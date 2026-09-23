"""MOCK_ONLY offline worker tests; no Whisper DLL, model, network or audio device."""
import base64
import ctypes as C
import hashlib
import gc
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import unittest
import weakref
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[1]
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("resident_worker", ROOT / "companion/resident_recognition_worker.py")
worker = importlib.util.module_from_spec(SPEC)
with patch.object(C, "CDLL", side_effect=AssertionError("NATIVE_LOAD_FORBIDDEN")):
    SPEC.loader.exec_module(worker)


def wave(samples=1600, first=-32768):
    data = struct.pack("<h", first) + bytes(samples * 2 - 2)
    return struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", len(data) + 36, b"WAVE", b"fmt ",
                       16, 1, 1, 16000, 32000, 2, 16, b"data", len(data)) + data


def request(identity=1, raw=None):
    return {"v": 1, "type": "transcribe", "id": identity,
            "wav": base64.b64encode(wave() if raw is None else raw).decode("ascii")}


def lines(*messages):
    return b"".join((json.dumps(m) + "\n").encode() for m in messages)


class Engine:
    native_version = "MOCK_ONLY-b5130"

    def __init__(self, output="Heard you."):
        self.calls, self.closed, self.output = [], 0, output

    def transcribe(self, pcm):
        self.calls.append(pcm)
        if isinstance(self.output, Exception):
            raise self.output
        return self.output

    def close(self):
        self.closed += 1


def exercise(raw, engine=None):
    engine = Engine() if engine is None else engine
    output = io.BytesIO()
    with patch.object(C, "CDLL", side_effect=AssertionError("NATIVE_LOAD_FORBIDDEN")):
        result = worker.serve(io.BytesIO(raw), output, lambda: engine)
    return result, [json.loads(line) for line in output.getvalue().splitlines()], engine


class Function:
    def __init__(self, implementation):
        self.implementation = implementation

    def __call__(self, *args):
        return self.implementation(*args)


class Library:
    def __init__(self):
        self.buffers = [C.create_string_buffer(b"MOCK_ONLY-b5130"), C.create_string_buffer(b" Heard "),
                        C.create_string_buffer(b"you.")]
        self.allocations, self.active_params, self.calls, self.freed_contexts = [], set(), [], []
        self.defaults_count, self.free_params_count, self.context_free_count = 0, 0, 0
        self.backend_loaded, self.backend_paths = False, []
        self.context = worker.ContextParams()
        self.context.use_gpu = True
        self.context.dtw_token_timestamps = True
        functions = {
            "ggml_backend_load_all_from_path": self.load_backend,
            "ggml_backend_dev_by_type": self.cpu,
            "whisper_version": lambda: C.addressof(self.buffers[0]),
            "whisper_log_set": self.set_log,
            "whisper_context_default_params_by_ref": lambda: C.pointer(self.context),
            "whisper_free_context_params": self.free_context_params,
            "whisper_init_from_file_with_params": self.initialize,
            "whisper_full_default_params_by_ref": self.defaults,
            "whisper_free_params": self.free_params,
            "whisper_full": self.full,
            "whisper_full_n_segments": lambda _: 2,
            "whisper_full_get_segment_text": self.segment,
            "whisper_free": lambda ctx: self.freed_contexts.append(ctx)}
        for name, function in functions.items():
            setattr(self, name, Function(function))

    def set_log(self, callback, user):
        self.log = callback

    def load_backend(self, path):
        assert hasattr(self, "log"), "logging sink must be installed before backend discovery"
        self.backend_paths.append(path)
        self.backend_loaded = True

    def cpu(self, kind):
        assert self.backend_loaded and kind == 0
        return 0xABCDEF987654

    def initialize(self, model, params):
        assert self.context_free_count == 0
        assert self.backend_loaded
        assert params.use_gpu is False and params.dtw_token_timestamps is False
        assert model == b"MOCK_ONLY"
        return 0x123456789ABC

    def free_context_params(self, _):
        self.context_free_count += 1

    def defaults(self, strategy):
        assert strategy == 0
        self.defaults_count += 1
        params = worker.FullParams()
        params.n_threads, params.translate, params.detect_language = 99, True, True
        params.temperature, params.greedy.best_of = 0.375, 7
        params.initial_prompt, params.carry_initial_prompt = b"OLD PROMPT", True
        params.prompt_tokens = C.pointer(C.c_int32(42))
        params.prompt_n_tokens = 1
        pointer = C.pointer(params)
        self.allocations.append((params, pointer))
        self.active_params.add(C.addressof(params))
        return pointer

    def full(self, ctx, params, pcm, count):
        assert self.active_params
        self.calls.append({"ctx": ctx, "params": worker.FullParams.from_buffer_copy(params),
                           "first": pcm[0], "count": count})
        return 0

    def segment(self, _, index):
        assert self.active_params, "default allocation was freed before text copied"
        return C.addressof(self.buffers[index + 1])

    def free_params(self, pointer):
        self.active_params.remove(C.addressof(pointer.contents))
        self.free_params_count += 1


