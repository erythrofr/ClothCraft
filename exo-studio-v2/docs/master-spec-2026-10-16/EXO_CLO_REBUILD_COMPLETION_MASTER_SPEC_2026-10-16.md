# EXO CLO-Class Rebuild — Complete Remaining-Work Master Specification

**Snapshot:** 2026-10-16. **Status:** proposed / evidence-linked, not certified CLO parity.
**Exact inventory:** 70 live toolbar slots; 400 current fabric records; 45 core system packages; 15 integration packages.

## Engineering hierarchy
M0 canonical project / typed commands → M1 2D CAD / property tools → M2 sewing and 3D mapping → M3 avatar and simulation → M4 material mechanics/PBR → M5 fit → M6 production → M7 desktop/CI → M8 rendering → M9+ optional platform.

## Core system specifications

### ARCH-001: Canonical garment document
**Priority:** M0/P0. **Evidence:** `src/core/project.js; src/core/backends/protocol.js; native_cpp/core/garment_document.hpp`.
**Purpose:** Single revisioned source of truth for 2D pattern, 3D arrangement, seam graph, fabric assignments, avatar pose and exports
**Required implementation:** Define versioned Project/Pattern/Edge/Curve/Seam/Fabric/Avatar/Trim/Manufacturing models; immutable IDs; unit scale; coordinate frames; provenance; explicit migrations. Convert native Rust session snapshots and C++ document snapshots through a schema-preserving boundary.
**Data contract:** ProjectRevision{id,revision,parents,units,hash,entities,invalidations}; no data-derived element ID may silently shift on edit.
**Release acceptance:** Save/edit/undo/reopen/re-export consistency on tee, pants and jacket; reject stale revision and dangling foreign key without modifying disk

### ARCH-002: Typed command engine and undo
**Priority:** M0/P0. **Evidence:** `src/core/workspaceCommandIndex.js; src/core/cloPropertyCommands.js; integrations/clothcraft/exo-session.rs`.
**Purpose:** Make every toolbar action a deterministic, testable edit with proper cancellation and history
**Required implementation:** Register typed operations with target preconditions, dry-run diff, effect scopes, inverse snapshot and atomic commit. Choose one transaction owner per change and map browser/native bindings to same command semantics.
**Data contract:** CommandEnvelope{commandId,targetIds,params,expectedRevision,selection,units}; CommandResult{revision,createdIds,changedIds,invalidated,errors}.
**Release acceptance:** Bad inputs leave project byte-identical; grouped drag is one history step; undo/redo survives native restart and invalidates dependent projections

### ARCH-003: 2D planar geometry kernel
**Priority:** M1/P0. **Evidence:** `src/core/draftingPrecision.js; src/core/draftingTopology.js; native_cpp/core/drafting_precision.cpp`.
**Purpose:** Exact point, curve, segment and topology operations without pixel-space drift
**Required implementation:** Use stable edge-segment IDs and declared units. Evaluate Bézier derivatives and arc length; robust intersection predicates; exact decimal input; split/reparameterize edges while preserving attachment parameters.
**Data contract:** CurveEdge{id,from,to,kind,controls,orientation,arcLengthTolerance}; tolerance policy defines mm to internal coordinate conversion.
**Release acceptance:** Golden analytic geometry fixtures at many zoom/DPR levels; no inverted winding or dangling notch after split; no self intersection accepted silently

### ARCH-004: 2D drawing and selection
**Priority:** M1/P0. **Evidence:** `src/components/PatternEditor.jsx; src/core/draftingSnapping.js`.
**Purpose:** Selection, lasso, snap, node edits, keyboard precision and viewport state
**Required implementation:** Specify pointer hit-test order, snapping priorities, selection cycling, drag preview commit, keyboard nudges, multi-select and focused command routing. Keep screen transforms separate from physical points.
**Data contract:** SelectionState{kind,ids,active,mode}; DragPreview{baseRevision,proposedGeometry,precisionMm}.
**Release acceptance:** Pointer and keyboard produce equivalent geometry; viewport zoom does not alter final cm measurements

### ARCH-005: 2D drafting constructions
**Priority:** M1/P0. **Evidence:** `src/core/draftingConstructions.js; src/core/draftingUnfold.js; native_cpp/core/drafting_constructions.cpp`.
**Purpose:** Native darts, slash/spread, pleat, fullness, mirror, unfold and linked pieces
**Required implementation:** Model fold/dart legs, apex, take-up and dependent constraints. Use constructive graph nodes whose control points remain editable; reconstruct boundary stitching, cut offsets and annotations after each operation.
**Data contract:** Construction{id,type,parentPiece,anchors,parameters,dependentEdges,revision}.
**Release acceptance:** Known dart intake and fold tests, mirrored tangent continuity and seam lengths preserved under undo/export/import

### ARCH-006: Notches and seam allowance CAD
**Priority:** M1/P0. **Evidence:** `src/core/draftingPrecision.js; src/core/productionPreflight.js`.
**Purpose:** Cut-line offsets, variable width, corners, notches and seam line differentiation
**Required implementation:** Compute offset curves with robust join semantics, corner trimming and collision checks. Distinguish stitch line, cut line, turn/fold line and metadata references. Annotate cut marks with consistent scale.
**Data contract:** Allowance{edgeId,widthMm,cornerPolicy,lockMode}; Notch{edgeId,t,depthMm,style,gradeMode}.
**Release acceptance:** 1:1 paper plot measurements and independently checked DXF layer output; no allowance becomes a sewing edge by accident

### ARCH-007: Linked 2D to 3D correspondence
**Priority:** M2/P0. **Evidence:** `src/core/clothMeshing.js; src/core/liveDrapeTransfer.js; native_cpp/core/pattern_mesh.cpp`.
**Purpose:** Lossless mapping of every authored piece and semantic line to render/solve mesh
**Required implementation:** Maintain source vertex and edge-param lineage during triangulation and remeshing; define index stable until invalidated. Propagate UVs, grainline, material IDs and seam constraints.
**Data contract:** MeshMapping{pieceId,meshVersion,vertexSources,edgeRanges,triangleSources,uvFrame}.
**Release acceptance:** Highlighting a source line finds correct 3D surface after subdivision; editing point invalidates only dependent solve caches

### ARCH-008: Sewing graph and partial seams
**Priority:** M2/P0. **Evidence:** `src/core/sewingConstruction.js; src/core/backends/seamAssembly.js; native_cpp/core/native_seam_assembly.cpp`.
**Purpose:** Segment/free sewing, orientation, lengths, easing, seam types and topology diagnostics
**Required implementation:** Treat seam as a pair of oriented parameter intervals on persistent boundary edges. Build stitch samples by arc-length correspondence, reconcile different discretizations and detect gaps or duplicates.
**Data contract:** Seam{id,left:{edge,t0,t1},right:{edge,t0,t1},direction,ease,stitch,allowance}.
**Release acceptance:** Full/partial seam fixtures, reverse-edge direction, oversized ease ratio rejection, seam walk report and undo/redo reopening

### ARCH-009: Complex construction and hardware
**Priority:** M2/P1. **Evidence:** `src/core/trims.js; src/core/sewingConstruction.js; native_cpp/core/cloth_seam_constraints.cpp`.
**Purpose:** Zippers, buttons, buttonholes, binding, piping, trims, quilting, lining and multi-layer assembly
**Required implementation:** Store separately authored trim geometry and pattern-space attachment constraints. Separate visual paths from physical/production semantics. Add collision proxies only after robust primitive support.
**Data contract:** TrimInstance{id,type,material,anchors,fastenerState,geometryVersion,manufacturingCode}.
**Release acceptance:** A jacket zipper closes/reopens with no orphan edges; hardware BOM is traceable to rendered attachment and version

### ARCH-010: 3D garment editing tools
**Priority:** M2/P0. **Evidence:** `src/core/meshSelection.js; src/components/GarmentViewport.jsx`.
**Purpose:** Mesh selection, stylelines, pins, transforms and surface-bound strokes
**Required implementation:** Add area/brush/lasso selection on triangle IDs with source map, editable styleline contours and persistent projected control points. Preserve source panel ownership after remesh.
**Data contract:** SurfaceStroke{id,meshRevision,barycentricAnchors,parentPieceIds,projectionTolerance}.
**Release acceptance:** Click/drag modifies correct authored entity, undo/redo, 3D→2D continuity and reopen; unsupported tools remain labelled

### ARCH-011: Avatar geometry and measurement
**Priority:** M3/P1. **Evidence:** `src/core/meshAvatarContact.js; public/avatars; blender_bridge`.
**Purpose:** Body collision mesh, pose rig, standardized landmarks, shape and anthropometric control
**Required implementation:** Record avatar license, units, rig hierarchy, landmark definitions, skinning and signed mesh normals. Validate open scans, custom morphology, poses and robust collision proxy generation.
**Data contract:** Avatar{id,meshHash,unit,rig,bonePoses,measurements,landmarks,collisionProxyVersion}.
**Release acceptance:** Independent tape measurement within tolerance, neutral/arms-up poses, malformed scan rejection, accurate visual and collision alignment

### ARCH-012: Animation timeline
**Priority:** M3/P2. **Evidence:** `src/components/GarmentViewport.jsx; src/core/physics/timestep.js`.
**Purpose:** Pose, clip, keyframe editing and motion-driven drape
**Required implementation:** Build typed animation tracks for avatar bones, camera and garment states, keyframe interpolation, timeline editing, scrub/cancel, cache invalidation and export.
**Data contract:** AnimationTrack{targetId,property,keyframes,interp}; MotionSample{time,poseHash}.
**Release acceptance:** Repeatable pose reconstruction and defined contact checks between frames; time scrubs do not corrupt source geometry

### ARCH-013: Interactive VBD and XPBD preview
**Priority:** M3/P0. **Evidence:** `integrations/clothcraft/exo-session.rs; native_backend/server.mjs; src/core/physics.js`.
**Purpose:** Fast cloth response with explicit accuracy tier and selectable backend
**Required implementation:** Specify substep/unit conventions and initial assembly, anisotropic stretch/shear/bend/damping, panel pins and restart. Draw boundaries among Rust VBD, browser PBD and C++ XPBD; report runtime and constraints.
**Data contract:** SimulationRequest{documentRevision,backend,materials,avatar,config,seed}; Frame{positions,velocities,diagnostics}.
**Release acceptance:** Tee/pants/jacket quality curves, finite values, reproducibility, controlled pause/reset and recorded unsupported contact conditions

### ARCH-014: PPF contact batch acceptance
**Priority:** M3/P0. **Evidence:** `ppf_backend/server.mjs; ppf_backend/fitAcceptance.mjs; ppf_backend/assemblyAcceptance.mjs`.
**Purpose:** Full-frame and swept-contact validation rather than solver-completed status
**Required implementation:** Solve with initialized seam graph and validated boundaries; run cloth/body and cloth/cloth swept intersection analysis, seam-gap metrics, friction, strain and temporal jitter reports.
**Data contract:** AcceptanceReport{fixture,solverHash,frames,maxPenetrationMm,sweptHits,seamGapMm,strain,passed,failures}.
**Release acceptance:** Known failing tee/arm motion must be rejected; acceptance only when independent metrics meet stated fixture thresholds

### ARCH-015: Simulation numerical reliability
**Priority:** M3/P0. **Evidence:** `native_cpp/core/cloth_collision_step.cpp; src/core/physics/qualityGate.js`.
**Purpose:** Collision tolerances, convergence, diagnostics and safe restart
**Required implementation:** Test stretch/shear energy, non-inverted triangles, mass conservation, energy drift, self-contact and avatar-contact residuals under variable timestep and remeshing.
**Data contract:** SolverDiagnostics{iteration,energy,residual,contactCount,violations,stable,runId}.
**Release acceptance:** NaN, teleport, tunneling, seam bursting and stale frame tests; bounded cancellation; reproducible seed and environment

### ARCH-016: Physical fabric model
**Priority:** M4/P0. **Evidence:** `src/core/fabricCalibration.js; src/core/fabricEvidenceCalibration.js; src/core/clothcraftFabrics.js`.
**Purpose:** Traceable anisotropic sheet mechanics separate from optics
**Required implementation:** Use GSM, pressure-qualified thickness, directional force-extension curves, shear, bending hysteresis, friction pair and damping. Map measurements to each solver explicitly with uncertainty and benchmark fits.
**Data contract:** PhysicalFabricSpec{specimenId,conditioning,tests,SI,uncertainty,calibration,solverMappings}.
**Release acceptance:** Real swatch and solver model measured against drape/force data; show estimated flag without calibration; 400-count not certification

### ARCH-017: Physical fabric acquisition
**Priority:** M4/P0. **Evidence:** `docs/FABRIC_MEASUREMENT_INGESTION.md; src/core/fabricEvidenceCalibration.js`.
**Purpose:** Lab specimen intake, unit normalization, calibration and provenance
**Required implementation:** Define machine calibration, specimen orientation, conditioning, repeat runs and raw curve storage; automate outlier/units checks and fit report. Keep unverifiable claims explicitly unverified.
**Data contract:** FabricTest{sampleId,instrument,method,orientation,replicate,rawSeries,operator,environment}.
**Release acceptance:** Reject inconsistent load units, missing repeats and bad sampling; independent examiner can reproduce one fitted stretch response

### ARCH-018: PBR textile optical pipeline
**Priority:** M4/P1. **Evidence:** `src/core/textileProcedurals.js; src/core/fabricPbrGenerator.js; src/core/fabricSurfaceModel.js`.
**Purpose:** Measured/estimated PBR maps, yarn-scale repeat, panel UVs and color management
**Required implementation:** Separate source albedo, normal, roughness, opacity, height, metallic, sheen, weave anisotropy and color-space tagging. Follow grainline in 2D UVs and preserve map provenance/hashes.
**Data contract:** VisualFabricProfile{id,textureSets,licenses,texelScaleCm,normalConvention,uvRotation,renderTransform}.
**Release acceptance:** Neutral-light swatch + oblique-light comparisons, no flipped normals, consistent repeat size across garment sizes

### ARCH-019: 400 fabric catalog engineering
**Priority:** M4/P1. **Evidence:** `src/data/fabricCatalog400.js; src/data/defaultProject.js; docs/reports/EXO_400_FABRICS_COVERAGE.json`.
**Purpose:** Preserve all 400 stable IDs, add specimen fidelity, swatch and construction truth
**Required implementation:** Audit every current estimate and unique scan assignment, create priorities by cotton/French terry/denim/wool/knit/leather/nylon, measure high-volume archetypes, then populate calibrated variants only when tested.
**Data contract:** FabricCatalogEntry{id,parentConstructionId,appearanceVariant,evidenceLevel,specimenId,license,QA}.
**Release acceptance:** 400 stable entries selectable and saved; separate coverage measures for 400 parameter presets, 44 used image sources and 0 measured mechanics

### ARCH-020: Fabric optical finishes and washes
**Priority:** M4/P1. **Evidence:** `src/core/clothWashProcedurals.js; src/core/clothWashImage.js`.
**Purpose:** Non-destructive denim/garment washing, distress, colorway layers and masks
**Required implementation:** Create versioned finish stack with seeded masks, material-aware choices, physical-scale edge distances, seam masks, layered roughness effects and source-preserving compositing.
**Data contract:** FinishLayer{kind,strength,seed,blend,uvTransform,seamWear,masks,sourceHash}.
**Release acceptance:** Undo/reopen deterministic colorways; mask aligned after grading; textile physics does not change for optical wash

### ARCH-021: Fabric browser and property editing
**Priority:** M4/P1. **Evidence:** `src/components/ClothCraftFabricLibrary.jsx; src/components/CloPropertyEditorAccordion.jsx; src/core/cloPropertyCommands.js`.
**Purpose:** Context-sensitive metadata, measured status, face materials and revisioned edits
**Required implementation:** Add editable Name/Item No./Construction/Supplier/Owner with revision validation, front/back/side appearance fields, physical properties, texture transforms, assignment and bulk edits.
**Data contract:** PropertyMutation{entityId,field,value,expectedRevision}; field registry defines type/units/read-only rules.
**Release acceptance:** Selected fabric edits appear instantly, persist after native restart and never silently edit the selected panel

### ARCH-022: Avatar/garment fit interpretation
**Priority:** M5/P1. **Evidence:** `src/core/meshAvatarContact.js; docs/PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md`.
**Purpose:** Clearance maps, strain maps, body measure POM, comfort limitations
**Required implementation:** Compute fit visualizations from tested geometry and solver diagnostics. Distinguish contact, high tensile strain, pressure proxy, nonconvergence and actual physical comfort.
**Data contract:** FitLayer{metric,units,min,max,confidence,fixtureId,sourceRevision}.
**Release acceptance:** Known 2mm penetration appears as failure; legend and dataset distinguish measured and estimated metrics

### ARCH-023: POM and measurement tools
**Priority:** M5/P1. **Evidence:** `src/core/measurements.js; src/core/clothcraftSelectionMetrics.js`.
**Purpose:** Permanent dimension anchors, garment points of measure, grading and report tables
**Required implementation:** Create authored POM paths anchored to pattern topology/2D/3D body landmarks; store measurement type, protocol, tolerance, placement and sizes.
**Data contract:** POM{id,measureKind,anchors,method,units,tolerance,sizeValues,revision}.
**Release acceptance:** POM persists/grades; edit a pattern then recalculate; temporary native tape not mistaken for saved POM

### ARCH-024: Grading and multi-size
**Priority:** M6/P1. **Evidence:** `src/core/grading.js; native_cpp/core/grading.cpp`.
**Purpose:** Point grade rules, size tables, curve propagation and notch/graphic sizes
**Required implementation:** Model base-size control points with per-size deltas; interpolate graded curves, sew compatibility and item IDs; import/export AAMA/ASTM rules.
**Data contract:** GradeRule{pointId,sizeGroup,baseSize,deltaBySize,notchBehavior}.
**Release acceptance:** Measurements for XS–XXL independently checked; seam match after grading; roundtrip through external CAD

### ARCH-025: DXF and industrial CAD interchange
**Priority:** M6/P0. **Evidence:** `src/core/dxf.js; native_cpp/core/dxf_import.cpp; native_cpp/core/dxf_export.cpp`.
**Purpose:** Bidirectional AAMA/ASTM/standard DXF with units, layers, curve and notch fidelity
**Required implementation:** Explicitly map polylines/curves, grainlines, cut/stitch lines, notches, seam allowances, grade layers, units and import warnings.
**Data contract:** ImportReport{sourceFileHash,format,unitScale,mappedEntities,losses,warnings}.
**Release acceptance:** External CAD roundtrips + measured millimeter tolerances on test tee and trouser markers

### ARCH-026: Markers and cutting layout
**Priority:** M6/P1. **Evidence:** `src/core/marker.js; native_cpp/core/marker_layout.cpp`.
**Purpose:** Fabric-width, nap, print direction, grain, multi-size nesting and yardage
**Required implementation:** Represent constrained polygon packing, repeated patterns, seam allowances, shrink, fabric flaws, stripes/plaids and lay plans with independently measured efficiency.
**Data contract:** MarkerJob{rollWidth,repeat,grainTolerance,nap,patternVersions,quantity}; MarkerReport{placements,utilization,violations}.
**Release acceptance:** Verify no overlaps, actual length on plotted layout, stripe alignment and factory-signed sample marker

