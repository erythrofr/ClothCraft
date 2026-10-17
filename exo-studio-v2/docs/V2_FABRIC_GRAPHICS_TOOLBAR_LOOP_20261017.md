# EXO ClothCraft Studio V2 — fabric, graphics, garment previews and toolbar loop

**Date:** 2026-10-17. **Reference:** the owner's `IMG_6936.HEIC` in Downloads, and CLO's published Material/Property Editor and Graphic (3D Pattern) instructions. This work is a new implementation pass, **not** a claim of feature equivalence to CLO3D.

## Implemented in source

| Area | Implementation | Distinction / gap |
| --- | --- | --- |
| Fabric library hover | Side-by-side flat texture square and interactive drape-over-ball study. Expanded weight, thickness, composition, construction, roughness, color-map, supplier and owner readouts. | Ball mesh represents an art-directed deterministic fold study, **not** a measured Rust solver result or CLOFAB. |
| Native fabric inspector | Selecting a native fabric in Object Browser exposes CLO-style editable fabric information. The native Fabric workspace shows the flat/drape specimen and numeric physical parameters, plus separate color/roughness/sheen/reflectance optical preview sliders. | Seven native cloth physical constants are real edits. Optical specimen sliders are **preview only**; composition data can be unverified. Do not imply preview shader edits update native collision or simulation. |
| Garment library preview | `GarmentLibraryPreview.jsx` and `assembledTeePreviewGeometry.js`: illustrative assembled T-shirt torso/sleeves/collar, default 3/4 VIEW, FRONT and source PATTERN EXPLODED controls proportioned to editable drafting template. | The illustrated assembled surface is not the solver and cannot certify fit, sewing assembly accuracy or manufacturing tolerances. A native installed screenshot succeeded; the torso and sleeve transition still lacks the realism of `IMG_6936`. |
| 2D pattern | `ClothCraftBoardV2`: neutral near-white paper `#f7f8f7` regardless of assigned 3D fabric, no texture or tint on the 2D cutting geometry; compact FR, GR, F, S, C controls at top of the board. | Picking/highlighting and edge details still overlay the neutral paper; changing 3D material must not recolor the cut outline. |
| Graphics | Sanitized SVG/PNG/JPEG import, per-panel front/back/both print-face selection, X/Y position, scale, rotation, visibility and removal. `attachGarmentGraphics` copies native triangulated panel mesh/UV to render a print that follows a deformed snapshot. Local IndexedDB persistence with compatibility migration from prior localStorage layouts. | These are **browser visual sidecar overlays**; Rust's cloth physics, exported factory graphics, full print-colorway hierarchy, proprietary CLO artwork formats, and production-baked texture exports are not implemented. |
| CLO toolbars | Exact stored 70-position reference inventory with 19 positions mapping to verified native action families, 7 inspection-only and 44 unavailable, after addition of session-only 3D mesh-brush selection. | Native-mode badge/action does not imply exact CLO parity. Unimplemented slots are intentionally labeled rather than silently mapped to unrelated tools. |

## Verification and release gates

- `node integrations/clothcraft/check-clo7-native-capabilities.mjs` — native capability mapping contract confirmed with 19 native/7 inspect/44 unavailable at this pass.
- `node --check src/core/nativeGarmentGraphics.js` and `node --check src/core/nativeGraphicStorage.js` — syntax pass.
- `git diff --check` on relevant files — whitespace pass.
- Build validation for edited frontend source passed earlier. Rebuilding/signing current macOS bundle must complete independently.
- `docs/V2_GRAPHICS_WHITE_PATTERN_QA_20261017.md` documents a disposable Rust/Vite browser suite. Both services eventually started on retry, but the isolated front panel failed its readiness condition; the graphic import/render and persistence assertions did **not** run to completion. No honest installed browser end-to-end graphics pass can be claimed from it.
- Early `scripts/qa-garment-hover-20261017.mjs` test-harness navigation failed. Later **installed-bundle** headless Chromium hover QA did succeed, with `previewStatus=ready`, **27 assembled mesh objects**, `previewRenderMode=pattern-derived-tee-assembly` active **by default**, and **zero JS errors**. Native screenshots: `screenshots/v2-assembled-tee-refined-20261017.png` and `screenshots/v2-tee-default-assembled-installed-20261017.png`. Review confirms only partial visual resemblance to the user's target garment.
- `node integrations/clothcraft/qa-v2-toolbar-repair-installed.mjs` — **PASS**, exit 0 on the latest reopened, signed installed V2 bundle, checking Split, Curve, Measure, Camera Fit, Strain on/off, and Select with no page errors. App `/health` reports nativeReady and OGC backend available.

## Following pass — highest priority

1. Make screenshot harness independent from the resource-intensive Vite build process and inspect the real assembled T-shirt at 1440 and 390 against `IMG_6936`. Adjust shoulder/sleeve junctions, collar depth, silhouette thickness and framing based on an **actual rendered screenshot**.
2. Verify SVG artwork upload creates a visible print in the native Three.js garment viewport, including back/side orientation, skin contact and simulated drape, independent of the `data-garment-graphic-count` diagnostic. Reload to validate IndexedDB.
3. Validate native Fabric selected-item property binding, real numeric adjustments and 2D paper color persistence after changing native fabric physical material. Expand signed sample data for composition/width/supplier/owner only when supported by persistent Rust/sidecar schema.
4. Prioritize next 44 missing CLO reference slots by functional production value (texture transformation, graphic placement and print exports; attachment hardware; grading, tech pack, manufacturing), not adding inactive buttons.
