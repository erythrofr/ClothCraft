# EXO Studio V2 × live CLO 7.0.242 — dual toolbars and contextual Property Editor

**Captured and implemented:** October 16, 2026. **Primary reference:** native signed EXO CLO Inspector's live accessibility tree and screenshot of the running CLO 7.0.242 Academic app. **Target:** signed standalone `~/Applications/EXO ClothCraft Studio V2.app`; V1 is not changed. This is an audited iteration, not a claim of full functional or pixel-exact CLO parity.

## Live evidence, not guesses

- macOS permissions were verified working for the signed native inspector (Accessibility and ScreenCaptureKit). The active CLO window is version **7.0.242 (r39887)** and approximately 1512 × 900 pixels. The helper records each tool's actual accessible title, role and global x/y position, alongside screenshots. The original reference was taken with the right Property Editor blank. A later safe, explicit *selection only* of the CLO Object Browser `FABRIC 1` row populated a real Fabric Property Editor. The helper was never used to save CLO files.
- The two physical CLO strips are **3D (A then B)** beside its left viewport and **2D (A then B)** beside its 2D viewport. Real AX x positions: **232, 268, 1096, 1132** respectively. Controls are ordered independently top-to-bottom; do not collapse four columns into one alternating list, nor assume each ordinal shares a single horizontal baseline.
- Exact live AX counts are **20 / 18 / 17 / 15 = 70**. The prior screenshot-inferred EXO map contained 19/19/17/15 and numerous incorrect guesses, especially 3D sewing and 2D sewing/steam/taping. The source `src/data/clo7ToolbarOrder.js` is replaced with **70 verified titles and observed Y coordinates**, using original EXO-drawn icons rather than copying proprietary CLO artwork.
- Installed EXO V2's reference rails now show all 70 named slots in the correct four physical columns by default. Independent headless QA compared each slot's accessible name against the exact same live CLO AX title, checked absolute source order against the recorded Y positions and verified no frontend runtime errors. A full installed native app inspection reconfirmed the order at local ports 5385/5386.

## Verified row-by-row toolbar order

The columns below are two vertical controls each for 3D (left), and two for 2D (right); they are not a single 70-item sequence. **✓** = available directly equivalent action in the native EXO V2 configuration; **○** = CLO position shown in EXO reference rail but disabled until a truthful native implementation exists. Pressing a disabled icon never invokes an unrelated control.

| Position | 3D A (left) | 3D B (right) | 2D A (left) | 2D B (right) |
|---:|---|---|---|---|
| 1 | ✓ Simulate · y130 | ○ Play Motion · y130 | ✓ Transform Pattern · y130 | ○ Edit Sewing · y130 |
| 2 | ✓ Select/Move · y174 | ○ Edit Line (3D Pattern) · y174 | ✓ Edit Pattern · y164 | ○ Segment Sewing · y164 |
| 3 | ○ Select Mesh (Brush) · y208 | ○ Line (3D Pattern) · y208 | ○ Fullness (Point) · y198 | ✓ Free Sewing · y198 |
| 4 | ○ Edit Styleline · y252 | ○ 3D Base Pen · y242 | ○ Polygon · y232 | ○ Check Sewing Length · y232 |
| 5 | ○ Edit Sewing · y296 | ○ Edit 3D Pen (Avatar) · y286 | ✓ Internal Polygon/Line · y266 | ○ Steam · y276 |
| 6 | ○ Segment Sewing · y330 | ○ 3D Pen (Avatar) · y320 | ○ Base Polygon · y300 | ○ Seam Taping · y320 |
| 7 | ○ Free Sewing · y364 | ○ Edit Texture (3D) · y364 | ○ Trace · y334 | ○ Edit Texture (2D) · y364 |
| 8 | ○ Auto Sewing · y398 | ○ Transform Graphic · y398 | ○ Notch · y368 | ○ Transform Graphic · y398 |
| 9 | ○ Edit Tack · y442 | ○ Graphic (3D Pattern) · y432 | ○ Seam Allowance · y402 | ○ Graphic (2D Pattern) · y432 |
| 10 | ○ Tack · y476 | ○ Select/Move Button · y476 | ○ Walk Pattern · y446 | ○ Edit Topstitch · y476 |
| 11 | ○ Fold Arrangement · y520 | ○ Button · y510 | ○ Edit Point of Measure · y490 | ○ Segment Topstitch · y510 |
| 12 | ○ Fold 3D Garment · y554 | ○ Fasten Button · y544 | ○ Point of Measure · y524 | ○ Edit Puckering · y554 |
| 13 | ○ Reset 2D Arrangement (All) · y588 | ○ Zipper · y588 | ○ Edit Annotation · y568 | ○ Segment Puckering · y588 |
| 14 | ○ Reset 3D Arrangement (All) · y622 | ○ Edit Piping · y632 | ○ Pattern Annotation · y602 | ○ Set Sublayer · y632 |
| 15 | ○ Re-drape 3D Arrangement · y656 | ○ Piping · y666 | ○ Pleats · y646 | ○ Fill · y676 |
| 16 | ○ Hi-Res Garment · y700 | ○ Select Binding · y710 | ○ Edit Grading · y690 | — |
| 17 | ○ Edit Measure (Avatar) · y744 | ○ Binding · y744 | ○ Auto Grading · y724 | — |
| 18 | ○ Basic Tape Measure (Avatar) · y778 | ○ Press · y788 | — | — |
| 19 | ○ Edit Measure (Garment) · y822 | — | — | — |
| 20 | ○ Linear Measure (Garment) · y856 | — | — | — |

