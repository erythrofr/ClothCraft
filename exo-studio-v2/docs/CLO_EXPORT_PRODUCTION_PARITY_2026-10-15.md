# Garment Studio export & production: CLO3D comparison pass

**Date:** 2026-10-15. **Scope:** editable Garment Studio workspace in `src/`, offline bundled macOS build, and factory outputs. This document does **not** imply that any commercially licensed CLO3D format was reverse-engineered, that our CAD files have been imported into CLO3D, or that a factory has accepted them.

## Primary CLO product references

- [CLO: 2D Pattern DXF Import/Export](https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export) — Standard DXF / AAMA / ASTM, grades, rule files, scale, rotation, selective export and pattern annotations.
- [CLO: Plot Patterns](https://support.clo3d.com/hc/en-us/articles/360001557927-Plot-Patterns) — actual-size plotting, cut-line choice, notches, additional annotations, preview, physical plotter and `.plt` HP-GL.
- [CLO: BOM(XML) Export](https://support.clo3d.com/hc/en-us/articles/115000525207-BOM-XML-Export) — combined XML, native project, and colorway/fabric/button/garment/pattern/print-layout images.
- [CLO staff: 1:1 PDF print layouts](https://support.clo3d.com/hc/en-us/community/posts/10447117236633-Export-definitive-print-layout-as-PDF) — actual-size PDF via Print Layout snapshot/export.

## Direct feature inventory

| Production function | Current status | Reproducible evidence | Major remaining gap |
|---|---|---|---|
| Standard layered DXF export with grain/sewing/notches | Implemented and tested | `scripts/check-production.mjs`; `scripts/dxf-roundtrip-check.mjs` | Not a verified industrial AAMA/ASTM file |
| Export selected 2D pattern | Implemented; unit DXF round-trip tested | `src/App.jsx`; `scripts/check-production-handoff.mjs` | Selected-only browser scenario not yet separately tested |
| Multi-size DXF production handoff | Implemented and tested | `scripts/check-factory.mjs` | Combined size nesting / grading rules via industrial DXF incomplete |
| AAMA / ASTM export and import | Missing certified compatibility | `src/core/dxf.js` | Implement format-specific annotations / grade blocks and cross-import fixtures in CLO, Lectra, Gerber |
| Rule file / grading block interoperability | Partial | `src/core/grading.js`, project size-run JSON | Export/import documented industrial rule formats; grading edge cases |
| True-size PDF print layout | Implemented, parser+scale tested | `src/core/markerArtifacts.js`; `scripts/check-production-handoff.mjs`; PyMuPDF verified 150 cm × 139.19 cm MediaBox | Physical printer/plotter calibration, page tiling and overlaps remain |
| True-size SVG print/cut layout | Implemented and tested | `markerToSvg` with separate cut/grain/notch/label groups | Consumer compatibility and registration controls remain |
| Fabric-specific marker layout, quantity and overflow | Functional, partial industrial behavior | `src/core/marker.js`, `scripts/check-markers.mjs` | True non-rectangular industrial nesting, manual rearrangement, placement locks, roll constraints |
| Cutter/plotter PLT export | Missing | N/A | Graphtec-style HP-GL implementation and external validation |
| Pattern/POM tables and measurement tolerances | Implemented and tested | `src/core/measurements.js`, `scripts/check-production.mjs` | Supplier measurement methods, colorway and revision sign-off |
| Standard XML fabric/trim bill of materials | Partially interoperable | `src/core/bomXml.js`; `scripts/check-production-handoff.mjs` | Our documented XML schema is **not** CLO proprietary XML; no CLO round-trip |
| Graded fabric-consumption and optional price estimation | Implemented and tested | `src/core/productionCost.js`; `fabric-costing.csv` | Colorway prices, trims, multi-garment batches, tax/freight/labor and quoted purchasing |
| Factory-readable print sheet and structured tech pack | Implemented; sample validation needed | `factory-spec.html`, `tech-pack.json`, `scripts/check-factory.mjs` | Style drawings, callout placement, factory tech-pack acceptance |
| Single downloadable graded factory ZIP | Implemented and tested | `src/core/factoryPackage.js` (45 files for hoodie fixture) | Production-ready sign-off procedure and factory importer |
| Structural preflight (all sizes) | Implemented and tested | `src/core/productionPreflight.js`; regression fixtures | Does not certify physical garment fit, cutting tool tolerance or whole-line QA |
| 3D garment OBJ/GLB export | Present and separately tested | `scripts/check-obj-export.mjs`, `scripts/check-glb-export.mjs` | Topology/UV/morph/preset parity, vendor import QA |
| FBX, Alembic, USD and export presets | Mostly missing | Project has OBJ/GLB paths | Implement formats safely, animation and material option coverage |
| CLO-style BOM image package with colorways | Missing | Native image exports available individually | Attach screenshots, PBR textures, project, rendered variants and versioned attachments |

## What changed in this engineering pass

1. Added editable fabric prices per meter in the Production workspace and multi-size estimated consumption and fabric-only cost calculations. Missing prices remain unknown; incomplete fabric markers invalidate cost totals.
2. Added true-size marker PDF/SVG outputs at fabric width and calculated length, with 2D grainline/notch/label annotations where defined.
3. Added direct selected-pattern DXF export, BOM XML export and explicit all-size production blockers/warnings in the Production workspace.
4. Expanded ZIP with XML BOM, `fabric-costing.csv`, structural QA JSON and per-size per-fabric plotted PDF/SVG files while retaining source/POM/seams/DXF.
5. Built a separate, signed ARM64 macOS app staging artifact from the updated web output; the **installed/running app remains unchanged** to avoid disrupting the user's session.

## Reproducible checks completed

- `npm run check:production-handoff` — pass: malformed geometry, missing fabrics, cut quantities, broken seam, self-crossing, over-width fabric, true-size PDF and SVG, BOM XML, costing unknown vs supplied, ZIP files and one-piece DXF.
- `npm run check:production-ui` — pass: isolated headless browser selected Production workspace, entered a fabric meter price and actually downloaded DXF, PDF, SVG, BOM XML and factory ZIP without runtime errors.
- `npm run check:non-simulation` — pass: DXF round-trip, construction DXF fidelity, size grading, factories, markers, mesh selections and drafting precision.
- `npm run check:clo-parity-ci` — pass: original selected-feature matrix schema/evidence remained valid. **This does not recalculate complete product parity.**
- `npm run build` — pass, after implementation.
- `INCLUDE_PREPARED_SOLVES=0 INCLUDE_PRIVATE_THOMAS=0 bash native_app/build.sh arm64 && bash native_app/test_bundle.sh arm64` — pass for a self-contained signed **staged** desktop app (without preparing heavy simulations or including private avatar files).
- Python `fitz` independently opened an example PDF, reporting page dimensions of 4251.97 × 3945.62 points, equivalent to 150 × 139.19 cm.

## Defensible parity statement

**Not 90% CLO3D production parity yet.** Passing a test suite demonstrates the checked operations work under their tested conditions, not that all CLO export settings, vendor formats, print devices or manufacturing workflows are covered. The project's earlier *whole-product selected-feature* replica audit reported 54.1%, but that is from a different 43-feature scope and cannot be treated as a fresh score for this subsystem. No new 90% numeric assessment is warranted without external reference fixtures and equally weighted end-to-end tests.

## Next 90%-gate engineering order

1. **AAMA/ASTM and grading interoperability:** obtain permitted reference fixtures from the open CLO app, implement documented industrial DXF semantics and independently cross-import all pattern/grading/notch cases.
2. **Plotter/marker controls:** HP-GL/PLT, accurate tiling, registration marks, fabric orientation constraints, manual placement editing and physical 100% print calibration.
3. **Full BOM costing/production data:** colorways, per-trim and labor cost, construction callout drawings, vendor SKU and revision approvals, formal XML interoperability mapping where possible.
4. **3D interoperability/presets:** UV/material/thickness and topology toggles, animation and export preset persistence, certified FBX/USD/Alembic where appropriate.
5. **End-to-end acceptance:** open exported files in the user's CLO3D application and at least one independent pattern/cutter consumer; confirm units, dimensions, seam/grading metadata and physical outputs. Only promote a row to complete when reproducible evidence is saved.

**Safety rule:** The factory package deliberately ships QA warnings alongside output; exporting a ZIP does not make a garment ready for cutting or mass production.
