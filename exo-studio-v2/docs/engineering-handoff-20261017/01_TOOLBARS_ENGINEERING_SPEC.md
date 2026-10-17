# EXO ClothCraft Studio V2 — left/right toolbar execution specification

Date: 2026-10-17. Scope: **EXO ClothCraft Studio V2 only**. This is a backlog and engineering contract, not a claim that all commands work.

## 1. Correct application and evidence

- Authoritative working repository on Blender Mac: `/Users/mikylecouto/Chat On Steroids Workspace/exo-clothcraft-v2`.
- Installed target: `~/Applications/EXO ClothCraft Studio V2.app`; do not implement in older `garment-studio`, community website prototypes, or the contribution checkout.
- Observed HEAD: `64c3be9`; working tree already contains substantial changes from other work. Preserve them. Snapshot only touched files before edits; never reset/clean/rewrite the tree.
- Inventory: `src/data/clo7ToolbarOrder.js` defines **70 slots**: left 3D A=20/B=18, right 2D A=17/B=15. Positions are stable IDs, not viewport pixel coordinates. Repeated A01/B01 require a dimension prefix.
- Capability evidence: `src/core/clo7NativeToolCapabilities.js`. `native` means a meaningful native action is mapped, NOT full CLO feature parity or proof of all behavior in this plan. `inspect` cannot be counted as an editing implementation. Counts below are source-derived, not newly run end-to-end certification.
- Routing/UI: `src/App.jsx`, `src/components/RightToolPalette.jsx`, `ViewportQuickTools.jsx`, `ClothCraftCornerTools.jsx`, `CloToolActionPanel.jsx`.
- V2 editing: `ClothCraftWorkspace.jsx`, `ClothCraftBoardV2.jsx`, `ClothCraftSceneV2.jsx`; native boundary `integrations/clothcraft/workspace.mjs` and `integrations/clothcraft/exo-session.rs`.
- The current V2 boundary is Rust-linked. Do NOT apply the older Garment Studio C++/Qt migration assumption to this app or rewrite the V2 architecture as part of this task.

## 2. Definition of functional

A tool is complete only when: correct slot activates the actual tool; required selection is visible; valid input performs the named operation; native document/snapshot changes as appropriate; errors are actionable; authoring survives undo/redo/save/reopen; dependencies remain valid; 2D/3D representations agree; production output preserves supported semantics; and the exact acceptance fixture below passes. A toast, opened inspector, changed icon, or borrowed neighboring tool does not satisfy an authoring tool.

For intentionally transient tools (camera, brush selection, temporary tape), no document mutation is expected; test the opposite. Opening a read-only panel must be labeled **Inspect**, not falsely enabled as a completed editor.

## 3. Shared engineering foundation — implement first

1. Generate a single tool registry from the stable 70 IDs with label, dimension, slot, capability, action, selection prerequisites, disabled reason, shortcut, command version and test IDs. Keep existing original artwork and physical order.
2. Dispatch rail, flyout, command palette and keyboard activation through one handler. Preserve active tool identity separately from low-level board mode: multiple tools currently map to `edit`, which must not erase semantic identity.
3. Introduce tool lifecycle `idle -> armed -> previewing -> committing -> completed/error`. Escape cancels previews, Enter commits only valid input, pointer cancel/lost capture restores last committed state. Numeric input typing must not trigger global shortcuts.
4. Native document owns CAD mutations. Preview overlays do not mutate rest geometry. Existing `/workspace` transport submits a revision and returns structured state; extend its existing conventions rather than creating a conflicting API. Proposed additions: operation ID, expected revision, stable object IDs, explicit units, capability version, validation diagnostics and changed object IDs.
5. Serialize mutation commits; do not silently drop actions when the current lock is busy. Coalesce drag previews and commit once on release. Reject stale revision, refresh/rebase only with deterministic policy; do not replay uncertain external writes.
6. Implement one reversible transaction per completed gesture, including topology-dependent remapping. Native undo restores rest shape, seams, trims, treatments and assignments together. Save is schema-versioned and atomic with recoverable previous file.
7. Units: UI may use cm/mm/in; native geometry contract must declare units and convert once. NaN/Infinity, invalid IDs, degenerate edges, self-intersections and impossible constraints reject without partial mutation. Stable edge IDs plus arclength anchors are preferable to array indices; migrate old indices explicitly.
8. Maintain separate rest pattern, board layout, arrangement, simulated mesh and render mesh. Remeshing transfers material coordinates and attachments; it never changes drafted dimensions to make a visual fit.
9. Physical features require measured native response and explicit quality gates. Never hide intersections, snap seams after solving, or mark stylized preview folds as validated simulation.
10. Accessibility: named buttons, pressed/expanded/disabled state, keyboard access to flyouts, focus-visible, Escape dismissal, non-hover path for touch. Hit areas at least 28 px desktop, 44 px touch where applicable. Scroll tall bars without hiding final slots.

