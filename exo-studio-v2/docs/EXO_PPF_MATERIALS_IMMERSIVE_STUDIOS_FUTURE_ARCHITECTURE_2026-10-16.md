# EXO: PPF Physics, Measured Textiles, PBR Materials, and Immersive Studios
**Engineering research extension | 2026-10-16 | FUTURE PLANNING ONLY**

**Program navigation:** [Integrated ecosystem implementation program](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md) and [PPH/MAT/STU/COM candidate engineering issues](EXO_ECOSYSTEM_CANDIDATE_ENGINEERING_BACKLOG_2026-10-16.md).

This document develops the next EXO Studio concept: fast garment editing, offline PPF reference contact, real material calibration, realistic textile surfaces, photography studios, and an explorable room of the user's clothing collection. **None is requested to be implemented in this turn.** Do not alter the running V2 app, original garment projects, native solver, or local PPF jobs.

Companions: [Spatial master research](EXO_SPATIAL_PROJECTION_GARMENT_STUDIO_AND_AR_CONCEPTS_2026-10-16.md), [ten-page plan](EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md), [PPF fit audit](PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md), [upstream PPF frame forensics](PPF_UPSTREAM_PIN_MOTION_FORENSICS_2026-10-14.md), [fabric library](../integrations/clothcraft/FABRIC_LIBRARY_V2.md), and [EXO fabric optics](EXO_FABRIC_MATERIALS_AND_TRIMS.md).

## 1. One clothing design, multiple separately verified representations

1. **Authoring source:** pattern polygons/curves in measured local coordinates, seam graph, stitch assignments, internal lines, trims, grain direction, measurement spec and graded sizes. Immutable revisions + permitted edits are the source of truth.
2. **Physics input:** triangulated rest meshes, masses, local warp/weft orientations, calibrated constitutive material and collision parameters, avatar collider, staging plan, sewing constraints and chosen solver.
3. **Physics output:** timed drape frames with the exact source/solver/material hashes, seam/contact/strain QA report, simulation cache status and warning badges.
4. **Presentation:** mesh and UVs, appropriate textures, garments on mannequins, shaders, poses, stage/HDRI, camera, video and optimized gallery GLB, all labeled for their actual physical status.
5. **Publishing:** a separately authorized visual product page and optionally downloadable pattern/manufacturing data, material assets and studio presets, each with rights and visibility distinct from the original.

A good-looking PBR shader cannot repair an invalid cloth fit. A dense collider does not guarantee reliable seam closure. A published gallery look is not permission to redistribute the original source project.

## 2. Current implementation audit: what actually works

**ClothCraft V2:** local native Rust VBD/GPU VBD, three-vertex barycentric Hand spring with continuous target updates, panel selection/movement and material assignment. Its nine native exemplar materials are cotton woven, cotton/poly interlock jersey, wool, denim, nappa leather, light silk, linen, nylon ripstop and stretch knit. The preset mass and some thickness inputs are based on specimens; stretch/shear/bend and look are approximations. The V2 surface generator uses small procedurally repeated bumps and basic MeshPhysicalMaterial properties. There is **no experimentally validated complete friction, plasticity, knit-loop or certified textile fit** in this pipeline. Relevant files: src/core/clothcraftFabrics.js, clothcraftFabricSurface.js, integrations/clothcraft/exo-session.rs, workspace.mjs and FABRIC_LIBRARY_V2.md.

**Broader original Garment Studio:** src/core/fabricSurfaceModel.js, textileProcedurals.js, fabricPbrGenerator.js, components/FabricMaterialPreview.jsx and GarmentViewport.jsx provide richer visual texture and environment authoring. Its source model is **not automatically the same** as the native ClothCraft V2 source model. Migrate through a typed compatibility adapter and comparison fixtures, not by reusing raw numeric labels blindly.

**PPF Contact Solver:** the installed macOS arm64 Metal runtime has been executed from the EXO PPF bridge. It produced real native cloth trajectories, not a visual fake, but the October 14 historical tee with 98 stitches failed final production fit: mean seam gap near 1.01 cm, maximum about 9.98 cm, cloth/body penetrations beginning frame 3, and swept collision checks failed. A separate near-assembled test failed the required maximum 3 cm initial sewing gap. The upstream 241-frame dress example also had body intersections at frames 87, 90 and 174 under the independent audit. Smoothing a pinned-body keyframe sequence reduced crossings but did not eliminate them. These are **hard blockers** to calling PPF results certified for fit on this project. See the linked local audit before making a replacement-engine decision.

