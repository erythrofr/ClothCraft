# EXO Spatial Studio — Implementation-Ready Task Register
**Planning annex to the 10-page blueprint · 16 October 2026 · Future work only**

**No-build instruction:** This is an issue-writing and milestone-planning aid. Do not create tickets on remote issue trackers, install packages, alter V2 production code, operate cameras/projectors, or spend money from this annex. No dates or durations are commitments.

**Read first:** [Ten-page implementation blueprint](EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md) and [long-form concept and source research](EXO_SPATIAL_PROJECTION_GARMENT_STUDIO_AND_AR_CONCEPTS_2026-10-16.md).

**Later platform expansion:** [PPF, textiles, studios, community, marketplace and web tech-pack backlog](EXO_PLATFORM_EXPANSION_EXECUTION_BACKLOG_2026-10-16.md). Its PX/RX/CX/TX planning IDs extend but do not replace the original SP tasks.

## 1. Current source integration map — factual versus proposed

| Domain | Existing source inspected | Observed capability | Future work required |
| --- | --- | --- | --- |
| Authoring workspace | `src/components/ClothCraftWorkspace.jsx` | Local project state, edit commands, selection, simulator control | External trusted gesture controller and transaction acceptance |
| 2D patterns | `src/components/ClothCraftBoardV2.jsx` | SVG metric-style panel geometry, guides and selection | Export display-space independent mm outlines; hit-test/edit projection adapter |
| 3D garment scene | `src/components/ClothCraftSceneV2.jsx` | Three.js render mesh and native Hand pointer pick | Calibrated projector camera and external camera-to-mesh hit testing |
| Cloth control | `integrations/clothcraft/workspace.mjs` | Native worker, continuous steps, grab mailbox, error/recovery | Owned temporary grab leases, external input gateway and policy |
| Native simulation | `integrations/clothcraft/exo-session.rs` | ClothCraft VBD grab and native solver | No engine rewrite required to prototype one virtual Hand; robust multi-sensor interop remains unbuilt |
| Agent API | `integrations/clothcraft/agent-api.mjs` | Loopback workspace status/snapshot/pause/step | Fabric grab and CAD edit are **explicitly unsupported** by current capability manifest |
| Render/GLB | `src/components/GarmentViewport.jsx` | Three.js garment visualization, lighting and an export path | Look/studio manifest, source-safe asset catalog and verified Blender scene conversion |

This map does **not** mean those existing components form an integrated projectable product today. Any future code should be built on separate branches/test fixtures with explicit user authorization, and should distinguish native ClothCraft V2 from the original Garment Studio data model.

## 2. Recommended order and dependencies

| Milestone | Must precede | Observable deliverable |
| --- | --- | --- |
| G0: Approve plan, sample garments and physical equipment | All other gates | Hardware inventory, data rights, units, requirements and risk decisions |
| G1: Read-only metric table | G0 | Saved projector calibration, reference-ruler QA and locked Trace mode |
| G2: Gesture table editor | G1 | One Move Point/Move Piece/Rotate with undo and loss-of-tracking cancel |
| G3: Garment asset library | G0 | Read-only indexed EXO/CLO/Blender provenance and thumbnails |
| G4: Blender studio looks | G3 | Three original studio assets and reproducible renders |
| G5: Static mannequin projector | G0 + body model | Physically verified projector registration and visible surface masks |
| G6: Live cloth on mannequin | G5 + tested native grab | Real solver-held deformation and guaranteed release on failure |
| G7: Optional AR appearance preview | G3 | Compatible-device, consent-aware, visually tracked try-on; no fit claim |

The **critical physical-calibration path** is G0 → G1 → G2. The **asset/presentation path** is G0 → G3 → G4 and can proceed independently. The **advanced interaction path** is G0 → G5 → G6 and should not block initial product usefulness. G7 is exploratory and not a deadline dependency.

## 3. Proposed task cards

These IDs are stable *planning IDs*, not GitHub issue numbers. Each **Done** statement describes a future acceptance test that must be supported by actual evidence when implemented.

### Phase 0 — project/hardware definition

**SP-001 — Lock canonical design and measurement units.** Depends: none. Owner: EXO architecture. Scope: decide which data model owns panels, seam topology, fabric IDs, grading, geometry revisions and meters/mm conversion; document adapter boundaries between original EXO and ClothCraft. **Done:** representative T-shirt/Hoodie fixture maps into the chosen model with source measurements preserved; no silent factor-of-1000 conversions.

