# EXO Sample 3D — manufacturing and factory data pipeline

**Status:** target production contract with existing feature pointers, 15 October 2026. A factory ZIP is a structured handoff candidate, not authorization to cut. The [CLO export audit](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md) documents tested DXF, BOM, POM, marker and packaging operations alongside absent AAMA/ASTM certification, plotter integration and physical factory validation.

## One authoritative manufacturing revision

Each production output needs a project ID, style ID, revision, size system, unit declaration, grading revision, fabric/trim revision, responsible author, and generated timestamp. Store immutable references to selected pattern geometry and material assignments in a manifest; hashes should detect disagreement across tech pack, DXF, BOM, cut order and marker. Changes to geometry, grade rules, seam allowance, roll width or cut quantity invalidate dependent outputs. Do not let a prior graded marker accompany a newer DXF without a visible error. The source project remains editable and the factory package becomes a frozen derivative with signed approval states.

Build a traceability graph: style revision → source panel IDs → graded size and cutpiece variants → placed marker pieces → plotted and cutter files → cut bundle and sewing operations → finished-garment POM targets. A material SKU and shade lot should connect to the relevant panels and marker. Size-label mappings must be explicit: apparel labels such as XS/S/M/L cannot serve as a geometric grading algorithm. Every table exports defined units, decimal precision, tolerance and null/missing semantics.

## Pattern preparation and structural preflight

Validate each closed cut contour, hole and internal construction path. Confirm allowed winding, no unexpected self-crossing, nonzero edge length, valid seam allowance offsets, declared notches and grainline direction. Link seam IDs to both participating pieces and validate that notches intended to match actually correspond. Check fold pieces, mirrored pieces, paired cut pieces and asymmetric cuts distinctly. A seam-edge annotation is not automatically a cutline; exporters must make the geometry role unambiguous.

Block on missing essential fabrics, unsupported sizes, invalid units, open production contours, duplicate production identifiers and notches referencing deleted geometry. Emit warnings on unusual but potentially intended conditions such as dramatic ease, large grain rotation or fabric waste. Existing `src/core/productionPreflight.js`, `scripts/check-production-handoff.mjs` and `scripts/check-native-cpp-preflight.mjs` should anchor regression coverage. Every suppression must carry reason, reviewer and scope; a global `ignoreWarnings` switch is not a production sign-off.

## Grading and measurements

Define a base size and grade rules for landmarks or vertices, with a versioned size chart and target body/garment measurement table. Recalculate curved seam lengths and notch positions after grading rather than copying base-size coordinates unmodified. Measure circumference and garment dimensions in specified configurations, and distinguish flat POM from finished garment circumferences and tolerances. Width across the chest, total body length, sleeve length and inseam require diagrammed landmark conventions so a manufacturer measures the same thing as the application.

Review `src/core/grading.js`, `src/core/measurements.js`, `scripts/check-native-cpp-grading-helpers.mjs`, `scripts/check-native-cpp-pom-parity.mjs` when present on the active branch, and [native grading/cutting audit](NATIVE_CPP_GRADING_AND_CUTTING_PASS_2026-10-15.md). For each size, assert expected measurements, seam compatibility, boundary layout and grade progression. Include negative grades, asymmetric grading, custom named sizes and extremely small/large sizes. Some grading controls may be UI-complete while industrial rule-file round-trip remains unverified; preserve that distinction.

## Industrial DXF contract

The existing R12 DXF output and layered construction exports are useful, but a generic syntactically valid DXF is not automatically conformant with ASTM/AAMA apparel dialects or vendor grading systems. Maintain a versioned layer mapping for boundaries, seam allowances, notches, internal lines, darts, text, drill holes, grainlines, mirrored/fold instructions and nesting IDs. State exported coordinate units in millimeters, and avoid relying on an importer's guessed scale. Account for splines, sampled curves, line/arc continuity and allowable chord error.

For formal compatibility, assemble legally obtained reference samples and parse the output independently. Import into CLO3D and at least one additional pattern CAD environment, then check cutpiece count, dimension, rotation, unique identifiers, grade correspondence, piece placement and matching notches. Export again where allowed and compare equivalent geometry and metadata. The proof must name the consumer, version and import options. `src/core/dxf.js`, `native_cpp/core/construction_dxf.cpp`, `scripts/dxf-roundtrip-check.mjs` and `scripts/check-native-cpp-construction-dxf.mjs` offer implementation and regression entry points. Never imply proprietary format support based solely on file extension.

## Marker planning and roll economics

A marker combines graded cut quantities with assigned fabric specifications and cutting constraints. Its inputs include usable fabric width after selvage, shrinkage and relaxation allowances, nap/directional rules, one-way prints, stripe/plaid matching, maximum permitted rotation, fold mode, piece pairing and material lot. The nesting algorithm must operate on true contours and provide deterministic, collision-free placements with separation margins; rectangular packing can serve as a conservative preview but should be labeled as such. Manual adjustment needs locking and validation so moving one piece cannot silently create overlap.

