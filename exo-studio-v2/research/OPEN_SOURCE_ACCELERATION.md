# Garment Studio — Open-Source Acceleration Plan

## Goal
Use mature open-source garment/cloth/3D components to accelerate Garment Studio toward CLO-class capability while keeping one canonical garment document, one UI, and clean license boundaries.

## Core architecture

Garment Studio document model remains authoritative for production semantics: patterns, curves, seams, allowances, notches, grading, trims, materials, POMs, marker settings, BOM and factory export.

Backends become swappable:

1. **Blender platform** — desktop shell, scene, mesh editing, viewport, Eevee/Cycles, rigging, animation, cameras, UV/materials, import/export.
2. **Seamly2D external CAD backend** — mature formula/measurement-driven drafting, construction history and dependency graph.
3. **PyGarment / GarmentCode** — parametric sewing-pattern generation and higher-level pattern operators.
4. **Native PBD/XPBD backend** — low-latency cross-platform fitting using MIT PositionBasedDynamics concepts/library.
5. **PPF Contact Solver backend** — high-fidelity FEM/contact solve for final drape and penetration validation.
6. **XRTailor backend** — CUDA quality/throughput solver for NVIDIA Windows/Linux systems.
7. **HOOD / ContourCraft backend** — optional neural animation/multi-garment intersection backend.
8. **ReMu import service** — optional image-to-layered simulation-ready garment reconstruction.
9. **MakeHuman/MPFB avatar path** — CC0 detailed body visualization followed by measurement-to-morph integration.
10. **Garment Studio production engine** — grading, markers, DXF, tech packs, factory packages and AI/Jarvis API.

## Repository ranking

| Project | License / risk | Best use | Priority |
|---|---|---|---|
| Blender | GPL | Application shell, mesh/scene/render/animation/avatar infrastructure | P0 |
| Seamly2D | GPL-3.0+ | External parametric pattern-CAD backend; formulas, construction history, measurements, drafting operations | P0 |
| GarmentCode / PyGarment | MIT | Parametric pattern CAD, panels/edges/interfaces/stitches, garment generators | P0 |
| PositionBasedDynamics | MIT | Cross-platform XPBD/strain/bending/deformable solver foundation | P0 |
| PPF Contact Solver | Apache-2.0 | High-fidelity FEM cloth/contact backend; penetration-free final solves; Metal/CUDA/ROCm/CPU | P0/P1 |
| MakeHuman / MPFB core graphical assets | CC0 assets; code licenses reviewed separately | Detailed fitting avatar, morph-target/measurement pipeline, Blender avatar authoring | P0/P1 |
| XRTailor | Apache-2.0 core; third-party licenses require module review | High-end CUDA cloth, anisotropy, self-collision, automatic dressing, SMPL(X), GLTF, Alembic/OBJ | P0/P1 |
| NVIDIA Warp (official current) | Apache-2.0 core; NVIDIA third-party terms for some binaries | GPU compute framework / simulation experiments; CUDA on NVIDIA, CPU/macOS available | P1 |
| HOOD | MIT code; model/body/data licenses separate | Fast learned garment dynamics | P1 |
| ContourCraft | MIT code; CUDA collision/body/data dependencies separate | Multi-garment intersection handling, learned layered animation | P1 |
| ReMu | MIT core; vendored/model licenses separate | Image -> layered simulation-ready garment import | P2 |
| GarmentMeasurements | GPL-3.0 | Body shape sampling and measurements; usable inside GPL Blender path or as reference | P2 |
| DrapeNet | GPL-3.0 + SMPL/model dependencies | Neural garment generation/draping research | P2/reference |
| Gaussian-Garments | non-commercial/research notices in source + restricted dependencies | Photoreal garment reconstruction/appearance research reference only | Reference only |
| GarmentLab | no clear top-level license in cloned repo; includes NVIDIA-licensed code | Isaac/PhysX garment manipulation benchmark and physics reference | Reference until permission clarified |
| awesome-cloth-simulation | curated index | Discovery map for papers/code, not a runtime dependency | Ongoing research |

## What was validated locally

