# Garment Studio — native CLO-class CAD and simulation architecture

Status: engineering architecture and migration plan, 2026-10-12. **Not** evidence that the proposed native application or accurate avatar collision exists. Preserve the existing working JavaScript application as the baseline.

## Executive decision

Build a **native desktop Garment Studio** with **Qt 6 / C++20** for the primary CAD GUI and deterministic geometry/constraint core, a native **Metal** rendering and compute path on Apple Silicon, a separate fast native **XPBD** garment simulation service, and a higher-fidelity **contact/FEM refinement** backend. Keep Blender as a downstream 3D production/rigging/rendering integration, **not** as the sole CAD/solver system of record. Keep the React/Three.js UI temporarily as an interoperable frontend, automation/test harness and remote preview; Three.js itself is not the physics error.

Use one renderer-independent **canonical garment document**: construction geometry, dimension formulas, curves, seam-edge references and ranges, stitch/ease treatments, allowance paths, fabrics, material calibration, trim definitions, avatars, arrangements, cached mesh/solve results and revision/undo graph. Pattern edits must invalidate derived triangulations and stitch pairs without losing identifiers. Define stable units (cm drafting, meters world, millimeters production), axis/handedness and tolerances at the API boundary.

## Audit: what is already here and why output differs from CLO

- `src/core/project.js` stores pieces/curves; `src/components/PatternEditor.jsx` provides SVG drafting, grading views, seam allowances, internal lines, notches, manual pins and trims. Construction constraints and parametric history are incomplete.
- `src/core/physics.js` triangulates via Three.ShapeUtils and subdivision and implements JS PBD contact/stitching. `src/core/backends/` already exposes replaceable backends, a native XPBD service and `ppf_backend` research adapters. These are valuable foundations, not validated CLO-equivalent fitting engines.
- `src/components/GarmentViewport.jsx` displays the CLO-exported Thomas GLB, but **collision still uses a measurement-driven analytic proxy**. This body mismatch, inappropriate initial poses, solver instability/strain and seam discretization directly explain why a garment can appear in the wrong shape despite an apparently correct visible avatar.
- Existing regression `npm run check:physics` on the default tee reports settled mean seam distance ~0.0081 m and maximum structural strain ~1.76 (176%); `npm run check:avatar` across 160–200 cm body variations reports peak strain 146.8–237.9%. These are problematic for physical credibility, even if the checks currently pass. Measure and fix them, not just their appearance.
- Current 2D sewn edges and 3D topstitches do not constitute CLO's linked 2D-to-3D stitching inspector, pre-sew 3D arrangement, sew animation and finished drape workflow. An initial visual correspondence/exploded preview was added separately; **it does not change cloth topology**.

## Native system split

| Subsystem | Recommended implementation | Why |
| --- | --- | --- |
| Host desktop UI | Qt 6 Widgets/QML plus C++20, with Python scripting/automation bridge | Mature low-latency dockable GUI, precise input, native packaging, background tasks |
| Parametric 2D CAD | Double-precision C++ geometry core; Qt graphics canvas for interactive vectors | Exact document, robust snapping/dimensions, industrial edit affordances |
| Geometry operations | Clipper2 for validated polygon offsets/intersections; specialized Bézier and arc intersection/offset solvers; optionally CGAL per audited license | Robust seam allowance and topology, consistent curve and corner treatment |
| Pattern mesh generation | Constraint-aware adaptive triangulator with boundary vertex control (Triangle/libigl where appropriate and license-checked) | Preserve seam correspondence; refine locally near darts, curves, collisions; no arbitrary subdivision |
| Stitching graph | Stable edge ID + arc-length interval + orientation + notches + ease/gather ratio; barycentric correspondence where tessellations differ | 2D edit propagates deterministically into 3D solver and guides |
| Interactive garment solver | Native C++ XPBD on CPU first, Metal GPU acceleration after numerical parity and profiling | Responsive pre-sew manipulation, stable constraint projection, seam closure and fabric bending |
| High-quality solver | Existing PPF Contact/FEM investigation behind job-based adapter | Robust body/garment/self-contact and measured material accuracy; slower final verification |
| 3D viewport | Native Metal on Mac (or tested QRhi abstraction for cross-platform), PBR textures, wireframe/strain/pressure modes | Predictable render pipeline and GPU memory; renderer independent from solver |
| 3D production | Blender bridge (`blender_bridge`) for rigs/poses, UVs, Eevee/Cycles, animation and final rendering | Reuse mature authoring ecosystem without making Blender the pattern document |
| Interchange | DXF/AAMA and ASTM patterns when licensed/tested, OBJ/GLB/USD for meshes; documented versioned JSON/FlatBuffers IPC for project/solve | Vendor interoperability and future UI backend migration |

