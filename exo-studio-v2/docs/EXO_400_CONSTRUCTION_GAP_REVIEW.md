# EXO 400 Fabric Construction Gap Review

## Scope and interpretation

Run `node scripts/check-400-fabric-constructions.mjs` to inspect the canonical `FABRIC_PRESETS` catalog and regenerate `docs/reports/EXO_400_CONSTRUCTION_DIAGNOSTICS.json`. Every record includes its stable ID, assigned construction family, actual numeric preset parameters, matching optical asset information, ordered actionable warnings, and separate diagnostic and evidence grades. The script is a read-only catalog validator; the only write is its JSON report.

**Physical calibration remains zero confirmed.** Neither photographic PBR source material nor plausible estimated parameter values proves a tested textile's tensile, bending, shear, friction, thickness or spectral reflectance response. `stretchWarp` and `stretchWeft` are unitless visual/solver extension settings, not measured extension at a documented load. `bend` is a normalized control, not flexural rigidity in N·m. Roughness and sheen are render shader controls, not laboratory gloss values. Thickness is converted from metres to millimetres in the report; GSM is g/m².

## Family taxonomy and envelope philosophy

The family assignment is a deterministic precedence-based interpretation of stable ID, garment name, and surface-family metadata, covering mesh/open constructions, leather/suede, silk/sheer, looped terry, fleece/pile, denim/twill, coated/composite textiles, cotton/woven, knit/stretch, and miscellaneous textiles. These categories overlap in real materials: a stretchy leather composite, coated cotton, or elastane denim may occupy multiple categories. The chosen category is for triage, not material identity certification.

The code publishes intentionally broad screening ranges for GSM, apparent thickness, warp/weft extension and normalized bending/optics, including elastane and specialty layered constructions. Do not enforce a narrow universal tensile limit: loading protocol, yarn orientation, sample conditioning and coating can change a textile's mechanical response. Read all `OUTSIDE_FAMILY_ENVELOPE` findings as **reviews**, not hard failures. Positive finite masses and thicknesses, nonnegative directional extension and normalized shader settings are the hard numeric validity conditions.

Apparent bulk density (`GSM / thicknessMm`, in kg/m³) is a screening calculation, not fiber density. Mesh air voids, pile loft, laminate cavities and measurement pressure can change this ratio by orders of magnitude. Values outside the broad 25–3000 kg/m³ review interval require controlled-pressure thickness assessment, not automatic rejection. Large directional stretch ratios trigger a check of warp/weft orientation and force–extension curves, without rejecting anisotropic specialty textiles.

### Mesh cutout render validation

The diagnostic imports `describeTextileSurface` and `meshYarnCoverage` from the existing production generator to classify each mesh as `athletic-mesh`, `power-mesh`, `tulle-net`, or the fallback `mesh-grid`. It samples a 64 × 64 coverage grid and verifies both visually exposed holes and yarn regions, then recognizes the generated `alphaMap` / `alphaTest` rendering path as `OPEN_STRUCTURE_PROCEDURAL_CUTOUT` (informational). Fully opaque **yarn** settings are compatible with transparency between yarns. When a user opacity image overrides the generator, the report instead emits `OPEN_STRUCTURE_UPLOADED_OPACITY` and asks for visual inspection; a missing or constant procedural mask without an uploaded alpha map emits the review-level `OPEN_STRUCTURE_CUTOUT_MISSING`. A generated alpha cutout is a **shader appearance only**: physics/collision triangles are still continuous, and no true knitted loop topology or physical open weave is claimed.

On the present catalog all 15 mesh-family variants have generated cutout coverage (the three base constructions and their four treatments). No `OPEN_STRUCTURE_OPACITY` warnings remain and the 400-preset diagnostic has zero review findings. The cutout report proves coverage-function variation and code-path compatibility, not a screenshot-derived GPU visibility guarantee.

## Diagnostic grading

`B` indicates no numerical error or review warning in the available **estimated** data. `C` indicates one or more review-worthy contradictions, and `D` indicates an invalid required parameter. `A` is intentionally never issued based only on guessed values. The independent `evidence` field stays `unmeasured` unless a sample ID, evidence URI and measured status are present; even then it says the submitted evidence requires verification. Every fabric is `productionReady: false`. This is not the A–D laboratory evidence completeness grade in `fabricEvidenceCalibration.js`.

`VISUAL_SOURCE_PROXY` indicates a structure-similar photographic reference used as a visual stand-in; its exact material properties must never be inferred. `PROCEDURAL_OPTICS` means a licensed photographic scan is unavailable for the preset. Scan metadata classification is verified from preset `texture.scanMatch`/`photoReference.match`, not inferred by image color or fiber name. Source identifiers and asset links are included for independent inspection. Scan count is not unique specimen count.

## Practical next measurements

For flagged fabrics, obtain conditioned specimen GSM and thickness at a stated pressure. Record specimen direction, dimension, rate, load and unload force/extension curves along warp, weft and bias, plus bending, shear, friction against a specified counter-surface and repeat measurements. For mesh and tulle, quantify aperture/open area and transparency; for fleece and terry, quantify loops/pile and compressibility; for coated materials, measure coating mass, layers, vapor/moisture response and gloss. For denim, cotton, silk and leather, record finish, basis weight, construction, orientation and controlled imaging. Keep measured evidence in the separate `fabricEvidenceCalibration.js` ingestion path; this diagnostic never mutates catalog values or claims solver calibration.

The full JSON lists individual corrective actions for every flagged fabric and summary totals by family, warning type, source proxy and evidence status.
