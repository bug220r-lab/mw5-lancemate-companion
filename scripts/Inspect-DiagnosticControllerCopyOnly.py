"""Fixed native entry for the exact mod-copy Blueprint/CDO; no stock query.

Run only through the reviewed editor script entry point. The shared inspector
still pins stock/copy/original content and the historical stock text exports.
Importing this wrapper does not import Unreal or execute the inspection.
"""
import hashlib
from pathlib import Path
import types

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROOT = Path(r"C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION")
HELPER = ROOT / "scripts/Inspect-DiagnosticControllerCopy.py"
HELPER_SHA256 = "daa431f3d271e1d0f01345a97d87f018211bcbdbdefdd0f6d9d4a3f15e092360"


def load_pinned_helper():
    if ROOT.resolve() != EXPECTED_ROOT.resolve():
        raise ValueError("FIXED_ENTRY_ROOT_MISMATCH")
    raw = HELPER.read_bytes()
    if len(raw) > 128 * 1024 or hashlib.sha256(raw).hexdigest() != HELPER_SHA256:
        raise ValueError("FIXED_ENTRY_HELPER_HASH_MISMATCH")
    # Execute the exact reviewed bytes rather than reopening the file after the
    # hash check. Its __main__ block is disabled; only this fixed entry runs it.
    module = types.ModuleType("diagnostic_copy_only_reviewed_helper")
    module.__file__ = str(HELPER)
    exec(compile(raw, str(HELPER), "exec"), module.__dict__)
    return module


if __name__ == "__main__":
    helper = load_pinned_helper()
    import unreal
    result = helper.run(unreal, native=True, mode="copy-only")
    print("DIAGNOSTIC_CONTROLLER_COPY_ONLY_REVIEW: " + result["status"] + " | " + result.get("output_directory", ""))
