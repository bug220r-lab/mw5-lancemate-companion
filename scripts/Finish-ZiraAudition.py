"""Build clean/radio listening reels from local Zira WAVs. No network or playback."""
import hashlib
import json
import math
from pathlib import Path
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audio" / "zira-audition-001"
SPEC_PATH = ROOT / "synthetic" / "zira-audition.json"
SPEC = json.loads(SPEC_PATH.read_text(encoding="utf-8-sig"))
FS = SPEC["sample_rate"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_pcm(path):
    with wave.open(str(path), "rb") as wav:
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, FS)
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float64) / 32768


def band_filter(signal, cutoff, highpass):
    # Butterworth biquad, direct form II transposed, zero initial state.
    omega = 2 * math.pi * cutoff / FS
    c = math.cos(omega)
    alpha = math.sin(omega) / math.sqrt(2)
    if highpass:
        b0, b1, b2 = (1 + c) / 2, -(1 + c), (1 + c) / 2
    else:
        b0, b1, b2 = (1 - c) / 2, 1 - c, (1 - c) / 2
    a0 = 1 + alpha
    b0, b1, b2, a1, a2 = (v / a0 for v in (b0, b1, b2, -2 * c, 1 - alpha))
    result = np.empty_like(signal)
    z1 = z2 = 0.0
    for i, sample in enumerate(signal):
        y = b0 * sample + z1
        z1 = b1 * sample - a1 * y + z2
        z2 = b2 * sample - a2 * y
        result[i] = y
    return result


def level(signal):
    # Match active-speech RMS, retaining at least 3 dB sample-peak headroom.
    assert np.isfinite(signal).all()
    active = signal[np.abs(signal) > 0.002]
    assert active.size > FS // 10, "No substantial audio in clip"
    rms = np.sqrt(np.mean(active * active))
    gain = min(10 ** (-22 / 20) / rms, 10 ** (-3 / 20) / np.max(np.abs(signal)))
    return signal * gain


def write_pcm(path, signal):
    assert not path.exists(), f"Preserve existing artifact: {path}"
    assert np.isfinite(signal).all() and 0 < np.max(np.abs(signal)) < 0.95
    pcm = np.rint(signal * 32767).astype("<i2")
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(FS)
        wav.writeframes(pcm.tobytes())
    # Reopen each file to verify its header and sample payload.
    checked = read_pcm(path)
    assert len(checked) == len(signal)
    assert not np.any(np.abs(checked) >= 0.999)
    return {
        "path": str(path.relative_to(OUT)).replace("\\", "/"),
        "duration_seconds": round(len(checked) / FS, 3),
        "sample_rate": FS, "channels": 1, "bits_per_sample": 16,
        "peak_dbfs": round(20 * math.log10(np.max(np.abs(checked))), 2),
        "clipped_samples": int(np.sum(np.abs(checked) >= 0.999)),
        "sha256": sha(path),
    }


def main():
    generation = json.loads((OUT / "generation.json").read_text(encoding="utf-8-sig"))
    assert generation["manifest_sha256"].lower() == sha(SPEC_PATH)
    assert len(generation["files"]) == 6
    for item in generation["files"]:
        assert sha(OUT / item["path"]) == item["sha256"].lower()
    clean_parts, radio_parts, files, timeline = [], [], [], []
    pad = np.zeros(round(FS * 0.12))
    gap = np.zeros(round(FS * 0.8))
    # An original quiet 25 ms transmission pip; no game audio is used.
    t = np.arange(round(FS * 0.025)) / FS
    pip = 0.035 * np.sin(2 * np.pi * 1750 * t) * np.sin(np.linspace(0, np.pi, len(t))) ** 2
    position = 0
    for line in SPEC["lines"]:
        raw = read_pcm(OUT / "raw" / (line["id"] + ".wav"))
        assert FS * 0.3 < len(raw) < FS * 20
        clean_voice = level(raw)
        filtered = band_filter(clean_voice, 250, True)
        filtered = band_filter(filtered, 3600, False)
        radio_voice = level(np.tanh(filtered * 1.6) / 1.6)
        clean = np.concatenate((pad, clean_voice, pad))
        radio = np.concatenate((pad, radio_voice, pad))
        radio[:len(pip)] += pip
        radio[-len(pip):] += pip * 0.6
        assert len(clean) == len(radio)
        files.append(write_pcm(OUT / (line["id"] + "-clean.wav"), clean))
        files.append(write_pcm(OUT / (line["id"] + "-radio.wav"), radio))
        timeline.append({"id": line["id"], "start_seconds": round(position / FS, 3),
                         "end_seconds": round((position + len(clean)) / FS, 3),
                         "text": line["text"], "context": line["context"]})
        clean_parts.append(clean)
        radio_parts.append(radio)
        position += len(clean)
        if line != SPEC["lines"][-1]:
            clean_parts.append(gap)
            radio_parts.append(gap)
            position += len(gap)
    files.append(write_pcm(OUT / "zira-clean.wav", np.concatenate(clean_parts)))
    files.append(write_pcm(OUT / "zira-radio.wav", np.concatenate(radio_parts)))
    report = {
        "status": "LOCAL_AUDIO_GENERATED_FILE_CHECKS_PASS",
        "voice": generation["voice"], "api_requests": 0, "api_fees_usd": 0,
        "manifest_sha256": sha(SPEC_PATH),
        "generation_record_sha256": sha(OUT / "generation.json"),
        "filter": {"highpass_hz": 250, "lowpass_hz": 3600, "order_each": 2,
                   "compression": "gentle tanh soft saturation, gain 1.6",
                   "active_rms_target_dbfs": -22, "sample_peak_ceiling_dbfs": -3,
                   "transmission_pip": "original 25 ms sine, 1750 Hz, quiet level"},
        "comparison": "Identical synthesis, phrasing, rate and timing in clean/radio versions.",
        "listening_acceptance": "NOT_PERFORMED; user will audition",
        "pronunciation_and_intelligibility_review": "NOT_PERFORMED; no listening/transcription tool available",
        "in_game_latency_and_integration": "NOT_PERFORMED",
        "permanent_voice_selection": None, "timeline": timeline, "files": files,
    }
    report_path = OUT / "audio-checks.json"
    assert not report_path.exists()
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "duration_seconds": files[-1]["duration_seconds"],
                      "processed_files": len(files), "voice": generation["voice"],
                      "api_fees_usd": 0, "listening_acceptance": "NOT_PERFORMED"}))


if __name__ == "__main__":
    main()
