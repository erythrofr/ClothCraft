# Garment Studio native application status — October 13, 2026

## Confirmed running on Blender Mac

The current private ARM64 build lives at `~/Applications/GarmentStudioNative.app` on the Blender Mac. It is a **standalone macOS app**, defaulting to a bundled WebKit version of the existing full React/Three.js garment workspace. Screenshot QA confirmed that the full 3D garment with the local CLO Thomas GLB (original textures and hair), 2D pattern editing workspace, left garment/template library, right inspector, main toolbars and sewing lines render simultaneously. This full workspace is bundled in `Contents/Resources/web/`, and does not require Safari, Vite, the Blender Mac tunnel or network access for basic UI rendering. The native backend/server and other integrations may still require services for special features.

`Full Workspace` is **the existing Three.js/React system inside WebKit**, not a native Qt 6 interface or a completed CLO3D clone. `Native XPBD Preview` is a separate AppKit/SceneKit engineering sandbox, reachable via a button in the full workspace, with a return button.

## Changes in this engineering pass

- Added `NativeWebWorkspace.swift` with a local custom resource scheme to serve bundled React assets offline and preserve the complete 3D/2D UI.
- Added `NativeSolver.swift` to load prepared results from the existing C++ XPBD CLI, validate finite particle positions and expose fitted-state interpolation, seam residuals and strain readings.
- Added `NativeGarmentGeometry.swift` for area-weighted triangle vertex normals; repaired and resized the native 3D/2D split and a 2×2 pattern layout.
- Native preview now has Thomas OBJ view (private asset), panel selection and visibility, 2D and 3D seam guides, dropdown to inspect named seam links, exploded arrangement, sewing correspondence animation and fitted snapshot animation.
- Updated `build.sh` to compile Swift for architecture (`arm64` / `x86_64`), bundle four garment fixtures, finite precomputed XPBD snapshots and the full built web workspace. Local Thomas GLB/OBJ assets are included only when `INCLUDE_PRIVATE_THOMAS=1` is set.
- Added a one-time CLO Thomas avatar bootstrap to the private desktop workspace, without replacing the rest of the existing project in local storage.
- Verified real running app screenshots on Blender Mac: `native_app/awake-full-ui.jpg`, `native_app/native-two-pane-qa.jpg`, `native_app/native-seam-selected-preview.jpg`, `native_app/final-full-workspace.jpg` (local QA files, not distributed).
- Used macOS UI automation to successfully switch between full and native views, change the native sewing dropdown to `Shoulder L`, and click `Reset Fit` / `Simulate Fit`; screenshots of the fitted-state preview differed from reset. Exact realism remains incomplete.
- `npm run build`, `bash native_app/build.sh arm64`, `bash native_app/test_bundle.sh arm64` passed.

## Important remaining gaps

- **Not CLO3D-equivalent:** the current displayed default T-shirt fit is boxy/incorrect at shoulders and chest even though Thomas textures and both editors render.
- The native app shows **precomputed solver snapshots**; it is not a continuously interactive live native cloth simulation. `Sew Preview` in native mode is a visual panel-motion guide, not physical stitch closure.
- Native physics still use an analytic avatar collision proxy, **not CLO Thomas's precise deformable body mesh**, so numerical fitting cannot be expected to match visual Thomas.
- Native solver exhibits significant seam error/strain. The tee's finite 90-frame result reports average seam distance **~8.2 mm**, peak structural strain **~123%**; quality hoodie and zip-hoodie simulation become numerically unstable if solved too long. Packaging falls back to shorter finite results (**70 and 60 frames** respectively) rather than including nonfinite geometry.
- Native 2D editor is mesh inspection with seam correspondence, not the full parametric CAD editor. The full desktop WebKit mode contains the existing, richer parametric editor.
- No Qt-native cross-platform UI yet; Windows/Linux not implemented or tested. Licensing and public third-party asset audits still pending. CLO-derived Thomas assets must not enter a public release without appropriate rights.

## High-priority next engineering stages

1. Turn the C++ solver into a validated, platform-independent streaming library (or process protocol) with guarded time steps, divergence detection and replayable frames, not just endpoint snapshots.
2. Build a **pose-aligned Thomas body mesh BVH/SDF collider**, with explicit collision penetrations and correspondence to garment rest positions. Fix geometry alignment, pattern scaling and initial pre-sew placement.
3. Implement a true seam-constraint activation schedule and physics-based sewing convergence, with reliable contact and energy metrics.
4. Move the full CAD and viewport functionality behind a platform-independent Qt/C++ kernel/UI while preserving existing project data and the proven React experience. Add automated native GUI interaction/image checks, Windows/Linux CI and installers.

