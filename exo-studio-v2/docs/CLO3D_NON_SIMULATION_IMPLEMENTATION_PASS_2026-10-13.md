# Garment Studio — non-simulation engineering pass

Date: October 13, 2026. User requested continuing all non-physics feature gaps identified in `CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md`. No garment simulation settings were intentionally changed.

## Implemented in this pass

- **3D mesh inspect mode:** 3D Column A's previously disabled Select Mesh toolbar control is active. Clicking a garment mesh triangle raycasts the actual Three.js surface and highlights that triangle in yellow, reports its piece/triangle/vertex indices to the selected-pattern Property Editor, and can return to transform without changing patterns or solver particles. This is **single-triangle inspection only**, NOT the advertised full box/lasso/brush multi-selection or mesh editing. Styleline is still planned.
- **DXF interchange:** The exported header now declares `$INSUNITS = 4` (millimetres) and importer source-layer token matching was improved for associating notches, grainlines, buttonholes and internal construction lines with their correct imported pattern. This is not full AAMA/ASTM or CLO project file interoperability.
- **UI regression repair:** Updated the visual QA test to disambiguate the Free Sewing control, tolerate relocated camera UI, and accept standalone SVG `<img>` icons rather than assuming inline `<svg>` geometry. Corrected the toolbar placement regression to expect a now-enabled mesh tool.

## Checks observed

- `npm run build`: PASS.
- `node scripts/dxf-roundtrip-check.mjs`: PASS (four base pattern pieces / unchanged areas, one LWPOLYLINE test).
- `node scripts/check-production.mjs`: PASS (graded sizes, POM, tech pack and cut/notch/grain/internal lines).
- `node scripts/check-factory.mjs`: PASS (multi-size DXF, BOM, marker, ZIP entries).
- `node scripts/qa-clo-interface.mjs`: PASS, 14 menus / 10 Object Browser tabs / 34 right tool icons; errors empty after updating outdated test expectations.
- `node native_app/qa/check-toolbar-placement.mjs`: PASS, two physical strips each side.
- `node native_app/qa/check-toolbar-actions.mjs`: PASS, existing active toolbar interactions.

## Still missing and not claimed as done

The full requested list is a multi-milestone engineering roadmap. Precision multi-point CAD, actual box/lasso/brush mesh selection, editable styleline topology, fully functional Object Browser visibility/lock and hierarchy, high-end trim/puckering editing, industrial-grade marker/grading, AAMA/ASTM round-trip, comprehensive asset management, avatar rigging, path-traced render, animation, and safe AI action infrastructure are **not** certified complete by this pass. No tests here prove complete CLO parity.

## Engineering priorities following this pass

1. Finish 3D box/lasso/brush mesh-selection geometry and connected 3D/2D stylelines with undo and persistence.
2. Finish precise 2D multi-node, snapping, numeric constraints and grade-rule editing with full regression tests.
3. Connect Object Browser visibility/lock buttons to undoable project updates and test filtering/hierarchy.
4. Verify DXF notch/buttonhole/grainline coordinates on irregular pieces and add industrial interchange fixtures.
5. Enhance materials, grading, marker, rendering, animation, asset catalog and AI operation API as separate, testable feature increments.
