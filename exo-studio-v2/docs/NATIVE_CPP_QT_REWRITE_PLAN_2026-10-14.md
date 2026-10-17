# Garment Studio — full native C++ and Qt migration

**Initiated:** October 14, 2026. **Objective:** replace the React/WebKit/Swift user-facing editor with a maintainable native Qt 6/C++17+ desktop application, using a shared C++ garment-document and CAD engine, native viewport/rendering, simulation bridges, and native manufacturing modules. This is a target architecture, **not a claim that the entire app is already rewritten or that CLO's proprietary source architecture is known**.

## What exists now

The currently installed app is a Swift/AppKit application that embeds a React/JavaScript/Three.js workspace in WebKit. Pattern operations and document mutation mainly reside in `src/core` and `src/App.jsx`. A separate native C++ XPBD CLI exists in `native_backend/src/garment_xpbd_cli.cpp`, while PPF research runs behind another process bridge. This workspace's shell has an Apple clang++ compiler but does not currently expose Qt 6, CMake, or a Qt package manager installation. A full Qt app cannot be claimed deployed without compiling and running it.

## Target ownership boundaries

| New subsystem | Responsibility | Initial compatibility path |
| --- | --- | --- |
| `native_cpp/core` | Canonical garment document, point/curve/edge geometry, IDs, seam references, validation, revision transactions | Versioned JSON import/export preserving unrecognized properties and ensuring explicit edit operations are undoable |
| `native_cpp/desktop` | Qt 6 Widgets desktop chrome, 2D pattern canvas, object browser, property inspector, native 3D viewport holder | Separate executable until it implements replacement workflows |
| C++ geometry engine | Bézier arc lengths, constraints, dart/cut/split, seam/stitch correspondence, robust topology | Numerical parity and document round-trip fixtures against JS CAD |
| C++ simulation adapters | Existing XPBD CLI and validated PPF process integration | No untested changes to cloth solver or collision code |
| Native rendering | Viewport + fabric shading + avatar/material import + export | Independent parity testing against existing Three.js viewer |
| C++ production modules | Measurement graph, grading, trims, DXF, marker, tech packs | Transaction-preserving importer/exporter and manufacturing checks |

## Required migration guarantees

1. **Preserve all user projects.** Never reset, delete, rewrite or silently migrate the stored `garment-studio-project-v1` web document. Existing installed app stays available until native 2D drafting, editing history, 3D viewport, fabric/materials, import/export and saved garment compatibility are verified.
2. **Canonical document owns the truth.** Native geometry changes must update the same typed garment-document representation and revision; renderer and simulator receive derived views, never own separate editable garment geometry.
3. **No lossy import.** Preserve unknown project fields, stable piece IDs, point IDs, seam endpoints, per-edge allowances, grading metadata, fabric and avatar references and prior document version. Explicit upgrades use copy-on-write plus warnings; never replace a source file in place without confirmation.
4. **Native operations are deterministic.** Each CAD operation has bounds, topology validation, a semantic command, an undoable transaction and fixture-based comparisons; malformed or invalid operations leave the document unchanged.
5. **Separate visual staging from physics.** Startup preview may be mildly curved but cannot silently modify manufacturing pattern lengths or solver physical state.
6. **No speculative equivalence.** CLO is proprietary; seek native engineering quality and feature parity from publicly documented user workflows rather than claiming to reproduce CLO's exact internal implementation.
7. **ZOZO's solver remains Rust.** The requested GitHub engine is ZOZO's Contact Solver (`st-tech/ppf-contact-solver`), whose upstream implementation is explicitly **Rust-first**. The C++/Qt rewrite integrates it as a separately deployed native solver backend through a stable versioned process/IPC boundary. Rewriting the engine into C++ would throw away upstream fixes and guarantees and is *not* required for the Garment Studio application to be built mostly in C++. It is not a CLO-compatible turnkey garment fitter: accurate rest meshes, stitching constraints, avatar collision, materials, solver initialization and output transfer still need engineering and validation.

## Existing ZOZO integration verified in repository

