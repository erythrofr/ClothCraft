# Construction trim metadata

Buttons, buttonholes, zippers and topstitch rows are nonphysical construction
annotations. The document stores stable trim and panel IDs and local material
coordinates in metres. Buttonholes are line segments; zipper and topstitch
paths are polylines. Topstitches can describe one to eight rows. Paths are
bounded, finite and have no zero-length consecutive segment. These records do
not validate containment, sew fabric, create fasteners or affect contacts.

The authoring API can create, update and remove trims with undo/redo. Empty
lists are omitted so older documents remain readable. Duplicating or pasting a
panel creates fresh trim identities and remaps panel IDs; deleting a panel also
deletes its trims. Remeshing retains the same material coordinates. Standalone
X/Y mirror operations reflect trim coordinates in the panel's material frame;
an in-place mirror retains trim IDs, while a mirrored copy gets fresh IDs.
Linked mirroring with trims, replacing the whole garment and other material
contour changes on a panel with trims are rejected until their mapping policies
are implemented.

Select an existing trim and choose **Repeat…** to create 1–128 copies at a
fixed panel-local X/Y offset in millimetres. Apply checks each generated center
or path against the panel surface and uses one undo transaction; widths and
row offsets can extend beyond the panel. Cancel or Escape (outside text editing)
returns to the original. Large requests can be refused by the shared work limit, and linked
mirror panels are refused until paired trim synchronization is supported.
While editing, up to 16 copies appear in amber on the 2D board and 3D cloth,
using their existing drawing and bounded surface/visibility budgets. A warning marks incomplete or
invalid previews; Apply always checks the complete set, not just the preview. A CPU integration fixture checks the actual editor installation, undo/redo and
save/reopen with a held interior vertex. Its pending-worker flags are simulated;
it does not exercise a concurrent worker or a native window.

Trim-only edits are classified as nonphysical and excluded from fitting mesh
signatures.

The inspector keeps long trim lists scrollable and renders only visible rows.
For repeated details, **Duplicate** opens a fresh-ID draft of an existing trim.
Position it on the 2D board or 3D cloth, then Apply once; Cancel leaves the
original and the document unchanged.

When a saved trim is selected in Edit mode, Delete removes that trim in one
undoable edit instead of deleting its panel. Delete is refused while a new
trim or an active placement, path or repeat operation is being edited; finish
or cancel that operation first. A changed or removed trim must be selected
again before deletion. Text fields keep their normal Delete behavior.
Once a trim or panel handles or refuses Delete, the same key press is not
also sent to the seam deletion shortcut.

Escape cancels a placement or path only when a text field does not own the
keyboard. If a field is focused, leave it first, then press Escape again.
Undo first cancels an unfinished repeat, placement or path gesture, then discards a
new or modified trim draft before it reaches document history. Redo is
unavailable while such a step is pending. Selecting an unchanged saved trim
does not block history. Text editing retains its own keyboard shortcuts.

In Edit mode, the 2D and 3D placement/drawing buttons require their respective
view to be open. Hiding the target view preserves the draft and any staged path
points; restore the view to continue or cancel the gesture in the inspector.
In the Piece inspector, expand **Construction trims**, choose a type and click
**New**. Edit local X, Y coordinates in millimetres; paths use one comma-separated
pair per line. **Position first point on 2D board** moves the whole draft by a
click; **Apply** validates and commits once, while **Cancel** discards the draft.
For paths that exceed the direct validation estimate, panels up to 20,000
triangles use a bounded material-space index. Ill-conditioned meshes, excessive
work or too many attachments are rejected. A preview rebuild allows at most
four such indexed paths; remaining objects are skipped with a warning.
For buttonholes, **Draw path on 2D board** stages exactly two endpoints; for
zippers and topstitch paths it stages up to 128 clicked points. **Finish path**
returns to the draft and **Cancel drawing** or
Escape restores the previous path. A finished draft still needs **Apply**.
In Edit mode, clicking an existing trim on the board opens its inspector draft.
Board ownership includes legacy rectangular panels and chooses the topmost
panel body when pieces overlap; polygon holes expose the panel underneath.
In the 3D view, an Edit-mode click can also select a visible trim preview;
selection samples cloth and avatar visibility and is disabled in Clean view.
For a trim draft in Edit mode, **Position first point on 3D cloth** lets a click on the
visible owning panel stage a translation of the entire trim. The hit is mapped
back to panel-local material coordinates from the deformed triangle; another
panel or an avatar-occluded hit is not accepted. Escape cancels the placement
gesture and **Apply** commits the draft as one undoable edit. The click query
is limited to 100,000 cloth triangles and reports invalid geometry; it does not
affect physics or collision detection. This workflow needs native-window and
real-scene performance validation.
For a buttonhole, zipper or topstitch draft in Edit mode, **Draw path on 3D
cloth** stages successive points on the visible owning panel using the same
mapping. A buttonhole needs exactly two points; other paths accept up to 128.
**Finish path** keeps the staged line for **Apply**, while **Cancel drawing**,
Escape or changing tools restores the previous draft path. During a 3D gesture,
clicks on the 2D board do not add points or change the selection. This creates
material-space polylines, not geodesics or physical fasteners.
The staged draft appears amber in 3D, including a first-point marker while
drawing. It uses the same bounded, sampled visibility as committed overlays;
out-of-panel geometry or preview limits can hide it with a warning. Incomplete
input is not shown until it forms a valid preview.