## October 13 — desktop UI fidelity and control regression pass

- Removed the redundant AppKit header above the embedded 3JS workspace: the desktop window now uses the **same complete header, tabs, tool rail, library, 3D/2D split, inspector and simulation footer** as the existing React UI, with no duplicate chrome taking away editing space.
- Moved the separate native XPBD engineering preview and reload into the macOS `Workspace` menu. Verified both `Workspace > Native XPBD Preview` and `Workspace > Full 3D + 2D Workspace` change the real running Blender Mac window.
- Added a desktop-only UI style (`?desktop=1`) with larger type, better contrast, clearer selection and spacing, consistent pane sizing and more legible inspector controls. The browser-only view remains unchanged.
- Added `native_app/qa/check-desktop-ui.mjs` to assert the seven main tabs, seven asset-library categories, 19 primary controls, nonzero dimensions of all eight key UI regions, successful hand/orbit tool selection, sewing inspector, pattern add/delete, save, simulation start/pause/reset and no JS errors. Headless Chrome test **passed** at 1440×900. Visual screenshot `native_app/ui-polish-desktop.jpg` confirmed the actual installed macOS application matches the 3JS layout.
- Rebuilt and installed the self-contained private arm64 desktop application to `~/Applications/GarmentStudioNative.app`; it is open in Full Workspace mode on Blender Mac.

**Not yet validated:** every deep inspector action and actual production CAD correctness. UI controls are present and representative stateful actions work, but CLO3D-level sewing, pattern accuracy and live native solver parity remain separate tasks.

## October 13 — CLO-style arrange → sew → simulate workflow

The full Three.js desktop workspace now opens each sample garment as **flat, undeformed 3D panels** arranged around the avatar, using the existing 2D triangulation and stable seam particle correspondence:

- The front panel is staged in front of the torso, the back panel behind it, the left/right sleeves outside the arms, and trouser front/back panels in front of/behind each leg.
- The 2D editor always retains the same pattern geometry. Sewing relationships defined by the 2D Sew tool appear as orange correspondence lines in both 2D and 3D. Links are sparse by default, and choosing a seam with the `WALK` action isolates/highlights it.
- The **3D Move** tool can drag a flat panel to adjust its pre-sew location; the staged XYZ offsets are persisted separately from the physical fitted arrangement. The Pattern inspector also exposes Flat X/Y/Z.
- `SIMULATE` is an explicit operation: it starts cloth dynamics and blends the staged view toward the solver's body-fitted pose. `PAUSE` preserves the pose. `RESET` stops and restores flat 3D panels with their saved offsets and visible sewing links.
- A drafting change resets to the pre-sewing arrangement. Showing or editing seams does **not** automatically trigger a simulation.

**Current physics limitation:** Pre-simulation panels are accurate planar display geometry, but the solver's initial particle positions are still initialized from its analytic wrapped-body placement; the move from staged to simulated appearance is interpolated before the live PBD fit settles. To achieve true CLO-grade assembly, the next backend milestone must start physics from the *actual flat spatial arrangement*, gradually activate seam constraints, solve self/avatar collision during stitch closure, and converge before draping. Thomas remains visual-only for collision.

Validation: `node scripts/check-staging.mjs`, `node native_app/qa/check-staging-workflow.mjs`, and `node native_app/qa/check-drag-stage.mjs`; tested default T-shirt and straight pants, seam selection, simulation/pause/reset, 3D panel dragging and browser page errors. Production build, browser PBD physics and partial seam regressions also passed.

## October 13 — 2D/3D selection, transform gizmos and UI usability pass

The packaged Full Workspace now supports click-to-select fabric panels in either viewport with synchronized selected-piece state across the 2D editor, 3D viewport, Pattern inspector and right Object Browser.

- Added Three.js `TransformControls` with actual colored **XYZ translation arrows** and **3D rotation rings**, selectable using the 3D Move/Rotate tools. Dragging saves editable `stagingOffsetX/Y/Z` in meters or `stagingRotationX/Y/Z` in degrees on the selected pattern piece. The gizmo is active during the flat pre-simulation arrangement phase, and disabled during simulated cloth draping. Key shortcuts: G move, R rotate, Q/Escape orbit, Space simulate/pause, Cmd+S save, Cmd+Z undo; shortcuts do not interrupt text editing.
- Added live highlighting for selected fabric, yellow/blue panel boundary and material emissive cue, synchronized 2D pattern emphasis and outliner row, selection information overlay, and 3D raycast to switch the selected pattern piece.
- The 2D drafting canvas now uses a slate-gray high-contrast drafting background, off-white/light-blue fill, cyan selected outline, stronger sewn-edge orange, and clearly legible labels/nodes.
- Added `FOCUS` selected piece and `FIT ALL` that account for overlay tool columns, so pieces are not clipped under the right 2D buttons.
- **TIDY** is a user-initiated 2D layout action, not automatic or destructive. It packs saved pattern bounding boxes in spaced rows, refits the view and preserves all 2D piece geometry, curve controls, 3D transforms and sewing constraints. Existing saved manual arrangements are not silently overwritten.
- Pattern editing begins with 2D sewing correspondence hidden to avoid a web of lines over the shapes; choosing Sewing shows them again. SEAMS toggle overrides within each section.
- CLO-style menu `3D Garment > Rotate selected pattern` activates 3D rotation gizmo; other sidebar controls, library search, simulation popover, wireframe/strain/sewing toggles, and toolbar states have been audited.

