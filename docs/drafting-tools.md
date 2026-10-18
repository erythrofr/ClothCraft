# Primitives, mirrors, booleans and internal sewing

Implemented on 2026-10-15. CPU authoring operations, independent of the physical backend. They compile and validate the complete result before committing; failed edits leave the document intact. Every successful edit is undoable. Native window interaction and GPU draping of these new cases still need an explicitly scheduled validation pass.

## Use the tools

- **Shapes** in the toolbar creates a rectangle, circle/ellipse or arc sector at the board center. Enter dimensions in mm; **Circle: H = W** makes a circle. An arc is a closed fabric sector, with two radial edges. Its dimensions describe the supporting ellipse. Arcs are cubic approximations, flattened with the existing 0.25 mm tolerance.
- Select a piece, open **Mirrors and booleans**. **Mirror X/Y** reflects material geometry in place. **−X/+X/−Y/+Y** creates an independent mirrored copy beside it. Axes refer to local 2D coordinates; board rotation is respected. Copies do not copy sewing relationships to other pieces. These are not linked instances.
- For **Union**, **A − B** or **Intersection**, overlap two pieces on the 2D board. Select A, choose B in the inspector, then the operation. **Keep B** retains the cutter. Results inherit A's fabric, grain, meshing and 3D frame. Islands become separate panels; cutouts become real holes. Both inputs must have no seams, pins, internal lines or target lengths: edits never silently discard those references. Empty/invalid results are rejected. Curves become sampled straight boundaries with new names.
- Select a piece, choose **Ligne intérieure**, click anchors and click-drag for symmetric Bézier tangents. **Finish line** or Enter commits an open sewing path. Backspace removes an anchor; Escape cancels. Stay strictly inside material. In **Edit**, select the line and drag anchors/handles; **Smooth tangents** provides handles on a straight line. Changing its length can be rejected if an equal-length seam would become invalid.
- **Sew** pairs that line with another piece's boundary in 2D or 3D. Alternatively select the line and **Create and sew a ruffle**: width in mm, length ratio 1–4. A ratio of 1.5 creates a strip 50% longer than the receiving line with explicit ease. Adjust its initial 3D placement before simulation, especially along a curve. This is gathered material with a finite seam penalty, not guaranteed folds or collision-free placement.
- **Delete line** removes an unsewn line. Remove its seam first if needed; Ctrl+Z restores edits.

Still missing: partial/1:N sewing, linked symmetry and automatic ruffle arrangement. Seam allowance and notches are now draft markings; see [markings.md](markings.md). Internal lines add no fold/crease energy. Hole rims can be selected/sewn; dedicated hole point editing is absent.

## Persistent model

`PolygonPattern` adds optional `holes` and `lines`, omitted when empty to preserve historical serialization/signatures. Example fields inside a sufficiently large outer contour:

```json
{
  "holes": [{
    "points": [[0.2,0.2],[0.2,0.4],[0.4,0.4],[0.4,0.2]],
    "edges": ["hole_1_edge_1","hole_1_edge_2","hole_1_edge_3","hole_1_edge_4"]
  }],
  "lines": [{
    "id": "line_1",
    "points": [[0.1,0.1],[0.5,0.1]],
    "tangents": [[0.1,0.03],[0.1,-0.03]]
  }]
}
```

Coordinates/tangents are local material metres. Outer winding is CCW; holes are CW. Names are unique across outer edges, hole edges and lines. Holes use straight segments; lines use symmetric cubic tangents. Lines must be simple, disjoint and strictly interior. Holes cannot touch, cross or nest. Validation uses sampled polylines, not exact curve predicates. Limits: 32 holes, 64 lines, 64 anchors per line, 4,096 samples per contour/path, 8,192 combined samples and the mesher's vertex budget.

CDT inserts internal paths as constraints with fabric on **both** sides, not cuts. With holes/lines, a temporary frame two metric units outside the contour bounds separates material constraints from the convex hull, preventing roundoff slivers from causing runaway encroachment. Refinement covers this frame, then material membership removes all outside faces and unused frame vertices. Refining outside the material consumes budget. The area postcondition and explicit budget failures remain. Boundary-only historical inputs retain their original meshing path.

