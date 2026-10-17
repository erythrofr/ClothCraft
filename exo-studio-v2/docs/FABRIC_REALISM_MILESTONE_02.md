# EXO Fabric Realism — Milestone 02

## Left Fabric library

The left Library's **Fabric** category now opens the complete existing EXO catalog in both the EXO draft editor and `?engine=clothcraft` Rust workspace. Browse all 400 presets, search by name/family/provider, filter by construction family, expand details for provenance, and scroll inside the library viewport independently of the garment work area. The 385 scan-backed presets show lazily loaded photographic thumbnail references; the remaining 15 retain procedural thumbnails. Rows defer off-screen layout work to keep scrolling usable.

The **default EXO draft editor** can add a chosen preset as a swatch, apply it to the selected pattern, and display its maps in the Three.js material viewport. The **Rust ClothCraft workspace** can currently browse and inspect these EXO records, while its native physical materials remain governed by the Rust Fabric inspector. Browsing an EXO preset does not silently overwrite native solver parameters.

## Surface rendering improvement

- Three.js garment and independent material preview now preserve up to 1024 pixels of installed source color/roughness maps during optical regrading (previously capped at 768 px). This keeps fine scan weave variation from being discarded before upload.
- Repeating photographic maps now use trilinear mipmaps and 8× anisotropic filtering, improving angled and draped textile views.
- The independent material preview has stronger controlled lighting and rim definition for dark fabrics, without modifying real fabric photo data or physics.
- Color, tangent-space normal and roughness remain coordinated with the selected catalog fabric. Real-centimeter UV repeat metadata is used for mapped EXO garment panels, but source scan physical repeat may be an illustrative placeholder.

## Fabric evidence and sourcing

The repository already contains **67 unique CC0 scan sets** (37 Poly Haven + 30 ambientCG), each with color, normal and roughness, or 201 verified image files. These are referenced by **385 of the 400 presets** through construction and finish variants. Only 15 presets rely on procedural appearance. This is not a claim of 400 independently photographed textile specimens, true fiber identity, or measured stretch, bending, shear, friction and density.

See `src/data/fabricTextureLibrarySources.js` and `docs/FABRIC_TEXTURE_SOURCE_AUDIT.md` for installed source IDs, optical proxies, license terms, and restrictions. LotPixel and Poliigon commercial/free textures cannot be bundled as redistributed editable library assets under their ordinary licenses; ShareTextures also restricts collection/plugin redistribution. TextureCan explicitly publishes CC0 assets but no unreviewed images were downloaded in this iteration.

## Acceptance

```sh
npm run build
npm run qa:fabric-sidebar
npm run qa:fabric-showcase
node scripts/qa-400-fabric-ui.mjs
node scripts/check-fabric-realism.mjs
node scripts/check-400-pbr-balance.mjs
```

Latest local Chrome acceptance: 400 selectable catalog entries in both editor modes, a 420-pixel-tall independent left scroll viewport, successful search/apply in EXO draft mode, and a working 390-pixel-wide viewport library. WebGL preview and assigned garment maps passed without missing scan requests or JS exceptions. The entire desktop-oriented CAD workspace still has horizontal document overflow at 390px and is not claimed to be mobile-native.

## Further fidelity work

Photograph or scan actual named textiles at higher resolution with a ruler and calibrated color target. A true silk specimen, ribbed cotton, verified nylon ripstop, and washed leather require material-matched sources rather than appearance-family proxies. Use physical test evidence to calibrate warp/weft curves, bending, shear, thickness and friction for the specific textile, then compare physical drape photographs with the solver. Do not infer measured physics from normal or albedo maps.