**Validation:** passed `npm run build`, `npm run check:physics`, `npm run check:partial-seams`, `npm run check:avatar`, `node scripts/check-staging.mjs`, `node native_app/qa/check-transform-and-2d.mjs`, `node native_app/qa/check-toolbar-actions.mjs`, `node native_app/qa/check-tidy-drafting.mjs`. The 3D rotation gizmo drag persisted an actual ~26.65° Y rotation; the X-axis translation drag persisted an ~0.11 m stage movement. The 2D drag persisted the pattern's layout position. TIDY test found 0 overlapping 2D pattern pairs, with all 14 sewing constraints and four pattern shapes unchanged. Chrome tests reported no JavaScript errors.

**Deployment:** private, self-contained Apple Silicon app compiled and bundle-verified, reinstalled to `~/Applications/GarmentStudioNative.app` and relaunched on Blender Mac. Verified only the installed app process was running; took real macOS desktop screenshot `native_app/qa/installed-2d-final.jpg`, confirming Thomas, full UI, newly legible pattern view and TIDY/FOCUS/FIT ALL buttons.

**Still not CLO3D parity:** Real cloth deformation is the existing XPBD solver using analytic collision; the pre-sewing panels are a visual flat staging arrangement; the 3D transform gizmo only manipulates those flat staged pieces, not deformed live cloth. Some advanced menu items remain planned, and an exhaustive pixel/performance/accuracy qualification of every deep tool is unfinished.

## October 13 — detailed CLO-style tool and right inspector iteration

Reference visual reviewed: user's actual CLO 7.0 screenshot `qa-clo-reference-screen-20261012.png` (no proprietary assets copied). Garment Studio app rebuilt/installed at `~/Applications/GarmentStudioNative.app` on Blender Mac. Installed screen verified `native_app/qa/clo-final-installed.jpg` (private QA only).

**Implemented frontend:** 42 left toolbar button positions, 34 right palette slots (33 UI actions enabled, 1 true physical sew-from-flat action intentionally disabled), full-height right 2-column icon bar, wider ~398px inspector at 1530px window, larger 106×99 fabric preview including GSM, thickness and warp/weft stretch, two-row Object Browser tabs with text labels, scrollable selected-pattern Property Editor with numeric area/perimeter/vertex/seam/fabric properties, warp/weft shrinkage and thickness. Subdivision level is labeled honestly, not called exact millimeter particle distance. Circular camera axis widget tracks the actual orbit direction and snaps to preset views; selected piece still uses XYZ move and rotation rings. Top-left simulation dropdown selects fast/balanced/fitting/native quality; original top-right control retained. User-selectable top workspace tabs preference persists in local storage and has Preferences menu action.

**Verified:** `npm run build` PASS; `node native_app/qa/check-major-clo-ui.mjs` PASS (42 left, 34 right, 1 disabled, full height, tabs toggle, top-left modes, orbital preset, selected properties and no JavaScript page errors), `node native_app/qa/check-transform-and-2d.mjs` PASS, `node native_app/qa/check-staging-workflow.mjs` PASS, private arm64 native app build and test bundle PASS, actual installed app process PID 66796 inspected visually.

**Physics warning:** `npm run check:physics` passes numeric test yet reports 8.1mm mean seam gap and 176% max local stretch. `npm run check:avatar` currently FAILS for 160cm avatar with ~1346% strain. Advanced physical sewing from spatially flat panels, exact Thomas collision mesh, collision-safe GPU/CPU simulation and true millimeter particle-distance meshing are not finished. New research/acceptance plans: `docs/GARMENT_SIMULATION_NEXT_GEN.md` and `docs/CLO_UI_TOOL_INVENTORY.md`. Do not claim CLO3D physics or total command parity. Current visible 76 icons are an independent reference implementation, not extracted CLO proprietary assets.
