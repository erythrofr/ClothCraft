# CLO male T-shirt: native 2D DXF export and Garment Studio import

Date: October 14, 2026. This pass is **completed for 2D pattern import**, not cloth-fit certification.

## Original source and outputs (private local workspace)

Source loaded in the running licensed CLO 7.0.242 app: `~/Documents/clo/Assets/Garment/Male_T-shirt.zpac`. We used the actual **File → Export → DXF** UI and selected the application's export defaults: DXF-ASTM, 100% size, millimeters, no rotation. The original native garment was not edited or overwritten.

All resulting files are in `research/clo-reference/live-audit-20261014/exports/`:

* `clo-male-tshirt-pattern-20261014.dxf` — **actual CLO export** (171,077 bytes). Keep this authoritative original.
* `clo-male-tshirt-7piece-import.dxf` — normalized import DXF (56,484 bytes), one true cutline per source block.
* `clo-male-tshirt-7piece-import.manifest.json` — contour provenance, precision and area information.
* `clo-male-tshirt-7piece.garment.json` — full editable Garment Studio document with the true 2D CLO outlines; originally authored projects are untouched.
* `clo-male-tshirt-garmentstudio-ui.png` and `clo-male-tshirt-dxf-ui.png` — live browser import verification images (isolated Chrome session, no mutation of installed app).
* `clo-reference-tee-20261014.obj` and `clo-reference-tee-20261014_meta_data.xml` — separately exported **CLO 3D pattern meshes and source sewing correspondences** from the earlier reference pass.

## Confirmed 2D geometry

| Native CLO block | Garment Studio role | Vertices | Area (cm²) |
|---|---|---:|---:|
| `37_M` | Front | 302 | 3163.75 |
| `7_M` | Back | 276 | 3437.07 |
| `36_M` | Right Sleeve | 151 | 506.73 |
| `39_M` | Left Sleeve | 151 | 506.73 |
| `Pattern2D_768516_M` | Neck Piece A | 4 | 23.95 |
| `Pattern2D_768527_M` | Neck Piece B | 6 | 29.81 |
| `Pattern2D_768528_M` | Neck Piece C | 4 | 23.95 |

The existing generic DXF parser initially found **14** closed polygons (both CLO layer 1 cutlines and redundant layer 84 cutlines). The CLO-specific conversion deliberately selects **exactly one original layer 1 contour from each of 7 ASTM BLOCKs**. Source coordinates are preserved in millimeters; the application's existing importer converts them to centimeters (factor 0.1). No fabricated pattern curves, altered silhouettes or arbitrary resizing were required.

## Verification

1. `python3 scripts/convert-clo-astm-tshirt.py SOURCE.dxf DERIVED.dxf`: produced exactly 7 traceable CLO cutlines.
2. `parseDxfPatterns(DERIVED.dxf)`: returned 7 pieces at 0.1 cm/mm with finite and plausible dimensions.
3. `node scripts/build-clo-tshirt-import.mjs`: generated distinct `.garment.json` with 7 editable patterns and an approximate starter 3D arrangement. The three tiny collar pieces remain 2D-only until neckline assembly is implemented.
4. Independent Chrome import using `input[type=file]`: the `.garment.json` **rendered 7 pattern pieces** with correct IDs and zero browser errors; the normalized `.dxf` also rendered **7 pattern pieces**, again with zero browser errors.
5. `npm run build`: passed after preparation.

**What is not yet finished:** the DXF stores 2D shapes, not a validated garment fit. It does not import the 23 native CLO sewing groups (182 sampled correspondence points) into our 2D edge-level sewing graph. Those correspondences are preserved in the original OBJ/XML sidecar, but require a verified 2D-to-mesh correspondence map and edge intervals before creating live seams. The garment is therefore **7 editable patterns / 0 assigned seams / not yet a fitted T-shirt**. Do not present its 3D staging preview as successful physical simulation. The CLO original's reference staged mesh also has large pre-sewing gaps; it is not a substitute for PPF's 3 cm starting stitch-gap gate.

**Next improvement:** use preserved XML/OBJ sewing topology and the cutline DXF to create a validated edge/correspondence mapping, then run sewing + drape tests on the target avatar while enforcing the solver's physical contact gates. Avoid copying proprietary CLO assets into the public source candidate.
