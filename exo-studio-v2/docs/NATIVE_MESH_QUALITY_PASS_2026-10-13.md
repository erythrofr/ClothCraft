# Native cloth mesh conditioning & XPBD solver · next pass

**Status:** Implemented and verified as a numerical safety/diagnostic pass, **NOT** a successful garment fit. Source: `native_backend/src/garment_xpbd_cli.cpp`, `src/core/physics/qualityTriangulation.js`, `src/core/backends/nativePayload.js`.

## Measured root-cause candidate

The original unfiltered tee quality solver diverged at frame 0 / substep 0 / iteration 2 on strain element 704 in the right sleeve. The rest element is roughly 4.20 cm long and 0.129 cm high (aspect 32.5). The front and back initially contain even thinner elements (worst aspect 151 and 263 respectively). The unfiltered native solver made corrections on the order of 10^65 meters before generating nonfinite results.

Correction-limiting trials at 2–20 mm kept the result numerically finite but required thousands of projection clamps and produced physically unsatisfactory constraints. **No production correction clamp was activated.**

## Native strain-element quality filter

Native strain-triangle quality mode now rejects elements with rest aspect over **25:1** or shortest altitude below **2 mm**. These boundaries are engineering heuristic safeguards, not a validated optimal meshing threshold. Critically, distance-edge constraints on the rejected elements remain active, so filtered elements are not simply disconnected. Users may override the filter for research via `nativeStrainMeshMaxAspect` and `nativeStrainMeshMinAltitudeM`; the validator will still reject nonfinite returned geometry before applying it.

After this pass, `node scripts/check-native-quality.mjs` completes nine profile/garment checks, and `node scripts/check-native-service.mjs` completes both a 12-frame quality job and 8-frame incremental step. All three garments complete a 60-frame native quality solve with finite positions.

| Quality profile, 60 frames | Accepted strain triangles | Filtered triangles | Worst sewn gap | True full-mesh peak edge strain | Fit accepted? |
| --- | ---: | ---: | ---: | ---: | --- |
| Tee | 576 | 192 | 21.8 mm | 339.4% | **No** |
| Hoodie | 1032 | 136 | 31.1 mm | 218.1% | **No** |
| Zip hoodie | 968 | 104 | 25.9 mm | 214.4% | **No** |

The native solver now computes **full-mesh structural strain across every unique rest edge**, because the previous `structuralStrainMax` only measured active distance constraints and omitted edges handled by strain triangles. The backend translates the full-mesh measurement and sewn seam gap into the shared `assessSimulationFit` result, which remains `FAILED` or `UNVERIFIED` until contact/strain are actually acceptable. A finite solver does not imply an acceptable drape.

### Frame-by-frame physical diagnostics (added in this pass)

Quality-mode native results now include `fitTrajectory.frames`: one entry per simulated frame with full-mesh peak/mean strain, maximum/mean seam gaps, and numerical finiteness. This is **not** per-frame triangle CCD. The fit assessment uses the worst measurement from the whole captured sequence, not merely the final frame, preventing a late settled-looking pose from hiding an initial catastrophic strain.

| Quality profile | Frame 1 peak strain | Worst strain during 60 frames | Worst sewn gap during 60 frames | All-frame fit gate |
| --- | ---: | ---: | ---: | --- |
| Tee | 1,374.2% | **1,516.2%** | 24.8 mm | **FAIL** |
| Hoodie | 297.7% | **564.6%** | 33.7 mm | **FAIL** |
| Zip hoodie | 343.6% | **475.9%** | 37.6 mm | **FAIL** |

These results identify the first frame as already physically extreme, making initial panel staging, sleeve-to-torso assembly, sewing/tack projection and native constraint coupling the next critical debugging subjects. No additional iteration count or contact margin can be assumed to correct these measured errors. `scripts/check-native-quality.mjs` now requires a complete 60-frame finite trajectory for each quality-profile garment and reports explicit `FAILED` fit statuses.

## Conservative interior edge-flip optimizer

`src/core/physics/qualityTriangulation.js` implements deterministic interior edge flips for valid convex quads, retaining every boundary edge, vertex position and total cut area. `node scripts/check-quality-triangulation.mjs` checks boundaries, cut area and determinism. It reduced the observed *initial* worst aspect ratios from front 151.1 → 49.4, back 263.0 → 49.4, sleeves 32.5 → 7.7.

However, applying it automatically to native quality simulation increased the tee and hoodie maximum strain compared with the safer filtered original topology (hoodie ~743% vs ~218% using the unoptimized filtered mesh). The optimization was therefore **rejected as the default** and left opt-in only via `project.simulation.experimentalNativeMeshOptimization`. It is not a completed constrained mesh generator.

## Remaining priority

1. Build a **true boundary-constrained adaptive triangulator** with reliable interior Steiner vertices and minimum-angle/min-altitude targets. Preserve the original garment's cut and sewing edge mapping and compute correct vertex UVs, grain and mass.
2. Verify its mesh quality **and** solver outcome, not merely nicer aspect ratios. Compare full-mesh strain distribution, sewing gap tails, collision signed distance, all-frame self/body triangle crossings, and pose realism.
3. Correct native strain/isometric interactions at the shoulders and sew tacks after the rest-mesh is verified. Never accept extreme full-mesh edge strain or 2–3 cm maximum seam gaps as a fit.
4. Keep the offline PPF route separate; no verified continuous body/cloth CCD or full-trajectory fit pass is established.

**Files not altered:** saved user garments, private Thomas avatar and factory production exports.
