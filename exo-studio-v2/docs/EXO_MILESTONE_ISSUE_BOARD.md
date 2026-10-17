# EXO Sample 3D — proposed milestone and GitHub issue board

**Planning snapshot:** 15 October 2026. **Repository:** renamed `mikristian/exo-sample-3d` (formerly `mikristian/SAMPL3D`); package renamed `exo-sample-3d`; product identity **EXO Sample 3D**. The primary agent reports public release is pending. These are **54 proposed tickets**, not assertions that GitHub issues have already been opened. Issue IDs below are local planning keys until a maintainer creates real issue URLs. Every issue requires a reproducer or acceptance artifact before closure.

## Triage and evidence conventions

**P0**: correctness, data integrity, user trust, or release security blocker. In particular, invalid garment/body collision states must never be labeled fit-accepted; wrong factory units or secretly included restricted media are release blockers. **P1**: necessary for dependable end-to-end authoring, fitting or factory interoperability. **P2**: substantial capability and usability improvements on top of safe basics. **P3**: optional polish, documentation and ecosystem improvements that do not block an honest experimental release.

Statuses are **candidate**, **in investigation**, **fixture tested**, **externally verified**, or **accepted**. The list below is an *open proposed backlog*. Existing implementations may already satisfy portions of individual tickets, but none is closed without a scoped acceptance result. Assign owner **roles**, not named individuals: UI/UX, CAD, solver, native, Rust integration, rendering, production, QA, security or community maintainer. A listed command is an evidence starting point, not proof that it currently passes; inspect package scripts and checked-out tool availability before running. For physical/manual checks, the named protocol is mandatory because no automated test can prove a manufacturer imported a file or cut a correct sample.

Milestones: **M0** reproducibility and licensing, **M1** 2D CAD, **M2** meshing/sewing, **M3** solver and contact, **M4** fabric and fit, **M5** factory handoff, **M6** cross-platform desktop/UI, **M7** community and open-core release. The term *open-core* here is a product-governance direction, **not** an established separate proprietary module boundary: current code carries the GPL-3.0-only project license, and any future commercial modules require an explicit legal, technical and contributor-rights decision. Do not silently relabel GPL-covered source as proprietary.

## M0 — core reproducibility, CI and release safety

**EXO-001 · P0 · QA infrastructure — Freeze licensed reproducible fixture corpus.** Dependency: none. Build manifest-backed tee, pants, curved/darted pattern and layered garment cases with coordinates, seam IDs, material IDs, size grading, geometric unit metadata and license provenance. Acceptance: clean checkout can read fixture schemas and reject altered hashes; no local proprietary avatars or scans. Tests: `npm run check:non-simulation` and fixture parser validation. Evidence: [validation plan](EXO_VALIDATION_TEST_PLAN.md). Owner: QA.

**EXO-002 · P0 · Security — Audit full reachable Git history and media rights.** Dependency: EXO-001 for asset allowlists. Scan every reachable commit and packaged artifact for secrets, private assets, restricted CLO-derived models and accidental credentials. Validate publication rights of V16 soundtrack, photographs, artwork and linked fonts; block release on unresolved findings. Acceptance: reviewed audit log and approved media rights, with sensitive findings omitted from public reports. Tests: repository history scanner, public bundle file inventory, release checklist in [release status](EXO_RELEASE_STATUS.md). Owner: security/release.

**EXO-003 · P0 · CI — Make clean checkout validation an enforceable gate.** Dependency: EXO-001. Run locked dependency install, browser build, CAD/production scripts and native parity on supported hosts. Acceptance: CI reports pass, fail and skipped with environments; protected branch refuses failing gates. Tests: `npm ci`, `npm run build`, `npm run check:non-simulation`, `bash native_cpp/scripts/build_and_test.sh`. Owner: QA/devops.

