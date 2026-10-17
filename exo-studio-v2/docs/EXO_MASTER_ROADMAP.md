# EXO Sample 3D — engineering master roadmap

**Status:** proposed execution plan, 15 October 2026. **Product identity:** EXO Sample 3D. **Repository:** `mikristian/exo-sample-3d`; historical document filenames and internal identifiers are preserved for traceability. This roadmap is a contract for work and verification, not a declaration that the application matches CLO3D or produces certified factory deliverables.

## Product contract and architectural boundaries

EXO aims to connect precise editable 2D patterns, sewn 3D geometry, realistic fabric responses, fit analysis, visual material design, and traceable manufacturing packages. A single versioned garment project must remain the source of truth for all views. An edit to a dart, seam allowance or grade rule should invalidate the relevant derived mesh, contact state, point-of-measure (POM) results, marker and export outputs. The application should never display an old simulation or export as if it reflected newer drafting geometry.

The source currently includes a React/Three.js browser workspace, a shipped macOS shell using WebKit, native C++ feature modules under `native_cpp/core/`, a developing Qt interface, and an optional Rust PPF sidecar. The active UI and the tested native CLI do not yet constitute a single independently validated fully native application. Existing C++ parity coverage is module-specific. JavaScript remains a reference behavior for many functions, and a close numerical match to JavaScript is not proof that the reference physics is physically correct. Preserve that distinction in status and release notes.

Read [architecture](ARCHITECTURE.md), [native conversion checkpoint](SAMPL3D_NATIVE_CPP_CONVERSION_LOOP_2026-10-15.md), [CLO production comparison](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md), [simulation research](EXO_SIMULATION_RESEARCH.md) and [verification plan](EXO_VALIDATION_TEST_PLAN.md) together. The October production audit explicitly states that 90% CLO3D parity has **not** been demonstrated. Neither the existence of export files nor passing source parity tests is equivalent to acceptance by a cutter, grader, vendor or garment technician.

## Work graph and dependency gates

The milestones below are numbered by dependency and verification effort, not by an asserted percentage complete. Parallel tasks are safe where they operate on separate data contracts and cannot silently alter shared geometry. Every GitHub milestone requires a named owner, evidence artifact, exact command, machine/OS/solver version, failure case, and acceptance reviewer. Do not promote an issue solely because a feature appears in a menu.

### M0 — reproducibility, provenance and reference corpus

1. Capture immutable source revision, build flags, native runtime versions, material configuration and test seed with each fixture. Define schema revisions for garment projects, physics snapshots, export manifests and acceptance records. Store fixture metadata beside the fixture and avoid environment-dependent absolute paths.
2. Establish open, redistributable base garments: basic tee with conventional sleeves, sleeveless shell, trousers with inseam and fly, jacket with zipper and multi-layer cloth. Include explicit unit scales, grain angles, notches, panel winding, seams, symmetric references and annotated measurement landmarks. Use synthetic or freely licensed avatar geometries with documented redistribution rights.
3. Add a deterministic cross-backend harness that compares reference JavaScript outputs, native C++ transformations and Rust solver traces by operation and field. Declare tolerances per field and explain why they are physically meaningful. Every mismatch retains a minimal repro and observed numeric delta.
4. Set protected CI checks for format validity, build reproducibility, license inventory, data migrations, and sample exports. Run `npm run build`, `npm run check:non-simulation`, `scripts/check-native-cpp-conversion-coverage.mjs` and native test suites as applicable. The inventory is a set of covered exports, not a whole-product percentage.

**Exit:** on a clean checkout, another developer can run a documented subset without private assets; fixture licenses are declared; every baseline passes or its failures are visible. See [open-source validation](OPEN_SOURCE_VALIDATION_2026-10-14.md), [release audit](OPEN_SOURCE_RELEASE_READINESS_AUDIT_2026-10-13.md), and [licensing](LICENSING.md).

### M1 — CAD accuracy and round-trip drafting

Keep all native drafting coordinates in declared physical units. Design a stable document model for panels, vertices, quadratic/curved edges, seam allowances, darts, internal lines, cutouts, grainlines, labels, linked mirror transforms, user-defined construction points and per-size grade rules. Editing must preserve constraint identity and undo/redo history. A notch tied to an edge parameter should stay attached after reasonable edits and should become a validation error if its parent edge is deleted. Imported patterns must be quarantined from simulation until winding, unit scale and topological checks pass.

