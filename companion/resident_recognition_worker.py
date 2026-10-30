"""Opt-in, private-pipe Whisper b5130 worker. Import/default CLI are inert.

Project protocol only: untrusted text, no microphone, listener, files of audio,
commands or game access. Production is Windows x64 only; tests inject an engine.
ABI: whisper.cpp 927cfce34f31707e17f2bff35c349632fb9e2c3a, whisper.h
SHA256 a7d19f7feb5be52426628ff07e0602de28a30dc4312d0d0603e1e536753f76dd.
"""
import base64
import ctypes as C
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import stat
import struct
import sys

MODE = "RESIDENT_PIPE_TRANSCRIPTION_ONLY"
MAX_LINE = 650000
MAX_RESPONSE = 8192
MAX_TEXT = 4096
MAX_ID = 9007199254740991
INVENTORY_SHA = "7bc2ffa17febb5ed6439cc285756cfe08fdb2a30852b4dd07e0010eae7500d7a"
DLL_SHA = "b7bb4ba92bd36b8afe0c00059ca6a0f69c6767193bfb5f0761e9ed27b1087803"
GGML_DLL_SHA = "c6e88687d6aa0238f2e834a87958f38d2dc96075a6a7bf6fb8b9cd728a0faed2"
MODEL = {"name": "ggml-base.en.bin", "bytes": 147964211,
         "sha256": "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002",
         "version": "5359861c739e955e79d9a303bcbc70fb988958b1"}
ARCHIVE = {"name": "whisper-bin-x64.zip", "bytes": 8573270,
           "sha256": "f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c",
           "version": "b5130"}
ARCHIVE_URL = "https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-x64.zip"
ERROR_CODES = frozenset(("INVALID_REQUEST", "FRAME_TOO_LARGE", "INVALID_WAV", "REPLAYED_ID",
    "UNSUPPORTED_PLATFORM", "ABI_MISMATCH", "INSTALLATION_REJECTED", "NATIVE_INIT_FAILED",
    "NATIVE_DECODE_FAILED", "INVALID_TRANSCRIPT", "RESPONSE_TOO_LARGE", "WORKER_FAILED"))


class WorkerError(Exception):
    def __init__(self, code):
        self.code = code if code in ERROR_CODES else "WORKER_FAILED"
        super().__init__(self.code)


# Complete structures used by the ABI. No _pack_: Windows x64 natural alignment.
class Ahead(C.Structure):
    _fields_ = [("n_text_layer", C.c_int), ("n_head", C.c_int)]


class Aheads(C.Structure):
    _fields_ = [("n_heads", C.c_size_t), ("heads", C.POINTER(Ahead))]


class ContextParams(C.Structure):
    _fields_ = [("use_gpu", C.c_bool), ("flash_attn", C.c_bool), ("gpu_device", C.c_int),
        ("dtw_token_timestamps", C.c_bool), ("dtw_aheads_preset", C.c_int),
        ("dtw_n_top", C.c_int), ("dtw_aheads", Aheads), ("dtw_mem_size", C.c_size_t)]


class TokenData(C.Structure):
    _fields_ = [("id", C.c_int32), ("tid", C.c_int32), ("p", C.c_float),
        ("plog", C.c_float), ("pt", C.c_float), ("ptsum", C.c_float),
        ("t0", C.c_int64), ("t1", C.c_int64), ("t_dtw", C.c_int64), ("vlen", C.c_float)]


class GrammarElement(C.Structure):
    _fields_ = [("type", C.c_int), ("value", C.c_uint32)]


class VadParams(C.Structure):
    _fields_ = [("threshold", C.c_float), ("min_speech_duration_ms", C.c_int),
        ("min_silence_duration_ms", C.c_int), ("max_speech_duration_s", C.c_float),
        ("speech_pad_ms", C.c_int), ("samples_overlap", C.c_float)]


class Greedy(C.Structure):
    _fields_ = [("best_of", C.c_int)]


class BeamSearch(C.Structure):
    _fields_ = [("beam_size", C.c_int), ("patience", C.c_float)]


