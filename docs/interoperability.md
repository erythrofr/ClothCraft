# Interchange: actual support and next adapters

Reviewed 2026-10-14. This is a requirements document, not a list of implemented readers/writers. Inputs and outputs are separate capabilities. All adapters must sit outside the physical solver and convert through the canonical garment/asset model.

## Available now

| Format | Input | Output | Contract / loss |
|---|---|---|---|
| ClothCraft fitting-project JSON v1 | Workspace File → Open and CLI `cloth-fit --project` | Workspace Save / Save As and CLI | Editable template, optional state and interactive settings; adjacent portable OBJ assets |
| ClothCraft template JSON v1/v2 | `cloth-template` CLI | `template.json` | Named panels/boundaries, local metre coordinates, shared fabrics, grain, sewing and board metadata |
| OBJ | Avatar surface geometry through CLI | Static garment and grain guides | Geometry only; no MTL, skinning, animation, normals/material round trip or reconstruction of sewing patterns. Export UVs are local metres, not a packed texture atlas. Triangulate complex avatar polygons before import |
| SVG | None | Pattern preview **and** untiled metric sewing outlines | `patterns.svg` is a visual preview; `patterns-print.svg` sets physical mm dimensions and a 100 mm ruler. No allowances, nesting, grading, PDF, page tiling, or printer-scale guarantee |
| Diagnostic JSON | No general interchange reader | Metrics/fiber frames | Research outputs; fibers are surface directions, not simulated yarns |

The workspace's **Export** action writes these supported outputs together to its launch directory. It replaces fixed filenames. Native project Save/Open dialogs, portable OBJ assets and local recovery are available; export still uses the session folder. See [document contracts](documents-and-sewing.md).

## Required inputs and outputs

| Priority | Format | Input milestone | Output milestone | Main blocker / acceptance |
|---|---|---|---|---|
| Critical | DXF-AAMA / DXF-ASTM | Pieces, explicit units, contours, grain, annotations, notches; identify dialect | Preserve piece/edge identity and cutting/sewing distinction through round trip | Generic DXF geometry is not apparel-DXF support. Independent fixtures for each dialect, unsupported-entity reports, shape/length comparisons |
| Critical | OBJ + MTL | Avatar/prop groups, material bindings, referenced textures | Per-panel groups, normals, material assignments and texture paths | Current geometry subset is partial. Validate scales, axes and missing resources |
| Critical | glTF / GLB | Static avatars/props, then rigged/animated assets | Static garment mesh/PBR first; animation only after its model exists | Validate with Khronos tooling and independent viewers. Explicit extension policy; no editable-pattern recovery claim |
| Critical | Alembic `.abc` | Animated avatar cache | Time-sampled garment positions/normals | Stable topology, time units and vertex order; test playback in a DCC |
| Critical | OpenUSD `.usd/.usda/.usdc` | Meshes, transforms, material bindings and time samples | Garment hierarchy, materials and cache samples | Stage units/up-axis, layer/asset resolution; Chaos-specific metadata is a separate tested capability |
| High | FBX | Avatar hierarchy, skinning, bind pose and animation | Mesh/material output, then rig/animation where supported | Choose supported SDK/library and distribution terms; test bind transforms and frame sampling |
| High | SVG / PDF | Vector paths with physical scale; images may serve as tracing references only | **Untiled mm SVG sewing outlines and a ruler now exist**; tiled PDF, grain, labels and allowances remain planned | Distinguish vector geometry from a scanned image. Require user-confirmed scale when absent; do not pretend a raster is a pattern |
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
