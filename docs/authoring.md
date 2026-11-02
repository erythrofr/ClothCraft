# Unified pattern workspace

**Group 3D placement:** use Place mode for shared-pivot transforms and visible
or Alt-through box selection. Read [group placement](group-placement.md) for
the flat-arrangement reset policy, cancellation and visibility limits.

19 October update: [panel tools](panel-tools.md) documents boundary-owned internal lines, the read-only 2D ruler and bidirectional linked mirror pairs. Geometry updates commit on release; 3D placement/material stay independent.

**16 October:** [Document lifecycle and partial/multi-edge sewing](documents-and-sewing.md) now extend the workflow below. Native Save/Open is separate from Export. Use Sew → Multiple edges per side for ordered chains.

**Workspace update (15 October):** tools are on the left rail and in the radial menu. Drag dividers to resize 3D / 2D / Properties; use Expand / Split to focus a canvas. Display controls are in each viewport’s gear menu, and Properties has Piece, Fabric and Simulation tabs. [Layout, display options and limits](workspace-ui.md).

Launch `scripts/start-atelier.ps1`. All pieces share **one metric 2D board**, beside the 3D garment view. A panel or named boundary selected in either view identifies the same model object in the other view.

## Draft cloth

### Attached, editable ruler measurements

Choose **Measure** (M), then click near two named boundaries on the same
editable polygonal piece. Each endpoint attaches to its boundary's sampled
material arclength. The green draft follows the piece when it is moved or
rotated. Open **Properties → Piece → Measurements**, enter a label and click
**Save measurement**. The measurement becomes part of the garment document;
ordinary Save/Open preserves it. A measurement is a straight-line distance in
the flat material pattern, reported in millimetres, rather than a draped surface
distance or a physical length constraint.

Saved measurements remain drawn on the board in other tools. Select their row
in **Measurements**, or click the line while using Measure, to edit them.
Change the label, either named boundary, or the endpoint's distance from its
boundary start, then click **Apply measurement edit**. In Measure, dragging a
selected endpoint near a boundary on the same piece stages the same edit.
**Delete measurement** removes the selected record. Each save, edit or deletion
is one document undo/redo step. Typing and Enter do not commit a measurement.
**Cancel measurement draft** or Escape outside text input discards the draft;
saved records remain. A completed attached draft is retained when switching to
Edit to move the piece; unfinished/free ruler gestures are cancelled.

Moving or rotating a piece changes only its displayed location. Editing its
rest geometry updates the measured distance through the retained boundary
stations. Supported splits migrate stations to the appropriate child boundary;
curved resampling may move a station by at most twice the 0.25 mm flattening
tolerance. Mirrors reverse contour station direction; copies retain panel-local
measurement IDs. Linked pieces own independent measurement labels and stations.
Deleting a referenced point/line, cutting a referenced dart or applying a
boolean without a defined migration is refused transactionally. Remove the
affected measurement first. A saved endpoint never refers to a mesh vertex.

The existing free board ruler remains available for interior or cross-piece
distances, but those coordinates are temporary. Saving requires two boundary
stations on one polygonal piece; legacy rectangular documents still load, and
the saved-measurement controls explain when a piece has no editable polygon.
Measurement metadata preserves the active mesh, drape, playback and worker
generation. Older readers that reject unknown fields cannot open documents
using the optional `measurements` extension.

The station schema follows the reviewed MIT ClothCraft proposal in PR #66
(`e3994ae80c496eb3e6371309ccabb8e4b7bea3ab`, Mikyle Couto). Resolution,
validation, UI and integration here are independently implemented against the
current native editor. No EXO application, solver or asset changes are included.
Validation uses CPU geometry, saved-project/history and real named egui-control
tests; a native window/GPU run is separate.

### Cut-and-sewn darts

In **Edit**, select a straight, unsewn polygon boundary in 2D or 3D. In the
inspector, choose **Cut-and-sewn dart…**, then enter the intake center's distance
from the edge start, intake width and inward depth in millimetres. The 2D board
shows the proposed triangular cut, two legs and apex. An **Edge start · 0 mm**
marker and arrow identify the origin and direction of the center distance.
The preview follows the
panel's board placement and rotation; it never uses the draped shape.

