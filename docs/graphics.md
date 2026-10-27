# Graphic placement metadata

This is a CPU document and authoring prerequisite, not an image feature.
`GarmentTemplate.graphics` stores bounded placements with a unique ID, a panel
ID, an opaque asset ID, a metre-space center/size/angle and a front/back side.
An asset ID is not a path, embedded image, portable asset or proof that an image
can be loaded. No native control or renderer consumes these records yet.

Empty lists are omitted when saving legacy documents. Loading and compilation
reject invalid IDs, duplicate IDs, missing panels, non-finite transforms and
more than 4096 placements. Artwork may extend beyond the contour; later rendering
must define clipping and sidedness rather than interpreting these records as
permission to draw outside the panel.

`SetGraphic` and `RemoveGraphic` are ordinary validated authoring transactions.
Visual-only updates preserve the physical signature and use the same editor
transition as fabric appearance, keeping the current worker and drape. A
duplicate or clipboard paste creates fresh graphic IDs and remaps panel IDs;
deleting a panel removes its placements. Mirror and material-geometry changes
(including contour, holes and internal lines) on a panel with attached graphics
are refused until their mapping policy is implemented.
Replacing the whole garment is also refused while it contains graphics.
Meshing-density changes retain the same material coordinates. Transient image
coordinates must be rebuilt after remeshing; they never store mesh indices in
the document. No physical fibers, collisions or calibrated material behavior
are introduced by artwork metadata.

The document contains no asset registry or portability mechanism. Later work
must define safe bounded image formats and project-relative asset lifecycle,
clipping, layering and native UI with undo before advertising images as usable.