### Proposed native object schema families

- `PatternPanel`: stable boundary/curve/vertex IDs, grain, rest units, internal paths, layout transform, arrangement transform.
- `Seam`: stable edge chains/ranges, orientation, ease, stiffness, endpoints; version-safe reference remapping.
- `SurfaceAnchor`: panel + rest coordinate; cached triangle/barycentrics valid only for matching mesh revision.
- `Attachment`: tack/button/zipper/trim types, anchor sets, compliance/contact metadata.
- `Measure`: avatar/garment/POM scope, anchors, method, reference state, tolerances, size association.
- `Graphic`, `MaterialRegion`, `UVTransform`, `Treatment`, `GradeRule`, `Annotation`: typed objects, not anonymous inspector values.

These are proposed models: first map existing Rust types and extend compatibly. Add import migration and fixture round trips before promoting capability flags.

## 4. Slot-by-slot implementation contracts

Each entry includes observed routing, intended interaction, native/data work and a decisive acceptance fixture. ALL authoring entries additionally inherit: invalid-input rejection, cancel, stale-revision protection, undo/redo, save/reopen, dependency integrity, unit conversion and supported export tests from section 2. Native-backed rows still need the specified gap work and validation.

Source-derived capability counts: **19 native-backed / 7 inspection-only / 44 unavailable**.

### 3d:A01 — Simulate

- **Observed:** `native`; route `simulation.toggle`.
- **Interaction:** Toggle play/pause; display busy, paused, running and failed distinctly; quality selector must disclose actual solver settings.
- **Engineering:** Retain native step/pause operations; stop scheduling before edits, bound outstanding work, preserve last accepted snapshot.
- **Acceptance:** Pause during load produces no subsequent document mutation; rejected step retains prior mesh and reports reason.

### 3d:A02 — Select/Move

- **Observed:** `native`; route `viewport3d.selectMove`.
- **Interaction:** Pick panel, multi-select, translate using axes or numeric metric fields; distinguish local/world coordinates.
- **Engineering:** Extend pose-panel transaction; persistent transforms, stable panel IDs, no changes to 2D rest geometry.
- **Acceptance:** Move 20 mm on X; save/reopen and undo recover exact positions; picking rear panels respects occlusion.

### 3d:A03 — Select Mesh (Brush)

- **Observed:** `native`; route `viewport3d.meshBrushSelect`.
- **Interaction:** Brush real mesh vertices; expose brush radius and add/subtract selection; keyboard clear.
- **Engineering:** Keep transient selection separate from authored mesh; topology revision invalidates stale vertex selection.
- **Acceptance:** Brush follows zoom; Alt removes only hit vertices; remesh cannot silently select unrelated vertices.

### 3d:A04 — Edit Styleline

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Pick and drag an existing 3D styleline with visible control anchors; offer internal-only versus cut conversion.
- **Engineering:** Store source-panel surface anchors, rest-space curves and topology dependencies; cut conversion must remap seams and invalidate solve.
- **Acceptance:** Curved line survives drape; cut preserves perimeter and remaps attached seams or rejects atomically.

### 3d:A05 — Edit Sewing

- **Observed:** `native`; route `sewing.editExisting`.
- **Interaction:** Select seam in 3D; edit orientation, ease and stiffness, with both endpoints highlighted.
- **Engineering:** Reuse native seam edit with revision guard; require edge-range integrity and history for each committed change.
- **Acceptance:** Reverse one seam; coupling changes, undo restores; stale seam IDs reject without editing another seam.

### 3d:A06 — Segment Sewing

- **Observed:** `native`; route `sewing.freeSew`.
- **Interaction:** Pick complete boundary segments on two panels, preview pairing arrows and lengths, then confirm.
- **Engineering:** Dedicated segment mode over native Sew; serialize full-edge ranges and endpoint orientation, not arbitrary clicks.
- **Acceptance:** Whole segment selected even when clicked mid-edge; invalid interior edge rejected; undo removes relationship.

### 3d:A07 — Free Sewing

- **Observed:** `native`; route `sewing.freeSew`.
- **Interaction:** Pick start/end arclength on each edge chain, show range and direction, then confirm free sewing.
- **Engineering:** Native Sew with normalized arclength ranges, supported chain references and validated monotonic pairing.
- **Acceptance:** Two partial ranges produce stitches only inside ranges; reverse direction is visible and survives reopen.

