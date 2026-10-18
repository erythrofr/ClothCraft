# Feature map: published CLO / Marvelous Designer functions vs ClothCraft

Reviewed **18 October 2026**. This is a planning document. It maps publicly documented
product functions of CLO / Marvelous Designer onto the current ClothCraft working tree so
the next contribution slices can be chosen on evidence instead of memory. It is linked
from [ROADMAP.md](../ROADMAP.md); the format-level view stays in
[interoperability.md](interoperability.md) and the first-milestone tool view stays in
[essential-authoring-tools.md](essential-authoring-tools.md).

## What this document is, and is not

- **It is** a functional inventory of *externally documented behaviour* and a status
  judgement of *our own code*, family by family, with a proposed next slice each.
- **It is not** a parity claim, a supported-feature list, a release plan or a benchmark.
  A row saying CLO has something is not a promise that ClothCraft will.
- **Feature names and one-line descriptions** below paraphrase the public product page, the
  public release-feature list and the public manual index listed at the end. All ClothCraft
  data models, algorithms, UI and tests remain independently written; see the source/behaviour
  ledger in [manual-study.md](manual-study.md).
- **"Status" is a code audit of this tree**, at the date above, not user testing. Several
  UI paths are CPU/headless-validated and still await native acceptance; see
  [validation.md](validation.md) and the module docs.
- Families that are out of scope are marked **not planned** rather than "missing", so the
  roadmap does not quietly grow a cloud or hardware dependency.

## How to read the status column

| Status | Meaning |
|---|---|
| **implemented** | Code path exists, is documented and has a CPU test with a checkable property (finite difference, invariance, round trip, bounds). Native/GPU acceptance may still be pending and is stated where relevant. |
| **partial** | A real, usable subset exists, with the missing part named. Emitting a file or showing a panel is not, by itself, a completed feature. |
| **planned** | No implementation. An accepted design criterion and slice ID exist. |
| **not planned** | Conflicts with ClothCraft's scope (cloud accounts, AI services, proprietary runtimes, vendor hardware) or with an invariant in [AGENTS.md](../AGENTS.md). |

## The map

Families follow the public manual's own grouping (see sources), with the release features
folded in. "CLO functions" are published capabilities, not specifications we hold.

### Document, project and interface

| Family | CLO functions (published) | ClothCraft now | Status | Next slice |
|---|---|---|---|---|
| File open/save | Native project save with thumbnail, recovery, 3D State, scene/render properties (ZSE) | Native picker, Open/Save/Save As, dirty state, portable OBJ assets, local recovery; JSON is the document | **partial** — no multi-document tabs, no versioned recovery history, no saved 3D state | `SAVE-02` multi-tab + managed recovery history |
| Interface | Toolbar customization, global menu search, custom layout, UI colour, context menus | English UI, light/dark preferences, fixed workspace layout, radial tools | **partial** — no user-arranged toolbar or menu search | `UI-01` searchable command palette (indexes existing commands only) |
| Selection & organisation | Object browser, isolate selection, hide/lock, pattern archive, group internal lines | Object browser, 2D marquee, clipboard, linked 2D/3D selection, grouping of internal lines | **partial** — no hide/isolate/lock, no piece archive | `EDIT-01` presentation-only visibility, isolate and lock |
| Autosave | Time-based autosave with an interval setting | Recovery snapshots on write; no interval policy | **partial** | `SAVE-02` (shared with tabs) |

### 2D pattern authoring

