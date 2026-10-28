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
deletes its trims. Remeshing retains the same material coordinates. Mirroring,
replacing the whole garment and changing the material contour of a panel with
trims are rejected until their mapping policies are implemented.

Trim-only edits are classified as nonphysical and excluded from fitting mesh
signatures.

In the Piece inspector, expand **Construction trims**, choose a type and click
**New**. Edit local X, Y coordinates in millimetres; paths use one comma-separated
pair per line. **Position first point on 2D board** moves the whole draft by a
click; **Apply** validates and commits once, while **Cancel** discards the draft.
For zippers and topstitch paths, **Draw path on 2D board** stages up to 128
clicked points; **Finish path** returns to the draft and **Cancel drawing** or
Escape restores the previous path. A finished draft still needs **Apply**.
In Edit mode, clicking an existing trim on the board opens its inspector draft.
The selected panel's board rotation and placement are respected. The 2D draft
is amber; committed trims are purple. A changed or deleted object cannot be
silently overwritten by a stale draft.

The 3D overlay follows the deformed surface using transient material attachments,
rebuilt after remeshing. It displays center lines or button markers, not actual
hardware shapes or widths. Occlusion is sampled at line endpoints and midpoints,
not per pixel. Preview work is bounded: at most 128 objects, 4096 input points,
128 embedded points and a capped ray-test budget. Unsupported or out-of-panel
objects are skipped with a warning; oversized scenes can hide the 3D preview.
Clean view hides the 3D overlay. The 2D preview has a separate 4096-point budget.
Multiple topstitch rows and zipper widths are stored, but both views currently
show only their center line; they are not manufacturing-accurate previews.

Curved paths, attachment to named edges, manufacturing output and physically
simulated closures remain future work. Native-window appearance and performance
require separate testing. No imported artwork or third-party assets are included.
