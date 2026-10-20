# Unified pattern workspace

**16 October:** [Document lifecycle and partial/multi-edge sewing](documents-and-sewing.md) now extend the workflow below. Native Save/Open is separate from Export. Use Sew → Multiple edges per side for ordered chains.

**Workspace update (15 October):** tools are on the left rail and in the radial menu. Drag dividers to resize 3D / 2D / Properties; use Expand / Split to focus a canvas. Display controls are in each viewport’s gear menu, and Properties has Piece, Fabric and Simulation tabs. [Layout, display options and limits](workspace-ui.md).
## Persistent Points of Measure (EXO 2D)

EXO stores editable POMs in `GarmentTemplate` v2 under each
`panels[].polygon.measurements` array. Each record has a stable `id`, human
`label`, and two anchors `{edge,t}` tied to a named panel boundary. The
`t` value is the **normalized material-space sampled arclength** in
`[0,1]`, not a Bézier parameter, screen coordinate, triangle index, or
position on a draped 3D mesh. Physical distances are in **metres** in Rust
and shown in centimetres or millimetres by the UI. Current POM values
measure the **straight-line rest-space distance** between the two stations.
This is not a curved-path tape measurement or a graded technical POM table.

`SetMeasurement` creates or replaces an identified record; `RemoveMeasurement`
deletes one. Both are compiled, validated transactions with Undo/Redo and
do not reset the simulation's rest mesh or drape. Invalid IDs, labels,
fractions and missing boundaries fail closed. On `SplitBoundary` an anchor
is assigned to the left or successor edge using the exact physical
split station, and its normalized station is remapped to the child. Mirror
reverses station direction (`t ↦ 1-t`) while retaining named-edge identity.
Supported contour edits retain POM IDs. Deleting a referenced boundary,
performing Boolean reconstruction that loses those stations, or sending a
`Shape` with a silently removed POM is rejected.

The 2D Measure tool accepts two cutline clicks and saves a real native POM,
then provides a frosted in-viewport list for selecting, renaming and deleting
stored records. The nearest-boundary hit tolerance is screen-based (12 px,
bounded to 35 mm) so it scales with zoom. Stored marks render using the
current compiled Rust material UV boundaries, not an independent SVG model.
The `pattern-audit` response includes each POM's measured millimetres and
both material endpoint stations. Undo/Redo and reopen are exercised through
`tests/persistent_pom_references.rs` and the isolated real-browser script
`scripts/engineering/tests/qa-native-pom-browser-20261018.mjs` in EXO V2.

**Limitations:** No native multi-size POM rule table, user-defined curved
measurement paths, cross-panel POM, or automatic industry-specific fit
tolerances yet. These are not manufacturing-approved measurements.

Launch `scripts/start-atelier.ps1`. All pieces share **one metric 2D board**, beside the 3D garment view. A panel or named boundary selected in either view identifies the same model object in the other view.

## Draft cloth

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

**Existing seams (N)** is available in the Piece tab of the inspector: select a named seam or press its **Delete** button. In **Edit** or **Sew**, click a sewn boundary in either view: both sides highlight and **Delete the seam** appears. **Del** removes the seam if exactly one is associated with the selected edge and no text field owns keyboard input. **Ctrl+Z** restores it. Removal preserves the cloth and drape. This editor handles whole named edges; partial/free sewing, interactive notches and M:N relationships remain planned. Editing one member of an equal-length seam can be rejected if it changes that length: remove/recreate the relation with explicit easing when appropriate.

## Place and simulate

**Move 3D (G)** and **Rotate 3D (R)** directly select the arrangement gizmo. Drag the colored arrows or X/Y/Z rings; Shift snaps rotations to 15° increments. Rings remain draggable when viewed edge-on using a screen tangent. Rings and numeric rotations use the panel's bounding-box center as their pivot; **Frame the panel** finds an off-screen selection. Shortcuts do not act while editing a text field.