**Alternative evaluation:** Building the entire app as a Blender add-on gives much faster 3D scene editing, but Blender's edit modes, Python integration and own cloth physics do not automatically provide accurate sewing-edge parameterization, contact calibration or industrial grading. A Blender add-on should be a companion and fast prototype, not the only engine. A standalone Qt/C++ app costs more engineering effort but offers a better long-term CLO-style dual viewport. Rust/wgpu is viable, especially for platform portability; on the current Apple-Silicon-centered workflow, C++20/Qt/Metal is the shortest reuse route for existing native XPBD/C++ and macOS ecosystem. A Qt frontend with an isolated Rust geometry or services module remains possible if benchmarking justifies it.

## The essential interaction model

1. **Pattern construction:** true lines/segments/arcs/Béziers, dart transformations, slash/spread, pleats, parametric measurements, formula-driven grading, cut/trace/walk, symmetry, linked mirrored pieces, layer and annotation system. Precisely constrained points with undo/redo. Dimension system in cm/mm/in with non-destructive manufacturing tolerance.
2. **Seam editor:** click seam A and B with distinct edge ranges and orientation; show 8–32 correspondences in 2D and 3D, live path lengths and mismatch coloring, notch matching, reverse/facing rules. Validate ambiguous T-junction and partial seams. Include seam type, fold lines, topstitch and allowance IDs.
3. **Arrangement:** separate **flat 2D layout**, **3D pre-sew placement** (actual rigid transform per pattern panel, axis gizmos and arrangement points around avatar), **exploded inspection** (display-only, invertible transforms), **stitch/closure animation** (physical constraints ramp on over time), **fitted drape**, **inspect pressure/ease**, and **final render**. Treat these as explicit states; never mix display explosion transforms into simulated particle coordinates.
4. **Direct manipulation:** grab cloth via picked triangle+barycentric coordinates and kinematic constraint; solver continues using stable pinned goals, with damping and release ramp. Move/rotate entire *unsewn* pattern as a 6DoF rigid pre-positioning transform; move an already-sewn piece only with a deliberate temporary pin/transform operation.
5. **True mesh collisions:** derive Thomas collision mesh from the actual exported GLB body mesh, excluding hair/clothing/shoes, recompute posed/skinned geometry, validate normals/manifold orientation, make SDF/BVH + capsule fallback, compare anatomical landmarks and measurements against garment arrangement. Use continuous collision/contact thickness, self-contact and penetration reports. Never silently claim exact fit while the proxy is in use.
6. **Photorealistic textile rendering:** physically meaningful thin-shell thickness, UV grain direction, dual-layer normals, calibrated roughness/sheen, material tiling, correct transparent/opaque depth ordering; export passes to Blender Cycles/Eevee for marketing renders. These controls do not substitute for physically correct drape.

## Recommended development phases and acceptance gates

### Phase 0 — establish a reproducible accuracy baseline (1–2 weeks of focused work, estimate)
- Capture CLO3D Thomas standing pose and target garment front, side, back, measurement tables, native simulation frames and reference seams. Export unclothed avatar GLB, body measurements and matched fitted garment OBJ/GLB from CLO. Confirm CLO render includes no garment contamination in the body asset.
- Establish per-frame 2D/3D landmark errors in mm, seam-edge lengths, missing/extra intersections, penetration fractions, garment surface-to-body distance, strain distribution, solve wall time and memory; use **identical cloth patterns and avatar pose**.
- Set provisional limits: zero NaN/nonmanifold outputs; average seam distance <5 mm except intentional treatments; collisions with >3 mm penetration <0.1% of cloth vertices after settled state; p95 strain <10% for rigid denim except controlled deformation. Targets to be calibrated by fabric and references; do not use universal thresholds blindly.

### Phase 1 — CAD and sewing fidelity (3–6 weeks, estimate)
- Build stable parametric point/curve graph and unit-validated construction functions, snapshot and mutation tests; true 2D→3D panel/seam identity. Define deterministic constrained triangulation with max edge length and curvature adaptive refinement.
- Full seam graph and 2D/3D correspondence inspector; arc-length matched sewing for partial/ranged seams, mismatch validation, clickable linkage and notch alignment.
- Separate saved arrangement transforms from solver-ready initial positions. Add editing modes, views and real selection history. Use SVG only for preview while replacing the CAD kernel; Qt later consumes the same document.