Official PPF upstream: https://github.com/st-tech/ppf-contact-solver. The Apache-2.0 project expressly describes the solver as an offline/non-production-ready backend and notes slow CPU/Metal performance. Its claim about internal contact safety does not override EXO's separately observed full-trajectory penetration tests. Our goal is to test facts rather than adopt marketing guarantees.

## 3. The hybrid simulation architecture

### Live track: responsive VBD/XPBD
Editor mouse/hand input → raycast to the visible cloth triangle → barycentric weights + bounded target in world meters → native temporary grab → step VBD/GPU VBD → valid drape snapshot → Three.js projection and studio preview. User release, camera loss, app close, mode switch or timeout removes the spring. Maintain revision ownership and a last valid solver state. Do not let an unsupported or unauthenticated website invoke raw local commands.

### Offline reference track: PPF
Take a **frozen** garment source revision and material profile revision. Validate finite geometry, UV/grain topology, 2D-to-3D seam correspondence and initial assembly (no initial disallowed crossings, correct orientation, stitch distances below a chosen gate). Build PPF shell/body groups with explicit pinned-shell vs static policy, thickness and collision settings. Run isolated stages with bounded CPU/GPU quotas and log exact backend/mesh/params. Collect all native time samples and independent tests of intersections, seam closure, stretch, body clearance and swept motion.

States: pending → input validation → staging → native run → full-frame audit → **accepted, rejected, failed, cancelled**. A solver process exit of 0 means only completed, never automatically accepted. Rejected outputs remain private diagnostics; they cannot silently overwrite an accepted drape, visually approved showroom look or production specification.

### Initial research experiments
- Reproduce the unchanged upstream fitting scene on current hardware with commit and asset hashes.
- Compare STATIC Thomas vs fully pinned SHELL Thomas using the same starting mesh/sewing/material/gravity/time; one policy variable changed.
- Fix actual garment 2D→3D armhole, shoulder and side seam correspondence, orientation, physical sewing lengths and nonintersecting initial layout.
- Independently test every saved frame with triangle intersection and swept CCD checks, including avatar keyframe boundaries; compare native contact diagnostics with independent geometry checks.
- Benchmark CPU/GPU runtime and memory at multiple triangle counts. Do not extrapolate full interactive speed from a ten-frame 500-vertex test.
- Measure material parameter convergence separately for jersey, French terry, denim and leather; don't use arbitrary visual presets as physical proof.

### Release gate for any PPF-accepted fitting
At minimum require fully enumerated source triangles and stitches; valid material, body, pose and settings; full contiguous frame series and correct frame mapping; zero forbidden body/self penetrations in the tested trajectory; independently checked temporal/swept contacts; bounded maximum/mean seam gaps and regional body clearances; capped nonphysical principal strain; and comparison against actual clothing where users claim true fit. Existing example PPF thresholds from the audit (engineering targets, not certifications) are final seam mean ≤0.2 cm, maximum ≤1 cm, shoulder mean clearance ≤1.5 cm and p90 ≤3 cm, torso mean ≤2 cm. Log failures in red, not merely warning-colored footnotes.

### System integration
A future SimulationJob references garmentRevision, triangulationHash, materialProfileVersion, bodyColliderVersion, backendName/Version, runConfigHash, progress, statistics, finalMeshRef, frameCacheRef, acceptanceReport and retention. This fits alongside the creator platform's upload permissions but should **not** run automatically on public uploads: compute/GPU expenditure and potentially hostile meshes require isolation, quotas and explicit authorization.

## 4. What a textile profile actually needs

The authoring UI should expose user-friendly physical values but the backend must store canonical units and source measurements.

| Field | Physics meaning | Canonical value | Input/calibration note |
| --- | --- | --- | --- |
| GSM | mass per surface area | kg/m² = GSM/1000 | Weigh known sample area; not garment total mass |
| Thickness | actual textile compressed/uncompressed thickness | m | Test pressure/conditioning matters |
| Warp extension curve | tension/strain along grain | load and strain samples | Many fabrics nonlinear and direction-dependent |
| Weft extension curve | cross grain tension/strain | load and strain samples | Jersey/rib knit differ substantially |
| Bias/shear response | resistance to rhombus deformation | calibrated force/angle | Drape and folds heavily depend on this |
| Warp/weft bending | directional moment/curvature | solver-model documented | Bending should be tested separately from stretching |
| Damping/hysteresis | loading/unloading loss and recovery | model-specific | Fabric may remain deformed or relax |
| Friction | cloth/cloth and cloth/body resistance | contact-model-specific | Need skin, underlying fabric and surface variants |
| Compression/loft | piled/knit/leather thickness under contact | nonlinear measured curve | Important for French terry, fleece, padded garments |
| Plasticity | permanent shaping/creases | strain history law | Denim/leather may need irreversible deformation |
| Environment | humidity/temp conditioning | specimen metadata | Can alter results |
| Uncertainty | provenance and confidence | sample/testing status | Default estimates are not scientific certificates |