Validate exact millimeter bounding geometry, edge sampling error, seam length, reversible transformations, nested undo groups, dangling seam references, nonmanifold contours and self-intersections. Cover keyboard and pointer tools, snapping in actual 2D viewport coordinates, scale/zoom behavior, high-DPI selection and redraw responsiveness. Existing relevant files include `src/core/dxf.js`, `src/core/grading.js`, `src/core/measurements.js`, and native tests such as `scripts/check-native-cpp-drafting-constructions.mjs`, `scripts/check-native-cpp-cad.mjs` and `scripts/check-native-cpp-project-geometry.mjs`. Read [2D drafting acceptance](CLO_DRAFTING_WORKSPACE_MATERIAL_ACCEPTANCE_2026-10-14.md) before changing interaction contracts.

**Exit:** reference patterns survive save/open and export/import without lost construction semantics, and tolerances have been verified against independent geometry assertions. Persisted projects remain readable following schema upgrades.

### M2 — sewn garment topology and mesh generation

Map seam segments to discretized mesh boundary edges using stable parent edge identifiers and arc-length parameters. Support opposing directions, seam-length imbalances, easing, pleats, darts, virtual zipper tracks, reversible seam assignments, layered seam junctions and incremental remeshing. Report sewable lengths, unmatched intervals and topology violations before assembling. A sewing error must remain visible even if a visual interpolation can hide the opening in a posed screenshot.

Generate UVs in grain-relative coordinates, preserve panel names/materials after subdivision, and propagate fabric orientation into anisotropic constitutive models. Verify triangle area and orientation, boundary invariants, panel spacing, and seam matching under changes to tessellation density. `native_cpp/core/pattern_mesh.hpp`, `scripts/check-native-cpp-pattern-mesh.mjs`, `scripts/check-native-cpp-seam-assembly-parity-bridge.mjs` and [native mesh audit](NATIVE_MESH_QUALITY_PASS_2026-10-13.md) provide starting evidence. The advanced assembly tests must report contact and position agreement across tee and trousers rather than converting a one-frame pass into a complete fit claim.

**Exit:** deterministic, editable sewn rest state across multiple garment classes, with explicitly tracked invalid or incomplete seams.

### M3 — physically defensible dynamics and fitting

Maintain a clear separation between real-time design preview and a slower acceptance-grade simulation. The browser solver may support immediate iteration; the Rust PPF contact solver may own physically demanding contact operations; C++ may own CAD, interchange, quality analysis and glue. A single orchestrator must expose backend identity, integration scheme, timestep, substeps, cloth thickness, material parameter units, initial pose, collision proxy source and solver stopping criteria. The viewport must not collapse diagnostics into an unexplained green status.

Implement and verify stretch, shear, bending, damping, mass, gravity, seams and boundary pins. Treat self-contact and continuous collision detection (CCD) as distinct requirements from body penetration correction. Tests must cover fast arm motion, cloth-on-cloth folds, crossing sleeve panels, layered jackets, narrow armholes, seam convergence and warm-start resets. Evaluate swept cloth/body and cloth/cloth interactions through complete trajectories. Require controlled comparisons against licensed or open physical benchmark data and physically measured drapes. See [simulation research](EXO_SIMULATION_RESEARCH.md), [PPF body tee pipeline](PPF_BODY_TEE_PIPELINE.md), [contact safety](PPF_CONTACT_SAFETY_NEXT_PASS_2026-10-13.md) and [actual fit audit](PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md).

**Exit:** recurring simulation fixtures meet numerical, geometric and trajectory acceptance limits recorded in the [test plan](EXO_VALIDATION_TEST_PLAN.md). Until then, any status marked `fitCertified`, `factoryCertified` or CCD-complete remains false unless independently justified by the exact scenario.

### M4 — fabric appearance and engineering parameters

Retain separate appearance and mechanical material models. Procedural albedo, normal, height and roughness do not establish bending stiffness or friction. Keep physical provenance for warp/weft elasticity, bending, density, damping, thickness and surface friction, with confidence intervals where measurements are uncertain. Support both isotropic and anisotropic profiles, grain rotation, different materials per panel, trims and hardware collision boundaries. Map UI parameters to defined units and solver-specific constitutive fields.

The current project describes 23 fabric presets and 13 procedural textile structures; inspect `scripts/check-native-cpp-textile-procedurals.mjs`, `scripts/check-native-cpp-fabric-pbr-pixels.mjs` and [fabric parity audit](SAMPL3D_FABRIC_PARITY_AUDIT_2026-10-15.md). Validate continuity at UV seams, deterministic generated maps, texture-scale consistency in centimeters and visual behavior under changing lighting. Changing appearance should not accidentally restart drape; changing mechanical parameters should invalidate physics caches and visibly request a new solve.

**Exit:** appearance reproducibility plus measured or explicitly estimated physical parameters, accompanied by uncluttered material provenance indicators.