These tools edit the selected piece's **flat arrangement** and preserve the other pieces' drape. Moving or rotating a draped piece returns that piece to its flat shape; it is not a rigid transformation of the drape. Gizmo release commits, Escape restores the state before preview; numeric fields use **Apply**. Right drag orbits, middle drag pans, wheel zooms the 3D camera. **Duplicate / Delete panel** act on the selected panel; deletion removes its seams and retains at least one panel.

**Simulate / Space** switches to cloth-grab mode and starts the existing worker. In **Grab**, left drag applies a barycentric force. Physical edits invalidate solver caches but retain positions and velocities of compatible panels, matched by ID and identical local rest mesh, arrangement and pins. Adding a piece or changing seams/material therefore preserves the existing drape; newly drawn, moved or remeshed pieces start at their arrangement. Density edits rebuild masses without resetting geometry or velocity. A 2D layout edit preserves the whole physical state. **Simulation → Reset the flat arrangement** deliberately restores the full arrangement. Gizmo/contour previews do not remesh each frame. Neither a drawing nor a gizmo guarantees a collision-free initial arrangement; OGC can reject cloth placed inside the body.

## Choose a fabric

Open the **Fabric** tab in the selected panel's inspector; **Fabric · weight and stretch** is expanded by default. Nine indicative presets cover cotton, jersey, wool, denim, leather, silk, linen, nylon and stretch knit. Adjust g/m², thickness, extension at the displayed reference load, shear and bending, then **Apply fabric**. Use the checkbox to affect all panels. The inspector shows actual panel and garment masses in grams. [Fabric guide and sources](fabrics.md) distinguish measured mass/thickness from estimated mechanics. These controls change physical properties, not visual textures.

**Undo / Redo**, or Ctrl+Z / Ctrl+Shift+Z, retain up to 32 document edits. While drafting, Ctrl+Z removes an anchor. The inspector shows relevant tools; mesh density, solver settings and diagnostics are in the **Simulation** inspector tab. **Examples** loads the T-shirt or dress; the **3D gear** menu contains wireframe, strain and seam overlays.

The **Pieces** browser also selects a panel in both views. **Simulation** contains single-step and full-arrangement reset; the **Frame all** icon above 3D reframes the garment and avatar. **File → Files & formats** lists actual interchange capabilities and the export directory. Tooltips explain gestures; drawing, sewing, placement and grabbing are grouped in the toolbar. See [workspace validation](workspace-polish.md).

## Save and reproduce

**Export** writes template JSON, fitting-project JSON, OBJ, preview SVG and fiber guides in the launch output directory, replacing its fixed filenames. Bézier controls and 2D layout survive JSON round trips; SVG outlines and sewing previews follow the sampled curves. SVG remains a preview, not a calibrated sewing print.

Reopen with `scripts/start-atelier.ps1 -ProjectPath output/atelier/fitting-project.json`. The fitting project currently stores a resolved avatar path; relink it when moving to another machine. A file picker, portable bundle and autosave remain planned.

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

In **Edit**, choose **Box select → Panels**, then drag empty board space. The rectangle selects pieces whose actual cloth triangles intersect it; empty cutout space alone does not count. Shift adds to the selection; Shift-click toggles a piece. Drag a selected panel body to move the whole selected group on the 2D board in one undoable edit. This leaves all rest geometry and 3D state unchanged. **Points** mode box-selects outer anchors on the active polygon, ready for existing point dragging/nudging. Group rotation, group 3D placement and 3D marquee selection remain unsupported; the gizmos act on the active panel.

**Ctrl+C / Ctrl+V** (Command on macOS) use the system clipboard. Copy/Paste buttons provide a local fallback. Text fields retain their normal clipboard behavior. Copies include editable geometry, grain, materials, holes, internal paths and target lengths. Seams are copied only when both endpoints belong to the copied group. Paste allocates new panel/seam IDs, reuses equal materials and preserves conflicting destination materials. One paste is one undo entry. Existing compatible pieces retain their simulated positions and velocities.