A **220 GSM** sample has 0.220 kg/m² nominal sheet mass. At 0.4 m² of cut material the surface-mass-only estimate is 0.088 kg before seam allowances, doubled/folded parts, trims, lining and adhesives. This arithmetic is not fabric hand, stiffness, thread weight or fitted garment mass certification.

**Test kit and protocol:** controlled-size specimen and scale → conditioned GSM/thickness measurement → repeated warp/weft/bias stretch at more than one load → three-point bending/cantilever strips → friction/sliding against representative body/fabric → drape photo with measured folds → repeat after release and use least-squares/model fitting to infer solver coefficients. Keep raw observation, curve, specimen batch and confidence distinct from fitted backend coefficients.

**Important mapping rule:** raw user-facing warp/weft stretch in percent at a named force is **not** automatically interchangeable with PPF normalized Young's modulus, Poisson ratio, thickness and bending parameter; a VBD N/m or N·m coefficient is not numerically the same as a PPF FEM parameter. Create separate calibrated maps for each solver and compare with the same physical fixture. Build backend-specific parameter dictionaries from the same canonical measurement set.

### Material priority
Tier 1: cotton jersey, French terry, fleece, heavyweight cotton, canvas, raw and stretch denim, polyester/cotton knit, ribbing and wool suiting. Tier 2: nappa leather, suede, silk/satin, nylon ripstop, fleece/pile, technical shell/coated fabrics, linen, viscose and velvet. Tier 3: multi-layer padded/trapunto, bonded constructions, fusible interfacing, quilting, down/synthetic fill, zippers/hardware with rigid interaction, anisotropic directional trims. Specimen provenance matters more than an impressive count of 300 unmeasured presets.

Suggested MaterialPhysicalProfile fields: materialId, specimenId, description, composition, construction, weaveDirection, surfaceMassKgM2, thicknessM, extensionCurvesByDirection, shearCurve, bendingCurvesByDirection, frictionPairs, damping, compression, permanentSet, uncertainties, environmentalCondition, dataSource, license, validationStatus and derivedBackendCoefficients.

## 5. Optical appearance is a separate PBR/material problem

A cloth can look like velvet while simulating with a denim preset, so **do not assume appearance identifies physics**. Every MaterialAsset should link independently to MaterialPhysicalProfile and MaterialVisualProfile.

MaterialVisualProfile: baseColor map/linear color, normalMap, height/displacement, roughness map, ambient occlusion map, weave/nap/loop scale (millimeters/cm), fiber tangent direction, sheen, sheen roughness, anisotropy, clearcoat (only treated/coated surface), thickness/transmission/opacity where relevant, surface front/back, alpha handling, UV scale and source rights. For leather/suede, use grain/nap direction, microrelief and controlled grazing highlights; for denim, repeatable twill angle and dyed warp/weft; for French terry, face knit and terry loop reverse, using separately assigned front/back materials if render backend supports it.

**Color pipeline:** base-color texture interpreted as sRGB then converted to renderer working color space; scalar roughness/metalness, height and normal are data textures and should not receive sRGB correction. Keep real-world repeat scale and correct directional UV across panel movement. Do not stretch a 3 mm stitch texture to cover a whole sleeve as an arbitrary repeating square. Use texture mipmapping and anisotropic filtering, plus a macro/micro view.

Relevant glTF extensions include [KHR_materials_sheen](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_sheen/README.md) for textile grazing highlights and [KHR_materials_anisotropy](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_anisotropy/README.md) for directed highlights; renderer and exporter feature support must be checked. Display normal/roughness/albedo maps independently for debugging, and compare shader output under the **same** lighting, camera, color management, exposure and monitor profile.

**Procedural vs measured scans:** procedural weave can fill placeholders cheaply; calibrated, tileable captured materials with multiscale normals and reflectance should carry a measured-scan flag. A photo without scale bar, lighting calibration, texture rights and direction annotation is not a physically correct textile source.

**Hardware:** zipper pullers, metal buttons, buckles and studs need their own real geometry, metallic/dielectric shading and physically meaningful BOM item; they should not simply be embedded in a flat albedo texture. Rigid-body contact for metal trims requires separately validated solver support.