**SP-002 — Baseline legal/consent asset inventory.** Depends: none. Owner: asset/product research. Scope: choose user-authorized source folders and example garments; record origin and third-party avatar/HDRI rights. **Done:** list of permitted sample files with immutable hashes; no personal camera/body data copied.

**SP-003 — Inspect the physical projection rig.** Depends: none. Owner: calibration engineer. Scope: identify actual projector, cable outputs, mounting stability, measured tabletop size, surface, room lighting, existing cameras, throw and keystone setting. **Done:** photographed dimensioned equipment sheet with known unknowns and a zero-cost pilot configuration.

**SP-004 — Define privacy and threat model.** Depends: SP-002. Owner: app/security. Scope: decide local-only processing, camera controls, recording defaults, future authenticated message transport, arbitrary-script prohibitions, consent. **Done:** documented permission table and test plan; no future unscoped network endpoint.

**SP-005 — Freeze benchmark fixtures.** Depends: SP-001, SP-002. Owner: QA. Scope: store design references for flat tee panel, curved sleeve, 100/300/500 mm physical ruler targets, simple mannequin mesh and material variants. **Done:** test fixture list with measured values and source hashes; no modification of user's live saves.

**SP-006 — Confirm release acceptance gates.** Depends: SP-003, SP-005. Owner: product/apparel engineer. Scope: distinguish artistic projection, physically traced pattern, garment fit, digital showroom and AR appearance. **Done:** agreed thresholds and limitations signed off before a prototype can advertise metric accuracy or fit.

### Phase 1 — calibrated tabletop projection (G1)

**SP-101 — Typed coordinate-transform library.** Depends: SP-001. Owner: graphics. Scope: explicit pattern-mm, table-mm, camera-pixel, projector-pixel and world-meter representations. **Done:** transform unit tests preserve distances and axis orientation under round-trip conversion; no untyped pixel position reaches CAD state.

**SP-102 — Read-only pattern-outline adapter.** Depends: SP-101, SP-005. Owner: authoring/graphics. Scope: extract authored contours, seam allowances, grainline, notches and measurements as read-only display commands. **Done:** same native dimension appears on desktop and the simulator; no design revision changes when projecting or zooming.

**SP-103 — Table calibration sampler and solver.** Depends: SP-003, SP-101. Owner: CV/calibration. Scope: undistort camera image where used, gather physical correspondences, compute table-to-projector homography, reject high residuals. **Done:** calibrated grid matches measured table at center/edges; transform has stored error statistics and sample count.

**SP-104 — Save/load and validity of projection profiles.** Depends: SP-103. Owner: app. Scope: versioned projector/table mount ID, optical settings, transform, verification time and checksum. **Done:** same fixed rig restores geometry; changed resolution or hardware configuration requires recalibration.

**SP-105 — Trace and safety controls.** Depends: SP-102, SP-104. Owner: UI. Scope: visual-only versus Scale Verified status, cutoff/blank, lock physical scale, high-contrast outlines and accessible manual controls. **Done:** Trace cannot activate with expired/mismatched profile and gesture edits remain disabled in Trace.

**SP-106 — Physical metric regression fixture.** Depends: SP-105. Owner: QA/patternmaker. Scope: measure 100/300/500 mm projected lines at sampled table positions both cold and warm. **Done:** documented error distribution versus explicitly agreed pilot tolerance; sample physical ruler photographs and repeatable calibration.

**SP-107 — Pattern labels, compare and layout.** Depends: SP-105. Owner: UI/apparel. Scope: seam/cut lines, notches, size overlays, fabric width, grain, safe projection bounds, mirrored/fold pieces. **Done:** line styles and identifiers match source project with clipping/visibility QA; no false industrial marker-optimization claim.

### Phase 2 — tabletop hand controls (G2)

**SP-201 — Implement tracking-provider protocol.** Depends: SP-004, SP-104. Owner: CV. Scope: camera frame timestamps, confidence, handedness, landmarks; MediaPipe provider first, Apple Vision optional alternate. **Done:** controlled replay produces normalized events from both test inputs without direct CAD mutation.

