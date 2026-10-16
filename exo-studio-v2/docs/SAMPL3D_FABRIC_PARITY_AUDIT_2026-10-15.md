# SAMPL3D · CLO3D fabric and material parity audit

**Date:** 2026-10-15  
**Scope:** Fabric appearance, textile families, textures, physical data, file interchange, material UI, rendering and optical-edit behavior.  
**Working source:** `/Users/mikylecouto/Chat On Steroids Workspace/garment-studio` (development folder, not public GitHub release).  
**CLO reference:** User's installed, running `CLO_Standalone_OnlineAuth.app` (visible application identified as CLO 7.0.242 Academic), plus CLO's current, published feature documentation. The latter documents capabilities added since the local installation. No proprietary CLO implementation, private asset, zfab internals, or original garment data were copied.

## Executive result

SAMPL3D **has not reached 90% CLO3D fabric parity**. A **provisional 48/100 weighted feature-coverage score**, detailed below, is a *planning heuristic* based on functionality visible in SAMPL3D source and publicly documented CLO features; it is **not** a measured perceptual similarity score, an independently calibrated physical performance score, or a verification of each CLO feature in the user's installed older version. The most serious gaps are physical material calibration, direction-specific textile behavior, front/back/side material differentiation, photoreal final rendering, and scanned fabric interchange.

## Audit matrix

| Area (weight) | Implemented / verified in SAMPL3D | CLO capability and remaining gap | Provisional points |
| --- | --- | --- | ---: |
| PBR material appearance (25) | `THREE.MeshPhysicalMaterial`: albedo, normal, roughness, metalness, opacity, manual height/displacement map, sheen, anisotropy, clearcoat, optical hot updates. Actual 3D viewport PBR maps confirmed in browser. | CLO supports distinct front/back/side materials, substance types, reflection models, displacement in final render and advanced texture treatments. SAMPL3D lacks per-side material assignment and validated physically plausible path-traced textile shading. | 17 |
| Textile library (15) | 23 editable named presets; 13 procedural surface families including jersey, terry, twill, satin, woven, ripstop, leather, suede, velvet, corduroy. Real physical calibration of these presets is **not claimed**. | CLO provides fabric type libraries, composition data, scanned/maps presets, and hardware-supported digitization workflow. Textile construction approximations are not scanned samples. | 8 |
| Texture controls and UV mapping (15) | Embedded color and PBR images; centimeter-sized UV repeat; grain direction, rotation and map hot-reload without drape reset; automatic filename-channel matching and *estimated* PBR generation from photographed albedo. | CLO supports advanced repeat modes (block/half-drop/brick/diamond/stripe), arbitrary prints, map intensities/inversions and multi-layer materials. SAMPL3D does not yet implement every print-repeat style and texture transform independently by channel. | 11 |
| Physical simulation and fabric measurement (25) | GSM, thickness, scalar bending, warp/weft stretch and shrink, friction and damping. Different families map to approximate coefficients for existing solvers. | CLO exposes independently adjustable warp/weft/bias bending, warp/weft/shear stretch and hardware measurement / fabric-digitization workflows. Values have not been mapped through force/strain tests to real fabric lab data. This is the highest-impact gap. | 5 |
| Interoperability and handoff (10) | JSON project data, tech pack materials, BOM CSV including added PBR channel references and fabric structures, 3D exports. | No validated `.zfab` roundtrip, CLOFB hardware interchange or full Substance metadata. Rendering of all PBR channels after *export to other DCC tools* is not fully acceptance-tested. | 3 |
| QA, render reproducibility, performance (10) | Deterministic yarn maps; `check:materials`; browser UI tests show shader preview and PBR map auto-generation; 1080 × 1350 rendered PNG smoke test; browser page-error checks. | No color-managed multi-light reference benchmark (CLO vs SAMPL3D), perceptual texture SSIM/LPIPS acceptance, controlled mechanical drape benchmark, or certified path-tracing. | 4 |
| **Total** | | **90% parity not proven.** | **48 / 100** |

## Verified improvements in the 2026-10-15 pass

1. Expanded procedural appearance families, with periodic yarn-height and per-family roughness/normal maps; plain weave, twill and satin use distinct warp/weft interlacement approximations instead of shared crossed waves. All examples remain mathematical stylizations, not measured yarn scans.
2. Added editable textile structure override, six additional fabric presets (cotton velvet, silk chiffon, silk organza, corduroy, scuba knit, technical softshell), and smooth visual-only switching between materials. Full working library now contains 23 presets; procedural generator recognizes 13 families.
3. Added cloth-independent material texture hot updates: uploaded color/normal/roughness/metalness/opacity/displacement images and real-centimeter repeat edits can be reflected without creating a new cloth simulation session. The pattern UV attribute is remapped without changing vertex positions.
4. Added an interactive, independently rendered PBR material finish ball alongside a close-up 1.8 cm fabric patch, so microscopic weave patterns are visually inspectable rather than always minified away on the full sphere.
5. Added photo-to-normal/roughness estimation, with explicit UI caveat that luminance-derived normals are not recovered physical geometry. Added a safe multi-file PBR filename classifier; DirectX normal maps and packed channel masks are not silently interpreted as OpenGL or grayscale maps.
6. Added upload/control for displacement height maps with optically limited 0–2 mm vertical displacement. This is rendered vertex displacement on the garment mesh, **not collision geometry** and not a true microdisplacement subdivision renderer.
7. Extended material JSON tech packs and factory BOM CSV to retain references to metalness/opacity/displacement maps, opacity and the fabric surface family. Full image bytes are not included in the tech pack.

