# CLO 7.0.242 live toolbar audit — 2026-10-16

This audit uses the **signed EXO CLO Inspector** read-only capture at `~/Library/Application Support/EXO-CLO-Inspector/clo-property-editor-reference.png` and its `latest-status.json`, compared with `src/data/clo7ToolbarOrder.js` and `docs/CLO_V7_EXACT_DUAL_TOOLBAR_ORDER_2026-10-16.md`. The screenshot shows CLO version **7.0.242 (r39887)** and its four independent physical toolbar columns. Command names below come from **live accessibility `name` fields**, not icon guesses. The screenshot confirms their positions; AX frames provide the exact y ordering. The named AX controls have 30px height; unlabeled, zero-height AXButton entries are excluded as structural duplicates.

## Counts and column locations

| Column | AX frame x | Live named controls | EXO manifest | Alignment |
|---|---:|---:|---:|---|
| 3D A, left subcolumn | 232 | **20** | 19 | Missing one slot and widespread command differences |
| 3D B, right subcolumn | 268 | **18** | 19 | Extra EXO slot and widespread command differences |
| 2D A, left subcolumn | 1096 | **17** | 17 | Counts match; substantive command/order differences |
| 2D B, right subcolumn | 1132 | **15** | 15 | Counts match; substantive command/order differences |

Ordinal numbers below count top to bottom *within each column*. Columns A and B have independent divider spacing: paired ordinal numbers **do not mean the icons share the same y position**.

## 3D left physical toolbar — live AX command sequence

| Ordinal | Column A (x=232; top y: command) | Column B (x=268; top y: command) |
|---:|---|---|
| 1 | 130: Simulate | 130: Play Motion |
| 2 | 174: Select/Move | 174: Edit Line (3D Pattern) |
| 3 | 208: Select Mesh (Brush) | 208: Line (3D Pattern) |
| 4 | 252: Edit Styleline | 242: 3D Base Pen |
| 5 | 296: Edit Sewing | 286: Edit 3D Pen (Avatar) |
| 6 | 330: Segment Sewing | 320: 3D Pen (Avatar) |
| 7 | 364: Free Sewing | 364: Edit Texture (3D) |
| 8 | 398: Auto Sewing | 398: Transform Graphic |
| 9 | 442: Edit Tack | 432: Graphic (3D Pattern) |
| 10 | 476: Tack | 476: Select/Move Button |
| 11 | 520: Fold Arrangement | 510: Button |
| 12 | 554: Fold 3D Garment | 544: Fasten Button |
| 13 | 588: Reset 2D Arrangement (All) | 588: Zipper |
| 14 | 622: Reset 3D Arrangement (All) | 632: Edit Piping |
| 15 | 656: Re-drape 3D Arrangement | 666: Piping |
| 16 | 700: Hi-Res Garment | 710: Select Binding |
| 17 | 744: Edit Measure (Avatar) | 744: Binding |
| 18 | 778: Basic Tape Measure (Avatar) | 788: Press |
| 19 | 822: Edit Measure (Garment) | — |
| 20 | 856: Linear Measure (Garment) | — |

The 3D A AX set includes a popup for Simulate, mesh select, styleline, sewing variants, tack, resolution and measurement; the other entries have AXButton or AXCheckBox roles. 3D B includes popups for avatar pen and button; the remaining named controls are largely checkboxes. These role distinctions identify accessible widget types, not whether functions were executed.

## 2D right physical toolbar — live AX command sequence

| Ordinal | Column A (x=1096; top y: command) | Column B (x=1132; top y: command) |
|---:|---|---|
| 1 | 130: Transform Pattern | 130: Edit Sewing |
| 2 | 164: Edit Pattern | 164: Segment Sewing |
| 3 | 198: Fullness (Point) | 198: Free Sewing |
| 4 | 232: Polygon | 232: Check Sewing Length |
| 5 | 266: Internal Polygon/Line | 276: Steam |
| 6 | 300: Base Polygon | 320: Seam Taping |
| 7 | 334: Trace | 364: Edit Texture (2D) |
| 8 | 368: Notch | 398: Transform Graphic |
| 9 | 402: Seam Allowance | 432: Graphic (2D Pattern) |
| 10 | 446: Walk Pattern | 476: Edit Topstitch |
| 11 | 490: Edit Point of Measure | 510: Segment Topstitch |
| 12 | 524: Point of Measure | 554: Edit Puckering |
| 13 | 568: Edit Annotation | 588: Segment Puckering |
| 14 | 602: Pattern Annotation | 632: Set Sublayer |
| 15 | 646: Pleats | 676: Fill |
| 16 | 690: Edit Grading | — |
| 17 | 724: Auto Grading | — |

## Divergences relative to the current EXO manifest

1. **3D A: 20 AX commands versus 19 EXO slots.** Manifest entries A04–A15 currently describe pin, component, mesh and avatar arrangement guesses. The actual run from live AX is `Edit Styleline` → four sewing operations → tack variants → fold/arrangement/reset controls. The last five AX commands are `Hi-Res Garment` and four separate avatar/garment measurement commands, unlike the manifest's two generic measurement icons and garment zipper endings.
2. **3D B: 18 AX commands versus 19 EXO slots.** Existing B02–B06 describe generic curve/styleline variants; live AX identifies `Edit Line (3D Pattern)`, `Line (3D Pattern)`, `3D Base Pen`, `Edit 3D Pen (Avatar)`, `3D Pen (Avatar)`. Existing B15–B19 show material swatches/magnet guesses; the actual tail is `Piping`, `Select Binding`, `Binding`, `Press` (B15–B18 live ordinals). `Edit Texture (3D)` and graphics occupy live positions 7–9, followed by button/zipper and piping operations.
3. **2D A: 17 AX commands versus 17 slots, but misleading labels and positions.** Live A03 is `Fullness (Point)` (manifest `Edit or split a segment`), A06–A09 are `Base Polygon`, `Trace`, `Notch`, `Seam Allowance` (manifest dashed outline/overlap/internal line/reshape), and A10–A17 run `Walk Pattern`, two point-of-measure controls, two annotations, `Pleats`, `Edit Grading`, `Auto Grading`. The current manifest's ruler, cutting and avatar arrangement guesses are not supported by this AX capture.
4. **2D B: 15 AX commands versus 15 slots, but almost all command names differ.** Live B01–B04 are sewing and seam length checks, followed by `Steam`, `Seam Taping`, 2D texture/graphics, topstitch variants, puckering variants, `Set Sublayer` and `Fill`. The existing manifest starts with shape/curve guesses and ends with elastic, mirror and quilting guesses.
5. **Spacing is independent per subcolumn.** Live 3D A has larger vertical gaps, e.g. 130→174 and 398→442; 2D B has breaks at 232→276 and 432→476. The existing `after` flags are approximations and should be reviewed against the captured frame y values before claiming exact physical alignment.

The earlier `CLO_V7_EXACT_DUAL_TOOLBAR_ORDER_2026-10-16.md` explicitly describes its names as guesses from a saved screenshot. The **live AX names above supersede those tentative icon descriptions** for this specific observed CLO version and UI state. The captured 3D and 2D viewport screenshot shows icons and divider positions, but icon visual similarity alone is not proof of command identity or EXO implementation parity. The screenshot's right Property Editor is empty, so this capture cannot establish property editor field ordering. No tools were clicked, flyouts expanded or user CLO files altered. Commands behind flyouts and selection-dependent functionality remain unverified.
