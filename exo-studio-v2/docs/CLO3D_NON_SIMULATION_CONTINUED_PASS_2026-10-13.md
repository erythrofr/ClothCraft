# Garment Studio — continued non-simulation engineering pass

User scope: implement everything still unfinished relative to CLO3D *other than clothing simulation*. This is a multi-milestone roadmap, so document tested completed increments separately from remaining capabilities. Preserve existing user projects and PPF native solver.

## Independent completed increments (this pass)

- Added `scripts/check-dxf-construction-fidelity.mjs` to check a realistic round trip for four T-shirt pieces plus non-axis-aligned grainline, rotated buttonhole and internal fold, including exact coordinates, length, angle and pattern area tolerances. PASS.
- Added an aggregate `npm run check:non-simulation` script, covering pattern DXF round trip, detailed DXF construction fidelity, graded production, factory package, markers and mesh inspection selection behavior. PASS.
- Built production frontend with `npm run build`. PASS. These are source/runtime checks, not certification against CLO.

## Prior recent work retained

- A selectable 3D cloth-triangle inspector with non-destructive highlights and additive face selection.
- DXF unit declaration (`$INSUNITS=4`, mm) and source-layer associations for construction features.
- UI reference/toolbar regression checks refreshed for modern SVG assets and new tool labels.

## Still open until independently validated

- Full professional CAD constraints, complete box/lasso/brush and styleline authoring, editable hierarchical scene tree with persistent locks/visibility, advanced trim and puckering authoring, material library, AAMA/ASTM industrial-grade export, comprehensive nesting, avatar rigging, animation, render farm, asset indexing and project-wide AI editing action schema. Existence of a tab or isolated test is not complete feature parity.
- All user project file edits and local garment solver are preserved. No complete CLO3D parity has been claimed.

Current acceptance checks: run `npm run check:non-simulation` and `npm run build`. For UI tests run `node scripts/qa-clo-interface.mjs`, `node native_app/qa/check-toolbar-placement.mjs` and `node native_app/qa/check-toolbar-actions.mjs` against the existing live Vite server before native repackaging.
