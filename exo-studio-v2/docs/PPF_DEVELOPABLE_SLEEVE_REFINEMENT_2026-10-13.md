# PPF sleeve cone and armhole alignment — October 13, 2026

## What was implemented

- `blender_bridge/refine_ppf_sleeves.py` splits sleeve triangles along shared edge midpoints **before** 3D bending, preserving all original sewing vertex IDs and pairings. The production mode subdivides sleeves once and does not subdivide the torso until there is a collision-safe torso wrapping strategy.
- `blender_bridge/nonrigid_ppf_assembly.py` measures each sleeve's matching underarm endpoints and uses a developable **conical frustum** instead of an arbitrary tapered cylinder. A small angular sewline opening avoids coincident unfinished mesh boundaries. The rest geometry is verified through **every triangle edge** after deformation.
- Independently optimizes each sleeve's rigid rotation and translation against actual 98-pair sewing correspondences, requiring zero intersections against evaluated CLO Thomas and the full garment shell after every accepted move.
- `ppf_backend/server.mjs` runs this assembly pass for supported four-piece tees, validates the generated PPF payload, exposes the assembly report and rejects unfinished arrangements instead of treating them as completed fits. For other garments, the original staging route is retained.

## Geometry

Let `z0` be the center of the underarm endpoints, and let sleeve half-width `w(y)` vary approximately linearly with original pattern length coordinate `y`. Define `k = dw/dy`, `y_apex = y0 - w(y0)/k`, polar coordinates `rho = hypot(y-y_apex, z-z0)`, `alpha = atan2(z-z0, y-y_apex)`, and cone opening `q = atan(k)/(pi-epsilon)`. The 3D conical surface uses `R = q*rho`, `phi = alpha/q`, radial coordinates `R*cos(phi), R*sin(phi)`, and axial coordinate `sqrt(1-q²)*rho` with rigid placement around the arm. This is the planar sector to cone isometry in the continuous limit. A one-level edge-midpoint subdivision is necessary because coarse triangle chords otherwise show artificially large compression.

## Current Foundation Tee test (actual current 2D template, CLO Thomas)

| Metric | Staged | Refined/rigid-aligned |
|---|---:|---:|
| Cloth vertices / faces | 500 / 768 | 976 / 1,632 |
| Physical stitch pairs | 98 | 98 |
| Mean initial seam gap | 33.461 cm | 15.973 cm |
| Underarm maximum gap (each sleeve) | 34.5 cm | 0.901 cm |
| Largest remaining seam | — | 32.0 cm |
| Maximum intrinsic triangle-edge change | — | 2.430% (5% limit) |
| Initial body/self BVH intersections | 0 / 0 | 0 / 0 |

The complete refined payload passes the JavaScript PPF validator, Blender's native scene preparation, and a second Blender frame-zero body/self-contact check. Run `npm run check:ppf-nonrigid` after regenerating the corresponding local test artifacts. The current template and private Thomas GLB remain local to the user's workstation.

## Still not certified

The torso front/back **side and shoulder seams** still begin far apart (largest initial seam ~32 cm); the refined pose does not pass `evaluatePpfAssembly` and is not published as a valid full-body fitting result. A torso wrapping transform at radii 20–24 cm penetrates Thomas's upper back. Simply increasing the radius leaves the shoulders farther apart, so the remaining task requires shoulder drape/roll and contact-aware torso assembly, not stronger stitch springs.

Native PPF compatibility: the full 1,764-vertex / 3,072-face first prototype imported and passed frame-zero contact, but a 10-frame CPU run timed out on frame 1 after 180 seconds. A follow-up Metal GPU build with the reduced 976-vertex / 1,632-face configuration reported `solver: FAILED` without details. Neither run has generated an all-frame validated garment. The associated test-specific processes were stopped, without touching other active PPF listeners.