## Actual checks executed

| Test | Result and limitations |
| --- | --- |
| `npm run build` | Passed Vite production compilation on Blender Mac. Bundle-size warning remains. |
| `npm run check:materials` | Passed core PBR materials and 13-family deterministic textile QA, with real-centimeter UV mapping and optical/physics fingerprint separation. |
| `npm run check:non-simulation` | Passed broad drafting, export, factory and materials-adjacent non-simulation tests. |
| `node scripts/qa-fabric-material-iteration.mjs` | Passed browser test: material-ball+macro shader render, changed weave visibly alters preview, image upload and normal+roughness map generation, displacement upload, slider update, per-panel map assignment, no cloth session rebuild, no JS page errors. Uses isolated tee testSession to avoid user's saved garments. |
| `node scripts/qa-material-render-still.mjs` | Passed: 4/4 panels had PBR map bindings; 1080×1350 PNG generated with valid bytes; no browser errors. **No path-tracing certification.** |
| `node scripts/qa-clo-workspace-fabric-seamly.mjs` | Passed: material slider edited and stored, simulation session unchanged, workspace layouts, pattern geometry preservation and Seamly reference smoke tests. |

### Independent 90% acceptance gates still required

- **Appearance:** 12 real swatches (denim, rigid poplin, fleece, jersey, silk satin, organza, velvet, suede, leather, ripstop, wool suiting, coated nylon) photographed or scanned under controlled geometry and two illumination conditions. Match CLO and SAMPL3D camera, tonemapping, color profile and grain alignment. Require per-family review, side-by-side pixel/perceptual metrics, and no conspicuous moiré / hard UV tile seams.
- **Fabric mechanics:** Reference physical strip tests for warp, weft, shear, bias bending and bending hysteresis; dynamic drape on neutral forms; matching cloth density/thickness; recorded solver tolerances/strain and contact outputs. Current `bend` is scalar and lacks lab-grounded anisotropy.
- **Workflow completeness:** Side-specific materials, print-repeat families, separate per-map transform and inversion/intensity, asset-library persistence, fabric presets created from measured information, high-quality final render, export/import of production-appropriate material artifacts.
- **No regression:** Automatic tests must keep original measured vertex arrays and mesh state unchanged during optical edits, including when simulation is playing, and return correct per-panel materials after switching fabric assignment.
- **Documentation/legal:** Define licenses and provenance for any newly acquired reference textile scans or externally imported presets. Do not ship CLO's own bundled swatches or the private avatar in an open-source release.

## Highest priority follow-on work

1. Calibrated anisotropic stretching, bending and shear with independent warp/weft/bias parameters; expose controls only once backed by simulation physics (not cosmetic sliders).
2. Physically correct independent front/back/edge rendering, and robust material layer order for transparent organza/chiffon overlapping garment pieces.
3. Render-only micropolygons/tessellation or offline displacement and high-quality lighting for final stills, with accurate scale and lower aliasing.
4. Supported texture-file references / portable asset packages with sidecar PBR maps, including explicit licensing and color-space handling, plus map transforms and repeat modes.
5. Visual comparison tooling to capture CLO and SAMPL3D real fabric swatches at matched camera and lights, scoring reproducible side-by-side perceptual similarity.

## Official CLO reference material

- [Set Fabric Materials](https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials): Front, back and side material options; material types; maps.
- [Fabric Normal Map](https://support.clo3d.com/hc/en-us/articles/115012380288-Fabric-Normal-Map): Uploaded/automatic normal maps, adjustable intensity.
- [Apply Texture](https://support.clo3d.com/hc/en-us/articles/115015832128-Apply-Texture): Color texture, drag-and-drop material map types and map persistence.
- [Displacement Map](https://support.clo3d.com/hc/en-us/articles/360025439933-Displacement-Map-ver5-1-0): Render-only displacement, amount and clipping; advanced mesh detail.
- [Bending – Weft/Warp](https://support.clo3d.com/hc/en-us/articles/115000483187-Adjust-Bending-Weft-Warp): Independent physical bending direction controls.
- [Stretch – Weft/Warp/Shear](https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear): Independent resistance directions.
- [CLOFAB](https://support.clo3d.com/hc/en-us/articles/49343947711769-CLOFAB): Textile image set import, fiber/composition/density and digital material capture.
- [Print on Fabric](https://support.clo3d.com/hc/en-us/articles/360053434434-Print-on-Fabric): Repeat mode families and PBR map sharing.

**Caveat:** This is a feature-coverage planning audit, not endorsement, and does not imply permission to redistribute CLO materials or proprietary data. The user's working originals were not cleaned, reset, or published.
