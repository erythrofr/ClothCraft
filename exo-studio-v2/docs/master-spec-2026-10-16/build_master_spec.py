#!/usr/bin/env python3
"""Build an evidence-linked, detail-level EXO completion specification.

This is a planning artifact. Existing application files are read only. A new
PDF/DOCX/HTML/manifest is produced in this documentation folder.
"""
from __future__ import annotations
import html
import json
import re
import subprocess
from pathlib import Path
from datetime import date

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
OUT.mkdir(parents=True,exist_ok=True)
STAMP='2026-10-16'

def js_module(expression):
    code=f"import {{FABRIC_PRESETS}} from './src/data/defaultProject.js'; import {{CLO7_NATIVE_TOOL_CAPABILITIES}} from './src/core/clo7NativeToolCapabilities.js'; console.log(JSON.stringify({expression}))"
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,text=True))

tools=js_module('CLO7_NATIVE_TOOL_CAPABILITIES')
fabrics=js_module('FABRIC_PRESETS')
coverage=json.loads((ROOT/'docs/reports/EXO_400_FABRICS_COVERAGE.json').read_text())
fabrics_evidence={r['id']:r for r in coverage['fabrics']}

EPICS=[
('Canonical garment document','Single revisioned source of truth for 2D pattern, 3D arrangement, seam graph, fabric assignments, avatar pose and exports','src/core/project.js; src/core/backends/protocol.js; native_cpp/core/garment_document.hpp','Define versioned Project/Pattern/Edge/Curve/Seam/Fabric/Avatar/Trim/Manufacturing models; immutable IDs; unit scale; coordinate frames; provenance; explicit migrations. Convert native Rust session snapshots and C++ document snapshots through a schema-preserving boundary.','ProjectRevision{id,revision,parents,units,hash,entities,invalidations}; no data-derived element ID may silently shift on edit.','Save/edit/undo/reopen/re-export consistency on tee, pants and jacket; reject stale revision and dangling foreign key without modifying disk','M0/P0'),
('Typed command engine and undo','Make every toolbar action a deterministic, testable edit with proper cancellation and history','src/core/workspaceCommandIndex.js; src/core/cloPropertyCommands.js; integrations/clothcraft/exo-session.rs','Register typed operations with target preconditions, dry-run diff, effect scopes, inverse snapshot and atomic commit. Choose one transaction owner per change and map browser/native bindings to same command semantics.','CommandEnvelope{commandId,targetIds,params,expectedRevision,selection,units}; CommandResult{revision,createdIds,changedIds,invalidated,errors}.','Bad inputs leave project byte-identical; grouped drag is one history step; undo/redo survives native restart and invalidates dependent projections','M0/P0'),
('2D planar geometry kernel','Exact point, curve, segment and topology operations without pixel-space drift','src/core/draftingPrecision.js; src/core/draftingTopology.js; native_cpp/core/drafting_precision.cpp','Use stable edge-segment IDs and declared units. Evaluate Bézier derivatives and arc length; robust intersection predicates; exact decimal input; split/reparameterize edges while preserving attachment parameters.','CurveEdge{id,from,to,kind,controls,orientation,arcLengthTolerance}; tolerance policy defines mm to internal coordinate conversion.','Golden analytic geometry fixtures at many zoom/DPR levels; no inverted winding or dangling notch after split; no self intersection accepted silently','M1/P0'),
('2D drawing and selection','Selection, lasso, snap, node edits, keyboard precision and viewport state','src/components/PatternEditor.jsx; src/core/draftingSnapping.js','Specify pointer hit-test order, snapping priorities, selection cycling, drag preview commit, keyboard nudges, multi-select and focused command routing. Keep screen transforms separate from physical points.','SelectionState{kind,ids,active,mode}; DragPreview{baseRevision,proposedGeometry,precisionMm}.','Pointer and keyboard produce equivalent geometry; viewport zoom does not alter final cm measurements','M1/P0'),
('2D drafting constructions','Native darts, slash/spread, pleat, fullness, mirror, unfold and linked pieces','src/core/draftingConstructions.js; src/core/draftingUnfold.js; native_cpp/core/drafting_constructions.cpp','Model fold/dart legs, apex, take-up and dependent constraints. Use constructive graph nodes whose control points remain editable; reconstruct boundary stitching, cut offsets and annotations after each operation.','Construction{id,type,parentPiece,anchors,parameters,dependentEdges,revision}.','Known dart intake and fold tests, mirrored tangent continuity and seam lengths preserved under undo/export/import','M1/P0'),
('Notches and seam allowance CAD','Cut-line offsets, variable width, corners, notches and seam line differentiation','src/core/draftingPrecision.js; src/core/productionPreflight.js','Compute offset curves with robust join semantics, corner trimming and collision checks. Distinguish stitch line, cut line, turn/fold line and metadata references. Annotate cut marks with consistent scale.','Allowance{edgeId,widthMm,cornerPolicy,lockMode}; Notch{edgeId,t,depthMm,style,gradeMode}.','1:1 paper plot measurements and independently checked DXF layer output; no allowance becomes a sewing edge by accident','M1/P0'),
('Linked 2D to 3D correspondence','Lossless mapping of every authored piece and semantic line to render/solve mesh','src/core/clothMeshing.js; src/core/liveDrapeTransfer.js; native_cpp/core/pattern_mesh.cpp','Maintain source vertex and edge-param lineage during triangulation and remeshing; define index stable until invalidated. Propagate UVs, grainline, material IDs and seam constraints.','MeshMapping{pieceId,meshVersion,vertexSources,edgeRanges,triangleSources,uvFrame}.','Highlighting a source line finds correct 3D surface after subdivision; editing point invalidates only dependent solve caches','M2/P0'),
('Sewing graph and partial seams','Segment/free sewing, orientation, lengths, easing, seam types and topology diagnostics','src/core/sewingConstruction.js; src/core/backends/seamAssembly.js; native_cpp/core/native_seam_assembly.cpp','Treat seam as a pair of oriented parameter intervals on persistent boundary edges. Build stitch samples by arc-length correspondence, reconcile different discretizations and detect gaps or duplicates.','Seam{id,left:{edge,t0,t1},right:{edge,t0,t1},direction,ease,stitch,allowance}.','Full/partial seam fixtures, reverse-edge direction, oversized ease ratio rejection, seam walk report and undo/redo reopening','M2/P0'),
('Complex construction and hardware','Zippers, buttons, buttonholes, binding, piping, trims, quilting, lining and multi-layer assembly','src/core/trims.js; src/core/sewingConstruction.js; native_cpp/core/cloth_seam_constraints.cpp','Store separately authored trim geometry and pattern-space attachment constraints. Separate visual paths from physical/production semantics. Add collision proxies only after robust primitive support.','TrimInstance{id,type,material,anchors,fastenerState,geometryVersion,manufacturingCode}.','A jacket zipper closes/reopens with no orphan edges; hardware BOM is traceable to rendered attachment and version','M2/P1'),
('3D garment editing tools','Mesh selection, stylelines, pins, transforms and surface-bound strokes','src/core/meshSelection.js; src/components/GarmentViewport.jsx','Add area/brush/lasso selection on triangle IDs with source map, editable styleline contours and persistent projected control points. Preserve source panel ownership after remesh.','SurfaceStroke{id,meshRevision,barycentricAnchors,parentPieceIds,projectionTolerance}.','Click/drag modifies correct authored entity, undo/redo, 3D→2D continuity and reopen; unsupported tools remain labelled','M2/P0'),
('Avatar geometry and measurement','Body collision mesh, pose rig, standardized landmarks, shape and anthropometric control','src/core/meshAvatarContact.js; public/avatars; blender_bridge','Record avatar license, units, rig hierarchy, landmark definitions, skinning and signed mesh normals. Validate open scans, custom morphology, poses and robust collision proxy generation.','Avatar{id,meshHash,unit,rig,bonePoses,measurements,landmarks,collisionProxyVersion}.','Independent tape measurement within tolerance, neutral/arms-up poses, malformed scan rejection, accurate visual and collision alignment','M3/P1'),
('Animation timeline','Pose, clip, keyframe editing and motion-driven drape','src/components/GarmentViewport.jsx; src/core/physics/timestep.js','Build typed animation tracks for avatar bones, camera and garment states, keyframe interpolation, timeline editing, scrub/cancel, cache invalidation and export.','AnimationTrack{targetId,property,keyframes,interp}; MotionSample{time,poseHash}.','Repeatable pose reconstruction and defined contact checks between frames; time scrubs do not corrupt source geometry','M3/P2'),
('Interactive VBD and XPBD preview','Fast cloth response with explicit accuracy tier and selectable backend','integrations/clothcraft/exo-session.rs; native_backend/server.mjs; src/core/physics.js','Specify substep/unit conventions and initial assembly, anisotropic stretch/shear/bend/damping, panel pins and restart. Draw boundaries among Rust VBD, browser PBD and C++ XPBD; report runtime and constraints.','SimulationRequest{documentRevision,backend,materials,avatar,config,seed}; Frame{positions,velocities,diagnostics}.','Tee/pants/jacket quality curves, finite values, reproducibility, controlled pause/reset and recorded unsupported contact conditions','M3/P0'),
('PPF contact batch acceptance','Full-frame and swept-contact validation rather than solver-completed status','ppf_backend/server.mjs; ppf_backend/fitAcceptance.mjs; ppf_backend/assemblyAcceptance.mjs','Solve with initialized seam graph and validated boundaries; run cloth/body and cloth/cloth swept intersection analysis, seam-gap metrics, friction, strain and temporal jitter reports.','AcceptanceReport{fixture,solverHash,frames,maxPenetrationMm,sweptHits,seamGapMm,strain,passed,failures}.','Known failing tee/arm motion must be rejected; acceptance only when independent metrics meet stated fixture thresholds','M3/P0'),
('Simulation numerical reliability','Collision tolerances, convergence, diagnostics and safe restart','native_cpp/core/cloth_collision_step.cpp; src/core/physics/qualityGate.js','Test stretch/shear energy, non-inverted triangles, mass conservation, energy drift, self-contact and avatar-contact residuals under variable timestep and remeshing.','SolverDiagnostics{iteration,energy,residual,contactCount,violations,stable,runId}.','NaN, teleport, tunneling, seam bursting and stale frame tests; bounded cancellation; reproducible seed and environment','M3/P0'),
('Physical fabric model','Traceable anisotropic sheet mechanics separate from optics','src/core/fabricCalibration.js; src/core/fabricEvidenceCalibration.js; src/core/clothcraftFabrics.js','Use GSM, pressure-qualified thickness, directional force-extension curves, shear, bending hysteresis, friction pair and damping. Map measurements to each solver explicitly with uncertainty and benchmark fits.','PhysicalFabricSpec{specimenId,conditioning,tests,SI,uncertainty,calibration,solverMappings}.','Real swatch and solver model measured against drape/force data; show estimated flag without calibration; 400-count not certification','M4/P0'),
('Physical fabric acquisition','Lab specimen intake, unit normalization, calibration and provenance','docs/FABRIC_MEASUREMENT_INGESTION.md; src/core/fabricEvidenceCalibration.js','Define machine calibration, specimen orientation, conditioning, repeat runs and raw curve storage; automate outlier/units checks and fit report. Keep unverifiable claims explicitly unverified.','FabricTest{sampleId,instrument,method,orientation,replicate,rawSeries,operator,environment}.','Reject inconsistent load units, missing repeats and bad sampling; independent examiner can reproduce one fitted stretch response','M4/P0'),
('PBR textile optical pipeline','Measured/estimated PBR maps, yarn-scale repeat, panel UVs and color management','src/core/textileProcedurals.js; src/core/fabricPbrGenerator.js; src/core/fabricSurfaceModel.js','Separate source albedo, normal, roughness, opacity, height, metallic, sheen, weave anisotropy and color-space tagging. Follow grainline in 2D UVs and preserve map provenance/hashes.','VisualFabricProfile{id,textureSets,licenses,texelScaleCm,normalConvention,uvRotation,renderTransform}.','Neutral-light swatch + oblique-light comparisons, no flipped normals, consistent repeat size across garment sizes','M4/P1'),
('400 fabric catalog engineering','Preserve all 400 stable IDs, add specimen fidelity, swatch and construction truth','src/data/fabricCatalog400.js; src/data/defaultProject.js; docs/reports/EXO_400_FABRICS_COVERAGE.json','Audit every current estimate and unique scan assignment, create priorities by cotton/French terry/denim/wool/knit/leather/nylon, measure high-volume archetypes, then populate calibrated variants only when tested.','FabricCatalogEntry{id,parentConstructionId,appearanceVariant,evidenceLevel,specimenId,license,QA}.','400 stable entries selectable and saved; separate coverage measures for 400 parameter presets, 44 used image sources and 0 measured mechanics','M4/P1'),
('Fabric optical finishes and washes','Non-destructive denim/garment washing, distress, colorway layers and masks','src/core/clothWashProcedurals.js; src/core/clothWashImage.js','Create versioned finish stack with seeded masks, material-aware choices, physical-scale edge distances, seam masks, layered roughness effects and source-preserving compositing.','FinishLayer{kind,strength,seed,blend,uvTransform,seamWear,masks,sourceHash}.','Undo/reopen deterministic colorways; mask aligned after grading; textile physics does not change for optical wash','M4/P1'),
('Fabric browser and property editing','Context-sensitive metadata, measured status, face materials and revisioned edits','src/components/ClothCraftFabricLibrary.jsx; src/components/CloPropertyEditorAccordion.jsx; src/core/cloPropertyCommands.js','Add editable Name/Item No./Construction/Supplier/Owner with revision validation, front/back/side appearance fields, physical properties, texture transforms, assignment and bulk edits.','PropertyMutation{entityId,field,value,expectedRevision}; field registry defines type/units/read-only rules.','Selected fabric edits appear instantly, persist after native restart and never silently edit the selected panel','M4/P1'),
('Avatar/garment fit interpretation','Clearance maps, strain maps, body measure POM, comfort limitations','src/core/meshAvatarContact.js; docs/PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md','Compute fit visualizations from tested geometry and solver diagnostics. Distinguish contact, high tensile strain, pressure proxy, nonconvergence and actual physical comfort.','FitLayer{metric,units,min,max,confidence,fixtureId,sourceRevision}.','Known 2mm penetration appears as failure; legend and dataset distinguish measured and estimated metrics','M5/P1'),
('POM and measurement tools','Permanent dimension anchors, garment points of measure, grading and report tables','src/core/measurements.js; src/core/clothcraftSelectionMetrics.js','Create authored POM paths anchored to pattern topology/2D/3D body landmarks; store measurement type, protocol, tolerance, placement and sizes.','POM{id,measureKind,anchors,method,units,tolerance,sizeValues,revision}.','POM persists/grades; edit a pattern then recalculate; temporary native tape not mistaken for saved POM','M5/P1'),
('Grading and multi-size','Point grade rules, size tables, curve propagation and notch/graphic sizes','src/core/grading.js; native_cpp/core/grading.cpp','Model base-size control points with per-size deltas; interpolate graded curves, sew compatibility and item IDs; import/export AAMA/ASTM rules.','GradeRule{pointId,sizeGroup,baseSize,deltaBySize,notchBehavior}.','Measurements for XS–XXL independently checked; seam match after grading; roundtrip through external CAD','M6/P1'),
('DXF and industrial CAD interchange','Bidirectional AAMA/ASTM/standard DXF with units, layers, curve and notch fidelity','src/core/dxf.js; native_cpp/core/dxf_import.cpp; native_cpp/core/dxf_export.cpp','Explicitly map polylines/curves, grainlines, cut/stitch lines, notches, seam allowances, grade layers, units and import warnings.','ImportReport{sourceFileHash,format,unitScale,mappedEntities,losses,warnings}.','External CAD roundtrips + measured millimeter tolerances on test tee and trouser markers','M6/P0'),
('Markers and cutting layout','Fabric-width, nap, print direction, grain, multi-size nesting and yardage','src/core/marker.js; native_cpp/core/marker_layout.cpp','Represent constrained polygon packing, repeated patterns, seam allowances, shrink, fabric flaws, stripes/plaids and lay plans with independently measured efficiency.','MarkerJob{rollWidth,repeat,grainTolerance,nap,patternVersions,quantity}; MarkerReport{placements,utilization,violations}.','Verify no overlaps, actual length on plotted layout, stripe alignment and factory-signed sample marker','M6/P1'),
('Factory BOM and cost','Traceable fabrics, hardware, seams, shrink allowances, suppliers, consumption and costing','src/core/factoryPackage.js; src/core/bomXml.js; native_cpp/core/bom_export.cpp','Build line items from authored assignments and actual marker usage; retain vendor costs private; track alternates, unit conversions, minimum order and revision history.','BOMLine{itemId,type,supplier,sku,qty,unit,usageBasis,sourceRevision}.','Per-size usage reconciles with marker; 3D hardware count equals BOM; private prices excluded from public previews','M6/P1'),
('Technical pack production','Editable and immutable approved releases of POM, BOM, 2D, images and notes','src/core/factoryPackage.js; docs/EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md','Define source-linked tables, component callouts, sewing illustrations, grade measurements, tolerance sign-off, sample rounds and export manifest with reviewer approvals.','TechPackRelease{id,sourceHash,sections,approvals,assets,visibility,signature}.','Factory receives complete selected release, revisions compare field by field; prior approved release cannot be silently overwritten','M6/P1'),
('Project save, migration and recovery','Transactional atomic persistence, autosave and damaged-file recovery','src/core/project.js; integrations/clothcraft/exo-session.rs','Use complete version headers, checked sums, forward-only migration, atomic temp/rename and off-site optional backup. Keep project source separate from generated caches.','ProjectFile{schemaVersion,sourceRevision,authoringGraph,resourceManifest,historyWatermark}.','Crash during save cannot corrupt last good revision; 1-year-old fixture migrates with no loss of topology','M0/P0'),
('Desktop app shell and Qt strategy','Consolidate signed macOS WebKit/Rust and native C++ Qt without dual sources of truth','integrations/clothcraft/macos; native_app; native_cpp/desktop','Select one supported desktop product path per release; secure localhost RPC, lifecycle/IPC, signed sandbox, file dialogs, native accessibility, workspace state and crash logs.','DesktopCapability{runtime,buildHash,supportedTools,backendEndpoints,securityScope}.','Installed signed app is tested on clean machine; no browser-only toolbar mistaken for native implementation','M7/P0'),
('Typed automation and scripting','Stable operation coverage for human and AI tools','docs/EXO_V2_AGENT_API_FOUNDATION.md; src/core/workspaceCommandIndex.js','Generate tool registry from exact command schemas; strict read/write scopes, previews, revision guards, atomic multi-step transaction, deterministic replay and logs.','AgentOperation{command,targets,params,expectedRevision,allowSideEffects,previewOnly}.','Agent creates tee seam, edits fabric, exports on test fixture while all actions remain reversible','M7/P1'),
('Rendering and visual studio','Film-grade textile optics, neutral reference lighting, still/movie output','src/components/GarmentViewport.jsx; docs/EXO_UI_RENDERING_AND_AVATARS.md','Design physically plausible light presets, studio HDRI licenses, camera composition, tone maps, microtexture LOD, output color profiles and queued exports.','RenderJob{sceneHash,materialHashes,camera,lights,resolution,colorSpace,output}.','Repeat captures compare visual refs under neutral light; no proprietary third-party HDRI bundled without license','M8/P2'),
('Asset library and local ownership','Searchable editable library of patterns, garments, avatars, fabrics, trims and studios','docs/EXO_DATA_MODEL.md; public/avatars; docs/EXO_FABRIC_MATERIALS_AND_TRIMS.md','Implement content-addressed assets, preview indexes, local folders and reversible relinking, tags, duplicate detection, license metadata, offline access.','LibraryAsset{id,type,contentHash,sourceUri,license,dependencies,previewHashes}.','Renaming a folder and reopening an outfit rebinds by hash without losing authored fabric IDs','M8/P2'),
('Open-source packaging and CI','Portable builds, dependency licenses, reproducible assets and support policy','package.json; .github/workflows; docs/LICENSING.md','Pin native toolchains, generate SBOM, static checks, test fixtures, binary signing/notarization, contributor templates and regression dashboards.','ReleaseManifest{commit,buildEnv,licenseInventory,testResults,knownGaps,packageHashes}.','Clean machine install/build passes supported command set; distributed binary dependencies and licenses match manifest','M7/P0'),
('Community and pattern marketplace','Independent future service with creator profiles, assets, rights and pricing','docs/EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md','Do not expose local source by default. Implement authorized publish previews, versioned entitlement, sanctioned remixes, refund and moderation events with no private CAD leakage.','PublishedAsset{id,version,license,rights,publicDerivatives,privateSourceRef}.','An anonymous follower cannot fetch editable source; a purchased entitlement receives only licensed immutable revision','M9/P2'),
('Interactive web tech packs','Team collaboration, comments, proposals, immutable manufacturer release','docs/EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md','Design separate tenancy, section-based ACL, comment anchors on stable CAD IDs, proposal merges with revision preconditions, factory acknowledgments and diff receipts.','Proposal{id,baseRevision,patch,author,reviewStatus}; Approval{releaseHash,role,time}.','Factory B cannot read Factory A quote; approved R01 stays downloadable after new R02 proposal','M9/P2'),
('Spatial showroom and projection','Optional walking wardrobe, projection staging, AR and video production','docs/EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md','Prototype after CAD reliability; isolate projectable display meshes and 3D room masters, maintain stable looks and explicit asset rights. Avoid requiring PPF on web page load.','Look{id,garmentRevision,avatarPose,studio,lights,cameras,derivativeManifest}.','Walkable 10-outfit scene runs on target hardware and never requests private unpublished geometry','M10/P3'),
('Security/privacy and permissions','Project privacy, import sandboxing, safe local bridge and public publishing','integrations/clothcraft/server.mjs; docs/EXO_RELEASE_STATUS.md','Bind local services to loopback, validate origins/input size, guard destructive mutations by version; block path traversal, zip bombs, malformed GLB/DXF and untrusted texture payloads.','CapabilityGrant{principal,scope,resource,operation,expiry}; SecurityEvent{id,reason,source}.','Untrusted project import is quarantined, no extra disk paths are readable, serialized source is never leaked to previews','M0/P0'),
('Performance budgets and telemetry','Large pattern sets, 400 catalog, textures, simulation, import and signed app responsiveness','src/components/GarmentViewport.jsx; src/core/backends/registry.js','Define workload fixtures per device, memory/latency budgets, shader/texture loading and worker cancellation. Cache by exact revision and avoid nested full rebuild on visual-only edit.','PerfTrace{operation,fixture,cpuMs,gpuMs,memoryPeak,outputBytes,revision}.','Measure 100-piece scene interactions and worst-case 400 swatch browsing without UI deadlock or stale state','M7/P1'),
('Accessibility and localization','Keyboard complete editing, focus rules, units and descriptive commands','src/components/CloUI.jsx; src/components/RightToolPalette.jsx','Specify accessible role/description of controls, hover+keyboard parity, radial tool groups, screen-reader property labels and regional numeric/unit conversion.','UserPreferences{unitSystem,locale,shortcutMap,workspaceLayout}; UICommand{ariaLabel,shortcut,disableReason}.','Every toolbar button has exact accessible name, keyboard path, valid focus and meaningful disabled explanation','M7/P1'),
('Tool-bar and property parity reference','70 verified CLO 7 toolbar positions as reference; precise supported/inspect/disabled EXO states','src/data/clo7ToolbarOrder.js; src/core/clo7NativeToolCapabilities.js','Preserve observed order separately for 3D and 2D independent A/B columns, live semantics, context switches, icons and flyouts. Implement actual Rust commands before updating capability registry.','ToolCapability{id,dimension,column,position,mode,nativeAction,reason,testEvidence}.','70/70 controls visible in documented order; 11 native / 9 inspect / 50 unavailable treated as present snapshot, never all functional','M1/P0'),
('Context-aware Property Editor','Pattern/fabric/seam/avatar/trim selection and editable sections with validation','src/components/CloPropertyEditorAccordion.jsx; src/components/CloObjectPropertyFields.jsx','Normalize selection context and field registry. Each field has type, range, units, disable reason, localization, dependency invalidations and conflict messaging.','PropertyDescriptor{entityKinds,key,type,units,min,max,nullable,editable,backendCapability}.','Selecting a fabric exposes Fabric1 metadata/PBR; selecting a pattern exposes construction/particle distance without cross-writing','M1/P0'),
('Material calibration regression','Cross-solver physical mapping, optical maps and objective lab-data acceptance','docs/FABRIC_MEASUREMENT_INGESTION.md; src/core/fabricCalibration.js','Create calibrated material cards with instrument source, unit normalization, error bars, differential patch tests, numerical integration and hold-out material tests.','CalibrationReport{specimenId,solverBuild,parameterMapping,errors,heldOutCurves,approvedBy}.','Exactly zero measured presets until reviewed dataset; every promoted measured state links raw series and reproducible fitting script','M4/P0'),
('Cross-backend numerical parity','JS, C++ and Rust share semantics without conflating matching with physical accuracy','native_cpp/CONVERSION_STATUS_2026-10-15.md; docs/CLOTHCRAFT_CPP_RUST_INTEROP_2026-10-15.md','Compare data model/operation outputs by type: geometry in mm, solver samples in SI, frame arrays, UV and factory payloads. Keep solver maturity separate from exact JS parity.','ParityResult{fixture,engines,version,field,expected,actual,tolerance,difference,classification}.','Replicate 58 tests from clean native build; reject >tolerance collision or style metadata drift, with machine-recorded reports','M0/P0'),
('Engineering release gating','Evidence-weighted readiness by workflow, never decorative percentage complete','docs/EXO_VALIDATION_TEST_PLAN.md; docs/EXO_MILESTONE_ISSUE_BOARD.md','Every issue has traceable fixture, failure record, explicit acceptance, code owner, dependency, risk and command. Require independent visual and numerical regression.','ReleaseGate{id,feature,owner,fixture,evidence,passed,blockers,risk,reviewedAt}.','No factory-ready/fit-certified claim without external reviews; warn on unverified native controls and PPF crossings','M0/P0'),
]