Named vertex chains are rebuilt from material coordinates after remeshing. Internal seams reuse `BoundaryRef.edge`, two-vertex interpolation per side, rest-arclength integration, the same four-vertex CPU/GPU terms and local contact exclusions. There is no new per-frame solver path or persistent mesh index. Holes remove area/mass; lines do not. Adding/editing a line remeshes and resets that panel to its arrangement; other compatible panels retain their drape.

Target lengths remain attached to their named edges through reflection. Mirrors restore contour winding and migrate corresponding seam ranges/directions/notches, pins, grain and meshing axes. Internal path directions stay unchanged. SVG preview uses even-odd holes and line strokes; grain-guide export clips against flattened contours and holes. OBJ contains actual triangulated material.

## Implementation and validation

| File | Responsibility |
|---|---|
| `src/garment/shapes.rs` | Primitives, reflection and polygon overlay |
| `src/garment/domain.rs` | Holes/lines, validation, selectable paths |
| `src/garment/meshing.rs`, `polygon.rs` | CDT domain meshing and named chain reconstruction |
| `src/authoring/geometry.rs` | Geometric transactions, reference migration, gathered strips |
| `src/atelier/drafting_ui.rs`, `board.rs` | Controls, pen, picking and handle previews |
| `tests/drafting_tools.rs` | Area/mass, holes, mirror inversion, board transforms, remeshing, seam forces, serialization, atomic failures |

Additional point/view editing and Firefly attribution: [integration notes](firefly-integration.md).

Run `scripts/check-cpu.ps1` and `cargo check --locked -j 2`. Neither uses GPU compute. A future explicit UI/GPU pass should exercise controls, undo/reload, sewing in both views and a draped ruffle at multiple densities before production claims.

Validation on 2026-10-15: the CPU check script passes (93 tests including 13 drafting regressions, CPU Clippy, five historical template fixtures). `cargo clippy --locked --all-targets -j 2 -- -D warnings` also passes with desktop code enabled. Shader checks parse/validate shader code on CPU; they do not initialize a GPU.

The release executable builds with `cargo build --release --locked -j 2 --bin cloth-fit`, without launching it. The final drafting regression run also covers 25 mm isotropic meshing and a rotated 37° anisotropic metric, with continuous material on both sides of each internal chain.

Overlay uses [i_overlay 9.0.1](https://docs.rs/i_overlay/9.0.1/i_overlay/), even-odd fill rule, pinned in Cargo.lock; its manifest declares **MIT OR Apache-2.0**. This is a declared dependency. Its float adapter uses quantized coordinates, so resulting boundaries are approximate. Input coordinates must be finite and within ±1000 m; geometry/mesh budgets impose tighter practical limits.

## Web pattern library investigation

**Free patterns · Web** opens official FreeSewing designs; it does not import or replace the current scene:

| Design | Use | Official source checked 2026-10-15 |
|---|---|---|
| Teagan | T-shirt | [Design](https://freesewing.eu/designs/teagan/) |
| Titan | Trouser drafting block | [Design](https://freesewing.eu/designs/titan/) |
| Jett | Bomber/letterman jacket | [Design](https://freesewing.eu/designs/jett/) |

FreeSewing explicitly permits commercial use in its [FAQ](https://freesewing.eu/docs/about/faq/commercial-use/). No downloaded patterns, photos or logos are bundled here. Inspect and pin exact source/artifact licenses before redistributing a generated library; a free download alone does not establish redistribution rights.

Their [export documentation](https://freesewing.eu/docs/editor/views/export/) describes **SVG geometry**, whereas JSON/YAML exports contain **pattern settings**. Settings JSON is not a finished mesh or ClothCraft JSON. Proposed import track:

1. Bounded SVG adapter: physical units/transforms, closed seam contours, holes and cubics; report unsupported geometry.
2. Distinguish sewing contours from cutting allowances, annotations, grain, notches and mirrored duplicates.
3. Preview pieces and explicitly map sewing edges; arrange in 3D with existing gizmos. Do not guess seams from spatial proximity.
4. Version-pinned generator adapter for parametric measurements, if needed. Keep code, settings, measurement data, provenance and generated geometry separate; distribute synthetic measurements only.
5. Acceptance: Teagan/Titan/Jett dimensions, piece/hole counts and semantic IDs survive import/save/load; verify sewing independently.

The public [Marvelous Internal Polygon/Line manual](https://support.marvelousdesigner.com/hc/en-us/articles/47358276422297-Internal-Polygon-Line) informs interaction goals. ClothCraft's data model, meshing and validation are independent implementations.