| Family | CLO functions (published) | ClothCraft now | Status | Next slice |
|---|---|---|---|---|
| 2D pattern | Polygon/rectangle/ellipse, Bézier curves, pattern drafter, seamless blocking, calculator notepad, NURBS | Rectangle/ellipse/arc primitives, cubic Bézier boundaries, numeric dimensions, constrained Delaunay meshing | **partial** — no drafter, blocking, notepad or NURBS | `DRAW-05` notch-free pen improvements are lower priority than `DRAW-04` |
| 2D pattern edit | Offset internal line, internal line fold angle, linked editing, symmetry sync, group internal lines, point optimisation, smooth curve, real-time arithmetic input | Internal Bézier paths and ruffle strips, unsewn splits, numeric point moves, per-point curve/straighten, booleans with holes | **partial** — no measured offsets, no linked symmetry, no arithmetic fields | `DRAW-04` measured offset, then `DRAW-03` linked symmetry |
| 2D arrangement | Flip, rotate, match up, align, distribute | Board drag, group drag, board rotation, independent mirrors, numeric 2D layout saved per piece | **partial** — no align/distribute/match-up | `DRAW-06` align and distribute on the board |
| Dart / pleats / fullness | Dart, base dart, segment darts, add dart with fullness, pleats | Ruffle strips (a related but distinct fullness mechanism); no dart or pleat object | **planned** | `FULL-01` one explicit dart with a physical fold |
| 2D pattern information | 2D pattern information panel, create notch, pattern annotation | Boundary names/lengths, target lengths | **partial** — no free-position annotations, no printed piece label, no measurable on-board information probe | `ANNO-01` piece annotations, then `MEASURE-01` |
| Manufacturing marks | 2D seam allowance, create notch, grain line | None; seam links carry a `notches` placeholder that is never populated | **planned** — no seam allowance, no notch authoring, no joined cutting contour | `MARK-01` per-boundary allowance and notches as stable draft data, then `MARK-02` |
| POM | Create/edit 2D POM, POM object browser | None | **planned** | `GRADE-01` (POM is a prerequisite) |
| Grading | Add/apply grading, trim grading, auto fitting | None | **planned** — explicitly a string-free zone until single-size exchange is reliable | `GRADE-01` named dialect + size tables |
| Print layout mode | Tape measure, nest patterns, edit fabric in layout | `patterns.svg`, an unscaled preview explicitly labelled *not a print-to-scale sewing pattern* | **planned** — no scaled or tiled sheets, no nesting, no tape measure in layout | `LAYOUT-01` deterministic nesting over scaled sheets, then `LAYOUT-02` |
| BOM editor | Bill of material | None | **planned** — no cut count, no cut list | `BOM-01` per-piece cut count and a printed cut list, then `BOM-02` |

### Sewing and assembly

| Family | CLO functions (published) | ClothCraft now | Status | Next slice |
|---|---|---|---|---|
| Sewing | Free/segment sewing, 1:N and M:N, reversed seams, auto sewing, select all sewn patterns | Whole-edge and whole-path sewing, partial ranges, ordered 1:N / M:N, direction, easing, delete/undo | **partial** — no auto sewing heuristic, no correspondence markers | `SEW-02` notch/correspondence markers |
| Seam finishing | Turned seams, weld turned seamlines, seam tape extrusion | Easing and ruffle strips; no turned/seam-tape geometry | **planned** | after `SEW-02` |
| Lacing / gluing | Lacing tool, gluing tool | None | **planned** — needs distinct physical semantics, not a colour toggle | `FASTEN-01` one explicit fastening type |
| Arrangement | Arrangement points, auto 3D arrangement, wrap direction, pattern archive | Flat placement, 3D move/rotate (G/R), camera framing; no body anchors | **partial** — no body-aware placement or preflight | `ARR-01` body anchors + clearance preview |
| Simulation controls | Play/pause/step, quick pinching, brush pinching, sculpt, freeze, pins | Worker play/pause/step, mouse grab; model pins exist but have no complete authoring UI | **partial** — no persistent pin workflow, no freeze, no pinching | `SIM-01` persistent pins, then `SIM-02` freeze |

### Physics and fit

| Family | CLO functions (published) | ClothCraft now | Status | Next slice |
|---|---|---|---|---|
| Cloth simulation | Fabric presets, GPU and Metal simulation, soft body, collision thickness, align collision direction | CPU Newton reference, CPU VBD, hybrid GPU VBD + OGC, seams in the implicit objective, thickness/contact, adaptive initialization, real-time accounting | **implemented (CPU-validated)** — GPU paths are opt-in and not in the default suite | `PHYS-02` soft body / layered cloth, only with a new regression scene |
| Fit maps | Strain map, fabric-aware strain maps, garment fit properties, fit on 2D patterns | Global strain and seam metrics plus a strain overlay; labels are not pressure measurements | **partial** — no per-piece map on the board, no fabric-aware weighting | `FIT-01` per-piece strain readout with explicit limits |
| Measurement | 3D garment/volume measurement, tape measure, matched 2D measurements | Boundary lengths, mass, seam gaps | **partial** — no ruler tool, no persistent measurements | `MEASURE-01` 2D ruler and saved measurements |
| 3D mesh / PIN | Mesh display, quad/tri remesh, select and apply to mesh | Per-panel/cell/side meshing settings and remesh on change | **partial** — no interactive remesh or mesh-region apply | after `ARR-01` |
| Avatar | Avatar editor, blend shapes, MetaHuman import, IK joints, AI pose, avatar UV display, wireframe | CLI/asset OBJ avatar intake and sizing; no in-app editor | **planned** | `AVATAR-01` in-app import with unit preview |
| Fabrics | Fabric library, PBR maps, knit swatch editor, denim wet wash, U3M/Vizoo, AI texture, colour switch, blend print | Shared fabric model with named/dimensioned physical properties; grain affects the model | **partial** — no appearance channel, no on-board grain editor | `FABRIC-01` appearance separation, then `GRAIN-01` |