NewSegmentCallback = C.CFUNCTYPE(None, C.c_void_p, C.c_void_p, C.c_int, C.c_void_p)
ProgressCallback = C.CFUNCTYPE(None, C.c_void_p, C.c_void_p, C.c_int, C.c_void_p)
EncoderBeginCallback = C.CFUNCTYPE(C.c_bool, C.c_void_p, C.c_void_p, C.c_void_p)
AbortCallback = C.CFUNCTYPE(C.c_bool, C.c_void_p)  # ggml.h:713, NOT ggml_abort_callback_t
LogitsFilterCallback = C.CFUNCTYPE(None, C.c_void_p, C.c_void_p, C.POINTER(TokenData),
                                 C.c_int, C.POINTER(C.c_float), C.c_void_p)
# ggml.h:2858 const char* represented as an opaque pointer: sink never reads logs.
LogCallback = C.CFUNCTYPE(None, C.c_int, C.c_void_p, C.c_void_p)
# whisper_log_set stores a library-global callback. Keep its thunk alive for
# the entire Python process, including constructor failure and engine teardown.
_PROCESS_LOG_SINK = LogCallback(lambda _level, _text, _data: None)
_SERVE_ACTIVATION = object()
# The native backend registry deliberately retains dynamic libraries because
# backend threads may still use their resources (pinned reg.cpp:176-181).
# Never call ggml_backend_unload or FreeLibrary during worker cleanup.
_PROCESS_NATIVE_LIBRARIES = []


class FullParams(C.Structure):
    _fields_ = [("strategy", C.c_int), ("n_threads", C.c_int), ("n_max_text_ctx", C.c_int),
        ("offset_ms", C.c_int), ("duration_ms", C.c_int), ("translate", C.c_bool),
        ("no_context", C.c_bool), ("no_timestamps", C.c_bool), ("single_segment", C.c_bool),
        ("print_special", C.c_bool), ("print_progress", C.c_bool), ("print_realtime", C.c_bool),
        ("print_timestamps", C.c_bool), ("token_timestamps", C.c_bool), ("thold_pt", C.c_float),
        ("thold_ptsum", C.c_float), ("max_len", C.c_int), ("split_on_word", C.c_bool),
        ("max_tokens", C.c_int), ("debug_mode", C.c_bool), ("audio_ctx", C.c_int),
        ("tdrz_enable", C.c_bool), ("suppress_regex", C.c_char_p), ("initial_prompt", C.c_char_p),
        ("carry_initial_prompt", C.c_bool), ("prompt_tokens", C.POINTER(C.c_int32)),
        ("prompt_n_tokens", C.c_int), ("language", C.c_char_p), ("detect_language", C.c_bool),
        ("suppress_blank", C.c_bool), ("suppress_nst", C.c_bool), ("temperature", C.c_float),
        ("max_initial_ts", C.c_float), ("length_penalty", C.c_float), ("temperature_inc", C.c_float),
        ("entropy_thold", C.c_float), ("logprob_thold", C.c_float), ("no_speech_thold", C.c_float),
        ("greedy", Greedy), ("beam_search", BeamSearch), ("new_segment_callback", NewSegmentCallback),
        ("new_segment_callback_user_data", C.c_void_p), ("progress_callback", ProgressCallback),
        ("progress_callback_user_data", C.c_void_p), ("encoder_begin_callback", EncoderBeginCallback),
        ("encoder_begin_callback_user_data", C.c_void_p), ("abort_callback", AbortCallback),
        ("abort_callback_user_data", C.c_void_p), ("logits_filter_callback", LogitsFilterCallback),
        ("logits_filter_callback_user_data", C.c_void_p),
        ("grammar_rules", C.POINTER(C.POINTER(GrammarElement))), ("n_grammar_rules", C.c_size_t),
        ("i_start_rule", C.c_size_t), ("grammar_penalty", C.c_float), ("vad", C.c_bool),
        ("vad_model_path", C.c_char_p), ("vad_params", VadParams)]


