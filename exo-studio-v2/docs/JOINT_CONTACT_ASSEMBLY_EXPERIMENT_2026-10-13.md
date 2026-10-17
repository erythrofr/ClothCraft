# Joint seam/rest/contact initializer · experimental numerical study

Status: Implemented as an explicitly opt-in **internal code option**, not enabled in the user interface or native production pipeline. Date: 2026-10-13.

`src/core/backends/seamAssembly.js` now accepts `{jointConstraintMode:true,jointContactWeight}`. It collects corrections for the actual indexed sewing pairs, unique flat cloth rest edges, and analytic-avatar clearance from the *same starting positions* per iteration. The solver applies a Jacobi-style averaged update, rather than completing sewing first and immediately projecting that result out of the body. It runs on a deep copy of the native payload and preserves the original pattern, topology, sewing graph and anchor data. `scripts/check-joint-assembly-experiment.mjs` verifies repeatable deterministic results, preserved input topology, finite positions and rejection of invalid fits.

## Measured outcomes

All candidates used 300 iterations, seam coefficient 0.7, default rest coefficient 0.7. Metrics below describe the **pre-simulation 3D assembly**, NOT physically accepted draping. Intrusion is sampled against the current analytic avatar, not certified full-triangle CCD.

| Garment | Contact weight | Maximum sewn gap (mm) | Peak rest-edge strain (%) | Sampled avatar intrusion (mm) |
| --- | ---: | ---: | ---: | ---: |
| Tee (sew-first baseline) | — | 3.90 | 26.17 | 92.89 |
| Tee joint | 0.1 | 19.14 | 335.79 | 60.42 |
| Tee joint | 0.3 | 121.03 | 299.70 | 49.22 |
| Tee joint | 1.0 | 141.65 | 319.02 | 34.98 |
| Hoodie (sew-first baseline) | — | 4.82 | 45.85 | 89.51 |
| Hoodie joint | 0.1 | 3.85 | 85.29 | 73.65 |
| Hoodie joint | 0.3 | 67.68 | 134.77 | 55.03 |
| Hoodie joint | 1.0 | 30.43 | 330.71 | 58.60 |
| Zip hoodie (sew-first baseline) | — | 12.51 | 51.14 | 95.14 |
| Zip hoodie joint | 0.1 | 10.63 | 96.50 | 74.84 |
| Zip hoodie joint | 0.3 | 61.72 | 99.80 | 51.47 |
| Zip hoodie joint | 1.0 | 93.29 | 533.80 | 58.78 |

**Decision:** No tested candidate satisfies a realistic cloth strain, sewing or body-contact gate, so the joint mode is **not** enabled for native requests and no change was made to the user's installed app. The default sew-first opt-in and the standard native solver paths remain unchanged. This is a source-only research implementation, with a check command for repeatable comparisons.

Next engineering step should use a single consistent signed-distance representation from the actual Thomas body mesh with stable gradients, non-penetrating shoulder/sleeve manifold initialization, and robust contact/sewing constraints solved with line search or trust-region and all-frame swept triangle CCD. The current overlapping analytic-collider approximation and unconstrained Jacobi averaging do not guarantee this.

Regression run: `npm run check:joint-assembly-experiment`, `npm run check:sew-first-assembly`, `npm run check:simulation-architecture`, `node scripts/check-native-quality.mjs`, `npm run build` all passed. A successful regression run is not physical-fit approval.