**Apply dart** removes that triangle and creates a reversed sewing relation
between the two legs using the existing physical sewing model. The entire
garment is validated and remeshed before accepting the transaction. An invalid
contour or failed compilation leaves the document and history unchanged.
Typing and Enter do not apply. **Cancel dart**, Escape, changing the selected
boundary or leaving Edit discards the draft. Ctrl+Z outside a text field cancels
a pending draft first. A successful Apply is one undo/redo entry and survives
ordinary Save/Open; it resets the edited cloth's simulation caches.

This is a **cut-and-sewn dart**, not an uncut fold model or a guarantee of fit.
Intake is 3–150 mm and depth is 8–500 mm; the source must be at least 20 mm
long and the intake must stay beyond its 1% end margins. Curved or target-length
boundaries, already sewn boundaries (including chain tails), linked mirrors,
and panels with holes or internal lines are currently unsupported. The numeric
preview does not certify that the apex or legs fit inside a concave panel:
Apply performs that whole-contour validation. No mesh is compiled per repaint.

### Numeric point construction

In **Edit**, select a contour point on the 2D board. The Piece inspector shows
**Point · Construction**. Choose a straight reference edge, including an edge
on another panel, then choose:

- **Project**: orthogonal projection onto the edge's infinite line.
- **Distance**: signed millimetres from its start toward its end.
- **Intersection**: choose a second straight reference edge, including one on
  another panel. The selected corner moves to the intersection of the two
  infinite lines. Parallel, coincident, curved or missing references disable Apply.
- **Perpendicular**: signed millimetres from the projection, along the direction
  obtained by rotating the directed reference edge by +90 degrees in board
  coordinates (the displayed vertical coordinate increases downward).

Read the proposed panel-local X/Y coordinates, then click **Apply construction**.
The auto-scaled diagram shows the directed reference edge in blue, the current
corner as a gold ring and its proposed position as a green dot. It follows
the flat board's rotations and layout, not the draped mesh. This is a geometric
preview only: it does not certify that the resulting contour or seams are valid.
Typing does not edit the pattern; Enter in the distance field does not apply it.
Distances are not clamped to the edge endpoints. Curved reference boundaries
are explicitly unsupported rather than approximated by their chords.

Intersection shows reference A in blue and B in purple, with thin extensions
leading to the proposed point. The distance field is inactive in this mode.
The references use the panels' current flat-board positions and rotations;
they need not touch, and the intersection can lie outside either segment.
If a chosen edge disappears or becomes curved, choose a valid replacement
explicitly. The preview does not certify the resulting contour: Apply can
still reject a collapsed edge, crossing or incompatible seam without changing
the document or adding history.

The reference and target are resolved by panel/boundary names. Construction
uses the flat 2D arrangement, including each panel's rotation, then converts
the result into the target's material coordinates. It never reads draped 3D
positions. Only the selected corner and its attached handles/material pins
move; linked mirrors follow the existing transaction policy. Other pieces'
board positions stay fixed, including files using automatic layouts.

Apply validates the whole garment: crossings, invalid geometry or incompatible
seams reject the edit without adding history. One successful Apply is one
undo/redo step, and the resulting ordinary contour survives Save/Open. This
is a one-time geometric edit, not a persistent dimensional constraint.

### Freehand panels

Choose **Freehand** above the 2D board. Hold the left mouse button to trace
an outline, then release to preview the fitted cubic curves. The orange
segment shows the straight edge that closes an open stroke. Choose **Create
panel** to add a meshed piece in both views; this never replaces existing
panels. Use placement tools to arrange it before sewing or simulation.

**Fit tolerance** is in millimetres (default 1 mm). It bounds the fitter's
sample residual at chord-length parameters, not the continuous curve's
Hausdorff distance. Fitting and contour validation happen on release or a
tolerance change, not every frame. Asymmetric Bézier controls are preserved.
Self-intersections are checked on the flattened contour, as for other panels.