### 3d:A08 — Auto Sewing

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Suggest compatible unsewn edge pairs; show confidence and preview; user chooses before commit.
- **Engineering:** Deterministic matcher using seam tags, lengths and spatial intent; proposals are not mutations; batch native seam transaction.
- **Acceptance:** Ambiguous sleeve pair stays unresolved; accepted proposals undo together; no duplicate seams.

### 3d:A09 — Edit Tack

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Pick an existing tack, move anchors or adjust compliance, release/delete deliberately.
- **Engineering:** Persistent Tack ID with two barycentric or material-space anchors and compliance; native edit/remove operation.
- **Acceptance:** Edited tack changes actual constraint; deleted panel cannot leave dangling tack; undo restores both anchors.

### 3d:A10 — Tack

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose cloth-to-cloth or cloth-to-avatar targets; preview link before commit.
- **Engineering:** Add first-class solver attachment, explicit target type, rest offset and break/release policy.
- **Acceptance:** Tack restrains chosen points under gravity; untack releases; invalid cross-document target rejects.

### 3d:A11 — Fold Arrangement

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose arrangement fold line, angle and side before simulation.
- **Engineering:** Store arrangement-only fold transform; keep rest pattern and physical crease distinct.
- **Acceptance:** 90-degree arrangement fold changes initial pose but not pattern area or material properties; undo exact.

### 3d:A12 — Fold 3D Garment

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Pick authored internal crease; set angle, direction and stiffness for cloth fold.
- **Engineering:** Native crease/bending constraints with rest angles; support remesh anchor transfer.
- **Acceptance:** Same strip with 0/90-degree targets produces distinct folds without seam snapping; save/reopen preserves target.

### 3d:A13 — Reset 2D Arrangement (All)

- **Observed:** `native`; route `arrangement.reset2d`.
- **Interaction:** Reset all 2D layout placements, not drafted contours or 3D geometry; preview affected count.
- **Engineering:** Atomic board-transform reset from stored layout baseline, single history item.
- **Acceptance:** Patterns retain points/seams/materials; only layout changes; one undo restores all placements.

### 3d:A14 — Reset 3D Arrangement (All)

- **Observed:** `native`; route `arrangement.reset3d`.
- **Interaction:** Reset all cloth to stored 3D arrangement with user-visible scope.
- **Engineering:** Reuse native reset; preserve pattern, trim, fabric and seam authoring; clear transient velocity safely.
- **Acceptance:** Restores placement without deleting seams; paused state remains paused; undo policy explicitly tested.

### 3d:A15 — Re-drape 3D Arrangement

- **Observed:** `native`; route `simulation.redrape`.
- **Interaction:** Re-drape from current arrangement using selected solver quality; show progress and cancellation.
- **Engineering:** Explicit job lifecycle and input revision; accept result only for matching document revision.
- **Acceptance:** Edit during job makes old result stale; cancel retains last accepted mesh; failures never overwrite valid state.

### 3d:A16 — Hi-Res Garment

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select mesh density or target edge length, preview memory/time estimate before remesh.
- **Engineering:** Constrained triangulation; preserve cuts, UVs, notches, seam ranges, tacks and per-panel material coordinates.
- **Acceptance:** Triangle density increases while 2D boundary remains within 0.1 mm fixture tolerance; no missing attachments.

### 3d:A17 — Edit Measure (Avatar)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select existing avatar measurement, edit landmarks/path/type and name.
- **Engineering:** Persistent AvatarMeasurement referencing avatar asset/version and surface anchors, metric units.
- **Acceptance:** Changing avatar invalidates incompatible anchors visibly; editing one measurement leaves others unchanged.

### 3d:A18 — Basic Tape Measure (Avatar)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Place tape around/on avatar; choose straight, surface or circumference explicitly.
- **Engineering:** Geodesic/slice measurement kernels; save anchors, method and units, no screen-space distance.
- **Acceptance:** Known cylinder circumference error under 1%; straight measurement matches analytic segment within 0.5 mm.

### 3d:A19 — Edit Measure (Garment)

- **Observed:** `inspect`; route `dimensions.show`.
- **Interaction:** Select saved garment measure; adjust anchors, path and rest/current-space mode.
- **Engineering:** Typed GarmentMeasurement linked to panel material coordinates and current mesh mapping.
- **Acceptance:** After drape, anchors follow same fabric region; dimensions update without moving garment.

### 3d:A20 — Linear Measure (Garment)

- **Observed:** `inspect`; route `dimensions.show`.
- **Interaction:** Place two garment points; distinguish linear chord from surface path and optionally save.
- **Engineering:** Raycast-to-material-coordinate mapping plus persistent metric measurement object.
- **Acceptance:** Known 100 mm flat fixture reports within 0.5 mm; zoom/camera changes do not affect value.

