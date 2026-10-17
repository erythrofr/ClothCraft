# Garment Studio · first-frame cloth assembly & contact audit

**Scope:** Native XPBD T-shirt, hoodie and zip hoodie; 2026-10-13. These tests use a real compiled native binary, not a purely illustrative model. **The complete physical fitting problem is not solved.**

## Reproduced pre-simulation geometry failure

`src/core/backends/nativeAssemblyPreflight.js` now checks native mesh rest-edge strain and sewn-pair separation **before any physics**. The native payload carries its diagnosis to the UI; the Native XPBD panel displays the worst seam and starting distortion rather than claiming the garment is fitted.

| Garment | Initial maximum sewn-pair gap | Initial maximum mesh edge strain | Worst initial seam |
| --- | ---: | ---: | --- |
| Foundation tee | 188.45 mm | 139.31% | `seam-shoulder-l` |
| Hoodie | 196.21 mm | 149.83% | `hood-center-6` |
| Zip hoodie | 252.61 mm | 104.21% | `rib-waistband-right-front` |

This means initial world-space arrangement is **already geometrically inconsistent with the flat sewing/rest mesh**. The initial `.garment` pattern data, cut edges and seam specification remain unchanged; the fault is in the 3D fitting pose/assembly and solver contact rules.

## Exact first-iteration trace on the tee

`npm run check:native-initial-assembly` runs native frame-1 diagnostics, verifies the preflight, and isolates contact and sewing from the same fixture. Strain below is **peak all-mesh edge strain**, not mean or the old filtered strain metric.

| First substep, iteration 0 phase | Peak strain | Worst sewn-pair gap |
| --- | ---: | ---: |
| Starting 3D arrangement | 139.3% | 188.5 mm |
| Strain triangle | 178.8% | 196.5 mm |
| Sewing + distance constraints | 836.5% | 14.8 mm |
| Isometric bending | 724.9% | 54.8 mm |
| Anchors / self-collision | 724.9% | 54.8 mm |
| Body particle projection | **1,578.0%** | **212.1 mm** |
| Seam midpoint recovery | 1,529.4% | 25.0 mm |

This identifies **two separate forced corrections**: early sewing closing gaps across disjoint panels, followed by analytic avatar contact projecting those distorted panels back against the body. Increasing gravity, iteration count, padding, or blindly adjusting sewing stiffness is not a principled fix.

The worst first-frame measured edge is on the front underarm/armscye region (`front:63` to `front:62`), with a flat rest length of ~10.4 mm but a frame-1 length of ~153.6 mm. It is highly elongated by solver projection rather than the clothing design explicitly containing that long segment.

## Controlled ablations, no false acceptance

Full 60-frame quality runs were compared in isolated native fixtures, without modifying user garments. Base tee: **1,516%** peak all-frame strain, 24.8 mm worst sewn gap; frame 1 strain 1,374%.

- Removing body contact lowers first-frame strain to ~136–180%, demonstrating the principal interaction; but removing contact cannot satisfy body fitting.
- Removing sewing constraints lowers first-frame peak to ~268% but leaves seams unassembled, which is unacceptable.
- Disabling or reducing seam midpoint recovery can produce 75–140 mm seam openings.
- Moving sleeves down 6–11 cm and/or laterally, or moving shoulder panel edges closer, can improve frame 1 but often worsens full-frame strain or seam closure, sometimes by more than 100 mm.
- Ramping contact and changing its projection weight sometimes decreases first-frame strain but worsens later sewn gaps and can leave under-corrected avatar penetration.
- Partitioning torso/shoulder/arm analytic colliders by pattern panel or choosing only the deepest primitive did not reliably improve all garment cases; some failures exceeded 3,000% strain or 100 mm seam gaps.
- Applying body contact or seam recovery only at the end of each constraint substep also regressed the full trajectory; a zip-hoodie experimental contact-scheduling variant was non-finite.
- Arc-style initial torso parameterization reduced some first-frame local distortion but degraded later fit in the tested configurations. It is **not yet validated enough to replace normal initialPosition**.

**Decision:** The current known-numerically-stable collision and sewing defaults were preserved. Research flags in the native binary default to the original behavior. No speculative warmup or weight was deployed automatically. A finite pose continues to display as an experimental diagnostic; the UI explicitly labels a failed physical fit **FIT FAILED** rather than "SOLVED." The native assembly warning names the worst initial seam and associated measurements.

## What's implemented

1. `nativeAssemblyPreflight.js`: deterministic, geometry-based initial pose/seam readiness report with per-group gaps, worst rest edge, and quantitative failure thresholds.
2. `nativePayload.js`/`nativeServiceBackend.js`: preserve the report across native payload and live session, with preflight info available through backend metrics and the one-shot solve response.
3. `garment_xpbd_cli.cpp`: opt-in `captureStartupStages` captures the initial sewing/contact/bend/anchor corrections by phase; `fitTrajectory` includes first-frame and all-frame worst edges.
4. `App.jsx`/`GarmentViewport.jsx`: visible native **FIT FAILED** status, first-pose assembly warning, all-frame peak strain/gap, no stale metrics while a subsequent solve runs.
5. `scripts/check-native-initial-assembly.mjs`: native end-to-end regression for the known starting-pose failure, compares sewing/contact ablations and asserts measurable failure rather than treating finite state as acceptable fit.
6. Native XPBD service was started at `127.0.0.1:5191` and the full browser UI button was tested with Playwright in `scripts/qa-native-fit-diagnostics.mjs`.

## Next real fix

A CLO-like automatic fitting system must **construct an initially stitched, spatially continuous 3D cloth assembly** from matched 2D seam edge samples, then nonrigidly conform each garment piece to the avatar while preserving rest lengths, orientation, panel thickness and collision constraints. A correct implementation should solve for front/back shoulder seams, sleeve cap orientation and armhole interfaces together, not translate pieces rigidly or relax one collision primitive independently. The initial placement needs a body-aligned, rest-metric-aware manifold parameterization, followed by a continuous collision-safe trajectory.

**Acceptance gate:** Maximum sewn gap below a calibrated mm threshold, realistic fabric-specific strain percentile and peak, no body-penetrating/nonadjacent intersecting cloth triangles over *all* frames (including substeps and swept geometry), and sample-fit approval. None of these garments currently passes that full gate.