Escape, Cancel, changing tools or losing window focus cancels an unfinished
stroke. Ctrl+Z cancels a pending stroke before touching document history.
Committed panels use ordinary undo/redo and Save/Open. Drawing bypasses grid
snapping; camera transforms stay fixed during a stroke. Up to 4096 delivered
pointer samples and 63 fitted spans plus a closing edge are accepted; overflow
rejects the stroke rather than silently truncating it. Invalid contours remain
visible with an error and cannot be committed. Draw again to replace a preview.

This first integration creates **new outer contours only**. Replacing existing
sewn contours, freehand holes and internal lines remain separate tasks because
they require explicit boundary-reference migration.

For numeric primitives, mirrors, booleans/holes and internal sewing curves with ruffles, see [drafting tools](drafting-tools.md). All use the same board, selections and undo history.

- **New sheet** starts a blank drawing; the existing garment is replaced only after a valid contour is completed. Cancel the trace to keep it.
- **Pen**: click for a corner; click and drag to set a Bézier tangent. Continue around the piece, then click its first anchor or **Close the contour** / Enter. Backspace removes the last anchor; Escape cancels the trace. The magnet defaults to 10 mm and can be changed in Settings.
- **Rectangle**: drag between opposite corners. Release creates a meshed panel in 2D and 3D.
- **Edit**: select a panel, then drag an anchor to change its outline. Select a boundary and use **Add Bézier handles**; drag either blue handle independently. **Convert to straight segment** removes the handles. Self-intersecting or otherwise invalid edits are rejected without changing the document.
- Drag the interior of a piece to rearrange it on the board. This changes only its 2D layout, never its physical rest shape or 3D placement. Middle/right drag pans the board; the wheel zooms around the pointer; the **Frame all** icon frames all pieces.
- In **Edit**, drag the selected piece's gold circular handle to rotate it on the board. **Shift** snaps to 15° increments; Escape cancels the preview and Ctrl+Z undoes the edit. Rotation keeps the piece's center fixed and preserves material coordinates, grain, seams and the complete simulated state. Anchors and Bézier handles remain editable after rotation.

Curves are cubic Béziers with two controls per named edge. They are stored as curves, then subdivided to a 0.25 mm chord-error bound for the constrained Delaunay mesher. Sewing uses that sampled boundary's rest arclength, not the straight chord between its anchors. Boolean cutouts create holes, and internal sewing lines retain material on both sides. Internal cuts and automatic smooth-handle coupling for outer contours remain planned. Legacy v1 rectangular templates remain readable/simulatable; contour editing targets v2 polygons, including newly drawn rectangles.

## Sew in either view

Choose **Sew** and click boundary A in 2D or 3D, then boundary B in either view. Edges highlight together across views; endpoint labels (`A0 ↔ B0`, `A1 ↔ B1`) and 3D connection lines preview correspondence. Check the length difference and **Reverse B's direction**, then **Commit the seam**. Different lengths require **Allow easing (different lengths)**. The highlighted pair is explicitly labelled as a preview until committed. **Sew and simulate / Space** commits the pending pair before starting; invalid sewing leaves simulation paused and displays the reason in the inspector.

Committed seams have a stable color in both views and the seam list. Sparse dashed links and small endpoint ticks connect corresponding positions. Selecting or hovering either edge emphasizes its pair; pending links are pink and labelled **Preview A ↔ B**. **3D gear → Overlays → Seam links** hides the background links while retaining the active pair. The display follows the compiler's trimmed, reversed, notch-aware rest-arclength map; no vertex indices are persisted. Lines are visual overlays, not threads or additional constraints, and may be visible through geometry.

For an apron added to an existing shirt: draw the rectangle, place it outside the body, select its upper edge and the shirt's free hem, check correspondence, then **Sew and simulate**. For example, a 660 mm edge joined to a 560 mm hem needs explicit easing or a pattern adjustment. A newly drawn piece participates in physics even before it is sewn; without an attachment it falls.

3D picking follows compiled boundary chains, including curves and the current drape. It rejects hits hidden by the avatar or other cloth: orbit to reach the back. Highlight lines are overlays and may remain visible through geometry. A whole panel can be selected by clicking its visible surface in **Edit**, **Move 3D** or **Rotate 3D**.

