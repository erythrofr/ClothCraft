# SVG pattern geometry import

`garment::svg_import` provides a CPU reader and a prepared authoring edit.
It does not yet add an import dialog to the desktop application. It is not an
SVG renderer or a sewing-pattern interchange standard.

## Integration contract

1. Read UTF-8 text with `read_svg(source, Options::default())`.
2. Show `Drawing::losses` and let the user select outline indices.
3. Call `prepare` with the current template, existing fabric ID, meshing
   settings and a finite 3D arrangement origin.
4. Commit the returned edit through the existing authoring/history path.

The reader returns geometry in metres, with positive Y down, matching material
V. Conversion translates each outline to local material coordinates without
flipping it. It creates editable polygon panels, unique boundary identities,
and a separate initial arrangement. It never reconstructs material dimensions
from a draped mesh. Full template compilation succeeds before an edit is
returned. Existing panels, seams and state are preserved by the normal
`Edit::state_after` mapping; new panels start from their arrangement. One edit
is one undoable transaction.

Import creates no seams, pins, internal lines, materials, seam allowances or
manufacturing metadata. Coincident contours are not stitched automatically.
The caller supplies a material already present in the document.

## Supported subset

- An SVG namespace root with explicit physical width and height: mm, cm, in,
  pt, pc or px. CSS pixels use 96 px/in. Root unitless/percentage sizes are
  rejected, rather than guessed from a garment.
- Optional `viewBox`, with its origin and both dimensions respected.
  `preserveAspectRatio` supports `none` and the nine alignments with `meet`.
- Nested groups and affine matrix, translate, scale, rotate and skew transforms.
  Curve tolerance is evaluated after transformation into physical metres.
- Polygons, explicitly closed polylines, non-rounded rectangles, circles,
  ellipses and single closed paths. Paths accept absolute and relative
  M/L/H/V/C/S/Q/T/A/Z commands.
- Basic fill/stroke attributes are accepted but do not affect pattern geometry.
  Display-none subtrees are excluded and reported. IDs or data-name supply
  outline names; plain title/description text is ignored.

Cubic and quadratic curves are subdivided with the existing bounded Bézier
flattener. Elliptical arcs use the SVG endpoint-to-centre conversion followed
by chord sampling with an error bound on the transformed ellipse's second
derivative. The default chord tolerance is 0.1 mm. Curves become polygon edges,
not editable Bézier handles. This tolerance is not the mesh particle distance.

## Explicit limitations and rejection

No viewport clipping is performed: this is an outline-geometry importer.
Root transforms/placement, nested SVG viewports, slice alignment, rounded
rectangles, compound paths, holes, text geometry, use/references, images,
scripts, filters, masks, clipping paths, unknown styles/attributes and external
resources are rejected. Wrap root-level transforms in a group or flatten
unsupported effects in the source editor first. XML DTDs, processing
instructions, general-reference text events and CDATA are rejected. Attribute
values support predefined XML escaping. XML declarations must specify 1.0 and,
if present, UTF-8 encoding.

`read_svg` validates parsing and bounded output, not garment topology. `prepare`
rejects self-intersecting or degenerate selected outlines through compilation.
Selected contours must be disjoint: nesting, overlap and touching are rejected
instead of guessing holes, duplication or panel identity. Unselected contours
are not imported. No source mutation occurs on failure.

Resource limits include 3 MiB input, 64 levels, 4,096 elements, 128 panels,
4,096 vertices per contour, 100,000 output vertices and 100,000 path commands
per outline. Physical coordinates must remain finite and within 1,000 m.
Curve subdivision and pairwise contour validation also have explicit budgets;
exhaustion is an error, not a lower-accuracy fallback.

## Validation and provenance

CPU fixtures in `tests/svg_import.rs` cover physical units, viewBox alignment,
nested transforms, curves, unsupported inputs, editable conversion, stable
save/reload, one-step undo/redo, preservation of existing drape and rejection
without source mutation. Run:

```powershell
cargo test --locked --no-default-features -j 2 --test svg_import -- --test-threads=2
```

This is an independent implementation. EXO's browser importer was inspected
at commit `352c6086b622caeda95f16d9bd923624b95e05d9` to identify user-facing
behavior; its JavaScript and assets were not copied. Dependencies are
`svgtypes` 0.16.1 (MIT OR Apache-2.0) and `quick-xml` 0.41.0 (MIT).
The latter already existed in the lockfile; adding the former also adds
`siphasher`, without upgrading unrelated dependencies.

Consulted specifications:

- [SVG coordinate systems and transforms](https://www.w3.org/TR/SVG2/coords.html)
- [SVG elliptical arc implementation notes](https://www.w3.org/TR/SVG/implnote.html)

Next slice: a preview/selection dialog that displays dimensions and losses,
then commits through authoring history. Do not advertise a desktop SVG import
workflow before that integration is implemented and tested.