The copied group appears at the board pointer (or view center); repeated pastes are offset. In 3D it is placed beside the existing flat arrangements. **Inspect and arrange copies before simulating:** this placement is not an intersection check against the avatar or the current drape. Internal seam relationships remain together; external seams are intentionally omitted. The clipboard carries versioned editable JSON (`clothcraft-pattern-clipboard` v1), never draped mesh indices. Limit: 64 panels / 2 MiB.

Implementation: `authoring/clipboard.rs` and `Command::{Paste,LayoutGroup}` own CPU transactions; `atelier/selection.rs` and `radial.rs` adapt input. CPU tests cover remapping, materials, state preservation, undo/redo, invalid payloads, geometry selection and real headless egui pointer events. Native window/OS clipboard acceptance was not run during the owner's Unreal rendering session.

### Existing numeric tools

Adapted from FireflyTheReal / julienfoss; see [provenance and integration fixes](firefly-integration.md).
In Edit, Shift-click contour points to select several. Drag a selected point or use arrow keys (1 mm; Shift: 10 mm). Numeric coordinates and rectangle dimensions are in the inspector. The nearby + badge splits an unsewn boundary at sampled material arclength; Delete removes a straight, unsewn, untargeted point. Clear an affected seam or target before changing its boundary identity. Internal sewing paths remain separate from outer-contour point selection.

The native EXO V2 **Edit Curve Point** workspace also supports independent free points along named cutlines. Each point keeps its stable ID and physical position, with optional exact material-space derivative metadata after a topology change. A **SplitBoundary** action on a cutline with independent free curve points now divides the exact piecewise-cubic source into two child cubics, reparameterizes every surviving point and preserves its tangent and stable ID. The already-implemented sewing interval, correspondence notch, allowance and measured target migration applies to the two named children. It remains one undoable transaction. Ordinary authored points omit derivative metadata; older saved projects remain readable.

Splitting **directly at** an independent free point is also supported. The free point is promoted into a true topological vertex with its original ID stored in the optional `polygon.vertex_ids` mapping under the new outgoing named edge. No invalid free point at `t=0` or `t=1` is left behind. The native 2D Split tool exposes authored free points as clickable split markers; it sends the measured curve arclength, and Rust snaps within 0.50 mm to the original saved knot station before partitioning geometry and manufacturing references. The stable ID survives subsequent edge indexing changes, JSON reload and history. Deleting that identified corner remains blocked rather than discarding its provenance.

**Linked mirrored free-curve point splitting is atomic:** when the two owning edges are verified geometric reflections, splitting either marked knot also splits its counterpart at its reflected physical-arclength station. Both source point IDs are promoted to persistent vertices, and a shared `vertex_mirror_groups` mapping records their symmetry for reload and future editing. The authoring command performs two internal validated migrations but exposes just one new revision and one Undo/Redo step. The source remains untouched if either side fails sewing, notches, allowances, target lengths, correspondence, or shape validation. Multiple linked knot pairs on two edges are supported only when their identities can all be restored coherently; unmatched or geometrically non-reflected groups are rejected. A cut through a physical notch station or malformed sewing correspondence is still blocked. The regression contract includes `cargo test --test mirrored_free_curve_split` alongside `free_curve_knot_split`, `free_curve_split_migration`, `free_curve_point_authoring`, `split_attachment_migration` and `edge_sampling_validation`. Sampled contour deviation is checked within the 0.25 mm per-span flattening bound. These checks support accurate engineering references, not certification of garment manufacturing outputs.

The inspector and board share the selected boundary's target length. Applying it changes rest geometry; clearing it removes only metadata. Dimensions scale the rectangle's holes and internal paths as well. All commands remain transactional and undoable.

The camera dropdown above 3D provides presets, frame all/selection and perspective/orthographic projection. Alt-left drag rotates the 2D view; [ / ] rotate it 15 degrees and Home resets it. These are camera changes, distinct from the panel arrangement gizmos. Workspace → Preferences applies theme and snap immediately; its simulation/overlay defaults are for the next launch. Local recovery snapshots now exist; see the document guide.
