# EXO V2 fabric photographic map calibration — 2026-10-17

## Verified catalog evidence

The source audit `node scripts/audit-400-fabric-scans.mjs` verifies 400 catalog presets and 201 hash-checked map files (three channels for each of 67 licensed CC0 sources: 37 Poly Haven and 30 ambientCG). **67 distinct installed scans are not 400 distinct scans.** Of 400 presets, 385 share photographic scan references, while 15 have procedural appearance fallbacks. Only 44 distinct scans are referenced by the 385 presets. There are 165 related-family proxy assignments; 135 presets flag source optical review, and 105 carry illustrative physical repeat scales. All 400 presets use estimated rather than measured mechanical parameters; scanned normal and roughness channels do not establish real mechanical drape, weight, thickness, or stretch.

## PBR pipeline

Photographic albedo is regraded into a chosen simulated dye colorway and tagged `THREE.SRGBColorSpace`. Normal and roughness textures are explicitly `THREE.NoColorSpace`; roughness uses the source green channel, matching Three.js. All three photographic channels use one shared centimeter repeat and identical wrap modes. The retained procedural fallback textures are labeled and generated as approximations, with tiled fiber-relief maps rather than claims of physical scans. The independent `textileProcedurals.js` normal and roughness canvases use `NoColorSpace` and their albedo uses `SRGBColorSpace`.

The roughness adjustment previously mapped its mean to 255, clipping all yarn values brighter than average. It now maps the mean to 230 (~0.90) with a symmetric bounded offset, retaining fine source contrasts in both directions. This is appearance grading, not recovered measured microfacet roughness. The native material's photographic color fallback was adjusted to avoid a white tint when canvas processing is unavailable for a washed colorway; the normal and roughness remain as authored where an image cannot be accessed for grading.

## Current limitations / quality bar

The quality improvement applies to balanced reflected textile texture and graceful original-image fallbacks. A physically faithful material needs construction-specific scanned specimens, tested tiling and actual size, measured mechanical inputs, measured BRDF/specular response, and evaluation under controlled calibrated lighting. For the 165 family proxies and 105 illustrative repeats, do not advertise exact material matching. Browser image authorization and actual shader output require independent screenshot review; this pass validates the code invariants and source hashes without making photorealism claims.

Reproduce: `node scripts/qa-fabric-map-calibration-20261017.mjs` and `node scripts/audit-400-fabric-scans.mjs`.
