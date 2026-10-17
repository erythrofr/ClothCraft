# Garment Studio — native C++ grading and manufacturing cutline migration

Date: 2026-10-15. Source of truth: live `garment-studio` workspace. Incremental migration only; existing Swift/WebKit/React app and Rust PPF solver unchanged.

## Delivered

- `native_cpp/core/grading.hpp/.cpp`: C++17 graded project copies, complete graded size run, configurable width/length deltas, explicit point grade rules, parametric curve and internal-line transformations, custom measurement coordinates, and legacy seam-locked affine T-shirt arc fitting.
- `native_cpp/core/cutting_geometry.hpp/.cpp`: per-edge seam-allowance boundary with curve sampling, outward offset lines, miter intersection, near-parallel fallback, miter-length limit, finite checks and centimetre source units. Algorithm intentionally tracks our own JavaScript `seamAllowanceBoundary` output, not unverified proprietary cutter geometry.
- `native_cpp/core/dxf_export.*`: preserve original default stitchline-only DXF R12 mode, optionally export real allowance-offset cut contours.
- `native_cpp/cli/main.cpp`: new NDJSON operations `grade-size`, `grade-run`, `export-dxf-run`; existing `export-dxf` now supports `args.size` and `args.withSeamAllowances`; `clothcraft-export` accepts optional `args.size`. The source document remains immutable. Rust PPF fit status is unchanged and not asserted by a graded export.
- `scripts/check-native-cpp-grading.mjs`: compares native C++ with live JavaScript on four T-shirt/hoodie/designer-rule projects, including size runs, curve control geometry, sewn edges, custom measurements, metadata integrity, exported DXF, importer round-trip and invalid input handling.
- `native_cpp/tests/test_document.cpp`: native transaction, source immutability and cut-outline unit tests.
- `native_cpp/CMakeLists.txt`, `native_cpp/scripts/build_and_test.sh`: compile and run the new native modules and regressions.

## Reproducible validation

Run `bash native_cpp/scripts/build_and_test.sh` from the repository root. The latest passing run reported:

| Gate | Evidence |
|---|---|
| Native C++ compile | Clang C++17, CMake; all native core/CLI targets compiled |
| Native unit suite | 2/2 CTest suites passed |
| CAD baseline | 76 edge-length and 28 sewing comparisons passed |
| Grading | 4 garment projects; 2,256 coordinate comparisons, 984 quadratic controls, 912 seam-pair checks passed |
| Cut outlines | 3,510 independently compared sampled contour points matched browser JS after DXF import |
| Input integrity | Unknown size, duplicate size, excessive geometry rejected; source and revision preserved |
| Size run DXF | XS–XXL generated and imported through JavaScript DXF parser; widths scale across sizes |
| ClothCraft | Graded size export available from compiled CLI; garment simulation and fitting not certified |

`npm run check:non-simulation` also passed with existing DXF, manufacturing, marker, mesh, and precision checks. `npm run build` passed. The latter are **JavaScript regression checks**, not evidence that those other modules were converted to C++.

## Known gaps and blockers

1. **Native Qt6 desktop not compiled:** the full Qt6 C++ developer headers and CMake package are not installed on Jarvis. The PySide6 wheel contains a runtime, not the appropriate official C++ SDK. There is no native 2D/3D end-to-end application acceptance test; the installed React/Swift application remains the active workspace.
2. **Browser still runs its JavaScript grading and cutting flows:** the new native functions are callable through the versioned native CLI, not yet wired to a native Qt production workspace or desktop UI. No feature has been removed from JavaScript.
3. **Factory DXF incomplete:** no AAMA/ASTM construction metadata, notch/cutting attributes, grainline layers, darts, validated plotter output, garment nesting cutter tests, or measured factory acceptance. The native offset uses a sampled polygon and a finite miter cap; production-safe contour topology is not guaranteed on arbitrarily complex curves.
4. **Simulation not accepted:** the existing independently audited Rust PPF trajectory still fails physical fit/contact evidence. Exporting a graded ClothCraft template does not demonstrate real-body drape correctness.
5. **Other subsystems remain in JavaScript:** marker layout, marker PDFs, BOM XML, fabric costs, full DXF importer, drafting construction/history, React UI, WebGL scene, materials and most production flows.

## Recommended next engineering loop

Install and verify a proper Qt6 C++ desktop SDK in an isolated build, compile the existing native Qt window, then connect C++ grading size selection and per-edge cutline preview using the immutable document API. In parallel, migrate marker layout/production artifacts and the industrial DXF/AAMA interoperability suite with real cross-import fixtures. Keep the Rust solver separate, and gate body-fit acceptance on full-frame contact, strain, seam and CCD evidence.

**Claim boundary:** this is a tested C++ migration of grading and one manufacturing geometry pathway, not 90–100% product completion or a full replacement of CLO3D.