# These aren't direct CLO toolbar slots, but require unique close-out decisions.
SUPPORT_TOPICS=[
('Interchange format matrix','DXF AAMA/ASTM, SVG, OBJ, GLB, FBX, USD, ZPRJ/ZFAB import/export intent and unsupported boundaries','src/core/dxf.js; integrations/clo_sdk/audit_zprj.py','Per-format semantic matrix of geometry, sizes, materials, seams, animations, textures, versioning and license; import warnings rather than silent loss.'),
('Regression fixture repository','Reference garments across multiple body shapes and garments','docs/EXO_VALIDATION_TEST_PLAN.md; native_cpp/tests','Fixtures for sleeveless tee, raglan hoodie, 5-pocket jeans, structured jacket and layered garments in smallest and largest supported sizes.'),
('Cloth solver benchmark protocol','Timed, seeded and measured acceptances across device classes','src/core/physics/qualityGate.js; ppf_backend/fitAcceptance.mjs','Pin timestep and tolerances and report absolute seam gaps, body penetration, triangle inversion, strain, collision and normal tangency.'),
('Deployment update architecture','Signed macOS bundle, upgrades, rollback and notarization','integrations/clothcraft/macos; native_app','Versioned signed app and native service builds; checksum install and reversible migration; protect project documents from forced overwrite.'),
('Typography and design quality','Consistent editor layout, docking, icons, scale and workflows','docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md; src/clo-interface.css','Design-system tokens with per-platform high DPI, accessible commands and standard interaction rules; audit real app screenshots.'),
('Manufacturing traceability','Cutter-ready package provenance and release instructions','docs/EXO_PRODUCTION_PIPELINE.md; src/core/factoryPackage.js','Every exported drawing, POM, BOM and marker points back to an immutable garment revision and measured shrinkage/width data.'),
('Fabric inspection laboratory','Light booth view and transparent physical/visual evidence','docs/FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md','Enforce standardized lighting/color targets and physical swatch sample card, calibrated repeat scale and known instrument readings.'),
('Finish masking studio','Sew and fold aware fade/abrasion authoring','src/core/clothWashProcedurals.js; src/core/clothWashImage.js','Editable UV-space procedural masks, painting layer revision and stable seam landmark coordinates with nondestructive export.'),
('CLO version change monitoring','Maintain exact reference audit by version without copying proprietary assets','src/data/clo7ToolbarOrder.js; docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md','Pin reference version 7.0.242; changes in 2026 releases are separate additions, not silently appended into 70-slot order.'),
('Backend isolation and diagnostics','Reliable watchdog and bounded local process orchestration','native_backend/server.mjs; ppf_backend/server.mjs','Deadline, job cancellation, preview artifact manifests, child PID cleanup and errors without blocking UI process.'),
('Asset licensing and provenance','Verify rights for photos, scans, avatar meshes and external source','docs/LICENSING.md; docs/reports/EXO_400_LICENSED_SCAN_REGISTRY.json','Keep CC0 source evidence, user-uploaded restrictions, per-map hash and dependencies; never embed CLO proprietary resources.'),
('Automated tool functional matrix','Every native/legacy UI control from click to persistence','integrations/clothcraft/check-clo7-native-capabilities.mjs; scripts/qa-clo-interface.mjs','Test click, command dispatch, state change, selection, undo, save/load, screenshot and error case for each toolbar tool.'),
('Context property exhaustive matrix','Property Editor all selected object kinds and multi-select','docs/CLO3D_PROPERTY_EDITOR_DEEP_AUDIT_20261016.md; docs/CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md','Exact names, types, units and default state for pattern, fabric, seam, trims, avatar, simulation, graphic, grading and POM; test null/mixed values.'),
('Look and rendering ownership','Final presentation without replacing CAD sources','docs/EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md','Store immutable looks and render settings with source hashes; public visual derivatives contain no private pattern coordinates.'),
('Development operation and observability','Build health, persistent regression dashboards, failure triage','package.json; docs/EXO_DEVELOPER_GUIDE.md','Continuous CI on clean environment, runtime capability report, checksums, bug repro archive and automated artifact index.'),
]