**EXO-004 · P1 · QA — Establish backend capability and provenance manifest.** Dependency: EXO-001. Persist solver version, units, seed, mesh hash, material hash, avatar provenance and confidence status with each output. Acceptance: invalidating a pattern revision expires associated cloth-fit, POM and marker evidence; restart restores truthful status. Tests: project save/load and schema round-trip check, plus negative tests for stale hashes. Owner: core architecture.

**EXO-005 · P1 · CI — Add representative full-run regression matrix.** Dependency: EXO-003, EXO-004. Run tee, pants and zipper fixtures in default and advanced modes over multiple frames; report differences between fixture parity and physical acceptance. Acceptance: numerically failing fixtures stay red, even if an individual still frame appears close. Tests: `scripts/check-native-cpp-conversion-coverage.mjs`, `scripts/check-native-cpp-cloth-simulation.mjs` and `scripts/check-ppf-multirun-robustness.mjs`. Owner: QA/solver.

**EXO-006 · P2 · QA — Add benchmark dashboards for memory and interaction latency.** Dependency: EXO-003. Record source revision, machine, tessellation, substeps, UI latency, peak RAM and exported file sizes. Acceptance: every performance claim references an identical correctness gate and representative test; no silent contact disabling for speed. Tests: instrumented editor performance and native command timing. Owner: performance.

## M1 — authoring, drafting and 2D pattern integrity

**EXO-007 · P0 · CAD — Validate physical unit scale across authoring/export.** Dependency: EXO-001. Enforce explicit millimeters for production geometry and meters at solver interchange. Acceptance: a measured 100 mm edge remains 100 mm through save/import and DXF; mixed scales fail loudly. Tests: `scripts/dxf-roundtrip-check.mjs`, `scripts/check-native-cpp-dxf-import.mjs`. Owner: CAD.

**EXO-008 · P1 · CAD — Round-trip editable Bézier and concave contours.** Dependency: EXO-007. Track handles, sampled curve tolerances, open/internal construction paths and winding. Acceptance: importing/exporting a concave pattern retains physically measured perimeter within a specified chord-error budget. Tests: `scripts/check-native-cpp-drafting-constructions.mjs`, `scripts/check-native-cpp-project-geometry.mjs`. Owner: CAD.

**EXO-009 · P1 · CAD — Stabilize notch/grainline identities after edits.** Dependency: EXO-008. Associate notches with parent seam arcs and carry identifiers across vertex edits, splits, mirrors and grading. Acceptance: notch shifts remain along intended edges; deleting the referenced edge generates a visible repair task. Tests: `npm run check:non-simulation` and targeted fixture with edge split. Owner: CAD.

**EXO-010 · P1 · CAD — Verify undo/redo and versioned project migrations.** Dependency: EXO-004, EXO-008. Preserve edits, history and cutpiece IDs across reopening. Acceptance: 100-operation edit/undo/redo/save scenario round-trips without hidden loss of seam constraints or grade metadata. Tests: `scripts/check-native-cpp-cad.mjs` plus project migration fixture. Owner: core CAD.

**EXO-011 · P1 · CAD — Expand 2D grading edge-case fixtures.** Dependency: EXO-007, EXO-009. Include negative increments, asymmetry, custom size labels, curved armholes, leg inseams and mirrored pieces. Acceptance: independently expected size/POM deltas and seam lengths match all exported sizes. Tests: `scripts/check-native-cpp-grading-helpers.mjs`, `scripts/check-factory.mjs`. Owner: grading engineer.

**EXO-012 · P2 · UI/CAD — Add constraint-aware snapping diagnostics.** Dependency: EXO-008. Make snap source, actual geometric constraint and high-DPI cursor tolerance visible during point/line editing. Acceptance: zoom-independent snapping on dense overlapping curved geometry; keyboard undo reproduces state. Tests: `scripts/check-native-cpp-drafting-constructions.mjs` and browser pointer test. Owner: CAD/UI.

