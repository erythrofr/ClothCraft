# EXO 400: Independent Material Evidence and Acceptance Protocol

**Baseline:** 2026-10-16. **Scope:** existing 400 fabric presets, current licensed photographic references, and the evidence required to promote each preset into a specimen-backed optical and mechanical material. This is an evidence plan; no 400-specimen acquisition or physical testing is claimed complete.

## Current combined evidence audit (Poly Haven + ambientCG)

The authoritative source is `node scripts/audit-400-fabric-scans.mjs` and `docs/reports/EXO_400_FABRICS_COVERAGE.json`. As of 16 October 2026, EXO contains **400 distinct digital material specifications**, **67** installed source CC0 photo scans (37 Poly Haven, 30 ambientCG), **201** SHA-256-verified original color/normal/roughness maps, and **44** actually assigned unique photo source sets. There are **385** photo-referenced fabric presets, of which **165** are explicitly related-material visual proxies, and **15** procedural texture fallbacks. **None of the 400 fabrics has independently validated complete mechanical test curves.** Source-scanned normals and color maps do not certify exact EXO fabric weight, drape, manufacturing wash behavior, or dimensional scale. Some ambientCG scan repeats have undocumented physical size, and their provisional UV dimensions must not be considered measurements.

The contact sheet is `screenshots/EXO_400_FABRIC_CONTACT_SHEET.jpg`; the ambientCG material inspection board is `screenshots/EXO_AMBIENTCG_30_SCAN_OVERVIEW.jpg`. Both show *illustrative digital appearances*, not physical laboratory results.

## Historical Poly Haven-only inventory (prior baseline)

| Metric | Current count | Meaning |
| --- | ---: | --- |
| Catalog fabric presets | **400** | Digital material specifications, including variants; not 400 independently scanned specimens |
| Unique downloaded Poly Haven CC0 photographic sources | **37** | Independent *source assets*, not EXO-specific laboratory specimens |
| Installed 1K map files | **111** | Exactly 37 color, 37 normal, 37 roughness files, with verified file hashes |
| Presets referencing a photographic source | **365** | Shared/inherited maps; a given source can support multiple variants |
| Presets using related-family proxies | **170** | Optical approximation drawn from a non-equivalent construction or fiber family |
| Presets using procedural fallback | **35** | Structure-specific generated appearance, no qualifying shared photographic scan |
| Grade A **optical-map coverage** | **365** | Complete scan-derived color/normal/roughness triplet with declared repeat and tileability; can include proxies and inherited images |
| Grade D **optical-map coverage** | **35** | No verified licensed photographic triplet in the existing asset registry |
| Independently measured EXO material mechanical profiles | **0** | No validated specimen-to-preset laboratory dataset or fitted measured stress/strain curves |

These counts are produced by `node scripts/audit-400-fabric-scans.mjs`, drawing on `src/data/defaultProject.js`, `src/data/polyhavenFabricAssignments.js`, and `src/data/polyhavenVerifiedRegistry.generated.json`. Grade A describes optical asset availability **only**. It does not certify dye accuracy, the exact textile weave, optical uniqueness, cloth physics, repeat dimensions of a manufactured EXO swatch, or provenance of an EXO specimen. Under current source reuse, the remaining gap to 400 **independent** physical specimens is 400, even though 365 digital presets already have useful photographic references.

## Two different kinds of match

**Construction-reference:** the borrowed photographic source resembles the target construction closely enough to serve as a plausible visual reference, such as a denim image applied to a denim category. It still describes an outside source specimen with unknown relationship to the exact EXO yarn, weight, treatment, dye, and finish. It does **not** mean identical material or measured match.

**Related-family proxy:** the borrowed source differs materially in composition, weave/knit, finish, or structure and is used only to approximate visible texture. For example, a herringbone wool photo cannot prove the appearance or behavior of cotton twill; a generic woven synthetic cannot certify ripstop, nylon shell, or other target engineering. The **170** proxy presets must carry a visible `related-family-proxy` or equivalent label and must not be promoted to exact optical construction matches without evidence.

Construction-reference and proxy are both source-reuse categories. Neither constitutes independent EXO evidence. The remaining **195** photo-referenced presets are classified as construction references (365 minus 170); the 35 procedural entries have neither category of qualifying photographic reference. Per-preset dye retargeting or wash simulation does not transform one underlying photograph into independent specimens.

## The 400 acceptance gates