# Independent header-order arithmetic: bool1/int4/float4/int64+pointer+size_t8,
# align each field naturally, then round to max member alignment. These are
# expectations, not values derived from the ctypes classes being checked.
LAYOUTS = {
    Ahead: (8, 4, [0, 4]), Aheads: (16, 8, [0, 8]),
    ContextParams: (48, 8, [0, 1, 4, 8, 12, 16, 24, 40]),
    TokenData: (56, 8, [0, 4, 8, 12, 16, 20, 24, 32, 40, 48]),
    GrammarElement: (8, 4, [0, 4]), VadParams: (24, 4, [0, 4, 8, 12, 16, 20]),
    Greedy: (4, 4, [0]), BeamSearch: (8, 4, [0, 4]),
    FullParams: (304, 8, [0, 4, 8, 12, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28,
        32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 88, 96, 104, 112, 113, 114,
        116, 120, 124, 128, 132, 136, 140, 144, 148, 160, 168, 176, 184, 192, 200,
        208, 216, 224, 232, 240, 248, 256, 264, 268, 272, 280])}


def validate_abi(require_platform=True):
    if require_platform and (sys.platform != "win32" or platform.machine().lower() not in ("amd64", "x86_64")):
        raise WorkerError("UNSUPPORTED_PLATFORM")
    primitives = ((C.c_bool, 1), (C.c_int, 4), (C.c_float, 4), (C.c_void_p, 8),
                  (C.c_size_t, 8), (C.c_int64, 8))
    if sys.byteorder != "little" or any(C.sizeof(t) != n for t, n in primitives):
        raise WorkerError("ABI_MISMATCH")
    for cls, (size, alignment, offsets) in LAYOUTS.items():
        if (C.sizeof(cls) != size or C.alignment(cls) != alignment or
                [getattr(cls, name).offset for name, _ in cls._fields_] != offsets):
            raise WorkerError("ABI_MISMATCH")


PROTOTYPES = {
    "whisper_version": ([], C.c_void_p),
    "whisper_log_set": ([LogCallback, C.c_void_p], None),
    "whisper_context_default_params_by_ref": ([], C.POINTER(ContextParams)),
    "whisper_free_context_params": ([C.POINTER(ContextParams)], None),
    "whisper_init_from_file_with_params": ([C.c_char_p, ContextParams], C.c_void_p),
    "whisper_full_default_params_by_ref": ([C.c_int], C.POINTER(FullParams)),
    "whisper_free_params": ([C.POINTER(FullParams)], None),
    "whisper_full": ([C.c_void_p, FullParams, C.POINTER(C.c_float), C.c_int], C.c_int),
    "whisper_full_n_segments": ([C.c_void_p], C.c_int),
    "whisper_full_get_segment_text": ([C.c_void_p, C.c_int], C.c_void_p),
    "whisper_free": ([C.c_void_p], None)}
BACKEND_PROTOTYPES = {
    "ggml_backend_load_all_from_path": ([C.c_char_p], None),
    "ggml_backend_dev_by_type": ([C.c_int], C.c_void_p)}


def bind_library(library, prototypes=PROTOTYPES):
    try:
        for name, (args, result) in prototypes.items():
            function = getattr(library, name)
            function.argtypes, function.restype = args, result
    except (AttributeError, TypeError):
        raise WorkerError("ABI_MISMATCH") from None
    return library


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise WorkerError("INVALID_REQUEST")
        result[key] = value
    return result


def _decode_json(raw):
    return json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(WorkerError("INVALID_REQUEST")))


def _checked_path(root, path, directory=False):
    root, path = Path(root).absolute(), Path(path).absolute()
    if path != root and root not in path.parents:
        raise WorkerError("INSTALLATION_REJECTED")
    # lstat supported symlink/junction rejection, not a blanket claim about all
    # Windows reparse tags (ordinary OneDrive cloud metadata is not a junction).
    for item in [*reversed(path.parents), path]:
        info = item.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(item, "is_junction", lambda: False)():
            raise WorkerError("INSTALLATION_REJECTED")
        if item != path and not stat.S_ISDIR(info.st_mode):
            raise WorkerError("INSTALLATION_REJECTED")
    if os.path.normcase(str(path.resolve(strict=True))) != os.path.normcase(str(path)):
        raise WorkerError("INSTALLATION_REJECTED")
    if not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
        raise WorkerError("INSTALLATION_REJECTED")
    return path