**Existing seams (N)** is available in the Piece tab of the inspector: select a named seam or press its **Delete** button. In **Edit** or **Sew**, click a sewn boundary in either view: both sides highlight and **Delete the seam** appears. **Del** removes the seam if exactly one is associated with the selected edge and no text field owns keyboard input. **Ctrl+Z** restores it. Removal preserves the cloth and drape. Partial boundary ranges and ordered 1:N / M:N chains are supported; see [documents and sewing](documents-and-sewing.md). Dedicated manufacturing notches remain planned. Editing one member of an equal-length seam can be rejected if it changes that length: remove/recreate the relation with explicit easing when appropriate.

## Place and simulate

**Move 3D (G)** and **Rotate 3D (R)** directly select the arrangement gizmo. Drag the colored arrows or X/Y/Z rings; Shift snaps rotations to 15° increments. Rings remain draggable when viewed edge-on using a screen tangent. Rings and numeric rotations use the panel's bounding-box center as their pivot; **Frame the panel** finds an off-screen selection. Shortcuts do not act while editing a text field.

These tools edit the selected piece's **flat arrangement** and preserve the other pieces' drape. Moving or rotating a draped piece returns that piece to its flat shape; it is not a rigid transformation of the drape. Gizmo release commits, Escape restores the state before preview; numeric fields use **Apply**. Right drag orbits, middle drag pans, wheel zooms the 3D camera. **Duplicate / Delete panel** act on the selected panel; deletion removes its seams and retains at least one panel.

**Simulate / Space** switches to cloth-grab mode and starts the existing worker. In **Grab**, left drag applies an implicit surface attachment; radius and strength are available above 3D. See [editor basics](editor-basics.md) for brush behavior and limits. Physical edits invalidate solver caches but retain positions and velocities of compatible panels, matched by ID and identical local rest mesh, arrangement and pins. Adding a piece or changing seams/material therefore preserves the existing drape; newly drawn, moved or remeshed pieces start at their arrangement. Density edits rebuild masses without resetting geometry or velocity. A 2D layout edit preserves the whole physical state. **Simulation → Reset the flat arrangement** deliberately restores the full arrangement. Gizmo/contour previews do not remesh each frame. Neither a drawing nor a gizmo guarantees a collision-free initial arrangement; OGC can reject cloth placed inside the body.

## Choose a fabric

Open the **Fabric** tab in the selected panel's inspector; **Fabric · weight and stretch** is expanded by default. Nine indicative presets cover cotton, jersey, wool, denim, leather, silk, linen, nylon and stretch knit. Adjust g/m², thickness, extension at the displayed reference load, shear and bending, then **Apply fabric**. Use the checkbox to affect all panels. The inspector shows actual panel and garment masses in grams. [Fabric guide and sources](fabrics.md) distinguish measured mass/thickness from estimated mechanics. These controls change physical properties, not visual textures.

**Undo / Redo**, or Ctrl+Z / Ctrl+Shift+Z, retain up to 32 document edits. While drafting, Ctrl+Z removes an anchor. The inspector shows relevant tools; mesh density, solver settings and diagnostics are in the **Simulation** inspector tab. **Examples** loads the T-shirt or dress; the **3D gear** menu contains wireframe, strain and seam overlays.

The **Pieces** browser also selects a panel in both views. **Simulation** contains single-step and full-arrangement reset; the **Frame all** icon above 3D reframes the garment and avatar. **File → Files & formats** lists actual interchange capabilities and the export directory. Tooltips explain gestures; drawing, sewing, placement and grabbing are grouped in the toolbar. See [workspace validation](workspace-polish.md).

## Save and reproduce

**Export** writes template JSON, fitting-project JSON, OBJ, preview SVG and fiber guides in the launch output directory, replacing its fixed filenames. Bézier controls and 2D layout survive JSON round trips; SVG outlines and sewing previews follow the sampled curves. SVG remains a preview, not a calibrated sewing print.

Reopen with `scripts/start-atelier.ps1 -ProjectPath output/atelier/fitting-project.json`. Save/Open use a file picker, portable adjacent avatar assets and separate recovery snapshots. Keep the JSON and its adjacent `.assets` directory together; see [documents and sewing](documents-and-sewing.md).

## Implementation map