## How many actions actually work now?

The **native V2** installed smoke test counted **2 enabled 3D A**, **0 enabled 3D B**, **3 enabled 2D A**, **1 enabled 2D B** = **6 enabled**, with **64 truthfully disabled**. The working actions are CLO-aligned Simulate, Select/Move, Transform Pattern, Edit Pattern, Internal Polygon/Line, and Free Sewing. Some available EXO-specific commands remain in their separate EXO tools section and are not mislabeled as equivalents for CLO-specific rows. This is order/naming parity, *not* full functionality parity. No CLO proprietary icon images or code were copied.

## Right-side contextual Property Editor — actual new observation

CLO's right side is split **Object Browser above Property Editor**. In the original empty CLO scene the Property Editor body was blank. After selecting actual CLO `FABRIC 1` (without assigning or changing fabric), the right Property Editor showed:

1. **Fabric** asset header and **Open / Save** asset controls (not a generic pattern Property Editor).
2. **Information** accordion with **Name: FABRIC 1**, **Item No.: None**, **Construction: None**, **Supplier: None**, and **Owner: None**.
3. **Material** accordion with **PBR**, **Front / Back / Side** face tabs. The scrolled viewport showed **Texture Mapping: Repeat**, **Type: Fabric_Matte**, **Basic Parameters** containing **Texture**, **Normal Map**, **Displacement Map**, **Color**, **Opacity (100)**, **Opacity Map**, then **Reflection**. These are read directly from actual CLO screen captures, not inferred from its tutorial.

EXO's draft Fabric asset context is now **Information → Material → Physical Property → Miscellaneous**, rather than presenting a garment panel's eight Property Editor groups. The five material-metadata fields are editable via the typed EXO document transactions; color/roughness/metalness/sheen remain editable EXO appearance parameters. Front is shown as the shared draft material; Back and Side are **disabled** until the renderer has actual independently stored/previewed per-face PBR data. Texture, Normal, Displacement, and Opacity map displays are not advertised as separate editable CLO-equivalent assets where EXO has no independent contract. Approximate EXO draft physical values are grouped under Physical Property and labeled non-calibrated. Native Rust fabrics have a separate authoritative Fabric workspace; selecting a draft swatch never silently replaces native cloth physics.

For selected patterns and native pattern lines, the editor retains eight ordered CLO-inspired pattern groups (Information, Selected Line, Simulation Properties, Fabric, Bond, Solidify, Arrange, Miscellaneous). Actual selected named Rust boundaries show separate real **2D UV and 3D simulated line lengths**, 3D stretch, sewing references and revision-guarded drafting-length specifications. Sewing pairs show their individual partial lengths and real native gap/stiffness. These controls are implemented and separately tested, but the current empty live CLO reference does **not** establish that every selected-pattern dropdown exactly matches 7.0.242. Official CLO references guide the remaining content, and physical Elastic/Seam Taping/Bond/Solidify stay disabled until solver-backed.

