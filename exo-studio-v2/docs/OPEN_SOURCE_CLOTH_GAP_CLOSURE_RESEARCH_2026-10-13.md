# Open-source research: closing Garment Studio's CLO-like simulation gaps

Date: 2026-10-13. This is a researched engineering proposal, not a claim of implemented or validated functionality. Baseline defect inventory: `docs/CLO3D_CLOTHING_SIMULATION_GAP_AUDIT_2026-10-13.md`.

## Finding

Existing open-source libraries cover the *building blocks* of nearly all critical defects, but do not offer a drop-in CLO3D-equivalent pipeline. The difficult remaining work is coupling garment source topology, posed avatar skin, collision detection, seam activation, material calibration, multi-layer constraints, and UI updates in one stable, testable runtime. A successful PPF solve must still pass all-frame contact/strain checks; existing Thomas T-shirt tests do not.

## Reuse matrix

| Source | URL | Candidate reuse | Status / caveat |
|---|---|---|---|
| ST-Tech / ZOZO PPF Contact Solver | https://github.com/st-tech/ppf-contact-solver | FEM, barrier contact, shell sewing, strain limiting, Metal offline solve | Already integrated and running on Mac; observed Thomas contact failures; upstream says offline and not production ready. Apache-2.0 upstream; audit transitive dependencies. |
| PositionBasedDynamics | https://github.com/InteractiveComputerGraphics/PositionBasedDynamics | XPBD bending, triangle strain, point-triangle/edge-edge constraints, SDF collision | Source already cloned and core built; not a finished integrated replacement. MIT. |
| IPC Toolkit | https://github.com/ipc-sim/ipc-toolkit | CCD, barrier distance, friction, broad/narrowphase | New priority evaluation; toolkit is *not* a standalone physics engine. Check its third-party license dependencies. |
| Codim-IPC | https://github.com/ipc-sim/Codim-IPC | Cloth-specific collision-safe implicit thin-shell reference | Offline experimental contact mode, not live editor. Apache-2.0 repo. |
| GarmentCode / PyGarment | https://github.com/maria-korosteleva/GarmentCode | Parametric panel, edge, sewing topology, made-to-measure generation | Existing source clone and working Python core; integrate schema and edge provenance. |
| Seamly2D | https://github.com/FashionFreedom/Seamly2D | Pattern drafting formulas, measurement-driven grading | External process/document bridge; GPLv3+ licensing implications. |
| libigl | https://github.com/libigl/libigl | Triangulation, mesh quality, geometry algorithms | MPL-2.0 core; some copyleft/third-party modules have other licensing. |
| GarmentLab | https://github.com/GarmentLab/GarmentLab | Avatar/garment manipulation benchmarks | Existing research clone; licensing unclear in local inventory, reference until cleared. |
| NVIDIA Warp | https://github.com/NVIDIA/warp | CUDA/CPU differentiable simulation and optimization experiments | Existing research clone; CUDA-focused, not direct Mac Metal editor replacement. |
| XPBD-Cloth | https://github.com/steampower33/XPBD-Cloth | Vulkan multi-substep and graph-colored GPU XPBD reference | Research only; not drop-in for Metal. |
| cloth-simulator | https://github.com/Syntaxswine/cloth-simulator | SI-unit cloth material verification, vertex-face and edge-edge contact tests | Audit quality, correctness and license before reuse; useful benchmark ideas. |
| GarmentDiffusion | https://github.com/Shenfu-Research/GarmentDiffusion | AI pattern synthesis and incomplete pattern inference | Future optional AI layer, not a physics solution. |

## Why the current library set has not solved the shirt

1. Browser PBD and native XPBD use analytic body proxies; offline PPF uses the real Thomas skin. Visual avatar != collision geometry in live solver.
2. Live self-contact is particle proximity, not swept triangle contact. Two triangles can intersect without close vertices.
3. Seam and collision constraints run as competing projections, so closed seams may reopen, or collide through the shoulder.
4. Initial staged pose may be non-intersecting but trajectories still cross the body by frame 3 in recorded Thomas dynamic report.
5. Pattern tessellation lacks validated target metric edge length and accurate seam-curve correspondence.
6. Cloth material presets and solver stiffness are not calibrated against physical fabric experiments.
7. Existing tests largely guard finiteness and gross regressions; acceptance needs all-frame intersections, penetration depth, seam p95/max, region strain, silhouette and energy.

## Concrete integration architecture

- **Canonical garment document**: immutable pattern edge IDs, parametric curves, dart/fold/notch/allowance data, seam graph, material SI values; adapters for GarmentCode and external Seamly documents.
- **Common physical mesh**: constrained triangulation and adaptive remesh with source-edge provenance; one export format used by browser/native/PPF.
- **Avatar collision service**: Thomas evaluated posed triangle mesh, consistent coordinates and unit scale; BVH and signed distance/closest-point queries, including shoulders/underarms.
- **Interactive native XPBD**: strengthen with mesh contact and CCD, compliance in SI units, incremental sewing and stable drag targets. Evaluate PositionBasedDynamics primitives rather than duplicating them.
- **Offline PPF**: staged-sewing/strain-limited contact mode, strict all-frame acceptance, no silent promotion of failed results. Prototype Codim-IPC/IPC Toolkit contact validation independently.
- **Fit optimizer**: candidate arrangement and reversible pattern changes ranked by physical quality, not only seam closure or initial clearance.
- **QA gate**: same T-shirt, 160/180/200 cm, multiple poses; zero invalid topology/crossings, seam mean/p95/max in mm, calibrated strain percent, drape silhouette and runtime.

## Execution order

1. Implement a solver-independent per-frame contact/strain/seam QA reporter using the current Thomas mesh and T-shirt cache. Add automated failures for the recorded first crossing at frame 3.
2. Build a small IPC Toolkit prototype: moving triangle vs posed Thomas triangle, including CCD and contact thickness; validate against PPF reports.
3. Integrate posed Thomas collider into native XPBD and verify transforms before tuning sewing.
4. Replace hard seam correction with staged, bounded, coupled seam/contact solves. Benchmark with a two-panel shoulder fixture, then four-piece tee.
5. Upgrade pattern triangulation and material calibration; rerun the same multi-avatar fixtures.
6. Build reversible Auto Fit and controlled CLO3D comparison using matched garment, avatar, material and pose.

## Risk and license gate

Do not blindly merge source trees. Keep GPL Seamly2D external unless choosing a compatible distribution model. Inspect libigl copyleft modules, GarmentLab asset permissions, NVIDIA CUDA requirements, and all PPF transitive dependencies. Check source license and test behavior before introducing any new code to shipping Garment Studio.

## Public sources reviewed

https://github.com/st-tech/ppf-contact-solver
https://github.com/InteractiveComputerGraphics/PositionBasedDynamics
https://github.com/ipc-sim/ipc-toolkit
https://github.com/ipc-sim/Codim-IPC
https://github.com/maria-korosteleva/GarmentCode
https://github.com/FashionFreedom/Seamly2D
https://github.com/libigl/libigl
https://github.com/GarmentLab/GarmentLab
https://github.com/NVIDIA/warp
https://github.com/steampower33/XPBD-Cloth
https://github.com/Syntaxswine/cloth-simulator
https://github.com/Shenfu-Research/GarmentDiffusion