Marker output should report total usable length, placed area, utilization, offcuts, cut quantity per size, overwidth pieces, unusable residue and estimated fabric length with configurable loss allowance. Preserve the exact cut plan geometry behind every costing number. Validate piece-to-piece clearance numerically and at physical print dimensions. Review `src/core/marker.js`, `src/core/markerArtifacts.js`, `scripts/check-markers.mjs`, `scripts/check-native-cpp-markers.mjs`, `scripts/check-native-cpp-marker-svg.mjs` and [marker/BOM QA](NATIVE_CPP_MARKERS_COST_AND_BOM_QA_2026-10-15.md).

The next external validation step is a calibrated print/cut workflow: full-scale PDF/SVG with registration marks, orientation marks, plotter tiling, physical calibration boxes, page overlap and actual measurements. HP-GL/PLT and vendor-specific cutter dialects should be accepted only after observed operation on supported equipment. Do not silently label SVG export as a verified cutter command stream.

## BOM, trims and hardware

The bill of materials must represent fabrics, linings, interlinings, elastics, zippers, buttons, snaps, thread, labels, packaging and optional consumables by part identifier, version, supplier, unit, consumption, wastage, colorway, size applicability and sourcing status. Link a fabric to panels and a zipper to its specific seam or placement. Respect size-dependent consumption and colorway substitutions. Distinguish quoted, estimated and missing cost. Unknown supplier prices must not become zero in a summarized garment cost.

Existing XML BOM exports are project-defined mappings; the [production audit](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md) says they are not proven equivalent to CLO proprietary XML. Review `src/core/bomXml.js`, `src/core/productionCost.js`, `scripts/check-native-cpp-bom.mjs`, `scripts/check-native-cpp-fabric-cost.mjs`, and [native POM audit](NATIVE_CPP_POM_PARITY_2026-10-15.md). Add revisioned XML/CSV schemas with strict escaping, identifiers and locale-independent numbers. A downstream factory should be able to map these fields without guessing units or color identifiers.

## Construction tech pack

A usable tech pack contains front/back flats, seam and stitch construction callouts, POM diagrams, graded tolerance tables, material/trim specifications, colorways, care details where applicable, placement/print artwork provenance, revision history and sample comments. Each graphic should be generated from the approved garment revision or carry a manually reviewed annotation link. Include sewing order, stitch class and machine recommendation when specified by the designer; never invent these from appearance alone. Where the specification is incomplete, show an explicit `requires specification` state.

The existing `src/core/factoryPackage.js`, `factory-spec.html` and `tech-pack.json` paths are foundations. Generate linked data rather than contradictory independent copies. Store proof of visual approval separately from proof of file integrity, and require sign-off before showing a final production-ready label. Version every attachment and identify nonredistributable renders or avatar media prior to public distribution.

## Export bundle manifest and reproducibility

A recommended package root contains `manifest.json`, source project reference, `/patterns/<size>/*.dxf`, `/markers/<material>/<size>/*.pdf|svg`, `bom.xml`, `bom.csv`, `pom.csv`, `tech-pack.json`, `factory-spec.html`, validation report and license/usage notices for attachments. Those filenames are a target layout, not a claim about the current ZIP's exact tree; existing fixture packs have different file counts. Include content checksums and revision-specific provenance. Sort entries deterministically, use stable number formatting and make all filenames safe for cross-platform extraction.

Validation should check file signature, parsing, manifest completeness, checksum integrity, no unsafe path traversal, export determinism and geometry units. Compare native and JavaScript generation field-by-field, then byte-by-byte where a stable canonical format is intended. Different JSON key order with equivalent data is a formatting parity issue; different DXF cut contour dimensions are a product correctness issue. Use `scripts/check-native-cpp-factory-zip.mjs`, `scripts/check-native-cpp-factory-cli.mjs` and [native factory studies](NATIVE_CPP_BOM_AND_MARKER_PARITY_2026-10-15.md). Keep an explicit list of partially matched output variants until they pass.

## External pilot and approval workflow

Freeze a deliberately simple multi-size tee and trousers fixture. Run structural QA, export the factory package, cross-import DXFs into a separate CAD consumer, inspect rule interpretation, print a calibration reference and compare cutpiece dimensions. Cut sample garments from real material, assemble, press and measure them with an independent technician. Log measurements, deviations, corrected instructions, defect photos and final sign-off. Do not skip sample construction because a drape looks good in the viewport.

The acceptance record should distinguish digital pilot approved, physical sampling approved, first-production approved and recurring production approved. A supplier can approve one size/material/style revision without approving every future grade or colorway. Changes in material shrinkage, hardware, wash or construction methods should invalidate affected approval scopes. Keep old package revisions archived for traceability and recall.

## Release priorities

First make units, grading and DXF semantics auditable. Next improve true-contour nesting, roll rules and physical plot validation. Then complete colorway-aware BOM, trims, POM diagrams and revision management. Only after import/export compatibility is independently proven should the interface call a format fully supported. The practical standard for EXO is a sample maker who can read, measure, cut and sew from a complete package without oral clarification of missing dimensions, while retaining a visible record of remaining uncertainties.
