# Garment Studio — non-simulation CLO feature parity program

Date: 2026-10-14. Scope: **all pattern CAD, authoring, grading, sewing specification, garment details, materials, organization and production features**. Excludes cloth simulation and collision solver work. Do not confuse a toolbar icon or static preview with a functional feature.

## Research references

- CLO 2026.1 feature announcements: https://clo3d.com/en/product/features
- Official manual index: https://support.clo3d.com/hc/en-us/categories/115000064648-Manual
- 2D editing index: https://support.clo3d.com/hc/en-us/sections/115000617868-2D-Pattern-Edit
- 2D creation index: https://support.clo3d.com/hc/en-us/sections/115000642008-2D-PATTERN
- 2D annotation and seam allowance: https://support.clo3d.com/hc/en-us/sections/115003578728-2D-Pattern-Information
- 2D toolbar guide: https://support.clo3d.com/hc/en-us/article_attachments/48293801440281

## Implementation order and acceptance criteria

### P0 — production-grade 2D pattern geometry

1. Selection model: piece, multiple pieces, outline point, curve control, edge segment, internal line, notch, seam. Distinct selectable hit targets and context menus. Undo/redo and keyboard shortcuts; lock/visibility respected.
2. Precision drafting: numeric dimensions, point coordinates, tangent control, length and angle constraints, split at true curve arc-length, curve smoothing and continuity, reference guides, grid and snapping. Live measured feedback.
3. Shape editing: mirror, unfold, offset, trace, cut/cut-and-sew, merge, slash-and-spread, dart rotate, fullness and pleats. Ensure ID remapping and sewing, grading, trim and annotation propagation.
4. Non-destructive construction layers: internal polygons/lines, grainline, baselines, dart fold lines, annotations, notches, drill marks, seam allowance with independently editable per-edge width and corners.
5. Sewing specification: segment/free sewing, partial segments, M:N, seam walk, mismatch analysis and notches. Verify all corresponding edge intervals and orientation, independent of simulation.

### P1 — sizes, manufacturing and technical design

6. Grading rules by point/segment, grading review across sizes, measurement-driven pattern drafter, POM measurements and tolerances.
7. Material/fabric library, trims, buttonholes, zipper and topstitch details, print and graphic placement, layering and revisions.
8. DXF-AAMA/ASTM import/export fidelity, marker nesting, fabric direction and shrinkage, plotter preview, size labeling, tech pack, BOM and costing.

### P2 — complete studio workflow

9. Project/library asset browser, searchable commands, customizable toolbars, workspaces, history, autosave and recovery.
10. Avatar measurement editing, static 3D arrangement and view controls, mesh import/export, render materials and image exports (no physics required).

## Existing functional foundation (audit, not parity claim)

`PatternEditor.jsx` supports piece arrangement, point and quadratic-curve editing, edge splitting, notches, internal lines, sewing, fasteners, pins and measurements. Core modules include grading, DXF, production/marker, trims and measurement utilities. Many tools still need precision CAD behavior, complete editing semantics and production-format validation before CLO feature parity.

## Implemented this pass

The 2D editor has a new live **2D QA** panel. It reads actual sampled piece geometry and sewn curve lengths, showing width, height, area, perimeter, and each sewing pair's lengths, delta and mismatch percentage, with selection/focus from the panel. All measurements use centimeters (area cm²), and the panel is explicitly non-simulation. This is an audit/measurement surface, not a claim of complete pattern drafting.

Verification: `npm run build` and `npm run check:non-simulation` passed. The native garment physics pipeline was not modified.

## Next concrete implementation

Precision **segment inspector**: selecting an edge should expose actual curve length, start/end points, tangent/handle and per-edge seam allowance, with numeric edit transactions and undo. Add geometry tests for arc-length, invalid topology, mirrored shapes, sewing ID stability, and DXF round trip. Then implement true internal polygon drafting and slash-and-spread with deterministic sewing/trim propagation.

## Implemented second pass — 2026-10-14

The 2D canvas now supports **direct pattern edge selection** while in Select, Point and Curve tool modes, an orange selected-edge highlight, and an inspector that displays sampled straight/curved edge length (three decimal places in cm), start/end vertex coordinates, and edge shape identity. A numeric **per-edge seam-allowance input** is bounded to 0–8 cm at 0.01 cm precision and writes through the application's normal `mutateProject` history path, preserving undo/redo and save semantics. Locked pieces cannot be edited. The implementation reuses `getEdgeSeamAllowance` and `piece.edgeSeamAllowances` already supported by production and DXF code rather than creating a duplicate source of truth.

Evidence: `npm run build`, `npm run check:non-simulation`, and `node scripts/qa-clo-2d-drafting.mjs` pass. New `node scripts/qa-precision-edge-inspector.mjs` uses the real browser application to select front edge 0, set allowance to 1.37 cm and verify the persisted garment project stores the exact numeric override with no browser errors.

**Remaining after the edge-inspector pass:** direct numeric point/tangent editing and accurate analytical Bézier arc length; piece/edge multiselect; parametric constraint solving; topology-safe cuts and darts; broader manufacturing parity. This statement describes the earlier edge-inspector milestone, not the later point/curve precision pass below.

## Implemented third pass — numeric pattern points and curve controls, 2026-10-14

Jarvis had begun a numerical point editor and quadratic Bézier arc-length implementation. This pass preserves that work and completes the missing **numeric curve editing**. Pattern points accept Cartesian X/Y or a length/angle measured from the preceding point. Curve handles accept Cartesian X/Y or **distance along/perpendicular to the edge chord**; applying either mode creates/updates real quadratic curve geometry. A "Convert to straight edge" operation removes only the selected quadratic handle. All numerical point/curve transactions use document history, not a display-only overlay. Locked pattern pieces disallow changes.

`src/core/draftingPrecision.js` includes a validated chord-coordinate conversion and a precision curve edit function. The arc-length calculation uses adaptive Simpson integration of the quadratic Bézier derivative, and the `project.js` edge-length and seam reporting functions use it. The arc-length checker previously rejected fully valid point objects with extra IDs/metadata; it now validates only x/y numeric fields. Neither manufacturing point IDs nor grading metadata are stripped.

**Evidence:** `node scripts/check-drafting-precision.mjs` tests lengths against independent 10,000-chord integration, exact interval additivity, arc-length fraction inversion, control-coordinate conversion, preserved point metadata, invalid inputs and sewn curve-length updates. `node scripts/qa-precision-point-curve.mjs` uses the live local browser app to create numeric point and curve edits, read back the persisted project, confirm undo/redo, straighten and undo a curve, and assert no browser runtime errors. Existing seam-allowance and 2D drafting UI tests also pass. `npm run check:non-simulation` now includes the numerical drafting test.

**Not yet completed:** robust self-intersection and topology validation of all user-authored pattern changes; explicit tangent G1/G2 continuity constraints; multi-piece sketch relations; true Bézier curve arc-length split with correspondence-preserving sewing and notch mappings; advanced pattern cutting, graded dart rotation and CLO-wide tool coverage. A validated numeric CAD editor is not equivalent to certified factory patterns or fully simulated garments.
