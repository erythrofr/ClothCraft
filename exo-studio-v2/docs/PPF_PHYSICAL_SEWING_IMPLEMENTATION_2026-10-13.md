# PPF physical sewing integration · October 13, 2026

## Implemented

The **Sewing** workspace now provides a second, offline high-fidelity physical sewing action using ZOZO/ST-Tech PPF Contact Solver on Apple Silicon Metal. The interactive XPBD sewing action remains in place.

The actual solver pipeline is:

1. Garment Studio's canonical 2D pattern seam graph (14 Foundation Tee seam relationships).
2. `src/core/backends/nativePayload.js` creates real seam pairs between fabric particles.
3. `src/core/backends/ppfPayload.js` exports the 98 unique pairs as **pure loose Blender edges**, which PPF's Shell-group encoder treats as stitch springs, not normal mesh edges.
4. `ppf_backend/server.mjs` runs an isolated PPF job with zero-initial-self-intersection staging, a Blender Shell group, an avatar Static group, configured material `stitch_stiffness` and Apple's Metal GPU backend.
5. PPF simulates the cloth and applies sewing constraints. Its fetched PC2 animation is copied into persistent `blender_bridge/output/data/<job>-solved/` and relinked to the permanently saved `.blend`.
6. `scripts/analyze-ppf-sewing.mjs` measures **actual physical seam endpoint distances** in every simulated frame, grouped by the original garment seam name. The job service returns closure %, worst seams, output paths and detailed per-seam JSON.
7. The Sewing inspector polls job status and shows sewing progress and the final measured closure. The saved Blender scene remains a distinct final-quality result; it is not imported into the interactive WebGL cloth mesh yet.

## Reproducible test results

- `npm run check:ppf-payload`: PASS, confirms every T-shirt seam is represented and stitch stiffness serializes correctly. Hoodie, zip hoodie, and pants PPF payloads pass basic topology checks too.
- `npm run check:ppf-bridge`: PASS, preserves shell and stitching metadata in Blender.
- `npm run check:ppf-staging`: PASS, no nonadjacent self intersections in pre-sew staging.
- `PPF_FRAMES=10 PPF_RUN_TIMEOUT=120 npm run check:ppf-metal`: PASS, 500 finite vertices, 10 PC2 samples, 98 stitch constraints.
- `node scripts/qa-ppf-sewing-ui.mjs`: PASS, PPF Sewing panel and editable sewing settings.
- `node scripts/qa-ppf-sewing-job.mjs`: PASS, complete UI → local service → Blender → PPF Metal → cache → measured seam closure, job `ppf-mv6awc68`.

### Final user-facing sewing test

| Quantity | Result |
|---|---:|
| PPF physical stitch pairs | 98 |
| Named seam groups | 14 |
| Shell vertices / faces | 500 / 768 |
| Frames cached | 10 |
| Initial mean stitch gap | 42.462 cm |
| Final mean stitch gap | ~12.93 cm |
| Closure improvement | 69.56% |
| End-to-end UI test time | 46.9 seconds |
| Persisted PC2 | Verified on disk and referenced by reloaded Blender project |
| Local solver service | Ready after job; no orphan solver process |

Permanent files:

- `blender_bridge/output/ppf-mv6awc68-solved.blend`
- `blender_bridge/output/ppf-mv6awc68-report.json`
- `blender_bridge/output/ppf-mv6awc68-sewing-report.json`
- `blender_bridge/output/data/ppf-mv6awc68-solved/*.pc2`
- `qa-ppf-sewing-ui-20261013.png`
- `qa-ppf-sewing-end-to-end-20261013.png`

### Failed stress tests (valuable limitations)

- PPF stitch stiffness 10, 15 frames: **timeout at frame 11** (360 s run timeout). More force is not automatically better.
- Default stiffness 1, 20 frames: **timeout at frame 13** (180 s run timeout) due to extreme contact work as garment approaches shoulder/arm regions.
- These do **not** invalidate the 10-frame sewn animation; they show that a fully closed, wearable shirt is still an engineering problem.
- The initial 42 cm sewing gap is extremely large, especially for the right sleeve-armhole stitches. The server's zero-self-intersection pose is not yet a realistic garment-sewing arrangement.
- Seam gaps are Euclidean distances between paired shell vertices. A smaller gap does not by itself certify collision-free output over every frame or a manufacturing-quality seam.

## Sewing resources identified in PPF source

- `examples/fitting.ipynb`: `app.asset.add.stitch(...)`, `dress.stitch(...)` for an actual stitched dress worn on a body.
- Installed Blender extension `debug/scenarios/bl_stitch_merge.py`: two independent SHELL meshes connected using **cross-object barycentric stitches**, a source/target merge-pair graph, soft stitch forces, and **post-snap exact seam closure** on Fetch.
- Installed extension `debug/scenarios/bl_shell_static_stitch.py`, `bl_static_stitch.py`, `bl_solid_solid_stitch.py`: more constraint/configuration regression paths.
- Internal PPF kernel `crates/ppf-cts-solver/src/kernels/energy/model/stitch.kernel.cpp`: continuous contact-aware stitch spring gradient and Hessian, including barycentric endpoints.

The current Garment Studio implementation uses **loose-edge stitching within one Shell mesh**. The cross-object merge-pair route is **researched, but not yet integrated**, and its exact seam snapping is a post-processing step rather than proof that physical closure is achieved throughout the simulation.

## Next milestones

1. Stage sleeve-cap seams nearer the avatar's armholes, with a verified collision-free swept trajectory; avoid forcing separated panels straight through the torso.
2. Test PPF's separate SHELL + barycentric cross-object stitching route on a miniature 2-panel fixture, then expand to four T-shirt panels if the test is stable.
3. Verify cloth/body contact and cloth/cloth penetration on **every frame**, alongside material strain and individual seam closure metrics.
4. Calibrate jersey cloth Young's modulus, Poisson ratio, bending, density and friction against real measurements rather than relying on visual presets.
5. Consider a controllable staged-to-dressed pre-solve using XPBD, followed by the high-fidelity PPF refinement backend; preserve exact seam IDs and do not falsely weld unsolved physical seams.
6. Investigate native `.blend` opening / PC2 playback from the Sewing UI, and optional import of solved mesh into the in-app 3D viewport, with clearly labeled backend provenance.

## Running the UI

The local service currently listens at `http://127.0.0.1:5192` and can be restarted with `npm run ppf:serve` from Garment Studio's project folder. The Mac app Sewing workspace contains a PPF section with editable stitch strength, frame count and a `RUN PHYSICAL SEWING · PPF METAL` action. Default to 10 frames on this Mac while the longer solve stall remains unresolved.
