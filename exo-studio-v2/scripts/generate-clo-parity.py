#!/usr/bin/env python3
"""Reproducible, conservative parity report using MIT replica-skill.

Usage:
    python3 scripts/generate-clo-parity.py
    python3 scripts/generate-clo-parity.py --check

Does not invent a visual similarity score. Source evidence is checked for each
named feature, and the generated score only covers the declared sample of
functional CLO-inspired features, not a complete audit of CLO3D.
"""

from __future__ import annotations

import argparse
import csv
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts/vendor/replica-skill"))
from parity import combine, load, render, score  # noqa: E402

MATRIX = ROOT / "replica/features.csv"
REPORT = ROOT / "replica/parity.md"
PRIORITIES = {"must", "should", "could"}
STATES = {"yes", "partial", "no", "skip"}


def validate() -> list[dict]:
    with MATRIX.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        expected = {"feature", "area", "priority", "original", "clone", "notes", "evidence"}
        if not reader.fieldnames or not expected.issubset(reader.fieldnames):
            raise ValueError(f"Matrix requires columns {sorted(expected)}")
        rows = list(reader)
    if len(rows) < 35:
        raise ValueError("Coverage too small for the current CLO3D parity programme")
    seen = set()
    for line, row in enumerate(rows, 2):
        if None in row:
            raise ValueError(f"Row {line}: malformed CSV columns: {row[None]}")
        name = (row["feature"] or "").strip()
        if not name or name in seen:
            raise ValueError(f"Row {line}: missing or duplicate feature {name!r}")
        seen.add(name)
        if row["priority"] not in PRIORITIES or row["clone"] not in STATES:
            raise ValueError(f"Row {line}: unrecognized priority or clone state")
        if row["original"] != "yes":
            raise ValueError(f"Row {line}: CLO3D reference applicability must be explicit")
        if row["clone"] in ("partial", "no", "skip") and len(row["notes"].strip()) < 18:
            raise ValueError(f"Row {line}: incomplete feature requires an explanatory gap")
        path = pathlib.Path(row["evidence"])
        if path.is_absolute() or ".." in path.parts or not (ROOT / path).is_file():
            raise ValueError(f"Row {line}: evidence path does not exist: {path}")
    return rows


def generate() -> str:
    validated = validate()
    result = combine(score(load(MATRIX)), [])
    return (
        "# Garment Studio versus CLO3D — functional feature parity snapshot\n\n"
        "**Scope:** This is a source-backed *feature inventory* of "
        f"{len(validated)} selected CLO-inspired behaviors, not all of CLO3D. "
        "Partial credit is exactly half for the named behavior; a passing "
        "unit test does not prove end-to-end workflow equivalence. "
        "All statuses require human reevaluation as the build evolves.\n\n"
        "**Full visual parity:** Not measured. A bounded chrome-only diff of "
        "a local CLO7 2D reference and Garment Studio exists in "
        "[the 2D comparison audit](../docs/CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md); "
        "its score is **not** a complete CLO3D appearance or behavior score.\n\n"
        "**Physics:** A functional backend is not an accepted simulated fit. "
        "The physical sewing/collision gaps remain failing.\n\n"
        "**Important:** This weighted snapshot is not directly interchangeable "
        "with earlier approximate 38% overall CLO3D parity estimates.\n\n"
        + render(result, markdown=True)
        + "\n\n## Evidence and methodology\n\n"
        "The auditable matrix is [features.csv](features.csv), with a "
        "per-row local source/test/report pointer and missing-behavior note. "
        "The weighting calculation comes from MIT-licensed replica-skill "
        "([source](https://github.com/Jakeschincariol/replica-skill)).\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if report is stale")
    args = parser.parse_args()
    try:
        content = generate()
    except ValueError as exc:
        print(f"Parity matrix invalid: {exc}", file=sys.stderr)
        return 2
    if args.check:
        if not REPORT.exists() or REPORT.read_text() != content:
            print(f"Stale parity report: regenerate with {sys.argv[0]}", file=sys.stderr)
            return 1
        print("CLO3D parity matrix: valid; generated report current")
    else:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(content)
        scored = score(load(MATRIX))
        print(
            f"Selected-feature parity: {scored['feature_score']:.1f}% "
            f"({scored['counted']} behaviors; "
            f"{scored['must_have_done']}/{scored['must_have_total']} must-haves done)"
        )
        print(f"Saved {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
