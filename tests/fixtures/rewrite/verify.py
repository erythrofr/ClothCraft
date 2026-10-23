"""Verify public native authoring fixtures through the real CPU CLI (stdlib only)."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
COMMANDS = {"validate", "metrics", "audit-sewing"}


def fixture_hash(data):
    # Git may check out CRLF on Windows and LF elsewhere. Content remains exact.
    return hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest()


def pointer(document, path):
    if not path.startswith("/"):
        raise ValueError(f"Invalid JSON pointer: {path}")
    for part in path[1:].split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        document = document[int(key)] if isinstance(document, list) else document[key]
    return document


def compare(document, expected):
    for path, value in expected.get("exact", {}).items():
        actual = pointer(document, path)
        if type(actual) is not type(value) or actual != value:
            raise ValueError(f"{path}: expected {value!r}, got {actual!r}")
    for path, (value, tolerance) in expected.get("near", {}).items():
        actual = pointer(document, path)
        numbers = (actual, value, tolerance)
        if any(type(x) not in (int, float) or not math.isfinite(x) for x in numbers):
            raise ValueError(f"{path}: comparison requires finite numbers")
        if tolerance < 0 or abs(actual - value) > tolerance:
            raise ValueError(f"{path}: expected {value} +/- {tolerance}, got {actual}")


def run_check(executable, fixture, check):
    command = check["command"]
    if command not in COMMANDS:
        raise ValueError(f"Unsupported command {command!r}")
    env = dict(os.environ, RAYON_NUM_THREADS="2")
    # Bound runtime and retained output. Files avoid unbounded capture buffers.
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        result = subprocess.run(
            [str(executable), command, str(fixture)], env=env,
            stdout=out, stderr=err, timeout=30, check=False,
        )
        outputs = []
        for stream in (out, err):
            if stream.tell() > 1_000_000:
                raise ValueError("CLI output exceeds the 1 MB report budget")
            stream.seek(0)
            outputs.append(stream.read().decode("utf-8"))
    stdout, stderr = outputs
    if result.returncode != check["exit"]:
        raise ValueError(f"exit {result.returncode}, expected {check['exit']}: {stderr[:1000]}")
    if "stderr_contains" in check and check["stderr_contains"] not in stderr:
        raise ValueError(f"missing expected error: {check['stderr_contains']!r}")
    if check.get("exact") or check.get("near"):
        compare(json.loads(stdout), check)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", type=Path, required=True)
    parser.add_argument("--self-test", action="store_true",
                        help="also prove a deliberately wrong area fails against the real CLI")
    args = parser.parse_args()
    executable = args.cli.resolve(strict=True)
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if manifest["version"] != 1:
        raise ValueError("Unsupported fixture manifest version")
    print(f"CLI SHA256: {hashlib.sha256(executable.read_bytes()).hexdigest()}")
    print(f"Native contract baseline: {manifest['source_revision']}")
    failures = []
    seen = set()
    checks = 0
    for case in manifest["cases"]:
        try:
            if case["id"] in seen:
                raise ValueError("Duplicate case ID")
            seen.add(case["id"])
            fixture = (ROOT / case["file"]).resolve(strict=True)
            if fixture.parent != ROOT or fixture.suffix != ".json":
                raise ValueError("Fixture must be a JSON file in this directory")
            if fixture_hash(fixture.read_bytes()) != case["sha256"]:
                raise ValueError("Fixture hash mismatch; review changes, do not auto-bless")
            for check in case["checks"]:
                run_check(executable, fixture, check)
                checks += 1
            print(f"PASS {case['id']} ({len(case['checks'])} checks)")
        except (ValueError, KeyError, IndexError, OSError, subprocess.TimeoutExpired) as error:
            failures.append(case["id"])
            print(f"FAIL {case['id']}: {error}")
    if args.self_test:
        bad = {"command": "metrics", "exit": 0,
               "near": {"/net_area_m2": [12.0, 1e-10]}}
        try:
            run_check(executable, ROOT / "legacy-rectangle.json", bad)
        except ValueError as error:
            if "/net_area_m2: expected 12.0" not in str(error):
                raise
            print("PASS negative control: deliberate 100x area expectation rejected")
        else:
            failures.append("negative-control")
            print("FAIL negative control: verifier accepted a wrong area")
    print(f"{checks} successful CLI checks; {len(failures)} failed cases")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