PRIMARY_DOCS=[
'EXO_MASTER_ROADMAP.md','EXO_ARCHITECTURE.md','EXO_DATA_MODEL.md',
'GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md',
'CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md',
'CLO7_LIVE_TOOLBAR_AUDIT_20261016.md',
'EXO_CLO7_NATIVE_TOOL_SUPPORT_AUDIT.md',
'CLO3D_PROPERTY_EDITOR_DEEP_AUDIT_20261016.md',
'CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md',
'EXO_V2_PROPERTY_EDITOR_CONTEXT_EDIT_AUDIT_20261016.md',
'EXO_CLO7_BUTTON_FUNCTIONAL_LOOP_20261016.md',
'EXO_400_FABRIC_LIBRARY_AND_WASH_SYSTEM.md',
'FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md',
'PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md',
'EXO_VALIDATION_TEST_PLAN.md',
'CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md',
'EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md',
'EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md',
]
REFERENCES=[
('CLO live 7.0.242 inventory','docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md','Project live app inspector; four columns of 20+18+17+15 controls.'),
('CLO physical fabrication documentation','https://support.clo3d.com/hc/en-us/articles/115000565548--Mode-Emulator','Fabric emulator measures directional physical sample responses; not automatically EXO data.'),
('CLO material settings','https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials','Front/Back/Side optical property model and PBR settings.'),
('CLO DXF interoperability','https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export','Industrial AAMA/ASTM/standard DXF import/export options and losses to test.'),
('CLO grading','https://support.clo3d.com/hc/en-us/articles/115015578947-Add-Apply-Grading','Size groups, rules and grade editing behaviors.'),
('CLO pattern information','https://support.clo3d.com/hc/en-us/articles/59635504938777-2D-Pattern-Information','Pattern metadata, revision and shrinkage requirements.'),
('CLO particle distance','https://support.clo3d.com/hc/en-us/articles/115012227227-Particle-Distance','Numerical cloth mesh resolution property in mm.'),
('CLO sewing','https://support.clo3d.com/hc/en-us/articles/115012380148-Edit-Sewing','Sewing selection/mutation behavior.'),
('CLO POM','https://support.clo3d.com/hc/en-us/articles/360025716814-Edit-2D-POM','Permanent measurement geometry editing behavior.'),
('CLO finishing','https://support.clo3d.com/hc/en-us/articles/33852438561049-PBR-Map-Generator-ver-2024-1','Optical map generation options.'),
('CLO 2D seams','https://support.clo3d.com/hc/en-us/articles/115015714428-2D-Seam-Allowance','Custom seam allowance editing and selection.'),
('CLO recent grading review','https://support.clo3d.com/hc/en-us/articles/58043228154393-Grading-Review-2D','2026 grading side-by-side review; future parity scope.'),
('Licensed optical scan registry','docs/reports/EXO_400_LICENSED_SCAN_REGISTRY.json','CC0 third-party scan record and checksums.'),
]