### 3d:B01 — Play Motion

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Load/select animation clip, scrub, play/pause and choose cloth follow/re-simulate.
- **Engineering:** Versioned avatar rig/clip tracks, time units, cache key includes cloth/clip revision; explicit unsupported rig errors.
- **Acceptance:** Scrubbing returns deterministic avatar pose; stale cloth cache never displayed as fresh simulation.

### 3d:B02 — Edit Line (3D Pattern)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select a projected 3D pattern line and edit anchors, tangents or delete.
- **Engineering:** Rest-space line authority with surface projection mapping; topology edits remap or invalidate explicitly.
- **Acceptance:** Curve remains attached through solve; undo restores controls and generated geometry.

### 3d:B03 — Line (3D Pattern)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Draw a line directly on visible cloth; snap to seams and close outline deliberately.
- **Engineering:** Persist per-panel surface anchors; split multi-panel strokes by panel and track continuity.
- **Acceptance:** Stroke over a seam records two valid panel paths; no floating screen-space polyline after orbit.

### 3d:B04 — 3D Base Pen

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Place 3D base pen control points and construct a candidate pattern patch.
- **Engineering:** Typed construction surface and projection policy; validated conversion to 2D rest pattern with distortion report.
- **Acceptance:** Conversion rejects folded/non-manifold patch; generated 2D boundary corresponds to picked surface, not rectangle fallback.

### 3d:B05 — Edit 3D Pen (Avatar)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select/edit avatar pen curve, move surface anchors and update derived construction.
- **Engineering:** Avatar-surface anchored curve versioned against avatar topology, editable native object.
- **Acceptance:** Avatar pose change retains attachment; incompatible mesh replacement marks curve unresolved.

### 3d:B06 — 3D Pen (Avatar)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Draw on avatar with visible stroke, snap landmarks and choose open/closed curve.
- **Engineering:** Persistent avatar annotation/construction curve, optional explicit downstream pattern extraction.
- **Acceptance:** Closed stroke survives save/reopen and orbit; does not create cloth until requested.

### 3d:B07 — Edit Texture (3D)

- **Observed:** `inspect`; route `fabric.inspectProperties`.
- **Interaction:** Pick garment texture; manipulate UV offset/rotation/physical repeat with numeric controls.
- **Engineering:** Promote inspection-only entry to material-coordinate transform command shared with 2D editor.
- **Acceptance:** 90-degree texture rotation preserves weave scale and changes garment/ball identically; undo restores maps.

### 3d:B08 — Transform Graphic

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select existing graphic; drag/rotate/scale with clipping preview.
- **Engineering:** Native GraphicInstance with panel-space anchor, dimensions, rotation, sidedness and asset hash.
- **Acceptance:** Graphic stays on cloth when folded and does not bleed onto neighboring panel; save/reopen exact.

### 3d:B09 — Graphic (3D Pattern)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose graphic asset and click cloth to place; show physical width/height and preview before commit.
- **Engineering:** Validated asset ingestion plus native instance creation using material-space coordinates.
- **Acceptance:** Transparent PNG edges remain clean; dropped asset persists by content ID, not temporary URL.

### 3d:B10 — Select/Move Button

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Pick button instance, translate along cloth, rotate and edit size/attachment.
- **Engineering:** Typed hardware instance tied to material coordinates; sync render mesh and attachment model.
- **Acceptance:** Moving button updates actual anchor and visible mesh; undo restores; stale surface anchor rejects.

### 3d:B11 — Button

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose button style/diameter, place one or evenly spaced row on garment.
- **Engineering:** Versioned hardware asset plus instance transforms, physical thickness and optional collision proxy.
- **Acceptance:** Five-button row keeps metric spacing across drape; changing style does not delete attachment references.

### 3d:B12 — Fasten Button

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select button and buttonhole counterpart; fasten/unfasten with pair preview.
- **Engineering:** First-class closure constraint between compatible instances; contact thickness and compliance explicit.
- **Acceptance:** Fasten pulls intended pair only; unfasten releases actual constraint; no visual-only snap.

### 3d:B13 — Zipper

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select two boundary ranges, configure zipper tape/teeth and slider opening.
- **Engineering:** Typed paired zipper paths, arc-length correspondence, deformable tapes and closure constraints; opening is persistent parameter.
- **Acceptance:** 0/50/100% closed states change both geometry and coupling; unequal paths warn before commit.

### 3d:B14 — Edit Piping

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select piping run and edit path, radius, endpoints and material.
- **Engineering:** Persistent Piping object, surface anchors, arc-length sweep and attachment policy.
- **Acceptance:** Radius edits regenerate sweep without spikes at curves; undo restores path and render geometry.

