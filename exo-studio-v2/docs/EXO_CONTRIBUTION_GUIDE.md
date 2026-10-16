# Contributing to EXO Sample 3D

EXO Sample 3D is the current project name and GitHub repository identity. Historic SAMPL3D and Garment Studio strings remain in old document filenames, internal API identifiers and research records for compatibility and provenance. Contributors should not rename serialized schema keys without a migration plan. Start with the repository root [CONTRIBUTING](../CONTRIBUTING.md), [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md), [SECURITY](../SECURITY.md), [governance](../GOVERNANCE.md), [license audit](LICENSING.md) and [architecture](ARCHITECTURE.md). These existing policies take precedence where they define established contributor requirements.

## Mission and constraints

The aim is an inspectable bridge between apparel design and responsible production. Public screenshots, animation clips and demo files should only illustrate results actually produced by a named application revision. Do not describe the complete CLO3D feature set as implemented, claim real-time physically accurate fit based on a visual impression, or promote a test fixture to production-certified without independent evidence. A feature may be experimental and still be useful. Clearly naming its limits makes contributions easier to review and gives future engineers stable acceptance targets.

Respect upstream and asset rights. A source repository being public does not automatically mean every dependency, compiled runtime, avatar, fabric scan, font, design graphic or promo track is safe to redistribute. The optional Rust PPF research checkout is documented in [Rust backend](RUST_BACKEND.md) and normally stored under ignored research directories. Do not commit those upstream binaries, private body scans, credentials, personally identifying customer garments, paid pattern libraries or copyrighted CLO screen captures without sufficient rights. Include source URLs, versions and license notices for original open fixtures; record contributor-generated assets under an explicit license and permission statement.

## How the repository is organized

The browser experience and much of the product behavior live in `src/`, with CAD, grading, production and physics routines in `src/core/`. Native feature ports and CLI tests live under `native_cpp/`; an evolving desktop shell and Qt work have separate directories. The Rust PPF pathway is an optional locally configured service. Automation and parity checkers are under `scripts/`, design and engineering findings under `docs/`, and external research checkouts under ignored paths. Inspect actual directory contents before proposing changes: the native conversion is ongoing and references may move.

An engineer joining the project should read [master roadmap](EXO_MASTER_ROADMAP.md), [simulation research](EXO_SIMULATION_RESEARCH.md), [validation tests](EXO_VALIDATION_TEST_PLAN.md), and [production pipeline](EXO_PRODUCTION_PIPELINE.md). If working on a narrower area, look first at the dated audits: [native conversion](SAMPL3D_NATIVE_CPP_CONVERSION_LOOP_2026-10-15.md), [factory comparison](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md), [fabric parity](SAMPL3D_FABRIC_PARITY_AUDIT_2026-10-15.md), and [simulation gaps](CLO3D_CLOTHING_SIMULATION_GAP_AUDIT_2026-10-13.md). These are checkpoints rather than immutable guarantees; rerun the current tests before relying on a historical passing status.

## Development setup

Begin from a clean copy of the project at a known commit and use the dependency lockfile. Common checks documented by the repo include:

```bash
npm ci
npm run build
npm run check:non-simulation
npm run check:production-handoff
bash native_cpp/scripts/build_and_test.sh
```

These commands are starting examples, not a guarantee that every environment has all optional runtimes. Inspect `package.json`, build scripts, the checked-out toolchain and OS prerequisites. A native compiler, CMake and matching libraries may be required for C++; Qt requires correctly licensed developer components. The Rust PPF solver may need separately prepared upstream sources and service dependencies. Run `npm run ppf:health` only when the optional service is intentionally configured and running. A test that is skipped because a dependency is unavailable should appear as skipped with a reason, not passing.

Before editing, check the repository status and any instructions such as `AGENTS.md` within the affected subtree. Preserve unrelated local modifications, particularly generated reference experiments. Limit each pull request to a coherent feature or defect. Use a fixture that does not reveal personal avatars or licensed commercial design assets.

## Issues and engineering proposals

Open an issue with a concrete user-visible behavior: for example, 'A graded trouser inseam changes length after DXF round trip' or 'A fast shoulder rotation causes the sleeve to pass through the avatar'. Include exact reproduction steps, a minimal allowed-to-share project, expected behavior, observed numeric or visual result, application commit, backend, OS, and why the failure matters. State any existing test and the missing case. Attach a before/after screenshot only when the camera and garment revision are described.

Feature issues additionally specify accepted inputs, outputs and failure handling. Make the proposed data model and ownership clear: for instance, whether notch coordinates are authored CAD, derived geometry or exporter-only annotations. Link the roadmap milestone and write a measurable acceptance gate. If a feature is meant to be compatible with CLO3D, name the exact documented feature or file behavior and test it only through lawful documented interfaces and permitted user workflows. Avoid broad claims like 'CLO parity solved'.

Useful initial GitHub issue milestones are `M0 Fixtures & reproducibility`, `M1 CAD & grading`, `M2 Sewing & meshing`, `M3 Motion/contact & PPF`, `M4 Fabrics`, `M5 Avatar & fit`, `M6 Production interoperability`, and `M7 Desktop & public packaging`. The maintainer can connect those to labels described in [master roadmap](EXO_MASTER_ROADMAP.md). A large parent issue should link independently reviewable implementations and validation tasks, rather than hiding unresolved parts under a single checkbox.