| Module | Responsibility |
|---|---|
| `src/authoring.rs` | Atomic commands, physical-vs-layout change classification, history, local-coordinate normalization |
| `src/garment/curves.rs` | Cubic evaluation, bounded recursive subdivision, sampled arclength |
| `src/garment/polygon.rs` | Contour validation, triangulation, reassembly of named curved boundary chains |
| `src/atelier/board.rs` | Unified pan/zoom canvas, drafting, anchor/handle/layout previews, shared selection |
| `src/atelier/edges_3d.rs` | Screen-space edge picking with visibility checks and correspondence overlays |
| `src/atelier/authoring_ui.rs`, `gizmo.rs` | Inspector, history, mode controls, rigid placement |

Optional `curves`, `holes`, `lines`, `layout_2d` and `layout_rotation_degrees` fields extend existing templates; old v1/v2 files still load. Empty geometry extensions are omitted when serialized. Both layout fields are excluded from physical cache signatures and physical-change comparisons. The angle defaults to zero and zero is omitted when serialized, preserving historical cache signatures. JSON uses exact floating-point round trips so near-degenerate Delaunay decisions do not change on reload. Curve intersection validation applies to the sampled contour, not an exact algebraic intersection proof.

A v2 polygon may also carry `target_lengths`: a map from each stable boundary identifier to its required length in metres, empty and omitted when no target is set. A target is a 2D specification. It is shown as a measured-versus-target deviation and is applied to the rest contour only by an explicit **Target length** action in the inspector; opening or reloading a document never resizes a piece. Values that are missing, non-finite or non-positive are reported and treated as no target. Setting a boundary's target refuses a later split or point deletion on that boundary until the target is cleared, so a specification can never be silently re-pointed at a shorter edge. Stored targets are excluded from the physical-change comparison (`same_physics`), so setting or clearing one cannot disturb the drape; only applying a different required length moves the rest contour and resets the caches.

The explicit native smoke (GPU window, outside ordinary CPU CI) is:

```powershell
cargo run --release --locked -j 2 --bin cloth-fit -- --steps 0 --ui-authoring-smoke --output output/board-smoke
```

It uses 55 real egui pointer actions and writes `authoring.json` plus `ui.png`, including partial/M:N seam editing, 2D rotation preserving physics, all three 3D rotation rings, pending-seam commitment on Play, seam deletion/restoration preserving the drape, a denim material assignment, export and actual new-panel motion. The fixture separates pieces before turning them: arrangement tools do not repair or prevent initial intersections. CPU coverage is in `tests/authoring.rs`, `tests/pattern_board.rs`, `tests/editing_state.rs` and `tests/fabrics.rs`. GPU free-fall and supported-cloth regressions are explicitly ignored by default; see [adaptive initialization](adaptive-initialization.md).

Rotation validation, 14 October 2026: all 78 CPU tests and the 41-action native scenario pass ([captured report](rotation-validation.json)). The existing three-panel saved fitting project also reloads with its state and historical signature. The first XYZ fixture intersected its neighbour and was rejected by OGC; the final fixture adds an explicit translation before rotation. This is an interaction/state-preservation check, not a convergence or performance benchmark.

During simulation, **Properties → Simulation → Diagnostics** displays maximum seam gap and positive axial extension (95% of rest area and maximum). Large gap means assembly is incomplete; persistent excessive extension may indicate incompatible sewing, material choice or insufficient convergence. The Simulation tab allows up to 128 iterations. The default is now 16; adaptive initialization and the larger solve budget address artificial gravity stretch without changing mass or gravity.

Measured outcomes and example captures: [board validation](board-validation.md). The reusable [curved-panels fixture](../examples/templates/curved-panels.json) is a saved result from the native drawing workflow.

## Numeric editing and view controls

### Fast tool switching, box selection and clipboard

Right-click either canvas without dragging to open the radial tool menu (or use **Tools · RMB**). Click a sector or press **1–8**; **Esc**, the center or a click outside cancels. Right-drag still pans/orbits. The menu consumes its closing click so it cannot start a drawing or select an edge underneath. It is clamped inside the window and follows the light/dark preference.

