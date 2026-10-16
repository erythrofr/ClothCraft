# SAMPL3D / Garment Studio — verified native C++ manufacturing migration checkpoint

**Date:** 2026-10-15. **Workspace:** live `garment-studio` repository. This checkpoint covers compiled manufacturing code; it is **not** a full native app cutover or an assertion of CLO3D production parity.

## Newly completed

1. **Native C++ rectangle-development marker layouts** now pass JavaScript parity on graded garments, alternate cross-grain rotations, fabric width overrides, cut quantities, and intentionally unplaceable fabric pieces. The existing `scripts/check-native-cpp-marker.mjs` baseline checks **61 marker sets / 388 placements / 15,824 contour vertices**, while the new `scripts/check-native-cpp-markers.mjs` exercises **48 marker sets / 540 inspected pieces** across four scenarios.
2. **Native marker-based fabric costing** uses native graded markers, explicit supplier prices, and incomplete-marker status. `scripts/check-native-cpp-fabric-cost.mjs` compares **54 rows / 36 size totals**, including exact CSV parity, no fabricated zero prices, and overflow conditions.
3. **Native C++ BOM XML export** is implemented in `native_cpp/core/bom_export.{hpp,cpp}` as `op: "export-bom"` on the versioned NDJSON `garment_cad_cli`. It reuses the same C++ cost calculation, computes stitchline (not cutline) pattern area, preserves garment metadata without editing the source, and writes the open Garment Studio 1.0 XML schema (not proprietary CLO).
4. `scripts/check-native-cpp-bom.mjs` compares **7 actual garment cases byte-for-byte** with `src/core/bomXml.js`: 11 fabric entries, 63 fabric cost estimates, and 74 trims. Cases include priced/unpriced fabrics, EURO currency, named trims and fasteners, escaped XML characters, quantities, multi-fabric construction, marker overflows and string-supplied supplier prices. Every case also repeats export to assert determinism and verifies source JSON is untouched.

## Reproducible checks (latest passing run)

```sh
bash native_cpp/scripts/build_and_test.sh
node scripts/check-native-cpp-markers.mjs
npm run check:non-simulation
npm run build
```

Both CTest suites passed. C++ vs JS CAD checks passed **76 edge lengths / 28 seam relationships**, graded coordinates **2,256**, curve controls **984**, seam pairs **912** and cutline points **3,510**. Standalone native marker, fabric cost, BOM and ClothCraft exchange parity scripts also passed. Existing Vite application build and non-simulation regression checks passed. The Vite build reported a large JavaScript bundle warning, not a build failure.

## Architecture boundary and remaining work

- **Existing installed product:** Swift/AppKit + WebKit + React/Three.js; current user projects untouched.
- **Compiled native components:** C++ canonical garment document and CAD/transactions, grading, sampled cut outlines and DXF, marker nesting previews, fabric-cost estimates, BOM XML, ClothCraft interchange, XPBD service and C++ bridge to Rust-first PPF.
- **Native Qt source is not a substitute for a compiled desktop:** Qt 6 development headers and CMake package must be installed and the native Qt application independently built/launched/validated before claiming UI migration. No installed app replacement was attempted.
- **Existing active workflow is still JavaScript:** native exports are exposed through the CLI; they are not yet wired into the shipping editor or used to replace it.
- **Not production-certified:** Open XML is not CLO's proprietary BOM, rectangle markers are not validated industrial nesting, DXF lacks several industrial construction annotations and factory cutter acceptance, and fabric costs exclude trims/labor.
- **Physics acceptance remains blocked:** Rust PPF is intentionally retained; the saved Thomas tee trajectory fails body contact, swept CCD, and seam closure gates. Passing a rejection test is not proof of a successful fit.
- **Source-control safety:** `native_cpp/` remains a preexisting untracked directory in the working tree. Preserve and review existing uncommitted work before any atomic commit or publication.

## Next conversion dependencies

1. Complete a legitimate isolated Qt6 C++ SDK setup, build and launch the native Qt editor without replacing the installed app, and run real edit/undo/save compatibility tests.
2. Add a native GUI command adapter for the now-compiled grading, marker, fabric cost, and BOM operations; preserve older React editor until parity.
3. Migrate XML/DXF production import, notches/marker artifacts, industrial construction metadata and native fabrication validation.
4. Implement native 3D garment viewport/material rendering and pass independent same-garment CLO visual comparisons.
5. Bring full garment simulation to passing per-frame contact and sewing acceptance before designating a physically fitted result.
