# Group placement and 3D box selection

In **Place** mode, Shift-click panels to add or remove them from the selection.
Drag outside a gizmo handle to select a rectangle of visible cloth. Hold Alt
when starting the rectangle for **through selection**; hold Shift to add to
the current selection. The rectangle displays its selection mode. Existing
2D panel selection can also supply the group.

Visible selection considers both cloth and the avatar as occluders. Through
selection includes panels whose projected triangles overlap the rectangle,
even behind other surfaces. Successful panel selection clears stale point,
edge and seam selections.

## Moving the group

Drag a translation or rotation handle. All selected panels receive one rigid
world-space transformation around the mean of their arranged material-box
centres. Each panel contributes equally to that mean. This is not a mass
centre or a centre computed from the current draped shape.

Preview and commit reset moved panels to their flat arrangements. Unchanged
panels preserve their drape. Moving a group does not change rest coordinates,
fabric properties, sewing relations or linked-mirror relationships. Linked
geometry remains linked; 3D placement does not mirror another piece's pose.
Release commits one authoring transaction; Undo restores the previous
placements in one action. Undo is not a full physical-history replay.

Escape or losing window focus cancels an active placement preview or rectangle.
Leaving Place mode also clears the selection rectangle. Placement cancellation restores the captured
state and does not create an authoring history entry. The worker generation
may advance to reject stale responses; cancellation must not rewind that
counter. Commit also invalidates stale worker responses through the ordinary
edit installer.

## Selection cost and limits

Visible box selection rasterizes a CPU depth buffer only when the drag ends.
The grid is at most 512 by 512 samples, with a 30-million sample-test budget.
Homogeneous frustum clipping handles triangles crossing the near plane.
Avatar geometry wins near-equal depth ties. Very small visible fragments can
fall between samples, so this is bounded sampled visibility, not exact
analytic visibility. Through selection uses projected triangle overlap.

Budget exhaustion reports an error and preserves the previous selection; it
does not silently return a partially evaluated result. This selection pass
does not alter solver contact detection or execute each rendered frame.

## Evidence and remaining acceptance

PR #105 merged as `2f9f9c5` after all seven checks passed at `4a4340a`.
Four backend fixtures cover shared pivots, nontrivial orientations, linked
pairs, invalid inputs, rest-geometry preservation, unchanged drape, undo/redo
and exact zero-motion behavior. The desktop CPU suite at that revision passed
95 tests, with one optional preview ignored. It includes production projection
and selection helpers, cloth/avatar occlusion, near-plane clipping, budget
refusal, named-canvas pointer/Escape input and focus-loss cancellation.

These tests do not instantiate the complete GPU-backed Atelier. Final preview
restoration and worker-generation wiring were source-reviewed, not exercised
as a complete native interaction test. Task EXO-UX-004 remains open for that
acceptance; native appearance also needs an explicitly authorized window run.
Do not duplicate the implemented transform or selection algorithms.

```powershell
cargo test --locked --no-default-features -j 2 --test group_placement -- --test-threads=2
cargo test --locked --features desktop -j 2 --bin cloth-fit -- --test-threads=2
```
