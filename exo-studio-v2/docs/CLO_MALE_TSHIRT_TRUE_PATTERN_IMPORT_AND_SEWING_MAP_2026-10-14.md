# CLO male T-shirt: true 2D cut-pattern import and sewing correspondence map

**Status:** Editable CLO cut contours imported and checked; complete original sewing graph geometrically traced to 2D; **physical sewing/drape not yet transferred or certified**.

## Provenance and non-destructive export

The installed, running CLO Academic 7.0.242 app had `Male_T-shirt.zpac` open. The official UI exported **File → Export → DXF**, producing a new copy without changing the original garment. The raw CLO ASTM-format DXF is `research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-pattern-20261014.dxf` (171,077 bytes). Preserve it: it contains source construction entities and named pattern blocks, not just outer cutlines.

Because Garment Studio's current general-purpose DXF importer does not interpret the nested CLO ASTM blocks, `scripts/convert-clo-astm-tshirt.py` extracts one authoritative **closed layer-1 cut contour** per CLO block into the distinct, editable `clo-male-tshirt-7piece-import.dxf`. The normalization preserves the original exported millimeter coordinates and roles. `clo-male-tshirt-7piece-import.manifest.json` verifies the seven source contours and piece areas.

`scripts/build-clo-tshirt-import.mjs` produced `clo-male-tshirt-7piece.garment.json` as a distinct Garment Studio project, with `Front`, `Back`, `Right Sleeve`, `Left Sleeve`, and three separate neckline pieces. The live Garment Studio 2D screenshot shows seven pieces, with no invented sewing. It is *not* a fitted simulation.

## Mapping 23 CLO sewing groups onto 2D cuts

The matching official CLO **OBJ + XML metadata** export already preserved `3,661` indexed mesh vertices in `7` named physical mesh groups, `23` `SeamLinePair` groups, and `182` ordered stitch-point correspondences. The OBJ exports one `vt` UV position per mesh vertex. These 2D UVs have the same true physical dimensions as each flat CLO contour, but may be translated and/or mirrored.

New reproducible geometry mapper: `scripts/map-clo-tshirt-sewing.py`. It uses the exact OBJ vertex indices named in the XML, the OBJ's UVs, and the imported true 2D cut polygons. For each of seven pieces it searches all four reflected/unaltered XY variants and registers by bounding-box extent. It then projects **each source stitch point** onto the nearest polygon *segment* (not just nearest vertex), preserving original group, point order, piece ID, 2D X/Y, selected polygon edge index, fraction along the edge and residual.

The output is `research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-clo-sewing-to-2d-mapping.json`. The highest point-to-outline projection error is **2.04249 mm** (back garment); all other pieces are closer, with the great majority at submillimeter residual. Assertions reject projection exceeding 2.1 mm. The data contains **all 23 groups, 182 stitch-point pairs, and two same-piece sleeve seams**; there is no ungrounded manual choice of matching edges.

Four neckline-related seam groups have more than 5% difference between their sampled 2D arm lengths. These need easing, direction and possibly underlay/piece geometry review before physical sewing. A correctly mapped 2D point is not automatically a compatible one-to-one sewing constraint.

## Verification performed

- Parsed the new DXF with the actual `parseDxfPatterns` importer: **7 patterns**.
- Compared imported project point counts and polygon areas with the true original CLO ASTM layer-1 contours: **7/7 within 0.015 cm²**.
- Verified actual source sewing metadata: **23 groups and 182 ordered stitch point pairs** referenced to all seven cut patterns.
- Source 2D sewing registration: **max 2.04249 mm**; upper limit checked at 2.1 mm.
- The live clone screenshots are `.../exports/clo-male-tshirt-dxf-ui.png` and `.../exports/clo-male-tshirt-garmentstudio-ui.png`.

## Exactly what still blocks the end-to-end CLO clone

Our app's `project.seams` schema can represent a pattern **single-edge or partial-edge** pair, but a real CLO `SeamLinePair` typically traces across **multiple small sampled segments** of the imported dense cutline. Do **not** collapse every CLO sewing group to a single guessed `edgeIndex`, or blindly treat all 182 source samples as 182 whole-edge seam records: either action would corrupt correspondence, mesh density or sewing direction. The mapped source graph is available as independently verified geometry metadata, **not yet inserted into the physics engine**.

The next engineering pass should: (1) subdivide each CLO seam polyline at its true cutline edge crossings, (2) resample both sides by synchronized arclength while honoring direction and intentional easing, (3) preserve source group/stitch provenance, (4) verify no overlapping/contradictory seam constraints, (5) produce a new sewn **copy** of the seven-piece garment, and only then (6) run an actual on-body PPF test against the correct avatar with measured strain, stitch gaps and collision gates. Don't overwrite the original source or replace the current default working T-shirt.

## Follow-up: separate 947-partial-seam experimental file completed

`scripts/build-clo-tshirt-seam-candidate.py` now creates **`clo-male-tshirt-sewn-EXPERIMENTAL.garment.json`**, a new seven-piece *candidate* with **947 partial-edge seam links** derived from all 23 real CLO sewing lines. The code tracks their actual source group, local cutline edge fractions and reverse pairing. It splits at all original pattern cutline corners and source stitch sampling points instead of attaching full arbitrary edges. The candidate removes **26 exactly repeated zero-length construction vertices** in its *own* piece copies; the imported master DXF and original Garment Studio project remain unmodified. The sew segments cover original source seam arclength to a **maximum error of 0.00203 cm** across both sides of all 23 groups.

Static acceptance `node scripts/check-clo-tshirt-seam-transfer.mjs` passes: seven source contours, 23 groups, 182 original stitch correspondences, 947 valid and non-zero partial-edge records, **zero intersecting sewing ranges assigned to different CLO groups on the same cutline edge**, no zero-length candidate pattern edges, and the original project still unsown. `npm run check:partial-seams` and `npm run build` also passed. The numerical seam-length mismatches in the four collar-related groups have **not** been hidden or averaged away.

**Critical distinction:** This is a complete *static sewing-candidate data-model transfer*, not proof it is safe to invoke the 3D solver. The candidate explicitly records `cloReference.DO_NOT_DEPLOY_SIMULATION=true` and `sewnFitCertified=false`. Before calling it working clothing simulation, the 3D mesh assembler must demonstrate meaningful point-to-point seam sampling under the current physics resolution, correct orientation and fabric-easing behavior for all 947 ranges, valid neckline panels, stable placement against the matching avatar, and strict no-penetration end-to-end simulation. It has not passed those gates.
