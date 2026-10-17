# EXO ClothCraft Studio V2 — visual, material and toolbar loop

**October 17, 2026 — source and isolated-browser verification.** The most important distinction in this loop is between actual native Rust garment edits, rendered visual studies, and reference-only CLO tools. All tests described below use local disposable workspaces rather than the installed user's saved project.

## Implemented and verified

- **Selected native fabric:** The right inspector now has a stable visible portal that follows a selected Fabric object. Its side-by-side flat swatch and over-ball sample uses the actual Three.js preview cloth mesh. Seven independent physical inputs/slider controls apply native Rust material commands; construction, supplier and owner are editable native metadata. Optical roughness, color, reflectivity, yarn normal strength and sheen are separate preview studies, not fake native physics.
- **Fabric drape visualization:** A 270 cm rendered textile sample, over a presentation sphere, with generated or licensed texture maps, directional lighting, shading, observable folds and drag-to-rotate view. It is a **deterministic visualization informed by estimated mass/bending**, not a solver-certified fabric-ball drape calculation identical to CLO3D.
- **3D garment artwork:** SVG/PNG/JPEG import with validation; graphics mapped on the selected front/back panel's Rust-derived UV mesh; editable panel, face, X/Y, scale and rotation; local IndexedDB persistence after reload and separate artwork JSON export. Graphics do **not** enter native Rust project save, factory packages or physical cloth simulation as ink thickness.
- **2D cutting pattern color:** The 2D drafting viewport remains white/neutral irrespective of material color and printed graphics in 3D. This keeps sewing, measurements and contour points legible.
- **Compact 2D navigation:** Front/Grid/Frame All/Selected/Center bar visually coordinates with the compact 3D orientation bar.
- **Garment preview:** The Library's T-shirt example uses actual source template panel polygons and seam references, triangulated into a curved Three.js construction study, with 3/4, front, and gathered presentation choices. This is a preview of source pattern geometry, **not an assembled and physically solved garment**. Reference: local user-provided `IMG_6936.HEIC` shows a full front T-shirt and an oblique garment view.
- **Toolbars:** The CLO7 reference registry enumerates all 70 positions. Current source audit: **19 native actions**, **7 inspect-only**, **44 still unavailable**; unavailable tools remain explicitly described rather than fabricating working commands. Prior independent native 2D sewing/polygon, notch/allowance, Undo and Save tests passed. The complete 44-gap, priority and acceptance matrix is in `docs/V2_RIGHT_TOOLBAR_NEXT_44_GAPS_20261017.md`.

## Executed acceptance evidence

| Test | Result | Evidence |
| --- | --- | --- |
| Graphics editor, SVG upload, X/Y/scale/rotate, unchanged white drafting panels, IndexedDB reload and zero JS errors | **PASS 6/6** | `docs/V2_GARMENT_GRAPHICS_BROWSER_QA_20261017.md` and `integrations/clothcraft/output/qa-v2-garment-graphics-U575Xc/results.json` |
| Fabric selection, Three.js over-ball mesh, 7 inputs, native material edit, native Undo, white 2D panels, supplier metadata | **PASS 7/7** | `docs/V2_FABRIC_INSPECTOR_STATIC_QA_20261017.md` and `integrations/clothcraft/output/qa-v2-fabric-static-hJBXvP/results.json` |
| Native fabric notch + seam allowance add/remove/save/Undo/Redo and original cloth pose preservation | **PASS** | `docs/V2_NOTCH_ALLOWANCE_QA_20261017.md` |
| Graphic import/JSON/UV validation | **PASS** | `node scripts/check-garment-graphics.mjs` |
| Native CLO7 capability order and declared modes | **PASS** | `node integrations/clothcraft/check-clo7-native-capabilities.mjs` |
| React production bundle | **PASS** | `npm run build` — 1890 transformed modules, latest reviewed bundle at `dist` |

### Shared-fabric edit semantics verified

When one panel edits a material shared with another panel, native Rust `Command::Fabric` makes a new fabric record for the selected panel unless `all_panels` is true. Browser QA verified the selected front panel changed from 200 to 201 g/m² (`woven-reference` to `fabric_1`, native revision 0→1) and Undo returned its original assignment. The original shared material correctly stayed unchanged; the initial test checking the old ID was corrected, not worked around in product code.

## Still required for CLO3D parity

1. Native editable artwork objects, factory/exported print placement, and direct 3D artwork handles, rather than an IndexedDB/renderer-only sidecar.
2. True solver-based calibrated fabric-on-ball drape, repeatable measured weight/bend/stretch inputs, multi-condition validation and calibrated 3D lighting/textures. The present visual ball is not equivalent to that measurement.
3. Physically assembled, fit-certified template preview matching real sewn-shirt drape rather than only art-directed curved panels. Current native solver still labels fit unverified.
4. Complete native patterns/tools for the 44 unavailable positions, emphasizing Trace, Walk Pattern, topstitch and native graphics first. Each tool must pass actual edit, Undo, Save and Reopen tests before being marked available.
5. Additional requested production-property groups (editable fabric roll width, thread structure and optical channels) must be added as typed fields with truthful save/solver semantics. They are not all first-class Rust physical properties today.

## Signed macOS V2 release validation

The existing guarded `bash integrations/clothcraft/macos/build-workspace-v2-app.sh` process finished after rebuilding Rust, compiling the latest Vite web assets, and replacing the signed app in `~/Applications/EXO ClothCraft Studio V2.app`. The newly built app was reopened successfully. Checked:

- `/usr/bin/codesign --verify --deep --strict` — **PASS**.
- Native backend `http://127.0.0.1:5385/health` — **HTTP 200**, `ok: true`, `nativeReady: true`, `rustCheckoutReady: true`.
- Installed web bundle `http://127.0.0.1:5386/` — **HTTP 200**; installed minified bundle contains new `garmentGraphicCount` rendering integration.
- `node integrations/clothcraft/qa-v2-toolbar-repair-installed.mjs` — **PASS**, `installedBundle: true`, `authoringUnchanged: true`, Split, Curve, Measure, Camera Fit, Strain on/off and Select, zero JS errors.

The broader graphics 6/6 and fabric inspector 7/7 checks were run against disposable native Rust workspaces rather than the user's installed garment. Neither the source build nor these tests establish CLO-level fit certification or completion of all 70 toolbar functions.
