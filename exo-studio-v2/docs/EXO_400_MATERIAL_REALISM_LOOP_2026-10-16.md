# EXO 400 — material realism iteration 3

**Date:** 2026-10-16. **Scope:** actual local EXO project and material renderers, without repackaging the native app. The 400 material specifications are not 400 individually photographed or physically measured swatches.

## Implemented improvements

1. Kept **80 original constructions + 320 variants = exactly 400 stable IDs**, plus 405 native Rust choices including five historic reference specimens.
2. Each derived variant now changes **fiber anisotropy, yarn relief, sheen broadness and dye variation**, in addition to estimated weight, thickness, stretch, bending, friction, roughness and base color. The values are deliberately **design estimates**, not independently measured mechanics.
3. Replaced automatic enzyme softening of all fabric families with conservative **fabric-sensitive digital finish defaults**. Synthetic, silk, animal fibers and leather no longer inherit the same cotton/denim finish. The wash editor warns where a visual reference would not be an ordinary manufacturing choice. Tested **400 × 16 = 6,400** material/effect combinations; these are optical simulations, never a manufacturing recipe.
4. Preserved all **67 licensed CC0 photographed material sets and their 201 SHA-256-verified source maps**, with no additional bulky downloads. Assignments across the 400 currently use **44 distinct sources**, with 385 photo-backed preset appearances, 165 clearly marked visual proxies and 15 generated open-structure mesh/tulle appearances.
5. Added image-source heuristic quality flags in the EXO material inspector, to review unusually compressed normal-map vectors and low-contrast roughness maps under actual lighting. Also labels material repeat dimensions as unknown where they are only illustrative. Source scans remain unchanged.
6. Improved native ClothCraft's asynchronous photo-loader disposal behavior: a disposed swatch cannot be mutated by a late texture callback. Photo texture failure no longer incorrectly removes the original material dye tint.

## Audited per-preset status

| Metric | Confirmed |
|---|---:|
| Main catalog material specs | **400** |
| Native Rust catalog, legacy included | **405** |
| Downloaded independent CC0 appearance source sets | **67** |
| Verified color/normal/roughness maps | **201** |
| Unique photographed sets actually assigned | **44** |
| Presets referencing some photographed PBR | **385** |
| Related-construction optical proxies | **165** |
| Open mesh / tulle procedural fallbacks | **15** |
| Presets inheriting source-photo heuristic review flags | **135** |
| Presets with unknown physical scan-repeat dimensions | **105** |
| Independently measured and validated EXO physical materials | **0** |

An optical map Grade A is evidence of a licensed color, normal and roughness source triplet, not a scanned specimen matched to a specific EXO variant. A construction diagnostic Grade B means plausible numeric estimates under broad screening, not physical validation or certification.

The 135 source-image QA warnings reuse a small number of actual photo source anomalies. They are **not 135 independently defective assets**. Flat roughness or low-amplitude normal maps can be exactly right for a finish; verify under raking illumination before changing anything. Unknown repeat scale has an explicitly marked provisional rendering estimate, not a claim of physical measurement.

## Reproduction

In the project root, run the fabric source quality builder and checks:

    node scripts/build-fabric-source-review.mjs
    node scripts/check-fabric-source-review.mjs
    node scripts/check-fabric-wash-suitability.mjs
    node scripts/check-400-fabric-constructions.mjs
    npm run check:materials
    npm run check:fabric-scans
    npm run build

Detailed coverage: docs/reports/EXO_400_FABRICS_COVERAGE.csv and .json. Additional reports: docs/reports/EXO_400_CONSTRUCTION_DIAGNOSTICS.json, EXO_400_SCAN_IMAGE_METRICS.json and EXO_400_LICENSED_SCAN_REGISTRY.json. Visual preview: screenshots/EXO_400_FABRIC_CONTACT_SHEET.jpg. Prior WebGL checks: docs/EXO_400_OPTICAL_PASS_LIVE_QA.md and docs/EXO_400_FABRIC_UI_QA.md.

## Unresolved physical-realism requirements

To certify 400 physical textile specifications, procure and document traceable supplier specimens/lots, composition and true construction; photograph real fabric samples with controlled color calibration and rulers; measure repeat width, actual areal mass and compressed thickness; record warp/weft nonlinear force-extension curves, bending, shear, friction, recovery, and genuine dye/wash-dependent changes; fit solver curves and compare actual garment drape to the simulation. Licensed stock photographs and visual wash shaders cannot supply those measurements.

Prioritize 15 procedural open textiles and the 165 related-source proxies for independent capture. Until measured, keep physical evidence status as **estimated** or **imported-unverified**, not certified.
