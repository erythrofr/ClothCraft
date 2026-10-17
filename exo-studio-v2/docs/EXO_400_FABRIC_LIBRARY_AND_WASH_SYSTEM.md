# EXO 400+ Fabric Library and Digital Wash System

Research, implementation and engineering acceptance specification — 16 October 2026. The implemented module references below are verified by a programmatic catalog audit; future high-fidelity features in this document remain proposals. It does not certify that EXO currently has 400 experimentally characterized/photorealistic fabrics or that its implementation matches CLO.

## Implemented scope (validated October 16, 2026)

### Subsequent real-scan appearance pass on the same 400

All 400 presets were re-audited against actual installed and SHA-256-verified CC0 photographs; the result is in `docs/reports/EXO_400_FABRICS_COVERAGE.csv` and `.json` with exactly 400 rows.

| Evidence state | Actual count |
| --- | ---: |
| EXO garment fabric presets | **400** |
| Unique installed CC0 photographic PBR source materials | **67** (37 Poly Haven, 30 ambientCG) |
| Unique CC0 sources actually used by presets | **44** |
| Verified installed images (1k JPG albedo, OpenGL normal, roughness) | **201** |
| Fabric presets referencing an installed photographed material | **385** |
| Construction-reference assignments | **220** |
| Related-fabric proxy assignments (NOT an exact fabric scan) | **165** |
| Textile-specific generated appearance fallback (mostly fine/open mesh) | **15** |
| New per-specimen mechanically measured/calibrated materials | **0** |

Real sources were obtained from official Poly Haven and ambientCG APIs under CC0 licenses (see `https://polyhaven.com/license` and `https://docs.ambientcg.com/books/website-licensing/page/license-information`), with SHA-256 checksums, author/source and provider metadata preserved in `src/data/polyhavenScans.generated.json` and `src/data/ambientcgScans.generated.json`. No proprietary CLO textures are used. Resumable installers are `scripts/install-polyhaven-fabric-scans.py` and `scripts/install-ambientcg-fabric-scans.py`; the combined strict asset registry is `docs/reports/EXO_400_LICENSED_SCAN_REGISTRY.json`. `src/data/polyhavenFabricAssignments.js` documents assignment to the 80 base archetypes, inherited by four additional variants; no extra material specimen is created by editing color or GSM.

Photo maps and provider-declared repeat scaling are installed via `src/data/polyhavenScans.js` and rendered in both browser and native swatches. Some ambientCG assets do not publish physical repeat measurements, so their default repeat scale is marked **unknown/illustrative** rather than verified. Colorways use non-destructive photographic tonal retargeting: source yarn detail is retained while the user adjusts color and wash strength. The 15 unmatched materials retain procedural textures suited to fine meshes/tulle and unsupported physical constructions (neither substitutes for yarn-level cloth simulation).

**Clarification of evidence grade:** The strict photo registry may grade a fabric "A" for complete **color + normal + roughness maps**. That is optical map coverage only. It is not a claim of color-spectrophotometric accuracy, a scan of the exact EXO fabric variation, or laboratory-determined drape/stress data. Related-fabric proxies are clearly separated in the audit. The 1k source maps suit interactive previews; higher-resolution originals may be available for later selective re-import. The two source caches occupy approximately **191 MB** (90 MB Poly Haven and 101 MB ambientCG); additional bulk downloading was paused because the Mac had approximately 19 GiB free.

The physical importer in `src/core/fabricEvidenceCalibration.js` supports traceable mass/thickness measurements and directional laboratory curves with provenance and unit checks. In the editor, use **Physical Fabric > Import Lab Specimen Data (JSON)** to add *user-provided* specimen data. Areal mass and thickness can be converted directly to the solver's SI quantities; uncalibrated tensile, bending and shear fits remain advisory. A user's submitted file is marked `imported-unverified` until instrument and specimen traceability are independently confirmed. This is intentionally not an automated 400-material calibration claim.

The visual preview contact sheet generated from all current preset colors and photo references is `screenshots/EXO_400_FABRIC_CONTACT_SHEET.jpg`. Its JPG thumbnails are graphic previsualizations, not WebGL screenshots or measured color targets. The main and native PBR rendering use the source image, normal and roughness maps.