**EXO-013 · P2 · CAD — Implement independent dart, pleat and cutout audits.** Dependency: EXO-008. Define geometric folding, dependent marks and reversible construction transformations. Acceptance: each feature survives size grading, DXF, preview and reopening without topology corruption. Tests: `scripts/check-native-cpp-construction-dxf.mjs` and new pattern fixtures. Owner: CAD.

## M2 — garment topology, sewing and assembly

**EXO-014 · P0 · Meshing — Guard degenerate and inverted triangles.** Dependency: EXO-008. Reject zero-area faces and incorrect winding; maintain source panel IDs and grain-relative UVs. Acceptance: all normal fixtures pass; deliberate degeneracy yields actionable errors, never a supposedly accepted mesh. Tests: `scripts/check-native-cpp-pattern-mesh.mjs`, `scripts/check-native-cpp-cloth-meshing-pipeline.mjs`. Owner: geometry.

**EXO-015 · P1 · Sewing — Stable arc-length seam correspondence.** Dependency: EXO-009, EXO-014. Match seam edges under differing discretization and opposing winding. Acceptance: every stitch maps to a stable source interval and reports residual gap; no silent dropped segments. Tests: `scripts/check-native-cpp-native-seam-assembly.mjs`. Owner: simulation geometry.

**EXO-016 · P1 · Sewing — Validate easing, gathers and split seams.** Dependency: EXO-015. Model unequal sewn lengths explicitly and preserve user-defined ease distribution. Acceptance: eased seam has bounded drift without unintended hard stretching, while impossible seams stay visibly invalid. Tests: `scripts/check-native-cpp-seam-assembly-parity-bridge.mjs` plus custom fixture. Owner: sewing engine.

**EXO-017 · P1 · Sewing — Stabilize contact-constrained advanced assembly.** Dependency: EXO-015, EXO-025. Cover iterations 0/1/4/6, pass count 1/2, zipper weights and variable contact margin for tee/pants. Acceptance: native and reference state/metrics align at defined tolerances; unsafe body crossings are flagged. Tests: `scripts/check-native-cpp-seam-assembly-parity-bridge.mjs`. Owner: native solver.

**EXO-018 · P2 · Sewing — Add reversible zipper and hardware anchors.** Dependency: EXO-016. Model two zipper tapes, slider anchors, gap, material collision and required stitch endpoints. Acceptance: open/closed zipper motion remains connected and topology-valid without panel fusion. Tests: seam parity fixture and new zipper trajectory. Owner: sewing/hardware.

**EXO-019 · P2 · Mesh — Incremental remeshing without stale linked views.** Dependency: EXO-014, EXO-004. Invalidate only derived triangulations affected by pattern edits and update both 2D and 3D. Acceptance: no old mesh rendered or exported after a point drag; UV, panel name and material assignment persist. Tests: `scripts/check-native-cpp-cloth-meshing.mjs` and live editor integration test. Owner: geometry/UI.

## M3 — solver physics, Rust PPF and body/cloth collisions

**EXO-020 · P0 · Solver — Preserve current/previous particle integration parity.** Dependency: EXO-014. Instrument contact and stabilizer stages to identify divergent previous coordinates without altering tested positions. Acceptance: tee and pants multi-frame trajectories have bounded, explained position/velocity differences, with both collision flags. Tests: `scripts/check-native-cpp-cloth-solver-step-contacts.mjs`. Owner: native solver.

**EXO-021 · P0 · Contact — Prove swept cloth/body CCD on motion trajectories.** Dependency: EXO-020, EXO-025. Detect vertex-face and edge-edge crossings between snapshots, including arm sweeps and near-tangential motion. Acceptance: full-frame trajectory metrics show no unreported crossings within stated geometric tolerance; failed historical Metal case remains a negative control. Tests: `scripts/check-ppf-upstream-motion-contact.mjs`, `scripts/check-ppf-export-interpolation-regression.mjs` and swept-triangle analyzer. Owner: collision research.