Evaluate every preset independently using the following gates. Record `pass`, `fail`, `pending`, or `not_applicable` with evidence IDs and reviewer. No gate may silently inherit a parent's specimen ID merely because two presets share a scanned image.

| Gate | Required evidence and acceptance rule |
| --- | --- |
| G01 Identity and uniqueness | Stable preset ID, variant, bill-of-material material ID, specimen ID, lot ID, source supplier and composition; 400 distinct specimen records when claiming 400 individual materials. Versions from the same specimen must say so explicitly. |
| G02 Chain of custody | Acquisition date, supplier/manufacturer, lot, collection/ownership rights, custody events, sample dimensions, conditioning and transfer records. |
| G03 Rights and license | Per-asset source URL, creator, license URL, acquisition date, permitted redistribution, attribution requirements where applicable, asset hash and raw-file retention. Separate rights to third-party images from EXO's own specimen capture. |
| G04 Raw image capture | Original RAW or highest-quality source image, camera/lens and settings, consistent lighting geometry, color target, physical ruler, orientation and signed capture protocol. |
| G05 Color fidelity | Calibrated lighting and white balance; target-based color difference against physical sample measured under defined illuminant and observer. Record tolerances before capture; store original and rendered comparison. |
| G06 Surface optical completeness | Individually traced calibrated albedo/color, normal and roughness data; record normal handedness (OpenGL/DirectX), sRGB for color and linear for data maps. A map synthesized from another must say `derived`, not `measured`. |
| G07 Scale and tiling | Measured texture repeat width/height, units, warp/weft direction, camera scale, visible repeat and seam checks, usable tile dimensions and magnification review. Provider-declared tiling is not measured EXO repeat. |
| G08 Distinctness and construction | Compare source image hashes, perceptual near-duplicates, macro stitch/knit/weave counts, fibers, construction, finish and color. Any reused source remains labeled shared/proxy until a distinct specimen is captured. |
| G09 Mass and thickness | Conditioned specimen, areal mass (g/m²), thickness (mm), instrument model, calibrated fixture, measurement load/pressure, replicate counts and uncertainty. |
| G10 Tensile curves | Independently recorded warp and weft force-extension or stress-strain curves, specimen geometry, rate, gauge length, cycles, failure/extension limits, replicates and raw CSV. |
| G11 Shear, bending and recovery | Measured bending and shear responses, hysteresis, cyclic recovery and compression where relevant; name apparatus/method and raw results. Fit simulation parameters with fit residuals and uncertainty. |
| G12 Simulation and review | Versioned mechanical calibration, solver version, standardized drape/pose benchmark against physical specimen, tolerance thresholds, independent reviewer, documented failures and signed release decision. |

Quality gates are **not all already passed**. Current automated verification checks source/map presence, SHA-256 bytes, registry metadata, license labels, color space and repeat consistency; it does not measure or validate fabric specimens. A complete optical triplet may pass optical availability while G04–G12 remain pending. Publish separate dashboard fields `opticalMapGrade`, `constructionMatch`, `specimenEvidenceStatus`, `mechanicalCurveStatus`, and `releaseGateStatus`, preserving pending states visibly.

## Staged route to 400 specimen-backed optical maps and lab curves

**Stage 0 — lock definitions and baseline.** Export the current 400 IDs, 37 source IDs, 111 immutable map hashes, photo/reference assignments and the 35 procedural entries. Deduplicate shared maps by actual file hash and perceptual similarity. Define whether variations are truly distinct physical textile SKUs; if a colorway or wash uses the same substrate, record shared base mechanical curves and **separate** optical specimen images only when those colorways are physically sampled. Never call derived curves independently measured. Establish acceptance tolerances and written laboratory SOPs before collecting data.

**Stage 1 — source and procure.** For each target preset obtain a traceable material swatch or production-yardage lot, preferably from the intended manufacturer. Request fiber composition, knit/weave structure, yarn details, finish, weight, technical datasheets and rights to scan and redistribute resulting assets. Use a unique `specimen_id` and `lot_id`; establish custody and sample quantity needed for destructive and nondestructive testing. Prioritize the 35 procedural gaps and 170 proxies, then the 195 construction-reference presets. Third-party CC0 sources remain reference images and do not reduce the 400 physical specimen requirement.