class ProtocolTests(unittest.TestCase):
    def test_import_and_default_invocation_are_inert(self):
        with patch.object(C, "CDLL", side_effect=AssertionError("NO_NATIVE")):
            self.assertRaisesRegex(worker.WorkerError, "INVALID_REQUEST", worker.WhisperEngine)
        with patch.object(worker, "WhisperEngine", side_effect=AssertionError("NO_ENGINE")):
            self.assertEqual(worker.main([]), 0)
            for args in (["--model", "x"], ["--serve", "--threads", "8"], ["--check"]):
                self.assertEqual(worker.main(args), 2)

    def test_sequential_jobs_are_correlated_and_stop_closes_once(self):
        code, output, engine = exercise(lines(request(1), request(9), {"v": 1, "type": "stop"}, request(10)))
        self.assertEqual(code, 0)
        self.assertEqual(output[0], {"v": 1, "type": "ready", "mode": worker.MODE, "nativeVersion": "MOCK_ONLY-b5130"})
        self.assertEqual([m["id"] for m in output[1:]], [1, 9])
        self.assertEqual(engine.calls, [wave()[44:]] * 2)
        self.assertEqual(engine.closed, 1)

    def test_eof_closes_owned_context(self):
        code, output, engine = exercise(b"")
        self.assertEqual((code, len(output), engine.closed), (0, 1, 1))

    def test_replay_out_of_order_and_bool_id_never_decode(self):
        for bad in (1, 0, True, 1.0, -1, worker.MAX_ID + 1, "2"):
            with self.subTest(bad=bad):
                code, output, engine = exercise(lines(request(1), request(bad), request(3)))
                self.assertEqual((code, len(engine.calls), engine.closed), (1, 1, 1))
                self.assertEqual(output[-1]["type"], "error")

    def test_bad_envelopes_and_duplicate_keys_never_decode(self):
        bad = [b'{"v":1,"v":1,"type":"stop"}\n', b'{"v":NaN,"type":"stop"}\n', b'[]\n',
               b'\xff\n', b'\n', b'{"v":1,"type":"stop"}', lines({"v": True, "type": "stop"}),
               lines(dict(request(), model="arbitrary")), lines({"v": 1, "type": "stop", "id": 1})]
        for raw in bad:
            with self.subTest(raw=raw[:60]):
                code, output, engine = exercise(raw)
                self.assertEqual((code, engine.calls, engine.closed), (1, [], 1))
                self.assertEqual(output[-1]["code"], "INVALID_REQUEST")

    def test_line_limit_bounded_read_and_rejects_before_decode(self):
        class Bounded(io.BytesIO):
            def readline(self, size=-1):
                self.assert_size = size
                assert size == worker.MAX_LINE + 1
                return super().readline(size)
        source, output, engine = Bounded(b"x" * (worker.MAX_LINE + 50)), io.BytesIO(), Engine()
        self.assertEqual(worker.serve(source, output, lambda: engine), 1)
        self.assertEqual(source.tell(), worker.MAX_LINE + 1)
        self.assertIn(b'"code":"FRAME_TOO_LARGE"', output.getvalue())
        self.assertEqual(engine.calls, [])

    def test_canonical_wav_limits_and_exact_sample_bytes(self):
        for count in (1600, 240000):
            self.assertEqual(worker.decode_wav(base64.b64encode(wave(count)).decode()), wave(count)[44:])
        for count in (1599, 240001):
            with self.assertRaisesRegex(worker.WorkerError, "INVALID_WAV"):
                worker.decode_wav(base64.b64encode(wave(count)).decode())
        for offset, data in ((0, b"RF64"), (16, struct.pack("<I", 18)), (22, b"\x02\0"),
                             (24, struct.pack("<I", 48000)), (34, b"\x08\0"), (36, b"JUNK")):
            raw = bytearray(wave()); raw[offset:offset + len(data)] = data
            with self.assertRaisesRegex(worker.WorkerError, "INVALID_WAV"):
                worker.decode_wav(base64.b64encode(raw).decode())

    def test_base64_is_exact_not_whitespace_or_noncanonical_pad(self):
        encoded = base64.b64encode(wave()).decode()
        for bad in (encoded + "\n", " " + encoded, encoded.rstrip("="), "!", None, 5):
            with self.assertRaisesRegex(worker.WorkerError, "INVALID_WAV"):
                worker.decode_wav(bad)

    def test_transcript_utf8_and_response_limits(self):
        for text in ("é" * 2049, "", "\x00x", "\ud800", 123, "\x01" * 4096):
            code, output, engine = exercise(lines(request()), Engine(text))
            self.assertEqual((code, engine.closed), (1, 1))
            self.assertNotIn("result", [x["type"] for x in output])
            self.assertIn(output[-1]["code"], ("INVALID_TRANSCRIPT", "RESPONSE_TOO_LARGE"))
        code, output, _ = exercise(lines(request()), Engine("é" * 2048))
        self.assertEqual((code, len(output[-1]["text"].encode())), (0, 4096))

    def test_fixed_errors_do_not_dump_native_details(self):
        code, output, engine = exercise(lines(request()), Engine(RuntimeError("secret path/audio")))
        self.assertEqual((code, engine.closed), (1, 1))
        self.assertEqual(output[-1], {"v": 1, "type": "error", "id": 1, "code": "WORKER_FAILED"})

    def test_broken_output_and_close_failure_are_fatal(self):
        class Broken(io.BytesIO):
            def write(self, _):
                raise BrokenPipeError()
        engine = Engine()
        self.assertEqual(worker.serve(io.BytesIO(b""), Broken(), lambda: engine), 1)
        self.assertEqual(engine.closed, 1)
        engine = Engine()
        engine.close = lambda: (_ for _ in ()).throw(RuntimeError("untrusted detail"))
        code, output, _ = exercise(b"", engine)
        self.assertEqual(code, 1)
        self.assertEqual(output[-1]["code"], "WORKER_FAILED")