**EXO-022 · P0 · Contact — Verify self-collision in multilayer garments.** Dependency: EXO-014, EXO-020. Include cuff folds, crossing legs and stacked jacket panels with genuine nonadjacent triangle checks. Acceptance: zero unreported intersections in supported motion envelope and stable friction without solver explosions. Tests: `scripts/check-native-cpp-self-collision-real-fixtures.mjs`, `scripts/check-native-cpp-cloth-collision-step.mjs`. Owner: collision solver.

**EXO-023 · P0 · Fit — Enforce scoped certification flags.** Dependency: EXO-004, EXO-021, EXO-022. Calculate fit acceptance from actual seam, motion, strain and penetration evidence with explicit avatar/material revision. Acceptance: historical October 13 failed Rust PPF tee cannot be marked fit-certified even when solver returns successful execution. Tests: `scripts/check-ppf-assembly-acceptance.mjs` and negative fitAcceptance fixture. Owner: QA/physics.

**EXO-024 · P1 · Rust — Version the PPF sidecar data contract.** Dependency: EXO-004, EXO-014. Validate hashes, meters, triangle indices, seam groups, fixed timestep and compatibility before solve. Acceptance: malformed or incompatible payloads reject with typed error and leave document intact. Tests: `scripts/check-ppf-payload.mjs`, `scripts/check-native-cpp-ppf-payload.mjs`. Owner: Rust integration.

**EXO-025 · P1 · Avatar — Reconcile mesh and surface-contact projections.** Dependency: EXO-014. Check triangle normals, contact depths and corrected particle/previous states across real tee and trousers. Acceptance: independently sampled body penetrations align with native kernel under a stated error bound; mismatches name stage and vertex. Tests: `scripts/check-native-cpp-avatar-surface-real-fixtures.mjs`, `scripts/check-native-cpp-mesh-avatar-contact.mjs`. Owner: collision geometry.

**EXO-026 · P1 · Rust — Recover safely from solver unavailable/crashed.** Dependency: EXO-024. Preserve project and the last trustworthy frame with an explicit experimental-state label. Acceptance: service failure never produces a fake successful drape or an unsaved data loss event. Tests: `npm run ppf:health` for configured service and controlled fault-injection integration. Owner: Rust integration/UI.

**EXO-027 · P1 · Physics — Benchmark timestep and mesh convergence.** Dependency: EXO-020, EXO-022. Compare energies, maximum strain, seam residuals and contact metrics at multiple timestep/mesh resolutions. Acceptance: documented stable region with reproducible deviations and rejected parameter ranges. Tests: `scripts/check-native-cpp-cloth-simulation.mjs` and expanded parametric sweep. Owner: simulation research.

**EXO-028 · P2 · Physics — Add reproducible full-motion reports.** Dependency: EXO-021, EXO-027. Export metrics and frame snapshots for walking, rotating arms, squat and reaching. Acceptance: reports include every frame and complete configuration, not only best rendered still. Tests: `scripts/check-ppf-multirun-robustness.mjs` and replay analysis. Owner: QA/physics.

**EXO-029 · P2 · Rust — Verify platform-specific Metal/runtime repeatability.** Dependency: EXO-024, EXO-027. Capture permitted M-series test configurations and stable hashes while respecting upstream solver distribution licenses. Acceptance: repeatability results and failures link to solver build and GPU backend. Tests: `scripts/check-ppf-metal.sh` and [Metal research](PPF_METAL_REPEATABILITY_AND_SMOOTH180_RESULTS_2026-10-14.md). Owner: Rust integration.

## M4 — fabric, avatar, rendering and fit reporting

**EXO-030 · P1 · Materials — Separate optical presets from physical fabric inputs.** Dependency: EXO-004. Define explicit provenance for density, elasticity, bending, shear, friction and thickness; keep PBR changes separate. Acceptance: editing albedo preserves current drape while physical stiffness edits invalidate the solver state. Tests: `scripts/check-native-cpp-fabric-pbr-pixels.mjs` and material mutation regression. Owner: materials.