**Stage 2 — capture measured optical specimens.** Condition samples consistently, record warp/weft alignment, take color-calibrated controlled-light capture with physical scale and multi-angle or photometric acquisition as appropriate. Capture genuine sample-specific color and surface response; derive normal/roughness only with explicitly disclosed technique and calibration. Keep raw camera data, calibration targets, processing recipe, scan dimensions, versions and SHA-256. Where coating sheen requires additional BRDF or gloss data, obtain it instead of asserting an inferred roughness texture is a measurement. Review side by side under controlled rendering and lighting against each swatch.

**Stage 3 — test mechanics.** Record conditioned GSM and thickness, warp/weft tensile loading/unloading (including replicates), bending stiffness in both orientations, shear response and recovery/hysteresis. Use suitable textile test procedures under the laboratory's current licensed standards and document the exact standard edition, specimen width/gauge length, rate, temperature/humidity, clamping and apparatus calibration. Common standards to evaluate with the lab include ISO 13934 for strip tensile, ASTM D5035/D5034 as applicable, ASTM D1777 for thickness, ASTM D1388 for bending and ASTM D3776 for mass per area; do not imply all standards apply to every textile or substitute named standards for actual lab protocols. For high-stretch knits, coated textiles, leather and nonwovens, choose more suitable methods and record the decision. Retain raw force-displacement/time series, conversion assumptions, repetitions, outliers and uncertainty rather than only final stiffness scalars.

**Stage 4 — fit and independently validate.** Fit physical curves to the garment solver using specified orientation, test specimen and constitutive model. Preserve raw data and fitted values separately; publish fit residuals, split calibration and validation replicates, test repeated deformation and recovery, and perform controlled drape comparisons with actual sample garments. Mark unsupported effects (e.g. humidity, coating aging, seam friction, damage) as unmeasured until tested.

**Stage 5 — review and promote gradually.** Promotion requires a complete per-preset signed evidence manifest covering G01–G12 (or explicitly justified N/A), optical QC, validated curve datasets, licensing and provenance. Review in batches, e.g. a 10-material pilot, then 40 high-use materials, then the remainder. Update the visible counts after every accepted lot: `independentOpticalSpecimens`, `independentMeasuredMechanicalPresets`, `sharedReferencePresets`, `proxies`, `fallbacks`. Claim **400 independently scanned and mechanically characterized materials** only after all 400 pass their applicable gates and the uniqueness definition is met.

## Evidence manifest per preset

Suggested schema fields: `presetId`, `specimenId`, `materialSku`, `lotId`, `variantOf`, `supplier`, `composition`, `construction`, `finish`, `sourceCaptureType` (`independent-specimen`, `construction-reference`, `related-family-proxy`, `procedural`), `sourceAssetIds[]`, `sourceUrls[]`, `license`, `licenseUrl`, `creator`, `acquisitionDate`, `rightsRecord`, `rawScanHashes`, `mapHashes`, `mapColorSpaces`, `normalConvention`, `physicalRepeatMm`, `captureCalibration`, `laboratoryId`, `testMethodAndEdition`, `conditioning`, `instrumentCalibrations`, `measurementReplicates`, `rawCurveHashes`, `fitModelVersion`, `fitResiduals`, `uncertainties`, `reviewer`, `reviewDate`, `gateResults`, `releaseStatus`. Preserve evidence records across revisions and record inheritance only for a genuinely shared tested substrate, with the limit stated.

## Official asset and licensing references

- **Poly Haven:** [Asset license](https://polyhaven.com/license) (CC0 assets, commercial use and redistribution), [official API](https://polyhaven.com/our-api) and [FAQ](https://docs.polyhaven.com/en/faq). Preserve the original individual source URL such as `https://polyhaven.com/a/<asset_id>` and license at the time of acquisition. Poly Haven site branding and third-party website elements are not automatically CC0 assets.
- **ambientCG:** [Asset library](https://ambientcg.com/), [official licensing documentation](https://docs.ambientcg.com/license/) and [license information](https://docs.ambientcg.com/books/website-licensing/page/license-information). Confirm the individual downloadable asset's license and provenance when ingesting; label any newly acquired ambientCG asset as an **additional external reference**, not as an independent EXO specimen or lab measurement. ambientCG assets are currently **not included** in the verified 37-source Poly Haven baseline.
- **CC0 legal text:** [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). CC0 grants broad reuse of covered works but does not prove textile composition, physical response, or reproducibility.

**Publication rule:** Never equate complete third-party optical maps with 400 distinct scans, construction identity, physically calibrated simulator parameters, or full laboratory provenance. Only measured and independently verified specimen evidence permits those claims.