### 3d:B15 — Piping

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select boundary/internal path and create piping with offset/radius.
- **Engineering:** Native typed run linked to source edge chain, generated geometry and optional collision proxy.
- **Acceptance:** Closed neckline piping has continuous frame without twist; moving source curve updates run.

### 3d:B16 — Select Binding

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Pick binding strip, inspect covered edge range, width and fold method.
- **Engineering:** Stable Binding ID and source edge references, width/thickness/material, separate annotation and simulated modes.
- **Acceptance:** Selecting binding never selects unrelated panel; edits target correct strip after remesh.

### 3d:B17 — Binding

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Create binding along chosen edge with inner/outer width and corner policy.
- **Engineering:** Generate strip rest mesh, seam topology and folded placement; assign real material and optional solve.
- **Acceptance:** Curve/acute corner fixture has no inverted faces; attachment survives reopen and native simulation.

### 3d:B18 — Press

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose press region and pressure/heat/time preset; preview expected operation and reset path.
- **Engineering:** Define calibrated constitutive/crease-state update or label visual-only approximation; do not fake heat physics.
- **Acceptance:** Same fixture before/after exhibits quantified crease change; unsupported material rejects instead of changing roughness alone.

### 2d:A01 — Transform Pattern

- **Observed:** `native`; route `pattern2d.selectTransform`.
- **Interaction:** Select/multiselect patterns; move/rotate numerically, marquee, lock and snap.
- **Engineering:** Native BoardTransform for layout; separate transform-rest-geometry command when scaling drafted dimensions.
- **Acceptance:** 100 mm layout move leaves lengths unchanged; undo/redo/reopen preserve transform; locked panel stays fixed.

### 2d:A02 — Edit Pattern

- **Observed:** `native`; route `pattern2d.editPoints`.
- **Interaction:** Select vertices/curves, drag with snapping and numeric constraints, delete safely.
- **Engineering:** MovePoints/CurvePoint and topology operations remap seam/trim references atomically.
- **Acceptance:** Curved edge length updates; invalid self-intersection rejected; undo recovers all dependents.

### 2d:A03 — Fullness (Point)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose pivot and cut/spread rays; enter slash-and-spread amount or angle.
- **Engineering:** Native Fullness construction history, generated contour and notch/grain/seam mapping.
- **Acceptance:** Add 30 mm fullness at designated opening; pivot fixed, total spread within 0.1 mm, no unrequested scaling.

### 2d:A04 — Polygon

- **Observed:** `native`; route `pattern2d.drawPolygon`.
- **Interaction:** Click polygon points, numeric length/angle, close or cancel, edit before commit.
- **Engineering:** Native polygon creation with winding normalization, intersection/min-edge checks and units.
- **Acceptance:** Concave polygon triangulates; bow-tie rejects; Escape leaves no partial authored panel.

### 2d:A05 — Internal Polygon/Line

- **Observed:** `native`; route `pattern2d.drawInternalLine`.
- **Interaction:** Draw internal line/polygon, specify construction/dart/crease intent; edit points.
- **Engineering:** Native InternalLine with subtype, points/curves and source panel; dart requires explicit intake/closing semantics.
- **Acceptance:** Line remains within panel or reports clipping; dart intake is measured and not merely decorative.

### 2d:A06 — Base Polygon

- **Observed:** `native`; route `pattern2d.basePolygon`.
- **Interaction:** Choose rectangle/ellipse/sector and dimensions; preview then create.
- **Engineering:** Retain native Primitive implementation; extend supported shape parameters without aliasing arbitrary polygon tools.
- **Acceptance:** Known ellipse/sector dimensions persist; invalid radius rejects; one undo removes created object.

### 2d:A07 — Trace

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select source lines/edges, preview traced contour, choose linked or independent copy.
- **Engineering:** Native Trace with provenance, tolerance/welding policy and explicit closed-region validation.
- **Acceptance:** Trace multi-curve boundary preserves curves within 0.1 mm; open chain cannot silently become closed panel.

### 2d:A08 — Notch

- **Observed:** `native`; route `pattern2d.placeNotch`.
- **Interaction:** Pick edge and arclength; select notch count, depth, angle and mark/cut representation.
- **Engineering:** Extend current persistent 6 mm marker into typed notch model; manufacturing export representation explicit.
- **Acceptance:** Insert at 25% edge length, split edge, reopen: same physical notch survives; cut notch only when requested.

### 2d:A09 — Seam Allowance

- **Observed:** `native`; route `pattern2d.setSeamAllowanceGuide`.
- **Interaction:** Select edges; edit per-edge allowance, corner join and start/end transitions.
- **Engineering:** Extend 10 mm cutting guide to robust offset geometry; stitched contour remains authoritative.
- **Acceptance:** Convex/concave corners and variable widths form valid cut boundary; DXF round trip preserves seam/cut distinction.

