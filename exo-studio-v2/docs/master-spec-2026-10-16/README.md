# EXO / Complete CLO-Class Rebuild Engineering Specification

**Engineering audit snapshot:** 16 October 2026. **Status:** future implementation and verification requirements; no certification of CLO3D equivalence.

## Primary deliverables

| File | Purpose |
| --- | --- |
| `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.pdf` | 270-page, ~99,000-word engineering reference with 188 PDF bookmarks. |
| `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.docx` | Editable Microsoft Word version of the same source text. |
| `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.md` | Source-text requirements and 400 individually addressable fabric records. |
| `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.html` | Styled printable master, including a linked index. |
| `manifest.json` | Machine-readable list of 176 indexed requirements and cited research paths. |
| `render-validation.json` | Page, word, bookmark, syntax and export verification record. |
| `build_master_spec.py` | Deterministic generator reading the existing project and dated audits. |

**Scope:** 45 core system packages, 15 integration programs, all 70 observed CLO7 toolbar slots, 40 detailed ten-fabric sheets covering 400 exact current EXO material records, two QA/reference sheets, an executive architecture and evidence chapter, plus 11 full in-repository technical annexes.

## How to work from the specification

1. Open the PDF, navigate to an `ARCH-*`, `EXT-*`, `TOOL-*` or `FAB-*` requirement, and record its proposed implementation and acceptance gate in a corresponding engineering issue.
2. Confirm current implementation status against live code and a new reproducible test. The audit is a dated snapshot, and feature states can change between builds.
3. Record the exact project revision, versioned data/API contract, user interaction, failure path, undo/redo, reopened persistence, cross-backend behavior and numerical fixture before closing an issue.
4. Prioritize `M0` canonical document/schema, command history and clean native builds, followed by `M1` 2D CAD + property / toolbar correctness; `M2` sewing/source–mesh links; `M3` simulation/contact; `M4` physical fabric evidence; `M5/M6` fit and production interoperability; `M7` desktop/CI; and then optional presentation and web systems.
5. Update `src/core/clo7NativeToolCapabilities.js` only when the active Rust V2 command is independently proven. An inspection-only route, browser V1 feature or UI tooltip is insufficient.

## Baseline evidence that must stay honest

The saved CLO 7.0.242 live toolbar capture contains **70 distinct controls**. The observed Rust V2 registry snapshot has **11 actual native actions, nine read-only/inspection routes and 50 unavailable native commands**. For fabrics, there are **400 EXO estimated design specifications** and **zero instrument-calibrated specimens** in the current catalog; 67 installed licensed photo source materials exist, of which 44 are used to visualize 385 presets. A photograph, a preset or a passing source test is not physical fabric calibration. Historical C++ conversion/source parity coverage does not represent a production-ready, physically validated native application. The latest attempt to run existing 58 CTests was blocked by a stale CMake build directory referring to a prior checkout; this is a test setup issue rather than 58 failing assertions.

## Rebuild and QA

```sh
python3 docs/master-spec-2026-10-16/build_master_spec.py
```

Re-render the resulting HTML to the PDF using headless Chromium with A4 paper and no headers/footers; macOS `textutil` can convert the same HTML to editable DOCX. Existing generated source files should be regenerated from the current catalog and capability registry when either changes. Check all 176 requirement IDs and PDF bookmarks against `manifest.json`; inspect representative pages and verify table clipping before publishing.

No application source was changed to author this specification. Existing uncommitted EXO work is intentionally left untouched.
