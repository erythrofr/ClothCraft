# CLO 7.0.242 → EXO ClothCraft V2 toolbar implementation loop

Date: 2026-10-16. Scope: **all 70 reference toolbar positions** in the signed standalone `~/Applications/EXO ClothCraft Studio V2.app`, compared with the native CLO7 accessibility source and real Rust V2 operations.

**Result:** All 70 positions display real CLO tool names, are clickable and offer an honest response. **11** activate native EXO operations, **9** route to existing inspection workflows (including temporary 2D metric tape), and **50** are detailed help/info-only until their missing native editing/simulation implementations are built. Clicking any of those 50 **does not execute the CLO command**. This distinction is intentional: enabling an inert or unrelated tool as if it works would lose authored garment integrity.

## Interaction contract

- `src/core/clo7NativeToolCapabilities.js`: exhaustive dimension-qualified, typed capability registry (`native`, `inspect`, `unavailable`) for all 70 observed icons. The registry is the only source of truth for native command affordances; `src/data/clo7ToolbarOrder.js` remains the source of actual verified CLO labels/positions and original EXO artwork IDs.
- Clicking a **native** reference button directly activates the real Rust-backed mode/command with no overlay obstructing geometry editing. E.g. Polygon enters pen mode, then three points and **Close pattern** author a real pattern with native undo. 3D Select/Move sets native move mode, sewing tools select edges for a real native seam command, Reset 3D Arrangement restores native initial off-body pose, and Simulate starts/stops the solver.
- Clicking an **inspection-only** button opens its contextual detail card and navigates to existing native information, where meaningful. POM buttons activate the real temporary two-click 2D tape, but do not create persistent, graded production measurements. CLO-specific authoring requires additional native command implementation.
- Clicking an **unavailable** button opens a tool detail card with its exact CLO7 label, relevant implementation requirements and a link to the existing related EXO workspace. No fake native `Run` button is shown. Tooltips contain tool names and status rather than question-mark placeholders. The original extra EXO controls remain present and do not masquerade as CLO counterparts.
- `src/components/ClothCraftBoardV2.jsx` now captures internal-line drawing and temporary tape clicks over fabric surfaces and properly distinguishes editable vertex vs curve modes. The linked Rust engine retains panel/edge selection and actual seam/shape commands.

## Exact status of every observed position

| Native CLO7 position | CLO7 command | Current EXO availability | Backing command or truthful limitation |
|---|---|---|---|
| 3d:A01 | Simulate | **Native action** | simulation.toggle |
| 3d:A02 | Select/Move | **Native action** | viewport3d.selectMove |
| 3d:A03 | Select Mesh (Brush) | Not yet implemented | No equivalent verified Rust V2 operation; keep this reference tool disabled. |
| 3d:A04 | Edit Styleline | Not yet implemented | Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute. |
| 3d:A05 | Edit Sewing | Inspection only | sewing.inspectSeams |
| 3d:A06 | Segment Sewing | **Native action** | sewing.freeSew |
| 3d:A07 | Free Sewing | **Native action** | sewing.freeSew |
| 3d:A08 | Auto Sewing | Not yet implemented | Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far. |
| 3d:A09 | Edit Tack | Not yet implemented | Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far. |
| 3d:A10 | Tack | Not yet implemented | Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far. |
| 3d:A11 | Fold Arrangement | Not yet implemented | Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified. |
| 3d:A12 | Fold 3D Garment | Not yet implemented | Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified. |
| 3d:A13 | Reset 2D Arrangement (All) | Not yet implemented | Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified. |
| 3d:A14 | Reset 3D Arrangement (All) | **Native action** | arrangement.reset3d |
| 3d:A15 | Re-drape 3D Arrangement | Not yet implemented | Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified. |
| 3d:A16 | Hi-Res Garment | Not yet implemented | Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified. |
| 3d:A17 | Edit Measure (Avatar) | Not yet implemented | Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available. |
| 3d:A18 | Basic Tape Measure (Avatar) | Not yet implemented | Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available. |
| 3d:A19 | Edit Measure (Garment) | Inspection only | dimensions.show |
| 3d:A20 | Linear Measure (Garment) | Inspection only | dimensions.show |
| 3d:B01 | Play Motion | Not yet implemented | Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available. |
| 3d:B02 | Edit Line (3D Pattern) | Not yet implemented | Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute. |
| 3d:B03 | Line (3D Pattern) | Not yet implemented | Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute. |
| 3d:B04 | 3D Base Pen | Not yet implemented | Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute. |
| 3d:B05 | Edit 3D Pen (Avatar) | Not yet implemented | Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute. |
| 3d:B06 | 3D Pen (Avatar) | Not yet implemented | Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute. |
| 3d:B07 | Edit Texture (3D) | Inspection only | fabric.inspectProperties |
| 3d:B08 | Transform Graphic | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 3d:B09 | Graphic (3D Pattern) | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 3d:B10 | Select/Move Button | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 3d:B11 | Button | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 3d:B12 | Fasten Button | Not yet implemented | Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this. |
| 3d:B13 | Zipper | Not yet implemented | Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this. |
| 3d:B14 | Edit Piping | Not yet implemented | Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this. |
| 3d:B15 | Piping | Not yet implemented | Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this. |
| 3d:B16 | Select Binding | Not yet implemented | Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this. |
| 3d:B17 | Binding | Not yet implemented | Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this. |
| 3d:B18 | Press | Not yet implemented | Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process. |
| 2d:A01 | Transform Pattern | **Native action** | pattern2d.selectTransform |
| 2d:A02 | Edit Pattern | **Native action** | pattern2d.editPoints |
| 2d:A03 | Fullness (Point) | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A04 | Polygon | **Native action** | pattern2d.drawPolygon |
| 2d:A05 | Internal Polygon/Line | **Native action** | pattern2d.drawInternalLine |
| 2d:A06 | Base Polygon | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A07 | Trace | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A08 | Notch | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A09 | Seam Allowance | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A10 | Walk Pattern | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A11 | Edit Point of Measure | Inspection only | dimensions.measureTemporary |
| 2d:A12 | Point of Measure | Inspection only | dimensions.measureTemporary |
| 2d:A13 | Edit Annotation | Not yet implemented | No equivalent verified Rust V2 operation; keep this reference tool disabled. |
| 2d:A14 | Pattern Annotation | Not yet implemented | No equivalent verified Rust V2 operation; keep this reference tool disabled. |
| 2d:A15 | Pleats | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A16 | Edit Grading | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:A17 | Auto Grading | Not yet implemented | Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents. |
| 2d:B01 | Edit Sewing | Inspection only | sewing.inspectSeams |
| 2d:B02 | Segment Sewing | **Native action** | sewing.freeSew |
| 2d:B03 | Free Sewing | **Native action** | sewing.freeSew |
| 2d:B04 | Check Sewing Length | Inspection only | sewing.inspectSeams |
| 2d:B05 | Steam | Not yet implemented | Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process. |
| 2d:B06 | Seam Taping | Not yet implemented | Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process. |
| 2d:B07 | Edit Texture (2D) | Inspection only | fabric.inspectProperties |
| 2d:B08 | Transform Graphic | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 2d:B09 | Graphic (2D Pattern) | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 2d:B10 | Edit Topstitch | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 2d:B11 | Segment Topstitch | Not yet implemented | Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry. |
| 2d:B12 | Edit Puckering | Not yet implemented | Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process. |
| 2d:B13 | Segment Puckering | Not yet implemented | Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process. |
| 2d:B14 | Set Sublayer | Not yet implemented | Requires a native pattern-side paint/layer/UV tool with persistent material masks, per-face maps and reversible edits. The separate Fabric workspace handles existing material properties. |
| 2d:B15 | Fill | Not yet implemented | Requires a native pattern-side paint/layer/UV tool with persistent material masks, per-face maps and reversible edits. The separate Fabric workspace handles existing material properties. |

