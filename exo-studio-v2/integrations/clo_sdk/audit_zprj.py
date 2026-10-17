#!/usr/bin/env python3
"""Read-only integrity check for native CLO .zprj project containers.

Many CLO 7 project files have a binary prefix before their ZIP directory.
Python's zipfile can inspect those containers without editing or extracting.
CRC validity proves only that the saved archive is intact, *not* that patterns
are correctly sewn or that the garment fits an avatar.
"""
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path


def audit(path: Path) -> dict:
    result: dict = {"file": str(path), "exists": path.is_file(), "valid": False}
    if not path.is_file():
        result["error"] = "File missing"
        return result
    result["bytes"] = path.stat().st_size
    try:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            result["entry_count"] = len(names)
            result["has_garment_zpac"] = any(n.lower().endswith(".zpac") for n in names)
            result["has_avatar"] = any(n.lower().endswith(".avt") for n in names)
            result["has_scene_xml"] = any(n.lower().endswith(".xml") for n in names)
            result["entries"] = [
                {"name": i.filename, "bytes": i.file_size, "compressed_bytes": i.compress_size}
                for i in archive.infolist()
            ]
            broken = archive.testzip()
            result["crc_ok"] = broken is None
            if broken:
                result["crc_broken_entry"] = broken
            result["valid"] = result["crc_ok"] and result["has_garment_zpac"]
            result["fit_verified"] = False
            result["sewing_verified"] = False
            result["limitation"] = (
                "Archive integrity and embedded garment payload are checked; "
                "sewing orientation, avatar clearance, strain and drape are NOT verified."
            )
    except (OSError, zipfile.BadZipFile, EOFError) as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 audit_zprj.py /path/to/one.zprj [more.zprj ...]")
    reports = [audit(Path(name)) for name in sys.argv[1:]]
    print(json.dumps(reports, indent=2))
    sys.exit(0 if all(x.get("valid") for x in reports) else 2)