### ARCH-027: Factory BOM and cost
**Priority:** M6/P1. **Evidence:** `src/core/factoryPackage.js; src/core/bomXml.js; native_cpp/core/bom_export.cpp`.
**Purpose:** Traceable fabrics, hardware, seams, shrink allowances, suppliers, consumption and costing
**Required implementation:** Build line items from authored assignments and actual marker usage; retain vendor costs private; track alternates, unit conversions, minimum order and revision history.
**Data contract:** BOMLine{itemId,type,supplier,sku,qty,unit,usageBasis,sourceRevision}.
**Release acceptance:** Per-size usage reconciles with marker; 3D hardware count equals BOM; private prices excluded from public previews

### ARCH-028: Technical pack production
**Priority:** M6/P1. **Evidence:** `src/core/factoryPackage.js; docs/EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md`.
**Purpose:** Editable and immutable approved releases of POM, BOM, 2D, images and notes
**Required implementation:** Define source-linked tables, component callouts, sewing illustrations, grade measurements, tolerance sign-off, sample rounds and export manifest with reviewer approvals.
**Data contract:** TechPackRelease{id,sourceHash,sections,approvals,assets,visibility,signature}.
**Release acceptance:** Factory receives complete selected release, revisions compare field by field; prior approved release cannot be silently overwritten

### ARCH-029: Project save, migration and recovery
**Priority:** M0/P0. **Evidence:** `src/core/project.js; integrations/clothcraft/exo-session.rs`.
**Purpose:** Transactional atomic persistence, autosave and damaged-file recovery
**Required implementation:** Use complete version headers, checked sums, forward-only migration, atomic temp/rename and off-site optional backup. Keep project source separate from generated caches.
**Data contract:** ProjectFile{schemaVersion,sourceRevision,authoringGraph,resourceManifest,historyWatermark}.
**Release acceptance:** Crash during save cannot corrupt last good revision; 1-year-old fixture migrates with no loss of topology

### ARCH-030: Desktop app shell and Qt strategy
**Priority:** M7/P0. **Evidence:** `integrations/clothcraft/macos; native_app; native_cpp/desktop`.
**Purpose:** Consolidate signed macOS WebKit/Rust and native C++ Qt without dual sources of truth
**Required implementation:** Select one supported desktop product path per release; secure localhost RPC, lifecycle/IPC, signed sandbox, file dialogs, native accessibility, workspace state and crash logs.
**Data contract:** DesktopCapability{runtime,buildHash,supportedTools,backendEndpoints,securityScope}.
**Release acceptance:** Installed signed app is tested on clean machine; no browser-only toolbar mistaken for native implementation

### ARCH-031: Typed automation and scripting
**Priority:** M7/P1. **Evidence:** `docs/EXO_V2_AGENT_API_FOUNDATION.md; src/core/workspaceCommandIndex.js`.
**Purpose:** Stable operation coverage for human and AI tools
**Required implementation:** Generate tool registry from exact command schemas; strict read/write scopes, previews, revision guards, atomic multi-step transaction, deterministic replay and logs.
**Data contract:** AgentOperation{command,targets,params,expectedRevision,allowSideEffects,previewOnly}.
**Release acceptance:** Agent creates tee seam, edits fabric, exports on test fixture while all actions remain reversible

### ARCH-032: Rendering and visual studio
**Priority:** M8/P2. **Evidence:** `src/components/GarmentViewport.jsx; docs/EXO_UI_RENDERING_AND_AVATARS.md`.
**Purpose:** Film-grade textile optics, neutral reference lighting, still/movie output
**Required implementation:** Design physically plausible light presets, studio HDRI licenses, camera composition, tone maps, microtexture LOD, output color profiles and queued exports.
**Data contract:** RenderJob{sceneHash,materialHashes,camera,lights,resolution,colorSpace,output}.
**Release acceptance:** Repeat captures compare visual refs under neutral light; no proprietary third-party HDRI bundled without license

### ARCH-033: Asset library and local ownership
**Priority:** M8/P2. **Evidence:** `docs/EXO_DATA_MODEL.md; public/avatars; docs/EXO_FABRIC_MATERIALS_AND_TRIMS.md`.
**Purpose:** Searchable editable library of patterns, garments, avatars, fabrics, trims and studios
**Required implementation:** Implement content-addressed assets, preview indexes, local folders and reversible relinking, tags, duplicate detection, license metadata, offline access.
**Data contract:** LibraryAsset{id,type,contentHash,sourceUri,license,dependencies,previewHashes}.
**Release acceptance:** Renaming a folder and reopening an outfit rebinds by hash without losing authored fabric IDs

### ARCH-034: Open-source packaging and CI
**Priority:** M7/P0. **Evidence:** `package.json; .github/workflows; docs/LICENSING.md`.
**Purpose:** Portable builds, dependency licenses, reproducible assets and support policy
**Required implementation:** Pin native toolchains, generate SBOM, static checks, test fixtures, binary signing/notarization, contributor templates and regression dashboards.
**Data contract:** ReleaseManifest{commit,buildEnv,licenseInventory,testResults,knownGaps,packageHashes}.
**Release acceptance:** Clean machine install/build passes supported command set; distributed binary dependencies and licenses match manifest

### ARCH-035: Community and pattern marketplace
**Priority:** M9/P2. **Evidence:** `docs/EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md`.
**Purpose:** Independent future service with creator profiles, assets, rights and pricing
**Required implementation:** Do not expose local source by default. Implement authorized publish previews, versioned entitlement, sanctioned remixes, refund and moderation events with no private CAD leakage.
**Data contract:** PublishedAsset{id,version,license,rights,publicDerivatives,privateSourceRef}.
**Release acceptance:** An anonymous follower cannot fetch editable source; a purchased entitlement receives only licensed immutable revision

### ARCH-036: Interactive web tech packs
**Priority:** M9/P2. **Evidence:** `docs/EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md`.
**Purpose:** Team collaboration, comments, proposals, immutable manufacturer release
**Required implementation:** Design separate tenancy, section-based ACL, comment anchors on stable CAD IDs, proposal merges with revision preconditions, factory acknowledgments and diff receipts.
**Data contract:** Proposal{id,baseRevision,patch,author,reviewStatus}; Approval{releaseHash,role,time}.
**Release acceptance:** Factory B cannot read Factory A quote; approved R01 stays downloadable after new R02 proposal

### ARCH-037: Spatial showroom and projection
**Priority:** M10/P3. **Evidence:** `docs/EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md`.
**Purpose:** Optional walking wardrobe, projection staging, AR and video production
**Required implementation:** Prototype after CAD reliability; isolate projectable display meshes and 3D room masters, maintain stable looks and explicit asset rights. Avoid requiring PPF on web page load.
**Data contract:** Look{id,garmentRevision,avatarPose,studio,lights,cameras,derivativeManifest}.
**Release acceptance:** Walkable 10-outfit scene runs on target hardware and never requests private unpublished geometry

### ARCH-038: Security/privacy and permissions
**Priority:** M0/P0. **Evidence:** `integrations/clothcraft/server.mjs; docs/EXO_RELEASE_STATUS.md`.
**Purpose:** Project privacy, import sandboxing, safe local bridge and public publishing
**Required implementation:** Bind local services to loopback, validate origins/input size, guard destructive mutations by version; block path traversal, zip bombs, malformed GLB/DXF and untrusted texture payloads.
**Data contract:** CapabilityGrant{principal,scope,resource,operation,expiry}; SecurityEvent{id,reason,source}.
**Release acceptance:** Untrusted project import is quarantined, no extra disk paths are readable, serialized source is never leaked to previews

### ARCH-039: Performance budgets and telemetry
**Priority:** M7/P1. **Evidence:** `src/components/GarmentViewport.jsx; src/core/backends/registry.js`.
**Purpose:** Large pattern sets, 400 catalog, textures, simulation, import and signed app responsiveness
**Required implementation:** Define workload fixtures per device, memory/latency budgets, shader/texture loading and worker cancellation. Cache by exact revision and avoid nested full rebuild on visual-only edit.
**Data contract:** PerfTrace{operation,fixture,cpuMs,gpuMs,memoryPeak,outputBytes,revision}.
**Release acceptance:** Measure 100-piece scene interactions and worst-case 400 swatch browsing without UI deadlock or stale state

### ARCH-040: Accessibility and localization
**Priority:** M7/P1. **Evidence:** `src/components/CloUI.jsx; src/components/RightToolPalette.jsx`.
**Purpose:** Keyboard complete editing, focus rules, units and descriptive commands
**Required implementation:** Specify accessible role/description of controls, hover+keyboard parity, radial tool groups, screen-reader property labels and regional numeric/unit conversion.
**Data contract:** UserPreferences{unitSystem,locale,shortcutMap,workspaceLayout}; UICommand{ariaLabel,shortcut,disableReason}.
**Release acceptance:** Every toolbar button has exact accessible name, keyboard path, valid focus and meaningful disabled explanation

### ARCH-041: Tool-bar and property parity reference
**Priority:** M1/P0. **Evidence:** `src/data/clo7ToolbarOrder.js; src/core/clo7NativeToolCapabilities.js`.
**Purpose:** 70 verified CLO 7 toolbar positions as reference; precise supported/inspect/disabled EXO states
**Required implementation:** Preserve observed order separately for 3D and 2D independent A/B columns, live semantics, context switches, icons and flyouts. Implement actual Rust commands before updating capability registry.
**Data contract:** ToolCapability{id,dimension,column,position,mode,nativeAction,reason,testEvidence}.
**Release acceptance:** 70/70 controls visible in documented order; 11 native / 9 inspect / 50 unavailable treated as present snapshot, never all functional

### ARCH-042: Context-aware Property Editor
**Priority:** M1/P0. **Evidence:** `src/components/CloPropertyEditorAccordion.jsx; src/components/CloObjectPropertyFields.jsx`.
**Purpose:** Pattern/fabric/seam/avatar/trim selection and editable sections with validation
**Required implementation:** Normalize selection context and field registry. Each field has type, range, units, disable reason, localization, dependency invalidations and conflict messaging.
**Data contract:** PropertyDescriptor{entityKinds,key,type,units,min,max,nullable,editable,backendCapability}.
**Release acceptance:** Selecting a fabric exposes Fabric1 metadata/PBR; selecting a pattern exposes construction/particle distance without cross-writing

### ARCH-043: Material calibration regression
**Priority:** M4/P0. **Evidence:** `docs/FABRIC_MEASUREMENT_INGESTION.md; src/core/fabricCalibration.js`.
**Purpose:** Cross-solver physical mapping, optical maps and objective lab-data acceptance
**Required implementation:** Create calibrated material cards with instrument source, unit normalization, error bars, differential patch tests, numerical integration and hold-out material tests.
**Data contract:** CalibrationReport{specimenId,solverBuild,parameterMapping,errors,heldOutCurves,approvedBy}.
**Release acceptance:** Exactly zero measured presets until reviewed dataset; every promoted measured state links raw series and reproducible fitting script

### ARCH-044: Cross-backend numerical parity
**Priority:** M0/P0. **Evidence:** `native_cpp/CONVERSION_STATUS_2026-10-15.md; docs/CLOTHCRAFT_CPP_RUST_INTEROP_2026-10-15.md`.
**Purpose:** JS, C++ and Rust share semantics without conflating matching with physical accuracy
**Required implementation:** Compare data model/operation outputs by type: geometry in mm, solver samples in SI, frame arrays, UV and factory payloads. Keep solver maturity separate from exact JS parity.
**Data contract:** ParityResult{fixture,engines,version,field,expected,actual,tolerance,difference,classification}.
**Release acceptance:** Replicate 58 tests from clean native build; reject >tolerance collision or style metadata drift, with machine-recorded reports

### ARCH-045: Engineering release gating
**Priority:** M0/P0. **Evidence:** `docs/EXO_VALIDATION_TEST_PLAN.md; docs/EXO_MILESTONE_ISSUE_BOARD.md`.
**Purpose:** Evidence-weighted readiness by workflow, never decorative percentage complete
**Required implementation:** Every issue has traceable fixture, failure record, explicit acceptance, code owner, dependency, risk and command. Require independent visual and numerical regression.
**Data contract:** ReleaseGate{id,feature,owner,fixture,evidence,passed,blockers,risk,reviewedAt}.
**Release acceptance:** No factory-ready/fit-certified claim without external reviews; warn on unverified native controls and PPF crossings

## Additional integration work packages

### EXT-001: Interchange format matrix
**Goal:** DXF AAMA/ASTM, SVG, OBJ, GLB, FBX, USD, ZPRJ/ZFAB import/export intent and unsupported boundaries
**Evidence:** src/core/dxf.js; integrations/clo_sdk/audit_zprj.py
**Implementation:** Per-format semantic matrix of geometry, sizes, materials, seams, animations, textures, versioning and license; import warnings rather than silent loss.

### EXT-002: Regression fixture repository
**Goal:** Reference garments across multiple body shapes and garments
**Evidence:** docs/EXO_VALIDATION_TEST_PLAN.md; native_cpp/tests
**Implementation:** Fixtures for sleeveless tee, raglan hoodie, 5-pocket jeans, structured jacket and layered garments in smallest and largest supported sizes.

### EXT-003: Cloth solver benchmark protocol
**Goal:** Timed, seeded and measured acceptances across device classes
**Evidence:** src/core/physics/qualityGate.js; ppf_backend/fitAcceptance.mjs
**Implementation:** Pin timestep and tolerances and report absolute seam gaps, body penetration, triangle inversion, strain, collision and normal tangency.

### EXT-004: Deployment update architecture
**Goal:** Signed macOS bundle, upgrades, rollback and notarization
**Evidence:** integrations/clothcraft/macos; native_app
**Implementation:** Versioned signed app and native service builds; checksum install and reversible migration; protect project documents from forced overwrite.

### EXT-005: Typography and design quality
**Goal:** Consistent editor layout, docking, icons, scale and workflows
**Evidence:** docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md; src/clo-interface.css
**Implementation:** Design-system tokens with per-platform high DPI, accessible commands and standard interaction rules; audit real app screenshots.

### EXT-006: Manufacturing traceability
**Goal:** Cutter-ready package provenance and release instructions
**Evidence:** docs/EXO_PRODUCTION_PIPELINE.md; src/core/factoryPackage.js
**Implementation:** Every exported drawing, POM, BOM and marker points back to an immutable garment revision and measured shrinkage/width data.

### EXT-007: Fabric inspection laboratory
**Goal:** Light booth view and transparent physical/visual evidence
**Evidence:** docs/FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md
**Implementation:** Enforce standardized lighting/color targets and physical swatch sample card, calibrated repeat scale and known instrument readings.

### EXT-008: Finish masking studio
**Goal:** Sew and fold aware fade/abrasion authoring
**Evidence:** src/core/clothWashProcedurals.js; src/core/clothWashImage.js
**Implementation:** Editable UV-space procedural masks, painting layer revision and stable seam landmark coordinates with nondestructive export.

### EXT-009: CLO version change monitoring
**Goal:** Maintain exact reference audit by version without copying proprietary assets
**Evidence:** src/data/clo7ToolbarOrder.js; docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md
**Implementation:** Pin reference version 7.0.242; changes in 2026 releases are separate additions, not silently appended into 70-slot order.

### EXT-010: Backend isolation and diagnostics
**Goal:** Reliable watchdog and bounded local process orchestration
**Evidence:** native_backend/server.mjs; ppf_backend/server.mjs
**Implementation:** Deadline, job cancellation, preview artifact manifests, child PID cleanup and errors without blocking UI process.

### EXT-011: Asset licensing and provenance
**Goal:** Verify rights for photos, scans, avatar meshes and external source
**Evidence:** docs/LICENSING.md; docs/reports/EXO_400_LICENSED_SCAN_REGISTRY.json
**Implementation:** Keep CC0 source evidence, user-uploaded restrictions, per-map hash and dependencies; never embed CLO proprietary resources.

### EXT-012: Automated tool functional matrix
**Goal:** Every native/legacy UI control from click to persistence
**Evidence:** integrations/clothcraft/check-clo7-native-capabilities.mjs; scripts/qa-clo-interface.mjs
**Implementation:** Test click, command dispatch, state change, selection, undo, save/load, screenshot and error case for each toolbar tool.

### EXT-013: Context property exhaustive matrix
**Goal:** Property Editor all selected object kinds and multi-select
**Evidence:** docs/CLO3D_PROPERTY_EDITOR_DEEP_AUDIT_20261016.md; docs/CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md
**Implementation:** Exact names, types, units and default state for pattern, fabric, seam, trims, avatar, simulation, graphic, grading and POM; test null/mixed values.

### EXT-014: Look and rendering ownership
**Goal:** Final presentation without replacing CAD sources
**Evidence:** docs/EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md
**Implementation:** Store immutable looks and render settings with source hashes; public visual derivatives contain no private pattern coordinates.

### EXT-015: Development operation and observability
**Goal:** Build health, persistent regression dashboards, failure triage
**Evidence:** package.json; docs/EXO_DEVELOPER_GUIDE.md
**Implementation:** Continuous CI on clean environment, runtime capability report, checksums, bug repro archive and automated artifact index.

## Entire 70-command CLO7 native support matrix

### TOOL-001: 3D A01 — Simulate
**Current registry:** native. **Action:** simulation.toggle.
**Current evidence:** Native step changes simulated cloth state; pause stops scheduled steps.
**Target model:** CommandEnvelope and ProjectRevision. **Implementation:** Validate current state and command preconditions, expose real operation only when backend implements it and return typed state change with revision and diagnostics.
**Acceptance:** Click with valid state, run without selection, undo/restart and assert no fake execution or mislabeled support.

### TOOL-002: 3D A02 — Select/Move
**Current registry:** native. **Action:** viewport3d.selectMove.
**Current evidence:** Native Rust Place/pose-panel changes selected garment placement; no CLO gizmo parity claim.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-003: 3D A03 — Select Mesh (Brush)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** No equivalent verified Rust V2 operation; keep this reference tool disabled.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-004: 3D A04 — Edit Styleline
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-005: 3D A05 — Edit Sewing
**Current registry:** inspect. **Action:** sewing.inspectSeams.
**Current evidence:** Related native information is viewable, but this CLO editing operation is not implemented.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-006: 3D A06 — Segment Sewing
**Current registry:** native. **Action:** sewing.freeSew.
**Current evidence:** Select two garment edge ranges in the native 3D viewport to author a segment sewing relationship; requires actual valid edges.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-007: 3D A07 — Free Sewing
**Current registry:** native. **Action:** sewing.freeSew.
**Current evidence:** Select two garment edges in the native 3D viewport to sew them with the existing Rust seam operation.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-008: 3D A08 — Auto Sewing
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-009: 3D A09 — Edit Tack
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-010: 3D A10 — Tack
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-011: 3D A11 — Fold Arrangement
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-012: 3D A12 — Fold 3D Garment
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-013: 3D A13 — Reset 2D Arrangement (All)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-014: 3D A14 — Reset 3D Arrangement (All)
**Current registry:** native. **Action:** arrangement.reset3d.
**Current evidence:** Native Rust reset restores the 3D initial off-body pose while preserving authored 2D patterns, material and sewing relations.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-015: 3D A15 — Re-drape 3D Arrangement
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-016: 3D A16 — Hi-Res Garment
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified.
**Target model:** CommandEnvelope and ProjectRevision. **Implementation:** Validate current state and command preconditions, expose real operation only when backend implements it and return typed state change with revision and diagnostics.
**Acceptance:** Click with valid state, run without selection, undo/restart and assert no fake execution or mislabeled support.

