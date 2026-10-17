# V2 toolbar functional repair pass — 2026-10-17

## Scope and truthful completion status
User requested working left and right toolbars, not clickable placeholders. This pass repairs real native workflows; **the entire toolbar is NOT complete**. The reference inventory currently declares 13 native actions, 9 inspection-only actions and 48 unavailable feature systems. Counts are source classifications, not 70 new behavioral test passes. EXO supplemental tools are additional to that reference inventory.

## Repairs
- Right toolbar Split now inserts a native contour point at the clicked boundary arclength; undo restores topology.
- Curve shows anchors even on straight patterns. Click an anchor to create native curve handles, Option-click to straighten, drag handles to edit actual shape.
- Metric tape receives the actual native 2D tool event.
- Camera Fit computes bounds from native world-space garment particles, respecting viewport aspect/FOV.
- Strain view computes maximum principal engineering extension from each triangle's deformation gradient, averaged to vertices. Blue 0% through red 25%+. This is not stress, pressure or fit certification. Original fabric appearance returns when disabled.
- Mirror/duplicate commands listen with the current native selection. Missing selection / busy operations produce feedback instead of silent no-ops.
- Left Hand/Move/Rotate buttons send explicit native commands on every activation, including repeated clicks. Move selection highlighting is consistent.
- Split/Curve were inadvertently absent from All tools because obsolete column arrays excluded them from EXO extras. Restored them to the expandable supplemental palette.
- Reset 2D Arrangement executes a bounded atomic native BoardTransform batch. Validation finishes before mutation; one Undo restores all layouts. Native drape/rest UV are preserved. This batch deliberately rejects non-layout operations.
- Re-drape requests native simulation without toggling an already-running simulation off. Existing collision checks remain enforced.
- Working-only left toolbar filter now uses native capabilities rather than outdated legacy action IDs.

## Verification completed
- check-v2-strain-view.mjs: rest state, 20% extension, rigid-transform invariance, degenerate triangles, vertex averaging.
- check-v2-layout-batch.mjs: invalid batch rollback including history, unchanged UV/positions, single undo/redo, native save/reopen.
- qa-v2-toolbar-repair.mjs: actual browser clicks through Curve, Split, Measure, Camera Fit, strain toggle, selected-panel Mirror and atomic Reset 2D with undo. Isolated real Rust bridge, no mocked physics and no personal project mutation. Output: integrations/clothcraft/output/qa-v2-toolbar-repair-TueuPI.
- Rust adapter compiled successfully. Production build, Hand regression and installed app verification recorded below when completed.

## Unfinished systems
A help popup is not an implementation. No new claim is made for native tacks/pins, trim/button/zipper attachments, 3D surface pen authoring, avatar motion/measurement authoring, grading, seam allowances/notches, textile finishing or other unavailable rows. The upstream ClothCraft authoring command enum does not provide equivalents for these full feature families; they cannot be completed by simply copying an existing toolbar callback. Existing legacy EXO asset browsers are not proof of native solver attachment.

## Reference inventory
| Position | Tool | Declared capability |
|---|---|---|
| 3d:A01 | Simulate | native |
| 3d:A02 | Select/Move | native |
| 3d:A03 | Select Mesh (Brush) | unavailable |
| 3d:A04 | Edit Styleline | unavailable |
| 3d:A05 | Edit Sewing | inspect |
| 3d:A06 | Segment Sewing | native |
| 3d:A07 | Free Sewing | native |
| 3d:A08 | Auto Sewing | unavailable |
| 3d:A09 | Edit Tack | unavailable |
| 3d:A10 | Tack | unavailable |
| 3d:A11 | Fold Arrangement | unavailable |
| 3d:A12 | Fold 3D Garment | unavailable |
| 3d:A13 | Reset 2D Arrangement (All) | native |
| 3d:A14 | Reset 3D Arrangement (All) | native |
| 3d:A15 | Re-drape 3D Arrangement | native |
| 3d:A16 | Hi-Res Garment | unavailable |
| 3d:A17 | Edit Measure (Avatar) | unavailable |
| 3d:A18 | Basic Tape Measure (Avatar) | unavailable |
| 3d:A19 | Edit Measure (Garment) | inspect |
| 3d:A20 | Linear Measure (Garment) | inspect |
| 3d:B01 | Play Motion | unavailable |
| 3d:B02 | Edit Line (3D Pattern) | unavailable |
| 3d:B03 | Line (3D Pattern) | unavailable |
| 3d:B04 | 3D Base Pen | unavailable |
| 3d:B05 | Edit 3D Pen (Avatar) | unavailable |
| 3d:B06 | 3D Pen (Avatar) | unavailable |
| 3d:B07 | Edit Texture (3D) | inspect |
| 3d:B08 | Transform Graphic | unavailable |
| 3d:B09 | Graphic (3D Pattern) | unavailable |
| 3d:B10 | Select/Move Button | unavailable |
| 3d:B11 | Button | unavailable |
| 3d:B12 | Fasten Button | unavailable |
| 3d:B13 | Zipper | unavailable |
| 3d:B14 | Edit Piping | unavailable |
| 3d:B15 | Piping | unavailable |
| 3d:B16 | Select Binding | unavailable |
| 3d:B17 | Binding | unavailable |
| 3d:B18 | Press | unavailable |
| 2d:A01 | Transform Pattern | native |
| 2d:A02 | Edit Pattern | native |
| 2d:A03 | Fullness (Point) | unavailable |
| 2d:A04 | Polygon | native |
| 2d:A05 | Internal Polygon/Line | native |
| 2d:A06 | Base Polygon | unavailable |
| 2d:A07 | Trace | unavailable |
| 2d:A08 | Notch | unavailable |
| 2d:A09 | Seam Allowance | unavailable |
| 2d:A10 | Walk Pattern | unavailable |
| 2d:A11 | Edit Point of Measure | inspect |
| 2d:A12 | Point of Measure | inspect |
| 2d:A13 | Edit Annotation | unavailable |
| 2d:A14 | Pattern Annotation | unavailable |
| 2d:A15 | Pleats | unavailable |
| 2d:A16 | Edit Grading | unavailable |
| 2d:A17 | Auto Grading | unavailable |
| 2d:B01 | Edit Sewing | inspect |
| 2d:B02 | Segment Sewing | native |
| 2d:B03 | Free Sewing | native |
| 2d:B04 | Check Sewing Length | inspect |
| 2d:B05 | Steam | unavailable |
| 2d:B06 | Seam Taping | unavailable |
| 2d:B07 | Edit Texture (2D) | inspect |
| 2d:B08 | Transform Graphic | unavailable |
| 2d:B09 | Graphic (2D Pattern) | unavailable |
| 2d:B10 | Edit Topstitch | unavailable |
| 2d:B11 | Segment Topstitch | unavailable |
| 2d:B12 | Edit Puckering | unavailable |
| 2d:B13 | Segment Puckering | unavailable |
| 2d:B14 | Set Sublayer | unavailable |
| 2d:B15 | Fill | unavailable |

All existing user/concurrent changes were preserved. No commit, push or public release performed.
