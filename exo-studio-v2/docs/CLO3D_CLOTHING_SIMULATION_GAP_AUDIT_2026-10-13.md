# Garment Studio vs CLO3D — clothing and simulation engineering audit

Date: October 13, 2026. Scope: actual local code, test fixtures and recorded solver results; CLO3D comparison is a functional target, **not** a measured CLO3D parity test. This audit does not modify garment patterns or solver behavior.

## Executive conclusion

The dominant failure is not gravity alone. A split physics architecture (interactive PBD/native XPBD analytic-body proxies versus offline PPF real Thomas mesh), body/shoulder collision corrections that conflict with seam forces, and particle-only contact without robust triangle CCD allow a T-shirt to look sewn while floating, stretching, or crossing the avatar. **No currently measured run qualifies as an accepted production fit.**

## Measured failures and evidence

- Interactive T-shirt 120 frames, 180 cm avatar: peak structural strain 5.46016 (546.0% relative extension), average 0.10874 (10.87%), mean seam endpoint gap 1.12645 cm. Source: `scripts/check-tall-tee-shoulder-contact.mjs` and `/tmp/gs-contact-combined.log` on connected Blender Mac. This is an engineering fixture, not a CLO3D measurement.
- Same fixture, 200 cm: peak 1.39301 (139.3%), average 7.18%, mean seam gap 0.83500 cm. Improvement in one avatar range has not generalized.
- Offline PPF Thomas mesh with collision-safe initial staging: 10 frames, 500 vertices, 768 triangles, 14 source seam groups. Final seam gap about 1.8 mm, but 177 body intersections and 56 self-intersections in final frame. `blender_bridge/output/tee-thomas-body-safe-dynamic.json` independently reports max 183 body pairs and 67 self pairs across frames, first crossing frame 3. These are intersection *pair counts*, not penetration depth or unique triangles.
- A static 0-intersection initial arrangement is therefore not evidence of a valid dynamic result.
- Previous PPF long-sewing stress tests timed out under heavy contact; see `docs/PPF_PHYSICAL_SEWING_IMPLEMENTATION_2026-10-13.md`.

## Full gap inventory

| Priority | Capability | CLO-like expected behavior | Observed Garment Studio limitation | Evidence / location | Engineering acceptance gate |
|---|---|---|---|---|---|
| P0 | True posed body collision | Cloth contacts same posed surface shown in 3D | Browser PBD analytic ellipsoids/capsules; PPF optionally loads actual Thomas | `src/core/physics.js:collideAvatar`, `src/core/backends/ppfPayload.js` | Same skinned triangle geometry used for collision/render; no body crossings over all frames |
| P0 | Shoulder and neckline | Collar drapes around clavicles and rests under gravity | Body proxy overlaps, seam and contact corrections conflict; floating collar | `collideAvatar`, `stabilizeSeamPairs`, fit anchors | Shoulder/neck gap profile vs reference; no excessive upward motion |
| P0 | Bounded strain | Knit stretches within physically measured behavior | 546% local extension at 180 cm, 139% at 200 cm | `scripts/check-tall-tee-shoulder-contact.mjs` | Per-material max/p95 strain calibrated to fabric measurements; no pathological spikes |
| P0 | Body contact CCD | No triangles pass through body between steps | PBD vertex projection; optional centroid assist is not triangle CCD | `stepSimulation`, `resolveBodyFaceCollisions` | All-frame triangle-pair and swept CCD pass |
| P0 | Self-contact CCD | Cloth folds, edges and layers do not interpenetrate | Spatial-hash particle separation only | `resolveSelfCollisions` | Swept vertex-face/edge-edge CCD; zero unsafe intersections |
| P0 | Seam/contact coupling | Sewn edges close without moving cloth through body | Sequential correction and re-projection can reopen gaps and stretch neighbors | `stabilizeSeamPairs`, `stepSimulation` | Mean/p95/max seam residual and contact pass simultaneously |
| P0 | Reliable high-fidelity PPF | Final output only if solver respects body/self and strain | Metal solver completes but real Thomas dynamic contact fails | `blender_bridge/output/tee-thomas-body-safe-dynamic.json` | Reject all failed frames; measure strain, closure and clearance; no silent promotion |
| P1 | True flat-to-sewn physical progression | Simulated particles start in user-arranged flat 3D pose, then sew and drape | Interactive solver starts body-wrapped; PPF uses translated staging | `buildSimulation`, `applyPpfStagingPose` | Full trajectory starts flat, closes seams without tunneling |
| P1 | 2D pattern topology fidelity | Curves, darts, notches, seam allowance and edge lengths survive remesh | Basic triangulation/subdivision, not metric target-edge-length adaptive remesh | `triangulate`, `boundaryIndicesForSeamEndpoint` | Physical edge-length histogram, no inverted/sliver elements, stable IDs |
| P1 | Material constitutive behavior | Measured warp/weft, shear, bending, friction, thickness | Directional stiffness heuristic; uncalibrated fabric presets | `structuralDirectionStiffness`, `ppfFabricMaterial` | Reproduce strip, bias, bending and drape tests within measured tolerances |
| P1 | Physically invariant time steps | Similar results with different dt/mesh resolutions | Iterative PBD distance stiffness changes with substeps and resolution | `satisfyDistance`, `stepSimulation` | dt/substep/resolution convergence report |
| P1 | Garment rest state | Stable shirt naturally settles; no sustained hovering | Anchors and overlapping contact volumes can prop fabric up | `satisfyAnchor`, `collideAvatar` | Settled kinetic energy, gravity and shoulder contact measured |
| P1 | Pattern-fit optimizer | Suggest reversible source-pattern changes based on fit error | Auto-placement and PPF job triggering, no validated closed-loop pattern optimization | `src/App.jsx`, `tune_ppf_staging.py` | Reversible pattern edit, quality improvement validated across sizes |
| P1 | Avatar scaling/pose | Body shape/pose controls remain anatomically coherent | Height proxy and analytic arm landmarks; not verified against rigged Thomas poses | `getAvatarUpperBodyDimensions`, `getAvatarArmPose` | 150–200 cm and multiple arm poses without regressions |
| P1 | Interactive drag while simulating | Grab selected panel, drag and release without explosions | Interaction exists, but body/cloth contact under manipulation unvalidated | `src/components/GarmentViewport.jsx` | Stress test drag, pause/resume, and settle without penetration |
| P1 | Layered garment contact | Lining, pocket, interfacing and hardware do not invert/cross | Particle separation and heuristic outward layers; limited tests | `resolveSelfCollisions`, `stabilizeFuseLayers` | Layer-order and multi-contact penetration tests |
| P1 | Stable native XPBD | Long-running finite, converged hoodie/jeans simulations | Historical long-run divergence and short-run fallback in docs | `native_backend`, `docs/GARMENT_SIMULATION_NEXT_GEN.md` | 10,000-step finite and bounded-energy stress tests |
| P2 | Contact diagnostics | Quantified penetration depth and contact heatmaps | Approximate pressure/contact ratio; offline pair counts | `updateFitMetrics`, `check_ppf_dynamic_contact.py` | Depth in mm, p95, triangle IDs and body regions |
| P2 | Silhouette comparison | Same fabric/pattern/avatar compared side-by-side to CLO | No controlled numeric CLO capture | `docs/GARMENT_SIMULATION_NEXT_GEN.md` | Silhouette IoU, Chamfer, hem/collar/shoulder gap distributions |
| P2 | Performance | Interactive draft and slower verified quality bake | Separate PBD, native XPBD and Metal PPF pipelines; costly high fidelity | `src/core/backends`, `ppf_backend` | FPS and wall-time gates on specified hardware |
| P2 | Provenance/replay | Repeatable solver versions and captured fit states | Several separate solvers and no unified canonical baked timeline | Backend payloads and caches | Deterministic replay, per-frame quality audit, undoable fit |