One local opt-in CPU measurement of the 3D click query on three synthetic
panels (98,304 triangles) reported a 2.25 ms median / 2.35 ms p95 for a hit,
and 1.98 / 2.07 ms for a miss (18 samples after two warmups). It excludes
avatar occlusion, rendering and simulation, and is not a frame-time claim.
The query scans on click rather than per frame; an index/refit should be
evaluated against actual moving scenes before replacing it. Reproduce with:

```powershell
cargo test --locked -j 2 --bin cloth-fit benchmark_dense_surface_pick_cpu -- --ignored --nocapture --test-threads=2
```
These samples do not prove visibility for every pixel. Skipped trims cannot be
picked. On the 2D board buttonholes and zipper segments show width outlines in
material coordinates. Each zipper segment is outlined separately, so bends are
not joined or clipped to the panel and are not a manufacturing cutline. Inside
the owning panel, clicking an outlined strip or its interior also selects the
object. Topstitch rows are shown at their authored spacing and can be selected
near a row or the center line. Straight offsets use bevel connectors at bends;
the result is not clipped to the panel or a manufacturing stitch path.
The selected panel's board rotation and placement are respected. The 2D draft
is amber; committed trims are purple. A changed or deleted object cannot be
silently overwritten by a stale draft.

The 3D overlay follows the deformed surface using transient material attachments,
rebuilt after remeshing. Multi-row topstitch uses the authored material-space
offsets and the same bevel connectors, embedded along the surface.
If any row leaves the panel or exceeds a limit, the entire object is skipped
with a warning. Zippers and buttonholes show a centerline and two surface-following
width outline with bevel joins and end caps. If that outline leaves the panel,
crosses a hole or exceeds a limit, the centerline remains with a simplification warning.
Buttons remain markers, and none of these overlays represent physical hardware.
Occlusion is sampled at line endpoints and midpoints,
not per pixel. Preview work is bounded: at most 128 objects, 4096 input points,
512 embedded points. Visibility uses direct ray tests for small batches and a
cached, position-refitted editor BVH for larger batches, with a 100,000-triangle
limit and safe refusal if its bounds cannot be built. Unsupported or out-of-panel
objects are skipped with a warning; oversized scenes can hide the 3D preview.
An active draft or repeat preview is considered first within those same limits;
other items may be hidden with an incomplete-preview warning. No committed
objects are removed from the garment.
Clean view hides the 3D overlay. The 2D preview has a separate 4096-unit work
budget that also accounts for the extra width-outline segments.
These overlays are not manufacturing-accurate previews.

One local CPU test with 10,000 synthetic triangles and 1,536 rays measured
170.29 ms exhaustive versus 5.94 ms including BVH construction; after moving
the triangles away from the rays, it measured 348.22 ms exhaustive versus
0.56 ms including refit. All sampled answers matched. These single-run numbers
are workload-specific and do not measure the full editor, simulation, GPU or
real garment; large animated meshes can still make per-frame refits costly.

One CPU embedding comparison on a 20,000-triangle synthetic rectangular panel
matched the exhaustive attachments for the tested paths. Including index build,
simple paths took roughly 9.7–10.4 ms indexed versus 3.7–4.7 ms exhaustive;
a longer path took 10.3 ms versus 16.7 ms. These are single-run, synthetic
measurements; the index is used only when the conservative direct-work guard
would otherwise reject the path, not as a general speedup claim.

Curved paths, attachment to named edges, manufacturing output and physically
simulated closures remain future work. Native-window appearance and performance
require separate testing. No imported artwork or third-party assets are included.