### TOOL-017: 3D A17 — Edit Measure (Avatar)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-018: 3D A18 — Basic Tape Measure (Avatar)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-019: 3D A19 — Edit Measure (Garment)
**Current registry:** inspect. **Action:** dimensions.show.
**Current evidence:** Related native information is viewable, but this CLO editing operation is not implemented.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-020: 3D A20 — Linear Measure (Garment)
**Current registry:** inspect. **Action:** dimensions.show.
**Current evidence:** Related native information is viewable, but this CLO editing operation is not implemented.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-021: 3D B01 — Play Motion
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-022: 3D B02 — Edit Line (3D Pattern)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-023: 3D B03 — Line (3D Pattern)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-024: 3D B04 — 3D Base Pen
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-025: 3D B05 — Edit 3D Pen (Avatar)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-026: 3D B06 — 3D Pen (Avatar)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.
**Target model:** SurfaceAttachment, Pose and GarmentFrame. **Implementation:** Map hit-tested 3D triangle and barycentric coordinates to source pattern, update surface or arrangement state, retain pose and stable ID lineage under remeshing.
**Acceptance:** Orbit, pick near an occluded edge, edit in native 3D, inspect 2D mapping, undo and reopen across a remesh.

### TOOL-027: 3D B07 — Edit Texture (3D)
**Current registry:** inspect. **Action:** fabric.inspectProperties.
**Current evidence:** Related native information is viewable, but this CLO editing operation is not implemented.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

### TOOL-028: 3D B08 — Transform Graphic
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-029: 3D B09 — Graphic (3D Pattern)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-030: 3D B10 — Select/Move Button
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-031: 3D B11 — Button
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-032: 3D B12 — Fasten Button
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-033: 3D B13 — Zipper
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-034: 3D B14 — Edit Piping
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-035: 3D B15 — Piping
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-036: 3D B16 — Select Binding
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-037: 3D B17 — Binding
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-038: 3D B18 — Press
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

### TOOL-039: 2D A01 — Transform Pattern
**Current registry:** native. **Action:** pattern2d.selectTransform.
**Current evidence:** Native BoardTransform changes 2D panel placement.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-040: 2D A02 — Edit Pattern
**Current registry:** native. **Action:** pattern2d.editPoints.
**Current evidence:** Native MovePoints/CurvePoint edit existing pattern points.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-041: 2D A03 — Fullness (Point)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-042: 2D A04 — Polygon
**Current registry:** native. **Action:** pattern2d.drawPolygon.
**Current evidence:** Native Polygon creates authored pattern geometry.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-043: 2D A05 — Internal Polygon/Line
**Current registry:** native. **Action:** pattern2d.drawInternalLine.
**Current evidence:** Native InternalLine authors panel interior lines.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-044: 2D A06 — Base Polygon
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-045: 2D A07 — Trace
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-046: 2D A08 — Notch
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-047: 2D A09 — Seam Allowance
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-048: 2D A10 — Walk Pattern
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** PatternPiece, BoundaryEdge and CurveAnchor. **Implementation:** Edit in physical units on the canonical planar source using robust snapping and exact point/curve transforms. Rebuild dependent seam and mesh mappings deterministically.
**Acceptance:** Use exact numeric distances at two zooms, verify geometry/topology, undo, reopen and DXF export with mm tolerances.

### TOOL-049: 2D A11 — Edit Point of Measure
**Current registry:** inspect. **Action:** dimensions.measureTemporary.
**Current evidence:** Click two positions on the native 2D pattern to measure exact metric distance. This is a temporary tape overlay, not an authored production POM.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-050: 2D A12 — Point of Measure
**Current registry:** inspect. **Action:** dimensions.measureTemporary.
**Current evidence:** Temporary two-click tape measure is available on the native 2D board. Saved and graded CLO POM construction remains unimplemented.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-051: 2D A13 — Edit Annotation
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** No equivalent verified Rust V2 operation; keep this reference tool disabled.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-052: 2D A14 — Pattern Annotation
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** No equivalent verified Rust V2 operation; keep this reference tool disabled.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-053: 2D A15 — Pleats
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-054: 2D A16 — Edit Grading
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-055: 2D A17 — Auto Grading
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.
**Target model:** MeasurementAnchor and GradeRule. **Implementation:** Select referenced geometry, preserve object IDs through grading/point edits, and report exact units and tolerances in active inspector.
**Acceptance:** Author, edit, measure, save/reopen, grade across sizes and export selected dimension with unchanged units.

### TOOL-056: 2D B01 — Edit Sewing
**Current registry:** inspect. **Action:** sewing.inspectSeams.
**Current evidence:** Related native information is viewable, but this CLO editing operation is not implemented.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-057: 2D B02 — Segment Sewing
**Current registry:** native. **Action:** sewing.freeSew.
**Current evidence:** Native Rust Sew pairs selected 2D boundary ranges, with undo and edge validation.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-058: 2D B03 — Free Sewing
**Current registry:** native. **Action:** sewing.freeSew.
**Current evidence:** Native Sew joins selected boundary ranges; requires two valid boundary selections.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-059: 2D B04 — Check Sewing Length
**Current registry:** inspect. **Action:** sewing.inspectSeams.
**Current evidence:** Select a native sewing relationship to inspect both connected 2D/3D boundary lengths and simulated gap; automatic sewing-length correction is not implemented.
**Target model:** SeamRelation and edge intervals. **Implementation:** Selection must find boundary IDs and parameter ranges; pair orientation/ease; update sewing graph, constraint buffer and diagnostics.
**Acceptance:** Sew across one segment, reverse it, undo, reopen, measure residual seam gap, then intentionally select invalid edges.

### TOOL-060: 2D B05 — Steam
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

### TOOL-061: 2D B06 — Seam Taping
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process.
**Target model:** CommandEnvelope and ProjectRevision. **Implementation:** Validate current state and command preconditions, expose real operation only when backend implements it and return typed state change with revision and diagnostics.
**Acceptance:** Click with valid state, run without selection, undo/restart and assert no fake execution or mislabeled support.

### TOOL-062: 2D B07 — Edit Texture (2D)
**Current registry:** inspect. **Action:** fabric.inspectProperties.
**Current evidence:** Related native information is viewable, but this CLO editing operation is not implemented.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

### TOOL-063: 2D B08 — Transform Graphic
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-064: 2D B09 — Graphic (2D Pattern)
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-065: 2D B10 — Edit Topstitch
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-066: 2D B11 — Segment Topstitch
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.
**Target model:** TrimInstance and PatternSurfaceAnchor. **Implementation:** Place an authored component against a persistent edge/surface anchor with dimensions, material, orientation, assembly metadata and source panel linkage.
**Acceptance:** Place at measured seam point, change geometry, verify tracking, undo, save/reopen and ensure BOM reflects the item.

### TOOL-067: 2D B12 — Edit Puckering
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

### TOOL-068: 2D B13 — Segment Puckering
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

### TOOL-069: 2D B14 — Set Sublayer
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native pattern-side paint/layer/UV tool with persistent material masks, per-face maps and reversible edits. The separate Fabric workspace handles existing material properties.
**Target model:** CommandEnvelope and ProjectRevision. **Implementation:** Validate current state and command preconditions, expose real operation only when backend implements it and return typed state change with revision and diagnostics.
**Acceptance:** Click with valid state, run without selection, undo/restart and assert no fake execution or mislabeled support.

### TOOL-070: 2D B15 — Fill
**Current registry:** unavailable. **Action:** not implemented.
**Current evidence:** Requires a native pattern-side paint/layer/UV tool with persistent material masks, per-face maps and reversible edits. The separate Fabric workspace handles existing material properties.
**Target model:** MaterialAssignment and FinishLayer. **Implementation:** Select owning surface/pattern and bind texture space to grainline; typed layer operations must invalidate visual maps, and physically meaningful changes require a separate calibrated solver operation.
**Acceptance:** Apply to one panel, rotate grainline, undo, export swatch and check no accidental change to physical coefficients.

## Complete 400-material record and calibration backlog