- **Exactly 400** named, unique, selectable React material records: 80 original archetypes plus 320 physical/finish variants, assembled from `src/data/fabricCatalog400.js` and `src/data/defaultProject.js`. Four variants per base change weight, thickness, bending, directional stretch, friction and optical controls—not only color. They are parametric estimates, **not 400 unique fabric specimens**.
- **405** Rust fabric choices in `src/core/clothcraftFabrics.js`: 400 aligned construction IDs plus five extra original instrument/reference specimens retained for backward compatibility. The same underlying material models are **not** used by the React and Rust solvers; conversion remains approximate.
- **16** selectable, parameterized digital appearance effects, including modeled enzyme, stone, acid-marble, ozone, bleaching, localized PP-style fading, garment dye, whiskers, seam-edge fading and distress. `src/core/clothWashProcedurals.js` generates deterministic periodic masks; `src/core/clothWashImage.js` provides browser sRGB image grading. Project wash metadata is stored on fabric and changes remain optical-only in the main React workflow.
- `src/core/textileProcedurals.js` applies color-graded wash to generated yarn/base color maps, while `GarmentViewport.jsx` and `FabricMaterialPreview.jsx` also apply visual grading to loaded photographic color maps. The source image itself is not overwritten. Original procedural normal/roughness and uploaded maps remain independent.
- `src/core/clothcraftFabricSurface.js` renders matching preconfigured washes on saved native fabric preset names, but **the native workspace does not yet offer a persisted arbitrary wash layer editor**. Native custom finish stack persistence is a future bridge.
- Automated tests `scripts/check-apparel-catalog.mjs`, `scripts/check-cloth-washes.mjs`, and `scripts/check-cloth-wash-image.mjs` verify exact catalog size, finite parameters, uniqueness, deterministic tiling and reversible unmodified source RGB. `npm run build` and `npm run check:materials` passed. Physical drape certification, full-page visual regression, manufacturer wash QA and per-panel seam masks are not established by these checks.
- Native exhaustive simulation fixture `integrations/clothcraft/check-v2-fabrics.mjs` is time-intensive at 405 materials. Run `EXO_FABRIC_QA_LIMIT=20 node integrations/clothcraft/check-v2-fabrics.mjs` for a deterministic distributed sample plus high-priority denim/terry/leather/suede variants (27 samples), which passed material assignment, saved reopen, undo/redo and finite native steps. Pure consistency tests validate **all 405 material descriptors**, but the 405-case full native simulation exercise was terminated for runtime cost and must not be reported as passed.

**Quality classification of the new 320 variants:** Grade C/D *estimated construction descriptors and generated visuals*, zero newly instrument-measured textile specimens. A/B measured-fabric targets below are future quality gates; showing a count of 400 must never imply calibrated fabrics or scanned material photos.

## Verified reference and scope

