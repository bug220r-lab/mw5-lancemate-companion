"""Original CPU-only, file-output component benchmark. No microphone or playback."""
import ctypes
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import socket
import sys
import time
import traceback

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / "companion" / "local" / "tts"
REPORT = PROJECT / "research" / "KOKORO_COMPONENT_BENCHMARK.json"
START = time.perf_counter()
for key, value in {
    "HF_HOME": str(ROOT / "hf-cache"), "HF_HUB_OFFLINE": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1", "TRANSFORMERS_OFFLINE": "1",
    "CUDA_VISIBLE_DEVICES": "-1", "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2",
    "PYTHONDONTWRITEBYTECODE": "1",
    "TEMP": str(ROOT / "tmp"), "TMP": str(ROOT / "tmp"),
}.items():
    os.environ[key] = value

network_attempts = []
def refuse_network(*args, **kwargs):
    network_attempts.append("BLOCKED_NETWORK_ATTEMPT")
    raise RuntimeError("This authored component benchmark prohibits network access.")
socket.create_connection = refuse_network
socket.socket.connect = refuse_network
socket.socket.connect_ex = refuse_network
socket.getaddrinfo = refuse_network

def sha(file):
    with Path(file).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def peak_memory():
    if os.name != "nt":
        return None
    class Counters(ctypes.Structure):
        _fields_ = [("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong)] + [
            (key, ctypes.c_size_t) for key in ("PeakWorkingSetSize", "WorkingSetSize",
                "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage",
                "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
    value = Counters(); value.cb = ctypes.sizeof(value)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = ctypes.c_void_p
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    psapi.GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.POINTER(Counters), ctypes.c_ulong]
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(value), value.cb):
        return None
    return value.PeakWorkingSetSize

result = {
    "schemaVersion": 1, "classification": "LOCAL_COMPONENT_BENCHMARK_NOT_GAMEPLAY",
    "status": "RUNNING", "timestampUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "python": sys.version, "platform": platform.platform(), "deviceRequested": "cpu",
    "microphoneCapture": False, "speakerPlayback": False, "gameOrEditorExecution": False,
    "paidApiCalls": 0, "userVoiceApproval": "NOT_PERFORMED",
    "latencyAlongsideGame": "NOT_PERFORMED", "samples": [],
}
try:
    asset_manifest = json.loads((ROOT / "manifests" / "assets.json").read_text(encoding="utf-8"))
    result["assetManifestSha256"] = sha(ROOT / "manifests" / "assets.json")
    result["setupBudgetSha256"] = sha(ROOT / "manifests" / "budget.json")
    result["installedManifestSha256"] = sha(ROOT / "manifests" / "installed.json")
    checked_assets = []
    for asset in asset_manifest["assets"]:
        if not asset["file"].startswith("models/"):
            continue
        filename = (ROOT / asset["file"]).resolve()
        if not filename.is_relative_to(ROOT.resolve()) or sha(filename) != asset["sha256"]:
            raise RuntimeError("Model asset path/hash mismatch")
        checked_assets.append({"file": asset["file"], "sha256": asset["sha256"], "bytes": filename.stat().st_size})
    result["verifiedModelAssets"] = checked_assets

    import numpy as np
    import torch
    import soundfile as sf
    import spacy
    import espeakng_loader
    if not spacy.util.is_package("en_core_web_sm"):
        raise RuntimeError("Required preinstalled en_core_web_sm is unavailable; downloads prohibited")
    if torch.version.cuda is not None or "+cpu" not in torch.__version__:
        raise RuntimeError("Expected the pinned CPU-only torch wheel")
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    from kokoro import KModel, KPipeline
    result["importsMs"] = round((time.perf_counter() - START) * 1000, 3)
    result["versions"] = {name: importlib.metadata.version(name) for name in
        ["kokoro", "misaki", "torch", "transformers", "huggingface-hub", "spacy",
         "en-core-web-sm", "soundfile", "espeakng-loader", "numpy", "num2words"]}
    result["torchThreads"] = torch.get_num_threads()
    result["torchInteropThreads"] = torch.get_num_interop_threads()
    result["espeakLibrary"] = espeakng_loader.get_library_path()
    if not Path(result["espeakLibrary"]).resolve().is_relative_to(ROOT.resolve()):
        raise RuntimeError("eSpeak resolved outside the isolated component")
    loaded_at = time.perf_counter()
    model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(ROOT / "models" / "config.json"),
                   model=str(ROOT / "models" / "kokoro-v1_0.pth")).to("cpu").eval()
    pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model, trf=False, device="cpu")
    if str(model.device) != "cpu" or pipeline.g2p.fallback is None:
        raise RuntimeError("CPU model and functioning eSpeak fallback are required")
    result["loadMs"] = round((time.perf_counter() - loaded_at) * 1000, 3)
    result["readyFromScriptStartMs"] = round((time.perf_counter() - START) * 1000, 3)
    result["deviceObserved"] = str(model.device)
    fixtures = [
        ("edge", "af_bella", "Radio check. Keep it tight. I didn't come here to babysit scrap."),
        ("tactician", "am_adam", "Radio check. 3 pilots, 1 channel. 120 meters."),
        ("scout", "af_heart", "Radio check. Two turns, then I'll quit talking. Probably."),
    ]
    for persona, voice, text in fixtures:
        begun = time.perf_counter(); cpu_begun = time.process_time(); first = None; audio = []; phonemes = []
        for item in pipeline(text, voice=str(ROOT / "models" / f"{voice}.pt"), speed=1):
            if first is None:
                first = time.perf_counter()
            if item.audio is None:
                raise RuntimeError("No synthesized audio")
            audio.append(item.audio.detach().cpu().numpy())
            phonemes.append(item.phonemes)
        elapsed = time.perf_counter() - begun
        cpu_elapsed = time.process_time() - cpu_begun
        if not audio:
            raise RuntimeError("Empty generation")
        waveform = np.concatenate(audio)
        if waveform.ndim != 1 or not np.isfinite(waveform).all() or len(waveform) < 2400:
            raise RuntimeError("Invalid synthesized waveform")
        filename = ROOT / "audio" / f"{persona}-{voice}-component.wav"
        sf.write(filename, waveform, 24000, subtype="PCM_16", format="WAV")
        info = sf.info(filename)
        if info.samplerate != 24000 or info.channels != 1 or info.frames != len(waveform):
            raise RuntimeError("WAV verification failed")
        duration = len(waveform) / 24000
        result["samples"].append({"personaId": persona, "voiceCandidate": voice,
            "fixtureKind": "ORIGINAL_AUTHORED_COMPONENT_TEXT_NOT_MISSION_FACTS", "text": text,
            "phonemes": phonemes, "firstChunkMs": round((first - begun) * 1000, 3),
            "synthesisMs": round(elapsed * 1000, 3), "processCpuMs": round(cpu_elapsed * 1000, 3),
            "audioDurationSeconds": round(duration, 4), "realTimeFactor": round(elapsed / duration, 4),
            "rawPeakAmplitude": float(np.abs(waveform).max()), "samplesBeyondPcmRange": int((np.abs(waveform) > 1).sum()),
            "wav": str(filename.relative_to(PROJECT)).replace("\\", "/"),
            "sampleRate": info.samplerate, "channels": info.channels, "frames": info.frames,
            "bytes": filename.stat().st_size, "sha256": sha(filename)})
    if network_attempts:
        raise RuntimeError("Unexpected blocked network attempts occurred")
    result["status"] = "PASS_LOCAL_CPU_FILE_SYNTHESIS_ONLY"
except Exception as error:
    result["status"] = "BLOCKED_COMPONENT_SETUP_OR_SYNTHESIS"
    result["errorType"] = type(error).__name__
    result["error"] = str(error)
    result["traceback"] = traceback.format_exc()
finally:
    result["networkAttemptsBlocked"] = len(network_attempts)
    result["peakProcessWorkingSetBytes"] = peak_memory()
    result["totalScriptMs"] = round((time.perf_counter() - START) * 1000, 3)
    result["ttsDirectoryBytes"] = sum(p.stat().st_size for p in ROOT.rglob("*") if p.is_file())
    REPORT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "report": str(REPORT),
        "samples": len(result["samples"]), "error": result.get("error")}, indent=2))
sys.exit(0 if result["status"] == "PASS_LOCAL_CPU_FILE_SYNTHESIS_ONLY" else 1)
