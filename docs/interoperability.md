# Interchange: actual support and next adapters

Available-support table updated 2026-10-25. Later sections describe requirements, not implemented readers/writers. Inputs and outputs are separate capabilities. All adapters must sit outside the physical solver and convert through the canonical garment/asset model.

## Available now

| Format | Input | Output | Contract / loss |
|---|---|---|---|
| ClothCraft fitting-project JSON v1 | Workspace File → Open and CLI `cloth-fit --project` | Workspace Save / Save As and CLI | Editable template, optional state and interactive settings; adjacent portable OBJ assets |
| ClothCraft template JSON v1/v2 | Workspace template browser and `cloth-template` CLI | `template.json` | Named panels/boundaries, local metre coordinates, shared fabrics, grain, sewing and board metadata |
| OBJ | Workspace File → Import avatar and CLI avatar surface geometry | Static garment and grain guides | Geometry only; no MTL, skinning, animation, normals/material round trip or reconstruction of sewing patterns. Export UVs are local metres, not a packed texture atlas. Triangulate complex avatar polygons before import |
| glTF / GLB | Workspace File → Import avatar; static geometry only | None | Node transforms and mirrored winding; metres, Y-up. No textures, animation or skinning. Ambiguous scenes are rejected; supported extensions and losses are explicit. See [avatar import](avatar-import.md) |
| SVG | None | Pattern preview and physical sewing outlines | `patterns.svg` is an annotated preview; `patterns-print.svg` uses millimetres at actual size, with a 100 mm ruler. No allowances, nesting, grading or print tiling |
| Diagnostic JSON | No general interchange reader | Metrics/fiber frames | Research outputs; fibers are surface directions, not simulated yarns |

The workspace's **Export** action writes these supported outputs together to its launch directory. It replaces fixed filenames. Native project Save/Open dialogs, portable OBJ assets and local recovery are available; export still uses the session folder. See [document contracts](documents-and-sewing.md).

## Physical SVG export

Workspace **Export** and `cloth-template bake` now also write
`patterns-print.svg`. Its root dimensions use `mm`; the matching viewBox makes
one drawing unit one millimetre. Panels are stacked independently of their 2D
board arrangement and 3D drape. Polygon boundaries (including sampled curves),
holes and internal lines come from material rest coordinates. Panel IDs and
names are escaped as XML text. The existing `patterns.svg` remains an annotated
preview and must not be used for print scale.

Choose actual size / 100% in the viewer, disable fit-to-page, and measure the
100 mm calibration ruler. This is an untiled sewing-outline sheet, **not a
ready-to-cut pattern**: it has no seam allowances, cutting certification,
printer compensation, grain annotations or PDF page layout. Curves are sampled
polylines; downstream viewers can still apply their own scaling.

All artifacts are prepared after one full template validation, before existing
files are replaced. A template or geometry error leaves those files unchanged.
An I/O failure during writing can still leave a partial set; this is not an
atomic directory transaction. The exporter does not add a second triangulation
for the physical SVG.

