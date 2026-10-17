# EXO V2 · CLO-SET CONNECT fabric + stage fidelity iteration

Date: October 17, 2026

## Comparison benchmark

- CONNECT's Creating 3D Fabric guide requires repeating material images and
  maps no larger than 4K; it recommends weight, thickness, fiber composition
  and provenance/measurement details in fabric metadata:
  https://support-connect.clo-set.com/hc/en-us/articles/45304313148313-Creating-3D-Fabric
- CONNECT's Creating Scene guide stresses outward normals, usable/non-
  overlapping UVs, editable prop materials and good lighting/custom camera
  views; 2048px textures are recommended:
  https://support-connect.clo-set.com/hc/en-us/articles/45304285204633-Creating-Scene
- Actual CONNECT example fabric render and stage pages used for qualitative
  inspection, **not copied assets**:
  https://connect.clo-set.com/detail/4aad3212dccc4ce5a1b74202066b76fb
  https://connect.clo-set.com/detail/500cae37e1e5483c82625c81c1524204

## Fabric realism implemented

- Introduced controllable **soft**, **raking** and **daylight** studio illumination
  on the hover specimen ball, plus mouse-wheel and +/− keyboard zoom. Zoom
  computes the viewing direction before moving the lens, avoiding an initial
  collapsed camera target.
- Reduced the over-bright diffuse fill that made denim's 3D sphere look pale
  while its flat photographic reference was dark. Disallowed double-sided
  self-shadowing on the thin presentation mesh after screenshot QA revealed
  black triangular shadow artifacts; existing soft grounding shadow remains.
- Added `FabricScanFlatPreview.jsx`, which applies the same colorway/wash
  transform to the flat licensed scan as the 3D sphere, rather than displaying
  an *ungraded* scan next to a dyed material.
- Revised scanned roughness balancing to preserve highlights and shadow
  variation in the original yarn data. Safeguarded photographic map tint
  fallback if browser canvas color grading is unavailable.
- Retained normal/roughness map data in linear texture space, photographic
  base color in sRGB, and repeat dimensions across the 270cm specimen.

The 3D ball remains a **deterministic illustration** informed by estimated GSM
and bend; it is not the output of a physically calibrated bending, shear,
friction and tensile cloth solver.

### Library audit

| Metric | Count |
| --- | ---: |
| Fabric presets | 400 |
| Installed licensed CC0 photographic scans | 67 |
| Photograph-referenced presets | 385 |
| Procedural-only presets | 15 |
| Unique photographic sources referenced | 44 |
| Verified color, normal, roughness map files | 201 |
| Presets with independently measured physics | 0 |

## Stage realism implemented

- Five stage GLBs remain selectable: Cathedral House, R02, R03, S01 and S10.
  Stage preview lighting uses scene-specific exposure, lower-cost bounded
  soft shadow maps and world-space bounds for candidate prop shadow casters.
- The S01 Botanical Studio was remodeled from 68 to **350 meshes** and from
  8 to **17 materials**, replacing geometric capsule shrubs and plain cards
  with individually modeled plant leaves, architectural slats, wall bases
  and ceiling spot fixtures. The updated source was saved separately from
  the original Blender scene; its exported GLB is approximately 1.4 MB.
- Actual GLB preview renders were inspected; all five stages still load in
  the viewport. S01 is improved but not yet comparable to professional
  high-end stage photography. It still lacks high-quality material scans,
  complex foliage, convincing mirror light transport and consistent 2K
  texels/UVs (only 170 of 350 S01 primitives have UV0).

### Installed-app acceptance

| Test | Status |
| --- | --- |
| Signed EXO macOS V2 and native Rust bridge | PASS |
| Source fabric color/normal/roughness audit | PASS |
| Denim/Silk ball lighting/zoom interaction | PASS, 0 page errors |
| Flat scan preview colorway | PASS, same tint algorithm |
| Fabric list (400) and docked native properties | PASS |
| SVG import of two 2D cutlines without sewing | PASS |
| Five actual stage meshes and posters at 1440/390px | PASS |
| S01 visual preview | PASS, 350 actual meshes |
| Native source and user garment projects altered | NO |

Installed with `integrations/clothcraft/macos/build-web-only-v2.sh`,
with native-board acceptance and automatic rollback on failure.
Web backup:
`integrations/clothcraft/output/app-backups/EXO-V2-web-before-connect-fabric-studio-20261017`.

## Next measured quality gates

1. Capture separate warp/weft/bias bending and tensile data from a physical
   fabric specimen. Tune cloth solver parameters against filmed sphere-drape
   tests rather than infer physics from a 2D scan.
2. Create correct cloth-scale scan matching and two light-temperature reference
   plates for each distinct scan, visually calibrate in sRGB/ACES and verify
   roughness/normal microstructure against a real swatch.
3. Raise S01 and at least one runway to actual PBR-quality geometry, unwrapped
   UVs across every large architectural material, authored 1K–2K albedo,
   roughness and normal maps, detailed furniture/foliage, and studio cameras.
4. Test viewer frame time/GPU limits for the five stages and the fabric ball
   under normal laptop load, then introduce adaptive DPR if necessary.

**Do not claim CLO-SET CONNECT rendering parity yet.** Current stage and
fabric data support controlled comparisons and iterative improvement, not
independent physical quality certification.
