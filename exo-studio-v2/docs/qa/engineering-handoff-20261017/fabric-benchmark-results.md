# EXO V2 six-material fabric benchmark — October 17, 2026

CPU-only source export acceptance, using `scripts/qa-v2-handoff-six-material-benchmark-20261017.mjs`. These are **synthetic procedural test fixtures** and a deterministic presentation mesh. No calibrated PBR scan, mechanical measurements, solved drape, GPU render, screen capture or native installation is involved. The names label representative families; they do not certify measured textile properties.

## Run and acceptance

`node scripts/qa-v2-handoff-six-material-benchmark-20261017.mjs` — **PASS**, six fixture families, each with **2,401 vertices** and **4,608 triangles** (48 × 48 grid, indexed two triangles per cell) over the current **270 cm author-defined square swatch**. For each fixture the test verifies finite XYZ and flat-rest UV coordinates, UV coordinates in [0,1], consistent vertex/UV counts and expected triangle counts, no zero/invalid triangle area reported, positive finite per-triangle and total deformed-to-rest area ratios, expected procedural family mapping, finite/bounded opacity and roughness, and positive finite scan/procedural texture repeat counts. It also asserts the source geometry marks material as unmeasured and the diagnostics as illustrative.

| Fixture | Mapped family | Total area ratio | Triangle area ratio min–max | Scan repeat X × Y | Opacity |
|---|---|---:|---:|---:|---:|
| Denim | twill | 1.1314 | 0.7575–2.9319 | 15 × 22.5 | 1 |
| Poplin | plain-weave | 1.0077 | 0.6079–2.9319 | 13.5 × 13.5 | 1 |
| Jersey | jersey-knit | 1.0327 | 0.6245–2.9319 | 22.5 × 27 | 1 |
| Satin | silk | 0.9904 | 0.5668–2.9319 | 33.75 × 18 | 1 |
| Wool/fleece | fleece-pile | 1.0871 | 0.7023–2.9319 | 13.5 × 13.5 | 1 |
| Sheer/chiffon | sheer-weave | 0.9825 | 0.5568–2.9319 | 45 × 30 | 0.45 |

For all six fixtures the generated 3 cm yarn tile yields 90 × 90 intended procedural repeats. The scan-repeat counts are calculated from fixture dimensions only: **no actual scan assets are loaded**. All fixture provenance is `procedural`, with `calibration: unmeasured illustrative analytic mesh`.

## Known missing signoffs

The area ratios reveal substantial local compression and extension, particularly at the peak triangle ratio of 2.9319; the mesh is not area-preserving and must not be treated as a mechanical validation. The benchmark does not establish triangle orientation consistency or collision clearance, physical fabric friction/bend/stretch, solver convergence, yarn count, actual opacity or optical color accuracy, texture seam appearance, native renderer parity, scan licensing, real cloth behavior, image-based reference comparison, performance budgets, or human review of six distinct rendered fabrics. Visual screenshots were intentionally omitted to keep this QA pass CPU-only. Only the new benchmark and this report were authored for this workstream.
