# Native C++ garment measurements and size-run POM exports

Date: October 15, 2026. Scope: additive native CAD/production migration; original Swift/WebKit and React application and original garment documents remain unchanged.

## Implemented

- `native_cpp/core/measurement_export.hpp/.cpp`: read-only C++17 equivalent of `src/core/measurements.js` measuring existing 2D pattern geometry, quadratic curves, curved boundary intersections, the torso and sleeve POM rows, and explicitly authored custom measurements. Uses the same numeric centimetre units and tolerance values as the live application.
- Exact size-run POM output uses existing native `gradeProject`, preserving the source garment, pattern IDs and revision. New native CLI operations `measure-project`, `measure-run` and `export-pom-csv` return measurements, per-size tables and a CSV with quoted strings and escaped quote characters.
- `native_cpp/desktop/main_window.cpp/.hpp`: adds an all-size POM CSV export action to the independent Qt native application's Production menu and dock. The C++ data/export behavior has been tested through the native CLI; the **Qt action has not yet been compiled or GUI-tested** because Qt 6 C++ developer SDK discovery still fails on this Mac.

## Measured evidence

`node scripts/check-native-cpp-measurements.mjs` passes against JavaScript's authoritative `measureProject`, `buildMeasurementSizeRun`, and `measurementRunToCSV`. Five independently constructed scenarios (default T-shirt, zip hoodie, two custom measurements including an escaped CSV label, no sleeve and a three-size run) were checked. Totals: 44 base measurement rows, 237 graded measurement rows, and 3,110 exact CSV bytes compared. Additional checks reject invalid numeric inputs and confirm source documents remain unchanged and outputs are deterministic.

`bash native_cpp/scripts/build_and_test.sh` passed five CTest suites plus all existing native-vs-JS parity suites, including the POM test. The saved historical ZOZO PPF simulation remains **rejected** by the physical-fit acceptance test (body contacts and open seams); passing CAD/manufacturing regressions does not certify real textile fit.

## Unfinished

- Compile and manually exercise the Qt native Production action once a complete SDK with Qt6Config.cmake and C++ headers becomes available; do not claim functional native GUI parity before this step.
- Fully native tech-pack generation, deeper garment construction and industrial interoperability, native 3D rendering, high-quality verified fitting, and complete JS-to-C++ application cutover remain separate tasks.
- Measurement methodology is a current-product 2D POM development reference, not a physical garment or factory certification.

No ClothCraft code or Rust solver was merged. GitHub publication and installed application replacement were not performed in this pass.

## Second C++ production pass: complete structured tech-pack JSON

Added `native_cpp/core/tech_pack_export.*` and CLI `op: "export-tech-pack"` using the native POM, grading and marker modules. The output includes project metadata, production specifications, avatar dimensions, 2D patterns and grade-point rules, seam construction, internal lines, notches, buttonholes, fabric/texture metadata, custom measurements, six-size POM tables and multi-fabric marker summaries. It is a development handoff, not a factory-reviewed or physically fitted garment.

`node scripts/check-native-cpp-tech-pack.mjs` passes **full JSON structural parity** with JavaScript `buildTechPack` across five cases (base T-shirt, zip hoodie, priced/custom-measurement hoodie, textured/trimmed T-shirt and three-size T-shirt). In total: 27 size reports, 249 per-size measurement rows, 39 fabric marker summaries and seven material records. Repeated native output is deterministic and source projects are immutable.

The independent Qt desktop source now also includes a Production-menu/dock action to save a standalone tech-pack JSON through the same safe output-file workflow. **As with the POM action, this Qt UI path is source-only until the Qt developer SDK is installed and the desktop is built and exercised.**