In **Edit**, **Box / Lasso** and **Panels / Points** are visible above the board. Drag empty board space to select pieces whose actual cloth triangles intersect the region; empty cutout space alone does not count. Shift adds to the selection; Shift-click toggles a piece. Drag a selected panel body to move the whole selected group on the 2D board in one undoable edit. This leaves all rest geometry and 3D state unchanged. **Points** selects outer anchors across polygons. Drag a selected anchor or use arrow keys to move all selected points in one validated, undoable edit, accounting for each panel's board rotation. Shift adds to the selection. Selected anchors have outlined blue markers and numbers in 2D and at their visible positions in 3D. Delete removes selected panel bodies when no text field, point or seam owns that action; at least one panel must remain. Group rotation, group 3D placement and 3D marquee/lasso gestures remain unsupported; the gizmos act on the active panel. See [current interaction validation](realtime-follow-up.md#selection).

**Ctrl+C / Ctrl+V** (Command on macOS) use the system clipboard. Copy/Paste buttons provide a local fallback. Text fields retain their normal clipboard behavior. Copies include editable geometry, grain, materials, holes, internal paths and target lengths. Seams are copied only when both endpoints belong to the copied group. Paste allocates new panel/seam IDs, reuses equal materials and preserves conflicting destination materials. One paste is one undo entry. Existing compatible pieces retain their simulated positions and velocities.

The copied group appears at the board pointer (or view center); repeated pastes are offset. In 3D it is placed beside the existing flat arrangements. **Inspect and arrange copies before simulating:** this placement is not an intersection check against the avatar or the current drape. Internal seam relationships remain together; external seams are intentionally omitted. The clipboard carries versioned editable JSON (`clothcraft-pattern-clipboard` v1), never draped mesh indices. Limit: 64 panels / 2 MiB.

Implementation: `authoring/clipboard.rs` and `Command::{Paste,LayoutGroup}` own CPU transactions; `atelier/selection.rs` and `radial.rs` adapt input. CPU tests cover remapping, materials, state preservation, undo/redo, invalid payloads, geometry selection and real headless egui pointer events. Native window/OS clipboard acceptance was not run during the owner's Unreal rendering session.

### Existing numeric tools

Adapted from FireflyTheReal / julienfoss; see [provenance and integration fixes](firefly-integration.md).
In Edit, Shift-click contour points to select several. Drag a selected point or use arrow keys (1 mm; Shift: 10 mm). Numeric coordinates and rectangle dimensions are in the inspector. The nearby + badge splits an unsewn boundary at sampled material arclength; Delete removes a straight, unsewn, untargeted point. Clear an affected seam or target before changing its boundary identity. Internal sewing paths remain separate from outer-contour point selection.

The inspector and board share the selected boundary's target length. Applying it changes rest geometry; clearing it removes only metadata. Dimensions scale the rectangle's holes and internal paths as well. All commands remain transactional and undoable.

The camera dropdown above 3D provides presets, frame all/selection and perspective/orthographic projection. Alt-left drag rotates the 2D view; [ / ] rotate it 15 degrees and Home resets it. These are camera changes, distinct from the panel arrangement gizmos. Workspace → Preferences applies theme and snap immediately; its simulation/overlay defaults are for the next launch. Local recovery snapshots now exist; see the document guide.

### Intersection tool validation

EXO-CAD-010 extends the existing construction transaction; it adds no saved
fields or physics behavior. Its CPU tests cover rotated frames, independently
rotated references, intersections beyond endpoints, invalid references,
invalid resulting contours, exact undo/redo and reload. The named-widget
scenario drives the actual Intersection mode, both edge menus and Apply,
including parallel/stale/curved references and a rejected contour edit.
It uses the [CPU harness](widget-harness.md), not OS input or a GPU window.
Run `cargo test --locked -j 2 --bin cloth-fit named_widgets -- --test-threads=2`
and `cargo test --locked --no-default-features -j 2 --test drawing_commands -- --test-threads=2`.

Validation on 23 October 2026: all 23 drawing-command tests and 59 editor
tests passed (one optional preview ignored). Seven editor scenarios now use
named widgets. The intersection scenario also caught a popup-transition
issue: selectors close explicitly after selection, and the test renders the
closed popup before opening the next one. No native-window or GPU acceptance
is claimed for this slice.
