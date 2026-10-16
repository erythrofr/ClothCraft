# Garment Studio — native C++ architecture (ongoing migration)

The independent Qt desktop now includes Simulation → View original ZOZO dress recording. From a local source folder, select public/references/zozo-dress to play a READ-ONLY sampled wireframe of the 241-frame original recorded cloth and body motion. It is not the active editable garment simulation and the original fitting audit records body intersections. This reference viewer does not embed the ~79 MB source trajectory in the desktop executable.

**Factory-development export:** The Qt Production menu now offers a separate **Export full factory ZIP (experimental, uncertified)…** action. It assembles all 24 expected tee/pants size S/M/L production files natively, including BOM, costing, markers, PDF, DXF, tech pack, HTML, CSV and editable source. The original development ZIP is still available. The C++ CLI offers factory-full-development-summary and export-factory-full-development-zip with exact matching file inventory and binary-safe ZIP extraction, but tee/pants byte parity with JavaScript is currently only 16/24 and 20/24 files. Neither export certifies fit, grading, cut quality or factory readiness.

**Native research seam assembly:** The C++ JSON-particle adapter for assembleNativeSeams now supports both contact-constrained and joint-constraint preassembly in addition to conventional seams and weighted virtual zipper seams. It passed 120 strict tee/pants/virtual JS parity fixtures. These are staged candidate arrangements only; no swept collision CCD, fit certification, or production-safe auto-application is implied.

**Decoded fabric photo PBR:** A native C++ RGBA pixel adapter generates normal and roughness PNG data URLs (102/102 decoded pixel-level JS fixture parity). Caller must supply decoded/resampled canvas pixels. The browser's original source-image decoding and resampling remain unported, so this does not replace the complete browser source-image API.

The viewer has its own offscreen rendering smoke test, from the repository root:

    QT_QPA_PLATFORM=offscreen native_cpp/build-qt-current/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt --zozo-preview-smoke

**Latest checkpoint:** `CONVERSION_STATUS_2026-10-15.md` contains the current measured export mapping, passing CTest count, exact initial garment assembly/payload parity and explicit simulation limitations. The historical milestone paragraphs below predate several fully compiled Qt/C++ integrations. Re-run the coverage checker rather than relying on a historical number.

**Current build and conversion status:** See CONVERSION_STATUS_2026-10-15.md. Some historical notes further below (such as the Qt SDK still being unavailable) predate the successful native Qt C++ build and are no longer current. Use the status report and a fresh parity audit for current facts.

This folder is **new, additive, and independent** of the currently installed Swift/WebKit/React Garment Studio. Its long-term target is a CLO-class **Qt 6/C++17+ desktop application** backed by one native garment document, CAD operations, renderer, and explicitly gated simulation services. This is a **partial implementation**, not a claim the old application has been replaced.

## Implemented and compiled on the Mac

`core/garment_document.*`: strongly validated, canonical JSON garment document with lossless unknown metadata and stable pattern/seam IDs. Exact drafting in **centimetres**, quadratic Bézier arc lengths (adaptive Simpson), full measured sewn-edge lengths, per-edge seam allowances, copy-on-write transactions and undo snapshots, revision guard, point edits, curve edits, point-preserving edge splitting, layout edits, piece/seam addition and removal. A sewn edge or one with other edge-indexed production metadata cannot be split silently. No automatic destructive migration or full-document rewrite.

`core/dxf_export.*` and `core/cutting_geometry.*`: compiled **native C++ read-only DXF R12 outline exporter** and per-edge seam-allowance outline engine. Exports a separate closed polyline per piece, samples quadratic Bézier edges, converts drafting centimetres to manufacturing millimetres, separates pieces horizontally, and preserves the original document. `export-dxf` supports optional `args.samplesPerCurve` (4–256), `args.size` and `args.withSeamAllowances` (defaults false for backward compatibility). The cutline option faithfully follows the JS `seamAllowanceBoundary` geometry, including adjacent-edge miters with a bounded fallback. `export-dxf-run` produces all graded sizes with the same options. **Still missing:** notches, darts, grainline entities, AAMA/ASTM metadata, certified cutter workflows and comprehensive DXF import. Do not treat it as factory-ready.

`core/grading.*`: **native C++ graded pattern generation** (individual size and complete size runs). Covers size deltas, per-point designer grade rules, quadratic curve controls, internal drafting lines, custom measurement endpoints, and the T-shirt `seam-locked-affine-v1` curve-fitting path used by the current JS frontend. Unknown project/piece metadata, IDs, stitches, fabrics and revisions are preserved. Outputs are independent size previews rather than mutated source projects; input validation fails atomically. Available through `grade-size`, `grade-run`, graded `export-dxf` / `export-dxf-run` and optional `args.size` on `clothcraft-export`. Native grading is **not yet wired into the React frontend or compiled Qt interface**.

