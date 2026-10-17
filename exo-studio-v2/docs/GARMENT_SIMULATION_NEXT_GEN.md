# Garment Studio — Next-generation cloth simulation research & engineering gates

*October 13, 2026 · Research and implementation specification, not a completed simulator.*

## Status and measured quality deficit

Current browser PBD and native C++ XPBD pathways simulate sewn garments using an analytic avatar collider and are **not yet CLO-grade**. The 3D pre-sew layout is a render-only flat-panel staging layer; the physical solver starts from a body-wrapped initialization rather than progressively assembling a physically flat garment. Thomas's CLO-exported GLB/OBJ is displayed, but cloth contact does not consistently use that exact surface. The cloth does not yet have a validated metric particle-distance remeshing kernel.

October 13 measurements (regression fixtures, no hand tuning):

| Fixture / command | Observed | Interpretation |
|---|---|---|
| `npm run check:physics` default T-shirt | mean seam residual **0.008098 m (8.1 mm)** at settled state | Visible sewn seams may still have gaps; not production quality. |
| `npm run check:physics` default T-shirt | peak structural strain **1.7599 (176%)** | Numerical stress and silhouette unacceptable on that local edge. |
| `npm run check:avatar` 160-cm variant | **now passes** after neck-anchor repair: peak local strain **178.1%** vs. previous **1346%** | Neck fitting tack was fighting avatar collision. Residual 178% is still not material-accurate. |
| `npm run check:avatar` 200-cm variant | **now passes** after neck-anchor repair: peak local strain **112%** vs. previous **677.7%** | Fix generalizes to both heights under test; not yet proof for other avatar poses. |
| `node scripts/check-partial-seams.mjs` | Pass | Partial-edge indexing functions structurally; does not prove robust cloth simulation. |
| Native XPBD build T-shirt | finite at 90 frames | Finite numbers are necessary but far from proof of correct fitting. |
| Native XPBD quality hoodie and zip-hoodie | long runs sometimes non-finite; build falls back to shorter finite previews | Divergence requires a proper numerical engineering fix, not frame-count hiding. |

These are software-fixture measurements, not external CLO comparison results. Do not advertise CLO parity or superiority without separately calibrated numerical and perceptual experiments.

## 1. Canonical garment + fabrication mesh

- Maintain an editable, versioned 2D CAD source graph with real Bezier/arcs, graded point rules, notches, seam allowances, fabric grain and sewing relations. Each source edge gets stable IDs and arc-length coordinates.
- Generate a simulation triangle mesh with a **true target edge length in millimeters** (e.g. draft 20 mm, production 5 mm, advanced selectively <5 mm). Keep discretization separate from renderer tessellation. Every remesh projects notches, sewn endpoints, pin constraints, trims and graded measurements back by barycentric or arc-length provenance.
- Constrained triangulation must avoid slivers and inverted elements; validate minimum angle and aspect ratio. Adaptive remeshing should refine folds/high-curvature/high-contact regions based on measured error rather than multiplying every polygon globally.
- Implement a configurable lower-detail interactive solver and a high-fidelity validation / bake mode, both driven by the same document and physically measured fabric properties. Changing resolution must not alter intended mechanical stiffness.

## 2. Real avatar and garment collisions

- Read Thomas's existing user-owned skinned GLB locally. Extract posed collision geometry with correct coordinate system, rig matrices, skinning weights, units and world transforms. Do not put copyrighted CLO avatar meshes in any public package.
- Build a two-level collision accelerator: static/pose-coherent BVH for mesh triangles, and a sparse narrow-band signed distance field as broadphase and cheap normal lookup. Include exact closest-triangle projection as narrowphase; handle nonwatertight sections (eyes, shoes, clothing) and separate material layers.
- Evaluate point-triangle and edge-edge contacts as cloth moves, not only after each step. Add continuous collision detection (CCD) or conservative advancement to prevent tunneling and self-intersections at larger time steps.
- Implement Coulomb-like static/dynamic friction and per-material contact thickness. Define collision layers for shell, lining, interfacing, zipper and hardware.
- Validate per-frame maximum body penetration (mm), fraction of cloth vertices in penetration, interpenetration triangle pairs, and physical clearance for every pose. Measure on both the 160-cm and 180-cm avatars to prevent height-scale regression.

## 3. Physically sew flat panels into garments

The current flat arrangement shows what the user wants visually, but physical trajectories do not start there. Correct algorithm:

1. Create rest-shape particles **in spatially flat 3D pre-sew arrangement**; initial velocities are zero and gravity may start disabled or at a controlled ramp.
2. Turn stitched edge definitions into oriented arc-length correspondences: preserve reversal/ease/gather/stretch ratios, sample exact physical seam pairs, and attach per-seam compliance and stitching mode.
3. Activate sew springs/constraints progressively in a controlled schedule (zipper-length progression or batch closure) with damped target separation, rather than teleporting panels onto the avatar.
4. Stabilize collision and self-collision against Thomas and neighboring panels during the closure phase. Constrain abrupt accelerations and use adaptive time steps when contact or strain exceeds thresholds.
5. Begin gravitational drape **only after stitch residuals and collision metrics converge**, while keeping all seam constraints active and allowing a partial sewn-state preview.
6. Save reproducible stitch progress as physical state snapshots, so paused, undone and replayed sewing use real particles, not just a visual blend.

