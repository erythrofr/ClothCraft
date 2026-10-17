# IMG_6936 reference update — EXO ClothCraft Studio V2

2026-10-17. Supersedes earlier “image missing” status for the garment reference only. Original IMG_6936.HEIC found in Downloads; converted to PNG for inspection without modifying original. The CLO-SET fabric reference remains a separate task.

## Actual visual interpretation

Reference shows unsewn, semi-curved front/back torso panels placed in depth around an implied body, separated partly rolled sleeves, white/neutral cloth and dark presentation background. Front and side views expose the panel arrangement. It does not depict a flat side-by-side drafting layout or a completely sewn shirt.

## Applied

- `GarmentLibraryPreview.jsx`: all tee preview camera views now use the reference arrangement; default three-quarter, Front/Side controls; clean neutral material, reduced bump/sheen; stitch/style overlays optional and initially hidden; no generic assembled-tee mesh.
- `garmentPreviewGeometry.js`: bowed torso front/back in depth, partially cylindrical sleeves; source boundaries preserved. Stitch/edge paths sampled in rest coordinates before posing and rendered as piecewise paths instead of overshooting splines. Continuous differential normals prevent rolled-sleeve lighting seams.
- `scripts/qa-reference-garment-hover-20261017.mjs`: focused reference-mode QA with camera/view, rotation, details and viewport bounds assertions.
- Pre-edit backup: `docs/qa/reference-hover-20261017/before/`. Installed index backup: `docs/qa/reference-hover-20261017/installed-before/`.

## Verification/delivery

Build passed. Component and full Library UI tests passed at 1440×900 and 390×844, no page errors. Final tests against installed app's loopback UI endpoint `http://127.0.0.1:5386` passed, using a separate browser test session. Ready diagnostics: 8 meshes, 3743 triangles, 4 source panels, 38 source edges. Rendered three-quarter and side screenshots inspected.

Installed `EXO ClothCraft Studio V2.app` web assets updated additively; index replaced atomically after backup, code signature renewed and verified. No solver/native executable rebuild, project replacement, process restart or forced reload. Open app must use View → Reload Workspace (Command-R) to load new JavaScript. Verification was against installed web assets in Chrome, not a fresh screenshot of the already-open native WebKit window.

Curvature is presentation geometry, not a physical solve. Existing template loading/mannequin placement and native simulation semantics are unchanged. Other garment families retain their existing source-derived panel presentation; the photo-specific body/sleeve arrangement is for the tee template shown in the reference.
