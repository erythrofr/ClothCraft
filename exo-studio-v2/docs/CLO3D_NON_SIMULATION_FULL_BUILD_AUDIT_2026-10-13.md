# Garment Studio vs CLO3D: whole-application gap audit (excluding cloth simulation)

Date: 2026-10-13. Scope: repository `src/`, `native_app/`, `scripts/`, `docs/`, production/export modules. Excludes solving/draping/cloth-body contact quality. This is a source/feature and bounded automated-test audit, **not** a certified parity review of every CLO version or an exhaustive interactive end-to-end test.

## Evidence and test results

- `npm run build`: PASS.
- `node scripts/check-production.mjs`: PASS.
- `node scripts/check-factory.mjs`: PASS.
- `node scripts/qa-clo-interface.mjs`: FAIL, selector ambiguity (`getByRole('button',{name:'Free sewing'})` now matches two buttons). This is a UI test reliability issue, not proof that sewing is broken.
- `node scripts/check-grading.mjs`: unavailable / missing script; grading has an implementation in `src/core/grading.js`, but that test command did not verify it.
- Existing detailed implementation and inventory reports: `docs/CLO_UI_IMPLEMENTATION_2026_10_13.md`, `docs/CLO_UI_TOOL_INVENTORY.md`, `docs/CLO_ICON_VISUAL_AUDIT_2026-10-13.md`, `docs/CLO_DUAL_COLUMN_TOOLBAR_PLACEMENT.md`.

Status terms: **Foundation** = usable core with substantial missing workflows; **Partial** = limited subset or UI-to-inspector only; **Absent/unverified** = no validated complete implementation found in inspected code. None means CLO parity.

| Category | Current evidence | Gap / next acceptance target | Priority |
|---|---|---|---|
| Precision 2D CAD | `src/components/PatternEditor.jsx`; select, edit points, split, curve, internal line, notches, measure; DXF import/export | Complete Bézier/arc precision, point/segment constraints, symmetry, true cut/spread/slash, dart manipulation, nested pieces, keyboard dimension input, multi-selection and precision snapping | P0 |
| 3D mesh/styleline editing | `src/App.jsx` 3D rail: Select Mesh and Edit Styleline are explicitly disabled/planned | Implement actual 3D mesh selection (box/lasso/brush) and editable stylelines, preserve mapping to 2D patterns and undo | P0 |
| Sewing authoring (not physics) | Seam links, free sewing, edge correspondence and 2D/3D guides | Edit seam direction, partial/segment sewing, match lengths, seam allowances and seam walk interaction; robust editing and undo tests | P1 |
| Toolbars and workspace | Two tool rails, object and property panes, menus, camera and view widgets | Correct CLO visual ordering and semantics, flyout variants, context-sensitive tool state, docking, persistence of workspace layouts; avoid proprietary icon copying | P1 |
| Object Browser | Ten tabs: Scene, Fabric, Graphic, Button, Buttonhole, Topstitch, Puckering, Trim, Grading, POM (`src/components/CloUI.jsx`) | Real hierarchy, visibility/lock, drag ordering, search/filter across objects, multi-object editing; Puckering and several object types have shallow actions | P1 |
| Property Editor | Pattern/fabric/avatar/seam/production inspectors | Complete selection-specific editors, per-object validation, batch edits, true CLO particle-distance-in-mm control instead of subdivision surrogate | P1 |
| Fabrics and appearance | Fabric GSM, thickness, shrink, warp/weft controls, texture/graphics, rendering | Measured physical fabric library, texture transform UV workflow, PBR layers/normal/roughness, calibrated color management and swatch persistence | P1 |
| Trims, graphics, stitching | `src/core/trims.js`, zippers, buttons/buttonholes, topstitch, graphic and trim object rows | True editable 3D hardware placement, realistic geometry, customizable stitch types, trim libraries, production metadata, puckering authoring | P1 |
| Grading | `src/core/grading.js`, size offsets and size-run generation | Point-level rules and rule tables, linked/nested size runs, size-specific seam checks, industrial grading import/export, golden fixture tests | P1 |
| Marker making | `src/core/marker.js` placement and marker reports | Grainline/nap constraints, fabric defects, stripe/plaid matching, multi-size and multi-ply marker strategy, verified material utilization | P2 |
| Manufacturing / tech packs | `src/core/factoryPackage.js`, `src/core/measurements.js`, BOM/POM, graded DXF, marker reports, HTML and ZIP | More robust grading tolerances, annotations, construction detail, versioned approvals, vendor round-trip and verified export fidelity | P1 |
| File interchange | Local garment project, DXF, OBJ/GLB export, factory ZIP | No validated native CLO `*.zprj` round-trip; assess AAMA/ASTM DXF interoperability, curve/notch/metadata fidelity, import warnings and round-trip fixture coverage | P1 |
| Avatar tools | Avatar options, CLO Thomas asset and measurements, viewport transforms | Dedicated avatar editor, pose library, custom rig import, motion retargeting, skin/measurement precision, avatar accessory management | P1 |
| Rendering | Still capture, environment and resolution settings | Studio-grade PBR lighting/camera presets, shadows and fabric microdetail, render queue and batch output, verified consistent color output | P2 |
| Animation | Animation menu/workspace scaffold | Keyframe/timeline editing, motion import, clips, export, pose-to-animation workflows; no validated full implementation found | P2 |
| Asset library | Garment/fabric/avatar/trims categories and local thumbnails | Complete reusable asset catalog, import tagging, folders, previews, filtering, versioning and project relinking | P2 |
| Automation | `src/App.jsx` command parser implements narrow verbs (widen %, crop cm, seam allowance, fabric weight, simulate/reset) | Typed action API for *all* editing commands, schema validation, preview/rollback, agent-driven multi-step projects, regression tests | P1 |
| Project reliability | Autosave/undo/redo and native wrapper; current production build passes | Comprehensive tool acceptance tests, migration/versioning, crash recovery, project round-trip, keyboard shortcuts, accessibility, QA on native bundle | P0 |

## Recommended order (outside simulation)

1. **P0 CAD correctness:** establish editable topology, exact numeric geometry, reliable undo/redo, selection, snap and DXF round-trip. This is the foundation for every downstream feature.
2. **P0 real 3D tool implementation:** replace disabled mesh selection and styleline controls with real operations that propagate to 2D and persist.
3. **P1 editing completeness:** sewing graph editor, trims/topstitch/puckering, Object Browser and Property Editor semantics.
4. **P1 production reliability:** grading, marker, tech packs and DXF import/export acceptance fixtures; do not equate existence of a generator with factory-level certification.
5. **P1 automation and QA:** expose safe, reversible typed operations for AI and users; test every toolbar command against model mutation, undo, save/load and 2D/3D synchronization.
6. **P2 presentation ecosystem:** material library, avatar authoring, high-quality rendering, animation, asset management and customizable workspace.

## Verification contract

For each CLO comparison tool, log `implemented`, `partial`, `planned` or `unsupported`, link source function and screenshot, then test: click -> intended model mutation -> undo -> redo -> save/load -> 2D/3D sync -> DXF/production export if applicable. Include numerical geometric checks, not only browser screenshot assertions. CLO version and toolbar personalization must be recorded for any 1:1 comparison. Do not silently activate placeholder buttons or imply a full feature from a tab or menu label.