### Garment details and appearance

| Family | CLO functions (published) | ClothCraft now | Status | Next slice |
|---|---|---|---|---|
| 3D design | 3D pencil (avatar and off-avatar), symmetry lock, seamline rip, NURBS on 3D, steam eraser | None | **planned** | only after arrangement and pins |
| 3D details | Roll up, fold garment, rendering thickness, lacing edit, variable fold angle | Thickness is a simulation parameter, not a render option | **planned** | with `FABRIC-01` |
| Button / buttonhole / zipper | Button and buttonhole tools, zipper style, create/edit zipper, teeth OBJ, accessories | None | **planned** | `DETAIL-01` buttons first, as non-simulated attachments |
| Topstitch / puckering | Segment and free topstitch, smooth corner, puckering tools | None | **planned** | after `DETAIL-01` |
| Piping / binding / OBJ trim | Create piping/binding, convert pattern to trim, OBJ trims, seam tape | None | **planned** | after `DETAIL-01` |
| Graphic | Graphic placement, select/move, duplicate, on/off toggle, lock, blend with fabric | None | **planned** | with `FABRIC-01` |
| Colourway / render | Colourway, V-Ray render, toon shader, video capture, turntable, schematic render | Lit viewport only; no offline renderer or capture | **planned** | `RENDER-01` deterministic screenshot/capture from the existing viewport |
| Animation | Keyframe animation, timeline markers, blend-shape animation, camera motion, FBX/glTF/Alembic animation export | None | **planned** — blocked by the animation data model (P2.1) | `ANIM-01` after P2.1 |

### Interchange, libraries and collaboration

| Family | CLO functions (published) | ClothCraft now | Status | Next slice |
|---|---|---|---|---|
| Pattern import/export | DXF (Standard/AAMA/ASTM), AI/PDF patterns, OBJ pattern import | Template JSON in/out; OBJ geometry out | **partial** — no apparel DXF, no PDF | `DXF-01`, then `DXF-02` (see [interoperability.md](interoperability.md)) |
| 3D import/export | OBJ/MTL, glTF/GLB, VRM, FBX, Alembic, USD/USDZ, MetaHuman DNA, camera I/O | Static OBJ out; unscaled preview SVG out | **partial** (static geometry only) | P1.1 static OBJ+MTL, then GLB |
| Print output | PDF/SVG pattern output, nesting, tape measure | Nothing at print scale; the preview SVG states that it is not print-to-scale | **planned** — no PDF, no tiled sheets, no nesting | `PDF-01` after `LAYOUT-01` |
| Libraries & blocks | Modular library, register accessories/trims, library preview, block creation | T-shirt and dress example templates; web pattern generators are linked, not imported | **planned** | `BLOCK-01` documented block set |
| UV editor | UV editor, unified map, UV packing, UV seam improvement, side/back expansion | Export UVs are local metres, not a packed atlas | **planned** | with `FABRIC-01` |
| Review | Grading review (2D/3D), save 3D state in review mode | Undo/redo history exists | **partial** | with `GRADE-01` |
| Collaboration | CLO-SET, CONNECT, account linking, download folders | None | **not planned** — requires a hosted account service | — |
| AI studio | AI image/render, AI texture and graphic generators, AI pose | None | **not planned** — external model service, no offline contract | — |
| Emulator | Fabric kit, emulator mode, warranty | None | **not planned** — vendor hardware | — |

## Roadmap derived from the map

Ordered by dependency, not by ambition. Each slice needs a fixture, undo/save/load coverage
and a checkable property. IDs continue the scheme used by
[essential-authoring-tools.md](essential-authoring-tools.md); where a row there already
owns an ID, this table reuses it.

