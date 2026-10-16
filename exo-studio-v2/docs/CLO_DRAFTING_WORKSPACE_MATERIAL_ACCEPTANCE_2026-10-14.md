# Garment Studio — CAD, workspace, materials and rendering audit

**Engineering update: October 14, 2026.**

The target is functional CLO3D-class design quality. This is an acceptance
scorecard, **not a claim of completed 1:1 CLO3D equivalence**. Only verified
features and source evidence count as completed.

## 2D drafting

**Implemented and verified this pass**

- Numeric 2D pattern-point editing in centimeters, absolute XY or measured
  distance/angle from the preceding point, with real Undo/Redo persistence.
- Exact editable quadratic Bézier control X/Y or along-chord/depth, straighten
  curve, and adaptive arc-length integration for sewing and edge measurements.
- Analytic line-based point construction: distance along an edge, perpendicular
  offset, project to line, mirror about line, and extended line intersection.
  Degenerate and nonfinite inputs are rejected; original point IDs survive.
- Previous pattern splitting, notches, edge allowances, sewing, grading,
  size-run, DXF and production exports remain available.
- SeamlyMe .smis and .smms read real XML, convert units and preserve graded
  increments; applying body values is a separate optional action that does
  not alter cut patterns and sewing.
- Read-only Seamly2D .sm2d tool-graph reference importer retains tool names,
  original formula strings, IDs, draft blocks and measurement references.
  Tested on real Seamly2D male-shirt sample: 188 tools, 53 formulas and five
  blocks. This is NOT a fully evaluated/imported manufacturer pattern.

**Not yet at 100%:** full Seamly2D formula evaluation/dependency propagation,
advanced precision splines and constraints, geometric validity on every
editing operation, dart transformation and cut/spread, industrial-grade
sew/dimension workflows, and supplier-verified multi-format CAD round-trip.

## CLO3D-inspired interface and workspace

**Implemented and verified this pass**

- Four functional drafting/sewing/material/render workspace presets change
  the actual tool, section, object tab and panel geometry.
- Custom layout save/restore is persisted independently of the project and
  fabric simulation; values are clamped and tool IDs whitelisted.
- Existing dual viewport, tool rails, object browser, visibility/lock controls,
  library, property inspector, macOS menus and draggable panels remain.

**Not yet at 100%:** every CLO toolbar command implemented and tested,
full context-sensitive flyouts and docking, production-grade 3D
styleline/mesh editing, animation controls, complete selection-synced
property semantics and exhaustive keyboard/accessibility parity.

## Textiles, optical materials and rendering

**Implemented and verified this pass**

- MeshPhysicalMaterial PBR fabric with centimeter-scaled procedural
  albedo, normal and roughness yarn maps, plus uploaded map overrides.
- Fiber anisotropy and highlight direction, coating and coating roughness,
  yarn-scale and dye variation controls, alongside existing color, sheen,
  roughness and normal-strength controls.
- Material values persist in the source garment and tech-pack metadata.
- Optical-only adjustments update shader maps and parameters **without
  destroying the running cloth-simulation session**. Mechanical fabric
  or garment geometry edits correctly trigger physics reconstruction.
- Actual Chrome WebGL QA detected normal/roughness PBR textures on all
  four T-shirt panels. A downloaded PNG was checked for binary signature,
  1080×1350 resolution and 422,803 nonempty bytes, with zero JS errors.
- Existing HDRI loading, lighting presets, exposures, shadows and still
  export are retained.

**Not yet at 100%:** certified path tracing, textile reflectance
measurements/calibration, professional light transport and denoising,
render layers/queue, cross-device color-management validation, verified
texture scanning/grain accuracy and varied visual golden-image tests.
Optical appearance controls do not prove realistic physical garment drape.

## Verified checks

- npm run check:drafting-precision — PASS
- npm run check:drafting-ui — PASS (point and curve, undo/redo)
- npm run check:drafting-constructions — PASS (five line operations)
- npm run check:seamly-workspace-materials — PASS (real XML examples)
- npm run check:clo-layout-fabric-ui — PASS (browser layout and import)
- npm run check:render-still — PASS (real PNG and mapped panels)
- npm run check:non-simulation — PASS (production / DXF / markers)
- npm run build — PASS (bundle splitting remains a performance issue)

Seamly2D GPL source was inspected locally, not copied into this program.
The new independent parser uses MIT fast-xml-parser for external XML.
The original app is not a cleared public distribution; license and
proprietary avatar audits are separate requirements.

## Next required milestones

1. Evaluate and preserve full parametric drafting dependency graphs, including
   a reliable supplier-reference Seamly pattern interchange.
2. Finish constraint-solvable CAD geometry and tool acceptance for every
   CLO-inspired toolbar operation.
3. Add physically measured fabric material scans and validated photoreal
   rendering with explicit color-management and frame-output QA.
4. Complete independent native garment fitting before calling rendered
   garment output physically certified.