## Recommended implementation milestones (strict order)

1. **Truthful measurements first:** extend QA to capture per-frame regional strain (collar, armhole, sleeve, torso), seam p95/max, min/max clearance, self/body triangle intersections, kinetic settling and solver performance. Fail quality gates independently of finite-number tests. Test 160, 180, 200 cm.
2. **One authoritative avatar collision representation:** local Thomas evaluated skin, BVH closest triangle and robust normals, correct pose transforms; validate against rendered avatar. Do not assume a visible GLB automatically serves as collider.
3. **Coupled contact + seam step:** integrate contact and stitch convergence with bounded updates, adaptive substeps and CCD; no sequential hard projection that reopens sewn edges.
4. **Sew-from-flat pipeline:** arc-length seam correspondences, staged sewing and gravity, no teleportation into wrapped positions; track provenance to 2D edges.
5. **Physical material and mesh calibration:** metric adaptive triangulation, stable anisotropic XPBD compliance and measured fabric tests. Preserve topology and source pattern.
6. **Closed-loop Auto Fit:** rank candidate placements and pattern edits using the *same* collision/strain/seam gates; apply only accepted solutions, offer undoable proposed pattern modifications.
7. **Controlled CLO3D benchmark:** use identical avatar, pose, pattern, cloth, frame/time and view; compare shape and measured metrics. Obtain screenshots/exports from actual CLO rather than claiming 1:1 equivalence from intuition.

## Non-negotiable acceptance

- **Not sufficient:** simulation completes, no NaNs, seams visually touch, 0 initial intersections, or screenshot looks plausible.
- **Required:** finite over long runs, seam closure within specified mm tolerance, all-frame body/self contact pass, physically calibrated strain, stable settled garment, faithful pattern geometry, reproducible multi-avatar/pose results.
- The current code's 250% peak strain regression guard for some avatar tests is a *regression detector*, not a textile acceptance criterion.

## Files inspected

`src/core/physics.js`, `src/core/backends/browserPbdBackend.js`, `src/core/backends/nativeServiceBackend.js`, `src/core/backends/ppfPayload.js`, `ppf_backend/server.mjs`, `docs/GARMENT_SIMULATION_NEXT_GEN.md`, `docs/PPF_METAL_CLOTH_VALIDATION_2026-10-13.md`, `docs/PPF_PHYSICAL_SEWING_IMPLEMENTATION_2026-10-13.md`, `scripts/check-avatar.mjs`, `scripts/check-tall-tee-shoulder-contact.mjs`, `blender_bridge/output/tee-thomas-body-safe-dynamic.json`.
