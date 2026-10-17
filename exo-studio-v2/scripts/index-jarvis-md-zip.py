#!/usr/bin/env python3
"""Inventory Markdown handoffs in a given Jarvis ZIP without extracting or executing.

Example: python3 scripts/index-jarvis-md-zip.py handoffs.zip --output-dir docs/jarvis-zip-review
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path, PurePosixPath

AREAS = {
    "community_ui": ("community", "website", "homepage", "marketplace", "portfolio", "forum", "interface"),
    "garment_engine": ("garment", "fabric", "pattern", "simulation", "grading", "cloth", "sewing"),
    "creative_studio": ("blender", "touchdesigner", "render", "camera", "projection", "studio"),
    "backend_agents": ("agent", "mcp", "api", "backend", "auth", "database", "automation"),
}


def analyze(path):
    result = []
    warning = []
    total_bytes = 0
    with zipfile.ZipFile(path) as bundle:
        files = bundle.infolist()
        if len(files) > 5000:
            raise ValueError("ZIP exceeds the 5000-entry safety limit")
        for item in files:
            if item.is_dir() or not item.filename.lower().endswith(".md"):
                continue
            parts = PurePosixPath(item.filename).parts
            if (not parts or ".." in parts or item.filename.startswith("/")
                    or "\\" in item.filename or "__MACOSX" in parts):
                warning.append("Skipped unsafe member: " + item.filename)
                continue
            if item.file_size > 2_000_000:
                warning.append("Skipped oversized MD: " + item.filename)
                continue
            total_bytes += item.file_size
            if total_bytes > 50_000_000:
                raise ValueError("Markdown uncompressed contents exceed 50 MB")
            raw = bundle.read(item)
            content = raw.decode("utf-8-sig", errors="replace")
            searchable = (item.filename + "\n" + content[:30000]).lower()
            scores = {area: sum(searchable.count(word) for word in keywords)
                      for area, keywords in AREAS.items()}
            top = max(scores.values())
            areas = [area for area, score in scores.items() if score and score >= top * 0.65]
            checklist = re.findall(r"(?im)^\s*[-*]\s*\[([ x])\]\s*(.+)$", content)
            result.append({
                "path": item.filename,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
                "lines": content.count("\n") + 1,
                "headings": re.findall(r"(?m)^#{1,4}\s+(.+)", content)[:40],
                "checklist": [{"done": flag.lower() == "x", "text": msg[:240]}
                              for flag, msg in checklist],
                "suggested_workstreams": areas or ["unclassified"],
                "status": "NOT_REVIEWED",
                "files_changed": [],
                "verification": [],
                "blockers": [],
            })
    return result, warning


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("zipfile", type=Path)
    cli.add_argument("--output-dir", type=Path, required=True)
    args = cli.parse_args()
    src = args.zipfile.expanduser().resolve()
    if not src.is_file():
        cli.error("Archive not found: " + str(src))
    indexed, warnings = analyze(src)
    folder = args.output_dir.expanduser()
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"source_archive": str(src),
               "source_sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
               "markdown_count": len(indexed), "warnings": warnings, "files": indexed}
    (folder / "jarvis-md-index.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    rows = ["# Jarvis Markdown implementation tracker", "",
            "Source: " + src.name, "",
            "**Index only. Source text has not been executed.**", "",
            "| Source MD | Suggested stream | Tasks | Status |",
            "| --- | --- | ---: | --- |"]
    for f in indexed:
        rows.append("| " + f["path"].replace("|", "/") + " | "
                    + ", ".join(f["suggested_workstreams"]) + " | "
                    + str(len(f["checklist"])) + " | NOT_REVIEWED |")
    if warnings:
        rows += ["", "## Skipped entries"] + ["- " + w for w in warnings]
    (folder / "jarvis-md-tracker.md").write_text("\n".join(rows) + "\n",
                                                  encoding="utf-8")
    print("Indexed", len(indexed), "Markdown members in", src.name)
    print("Report directory:", folder)


if __name__ == "__main__":
    main()
