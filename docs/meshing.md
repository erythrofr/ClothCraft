# Pattern meshing: constrained Delaunay

`src/garment/meshing.rs` wraps **Spade 2.15.1**, pinned in Cargo. The pattern remains the rest configuration in metres. The mesh is a rebuildable cache; seams continue to reference boundary names and coordinates, never indices.

## Settings

In `panel.polygon.meshing`:

```json
{
  "target_edge_m": 0.025,
  "anisotropy": 1.0,
  "axis_degrees": 0.0,
  "min_angle_degrees": 25.0,
  "max_vertices": 20000
}
```

Isotropic mode uses `anisotropy = 1`. A value of 2 allows twice the size **along the specified axis**, retaining target size perpendicular to it. This axis controls geometric resolution, not grain direction or physical fabric properties.

The constant transform is `q = (dot(p,a)/(h*r), dot(p,b)/h)`, where `a,b` are rotated axes, `h` is target size and `r` the ratio. Triangulation and angle checks occur in this metric space; exported UVs return to metres. Anisotropy is global per panel, not yet a spatial field adapting to curvature or stress.

`target_edge_m` is a nominal equilateral size, **not a strict bound on every edge**. The checked bound is `metric area <= sqrt(3)/4`. The default requested angle is 25° in metric space. Acute contour angles may prevent satisfying that angle bound; actual values are reported. Euclidean angles can be smaller in anisotropic mode.

## Pipeline

1. Validate a simple positively oriented outer contour and unique names; also validate clockwise holes and disjoint internal lines when present.
2. Sample boundaries by metric length and insert them as constraints.
3. Refine Delaunay with Steiner points, an area bound and target angle. Boundary edges may subdivide.
4. Check actual areas. If needed, add centers of oversized faces and repeat, for at most eight passes within a global vertex budget.
5. Remove exterior faces, reconstruct ordered boundary chains and compile masses, elements and seams from UVs.

Exhausting the budget produces an explicit error, never a silently incomplete mesh. Fitting caches carry a template/UV/triangle signature: a mesh change invalidates saved positions.

With `holes`/`lines`, a temporary frame two metric units away separates the convex hull from cloth constraints, avoiding near-zero angles from rounding. After refinement, faces outside material and frame vertices are removed. An internal line retains cloth on both sides and produces a named chain usable by sewing. Refinement may waste work in empty regions and exhaust the budget; it fails explicitly. Historical inputs without holes/lines retain the previous path. See [drafting-tools.md](drafting-tools.md) and `tests/drafting_tools.rs`.

Legacy `subdivisions` remains accepted (0..4). Without explicit settings, it now maps to `h = 0.1 / 2^subdivisions` m. New examples store `meshing` explicitly. The template remains v2; rectangular v1 is unchanged.

## Verification

`tests/meshing.rs` checks boundary constraints, the local Delaunay property on internal edges, metric area/angles, reproducibility, mass and seam-length conservation under refinement, and budget failures. Anisotropic cases include an axis rotated by 37°.

Commands and captures: [first fitting](first-fit.md). Density reduces geometric contact error but does not replace continuous collision or face contacts.

## Sources consulted

- [Spade constrained triangulation and refinement](https://docs.rs/spade/2.15.1/spade/struct.ConstrainedDelaunayTriangulation.html): API used, Steiner insertion and quality limits.
- [Refinement parameters](https://docs.rs/spade/2.15.1/spade/struct.RefinementParameters.html): area, angle, budget and exterior-face exclusion.
- [Spade repository and license](https://github.com/Stoeoef/spade/blob/master/Cargo.toml): MIT OR Apache-2.0. This backend is a declared dependency, not a claimed reimplementation.

## Optional static fabric sizing

On the independent mesh-resolution branch, `physics_sizing` is an optional,
omitted-when-absent meshing setting. **Simulation > Physics-inspired mesh
preparation** builds it once and resets the scene. The controls are always
visible and default to all polygon pieces when none is selected. It is not
evaluated by solver steps. Reset recompiles the same plan; no on-the-fly
remeshing is supported.
The existing compiler still derives all rest quantities from 2D material metres.
See [one-time preparation, demo and limits](pie-resolution.md) for explicit Pa
inputs, boundary-band semantics, angle/area checks and CPU acceptance evidence.

The default sphere/hanging reference editor exposes the same mesher through
**Simulation > Physics-inspired mesh preparation > Remesh and reset**.
Project v1 accepts an optional `physics_sizing` plan, omitted when absent.
Its rectangle compiles through `PolygonPattern::build`, then receives the
original scene placement and hanging corner pins. Clearing the plan restores
the historical structured grid. The solver never changes topology while stepping.
