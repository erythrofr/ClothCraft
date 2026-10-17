# EXO Sample 3D — Feature Atlas and Evidence Register

> This atlas indexes capabilities in the repository as inspected on 15 October 2026. **Implemented** means code exists with a reachable or defined workflow; **experimental** means limitations, alternative paths or incomplete validation remain; **roadmap** is work proposed here rather than a claim of completion. Neither a passing smoke test nor an interface control establishes real-world fit or factory certification.

## Contents
1. [Evidence and maturity rules](#evidence-and-maturity-rules)
2. [Workspace and interface](#workspace-and-interface)
3. [Two-dimensional pattern CAD](#two-dimensional-pattern-cad)
4. [Sewing and assembly](#sewing-and-assembly)
5. [Avatars and staging](#avatars-and-staging)
6. [Cloth solvers](#cloth-solvers)
7. [Fabric and visual realism](#fabric-and-visual-realism)
8. [Production and export](#production-and-export)
9. [Native desktop and C++ conversion](#native-desktop-and-c-conversion)
10. [Interoperability and automation](#interoperability-and-automation)
11. [Acceptance milestones](#acceptance-milestones)

## Evidence and maturity rules

The application is a substantial experimental engineering project. Presence of an icon does not prove the entire underlying workflow. Presence of a C++ implementation does not prove it is wired to the active desktop or matches the JavaScript algorithm. A completed export archive does not make the manufacturing contents verified. This atlas uses three levels:

| Level | What evidence means | Explicit limitation |
|---|---|---|
| Implemented | Inspectable code path, UI entry or export handler exists | Could have unsupported edge cases |
| Experimental | Implemented code with known parity, realism, or environment gaps | Requires focused acceptance testing |
| Roadmap | Target outcome with supporting implementation direction | No completion claim |

For measurable readiness, prefer a named fixture, command, output checksum or numerical error report rather than percentage estimates. Relevant audits include `docs/CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md`, `docs/ARCHITECTURE_AUDIT_CLOTH_SIMULATION_2026-10-13.md`, `docs/CLO3D_CLOTHING_SIMULATION_GAP_AUDIT_2026-10-13.md` and the native parity test scripts.

## Workspace and interface

**Implemented:** The React/Vite entry is `src/main.jsx` and `src/App.jsx`. `src/components/CloUI.jsx` defines an extensive workspace; `PatternEditor.jsx` handles drafting; `GarmentViewport.jsx` renders garment/avatars; `RightToolPalette.jsx`, `PropertyCategoryNavigator.jsx`, `ObjectBrowserHierarchy.css` and `WorkspaceCommandPalette.jsx` support tool discovery and inspection. Numerous vector toolbar controls live in `src/assets/toolbar-icons/`, including selection, seams, fabric, simulation, fasteners, pressure, markers and grading. Styling is under `src/clo-interface.css`, `src/clo-neutral-theme.css` and component CSS.

**Experimental:** The interface pursues CLO-like depth, but no source-visible global parity certification shows every control matches the commercial application. A toolbar button can show a dialog without completing all manufacturing semantics, and the React desktop design remains distinct from the native Qt UI. The screenshot set `screenshots/01-pattern-workspace.png` through `screenshots/07-multi-fabric-marker.png` documents particular visual states, not continuously verified functionality.

**Roadmap:** A command capability manifest describing each tool's availability, undo behavior, backend requirement and telemetry; consistent state restoration across workspaces; accessibility and keyboard focus regression tests; cross-application visual snapshots.

## Two-dimensional pattern CAD

**Implemented:** Core geometry `src/core/project.js` supports polygon boundaries, quadratic curve sampling, edge length and allowance boundaries. Drafting logic includes `draftingPrecision.js`, `draftingSnapping.js`, `draftingConstructions.js`, `draftingTopology.js`, `draftingSplit.js`, `draftingUnfold.js`, `draftingPrecision.js` and `autoFitPlacement.js`. `PatternEditor.jsx` provides the 2D authoring surface. Notches, seam allowances, internal lines, grain orientation and mirrored/fold operations are represented in project data or dedicated drafting routines. Dedicated check scripts include `check:drafting-precision`, `check:drafting-snapping`, `check:drafting-splits`, `check:drafting-unfold` and `check:drafting-topology`.

**Experimental:** Thin geometry, degenerate intersections, touching contours and precise curve identity are difficult cases. Visual fidelity to a commercial CAD drafting session is different from topological correctness. Curves are quadratic segments in the inspected JS geometry path; third-party drafting representations may need richer spline objects or explicit approximation tolerances.

**Roadmap:** Robust per-edge stable IDs; guaranteed constraint preservation through split/merge; numerical tolerance policy; reversible import/export for arbitrary curved pattern files; real test garments with measured sewing lengths.

## Sewing and assembly

**Implemented:** Seams reference pattern pieces and edge ranges. `src/core/sewingConstruction.js` and `src/core/backends/seamAssembly.js` handle construction/assembly concerns. `src/core/backends/nativeAssemblyPreflight.js` evaluates a subset of native assembly assumptions. Related C++ modules include `native_seam_assembly.cpp`, `seam_assembly_parity_bridge.cpp`, `seam_assembly_advanced.cpp`, `cloth_seam_constraints.cpp` and `sewing_construction.cpp`. Buttons, buttonholes, zippers and trims have associated authored structures and UI tools.

**Experimental:** Conventional sewing correspondence, partially open edges, zipper pairs, virtual seam segments and constraints that account for contact may diverge between engines. Advanced `contactConstrained` and `jointConstraintMode` paths require their own parity fixtures. One frame of exact garment positions does not show equivalent seam friction or temporal stability.

**Roadmap:** Constraint identity tracking across remeshing; stitch type physical calibration; seaming order authored explicitly; closure timelines; per-stitch error reports; interaction handling where several seams meet at a vertex; a complete sewing construction audit that can be reproduced on actual sample garments.

## Avatars and staging

**Implemented:** Avatar references and placement settings are part of the project. `src/core/staging.js` and `src/core/autoFitPlacement.js` manage arrangement; `src/core/meshAvatarContact.js` supports mesh avatar contact functions; `src/core/zozoReferenceDress.js` represents a reference dress pathway. Viewers and visualization components include `ZozoReferenceDressViewer.jsx` and `FlatAvatarSilhouette.jsx`. Native counterparts include `avatar_physics.cpp`, `mesh_avatar_contact.cpp`, `avatar_surface_correction.cpp` and `zozo_reference_dress.cpp`.

**Experimental:** A rendered avatar and its collision approximation may use different geometry; correcting penetration alone is not fit verification. Real tee and trouser fixture tests matter more than synthetic spheres. Contact details depend on triangle winding, nearest-point calculation, projection order, collision margin and previous frame state.

**Roadmap:** Documented permitted avatar assets and provenance, independently measurable sizes, per-body collision QA, robust shell-to-body initialization and retained fit annotations. Exclude third-party proprietary avatar sources from public tests without explicit redistribution rights.

## Cloth solvers

**Implemented:** Browser dynamics and meshing live in `src/core/physics.js`, `clothMeshing.js`, and `src/core/physics/`. Backend management lives in `src/core/backends/registry.js` and `protocol.js`. The native local HTTP solver is `native_backend/server.mjs`, using a CLI built by `native_backend/scripts/build_garment_xpbd_cli.sh`. There is also `ppf_backend/server.mjs`, integrating a local Blender/PPF runtime with jobs, previews and acceptance checks. Native C++ includes `cloth_simulation.cpp`, `cloth_solver_step_contacts.cpp`, `cloth_analysis.cpp`, `self_collision.cpp`, `avatar_contact_pass.cpp`, `native_payload.cpp` and specialized testing bridges.

**Experimental:** These engines solve overlapping but nonidentical problems. XPBD distance and strain triangles have different deformation behavior. Seam stabilization and avatar contact ordering influence previous positions, and therefore frame-to-frame motion. A solver can pass a collision count test while displaying clothing in a visibly wrong assembly. The presence of IPC/CCD related files or prototypes is not proof of full collision guarantees across all input geometries.

**Roadmap:** A single documented fixture corpus, two-frame and long-run position/velocity comparisons, strain and penetration thresholds, swept-contact validation, cloth interpenetration regression scenes, an externally reviewed fit benchmark and solver selection policies based on measured capability.

## Fabric and visual realism

**Implemented:** `src/data/defaultProject.js` defines initial and extended material presets. The visual surface system spans `src/core/fabricSurfaceModel.js`, `fabricPbrGenerator.js`, `fabricPbrFileNaming.js`, `textileProcedurals.js`, `src/components/FabricMaterialPreview.jsx` and the Three.js viewport. Model properties include color, roughness, metalness, anisotropy-related fiber controls, clearcoat, opacity, maps and grain-aligned centimeter-based weave repetition. `npm run check:materials` includes `check-materials.mjs` and `check-fabric-realism.mjs`.

**Experimental:** Visual textures are deterministic only if sources, seeds, generation algorithm and color-space assumptions are held fixed. Pixel parity between JS and C++ generators should be independently measured. Fabric parameters are empirical starting values, not certified fabric lab measurements. A roughness or weave edit should keep drape continuous if mechanical parameters did not change.

**Roadmap:** Standard material descriptors with SI units, scanned swatch ingest, physically calibrated stretch/bend data, per-fabric solver validation, wavelength-aware normals and authored render presets that can be reproduced on other machines.

## Production and export

**Implemented:** `factoryPackage.js` combines size runs, markers, tech packs, cost runs, CSV, DXF and BOM XML, backed by `grading.js`, `measurements.js`, `marker.js`, `markerArtifacts.js`, `productionCost.js`, `dxf.js`, `bomXml.js` and `productionPreflight.js`. An archive is produced with `fflate`. Native variants include `factory_package_files.cpp`, `factory_zip.cpp`, `construction_dxf.cpp`, `marker_svg.cpp`, `marker_pdf.cpp`, `fabric_cost.cpp`, `bom_export.cpp` and `tech_pack_export.cpp`.

**Experimental:** Native and JS output parity is tracked per exact file and fixture; some serialization differences can persist despite equal graded point coordinates. DXF exchange is sensitive to units, layer names, entity order and curves. Physical output verification requires manufacture-oriented measurements, material shrink allowances and target importer checks. A passed preflight is not factory certification.

**Roadmap:** Versioned package manifest; validation against production partner importers; sample-cut comparisons; independent grading sign-off; secure traceability of size rules; automated comparison between tech pack, pattern seams and BOM; more comprehensive format coverage.

## Native desktop and C++ conversion

**Implemented:** `native_cpp/CMakeLists.txt` builds a C++17 core and CLI, with an optional Qt6 Widgets target. There are many C++ source modules corresponding to JS operations, plus `native_cpp/tests/` and `scripts/check-native-cpp-*.mjs` tests. `native_cpp/core/garment_document.hpp` supports JSON data, inspection, revisions, transactions and undo snapshots. `native_cpp/desktop/` contains a native main window, pattern canvas and staging view.

**Experimental:** The conversion is ongoing. A named-export inventory should distinguish source implemented, compiled into the library, reachable from the CLI/Qt interface, covered by equivalence tests and equivalent under representative input cases. Parallel new modules can exist before they are integrated. Native solver and manufacturing parity claims should be accompanied by output values and test command, especially where real garments and multi-frame contacts differ.

**Roadmap:** Publish a machine-readable coverage report; consolidate redundant geometry implementations; add browser-to-native project round trips; verify Qt controls against the same fixtures as React; establish CI builds across supported macOS versions and other operating systems where dependencies permit.

## Interoperability and automation

**Implemented:** `src/core/garmentCode.js` and `seamlyMeasurements.js` expose integration ideas and concrete adapters. `src/core/bomXml.js` handles structured manufacturing data. `integrations/clo_sdk/README.md` documents SDK-related investigation; `blender_bridge/README.md` describes Blender integration. Local native services use an explicit JSON transport.

**Experimental:** Third-party format translators cannot retain properties absent from a receiving schema. Integration files do not prove an officially supported or complete CLO SDK workflow. Automated garment authoring must validate edits and show what was changed; an AI operator should not be permitted to silently declare production readiness.

**Roadmap:** Stable documented plugin hooks, schema-version negotiation, import reports for dropped properties, a headless validated batch editor and signed artifact manifests with reproducible configuration.

## Acceptance milestones

**Drafting:** every stitch line and corresponding cut line must have closed valid topology; seam allowance, curve and notch semantics survive serialization. **Sewing:** seam edge references and reversals remain stable through grading and remeshing. **Simulation:** two or more frames of positions and previous positions match stated tolerances on real garments; avatar and self-contact diagnostics are bounded and measured. **Materials:** appearance edits do not change particle positions; physical edits invalidate the appropriate simulation caches. **Exports:** a fixed-size known garment package has correct filenames, geometric import fidelity and independently reviewed measurements. **Desktop:** native UI can edit, save, reopen and export the same fixture as React, with transaction semantics intact.

The most meaningful milestone is a reproducible, visibly correct garment making a round trip from edit, through simulation and graded production package, through an independent consumer. Until that is demonstrated on representative garments, EXO Sample 3D should be described as an actively developed professional-oriented garment CAD platform.

Related documentation: [Architecture](EXO_ARCHITECTURE.md) · [Data Model](EXO_DATA_MODEL.md) · [Developer Guide](EXO_DEVELOPER_GUIDE.md).
