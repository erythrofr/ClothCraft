# Garment Studio CLO3D parity reconnaissance

**Product:** Garment Studio on macOS, an independently authored
CLO3D-inspired CAD, garment-design and textile-simulation program.
**Target:** functional equivalence on tested user workflows, not copying
CLO3D source, unique artwork, proprietary assets or internal algorithms.
**Reviewed:** October 14, 2026.

## Scope and public references

| Source | What we can learn |
| --- | --- |
| https://clo3d.com/en/product/features | Published CLO3D features and priorities |
| https://support.clo3d.com/hc/en-us/categories/115000064648-Manual | Public manual reference |
| https://support.clo3d.com/hc/en-us/sections/115000617868-2D-Pattern-Edit | Pattern edit behavior |
| https://support.clo3d.com/hc/en-us/sections/115000642008-2D-PATTERN | Pattern authoring operations |
| https://support.clo3d.com/hc/en-us/sections/115003578728-2D-Pattern-Information | Seam allowances and annotations |
| https://support.clo3d.com/hc/en-us/article_attachments/48293801440281 | Public toolbar index |
| docs/CLO_DRAFTING_WORKSPACE_MATERIAL_ACCEPTANCE_2026-10-14.md | Current verified Garment Studio scope |
| docs/PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md | Actual failed physical-fit acceptance |
| docs/NATIVE_CPP_QT_REWRITE_PLAN_2026-10-14.md | Status and constraints of the native rewrite |

The named public CLO references above are known workflow references from our
previous engineering research. A comprehensive 2026.1 release-to-release
reference review has **not** been completed in this pass. Never convert an
unseen option into a claim of 1:1 behavior.

## Screen inventory

| ID | Workspace | Entry point | Important states and components |
| --- | --- | --- | --- |
| S01 | 2D drafting | Pattern workspace | Empty and selected canvas, piece moving, vertex and curve tools, snapping, inspector |
| S02 | 3D garment | Garment viewport | Avatar visible, arranged panels, selected mesh, transform gizmo, post-solve states |
| S03 | Sewing | Sewing workspace | First edge pending, seam correspondence drawn, mismatch audit, invalid/sewn state |
| S04 | Fabrics and materials | Fabric workspace | Swatches, PBR controls, maps uploaded, physical/visual differences |
| S05 | Production | Production workspace | Grading, marker, POM table, DXF and tech pack export |
| S06 | Render | Render workspace | HDRI and optical controls, still export, output format |
| S07 | Preferences | Layout menu | Draft/sewing/material/render preset, custom saved layout, restored layout |

**Reference screenshot status:** An authenticated local CLO Academic 7.0.242
Male T-shirt screenshot was found from October 14, 2026, and a corresponding
Garment Studio Foundation Tee viewport was captured. Their 2D window
chrome is comparable; the drawings are **not the same garment/state**.
Only a masked 2D-interface comparison is measured; no complete visual
1:1 score is available. See
`docs/CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md`.

## Core workflow contracts

### F01 — Select and move a 2D pattern

S01 open piece → select tool → drag piece fill or edge → release → save.
The piece position changes; geometry, sewing and piece identity are unchanged.
No measurement, edge inspector or context menu appears over the drawing.

Existing browser QA:
`scripts/qa-2d-nonblocking-measurements.mjs`.

### F02 — Draft a precise curve

S01 select piece → point/curve tool → select handle → edit exact dimensions
in the right Property Editor → apply → Undo/Redo. The arc length and sewing
measurements update without losing piece IDs.

Existing browser QA:
`scripts/qa-precision-point-curve.mjs`.

### F03 — Sew pieces and simulate physical drape

S03 select corresponding edges → stitch graph → S02 arrange near body →
invoke native PPF → validate every frame → final fully sewn fitted shape.

**Blocked:** The initial Thomas tee assembly has >3 cm worst opening.
An earlier PPF Metal trajectory passed runtime invocation but collided with
the avatar and left substantial stitch separation. Neither demonstration
constitutes a completed clothed avatar. Evidence:
`docs/PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md`.

### F04 — Assign a fabric and render

S04 select a swatch → change PBR optics → update shader without restarting
physics → S06 export a still image. Physical cloth calibration and full
path tracing remain separate unverified goals.

Existing browser QA:
`scripts/qa-clo-workspace-fabric-seamly.mjs`,
`scripts/qa-material-render-still.mjs`.

### F05 — Produce manufacturing outputs

S01 pattern shape → S05 size-run grading → seam allowance/DXF → marker →
tech pack. Current round-trip and accuracy checks cover selected fixtures,
not every supplier interchange format.

Existing QA: `scripts/dxf-roundtrip-check.mjs`,
`scripts/check-markers.mjs`, `scripts/check-production.mjs`.

## Inferred data model

- GarmentDocument: `pieces`, `seams`, `fabrics`, `avatar`,
  `grading`, `customMeasurements`, project history.
- PatternPiece: stable ID, flat `points`, optional quadratic `curves`,
  `layout2d`, `arrangement3d`, grain, edges and seam allowances.
- SewingRelation: named links between piece-edge intervals.
- Fabric: optical maps/parameters **and** separate mechanical parameters.
- SimulationResult: geometry/time state plus independently audited
  stitch/contact/strain evidence; a solver invocation is not acceptance.

These fields are grounded in Garment Studio's own implementation, not
statements about CLO3D's proprietary file schema.

## Known non-clonable assets and boundaries

Do not extract CLO3D binary implementation, bypass accounts or licensed
access, redistribute a CLO-exported Thomas model, use target screenshots
as shipped art, or reproduce copyrighted icon assets. Independent behavior
and professional user workflow are the target.

The matrix `replica/features.csv` records the currently selected
feature requirements with must/should/could weights, our implementation
status and local code evidence. Updating that file and regenerating
`replica/parity.md` is the repeatable comparison method.