| Order | Slice | Scope | Acceptance evidence |
|---|---|---|---|
| 1 | `MARK-01` | Per-boundary 2D seam allowance and physical notches as stable draft data, carried onto the printed cutting line | A 10 mm allowance on a curved panel changes the printed cut line and not the physics; a notch survives a document round trip |
| 2 | `MARK-02` | Notch **correspondence**: a matched pair carried across a seam, with a length-difference report | Sew two notched boundaries, shift one notch, see the mismatch reported; a notch survives a document round trip |
| 3 | `MEASURE-01` | 2D ruler, persistent measurements, seam-length comparison | Measure a curved edge and its matching chain with mm agreement, without changing physics |
| 4 | `EDIT-01` | Presentation-only visibility, isolate and lock | Isolate a sleeve, lock the avatar, restore visibility; physics byte-identical |
| 5 | `DRAW-04` | Measured offset of a boundary or internal line, with corner and self-intersection handling | A 10 mm inset on a curved panel; explicit failure when the offset self-intersects |
| 6 | `DRAW-03` | Linked symmetry (edit one side, update the other, unlink) | One edit updates both sleeves once; seam direction and grain stay correct; the whole operation undoes |
| 7 | `LAYOUT-01` | Deterministic nesting of pieces onto shared sheets, with rotation 0/90 only | Same input, same sheet layout, byte for byte; no two cutting contours overlap; page count is reported |
| 8 | `PDF-01` | PDF print output at the same physical scale as the SVG sheets | A PDF whose 100 mm ruler measures 100 mm in an independent viewer |
| 9 | `BOM-01` | Per-piece cut count, page labels carrying cut count / fabric / grain, and a printed cut-list index with per-piece page ranges | A printed package whose cut list names every piece and whose page ranges agree with its tiles; a cut count that cannot alter physics |
| 10 | `BOM-02` | Structured piece fields (description, material code, size) and a machine-readable BOM | Round trip of the fields; a BOM listing every piece with its count and page range |
| 11 | `DRAW-06`, `ANNO-01` | Board align/distribute; free-position piece annotations printed with the piece | Alignment moves only the selected pieces; annotations keep material-space positions |
| 12 | `GRADE-01` | Named grading dialect, size tables, reversible grade; POM as its prerequisite | S/M/L fixtures; a grade applies and reverses to the same geometry |
| 13 | `AVATAR-01`, `FIT-01` | In-app avatar import with unit preview; per-piece strain readout | Explicit units on import; a strain figure labelled with its measurement basis, not "pressure" |

Formats and appearance channels (`DXF-01/02`, GLB, USD, `FABRIC-01`, `DETAIL-01`,
`ANIM-01`) stay behind the milestone in [interoperability.md](interoperability.md) and
[ROADMAP.md](../ROADMAP.md); naming them here does not make them deliverables.

## Non-goals

- Cloud accounts, hosted projects, collaboration and review services.
- AI generation of images, textures, poses or patterns.
- Vendor hardware or material-calibration devices.
- A solver or renderer selector that exists in the UI but has no second implementation.

## Sources actually read

- Product page <https://www.clo3d.com/en/product/clo> — the five published pillars
  (simulation, AI, fit, pattern, material) used for the headline wording.
- Release features <https://www.clo3d.com/en/product/features>. The rendered page returned
  no rows without a version context, so the versioned JSON it loads was read instead:
  `/api/v1/swrelease/features?version=<version>&lang=en`, for versions `2026.1` through
  `12.0`. Feature titles, categories and one-line descriptions were taken from that public
  response. The endpoint is shared with the Marvelous Designer product line.
- Manual index <https://support.clo3d.com/hc/en-us/categories/115000064648> — the family
  taxonomy and article titles (for example *2D Pattern Information*, *Create Notch*,
  *Pattern Annotation*, *Print Layout Mode* → *Tape Measure* / *Nest Patterns* /
  *Edit Fabric*, *BOM Editor* → *Bill of Material*).
- No article behind those titles was read for this review beyond the index. Behaviour
  claimed above is limited to the page, the release list and the index titles.

## What this pass changed

Nothing in the code. This commit adds this document and the three links to it: the paragraph
in [ROADMAP.md](../ROADMAP.md), the entry in [AI_START_HERE.md](../AI_START_HERE.md) and the
source ledger in [manual-study.md](manual-study.md). The rows above are an audit of the tree
this commit sits on.

The first slice this map proposes is `MARK-01`: a per-boundary 2D seam allowance and physical
notches as stable draft data. Neither it nor `BOM-01` is implemented in this tree.
