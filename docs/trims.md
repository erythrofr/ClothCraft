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

Trim-only edits are classified as nonphysical and excluded from fitting mesh
signatures.

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
