# EXO 400 vs CLO 7: fabric property gap review (2026-10-16)

## Scope and evidence

Audited all **400 stable EXO material IDs** from `src/data/defaultProject.js` using `src/core/fabricCloParityAudit.js`. The machine-readable, per-preset, per-property results live at `docs/reports/EXO_400_CLO_PROPERTY_PARITY.json`; regenerate with `node scripts/check-400-clo-parity.mjs --write`, check reproducibility without writing with `node scripts/check-400-clo-parity.mjs`.

**CLO evidence:** public guidance for [warp/weft stretch and shear](https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear), [Fabric Kit](https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual), [CLOFAB](https://support.clo3d.com/hc/en-us/articles/49343947711769-CLOFAB), and [Property Editor](https://support.clo3d.com/hc/en-us/articles/115004877468-Property-Editor). The project's separate **live** screenshot audit, `docs/CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md`, confirms an open native CLO 7.0.242 window with FABRIC 1 in the browser, but the Property Editor body was blank and no fabric object was demonstrably selected. **Consequently no individual physical-property row or version-exact ordering was observed live.** The matrix below maps concepts from official guidance, not a claimed visual match.

**EXO evidence:** the 80 reference definitions, 320 generated variants and their declared fields. Reference presets may include historical example measurements, but the generated 320 explicitly state `calibration.status: estimated`; none should be described as CLO calibrated. A preset number is an authoring control until independently validated in the physical engine.

## Field-level classification

The report has **20 fields per preset, 8,000 evaluations**: **800 supported**, **5,200 approximations**, and **2,000 missing**. These are schema/presence classifications, **not a physical accuracy percentage or an assertion of feature parity**. Every record includes its original ID, name, parent family, treatment, 20 status objects, EXO source keys, units and priority.

| CLO conceptual property | EXO fields | Gap interpretation | Priority |
| --- | --- | --- | --- |
| Weight / density | `gsm` | Supported authoring mass (400/400); real specimen verification still required | P0 |
| Thickness | `thickness` | Estimated meter-valued thickness; measuring pressure and solver contact behavior unverified | P0 |
| Stretch Warp / Stretch Weft | `stretchWarp`, `stretchWeft` | Normalized stretch controls, not directional tensile force/extension curves or CLO values | P0 |
| Shear | `shearRelative` | Only generated variants have relative shear metadata; 80 references lack it. No established calibrated shear response | P0 |
| Bending Warp / Weft | shared `bend` | Single normalized control; neither independent directional rigidities nor hysteresis | P0 |
| Custom physical preset | no per-preset fitted nonlinear curves | Missing physical calibration workflow and validated solver mapping | P0 |
| Collision thickness | no solver-level proof in catalog | Missing direct evidence for fabric contact parity even when thickness authoring exists | P0 |
| Measurement provenance | `calibration` on variants | Estimated variant provenance; 80 reference records lack a common sample-level calibration certificate | P0 |
| Friction | `friction` | Normalized scalar, lacking fabric/fabric and fabric/avatar tested contact pairs | P1 |
| Shrinkage | `shrinkWarp`, `shrinkWeft` | Present ratios; laundering, recovery and treatment kinetics are unvalidated | P1 |
| Damping | `damping` | Scalar, no measured loading/unloading frequency dependence | P1 |
| Base color | `color` | Supported hex authoring, not calibrated spectral/lighting fidelity | P1 |
| Surface reflectance | `roughness`, `metalness`, `sheen` | Optical approximations; source scan reflectance calibrations vary | P1 |
| Normal detail | `normalStrength` | Scaled procedural/map appearance; no universal measured microgeometry | P1 |
| PBR map references | `pbrMaps`, `maps`, `fabricScan` | Field-dependent source linkage; inspect asset registries for actual files and licensing | P1 |
| Fabric grain | `fiberAngleDeg` | Angle data exists; pattern-local warp alignment not established by catalog field alone | P1 |
| Visual finish/wash | `wash` | Optical effects, not tested enzyme/stone/potassium-permanganate process chemistry | P2 |
| Composition | `composition`, `fiberContent` | Incomplete metadata and manufacturer traceability | P2 |

## Immediate engineering priorities

1. **P0 — measured swatch protocol:** capture conditioned sample identity, GSM and thickness under specified pressure; measure warp, weft and bias loading/unloading curves plus shear and directional bending. Store unit, method, instrument, test date, specimen dimensions and source license. Preserve each catalog ID and attach measurement sets by sample identifier; do not overwrite estimates without evidence.
2. **P0 — physics mapping:** fit continuum-compatible warp/weft tensile, shear, directional bending and damping models, then calibrate XPBD/native solver coefficients with mesh-size/time-step convergence tests. Separate authoring bend and stretch ratios from dimensional stiffness (N/m, N·m). Independently validate collision thickness against contact geometry.
3. **P1 — asset realism:** require image-map path validation, face/back identity, tiling scale, linear vs sRGB channel conventions, normal-map tangent convention, rights provenance and consistent lighting reference. Use measured optical images only when licensed and attributed.
4. **P1 — garment grain and friction:** test rotations per pattern panel, anisotropic drape, contact-pair friction on different surfaces, and repeatable wrinkle/drape benchmarks for several fabrics (denim, jersey, French terry, nylon, silk).
5. **P2 — finish lifecycle:** distinguish procedural visual washes from manufacturer process recipes, quantify color change and dimensional shrink/recovery using pre/post treatment swatches, and version the visual recipe independently.

## Limits

The 400 entries are a design catalog of 80 families and four constructed variants apiece, **not 400 laboratory-characterized fabrics**. Some visual reference scans may exist in separate registries; this audit measures what each preset record declares, not whether every asset has been loaded and visibly tested in a running CLO/EXO session. This review makes no claim that EXO shares CLO's proprietary physical model, uses CLO's actual presets, or reproduces their exact physical property numbers.
