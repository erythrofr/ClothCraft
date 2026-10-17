# EXO Sample 3D shell over ClothCraft's dual view — personal Studio

## Final design correction: reuse the actual EXO interface

The primary Studio route, `?desktop=1&engine=clothcraft`, now mounts the **real `src/App.jsx` EXO interface**. This includes EXO's own menubar, project strip and command field, search and library thumbnail browser, two-column 3D tool rail, two-column 2D pattern tool rail, the right-side vertical tool palette, object browser, category navigator, full property editor, and bottom simulation/status bar. These are the original live React components and button definitions, **not recreations**. The central `.workspaces` area alone mounts `ClothCraftWorkspace embedded`, preserving ClothCraft's original live GPU/Rust-linked 3D garment scene and native 2D drafting board. The old smaller, EXO-inspired seven-category shell remains on `?desktop=1&engine=clothcraft-lab` only as a QA/development fallback.

Primary EXO global actions explicitly bridged to the visible Rust document: top and bottom Simulate/Pause and Reset; top Undo/Redo and Save/Export; original left-hand Free Sewing, point editing, internal line and 3D move/rotate mode selectors; top layout selector; original wireframe/seam visibility; left-bar Duplicate, Mirrored Duplicate and Delete Selected. The project strip and simulation bar show **Rust session** name, panel/seam counts, revision, running state, time, and vertex count while hybrid mode is selected. The center also offers direct Rust step, save, edit and view controls. The full-EXO route without an `engine` parameter remains unmodified and accessible as the independent EXO editor.

**Data boundary still applies:** the full EXO object browser, graphics, production, grading, zippers and other application-specific buttons continue to address the separate EXO document unless a native Rust adapter exists. The installed interface states this explicitly above the views and in the EXO property editor rather than silently presenting incompatible source data as ClothCraft output. No complete project parity or automatic bidirectional synchronization is claimed. The actual full EXO interface is present even when those specialized functions do not yet act on the currently visible Rust cloth.

`npm run clothcraft:qa-full-exo-ui` exercises the original EXO menu/library/two tool columns/right toolbar/inspector/bottom status, both ClothCraft live viewports, a Rust step, global Save, original left-side Duplicate + global Undo, top Simulate/Pause, original sewing and wireframe buttons, a 3D-focus/split layout switch, and the correct limitation notice. It operates on the dedicated QA backend and has no access to the user's installed session.

This personal Mac Studio retains **ClothCraft's coupled 3D garment and 2D material-space drafting board**. The surrounding toolbar, asset browser, workspace categories, project strip, property editor, and rendering chrome use EXO Sample 3D's dark CLO-inspired organization. It is the same Rust session, not an image/mockup of ClothCraft or a second live garment document.

## Accessible categories

| EXO sidebar category | Working now in Studio | Still in the complete EXO application |
|---|---|---|
| Pattern | Linked panel/edge selection, draft primitives, Bézier control points, numeric point edits, mirrors, boolean pieces, duplicate/remove, 3D arrangement | Graded technical patterns, Seamly interoperability, industrial annotations |
| Sewing | Paired edge selection, reversal/easing, boundary lengths/splits, internal sewing lines and ruffle commands | Trims, zippers, multilayer factory construction, edge hardware |
| Fabric | Native physical density, thickness, stretch, shear and bending controls, which feed Rust solver state | PBR texture sets, optical material library, printing, graphics placement |
| Avatar | Show/hide real ClothCraft collision mannequin; mesh diagnostics | EXO/Thomas avatar chooser, mesh retargeting, fit-measurement controls |
| Fit | Real Rust VBD + OGC simulate/pause/step/reset, seam gap, p95 strain, contact count | Other physics backends, actual certified body fitting |
| Production | Editable fitting project JSON, current simulated cloth OBJ, explicitly **reference-only** material-space SVG | Manufacturing DXF, size grading, technical packs and production markers |
| Render | Real avatar/seam/wireframe toggles, split/3D/2D view modes | HDRI, full material rendering and optical presets |

