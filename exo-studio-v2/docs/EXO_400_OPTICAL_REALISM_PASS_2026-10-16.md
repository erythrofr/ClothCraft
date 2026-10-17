# EXO ClothCraft — 400-material optical realism pass, iteration 2

**Scope:** verified digital textile rendering and catalog checks on 16 October 2026. This is an implementation report, not an independently measured fabric physics dataset or certification of photographic color accuracy.

## Material coverage and source limitations

- Main editor: **400** stable catalog IDs (80 master constructions and 320 design-derived weight/hand variants). Rust native catalog: **405** including five earlier reference specimens.
- Installed photo sources: **67** distinct externally photographed CC0 material sets, from Poly Haven (37) and ambientCG (30). The 201 existing files are 67 color maps, 67 normal maps and 67 roughness maps. No new texture downloads were performed in this second iteration.
- **385** catalog materials reuse photographed PBR texture data, including **165** related-construction visual proxies. **44** of the 67 installed source sets are currently assigned. **15** unscanned open-mesh/tulle construction variants retain generated texture channels.
- Exactly **zero** catalog records have a complete independently verified, specimen-specific tensile/bending/shear/friction laboratory calibration. All 400 original physical profiles and design variants remain *estimates*. This distinction is explicit in `src/core/fabricEvidenceCalibration.js`, the 400-item audit, and material inspector.

## Implementation changes

### Consistent photographed roughness across all photo-backed presets

`src/core/fabricPbrAppearance.js` provides a licensed-texture-only, sRGB-independent roughness rebasing step. Original source JPEG bytes and SHA256 evidence are never changed. An imported grayscale roughness image historically *multiplied* the user's normalized material roughness; differently authored texture baselines created unexpected gloss variation when selecting equivalent fabrics. The new browser helper rebases each scan's green channel around a near-neutral scalar, with intentionally moderate variation determined from broad construction/finish cues (suede/pile, denim, coated, silk). Result: the roughness slider remains the primary control, while the source yarn structure still affects highlights.

The transformation is applied to photo-backed materials in **three** render pathways:

- `src/components/GarmentViewport.jsx` — live cloth panels;
- `src/components/FabricMaterialPreview.jsx` — material inspection ball and 1.8 cm swatch;
- `src/core/clothcraftFabricSurface.js` — native ClothCraft reference swatches.

Unlicensed external texture guesses, user-imported maps and procedural fallbacks are not silently reclassified as verified photo scans. A failed or tainted image cannot corrupt an original source asset; it keeps the original roughness map. Pixel alpha remains intact.

### Color and dye sampling stability

`src/core/photographicScanToning.js` and the new roughness rebase use complete sampling on small images and a 23-pixel skip on larger surfaces rather than fixed eight-pixel sample strides. This removes a sampling bias that synchronized against repeating yarn lattice patterns and could substantially clip or skew some fabric swatch shades. RGB sRGB dye retargeting remains a **visual approximation**, not a measured physical dye result.

### Structure-specific transparent textile surfaces

`src/core/textileProcedurals.js` now constructs three distinct periodic cutout visual families:

- **Athletic polyester mesh**: circular ventilated openings and generally opaque jersey between holes.
- **Power mesh**: diagonal stretch-grid yarn network and intermediate open fraction.
- **Tulle**: fine angled net with visibly higher open fraction.

Across 15 procedural mesh/open textile variants, the normal/roughness and optical alpha channels now reference coherent topology. This is *alpha-masked garment appearance*, **not** actual yarn-strand contact mechanics, mass distribution through an aperture, or physical collision/tearing holes. The associated construction diagnostic correctly treats a fully opaque *strand shader* and alpha-map apertures separately, instead of naively interpreting fabric opacity=1 as a nonporous mesh.

## Independent QA and evidence

| Validation | Verified result |
|---|---|
| `node scripts/check-400-pbr-balance.mjs` | All 400 finite material parameters, 385 licensed scanned-source rebases, 15 backups, pixel RGB and alpha preservation |
| `node scripts/check-400-mesh-optics.mjs` | All 15 generated open meshes, 3 differentiated topologies and periodic UV boundaries |
| `node scripts/check-400-fabric-constructions.mjs` | 400 entries, 10 broad construction classes, 0 invalid material numbers, original estimates clearly tagged |
| `python3 scripts/check-400-scan-optics.py` | All 201 source JPEGs hashed and channel statistics recorded; eight source normals and five low-contrast roughness inputs flagged for optional visual review |
| `node scripts/audit-400-fabric-scans.mjs` | 67 complete CC0 source triplets, 385 reuse assignments, 165 family proxies and 15 procedural materials |
| `npm run check:materials` | Integrated materials, fabrication suitability, wash effects and optical QA |
| `npm run build` | Vite/React production bundle (bundle size still a performance roadmap item) |

Additional browser QA and screenshots are logged in `docs/EXO_400_OPTICAL_PASS_LIVE_QA.md` if available. A browser screenshot comparison checks appearance changes, not the scientific accuracy of the generated color, micro-reflectance or yarn texture.

## Limits and next physical-fabric milestone

Full production-level accuracy requires separately acquired garments or traceable fabric sample lots; controlled photographs with rulers and calibrated lighting; measured swatch reflectance and pile direction; manufacturer-provided/fabric-lab test conditions for GSM, thickness, warp/weft nonlinear extension, shear, bending and friction; actual chemical wash test specimens; and simulation validation against drape/collision experiments. Source license verification plus photographic-looking maps do **not** establish those properties. See `docs/EXO_400_INDEPENDENT_MATERIAL_EVIDENCE.md` for specimen-level quality gates.

Local storage pressure remains relevant (approximately 18 GiB free on the last check). Do not unconditionally download large 4k/8k photo libraries or duplicate the CC0 sources across 400 presets; preserve shared 1k sources and source-attribution metadata until space and benefit have been audited.