`core/marker_layout.*`, `core/fabric_cost.*`, and `core/bom_export.*`: compiled **native development marker nesting, graded material consumption/cost estimates and open-schema BOM XML export**. Operations `marker-size`, `marker-run`, `fabric-cost-run`, `fabric-cost-csv`, and `export-bom` provide project-immutable output through the native CLI. C++-versus-JS regression checks cover 61 marker sets/388 placements, 54 cost rows/36 size totals, and seven byte-exact BOM XML examples (11 fabric entries, 63 cost estimates, 74 construction trims). These are not industrial nesting certification, supplier purchase orders, or proprietary CLO BOM interchange. Details: `docs/NATIVE_CPP_BOM_AND_MARKER_PARITY_2026-10-15.md`.

`core/measurement_export.*`: native C++ point-of-measure calculations and multi-size measurement CSV (`measure-project`, `measure-run`, `export-pom-csv`). Regression tests compare 44 base POM values and 237 graded POM values with the current JS implementation, including byte-exact CSV across five different garment/measurement scenarios. The independent Qt Production menu now includes the native CSV export action, **pending Qt SDK compilation and user-interface testing**. See `docs/NATIVE_CPP_POM_PARITY_2026-10-15.md`.

`core/tech_pack_export.*`: C++17 structured native garment tech-pack JSON (`export-tech-pack`), using the native POM, grading and fabric marker engines. Full JSON parity with the JavaScript `buildTechPack` was validated across five realistic projects, comparing 27 size reports, 249 POM rows, 39 marker-fabric summaries and seven material records. No projects were edited, no garment fit was certified. The Qt-native production source has a matching export action, **not yet GUI-compiled or tested**.

`cli/main.cpp`: versioned NDJSON request/response interface `garment-studio.native-cad.v1` for the transitional JavaScript frontend, native Qt GUI and local automation. Requests always include the explicit project, so the process cannot silently reach browser storage, saved files or an unrelated user document.

`solver/ppf_bridge.*`: independent native preflight for ZOZO's original Rust PPF solver. Preserves real stitch IDs, metre-scale cloth mesh, explicit Thomas body mode, strict **≤3 cm** initial seam gap, and independently measured contact/strain evidence. It provides the POST `/jobs` envelope shape used by the existing `ppf_backend/server.mjs` without launching an unsafe simulation. Original PPF solver stays Rust and all-frame fit/CCD acceptance remains separate.

`tests/`, `scripts/check-native-cpp-cad.mjs` and `scripts/check-native-cpp-grading.mjs`: C++ unit tests and precise JS parity. Original CAD core: **76** native-vs-JavaScript edge lengths and **28** seam group lengths; grading and cutting: **2,256** point coordinates, **984** curve controls, **912** seam-pair checks and **3,510** cut-outline samples across development garment sizes. Source preservation and invalid size/geometry rejection are tested. See `docs/NATIVE_CPP_GRADING_AND_CUTTING_PASS_2026-10-15.md`.

## Native Qt frontend source (Qt6 SDK and native build verified)

`desktop/`: **Qt Widgets/C++** code with two split panes (editable 2D pattern canvas; clearly labeled unsimulated 3D panel staging projection), piece tree, seam mismatch inspector, numeric point and allowance controls, drag handles, undo/redo, separate JSON file-copy Save As, and simulation buttons safely disabled until real fitted-garment acceptance. It does **not** embed a browser or use PySide as the application frontend.

The machine now has a separate Qt6 C++ SDK under `native_cpp/.qt-sdk-worker1/6.8.3/macos`. With its location set as `CMAKE_PREFIX_PATH`, the independent `GarmentStudioQt` target compiles and launched in an offscreen smoke test. The current native GUI includes graded CAD previews, point/curve editing, grid snapping, explicit edge splitting and development production exports, but still lacks a validated dynamic cloth-fitting playback. A dynamic-linking/packaging and macOS codesign audit and hands-on GUI tests will still be required before distributing the native Qt app; do not replace the existing installed app automatically.

## Build and test

From the Garment Studio repository root:

```bash
bash native_cpp/scripts/build_and_test.sh

# Extended C++ CTest + live CLI + all per-export JavaScript parity gates:
bash native_cpp/scripts/verify-conversion.sh

# Include independent Qt6 C++ compilation when the local SDK is present:
GARMENT_VERIFY_QT=1 bash native_cpp/scripts/verify-conversion.sh

# C++ CLI request protocol (one JSON request per line on stdin):
native_cpp/build-cmake/garment_cad_cli --version
```