def _read_verified(root, path, maximum, expected=None, retain=False):
    path = _checked_path(root, path)
    chunks, digest, count = [], hashlib.sha256(), 0
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if before.st_size > maximum or (expected and before.st_size != expected["bytes"]):
            raise WorkerError("INSTALLATION_REJECTED")
        while True:
            chunk = stream.read(min(1024 * 1024, maximum + 1 - count))
            if not chunk:
                break
            count += len(chunk)
            if count > maximum:
                raise WorkerError("INSTALLATION_REJECTED")
            digest.update(chunk)
            if retain:
                chunks.append(chunk)
        after = os.fstat(stream.fileno())
    current = _checked_path(root, path).stat()
    # Windows Python can report different ctime semantics through fstat versus
    # pathname stat. Compare ctime only within the same open handle; identity,
    # size and mtime must still agree across both APIs, in addition to the hash.
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    if (signature(before) != signature(after) or before.st_ctime_ns != after.st_ctime_ns or
            signature(before) != signature(current) or count != before.st_size):
        raise WorkerError("INSTALLATION_REJECTED")
    if expected and digest.hexdigest() != expected["sha256"]:
        raise WorkerError("INSTALLATION_REJECTED")
    return b"".join(chunks) if retain else digest.hexdigest()


def runtime_root():
    source = Path(__file__).absolute().parents[1]
    configured = os.environ.get("MW5_COMPANION_RUNTIME_ROOT")
    if configured is None:
        return source / "companion/local"  # Inert historical fixture compatibility only.
    path = Path(configured)
    if (not configured or configured.strip() != configured or not path.is_absolute() or
            configured.startswith(("\\\\", "//")) or ".." in path.parts or
            any(part.casefold() in ("librarycache", ".handoff", ".codex", "codex-runtimes") for part in path.parts) or
            path == source or source in path.parents or path in source.parents):
        raise WorkerError("INSTALLATION_REJECTED")
    return path


def verify_installation():
    """Fixed project-local paths only. No executable/model is loaded here."""
    try:
        root = Path(__file__).absolute().parents[1]
        lock = _decode_json(_read_verified(root, root / "companion/models.lock.json", 1048576, retain=True))
        raw = _read_verified(root, root / "companion/whisper-runtime-pins.json", 1048576, retain=True)
        if hashlib.sha256(raw).hexdigest() != INVENTORY_SHA:
            raise WorkerError("INSTALLATION_REJECTED")
        pins = _decode_json(raw)
        if lock.get("schemaVersion") != 1 or type(lock.get("artifacts")) is not list:
            raise WorkerError("INSTALLATION_REJECTED")
        for identity, pin in (("whisper-base-en", MODEL), ("whisper-cpu", ARCHIVE)):
            matches = [a for a in lock["artifacts"] if type(a) is dict and a.get("id") == identity]
            if len(matches) != 1 or any(matches[0].get(k) != v for k, v in pin.items()):
                raise WorkerError("INSTALLATION_REJECTED")
        if (pins.get("schemaVersion") != 1 or pins.get("artifact") != "whisper-cpu" or
                pins.get("version") != "b5130" or pins.get("archiveSha256") != ARCHIVE["sha256"] or
                pins.get("archiveBytes") != ARCHIVE["bytes"] or pins.get("source") != ARCHIVE_URL or
                type(pins.get("files")) is not list or len(pins["files"]) != 40):
            raise WorkerError("INSTALLATION_REJECTED")
        local = runtime_root()
        runtime = _checked_path(local, local / "runtimes/whisper-cpu-b5130/Release", True)
        names = set()
        for pin in pins["files"]:
            name = pin.get("name", "")
            if (not re.fullmatch(r"[A-Za-z0-9_-]+\.(dll|exe)", name, re.I) or name.lower() in names or
                    pin.get("archiveEntry") != "Release/" + name or type(pin.get("bytes")) is not int or
                    pin["bytes"] <= 0 or not re.fullmatch(r"[a-f0-9]{64}", pin.get("sha256", ""))):
                raise WorkerError("INSTALLATION_REJECTED")
            names.add(name.lower())
            _read_verified(local, runtime / name, pin["bytes"], pin)
        observed_names = set()
        with os.scandir(runtime) as entries:
            for index, entry in enumerate(entries):
                if index >= 40 or entry.name.lower() not in names or entry.name.lower() in observed_names:
                    raise WorkerError("INSTALLATION_REJECTED")
                observed_names.add(entry.name.lower())
        if observed_names != names:
            raise WorkerError("INSTALLATION_REJECTED")
        for name, digest in (("whisper.dll", DLL_SHA), ("ggml.dll", GGML_DLL_SHA)):
            dll_pin = [p for p in pins["files"] if p["name"] == name]
            if len(dll_pin) != 1 or dll_pin[0]["sha256"] != digest:
                raise WorkerError("INSTALLATION_REJECTED")
        for pin in (MODEL, ARCHIVE):
            _read_verified(local, local / "models" / pin["name"], pin["bytes"], pin)
        return runtime, local / "models" / MODEL["name"]
    except Exception:
        raise WorkerError("INSTALLATION_REJECTED") from None