def e(value): return html.escape(str(value),quote=True)
def textblock(value):return e(value).replace('\n','<br>')
def tag(name,content,**attrs):return '<'+name+''.join(f' {k.replace("_","-")}="{e(v)}"' for k,v in attrs.items())+'>'+str(content)+'</'+name+'>'
def paragraph(body): return '<p>'+e(body)+'</p>'
def bullet(lines):return '<ul>'+''.join('<li>'+e(s)+'</li>' for s in lines)+'</ul>'
def table(headers,rows):
    return '<table><thead><tr>'+''.join('<th>'+e(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+e(c)+'</td>' for c in row)+'</tr>' for row in rows)+'</tbody></table>'
def sheet(code,title,kind,body,refs=''):
    sheet_class='sheet fabric-sheet' if kind.startswith('400-MATERIAL') else 'sheet'
    return f'<section class="{sheet_class}" id="{e(code)}"><div class="eyebrow">{e(kind)} <span>{e(code)}</span></div><h2>{e(title)}</h2>{body}<div class="sheet-footer">{e(refs)}<span>EXO ENGINEERING SPECIFICATION · 16 OCT 2026</span></div></section>'
def paired(label,content):return f'<h3>{e(label)}</h3><p>{e(content)}</p>'
def markdict(keys,data):return ', '.join(f'{k}: {data.get(k,"unknown")}' for k in keys)
def read_source_excerpt(path):
    raw=(ROOT/'docs'/path).read_text(errors='replace')
    # Source annexes are redacted to engineering portions, with no duplicated cover.
    return raw