**EXO-031 · P1 · Physics/materials — Calibrate reference textile swatches.** Dependency: EXO-027, EXO-030. Source measurement protocols and uncertainty for directional extension, bending and gravity drape. Acceptance: simulated and measured shape errors and confidence intervals are published for at least two materially different fabrics. Tests: physical swatch protocol plus solver convergence suite. Owner: materials research.

**EXO-032 · P1 · Avatar — Build licensed body measurement landmarks.** Dependency: EXO-001, EXO-025. Create reference avatars with repeatable body scale and garment-measurement landmarks. Acceptance: no restricted Thomas model in public fixtures; landmark positions and units survive exports. Tests: avatar provenance check and `scripts/check-native-cpp-avatar-physics.mjs`. Owner: avatar/CAD.

**EXO-033 · P2 · Rendering — Verify all procedural textile textures.** Dependency: EXO-030. Test repeat scale in centimeters, normal orientation, roughness bounds and transparent/nontransparent behavior in multiple lights. Acceptance: documented shader fixtures match image-generation buffer outputs within declared tolerances. Tests: `scripts/check-native-cpp-textile-procedurals.mjs`, `scripts/check-native-cpp-fabric-surface.mjs`. Owner: rendering.

**EXO-034 · P2 · Fit UI — Explain clearance, strain and uncertainty heat maps.** Dependency: EXO-023, EXO-032. Label measured units and unsupported pressure approximations; show stale-analysis state after size or pose edits. Acceptance: a failed collision never renders as 'good fit' merely from color choice. Tests: negative trajectory fixture and automated UI snapshot. Owner: UI/physics.

**EXO-035 · P2 · Rendering — Improve authentic neutral-model and studio lighting.** Dependency: EXO-032, EXO-033. Preserve garment geometry and truthfully annotate staging/simulation state while adding camera controls, PBR comparisons and studio presets. Acceptance: recent captured UI matches real app state under reproducible fixture. Tests: `scripts/capture-exo-public-gallery.mjs` and visual review. Owner: rendering/UI.

## M5 — export, BOM, grading, marker and factory pilot

**EXO-036 · P0 · Production — Verify graded DXF units and external import.** Dependency: EXO-007, EXO-011. Document layer/notch/grain conventions, inspect export and import in independent CAD software. Acceptance: sizes, contours, placements and annotations agree after consumer import; record exact importer version/settings. Tests: `scripts/check-native-cpp-construction-dxf.mjs`, `scripts/dxf-roundtrip-check.mjs`, external CAD protocol. Owner: CAD interoperability.

**EXO-037 · P0 · Production — Lock production preflight and approvals to revision.** Dependency: EXO-004, EXO-036. Block bad geometry, incomplete cuts and missing essential materials; log warning suppressions with reviewer. Acceptance: modifying a piece or BOM revokes affected production approval and regenerates validation. Tests: `npm run check:production-handoff`, `scripts/check-native-cpp-preflight.mjs`. Owner: production/QA.

**EXO-038 · P1 · Production — Confirm POM calculations and supplier method.** Dependency: EXO-011. Define landmarks, seam allowances, flattening assumptions and tolerance grading per size. Acceptance: technician-measured physical sample matches approved POM methodology with deviations reported. Tests: `scripts/check-native-cpp-pom-parity.mjs` where available and manual measurement audit. Owner: technical design.

**EXO-039 · P1 · Factory — Complete colorway-aware BOM with unknown costs.** Dependency: EXO-030, EXO-037. Link trims, fabric lots, zipper options and prices to sizes and colors, preserving missing as unknown. Acceptance: XML/CSV round-trip preserves SKUs, quantities, cost states and schema version. Tests: `scripts/check-native-cpp-bom.mjs`, `scripts/check-native-cpp-fabric-cost.mjs`. Owner: production data.

