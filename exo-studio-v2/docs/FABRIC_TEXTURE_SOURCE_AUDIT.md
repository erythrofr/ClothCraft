# Fabric texture sources — installation and rights audit

Checked 2026-10-16. This is a visual PBR inventory, not cloth-physics measurements.

## Installed and validated

| Provider | Actual installed sets | Files | Resolution | Provenance |
| --- | ---: | ---: | --- | --- |
| Poly Haven | 37 | 111 | 1K | `src/data/polyhavenScans.generated.json` |
| ambientCG | 30 | 90 | 1K | `src/data/ambientcgScans.generated.json` |

All 201 installed color, normal and roughness files existed and matched the SHA-256 hashes in their existing generated manifests at audit time. Both suppliers identify their assets as CC0. Each scan is one photographic visual reference even where assigned to multiple catalog fabric variations. No 2K/4K scans are installed in these two collections; evaluate higher-resolution source variants only where close-up weave details justify the bandwidth. No new downloaded assets were added in this iteration.

## Construction-aware starting points

Cotton jersey: `cotton_jersey`; pique: `waffle_pique_cotton`; poplin: `stretch_poplin`. AmbientCG `Fabric062` is a *visual proxy* for canvas, and `Fabric077` a proxy for twill. Denim references: `denim_fabric_06` general, `denim_fabric_04` light, `denim_fabric_05` heavy, `denim_fabric_03` stretch-denim appearance (actual stretch unmeasured). Silk-like surfaces: `crepe_satin` and `crepe_georgette`; their exact fiber content and mechanical properties have **not** been established. Application mapping is in `src/data/polyhavenFabricAssignments.js`, while the concise source inventory and matches are in `src/data/fabricTextureLibrarySources.js`.

## Evaluated but not installed

| Provider | Commercial usage | Embed/rehost raw maps in EXO library? | Source |
| --- | --- | --- | --- |
| TextureCan | Yes, under its stated CC0 terms | Publisher explicitly allows redistribution **together with projects and 3D assets**. Verify individual asset and packaging before adding. | https://www.texturecan.com/terms/ |
| LotPixel | Free tier allows commercial projects | No, its terms prohibit texture libraries, redistributing assets and design tools exposing raw files without permission. | https://www.lotpixel.com/terms_conditions |
| Poliigon | Free license allows commercial projects | No, redistribution and end-user access in design software are prohibited. | https://help.poliigon.com/en/articles/8749749-asset-use-licensing |
| ShareTextures | Yes, under publisher's custom license | No without written approval: publisher forbids redistribution in collections/plugins and automated downloading, despite its CC0 descriptions. | https://www.sharetextures.com/p/license |

**Asset additions:** Zero. LotPixel, Poliigon and ShareTextures are only research references; their texture files were not downloaded or mirrored. TextureCan is a possible future supplier after confirming an actual asset URL and redistribution compatibility with the planned delivery format.

**Reproducible verification:** run a SHA-256 comparison for every `maps.*.src` against its `sha256` field in the two generated manifests. The photographs do not yield validated physical parameters (mass, thickness, bend stiffness, stretch, friction) or guaranteed weave-scale calibration; those need independently measured fabric data.