Based on Mikyle Couto's [PR #3](https://github.com/erythrofr/ClothCraft/pull/3),
revision `c0ea77d16972abfdc7986a16e3dc3a529a6f0daf`. Firefly's
[independent browser review](https://github.com/erythrofr/ClothCraft/issues/14#issuecomment-6399877415)
measured the reference output in Edge: its 100 mm ruler measured
99.9995–99.9999 mm across three fixtures. That verifies browser unit handling,
not physical printer calibration. Integration adds early validation and reuses
the existing template-save validation. Sheet bounds include outward curve bulges
so they are not clipped; the solver and rest geometry are unchanged.

Integration validation on 2026-10-25 repeated the browser measurement with
Edge 156.0.4314.42 in headless mode with GPU disabled, using actual CLI exports
of `two-panel`, `curved-panels`, `tshirt` and `dress`. Rulers measured
99.99953–99.99986 mm; root dimensions matched their viewBoxes within 0.01 mm,
and every sewing contour was inside its sheet. Six CPU tests cover units,
curves/holes/internal lines, an outward curve bulge, invalid geometry, export
equivalence and preservation of previous files on validation failure.

## Required inputs and outputs

| Priority | Format | Input milestone | Output milestone | Main blocker / acceptance |
|---|---|---|---|---|
| Critical | DXF-AAMA / DXF-ASTM | Pieces, explicit units, contours, grain, annotations, notches; identify dialect | Preserve piece/edge identity and cutting/sewing distinction through round trip | Generic DXF geometry is not apparel-DXF support. Independent fixtures for each dialect, unsupported-entity reports, shape/length comparisons |
| Critical | OBJ + MTL | Avatar/prop groups, material bindings, referenced textures | Per-panel groups, normals, material assignments and texture paths | Current geometry subset is partial. Validate scales, axes and missing resources |
| Critical | glTF / GLB | Static avatars/props, then rigged/animated assets | Static garment mesh/PBR first; animation only after its model exists | Validate with Khronos tooling and independent viewers. Explicit extension policy; no editable-pattern recovery claim |
| Critical | Alembic `.abc` | Animated avatar cache | Time-sampled garment positions/normals | Stable topology, time units and vertex order; test playback in a DCC |
| Critical | OpenUSD `.usd/.usda/.usdc` | Meshes, transforms, material bindings and time samples | Garment hierarchy, materials and cache samples | Stage units/up-axis, layer/asset resolution; Chaos-specific metadata is a separate tested capability |
| High | FBX | Avatar hierarchy, skinning, bind pose and animation | Mesh/material output, then rig/animation where supported | Choose supported SDK/library and distribution terms; test bind transforms and frame sampling |
| High | SVG / PDF | Vector paths with physical scale; images may serve as tracing references only | Physical SVG and tiled PDF, ruler, labels, grain and allowances | Distinguish vector geometry from a scanned image. Require user-confirmed scale when absent; do not pretend a raster is a pattern |
| High | Grading rule files | One explicitly named vendor/dialect with size tables | Reversible rule application and matching dialect | Stable grading-point identity, base size, units and S/M/L/XL fixtures; not a universal `.rul` parser |
| Medium | USDZ | Optional later asset viewing | Validated package for AR/product presentation | Depends on USD and appearance support; verify archive and texture restrictions against target viewers |
| Secondary | MDD / PC2 | Legacy avatar deformation caches | Fixed-topology garment caches | Exact frame/time conversion, topology and vertex-order rejection |
| Secondary | SBSAR | Procedural appearance through a supported runtime/baking route | Baked textures/material settings, not an SBSAR authoring tool | Runtime/distribution evaluation; appearance parameters do not define measured cloth mechanics |

CLO/Marvelous native projects (`.zprj`, `.zpac`, etc.) are **not supported**. Interoperability through documented exchange formats is the first route. Native-format support would require a separate specification and fidelity evaluation, not renaming a JSON file.

## First adapter contract

1. Declare direction, version/dialect and supported entities; never use one boolean called “format supported”.
2. Parse into a validated intermediate representation with source IDs and unit/axis metadata. Do not put parsing in VBD or Newton.
3. Show unsupported elements, missing resources, lossy conversions and unit ambiguity before applying the import transaction.
4. Preserve material-space rest coordinates and stable panel/boundary identities. Rebuild derived meshes/caches; never persist transient mesh indices as sewing references.
5. Validate at least a straight rectangle, curved panel, reversed seam, unequal-length/notched seam and multi-piece fixture. For mesh/cache formats add handedness, transforms, UVs, time and topology tests.
6. Test in a second independent application. Record numerical tolerances and explicit losses. Test importing, exporting and round-tripping separately.

## Sources actually checked

- [CLO DXF import/export](https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export): distinguishes Standard/AAMA/ASTM, units, cutting/sewing lines, notches and grading/rule-file options. These define separate fidelity cases for our future adapters.
- [CLO AI/PDF patterns](https://support.clo3d.com/hc/en-us/articles/115004273427-2D-Pattern-AI-PDF-Import-Export): vector-pattern exchange with scale and interpretation choices. ClothCraft has neither this importer nor a PDF exporter yet.
- [CLO glTF/GLB](https://support.clo3d.com/hc/en-us/articles/360051525034-glTF-2-0-GLTF-GLB-File): separates avatar/trim input, output selection, scale, axes, UVs and animation. We will start with static geometry/materials.
- [Marvelous compatible formats](https://support.marvelousdesigner.com/hc/en-us/articles/47358199862553-Compatible-File-Format): documents different capabilities for OBJ, FBX, Alembic, USD, USDZ, caches and Substance. It is a product capability reference, not a binary format specification.

Implementation must consult the applicable normative format specifications and library documentation before coding. The sources above do not justify claiming cross-product project compatibility.
