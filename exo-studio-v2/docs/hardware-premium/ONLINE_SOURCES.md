# Online hardware source verification — October 17, 2026

The premium library currently includes three new **original procedural** models: D-ring, hinged single-prong buckle and tri-glide strap adjuster. These models are already available in the product with PBR materials, static Blender preview images and live GLB hover inspection. They are not represented as third-party downloads.

## Identified external candidates

1. [Ashley Jay Thornton / AshleyJay — Buckle, Sketchfab](https://sketchfab.com/3d-models/buckle-51be72dc58d4437bb3dfc408c751344d) — official listing says **downloadable under CC Attribution**, 5,500 triangles / 2,700 vertices, made in Blender/Substance Painter. Appears suitable for a future physically detailed buckle variant. The site's model download requires its supported download flow; no files were retrieved via bypass or scraping. An imported version must preserve author, model URL and CC BY credit.
2. [3DAssets.dev — Quick Release Buckle](https://3dassets.dev/assets/backpacks-and-expedition-storage-quick-release-buckle-54f0fdd6) — listed as **CC0 1.0**, 432 triangles, 72 × 17 × 65 mm with two materials and an explicit direct [GLB URL](https://cdn.3dassets.dev/assets/21104/v1/model.glb). This is a low-poly outdoor quick-release variant, not a high-detail polished metal buckle. Retrieval was attempted using the advertised public CDN URL but the connected Mac returned `Could not resolve host: cdn.3dassets.dev`; this asset has **not been imported**.
3. [Pixor — Belt](https://pixor.art/library/armour/belt/) — direct CC0 low-poly belt GLB, 248 triangles, appropriate as a reference or placeholder, below EXO's premium metal-detail threshold. Public GLB download request was not completed in the current environment. The underlying belt form would also need isolating the buckle mesh before reuse.

Listings with **NoAI**, NonCommercial or NoDerivatives restrictions were excluded. Third-party assets with unverified downloads have not been mislabelled as installed.

## Quality gate for a future imported source

Verify the author and commercial reuse license on the original listing; download through the official channel; save author URL/license with file hash; ensure the GLB actually contains the promised buckle or ring; inspect from front and side for connected tongue/hinge, true rounded metal section and acceptable topology; normalize millimetre dimensions, center the model, render against the EXO dark studio and verify the file loads through the library hover. Only then enable it in `hardwarePresets.js`.