## Verification loop

- `node integrations/clothcraft/check-clo7-native-capabilities.mjs`: validates all 70 manifest positions and the explicit Rust integration command contracts, no duplicates, no unknown modes.
- `node integrations/clothcraft/qa-v2-clo-live-four-column.mjs`: verifies all four EXO columns and CLO7's live AX names/Y ordering, and ensures unsupported seam-taping remains identifiable, not falsely executable.
- `node integrations/clothcraft/qa-v2-clo-toolbar-actions.mjs`: starts *disposable* Rust/Vite services with isolated ports and a temporary garment folder, iterates all **70** reference buttons, validates details and modes, checks selected native `pen`, `line`, `sew`, `move3d` and `edit`, creates a **real polygon** using the 2D rail, verifies Rust panel count increased, then undoes it and verifies recovery. It also measures two 2D board clicks, reads the resulting centimetres and clears the tape. No browser window is opened to the user.
- `node integrations/clothcraft/qa-v2-clo-toolbar-installed.mjs`: reads the signed native V2 app's **already running** internal service 5385/5386 headlessly, audits exact all-70 labels/status/tooltips, tests safe informational open/close without touching the personal saved garment.
- Existing `qa-v2-selected-line.mjs`, `qa-v2-right-inspector.mjs` and `npm run check:non-simulation` validate native measurement, property context, production drafting and non-simulation regressions.
- Installed with **only** `npm run clothcraft:build-v2-workspace` and `open -a "$HOME/Applications/EXO ClothCraft Studio V2.app"`. The protected V1 worktree is unchanged. The installed V2 includes other concurrent changes in its working tree; no unrelated WIP should be discarded or included indiscriminately in a commit.

## What is still missing for full CLO functional parity?

There are **50 genuinely unimplemented CLO commands**. They require feature engineering rather than icon/tooltip changes. Prioritize in bounded rounds:

1. **Drafting and 2D construction:** native notch, fullness, seam allowance, Walk Pattern, Trace, Base Polygon, POM authoring, grading and pleats. Add typed Rust operations with transactions, undo, saved geometry and SVG/DXF handoff.
2. **Sewing and finishing physics:** Edit Sewing, Tack, Steam, Seam Taping, Topstitch, Puckering and Press need geometric attachment and calibrated solver effects. An annotation or visual toggle is insufficient.
3. **3D authoring and hardware:** projected 3D Pen, stylelines, editable graphics, piping, binding, zipper/button fastening, and fabric texture paint require real mesh/UV/style object models and physical contacts.
4. **Avatar, arrangement and quality:** motion, independent fold operations, re-drape presets and remeshing density, avatar-attached measurement objects. Verify 3D state and collision/drape after undo and reopen.
5. **Per-selection Property Editor:** every newly implemented native property needs a typed command, unit/range constraints, inspector control and a deterministic fixture QA. Never expose a control as operational before its underlying Rust transition exists.

Only functional behavior validated against CLO itself, not merely button order, should count as parity. This iteration fixes the user-facing inert-button/problem-tooltip experience and activates every **currently supportable** native edit path, but does **not** finish the 50 underlying solver and modeling implementations.