### 2d:A10 — Walk Pattern

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Pick two seam paths, walk one along the other from chosen notch; show accumulated mismatch.
- **Engineering:** Arc-length correspondence, tangent-aligned temporary transform, ease interval report; no rest geometry mutation.
- **Acceptance:** Curved seam walk reports known 12 mm mismatch and notch alignment; cancel restores original layout.

### 2d:A11 — Edit Point of Measure

- **Observed:** `inspect`; route `dimensions.measureTemporary`.
- **Interaction:** Select saved POM, edit anchors, method, name, tolerance and grade association.
- **Engineering:** Promote temporary tape into native POM object and production-schema serialization.
- **Acceptance:** Edit POM survives reopen/export and recalculates after point edits; orphaned anchor visibly unresolved.

### 2d:A12 — Point of Measure

- **Observed:** `inspect`; route `dimensions.measureTemporary`.
- **Interaction:** Create named POM from points/edge/path; define units, measurement method and tolerances.
- **Engineering:** Native persistent POM, rest/current scope, grading table association and anchor remapping.
- **Acceptance:** 100 mm sample POM reports correctly at every zoom; grade-size values export consistently.

### 2d:A13 — Edit Annotation

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select annotation; edit text, leader, placement and print visibility.
- **Engineering:** Typed annotation anchored to panel or layout, font settings, locale-safe text, undo.
- **Acceptance:** Moving panel carries panel-anchored label; exported PDF shows intended text without viewport-only loss.

### 2d:A14 — Pattern Annotation

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Place text/leader annotation, choose template fields and print scope.
- **Engineering:** Native annotation create operation with stable ID; escape text in HTML/SVG exports.
- **Acceptance:** Names containing angle brackets display literally; no script execution; save/reopen preserves Unicode.

### 2d:A15 — Pleats

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Draw pleat lines, choose knife/box/inverted type, count, depth and fold direction.
- **Engineering:** Parametric pleat construction expands rest pattern and defines crease/sewing guides, no purely painted stripes.
- **Acceptance:** Three 20 mm knife pleats yield expected intake; undo restores original boundary and dependencies.

### 2d:A16 — Edit Grading

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose size set and grade points; edit X/Y deltas with base-size protection.
- **Engineering:** Native grading rules attached to stable vertices/curves, derived size geometry and validation.
- **Acceptance:** S/M/L fixture follows exact deltas; curves remain valid and sewn lengths checked per size.

### 2d:A17 — Auto Grading

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select grading rule preset and target sizes; preview all derived contours and conflicts.
- **Engineering:** Deterministic rule application with explicit unsupported landmarks; batch history and per-size validation.
- **Acceptance:** Cannot grade missing landmarks silently; manual overrides survive regeneration; export contains labeled sizes.

### 2d:B01 — Edit Sewing

- **Observed:** `native`; route `sewing.editExisting`.
- **Interaction:** Pick seam in 2D, edit ranges/reverse/ease/stiffness; show partner edge.
- **Engineering:** Same native seam object as 3D editor; one authoritative command, shared selection.
- **Acceptance:** Editing in 2D immediately updates 3D relationship; undo from either viewport restores both.

### 2d:B02 — Segment Sewing

- **Observed:** `native`; route `sewing.freeSew`.
- **Interaction:** Choose full edge segments, preview lengths/direction then confirm.
- **Engineering:** Segment-specific input atop native Sew; range defaults are exactly full valid segments.
- **Acceptance:** Mid-edge click selects complete edge; adjacent edge is not included; direction and ease survive export.

### 2d:B03 — Free Sewing

- **Observed:** `native`; route `sewing.freeSew`.
- **Interaction:** Specify partial or multi-edge boundary ranges and match endpoints.
- **Engineering:** Native free-sew ranges and orientation; reject overlaps and non-boundary sources.
- **Acceptance:** Half-edge seam affects only selected halves; edge split keeps seam coverage consistent.

### 2d:B04 — Check Sewing Length

- **Observed:** `inspect`; route `sewing.inspectSeams`.
- **Interaction:** Select seam(s), inspect lengths, mismatch ratio, notch positions and tolerances.
- **Engineering:** Read-only native length analysis; proposed correction is a separate explicit drafting command.
- **Acceptance:** Known 10 mm mismatch flags correct seam; checking never mutates cloth; values match rest geometry.

### 2d:B05 — Steam

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Brush/select steam region, shrink/stretch direction and amount with clear model label.
- **Engineering:** Persistent treatment field in material coordinates; validated rest metric modification or calibrated textile model.
- **Acceptance:** 5% shrink fixture changes target rest length by specified amount; mass/unit policy defined; undo restores.