def spec_category(label):
    s=label.lower()
    if 'sew' in s or 'tack' in s:return 'Stitch topology','SeamRelation and edge intervals','Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.','Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.'
    if any(x in s for x in ('fabric','texture','steam','press','pucker','fill')):return 'Material / finish','MaterialAssignment and FinishLayer','Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.','Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.'
    if any(x in s for x in ('measure','length','grading','notch','annotation','pleats')):return 'Measurement / drafting','MeasurementAnchor and GradeRule','Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.','Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.'
    if any(x in s for x in ('button','zipper','piping','binding','graphic','topstitch')):return 'Attachment / trim','TrimInstance and PatternSurfaceAnchor','Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.','Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.'
    if any(x in s for x in ('mesh','styleline','pen','line (3d','motion','avatar','move','arrangement','fold','drape')):return '3D editing / avatar','SurfaceAttachment, Pose and GarmentFrame','Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.','Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.'
    if any(x in s for x in ('pattern','polygon','trace','fullness','curve','point','seam allowance')):return '2D pattern CAD','PatternPiece, BoundaryEdge and CurveAnchor','Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.','Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.'
    return 'Workspace / simulation','CommandEnvelope and ProjectRevision','Validate current state and command preconditions, expose real operation only when backend implements it and return typed state change with revision and diagnostics.','Click with valid state, run without selection, undo/restart and assert no fake execution or mislabeled support.'

parts=[]
parts.append('<section class="cover"><div class="cover-kicker">EXO / GARMENT STUDIO<br>COMPLETE ENGINEERING PROGRAM</div><div class="cover-title">THE REMAINING<br>BUILD</div><div class="cover-subtitle">Architecture, native tool contracts, fabric master, physical simulation, manufacturing, system quality and final release gates</div><div class="cover-meta">2026.10.16 / MASTER EXECUTION SPECIFICATION / EVIDENCE-BOUND / NOT A PARITY CERTIFICATION</div></section>')
parts.append(sheet('00','Executive contract and present-state truth','PROGRAM CHARTER',
    paragraph('This dossier specifies the technical work required to bring EXO ClothCraft/EXO Sample 3D toward a reliable CLO-class garment CAD, simulation and production workflow. It is a proposed implementation contract. It does not claim that EXO has achieved exact CLO equivalence, certified apparel fitting or production-approved manufacturing output.')+
    table(['Evidence dimension','Verified repository snapshot','Remaining validation'],[
      ('Native toolbar mapping','70 observed CLO 7.0.242 commands; 11 native / 9 inspect / 50 unavailable','Functional click → model edit → undo → reopen → 2D/3D matching for each slot'),
      ('Fabric library','400 estimated specs, 405 Rust choices; 385 photo-linked visual variants','400 genuine calibrated tests are NOT present; per fabric optical source matching and drape validation'),
      ('Physical optics','67 installed CC0 source materials; 44 referenced; 201 map images','Source construction identity, centimeters-per-tile, scene color matching and yarn-scale validation'),
      ('Preview dynamics','React PBD, Rust VBD, C++ XPBD and Rust PPF paths exist','Single canonical project contract, confidence levels and cloth/body swept collision evidence'),
      ('Manufacturing','DXF/POM/BOM/marker/factory ZIP generators','Independent third-party import, actual cutting, physical samples and signed package acceptance'),
      ('Desktop','Signed WebKit app and developing Qt/C++ structures','Full authoring interaction evidence and cross-platform packaging')])+
    paragraph('Priority rule: preserve truthful user-facing capability indicators. A button in the toolbar, a data record or a screenshot does not prove its semantic operation. Each following work item has an acceptance boundary and source pointers. "Future" sections are optional architectural extensions rather than blockers for core CAD.')+
    paragraph('Source-of-truth audit provenance: repository at /blender-mac-workspace/exo-clothcraft-v2; current working tree contains active uncommitted changes. Evidence labels below are snapshots, not reproducible build green statuses. The PDF/Docx themselves are planning artifacts and do not modify EXO code.'),'docs/EXO_MASTER_ROADMAP.md; docs/EXO_RELEASE_STATUS.md'))

parts.append(sheet('01','Dependency-critical implementation order','PROGRAM EXECUTION',
 table(['Sequence','Program gate','Blocking evidence'],[
 ('M0','Canonical schema, deterministic builds, versioned operation contracts','Clean native builds, migration and fixture corpus'),
 ('M1','2D CAD + toolbar/property semantic correctness','70-slot matrix, exact tools, cross-revision undo'),
 ('M2','Seam topology and 2D↔3D correspondence','Sewing, arrangement, stable mesh/source mapping'),
 ('M3','Cloth physical solver, avatar, swept contact','Accepted multi-frame tee/pants/layer tests'),
 ('M4','Calibrated fabrics and truthful PBR','Specimen source and optical/mechanical independent evidence'),
 ('M5','Fit insights + production measurements','Signed landmarks, explanatory heat maps'),
 ('M6','Grading, markers, factory interoperability','Third-party CAD DXF roundtrip and cut-test'),
 ('M7','Signed desktop, QA, scripting, open-source packaging','Clean machine smoke, key control e2e tests'),
 ('M8','Rendering, asset libraries, photography','Color managed look and artifact provenance'),
 ('M9+','Community, tech packs, spatial optional products','Authentication, permissions, immutable approved releases')])+
 paired('Gate transition rule','No issue advances because its file exists or a test passes in only one layer. A gate requires the exact fixture revision, native build hash, automated assertions, adversarial failure test and an inspection report. Each completion ticket must identify a responsible implementation surface and a separate reviewer.')+
 paired('Suggested issue fields','Each ticket: SPEC-ID, feature, source location, acceptance date, current evidence class, blocking prerequisites, exact user workflow, input/output schema, undo state, expected and failure behavior, screenshot/regression path, QA owner and supporting measurement evidence.'),'docs/EXO_MASTER_ROADMAP.md; docs/EXO_VALIDATION_TEST_PLAN.md'))

parts.append(sheet('02','System boundaries and canonical dependency graph','REFERENCE ARCHITECTURE',
 paragraph('Local EXO authoring owns private garment source, edits and physical models. The React/WebKit shell displays 2D/3D state; Rust V2 powers selected live native commands; the C++ CAD library contains a broad but separately verified conversion set; PPF remains a bounded optional solver service. Future community and manufacturer services receive only creator-authorized immutable publish packages, never access to arbitrary local workspace files.')+
 table(['Layer','Owns','Receives','Never assume'],[
 ('UI','tool state, viewport state, temporary selection','stable document snapshots, tool capabilities','UI event alone mutates native model'),
 ('Project document','IDs, units, 2D pieces, seams, fabric, trim, revisions','atomic commands, migration','mesh vertex indexes are durable IDs'),
 ('Geometry/CAD','2D curves, topology, seam pairing, meshing, 2D/3D map','authoring graph','cut boundary is equivalent to stitch edge'),
 ('Physics','material-specific constraints, avatar contact, time trajectories','validated mesh and constitutive calibration','finite run means valid garment fit'),
 ('Visuals','PBR textures, masks, studio lights, still/video renders','UVs, optical material profiles','visual wash changes fabric mechanics'),
 ('Factory','grade, POM/BOM, markers, DXF release bundle','approved document revision','export ZIP passes cutter acceptance'),
 ('Platform','authorized published derivatives, entitlement, proposals','explicit immutable creator release','public preview grants source rights')])+
 paragraph('Recommended data path: user command → precondition and expected revision → document mutation → dependency invalidation → deterministic derived geometry and meshes → selected solver with diagnostics → rendering/inspection → production preflight → authorized immutable export. Persist named transformations, units and hashes at every boundary; record backend identity alongside output.')+
 paragraph('Do not conflate C++ export-count parity or Rust available commands with finished GUI integration. Errors from a stale build directory or broken test selector are evidence about test setup and should be distinguished from numerical test failures.'),'docs/EXO_ARCHITECTURE.md; docs/EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md'))