The script builds/tests the C++ core without requiring the Qt SDK. An isolated Qt6 C++ SDK is now present on this workstation and the independent `GarmentStudioQt.app` builds and passes an offscreen startup check. The real T-shirt starter fixture `examples/sample-tee.json` is loaded in the native app bundle; it is **a copy**, not a migrated browser localStorage project.

For the API, requests use `{"protocol":"garment-studio.native-cad.v1", "document":{...}, "op":"inspect"|"edge-info"|"seam-info"|"document"|"edit"|"grade-size"|"grade-run"|"export-dxf"|"export-dxf-run"|"clothcraft-export"|"ppf-preflight"|"ppf-job-envelope", ...}`. Example grading request: `{"protocol":"garment-studio.native-cad.v1","document":{"pieces":[...]},"op":"grade-size","args":{"size":"L"}}`; supply a real complete project with grading metadata. `export-dxf` takes optional `args: {"size":"L","withSeamAllowances":true,"samplesPerCurve":24}`. Edit uses `command` values `move-point`, `set-curve`, `remove-curve`, `split-edge`, `set-edge-allowance`, `set-layout`, `rename-piece`, `add-piece`, `remove-piece`, `add-seam`, `remove-seam`, plus `args` and optional `expectedRevision`. Read-only operations do not alter state. Failed or stale operations return `{ok:false,error:"..."}`; no partial document is committed.

## Next major migrations

The native geometry kernel is **not yet** a full constraint-based construction/history solver. Remaining milestones include comprehensive industrial offsets and darts, factory grading approval, AAMA/ASTM interchange certification, complete native 3D renderer, exact authored pattern-to-cloth triangulation/sewing, advanced avatar collisions/wind, garment-material calibration, full Qt interface parity, all-garment/asset compatibility, and actually passing PPF drape. Preserve existing project data and Swift/React tooling until feature and test parity is independently established. Read `docs/NATIVE_CPP_QT_REWRITE_PLAN_2026-10-14.md` for the phased acceptance gates.

Third-party licensing: `vendor/nlohmann/json.hpp` from the MIT-licensed nlohmann/json v3.11.3 single-header distribution. Qt LGPL/GPL/commercial terms and deployment obligations must be reviewed before distribution. ZOZO's Rust-first `st-tech/ppf-contact-solver` is an optional separate process and is not redistributed from this new directory.

## Native PPF connection and evidence gate (2026-10-14)

`solver/ppf_service.*` is a compiled C++/libcurl client for the **existing**
loopback service at `127.0.0.1:5192`. This is a transitional
C++ → Node/Blender orchestration → original Rust PPF boundary, not yet a
standalone C++ replacement for the orchestration layer. libcurl development
headers/libraries are now required to build the CLI (available in the macOS SDK).
The CAD kernel itself remains independent of HTTP.

Additional native NDJSON operations (same explicit `document` field):

- `ppf-health`: query the actual service and expose ready/busy, without launching a job.
- `ppf-submit`, `args.frames`: validate the envelope and backend readiness,
  then POST a guarded job. `allowExplodedExperimental` stays false. Never
  automatically retries uncertain submissions or falls back to XPBD.
- `ppf-job`, `args.id`: retrieve one job, with strict ID/path validation.
- `ppf-fit-evidence`: evaluate supplied `contact`, `sewing`, `ipcCcd`,
  `clearance`, and explicit resolved `strainLimitRatio` audit evidence.
  This is currently the **Thomas-shirt acceptance profile**, not generic
  shoulder criteria for pants. All frames/intervals and final seam/clearance
  evidence are mandatory. Missing, malformed, negative, or contradictory
  measurements fail. Caller must associate the reports with the correct job;
  this API does not authenticate report provenance or independently run CCD.

The service client disallows redirects, bypasses proxy environment settings,
limits response size, and uses connection/request timeouts. Failed POST
transport means **outcome unknown**: inspect jobs before manual retry.
A submitted/completed job is not automatically an accepted fit. The Qt GUI
still has no verified drape playback; these operations are the native CLI/API
boundary and must run off the GUI thread when wired into Qt.

Verified checks:

```bash
NODE_BIN=/usr/local/bin/node bash native_cpp/scripts/build_and_test.sh
python3 scripts/check-native-ppf-service.py # read-only, requires local service
python3 scripts/check-native-ppf-fit.py     # requires saved historical Metal artifacts
```

The real service health request and invalid-ID rejection passed. No new
Thomas garment job was submitted by the native client in this pass; the
runtime was reserved for the upstream reference. POST execution and result
playback remain to be verified on a valid near-assembled garment. The native
fit gate correctly rejects the real historical 20-frame Thomas failure.