class AbiTests(unittest.TestCase):
    def test_layout_and_platform_fail_closed(self):
        worker.validate_abi(False)
        with patch.object(worker.sys, "platform", "linux"):
            self.assertRaisesRegex(worker.WorkerError, "UNSUPPORTED_PLATFORM", worker.validate_abi)
        with patch.object(worker.C, "sizeof", return_value=1):
            self.assertRaisesRegex(worker.WorkerError, "ABI_MISMATCH", worker.validate_abi, False)

    def test_header_pin_all_full_fields_order_and_key_prototypes(self):
        raw = (ROOT / "tmp/resident-whisper-source-b5130/whisper.h").read_bytes()
        self.assertEqual(len(raw), 37439)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "a7d19f7feb5be52426628ff07e0602de28a30dc4312d0d0603e1e536753f76dd")
        header = raw.decode()
        body = header[header.index("    struct whisper_full_params {"):header.index("    // NOTE: this function allocates memory")]
        positions = []
        import re
        for name, _ in worker.FullParams._fields_:
            match = re.search(r"\b" + re.escape(name) + r"\s*(?:;|\[)", body)
            self.assertIsNotNone(match, name)
            positions.append(match.start())
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(C.sizeof(worker.FullParams), 304)
        self.assertEqual(worker.FullParams.vad_params.offset, 280)
        self.assertIs(worker.PROTOTYPES["whisper_full"][0][1], worker.FullParams)
        self.assertIs(worker.PROTOTYPES["whisper_init_from_file_with_params"][0][1], worker.ContextParams)
        for name in ("whisper_free", "whisper_free_params", "whisper_free_context_params", "whisper_log_set"):
            self.assertIsNone(worker.PROTOTYPES[name][1])

    def test_fresh_params_no_context_carry_and_owned_free(self):
        library = Library()
        with patch.object(C, "CDLL", side_effect=AssertionError("NO_NATIVE")):
            engine = worker.WhisperEngine(_library=library)
            self.assertEqual(engine.transcribe(wave()[44:]), "Heard you.")
            self.assertEqual(engine.transcribe(wave(first=32767)[44:]), "Heard you.")
            engine.close(); engine.close()
        self.assertEqual((library.defaults_count, library.free_params_count, library.context_free_count), (2, 2, 1))
        self.assertEqual(library.freed_contexts, [0x123456789ABC])
        for call in library.calls:
            p = call["params"]
            self.assertEqual((p.n_threads, p.no_context, p.no_timestamps, p.language), (4, True, True, b"en"))
            self.assertFalse(p.translate or p.detect_language or p.token_timestamps or p.carry_initial_prompt)
            self.assertEqual((p.initial_prompt, bool(p.prompt_tokens), p.prompt_n_tokens), (None, False, 0))
            self.assertEqual((p.temperature, p.greedy.best_of), (0.375, 7))
            self.assertFalse(p.print_special or p.print_progress or p.print_realtime or p.print_timestamps)
            self.assertEqual(call["count"], 1600)
        self.assertEqual(library.calls[0]["first"], -1.0)
        self.assertAlmostEqual(library.calls[1]["first"], 32767 / 32768)

    def test_native_failure_frees_params_without_result(self):
        library = Library()
        library.whisper_full = Function(lambda *_: 9)
        engine = worker.WhisperEngine(_library=library)
        with self.assertRaisesRegex(worker.WorkerError, "NATIVE_DECODE_FAILED"):
            engine.transcribe(wave()[44:])
        engine.close()
        self.assertEqual(library.free_params_count, 1)
        self.assertEqual(library.freed_contexts, [0x123456789ABC])

    def test_missing_export_and_null_initialization_fail(self):
        library = Library(); del library.whisper_full
        self.assertRaisesRegex(worker.WorkerError, "ABI_MISMATCH", worker.WhisperEngine, _library=library)
        library = Library(); del library.ggml_backend_load_all_from_path
        self.assertRaisesRegex(worker.WorkerError, "ABI_MISMATCH", worker.WhisperEngine, _library=library)
        self.assertEqual(library.context_free_count, 0)
        library = Library(); library.whisper_init_from_file_with_params = Function(lambda *_: None)
        self.assertRaisesRegex(worker.WorkerError, "NATIVE_INIT_FAILED", worker.WhisperEngine, _library=library)
        self.assertEqual(library.context_free_count, 1)

    def test_global_log_thunk_survives_engine_and_failed_constructor(self):
        library = Library()
        engine = worker.WhisperEngine(_library=library)
        callback = weakref.ref(engine._log_sink)
        address = C.cast(engine._log_sink, C.c_void_p).value
        engine.close(); del engine; del library; gc.collect()
        self.assertIsNotNone(callback())
        self.assertEqual(C.cast(worker._PROCESS_LOG_SINK, C.c_void_p).value, address)
        library = Library(); library.whisper_init_from_file_with_params = Function(lambda *_: None)
        self.assertRaisesRegex(worker.WorkerError, "NATIVE_INIT_FAILED", worker.WhisperEngine, _library=library)
        del library; gc.collect()
        self.assertIs(callback(), worker._PROCESS_LOG_SINK)

    def test_installation_refusal_precedes_native_load(self):
        with patch.object(worker, "_read_verified", return_value=b"{}"), \
                patch.object(C, "CDLL", side_effect=AssertionError("NO_NATIVE")):
            self.assertRaisesRegex(worker.WorkerError, "INSTALLATION_REJECTED", worker.WhisperEngine,
                                   _activation=worker._SERVE_ACTIVATION)

    def test_cpu_backend_required_before_context(self):
        library = Library()
        library.ggml_backend_dev_by_type = Function(lambda _: None)
        self.assertRaisesRegex(worker.WorkerError, "NATIVE_INIT_FAILED", worker.WhisperEngine, _library=library)
        self.assertEqual(library.context_free_count, 0)
        self.assertEqual(len(library.backend_paths), 1)
        self.assertTrue(Path(library.backend_paths[0].decode("utf-8")).is_absolute())
        self.assertEqual(library.ggml_backend_dev_by_type.argtypes, [C.c_int])
        self.assertIs(library.ggml_backend_dev_by_type.restype, C.c_void_p)
        self.assertEqual(library.ggml_backend_load_all_from_path.argtypes, [C.c_char_p])
        self.assertIsNone(library.ggml_backend_load_all_from_path.restype)

    def test_child_loader_order_environment_restriction_and_directory_cleanup(self):
        # All Windows/native exports below are fake functions. This exercises the
        # actual production ordering without calling WinDLL, CDLL or Whisper.
        for failure in (None, "restrict", "add_directory", "load_ggml", "load_whisper", "cpu"):
            with self.subTest(failure=failure):
                library = Library()
                events, closed = [], []
                runtime = ROOT / "companion/local/runtimes/whisper-cpu-b5130/Release"
                expected_environment = {k: v for k, v in worker.os.environ.items() if k.casefold() != "ggml_backend_path"}
                expected_environment["KEEP"] = "value"
                environment = {**expected_environment, "GGML_BACKEND_PATH": "hostile", "gGmL_bAcKeNd_PaTh": "also-hostile"}
                class Kernel:
                    pass
                kernel = Kernel()
                def restrict(flags):
                    events.append(("restrict", flags))
                    return 0 if failure == "restrict" else 1
                kernel.SetDefaultDllDirectories = Function(restrict)
                def win_load(name, **kwargs):
                    self.assertEqual(environment, expected_environment)
                    self.assertEqual((name, kwargs), ("kernel32.dll", {"winmode": 0x800, "use_last_error": True}))
                    events.append(("kernel", name))
                    return kernel
                class Directory:
                    def close(self):
                        events.append(("close", None)); closed.append(True)
                def add_directory(path):
                    self.assertEqual(path, str(runtime))
                    events.append(("directory", path))
                    if failure == "add_directory":
                        raise OSError("untrusted native detail")
                    return Directory()
                def native_load(path, **kwargs):
                    name = Path(path).name
                    self.assertEqual(kwargs, {"winmode": 0xD00})
                    self.assertEqual(Path(path).parent, runtime)
                    self.assertEqual(environment, expected_environment)
                    events.append(("load", name))
                    if failure == ("load_ggml" if name == "ggml.dll" else "load_whisper"):
                        raise OSError("untrusted loader path")
                    return library
                original_init = library.whisper_init_from_file_with_params
                library.whisper_init_from_file_with_params = Function(lambda model, params: (
                    events.append(("init", model)) or original_init(b"MOCK_ONLY", params)))
                original_backend = library.ggml_backend_load_all_from_path
                library.ggml_backend_load_all_from_path = Function(lambda path: (
                    events.append(("backend", path)) or original_backend(path)))
                if failure == "cpu":
                    library.ggml_backend_dev_by_type = Function(lambda _: None)
                with patch.object(worker, "verify_installation", return_value=(runtime, Path("MOCK_ONLY"))), \
                        patch.object(worker.os, "environ", environment), \
                        patch.object(C, "WinDLL", side_effect=win_load), \
                        patch.object(C, "CDLL", side_effect=native_load), \
                        patch.object(worker.os, "add_dll_directory", side_effect=add_directory):
                    if failure:
                        self.assertRaisesRegex(worker.WorkerError, "NATIVE_INIT_FAILED", worker.WhisperEngine,
                                               _activation=worker._SERVE_ACTIVATION)
                    else:
                        engine = worker.WhisperEngine(_activation=worker._SERVE_ACTIVATION)
                        self.assertEqual(library.backend_paths, [str(runtime).encode("utf-8")])
                        engine.close()
                self.assertEqual(kernel.SetDefaultDllDirectories.argtypes, [C.c_uint32])
                self.assertIs(kernel.SetDefaultDllDirectories.restype, C.c_int32)
                self.assertEqual(events[:2], [("kernel", "kernel32.dll"), ("restrict", 0xC00)])
                if failure in ("restrict", "add_directory"):
                    self.assertFalse(closed)
                    self.assertFalse(any(e[0] == "load" for e in events))
                else:
                    self.assertEqual(len(closed), 1)
                if not failure:
                    self.assertEqual([e[0] for e in events], ["kernel", "restrict", "directory", "load", "load", "backend", "init", "close"])
                    self.assertEqual(library.freed_contexts, [0x123456789ABC])
                    self.assertIn(library, worker._PROCESS_NATIVE_LIBRARIES)
                    self.assertIs(engine._backend, library)


if __name__ == "__main__":
    print("MOCK_ONLY: fake engines/functions; no DLL/model/audio/network execution", flush=True)
    unittest.main(verbosity=2)
