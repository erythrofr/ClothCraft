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
signatures. Native creation tools, visual previews, curved paths, attachment
to named edges, manufacturing output and physically simulated closures are
future work. No imported artwork or third-party assets are included.