### FAB-001: Cotton Jersey (`jersey`)
Nominal currently stored: **220 GSM**; thickness **2.0 mm**; warp/weft stretch **0.12/0.18**; bend **0.68**; friction **0.34**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-002: Heavy French Terry (`fleece`)
Nominal currently stored: **460 GSM**; thickness **4.0 mm**; warp/weft stretch **0.06/0.09**; bend **0.82**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-003: Rigid Denim (`denim`)
Nominal currently stored: **390 GSM**; thickness **3.2 mm**; warp/weft stretch **0.015/0.02**; bend **0.91**; friction **0.42**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-004: Silk Twill (`silk`)
Nominal currently stored: **95 GSM**; thickness **1.2 mm**; warp/weft stretch **0.035/0.045**; bend **0.42**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-005: Fusible Interfacing (`interfacing`)
Nominal currently stored: **52 GSM**; thickness **0.7 mm**; warp/weft stretch **0.012/0.018**; bend **0.88**; friction **0.52**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-006: Cotton Poplin (`cottonPoplin`)
Nominal currently stored: **135 GSM**; thickness **1.1 mm**; warp/weft stretch **0.014/0.025**; bend **0.77**; friction **0.36**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-007: Cotton Canvas (`cottonCanvas`)
Nominal currently stored: **320 GSM**; thickness **2.7 mm**; warp/weft stretch **0.008/0.014**; bend **0.94**; friction **0.48**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-008: Wool Suiting (`woolSuiting`)
Nominal currently stored: **250 GSM**; thickness **2.1 mm**; warp/weft stretch **0.035/0.04**; bend **0.69**; friction **0.43**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-009: Wool Melton (`woolMelton`)
Nominal currently stored: **580 GSM**; thickness **5.0 mm**; warp/weft stretch **0.015/0.018**; bend **0.94**; friction **0.56**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-010: Soft Garment Leather (`softLeather`)
Nominal currently stored: **650 GSM**; thickness **1.8 mm**; warp/weft stretch **0.02/0.035**; bend **0.89**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-011: Suede / Napped Leather (`suede`)
Nominal currently stored: **580 GSM**; thickness **2.2 mm**; warp/weft stretch **0.018/0.024**; bend **0.86**; friction **0.64**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-012: Lightweight Nylon (`lightNylon`)
Nominal currently stored: **80 GSM**; thickness **0.7 mm**; warp/weft stretch **0.012/0.016**; bend **0.3**; friction **0.29**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-013: Nylon Ripstop (`nylonRipstop`)
Nominal currently stored: **110 GSM**; thickness **0.9 mm**; warp/weft stretch **0.011/0.018**; bend **0.47**; friction **0.3**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-014: Plain Linen (`linen`)
Nominal currently stored: **180 GSM**; thickness **1.6 mm**; warp/weft stretch **0.013/0.017**; bend **0.8**; friction **0.39**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-015: Silk Satin (`silkSatin`)
Nominal currently stored: **85 GSM**; thickness **0.9 mm**; warp/weft stretch **0.035/0.045**; bend **0.32**; friction **0.19**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-016: Stretch Rib Knit (`ribKnit`)
Nominal currently stored: **320 GSM**; thickness **2.6 mm**; warp/weft stretch **0.22/0.45**; bend **0.59**; friction **0.45**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-017: Stretch Denim (`stretchDenim`)
Nominal currently stored: **345 GSM**; thickness **2.9 mm**; warp/weft stretch **0.025/0.14**; bend **0.79**; friction **0.42**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-018: Cotton Velvet (`velvet`)
Nominal currently stored: **310 GSM**; thickness **2.0 mm**; warp/weft stretch **0.025/0.04**; bend **0.66**; friction **0.55**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-019: Silk Chiffon (`silkChiffon`)
Nominal currently stored: **52 GSM**; thickness **0.5 mm**; warp/weft stretch **0.02/0.035**; bend **0.2**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-020: Silk Organza (`silkOrganza`)
Nominal currently stored: **38 GSM**; thickness **0.38 mm**; warp/weft stretch **0.008/0.012**; bend **0.5**; friction **0.21**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-021: Cotton Corduroy (`cottonCorduroy`)
Nominal currently stored: **370 GSM**; thickness **3.0 mm**; warp/weft stretch **0.015/0.028**; bend **0.84**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-022: Scuba Double Knit (`scubaKnit`)
Nominal currently stored: **360 GSM**; thickness **3.5 mm**; warp/weft stretch **0.22/0.31**; bend **0.74**; friction **0.31**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-023: Technical Softshell (`technicalSoftshell`)
Nominal currently stored: **290 GSM**; thickness **2.6 mm**; warp/weft stretch **0.045/0.095**; bend **0.76**; friction **0.28**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-024: Light Cotton Jersey (`cottonLightJersey`)
Nominal currently stored: **160 GSM**; thickness **1.05 mm**; warp/weft stretch **0.11/0.19**; bend **0.58**; friction **0.34**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-025: Heavyweight Cotton Jersey (`cottonHeavyJersey`)
Nominal currently stored: **285 GSM**; thickness **1.7 mm**; warp/weft stretch **0.08/0.15**; bend **0.75**; friction **0.34**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-026: Cotton Interlock (`cottonInterlock`)
Nominal currently stored: **235 GSM**; thickness **1.8 mm**; warp/weft stretch **0.14/0.22**; bend **0.65**; friction **0.34**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-027: Cotton Piqué (`cottonPique`)
Nominal currently stored: **225 GSM**; thickness **1.65 mm**; warp/weft stretch **0.08/0.14**; bend **0.73**; friction **0.34**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-028: Cotton Waffle Knit (`waffleKnit`)
Nominal currently stored: **290 GSM**; thickness **2.5 mm**; warp/weft stretch **0.16/0.29**; bend **0.66**; friction **0.34**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-029: Cotton 1×1 Rib (`cottonRib1x1`)
Nominal currently stored: **245 GSM**; thickness **1.65 mm**; warp/weft stretch **0.2/0.4**; bend **0.58**; friction **0.45**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-030: Cotton 2×2 Rib (`cottonRib2x2`)
Nominal currently stored: **320 GSM**; thickness **2.4 mm**; warp/weft stretch **0.2/0.46**; bend **0.67**; friction **0.45**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-031: Midweight French Terry (`frenchTerryMid`)
Nominal currently stored: **330 GSM**; thickness **2.35 mm**; warp/weft stretch **0.08/0.13**; bend **0.76**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-032: Heavyweight French Terry (`frenchTerryHeavy`)
Nominal currently stored: **520 GSM**; thickness **4.1 mm**; warp/weft stretch **0.05/0.1**; bend **0.87**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-033: Brushed Back Sweatshirt Fleece (`brushedFleece`)
Nominal currently stored: **385 GSM**; thickness **3.5 mm**; warp/weft stretch **0.07/0.12**; bend **0.78**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-034: Polyester Polar Fleece (`polarFleece`)
Nominal currently stored: **285 GSM**; thickness **4.5 mm**; warp/weft stretch **0.08/0.13**; bend **0.51**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-035: Polyester Sherpa (`sherpa`)
Nominal currently stored: **390 GSM**; thickness **6.2 mm**; warp/weft stretch **0.09/0.14**; bend **0.66**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-036: Brushed Cotton Flannel (`cottonFlannel`)
Nominal currently stored: **195 GSM**; thickness **1.5 mm**; warp/weft stretch **0.02/0.04**; bend **0.7**; friction **0.36**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-037: Cotton Oxford Shirting (`cottonOxford`)
Nominal currently stored: **170 GSM**; thickness **1.1 mm**; warp/weft stretch **0.02/0.04**; bend **0.76**; friction **0.36**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-038: Cotton Broadcloth (`cottonBroadcloth`)
Nominal currently stored: **130 GSM**; thickness **0.9 mm**; warp/weft stretch **0.015/0.025**; bend **0.73**; friction **0.36**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-039: Cotton Chambray (`cottonChambray`)
Nominal currently stored: **150 GSM**; thickness **1.1 mm**; warp/weft stretch **0.015/0.03**; bend **0.7**; friction **0.36**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-040: Cotton Workwear Twill (`cottonTwill`)
Nominal currently stored: **290 GSM**; thickness **1.75 mm**; warp/weft stretch **0.015/0.025**; bend **0.87**; friction **0.48**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-041: Cotton Duck Canvas (`cottonDuck`)
Nominal currently stored: **405 GSM**; thickness **3.1 mm**; warp/weft stretch **0.008/0.013999999999999999**; bend **0.96**; friction **0.48**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-042: Waxed Cotton Canvas (`waxedCanvas`)
Nominal currently stored: **360 GSM**; thickness **2.5 mm**; warp/weft stretch **0.01/0.015**; bend **0.9**; friction **0.48**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-043: Lightweight Linen Shirting (`linenShirting`)
Nominal currently stored: **145 GSM**; thickness **0.85 mm**; warp/weft stretch **0.012/0.018000000000000002**; bend **0.66**; friction **0.39**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-044: Heavyweight Linen (`linenHeavy`)
Nominal currently stored: **285 GSM**; thickness **1.95 mm**; warp/weft stretch **0.01/0.02**; bend **0.81**; friction **0.39**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-045: Hemp Canvas (`hempCanvas`)
Nominal currently stored: **365 GSM**; thickness **2.55 mm**; warp/weft stretch **0.009000000000000001/0.017**; bend **0.92**; friction **0.48**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-046: Raw Indigo Denim 14oz (`rawDenim`)
Nominal currently stored: **475 GSM**; thickness **1.45 mm**; warp/weft stretch **0.008/0.015**; bend **0.95**; friction **0.42**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-047: Lightweight Denim (`lightDenim`)
Nominal currently stored: **270 GSM**; thickness **0.95 mm**; warp/weft stretch **0.015/0.027999999999999997**; bend **0.77**; friction **0.42**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-048: Heavyweight Denim 18oz (`heavyDenim`)
Nominal currently stored: **610 GSM**; thickness **2.3 mm**; warp/weft stretch **0.006/0.01**; bend **0.97**; friction **0.42**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-049: Cotton Elastane Denim (`denimCottonElastane`)
Nominal currently stored: **350 GSM**; thickness **1.15 mm**; warp/weft stretch **0.03/0.18**; bend **0.77**; friction **0.42**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-050: Wool Flannel (`woolFlannel`)
Nominal currently stored: **275 GSM**; thickness **1.9 mm**; warp/weft stretch **0.03/0.05**; bend **0.68**; friction **0.43**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-051: Wool Gabardine (`woolGabardine`)
Nominal currently stored: **280 GSM**; thickness **1.45 mm**; warp/weft stretch **0.023/0.032**; bend **0.82**; friction **0.43**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-052: Wool Tweed (`woolTweed`)
Nominal currently stored: **410 GSM**; thickness **2.85 mm**; warp/weft stretch **0.02/0.035**; bend **0.83**; friction **0.56**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-053: Bouclé Wool Blend (`boucle`)
Nominal currently stored: **460 GSM**; thickness **4.2 mm**; warp/weft stretch **0.06/0.08**; bend **0.68**; friction **0.56**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-054: Cashmere Sweater Knit (`cashmereKnit`)
Nominal currently stored: **225 GSM**; thickness **2.1 mm**; warp/weft stretch **0.12/0.21**; bend **0.46**; friction **0.45**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-055: Viscose Challis (`viscoseChallis`)
Nominal currently stored: **125 GSM**; thickness **0.75 mm**; warp/weft stretch **0.04/0.06**; bend **0.33**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-056: Lyocell Twill (`tencelTwill`)
Nominal currently stored: **195 GSM**; thickness **0.95 mm**; warp/weft stretch **0.038/0.057999999999999996**; bend **0.42**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-057: Rayon Crêpe (`rayonCrepe`)
Nominal currently stored: **145 GSM**; thickness **1.0 mm**; warp/weft stretch **0.05/0.07**; bend **0.36**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-058: Silk Charmeuse (`silkCharmeuse`)
Nominal currently stored: **90 GSM**; thickness **0.5 mm**; warp/weft stretch **0.03/0.05**; bend **0.3**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-059: Silk Georgette (`silkGeorgette`)
Nominal currently stored: **70 GSM**; thickness **0.42 mm**; warp/weft stretch **0.04/0.06**; bend **0.25**; friction **0.22**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-060: Polyester Satin (`polySatin`)
Nominal currently stored: **155 GSM**; thickness **0.85 mm**; warp/weft stretch **0.025/0.04**; bend **0.48**; friction **0.19**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-061: Polyester Taffeta (`polyTaffeta`)
Nominal currently stored: **100 GSM**; thickness **0.58 mm**; warp/weft stretch **0.015/0.025**; bend **0.7**; friction **0.29**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-062: Athletic Polyester Mesh (`polyMesh`)
Nominal currently stored: **130 GSM**; thickness **1.25 mm**; warp/weft stretch **0.15/0.27**; bend **0.41**; friction **0.29**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-063: Nylon Spandex Power Mesh (`powerMesh`)
Nominal currently stored: **180 GSM**; thickness **0.9 mm**; warp/weft stretch **0.28/0.48**; bend **0.45**; friction **0.45**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-064: Stretch Nylon Spandex Tricot (`spandexTricot`)
Nominal currently stored: **240 GSM**; thickness **0.7 mm**; warp/weft stretch **0.4/0.55**; bend **0.39**; friction **0.45**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-065: Neoprene Laminated Foam (`neoprene`)
Nominal currently stored: **590 GSM**; thickness **3.8 mm**; warp/weft stretch **0.13/0.23**; bend **0.91**; friction **0.31**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-066: Coated Nylon Jacket Shell (`shellNylon`)
Nominal currently stored: **95 GSM**; thickness **0.18 mm**; warp/weft stretch **0.01/0.015**; bend **0.47**; friction **0.29**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-067: Ultralight Nylon Ripstop (`ripstopUltralight`)
Nominal currently stored: **55 GSM**; thickness **0.16 mm**; warp/weft stretch **0.01/0.02**; bend **0.35**; friction **0.3**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-068: Polyester Tulle Net (`polyTulle`)
Nominal currently stored: **48 GSM**; thickness **0.4 mm**; warp/weft stretch **0.1/0.17**; bend **0.35**; friction **0.21**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-069: Polyurethane Coated Textile (`veganLeather`)
Nominal currently stored: **540 GSM**; thickness **1.2 mm**; warp/weft stretch **0.03/0.06**; bend **0.86**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-070: Lambskin Garment Leather (`lambskin`)
Nominal currently stored: **460 GSM**; thickness **0.8 mm**; warp/weft stretch **0.04/0.07**; bend **0.64**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-071: Nappa Cowhide Garment Leather (`nappaLeather`)
Nominal currently stored: **640 GSM**; thickness **1.25 mm**; warp/weft stretch **0.02/0.04**; bend **0.86**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-072: Pebbled Cowhide Leather (`pebbledLeather`)
Nominal currently stored: **730 GSM**; thickness **1.65 mm**; warp/weft stretch **0.02/0.04**; bend **0.89**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-073: Vegetable-Tanned Cowhide (`vegetableLeather`)
Nominal currently stored: **840 GSM**; thickness **2.2 mm**; warp/weft stretch **0.015/0.03**; bend **0.97**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-074: Patent Leather (`patentLeather`)
Nominal currently stored: **660 GSM**; thickness **1.2 mm**; warp/weft stretch **0.025/0.04**; bend **0.88**; friction **0.51**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-075: Nubuck Leather (`nubuck`)
Nominal currently stored: **650 GSM**; thickness **1.35 mm**; warp/weft stretch **0.02/0.032**; bend **0.83**; friction **0.64**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-076: Lambskin Suede (`suedeLambskin`)
Nominal currently stored: **505 GSM**; thickness **1.1 mm**; warp/weft stretch **0.03/0.05**; bend **0.66**; friction **0.64**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-077: Microfiber Faux Suede (`fauxSuede`)
Nominal currently stored: **320 GSM**; thickness **1.25 mm**; warp/weft stretch **0.04/0.08**; bend **0.62**; friction **0.64**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-078: Cotton Velour Knit (`velour`)
Nominal currently stored: **295 GSM**; thickness **2.1 mm**; warp/weft stretch **0.14/0.22**; bend **0.55**; friction **0.55**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-079: Short Pile Faux Fur (`fauxFur`)
Nominal currently stored: **530 GSM**; thickness **8.0 mm**; warp/weft stretch **0.06/0.11**; bend **0.72**; friction **0.46**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-080: Quilted Nylon with Batting (`quiltedNylon`)
Nominal currently stored: **310 GSM**; thickness **6.0 mm**; warp/weft stretch **0.03/0.05**; bend **0.81**; friction **0.28**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-081: Cotton Jersey · Fine / Light Construction · 163 GSM (`jersey__fine`)
Nominal currently stored: **162.8 GSM**; thickness **1.62 mm**; warp/weft stretch **0.1356/0.2034**; bend **0.595**; friction **0.3264**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-082: Cotton Jersey · Dense / Firm Construction · 271 GSM (`jersey__dense`)
Nominal currently stored: **270.6 GSM**; thickness **2.32 mm**; warp/weft stretch **0.1032/0.1548**; bend **0.75**; friction **0.3672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-083: Cotton Jersey · Soft-Hand / Broken-In Finish · 212 GSM (`jersey__softened`)
Nominal currently stored: **212.3 GSM**; thickness **2.06 mm**; warp/weft stretch **0.1344/0.2016**; bend **0.575**; friction **0.3162**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-084: Cotton Jersey · Crisp / Structured Finish · 238 GSM (`jersey__crisp`)
Nominal currently stored: **237.6 GSM**; thickness **2.06 mm**; warp/weft stretch **0.1056/0.1584**; bend **0.765**; friction **0.357**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-085: French Terry · Fine / Light Construction · 340 GSM (`fleece__fine`)
Nominal currently stored: **340.4 GSM**; thickness **3.24 mm**; warp/weft stretch **0.0678/0.1017**; bend **0.735**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-086: French Terry · Dense / Firm Construction · 566 GSM (`fleece__dense`)
Nominal currently stored: **565.8 GSM**; thickness **4.64 mm**; warp/weft stretch **0.0516/0.0774**; bend **0.89**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-087: French Terry · Soft-Hand / Broken-In Finish · 444 GSM (`fleece__softened`)
Nominal currently stored: **443.9 GSM**; thickness **4.12 mm**; warp/weft stretch **0.0672/0.1008**; bend **0.715**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-088: French Terry · Crisp / Structured Finish · 497 GSM (`fleece__crisp`)
Nominal currently stored: **496.8 GSM**; thickness **4.12 mm**; warp/weft stretch **0.0528/0.0792**; bend **0.905**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-089: Rigid Denim · Fine / Light Construction · 289 GSM (`denim__fine`)
Nominal currently stored: **288.6 GSM**; thickness **2.592 mm**; warp/weft stretch **0.01695/0.0226**; bend **0.825**; friction **0.4032**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-090: Rigid Denim · Dense / Firm Construction · 480 GSM (`denim__dense`)
Nominal currently stored: **479.7 GSM**; thickness **3.712 mm**; warp/weft stretch **0.0129/0.0172**; bend **0.98**; friction **0.4536**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-091: Rigid Denim · Soft-Hand / Broken-In Finish · 376 GSM (`denim__softened`)
Nominal currently stored: **376.3 GSM**; thickness **3.296 mm**; warp/weft stretch **0.0168/0.0224**; bend **0.805**; friction **0.3906**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-092: Rigid Denim · Crisp / Structured Finish · 421 GSM (`denim__crisp`)
Nominal currently stored: **421.2 GSM**; thickness **3.296 mm**; warp/weft stretch **0.0132/0.0176**; bend **0.985**; friction **0.441**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-093: Silk Twill · Fine / Light Construction · 70 GSM (`silk__fine`)
Nominal currently stored: **70.3 GSM**; thickness **0.972 mm**; warp/weft stretch **0.03955/0.05085**; bend **0.335**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-094: Silk Twill · Dense / Firm Construction · 117 GSM (`silk__dense`)
Nominal currently stored: **116.8 GSM**; thickness **1.392 mm**; warp/weft stretch **0.0301/0.0387**; bend **0.49**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-095: Silk Twill · Soft-Hand / Broken-In Finish · 92 GSM (`silk__softened`)
Nominal currently stored: **91.7 GSM**; thickness **1.236 mm**; warp/weft stretch **0.0392/0.0504**; bend **0.315**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-096: Silk Twill · Crisp / Structured Finish · 103 GSM (`silk__crisp`)
Nominal currently stored: **102.6 GSM**; thickness **1.236 mm**; warp/weft stretch **0.0308/0.0396**; bend **0.505**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-097: Fusible Interfacing · Fine / Light Construction · 38 GSM (`interfacing__fine`)
Nominal currently stored: **38.5 GSM**; thickness **0.567 mm**; warp/weft stretch **0.01356/0.02034**; bend **0.795**; friction **0.4992**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-098: Fusible Interfacing · Dense / Firm Construction · 64 GSM (`interfacing__dense`)
Nominal currently stored: **64 GSM**; thickness **0.812 mm**; warp/weft stretch **0.01032/0.01548**; bend **0.95**; friction **0.5616**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-099: Fusible Interfacing · Soft-Hand / Broken-In Finish · 50 GSM (`interfacing__softened`)
Nominal currently stored: **50.2 GSM**; thickness **0.721 mm**; warp/weft stretch **0.01344/0.02016**; bend **0.775**; friction **0.4836**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-100: Fusible Interfacing · Crisp / Structured Finish · 56 GSM (`interfacing__crisp`)
Nominal currently stored: **56.2 GSM**; thickness **0.721 mm**; warp/weft stretch **0.01056/0.01584**; bend **0.965**; friction **0.546**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-101: Cotton Poplin · Fine / Light Construction · 100 GSM (`cottonPoplin__fine`)
Nominal currently stored: **99.9 GSM**; thickness **0.891 mm**; warp/weft stretch **0.01582/0.02825**; bend **0.685**; friction **0.3456**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-102: Cotton Poplin · Dense / Firm Construction · 166 GSM (`cottonPoplin__dense`)
Nominal currently stored: **166.1 GSM**; thickness **1.276 mm**; warp/weft stretch **0.01204/0.0215**; bend **0.84**; friction **0.3888**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-103: Cotton Poplin · Soft-Hand / Broken-In Finish · 130 GSM (`cottonPoplin__softened`)
Nominal currently stored: **130.3 GSM**; thickness **1.133 mm**; warp/weft stretch **0.01568/0.028**; bend **0.665**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-104: Cotton Poplin · Crisp / Structured Finish · 146 GSM (`cottonPoplin__crisp`)
Nominal currently stored: **145.8 GSM**; thickness **1.133 mm**; warp/weft stretch **0.01232/0.022**; bend **0.855**; friction **0.378**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-105: Cotton Canvas · Fine / Light Construction · 237 GSM (`cottonCanvas__fine`)
Nominal currently stored: **236.8 GSM**; thickness **2.187 mm**; warp/weft stretch **0.00904/0.01582**; bend **0.855**; friction **0.4608**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-106: Cotton Canvas · Dense / Firm Construction · 394 GSM (`cottonCanvas__dense`)
Nominal currently stored: **393.6 GSM**; thickness **3.132 mm**; warp/weft stretch **0.00688/0.01204**; bend **0.985**; friction **0.5184**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-107: Cotton Canvas · Soft-Hand / Broken-In Finish · 309 GSM (`cottonCanvas__softened`)
Nominal currently stored: **308.8 GSM**; thickness **2.781 mm**; warp/weft stretch **0.00896/0.01568**; bend **0.835**; friction **0.4464**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-108: Cotton Canvas · Crisp / Structured Finish · 346 GSM (`cottonCanvas__crisp`)
Nominal currently stored: **345.6 GSM**; thickness **2.781 mm**; warp/weft stretch **0.00704/0.01232**; bend **0.985**; friction **0.504**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-109: Wool Suiting · Fine / Light Construction · 185 GSM (`woolSuiting__fine`)
Nominal currently stored: **185 GSM**; thickness **1.701 mm**; warp/weft stretch **0.03955/0.0452**; bend **0.605**; friction **0.4128**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-110: Wool Suiting · Dense / Firm Construction · 308 GSM (`woolSuiting__dense`)
Nominal currently stored: **307.5 GSM**; thickness **2.436 mm**; warp/weft stretch **0.0301/0.0344**; bend **0.76**; friction **0.4644**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-111: Wool Suiting · Soft-Hand / Broken-In Finish · 241 GSM (`woolSuiting__softened`)
Nominal currently stored: **241.3 GSM**; thickness **2.163 mm**; warp/weft stretch **0.0392/0.0448**; bend **0.585**; friction **0.3999**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-112: Wool Suiting · Crisp / Structured Finish · 270 GSM (`woolSuiting__crisp`)
Nominal currently stored: **270 GSM**; thickness **2.163 mm**; warp/weft stretch **0.0308/0.0352**; bend **0.775**; friction **0.4515**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-113: Wool Melton · Fine / Light Construction · 429 GSM (`woolMelton__fine`)
Nominal currently stored: **429.2 GSM**; thickness **4.05 mm**; warp/weft stretch **0.01695/0.02034**; bend **0.855**; friction **0.5376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-114: Wool Melton · Dense / Firm Construction · 713 GSM (`woolMelton__dense`)
Nominal currently stored: **713.4 GSM**; thickness **5.8 mm**; warp/weft stretch **0.0129/0.01548**; bend **0.985**; friction **0.6048**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-115: Wool Melton · Soft-Hand / Broken-In Finish · 560 GSM (`woolMelton__softened`)
Nominal currently stored: **559.7 GSM**; thickness **5.15 mm**; warp/weft stretch **0.0168/0.02016**; bend **0.835**; friction **0.5208**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-116: Wool Melton · Crisp / Structured Finish · 626 GSM (`woolMelton__crisp`)
Nominal currently stored: **626.4 GSM**; thickness **5.15 mm**; warp/weft stretch **0.0132/0.01584**; bend **0.985**; friction **0.588**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-117: Garment Leather · Fine / Light Construction · 481 GSM (`softLeather__fine`)
Nominal currently stored: **481 GSM**; thickness **1.458 mm**; warp/weft stretch **0.0226/0.03955**; bend **0.805**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-118: Garment Leather · Dense / Firm Construction · 800 GSM (`softLeather__dense`)
Nominal currently stored: **799.5 GSM**; thickness **2.088 mm**; warp/weft stretch **0.0172/0.0301**; bend **0.96**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-119: Garment Leather · Soft-Hand / Broken-In Finish · 627 GSM (`softLeather__softened`)
Nominal currently stored: **627.3 GSM**; thickness **1.854 mm**; warp/weft stretch **0.0224/0.0392**; bend **0.785**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-120: Garment Leather · Crisp / Structured Finish · 702 GSM (`softLeather__crisp`)
Nominal currently stored: **702 GSM**; thickness **1.854 mm**; warp/weft stretch **0.0176/0.0308**; bend **0.975**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-121: Suede / Napped Leather · Fine / Light Construction · 429 GSM (`suede__fine`)
Nominal currently stored: **429.2 GSM**; thickness **1.782 mm**; warp/weft stretch **0.02034/0.02712**; bend **0.775**; friction **0.6144**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-122: Suede / Napped Leather · Dense / Firm Construction · 713 GSM (`suede__dense`)
Nominal currently stored: **713.4 GSM**; thickness **2.552 mm**; warp/weft stretch **0.01548/0.02064**; bend **0.93**; friction **0.6912**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-123: Suede / Napped Leather · Soft-Hand / Broken-In Finish · 560 GSM (`suede__softened`)
Nominal currently stored: **559.7 GSM**; thickness **2.266 mm**; warp/weft stretch **0.02016/0.02688**; bend **0.755**; friction **0.5952**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-124: Suede / Napped Leather · Crisp / Structured Finish · 626 GSM (`suede__crisp`)
Nominal currently stored: **626.4 GSM**; thickness **2.266 mm**; warp/weft stretch **0.01584/0.02112**; bend **0.945**; friction **0.672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-125: Nylon · Fine / Light Construction · 59 GSM (`lightNylon__fine`)
Nominal currently stored: **59.2 GSM**; thickness **0.567 mm**; warp/weft stretch **0.01356/0.01808**; bend **0.215**; friction **0.2784**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-126: Nylon · Dense / Firm Construction · 98 GSM (`lightNylon__dense`)
Nominal currently stored: **98.4 GSM**; thickness **0.812 mm**; warp/weft stretch **0.01032/0.01376**; bend **0.37**; friction **0.3132**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-127: Nylon · Soft-Hand / Broken-In Finish · 77 GSM (`lightNylon__softened`)
Nominal currently stored: **77.2 GSM**; thickness **0.721 mm**; warp/weft stretch **0.01344/0.01792**; bend **0.195**; friction **0.2697**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-128: Nylon · Crisp / Structured Finish · 86 GSM (`lightNylon__crisp`)
Nominal currently stored: **86.4 GSM**; thickness **0.721 mm**; warp/weft stretch **0.01056/0.01408**; bend **0.385**; friction **0.3045**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-129: Nylon Ripstop · Fine / Light Construction · 81 GSM (`nylonRipstop__fine`)
Nominal currently stored: **81.4 GSM**; thickness **0.729 mm**; warp/weft stretch **0.01243/0.02034**; bend **0.385**; friction **0.288**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-130: Nylon Ripstop · Dense / Firm Construction · 135 GSM (`nylonRipstop__dense`)
Nominal currently stored: **135.3 GSM**; thickness **1.044 mm**; warp/weft stretch **0.00946/0.01548**; bend **0.54**; friction **0.324**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-131: Nylon Ripstop · Soft-Hand / Broken-In Finish · 106 GSM (`nylonRipstop__softened`)
Nominal currently stored: **106.1 GSM**; thickness **0.927 mm**; warp/weft stretch **0.01232/0.02016**; bend **0.365**; friction **0.279**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-132: Nylon Ripstop · Crisp / Structured Finish · 119 GSM (`nylonRipstop__crisp`)
Nominal currently stored: **118.8 GSM**; thickness **0.927 mm**; warp/weft stretch **0.00968/0.01584**; bend **0.555**; friction **0.315**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-133: Plain Linen · Fine / Light Construction · 133 GSM (`linen__fine`)
Nominal currently stored: **133.2 GSM**; thickness **1.296 mm**; warp/weft stretch **0.01469/0.01921**; bend **0.715**; friction **0.3744**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-134: Plain Linen · Dense / Firm Construction · 221 GSM (`linen__dense`)
Nominal currently stored: **221.4 GSM**; thickness **1.856 mm**; warp/weft stretch **0.01118/0.01462**; bend **0.87**; friction **0.4212**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-135: Plain Linen · Soft-Hand / Broken-In Finish · 174 GSM (`linen__softened`)
Nominal currently stored: **173.7 GSM**; thickness **1.648 mm**; warp/weft stretch **0.01456/0.01904**; bend **0.695**; friction **0.3627**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-136: Plain Linen · Crisp / Structured Finish · 194 GSM (`linen__crisp`)
Nominal currently stored: **194.4 GSM**; thickness **1.648 mm**; warp/weft stretch **0.01144/0.01496**; bend **0.885**; friction **0.4095**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-137: Silk Satin · Fine / Light Construction · 63 GSM (`silkSatin__fine`)
Nominal currently stored: **62.9 GSM**; thickness **0.729 mm**; warp/weft stretch **0.03955/0.05085**; bend **0.235**; friction **0.1824**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-138: Silk Satin · Dense / Firm Construction · 105 GSM (`silkSatin__dense`)
Nominal currently stored: **104.5 GSM**; thickness **1.044 mm**; warp/weft stretch **0.0301/0.0387**; bend **0.39**; friction **0.2052**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-139: Silk Satin · Soft-Hand / Broken-In Finish · 82 GSM (`silkSatin__softened`)
Nominal currently stored: **82 GSM**; thickness **0.927 mm**; warp/weft stretch **0.0392/0.0504**; bend **0.215**; friction **0.1767**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-140: Silk Satin · Crisp / Structured Finish · 92 GSM (`silkSatin__crisp`)
Nominal currently stored: **91.8 GSM**; thickness **0.927 mm**; warp/weft stretch **0.0308/0.0396**; bend **0.405**; friction **0.1995**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-141: Stretch Rib Knit · Fine / Light Construction · 237 GSM (`ribKnit__fine`)
Nominal currently stored: **236.8 GSM**; thickness **2.106 mm**; warp/weft stretch **0.2486/0.5085**; bend **0.505**; friction **0.432**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-142: Stretch Rib Knit · Dense / Firm Construction · 394 GSM (`ribKnit__dense`)
Nominal currently stored: **393.6 GSM**; thickness **3.016 mm**; warp/weft stretch **0.1892/0.387**; bend **0.66**; friction **0.486**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-143: Stretch Rib Knit · Soft-Hand / Broken-In Finish · 309 GSM (`ribKnit__softened`)
Nominal currently stored: **308.8 GSM**; thickness **2.678 mm**; warp/weft stretch **0.2464/0.504**; bend **0.485**; friction **0.4185**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-144: Stretch Rib Knit · Crisp / Structured Finish · 346 GSM (`ribKnit__crisp`)
Nominal currently stored: **345.6 GSM**; thickness **2.678 mm**; warp/weft stretch **0.1936/0.396**; bend **0.675**; friction **0.4725**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-145: Stretch Denim · Fine / Light Construction · 255 GSM (`stretchDenim__fine`)
Nominal currently stored: **255.3 GSM**; thickness **2.349 mm**; warp/weft stretch **0.02825/0.1582**; bend **0.705**; friction **0.4032**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-146: Stretch Denim · Dense / Firm Construction · 424 GSM (`stretchDenim__dense`)
Nominal currently stored: **424.3 GSM**; thickness **3.364 mm**; warp/weft stretch **0.0215/0.1204**; bend **0.86**; friction **0.4536**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-147: Stretch Denim · Soft-Hand / Broken-In Finish · 333 GSM (`stretchDenim__softened`)
Nominal currently stored: **332.9 GSM**; thickness **2.987 mm**; warp/weft stretch **0.028/0.1568**; bend **0.685**; friction **0.3906**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-148: Stretch Denim · Crisp / Structured Finish · 373 GSM (`stretchDenim__crisp`)
Nominal currently stored: **372.6 GSM**; thickness **2.987 mm**; warp/weft stretch **0.022/0.1232**; bend **0.875**; friction **0.441**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-149: Cotton Velvet · Fine / Light Construction · 229 GSM (`velvet__fine`)
Nominal currently stored: **229.4 GSM**; thickness **1.62 mm**; warp/weft stretch **0.02825/0.0452**; bend **0.575**; friction **0.528**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-150: Cotton Velvet · Dense / Firm Construction · 381 GSM (`velvet__dense`)
Nominal currently stored: **381.3 GSM**; thickness **2.32 mm**; warp/weft stretch **0.0215/0.0344**; bend **0.73**; friction **0.594**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-151: Cotton Velvet · Soft-Hand / Broken-In Finish · 299 GSM (`velvet__softened`)
Nominal currently stored: **299.1 GSM**; thickness **2.06 mm**; warp/weft stretch **0.028/0.0448**; bend **0.555**; friction **0.5115**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-152: Cotton Velvet · Crisp / Structured Finish · 335 GSM (`velvet__crisp`)
Nominal currently stored: **334.8 GSM**; thickness **2.06 mm**; warp/weft stretch **0.022/0.0352**; bend **0.745**; friction **0.5775**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-153: Silk Chiffon · Fine / Light Construction · 38 GSM (`silkChiffon__fine`)
Nominal currently stored: **38.5 GSM**; thickness **0.405 mm**; warp/weft stretch **0.0226/0.03955**; bend **0.12**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-154: Silk Chiffon · Dense / Firm Construction · 64 GSM (`silkChiffon__dense`)
Nominal currently stored: **64 GSM**; thickness **0.58 mm**; warp/weft stretch **0.0172/0.0301**; bend **0.27**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-155: Silk Chiffon · Soft-Hand / Broken-In Finish · 50 GSM (`silkChiffon__softened`)
Nominal currently stored: **50.2 GSM**; thickness **0.515 mm**; warp/weft stretch **0.0224/0.0392**; bend **0.12**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-156: Silk Chiffon · Crisp / Structured Finish · 56 GSM (`silkChiffon__crisp`)
Nominal currently stored: **56.2 GSM**; thickness **0.515 mm**; warp/weft stretch **0.0176/0.0308**; bend **0.285**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-157: Silk Organza · Fine / Light Construction · 28 GSM (`silkOrganza__fine`)
Nominal currently stored: **28.1 GSM**; thickness **0.308 mm**; warp/weft stretch **0.00904/0.01356**; bend **0.415**; friction **0.2016**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-158: Silk Organza · Dense / Firm Construction · 47 GSM (`silkOrganza__dense`)
Nominal currently stored: **46.7 GSM**; thickness **0.441 mm**; warp/weft stretch **0.00688/0.01032**; bend **0.57**; friction **0.2268**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-159: Silk Organza · Soft-Hand / Broken-In Finish · 37 GSM (`silkOrganza__softened`)
Nominal currently stored: **36.7 GSM**; thickness **0.391 mm**; warp/weft stretch **0.00896/0.01344**; bend **0.395**; friction **0.1953**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-160: Silk Organza · Crisp / Structured Finish · 41 GSM (`silkOrganza__crisp`)
Nominal currently stored: **41 GSM**; thickness **0.391 mm**; warp/weft stretch **0.00704/0.01056**; bend **0.585**; friction **0.2205**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-161: Cotton Corduroy · Fine / Light Construction · 274 GSM (`cottonCorduroy__fine`)
Nominal currently stored: **273.8 GSM**; thickness **2.43 mm**; warp/weft stretch **0.01695/0.03164**; bend **0.755**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-162: Cotton Corduroy · Dense / Firm Construction · 455 GSM (`cottonCorduroy__dense`)
Nominal currently stored: **455.1 GSM**; thickness **3.48 mm**; warp/weft stretch **0.0129/0.02408**; bend **0.91**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-163: Cotton Corduroy · Soft-Hand / Broken-In Finish · 357 GSM (`cottonCorduroy__softened`)
Nominal currently stored: **357.1 GSM**; thickness **3.09 mm**; warp/weft stretch **0.0168/0.03136**; bend **0.735**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-164: Cotton Corduroy · Crisp / Structured Finish · 400 GSM (`cottonCorduroy__crisp`)
Nominal currently stored: **399.6 GSM**; thickness **3.09 mm**; warp/weft stretch **0.0132/0.02464**; bend **0.925**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-165: Scuba Double Knit · Fine / Light Construction · 266 GSM (`scubaKnit__fine`)
Nominal currently stored: **266.4 GSM**; thickness **2.835 mm**; warp/weft stretch **0.2486/0.3503**; bend **0.655**; friction **0.2976**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-166: Scuba Double Knit · Dense / Firm Construction · 443 GSM (`scubaKnit__dense`)
Nominal currently stored: **442.8 GSM**; thickness **4.06 mm**; warp/weft stretch **0.1892/0.2666**; bend **0.81**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-167: Scuba Double Knit · Soft-Hand / Broken-In Finish · 347 GSM (`scubaKnit__softened`)
Nominal currently stored: **347.4 GSM**; thickness **3.605 mm**; warp/weft stretch **0.2464/0.3472**; bend **0.635**; friction **0.2883**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-168: Scuba Double Knit · Crisp / Structured Finish · 389 GSM (`scubaKnit__crisp`)
Nominal currently stored: **388.8 GSM**; thickness **3.605 mm**; warp/weft stretch **0.1936/0.2728**; bend **0.825**; friction **0.3255**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-169: Technical Softshell · Fine / Light Construction · 215 GSM (`technicalSoftshell__fine`)
Nominal currently stored: **214.6 GSM**; thickness **2.106 mm**; warp/weft stretch **0.05085/0.10735**; bend **0.675**; friction **0.2688**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-170: Technical Softshell · Dense / Firm Construction · 357 GSM (`technicalSoftshell__dense`)
Nominal currently stored: **356.7 GSM**; thickness **3.016 mm**; warp/weft stretch **0.0387/0.0817**; bend **0.83**; friction **0.3024**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-171: Technical Softshell · Soft-Hand / Broken-In Finish · 280 GSM (`technicalSoftshell__softened`)
Nominal currently stored: **279.8 GSM**; thickness **2.678 mm**; warp/weft stretch **0.0504/0.1064**; bend **0.655**; friction **0.2604**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-172: Technical Softshell · Crisp / Structured Finish · 313 GSM (`technicalSoftshell__crisp`)
Nominal currently stored: **313.2 GSM**; thickness **2.678 mm**; warp/weft stretch **0.0396/0.0836**; bend **0.845**; friction **0.294**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-173: Cotton Jersey · Fine / Light Construction · 118 GSM (`cottonLightJersey__fine`)
Nominal currently stored: **118.4 GSM**; thickness **0.851 mm**; warp/weft stretch **0.1243/0.2147**; bend **0.495**; friction **0.3264**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-174: Cotton Jersey · Dense / Firm Construction · 197 GSM (`cottonLightJersey__dense`)
Nominal currently stored: **196.8 GSM**; thickness **1.218 mm**; warp/weft stretch **0.0946/0.1634**; bend **0.65**; friction **0.3672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-175: Cotton Jersey · Soft-Hand / Broken-In Finish · 154 GSM (`cottonLightJersey__softened`)
Nominal currently stored: **154.4 GSM**; thickness **1.081 mm**; warp/weft stretch **0.1232/0.2128**; bend **0.475**; friction **0.3162**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-176: Cotton Jersey · Crisp / Structured Finish · 173 GSM (`cottonLightJersey__crisp`)
Nominal currently stored: **172.8 GSM**; thickness **1.081 mm**; warp/weft stretch **0.0968/0.1672**; bend **0.665**; friction **0.357**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-177: Cotton Jersey · Fine / Light Construction · 211 GSM (`cottonHeavyJersey__fine`)
Nominal currently stored: **210.9 GSM**; thickness **1.377 mm**; warp/weft stretch **0.0904/0.1695**; bend **0.665**; friction **0.3264**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-178: Cotton Jersey · Dense / Firm Construction · 351 GSM (`cottonHeavyJersey__dense`)
Nominal currently stored: **350.6 GSM**; thickness **1.972 mm**; warp/weft stretch **0.0688/0.129**; bend **0.82**; friction **0.3672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-179: Cotton Jersey · Soft-Hand / Broken-In Finish · 275 GSM (`cottonHeavyJersey__softened`)
Nominal currently stored: **275 GSM**; thickness **1.751 mm**; warp/weft stretch **0.0896/0.168**; bend **0.645**; friction **0.3162**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-180: Cotton Jersey · Crisp / Structured Finish · 308 GSM (`cottonHeavyJersey__crisp`)
Nominal currently stored: **307.8 GSM**; thickness **1.751 mm**; warp/weft stretch **0.0704/0.132**; bend **0.835**; friction **0.357**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-181: Cotton Interlock · Fine / Light Construction · 174 GSM (`cottonInterlock__fine`)
Nominal currently stored: **173.9 GSM**; thickness **1.458 mm**; warp/weft stretch **0.1582/0.2486**; bend **0.565**; friction **0.3264**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-182: Cotton Interlock · Dense / Firm Construction · 289 GSM (`cottonInterlock__dense`)
Nominal currently stored: **289.1 GSM**; thickness **2.088 mm**; warp/weft stretch **0.1204/0.1892**; bend **0.72**; friction **0.3672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-183: Cotton Interlock · Soft-Hand / Broken-In Finish · 227 GSM (`cottonInterlock__softened`)
Nominal currently stored: **226.8 GSM**; thickness **1.854 mm**; warp/weft stretch **0.1568/0.2464**; bend **0.545**; friction **0.3162**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-184: Cotton Interlock · Crisp / Structured Finish · 254 GSM (`cottonInterlock__crisp`)
Nominal currently stored: **253.8 GSM**; thickness **1.854 mm**; warp/weft stretch **0.1232/0.1936**; bend **0.735**; friction **0.357**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-185: Cotton Piqué · Fine / Light Construction · 167 GSM (`cottonPique__fine`)
Nominal currently stored: **166.5 GSM**; thickness **1.337 mm**; warp/weft stretch **0.0904/0.1582**; bend **0.645**; friction **0.3264**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-186: Cotton Piqué · Dense / Firm Construction · 277 GSM (`cottonPique__dense`)
Nominal currently stored: **276.8 GSM**; thickness **1.914 mm**; warp/weft stretch **0.0688/0.1204**; bend **0.8**; friction **0.3672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-187: Cotton Piqué · Soft-Hand / Broken-In Finish · 217 GSM (`cottonPique__softened`)
Nominal currently stored: **217.1 GSM**; thickness **1.7 mm**; warp/weft stretch **0.0896/0.1568**; bend **0.625**; friction **0.3162**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-188: Cotton Piqué · Crisp / Structured Finish · 243 GSM (`cottonPique__crisp`)
Nominal currently stored: **243 GSM**; thickness **1.7 mm**; warp/weft stretch **0.0704/0.1232**; bend **0.815**; friction **0.357**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-189: Cotton Waffle Knit · Fine / Light Construction · 215 GSM (`waffleKnit__fine`)
Nominal currently stored: **214.6 GSM**; thickness **2.025 mm**; warp/weft stretch **0.1808/0.3277**; bend **0.575**; friction **0.3264**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-190: Cotton Waffle Knit · Dense / Firm Construction · 357 GSM (`waffleKnit__dense`)
Nominal currently stored: **356.7 GSM**; thickness **2.9 mm**; warp/weft stretch **0.1376/0.2494**; bend **0.73**; friction **0.3672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-191: Cotton Waffle Knit · Soft-Hand / Broken-In Finish · 280 GSM (`waffleKnit__softened`)
Nominal currently stored: **279.8 GSM**; thickness **2.575 mm**; warp/weft stretch **0.1792/0.3248**; bend **0.555**; friction **0.3162**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-192: Cotton Waffle Knit · Crisp / Structured Finish · 313 GSM (`waffleKnit__crisp`)
Nominal currently stored: **313.2 GSM**; thickness **2.575 mm**; warp/weft stretch **0.1408/0.2552**; bend **0.745**; friction **0.357**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-193: Cotton 1×1 Rib · Fine / Light Construction · 181 GSM (`cottonRib1x1__fine`)
Nominal currently stored: **181.3 GSM**; thickness **1.337 mm**; warp/weft stretch **0.226/0.452**; bend **0.495**; friction **0.432**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-194: Cotton 1×1 Rib · Dense / Firm Construction · 301 GSM (`cottonRib1x1__dense`)
Nominal currently stored: **301.4 GSM**; thickness **1.914 mm**; warp/weft stretch **0.172/0.344**; bend **0.65**; friction **0.486**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-195: Cotton 1×1 Rib · Soft-Hand / Broken-In Finish · 236 GSM (`cottonRib1x1__softened`)
Nominal currently stored: **236.4 GSM**; thickness **1.7 mm**; warp/weft stretch **0.224/0.448**; bend **0.475**; friction **0.4185**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-196: Cotton 1×1 Rib · Crisp / Structured Finish · 265 GSM (`cottonRib1x1__crisp`)
Nominal currently stored: **264.6 GSM**; thickness **1.7 mm**; warp/weft stretch **0.176/0.352**; bend **0.665**; friction **0.4725**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-197: Cotton 2×2 Rib · Fine / Light Construction · 237 GSM (`cottonRib2x2__fine`)
Nominal currently stored: **236.8 GSM**; thickness **1.944 mm**; warp/weft stretch **0.226/0.5198**; bend **0.585**; friction **0.432**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-198: Cotton 2×2 Rib · Dense / Firm Construction · 394 GSM (`cottonRib2x2__dense`)
Nominal currently stored: **393.6 GSM**; thickness **2.784 mm**; warp/weft stretch **0.172/0.3956**; bend **0.74**; friction **0.486**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-199: Cotton 2×2 Rib · Soft-Hand / Broken-In Finish · 309 GSM (`cottonRib2x2__softened`)
Nominal currently stored: **308.8 GSM**; thickness **2.472 mm**; warp/weft stretch **0.224/0.5152**; bend **0.565**; friction **0.4185**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-200: Cotton 2×2 Rib · Crisp / Structured Finish · 346 GSM (`cottonRib2x2__crisp`)
Nominal currently stored: **345.6 GSM**; thickness **2.472 mm**; warp/weft stretch **0.176/0.4048**; bend **0.755**; friction **0.4725**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-201: French Terry · Fine / Light Construction · 244 GSM (`frenchTerryMid__fine`)
Nominal currently stored: **244.2 GSM**; thickness **1.903 mm**; warp/weft stretch **0.0904/0.1469**; bend **0.675**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-202: French Terry · Dense / Firm Construction · 406 GSM (`frenchTerryMid__dense`)
Nominal currently stored: **405.9 GSM**; thickness **2.726 mm**; warp/weft stretch **0.0688/0.1118**; bend **0.83**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-203: French Terry · Soft-Hand / Broken-In Finish · 318 GSM (`frenchTerryMid__softened`)
Nominal currently stored: **318.4 GSM**; thickness **2.421 mm**; warp/weft stretch **0.0896/0.1456**; bend **0.655**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-204: French Terry · Crisp / Structured Finish · 356 GSM (`frenchTerryMid__crisp`)
Nominal currently stored: **356.4 GSM**; thickness **2.421 mm**; warp/weft stretch **0.0704/0.1144**; bend **0.845**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-205: French Terry · Fine / Light Construction · 385 GSM (`frenchTerryHeavy__fine`)
Nominal currently stored: **384.8 GSM**; thickness **3.321 mm**; warp/weft stretch **0.0565/0.113**; bend **0.785**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-206: French Terry · Dense / Firm Construction · 640 GSM (`frenchTerryHeavy__dense`)
Nominal currently stored: **639.6 GSM**; thickness **4.756 mm**; warp/weft stretch **0.043/0.086**; bend **0.94**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-207: French Terry · Soft-Hand / Broken-In Finish · 502 GSM (`frenchTerryHeavy__softened`)
Nominal currently stored: **501.8 GSM**; thickness **4.223 mm**; warp/weft stretch **0.056/0.112**; bend **0.765**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-208: French Terry · Crisp / Structured Finish · 562 GSM (`frenchTerryHeavy__crisp`)
Nominal currently stored: **561.6 GSM**; thickness **4.223 mm**; warp/weft stretch **0.044/0.088**; bend **0.955**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-209: Brushed Back Sweatshirt Fleece · Fine / Light Construction · 285 GSM (`brushedFleece__fine`)
Nominal currently stored: **284.9 GSM**; thickness **2.835 mm**; warp/weft stretch **0.0791/0.1356**; bend **0.695**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-210: Brushed Back Sweatshirt Fleece · Dense / Firm Construction · 474 GSM (`brushedFleece__dense`)
Nominal currently stored: **473.6 GSM**; thickness **4.06 mm**; warp/weft stretch **0.0602/0.1032**; bend **0.85**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-211: Brushed Back Sweatshirt Fleece · Soft-Hand / Broken-In Finish · 372 GSM (`brushedFleece__softened`)
Nominal currently stored: **371.5 GSM**; thickness **3.605 mm**; warp/weft stretch **0.0784/0.1344**; bend **0.675**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-212: Brushed Back Sweatshirt Fleece · Crisp / Structured Finish · 416 GSM (`brushedFleece__crisp`)
Nominal currently stored: **415.8 GSM**; thickness **3.605 mm**; warp/weft stretch **0.0616/0.1056**; bend **0.865**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-213: Polyester Polar Fleece · Fine / Light Construction · 211 GSM (`polarFleece__fine`)
Nominal currently stored: **210.9 GSM**; thickness **3.645 mm**; warp/weft stretch **0.0904/0.1469**; bend **0.425**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-214: Polyester Polar Fleece · Dense / Firm Construction · 351 GSM (`polarFleece__dense`)
Nominal currently stored: **350.6 GSM**; thickness **5.22 mm**; warp/weft stretch **0.0688/0.1118**; bend **0.58**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-215: Polyester Polar Fleece · Soft-Hand / Broken-In Finish · 275 GSM (`polarFleece__softened`)
Nominal currently stored: **275 GSM**; thickness **4.635 mm**; warp/weft stretch **0.0896/0.1456**; bend **0.405**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-216: Polyester Polar Fleece · Crisp / Structured Finish · 308 GSM (`polarFleece__crisp`)
Nominal currently stored: **307.8 GSM**; thickness **4.635 mm**; warp/weft stretch **0.0704/0.1144**; bend **0.595**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-217: Polyester Sherpa · Fine / Light Construction · 289 GSM (`sherpa__fine`)
Nominal currently stored: **288.6 GSM**; thickness **5.022 mm**; warp/weft stretch **0.1017/0.1582**; bend **0.575**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-218: Polyester Sherpa · Dense / Firm Construction · 480 GSM (`sherpa__dense`)
Nominal currently stored: **479.7 GSM**; thickness **7.192 mm**; warp/weft stretch **0.0774/0.1204**; bend **0.73**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-219: Polyester Sherpa · Soft-Hand / Broken-In Finish · 376 GSM (`sherpa__softened`)
Nominal currently stored: **376.3 GSM**; thickness **6.386 mm**; warp/weft stretch **0.1008/0.1568**; bend **0.555**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-220: Polyester Sherpa · Crisp / Structured Finish · 421 GSM (`sherpa__crisp`)
Nominal currently stored: **421.2 GSM**; thickness **6.386 mm**; warp/weft stretch **0.0792/0.1232**; bend **0.745**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-221: Brushed Cotton Flannel · Fine / Light Construction · 144 GSM (`cottonFlannel__fine`)
Nominal currently stored: **144.3 GSM**; thickness **1.215 mm**; warp/weft stretch **0.0226/0.0452**; bend **0.615**; friction **0.3456**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-222: Brushed Cotton Flannel · Dense / Firm Construction · 240 GSM (`cottonFlannel__dense`)
Nominal currently stored: **239.8 GSM**; thickness **1.74 mm**; warp/weft stretch **0.0172/0.0344**; bend **0.77**; friction **0.3888**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-223: Brushed Cotton Flannel · Soft-Hand / Broken-In Finish · 188 GSM (`cottonFlannel__softened`)
Nominal currently stored: **188.2 GSM**; thickness **1.545 mm**; warp/weft stretch **0.0224/0.0448**; bend **0.595**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-224: Brushed Cotton Flannel · Crisp / Structured Finish · 211 GSM (`cottonFlannel__crisp`)
Nominal currently stored: **210.6 GSM**; thickness **1.545 mm**; warp/weft stretch **0.0176/0.0352**; bend **0.785**; friction **0.378**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-225: Cotton Oxford Shirting · Fine / Light Construction · 126 GSM (`cottonOxford__fine`)
Nominal currently stored: **125.8 GSM**; thickness **0.891 mm**; warp/weft stretch **0.0226/0.0452**; bend **0.675**; friction **0.3456**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-226: Cotton Oxford Shirting · Dense / Firm Construction · 209 GSM (`cottonOxford__dense`)
Nominal currently stored: **209.1 GSM**; thickness **1.276 mm**; warp/weft stretch **0.0172/0.0344**; bend **0.83**; friction **0.3888**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-227: Cotton Oxford Shirting · Soft-Hand / Broken-In Finish · 164 GSM (`cottonOxford__softened`)
Nominal currently stored: **164 GSM**; thickness **1.133 mm**; warp/weft stretch **0.0224/0.0448**; bend **0.655**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-228: Cotton Oxford Shirting · Crisp / Structured Finish · 184 GSM (`cottonOxford__crisp`)
Nominal currently stored: **183.6 GSM**; thickness **1.133 mm**; warp/weft stretch **0.0176/0.0352**; bend **0.845**; friction **0.378**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-229: Cotton Broadcloth · Fine / Light Construction · 96 GSM (`cottonBroadcloth__fine`)
Nominal currently stored: **96.2 GSM**; thickness **0.729 mm**; warp/weft stretch **0.01695/0.02825**; bend **0.645**; friction **0.3456**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-230: Cotton Broadcloth · Dense / Firm Construction · 160 GSM (`cottonBroadcloth__dense`)
Nominal currently stored: **159.9 GSM**; thickness **1.044 mm**; warp/weft stretch **0.0129/0.0215**; bend **0.8**; friction **0.3888**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-231: Cotton Broadcloth · Soft-Hand / Broken-In Finish · 125 GSM (`cottonBroadcloth__softened`)
Nominal currently stored: **125.5 GSM**; thickness **0.927 mm**; warp/weft stretch **0.0168/0.028**; bend **0.625**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-232: Cotton Broadcloth · Crisp / Structured Finish · 140 GSM (`cottonBroadcloth__crisp`)
Nominal currently stored: **140.4 GSM**; thickness **0.927 mm**; warp/weft stretch **0.0132/0.022**; bend **0.815**; friction **0.378**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-233: Cotton Chambray · Fine / Light Construction · 111 GSM (`cottonChambray__fine`)
Nominal currently stored: **111 GSM**; thickness **0.891 mm**; warp/weft stretch **0.01695/0.0339**; bend **0.615**; friction **0.3456**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-234: Cotton Chambray · Dense / Firm Construction · 185 GSM (`cottonChambray__dense`)
Nominal currently stored: **184.5 GSM**; thickness **1.276 mm**; warp/weft stretch **0.0129/0.0258**; bend **0.77**; friction **0.3888**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-235: Cotton Chambray · Soft-Hand / Broken-In Finish · 145 GSM (`cottonChambray__softened`)
Nominal currently stored: **144.8 GSM**; thickness **1.133 mm**; warp/weft stretch **0.0168/0.0336**; bend **0.595**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-236: Cotton Chambray · Crisp / Structured Finish · 162 GSM (`cottonChambray__crisp`)
Nominal currently stored: **162 GSM**; thickness **1.133 mm**; warp/weft stretch **0.0132/0.0264**; bend **0.785**; friction **0.378**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-237: Cotton Workwear Twill · Fine / Light Construction · 215 GSM (`cottonTwill__fine`)
Nominal currently stored: **214.6 GSM**; thickness **1.417 mm**; warp/weft stretch **0.01695/0.02825**; bend **0.785**; friction **0.4608**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-238: Cotton Workwear Twill · Dense / Firm Construction · 357 GSM (`cottonTwill__dense`)
Nominal currently stored: **356.7 GSM**; thickness **2.03 mm**; warp/weft stretch **0.0129/0.0215**; bend **0.94**; friction **0.5184**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-239: Cotton Workwear Twill · Soft-Hand / Broken-In Finish · 280 GSM (`cottonTwill__softened`)
Nominal currently stored: **279.8 GSM**; thickness **1.802 mm**; warp/weft stretch **0.0168/0.028**; bend **0.765**; friction **0.4464**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-240: Cotton Workwear Twill · Crisp / Structured Finish · 313 GSM (`cottonTwill__crisp`)
Nominal currently stored: **313.2 GSM**; thickness **1.802 mm**; warp/weft stretch **0.0132/0.022**; bend **0.955**; friction **0.504**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-241: Cotton Duck Canvas · Fine / Light Construction · 300 GSM (`cottonDuck__fine`)
Nominal currently stored: **299.7 GSM**; thickness **2.511 mm**; warp/weft stretch **0.00904/0.01582**; bend **0.875**; friction **0.4608**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-242: Cotton Duck Canvas · Dense / Firm Construction · 498 GSM (`cottonDuck__dense`)
Nominal currently stored: **498.1 GSM**; thickness **3.596 mm**; warp/weft stretch **0.00688/0.01204**; bend **0.985**; friction **0.5184**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-243: Cotton Duck Canvas · Soft-Hand / Broken-In Finish · 391 GSM (`cottonDuck__softened`)
Nominal currently stored: **390.8 GSM**; thickness **3.193 mm**; warp/weft stretch **0.00896/0.01568**; bend **0.855**; friction **0.4464**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-244: Cotton Duck Canvas · Crisp / Structured Finish · 437 GSM (`cottonDuck__crisp`)
Nominal currently stored: **437.4 GSM**; thickness **3.193 mm**; warp/weft stretch **0.00704/0.01232**; bend **0.985**; friction **0.504**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-245: Waxed Cotton Canvas · Fine / Light Construction · 266 GSM (`waxedCanvas__fine`)
Nominal currently stored: **266.4 GSM**; thickness **2.025 mm**; warp/weft stretch **0.0113/0.01695**; bend **0.815**; friction **0.4608**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-246: Waxed Cotton Canvas · Dense / Firm Construction · 443 GSM (`waxedCanvas__dense`)
Nominal currently stored: **442.8 GSM**; thickness **2.9 mm**; warp/weft stretch **0.0086/0.0129**; bend **0.97**; friction **0.5184**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-247: Waxed Cotton Canvas · Soft-Hand / Broken-In Finish · 347 GSM (`waxedCanvas__softened`)
Nominal currently stored: **347.4 GSM**; thickness **2.575 mm**; warp/weft stretch **0.0112/0.0168**; bend **0.795**; friction **0.4464**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-248: Waxed Cotton Canvas · Crisp / Structured Finish · 389 GSM (`waxedCanvas__crisp`)
Nominal currently stored: **388.8 GSM**; thickness **2.575 mm**; warp/weft stretch **0.0088/0.0132**; bend **0.985**; friction **0.504**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-249: Linen Shirting · Fine / Light Construction · 107 GSM (`linenShirting__fine`)
Nominal currently stored: **107.3 GSM**; thickness **0.689 mm**; warp/weft stretch **0.01356/0.02034**; bend **0.575**; friction **0.3744**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-250: Linen Shirting · Dense / Firm Construction · 178 GSM (`linenShirting__dense`)
Nominal currently stored: **178.3 GSM**; thickness **0.986 mm**; warp/weft stretch **0.01032/0.01548**; bend **0.73**; friction **0.4212**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-251: Linen Shirting · Soft-Hand / Broken-In Finish · 140 GSM (`linenShirting__softened`)
Nominal currently stored: **139.9 GSM**; thickness **0.875 mm**; warp/weft stretch **0.01344/0.02016**; bend **0.555**; friction **0.3627**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-252: Linen Shirting · Crisp / Structured Finish · 157 GSM (`linenShirting__crisp`)
Nominal currently stored: **156.6 GSM**; thickness **0.875 mm**; warp/weft stretch **0.01056/0.01584**; bend **0.745**; friction **0.4095**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-253: Linen · Fine / Light Construction · 211 GSM (`linenHeavy__fine`)
Nominal currently stored: **210.9 GSM**; thickness **1.579 mm**; warp/weft stretch **0.0113/0.0226**; bend **0.725**; friction **0.3744**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-254: Linen · Dense / Firm Construction · 351 GSM (`linenHeavy__dense`)
Nominal currently stored: **350.6 GSM**; thickness **2.262 mm**; warp/weft stretch **0.0086/0.0172**; bend **0.88**; friction **0.4212**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-255: Linen · Soft-Hand / Broken-In Finish · 275 GSM (`linenHeavy__softened`)
Nominal currently stored: **275 GSM**; thickness **2.008 mm**; warp/weft stretch **0.0112/0.0224**; bend **0.705**; friction **0.3627**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-256: Linen · Crisp / Structured Finish · 308 GSM (`linenHeavy__crisp`)
Nominal currently stored: **307.8 GSM**; thickness **2.008 mm**; warp/weft stretch **0.0088/0.0176**; bend **0.895**; friction **0.4095**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-257: Hemp Canvas · Fine / Light Construction · 270 GSM (`hempCanvas__fine`)
Nominal currently stored: **270.1 GSM**; thickness **2.066 mm**; warp/weft stretch **0.01017/0.01921**; bend **0.835**; friction **0.4608**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-258: Hemp Canvas · Dense / Firm Construction · 449 GSM (`hempCanvas__dense`)
Nominal currently stored: **448.9 GSM**; thickness **2.958 mm**; warp/weft stretch **0.00774/0.01462**; bend **0.985**; friction **0.5184**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-259: Hemp Canvas · Soft-Hand / Broken-In Finish · 352 GSM (`hempCanvas__softened`)
Nominal currently stored: **352.2 GSM**; thickness **2.627 mm**; warp/weft stretch **0.01008/0.01904**; bend **0.815**; friction **0.4464**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-260: Hemp Canvas · Crisp / Structured Finish · 394 GSM (`hempCanvas__crisp`)
Nominal currently stored: **394.2 GSM**; thickness **2.627 mm**; warp/weft stretch **0.00792/0.01496**; bend **0.985**; friction **0.504**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-261: Raw Indigo Denim · Fine / Light Construction · 352 GSM (`rawDenim__fine`)
Nominal currently stored: **351.5 GSM**; thickness **1.174 mm**; warp/weft stretch **0.00904/0.01695**; bend **0.865**; friction **0.4032**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-262: Raw Indigo Denim · Dense / Firm Construction · 584 GSM (`rawDenim__dense`)
Nominal currently stored: **584.3 GSM**; thickness **1.682 mm**; warp/weft stretch **0.00688/0.0129**; bend **0.985**; friction **0.4536**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-263: Raw Indigo Denim · Soft-Hand / Broken-In Finish · 458 GSM (`rawDenim__softened`)
Nominal currently stored: **458.4 GSM**; thickness **1.494 mm**; warp/weft stretch **0.00896/0.0168**; bend **0.845**; friction **0.3906**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-264: Raw Indigo Denim · Crisp / Structured Finish · 513 GSM (`rawDenim__crisp`)
Nominal currently stored: **513 GSM**; thickness **1.494 mm**; warp/weft stretch **0.00704/0.0132**; bend **0.985**; friction **0.441**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-265: Denim · Fine / Light Construction · 200 GSM (`lightDenim__fine`)
Nominal currently stored: **199.8 GSM**; thickness **0.769 mm**; warp/weft stretch **0.01695/0.03164**; bend **0.685**; friction **0.4032**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-266: Denim · Dense / Firm Construction · 332 GSM (`lightDenim__dense`)
Nominal currently stored: **332.1 GSM**; thickness **1.102 mm**; warp/weft stretch **0.0129/0.02408**; bend **0.84**; friction **0.4536**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-267: Denim · Soft-Hand / Broken-In Finish · 261 GSM (`lightDenim__softened`)
Nominal currently stored: **260.6 GSM**; thickness **0.979 mm**; warp/weft stretch **0.0168/0.03136**; bend **0.665**; friction **0.3906**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-268: Denim · Crisp / Structured Finish · 292 GSM (`lightDenim__crisp`)
Nominal currently stored: **291.6 GSM**; thickness **0.979 mm**; warp/weft stretch **0.0132/0.02464**; bend **0.855**; friction **0.441**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-269: Denim · Fine / Light Construction · 451 GSM (`heavyDenim__fine`)
Nominal currently stored: **451.4 GSM**; thickness **1.863 mm**; warp/weft stretch **0.00678/0.0113**; bend **0.885**; friction **0.4032**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-270: Denim · Dense / Firm Construction · 750 GSM (`heavyDenim__dense`)
Nominal currently stored: **750.3 GSM**; thickness **2.668 mm**; warp/weft stretch **0.00516/0.0086**; bend **0.985**; friction **0.4536**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-271: Denim · Soft-Hand / Broken-In Finish · 589 GSM (`heavyDenim__softened`)
Nominal currently stored: **588.6 GSM**; thickness **2.369 mm**; warp/weft stretch **0.00672/0.0112**; bend **0.865**; friction **0.3906**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-272: Denim · Crisp / Structured Finish · 659 GSM (`heavyDenim__crisp`)
Nominal currently stored: **658.8 GSM**; thickness **2.369 mm**; warp/weft stretch **0.00528/0.0088**; bend **0.985**; friction **0.441**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-273: Cotton Elastane Denim · Fine / Light Construction · 259 GSM (`denimCottonElastane__fine`)
Nominal currently stored: **259 GSM**; thickness **0.931 mm**; warp/weft stretch **0.0339/0.2034**; bend **0.685**; friction **0.4032**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-274: Cotton Elastane Denim · Dense / Firm Construction · 431 GSM (`denimCottonElastane__dense`)
Nominal currently stored: **430.5 GSM**; thickness **1.334 mm**; warp/weft stretch **0.0258/0.1548**; bend **0.84**; friction **0.4536**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-275: Cotton Elastane Denim · Soft-Hand / Broken-In Finish · 338 GSM (`denimCottonElastane__softened`)
Nominal currently stored: **337.8 GSM**; thickness **1.185 mm**; warp/weft stretch **0.0336/0.2016**; bend **0.665**; friction **0.3906**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-276: Cotton Elastane Denim · Crisp / Structured Finish · 378 GSM (`denimCottonElastane__crisp`)
Nominal currently stored: **378 GSM**; thickness **1.185 mm**; warp/weft stretch **0.0264/0.1584**; bend **0.855**; friction **0.441**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-277: Wool Flannel · Fine / Light Construction · 204 GSM (`woolFlannel__fine`)
Nominal currently stored: **203.5 GSM**; thickness **1.539 mm**; warp/weft stretch **0.0339/0.0565**; bend **0.595**; friction **0.4128**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-278: Wool Flannel · Dense / Firm Construction · 338 GSM (`woolFlannel__dense`)
Nominal currently stored: **338.3 GSM**; thickness **2.204 mm**; warp/weft stretch **0.0258/0.043**; bend **0.75**; friction **0.4644**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-279: Wool Flannel · Soft-Hand / Broken-In Finish · 265 GSM (`woolFlannel__softened`)
Nominal currently stored: **265.4 GSM**; thickness **1.957 mm**; warp/weft stretch **0.0336/0.056**; bend **0.575**; friction **0.3999**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-280: Wool Flannel · Crisp / Structured Finish · 297 GSM (`woolFlannel__crisp`)
Nominal currently stored: **297 GSM**; thickness **1.957 mm**; warp/weft stretch **0.0264/0.044**; bend **0.765**; friction **0.4515**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-281: Wool Gabardine · Fine / Light Construction · 207 GSM (`woolGabardine__fine`)
Nominal currently stored: **207.2 GSM**; thickness **1.174 mm**; warp/weft stretch **0.02599/0.03616**; bend **0.735**; friction **0.4128**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-282: Wool Gabardine · Dense / Firm Construction · 344 GSM (`woolGabardine__dense`)
Nominal currently stored: **344.4 GSM**; thickness **1.682 mm**; warp/weft stretch **0.01978/0.02752**; bend **0.89**; friction **0.4644**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-283: Wool Gabardine · Soft-Hand / Broken-In Finish · 270 GSM (`woolGabardine__softened`)
Nominal currently stored: **270.2 GSM**; thickness **1.494 mm**; warp/weft stretch **0.02576/0.03584**; bend **0.715**; friction **0.3999**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-284: Wool Gabardine · Crisp / Structured Finish · 302 GSM (`woolGabardine__crisp`)
Nominal currently stored: **302.4 GSM**; thickness **1.494 mm**; warp/weft stretch **0.02024/0.02816**; bend **0.905**; friction **0.4515**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-285: Wool Tweed · Fine / Light Construction · 303 GSM (`woolTweed__fine`)
Nominal currently stored: **303.4 GSM**; thickness **2.308 mm**; warp/weft stretch **0.0226/0.03955**; bend **0.745**; friction **0.5376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-286: Wool Tweed · Dense / Firm Construction · 504 GSM (`woolTweed__dense`)
Nominal currently stored: **504.3 GSM**; thickness **3.306 mm**; warp/weft stretch **0.0172/0.0301**; bend **0.9**; friction **0.6048**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-287: Wool Tweed · Soft-Hand / Broken-In Finish · 396 GSM (`woolTweed__softened`)
Nominal currently stored: **395.6 GSM**; thickness **2.936 mm**; warp/weft stretch **0.0224/0.0392**; bend **0.725**; friction **0.5208**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-288: Wool Tweed · Crisp / Structured Finish · 443 GSM (`woolTweed__crisp`)
Nominal currently stored: **442.8 GSM**; thickness **2.936 mm**; warp/weft stretch **0.0176/0.0308**; bend **0.915**; friction **0.588**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-289: Bouclé Wool Blend · Fine / Light Construction · 340 GSM (`boucle__fine`)
Nominal currently stored: **340.4 GSM**; thickness **3.402 mm**; warp/weft stretch **0.0678/0.0904**; bend **0.595**; friction **0.5376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-290: Bouclé Wool Blend · Dense / Firm Construction · 566 GSM (`boucle__dense`)
Nominal currently stored: **565.8 GSM**; thickness **4.872 mm**; warp/weft stretch **0.0516/0.0688**; bend **0.75**; friction **0.6048**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-291: Bouclé Wool Blend · Soft-Hand / Broken-In Finish · 444 GSM (`boucle__softened`)
Nominal currently stored: **443.9 GSM**; thickness **4.326 mm**; warp/weft stretch **0.0672/0.0896**; bend **0.575**; friction **0.5208**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-292: Bouclé Wool Blend · Crisp / Structured Finish · 497 GSM (`boucle__crisp`)
Nominal currently stored: **496.8 GSM**; thickness **4.326 mm**; warp/weft stretch **0.0528/0.0704**; bend **0.765**; friction **0.588**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-293: Cashmere Sweater Knit · Fine / Light Construction · 167 GSM (`cashmereKnit__fine`)
Nominal currently stored: **166.5 GSM**; thickness **1.701 mm**; warp/weft stretch **0.1356/0.2373**; bend **0.375**; friction **0.432**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-294: Cashmere Sweater Knit · Dense / Firm Construction · 277 GSM (`cashmereKnit__dense`)
Nominal currently stored: **276.8 GSM**; thickness **2.436 mm**; warp/weft stretch **0.1032/0.1806**; bend **0.53**; friction **0.486**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-295: Cashmere Sweater Knit · Soft-Hand / Broken-In Finish · 217 GSM (`cashmereKnit__softened`)
Nominal currently stored: **217.1 GSM**; thickness **2.163 mm**; warp/weft stretch **0.1344/0.2352**; bend **0.355**; friction **0.4185**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-296: Cashmere Sweater Knit · Crisp / Structured Finish · 243 GSM (`cashmereKnit__crisp`)
Nominal currently stored: **243 GSM**; thickness **2.163 mm**; warp/weft stretch **0.1056/0.1848**; bend **0.545**; friction **0.4725**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-297: Viscose Challis · Fine / Light Construction · 93 GSM (`viscoseChallis__fine`)
Nominal currently stored: **92.5 GSM**; thickness **0.607 mm**; warp/weft stretch **0.0452/0.0678**; bend **0.245**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-298: Viscose Challis · Dense / Firm Construction · 154 GSM (`viscoseChallis__dense`)
Nominal currently stored: **153.8 GSM**; thickness **0.87 mm**; warp/weft stretch **0.0344/0.0516**; bend **0.4**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-299: Viscose Challis · Soft-Hand / Broken-In Finish · 121 GSM (`viscoseChallis__softened`)
Nominal currently stored: **120.6 GSM**; thickness **0.772 mm**; warp/weft stretch **0.0448/0.0672**; bend **0.225**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-300: Viscose Challis · Crisp / Structured Finish · 135 GSM (`viscoseChallis__crisp`)
Nominal currently stored: **135 GSM**; thickness **0.772 mm**; warp/weft stretch **0.0352/0.0528**; bend **0.415**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-301: Lyocell Twill · Fine / Light Construction · 144 GSM (`tencelTwill__fine`)
Nominal currently stored: **144.3 GSM**; thickness **0.769 mm**; warp/weft stretch **0.04294/0.06554**; bend **0.335**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-302: Lyocell Twill · Dense / Firm Construction · 240 GSM (`tencelTwill__dense`)
Nominal currently stored: **239.8 GSM**; thickness **1.102 mm**; warp/weft stretch **0.03268/0.04988**; bend **0.49**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-303: Lyocell Twill · Soft-Hand / Broken-In Finish · 188 GSM (`tencelTwill__softened`)
Nominal currently stored: **188.2 GSM**; thickness **0.979 mm**; warp/weft stretch **0.04256/0.06496**; bend **0.315**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-304: Lyocell Twill · Crisp / Structured Finish · 211 GSM (`tencelTwill__crisp`)
Nominal currently stored: **210.6 GSM**; thickness **0.979 mm**; warp/weft stretch **0.03344/0.05104**; bend **0.505**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-305: Rayon Crêpe · Fine / Light Construction · 107 GSM (`rayonCrepe__fine`)
Nominal currently stored: **107.3 GSM**; thickness **0.81 mm**; warp/weft stretch **0.0565/0.0791**; bend **0.275**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-306: Rayon Crêpe · Dense / Firm Construction · 178 GSM (`rayonCrepe__dense`)
Nominal currently stored: **178.3 GSM**; thickness **1.16 mm**; warp/weft stretch **0.043/0.0602**; bend **0.43**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-307: Rayon Crêpe · Soft-Hand / Broken-In Finish · 140 GSM (`rayonCrepe__softened`)
Nominal currently stored: **139.9 GSM**; thickness **1.03 mm**; warp/weft stretch **0.056/0.0784**; bend **0.255**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-308: Rayon Crêpe · Crisp / Structured Finish · 157 GSM (`rayonCrepe__crisp`)
Nominal currently stored: **156.6 GSM**; thickness **1.03 mm**; warp/weft stretch **0.044/0.0616**; bend **0.445**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-309: Silk Charmeuse · Fine / Light Construction · 67 GSM (`silkCharmeuse__fine`)
Nominal currently stored: **66.6 GSM**; thickness **0.405 mm**; warp/weft stretch **0.0339/0.0565**; bend **0.215**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-310: Silk Charmeuse · Dense / Firm Construction · 111 GSM (`silkCharmeuse__dense`)
Nominal currently stored: **110.7 GSM**; thickness **0.58 mm**; warp/weft stretch **0.0258/0.043**; bend **0.37**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-311: Silk Charmeuse · Soft-Hand / Broken-In Finish · 87 GSM (`silkCharmeuse__softened`)
Nominal currently stored: **86.8 GSM**; thickness **0.515 mm**; warp/weft stretch **0.0336/0.056**; bend **0.195**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-312: Silk Charmeuse · Crisp / Structured Finish · 97 GSM (`silkCharmeuse__crisp`)
Nominal currently stored: **97.2 GSM**; thickness **0.515 mm**; warp/weft stretch **0.0264/0.044**; bend **0.385**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-313: Silk Georgette · Fine / Light Construction · 52 GSM (`silkGeorgette__fine`)
Nominal currently stored: **51.8 GSM**; thickness **0.34 mm**; warp/weft stretch **0.0452/0.0678**; bend **0.165**; friction **0.2112**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-314: Silk Georgette · Dense / Firm Construction · 86 GSM (`silkGeorgette__dense`)
Nominal currently stored: **86.1 GSM**; thickness **0.487 mm**; warp/weft stretch **0.0344/0.0516**; bend **0.32**; friction **0.2376**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-315: Silk Georgette · Soft-Hand / Broken-In Finish · 68 GSM (`silkGeorgette__softened`)
Nominal currently stored: **67.5 GSM**; thickness **0.433 mm**; warp/weft stretch **0.0448/0.0672**; bend **0.145**; friction **0.2046**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-316: Silk Georgette · Crisp / Structured Finish · 76 GSM (`silkGeorgette__crisp`)
Nominal currently stored: **75.6 GSM**; thickness **0.433 mm**; warp/weft stretch **0.0352/0.0528**; bend **0.335**; friction **0.231**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-317: Polyester Satin · Fine / Light Construction · 115 GSM (`polySatin__fine`)
Nominal currently stored: **114.7 GSM**; thickness **0.689 mm**; warp/weft stretch **0.02825/0.0452**; bend **0.395**; friction **0.1824**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-318: Polyester Satin · Dense / Firm Construction · 191 GSM (`polySatin__dense`)
Nominal currently stored: **190.7 GSM**; thickness **0.986 mm**; warp/weft stretch **0.0215/0.0344**; bend **0.55**; friction **0.2052**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-319: Polyester Satin · Soft-Hand / Broken-In Finish · 150 GSM (`polySatin__softened`)
Nominal currently stored: **149.6 GSM**; thickness **0.875 mm**; warp/weft stretch **0.028/0.0448**; bend **0.375**; friction **0.1767**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-320: Polyester Satin · Crisp / Structured Finish · 167 GSM (`polySatin__crisp`)
Nominal currently stored: **167.4 GSM**; thickness **0.875 mm**; warp/weft stretch **0.022/0.0352**; bend **0.565**; friction **0.1995**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-321: Polyester Taffeta · Fine / Light Construction · 74 GSM (`polyTaffeta__fine`)
Nominal currently stored: **74 GSM**; thickness **0.47 mm**; warp/weft stretch **0.01695/0.02825**; bend **0.615**; friction **0.2784**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-322: Polyester Taffeta · Dense / Firm Construction · 123 GSM (`polyTaffeta__dense`)
Nominal currently stored: **123 GSM**; thickness **0.673 mm**; warp/weft stretch **0.0129/0.0215**; bend **0.77**; friction **0.3132**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-323: Polyester Taffeta · Soft-Hand / Broken-In Finish · 97 GSM (`polyTaffeta__softened`)
Nominal currently stored: **96.5 GSM**; thickness **0.597 mm**; warp/weft stretch **0.0168/0.028**; bend **0.595**; friction **0.2697**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-324: Polyester Taffeta · Crisp / Structured Finish · 108 GSM (`polyTaffeta__crisp`)
Nominal currently stored: **108 GSM**; thickness **0.597 mm**; warp/weft stretch **0.0132/0.022**; bend **0.785**; friction **0.3045**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-325: Athletic Polyester Mesh · Fine / Light Construction · 96 GSM (`polyMesh__fine`)
Nominal currently stored: **96.2 GSM**; thickness **1.012 mm**; warp/weft stretch **0.1695/0.3051**; bend **0.325**; friction **0.2784**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-326: Athletic Polyester Mesh · Dense / Firm Construction · 160 GSM (`polyMesh__dense`)
Nominal currently stored: **159.9 GSM**; thickness **1.45 mm**; warp/weft stretch **0.129/0.2322**; bend **0.48**; friction **0.3132**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-327: Athletic Polyester Mesh · Soft-Hand / Broken-In Finish · 125 GSM (`polyMesh__softened`)
Nominal currently stored: **125.5 GSM**; thickness **1.288 mm**; warp/weft stretch **0.168/0.3024**; bend **0.305**; friction **0.2697**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-328: Athletic Polyester Mesh · Crisp / Structured Finish · 140 GSM (`polyMesh__crisp`)
Nominal currently stored: **140.4 GSM**; thickness **1.288 mm**; warp/weft stretch **0.132/0.2376**; bend **0.495**; friction **0.3045**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-329: Nylon Spandex Power Mesh · Fine / Light Construction · 133 GSM (`powerMesh__fine`)
Nominal currently stored: **133.2 GSM**; thickness **0.729 mm**; warp/weft stretch **0.3164/0.5424**; bend **0.365**; friction **0.432**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-330: Nylon Spandex Power Mesh · Dense / Firm Construction · 221 GSM (`powerMesh__dense`)
Nominal currently stored: **221.4 GSM**; thickness **1.044 mm**; warp/weft stretch **0.2408/0.4128**; bend **0.52**; friction **0.486**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-331: Nylon Spandex Power Mesh · Soft-Hand / Broken-In Finish · 174 GSM (`powerMesh__softened`)
Nominal currently stored: **173.7 GSM**; thickness **0.927 mm**; warp/weft stretch **0.3136/0.5376**; bend **0.345**; friction **0.4185**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-332: Nylon Spandex Power Mesh · Crisp / Structured Finish · 194 GSM (`powerMesh__crisp`)
Nominal currently stored: **194.4 GSM**; thickness **0.927 mm**; warp/weft stretch **0.2464/0.4224**; bend **0.535**; friction **0.4725**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-333: Stretch Nylon Spandex Tricot · Fine / Light Construction · 178 GSM (`spandexTricot__fine`)
Nominal currently stored: **177.6 GSM**; thickness **0.567 mm**; warp/weft stretch **0.452/0.6215**; bend **0.305**; friction **0.432**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-334: Stretch Nylon Spandex Tricot · Dense / Firm Construction · 295 GSM (`spandexTricot__dense`)
Nominal currently stored: **295.2 GSM**; thickness **0.812 mm**; warp/weft stretch **0.344/0.473**; bend **0.46**; friction **0.486**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-335: Stretch Nylon Spandex Tricot · Soft-Hand / Broken-In Finish · 232 GSM (`spandexTricot__softened`)
Nominal currently stored: **231.6 GSM**; thickness **0.721 mm**; warp/weft stretch **0.448/0.616**; bend **0.285**; friction **0.4185**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-336: Stretch Nylon Spandex Tricot · Crisp / Structured Finish · 259 GSM (`spandexTricot__crisp`)
Nominal currently stored: **259.2 GSM**; thickness **0.721 mm**; warp/weft stretch **0.352/0.484**; bend **0.475**; friction **0.4725**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-337: Neoprene Laminated Foam · Fine / Light Construction · 437 GSM (`neoprene__fine`)
Nominal currently stored: **436.6 GSM**; thickness **3.078 mm**; warp/weft stretch **0.1469/0.2599**; bend **0.825**; friction **0.2976**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-338: Neoprene Laminated Foam · Dense / Firm Construction · 726 GSM (`neoprene__dense`)
Nominal currently stored: **725.7 GSM**; thickness **4.408 mm**; warp/weft stretch **0.1118/0.1978**; bend **0.98**; friction **0.3348**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-339: Neoprene Laminated Foam · Soft-Hand / Broken-In Finish · 569 GSM (`neoprene__softened`)
Nominal currently stored: **569.4 GSM**; thickness **3.914 mm**; warp/weft stretch **0.1456/0.2576**; bend **0.805**; friction **0.2883**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-340: Neoprene Laminated Foam · Crisp / Structured Finish · 637 GSM (`neoprene__crisp`)
Nominal currently stored: **637.2 GSM**; thickness **3.914 mm**; warp/weft stretch **0.1144/0.2024**; bend **0.985**; friction **0.3255**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-341: Coated Nylon Jacket Shell · Fine / Light Construction · 70 GSM (`shellNylon__fine`)
Nominal currently stored: **70.3 GSM**; thickness **0.146 mm**; warp/weft stretch **0.0113/0.01695**; bend **0.385**; friction **0.2784**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-342: Coated Nylon Jacket Shell · Dense / Firm Construction · 117 GSM (`shellNylon__dense`)
Nominal currently stored: **116.8 GSM**; thickness **0.209 mm**; warp/weft stretch **0.0086/0.0129**; bend **0.54**; friction **0.3132**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-343: Coated Nylon Jacket Shell · Soft-Hand / Broken-In Finish · 92 GSM (`shellNylon__softened`)
Nominal currently stored: **91.7 GSM**; thickness **0.185 mm**; warp/weft stretch **0.0112/0.0168**; bend **0.365**; friction **0.2697**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-344: Coated Nylon Jacket Shell · Crisp / Structured Finish · 103 GSM (`shellNylon__crisp`)
Nominal currently stored: **102.6 GSM**; thickness **0.185 mm**; warp/weft stretch **0.0088/0.0132**; bend **0.555**; friction **0.3045**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-345: Nylon Ripstop · Fine / Light Construction · 41 GSM (`ripstopUltralight__fine`)
Nominal currently stored: **40.7 GSM**; thickness **0.13 mm**; warp/weft stretch **0.0113/0.0226**; bend **0.265**; friction **0.288**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-346: Nylon Ripstop · Dense / Firm Construction · 68 GSM (`ripstopUltralight__dense`)
Nominal currently stored: **67.7 GSM**; thickness **0.186 mm**; warp/weft stretch **0.0086/0.0172**; bend **0.42**; friction **0.324**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-347: Nylon Ripstop · Soft-Hand / Broken-In Finish · 53 GSM (`ripstopUltralight__softened`)
Nominal currently stored: **53.1 GSM**; thickness **0.165 mm**; warp/weft stretch **0.0112/0.0224**; bend **0.245**; friction **0.279**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-348: Nylon Ripstop · Crisp / Structured Finish · 59 GSM (`ripstopUltralight__crisp`)
Nominal currently stored: **59.4 GSM**; thickness **0.165 mm**; warp/weft stretch **0.0088/0.0176**; bend **0.435**; friction **0.315**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-349: Polyester Tulle Net · Fine / Light Construction · 36 GSM (`polyTulle__fine`)
Nominal currently stored: **35.5 GSM**; thickness **0.324 mm**; warp/weft stretch **0.113/0.1921**; bend **0.265**; friction **0.2016**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-350: Polyester Tulle Net · Dense / Firm Construction · 59 GSM (`polyTulle__dense`)
Nominal currently stored: **59 GSM**; thickness **0.464 mm**; warp/weft stretch **0.086/0.1462**; bend **0.42**; friction **0.2268**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-351: Polyester Tulle Net · Soft-Hand / Broken-In Finish · 46 GSM (`polyTulle__softened`)
Nominal currently stored: **46.3 GSM**; thickness **0.412 mm**; warp/weft stretch **0.112/0.1904**; bend **0.245**; friction **0.1953**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-352: Polyester Tulle Net · Crisp / Structured Finish · 52 GSM (`polyTulle__crisp`)
Nominal currently stored: **51.8 GSM**; thickness **0.412 mm**; warp/weft stretch **0.088/0.1496**; bend **0.435**; friction **0.2205**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-353: Polyurethane Coated Textile · Fine / Light Construction · 400 GSM (`veganLeather__fine`)
Nominal currently stored: **399.6 GSM**; thickness **0.972 mm**; warp/weft stretch **0.0339/0.0678**; bend **0.775**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-354: Polyurethane Coated Textile · Dense / Firm Construction · 664 GSM (`veganLeather__dense`)
Nominal currently stored: **664.2 GSM**; thickness **1.392 mm**; warp/weft stretch **0.0258/0.0516**; bend **0.93**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-355: Polyurethane Coated Textile · Soft-Hand / Broken-In Finish · 521 GSM (`veganLeather__softened`)
Nominal currently stored: **521.1 GSM**; thickness **1.236 mm**; warp/weft stretch **0.0336/0.0672**; bend **0.755**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-356: Polyurethane Coated Textile · Crisp / Structured Finish · 583 GSM (`veganLeather__crisp`)
Nominal currently stored: **583.2 GSM**; thickness **1.236 mm**; warp/weft stretch **0.0264/0.0528**; bend **0.945**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-357: Lambskin Garment Leather · Fine / Light Construction · 340 GSM (`lambskin__fine`)
Nominal currently stored: **340.4 GSM**; thickness **0.648 mm**; warp/weft stretch **0.0452/0.0791**; bend **0.555**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-358: Lambskin Garment Leather · Dense / Firm Construction · 566 GSM (`lambskin__dense`)
Nominal currently stored: **565.8 GSM**; thickness **0.928 mm**; warp/weft stretch **0.0344/0.0602**; bend **0.71**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-359: Lambskin Garment Leather · Soft-Hand / Broken-In Finish · 444 GSM (`lambskin__softened`)
Nominal currently stored: **443.9 GSM**; thickness **0.824 mm**; warp/weft stretch **0.0448/0.0784**; bend **0.535**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-360: Lambskin Garment Leather · Crisp / Structured Finish · 497 GSM (`lambskin__crisp`)
Nominal currently stored: **496.8 GSM**; thickness **0.824 mm**; warp/weft stretch **0.0352/0.0616**; bend **0.725**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-361: Nappa Cowhide Garment Leather · Fine / Light Construction · 474 GSM (`nappaLeather__fine`)
Nominal currently stored: **473.6 GSM**; thickness **1.012 mm**; warp/weft stretch **0.0226/0.0452**; bend **0.775**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-362: Nappa Cowhide Garment Leather · Dense / Firm Construction · 787 GSM (`nappaLeather__dense`)
Nominal currently stored: **787.2 GSM**; thickness **1.45 mm**; warp/weft stretch **0.0172/0.0344**; bend **0.93**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-363: Nappa Cowhide Garment Leather · Soft-Hand / Broken-In Finish · 618 GSM (`nappaLeather__softened`)
Nominal currently stored: **617.6 GSM**; thickness **1.288 mm**; warp/weft stretch **0.0224/0.0448**; bend **0.755**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-364: Nappa Cowhide Garment Leather · Crisp / Structured Finish · 691 GSM (`nappaLeather__crisp`)
Nominal currently stored: **691.2 GSM**; thickness **1.288 mm**; warp/weft stretch **0.0176/0.0352**; bend **0.945**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-365: Pebbled Cowhide Leather · Fine / Light Construction · 540 GSM (`pebbledLeather__fine`)
Nominal currently stored: **540.2 GSM**; thickness **1.337 mm**; warp/weft stretch **0.0226/0.0452**; bend **0.805**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-366: Pebbled Cowhide Leather · Dense / Firm Construction · 898 GSM (`pebbledLeather__dense`)
Nominal currently stored: **897.9 GSM**; thickness **1.914 mm**; warp/weft stretch **0.0172/0.0344**; bend **0.96**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-367: Pebbled Cowhide Leather · Soft-Hand / Broken-In Finish · 704 GSM (`pebbledLeather__softened`)
Nominal currently stored: **704.4 GSM**; thickness **1.7 mm**; warp/weft stretch **0.0224/0.0448**; bend **0.785**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-368: Pebbled Cowhide Leather · Crisp / Structured Finish · 788 GSM (`pebbledLeather__crisp`)
Nominal currently stored: **788.4 GSM**; thickness **1.7 mm**; warp/weft stretch **0.0176/0.0352**; bend **0.975**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-369: Vegetable-Tanned Cowhide · Fine / Light Construction · 622 GSM (`vegetableLeather__fine`)
Nominal currently stored: **621.6 GSM**; thickness **1.782 mm**; warp/weft stretch **0.01695/0.0339**; bend **0.885**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-370: Vegetable-Tanned Cowhide · Dense / Firm Construction · 1033 GSM (`vegetableLeather__dense`)
Nominal currently stored: **1033.2 GSM**; thickness **2.552 mm**; warp/weft stretch **0.0129/0.0258**; bend **0.985**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-371: Vegetable-Tanned Cowhide · Soft-Hand / Broken-In Finish · 811 GSM (`vegetableLeather__softened`)
Nominal currently stored: **810.6 GSM**; thickness **2.266 mm**; warp/weft stretch **0.0168/0.0336**; bend **0.865**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-372: Vegetable-Tanned Cowhide · Crisp / Structured Finish · 907 GSM (`vegetableLeather__crisp`)
Nominal currently stored: **907.2 GSM**; thickness **2.266 mm**; warp/weft stretch **0.0132/0.0264**; bend **0.985**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-373: Patent Leather · Fine / Light Construction · 488 GSM (`patentLeather__fine`)
Nominal currently stored: **488.4 GSM**; thickness **0.972 mm**; warp/weft stretch **0.02825/0.0452**; bend **0.795**; friction **0.4896**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-374: Patent Leather · Dense / Firm Construction · 812 GSM (`patentLeather__dense`)
Nominal currently stored: **811.8 GSM**; thickness **1.392 mm**; warp/weft stretch **0.0215/0.0344**; bend **0.95**; friction **0.5508**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-375: Patent Leather · Soft-Hand / Broken-In Finish · 637 GSM (`patentLeather__softened`)
Nominal currently stored: **636.9 GSM**; thickness **1.236 mm**; warp/weft stretch **0.028/0.0448**; bend **0.775**; friction **0.4743**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-376: Patent Leather · Crisp / Structured Finish · 713 GSM (`patentLeather__crisp`)
Nominal currently stored: **712.8 GSM**; thickness **1.236 mm**; warp/weft stretch **0.022/0.0352**; bend **0.965**; friction **0.5355**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-377: Nubuck Leather · Fine / Light Construction · 481 GSM (`nubuck__fine`)
Nominal currently stored: **481 GSM**; thickness **1.094 mm**; warp/weft stretch **0.0226/0.03616**; bend **0.745**; friction **0.6144**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-378: Nubuck Leather · Dense / Firm Construction · 800 GSM (`nubuck__dense`)
Nominal currently stored: **799.5 GSM**; thickness **1.566 mm**; warp/weft stretch **0.0172/0.02752**; bend **0.9**; friction **0.6912**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-379: Nubuck Leather · Soft-Hand / Broken-In Finish · 627 GSM (`nubuck__softened`)
Nominal currently stored: **627.3 GSM**; thickness **1.391 mm**; warp/weft stretch **0.0224/0.03584**; bend **0.725**; friction **0.5952**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-380: Nubuck Leather · Crisp / Structured Finish · 702 GSM (`nubuck__crisp`)
Nominal currently stored: **702 GSM**; thickness **1.391 mm**; warp/weft stretch **0.0176/0.02816**; bend **0.915**; friction **0.672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-381: Lambskin Suede · Fine / Light Construction · 374 GSM (`suedeLambskin__fine`)
Nominal currently stored: **373.7 GSM**; thickness **0.891 mm**; warp/weft stretch **0.0339/0.0565**; bend **0.575**; friction **0.6144**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-382: Lambskin Suede · Dense / Firm Construction · 621 GSM (`suedeLambskin__dense`)
Nominal currently stored: **621.1 GSM**; thickness **1.276 mm**; warp/weft stretch **0.0258/0.043**; bend **0.73**; friction **0.6912**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-383: Lambskin Suede · Soft-Hand / Broken-In Finish · 487 GSM (`suedeLambskin__softened`)
Nominal currently stored: **487.3 GSM**; thickness **1.133 mm**; warp/weft stretch **0.0336/0.056**; bend **0.555**; friction **0.5952**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-384: Lambskin Suede · Crisp / Structured Finish · 545 GSM (`suedeLambskin__crisp`)
Nominal currently stored: **545.4 GSM**; thickness **1.133 mm**; warp/weft stretch **0.0264/0.044**; bend **0.745**; friction **0.672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-385: Microfiber Faux Suede · Fine / Light Construction · 237 GSM (`fauxSuede__fine`)
Nominal currently stored: **236.8 GSM**; thickness **1.012 mm**; warp/weft stretch **0.0452/0.0904**; bend **0.535**; friction **0.6144**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-386: Microfiber Faux Suede · Dense / Firm Construction · 394 GSM (`fauxSuede__dense`)
Nominal currently stored: **393.6 GSM**; thickness **1.45 mm**; warp/weft stretch **0.0344/0.0688**; bend **0.69**; friction **0.6912**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-387: Microfiber Faux Suede · Soft-Hand / Broken-In Finish · 309 GSM (`fauxSuede__softened`)
Nominal currently stored: **308.8 GSM**; thickness **1.288 mm**; warp/weft stretch **0.0448/0.0896**; bend **0.515**; friction **0.5952**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-388: Microfiber Faux Suede · Crisp / Structured Finish · 346 GSM (`fauxSuede__crisp`)
Nominal currently stored: **345.6 GSM**; thickness **1.288 mm**; warp/weft stretch **0.0352/0.0704**; bend **0.705**; friction **0.672**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-389: Cotton Velour Knit · Fine / Light Construction · 218 GSM (`velour__fine`)
Nominal currently stored: **218.3 GSM**; thickness **1.701 mm**; warp/weft stretch **0.1582/0.2486**; bend **0.465**; friction **0.528**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-390: Cotton Velour Knit · Dense / Firm Construction · 363 GSM (`velour__dense`)
Nominal currently stored: **362.9 GSM**; thickness **2.436 mm**; warp/weft stretch **0.1204/0.1892**; bend **0.62**; friction **0.594**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-391: Cotton Velour Knit · Soft-Hand / Broken-In Finish · 285 GSM (`velour__softened`)
Nominal currently stored: **284.7 GSM**; thickness **2.163 mm**; warp/weft stretch **0.1568/0.2464**; bend **0.445**; friction **0.5115**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-392: Cotton Velour Knit · Crisp / Structured Finish · 319 GSM (`velour__crisp`)
Nominal currently stored: **318.6 GSM**; thickness **2.163 mm**; warp/weft stretch **0.1232/0.1936**; bend **0.635**; friction **0.5775**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-393: Short Pile Faux Fur · Fine / Light Construction · 392 GSM (`fauxFur__fine`)
Nominal currently stored: **392.2 GSM**; thickness **6.48 mm**; warp/weft stretch **0.0678/0.1243**; bend **0.635**; friction **0.4416**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-394: Short Pile Faux Fur · Dense / Firm Construction · 652 GSM (`fauxFur__dense`)
Nominal currently stored: **651.9 GSM**; thickness **9.28 mm**; warp/weft stretch **0.0516/0.0946**; bend **0.79**; friction **0.4968**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-395: Short Pile Faux Fur · Soft-Hand / Broken-In Finish · 511 GSM (`fauxFur__softened`)
Nominal currently stored: **511.4 GSM**; thickness **8.24 mm**; warp/weft stretch **0.0672/0.1232**; bend **0.615**; friction **0.4278**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-396: Short Pile Faux Fur · Crisp / Structured Finish · 572 GSM (`fauxFur__crisp`)
Nominal currently stored: **572.4 GSM**; thickness **8.24 mm**; warp/weft stretch **0.0528/0.0968**; bend **0.805**; friction **0.483**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-397: Quilted Nylon with Batting · Fine / Light Construction · 229 GSM (`quiltedNylon__fine`)
Nominal currently stored: **229.4 GSM**; thickness **4.86 mm**; warp/weft stretch **0.0339/0.0565**; bend **0.725**; friction **0.2688**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-398: Quilted Nylon with Batting · Dense / Firm Construction · 381 GSM (`quiltedNylon__dense`)
Nominal currently stored: **381.3 GSM**; thickness **6.96 mm**; warp/weft stretch **0.0258/0.043**; bend **0.88**; friction **0.3024**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-399: Quilted Nylon with Batting · Soft-Hand / Broken-In Finish · 299 GSM (`quiltedNylon__softened`)
Nominal currently stored: **299.1 GSM**; thickness **6.18 mm**; warp/weft stretch **0.0336/0.056**; bend **0.705**; friction **0.2604**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