### M5 — fit analysis, avatars and animation

Formalize avatar import, mesh hygiene, collision normals, body landmarks, pose binding, shape scaling and motion interpolation. Create signed-distance or mesh contact proxies with documented error bounds and a way to compare proxy results with source triangles. Separate cloth strain from pressure estimates, local clearance from penetration depth, and posture feasibility from garment size recommendations. A color-coded strain map needs a legend, normalization rule and per-material thresholds. Expose analysis quality flags when motion sampling or contact convergence is inadequate.

Run baseline and perturbation tests on the tee, trousers and layered outfit, multiple sizes, and full motion sequences. Do not ship private scan assets or embedded proprietary avatars. Use open synthetic human meshes with correct notices. If a real reference body is used locally for testing, publish anonymized derived metrics only where distribution and privacy permissions permit.

**Exit:** trustworthy measurement landmarks, explainable heat maps and a repeatable on-body acceptance demonstration including failure cases.

### M6 — manufacturing handoff

Use the [production pipeline](EXO_PRODUCTION_PIPELINE.md) as the exporter contract. Verify industrial 2D DXF interpretations, unit scaling, grade-rule preservation, marker orientation, lengths, material widths, physical plot scale, POM tolerances, and a complete BOM. Keep revision identifiers consistent across source project, drawings, grades, cut orders, costing and ZIP manifest. Test a complete handoff with a cooperating technician and at least one separate CAD/cutter system.

Current work already covers several source and native operations: see [CLO export comparison](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md), `scripts/check-production-handoff.mjs`, `scripts/check-factory.mjs`, `scripts/check-native-cpp-factory-cli.mjs`, `scripts/check-native-cpp-markers.mjs`, and [native BOM/marker audit](NATIVE_CPP_BOM_AND_MARKER_PARITY_2026-10-15.md). Treat byte parity, unit parity and manufacturer compatibility as three different forms of evidence.

**Exit:** authorized pilot cutting from controlled reference patterns with signed dimensional QC. Factory certification requires documented supplier approval and an actual physical production review.

### M7 — desktop consolidation and open-source release

Once contracts above stabilize, offer an independently built C++/Qt desktop with equivalent authoring, undo, 2D/3D navigation, project save/load and production actions. The user can continue working in the existing WebKit workspace until verified workflows move. Rust PPF can remain a separate process exposed over a stable versioned protocol; a Rust solver does not force a Rust UI. Confirm Qt distribution terms and upstream binary/source licenses before packaging. A public repository should include legitimate screenshots, reproducible demo assets and the V16 promo only if all media rights and asset licenses permit redistribution.

**Exit:** reproducible packaging, clean-machine smoke test, explicit bundled licenses, public issue board, vulnerability handling and reviewed release notes. See [Qt toolchain](CPP_QT6_TOOLCHAIN_READINESS_2026-10-15.md), [native roadmap](GARMENT_STUDIO_NATIVE_ROADMAP.md), [GitHub launch](OPEN_SOURCE_GITHUB_LAUNCH_PLAYBOOK.md) and [contribution guide](EXO_CONTRIBUTION_GUIDE.md).

## Issue board taxonomy and prioritization

Create labels `cad`, `sewing`, `mesh`, `physics`, `ppf-rust`, `contact`, `material`, `avatar`, `fit`, `factory`, `interchange`, `desktop`, `docs`, `license`, `verification`, plus severity labels. An issue's first paragraph defines the user-visible failure or missing workflow; subsequent fields specify input fixture, expected behavior, observed behavior, candidate modules, acceptance gate, regression command and proof attachment. An umbrella tracking issue may link implementation, independent verification and external pilot tasks, but each subissue must close on its own artifact.

Prioritize defects that can misrepresent a garment's physical viability: silently inverted normals, body penetration, stale simulation shown after editing, wrong DXF units, altered grade dimensions, and false factory-ready flags. Next come fidelity improvements that influence purchase or manufacturing decisions; then rendering aesthetics, workspace refinement and optional interchange formats. A striking promo shot never substitutes for evidence of a solved collision or a measured cut dimension.

## Decision record and release rule

For every migration, record a brief architecture decision: the data ownership change, why C++/Rust/JavaScript is appropriate, serialization boundary, numerical agreement conditions, backward compatibility, rollback route and test provenance. Preserve a testable reference path until coverage is sufficient to remove it. Avoid hardcoded fixture-specific output, test-only flags hidden from users or declaring coverage using only counted exports. A release can label modules `experimental`, `fixture-verified`, `pilot-validated` or `production-approved` only with attached proof of that particular claim. Maintain a visible unsupported-functions matrix rather than compressing the roadmap into a fabricated completion score.
