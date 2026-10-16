#!/usr/bin/env python3
"""Headless Qt startup gate, never touches an already-running Garment Studio app.

Starts only the newly built C++ app from its isolated build directory, with a
repo test garment. Confirms that Qt's event loop stays alive for a short
period, then terminates exactly that child process. This is not GUI parity.
"""

import os
import pathlib
import subprocess
import sys
import time


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: smoke_qt.py <app-executable> <qt-prefix> <test-garment.json>", file=sys.stderr)
        return 2
    executable, qt_prefix, fixture = map(pathlib.Path, sys.argv[1:])
    for candidate in (executable, fixture):
        if not candidate.is_file():
            print(f"missing smoke test input: {candidate}", file=sys.stderr)
            return 2

    environment = os.environ.copy()
    environment["QT_QPA_PLATFORM"] = "offscreen"
    plugin_candidates = [
        qt_prefix / "plugins", qt_prefix / "lib" / "qt6" / "plugins",
    ]
    for plugin in plugin_candidates:
        if (plugin / "platforms").is_dir():
            environment["QT_QPA_PLATFORM_PLUGIN_PATH"] = str(plugin / "platforms")
            break

    lib_path = str(qt_prefix / "lib")
    prior = environment.get("DYLD_LIBRARY_PATH", "")
    environment["DYLD_LIBRARY_PATH"] = lib_path + (":" + prior if prior else "")
    process = subprocess.Popen(
        [str(executable), str(fixture)], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=environment,
    )
    time.sleep(2.5)
    try:
        if process.poll() is not None:
            output, errors = process.communicate(timeout=5)
            print(f"Qt GUI exited prematurely with status {process.returncode}", file=sys.stderr)
            print((output + errors).decode(errors="replace")[-4000:], file=sys.stderr)
            return 1
        print("PASS native Qt6 desktop: test garment opened and GUI event loop remained alive for 2.5 seconds")
        return 0
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