The **Full EXO** link switches to the complete existing EXO interface without inventing working Rust adapters for its other systems. It does **not** automatically transfer or merge the current ClothCraft document. Use compatible file exports for controlled manual interchange; no full bidirectional EXO ↔ ClothCraft editable-document parity is claimed.

## Interaction design and reliable checks

- Seven EXO-style categories are selectable from both the left icon rail and top workspace selector. The corresponding right property editor shows actual implemented controls rather than a list of fake tool buttons.
- The searchable asset browser has Pieces, Seams, Library and History tabs; selecting a panel highlights it in both original ClothCraft views. Selecting a seam can reveal its linked boundary. Presets open explicitly after confirmation when a document already exists.
- The top toolbar keeps existing selection, sewing, pen, internal line, 3D transform, simulation, native single step, undo/redo and reset commands. The new color and layout controls change actual Three.js scene state.
- `npm run clothcraft:qa-workspace` validates native 2D/3D authoring, undo, simulation, persistence and sewing selection.
- `npm run clothcraft:qa-exo-shell` validates every EXO sidebar category, actual primitive creation, undo, seam tool availability, physical fabric controls, avatar visibility, real Rust step, rendering toggles, 3D focus/split layout, downloadable OBJ and reference SVG and sidebar collapsing. Both browser tests run through a dedicated QA service and do not edit the installed app's saved garment.
- `npm run check:non-simulation` independently covers the original EXO production/DXF and drafting workflow; `npm run build` covers both route-specific entrypoints.
- Installed app smoke was repeated after signing: `5286` served the hybrid UI, `5285` served the Rust session API, the seven categories rendered, both viewports stayed live and the existing saved fitting project reopened without errors. The app's native backend was the real GPU VBD + CPU OGC build.

### Standalone Mac launch reliability

The installed Studio initially displayed a restored macOS window but its localhost servers did not come up. Investigation isolated an Apple Silicon runtime packaging problem: the original, validly signed Node Foundation executable received `SIGKILL` (exit 137) **only when launched from this particular app's `Contents/Resources/bin/node` path**, though the byte-identical executable ran normally from `/usr/local/bin/node` or a private Application Support path. The macOS Swift launcher now clones the bundled signed Node runtime on first use to `~/Library/Application Support/EXO-ClothCraft-Studio/Runtime/node` (or if the bundled runtime changes), then launches that local copy. No remote installation, network dependency, or subscription is needed. The native Rust executables remain inside the signed application bundle. Startup events are recorded in `~/Library/Logs/EXO-ClothCraft-Studio/startup-trace.log` to diagnose failures without user-visible blank windows. The AppKit delegate is also explicitly held alive for the event loop.

The SVG export uses known boundary vertices in millimeters from ClothCraft's UV/rest-space layout. This is a simple graphical reference rather than a validated, print-to-scale factory pattern; no AAMA/ASTM/DXF manufacturing compatibility is implied. The OBJ export is the current simulated vertex/face geometry, not a fitted-ready item.

## Installed applications remain separate

- `EXO ClothCraft Studio.app` — the hybrid EXO shell + Rust authoring/simulation + ClothCraft dual-view UI. Bundled on `5286` (local UI), `5285` (native Rust service).
- `EXO Sample 3D ClothCraft.app` — complete original EXO controls and opt-in Rust bridge, without replacing its main application.
- `ClothCraft.app` — upstream native Rust/egui editor without EXO shell changes.

Private user-owned Thomas avatar files stay outside Git. This hybrid Studio's persistent Rust document currently uses ClothCraft's provided MakeHuman surface. Thomas is **not** claimed to work in the persistent hybrid authoring session until the selected visible avatar and the Rust contact collider share a verified transformation and mesh.

The two views and their underlying Rust simulation/data model are not rewritten by the shell. Their original limitations remain: solver contact has no friction, collision certification is absent, and one engineering fixture's seam-gap improvement is not proof of industrial fit. The 6-second dress result remains outside acceptable sewing closure.