parts.append(sheet('EVIDENCE-01','Latest known validation gaps and confidence boundaries','INDEPENDENT WORKER AUDIT',
 paragraph('The current 16 October worker audit reviewed active Rust V2 and the separate C++ garment CAD and solver modules. These findings supersede optimistic readings of older parity reports but do not erase previously implemented features. They are source-level evidence and targeted test attempts, not blanket statements about future builds.')+
 table(['Boundary','Source-level evidence','Remaining work'],[
 ('Rust V2 authoring','exo-session.rs has edit, undo/redo, set-property, line-spec, pose/pull/grab, step and save','Unify with canonical geometry/project metadata, native command actions and property persistence tests'),
 ('Fit badge','V2 snapshot explicitly carries fitCertified:false','Only promote per verified trajectory and material/pose fixture'),
 ('C++ conversion','Dated status reports 175 of 182 JS mappings (96.2%) and previous 58/58 parity scripts','Export mappings ≠ working full desktop/CLO product; retest from current clean checkout'),
 ('C++ collision parity','Historical collision deviations around 0.074m tee and 0.055m pants RMS','Fix coupled contact and swept checks before any physically validated fit claim'),
 ('Manufacturing byte agreement','Reported 16/24 tee and 20/24 pants factory ZIP file byte matches','Investigate all divergent metadata and content; independently import exported DXF'),
 ('Qt native UI','Optional Qt shell and CAD core; native Qt simulation action not fully wired','Integrate actual command path, renderer, property controls and signed app testing'),
 ('Fresh native suite','58 tests NOT RUN in attempted existing build cache pointing to retired checkout path','Clean out-of-tree CMake configuration, build and new CTest evidence; NOT RUN is not 58 failed assertions')])+
 paragraph('Source references: native_cpp/CONVERSION_STATUS_2026-10-15.md; integrations/clothcraft/exo-session.rs; native_cpp/core/cloth_collision_step.cpp; native_cpp/desktop; native_cpp/tests. Any numerical value in this page must be tied to its dated fixture rather than generalized to every garment, pose, or backend.')+
 paragraph('A durable program dashboard should attach code revision, hardware, software versions, build flags and fixtures to every result. The same codebase may have a UI capability, an unrelated library function and a separate solver experiment; give each its own verification state.')))

for i,(title,goal,paths,impl,schema,tests,priority) in enumerate(EPICS,1):
    body=paired('Objective / acceptance scope',goal)+paired('Actual source locations',paths)
    body+=paired('Implementation requirements',impl)
    body+=paired('Proposed typed contract',schema)
    body+=paired('Required verification and failure cases',tests)
    body+=table(['Execution','Dependency and integration','Definition of done'],[
      (priority,'Source-model revision guard, source IDs and explicit invalidation of dependent caches','Named QA evidence, reproducible fixture, snapshot, proper error state'),
      ('Integration ownership','Browser/React view, signed Rust V2 action, separate C++/PPF service as applicable','Do not declare implemented until actual active workspace path uses new semantics'),
      ('Rollback and compatibility','Migration route for old native/browser documents, inverse command or snapshot','Save/reopen/undo and alternate-backend non-regression')])
    body+=paragraph('The implementation must not claim commercially certified CLO parity simply because a visual analogue exists. Deliver acceptance evidence with numerical physical units and a human-reviewable before/after record. Persist unsupported reasons until tested rather than mapping a reference toolbar action to an unrelated operation.')
    parts.append(sheet(f'ARCH-{i:03}',title,'SYSTEM WORK PACKAGE',body,paths))

for i,(title,goal,paths,impl) in enumerate(SUPPORT_TOPICS,1):
    body=paired('Functional boundary',goal)+paired('Reference surface',paths)+paired('Implementation detail',impl)
    body+=table(['Work stage','Required output'],[
      ('Model','Typed versioned entities with explicit units, IDs and reference hashes'),
      ('User workflow','Inputs, click/keyboard selection, live response, contextual inspector and cancel path'),
      ('Failure mode','Invalid file, selection, missing capability, concurrency conflict and stale cache'),
      ('Persistence','Undo/redo, save/load/migrate, chosen export and provenance'),
      ('Verification','Positive/negative fixture, UI interaction, machine metrics and reviewer sign-off')])
    body+=paragraph('Design the interaction against the currently connected native operation registry. A presentational equivalent and an operational equivalent require separate status flags and evidence. Record the relevant fixture and exact reproduction command when marking each of the above outputs accepted.')
    parts.append(sheet(f'EXT-{i:03}',title,'DEEP INTEGRATION PACKAGE',body,paths))

def capability_body(item):
    label=item['label'];state=item['mode'];dimension=item['dimension'].upper();column=item['column'];slot=item['position']
    category,model,implementation,test=spec_category(label)
    reason=item.get('reason','')
    action=item.get('nativeAction') or item.get('inspectionAction') or 'not yet routed'
    body=table(['Observed CLO7 slot','Category','EXO Rust V2 status','Current native route'],[(f'{dimension} · {column} · {slot}',category,state.upper(),action)])
    body+=paired('Observed purpose and target user action',f'{label} is a separately named control in the {dimension} reference viewport. Exact interaction contracts, flyout variants and selection preconditions must be confirmed against the saved CLO 7.0.242 reference session. In EXO, selection must resolve to the expected authored object kind for {category.lower()}; an active icon or cursor alone is insufficient.')
    body+=paired('Required native implementation',implementation)
    body+=paired('Data and transaction contract',f'{model}. Use stable object identifiers, physical millimeter/centimeter units where geometry is involved, explicit typed parameters and expectedRevision. The command must return affected IDs, history inverse and which 2D/3D, optical, simulation or manufacturing caches need regeneration. Selection tools may return a typed read-only selection result; they must not report an edit revision unless source data changed.')
    body+=paired('Present evidence / honest capability state',f'Observed registry mode: {state}. {reason} This describes the Rust V2 implementation snapshot, not a guarantee that an analogous browser V1 tool is absent. A complete implementation needs a real native GUI and service exercise and must not inherit success from a placeholder control.')
    body+=paired('Acceptance workflow',test+' Also verify keyboard/flyout focus, tooltip truth, no-op handling, cancellation, deterministic error messages and visible selection feedback at 390px viewport.')
    body+=table(['Scenario','Pass criterion'],[
      ('Nominal','Native tool executes its named action on a valid target; expected geometry/property delta confirmed'),
      ('Undo/reopen','Undo restores full source state; redo and restart reconstruct identical entity IDs and topology'),
      ('Bad selection','No silent wrong-object mutation; clear disabled/error reason; source revision does not change'),
      ('2D ↔ 3D','Changes highlight and transfer to paired source/mesh, or capability accurately marked read-only')])
    return body

for i,item in enumerate(tools,1):
    parts.append(sheet(f'TOOL-{i:03}',item['label'],f"{item['dimension'].upper()} VIEW / COLUMN {item['column']} / {item['mode'].upper()}",capability_body(item),'src/data/clo7ToolbarOrder.js; src/core/clo7NativeToolCapabilities.js'))

fabrows=list(fabrics.items())
assert len(fabrows)==400 and len(tools)==70
for batch in range(40):
    subset=fabrows[batch*10:(batch+1)*10]
    vals=[]
    for fid,record in subset:
        status=record.get('calibration',{}).get('status','estimated / reference') if isinstance(record.get('calibration'),dict) else 'estimated / reference'
        ev=fabrics_evidence.get(fid,{})
        source=ev.get('appearanceEvidence',ev.get('sourceProvider','proxy/procedural'))
        name=record.get('name',fid)
        vals.append([fid,name,str(record.get('gsm','—')),str(round(1000*float(record.get('thickness') or 0),3)),str(record.get('stretchWarp','—')),str(record.get('stretchWeft','—')),str(record.get('bend','—')),str(record.get('friction','—'))])
    body=paragraph(f'The table lists the exact next 10 stable catalog IDs ({batch*10+1}–{batch*10+10} of 400). These are current EXO records and parameter estimates, not 10 independently lab-measured specimen materials. Missing values and source/visual proxy mapping require investigation before any stronger physical or optical quality label is published.')
    body+=table(['ID','Construction / saved display name','GSM','mm','warp','weft','bend','friction'],vals)
    body+=paired('Implementation per row','For each stable ID: preserve loaded project compatibility; attach verified manufacturing composition, construction/weave/knit, unique parent specimen, conditioning history and proposed weight variants. Record machine-tested warp and weft force curves, bias/shear behavior, bending with hysteresis and friction pairs in standard SI units. Convert values through solver-specific constitutive calibration rather than using visual roughness as a stiffness surrogate.')
    body+=paired('Optical/finish requirements','Classify whether the assigned licensed source imagery is construction-exact, related-fabric proxy or fully procedural. Confirm image map checksums, linear vs sRGB channels, real centimeters per repeat, normal direction, mipmaps, face-specific use and grayscale optical wear masks. Maintain an independent, reversible colorway/finish stack for denim, French terry, cotton and other suitable groups.')
    body+=paired('Acceptance gate for these exact records','Check all ten IDs through selection, assignment to panel, material swatch, variant/reopen, native 2D/3D rendering, 1k scan asset loading, texture scale and optical wash undo. Separately compare a physical swatch and calibrated solver output for each promoted specimen. Catalog existence is not material validation.')
    body+=table(['Actual evidence summary for whole catalog','Status'],[
      ('Physically measured EXO catalog entries',str(coverage.get('measuredMechanicalPresets',0))),
      ('Fabric presets with photo source',str(coverage.get('sharedPhotoReferencePresets',0))),
      ('Direct construction photo matches',str(coverage.get('directConstructionVisualMatches',0))),
      ('Related-family source proxies',str(coverage.get('relatedFamilyProxies',0))),
      ('Unmatched/procedural',str(coverage.get('proceduralMaterialPresets',0)))])
    parts.append(sheet(f'FAB-{batch+1:03}',f'Fabric catalog / specimens {batch*10+1:03}–{batch*10+10:03}','400-MATERIAL TRACEABILITY AND FINISH QA',body,'src/data/defaultProject.js; docs/reports/EXO_400_FABRICS_COVERAGE.json'))