### Sample materials gallery tests
A sample scene contains flat swatch macro, bending strip, draped hanging square, hoodie torso and close-up seam at identical calibrated camera/light positions. Repeat for jersey, French terry, denim, leather and suede. Report **physics test status** beside **visual material fidelity**; do not silently award a single composite 90% realism score.

## 6. Photography Studio: build the stage, not a filter

A virtual studio is a **scene asset** with 3D stage geometry, backdrop/floor, camera rigs, light rigs, HDR environment, world scale, shadow/contact settings, color management, render engine, stage props and asset rights. Keep its original .blend master editable and export runtime derivatives for web. Blender GLB export does not preserve Blender area lights and complete World lighting as losslessly interchangeable scene lighting; EXO web scene recipes must reinstantiate suitable light rigs.

Suggested source scene presets:
- **White Infinity E-commerce:** white cyclorama and three-point softboxes, front/back/profile and detail photography camera; same frame crop across products.
- **Neutral Gray Fabric Lab:** measured white/gray card, neutral broad illumination plus optional grazing light, swatch spheres, material comparison.
- **Concrete Editorial:** original concrete studio, warm key/cool rim, directional floor shadows and fashion still framing.
- **Architectural Gallery:** original stone/concrete galleries with columns/vault/tracery and controlled materials, not copied proprietary architectural meshes.
- **Muslin Origins:** draped cream muslin backdrop, soft documentary lighting and macro stitch shots.
- **Black Stage:** rim-lit garments and hardware, shadow-preserving exposure.
- **Runway Theater:** time-controlled dressed avatars, path markers, backstage and audience cameras.
- **Outdoor Light:** authorized HDRI and an original ground surface.

**Photography panel UX:** select Look → Stage thumbnail → Avatar(s) and Pose → Camera/Shot → Lights/Exposure → Render Preview → Queue High-Quality Render → Review/Compare/Re-render → Add to collection or publish. Editing an exposure shouldn't rewrite source textile reflectance; an editorial renderer must not overwrite physically validated neutral swatch captures.

**ShotManifest:** lookId/version, mannequinIds/poses, garmentRevision/acceptedDrapeCache or visual-only mesh, studioId, camera position/target/lens/crop, lighting rig and HDRI rights, tone map/exposure, resolution, renderEngine/version, outputs and resulting file hashes. Include base PBR visual profile IDs and warn on missing maps.

## 7. An immersive walk-through 'Wardrobe Museum'

The user described a **cool room they can walk through**, showing mannequins dressed in all saved clothing. This is a separate view over the same Look and Studio objects, not a second set of duplicate garments.

### Spatial UX and room design
**Lobby:** a 3D architectural hall with collection/season portals, search, favorites, new uploads and 'continue editing'. **Collection rooms:** runway-like rows of mannequin plinths, each representing a Look; hover on an outfit for floating panel info and thumbnails. **Material Room:** fabrics, swatches, denim/leather close-up and physical vs visual badges. **Pattern Archive:** framed technical drawings and 2D panels that open in controlled edit mode; unauthorized viewers can see only permitted redacted previews. **Photo Studio Room:** an active cyc/set the viewer enters to change cameras/lights and take images. **Runway Gallery:** a walkable fashion presentation, with saved animation/video and look details. **Marketplace doorway:** discover permitted public creator looks; no auto-download of their private sources.

**Interaction:** desktop WASD + mouse (with optional pointer-lock using Three.js PointerLockControls), joystick/gamepad and accessible point-and-click navigation, click-to-teleport, home/reset viewpoint, room mini-map and 'flat accessible browse' alternative. Smooth walking must have collision against walls, floor and mannequins, bounds/navmesh, camera near/far limits and motion-sickness controls. Do not force free-moving first-person on mobile; offer touch orbit and scene hotspot navigation. Render an outline around the chosen mannequin, not heavy emissive fill on the clothing itself.

**Privacy:** by default only the user's own garments appear. A public showroom is an opt-in published scene with separately licensed textures, mannequins and photos. Team-only rooms respect project ACLs and should not leak hidden pattern measurements via scene files, network responses, embedded GLB extras or developer tools.

### Performance and scalability
Stage scene construction in Blender: master .blend → verify licenses, UV, rig, scale and texture dependencies → bake/optimize runtime GLB with LOD variants → compress textures to KTX2/Basis where renderer/device supports → GPU instancing for repeated room props/mannequin plinths → lazy-load rooms, high-resolution fabrics only for nearby outfits, texture memory budgets and recycled cached shaders → preserve a low-performance fallback gallery view.