- Upstream engine: <https://github.com/st-tech/ppf-contact-solver> (Apache-2.0; Rust-first, with macOS Metal and CPU support).
- Local installed runtime: `research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64`.
- Existing source payload converter: `src/core/backends/ppfPayload.js`; backend server/isolated process lifecycle: `ppf_backend/server.mjs`.
- Existing assembly and diagnostic checks: `ppf_backend/assemblyAcceptance.mjs`, `fitAcceptance.mjs`, `stagingDiagnostics.mjs` and related checks/scripts.
- **Migration rule:** the new C++/Qt application should call a native PPF solver adapter and translate garment documents into validated solver payloads. Existing Node/Blender orchestration remains available until a native bridge has passed the same or stronger acceptance tests. The presence of upstream source or a working solver executable does *not* prove full-body stitched garment assembly is correct.
- The independent, measured failure analysis and exact prerequisite acceptance suite are in [`PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md`](./PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md). Its baseline real Metal GPU tee run has body penetration from frame 3 and final seams still open almost 10 cm; that behavior must be fixed **before** the native C++ interface can advertise 'Simulate garment / fitted'.

## Rollout gates

1. **Foundation:** compile a real C++ CAD kernel with tests and a versioned document/CLI bridge. Provide optional Qt 6 build setup, keeping dependencies explicit.
2. **Native drafting:** Qt 2D canvas, exact point/edge/curve editing, snapping, seam allowance, dart/trim construction, undo/redo, project save/open. Validate round-trip of current 2D document fixtures.
3. **Native 3D:** mesh generation, avatar view, garment staging, native materials and textures, export. Verify source patterns and sewing references are unaffected by 3D edits.
4. **Manufacturing:** grading, DXF/AAMA interchange, measurement tables, nesting, markers, BOM/tech packs, precise metadata parity.
5. **Simulation:** integrate the existing C++ XPBD and optional PPF engines without blocking or corrupting main editor state.
6. **Cutover:** full regression, user acceptance on real saved documents, signed/notarized macOS application packaging, reversible project migration and only then removal of transitional React/Swift runtime.

**Scope/status:** the native replacement is a multi-milestone engineering program, not a safe one-command conversion. The first native kernel and Qt scaffold are being developed independently; the original installed app remains intact for daily use.

## Native C++ implementation checkpoint — October 14, 2026 evening

The new `native_cpp/` tree now has a **compiled C++17 canonical garment CAD kernel**, versioned NDJSON CLI, and separately compiled **PPF Rust solver compatibility/preflight adapter**. Unit tests and current-application parity checks passed: **76 drafting edges, 28 sewn edge relationships across two garment projects**, lossless JSON metadata roundtrip, stable referenced IDs, deterministic failure rollback, and snapshot undo. Safe **split-edge** uses de Casteljau subdivision but refuses to break a sewn edge/attached production annotations without a corresponding graph migration.

Native Qt Widgets **source** now includes a 2D drafting canvas, selected pattern points/inspector, editable coordinates and allowances, undo/redo, docked seam reports, optional 3D staging projection, and read-only project import plus separate-copy save. **This source has not been compiled yet:** the Mac has Clang and CMake but not a **Qt6 C++ development SDK**. An isolated Qt runtime downloaded from a PySide wheel contains executable libraries only, *not* C++ Qt headers/CMake targets. Do not claim a Qt application has been deployed. `native_cpp/README.md` records how to finish the build once the official Qt SDK is installed.

The installed Swift/React app and all saved projects remain untouched. The actual Thomas/PPF assembly remains an **unaccepted experimental pose** (max initial seam gap 18.742 cm versus 3 cm required), so a Qt interface must not misrepresent a staged model as a physically correct drape.

## C++ manufacturing migration checkpoint — October 15, 2026

The C++ kernel now also builds `native_cpp/core/dxf_export.cpp` and exposes `op: "export-dxf"` in its versioned NDJSON CLI. It exports closed **DXF R12 cutting polylines in millimetres** from the original garment geometry, including native quadratic Bézier edge sampling, without modifying the document. Native C++ unit tests check deterministic export, preserved document, unit header and basic DXF entity structure. A live CLI smoke test exported **four closed cutting outlines** from `native_cpp/examples/sample-tee.json` (27,143 bytes); `bash native_cpp/scripts/build_and_test.sh` passed both CTest suites and the native-vs-JS CAD parity checks.

This does **not** complete native manufacturing parity: DXF seam allowances, notches, darts, grading and AAMA-specific data still depend on the current JavaScript pipeline. Qt6 C++ headers and `Qt6Config.cmake` are still unavailable, so the new native Qt GUI remains source-only and the installed Swift/WebKit app has not been replaced. The next migration steps are completing DXF parity, obtaining a legitimate Qt6 C++ SDK, building the actual native desktop, and validating safe project opening/editing there.