- Shallow-cloned XRTailor, GarmentLab, Gaussian-Garments, GarmentCode, PositionBasedDynamics, GarmentMeasurements, NVIDIA Warp, ReMu, HOOD, DrapeNet and ContourCraft under `research/oss/`.
- PyGarment core imports and real Panel/Edge objects run on the Apple Silicon Mac when its optional Cairo visualization layer is bypassed.
- PositionBasedDynamics configures on Apple Silicon and the core `libPositionBasedDynamics.a` compiles successfully. The optional Discregrid collision dependency currently wants OpenMP.
- The official MakeHuman base mesh is staged as a CC0 detailed viewport avatar while Garment Studio keeps its analytic collision body active underneath.
- PPF Contact Solver is being staged under `research/oss/`. Upstream currently documents Apache-2.0 licensing, shell/solid/rod/rigid/sand contact, FEM deformables, calibrated fabric presets, Apple Silicon Metal, NVIDIA CUDA, AMD ROCm and CPU backends. Its own documentation describes it as an offline/high-quality solver rather than a real-time editor path, which makes it complementary to native XPBD rather than a replacement.
- XRTailor source/docs confirm CUDA-oriented Windows/Linux operation, anisotropic cloth, self/obstacle/environment collision, automatic dressing, SMPL/SMPL-H/SMPL-X, GLTF animation input and Alembic/OBJ sequence output.
- GarmentCode JSON maps naturally to Garment Studio: panels contain vertices/edges; stitches pair panel+edge; units are cm; quadratic/cubic curvature is explicit.

## License boundaries

### Safe first-party/permissive integration targets
- GarmentCode MIT
- PositionBasedDynamics MIT
- PPF Contact Solver Apache-2.0
- MakeHuman CC0 base graphical assets
- HOOD MIT code
- ContourCraft MIT code
- ReMu MIT core
- XRTailor Apache-2.0 core after per-module third-party review
- official NVIDIA Warp Apache-2.0 core after third-party binary review

### Copyleft path
- Blender GPL
- Seamly2D GPL-3.0+
- GarmentMeasurements GPL-3.0
- DrapeNet GPL-3.0

If Garment Studio becomes a distributed Blender fork, GPL obligations are expected for the Blender-derived application. Keep separately deployable permissive services behind documented APIs where useful.

### Do not ship directly without separate permission / license resolution
- Gaussian-Garments code paths marked non-commercial/research-only
- GarmentLab until a clear license grant is established
- any SMPL/SMPL-X/AMASS/checkpoint/dataset asset unless its own terms allow the intended distribution/use
- XRTailor modules whose bundled third-party dependency imposes incompatible terms; audit and replace/isolate as needed

## Immediate bridge contracts

### Garment Studio <-> GarmentCode
Garment Studio piece:
- `points[]` -> GarmentCode panel `vertices[]`
- `curves[edge]` -> GarmentCode quadratic curvature relative coordinates
- edge order -> panel edge endpoint indices
- `seams[]` -> GarmentCode `stitches[]`
- `arrangement3d` -> panel translation/rotation approximation

Keep Garment Studio-only metadata as an extension namespace: grading, seam allowances, notches, trims, fabrics, POMs and factory settings.

### Garment Studio <-> simulator backend
Backend-neutral payload:
- welded/sampled garment mesh
- pattern vertex provenance
- seam constraints
- material physical tensor (warp/weft, bend, shear, density, thickness, damping, friction)
- body mesh / animation
- layer order and collision groups
- anchors, pins, fasteners, zippers, elastic/gather/ease

Output:
- per-frame vertex positions/normals
- contact/pressure data when available
- collision/intersection diagnostics
- optional Alembic/OBJ cache

## End-of-week speedrun target

### Day 1
- finish license/component matrix
- GarmentCode import/export adapter
- PBD native library wrapper skeleton

### Day 2
- Blender bridge: Garment Studio document -> Blender scene + pattern meshes + avatar + materials
- Blender render/animation baseline

### Day 3
- native PBD backend bridge for static drape and sewn garments
- compare current JS solver vs native backend on tee/hoodie/pants

### Day 4
- PyGarment garment-generator ingestion (tee, bodice, sleeves, pants, skirts)
- measurement-driven parametric pattern regeneration

### Day 5
- layered garment / lining / interfacing regression in Blender + native solver
- high-resolution render/turntable pipeline

### Day 6
- optional HOOD/ContourCraft service prototype on compatible CUDA hardware
- multi-garment intersection benchmark

### Day 7
- unify UI/backend selector
- complex garment regression suite
- re-score CLO coverage from tested behavior, not checklist claims

## Realistic parity impact

Current Garment Studio was roughly ~52% overall by our prior rubric.

A successful week of reuse/integration can plausibly move:
- **real, working product depth:** ~60–68%
- **headline feature/prototype coverage:** ~70–75%

A jump directly to 90% in one week is not realistic because CLO's final gap is mostly robustness: arbitrary collision cases, multilayer convergence, production-grade pattern edge cases, fabric calibration, avatar fitting and years of QA. Open source can remove months of generic engineering, but integration and validation still matter.

## First integration order
1. Seamly2D document/formula bridge
2. GarmentCode adapter
3. MakeHuman detailed avatar + measurement-to-morph map
4. Blender bridge
5. PositionBasedDynamics native interactive backend
6. PPF Contact Solver final-quality backend adapter
7. XRTailor adapter contract
8. HOOD/ContourCraft optional dynamics service
9. ReMu import/reconstruction service
10. additional research projects only after license + benchmark review