parts.append(sheet('QA-01','Execution matrix and hard numerical release gates','VERIFICATION',
 paragraph('A completed feature proves named behavior through more than a compile or screenshot. For every tool: dispatch, preconditions, model mutation, history, reopen, 2D/3D mapping, alternate runtime behavior and negative fixtures. For each fabric: stable ID, swatch, units, optical file hash, solver assignment and actual calibration state. For each manufacturer export: independent CAD consumption and dimensional verification.')+
 table(['Gate','Mandatory evidence','Failure prevents'],[
 ('Source hygiene','Clean source clone, locked dependencies, no private external assets','release build'),
 ('Native bridge','Signed application launch, command response, revision persistence','native-ready toolbar label'),
 ('Geometry','Unit and tolerance report on curved boundaries, darts, seam allowances','CAD-complete claim'),
 ('Solver','Whole-trajectory contact, seam, strain and drift metrics','fit accepted status'),
 ('Materials','Specimen readings, optical map sources, unit mapping','measured/calibrated badge'),
 ('Manufacturing','Third-party DXF roundtrip, factory sample sign-off','factory-approved release'),
 ('Security','Local service scoping, import validation, rights isolation','community publication')])+
 paragraph('When a fixture fails, preserve its revision and numeric maximum error, avoid replacing the baseline screenshot and record the exact test binary paths. Historical 58/58 native CTest claims are not the same as a freshly configured build; reconfigure out of tree where stale CMake caches refer to old checkout paths.'),'docs/EXO_VALIDATION_TEST_PLAN.md; native_cpp/tests'))

parts.append(sheet('QA-02','Official CLO research and compatibility boundaries','REFERENCE INDEX',
 paragraph('The following links are public documented behavior to guide independent EXO workflows. CLO’s current web articles describe multiple newer 2026 features, while the live observed toolbar positions are from a pinned installed 7.0.242 session. Keep these as two separate baseline versions. EXO implementation should use original assets, original code and licensed media.')+
 table(['Resource','Engineering reason'],[(name,why) for name,url,why in REFERENCES])+
 paragraph('Do not infer CLO internal solver constants, unpublished Photoshop-like wash masks, 400 exclusive CLO shipped fabrics, or proprietary project file completeness from these pages. Vendor descriptions show reference user behavior, not an authorization to copy intellectual property.')+
 paragraph('Reference URLs are enumerated in the accompanying Markdown source and HTML. For audit, fetch a dated copy or retain article identification and update dates; mark unconfirmed behavior explicitly. The design goal is comparable usefulness with original EXO implementation.'),'support.clo3d.com; docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md'))

# Selected engineering annexes are sourced verbatim from internal repository docs,
# with explicit dated provenance so historical status is never mistaken as current.
ANNEX_DOCS=[
 'GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md',
 'EXO_MASTER_ROADMAP.md',
 'CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md',
 'CLO3D_PROPERTY_EDITOR_DEEP_AUDIT_20261016.md',
 'CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md',
 'EXO_400_FABRIC_LIBRARY_AND_WASH_SYSTEM.md',
 'FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md',
 'EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md',
 'EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md',
 'EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md',
 'EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md'
]
def md_inline(value):
    """Render safe common Markdown emphasis and links in source annexes."""
    safe=e(value)
    safe=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',lambda m:'<a href="'+e(m.group(2))+'">'+m.group(1)+'</a>',safe)
    safe=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',safe)
    safe=re.sub(r'`([^`]+)`',r'<code>\1</code>',safe)
    return safe

def md_html(md):
    out=[];list_type=None;in_code=False;code_lines=[];table_buf=[]
    def end_list():
        nonlocal list_type
        if list_type:out.append('</'+list_type+'>');list_type=None
    def end_table():
        nonlocal table_buf
        if table_buf:
            header=table_buf[0]
            rows=[line for line in table_buf[1:] if not all(set(c.strip())<=set('-: ') for c in line)]
            out.append(table(header,rows));table_buf=[]
    for raw in md.splitlines():
        s=raw.strip()
        if s.startswith('```'):
            end_table();end_list()
            if in_code:out.append('<pre>'+e('\n'.join(code_lines))+'</pre>');code_lines=[];in_code=False
            else:in_code=True
            continue
        if in_code:code_lines.append(raw);continue
        if s.startswith('|') and s.endswith('|'):
            end_list()
            table_buf.append([x.strip() for x in s.strip('|').split('|')])
            continue
        end_table()
        if not s:end_list();continue
        if s.startswith('#'):
            end_list();lev=min(len(s)-len(s.lstrip('#'))+2,5);out.append(f'<h{lev}>'+md_inline(s.lstrip('#').strip())+f'</h{lev}>');continue
        if re.match(r'^[-*] +',s):
            if list_type!='ul':end_list();out.append('<ul>');list_type='ul'
            out.append('<li>'+md_inline(re.sub(r'^[-*] +','',s))+'</li>');continue
        if re.match(r'^\d+[.)] +',s):
            if list_type!='ol':end_list();out.append('<ol>');list_type='ol'
            out.append('<li>'+md_inline(re.sub(r'^\d+[.)] +','',s))+'</li>');continue
        end_list()
        if s=='---':out.append('<hr>');continue
        out.append('<p>'+md_inline(s)+'</p>')
    end_table();end_list()
    if in_code:out.append('<pre>'+e('\n'.join(code_lines))+'</pre>')
    return ''.join(out)

annex_html=[]
for ix,name in enumerate(ANNEX_DOCS,1):
    f=ROOT/'docs'/name
    if not f.exists():continue
    source=f.read_text(errors='replace')
    annex_html.append(f'<section class="annex"><div class="eyebrow">SOURCE ANNEX {ix:02} · DATED EXISTING RESEARCH</div><h2>{e(name)}</h2><p><strong>Audit interpretation:</strong> This annex preserves earlier engineering research for traceability. Read reported pass counts and statuses as of its original date only. The current 70-slot and 400-fabric inventories above supersede any older source totals.</p>{md_html(source)}</section>')

