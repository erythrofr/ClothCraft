# EXO V2 stage quality loop — 2026-10-17

## Scope and reference

The curated stage catalog exposes cathedral, R02, R03, S01, and S10. The Blender rooms are original EXO assets inspired by CLO Connect's presentation standards; no CONNECT meshes or textures were copied. The current GLBs have 96 meshes / 6,344 polygons (R02), 108 / 5,288 (R03), 68 / 3,486 (S01), and 65 / 3,468 (S10). The cathedral is a separately supplied MIKRISTIAN Blender scene.

## Runtime change

`src/core/createStageEnvironment.js` now enables shadow casting on up to fourteen of the tallest substantial room objects. Every mesh can receive shadows. Horizontal floors, thin caps, and tiny trims are omitted from the shadow pass. The scene records `shadowCasters` and `meshCount` for diagnostic inspection. This restores spatial depth to large props and panels in the same directional-light setup used by the garment and library viewers, with a fixed draw-call bound. The cathedral receives the same bounded strategy. Loader callbacks after a stage has been disposed now release embedded material textures as well as the geometries and materials; empty GLB geometry also gets disposed.

## Qualitative acceptance review

| Stage | Design intent | Authored asset status | Runtime shadow handling | Gap to high-end CONNECT presentation |
| --- | --- | --- | --- | --- |
| Cathedral | Gothic architectural interior | Separately supplied source GLB; asset read at runtime | Bounded structural shadow casting | Requires in-view camera and exposure comparison; source scale and hero framing may vary |
| R02 | Mountain runway | Refined authored room, 96 meshes, six embedded maps | Up to 14 substantial casters | Mountain geology/mist remain stylized; no volumetric fog |
| R03 | Molding and mirror gallery | Refined authored room, 108 meshes, five embedded maps | Up to 14 substantial casters | True optical mirror reflections are unavailable in current raster path |
| S01 | Botanical studio | Refined authored room, 68 meshes, five embedded maps | Up to 14 substantial casters | Plants still use simplified geometry; photographic softboxes need rendered review |
| S10 | Garden entrance | Refined authored room, 65 meshes, six embedded maps | Up to 14 substantial casters | Water and vegetation require finer physical shaders and models |

## Validation and release bar

Use `node scripts/check-stage-scenes.mjs` to verify the manifest and GLB headers, `node --check src/core/createStageEnvironment.js` for syntax, and `npm run build` for integration. Browser-level visual acceptance still requires opening the five curated stages on desktop and mobile and comparing visible shadow definition, face exposure, stage frame composition, and garment visibility against the current posters. A successful build and structurally valid GLBs alone do not establish photorealism. The broader manifest tracks 15 available authored GLBs, but only these five are curated in the stage catalog; five original-source candidates remain unavailable due to inadequate geometry.

## Second loader pass: material response and grounding

Inspection of the GLB PBR data found `Mat | mirror` in R03 with 0.03 roughness and no authored metallic factor, `Mat | water surface` in S10 with 0.43 metalness and 0.10 roughness, and polished metal on R02/R03 with 0.92 metalness and 0.21 roughness. These surfaces need usable reflected lighting rather than very dark unlit metal. The loader now tunes only those recognized material names: R03 mirror metalness 0.90, roughness 0.09, environment response 1.35; S10 water metalness 0.08, roughness 0.12, environment response 1.20; polished metal minimum roughness 0.23, environment response 1.15; brushed brass/anodized minimum roughness 0.34, environment response 1.05. Existing texture maps and color data remain intact. These response adjustments require the viewer's environment map to display reflections; they cannot create planar or screen-space reflections.

Grounding: floor and low horizontal surfaces continue receiving the viewer's directional shadows. In addition to the 14-caster cap, enclosing meshes wider than 7 m and taller than 2.5 m no longer cast shadows, avoiding large room walls darkening the garment and foreground. `userData.adjustedMaterials` and `userData.shadowCasters` expose measurable per-stage counts. No duplicate ground plane was inserted because these GLBs already include authored floors; stacking a second floor risks z-fighting and hides source floor details. The loader does not override global ACES exposure or lights because those are shared with garment rendering and managed by each viewer.

## Missing source assets for photographic parity

| Stage | Specific missing source data before photoreal parity |
| --- | --- |
| Cathedral | Calibrated PBR surface scans (stone albedo/normal/roughness), measured fixtures and a reliable camera/garment scale anchor |
| R02 | High-resolution natural rock displacement/normal maps, mountain backdrop or environment plate with image rights, depth-aware atmosphere/fog |
| R03 | Reflection probes or a real-time planar reflection implementation plus accurate mirror panel thickness, normal map and environment HDRI |
| S01 | Botanical plant meshes with leaf translucency and varied leaf normal/roughness maps; accurate softbox diffuser emission profiles and studio HDRI |
| S10 | Realistic leaf/branch meshes and translucency maps, physically measured water depth/normal variation and reflection source, outdoor HDRI/environment plate |

The current GLBs use mostly lightweight 256 px procedural base-color maps and simplified geometry. None supplies the complete high-resolution physically measured material set or reflection/illumination data above. CLO Connect visual parity cannot be claimed from these inputs; runtime tweaks can improve tonal response and contact readability but cannot synthesize the missing scene detail.

## Third loader pass: shadow framing and reflective elements

The bounded caster selection now favors substantial geometry closer to the avatar at the origin, with an inverse distance weight on top of the existing projected-size heuristic. Mirrors, water, luminous strips and translucent meshes are excluded from the shadow-caster candidates: opaque shadow maps otherwise render these presentation surfaces as dark obstructions. Those meshes still receive shadows and retain their authored materials. `userData.skippedNonStructural` records the count excluded on material grounds for diagnostics. The ceiling remains **14 casters per room**; no extra lights, meshes or texture fetches were added. Final visual approval requires captured comparisons in the V2 viewer because neither GLB inspection nor a bundle build proves the resulting floor/contact-shadow appearance.
