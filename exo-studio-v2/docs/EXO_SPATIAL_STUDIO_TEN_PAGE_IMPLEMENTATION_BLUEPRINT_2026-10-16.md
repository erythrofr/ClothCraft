<!-- PAGE 01 OF 10: 01 — Vision, release strategy, and success criteria -->
# EXO SPATIAL FASHION STUDIO
## Ten-page implementation blueprint — research and planning only
**October 16, 2026 · Companion to the master spatial concepts document · Version 1.0**
**Decision:** No implementation is authorized by this blueprint. The installed EXO ClothCraft V2 app, live garments, connected camera/projector, and source code must remain unchanged until a future build request.

**Planning companion:** [48-task execution register](EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md) maps work packages to dependencies and future quality gates; it contains no authorized builds or external issue creation.

**Subsequent research extension (not included in this fixed ten-page edition):** [PPF/material calibration and immersive studio architecture](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md), [fashion creator community and downloadable marketplace](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [living web Tech Packs](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md), and [new task dependencies](EXO_PLATFORM_EXPANSION_EXECUTION_BACKLOG_2026-10-16.md).

### Product ambition
Turn EXO from a dual-view garment design tool into a spatial environment with: (1) full-size tabletop pattern projection; (2) hand-controlled 2D editing; (3) a searchable catalog of real garments from EXO, CLO3D exports and Blender; (4) reusable 3D photography and runway studios; (5) projected virtual cloth on a physical mannequin; and eventually (6) camera-based AR appearance try-on and independently validated fit research.

**North-star experience:** Choose a hoodie from the garment catalog, display its true-size pattern on the worktable, pinch to adjust a panel, review the updated 3D drape on an avatar, then place that look into an architectural Blender studio and make a render. Later, place a real mannequin in front of a projector, see the digital garment conform to its visible surface, pinch the projected chest or sleeve and watch native EXO cloth physics react, then naturally relax on release.

### Release slices
**Release A: projection drafting workstation.** One calibrated, fixed tabletop with trustworthy visual scale and manual keyboard/mouse fallback. A 100 mm line must measure correctly at multiple spots. Read-only first: no hand tracking required to deliver value.

**Release B: interactive table.** Add MediaPipe or Vision, select/move/rotate, snapping, commit/cancel and undo. Gestures become real EXO CAD commands, never image-only movement. Projection calibration remains an explicit prerequisite.

**Release C: garment catalog and studios.** Index user-approved design folders, import compatible display assets, dress avatars and configure a set of original Blender stages. A gallery of looks is useful independently of owning a projector.

**Release D: mannequin projection and virtual Hand.** First calibrated static projection on a real mannequin, then tracked grabs routed into the existing native cloth solver; release must remove every transient force.

**Release E: AR exploration.** Compatible-device camera preview, body pose registration and occlusion. Accurate size prediction is a separate research effort, not a promised early feature.

### Definition of success versus an attractive demo
A visual demo is not a verified implementation. Each slice must supply a repeatable procedure, measured output, screenshots or recordings, saved reproducible configuration, automated tests where possible, and an explicit failure condition. All metric tolerances below are **proposed engineering targets**, not manufacturing certifications. Benchmarks must include source revisions, cloth fixture and runtime hardware.

### Recommended boundaries
**Implement first:** read-only metric tabletop and garment/studio catalog discovery. **Then:** calibrated gesture edit. **Only later:** curved-surface mapping, live solver grabs and AR. Do not couple shipping the garment library to sensor hardware. Preserve a local-first workflow and never silently ingest private design folders or body data.

**Planning assumption:** one strong full-stack graphics engineer assisted by a CV/vision specialist part-time and a Blender artist for asset/studio creation. Core tabletop + studio + mannequin demonstrations may require roughly 20–37 engineer-weeks sequentially, subject to hardware and current solver reliability; AR fit research has no credible fixed delivery date. Treat these as planning bands, not estimates or commitments.

**Primary user value:** easier pattern drafting, faster clothing presentation, creative live garment interaction and an owned visual archive of clothing collections.

---

<!-- PAGE 02 OF 10: 02 — Current EXO inventory and target architecture -->
## Existing systems: reuse rather than rebuild
Actual repository review found native cloth and 2D UI pathways in **src/components/ClothCraftWorkspace.jsx**, **ClothCraftBoardV2.jsx**, **ClothCraftSceneV2.jsx** and **integrations/clothcraft/workspace.mjs**. Native **integrations/clothcraft/exo-session.rs** uses ClothCraft's VBD Grab spring and material solver; its documented behavior includes barycentric three-vertex interaction and recovery after release. Three.js renders a real garment and avatar; the editor has panel selection and command edits. The project already has an early **integrations/clothcraft/agent-api.mjs** that exposes status/snapshot, pause and step behind a versioned loopback facade. Crucially, its capability manifest explicitly says fabric grab and authoring actions are unsupported; do **not** pretend it is already a gesture bridge.

Also relevant: **src/components/GarmentViewport.jsx** includes Three.js visualization, environment presets and a GLB export path. Original EXO authoring and ClothCraft V2 are related but not interchangeable. A future system must choose one canonical design state and a tested adapter for every other representation.

### Proposed service boundaries
**Design Store** owns authored pattern polygons, panel IDs, seam topology, measurements, fabrics, sizes, revisions and permissions. Nothing else may overwrite this truth. **Simulation Adapter** accepts an immutable garment revision and temporary Hand constraints, then returns drape snapshots. **Asset Registry** stores garment display derivatives, imported Blender/CLO meshes, avatar assets, studio scenes, material textures, thumbnails, source attribution and validation. **Tracking Adapter** emits timestamped, confidence-rated landmarks in camera coordinates. **Calibration Engine** transforms these points into table mm or 3D world meters. **Interaction Controller** turns reliable gestures into permitted commands with cancel/undo. **Renderer** displays the shared scene on desktop/projector/AR with appropriate masks.

### One-way and two-way flows
For a projector table: snapshot CAD polygons → transform layout from piece-local millimeters to real table coordinates → project linework; overhead camera → hand keypoints → undistort camera pixels → intersect table plane → hit-test editable panel → validated EXO command → new revision → redraw.

For a physical mannequin: EXO garment + digital collider → cloth solver → projection-camera render aligned to the known mannequin; camera → hand rays → triangle/barycentric hit → **temporary** solver GrabStart/Move/Release → native cloth frames → projector redraw. The real mannequin does not move with the virtual cloth.

For a photo studio: design snapshot/imported mesh → validated visual asset → avatar rig/drape cache → saved Look + original Studio scene → preview and batch render; authoring source stays intact.

### Suggested interface contracts (proposal, not current endpoints)
**DesignVersion:** garmentId, revision, pieceIds, sourceUnits, fabricRefs, meshSignature, consent/license refs.
**CalibrationProfile:** device IDs, frames, intrinsics, distortion, table-plane basis or mannequin-mesh reference, transform, fitResidualMm, verifiedAt, schemaVersion.
**GestureEvent:** source, timestamp, handId, confidence, calibrationVersion, mode, world/table position, targetId, stage (begin/update/end/cancel).
**DesignCommand:** expectedRevision, kind (MovePiece/MovePoint/RotatePiece), point delta in mm, transactionId, affected IDs, undoToken.
**TemporaryGrab:** cloth snapshot revision, triangle IDs, barycentric weights, 3D target in meters, owner ID, lease expiry and cancel state.
**Look/Studio:** immutable garment/version refs, avatar/pose, studio asset, camera, lights and render settings.

### Never allow
Uncalibrated camera landmark → CAD edit; stale snapshot → grab from wrong triangle; imported OBJ → magically editable CLO sewing; render mesh → replacement of native cloth rest geometry; projector display transform → garment dimension changes. Every conversion must have a typed unit/axis and logging for reprojection.

### Core acceptance
A recorded session may replay gestures against a disposable design copy. The original project hash remains unchanged except for deliberately committed edits. Renderer disconnect does not stop saving valid CAD changes. Simulation failure retains the last usable state, and a force release is observable after the camera vanishes.

---

<!-- PAGE 03 OF 10: 03 — Physical 2D pattern table: build specification -->
## Why the table goes first
A planar surface is simpler to calibrate than a curved moving body. A useful standalone demonstration requires only an EXO snapshot, projector, flat work surface and physical ruler; hand tracking and depth sensors can arrive later. Even if the final installation uses TouchDesigner for show visuals, the metric pattern projection engine should be independent of its proprietary runtime.

### Equipment and mounting
Use one rigid projector mount and a fixed table. Track native projector resolution, throw geometry, focus, keystone setting, expected lamp warm-up and blanking. Use a real ruler, a printed calibration grid/ChArUco board of checked dimensions, a contrasting neutral tabletop, and a camera only after the initial optical test. Measure actual usable table width/length; do not assume the manufacturer's advertised throw produces exact physical scale. Use dedicated calibration profiles for changes in lens zoom, mount or table height.

### Projection transformation
Keep authored geometry in **pattern-local millimeters** (or convert existing EXO meters once at the adapter boundary). Compute piece layout rotation/translation in table millimeters. Convert table-mm coordinates to projector pixels using measured correspondences and a homography; undistort lens data when appropriate. Four corners can seed a homography, but additional fiducials and a residual test are essential. A global homography models a plane, not folds, warps or thick fabric. A flattened SVG/PDF renderer is fine for outlines if its coordinates are a dimensionally verified derivative of the authoritative CAD source.

### User modes
**Setup:** project checkerboard/ruler and verify orientation, mirroring, center, edges, 50/100/500 mm dimensions and clipping.
**Trace:** show cutting and sewing lines, seam allowance, grainline, fold line, dart/notch marks, labels, scale reference and selected size; lock physical scale and hide editing handles.
**Layout:** drag pieces and optimize their visibility inside fabric width, obeying piece order and grain; not automatically certified marker nesting.
**Compare:** overprint revisions or graded sizes with clear dash styles and legend.
**Guide:** highlight one segment and dimension at a time for teaching, tracing, or manual cutting preparation.
**Safe blank:** one-click black screen or low-intensity guide when somebody moves the table or projector.

### Work packages
T01: choose coordinate axes and mm schema; prototype pattern-to-projector renderer on dummy reference geometry.
T02: design CalibrationProfile JSON, include checksum, transform residual, hardware mount/version ID and fail-closed validity gate.
T03: acquire measured image/projector pairs, estimate table homography, compensate distortion and map the pattern into the projector frame.
T04: create scale-check overlay and guided calibration UI, with undo of calibration and manual keyboard alternative.
T05: render faithful line types, metric dimensions, cut/fold/seam markings, notch visibility and width offsets.
T06: implement saved setup profiles and drift detection; no nominal 1:1 assertion until measurement passes.
T07: run physical verification at center and corners, both cold start and after projector warm-up; record deviations.

### Provisional acceptance gates
**Prototype target only:** 100 mm, 300 mm and 500 mm reference lines should be within a proposed ±2 mm at the sampled locations. Reject 'metric trace' if maximum physical error exceeds the threshold; the exact intended manufacturing tolerance must be established by a real patternmaker and may need to be much tighter. All tests must compare physical ruler measurements, not mouse coordinates. Verify consistent handedness and no scale change from zooming/panning the desktop view.

**Operational target:** recover a saved calibration with no user camera alignment steps under unchanged conditions; detect profile mismatch when hardware changes; provide an unambiguous indicator for 'Visual Reference' versus 'Scale Verified'. Testing must include uneven paper and dark cloth to expose optical limits.

### Key risk
Projection does not immobilize material. Fabric curl, stretch, shifting, shadows and human perspective can make traced lines inaccurate regardless of geometric calibration. Never market this as an automated cutter or production-approved method before external factory tests.

---

<!-- PAGE 04 OF 10: 04 — Gesture tracking and spatial 2D editing -->
## Sensor choice and software path
**MediaPipe Hand Landmarker** is the leading cross-platform prototype choice; **Apple Vision Hand Pose** is a credible Mac-native alternative. Implement a provider abstraction so CV models can be swapped without changing CAD behavior. The model outputs anatomical landmarks/normalized or model-world estimates, **not automatically table millimeters**. Apple Vision produces recognized image-space points with confidence; tabletop coordinates still require calibration and ray/plane intersection. A depth camera can add fingertip height but should not be mandatory for V1.

### Gesture-to-command algorithm
Step 1: capture frames with monotonic timestamps, model confidence and the active camera calibration ID.
Step 2: select the tracked dominant hand, maintain continuity of hand ID and spatial position, smooth jitter without adding uncontrolled lag.
Step 3: transform index-tip/thumb points into calibrated table coordinates; estimate pinch from a normalized ratio against palm width or tracked 3D distance, not one global pixel threshold.
Step 4: classify hover → pinch candidate → held → moving → release or cancel, using separate thresholds for pinching and releasing to prevent rapid flicker.
Step 5: hit-test against visible pattern geometry within a measured mm tolerance and return a particular piece/point/edge, not whichever SVG element happened to be drawn last.
Step 6: create a **preview transaction** (source garment revision, target ID, start position, transform version); show a ghost, dimension delta, and live snap guides.
Step 7: on confident release validate against self-intersections, impossible seam metadata and expected revision, then commit exactly one undoable CAD command. On low-confidence dropout or camera disconnect, cancel rather than persisting a partial edit.
Step 8: tell projector to redraw from the authoritative accepted document revision.

### Proposed gestures and controls
Single-hand pinch on a point → Move Point; pinch inside panel → Move Piece; pinch on rotation control → Rotate; two-finger gesture could pan viewport but should not rotate production geometry accidentally. Physical-space select range should scale in **millimeters**, not change with projector resolution. Hover cursor and active gesture should show a confidence indicator. Users must retain mouse/keyboard undo and a large deliberate STOP/Cancel control.

**Interaction conflict:** once Trace mode is active, no editing gesture should be accepted. A separate Mode control is safer than inferring intent from any arbitrary hand wave. Avoid adding multi-hand transforms before robust one-hand manipulation.

### Work packages
G01: implement TrackingProvider interface for MediaPipe with camera permission and frame rate diagnostics.
G02: implement alternate Apple Vision provider behind same normalized input schema; benchmark rather than assert superiority.
G03: compute camera/table transforms, ray-plane projection, confidence and timestamp drift; disable edit if calibration expired.
G04: finite-state gesture recognizer and low-confidence hysteresis.
G05: hit-test native 2D geometry (bounding boxes for pieces, precise point/edge distance) with stable object IDs.
G06: bridge validated edits to current EXO authoring operations, initially Move Piece, then Rotate, then Move Point; commit through expectedRevision.
G07: build projected highlights and companion monitor debug overlay.
G08: add failure tests: lighting glare, hand shadows, multiple hands, occlusion, no hand, blocked camera, unexpected rotation, mode transition and rapid undo.
G09: privacy toggle for local-only landmark processing; no raw camera retention by default.

### Engineering targets for prototype
Pick center/corner reference locations, run repeated trials at different hand heights, measure absolute hand-to-CAD error in mm. Propose a **median error below 5 mm for selection**, plus a stricter confirmed-point editing goal chosen after physical tests. Do not promise pen-grade precision from consumer RGB landmark data without depth sensing and camera calibration. A provisional gesture-to-projection p95 target below 150 ms is a test goal, not a hardware guarantee. Instrument capture, inference, gesture classification, command acceptance, physics and display separately.

### Exit demonstration
Start from a duplicate pattern, pinch a sleeve corner, move it exactly a deliberate 10 mm according to displayed CAD measurement, commit, undo, redo and show same revision on desktop/projector. Remove the hand mid-drag and verify no unintended saved edit. Turn on Trace and verify gestures cannot mutate the document.

---

<!-- PAGE 05 OF 10: 05 — Garment library: importing CLO3D and Blender work -->
## What the library must represent
The user's garments made in EXO and CLO3D should become discoverable entries with visual thumbnails, size/material variants, provenance, source format and a mannequin preview. Different imported files offer different editable capabilities. **Editable CAD pattern**, **drape simulation cache**, **mesh for rendering**, and **finished studio image** are separate types, even if they all represent the same hoodie.

### Safe ingest process
Create a user-approved list of watched folders. First **index read-only**: path, extension, modified time, stable file hash and inferred type. Never silently search the whole disk or rename CLO projects. Mark anything not viewable as Indexed Only. Add a verification preview stage for scale, axis orientation, mesh topology, UVs, normals, skinning, texture filenames, alpha modes and external dependencies. Extract/import into a dedicated derivatives area; retain the original source unmodified. User explicitly assigns collection, garment type, license and ownership before publication.

**CLO3D approach:** use officially supported exports such as OBJ, FBX, glTF/GLB or other listed supported interchange formats when the installed version offers them. Official CLO docs describe export presets for supported 3D formats. Test exact unit scale, axis conversion, welded/unwelded mesh behavior, texture packing, skinning and animation. CLO native .zprj/.zpac are source references unless a supported authorized converter exists; do not pretend imported render meshes recreate editable patterns and seams.

**Blender approach:** keep .blend as scene/authoring master. Use Blender Asset Browser catalogs for clothing props, environments, material swatches, avatars and poses, and export optimized GLB/FBX for EXO's real-time viewer when necessary. Preserve rig/pose compatibility via a manifest. Some Blender features such as procedural nodes, modifiers and special shader nodes do not survive glTF; build the derivative scene explicitly and preview for loss.

**EXO approach:** retain native garment fitting project, compiled cloth topology, DXF/SVG outputs as separate traceable representations, and tag exported visual meshes with source revision and cloth material. A snapshot alone cannot stand in for editable pattern history.

### Data model proposal
Asset: assetId, displayName, owner, collection, category, sourceUri, immutable hash, sourceKind (exo/clo/blender), rights/status and import history.
GarmentVariant: garmentId, version, size, colorway, fabric IDs, patternDocumentRef, simulationSnapshotRef, textureSetRef, displayMeshRef, structural validation flags.
Avatar: avatarId, license, rig family/skeleton, neutral collider, dimensions, compatible poses and display GLB.
Studio: .blend master, derived scene package, cameras, lights, HDRIs, floor, props and original rights.
Look: wardrobe item variant versions, avatar/pose, studio and saved render configuration.
RenderJob: immutable Look revision, camera preset, engine, render preset, output paths, progress/error, reproducibility hash.

### Work packages
L01: create strict asset schema and local catalog index; plan migrations and atomic writes.
L02: user-approved folder import + read-only deduplication; hash asset files.
L03: import GLB/OBJ/FBX under a sandboxed validation pipeline; quarantine unsupported/huge/missing-texture files.
L04: EXO-owned asset preview and metadata editor; make a garment variant without changing original project.
L05: CLO3D manual export checklist and regression fixture; test real garment front/back mesh scale against known measurements.
L06: Blender Asset Browser linking and portable export recipes; license and source provenance checks.
L07: avatar dressing, saved Look relationships and compatibility statuses, without falsely claiming automatic physical refitting.
L08: screenshots/thumbnail/turntable queue with cancel/retry and incremental caching; no background upload.
L09: searchable collection view with category, season, colorway, size, license and visibility filters.

### Acceptance demonstration
Index three authorized garment sources (one EXO-native pattern, one CLO visual export, one Blender garment mesh), display verified thumbnails and source rights, dress at least one compatible avatar, show which assets are editable versus render-only, and round-trip a saved catalog manifest. Confirm every original input file hash is unchanged after import and generating renders. Missing texture or unsupported rig must produce an explicit warning instead of silent visual corruption.

---

<!-- PAGE 06 OF 10: 06 — Blender-powered fashion photo studios -->
## Target photography workflow
Users enter a **Studio Library** and choose a saved environment as easily as switching a background. They can place dressed mannequins, choose camera angle, lighting, pose, material variant and output format, then produce consistent lookbook images or turntables. This is not merely adding HDRIs to a canvas: credible garment imagery requires actual stage geometry, contact shadows, lighting, reflections, scale and versioned output settings.

### Source versus runtime
Blender .blend remains the editable master for staged scenes. EXO's web/Three.js viewport uses runtime-compatible geometry, material textures and an independent lighting configuration. Blender's glTF exporter supports punctual light types but does **not** carry Blender Area lights and World lighting through as equivalent glTF lights. Therefore exporting an entire .blend to GLB without additional scene recipes will change the shot. Keep two representations: **StudioMaster** (Blender file with Cycles/Eevee settings) and **StudioRuntime** (GLB geometry + EXO light/HDRI/camera preset), with a comparison thumbnail for accepted fidelity.

### Proposed starter environments
**White Product Cyc:** seamless floor, three large softboxes, neutral skin/cloth, front/back/profile and detail cameras; repeatability matters more than dramatic mood.
**Neutral Gray Material Lab:** color-controlled middle gray, grazing key/rim and calibrated camera so seam shapes and fabric roughness can be compared.
**Concrete Editorial:** original concrete walls/floor, long shadows, natural neutral palette and editorial pose/camera presets.
**Original Architectural Gallery:** vaulted elements, columns, statues or custom relief motifs built from owned geometry; dramatic directional lighting consistent with an architecture-inspired fashion line.
**Archive Muslin:** draped neutral studio backdrop, soft warm side light and macro shots.
**Black Stage:** edge/rim light for padded garment silhouettes and hardware; avoid crushing dark fabric textures.
**Runway Stage:** a path, rigged avatar poses, synchronized camera, look changes and simulation cache.
**Outdoor Daylight:** legitimately licensed HDRI, ground shadows and several standardized daylight orientations.

### Workflow and responsibility split
Art/design lead authors source scenes and camera rigs in Blender; EXO graphics developer authors a stable runtime lighting/camera schema; cloth/asset engineer validates outfit and avatar compatibility. Build all stages from original/licensed geometry rather than copying proprietary CLO sample scenes. Save camera focal length, position/target, crop, render engine and color management together with each shot. Save material and environment versions so a subsequent library update does not unpredictably change previously approved catalog images.

### Work packages
S01: reusable StudioAsset manifest and Blender export naming conventions.
S02: build **three** original stages first (White Product, Concrete, Black), with associated thumbnails and at least two cameras each.
S03: runtime loader; expose cameras, floor, shadow visibility, environment and editable exposure in EXO presentation panel.
S04: implement non-destructive pose and look selection, scene layering and comparison gallery.
S05: reproduce source lighting in runtime as closely as supported, with documented intentional differences.
S06: high-quality still render path (optionally via headless Blender batch/Cycles) separate from real-time preview; make it cancellable and local-first.
S07: turntable and front/back/detail batch output with render receipts (garment hash, studio, camera, material, resolution).
S08: texture/HDRI/license packaging and missing-dependency validation.

### Acceptance
Three original studio presets must load with the same garment and avatar without changing source patterns or cloth state. Create front, back and detail images using versioned cameras; compare consistency when reopened. A neutral fabric inspection scene should preserve enough shadow detail to review black/white fabrics, whereas editorial scenes may intentionally prioritize mood. No scene should contain external textures that disappear on another machine without a warning. Published renders must record rights for avatars, props and backgrounds.

### Competitive research
CLO documents V-Ray Interactive Render, environment-map choices, rectangular lighting controls, saved lighting configurations, and export paths. That validates **desired feature categories**, not an entitlement to distribute CLO proprietary stages or renderer code. Implement an original artistic and technical scene library.

---

<!-- PAGE 07 OF 10: 07 — Mannequin projection and live Hand physics -->
## Feasibility order
The most reliable sequence is: visualize cloth on EXO's existing digital avatar → obtain a matching rigid mannequin → register projector to that body → project static aligned garment patterns/appearance → add RGB hand rays → run actual temporary cloth constraints → test recovery and safety. Moving-person physical projection should wait until this static rig is stable.

### Fixed mannequin rig
Measure/scan a light matte mannequin; produce a mesh suitable for projection registration and a separately validated native physics collider. Place real reference markers visible to an RGB/depth camera. Calibrate intrinsic and extrinsic projector/camera parameters and solve the mannequin's world pose. In rendering, treat projector as an inverse camera: cast an image only onto projector-visible body surfaces. A single projector cannot illuminate back-facing surfaces; avoid textures stretching across hidden geometry. The virtual garment may extend from the mannequin; this light projection cannot produce a physical floating sleeve in space.

### Interaction chain
Camera captures hands with known timestamps; tracking provider estimates index/thumb landmarks and confidence; camera-to-world transform maps a fingertip ray; ray intersection chooses closest visible garment triangle not occluded by the body; gesture state accepts a pinch with target IDs and barycentric weights. Send current target positions to native ClothCraft's existing temporary VBD Grab interface while physics is running; the projector displays the latest accepted cloth state each draw. Upon pinch release, tracking loss, mode exit or solver crash, release the native grab **with the correct garment revision** and no leftover constraint.

**Important engineering integration:** V2's current agent facade does not expose an external grab API. A future dedicated local-only interaction controller must be reviewed, added and tested, or an appropriately narrow internal message channel exposed. Never simply bind the raw Rust command socket to LAN. Document schema, capability permission, lease/timeout, owner ID and revision conflict behavior before touching solver code.

### Render/simulation separation
The native solver can run at its chosen timestep, while projector rendering interpolates between valid snapshots. No frame should display an unacknowledged cloth edit as final state. If a solver frame is late, hold previous valid geometry or interpolate within bounds rather than extrapolating through collisions. Track total input-to-visible-latest-state latency. Render a prominent 'Hand active' indicator only when a real native constraint has been accepted. Live projector warp must reflect calibrated camera pose and mask occluded areas.

### Work packages
M01: mannequin scan/dimensioned model + approved texture/material surface, collision model and asset rights.
M02: joint camera-projector-mannequin calibration, pose solver, mask/occlusion handling and reprojection test.
M03: static garment/texture mapping with adjustable camera/projector placement; compare measured landmarks.
M04: hand world-ray reconstruction, closest visible garment triangle hit and pinch confidence gate.
M05: design safe native local GrabStart/Update/Release bridge with revision/owner lease; never permit arbitrary code execution.
M06: connect actual three-vertex constraint, time-stamped target mailbox and render response.
M07: require release on losthand, focus loss, app stop, projector disconnect and reset.
M08: test varied material stiffness, deep-black fabric render, false picks, overlapping panels, solver intersections and return-to-equilibrium.
M09: compare real-time latency with 1/2/3 active garments, report max sustainable scene complexity on actual Mac.

### Proposed gates
Static stage: marker reprojection error within a provisional 5 mm on visible mannequin locations after warm-up; report error by depth and surface. Interactive stage: median gesture-to-visible change under a proposed 150 ms in the selected setup, error logs recorded and no unreleased Grab after 100 repeated cancellations. Real cloth deformation must be in solver positions with fabric-dependent relaxation; merely deforming a Three.js mesh is insufficient. Report residual position over simulated time and never claim perfect return when collision, friction or seams imply another equilibrium.

### Safety
Use projector-safe aiming, diffusion/brightness appropriate for the audience and a physically controlled public area. Camera recording of people requires consent and strict retention. Screen-only preview remains fallback when calibration or tracking fails.

---

<!-- PAGE 08 OF 10: 08 — AR try-on: product research and rollout boundaries -->
## Three increasingly ambitious levels
**A. Avatar showroom:** choose a prebuilt fitted avatar, dress it with a garment display mesh or a valid garment simulation, and view front/side/back and poses. This is the fastest useful try-on-like experience for fashion presentation. It does not measure a person automatically.

**B. Camera visual try-on:** supported phone/tablet camera estimates body pose and segmentation; a garment visual layer follows a rig or correspondence model and applies occlusion. Expect tracking drift, pose errors, hair and arm occlusions, cloth-vs-skin mismatches, and differences between cinematic compositing and a 3D garment. Treat it as an appearance preview only.

**C. Body-specific fit research:** a trustworthy physical try-on uses measured body shape (not generic landmarks), matched avatar rig and collision volume, garment sewing and grading, calibrated fabric stretch/bend/shear/friction, and repeated on-body fit comparisons. Even a compelling rendering does not establish correct size recommendation or comfort. This level needs external apparel validation and human-consent procedures.

### Native and cross-platform building blocks
Apple ARKit has tracking and world understanding primitives, and Apple's official body-motion sample visualizes a tracked person via a virtual character; the sample requires an appropriate recent chip. Apple Vision hand pose provides image landmarks for Mac; ARKit iOS body tracking is a distinct device feature. MediaPipe Pose/Holistic can act as research input on more platforms. ARCore Depth on compatible Android devices can support geometry-aware occlusion. These components do not provide a complete, physics-accurate virtual apparel product.

Image diffusion virtual try-on projects can be useful creative references, but some well-known research implementations have **noncommercial** weights or code licenses. Their outputs can hallucinate garment details and are not certified pattern, drape or fit measurements. A future commercially distributed EXO feature must undergo a per-model dependency and data-rights review.

### Privacy and user trust design
Request camera permission only when user enters AR, allow an immediate stop/clear, avoid uploading body/video by default and be explicit when a frame is stored. Body silhouettes, size measurements and scans are sensitive personal information. Record purpose, retention, access and deletion ability. Bystander faces in showroom/installation views should not be incidentally collected.

**Preview labeling:** any AR appearance or size suggestions need clear labels such as 'Visual styling preview; not an accurate garment fit or size recommendation' until validated. Do not silently infer medical, demographic or personal attributes from body cameras.

### Work packages
A01: build rigged avatar showroom using existing garment catalog and safe neutral poses.
A02: evaluate ARKit compatibility for target devices; use explicit feature detection and permission gates.
A03: prototype single-person pose and segmentation with synthetic/local-consent footage.
A04: align a garment visual layer, enforce depth/occlusion order and maintain stable scaling through body motion.
A05: add render-only size/colorway switching and comparison, keeping clothing source files immutable.
A06: quantify visual failures, latency and supported pose range in controlled subject sessions.
A07: run controlled real garment comparisons only if an independent body/garment measurement research track is funded.
A08: release privacy/consent, export, storage and deletion tests before any externally accessible AR mode.

### Acceptance hierarchy
A digital-avatar showroom passes only when garment variants remain stable across multiple original studios and poses. Camera visual try-on passes only after specified motion/occlusion trials; it makes no body-specific fit claim. Physical-fit research progresses only if measured pattern, body and textile parameters predict real test garments within criteria set by an apparel specialist. The AR development track is explicitly not a dependency for shipping table projection, studio library or mannequin installation.

---

<!-- PAGE 09 OF 10: 09 — Execution roadmap, owners and dependency gates -->
## Illustrative planning, not a work authorization
Divide work into independent vertical slices with a responsible technical owner, test fixture, source hash, demonstration and rollback plan. The calendar below assumes one primary engineer with occasional CV/graphics/art support and on-site access to fixed projection hardware. Durations are **rough single-engineer effort bands** for exploration; they exclude significant user research, procurement, production fit certification and delays in undocumented source imports.

### Phase 0: product and lab specification (1–2 weeks)
Owner: engineering/product lead with patternmaker consultation. Gather list of owned Mac/projector/camera/table/mannequin assets; measure tabletop dimensions; choose exact EXO source of truth; inventory sample garments/licenses; define privacy policy. Deliver: data dictionary, fixed coordinate axes, hardware topology drawing, set of reference garments, tolerance proposal and decision log. **Gate G0:** user approves equipment/requirements and prototype scope.

### Phase 1: projection kernel + metric 2D (2–4 weeks)
Owner: graphics/calibration engineer. Build a screen-only projector-output simulator first; calibrate table, save/load a profile, project read-only piece outlines, test 100/300/500 mm lines. Log physical residuals and reject missing calibration. **G1:** measured scale checks at predefined locations, repeatable cold/warm output, projector disconnect recovery.

### Phase 2: tracked table editing (3–6 weeks)
Owner: CV engineer + EXO authoring engineer. MediaPipe provider, optional native Vision adapter, calibrated hand-plane hit test, gesture FSM, piece translation, rotation and point move, validated CAD transactions, undo, Trace lock. **G2:** repeated controlled gesture/undo suite, no stale document edit and no unintended command on lost hand.

### Phase 3: garment library (3–5 weeks; can overlap Phase 1)
Owner: application/data engineer. Approved folders, immutable source hashes, EXO/CLO/Blender visual-import adapters, variants, asset IDs, thumbnails and authorizations. **G3:** several real garments display with source/provenance and unchanged original files.

### Phase 4: Blender studio library (3–5 weeks; overlap library after schema stable)
Owner: Blender artist + graphics engineer. Three original studios with source .blend, runtime scenes, camera/light presets, Look builder, local render queue, reproducible e-commerce shots. **G4:** deterministic render outputs, consistent scale, license and missing-dependency reports.

### Phase 5: stationary mannequin projected garment (4–7 weeks)
Owner: graphics/CV engineer with physical setup help. Calibrate 3D projector/camera/mannequin, visibility masks and static display mesh, then revisit scene alignment from multiple viewpoints. **G5:** recorded reprojection error and stable projected image after restart; this does NOT yet demonstrate live hand physics.

### Phase 6: live projected cloth Hand (4–8 weeks)
Owner: cloth solver engineer + CV engineer. Safely expose versioned native Grab event channel, owned constraint lifecycle, hand raycast, simulation/render synchronization, physical material tests, error/dropout recovery. **G6:** repeated pinch/move/release cycles, native cloth moves during held gesture, complete force release and no corrupted saved drape.

### Phase 7: optional AR visual lookbook (6–12+ weeks separately)
Owner: AR/mobile engineer + apparel/graphics research. Avatar showroom first, then camera overlay and occlusion; separate physical-fit R&D indefinitely until benchmarks justify it. **G7:** explicit supported devices, visual drift/occlusion metrics, consent/privacy verification and 'visual preview' labeling.

### Dependency critical path
P0 → P1 → P2 for editing, while P0 → P3 → P4 for catalog/studios in parallel. P0 + stable physics + rig/calibration → P5 → P6. AR can research independently after P3 avatar assets exist. Hardware procurement is not a reason to delay authoring the library schema or Blender studios, but **no paid hardware purchase** is assumed or authorized.

### Governance and delivery rhythm
Every 1–2 weeks, produce a short evidence note: what changed, selected fixture, measured numbers, failures, next dependency and exact code/data rights. Keep feature flags off in production EXO until the corresponding gate. Do not make an aggregate 'percentage of CLO3D parity' claim; track real tested workflows. Use separate working branches or isolated sandboxes for CV and visual experiments so the user's live saved garments are untouched.

### Stop/reconsider triggers
If table accuracy cannot be repeated after recalibration, stop before Gesture Edit. If asset import loses scale/rights, do not publish. If native solver cannot release constraints under dropouts, do not exhibit interactive mannequin demo. If projection onto a moving body has unacceptable drift or brightness, revert to phone AR as an appearance experiment rather than forcing a false promise.

---

<!-- PAGE 10 OF 10: 10 — QA, resources, decisions and cited research -->
## Evidence, safety and test fixture matrix
**Metric projection:** measure physical lines at center/edges/corners and log actual ruler deviation at several projector warm-up states. Store profile JSON plus source image of calibration grid; test screen pan/zoom cannot change actual metric scale. Proposed prototype target ±2 mm for selected test lengths; manufacturing requirements must be established separately by a qualified patternmaker.

**Gesture CAD:** record human-intended 10 mm Move Point/Move Piece commands, recognized landmark trace, committed CAD delta, pointer/hand loss events, undo/redo result and rejection of stale revision. Keep camera recordings opt-in. Compare manual desktop result against physical gesture result on the same fixture.

**Studio library:** verify CLO-compatible export metadata, known reference dimension, Blender .blend source rights, GLB color/material and missing textures, immutable source hashes, import/export logs, preview reproducibility and allowed publication. A presentation OBJ alone does not indicate that a production pattern is editable.

**Mannequin projection:** verify camera-to-projector/body registration error, calibration validity, front/side occlusion, safety/bystander capture handling, repeated Hand release and solver metric history. Measure latency separately for inference, raycast, solver, projector render and display; a successful single pull does not mean production readiness.

**AR preview:** device-compatibility checks, permission denial, no-storage mode, tracked-body occlusion across motions, fail-safe disappearance and privacy labels. Physical fit calibration is a separate externally reviewed experiment.

### Risk register and mitigation
**R1 — wrong units/axes:** silent 1000× conversion errors. Mitigate typed mm/m transforms, calibrated fixtures and automatic scale checks.
**R2 — stale CAD/mesh revision:** gesture edits wrong vertices. Mitigate stable IDs, expected revisions, request rejection and an auditable transaction log.
**R3 — calibration drift:** displaced projector or variable table plane. Mitigate mount registry, recheck overlay, timestamped profiles, fail-closed Trace.
**R4 — CV false pinch:** unintended design edits. Mitigate dwell, hysteresis, visible hover, preview transaction and cancel.
**R5 — solver instability:** self-intersections, invisible spring, diverged geometry. Mitigate timeouts, last-valid snapshots, full release, isolated test garments.
**R6 — broken source assets:** invalid mesh import, missing texture, CLO export variant. Mitigate read-only ingest, version hashes, quarantined previews and explicit warnings.
**R7 — proprietary/licensing:** CLO asset restrictions, TouchDesigner license, Apple SDK, model weights or downloaded HDRIs. Mitigate rights metadata, reviewed dependency manifest and original scene assets.
**R8 — privacy/security:** exposed scripting endpoints, stored images/body scans. Mitigate loopback-only command bridge, authentication for any external UI, no arbitrary Python execution, local processing, consent and retention controls.
**R9 — misleading fit/accuracy:** image appears realistic but geometry isn't certified. Mitigate labeling, independent physical checks and separation of appearance from fit claims.

### Resourcing and budget worksheet (fill before procurement)
**Already owned/available:** EXO/ClothCraft codebase, Blender authoring access and existing computer/display equipment where verified on site. Do not assume a depth camera or reliable mount exists. **Possible costs to quote:** projector with suitable throw/focus/resolution, stable mount, overhead RGB/depth camera, printed calibration plates and precision ruler, mannequin or scan service, lighting control, Blender studio art time and external apparel testing. Obtain actual vendor quotes after G0; this report deliberately gives no speculative product prices or asserts current inventory.

**Role coverage:** graphics and projection calibration, EXO native cloth/CAD specialist, CV/hand tracking specialist, Blender lookdev artist, QA/test operator with ruler/camera, product/accessibility reviewer and a garment technologist for claims about manufacture or fit.

### First ten actionable tasks when implementation is authorized
1. Freeze two source garments and a reference tabletop dimension set; hash original files.
2. Photograph/measure the existing projector, mount and table; create a hardware inventory.
3. Specify design/unit/asset/gesture/calibration schemas with test fixtures.
4. Implement read-only table-projection simulator on a separate branch.
5. Acquire calibration markers and prove a 100 mm physical line in five locations.
6. Add revalidation and fail-closed Trace mode before adding gesture input.
7. Record a MediaPipe or Vision hand moving only a ghost cursor in table millimeters.
8. Commit a single EXO Move Piece action, then exercise Undo and disconnect cancellation.
9. Index three approved garment assets and make source-preserving catalog previews.
10. Build one original Blender White Product stage, attach a Look and render an immutable front/back pair.

### Source anchors (official/public)
OpenCV camera calibration/ChArUco: https://docs.opencv.org/4.x/da/d13/tutorial_aruco_calibration.html
MediaPipe Hand Landmarker: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
Apple Vision Hand Pose: https://developer.apple.com/documentation/vision/vndetecthumanhandposerequest
CLO format and preset documentation: https://support.clo3d.com/hc/en-us/articles/48665693640985-Import-Export-Option-Preset
CLO lighting settings: https://support.clo3d.com/hc/en-us/articles/115015558727-V-Ray-Render-Light-Properties
Blender Asset Browser: https://docs.blender.org/manual/en/4.4/editors/asset_browser.html
Blender glTF lights warning: https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html
ARKit body-motion sample: https://developer.apple.com/documentation/arkit/capturing-body-motion-in-3d
Apple native TouchDesigner plugin (MIT source, proprietary dependencies): https://github.com/sygnalinc/Apple-Frameworks-for-TouchDesigner

**Final decision:** The project's ten-page execution blueprint and long-form spatial concepts research are ready to evaluate. No implementation, license acceptance, asset redistribution, projector setup, paid purchase, user-body capture, CLO conversion, or EXO build is authorized by these planning documents.