css="""
@page { size: A4; margin: 14mm 16mm 17mm 16mm; }
* {box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1a2726;font-size:9.1pt;line-height:1.28;margin:0;background:white}
h1,h2,h3,p{margin-top:0}
h2{font-weight:690;font-size:21pt;letter-spacing:-.045em;line-height:1.1;margin-bottom:14px;color:#152b28}
h3{font-size:9.2pt;text-transform:uppercase;letter-spacing:.095em;margin:15px 0 5px;color:#355a4e}
p{margin-bottom:11px}
ul,ol{margin:6px 0 12px 18px;padding:0}li{margin-bottom:5px}
table{border-collapse:collapse;width:100%;table-layout:auto;margin:12px 0 15px;font-size:8pt;line-height:1.22}
th{background:#173c33;color:#fff;padding:7px 8px;text-align:left;font-size:7.6pt;vertical-align:top}
td{padding:6px 8px;border-bottom:1px solid #dbe2dc;vertical-align:top;overflow-wrap:anywhere}
tr:nth-child(even) td{background:#f2f5f0}
pre{font-size:7pt;white-space:pre-wrap;word-break:break-word;padding:11px;background:#e9efeb;border-left:3px solid #72917c}
hr{border:0;border-top:1px solid #ccd8cf;margin:15px 0}
.cover{height:263mm;page-break-after:always;break-after:page;padding:15mm 2mm 8mm;position:relative;background:linear-gradient(115deg,#101d1b,#172f29 66%,#2e4939);color:#f2f4e5}
.cover-kicker{letter-spacing:.23em;font-size:10pt;line-height:1.8;color:#cfdfc5}
.cover-title{font-size:64pt;letter-spacing:-.085em;line-height:.99;font-weight:720;position:absolute;top:75mm;left:6mm}
.cover-subtitle{font-size:14pt;line-height:1.5;position:absolute;bottom:52mm;left:6mm;width:125mm;color:#d9e8d4}
.cover-meta{font-size:8pt;letter-spacing:.13em;position:absolute;bottom:14mm;left:6mm;color:#b8c8b4}
.sheet{page-break-before:always;break-before:page;page-break-inside:auto;position:relative;padding-bottom:1mm}
.fabric-sheet{font-size:8.4pt;line-height:1.2}
.fabric-sheet h2{font-size:17pt;margin-bottom:9px}
.fabric-sheet h3{margin:8px 0 3px;font-size:8.6pt}
.fabric-sheet p{margin-bottom:7px}
.fabric-sheet table{font-size:7.1pt;line-height:1.11;margin:7px 0 8px}
.fabric-sheet th,.fabric-sheet td{padding:4px 5px}
.eyebrow{font-size:8pt;letter-spacing:.19em;font-weight:740;color:#4e6b55;margin-bottom:16px;text-transform:uppercase;display:flex;justify-content:space-between;border-bottom:2px solid #203a33;padding-bottom:9px}
.eyebrow span{font-weight:500;color:#718875}
.sheet-footer{margin-top:18px;padding-top:7px;border-top:1px solid #cddbd1;display:flex;justify-content:space-between;font-size:6.5pt;color:#82948a;overflow-wrap:anywhere}
.sheet-footer span{white-space:nowrap;padding-left:14px}
.toc{page-break-after:always;break-after:page;padding-bottom:8mm}
.toc h2{font-size:18pt;margin-bottom:11px}.toc h3{font-size:10pt}
.toc-grid{columns:2;column-gap:13mm}.toc-entry{font-size:8.1pt;line-height:1.25;margin:0 0 5px;break-inside:avoid}
.toc-entry a{color:#23473d;text-decoration:none}.toc-entry b{font:7.5pt ui-monospace,monospace;margin-right:5px;color:#647d66}
.toc-intro{font-size:9pt;color:#52685c}
.annex{page-break-before:always;break-before:page;padding-bottom:15mm}
.annex h2{font-size:15pt;overflow-wrap:anywhere}.annex h3{font-size:10pt}
.annex p{font-size:8.6pt}.annex table{font-size:7.2pt}
.annex pre{max-height:none;overflow:visible}
@media screen{body{background:#cdd6cf}.cover,.sheet,.annex{background:white;max-width:210mm;margin:12px auto;padding:15mm;box-shadow:0 8px 30px #0002}.cover{background:linear-gradient(115deg,#101d1b,#172f29 66%,#2e4939)}}
"""

toc_entries=[('00','Executive contract and present-state truth'),('01','Dependency-critical implementation order'),('02','System boundaries and canonical dependency graph'),('EVIDENCE-01','Latest known validation gaps and confidence boundaries')]
toc_entries += [(f'ARCH-{i:03}',row[0]) for i,row in enumerate(EPICS,1)]
toc_entries += [(f'EXT-{i:03}',row[0]) for i,row in enumerate(SUPPORT_TOPICS,1)]
toc_entries += [(f'TOOL-{i:03}',row['label']) for i,row in enumerate(tools,1)]
toc_entries += [(f'FAB-{i+1:03}',f'Fabrics {i*10+1:03}–{i*10+10:03}') for i in range(40)]
toc_entries += [('QA-01','Execution matrix and hard numerical release gates'),('QA-02','Official CLO research and compatibility boundaries')]
toc_block='<section class="toc"><div class="eyebrow">DOCUMENT INDEX / '+str(len(toc_entries))+' DETAILED SPECIFICATIONS</div><h2>Engineering contents</h2><p class="toc-intro">Each indexed requirement is independently reviewable. IDs remain stable across regenerated drafts. Reference annexes are explicitly dated research snapshots. Use PDF bookmarks to navigate source annexes and all requirement entries.</p><div class="toc-grid">'+''.join(f'<div class="toc-entry"><a href="#{e(code)}"><b>{e(code)}</b>{e(title)}</a></div>' for code,title in toc_entries)+'</div></section>'
parts.insert(1,toc_block)
html_text='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>EXO Complete CLO-Class Rebuild Engineering Specification</title><style>'+css+'</style></head><body>'+''.join(parts)+''.join(annex_html)+'</body></html>'
html_path=OUT/'EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.html'
html_path.write_text(html_text)

# A concise navigable Markdown companion explicitly indexes the 150+ complete
# specifications and all 400 exact catalog IDs. It is intentionally editable.
md=['# EXO CLO-Class Rebuild — Complete Remaining-Work Master Specification',
    '',f'**Snapshot:** {STAMP}. **Status:** proposed / evidence-linked, not certified CLO parity.',
    f'**Exact inventory:** {len(tools)} live toolbar slots; {len(fabrics)} current fabric records; {len(EPICS)} core system packages; {len(SUPPORT_TOPICS)} integration packages.',
    '', '## Engineering hierarchy',
    'M0 canonical project / typed commands → M1 2D CAD / property tools → M2 sewing and 3D mapping → M3 avatar and simulation → M4 material mechanics/PBR → M5 fit → M6 production → M7 desktop/CI → M8 rendering → M9+ optional platform.',
    '', '## Core system specifications']
for ix,(title,goal,paths,impl,schema,tests,priority) in enumerate(EPICS,1):
    md.extend(['',f'### ARCH-{ix:03}: {title}',f'**Priority:** {priority}. **Evidence:** `{paths}`.',f'**Purpose:** {goal}',f'**Required implementation:** {impl}',f'**Data contract:** {schema}',f'**Release acceptance:** {tests}'])
md.extend(['','## Additional integration work packages'])
for ix,(title,goal,paths,impl) in enumerate(SUPPORT_TOPICS,1):
    md.extend(['',f'### EXT-{ix:03}: {title}',f'**Goal:** {goal}',f'**Evidence:** {paths}',f'**Implementation:** {impl}'])
md.extend(['','## Entire 70-command CLO7 native support matrix'])
for ix,c in enumerate(tools,1):
    typ,model,impl,test=spec_category(c['label'])
    md.extend(['',f"### TOOL-{ix:03}: {c['dimension'].upper()} {c['position']} — {c['label']}",
        f"**Current registry:** {c['mode']}. **Action:** {c.get('nativeAction',c.get('inspectionAction','not implemented'))}.",
        f"**Current evidence:** {c['reason']}",f'**Target model:** {model}. **Implementation:** {impl}',f'**Acceptance:** {test}'])
md.extend(['','## Complete 400-material record and calibration backlog'])
for ix,(fid,record) in enumerate(fabrows,1):
    md.extend(['',f"### FAB-{ix:03}: {record.get('name',fid)} (`{fid}`)",
        f"Nominal currently stored: **{record.get('gsm')} GSM**; thickness **{round(float(record.get('thickness') or 0)*1000,3)} mm**; warp/weft stretch **{record.get('stretchWarp')}/{record.get('stretchWeft')}**; bend **{record.get('bend')}**; friction **{record.get('friction')}**.",
        "Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed."])
md.extend(['','## Official references'])
for title,url,reason in REFERENCES:md.extend(['',f'- {title}: {url} — {reason}'])
md.extend(['','## Dated source research annexes'])
for name in ANNEX_DOCS:md.append(f'- docs/{name}')
md_path=OUT/'EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.md'
md_path.write_text('\n'.join(md)+'\n')
summary={'date':STAMP,'toolbar':len(tools),'native':sum(c['mode']=='native' for c in tools),'inspect':sum(c['mode']=='inspect' for c in tools),'unavailable':sum(c['mode']=='unavailable' for c in tools),'fabrics':len(fabrics),'epics':len(EPICS),'integrations':len(SUPPORT_TOPICS),'annexes':len(ANNEX_DOCS),'specifications':toc_entries,'htmlBytes':html_path.stat().st_size,'markdownBytes':md_path.stat().st_size,'sourceEvidence':PRIMARY_DOCS,'officialReferenceURLs':[url for _,url,_ in REFERENCES]}
(OUT/'manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