## Required further implementation, in safe batches

- **Batch 1, semantics and selection:** one native selection registry with stable IDs/revisions for pattern, contour segment, internal line, seam pair, fabric asset, button and buttonhole, topstitch style vs placement, arrangement point and avatar. Shared typed capability schemas between app UI, Rust and future SDK/MCP. The 6 enabled toolbar positions should remain regression-locked while adding more.
- **Batch 2, 3D A sewing and garment manipulation:** implement actual Select Mesh brush, Edit Styleline, Edit/Segment/Free/Auto Sewing, Tack, Fold Arrangement, Fold 3D Garment, 2D/3D arrangement reset, Re-drape, Hi-Res Garment and measurement functions. Verify each action changes a legitimate native selection/geometry/solver state and supports undo; don't wire a superficially similar unrelated EXO action.
- **Batch 3, 3D B tools:** real 3D pen/stroke representation, avatar annotations, texture transforms, graphic selection and placement, button placement/fasten/rigid collision, zipper, piping, binding and press constraints. Separate EXO draft-only annotations from native cloth attachment forces.
- **Batch 4, 2D A drafting:** full Edit Pattern/Fullness, Polygon/Base Polygon/Internal Polygon, Trace, Notch, Seam Allowance, Walk Pattern, POM and grading/pleat/annotation editing with accurate geometry, control-point snapping and typed measurement units. Existing preview-only drawing must not be mistaken for native contour authoring.
- **Batch 5, 2D B construction:** Segment/Free Sewing with matching seam topology, Check Sewing Length, Steam, Seam Taping, Edit Texture, Transform/Place Graphic, Edit/Segment Topstitch, Puckering, Sublayer and Fill. Add explicit material/constraint physics only after observed solver effect and undo/reopen tests.
- **Batch 6, Property Editor field parity:** load a **disposable sample garment in CLO**, preserve user's working project, select each object type and scroll every Property Editor section in 7.0.242. Capture screenshots and AX fields at the same selection ID and units. Then compare EXO's context-specific editor field names, units, range, default, visibility, enum options and realized effects. Implement missing per-face material maps, native physical parameter backing, sewing tension/fold, line Elastic and Taping, Bond/Skive/Solidify, graphics, trims and POM/graded measurements. Only call a control *matched* when selection, UI, action and resulting geometry all agree; do not use visual similarity alone.

## Validation, reproducibility and limitations

- `node integrations/clothcraft/qa-v2-clo-live-four-column.mjs`: 70 live AX titles and observed Y values compared against EXO manifest, then isolated internal headless UI assertions for four actual columns, enabled/disabled affordances and zero JavaScript errors. No user-visible browser window is opened; **the deliverable is always the signed EXO V2.app**.
- `node integrations/clothcraft/qa-v2-right-inspector.mjs`, `qa-v2-property-context-extended.mjs`, `check-v2-property-commands.mjs`: verify contextual dropdown ordering, editable fabric metadata, false native changes prevented, draft undo, invalid input rejection.
- `npm run check:non-simulation`, `npm run build`, and `npm run clothcraft:build-v2-workspace`: drafting/factory integrity and signed native standalone app. Installed app audit again confirmed **20/18/17/15**, **6 truly enabled**, **64 disabled**, and no frontend page errors.
- The live CLO source's default project has no actual garment panels loaded; selected pattern/edge controls still require the disposable-sample audit before claiming exact field-by-field version parity. Material editor samples are verified and reflected in the EXO layout, but the physical fabric shader pipelines are not equivalent or independently calibrated. EXO's tool icons remain custom approximations, not copied CLO art; pixel-level icon equivalence is deliberately not asserted.

See `docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md`, `docs/CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md`, and `docs/EXO_CLO3D_V2_PROPERTY_EDITOR_IMPLEMENTATION_20261016.md`. Original user CLO project was not saved or modified; only a temporary fabric selection and scrolling were performed.
