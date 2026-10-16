# EXO × CLO-SET CONNECT — licensed research collection

Status: **integration prepared; marketplace-wide download not performed** (2026-10-16).

## Sources and access boundaries

- Free items discovery: https://connect.clo-set.com/store?pricingOptions=1
- Garment/pattern category: https://connect.clo-set.com/store/garment?pricingOptions=1
- Fabric category: https://connect.clo-set.com/store/fabric?pricingOptions=1
- CLO guidance confirms users can find garments, fabrics, avatars and other digital assets, some offered free: https://support.clo3d.com/hc/en-us/articles/115015461808-What-kinds-of-assets-are-provided-by-CLO
- The CONNECT help center distinguishes Free Item from Paid Item; a free price does **not** state an open-source/redistribution license: https://support-connect.clo-set.com/hc/en-us/articles/45304331487769-Uploading-Items
- CLO's general terms forbid service-scraping/data mining, including for machine-learning purposes, and unauthorized redistribution: https://legal.clo-set.com/modal-tou-general (2026-03-30, §7).
- A Chrome CONNECT tab was located in the current browser session, but the local automation process lacked permitted browser JavaScript, assistive access and screen capture. No account tokens, browser profiles or cookies were accessed.

## Working rules

1. Use the provider's interactive *Free* filter, inspect each item, and its actual item-level license and physical-production grant before downloading.
2. Import only source originals obtained using the authorized download action, or the user's own original files. **Never** use unpublished site data, private API calls, cookies, scraping or payment bypass.
3. Keep a per-file private record: title, seller, exact item URL, downloaded time, licensed use scope, whether commercial physical production is permitted, and SHA-256.
4. Default unknown item licenses to **private research only**. Do not ship originals, textures, thumbnails or extracted files in the open-source EXO app without express redistributable licensing.
5. Keep fabric optical measurements separate from physically calibrated properties: a realistic-looking textile image is not evidence of bending stiffness, tensile response, shear, thickness, surface friction or shrinkage.
6. Use the local importer under `integrations/clo-connect-licensed` for discrete files downloaded through the standard UI. The importer must never fetch the marketplace.

## EXO data model crosswalk

| CONNECT facet / artifact | EXO collection field | Verification / gap |
| --- | --- | --- |
| Fabric Type, Composition, Usage Type | construction, fiberComposition, intendedApplications | Normalize with provenance, not proprietary display names alone |
| Color and Pattern | colorway, motif, color source | Preserve source image's color profile; no exact spectral claim |
| Physical Property, Supplier | testingEvidence, supplier, property metadata | Mark user-supplied parameters as uncalibrated until laboratory measurements |
| Season / tags | tags, production season | Search/index only |
| ZFAB or other material package | sourceFormat, sourceUri, checksum | Format not automatically proof of solver compatibility |
| ZPAC/ZPRJ / garment package | patternPackage, sourceId, avatarFit | Keep garment geometry/sewing graph import distinct from mere thumbnail |
| DXF / native 2D pattern | 2D outlines, notches, grain, graded sizes | Validate units, polyline closure, curve tolerances and sewing correspondences |
| Item license / permitted production | rights, commercialUse, redistribute, exportAllowed | Deny publishing/exporting protected source assets unless licensed |

## Priority technical research

The main scientific opportunity is not acquiring 400 additional fabric names but resolving fabric physical accuracy. For each legitimately obtained specimen and fabric swatch with measurements:

- **Fabric physics:** areal mass (g/m²), thickness under stated test load (mm), measured warp/weft stretch curves (N/m), bias shear, anisotropic bending and buckling, friction and damping.
- **Surface appearance:** albedo/color, normal/height map, roughness, sheen, opacity, UV repeat size, photographic lighting/reference, and wear/wash map.
- **Pattern geometry:** piece identity, 2D perimeter, graded sizes, seam allowances, grainline, cut quantity, notches, sewing graph and correctly measured 3D endpoints.
- **Validation:** compare rendered drape against photographed/physically measured behavior on the same avatar and garment construction. Inferred parameter proxies must remain explicitly labeled.

## Release gate

No CLO-SET CONNECT asset is automatically promoted to an EXO-distributed catalog by being free, downloaded or parseable. Public distribution requires actual permission that covers that exact use. Research-library ingestion and user-owned material are separate from EXO-shippable examples.

## Access blocker / handoff

The existing browser session (Google Chrome, a CONNECT Store Garment tab) is visible by name and URL. The current terminal process cannot read the signed-in page because macOS denied Accessibility and Screen Recording; Chrome's JavaScript from Apple Events is also unavailable. To populate this collection from CONNECT, use the existing browser's normal Free item download control on specific properly licensed items and import the saved files. If a future authorized native-browser automation capability is enabled, respect the site's anti-scraping restriction; do not run a catalog-wide extraction.

## Executed 2026-10-16 acceptance results

- Private local intake created: `~/Documents/EXO Asset Research/CLO-SET CONNECT/manual-downloads/`.
- Private verified collection created: `~/Documents/EXO Asset Research/CLO-SET CONNECT/licensed-library/manifest.json`.
- Manual provenance template created at `~/Documents/EXO Asset Research/CLO-SET CONNECT/metadata-template.json`.
- Live source assets downloaded from CONNECT this turn: **0**. This is not a missing parser count: authenticated browser UI was inaccessible and marketplace-wide data extraction was not performed due to published restrictions.
- `node --test integrations/clo-connect-licensed/library.test.mjs`: 2/2 PASS (dry-run, SHA-256 dedup, ZIP integrity, symlinks ignored, unknown-license staging rejected).
- `node scripts/qa-clo-material-disclosures.mjs`: PASS for Material nested-disclosure structure and group field assignments.
- `node scripts/qa-installed-v2-property-readonly.mjs`: PASS in signed native V2 application after rebuild, including Fabric/Pattern context switch, native Fabric physical controls, independent Basic Parameters and Reflection toggles, and no frontend JS errors. Native Thomas/theo/nora avatar content preserved in signed personal app.
- Saved garment backup before app rebuild: `~/Documents/EXO Asset Research/EXO-V2-Property-Editor-Prebuild-20261016-1838/`.
