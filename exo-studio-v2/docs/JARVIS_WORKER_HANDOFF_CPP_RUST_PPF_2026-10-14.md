# Jarvis worker handoff — Garment Studio native C++ + Rust/PPF architecture

**Date:** October 14, 2026  
**Requested by user:** Pass the latest C++-versus-Rust architecture decision to the **current Jarvis worker**.  
**Status:** Shared-repository handoff for the active coding agent; **not** a request to rewrite or restart running work.

## Architecture decision

**Keep the UI and CAD in C++/Qt 6; retain ZOZO/ST-Tech's PPF Contact Solver in Rust.** Do **not** restart the whole application in Rust merely because the upstream simulation solver is written in Rust. A native mixed-language architecture is intentional:

| Layer | Ownership / technology | Notes |
| --- | --- | --- |
| Desktop UI, pattern canvas, inspectors, project commands | **C++17+ / Qt 6** | Native desktop app, replaces the Swift/WebKit/React editor gradually after test parity |
| Canonical garment document, patterns, 2D geometry, sewing graph, grading, manufacturing | **C++** | Single authoritative document with stable IDs, deterministic CAD transactions and undo/redo; existing JSON must round-trip without loss |
| Initial 2D-to-3D positioning, panel tessellation, stitch correspondence | **Native preparation layer** (C++ preferred, Rust optional at solver boundary) | Body-relative seam alignment; produces validated *solver-ready* mesh; does not rely on PPF alone to arrange exploded patterns |
| Physical cloth dynamics, deformation, contact/collision constraints | **ZOZO's existing Rust-first PPF Contact Solver** | Use upstream implementation directly, not an unverified C++ port; preserve macOS Metal path and its Blender/add-on encoding while native adapter is developed |
| Boundary between C++ and Rust | **Versioned native process/IPC or safe FFI** | Pass mesh vertices/faces, piece IDs, ordered stitches, body collider, material coefficients, solver settings; retrieve solved frames and measured contact/strain. Start with current out-of-process service boundary; only consider FFI with ownership/safety tests |
| User-facing simulation state | **Only validated results** | Do not present 'fitted' without body/self contact, swept CCD, fabric strain, seam closure and shoulder-clearance acceptance tests |

## Verified project status (do not overclaim)

1. `native_cpp/` was newly added and **its native CAD library/CLI compiled** on the Mac. Test command: `bash native_cpp/scripts/build_and_test.sh`.
2. `native_cpp/core/garment_document.*` implements a lossless canonical document, IDs, precise Bézier/edge length, sewn-edge length checks, point/curve edits, allowances, undo snapshot, revisions, safe split-edge operation and basic validation.
3. `native_cpp/solver/ppf_bridge.*` implements **C++ preflight** for real PPF shell/stitch payloads, requiring ≤3 cm largest initial seam gap, independent ≤5% rest-edge strain measurement, zero independently measured initial body/self intersections, and explicit Thomas collider settings. The adapter **does not yet constitute a validated PPF fitted run**.
4. C++ native unit tests passed. Parity test `node scripts/check-native-cpp-cad.mjs` compared **76 pattern-edge lengths and 28 sewing lengths** against the original JavaScript project models, while preserving unknown metadata.
5. `native_cpp/desktop/` has **Qt Widgets C++ source**, including 2D pattern editing, inspectors, undo/redo and a deliberately marked unsimulated 3D staging projection. **The Qt app has NOT been compiled or installed**: the machine has Clang/CMake, but lacks the full **Qt6 C++ developer SDK** (`Qt6Config.cmake`, C++ headers); an isolated PySide6 runtime wheel alone is not that SDK. Obtain an appropriately licensed official Qt 6 C++ developer installation before claiming a working Qt GUI.
6. Existing working app (`native_app/`, Swift/WebKit/React), garment projects and licensed Thomas avatar must remain untouched until validated cutover.

## PPF physical fitting: current critical blocker

- Upstream: <https://github.com/st-tech/ppf-contact-solver>, with bundled `examples/fitting.ipynb` showing garment stitching and a **pinned body mesh**. The upstream demo is **not** a universal automatic 2D pattern arrangement tool.
- CLO male T-shirt live OBJ + XML reference was captured through CLO's export UI at `research/clo-reference/live-audit-20261014/exports/`: 7 pieces, 23 seam groups, 182 indexed sewing correspondences. Its exported pose remains **arranged, not fully sewn**, with large gaps; do not copy its absolute coordinates or treat them as solver-ready.
- Our best independently validated Thomas four-piece T-shirt starting pose:
  `blender_bridge/output/ppf-clo-assembly-20261014/best-validated-initial-pose.json`.
  All 98 stitch IDs preserved; mean initial stitch gap **7.173 cm**, maximum **18.742 cm**, initial body and self BVH intersection counts 0, maximum intrinsic edge change **4.365%**. **Preflight FAIL:** 18.742 cm exceeds the 3 cm maximum.
- The previous historical real Metal PPF run did physically evolve cloth/stitches but crossed Thomas's body beginning at frame 3 and retained unacceptable sewing gaps; see `docs/PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md`. Do not confuse a completed GPU run with correct fitting.
- New PPF work must first solve **developable, anatomically constrained torso/shoulder/armhole/sleeve assembly** while conserving pattern shape and avoiding contact. Run PPF only after 3 cm gate passes; require **complete all-frame validation** before calling it fitted.

## Recommended engineering order for Jarvis

1. **Preserve the ongoing C++ work**, don't recreate or overwrite it. Review `native_cpp/README.md`, `docs/NATIVE_CPP_QT_REWRITE_PLAN_2026-10-14.md`, and `CLAUDE.md` before changes; check uncommitted modifications and concurrent editor activity.
2. Install/locate the full Qt6 C++ SDK, then **compile, launch and test** the native Qt canvas and edit/undo/document parity; explicitly report whether it actually compiled and ran. Never silently replace the current installed app.
3. Keep the existing Rust ZOZO PPF runtime behind a **versioned C++ ↔ Rust/native service boundary**. Test cloth input/output serialization and seam IDs, material units, body contact groups, and true solver output mapping. Avoid rewriting the solver in C++.
4. Prioritize a **correct initial shirt assembly algorithm**, with exact edge correspondence on the real Thomas avatar; verify strain, collision and sewing distances independently before running PPF.
5. Migrate manufacturing, rendering and production tooling incrementally with lossless garment-document tests. The ultimate goal is CLO-class capability; CLO's proprietary internal source design is not fully public, so avoid unsupported claims of an exact internal clone.

## Safety / communication

This file is an **informational handoff** requested by the user. It does **not** authorize deleting code, launching unsupervised GPU-intensive PPF loops, reverting other workers' edits or replacing the running app. Report actual results with measured evidence; if something remains blocked, name it and keep working code intact.