**SP-202 — Map tracked hand into table coordinates.** Depends: SP-201, SP-103. Owner: CV/graphics. Scope: image undistortion and fingertip ray/plane intersection, with height/uncertainty handling. **Done:** measured fingertip-to-table reference-error trials across multiple hand heights and corners.

**SP-203 — Gesture state machine.** Depends: SP-202. Owner: interaction. Scope: hover, candidate, pinch held, drag, release, cancel, confidence lost and mode transition. **Done:** jitter/flicker tests pass; no stuck held state on hand disappearance.

**SP-204 — Geometry-aware hit tests.** Depends: SP-102, SP-203. Owner: CAD. Scope: distinct pick tolerance for point, tangent handle, edge and panel; keep stable IDs. **Done:** recorded gestures select intended targets and never rely on mere image-color sampling.

**SP-205 — Preview-only transactions and committed commands.** Depends: SP-204, SP-001. Owner: CAD. Scope: implement Move Piece/Rotate/Move Point with expectedRevision, validation, one undo entry per completed gesture. **Done:** tracked 10 mm move is an actual editable pattern change; cancel/revision collision leaves authoritative source untouched.

**SP-206 — Spatial UI and companion monitor.** Depends: SP-205. Owner: UX. Scope: projected hover, selected object, ghost preview, mm delta, snap, Undo, Reset, safe Stop, mode separation. **Done:** user can complete a move without ambiguity about whether pattern data changed.

**SP-207 — Stress/privacy verification.** Depends: SP-206, SP-004. Owner: QA/security. Scope: camera disconnection, second hand, shadows, occlusion, low-light, Mode switch, fast reverse movement and no-video-recording mode. **Done:** deterministic cancellation/undo; no unauthorized saved imagery or silent edits.

### Phase 3 — garment and look registry (G3)

**SP-301 — Define asset registry schema and migration.** Depends: SP-001, SP-002. Owner: data/app. Scope: source design, display mesh, avatar, texture, garment size/variant, Look, Studio, render derivatives and rights. **Done:** fixture round-trips across versions; per-asset source/derivative linkage preserved.

**SP-302 — Read-only file indexing/deduplication.** Depends: SP-301. Owner: app. Scope: approved folders, content hashing, safe path traversal, file changes, duplicate resolution. **Done:** originals unchanged; missing and duplicate files produce explicit states.

**SP-303 — EXO garment source adapter.** Depends: SP-301. Owner: native EXO. Scope: editable patterns + material reference + compiled display mesh and render snapshot, accurately labeled. **Done:** source revision and display mesh are linked; the mesh cannot overwrite editable seams.

**SP-304 — CLO3D export intake guide.** Depends: SP-301. Owner: interoperability. Scope: benchmark official OBJ/FBX/GLB exports and supported presets, unit/axis/material/texture mapping, missing-data flags. **Done:** known CLO-origin garment renders at measured size; not incorrectly marked as fully editable CAD.

**SP-305 — Blender asset adapter.** Depends: SP-301. Owner: Blender/graphics. Scope: preserve .blend master; create portable runtime GLB and validation report for geometry, shaders, source props, rig and textures. **Done:** metadata identifies Blender export limitations and missing dependencies.

**SP-306 — Visual catalog and search.** Depends: SP-302 through SP-305. Owner: UI. Scope: thumbnails, categories, size/colorway, licenses, variant association, visible import state. **Done:** users distinguish Indexed Only / Renderable / Avatar Compatible / Editable in EXO.

**SP-307 — Look builder and preview reproducibility.** Depends: SP-306. Owner: graphics/app. Scope: garment variant on approved avatar in saved pose with stable render scene IDs. **Done:** look reopens with same garment version and camera; original design/source hashes unchanged.

### Phase 4 — Blender studio environments (G4)

**SP-401 — Studio asset and Look render manifest.** Depends: SP-301. Owner: Blender/graphics. Scope: source .blend master, runtime export, environment HDRI, cameras, lights, floor, props, rights, color management. **Done:** opening a Studio never overwrites its .blend source or the garment.

**SP-402 — Build original White Product, Concrete and Black Stage scenes.** Depends: SP-401. Owner: Blender artist. Scope: two cameras per stage, three-point/area lights in .blend, thumbnails and original geometry. **Done:** all three reopen and have correct licensing/provenance.