The official [CLO Express Denim Wet Wash guide](https://support.clo3d.com/hc/en-us/articles/48703338325145-Express-Denim-Wet-Wash) (updated 19 August 2026; feature introduced in CLO 2025.1) says to select **Material Type: Denim**, supply a denim **Base Color Map**, then choose a wash effect. CLO describes the effects as changes to the fabric's **Base Color Map**. The eight published presets are **Unwashed, Rinse, Enzyme, Stone, Acid, Bleach, Ozone, Custom**. CLO's stated controls are: **Wash Map concentration/intensity**, **Transformation** (scale, rotation, translation), **Blend** (with Overlay recommended for many denim washes), **Absorbency**, **Cycle Duration**, and **Seam Abrasion** (modifies appearance associated with pattern puckering). The article documents categories and qualitative behavior, not precise numerical control ranges, pixel algorithms, fabric test measurements, or a reproducible CLO rendering baseline. Accordingly, EXO should expose independently designed functionality and use its own names and algorithms rather than infer unpublished CLO internal formulas.

The related official [CLO Material Type article](https://support.clo3d.com/hc/en-us/articles/115015998728-Material-Type) describes Denim alongside fabric reflection/material types. Source reference is for comparative research only; no CLO screenshots, source images, procedural shader code, proprietary assets, or wash maps are to be copied.

## Proposed EXO system architecture

Maintain three linked but independently versioned records:

1. **Fabric master**: unique stable ID, human-readable name, construction/fiber composition, nominal GSM, measured or estimated thickness, warp/weft grain, mechanical calibration with evidence level, optical PBR family, base color/texture, yarn-scale texture repeat, licenses and source provenance. A master is a real fabric category/specimen variant, not a colorway or wash alias.
2. **Fabric appearance variant**: parent fabric ID, colorway, UV repeat, base PBR maps and an ordered, editable **digital finish stack**. Store original map references and parameters; regenerate derivative textures without overwriting originals. Share finish templates between fabrics but keep per-variant inputs independent.
3. **Panel assignment**: pattern panel ID, parent fabric/variant ID, stable grainline, UV transform, panel-specific masking, seam references, optional overrides. Persist alignment to the 2D pattern as well as the simulated 3D garment; avoid binding wear marks to arbitrary world-space coordinates.

Suggested asset graph:

```text
FabricMaster(id, mechanics, PBR, evidence)
  -> AppearanceVariant(id, base maps, finishStack[])
  -> PanelAssignment(panelId, uvLayout, grainline)
  -> SeamTopology(pairings, stitch lines, allowances, puckering)
  -> TextureBake(albedo, roughness, normal?, height?, AO?)
  -> Browser/Native render + swatch + BOM/techpack export
```

An illustrative finish-layer schema (a *design target*, not a claim of existing EXO API) is:

```json
{
  "id": "finish-unique-id",
  "kind": "denim-wash",
  "preset": "stone",
  "enabled": true,
  "seed": 31415,
  "strength": 0.45,
  "durationVisual": 0.5,
  "spread": 0.35,
  "blendMode": "overlay",
  "transform": {"offsetU": 0, "offsetV": 0, "scaleU": 1, "scaleV": 1, "rotationDeg": 0},
  "maskAssetId": null,
  "seamAbrasion": 0.4,
  "edgeWear": 0.3,
  "reversible": true
}
```

Normalize every numeric field to a published EXO range and reject nonfinite values. The 0–1 values above are proposed UI conventions, **not official CLO ranges**. Preserve seed, implementation version, color space, inputs and checksums so exports can be reproduced. Finish edits must participate in undo/redo, versions, named colorways, manufacturer comments and export metadata.

## Denim wash preset targets: appearance only

| Digital preset | Visible result to target | Proposed masks and texture response |
|---|---|---|
| Unwashed / raw | Preserved dark, saturated dye, sharp twill relief | Identity base color; no wash mask |
| Rinse | Subtle evenness and small reduction in apparent saturation | Low-amplitude broad mask, minimal localized contrast |
| Enzyme-inspired | Gentle broken-in fading with soft transitions | Low-frequency attenuation plus mild raised-area wear |
| Stone-inspired | Uneven highlights, pronounced seam/edge wear | Multi-scale wear noise, fold-ridge and edge masks |
| Acid-inspired | High-contrast irregular cloud/marble pattern | Seeded clustered mask with smooth/fragmented boundaries |
| Bleach-inspired | Localized to broad color lightening | Controlled pigment-removal color blend, preserve yarn detail |
| Ozone-inspired | Gentle fairly uniform fade | Broad low-contrast fading mask |
| Custom | User-owned photography or authored masks | Editable map transforms, channel blending and intensity |

These labels describe **visual approximations**. A digital filter does not chemically change dyestuff, predict process chemistry, validate environmental impact, soften a real fabric, or prove garment longevity. Even when the appearance suggests a softer hand, solver properties stay fixed until separately provided with measured post-treatment mechanical values and explicit user approval to change the simulated fabric.

Extend finishing beyond denim through the same stack: pigment or garment-dye look, vintage wash, sunfade, localized whiskers, honeycombs, knee/seat wear, edge abrasion, soft overdyed patina, uneven dye uptake, suede nap direction variation, leather patina and highlight wear, cotton/fleece garment aging, and print crackle. Use applicable masks per material; do not imply that every wet process is valid for leather, silk, wool or treated composites. Names such as 'potassium wash' should be presented as visual looks only, with no chemical formulations, process recipes, concentrations, times, temperatures or manufacturing operating instructions.

## Correct placement on UVs, patterns, and stitches

**UV invariants.** Generate primary repeat UVs from each 2D panel in centimeters. Keep fabric twill/knit orientation registered to grainline. On a stitched 3D garment, the mask must follow simulated vertex UVs during motion and deformation. Pattern resizing and grading must regenerate appropriate UV coordinates and remap authored local mask landmarks. Preserve authored offsets and seam continuity when panels are split or re-sewn.

**Construction-aware masks.** Derive edge-distance maps from **valid pattern boundary edges**, separately tagging fold, hem, cut, bound, zipper, pocket, waistband, seam allowance and internal stitch lines. Use signed or unsigned distance in **physical centimeters**, accounting for texel density. A fade near a hem should remain similar physical width on differently sized panels. Use user controls for seam bias and localized exclusion masks; avoid automatic artificial bright seams on raw or taped, sealed, reversible or non-denim materials.

**Seam registration.** Sewn edges refer to paired pattern edge IDs and correspondence/arclength. Edge-wear and puckering patterns should interpolate along those paths, with orientation and stitch density attached to the seam. Avoid accidental discontinuities when a wash crosses front/back joins; intentional panel discontinuities are allowed as a design choice. For whiskering, offer user-placed anchor areas at hip/upper thigh with directional fold curves and displacement from avatar pose, then bake on the panel UVs. Seat/knee worn regions should use labeled user-adjustable pattern zones, not hardcoded pixel rectangles that shift with size.

**Map pipeline.** Base color in sRGB; scalar/normal/height masks in non-color data space. Perform blending in a documented linear-light workflow and convert for storage/viewing as needed. Preserve weave and twill contrast by altering dye/pigment appearance without deleting the entire yarn normal map. Anti-alias masks, generate mip levels, check UV seams at render distance, and use a deterministic fallback when a map is absent. Roughness or normal response may be altered in an independent optical layer where appropriate; no direct change to collision thickness, mass, bending stiffness, tensile stiffness or friction from a color-only wash.

Recommended generation dependency graph: `finish params -> UV/edge/zone masks -> dye/fade color composite -> optional optical map composite -> mipmapped render assets`. Cache by fabric variant, panel geometry/UV revision, seam topology revision, finish version, input image hash and deterministic seed. A color-only operation must not reset simulated particle positions or rewrite garment pattern geometry.

## Measured physics versus visual plausibility

Current project reference paths include `src/core/clothcraftFabrics.js`, `src/data/apparelMaterialExpansion.js`, `src/core/fabricSurfaceModel.js`, `src/core/fabricCalibration.js`, `src/core/textileProcedurals.js`, `src/core/fabricPbrGenerator.js`, `src/components/ClothCraftFabricLibrary.jsx`, and `src/components/FabricMaterialPreview.jsx`. Existing source already distinguishes approximate material appearances from mechanical inputs; a source comment in `clothcraftFabrics.js` notes measured mass/thickness for some specimens but **estimated** elasticity and bending. `fabricCalibration.js` fits elementary measured tensile responses, not a complete fabric constitutive model. The [existing EXO materials reference](EXO_FABRIC_MATERIALS_AND_TRIMS.md) documents normal-map and shader limitations.

Physical fidelity requires specimen-level evidence for areal density (g/m²), thickness (mm with defined pressure), warp/weft extension versus applied load, shear, bend hysteresis, damping, surface friction, compression, shrinkage and behavior after real finishing when relevant. Record test method, specimen conditioning, force/displacement curve, uncertainty, and solver-specific fit/error. For denim, compare raw and physically finished *measured* samples before offering 'wash changed hand feel' simulations. An artist-made appearance may still be visually convincing without these measurements: label that honestly as **optically authored / mechanics estimated**.

Practical simulation gate: identical garment, poses, timestep and initial conditions must show unchanged cloth positions after an appearance-only edit within stated floating-point tolerance; independently applied measured mechanical updates should alter corresponding cloth observations when re-simulated. Test UV stability on a moving avatar and cloth self-contact; shader displacement and painted creases do not prove actual folded topology, abrasion damage or additional collision geometry.

## Swatch photography and texture capture protocol

1. Obtain a physical reference swatch with recorded consent/license, manufacturer/lot, fiber content, weave/knit, nominal GSM, finishing history, dimensions and measurements. Capture raw and finished variants when available. Do not assign a chemical-process label solely from visual similarity.
2. Condition and flatten a representative area consistently; capture a **measured centimeter scale**, neutral gray reference, calibrated color target and fiber/grain direction indicator. For PBR, obtain high-resolution macro photographs and garment-scale images under stable diffuse illumination. Include raking light and cross/polarized lighting when equipment allows; document the lighting and lens profile.
3. Capture controlled front/back albedo, weave/nap relief, low-angle directional reflection and transmitted-light reference when relevant (especially sheer cloth). For pile materials, photograph multiple fiber orientations because velvet, suede and brushed fleece change substantially with viewing direction.
4. Correct distortion and perspective against the scale marker, white-balance/color-manage with chart profile, document RGB working space, remove illumination gradients without erasing material texture and create edge-compatible tile crops. Do not mistake shaded wrinkles for diffuse pigmentation.
5. Derive roughness, normal and displacement maps through separately validated imaging or artist calibration. A single diffuse photo cannot uniquely recover physical roughness, normal microgeometry or BRDF. Mark inferred maps **estimated**. Set physical repeats in millimeters/centimeters and use matching UV axes.
6. Compare the rendered flat swatch, sphere/macro sample and full draped garment under matching reference studio lights at near and far distances. Save baseline captures with color target, input image hashes, source rights, calibration notes and compare dates. Use a calibrated display for judgment; no screen preview promises production dye match.

Capture minimum for priority families: rigid/stretch denim (face/back), cotton jersey, French terry (loop/back), fleece, poplin, canvas, twill, leather, suede, silk satin, wool suiting, linen, nylon ripstop, rib knit, velvet, mesh and sheer organza. Build family-specific test variants: black/white/high-chroma dyes, fine/coarse weave, shallow/deep relief, heavy/light weights, brushed and coated finishes, cross-grain orientation.

## 400+ catalog acceptance

**Count definition:** target `>= 400` **unique meaningful fabric masters** identified by stable IDs and differing in material composition, construction, weight, finish substrate or other defensible physical/material identity. Multiple dye colors, repeated presets, slight noise seeds, wash look variants, or near-identical parameter clones do **not** increase the unique-master count. Keep appearance variants separate; they may number in the thousands but must never inflate the underlying 400 claim.

Coverage plan (targets, not verified current counts):

| Material family | Unique masters target | Examples / coverage |
|---|---:|---|
| Cotton woven, canvas, twill, shirting | 68 | poplin, oxford, broadcloth, sateen, duck, drill, voile |
| Cotton and blended knit | 62 | jersey, interlock, piqué, rib, ponte, French terry, fleece |
| Denim | 52 | rigid/stretch, varying weight, warp/weft blend, slub, black, raw, lightweight |
| Wool and animal-fiber fabrics | 45 | suitings, flannel, melton, felt, worsted, cashmere blends |
| Linen, hemp and bast blends | 31 | plain weave, canvas, slub, twill, knit, mixes |
| Silk, satin and lightweight dress fabrics | 35 | charmeuse, crepe, georgette, chiffon, organza, taffeta |
| Synthetic technical fabrics | 59 | nylon/polyester woven, ripstop, mesh, shell, coated, spacer |
| Leather, suede and alternatives | 27 | nappa, split suede, nubuck, bonded, PU and microfiber |
| Pile, specialty and composite | 33 | velvet, corduroy, faux fur, jacquard, lace, quilted laminates |
| **Total planned** | **412** | All category counts require machine-audited distinct source entries |

Run a full automated catalog audit on the **actual assembled runtime catalog**, not source-file text counts. Assert 400+ stable unique IDs and names; valid, normalized numeric optics and finite physical data with units; correct family assignment; fabric master ≠ colorway ≠ wash variant; deterministic import/export; editable controls that persist after reopening; successful fabric assignment to an actual 2D panel and visible 3D mesh. Deduplicate case/spacing aliases and compare fingerprints (fiber composition, knit/weave, GSM band, thickness, stretch profile, optic family), flag suspicious near-identical records for manual review.

For **each** master, validate 1) source/provenance and license metadata, 2) useful swatch/fallback, 3) color map plus calibrated or explicitly estimated roughness/normal/relief, 4) consistent cm UV scale and grain direction, 5) nonzero credible physical metadata and its evidence status, 6) serialized save/load and production data export, 7) viewport application and 8) accessible search/filter/grouping. Quality is graded separately: **A** specimen-measured mechanical + color-calibrated optical reference; **B** part-measured with optical reference; **C** literature-estimated and artist-generated; **D** placeholder. Report A/B/C/D counts; a 400 total with 390 placeholders fails the intended quality bar.

