# EXO — Spatial Projection, Interactive Patterns, Fashion Studios & AR
**Research and future-feature concept document**  
**Date:** 2026-10-16  
**Status:** Backlog / design research only. **Do not implement yet.**

**Expanded EXO ecosystem:** [Physics/materials and walkable gallery research](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md), [public free/paid pattern pool and profiles](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [interactive Web Tech Pack](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md) and [master architecture / delivery plan](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md).

**Detailed implementation companion:** [EXO Spatial Studio — Ten-Page Implementation Blueprint](EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md). It specifies actual EXO integration points, technical work packages, phased delivery order, hardware calibration, data contracts, QA gates, risk controls and research citations. This is planning, not implementation authorization.

**Actionable future work register:** [EXO Spatial Studio — Execution Backlog](EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md), with 48 proposed planning tickets, dependency gates and acceptance checks. These are not yet implementation approvals or externally filed issues.

**Broader EXO ecosystem research:** [PPF physics, measured fabrics, photo studios and walkable rooms](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md); [creator profiles, free/paid Pattern Pool and collaborative marketplace](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md); [interactive designer/manufacturer web Tech Packs](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md); and [expanded implementation backlog](EXO_PLATFORM_EXPANSION_EXECUTION_BACKLOG_2026-10-16.md). All are future concepts with separate source/privacy and approval boundaries.

## 0. Vision and scope

EXO could evolve from a 2D/3D clothing CAD desktop app into a physical/digital fashion workspace. The user described five linked future modes:

1. **Mannequin Projection**: project a digital outfit onto an actual mannequin or person and let a tracked hand grab the virtual fabric.
2. **2D Pattern Projection Table**: project accurate, configurable, full-size flat patterns onto a table for tracing, construction and visual reference.
3. **Spatial Pattern Editor**: use MediaPipe or Apple Vision to pinch, drag, rotate, edit endpoints/curves and move whole pattern pieces directly in the tabletop projection, reflecting changes in the EXO document.
4. **Virtual Garment Library and Photo Studios**: browse all created/imported garments on avatars, build looks, choose premade Blender studios, adjust lights, poses and camera, render images and videos.
5. **AR Try-On**: preview the clothing against real people via a camera or AR device, later investigating accurate body-specific fit.

All of these are **ideas, not existing EXO functionality**. No changes to the current build, native solver, simulation, projection hardware, or app interface are requested by this document. The intent is to save a feasible roadmap without starting implementation.

### Clarifying the fundamental distinctions

- A **projector** displays light; it does not measure, scan, track fingers, physically pull fabric or create garment collision. Sensing and rendering are separate systems.
- **Projection mapping onto a rigid mannequin** can present a convincing garment texture and color on the real model, but it does not turn the projected color into material or guarantee fabric drape.
- **Grabbing projected fabric** means grabbing a corresponding surface point on a *virtual solver garment* via a real hand gesture, recomputing the cloth, and reprojecting the resulting 3D image. The user's hand moves a simulated constraint, not the real object.
- **Full-scale 2D table projection** is a metric CAD/calibration problem, not simply sending the 2D app window to a projector.
- **Virtual try-on** is a family of visualizations; a believable overlay is not evidence of correct garment sizing, pressure, strain, comfort or fit.

The design philosophy: the physical workspace, original digital garment, 2D pattern and studio presentation should stay **synchronized**, with one authoritative version of geometry and durable metadata.

## 1. Future Mode A — Projected garment on mannequin, avatar or model

### A1. Static projection on a real mannequin

Start with a fixed mannequin, fixed camera and projector, original calibrated 3D mannequin/collider model, and the EXO avatar dressed in the matching simulated garment. The scene renderer accounts for the projector's exact optical viewpoint, mapping visible parts of the simulated shirt/sweats to the mannequin's surface. A custom white/gray mannequin would make illumination easier to control.

The early conceptual demonstration is an apparent 'digital shirt' on a real physical mannequin, with coherent garment seams, texture orientation, front/side colors and silhouette from the chosen viewer's position. This is spatial augmented reality through projection, but it is **not physical cloth hanging away from the mannequin**, and one projector cannot illuminate surfaces behind the model.

### A2. Use a hand to grab and deform the projected fabric

Use a real camera, MediaPipe hand landmarks or Apple Vision, a gesture recognizer, a calibrated camera-to-world transform, and ray/mesh hit testing to find which **virtual triangle** the fingertip is contacting. A pinch/hold attaches a temporary three-vertex barycentric cloth-grab constraint; movement updates the target; the solver pulls other cloth according to actual sewing, gravity, bending and fabric stiffness; release removes the constraint.

Expected interaction flow:
- Hover highlights the chosen garment or region when confidence is high.
- Pinch activates 'Hand' on the nearest valid visible cloth point.
- Moving the hand updates the temporary solver target and generates live fabric movement while held.
- Releasing the pinch removes that constraint; fabric is allowed to relax naturally.
- Open palm or a visible Cancel signal releases any grab safely.
- A deliberate gesture switches between Fabric Hand, Select, Move and Rotate modes; avoid accidental mode changes while grabbing.
- A second hand could eventually pinch another part, but simultaneous manipulation is not a first milestone.

**Critical rule:** Never fake the response by moving just the projected texture or teleporting the rest shape. The original ClothCraft/EXO solver should remain authoritative. Garment movement after release is physical relaxation, not instant and not necessarily exact return to the previous pose; friction, pinned areas and gravity influence equilibrium.

### A3. Projection on a moving person

This is far harder than a rigid mannequin. Human body pose, real garment occlusion, skin/cloth material, projection distance, changing surface geometry and the projector's blind side must be continuously estimated. It may require depth sensing, body tracking, sensor fusion, moving projector compensation, visibility masks and temporal prediction. A moving person may block their own projected outfit.

The initial version should not promise two-sided coverage, lifelike moving cloth or validated size/fit. Treat this as advanced research and use a stationary mannequin as the engineering stepping stone.

### Conceptual hardware

- Mac capable of native cloth simulation and rendering
- Short-throw or other appropriately mounted projector
- RGB camera mounted in a known location relative to the projector
- Optional depth sensor / stereo camera for fingertip-to-surface depth
- Calibrated real mannequin, physical registration points and controlled lighting
- Companion desktop/tablet fallback input for calibration, reset and undo

### Technical problem list

1. Projector lens calibration, intrinsic/extrinsic parameters and distortion.
2. Camera calibration and registration to projector and target mannequin.
3. Target mannequin 3D scan/mesh alignment with simulator collider.
4. Curved-surface reprojection; a simple planar four-corner homography **does not work for an entire 3D body**.
5. View-dependent visibility and occlusion masks; hand and body may block light.
6. Gesture confidence, pinch hysteresis, noisy rays and input latency.
7. Simulation interpolation and frame timing: avoid letting a slow physics step stall the projector.
8. Handling tracking dropout: release or hold safely; never leave an invisible permanent pin.
9. Projected color calibration, brightness and human eye safety.
10. Consent for recording real people, especially biometric/body imagery.

**Future acceptance tests:** reprojection error at measured mannequin points, gesture latency distribution, repeated grab/release consistency, solver time/geometry advance *while held*, occlusion alignment, calibrated fabric response, recovery from camera disconnect or simulation failure, and sustained projector sessions.

## 2. Future Mode B — Metric 2D pattern projection table

This is the **most achievable physical interaction concept** because the tabletop is a stationary plane rather than a curved or moving body.

### Projection setup profiles

Save hardware-specific calibrated profiles with: projector dimensions/output resolution, physical table width/height in millimeters, origin, axes, projection footprint, rotation/mirroring, camera model, lens distortion, table plane transform/homography, ruler/test grid result, brightness, output color, and last verification timestamp.

Changing projector/table/camera position invalidates calibration. There should be a giant **Verify 100 mm** scale reference, multiple corner marks and a confidence/error indication. Patterns are always authored in CAD metric units; zooming a normal desktop preview never modifies their physical size.

### B1. Trace / Outline Mode

Display a single selected pattern or entire lay plan at locked **1:1 real-world scale** onto tracing paper, fabric, cardboard, cutting mat or pattern board. Toggle:

- Cut outline versus sewing line
- Seam allowances and hem allowances
- Grainline, fold line, center front/back, registration axes
- Notches, dart points, drill marks and internal construction lines
- Measurement labels, millimeter ruler, adjustable metric grid
- Pattern piece name, size/colorway, mirror designation and revision
- Safe margins and projector field boundaries
- High-contrast line color/width optimized for paper or dark fabric

A tracing mode should suppress edit handles and accidental gesture changes. The system must not call this a certified cutting workflow until repeatable **physical measured error** is evaluated across the actual target surface. Real cloth can slip, stretch or wrinkle; projector optics distort edges and width; bright rooms reduce fine lines.

### B2. Interactive Spatial Editor

Switch the table from passive display to editing. Project control points, curve tangents, edge segments, translation handles, rotation gizmos and guides. With hand tracking:

- Hover at a calibrated position.
- Pinch to select the nearest authorized point, edge or piece.
- Drag a point or Bezier handle and show the measurement delta in millimeters.
- Drag a whole piece, or rotate it around a visible pivot.
- Snap to grid, seam boundary, axis or measurement rule.
- Release to commit an EXO 2D CAD edit with undo/redo.
- If confidence drops, freeze/abort the edit without leaving malformed polygons.
- Use a companion screen button/voice/gesture to swap between Select, Point, Curve, Move, Rotate, Pan, Compare and Trace.

A tracking model's normalized coordinates are **not** table millimeters. Transform fingertip rays to the calibrated plane; when using a simple camera, hover height can make fingers appear offset. A depth sensor can improve touch-versus-hover discrimination.

### B3. Layout and Multi-Panel Modes

Move multiple digital pattern pieces around the projected fabric width; optionally allow alignment, mirrored pieces, seam matching, piece labels, fold edges and material/grain constraints. Compare two variants or graded sizes as layers (different line styles, not just color). Optional educational mode: illuminate a drafting step while somebody traces it.

A tabletop UI can make it easy to lay out patterns. It does **not automatically calculate factory nesting, cutting tolerances, grading or marker optimization**. Those remain separate production features with their own tests.

### Suggested calibration pipeline

1. Calibrate camera intrinsics and lens distortion with a chessboard or ChArUco marker target.
2. Establish table-plane coordinates using known measured points.
3. Calculate camera-to-table coordinates; then map table to calibrated projector pixels.
4. Run validation ruler/checker grid across the tabletop, measuring at center, corners and edges.
5. Store transforms per physical setup; lock calibration in metric tracing mode.
6. Recalibrate when zoom, keystone, throw distance, table surface or sensor position changes.

OpenCV's ChArUco/ArUco tutorials explain camera calibration with marker corners. On a table a **planar homography** is a reasonable first transformation; on a real 3D mannequin a mesh-based projector model is required.

## 3. Future Mode C — Integrated 2D/3D Spatial Workspace

The conceptual architecture should keep desktop and projected interfaces synchronized with the same garment. A change to a pattern endpoint on the table updates the **underlying document**, sewing connection and eventual simulated geometry—not an untracked projected pixel layer.

Concept pipeline:

    CLO export / EXO authored garment / Blender import
                            |
                    Garment asset registry
              pattern + mesh + fabric + metadata
                            |
                   Versioned CAD commands
                    /       |       \
             2D pattern   Rust cloth  Presentation mesh
                   \         |       /
                Scene & interaction bridge
                            |
                 Display / input adapters
             desktop / 2D table / mannequin
                            ^
                  Camera / hand tracking
              calibration and hit-testing

Technical interface requirements:
- World 3D positions in meters; 2D drafting and table measurements in millimeters; pixel-space coordinates only inside calibrated display adapters.
- Typed action messages: GrabStart, GrabMove, GrabRelease, PointMove, PieceMove, PieceRotate, Undo, Cancel, SetMode and SelectAsset.
- Every authored command knows document revision, panel ID, optional point/edge ID, source input modality and transform version. Never apply an edit to stale CAD geometry silently.
- Separate transient visual hand cursors, temporary cloth constraints, actual permanent pattern edits and nondestructive studio scene changes.
- Keep source-of-truth physics inside EXO/ClothCraft; do not substitute projection software for the solver.
- Replay/undo for committed design edits; simulation states can be reset without reverting the authored design.

**Failure states must be planned early:** calibration lost, projector disconnected, camera disappears, tracked hand confidence low, projection hidden by user's body, garment solver reports contact failure, mesh revision changes mid-drag, or app loses focus. Safely release cloth constraints and allow keyboard/manual controls. No unbounded pointer coordinate motion.

### Tracking systems to evaluate

**MediaPipe:** Hand Landmarker and Gesture Recognizer, useful for RGB cameras, desktop and other platforms. Its results include normalized image landmarks and world landmarks; these are not equivalent to a registered camera/projector or a measured mannequin. Its code is generally Apache-2.0, but model files/dependencies must be checked independently.

**Apple Vision:** Native Apple framework hand/body pose APIs, a macOS option for a fast local pipeline. Apple's Vision framework is proprietary even when a third-party adapter is open source. Verify camera permissions and OS/hardware support.

**Apple Frameworks for TouchDesigner:** A public GitHub project provides reference techniques for Apple/TouchDesigner plugins; verify its exact license/build compatibility before reusing. Do not assume that the previously discussed 'AppleTD' repository or Apple Vision SDK is MIT without checking the specific source.

**TouchDesigner / Kantan Mapper:** Useful as an isolated rapid-prototyping environment for sensor data, real-time visuals and projection warping. TouchDesigner itself is proprietary and should not become a hard dependency of a future open-source EXO release without explicit product licensing strategy.

**OpenCV:** Strong choice for camera calibration, lens distortion, fiducial detection, plane mapping, projected marker validation and basic computer vision. OpenCV 4.5+ uses Apache-2.0.

## 4. Future Mode D — Garment Library, Outfit Showroom and Photo Studios

### Overall experience

A visually rich **Garment Library** shows everything created inside EXO, approved exports from CLO3D and clothing modeled in Blender. Each garment may have multiple sizes, colorways, editable source projects, render meshes and fabric material references. Present combinations as **Looks**, each showing one or more dressed avatars in a custom 3D environment.

Proposed main views:
- **Garments:** search/filter by collection, silhouette, hoodie/tee/trouser, season, draft status, material, size and colorway.
- **Look Builder:** dress neutral mannequins or rigged avatars with garment combinations, save outfits and swap pieces without duplicating the source geometry.
- **Virtual Studio:** browse prebuilt studio thumbnails; choose scene, lighting preset, background, camera, model pose, material and render style.
- **Lookbook:** presentation carousel/grid of saved images, orbiting 3D models, video/turntable, collections and comparisons.
- **Asset Inspector:** EXO source link, imported file format, author, file license, textures, rig data, scale, outfit dependencies, render settings and quality warnings.

The full library is **not asserted to exist yet**; an inventory/import tool is a separate future effort.

### Blender-built studio presets

All environments should be original, owned or appropriately licensed Blender creations. Store an editable **.blend master scene** plus runtime export where possible. Studio templates may include:

| Studio | Design idea | Use |
| --- | --- | --- |
| White Infinity | White cyclorama, neutral softboxes, floor shadows | E-commerce product front/back |
| Concrete Editorial | Neutral cast-concrete wall/slab, strong area lights | Editorial fashion looks |
| Black Void | Black stage and subtle rim lighting | Silhouette, reflective trims |
| Archive Muslin | Cream muslin backdrop, softer side light | Garment construction and story |
| Gallery / Stone | Original stone architecture and gallery floor | Architectural collection campaign |
| Runway | Linear runway, avatars moving past camera track | Fashion show and animated looks |
| Outdoor Daylight | HDRI, believable sun/shadow plane | Lifestyle presentations |
| Color Cyclorama | Solid brand-specific colors and gradient setups | Collections and campaign variants |

Each studio definition should specify environment geometry, floor, world/environment illumination, key/fill/rim light values and positions, camera focal lengths/angles, color management, render preset, props, license and preview image. Scene files must stay editable in Blender; portable GLB/USD-derived versions may omit certain Blender-native shaders/volumetrics/constraints, so export validation and look comparisons are necessary.

### Mannequin and avatar ideas

- Neutral male, female, unisex and user-measured avatars from legitimately sourced meshes.
- Standing neutral pose, arms down, T-pose, walking/runway and editorial pose choices.
- Adjustable height/shape/measurements with collision mesh distinct from render-only avatar.
- Front, 3/4, back, side, detail, full-body and turntable shot cameras.
- Appearance controls for skin, hair, shoes only if sourced and licensed. No assumption that proprietary CLO avatar geometry can be distributed in an open-source product.
- Optional garment simulation per pose and caching for turntables, not a promise that arbitrary deformation preserves fit.

### CLO3D feature research (verified in vendor documentation)

CLO3D provides **V-Ray Interactive Render**, which previews changes to garments/avatars in a render window, plus final image/video output. It documents **environment map/HDRI lighting**, adjustable rectangle/area lights and render quality/material/light settings. Imported OBJ geometry can act as environmental props; exported garment OBJ, FBX and glTF/GLB provide interchange paths; garment/avatar animation and pose libraries are documented. Newer keyframe documentation includes camera and light animation controls.

The right reference point is therefore not 'one studio effect' but a **scene assembly pipeline:** avatar + garment + material + environment + lighting + camera + final render/animation. CLO is a proprietary feature benchmark, not a source license to port code or reuse its bundled stages.

Vendor sources:
- V-Ray Interactive and Final Render: https://support.clo3d.com/hc/en-us/articles/115015559167-V-Ray-Render
- V-Ray lighting/environment maps: https://support.clo3d.com/hc/en-us/articles/115015558727-V-Ray-Render-Light-Properties
- Advanced render properties: https://support.clo3d.com/hc/en-us/articles/115014899148-Edit-V-Ray-Render-Properties
- OBJ import/export: https://support.clo3d.com/hc/en-us/articles/115000494107-3D-File-OBJ-Import-Export
- OBJ environment props: https://support.clo3d.com/hc/en-us/articles/115012226667-Import-OBJ
- FBX: https://support.clo3d.com/hc/en-us/articles/115000526908-3D-File-FBX-Import-Export
- glTF/GLB: https://support.clo3d.com/hc/en-us/articles/360051525034-glTF-2-0-GLTF-GLB-File
- Pose library: https://support.clo3d.com/hc/en-us/articles/115002687328-Pose-POS-HPOS-Open-Save
- Garment animation: https://support.clo3d.com/hc/en-us/articles/115000560428-Garment-Animation-Making
- Camera/light keyframe animation: https://support.clo3d.com/hc/en-us/articles/44802289682073-Keyframe-Animation

### Import/export integrity

**Native EXO designs:** retain authoritative editable 2D patterns, seams, measurements, material physics and history separate from triangulated render derivatives. A photo studio save must not change the factory source.

**CLO3D garment imports:** prefer CLO's supported OBJ / FBX / glTF/GLB exports, with original user authorization, proper units, axes, UVs, color, textures, and optionally animation. A **visual mesh export is not a guaranteed round-trip reconstruction of an editable CLO sewing pattern**; preserve source/project reference and note conversion loss. Validate the exact CLO version/export options.

**Blender imports:** accept original user .blend files as project-level assets when accessible, and create portable runtime exports for viewing. Blender Asset Browser and catalogs offer a relevant model for organization, linking and reusing assets. External texture paths, modifiers, materials and baked animation require explicit packaging tests.

### Future data model — conceptual only

GarmentAsset:
- Stable ID, revision, display name, project/collection, garment category and author
- Native source link, import source, permitted use and third-party licenses
- Editable pattern reference, rendered drape mesh reference and format
- Fabric IDs and tested material profiles, colorways, grades, size system
- UVs, textures, seam data, axis convention and physical scale
- Preview/render cache, associated avatars, validation status and source hash

Look:
- Outfit/garment version references, chosen avatar and pose
- Studio scene, camera preset, lighting preset and material variant
- Preview thumbnails, final image/video, publication/privacy rights

StudioAsset:
- ID, Blender master .blend reference, optional optimized GLB/USD variant
- Stage geometry, floor, HDRI provenance, props, lights, cameras
- Preview image, license, scale, editable/render-readiness state

A manifest/registry should use stable IDs and asset hashes, not brittle hardcoded machine paths. Multiple Looks must be able to reference the same single garment version without duplicating its entire geometry cache.

## 5. Future Mode E — AR and virtual try-on

Plan three separate and clearly labeled product levels:

**E1: Virtual avatar try-on (lowest risk).** Dress a controllable 3D avatar in the selected collection and render the outfit under chosen lights and cameras. Useful for silhouette and aesthetics even without scanning the user.

**E2: Camera-based on-person appearance preview.** On a phone or camera screen, track the person, estimate pose/segmentation and overlay a stylized or skinned garment. Add depth-aware occlusion where available. This is a visual preview and may not accurately predict size or folds.

**E3: Body-specific physically informed try-on (research-heavy).** Estimate reliable measured body dimensions, align a rigged and collision-valid body mesh, use measured fabric physical properties and actual pattern grading, and compare with real garments across poses. Avoid recommending a size before external calibration against real people and garments.

ARKit supports 3D body motion and skeleton data on compatible Apple devices. ARCore's Depth API on supported Android devices can improve occlusion and surface understanding. These frameworks are not interchangeable with a single projected mannequin. A projector is a shared-room display; a phone/headset AR session has its own camera/head pose and occlusion rendering.

**Privacy:** body scans, motion traces, depth maps and camera imagery can be sensitive. Local processing and explicit opt-in, retention controls, secure export, and avoiding incidental bystander capture should be design constraints from the beginning.

## 6. Evidence-based feasibility and recommended sequence

| Idea | Relative difficulty | First credible demonstration | Main risk |
| --- | --- | --- | --- |
| Fixed 2D tabletop pattern at real scale | Low–medium | Verified 100 mm checks across table | Optical distortion; surface calibration |
| Gesture editing of 2D pieces | Medium | Drag 1 endpoint with correct mm delta and Undo | Tracking/height error; accidental pinch |
| Garment Library + Blender studios | Medium | Several original studios and licensed garment assets | Import provenance, consistent formats |
| Stationary mannequin projected garment | Medium–high | Shirt map stable on a known mesh | Curved-surface registration/occlusion |
| Live hand manipulation on projected model | High | True solver deforming while pinch held | Real-time geometry/tracking coordination |
| Camera/phone AR style preview | High | Stable tracked preview with occlusion | Person segmentation and shape |
| Reliable individual sizing / AR fit | Research-level | External physical fit benchmark | Accurate body/material/garment mechanics |

These are qualitative relative risks, **not development-time estimates or completion percentages**.

### Stage plan (all on hold; not build tasks)

**Stage 0 — Design specification:** Inventory current EXO editable garment formats, rendered mesh outputs, existing Blender stages, legal rights for avatars and actual projector/camera/surface equipment. Establish non-negotiable accuracy and privacy requirements.

**Stage 1 — Fixed tabletop read-only projection:** One calibrated table and projector; output a scale-locked outline, labels and measurement grid. Verify full-size geometry at corners and center with a ruler. No gesture or factory cutter claims.

**Stage 2 — Tabletop editing:** Add camera-to-table fingertip tracking, hover/pinch selector, move/rotate point and whole panel, undo, calibration validity gate, trace/editor mode switch. All edits commit through EXO's existing CAD commands.

**Stage 3 — Garment Library and virtual photography:** Asset registry, native EXO assets and authorized CLO/Blender imports, avatar-dressed Looks, original Blender-built stages, photoreal preset thumbnails, cameras, materials, turntables and rendered video.

**Stage 4 — Static 3D mannequin projection:** Scan/measure mannequin, calibrate projector-camera-body transform, handle curved geometry and surfaces out of projector sightline. Compare overlays from multiple observer viewpoints.

**Stage 5 — Projected Hand physics:** Connect confidence-gated tracking to the native cloth solver's real temporary grab, with correct release, collision and restart behavior. Benchmark repeated interactions, scene latency, input dropouts and projection update.

**Stage 6 — AR try-on study:** Introduce device-based body tracking and an honest preview. Make accurate body-specific cloth fit a separate measured-research program.

### Acceptance-test ideas for future researchers

- For tabletop projection, log errors between CAD reference lengths and physically measured projected lengths at many points, under several table/camera conditions; refuse metric Trace when the configured tolerance is violated.
- For projection gestures, log gesture recognition false positives, selection/drag error in table millimeters and latency; verify no edits occur during low confidence/cancel.
- For projected cloth, show native simulation positions/time advancing while a hand is holding the fabric; confirm release leaves no constraint; demonstrate return to material-specific equilibrium.
- For studio, prove identical garment geometry across environments and reproducible scene exports; check materials, UVs, lighting, pose and source licenses; verify the EXO editable design is untouched.
- For AR, quantify pose/depth stability, occlusion failures and visual drift; do not claim size validity on appearance alone.
- For privacy, track consent and document when video/body data is stored or transmitted.

## 7. Open-source and documentation sources (verified references)

These are **research candidates**; no repository was installed, vendored or copied during this work.

| Resource | Research use | Rights warning |
| --- | --- | --- |
| MediaPipe Hand Landmarker and Gesture Recognizer | Landmarks, on-device video/live tracking and interactions | Core MediaPipe code Apache-2.0; check model files and extras |
| Apple Vision hand pose | Native Apple tracking option | Proprietary Apple SDK; public adapters have independent licenses |
| OpenCV ChArUco tutorial | Repeatable camera/table calibration | OpenCV 4.5+ Apache-2.0; verify installed version |
| MapMap projection software | UI/reference for projection mapping | **GPL-3.0**; copying code into EXO needs licensing review |
| ofxPiMapper | Lightweight projection mapping reference | **MIT** per project README; assess platform/dependencies |
| TouchDesigner MediaPipe plugin | Prototype sensor/visual signal bridge | TouchDesigner proprietary; repository license separately verified before reuse |
| Apple Frameworks for TouchDesigner | Candidate Apple Vision/ML plugin reference | Confirm exact plugin license, build and distribution conditions |
| Blender Asset Browser | Catalogs for scenes, poses, materials and assets | Blender GPL software; asset copyright/licensing independent |
| CLO3D V-Ray and 3D import/export guides | Commercial rendering and workflow comparison | CLO software/assets proprietary |
| ARKit body motion and ARCore Depth | Future device body/occlusion research | Device/platform APIs; not evidence of physically accurate fit |

Source URLs:
- https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/HandLandmarker
- https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/HandLandmarkerResult
- https://developer.apple.com/documentation/vision/detecthumanhandposerequest
- https://github.com/opencv/opencv/blob/5.x/doc/tutorials/objdetect/aruco_calibration/aruco_calibration.markdown
- https://opencv.org/LICENSE/
- https://github.com/mapmapteam/mapmap
- https://github.com/kr15h/ofxPiMapper
- https://github.com/torinmb/mediapipe-touchdesigner
- https://github.com/sygnalinc/Apple-Frameworks-for-TouchDesigner
- https://docs.blender.org/manual/en/5.3/editors/asset_browser.html
- https://developer.apple.com/documentation/arkit/capturing-body-motion-in-3d
- https://developer.apple.com/documentation/arkit/arskeleton3d
- https://developers.google.com/ar/develop/depth

**Source and licensing caveat:** A public GitHub listing alone doesn't guarantee an open-source license; inspect the actual LICENSE and asset/model terms before copying any implementation. A compatible third-party plugin does not turn Apple Vision, TouchDesigner or CLO3D into open source.

## 8. Existing EXO references and no-build boundary

Research adjacent to existing EXO plans:
- EXO rendering/avatars: [EXO_UI_RENDERING_AND_AVATARS.md](EXO_UI_RENDERING_AND_AVATARS.md)
- Fabrics/PBR: [EXO_FABRIC_MATERIALS_AND_TRIMS.md](EXO_FABRIC_MATERIALS_AND_TRIMS.md)
- Avatar sources/rights: [EXO_FREE_OPEN_SOURCE_AVATAR_RESEARCH_2026-10-16.md](EXO_FREE_OPEN_SOURCE_AVATAR_RESEARCH_2026-10-16.md)
- Manufacturing source fidelity: [EXO_PRODUCTION_PIPELINE.md](EXO_PRODUCTION_PIPELINE.md)
- Existing Hand/Move native interaction: [../integrations/clothcraft/HAND_MOVE_V2.md](../integrations/clothcraft/HAND_MOVE_V2.md)
- Current render-studio screenshot: [../screenshots/exo-2026-3d-render-studio.png](../screenshots/exo-2026-3d-render-studio.png) — this is **not evidence** that the envisioned virtual library/studios already exist.

**Explicit decision:** Keep all five feature concepts in research/backlog. Do not change app UI, Rust solver, physical calibration, installed Mac bundle, projector configuration or commercial/public assets under this request. Reassess version/compatibility, precise hardware and licences only when work is separately approved.


## 9. Research extension: choose the hardware and software pathway before coding

The same visual concept supports several fundamentally different engineering stacks. Choosing a sensing and projection path should be deliberate and repeatable rather than a collection of impressive but incompatible demos.

### 9.1 Three feasible hardware configurations

| Configuration | Projection surface | Sensor | Display | Intended first experiment | Avoid promising |
| --- | --- | --- | --- | --- | --- |
| **Table / fixed plane** | Flat light-colored tabletop | Overhead RGB webcam; optional depth later | Projector above or beside table | Physical-scale pattern tracing, point/edge selection | Factory-certified cutting accuracy |
| **Mannequin / fixed curved mesh** | Light matte mannequin with known geometry | RGB camera rigidly attached to projector mount, optional depth | One projector first | Calibrated shirt appearance + hand hit-test | Real drape outside rigid silhouette or unseen back coverage |
| **Person / moving geometry** | Body, actual garments and skin | Pose + segmentation + depth / multi-view registration | Prefer phone AR preview before physical projector | Visually track garment over one pose/motion | Validated size, seamless 360-degree projection, or real-time individual cloth fit |

An existing laptop camera is a useful tracking input only if mounted at a fixed, measurable viewpoint. A webcam mounted directly on the computer screen is not automatically aligned with a wall projector. For tabletop metrics, first test with a plain mouse cursor and a physically measured calibration grid; gesture tracking is a later, independently testable layer.

Suggested preference is a **single calibrated camera/projector/table installation profile**, then a separate mannequin rig profile, then a mobile AR device configuration. Never reuse a table homography as a 3D mannequin calibration.

### 9.2 Coordinate frames and calibration artifact contract

Treat each transform as a distinct object:

| Space | Units / meaning | Typical input | Conversion |
| --- | --- | --- | --- |
| Pattern local | millimeters from each authored piece origin | Editable EXO points/curves and seamlines | piece-to-table layout transform |
| Table plane | millimeters from physical calibrated corner | Projection layout and hit positions | table-to-projector mapping |
| RGB image | pixel coordinates + lens distortion | MediaPipe / Vision hand landmarks | undistort then image-to-plane/world |
| World 3D | meters, right-handed convention chosen for project | EXO avatar and cloth state | world-to-projector virtual camera |
| Projector image | output pixels, final warping/masking | Projected pattern or garment render | real projector display pipeline |
| Avatar local / rig | meters, pose-dependent | Avatar skeleton/body collider | rig bone/world transform |

A table calibration artifact (future) should contain a schema version, hardware identifiers, table dimensions in mm, camera matrix and distortion coefficients, plane basis and origin, camera-to-table transform, table-to-projector mapping, viewport rectangle, confidence/error statistics, reference image hashes, and a timestamp. A mannequin calibration adds the reference body mesh hash, world-to-projector pose, projector intrinsics, camera extrinsics and mask; its surface mapping should be ray-based rather than an all-purpose homography.

**Never confuse MediaPipe model-world landmarks with the camera-calibrated room-world coordinates.** MediaPipe world landmarks are a hand-relative coordinate estimate, not a physical anchor to the projector. Likewise, Vision's 2D recognized hand points still need camera modeling before a meaningful tabletop hit test.

### 9.3 Suggested gesture contract (conceptual, not an implemented API)

Every frame consumed by EXO would have:
- tracker ID and input source (MediaPipe, Apple Vision or another calibrated device);
- capture timestamp, receipt timestamp, hand ID and handedness, and joint position/confidence;
- currently valid calibration revision and 3D/table transform identity;
- active interaction mode and candidate garment/panel/edge/point identifier;
- gesture state (hover, press candidate, held, moving, release, cancel, confidence-lost);
- position in the correctly calibrated table-mm or world-meter frame, plus uncertainty;
- garment source version so late events cannot deform an already replaced mesh.

Do not send unfiltered gestures directly to a fabrication operation. The **gesture interpreter** should emit deterministic high-level commands; the **CAD/solver command bus** should validate those commands and return accepted/rejected status; the **projector renderer** should consume accepted geometry updates. An update that arrives late or from an expired calibration must be rejected and surfaced in a visible status, not silently projected with stale coordinates.

### 9.4 Two very different definitions of 'move a panel'

- **Pattern Layout move:** shifts/rotates a *flat pattern piece on the cutting table* without changing the polygon's internal metric coordinates or an already saved measurement system.
- **Garment 3D move:** relocates some current simulated cloth particles in 3D without modifying the editable 2D pattern; a subsequent native solve should pull sewn neighbors and this panel according to topology, friction and gravity.
- **Point/curve edit:** actually changes pattern geometry in 2D, must mark a garment revision and re-mesh/re-simulate before claiming the 3D outfit matches.
- **Photo studio move:** changes a presentation avatar or camera and must not accidentally rewrite the garment's production data.

Keep these commands visually and technically separate, even if the user gestures with the same two fingers.

### 9.5 Recovery rules for physical gestures

Every temporary cloth grab must have **an owner ID and expiry**. The system shall release it on finger lift, hand loss, mode exit, calibrated-camera disconnect, projection window close, solver rejection or reset. An incomplete gesture should never keep an invisible spring on a real garment, and the UI should disclose when the cloth is actively constrained.

For tabletop CAD, the inverse rule is appropriate: if a tracked hand disappears mid-edit, **do not commit a partial destructive polygon edit**. Show a frozen preview until a short confirmation window expires, then cancel or offer an explicit commit from the desktop. Keep a small action log for debugging without storing camera video by default.

## 10. Research extension: EXO garment collection and Blender studio pipeline

### 10.1 First inventory: index without changing people's files

Do **not** assume all past CLO3D files are already available to EXO. A future library import pass should identify user-authorized folders and record discovered file name, path, extension, hash, size, modified time and thumbnail availability. Show **Indexed** separately from **Imported**, **Dressed / rigged**, **Renderable**, **Editable in EXO**, and **Missing dependencies**. A CLO project file on disk is not proof it can be decoded into fully editable EXO sewing data.

Recommended initial sources:
- EXO fitting project / editable pattern saved in the local workspace.
- Known Blender scene .blend files and appropriately licensed environments.
- CLO-origin .zprj / .zpac only as *source references* until exported via a supported and authorized workflow; do not claim direct parsing.
- Explicit exports: OBJ / FBX / GLB with textures, scale, axes, materials and version info, and neutral silhouette turntable previews.
- Original stills/videos, with explicit provenance and permission.

**Important:** an OBJ or GLB mesh is a presentation/render asset unless proven otherwise; it generally does not recreate original 2D patterns, sewn edges, material physics, size grading or manufacturing metadata.

### 10.2 Data flow: one item, many representations

The ideal library object links **source**, **derived meshes**, **looks**, **studios**, and **renders** as separate, versioned records. No use of a separate scene should mutate the source garment. Example conceptual lifecycle:

1. The user saves a garment in EXO or exports it from CLO.
2. A read-only library importer indexes all associated files and asks for missing texture/simulation assets when necessary.
3. The 3D asset validator confirms unit scale, triangles, UV and normals, texture dependencies, variant names and animation channels.
4. The library creates a neutral preview, then an outfit-on-avatar preview where geometry/rig compatibility permits.
5. Looks reference exact garment versions; one Look uses a white e-commerce studio while another uses a gallery studio.
6. Render jobs produce thumbnails/turntables/videos with provenance and deterministic render settings; failed renders do not replace accepted previous previews.
7. User modifications create new versions, not overwrites of source CLO or Blender projects.

A suggested virtual folder design for future consideration (not created):

    EXO-Assets/
      garments/collection-id/garment-id/
        manifest.json
        source/
        display/
        textures/
        previews/
      avatars/avatar-id/
        manifest.json
        mesh/
        rig/
        previews/
      studios/studio-id/
        scene.blend
        manifest.json
        runtime/
        previews/
      looks/look-id/
        manifest.json
        outputs/
      calibrations/
        table-profile-id.json
        mannequin-rig-id.json

The index should be relocatable: source IDs and relative package references first, absolute system paths only as optional import provenance. Never scan unrelated user folders or silently upload source clothing designs.

### 10.3 Studio / Photoshoot user experience

**Browse studio:** present a visual wall of environment thumbnails with configurable categories: Product, Editorial, Campaign, Architectural, Runway, Outdoor. The user can enter an environment, swap its avatar, and pick a saved garment variant.

**Compose shot:** switch front/back/side/three-quarter, orbit view, lens focal length, camera height, crop, 3-point lighting, environment HDRI, floor shadows, color temperature and resolution. Offer a material/texture close-up preset and a neutral color-verification mode distinct from dramatic campaign lighting.

**Batch render:** a saved Look could specify front/back/detail + a turntable and a product image set. Use an explicit job queue with progress, cancellation, source version and outputs. The camera/environment configuration belongs to the Look; never overwrite the canonical garment by baking lighting into its material source.

**Avatar wall:** multiple mannequins wearing different sizes/colorways for side-by-side composition. Each model requires explicit garment compatibility and correct pose/body orientation; a mesh simply attached to the same transform is not physically refitted clothing.

**Blender authored studios:** keep the .blend master in an asset catalog, with original geometry, props, world background, real lights, color management and preview image. Blender's official Asset Browser supports catalog organization of blend-file data blocks. EXO's studio browser should reference those catalogs and a separate runtime-export manifest, not merely call a folder of PNGs a Blender asset library.

### 10.4 Render fidelity and interchange warnings

Official Blender glTF export documentation notes that **area lights and World lighting are not exported as glTF punctual lights**. Supported lights are punctual types (point, spot, directional), and other render-specific behavior may not survive. Consequently, a GLB runtime scene should carry a separately authored EXO lighting/environment preset while Blender .blend remains the authoritative beauty-render setup.

Other loss risks: Blender Geometry Nodes, procedural textures, modifiers not applied or evaluated consistently, proprietary renderer nodes, volumetric effects, cloth caches, render engine/color-management settings and rig-specific constraints. Validate source-vs-runtime with standardized screenshots; note any downgrade in the library inspector.

A 'studio preset' is conceptually a scene recipe plus reusable geometry, environment and render settings — **not just a baked HDRI image**. The goal is a credible collection/editorial photography workflow with repeatable cameras and post effects.

### 10.5 Initial environment catalog (inspired by existing EXO art direction)

| Collection | Blender scene preset | Shot intent | Technical dependencies |
| --- | --- | --- | --- |
| Product | White cyc, floor shadow, softbox three-point | Consistent front/side/back e-commerce | Matte surface + stable exposure |
| Product | Neutral gray studio | Fabric and seam comparison | Color-verified light, fixed white balance |
| Campaign | Original concrete architectural room | Editorial layering, details and silhouette | Custom mesh + multiple area lights |
| Campaign | Original architectural columns / statues | Gothic/old-world visual language, no copied landmarks | Scene licensing + lightmaps/shadows |
| Editorial | Muslin draped backdrop | Process/origin narrative and detailed stitching | Cloth/fabric backdrop authoring |
| Motion | Black stage with a rotating camera | Hardware, padded surfaces and silhouette | Turntable camera, rim light |
| Fashion show | Minimal runway / seated gallery | Collection overview and multi-outfit lineup | Character rigs, garment animation caches |
| Outdoor | Sun/overcast outdoor set with HDRI | Product look across lighting contexts | HDR source rights, shadow plane |

These are design directions only: **no Blender environments have been created or added**.

## 11. Research extension: checked repository shortlist and license boundary

This expands the earlier candidate list with more precise licensing and runtime constraints, as verified from public documentation/README on 2026-10-16. Always re-check the chosen tag before redistribution.

| Candidate | Research role | Verified or reported license | Decision for a future EXO prototype |
| --- | --- | --- | --- |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Cross-platform hand/gesture data | Apache-2.0 for core repository; model-specific terms vary | Strong candidate for first tabletop tracker |
| [Apple Vision Hand Pose](https://developer.apple.com/documentation/vision/vndetecthumanhandposerequest) | Native Apple hand-point detector | Apple's proprietary frameworks/public APIs | Good alternative on Mac; cannot redistribute Apple framework as source |
| [Apple Frameworks for TouchDesigner](https://github.com/sygnalinc/Apple-Frameworks-for-TouchDesigner) | Rapid TD prototype of native VisionHand, VisionPose, VisionRect, segmentation | Repository's own plugin code says **MIT**; SDK/model licensing separate | Reference/prototype only; not standalone EXO replacement |
| [MapMap](https://github.com/mapmapteam/mapmap) | Projection mapping UI and warping inspiration | GPL-3.0 | Reference or separate evaluation; consult counsel before using code in differently licensed EXO modules |
| [ofxPiMapper](https://github.com/kr15h/ofxPiMapper) | Lightweight openFrameworks mapping reference | MIT in project README | Compatible-style reference but Raspberry Pi/openFrameworks dependencies need validation on target Mac |
| [OpenCV](https://opencv.org/LICENSE/) | ChArUco calibration, undistortion, projective transforms | Apache-2.0 for modern OpenCV versions | Strong underlying math/tooling candidate |
| [Blender Asset Libraries](https://docs.blender.org/manual/en/5.2/files/asset_libraries/introduction.html) | Native .blend studio asset catalog and pose/material reuse | Blender application GPL; user assets independent | Authoring/library reference, not blanket license for all downloaded assets |
| [CLO3D Render](https://support.clo3d.com/hc/en-us/articles/115015558727-V-Ray-Render-Light-Properties) | Benchmark lighting/preset photography tools | Proprietary commercial software | Compare behavior, create original studio presets |
| [CatVTON](https://github.com/Zheng-Chong/CatVTON) | AI photo-based visual try-on research | **CC BY-NC-SA 4.0** for published code/checkpoints/demo | Research-only; not a drop-in commercial EXO feature |
| [IDM-VTON](https://github.com/yisol/IDM-VTON) | Diffusion-based image try-on research | **CC BY-NC-SA 4.0** for published code/checkpoints | Research-only; generated image is not verified physical fit |

**Correction / unresolved identification:** A previously mentioned GitHub URL named *AppleTD* (ojrgb/appletd) could not be verified as an accessible repository in this research pass. It must **not** be listed as a confirmed MIT-licensed integration or project dependency. The verified and clearly named **Apple Frameworks for TouchDesigner** repository by sygnalinc is a different reference.

**Specific security warning:** The verified Apple Frameworks for TouchDesigner README says an optional demo TouchDesigner MCP component opens an **unauthenticated Python-execution endpoint on all interfaces on port 9988**. The docs explicitly recommend deleting that demo component if not intentionally using it. EXO research should **not** enable it, expose it to LAN/internet, or make it part of an app distribution. Prefer local-only, authenticated/permission-scoped message transport for any future automation controls.

**TouchDesigner free-tier constraint:** the same repository documents TouchDesigner Non-Commercial's output resolution cap (1280x1280) and plugin handling. It is a reason to avoid making TD the required production projection engine for large calibrated 2D sewing tables; evaluate any TD proof of concept under the actual Derivative license and output limits.

**AI try-on interpretation:** CatVTON/IDM-VTON can serve as appearance/compositing research references, but their published noncommercial terms and lack of calibrated cloth/body mechanics mean neither should be treated as a factory-fit, live hand physics, or unrestricted commercial integration.

## 12. Prototype-grade test cards (for later, not to run today)

A future proof-of-concept team should run **independent tests** and only progress when evidence is captured, rather than using a single attractive demo video as validation.

### P0 — Table projection accuracy baseline

- Fixture: grid board with visibly measured true lengths across at least center and multiple corners.
- Setup: fixed projector + table; no camera, gesture or simulation needed.
- Test: draw multiple known CAD lines, project at 1:1 physical scale, measure by physical ruler/checker at the surface.
- Capture: calibration profile version, lens/keystone configuration, table profile, measured deviations in mm, photos of references, and pass/fail against a tolerance selected for the intended *reference/tracing* use.
- Gate: do not offer a dimensionally trusted Trace mode without repeatable physical measurement evidence.

### P1 — Tracked fingertip on calibrated plane

- Fixture: known 2D virtual square/pattern points with recorded table-space positions.
- Test: move one point with one finger, drag an entire panel, rotate around a pivot, abort low-confidence gestures, Undo, then project the saved result.
- Capture: selection error, point-target error in mm, false gesture rate, dropped frames, latency, applied EXO CAD revision and before/after geometry.
- Gate: no unauthorized edits, no actual unit changes from viewport zoom, no edited geometry when calibration is expired.

### P2 — Live physics gesture on static projected mannequin

- Fixture: rigid known physical mannequin, corresponding digital collider, a garment with known sewn topology/fabric properties.
- Test: calibrate projector, grab virtual surface through detected pinch, move target while held, release, then monitor real solver's cloth return.
- Capture: picked triangle and weights, grab lifecycle including dropouts, tracking/render latency, frame count, solver metrics, reprojection error and failed contact reports.
- Gate: no invisible permanent spring, no mutation of pattern source from temporary grab, and no claim of real garment physics on the mannequin surface.

### P3 — Three-studio garment library proof

- Fixture: **one legitimately sourced garment** with an editable source and a separate display mesh, one avatar, and three original Blender scenes.
- Test: switch white cyc → concrete editorial → black void, render same garment at same camera/pose in each, regenerate previews, and check old garment source hashes untouched.
- Capture: source reference/version, studio identifier, licenses, exported GLB material/geometry validation, Blender source render comparison and performance logs.
- Gate: correct asset provenance, explicit interchange-loss warnings and no hidden rewriting of the author's garment/CLO file.

### P4 — AR appearance versus fit validation

- Fixture: consenting adult test subject with calibrated pose tracking and a visually comparable real garment.
- Test: visual overlay only first; record occlusion/registration drift with subject turning; separately explore measured size/fabric checks if specifically approved.
- Capture: consent, image retention status, device limitations, segmentation errors and clear 'visual preview only' label.
- Gate: do not issue body size or production-fit recommendations from a synthetic appearance overlay.

## 13. Decisions and open questions to preserve for future planning

**Current architectural preference:** desktop EXO remains source of truth for patterns/solver; Blender .blend remains master for photography studios; calibrations are external profiles; one gesture protocol can feed desktop/table/mannequin experiences; TouchDesigner can provide experiments but is not required in the eventual core.

**Questions to resolve before any hardware purchase or implementation:**

1. Which physical projector models, resolutions and projection optics are available?
2. Which Mac will run EXO and projector output during demonstrations? Is the display extended or mirrored?
3. Is the tabletop fixed, its measured usable dimensions, and will it have paper or fabric on it?
4. Is there an overhead camera and/or depth sensor? Which camera angle is possible without hand occlusion?
5. Is the mannequin rigid and light-colored, or a person wearing actual garments? Is its matching 3D geometry already available?
6. Does the user's existing CLO catalog consist mainly of source projects, validated exports, or Blender render meshes?
7. Which source assets are private, original, or legally redistributable? Does a future public EXO library need replaceable generic avatars and HDRIs?
8. Should the first virtual studio viewer be real-time WebGL for navigation with final Blender Cycles still renders, or fully Blender-driven presentation?
9. Is the initial target a personal art installation, an apparel workshop tool, or a production/factory tracing system? Required precision and permissions differ.
10. For AR try-on, is the first goal a stylistic campaign visual, a configurable avatar, or an independently validated measurement/fit tool?

**No-build constraint remains in force:** these are research decisions and future test cards only. No projector interaction, new UI, import service, camera capture, repository fork, machine configuration or simulation work is authorized by this document.
