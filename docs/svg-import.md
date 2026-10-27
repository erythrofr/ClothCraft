# SVG pattern geometry import

`garment::svg_import` provides a CPU reader and a prepared authoring edit.
The desktop adapter exposes this through **File → Import SVG patterns…**.
It is not an SVG renderer or a sewing-pattern interchange standard.

## Native review workflow

Choose a local UTF-8 SVG (at most 3 MiB). The dialog shows its path, outline
count, physical contour dimensions in millimetres, conversion losses and a
positive-Y-down preview. Select the intended contours, choose an existing
fabric and mesh spacing, then acknowledge the losses and click **Add panels**.
Nothing is selected automatically. Preview strokes are sampled for display;
the prepared edit uses the complete parsed geometry.

Changing curve tolerance immediately discards the reviewed contours and
acknowledgement. Click **Update preview** and review again. Choosing another
source also clears the review; cancelling the OS picker keeps the current
review. The source is a bounded in-memory snapshot, so changes made externally
require choosing the file again. Mesh spacing is separate from curve tolerance.

New panels are arranged to the right of the current cloth and avatar. Existing
unchanged panels retain their drape. Apply uses the ordinary history and edit
installer, rebuilding dependent state and invalidating stale worker responses.
Successful Apply requests a 2D board fit on the next frame so the added panels
are visible. This changes presentation only; the 3D camera is unchanged.
Cancel and Escape discard the dialog; invalid parsing or preparation does not
change the document. Finish active drawing/sewing/placement drafts first.

CPU widget tests exercise the real modal and prepared-edit adapter. They do
not instantiate the full GPU-backed Atelier or automate the native OS picker;
native appearance and final installer wiring require separate acceptance.
Four CPU adapter fixtures cover named selection/acknowledgement and stale
Apply, physical dimensions and separated placement, existing drape preservation,
one-step undo/redo, portable save/reopen, invalid source/input budgets, Escape,
failed compilation rollback and the unsaved-window-close flag. Run them with:

```powershell
cargo test --locked --features desktop -j 2 --bin cloth-fit svg_import_ui -- --test-threads=2
```

### Native Windows evidence — 27 October 2026

At `5f25a569ece7298a86e17d044c3c7e9251fdb349`, a short owner-authorized GPU
rendering run used the paused public 40 mm T-shirt and the actual File menu,
SVG picker, review dialog, Add panels, Save picker and Open picker. The test
SVG had explicit 300 mm dimensions and two disjoint contours: a triangle and
rectangle, each with a 100 by 200 mm bounding box. Both preview dimensions
were correct. Selecting both and acknowledging losses produced four pieces;
the eight existing seams remained. Saving and reopening succeeded.

Independent JSON comparison between the launch project and the saved document
confirmed exact preservation of the original panel definitions, seams,
existing position/velocity prefixes and simulation time. New IDs were `svg_1`
and `svg_2`, with widths/heights 0.1/0.2 m. The application was closed after
the test. Generated evidence is local under `output/svg-native-20261027/`;
no private garment was used or published.

That run exposed a framing issue: new panels were partly offscreen immediately
after Apply but visible after reopening. The subsequent board-fit request
addresses this presentation issue; the native result above predates that fix.
The automation's Save filename replacement was displayed but the OS dialog
returned the default `garment.clothcraft.json` in the isolated test directory.
This does not establish an application rename defect; typed-name validation
remains separate. Native Cancel/Undo, simulation during import, concurrent
worker timing and other platforms were not covered by this short run.

## Opt-in installer/worker acceptance

`CLOTHCRAFT_AUTHORING_SCENARIO=svg-installer` selects a native authoring smoke
that clicks the SVG dialog controls, first cancels, then imports two public
outlines and exercises toolbar Undo/Redo. It requires a paused fixture with
empty history and a fresh output directory. The smoke creates its SVG with
exclusive file creation; only this scenario bypasses the OS picker to choose
that output-local fixture. Normal import behavior and CPU tests are unchanged.

Immediately before the actual installer, the smoke requests one real worker
step and waits at most three seconds for its result. It deliberately delays
delivery until after Apply. The ordinary next-frame generation filter must
discard that old result. This is a controlled transport-delay test, not a claim
that the timing occurred naturally. It checks unchanged-panel positions,
velocities/time, the new generation, dirty state, two added panels, original
seams and exactly one undoable operation. No solver or receive filter is replaced.

With current owner authorization for a short native rendering run:

```powershell
$env:RAYON_NUM_THREADS = '2'
$env:CLOTHCRAFT_AUTHORING_SCENARIO = 'svg-installer'
$env:CLOTHCRAFT_SMOKE_SIZE = '1600x980'
cargo run --locked --features desktop -j 2 --bin cloth-fit -- --mesh-mm 40 --steps 0 --threads 2 --ui-authoring-smoke --output output/svg-installer-check
```

Inspect `authoring.json`, including every observed action and `passed`, plus
the process exit status. A missing target, mismatched state, worker failure or
35-second scenario timeout is a failure. The window uses graphics; it is not
part of default CPU CI. This does not replace OS-picker, save/reload or general
concurrency acceptance, and does not certify a GPU simulation backend.

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

The native adapter lives in `atelier/svg_import_ui.rs` and
`atelier/documents_ui.rs`; it reuses this reader rather than parsing SVG again.