For denim finishes, minimum golden scenes: raw indigo, sulfur black, light washed blue, heavyweight/slubby twill, stretch denim, jean front with fly/pockets/hem, jean back with seat/pockets, jacket with yoke and cuffs. Snapshot all eight presets across representative scenes and compare a physical/photo reference where licensed. Include intensity endpoints, UV transform rotations and scales, independent seed determinism, blend selection, area masks, seam abrasion at three levels, extreme panel aspect ratios, resizes/grading, symmetry, undo/redo, round-trip save/load, 3D pose motion, lighting changes and distance mipmapping. In particular assert finish edits do not modify recorded physical solver state.

Visual QA must catch: faded areas that drift in world space during cloth motion; identical wear printed onto both legs despite different panel mappings; seams glowing uniformly despite absence of puckering; twill detail disappearing under strong bleach looks; unlicensed photographs shipped with default assets; wash texture repeats exposing obvious tile seams; albedo treated as data or normal maps treated as sRGB; progress UI announcing '400 realistic fabrics' with no verified runtime total. Preserve separate measured optical similarity scores and solver fitting errors where evidence exists.

**Suggested release gates:** catalog count and integrity tests green; every entry can be assigned and reopened; each family has a documented manual lighting/visual sample; denim golden scenes reviewed; no catastrophic UV seams in sampled garments; wash stack exports are deterministic and reversible; no unlicensed reference maps; calibrated-vs-estimated badges visible; measured physics claims limited to measured specimens. Establish tolerances with baseline image differences and panel displacement fixtures rather than inventing unverified universal pixel/perceptual thresholds.

