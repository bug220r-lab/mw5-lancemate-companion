"""Project-owned persistent CPU TTS worker; private NDJSON pipes, no audio device."""
import contextlib
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sys
import time

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / "companion" / "local" / "tts"
OUTPUT = PROJECT / "companion" / "local" / "speech-output"
VOICES = ("af_bella", "am_adam", "af_heart")
LIMIT = 64 * 1024**2
PROTOCOL = sys.stdout
START = time.perf_counter()
os.environ.update({"HF_HOME": str(ROOT / "hf-cache"), "HF_HUB_OFFLINE": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1", "TRANSFORMERS_OFFLINE": "1",
    "CUDA_VISIBLE_DEVICES": "-1", "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2",
    "TEMP": str(ROOT / "tmp"), "TMP": str(ROOT / "tmp")})

def refuse_network(*args, **kwargs):
    raise RuntimeError("NETWORK_PROHIBITED")

socket.create_connection = refuse_network
socket.socket.connect = refuse_network
socket.socket.connect_ex = refuse_network
socket.getaddrinfo = refuse_network

def send(message):
    PROTOCOL.write(json.dumps(message, ensure_ascii=True) + "\n")
    PROTOCOL.flush()

def sha(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def output_directory():
    OUTPUT.mkdir(exist_ok=True)
    if OUTPUT.is_symlink() or OUTPUT.resolve() != OUTPUT.absolute():
        raise RuntimeError("OUTPUT_PATH_UNSAFE")
    if any(item.is_symlink() for item in OUTPUT.iterdir()):
        raise RuntimeError("OUTPUT_REPARSE_POINT")
    used = sum(item.stat().st_size for item in OUTPUT.iterdir() if item.is_file())
    if used + 3 * 1024**2 > LIMIT or shutil.disk_usage(OUTPUT).free < 10 * 1024**3 + 3 * 1024**2:
        raise RuntimeError("OUTPUT_DISK_BUDGET")

try:
    with contextlib.redirect_stdout(sys.stderr):
        pins = {
            "kokoro-v1_0.pth": "496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4",
            "config.json": "5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f",
            "af_bella.pt": "8cb64e02fcc8de0327a8e13817e49c76c945ecf0052ceac97d3081480e8e48d6",
            "am_adam.pt": "ced7e284aba12472891be1da3ab34db84cc05cc02b5889535796dbf2d8b0cb34",
            "af_heart.pt": "0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff",
        }
        for name, digest in pins.items():
            file = ROOT / "models" / name
            if not file.resolve().is_relative_to(ROOT.resolve()) or sha(file) != digest:
                raise RuntimeError("MODEL_HASH_MISMATCH")
        import numpy as np
        import soundfile as sf
        import spacy
        import torch
        import espeakng_loader
        versions = {name: importlib.metadata.version(name) for name in
            ("kokoro", "misaki", "torch", "spacy", "en-core-web-sm", "typer", "click")}
        if versions["kokoro"] != "0.9.4" or versions["misaki"] != "0.9.4" or versions["torch"] != "2.6.0+cpu":
            raise RuntimeError("RUNTIME_VERSION_MISMATCH")
        if torch.version.cuda is not None or not spacy.util.is_package("en_core_web_sm"):
            raise RuntimeError("LOCAL_CPU_RUNTIME_UNAVAILABLE")
        if not Path(espeakng_loader.get_library_path()).resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError("ESPEAK_PATH_MISMATCH")
        torch.set_num_threads(2)
        torch.set_num_interop_threads(1)
        from kokoro import KModel, KPipeline
        model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(ROOT / "models" / "config.json"),
            model=str(ROOT / "models" / "kokoro-v1_0.pth")).to("cpu").eval()
        pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model, trf=False, device="cpu")
        if str(model.device) != "cpu" or pipeline.g2p.fallback is None:
            raise RuntimeError("CPU_OR_ESPEAK_NOT_READY")
        output_directory()
    send({"type": "ready", "protocol": 1, "device": "cpu", "voices": list(VOICES),
        "startupMs": round((time.perf_counter() - START) * 1000, 3), "versions": versions,
        "assetManifestSha256": sha(ROOT / "manifests" / "assets.json"),
        "installedManifestSha256": sha(ROOT / "manifests" / "installed.json"),
        "microphoneCapture": False, "speakerPlayback": False})
except Exception as error:
    send({"type": "fatal", "error": type(error).__name__ + ": " + str(error)})
    sys.exit(1)

while True:
    line = sys.stdin.buffer.readline(8193)
    if not line:
        break
    if len(line) > 8192 or not line.endswith(b"\n"):
        send({"type": "fatal", "error": "INPUT_FRAME_TOO_LARGE"})
        sys.exit(1)
    request_id = None
    partial = None
    try:
        request = json.loads(line.decode("utf-8"))
        if not isinstance(request, dict) or set(request) != {"id", "text", "voiceId"}:
            raise ValueError("INVALID_REQUEST_FIELDS")
        request_id = request["id"]
        if not isinstance(request_id, str) or not re.fullmatch(r"[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}", request_id):
            raise ValueError("INVALID_REQUEST_ID")
        text, voice = request["text"], request["voiceId"]
        if not isinstance(text, str) or not text.strip() or len(text) > 256 or any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in text):
            raise ValueError("INVALID_TEXT")
        if voice not in VOICES:
            raise ValueError("INVALID_VOICE")
        output_directory()
        begun = time.perf_counter(); cpu_begun = time.process_time(); first = None; chunks = []
        with contextlib.redirect_stdout(sys.stderr):
            for item in pipeline(text, voice=str(ROOT / "models" / (voice + ".pt")), speed=1):
                if first is None:
                    first = time.perf_counter()
                if item.audio is None:
                    raise RuntimeError("EMPTY_AUDIO")
                chunks.append(item.audio.detach().cpu().numpy())
                if sum(len(chunk) for chunk in chunks) > 60 * 24000:
                    raise RuntimeError("AUDIO_DURATION_LIMIT")
        waveform = np.concatenate(chunks) if chunks else np.array([])
        if waveform.ndim != 1 or len(waveform) < 2400 or not np.isfinite(waveform).all():
            raise RuntimeError("INVALID_WAVEFORM")
        partial = OUTPUT / (request_id + ".part")
        final = OUTPUT / (request_id + ".wav")
        if final.exists():
            raise RuntimeError("OUTPUT_ALREADY_EXISTS")
        # Exclusive creation prevents replacing a file even if an ID is repeated.
        with partial.open("xb") as stream:
            sf.write(stream, waveform, 24000, subtype="PCM_16", format="WAV")
        partial.rename(final)
        elapsed = (time.perf_counter() - begun) * 1000
        send({"type": "result", "id": request_id, "fileName": final.name, "voiceId": voice,
            "firstAudioMs": round((first - begun) * 1000, 3), "synthesisMs": round(elapsed, 3),
            "processCpuMs": round((time.process_time() - cpu_begun) * 1000, 3),
            "audioDurationSeconds": len(waveform) / 24000, "sampleRate": 24000,
            "channels": 1, "bytes": final.stat().st_size, "sha256": sha(final)})
    except Exception as error:
        if partial is not None and partial.exists():
            partial.unlink()
        send({"type": "error", "id": request_id, "error": type(error).__name__ + ": " + str(error)})