## 4. Numerical algorithm options and trade-offs

| Method | Value | Constraint |
|---|---|---|
| XPBD with compliance and warm-started Lagrange multipliers | Fast interactive drafting and approximate materials. | Needs correct seam activation, conservative collision and calibrated anisotropic energy; mere extra iterations cannot repair inconsistent geometry. |
| Projective Dynamics / local-global elastic energy | Candidate for large scenes and GPU-preconditioned cloth solves. | Needs stable collision and strain-limiting coupling; not a drop-in fix. |
| Implicit shell FEM with anisotropic bending and stretch | More physically meaningful high-fidelity fabric validation. | Heavier CPU/GPU workload and mesh material calibration. |
| IPC/C-IPC barrier contact with CCD | Research-grade target for intersection-resistant collision, friction and stiff cloth behavior. | Computationally expensive; consider high-fidelity validation mode or contact-only inner solver, subject to licensed code review. |
| Hybrid CPU/GPU engine | CPU deterministic pipeline for document/contact logic, parallel GPU kernels for constraints and BVH. | Cross-platform Apple Metal vs Windows Direct3D/Vulkan vs Linux Vulkan paths must be tested independently. |

Relevant literature and source links: [XPBD, Macklin/Müller/Chentanez 2016](https://mmacklin.com/xpbd.pdf); [Incremental Potential Contact, Li et al. 2020](https://ipc-sim.github.io/); [Codimensional IPC, Li/Kaufman/Jiang](https://ipc-sim.github.io/C-IPC/). Do not incorporate academic source code without checking its exact implementation license and dependencies.

## 5. Fabric material model and measurement lab

- Store fabric GSM, thickness, anisotropic warp/weft stretch, shear modulus, bias response, bending stiffness by curvature direction, nonlinear yielding, anisotropic friction, shrinkage, humidity/wash state and optional hysteresis.
- Normalize the parameter names/units through a documented SI model instead of ad hoc sliders. Record provenance: ASTM/ISO drape, tensile, bending and Kawabata/FAST-style measured properties where available.
- Build simple controlled experiments (strip stretch under calibrated loads, cantilever bending, circular drape coefficient, falling square, two-layer sliding/friction) then invert model parameters to match measurements.
- Use error measures in metric units and retain a materials benchmark dataset with original digital fabric references.

## 6. Quality and performance acceptance gates

Proposed **engineering targets**, not claims reached:

- Every seam residual continuously measured; average under ~2 mm and p95 under ~4 mm on well-behaved garments at chosen resolution, subject to fabric design details.
- Zero non-finite particle positions across 10,000 time steps and the supplied hoodie/jeans stress fixtures. All timers and simulation jobs cancellable without corrupting project state.
- Collision: no persistent through-body intersections; median and p95 signed penetration ≤ explicitly calibrated contact tolerance, plus zero unsafe topology flips.
- Strain: compare actual material stress/stretch to per-fabric benchmarks, limit pathological local strain spikes; test avatar heights from 150–195 cm and multiple arm poses.
- Deterministic reproducibility of solver version and parameters on the same platform; document acceptable numerical tolerance for parallel/GPU variants.
- Interaction: at least 30–60 FPS with a drafting mesh on supported machines, and slower verified-quality mode with progress metrics for dense high-quality scenes. These are **performance goals**, not guaranteed FPS.
- User-perceived silhouette: render the same garment on the same posed avatar in Garment Studio, CLO3D and a measured physical garment; compute silhouette IoU, point-cloud Chamfer distance, body/hem gap distribution and blinded human rating. Compare using equivalent fabric measurements and pattern data, not arbitrary marketing screenshots.

## 7. Implementation staging and test names

1. **Safety gate (October 13 update):** `check:avatar` now passes with a stricter 250%-peak-strain regression guard after replacing the overstiff XYZ center-neck fit tack with a weak Y-only neckline support (stiffness 0.01). A 160-cm variant now peaks at 178.1% and 200-cm at 112%. These are regression wins, **not** acceptable calibrated fabric strains. Keep working on bounded-step divergence guards, self-contact and recording first failing frames.
2. **True avatar collider:** `check:thomas-collision` comparing precise Thomas mesh BVH against current analytic proxy, including finger/crotch/underarm clearances.
3. **Flat-sew solver:** `check:sew-from-flat` verifies continuous stitch-distance convergence from correct 3D pre-sew panel placements without teleportation.
4. **Physically calibrated mesh:** `check:particle-distance` verifies mm target edge-length distribution, aspect ratio and remesh constraint transfer.
5. **Self-contact/CCD:** `check:contact-intersection` + collision thickness/friction suite across garments, models and time steps.
6. **High-fidelity backend:** `check:cloth-fem` material curve fit; `check:ipc-collision` strict-contact validation, license permitting.
7. **Cross-platform delivery:** native Mac/Windows/Linux offline app GUI test, solver fixture provenance, source manifest, performance and physical comparison dashboard.

## Why a toolbar cannot solve simulation quality

The current UI can expose shrinkage, subdivisions and solver settings, but CLO-level capability requires measured physics and robust differential geometry. The correct next milestone is *not* 20 additional icon copies: it is repairing the failing 160-cm regression, integrating Thomas's actual mesh contact, and implementing seam closure starting from genuinely flat positions.