## Change ownership and implementation discipline

Read the call sites and source behavior before changing a module. Write down a small contract: accepted input units, mutation side effects, return fields, error codes, deterministic guarantees and unsupported options. Changes to a shared garment serialization schema need migration rules and old-fixture compatibility tests. Changes to a solver require an explicit statement about whether they alter preview behavior, physical model meaning, timestep stability or contact properties. Never tune a public acceptance threshold merely to match one sample output.

When porting JavaScript to native C++, compare equivalent structured snapshots. Numeric parity should include all relevant metadata and mutated arrays, not just the first frame's positions. Tests that detect unexpected previous-position changes, fabric normals, seam residuals or marker item ordering are valuable. Native code must calculate results independently; copying generated JavaScript output or hardcoding a fixture makes the proof meaningless. Identify intentionally unsupported modes in the adapter and return a clear error instead of silently falling back.

For Rust PPF, maintain a versioned protocol with explicit units, topology hashes and per-frame diagnostics. Treat sidecar unavailability as a normal recoverable state. If the solver accepts a request but produces an invalid trajectory, return a physics failure with reproducible evidence. Do not substitute the last safe frame as final accepted drape without disclosure.

## Meaningful tests and review artifacts

The smallest useful test catches a real class of mistakes and has an independent expected outcome. Include normal and pathological inputs, plus one saved regression for any fixed bug. Unit tests belong close to their modules; end-to-end checks should exercise the public command or UI that a user would invoke. The following script families are examples, and their arguments and evidence coverage should be confirmed against current source: `scripts/check-native-cpp-conversion-coverage.mjs`, `scripts/check-native-cpp-construction-dxf.mjs`, `scripts/check-native-cpp-seam-assembly-parity-bridge.mjs`, `scripts/check-native-cpp-self-collision-real-fixtures.mjs`, `scripts/check-native-cpp-factory-cli.mjs` and `scripts/check-ppf-assembly-acceptance.mjs`.

Every pull request should state what changed, why it changes observable results, which tests were run, actual outcomes and remaining limitations. A failure is acceptable in an experimental branch if it is explicitly described and does not weaken existing release guards. For a numerical change, include representative error distributions, edge-case behavior and a link to a reproducible fixture. For a UI change, include captured current screenshots with the target viewport and the actual feature state. For production changes, attach exported samples and independent parser results with dimensions and units.

Code reviews should check data provenance, determinism, backward compatibility and the chance of misleading the user. Verify that test names reflect their actual coverage, statuses are computed from current revision data and that newly introduced paths are safe to export and extract. Reject test shortcuts that merely duplicate the implementation's calculations or suppress failing fixtures. Security-sensitive material belongs in the project's defined responsible disclosure route rather than a public issue with exploitable details.

## Visual assets, screenshots and demo video

EXO's visual identity should use authentic recent captures of the live app and representative garments. A screenshot set should include drafting and graded sizes, avatar and garment geometry, sewing configuration, fabrics and hardware, studio workspace and production export, with the feature state and build commit in a nearby caption. A promotional V16 video can be referenced after the maintainer verifies where the exact media file lives and whether source music, fonts, model assets and likeness rights permit public inclusion. The documents do not claim that video is already in a GitHub release or that every shot depicts a certified solver. Do not fabricate a better 3D model or substitute unrelated reference imagery for evidence.

Prefer repository-friendly asset formats with bounded size and a caption linking to reproduction steps. For large videos, consider a release attachment or other documented distribution channel after verifying ownership and availability. Avoid committing raw paid texture libraries, personal assets and very large generated caches. If a model is generated from a pattern dataset, include the data license and transformation method where permitted.

## Documentation maintenance and knowledge transfer

Whenever an algorithm changes, update the relevant technical overview, expected units, error semantics and validation links in the same change. Document the difference between a feature's interactive preview, module-level parity and externally certified production workflow. Use examples that another developer can reproduce with public fixtures. Keep historical research reports for provenance, but place a visible superseded note when a later experiment resolves a previous hypothesis. Link substantive future plans into the master roadmap and avoid duplicating volatile numerical scores across files.

A useful handoff tells the next contributor exactly which fixture failed, the command, the observed and expected values, suspected stage boundary, changed files, remaining unknowns and ownership restrictions. This enables independent review across C++, Rust, JavaScript, Qt and factory tooling without overwriting concurrent work. When a task crosses architecture boundaries, describe the serialization contract first and assign isolated components where possible.

## Acceptance and release communication

Use concrete feature-level release language: 'native R12 construction DXF matched the named reference samples' is reviewable; 'factory-ready CLO equivalent' is not supported without external importer, physical sample and sign-off evidence. Define `experimental`, `fixture-verified`, `pilot-validated`, and `production-approved` by the tests in [validation plan](EXO_VALIDATION_TEST_PLAN.md). Keep failed or unexecuted gates visible. Document possible impact on existing user projects and explain recovery paths for migrations. This standard applies equally to community contributions, maintainer work, demonstration videos and public launch descriptions.