### 2d:B06 — Seam Taping

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Choose seam range, tape width/thickness/material and attachment sides.
- **Engineering:** Native reinforcing strip or calibrated laminate constraints; export BOM and attachment topology.
- **Acceptance:** Reinforced seam bends/stretches differently in controlled fixture; no duplicate underlying cloth mass.

### 2d:B07 — Edit Texture (2D)

- **Observed:** `inspect`; route `fabric.inspectProperties`.
- **Interaction:** Select pattern texture, edit grain-relative UV position/rotation/repeat with measured ruler.
- **Engineering:** Same material-coordinate transform as 3D texture tool, per-panel overrides and shared material inheritance.
- **Acceptance:** 2D and 3D yarn density match; rotation does not rotate drafted panel or alter physical grain unless requested.

### 2d:B08 — Transform Graphic

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select existing graphic, move/scale/rotate with exact dimensions and panel clipping.
- **Engineering:** Shared GraphicInstance object with 3D tool; native history, persistent asset mapping.
- **Acceptance:** 100 mm logo remains 100 mm after save/reopen and garment drape; no duplicate objects across views.

### 2d:B09 — Graphic (2D Pattern)

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Import/place graphic on panel with crop, opacity, side and layer controls.
- **Engineering:** Validated image asset, physical placement, premultiplied-alpha handling and safe decode limits.
- **Acceptance:** Image survives project packaging offline; unsupported/corrupt image shows retry without creating empty instance.

### 2d:B10 — Edit Topstitch

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select stitch run and edit style, thread, spacing, offset and rows.
- **Engineering:** Typed Topstitch run linked to edge/path; generated render geometry and manufacturing metadata.
- **Acceptance:** Changing stitch pitch changes actual count and appearance; path edits retain consistent offset.

### 2d:B11 — Segment Topstitch

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select complete segment and create topstitch with explicit start/end inset.
- **Engineering:** Native topstitch creation; arc-length sampling and persistent style reference.
- **Acceptance:** Curved path stitches keep metric pitch and do not bunch at vertices; export lists thread/style.

### 2d:B12 — Edit Puckering

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select puckering run; edit amplitude, wavelength, shrink/ease and method.
- **Engineering:** Typed seam treatment: physically simulated differential feed or explicitly visual displacement; separate physical and optical fields.
- **Acceptance:** Editing optical amplitude cannot change solver rest lengths; physical mode exhibits measurable differential gathering.

### 2d:B13 — Segment Puckering

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Apply puckering to segment with preview and material-dependent preset.
- **Engineering:** Persistent treatment bound to seam range; native implementation and renderer consume consistent IDs.
- **Acceptance:** Puckering stays in selected range after remesh; zero amplitude restores baseline without residual offsets.

### 2d:B14 — Set Sublayer

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Assign layer order to selected panels; show overlap/conflict graph.
- **Engineering:** Native layering/collision ordering with cycle detection; renderer depth order is not sufficient.
- **Acceptance:** Shirt-over-lining fixture settles correctly without disabling collision; cyclic layer requirements rejected.

### 2d:B15 — Fill

- **Observed:** `unavailable`; route `none`.
- **Interaction:** Select closed region; fill with fabric/color/mask, choose whole-panel or region semantics.
- **Engineering:** Native MaterialRegion/mask asset with UV/rest-space anchors and shared optical/physical assignment policy.
- **Acceptance:** Fill inside internal boundary does not leak outside; undo and project export preserve region, not only screen color.

## 5. Related controls and flyouts — no hidden omissions

Treat duplicate presentations as aliases of canonical commands, not new implementations. Audit `ViewportQuickTools`, `ClothCraftCornerTools`, right palette, main toolbar and context menu at the start of execution. Generate a coverage report with every rendered button mapped to a canonical slot or the supplemental actions below. Fail coverage on any new unmapped action.