**EXO-040 · P1 · Marker — Move to validated true-contour nesting.** Dependency: EXO-036, EXO-039. Add nap, grain, fold, cut pair, selvage and material-width constraints, plus deterministic placement. Acceptance: no piece overlaps, margin rules hold and cut quantities match manifest. Tests: `scripts/check-markers.mjs`, `scripts/check-native-cpp-marker-exact.mjs`. Owner: nesting engineer.

**EXO-041 · P1 · Plotting — Verify actual-size PDF/SVG and physical print.** Dependency: EXO-040. Add registration, tiling and printable-area controls; calibrate test square physically. Acceptance: measured output reflects claimed 100% scale within printer-specific tolerances recorded in report. Tests: `scripts/check-native-cpp-marker-pdf.mjs`, `npm run check:production-handoff`, real print protocol. Owner: production QA.

**EXO-042 · P2 · Production — Add HP-GL/PLT only with cutter proof.** Dependency: EXO-041. Map valid cut/draw commands to tested device and documented units. Acceptance: file is interpreted correctly by a named plotter/cutter and safety parameters are controlled. Tests: device integration procedure; no software-only pass substitutes. Owner: hardware interoperability.

**EXO-043 · P1 · Factory — Canonical, auditable factory ZIP manifest.** Dependency: EXO-037–EXO-041. Bind sizes, DXF, BOM, POM, markers and tech pack to common immutable revision with hashes and safe entry names. Acceptance: missing or stale source file fails packaging; independent parser verifies archive. Tests: `scripts/check-native-cpp-factory-zip.mjs`, `scripts/check-native-cpp-factory-cli.mjs`. Owner: production architecture.

**EXO-044 · P1 · Production — Complete supervised physical sample pilot.** Dependency: EXO-036, EXO-038, EXO-041, EXO-043. Hand frozen tee/pants files to a cooperating sample maker, record import, print, cutting, sewing and measured garment differences. Acceptance: independent signed sample QA and tracked deviations; scope of approval is style/size/fabric-specific. Tests: physical pilot protocol in [production pipeline](EXO_PRODUCTION_PIPELINE.md). Owner: technical design/manufacturing.

**EXO-045 · P2 · Export — Test glTF/OBJ interoperability and advanced formats.** Dependency: EXO-014, EXO-030. Validate triangulation, UV, PBR maps, normals, units and named materials with separate viewers. Acceptance: compatible loaders reconstruct authored shape and output reports preserve unsupported animation features. Tests: `scripts/check-native-cpp-gltf.mjs`, `scripts/check-native-cpp-flat-obj.mjs`. Owner: 3D export.

## M6 — live UI, native Qt and desktop delivery

**EXO-046 · P1 · UI — Make workspace actions truthful and fully testable.** Dependency: EXO-004, EXO-023. Check 2D, sewing, fabric, avatar, studio and production flows as actual interactions. Acceptance: every prominent toolbar action functions or declares unavailable/experimental with no fake success indicators. Tests: `npm run check:production-ui` and targeted Playwright user flows. Owner: UI QA.

**EXO-047 · P1 · Qt — Native desktop parity for save, undo and production.** Dependency: EXO-010, EXO-043. Build, launch and exercise Qt canvas, pattern inspector, marker and export from saved projects. Acceptance: native GUI can round-trip reference garment and export equivalent measured geometry without using browser shell. Tests: `native_cpp/scripts/verify_qt_desktop.sh` with documented SDK and smoke profile; see [Qt report](SAMPL3D_NATIVE_QT_DESKTOP_BUILT_2026-10-15.md). Owner: native desktop.

**EXO-048 · P1 · UI — Link editable 2D to actual 3D simulation state.** Dependency: EXO-019, EXO-023. Track 2D edits into rest mesh and invalidate old solved frames visibly. Acceptance: modifying sleeve curve changes correct 3D panel and a re-simulation is explicitly required. Tests: browser edit/sim integration, saved project reload. Owner: UI/simulation integration.

