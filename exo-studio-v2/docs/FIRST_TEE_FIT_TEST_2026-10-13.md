# Garment Studio · First T-Shirt Fit Test

**Date:** 2026-10-13  
**Reference:** saved CLO 3D interface screenshot `qa-clo-reference-screen-20261012.png`  
**Workspace:** `garment-studio` / Full Workspace

## Delivered

- Selected 3D garment panels have linked Three.js TransformControls **translate** arrows (X/Y/Z) and **rotate** rings (360°). Clicking fabric in Orbit mode reveals Move controls, and there is a Move / Rotate / Orbit switch within the 3D viewport. G/R/Q are shortcuts.
- Gizmo moves and rotations persist as `piece.arrangement3d.stagingOffsetX/Y/Z` and `stagingRotationX/Y/Z`. 2D points and sewing IDs remain intact.
- The Foundation Tee now has four panels: front, back, left short sleeve, right short sleeve. The redesigned sleeves preserve the original sewing-edge indices.
- T-shirt panels stage as **flat** geometry around the avatar, with front in front, back behind, sleeves on either side and y-position adjusted for the avatar neckline.
- Browser XPBD physically initializes particles from the **current pre-sew panel locations** at the first Simulate press. Earlier preview-only blending is bypassed for this backend; user adjustments to staging affect the actual physical starting condition.
- First fit test gets an independent project autosave slot using `?testSession=tee`. Normal existing garments remain saved under the original key. The native app accepts `--tee-test` without overwriting its normal workspace.
- The real macOS application menu supports 3D Garment -> Simulate / Pause, 3D Garment -> Move Garment / Rotate Garment, and existing garment editing commands.

## Test procedure

1. Launch installed Mac app as `GarmentStudioNative --tee-test` (currently installed in `~/Applications/GarmentStudioNative.app`).
2. Select the flat front/back/sleeve panels in the 3D viewport; use Move, Rotate or keyboard G/R/Q to inspect the gizmo.
3. View 2D fabric outlines and the 14 sewing relationships.
4. Start `SIMULATE` from the workspace or native `3D Garment` menu. Observe panels sew/drape from their current 3D arrangement.
5. Pause and inspect the result. Use `RESET` to restore the pre-simulation flat arrangement.

## Verification

| Test | Result |
|---|---|
| Vite production build | Passed |
| Native arm64 build / code signature | Passed |
| Browser E2E: four patterns, 14 seams, panel selection, Move/Rotate, start/pause/reset | Passed: `node scripts/qa-tee-first-fit.mjs` |
| Browser PBD physics baseline regression | Passed: `npm run check:physics` |
| 180 physical frames from flat staged tee | Finite / stable; p95 structural strain approximately 0.372; average sewn-pair gap 0.814 cm |
| Changed sleeve starting positions (translation/rotation) | Finite drape verified in parameter variations |
| Native UI test on CLO Thomas | Simulate, pause via genuine macOS menu tested and screenshot saved |

Browser QA screenshot references: `qa-tee-firstfit-staged-20261013.png`, `qa-tee-firstfit-move-gizmo-20261013.png`, `qa-tee-firstfit-rotation-gizmo-20261013.png`, `qa-tee-firstfit-paused-20261013.png`.

Native screenshot reference: `native_app/qa-native-tee-paused-20261013.png`.

## Known limitations / next fitting pass

1. The first T-shirt is **not production-quality drape**. The upper-body ease is excessive and the shoulder-to-sleeve armhole transition forms conspicuous folds. Investigate cap/armhole seam rest-length balance, seam vertex correspondence, local bending at shoulder seams and avatar-contact surface depth.
2. Native XPBD and browser PBD are distinct backends. The new staged-initialization logic applies to `browser-pbd` only; avoid claiming other backends have equivalent flat-to-drape initialization.
3. Physically measured seam gap remains around 8 mm on average. Do not present this as a fully closed, manufacturing-grade sewing result.
4. 3D simulated garment transformations are currently limited to staged pre-sew Move/Rotate handles and post-sim cloth hand manipulation. More advanced transform constraint workflows can be added in later passes.
5. Existing jeans foundation regression `check:foundations` was observed failing with high local structural strain before this tee-specific change. It is outside this T-shirt test and must be debugged separately.

## Source changes of this pass

- `src/App.jsx`: automatic 3D transform activation; isolated first-fit autosave and native action routing.
- `src/components/GarmentViewport.jsx`: move/rotate controls, correctly seeded pre-sew PBD positions and rendered 3D gizmo.
- `src/data/templates.js`: short-sleeve tee layout, realistic placement relative to avatar and simulation settings.
- `native_app/NativeWebWorkspace.swift`: optional `--tee-test` startup plus native 3D Rotate command.
- `scripts/qa-tee-first-fit.mjs`: browser regression screenshots and interaction checks.

Important: testing was performed on isolated first-fit sessions; no existing user-authored CLO `.zprj` or other garment project file was modified.
