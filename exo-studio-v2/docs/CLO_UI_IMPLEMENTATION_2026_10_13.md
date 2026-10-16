# Garment Studio — CLO 3D interface implementation audit

Updated October 13, 2026. Reference: `qa-clo-reference-screen-20261012.png` captured from the user's desktop CLO 3D 7.x application. Current workspace source: `src/App.jsx`, `src/components/CloUI.jsx`, `src/components/GarmentViewport.jsx`, `src/components/PatternEditor.jsx`, `src/clo-interface.css`, and native wrapper `native_app/NativeWebWorkspace.swift`.

## A. Interface inventory and implementation map

| Area | Visible control groups | Status | Code / action |
| --- | --- | --- | --- |
| Native macOS menu bar | File, Edit, 3D Garment, 2D Pattern, Sewing, Materials, Editor, Avatar, Animation, Render, Display, Preferences, Settings, Help | Menu groups implemented in real `NSMenu`; applicable actions call live editor | `installWorkspaceMenu`, `dispatchWebCommand` |
| Within-app menu strip | Matching CLO-style headings and drop-down command menus | Implemented | `CLO_MENUS`, `executeStudioAction` |
| Simulation header | Downward-arrow simulation button; pause; quality mode dropdown; XPBD option | Implemented and wired to existing solver selection; GPU mode visibly disabled | `toggleSimulation`, `applySimulationQuality`, `requestNativeSolve` |
| Library upper icons | Favorites, cloud/avatar context, fabric context | Navigation working, not remote CLO cloud | `LibraryChrome` |
| Library folders | Garment, Avatar, Hanger, Fabric, Hardware and Trims, Material, Stage, Patterns | Listed and selectable; some catalogs are not populated | `LibraryChrome`, `assetCategory` |
| Library assets | Foundation shirt/hoodie/pants/skirt shape thumbnails, fabrics swatches, avatars, hardware actions | Working for available local foundation assets | `GarmentSilhouette`, `applyGarmentTemplate`, `setAvatarModel` |
| Library navigation | Search, grid thumbnails / list, category expansion | Implemented | `librarySearch`, `libraryThumbnails` |
| 3D left tool columns | Orbit, move, hand, sewing guides, wireframe, strain display, pattern select/edit, point/split/curve, internal lines, pin, notch, free sew, fastener, measure, add/remove | Implemented; tools route to current project editors | `tool-rail`, `viewportTool`, `tool` |
| 3D upper-right widgets | Front/back/left/right/top/perspective camera presets | Implemented, live Three.js camera moves | `changeCamera` |
| 3D viewport display widgets | Avatar visibility, floor/grid, sewing constraint guides, mesh wireframe, strain, pressure, hand, orbit | Implemented, view state changes live | `GarmentViewport` |
| 2D editor tools | Transform, point, split, curve, internal line, sew, notch, measure, pin, fastener, add pattern | Implemented using existing pattern data callbacks | `PatternEditor` |
| 2D viewport widgets | Grid, seam visibility, zoom in/out, fit-to-window | Implemented | `PatternEditor` view / props |
| Right panel upper | Object Browser tabs: Scene, Fabric, Graphic, Button, Buttonhole, Topstitch, Puckering, Trim, Grading, POM | Implemented; rows populated from saved project; empty categories explain absence | `ObjectBrowser` |
| Right panel lower | Property Editor with dedicated scroll area | Existing property editors retained; visually separated from Object Browser | `.clo-property-panel` |
| Footer | Simulate/pause, reset, vertex/seam counts, engine state | Existing working engine controls retained | `simulation-bar` |

## B. Actual engine controls vs visual placeholders

**Working controls:** import/export in currently supported project formats; autosave; undo/redo; pattern edits; free edge sewing; avatar models; available fabrics; three.js camera; 2D zoom and grid; analysis overlays; fitting inspector; render still; current local and optional native XPBD simulation; object row selection and property inspectors.

**UI-only or not yet CLO-equivalent:** Animation workspace; advanced GPU solver; original CLO proprietary fabric libraries, icons and exact dialogs; full CLO `*.zprj` project import/export; complete puckering editing; complete CLO asset cloud; native manufacturing grading interface; advanced CLO right/left toolbar context-aware flyouts. Unsupported command menu items are disabled rather than silently pretending to work. Scene is data-driven and some categories are empty until the project contains those objects.

The original CLO app in the supplied screenshot presents multiple specialized and version-dependent functions beyond the visible subset; **visual coverage is not proof of CLO command or format parity**. Our toolbar iconography is an original Lucide/SVG approximation and is not a pixel-exact copy of CLO's proprietary icon set.

## C. Test log

- `npm run build`: **pass**; compiled React production app and stylesheet.
- `node scripts/qa-clo-interface.mjs`: **pass**; 14 menu groups, 10 Object Browser tabs, 8 garment thumbnails, simulation presets, camera, 2D grid, Mac-style menu action. Screenshots: `qa-clo-ui-pass-20261013.png`, `qa-clo-ui-interactions-20261013.png`.
- `xcrun swiftc -typecheck` with AppKit/SceneKit/WebKit: **pass**.
- `INCLUDE_PRIVATE_THOMAS=1 INCLUDE_PREPARED_SOLVES=0 bash native_app/build.sh arm64`: **pass**; native bundle rebuilt; private CLO Thomas avatar and existing prepared XPBD result files remain inside local bundle.
- Opened local rebuilt bundle with `open -n`; observed actual macOS menus and workspace in `qa-clo-native-launched-20261013.png` and `qa-clo-native-settled-20261013.png`. The prior installed app process was not terminated or overwritten.
- `node scripts/capture-pattern.mjs`: **not clean**, reports connection refused on resource requests despite viewport interaction test passing. Treat as separate test-service configuration issue.
- `node scripts/check-foundations.mjs`: **not clean**, `jeans-501` structural strain reported 1291.1%; this is a pre-existing physics/fixture issue, not a UI correctness test and must not be presented as resolved.

## D. Next passes

1. Context-aware flyout groups and customizable docking/reordering for 3D/2D toolbar icons.
2. CLO-quality asset thumbnails with local per-category folder browsing and personalized catalog.
3. Selection-synced object-tree expansion and visibility/lock toggles per pattern/fabric, true hierarchy and drag-reordering.
4. Expand 2D/3D tool modes to include special sewing/editing operations with actual geometry actions, not just static labels.
5. Continue physical fabric, pressure, collisions, and jeans 501 stability work independently of appearance verification.

Keep the original saved screenshot as the primary visual acceptance reference for the next iteration; compare the user-facing running bundle, not only the browser.