**SP-403 — Runtime scene conversion and parity.** Depends: SP-402, SP-305. Owner: graphics. Scope: use portable GLB for geometry and **separately reconstruct** Blender World and area-light behavior in EXO. **Done:** inspected reference screenshot comparison and explicit render-engine limitations; no claim of a lossless GLB scene.

**SP-404 — Studio presenter UI.** Depends: SP-403, SP-307. Owner: app/UX. Scope: choose environment, camera angle, avatar pose, lights, exposure and outfit variant without changing garment source. **Done:** look variants and cameras persist with stable IDs and neutral color-reference view.

**SP-405 — Deterministic still/turntable queue.** Depends: SP-404. Owner: pipeline. Scope: versioned output jobs, retry/cancel/progress, Blender offline rendering optional and local cache. **Done:** repeatable output filenames with source/scene hashes; failed jobs do not overwrite approved renders.

**SP-406 — Studio quality and accessibility QA.** Depends: SP-405. Owner: art/QA. Scope: black/white fabric legibility, shadows, material maps, camera crop, color management, missing assets and aspect ratios. **Done:** front, back, three-quarter, macro and turnaround reference set signed off.

### Phase 5 — stationary physical mannequin projection (G5)

**SP-501 — Scan/measure and align mannequin.** Depends: SP-003, SP-005. Owner: 3D/rig specialist. Scope: geometric surface for reprojection, separately validated collision avatar, world axes and reference markers. **Done:** verified real-vs-mesh correspondence; body mesh permissions documented.

**SP-502 — Calibrate curved-surface projector/camera pose.** Depends: SP-501, SP-103. Owner: CV/graphics. Scope: full projector-camera model with lens correction, extrinsics, visibility masks and physical marker positions. **Done:** measured reprojection error at front/side known points; planar homography not used for entire curved body.

**SP-503 — Static garment projection stage.** Depends: SP-502, SP-307. Owner: graphics. Scope: render digital garment appearance from calibrated projector view; mask invisible/back-facing surfaces. **Done:** original color and details appear aligned on mannequin and projector can be safely disabled.

**SP-504 — Drift and occlusion reliability.** Depends: SP-503. Owner: QA. Scope: warm-up, moved mannequin/mount, hand shadow, projector overexposure and re-registration tests. **Done:** error measurements and fail-safe blank when tracking/calibration becomes invalid.

### Phase 6 — real-time projected native cloth Hand (G6)

**SP-601 — Secure temporary grab capability design.** Depends: SP-004, SP-203, SP-503. Owner: security/native. Scope: versioned, local-only, allowlisted GrabStart/Move/Release with owner and lease expiry. **Done:** reviewed threat model, request schema, validation and timeouts; no public arbitrary script execution.

**SP-602 — Camera-to-garment hit test.** Depends: SP-501, SP-601. Owner: CV/graphics. Scope: raycast closest visible triangle and barycentric weights against source snapshot with revision. **Done:** selected native triangle corresponds to calibrated fingertip and is not behind body collider.

**SP-603 — Native solver command integration.** Depends: SP-602. Owner: physics. Scope: hand target mailbox sampled while simulation runs, separate draw interpolation, no render-only mesh rewrite. **Done:** positions/time advance while held and user-visible status corresponds to native accepted spring.

**SP-604 — Guaranteed release and recovery.** Depends: SP-603. Owner: native/app. Scope: end/cancel, tracking lost, disconnect, switch modes, pause, solver error and revision mismatch must release transient native constraint. **Done:** 100 consecutive injected cancellation cycles produce zero surviving held grabs; unchanged native garment source.

**SP-605 — Fabric/material and fit QA.** Depends: SP-604. Owner: apparel/physics QA. Scope: jersey, denim, French terry, leather and suede proxies where measured properties available; compare recovery, collision and seams. **Done:** recorded material-specific dynamics and known limits; no 'certified fit' claims from uncalibrated presets.

**SP-606 — End-to-end performance measurement.** Depends: SP-605. Owner: graphics/QA. Scope: timestamps for camera, model inference, gesture, native solve, renderer and projection, plus safe display fallback. **Done:** measured latency histogram and device-specific supported garment complexity.

### Phase 7 — optional AR and physical fitting research (G7)