### FAB-400: Quilted Nylon with Batting · Crisp / Structured Finish · 335 GSM (`quiltedNylon__crisp`)
Nominal currently stored: **334.8 GSM**; thickness **6.18 mm**; warp/weft stretch **0.0264/0.044**; bend **0.895**; friction **0.294**.
Required: independent sample composition, conditioning, directional mechanical tests, calibrated solver mapping, optical repeat scale and source-map provenance. Current presets are design estimates until lab evidence is reviewed.

## Official references

- CLO live 7.0.242 inventory: docs/CLO7_LIVE_TOOLBAR_AUDIT_20261016.md — Project live app inspector; four columns of 20+18+17+15 controls.

- CLO physical fabrication documentation: https://support.clo3d.com/hc/en-us/articles/115000565548--Mode-Emulator — Fabric emulator measures directional physical sample responses; not automatically EXO data.

- CLO material settings: https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials — Front/Back/Side optical property model and PBR settings.

- CLO DXF interoperability: https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export — Industrial AAMA/ASTM/standard DXF import/export options and losses to test.

- CLO grading: https://support.clo3d.com/hc/en-us/articles/115015578947-Add-Apply-Grading — Size groups, rules and grade editing behaviors.

- CLO pattern information: https://support.clo3d.com/hc/en-us/articles/59635504938777-2D-Pattern-Information — Pattern metadata, revision and shrinkage requirements.

