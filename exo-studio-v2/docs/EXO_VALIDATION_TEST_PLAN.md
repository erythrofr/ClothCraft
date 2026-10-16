# EXO Sample 3D — validation matrix and release gates

**Purpose:** define evidence required to promote individual features from experiments to trusted production workflows. **Status:** test design, not a report of passing tests. The repository's current source parity suites and selected user-interface checks provide useful regression coverage but do not establish industrial interoperability or physical fit acceptance.

## Evidence format

An acceptance record contains an immutable source commit, OS/architecture, relevant dependency versions, backend and build variant, fixture ID and licensing, invocation command, exact numeric parameters, expected result, actual result, numeric differences, visual evidence where useful, observed failure modes, and reviewer. Each artifact should have an integrity hash. Use JSON for metrics and Markdown for interpretation, with associated test data kept in appropriately licensed fixtures. The acceptance record must indicate whether the test was automated, human-operated, independently reproduced or executed in an external application.

Avoid a single `passes=true` field for an entire garment. Use separate flags such as `topologyValid`, `seamsClosed`, `staticContactAccepted`, `trajectoryContactAccepted`, `physicalShapeValidated`, `factoryFormatAccepted`, `plotCalibrationAccepted` and `supplierSignedOff`. Derived `fitCertified` and `factoryCertified` remain false until a defined set of independent prerequisites has been met, and must be scoped to a garment revision, size, material, avatar and motion scenario. Prior test evidence should expire when affected inputs or solver algorithms change.

## Core validation levels

**Level A: schema and unit checks.** Reject malformed projects, missing panel identifiers, invalid cuts, NaN and infinity, negative fabric widths, nonpositive scales, malformed grade rules and conflicting seam assignments. Test old-to-new project migrations with round-trip equality of all essential attributes. Validate units explicitly: the browser may render a normalized scene while manufacturing outputs are millimeters, and the Rust solver requires meters.

**Level B: deterministic functional comparison.** Compare exact or tolerance-bounded values against the JavaScript implementation for C++ migrations, including mutation effects and ordering. A byte-for-byte equality check on a DXF proves serialization matching for one fixture; it says nothing about whether an industrial DXF importer interprets layer names correctly. When an implementation intentionally differs, include an independently justified numerical oracle rather than adjusting a tolerance until the test passes.

**Level C: numerical and physical tests.** Check mesh refinement, timestep sensitivity, force balance, constrained equilibrium, trajectory continuity, swept collisions, deformation invariants and comparison with measured swatch or garment evidence. Use independent geometry operations where possible, avoiding both expected and actual results being computed by the same function.

**Level D: workflow verification.** Operate 2D drafting, sewing, materials, avatar fitting, 3D preview, POM, marker and export in the actual desktop or web app. Assert displayed statuses, saved state, downloaded data and absence of runtime exceptions. UI controls that merely open a panel do not count as functional coverage.

**Level E: external interoperability and manufacturing pilot.** Import approved outputs into independent CAD systems, print at calibrated scale, cut a sample, measure physical garments and secure written technician feedback. Claims of CLO-style workflow coverage require reproducible comparisons against a properly licensed installation and specific documented features; a menu-label resemblance is not sufficient.

## CAD and drafting acceptance

Use a minimum corpus including a tee front/back/sleeve, pants with curved crotch and inseams, a darted bodice, an asymmetric panel, multiple internal construction marks and mirrored panel transformations. Include degenerate and adversarial samples: coincident vertices, almost-zero edges, steep curves, reversed winding, open polygons and excessive coordinate magnitude. Verify exact vertex references where identity is relevant and a physical-distance tolerance where curves must be resampled. Test undo/redo through a batch of edits followed by save/reload and export; reject stale identifiers.

Review `src/core/dxf.js`, `src/core/grading.js`, `scripts/dxf-roundtrip-check.mjs`, `scripts/check-native-cpp-dxf-import.mjs`, `scripts/check-native-cpp-drafting-constructions.mjs` and `scripts/check-native-cpp-grading-helpers.mjs`. Read [drafting construction](CLO_DRAFTING_WORKSPACE_MATERIAL_ACCEPTANCE_2026-10-14.md) and [2D layout comparison](CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md). Record whether import preserves annotations and layer intent in addition to paths. Approve a grade only when independent expected measurement differences agree for every specified size, direction and piece.

## Seam, mesh and assembly acceptance

Use per-edge arc-length landmarks to verify sewing correspondence, boundary orientation and residual seam gap. Check mesh area conservation in rest space, minimum triangle quality, UV validity and stable panel references after remeshing. Document whether a concave shape is valid, whether holes are respected and whether a subdivided curved seam remains within its sampling-error budget. Compare assembled positions and all metrics at zero and nonzero iterations, both with and without advanced contact options. Relevant tests include `scripts/check-native-cpp-pattern-mesh.mjs`, `scripts/check-native-cpp-cloth-meshing-pipeline.mjs`, `scripts/check-native-cpp-native-seam-assembly.mjs` and `scripts/check-native-cpp-seam-assembly-parity-bridge.mjs`.

Acceptance requires no unexplained missing seams, explicit distinction between eased/gathered mismatch and incorrect stitching, no silent inversion, and a bounded maximum seam residual in physical units. Set thresholds from garment construction requirements; a universal arbitrary millimeter limit will be inappropriate for all apparel types. Archive visual diagnostics with seam IDs, allowing someone to locate the numerical failure in the pattern editor.

## Collision and simulation acceptance