**EXO-049 · P2 · Desktop — Safe project migration across WebKit/Qt.** Dependency: EXO-010, EXO-047. Implement compatible schema revisions and rollback/recovery tests across app shells. Acceptance: independent legacy and Qt open/save round trips preserve pattern, materials and history while protecting originals. Tests: migration corpus and bundle smoke tests. Owner: desktop architecture.

**EXO-050 · P2 · UX — Accessible high-density drafting navigation.** Dependency: EXO-046. Validate high-DPI hit targets, keyboard navigation, fit-to-view, undo and predictable tool mode behavior. Acceptance: manual accessible workflow plus automated focus/keyboard checks on target macOS. Tests: browser accessibility test, Qt offscreen screenshot comparison. Owner: UI/UX.

## M7 — public docs, collaboration and long-term governance

**EXO-051 · P0 · Release — Verify actual public repository and license boundaries.** Dependency: EXO-002, EXO-003. Check source commit hash, remote visibility, public asset manifest, GPL notices, upstream binaries and outbound documentation links. Acceptance: unauthenticated reader sees exact reviewed release revision with no restricted files; release state is recorded separately from local Git. Tests: GitHub access/manual audit, clean checkout CI and licensing review. Owner: release/security.

**EXO-052 · P1 · Community — Create issue/PR templates reflecting scientific gates.** Dependency: EXO-003. Capture fixture, backend, units, observed/expected values, acceptance evidence and source rights in forms. Acceptance: sample bug/feature PR can be reviewed without back-and-forth for basic reproduction details. Tests: template examples and maintainer trial review. Owner: community.

**EXO-053 · P2 · Community — Publish contributor-owned reproducible demos.** Dependency: EXO-001, EXO-035, EXO-051. Provide licensed sample garment workflows, explicit experimental badges, recent app screenshots and V16 video rights notes. Acceptance: every gallery image links to actual fixture and app state, and media rights are approved before release. Tests: `scripts/capture-exo-public-gallery.mjs` plus human review. Owner: documentation/media.

**EXO-054 · P3 · Governance — Decide future open-core module policy explicitly.** Dependency: EXO-051, EXO-052. Document whether any optional commercial service/module is planned, how it interacts with GPL source, and contributor consent for relicensing or external APIs. Acceptance: published policy approved by maintainers/legal reviewers and no retroactive unsupported ownership claims. Tests: governance document review against [licensing](LICENSING.md) and contribution policies. Owner: governance/legal.

## Sequencing and ownership protocol

Start P0 work across M0, core units and physical truthfulness together; EXO-001/002/003/004 establish the evidence and release foundations, while EXO-014/020/021/022/023 prevent a visibly attractive but untrustworthy on-body result. M1 geometry and M2 seam integrity are prerequisites for trustworthy M3 fit and M5 manufacturing. Parallelize optical fabric shaders and gallery UI only when they do not mask stale simulation states. Production file-format work can progress alongside physics research because cutting dimensions can be validated independently of drape; however a factory-ready badge still requires its own physical pilot.

Every issue needs a concrete **owner role**, named reviewer at assignment, failure fixture, required test command, expected numeric or external outcome, and a record of skipped environmental checks. When creating GitHub issues, link these local planning IDs to the resulting issue numbers without replacing the descriptive title. Maintain blocked-by links and summarize partial completion in issue comments. Avoid a misleading global percentage of CLO3D equivalence or C++ conversion: report by workflow, backend, garment fixture and independent external consumer.

The release narrative should retain the October 13 Rust PPF fit failure as a regression and clearly separate the October 15 Qt app smoke success from complete interactive sewing or certified physical fit. This is consistent with [project history](EXO_PROJECT_HISTORY.md), [master roadmap](EXO_MASTER_ROADMAP.md), [test plan](EXO_VALIDATION_TEST_PLAN.md), [production pipeline](EXO_PRODUCTION_PIPELINE.md) and [release status](EXO_RELEASE_STATUS.md).