| Supplemental action | Contract | Acceptance |
|---|---|---|
| Orbit / pan / fit camera | View-state only; camera target/bounds from actual scene; accessible reset | All geometry fits after orientation/resize; document revision unchanged |
| 3D move / rotate / hand | Move/rotate native arrangement; hand is bounded temporary live grab with explicit release | Native vertices respond; cancel/pointer loss releases all grabs; no retained ghost constraint |
| 2D split / curve | Stable edge split and editable curve commands | Seam/notch/trim arclength references preserved; failed split atomic |
| Duplicate / mirror | New unique IDs; explicit copy-versus-linked policy, mirrored grain/seam orientation | Independent copy edits do not alter source; links preserved only when requested |
| Delete | Delete selected entity and preview dependent consequences; reversible document command | No orphan seams, POMs or trims; one undo restores full dependency set |
| Wireframe / seams / grid / avatar visibility | Render/display state only; keep selection and simulation intact | Toggle repeatedly without changing native garment or restart |
| Surface / strain / pressure | State/version-matched measured field with units/legend; unavailable if backend lacks measurement | Known stretched fixture gives expected strain; no fabricated pressure inferred solely from color |
| Simulation quality menu | Actual backend parameters and capability, not display labels only | Each preset round trips and backend reports chosen values; offline backend clear |
| Fabric / material / graphics / hardware browsers | Show correct category and selection; explicit apply operation with scope | Choosing asset does not unexpectedly replace project; assignment undo/reopen works |
| Avatar / fit / pattern / render / production inspector | Navigate without mutation; selected-object context remains consistent | Editing field dispatches typed native command, not only React state |
| Scene tree / object browser / panel collapse | Selection synchronized across 2D/3D; persistent layout separate from project | Hidden panel reopens with selection, no duplicate edit dispatch |
| Grading / POM browser | Lists authored native objects; inspection not counted as authoring | Matches slot contracts and per-size exports |
| Export / save | Format capability table; validate unsupported fields and unit provenance | Reimport fixture preserves geometry + supported metadata; unsupported features reported, never silently lost |
| Library categories / search / list-grid | Filter without changing project; delayed hover lazy-loads; double-click/apply obeys existing V2 behavior | Search, hover, dismissal and apply tested without simulation changes |
| All/focused toolbar modes | Same canonical inventory and availability; layout-only preference | Returning to All restores every slot exactly once in correct column |

## 6. Execution order and exit gates

1. **T0 inventory/command foundation:** coverage JSON, native schema mapping, event lifecycle, transaction/error baseline. Exit: 70 IDs and supplemental surfaces audited, no mislabeled inspection editor.
2. **T1 drafting core:** transforms/points/polygon/base/internal/split/curve/notch/allowance/trace/annotations/POM. Exit: numeric geometry, undo and round-trip fixtures pass.
3. **T2 sewing/arrangement:** segment vs free semantics, edit/auto proposals, tacks, resets, walk/check lengths. Exit: real native constraints and consistent 2D/3D selection.
4. **T3 material/graphics:** shared asset schema and UV transforms, material fill/sublayer, assignments. Depends on photorealistic fabric spec's units and map contracts, not its full offline renderer.
5. **T4 native finishing/trim geometry:** buttons/closures, zipper, piping, binding/topstitch, pleats and folds. Keep physical vs decorative modes explicit.
6. **T5 advanced drafting and avatar:** fullness/grading, 3D lines/pens/stylelines, avatar tape and animation. Separate topology/rig milestones before enabling slots.
7. **T6 physics-dependent finishing:** steam/press/puckering/taping/high-res and motion-cloth validation. Exit: native benchmarks and parameter provenance, not just screenshots.
8. **T7 integrated QA/release:** complete wardrobe fixture, save/reopen/export; memory/resource audit, keyboard/touch coverage, actual installed V2 launch. Do not run app packaging scripts blindly: current build script can pause/stop the running app. Preserve user session before packaging and report exactly what was rebuilt.

Suggested work packets can be assigned to agents later; this document does not claim any additional agents ran. Each packet must name owned files, prerequisites, migration, tests and evidence paths. Only one packet should own native protocol/schema changes at a time.

## 7. Required tests and handoff evidence

Existing entry points to inspect and reuse: `integrations/clothcraft/check-clo7-native-capabilities.mjs`, `qa-v2-clo-toolbar-actions.mjs`, `qa-v2-original-tools.mjs`, `qa-v2-2d-marquee.mjs`, `qa-v2-live-grab.mjs`, `qa-v2-right-inspector.mjs`, and `qa-v2-native-property-editor-20261016.mjs`. These filenames are observed; their coverage is not assumed sufficient.

For every slot produce a row: ID, implementation commit/diff, native operation, capability state, fixture, expected/actual values, undo/reopen/export result, screenshot/video, limitations. A pure registry test cannot prove runtime behavior. Use isolated temporary projects and isolated native test sessions; do not test destructive gestures on the user's current garment. Test 1440×900 desktop and constrained layouts; verify 3D and 2D selection, disabled explanations and no console errors. Use tolerances justified by fixture units and geometry resolution, not arbitrary pass thresholds.

Completion deliverables: source patches, migrated schema fixtures, machine-readable coverage, focused test logs, before/after screenshots, known unsupported operations and install status. Any incomplete slot stays explicitly unavailable or inspection-only. No blanket “all tools functional” claim until all 70 contracts pass.