**SP-701 — Avatar-only try-on showroom.** Depends: SP-307. Owner: graphics/UX. Scope: avatar pose and outfit visualization from source-licensed assets. **Done:** looks switch smoothly with known export/rig compatibility and visual-preview label.

**SP-702 — Mobile AR tracking feasibility.** Depends: SP-701, SP-004. Owner: mobile AR. Scope: feature-detect Apple ARKit/Android ARCore support, camera permissions and tracking. **Done:** tested device matrix with consent and frame-rate/occlusion metrics.

**SP-703 — Camera-based garment overlay.** Depends: SP-702. Owner: graphics/CV. Scope: stable pose correspondence, segmentation and occlusion; no body-size assertion. **Done:** controlled turning/arm motion tests and explicit display of unsupported poses.

**SP-704 — Consent, data retention and export.** Depends: SP-702, SP-004. Owner: privacy/security. Scope: person/body data purpose, deletion, access and local-only processing. **Done:** camera cancellation/deletion tests and no incidental upload.

**SP-705 — Independent fit-science decision gate.** Depends: SP-703 + externally measured body/garment/fabric fixtures. Owner: apparel researcher. Scope: compare simulation against actual garments before any sizing recommendations. **Done:** independent evidence with measured errors and stated confidence; otherwise remain visual-only indefinitely.

## 4. User-facing scenario acceptance scripts (future QA)

### QA-S1 — 1:1 tabletop trace
With an approved table profile and neutral paper, select the front T-shirt piece, enable Trace and measure projected center/corner ruler lines. Confirm high-contrast seam/cut outline, grainline/notch visibility, units, and scale lock. Change UI zoom and verify true physical 100 mm stays unchanged. Move the projector; ensure Trace invalidates until calibration repeats.

### QA-S2 — camera-free fallback, then gestural edit
Disable all camera inputs: the table remains navigable with a mouse. Enable consented camera; hover, pinch one point, move 10 mm according to the CAD measurement readout, release, Undo and Redo. During active editing unplug the camera; transaction must cancel and source revision must remain unchanged. Trace mode should reject any change gesture.

### QA-S3 — library and Blender studio
Index an approved EXO design, a CLO display export and a Blender model. Confirm they display **different editability badges** and linked source hashes. Dress a compatible avatar, switch White Product → Concrete → Black Studio, render a front/back set, close/reopen, compare. Verify original CLO/.blend/EXO design files have not changed.

### QA-S4 — projected mannequin with Hand
Load a calibrated static mannequin outfit. Pinch visible cloth and confirm the native Rust positions change while held. Release and confirm zero held native constraints; repeat with blocked camera, mode change, solver error and projector disconnect. Document material-dependent recovery over simulated seconds, not instant snapback.

### QA-S5 — AR appearance honesty
With consenting adult test subjects and a supported device, view overlay from multiple angles under changing lights. Report temporal drift and occlusion failure. Labels must say **visual appearance preview only**; make no unsupported fit/size recommendation.

## 5. Engineering issue template and review policy

A future issue should include: **planning ID**, exact repository root, source integration file(s) to inspect, before/after example, independent test fixture, input/output units, required command API contract, assigned owner and reviewer, dependency tickets, non-goals, expected measurable acceptance, QA screenshot/recording path, migration/rollback path, third-party license status, privacy and security implications, and a list of known failures.

Every phase should run first against separate test fixtures, **not the real user's saved V2 project**. Record any skipped GPU/projection hardware checks plainly. A screenshot proves a displayed UI state, not calibrated physical measurements or fit physics. The future GitHub issue board should preserve these IDs, but this document intentionally creates no external issues.

## 6. Recommended decision sequence

**Before any implementation:** approve SP-001–006. **First possible demonstrable build:** SP-101–106 (projected dimensional outline); if that does not pass a physical ruler, stop. **Next:** SP-201–207 only after calibration passes. **Parallel value:** SP-301–307 and SP-401–406 make the clothing catalog/studio independently useful even without projector ownership. **Advanced installation:** SP-501–606 once the native solver and calibration are reliable. **AR:** evaluate SP-701–705 only if the intended value justifies camera/mobile work; do not fold it into the MVP promise.

The estimates and quality targets in the ten-page companion are provisional until G0 hardware and manufacturing requirements are confirmed. Keep **all work on hold until separately authorized**.
