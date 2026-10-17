# Stage quality assessment — 2026-10-17

The five featured stage assets are EXO authored scenes. They are not CLO-SET CONNECT assets and visual parity has not been demonstrated. CONNECT's [Creating Scene](https://support-connect.clo-set.com/hc/en-us/articles/45304285204633-Creating-Scene) guidance calls for outward mesh normals, UV unwrapping, image texture resolution near 2048 pixels, appropriate lighting and custom camera views. Public CONNECT examples describe adjustable materials and render-ready lighting.

| Featured room | Verified GLB geometry | UV and embedded texture audit | Main quality gap |
| --- | --- | --- | --- |
| Cathedral | Original imported Blender scene; inspect via `qa-stage-lighting-material-20261017.mjs` | GLB parser checks mesh, material and UV presence | Needs dedicated architecture camera framing and photographic materials |
| R02 Mountain runway | 96 meshes / 96 textured-coordinate primitives, 9 materials, 6 images | Export includes UV for each primitive | Mountain silhouette and distant landscape still stylized |
| R03 Side Molding Mirror | 108 meshes / 108 UV primitives, 8 materials, 5 images | PBR maps embedded | Realistic reflections need a captured HDR environment or true planar reflection |
| S01 Studio scene | 68 meshes / 68 UV primitives, 8 materials, 5 images | PBR maps embedded | Diffusion panels and botanical assets need stronger modeling and photographic surfaces |
| S10 Entrance gate | 65 meshes / 65 UV primitives, 10 materials, 6 images | PBR maps embedded | Sphere-based plants and water need replacement models and reflection technique |

## Runtime pass

The stage-specific live preview now uses a restrained, warm-neutral key with ambient fill, cooler separation light, ACES exposure 0.92 and lower pixel ratio. Its shadow camera covers the full room width, with bias to reduce surface acne; the 768-pixel atlas limits GPU cost. Hanger and avatar lighting remain at their previous levels. Architectural shadow candidates are evaluated using world-space bounds, so rotated props are classified correctly. No additional downloaded assets or render contexts are created.

These changes improve highlight retention and shadow placement but cannot manufacture photorealism from simple scene meshes and 256-pixel procedurally generated image maps. The stage authoring pass should upgrade hero-facing textures to approximately 2048 pixels with consistent UVs and measured roughness/normal maps, replace simple greenery and skyline geometry, and bake or capture licensed lighting as an environment map. A benchmark assessment also requires side-by-side desktop/mobile browser screenshots with the CONNECT reference. That visual comparison remains unverified; shader/context stability beyond source inspection and build checks also remains to be tested in a real browser.

Reproduction: `node scripts/qa-stage-lighting-material-20261017.mjs`, `node scripts/check-stage-scenes.mjs`, and `npm run build`.