- CLO particle distance: https://support.clo3d.com/hc/en-us/articles/115012227227-Particle-Distance — Numerical cloth mesh resolution property in mm.

- CLO sewing: https://support.clo3d.com/hc/en-us/articles/115012380148-Edit-Sewing — Sewing selection/mutation behavior.

- CLO POM: https://support.clo3d.com/hc/en-us/articles/360025716814-Edit-2D-POM — Permanent measurement geometry editing behavior.

- CLO finishing: https://support.clo3d.com/hc/en-us/articles/33852438561049-PBR-Map-Generator-ver-2024-1 — Optical map generation options.

- CLO 2D seams: https://support.clo3d.com/hc/en-us/articles/115015714428-2D-Seam-Allowance — Custom seam allowance editing and selection.

- CLO recent grading review: https://support.clo3d.com/hc/en-us/articles/58043228154393-Grading-Review-2D — 2026 grading side-by-side review; future parity scope.

- Licensed optical scan registry: docs/reports/EXO_400_LICENSED_SCAN_REGISTRY.json — CC0 third-party scan record and checksums.

## Dated source research annexes
- docs/GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md
- docs/EXO_MASTER_ROADMAP.md
- docs/CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md
- docs/CLO3D_PROPERTY_EDITOR_DEEP_AUDIT_20261016.md
- docs/CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md
- docs/EXO_400_FABRIC_LIBRARY_AND_WASH_SYSTEM.md
- docs/FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md
- docs/EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md
- docs/EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md
- docs/EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md
- docs/EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md