## Product semantics, rights, and safety

Label interface controls **Digital Wash / Finish Appearance**, with a separate optional **Measured Post-Finish Mechanics** asset only when actual tests support it. Store wash settings and reference image provenance in editable techpacks: finished-look target, source fabric, colorway, layers, reference photographs, panel mask placements, revision notes and manufacturer comments. Export swatches and a visual spec with a clear disclaimer that manufacturing results require separate factory sampling and approval.

Accept user-owned or appropriately licensed swatches and original procedural generators; track source URL, creator, license, attribution restrictions and whether redistribution/derivatives are allowed. Avoid bundling CLO media, logos, proprietary textures and reverse-engineered code. Never offer operational chemical wash formulas or infer worker/environmental safety from a rendered wash effect. Physical production instructions should be written only from qualified manufacturing documentation and applicable safety standards outside this digital appearance specification.

## Sources

- CLO, [Express Denim Wet Wash](https://support.clo3d.com/hc/en-us/articles/48703338325145-Express-Denim-Wet-Wash), official support guide, updated 19 August 2026.
- CLO, [Material Type](https://support.clo3d.com/hc/en-us/articles/115015998728-Material-Type), official support guide.
- EXO code reviewed read-only: `src/core/clothcraftFabrics.js`, `src/core/fabricSurfaceModel.js`, `src/core/fabricCalibration.js`; background architecture: [EXO Fabric Materials and Trims](EXO_FABRIC_MATERIALS_AND_TRIMS.md). All proposed fields and targets remain unimplemented unless separately verified by code and tests.
