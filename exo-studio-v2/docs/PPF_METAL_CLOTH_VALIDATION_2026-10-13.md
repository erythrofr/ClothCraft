# PPF Contact Solver: first verified Metal cloth solve

Test performed October 13, 2026 on the connected Mac, using `PPF_FRAMES=10 npm run check:ppf-metal` in Garment Studio.

## Verified outcome

- Solver: local ZOZO/ST-Tech PPF Contact Solver, macOS arm64, `mac_native` Metal GPU backend.
- Blender 5.1.2 add-on connected to local PPF service, built the shell solver, ran nine frame advances and fetched ten frames of point-cache data.
- T-shirt: 500 vertices, 768 faces, 98 loose stitch edges, 14 pattern sewing relationships.
- Mesh preparation: zero non-adjacent self intersections before the solve.
- First frame sewing gap remains large: mean initial loose stitch distance **0.4246 m** and maximum **0.5405 m**. This is a preparation/fitting problem, not evidence of satisfactory sewn fit.
- Output: finite PC2, 500 vertices, 10 samples, 0.150 m mean and 0.279 m maximum vertex displacement over cache.
- Wall-clock solve/test segment: **44 seconds**. NOT real time.
- Artifacts: `blender_bridge/output/tee-ppf-metal-solved.blend`, `blender_bridge/output/tee-ppf-metal-report.json`, and generated point-cache under `blender_bridge/output/data/`.

## Checks

`npm run check:ppf-payload` PASS: tee, hoodie, zip hoodie and pants serialize; `npm run check:ppf-bridge` PASS: Blender shell plus metadata; `npm run check:ppf-staging` PASS: no initial shell intersections; `PPF_FRAMES=10 npm run check:ppf-metal` PASS with finite output.

## Complementary source libraries

- PPF Contact Solver: https://github.com/st-tech/ppf-contact-solver (Apache-2.0). Treat as isolated offline high-fidelity FEM/contact backend, NOT low-latency editor physics. The upstream authors caution that Metal/CPU can be slow, and the solver is not production-ready.
- PositionBasedDynamics: https://github.com/InteractiveComputerGraphics/PositionBasedDynamics (MIT). Maintain XPBD for low-latency edits; evaluate bend, collision and constraint details against existing browser/native implementation.
- IPC Toolkit: https://github.com/ipc-sim/ipc-toolkit (MIT). Candidate for reusable exact collision queries and barrier-contact regression checking, not a drop-in cloth engine.
- libigl: https://github.com/libigl/libigl (MPL-2.0 core, third-party/copyleft subdirectory caveats). Candidate for mesh quality/triangulation, normals and topology checks, subject to individual modules' licenses.

## Remaining engineering work

1. **Validate fit and contact**, not just finite output: after each solve compute average seam gaps, max strain by region, shell/body intersections, self contacts and cloth-to-avatar signed distances.
2. Reduce initial sewing gap: map seam pair indices to closer but nonintersecting staged geometry. Preserve correct seam orientation, ring and cap topology.
3. Calibrate fabric by physical bending, stretch, density and friction rather than visual presets; collect real textile measurements.
4. Do not publish or ship the downloaded standalone solver until the bundled `THIRD_PARTY_LICENSES.txt` transitive dependency audit is complete.
5. Keep PPF behind the existing asynchronous service, isolate every job, enforce startup disk space and solver concurrency guards, and return explicit errors to UI. Reserve XPBD for live interaction.

The PPF bridge in this workspace predates this validation. This test establishes successful full Mac Metal execution, not completion of all visual or mechanical fidelity requirements.
