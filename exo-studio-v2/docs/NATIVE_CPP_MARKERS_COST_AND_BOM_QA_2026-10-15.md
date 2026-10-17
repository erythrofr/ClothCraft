# Garment Studio C++ conversion: fabric markers, costing and BOM QA

**Date:** October 15, 2026. **Location:** live `garment-studio` repository on Jarvis. This is an incremental conversion checkpoint, not a full native application release.

## Native C++ implementation added

- `native_cpp/core/marker_layout.cpp/.hpp`: a native layout implementation matching our existing JavaScript garment marker strategy. It operates on native centimetre cutting contours, obeys per-piece grainline rotation and optional cross-grain, groups by fabric, creates repeated cut quantities, respects per-fabric fabric-width overrides and inter-piece gaps, and reports unplaced pieces without pretending the marker is complete.
- `native_cpp/core/fabric_cost.cpp/.hpp`: native per-size marker consumption and optional supplier-price estimates; missing prices or incomplete markers explicitly retain null estimated costs. CSV uses the current browser schema with exact fields and formatting.
- C++ CLI operations `marker-size`, `marker-run`, `fabric-cost-run`, `fabric-cost-csv` exposed through the existing `garment-studio.native-cad.v1` NDJSON protocol. These are **read-only** on the supplied project and do not change revision or user files.
- The live native repository also acquired `core/bom_export.cpp/.hpp` and `export-bom` while this work was underway. I did **not** replace this concurrent BOM implementation; I independently cross-validated it against the JS XML BOM with `scripts/check-native-cpp-bom-parity-20261015.mjs`.

## Reproducible comparisons

| Command | Verified outcome |
|---|---|
| `node scripts/check-native-cpp-marker.mjs` | 5 projects, 61 marker sets, 388 placed pieces, 15,824 contour vertex comparisons, 12 correctly rejected too-wide pieces; 8 alternate valid piece locations from near-tied sorting; source projects unchanged |
| `node scripts/check-native-cpp-fabric-cost.mjs` | 6 projects, 54 native/JS material rows, 36 size totals, CSV byte parity, explicit handling for missing price, zero price and incomplete marker |
| `node scripts/check-native-cpp-bom-parity-20261015.mjs` | 5 projects, 99 comparable BOM XML fabric, trim and cost elements, including escaped XML special characters, semantic schema parity |
| `bash native_cpp/scripts/build_and_test.sh` | C++ native CLI compilation, CTest, original CAD grading/cutline checks, marker, cost, XML BOM and Rust PPF guard checks |
| `npm run check:non-simulation` | Browser manufacturing, marker, DXF, factory package, mesh and drafting regressions |
| `npm run check:clo-parity-ci` | Existing selected-feature parity matrix checks (does **not** imply 90% parity) |
| `npm run build` | Existing application Vite bundle |

## Required limits

The marker is our deterministic rectangle-placement development layout, not an optimal nesting solver or a factory-approved marker. The offset outline matches existing JavaScript but does not supply complete industrial CAD topology and cutter acceptance. Fabric costing excludes trims, sewing labor, freight, taxes, washing/shrinkage yield correction, and actual purchase order semantics. BOM is an **open Garment Studio** schema, not CLO's proprietary BOM format.

The current installed application is still Swift/WebKit/React-based and continues to use the browser's existing manufacturing workflow. These new native operations are callable via the C++ CLI but **not yet wired into the desktop workspace**. The optional Qt6 desktop target cannot currently compile on Jarvis because the full Qt6 C++ developer SDK (headers/CMake package) is missing. The original Rust ZOZO PPF solver remains a separate backend; its fit/CCD acceptance is **not resolved** by this CAD/export work. We did not replace or relaunch the installed app.

## Next development pass

1. Add a tested native production service adapter: call the C++ operations from the existing local application without blocking the UI; protect file/project identity and keep the browser path as a fallback until test parity.
2. Convert the remaining production preflight, marker PDF/SVG generation and factory packaging, including true cutter import validation rather than simply rewriting output files in a different language.
3. Install an appropriate Qt6 **C++ SDK** in a scoped, reversible manner, build the Qt window and wire native size switching, marker previews and validated save/export actions.
4. Maintain independent Rust PPF simulation acceptance: first-step geometry, full-frame contact, strain, seam closure, and CCD.

**Migration is not complete.** These additions increase native functional coverage, but there is no justified full-product C++ conversion percentage, nor a claim of CLO3D 90% parity.