### Phase 2 — correct avatar contacts and production-quality XPBD (4–10 weeks, estimate)
- Extract Thomas **body** mesh and skin weights from CLO-exported GLB, cache unit/pose/LOD, build BVH/SDF. Use cloth surface normals plus two-sided collision thickness and thigh/crotch-specific contact logic. Compare silhouette/body measures with CLO references.
- Refactor physics into native C++20 library callable from headless CLI and controlled service; expose deterministic frame stepping and solver diagnostics. Add robust strain/stretch/shear/bending/seam constraints; benchmark CPU single/multi-thread before Metal port.
- Add self-contact and layered cloth intersections; explicit seam closing animation; cloth manipulation as safe kinematic constraints. Test loose/gather/elastic/zipper edge cases.

### Phase 3 — native desktop app + Metal pipeline (6–12 weeks, estimate)
- Qt 6 GUI with resizable 3D viewport and precision 2D canvas, outliner, seam browser, cloth presets, property inspectors, selection sync and navigation shortcuts. Use native renderer abstraction, Metal backend on Mac. Wire same canonical project to app and headless server.
- GPU solver only after validated CPU reference parity (numerical tolerances and collision invariants). GPU optimize contact broadphase, BVH/SDF sampling and constraint batches; guard GPU memory and recover from device loss. Profile actual Apple Silicon unified memory instead of promising GPU speedups.
- Deliver macOS app bundle, notarization path, signed updates only after tests; keep web UI optional, not the source of truth.

### Phase 4 — calibrated FEM and production validation (ongoing)
- Integrate isolated PPF solver for high-quality final drape; only after license and third-party audit. Calibrate measured fabric parameters from strip, bias, bending and friction tests. Compare with CLO as a *reference*, not reverse-engineering proprietary internals.
- Blender plugin for outfit scene assembly, rig/pose sync, material transfer, garment animation and production-quality render/export. Add automatic DXF/size grading, markers, tech packs and measurements regression.

## Performance budget (targets, not measured promises)

- 2D pan/zoom/select: <=16 ms per UI frame for common documents with 50–200 patterns; high DPI and dense seams tested at 1000+ points per garment.
- Interactive CPU/Metal XPBD: aim 30–60 fps at defined 5k–20k cloth vertices on the target Mac with avatar collision on, with adaptive quality. Publish hardware, cloth size, contact rate, time-to-stable fit and energy/power for all benchmarks.
- Non-blocking heavy jobs: no CAD event-loop blocking; background solve process and shared-memory/structured result transfer; cancel/pause/resume controls; explicit progress and error boundaries.
- Multi-LOD: draft mesh 5–10 mm typical edge length (adapt by curves/notches), fine fit refinement and final render subdivision independent from physical solver. Confirm bending stability under remeshing.

## Quality, testing and licensing

Test geometry with property-based cases (near-tangent curves, reversed seam IDs, intersections, zero-area darts), 2D layout snapshots and pattern roundtrips; cloth with deterministic CPU fixtures, stress cases for tight denim/arms/crotch/pockets and cross-backend comparison; compare fitted garment screenshots and Hausdorff/signed distances to actual CLO references. Preserve stable file format and provide migration tools. Use crash-safe autosave and human-readable version history. Integrate CI on macOS Apple Silicon and Linux headless; ship optional plugin boundary rather than injecting code into CLO.

**Licensing gates:** Qt LGPL/GPL/commercial terms and linking policy; CGAL module-specific GPL/commercial terms; Clipper2 license; Seamly2D GPL; Triangle license; PPF Apache with incomplete transitive dependency audit already noted in `docs/ARCHITECTURE.md`. Do not merge unreviewed GPL libraries into a proprietary binary. Proprietary CLO avatar/model assets must stay local and not be redistributed automatically.

## Near-term order of work

1. Save existing Garment Studio state and add reference fit fixture (CLO Thomas matched garment, no exported extra clothing), including exact measured pose and garment edges.
2. Correct garment mesh triangulation and boundary/seam pairing; expose 2D + 3D seam links and display-only exploded preview immediately. Make mismatch/strain reports visible.
3. Replace analytic collision contact with posed CLO Thomas body mesh or validated mesh-SDF/BVH; this is the critical blocker for exact drape. Do not claim visual render matching equals physical matching.
4. Measure XPBD solve error and profile CPU; only then migrate to native C++ core and Qt/Metal. Preserve the web interface as optional remote dashboard.

**Decision:** native Qt/C++ app + high-quality native cloth solver + Metal + Blender companion is the most coherent end state; not simply a Three.js rewrite, not exclusively a Blender add-on and not a blind assumption that a different renderer produces more realistic garments.