def _bounded_c_string(pointer, maximum):
    if not pointer:
        raise WorkerError("INVALID_TRANSCRIPT")
    data = bytearray()
    view = C.cast(pointer, C.POINTER(C.c_ubyte))
    for index in range(maximum + 1):
        value = view[index]
        if value == 0:
            return bytes(data)
        data.append(value)
    raise WorkerError("INVALID_TRANSCRIPT")


def decode_wav(encoded):
    if type(encoded) is not str or len(encoded) > 640060:
        raise WorkerError("INVALID_WAV")
    try:
        raw = base64.b64decode(encoded, validate=True)
        if base64.b64encode(raw).decode("ascii") != encoded or not 3244 <= len(raw) <= 480044:
            raise ValueError()
        header = struct.unpack("<4sI4s4sIHHIIHH4sI", raw[:44])
        expected = (b"RIFF", len(raw) - 8, b"WAVE", b"fmt ", 16, 1, 1, 16000,
                    32000, 2, 16, b"data", len(raw) - 44)
        if header != expected or (len(raw) - 44) % 2:
            raise ValueError()
        return raw[44:]
    except (ValueError, TypeError, struct.error):
        raise WorkerError("INVALID_WAV") from None


class WhisperEngine:
    """Only main(--serve) constructs this with a real verified library.

    _library/_model are a code-only fake-function seam for offline ABI tests.
    The process is the cancellation boundary; no native interrupt is invented.
    """
    def __init__(self, *, _library=None, _backend=None, _model=None, _activation=None):
        self._context, self._dll_directory, self._library, self._backend = None, None, None, None
        self._log_sink = _PROCESS_LOG_SINK
        if _library is None and _activation is not _SERVE_ACTIVATION:
            raise WorkerError("INVALID_REQUEST")
        validate_abi(require_platform=_library is None)
        try:
            if _library is None:
                runtime, model = verify_installation()
                # Even load_all_from_path honors this override (reg.cpp:600-603).
                # Only this explicit dedicated-child path alters the environment.
                for key in tuple(os.environ):
                    if key.casefold() == "ggml_backend_path":
                        del os.environ[key]
                # Native backend discovery uses plain LoadLibraryW internally.
                # Limit its dependency search too, not only ctypes' own loads.
                # BOOL SetDefaultDllDirectories(DWORD): official Windows ABI.
                kernel32 = C.WinDLL("kernel32.dll", winmode=0x00000800, use_last_error=True)
                restrict = kernel32.SetDefaultDllDirectories
                restrict.argtypes, restrict.restype = [C.c_uint32], C.c_int32
                if not restrict(0x00000800 | 0x00000400):
                    raise WorkerError("NATIVE_INIT_FAILED")
                self._dll_directory = os.add_dll_directory(str(runtime))
                # C ABI / cdecl; absolute DLL plus its verified directory and System32.
                _backend = C.CDLL(str(runtime / "ggml.dll"), winmode=0x00000100 | 0x00000800 | 0x00000400)
                _PROCESS_NATIVE_LIBRARIES.append(_backend)
                _library = C.CDLL(str(runtime / "whisper.dll"), winmode=0x00000100 | 0x00000800 | 0x00000400)
                _PROCESS_NATIVE_LIBRARIES.append(_library)
            else:
                model = _model or "MOCK_ONLY"
                runtime = Path(__file__).absolute().parents[1] / "companion/local/runtimes/whisper-cpu-b5130/Release"
                _backend = _library if _backend is None else _backend
            self._library = bind_library(_library)
            self._backend = bind_library(_backend, BACKEND_PROTOTYPES)
            self._library.whisper_log_set(self._log_sink, None)
            # b5130 CLI loads backends before model init. Explicit non-null path
            # selects only candidates in the exact verified runtime directory.
            self._backend.ggml_backend_load_all_from_path(str(runtime).encode("utf-8"))
            if not self._backend.ggml_backend_dev_by_type(0):  # CPU enum, ggml-backend.h:134-136
                raise WorkerError("NATIVE_INIT_FAILED")
            version = _bounded_c_string(self._library.whisper_version(), 128).decode("ascii")
            if not re.fullmatch(r"[A-Za-z0-9._+ -]{1,128}", version):
                raise WorkerError("NATIVE_INIT_FAILED")
            self.native_version = version
            params = self._library.whisper_context_default_params_by_ref()
            if not params:
                raise WorkerError("NATIVE_INIT_FAILED")
            try:
                copy = ContextParams.from_buffer_copy(params.contents)
                copy.use_gpu = False
                copy.dtw_token_timestamps = False
                self._context = self._library.whisper_init_from_file_with_params(os.fsencode(model), copy)
            finally:
                self._library.whisper_free_context_params(params)
            if not self._context:
                raise WorkerError("NATIVE_INIT_FAILED")
        except Exception as error:
            try:
                self.close()
            except Exception:
                pass
            if isinstance(error, WorkerError):
                raise
            raise WorkerError("NATIVE_INIT_FAILED") from None

    def transcribe(self, pcm):
        if not self._context or type(pcm) is not bytes or len(pcm) % 2 or not 3200 <= len(pcm) <= 480000:
            raise WorkerError("INVALID_WAV")
        samples = (C.c_float * (len(pcm) // 2))(*(sample[0] / 32768.0 for sample in struct.iter_unpack("<h", pcm)))
        pointer = self._library.whisper_full_default_params_by_ref(0)  # GREEDY enum value in pinned header
        if not pointer:
            raise WorkerError("NATIVE_DECODE_FAILED")
        try:
            params = FullParams.from_buffer_copy(pointer.contents)
            params.n_threads, params.no_context, params.no_timestamps = 4, True, True
            params.translate, params.detect_language, params.token_timestamps = False, False, False
            params.language = b"en"
            params.initial_prompt, params.prompt_tokens, params.prompt_n_tokens = None, None, 0
            params.carry_initial_prompt = False
            params.print_special = params.print_progress = params.print_realtime = params.print_timestamps = False
            # No user callbacks, external VAD path, grammar or decoding prompt.
            # Other decoding defaults (sampling thresholds, beam/greedy values) stay intact.
            params.new_segment_callback = NewSegmentCallback()
            params.progress_callback = ProgressCallback()
            params.encoder_begin_callback = EncoderBeginCallback()
            params.abort_callback = AbortCallback()
            params.logits_filter_callback = LogitsFilterCallback()
            for name in ("new_segment_callback_user_data", "progress_callback_user_data",
                         "encoder_begin_callback_user_data", "abort_callback_user_data", "logits_filter_callback_user_data"):
                setattr(params, name, None)
            params.vad, params.vad_model_path = False, None
            if self._library.whisper_full(self._context, params, samples, len(samples)) != 0:
                raise WorkerError("NATIVE_DECODE_FAILED")
            count = self._library.whisper_full_n_segments(self._context)
            if type(count) is not int or not 0 <= count <= 4096:
                raise WorkerError("INVALID_TRANSCRIPT")
            parts, size = [], 0
            for index in range(count):
                value = _bounded_c_string(self._library.whisper_full_get_segment_text(self._context, index), MAX_TEXT - size)
                size += len(value)
                parts.append(value)
            return b"".join(parts).decode("utf-8", "strict").strip()
        except (UnicodeError, ValueError, OverflowError):
            raise WorkerError("INVALID_TRANSCRIPT") from None
        finally:
            self._library.whisper_free_params(pointer)

    def close(self):
        context, self._context = self._context, None
        try:
            if context and self._library:
                self._library.whisper_free(context)
        finally:
            if self._dll_directory is not None:
                self._dll_directory.close()
                self._dll_directory = None


def _send(stream, message):
    raw = (json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    if len(raw) > MAX_RESPONSE:
        raise WorkerError("RESPONSE_TOO_LARGE")
    written = stream.write(raw)
    if written is not None and written != len(raw):
        raise WorkerError("WORKER_FAILED")
    stream.flush()


def serve(input_stream, output_stream, engine_factory):
    """Binary JSON-lines loop. Explicit injected factory only; never defaults native.

    Returns zero on stop/EOF, one on any fixed-code error. Fatal protocol/native
    errors terminate rather than reusing an uncertain context. No request logging.
    """
    engine, identity, last_id = None, None, 0
    try:
        engine = engine_factory()
        version = engine.native_version
        if type(version) is not str or not re.fullmatch(r"[A-Za-z0-9._+ -]{1,128}", version):
            raise WorkerError("NATIVE_INIT_FAILED")
        _send(output_stream, {"v": 1, "type": "ready", "mode": MODE, "nativeVersion": version})
        while True:
            identity = None
            line = input_stream.readline(MAX_LINE + 1)
            if line == b"":
                return 0
            if type(line) is not bytes or len(line) > MAX_LINE:
                raise WorkerError("FRAME_TOO_LARGE")
            if not line.endswith(b"\n"):
                raise WorkerError("INVALID_REQUEST")
            try:
                request = _decode_json(line)
            except Exception:
                raise WorkerError("INVALID_REQUEST") from None
            if type(request) is not dict or type(request.get("v")) is not int or request["v"] != 1:
                raise WorkerError("INVALID_REQUEST")
            if request.get("type") == "stop" and set(request) == {"v", "type"}:
                return 0
            value = request.get("id")
            if type(value) is int and 1 <= value <= MAX_ID:
                identity = value
            if request.get("type") != "transcribe" or set(request) != {"v", "type", "id", "wav"} or identity is None:
                raise WorkerError("INVALID_REQUEST")
            if identity <= last_id:
                raise WorkerError("REPLAYED_ID")
            pcm = decode_wav(request["wav"])
            last_id = identity
            text = engine.transcribe(pcm)
            if type(text) is not str or not text.strip() or "\0" in text:
                raise WorkerError("INVALID_TRANSCRIPT")
            try:
                if len(text.encode("utf-8", "strict")) > MAX_TEXT:
                    raise WorkerError("INVALID_TRANSCRIPT")
            except UnicodeError:
                raise WorkerError("INVALID_TRANSCRIPT") from None
            _send(output_stream, {"v": 1, "type": "result", "id": identity, "text": text})
    except Exception as error:
        code = error.code if isinstance(error, WorkerError) else "WORKER_FAILED"
        try:
            _send(output_stream, {"v": 1, "type": "error", "id": identity, "code": code})
        except Exception:
            pass
        return 1
    finally:
        if engine is not None:
            try:
                engine.close()
            except Exception:
                try:
                    _send(output_stream, {"v": 1, "type": "error", "id": None, "code": "WORKER_FAILED"})
                except Exception:
                    pass
                return 1  # Parent independently confirms owned process termination.


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args != ["--serve"]:
        return 0 if not args else 2
    if "MW5_COMPANION_RUNTIME_ROOT" not in os.environ:
        return 2
    # Save the inherited protocol pipe before redirecting native stdout to stderr.
    # No listener, audio file, or native worker starts on import/default invocation.
    with os.fdopen(os.dup(sys.stdout.fileno()), "wb", buffering=0) as protocol:
        os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
        return serve(sys.stdin.buffer, protocol, lambda: WhisperEngine(_activation=_SERVE_ACTIVATION))


if __name__ == "__main__":
    raise SystemExit(main())