Define static states, settling trajectories, rapid motion, reversal, sliding contact and repeated loop playback. Include simulated cloth-body penetration and cloth-cloth self-intersection. A candidate must report the maximum intersection per frame, swept intersection count, minimum supported separation, contact pair count, seam residual, nonfinite states, spike in velocity, elapsed time and memory. Compare not only initial and final frames but intermediate checkpoints across the full motion. Intentional invalid initial penetrations need a documented recovery behavior; suppressing those frames from statistics invalidates the test.

The native fixtures `scripts/check-native-cpp-avatar-surface-real-fixtures.mjs`, `scripts/check-native-cpp-self-collision-real-fixtures.mjs` and `scripts/check-native-cpp-cloth-solver-step-contacts.mjs` target relevant subproblems. PPF scripts such as `scripts/check-ppf-multirun-robustness.mjs`, `scripts/check-ppf-export-interpolation-regression.mjs` and `scripts/check-ppf-assembly-acceptance.mjs` add trajectory-oriented evidence. Read [swept contact integration](IPC_THOMAS_SWEPT_CONTACT_INTEGRATION_2026-10-13.md) to see why frame-sampled contact cannot certify CCD. If a strict acceptance test cannot run due to licensed or absent upstream solver dependencies, mark it **not executed**; do not report it as passing.

Separate three decisions: a mesh looks correct for interaction; its collision solver runs without invalid states under a defined trajectory; its geometry and deformations agree sufficiently with measured physical behavior. A single green simulation button only establishes that a command ran. Release descriptions should specify which decision is supported.

## Material and rendering acceptance

Check material-map generation across declared weave/fiber patterns, image dimensions, alpha, finite and normalized normals, roughness bounds, repeat in centimeters and consistent UV alignment at grain rotations. Verify changing only a display texture preserves the current cloth coordinates, while changing mechanical elasticity reinitializes or invalidates the solver state. Use `scripts/check-native-cpp-textile-procedurals.mjs`, `scripts/check-native-cpp-fabric-pbr-pixels.mjs` and `scripts/check-native-cpp-fabric-surface.mjs`. Benchmark high contrast, low contrast, transparent, dark and reflective fabrics in the same controlled lighting environment. A shader passing these tests should be labeled visually verified, not mechanically calibrated.

For physically calibrated materials, require swatch source, test procedure, directional measurement axes, fitted coefficients, uncertainty estimates and deformation comparisons. Repeat the physical benchmark with at least two mesh resolutions and at least two timesteps to expose dependence on discretization.

## Factory export acceptance

Construct one complete project with multiple sizes, real grainlines, notches, seam allowances, construction marks, hardware, multiple materials, trims, expected POMs, cut quantities and a fabric roll width. Save a frozen manifest of expected outputs and verify that the factory package faithfully matches the project revision. Test `scripts/check-production-handoff.mjs`, `scripts/check-factory.mjs`, `scripts/check-native-cpp-factory-cli.mjs`, `scripts/check-native-cpp-marker-exact.mjs`, `scripts/check-native-cpp-bom-parity-20261015.mjs` and `scripts/check-native-cpp-factory-zip.mjs` as applicable. The actual available scripts are the definitive authority for current check behavior; inspect help/fixtures before invoking them in CI.

The output gate is staged. First compare filenames, MIME/format type, parsability, deterministic content and unit-accurate geometry. Next import into an external pattern CAD application, verify grading and annotations, and open PDF/SVG in independent renderers. Then print a 100% scale test square and measure across printer settings. Finally cut a garment and record measured dimensions and notches. A successful browser download is only the first stage.

## Performance and reliability acceptance

Record full test hardware and load. Track editor input latency at realistic garment sizes, remeshing time, frame-step simulation time, memory peak and startup recovery. Set percentile targets tied to supported hardware once representative data exist. Run cancellation, reopening a project while the solver is active, unexpected solver exit, corrupt project recovery and loss of external drive access. Verify no writes to a different revision and no publication of partial artifacts as completed packages. Each benchmark should include correctness checks: a faster solver that silently drops contact constraints fails.

## CI layers and promotion procedure

On each pull request run inexpensive schema, unit, core JavaScript and C++ tests. Run the native build/parity suite on appropriate OS architecture and keep the Rust sidecar integration suite conditional on documented availability. Nightly or release-candidate jobs may run larger cloth trajectories, visual snapshot comparisons and production package inspections. External CAD and physical factory pilots remain controlled manual acceptance workflows with signed evidence. Existing entries such as `npm run check:non-simulation`, `npm run check:production-handoff`, `npm run build` and `bash native_cpp/scripts/build_and_test.sh` provide grounded initial targets; validate exact package scripts on the checked-out revision.

Every regression failure should preserve the smallest failing fixture and name its owner. Maintain a release evidence dashboard listing accepted cases, rejected cases, skipped conditions, environment and affected releases. Do not erase failing historical experiments; clearly label them obsolete only once independently rerun and superseded. A passing suite is credible precisely because failing cases remain visible and prevent promotion.

## Definition of done

An engineering issue is complete when the change is reviewable, its behavior is specified, a relevant regression or independent measurement exists, the accessible UI/export action works if user-facing, licenses are verified, and residual limitations are documented. A capability is pilot-ready when its normal workflow and meaningful edge cases pass Level A–D. Production approval additionally requires Level E and owner sign-off. No aggregate completion percentage can replace these gates; the product roadmap should show evidence by workflow, garment type, backend and external consumer.