**Provisional performance gate:** aim for usable 60 FPS on the chosen current Mac at a specified 1080p window and scene with ~20 mannequins, but benchmark hardware rather than claim this as achieved. Record frame-time median/p95, GPU memory, draw calls, load time and low-detail fallback. Navigation collision should be independent of clothing's full FEM triangles; retain authored garment mapping for inspection but use optimized collision proxies.

**No need to simulate every garment live:** store accepted drape cache or representative visual look geometry. Full real-time PPF solves while walking an entire room would be a poor use of GPU and is not supported by the current solver.

### Example user journey
Open EXO Library → click 'Enter My Room' → walk through the Archive and choose a hoodie mannequin → review front/back, fabric close-up and PPF status → switch colorway → enter its photography studio → render a 3/4 shot → add image to a visual-only creator profile. Selecting 'Open in EXO' returns to the local editable file only when the user is the owner and source is locally available.

## 8. Engineering phases and acceptance tests

| Phase | Future implementation unit | Must prove before proceeding |
| --- | --- | --- |
| PH-01 | Unified physical/visual material schema, provenance and unit adapters | No 1000× errors; edited material assignment matches known native fixture |
| PH-02 | Specimen measurements and backend parameter fit | Same swatch curve and drape repeatably map to VBD and PPF separately |
| PH-03 | PPF job adapter and failing-fixture regression | Historical crossings correctly rejected; no accepted-cache overwrite |
| PH-04 | Nonintersecting seam assembly and body policy experiments | Actual seam and full-frame contact criteria pass on reference garment |
| PH-05 | Shared realistic fabric/trim PBR assets | Stable texel scale, color space and maps across swatch, garment and scene |
| PH-06 | Three Blender studio masters + web runtime derivatives | Camera/lighting compare, no missing textures, source .blend preserved |
| PH-07 | Walkable single-user wardrobe lobby and Look plinths | Verified first-person navigation, click-to-view, private asset non-leakage |
| PH-08 | Multiple collection rooms, accessibility, performance, public room mode | Permission tests, LOD/budget tests, flat-list fallback, URL sharing only of authorized assets |

**PPF verification harness** should run input validation, staging metrics, fixed/pinned body comparison, all-frame mesh crossing, swept CCD, seam convergence, strain, clearance and disabled acceptance when tests are missing. A screenshot or beautiful final render is not an acceptance fixture.

**Materials verification harness** should compare fabric specimen/provenance, measurement samples, warp/weft directional response, unit conversions, renderer PBR channels, physical pitch, PPF coefficient mapping and deterministic source-to-render export. Show an 'unmeasured' flag whenever applicable.

**Room verification harness** should inspect GLB packet for hidden private pattern data, camera navigation collision, load-time RAM/GPU, access control to every asset endpoint, output reproducibility and outside-account denial.

## 9. Rough dependency/effort bands, not commitments

- Material schema + unit conversions and tests: 1–3 engineer-weeks.
- Four core measured textile specimens and calibration pipeline: 4–8+ engineer-weeks plus real specimen/professional testing access.
- PPF reference solver experimentation: 4–10+ engineer-weeks; significantly more if sewing/contact remains unstable.
- PBR material library and visual previews: 3–6 engineer-weeks plus look-dev artist time.
- First three Blender studios and still photo queue: 3–6 engineer-weeks with a Blender artist.
- Walkable local wardrobe prototype, one room and 10–20 original garments: 3–6 engineer-weeks, plus content preparation. A polished multiroom online experience and multiplayer are larger subsequent programs.

These are order-of-magnitude exploratory bands, **not promises or a budget approved for spending**. The public platform below should begin with read-only visual previews and static assets before adding remote heavy compute.

## 10. Source references and rights

- Original PPF solver (Apache-2.0): https://github.com/st-tech/ppf-contact-solver ; upstream itself warns that Metal/CPU can be slow and solver is experimental.
- Cloth physics reference (MIT): https://github.com/InteractiveComputerGraphics/PositionBasedDynamics
- Khronos glTF sheen: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_sheen/README.md
- Khronos glTF anisotropy: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_anisotropy/README.md
- Blender Asset Browser: https://docs.blender.org/manual/en/5.2/files/asset_libraries/introduction.html
- Three.js first-person control: https://threejs.org/docs/pages/PointerLockControls.html
- Local EXO reference: [PPF Metal cloth test](PPF_METAL_CLOTH_VALIDATION_2026-10-13.md), [fabric research](FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md), [Garment Studio actual PPF fit audit](PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md).

**Decision:** the right architecture is a hybrid physical engine plus independently validated material and photo assets, with a walkable gallery sharing the same Look library. It does **not** require rewriting EXO V2 or shipping PPF as its real-time Hand backend.
