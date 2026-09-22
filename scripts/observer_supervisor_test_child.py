"""Tiny project-authored, self-expiring child for Windows adapter smoke tests.

No editor/game/module loading, network, registry, or external state is accessed.
Every mode exits naturally within five seconds if the supervisor leaves it alive.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    mode = sys.argv[1]
    if mode == "echo":
        print(json.dumps({"argv": sys.argv[2:], "pid": os.getpid()}), flush=True)
        print("synthetic stderr", file=sys.stderr, flush=True)
        return 7
    if mode == "sleep":
        time.sleep(3)
        return 0
    if mode == "tree":
        child = subprocess.Popen([sys.executable, "-B", str(Path(__file__).resolve()), "sleep"],
                                 creationflags=subprocess.CREATE_NO_WINDOW)
        print(json.dumps({"root_pid": os.getpid(), "child_pid": child.pid}), flush=True)
        time.sleep(4)
        return 0
    if mode == "survive-close":
        time.sleep(0.4)
        Path(sys.argv[2]).write_text("natural exit after handle closure", encoding="utf-8")
        return 0
    raise ValueError("unknown synthetic mode")


if __name__ == "__main__":
    sys.exit(main())
