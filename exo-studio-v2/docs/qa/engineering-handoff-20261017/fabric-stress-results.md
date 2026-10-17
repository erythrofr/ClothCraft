# EXO V2 fabric stress QA — October 17, 2026

Run: `node scripts/qa-v2-handoff-fabric-stress-20261017.mjs` — **PASS** (single measured invocation).

The script generates **252** small analytic display meshes: **42 iterations each** for denim, poplin, jersey, satin, fleece and sheer. Each has 289 vertices and 512 indexed triangles. The workload is synthetic and deterministic, with regular inputs varied alongside GSM of `0`, `-1e10`, `1e12` and bend of `0`, `-1e10`, `1e12`. It verifies finite XYZ/UV values, UVs within `[0,1]`, topology, positive finite triangle area diagnostics, explicit `measuredMaterial: false` and procedural fixture provenance. Invalid, infinite, negative, zero and undersized texture repeat dimensions are covered with 12 cases. Six invalid procedural tile sizes fall back to known positive repeat counts.

The evidence schema check uses a **clearly fictional** placeholder sample and URL, asserting preservation of sample identity and evidence URI; it also rejects five corrupt variants (unsupported URI scheme, blank sample ID, nonfinite mass, negative mass and absent measurements). Ten provenance assertions passed. A positive synthetic schema fixture is **not evidence of a real laboratory measurement**.

## Captured result

| Check | Observation |
|---|---:|
| Analytic mesh builds | 252 / 252 |
| Input dimension cases | 12 / 12 |
| Provenance assertions | 10 / 10 |
| Total area ratio across specimens | 0.9738–1.3586 |
| Meshes with local triangle area outside 0.95–1.05 | 252 / 252 |
| Wall time, one local execution | 56.48 ms |
| Mean time per mesh including JS assertions and allocation | 0.224 ms |

Area warnings are **expected disclosures**, not simulation pass criteria: even when total ratios approach 1, local mesh triangles can expand or compress substantially. For example, iteration 0 of all six families had local triangle area ratios from 1.011 to 2.243. The geometry generates a display approximation of drape, without a physically area-preserving textile model. Clamping extreme input makes arrays finite but does **not** establish real-world accuracy for those parameters.

Performance measures one CPU-only Node.js test process at 16 × 16 grid resolution; values are environment-dependent and include assertions and allocations. There was no GPU rendering, GPU memory measurement, native app inspection, fabric solver, calibrated textile specimen, real scan input, or physically meaningful throughput target. No app or native sources were changed in this workstream.
