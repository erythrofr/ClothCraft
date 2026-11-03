# Repository handoff

## Default sphere demo mesh controls — 31 October 2026

Plain `cargo run` still launches the original cloth-over-sphere reference
editor. Its right-hand **Simulation** tab now exposes **Physics-inspired mesh
preparation** and **Remesh and reset** ahead of the solver settings. The
optional Project v1 `physics_sizing` field is omitted by default. It uses the
existing polygon compiler and static sizing pipeline on the rectangle, keeps
the original sphere/hanging placement and hanging corner pins, and rebuilds
mass/hinges from material coordinates. Changing material or grain rebinds the
plan during compilation. Save/load and reset retain it; **Use uniform grid and
reset** clears it. Preparation requires a paused worker with no pending step.
Inputs are estimates in Pa, separate from membrane coefficients in N/m.

The same controls now also appear in **Properties > REST PATTERN**, below
grain and before the sphere settings. Both tabs share the same draft values
and apply path. **Remesh and reset** applies sizing estimates together with
pattern/fabric settings; **Apply and Reset** rebuilds the current mesh mode.

Validation: 197 selected CPU tests passed across both editor binaries, static
garment preparation, reference numerics and the five new reference-project
checks; two existing optional captures were ignored. The default native binary
also built successfully. No native-window or GPU interaction acceptance was
run. The optional strict Clippy pass was stopped during its fresh desktop
dependency rebuild to release Cargo; no lint result is claimed.

## One-time physics-inspired mesh preparation — 31 October 2026

The independent `codex/physics-inspired-mesh-resolution` branch now shares
its CPU sizing implementation between CLI comparison examples and the native
Simulation inspector. **Physics-inspired mesh preparation** compiles an optional
static plan and resets the arrangement through the existing scene installer;
the resulting topology stays fixed during solver steps. Reset rebuilds the
same plan. Existing uniform defaults and solver/contact rules are unchanged.

The preparation controls now appear directly under Mesh resolution, ahead of
the comparison lab, with no collapsed section. They remain available without
a piece selection and then target all editable polygon pieces. Selecting a
polygon enables the single-piece scope; clearing selection restores all-piece
scope. Legacy rectangular pieces are excluded.

The optional meshing settings retain explicit Pa estimates; bending and grain
are rebound to the current fabric/panel during compilation. Named boundaries,
mass, seam compilation, ordinary saves and signed caches use the normal paths.
CPU checks cover physical compilation, fixed-topology stepping, pins, curves,
cache rejection, deterministic reset, history and native named controls.
The comparison UI has an explicitly invoked CPU-rasterized layout preview;
native-window/GPU runtime acceptance has not been performed.
See [the runnable gathered-panel project, UI placement and limits](pie-resolution.md).


## Editor transitions and workspace profiles — 26 October 2026

PR #111 merged as `07c4988`. The production cancellation and installation
paths now have direct CPU coverage, including state restoration and stale
worker-generation rejection. This supersedes the source-review-only status
below; [group placement](group-placement.md) separates that evidence from
the remaining full native interaction and concurrent-worker checks.

PR #114 merged as `fcc7356` after seven green checks at `da2f4ad`. Named
workspace profiles are available under Workspace → Workspace profiles. Five profile fixtures and the full desktop
CPU suite passed (110 tests, one optional preview ignored); strict desktop
Clippy passed. The source reservation on #113 is released. Review the existing
PR before claiming follow-up work; do not build a second profile store.

## Native SVG import and command palette — 26 October 2026

PR #107 merged as `260646b` after seven green checks at `3771fa9` and exposes
File → Import SVG patterns. [SVG import](svg-import.md) documents selection,
units, conversion losses, atomic preparation and CPU widget/save-reopen checks.
This supersedes the earlier reader-only UI status below. EXO-IO-011 (#103)
retains the full native interaction/installer acceptance boundary.

PR #110 merged as `742b4ef` after seven green checks at `d38e3d0`. The
[command palette](command-registry.md#find-a-command) searches twelve existing
commands through the shared checked adapter. EXO-UX-002 (#109) retains native
input-isolation acceptance; CPU palette fixtures are already implemented.
Both source reservations are released. Review the merged code and remaining
evidence before claiming work, rather than creating duplicate integrations.

## Group placement integration — 26 October 2026

PR #105 merged as `2f9f9c5` after seven successful checks at `4a4340a`.
Shared-pivot group transforms and bounded visible/through 3D marquee selection
are implemented. [Usage and limits](group-placement.md) document the pivot,
flat-arrangement reset, sampling budget and cancellation behavior.

EXO-UX-004 (#104) remains open for complete Atelier cancellation/generation
acceptance. Backend and helper/widget tests pass; full native interaction was
not run. The source reservation is released. Obtain an accepted claim before
adding missing evidence; do not reimplement the already merged feature.

## Physical SVG reader — 26 October 2026

PR #101 implements EXO-IO-001, merged as `dcbc3154` after seven successful
checks at `4aea2c3`. Nine focused CPU fixtures cover physical dimensions,
transformed curve error, malformed/resource-limited inputs, editable conversion,
preserved drape, undo/redo and save/reload. The strict reader and prepared edit
are documented in [SVG import](svg-import.md); they do not add a desktop dialog.

EXO-IO-011 (#103) is the reviewed native integration follow-up. Reuse the reader
and existing authoring installer, display dimensions and losses before Apply,
and preserve the distinction between prepared-edit tests and full native-window
acceptance. The reader reservation is released. Obtain a fresh accepted claim
for UI work; do not duplicate parsing or advertise planned format support.

## Native command registry — 26 October 2026

PR #97 implements EXO-UX-001 with twelve typed commands routed through the
existing native adapter. It preserves Mikristian's original contribution from
#29 and adds accurate context, undo and failure behavior. All seven checks
passed at `a8c601f` before merge `c558dc6`. The reservation is released.
See [the command contract](command-registry.md) before implementing a palette
or automation caller: availability is a snapshot, worker submission is not
completion, and session export is not an atomic multi-file transaction.
CPU tests cover metadata, channel failure and export side effects; native GPU
window acceptance remains unclaimed. The dependent catalog tasks become
eligible through this documentation update, not automatically assigned.

## Avatar collision diagnostics — 26 October 2026

PR #96 implements EXO-AV-004. Properties → Simulation → Avatar collision
diagnostics inspects the actual static collision surface and optionally checks
the captured cloth state through an independent CPU VBD constructor. No solver
step, cache warming, geometry repair or collision approximation is introduced.
The bounded background request reports freshness, source identity, referenced
bounds and topology warnings. See [coverage and limitations](avatar-diagnostics.md).
Passing initialization does not certify global containment or static avatar
self-intersections; the existing sewing exclusions still apply.

Merged as `42addbc1c1c66aff5fe711112c3f6ed4685dc13b` after all seven checks
passed at `0438b63cd41a036ec9b4bde245dd6d97ebb90e0b`. Local evidence: five
CPU backend tests, 87 active desktop tests (one optional preview ignored) and
strict Clippy passed. Three named-widget tests cover real asynchronous jobs,
pause requirements, stale samples, failed initialization and disconnect/retry.
No native GPU/window appearance claim. Issue #20 records the accepted release;
the catalog completion is maintained separately from file ownership.

## Native DXF pattern import — 26 October 2026

PR #92 implements EXO-IO-010 on top of the generic reader from #88.
File → Import DXF patterns reviews source units, layers, closure and excluded
entities before appending selected outlines as ordinary unsewn panels. Changing
units or chord tolerance invalidates the previous reviewed selection. CAD +Y
maps to decreasing material V. Nested, touching and overlapping selected paths
are rejected instead of inferred as holes or cut/sew alternatives.

Preparation compiles the whole garment before recording one undo entry; the
existing installer preserves unchanged panels and invalidates dependent caches.
The source file is no longer needed after saving. The six-file implementation
and limitations are described in [pattern import](pattern-import.md).

Merged as `d98e889a454ea049124259e275e5de8bfdc2bc48` after seven green checks
on `fb4e203e5098393d6a9d08ca294af40b8331eff2`, including portable Windows
packaging. Local checks: five backend tests, 84 active desktop CPU tests
(one optional preview ignored) and strict Clippy passed. Four named-widget
tests cover actual controls, including a long-layer-name regression. Native
OS picker/GPU visual acceptance remains unverified. No solver changes or
industrial DXF support are implied. The reservation was explicitly released
and confirmed on issue #90 before merge.

## Static avatar import — 25 October 2026

PR #74 implements EXO-IO-009: File → Import avatar accepts static OBJ, glTF
and GLB with an explicit geometry-only confirmation. CPU candidate preparation
validates and stages a canonical OBJ before replacing the scene. Authored
patterns, seams and live settings survive; draped state and undo history reset.
The existing portable asset writer preserves saved geometry after staging is
dropped. See [avatar import](avatar-import.md) for failure semantics and limits.

At source commit `39c61c9`, five import integration tests, fourteen existing
glTF/document tests and 69 active desktop unit tests passed locally (one
optional preview ignored). CPU and desktop Clippy passed with warnings denied.
Named-widget checks exercise confirmation, cancellation, errors and a small
window. Native OS pickers and GPU rendering were not exercised. No physics
algorithm changed. Dense import remains synchronous; scene selection, scale
conversion, texture import and animation remain unsupported.

PR #63 supplies the template browser used beside this workflow. PR #29's
command registry remains a separate contribution: review found a failing
`cloth-fit` Clippy check and error propagation that needs correction before
integration. Preserve its accepted ownership and consult issue #21.

## Final-state diagnostics — 25 October 2026

Task EXO-PHY-004 / issue #72 adds an opt-in **Sample final state** action to
the native Simulation inspector. It follows one accepted step and reports
final OGC contact count/separation when present, the free-DOF backward-Euler
residual in newtons, sample and detection cost, backend and freshness. The
sample is read-only: it clones the collision world before the fresh detection,
so it cannot warm the next step's cache or change the accepted trajectory.
Pinned vertices are excluded; no free vertices yields `None`, never a fake
zero; no contact term also yields an unavailable separation.

Residual definition: for free vertex `i`, `r_i = m_i (v_i+ - v_i-) / dt +
damping * m_i * v_i+ - F_i`, where `F` is the existing physical force at the
accepted positions with **final** contacts (gravity, membrane, bending, sewing,
contact and grab). The UI reports `sqrt(sum |r_i|^2 / (3 * N_free))`. It is an
unconstrained gradient, not a KKT/constrained-equilibrium or per-color
mixed-gradient certificate. The in-step `detection_ms` contact set is an
earlier query and is labelled separately.

Review of PR #66: its accepted-position detection and free-DOF residual
semantics are the useful precedent. This slice does not import its removal of
`src/vbd/audit.rs`, its large GPU-path rewrite, its authoring changes or its
final-separation rejection gate. The current audit, directional bounds, sparse
precision, predictor, collision coverage, contact refresh and rejection policy
are unchanged.

Implementation: `FinalDiagnostics` plus the one-shot solver method are in
`src/vbd.rs`/`src/vbd/audit.rs`; the worker owns a one-shot request/result slot
keyed by solver generation and a monotonic request id, and clears it when the
generation changes; `src/atelier/chrome.rs` provides the named control,
identity filtering and presentation. The worker slot is deliberately outside
the per-step `Latest` snapshot so a slow frame cannot lose a completed sample.
A request for a newer generation is kept queued until the worker accepts that
generation; results from older generations or older requests are ignored even
when physical timestamps match. A proper worker command channel would need
`src/atelier.rs`, which is outside this task's scope.

Validation (CPU only; no GPU or native window):

- `cargo fmt --all -- --check`
- `RAYON_NUM_THREADS=2 cargo test --locked --no-default-features -j 2 -- --test-threads=2`
- `cargo clippy --locked --no-default-features --all-targets -j 2 -- -D warnings`
- `cargo clippy --locked --features desktop --bin cloth-fit --tests -j 2 -- -D warnings`
- `cargo test --locked --features desktop -j 2 --bin cloth-fit final_diagnostics_tests -- --test-threads=2` (3 named-widget/presentation tests)
- `cargo test --locked --features desktop -j 2 --bin cloth-fit final_diagnostics -- --test-threads=2` (7 diagnostics transport/presentation tests)
- template validation for `two-panel`, `local-ease`, `tshirt`, `dress`,
  `curved-panels` and `partial-chain`.

The new `tests/vbd_final_diagnostics.rs` checks accepted contacts against a
fresh detection, the residual against a finite-difference objective with
contact, seam, inertia and grab terms, pinned normalization, state preservation,
the one-accepted-step contract and that sampling does not change the next
accepted trajectory.

Indicative medians of five steps on this machine (CPU test profile,
`RAYON_NUM_THREADS=2`): 16 vertices, step 3.93 ms / sample 0.30 ms; 60 vertices,
7.99 / 0.66 ms; 2,454 vertices, 155.68 / 26.61 ms. The sample is outside
`step_ms`, and the default step pays only one atomic request poll. These are
small local fixtures, not a portable performance gate; keep sampling opt-in.
A GPU-accepted state is audited on the CPU and labelled "GPU-accepted state /
CPU audit (GPU timings unavailable)"; no GPU residual or timing is claimed.
Sampling while paused advances one step, as stated in the button tooltip.
While playing, a sample becomes stale on later states; pause to inspect it.

At the compact contact barrier's activation radius the potential is only
piecewise smooth: a tiny penetration can carry a large accepted-side force
that a finite-difference step outside the support does not see. The sample
reports that force without regularizing or hiding it. Use final contacts
strictly inside the support for gradient comparisons; a boundary sample is not
a convergence measurement.

Branch: `FireflyTheReal:agent/exo-phy-004-final-diagnostics`
PR: https://github.com/erythrofr/ClothCraft/pull/76

## Construction preview follow-up — 23 October 2026

PR #38 now includes an auto-scaled, read-only board-space diagram in the
numeric inspector. A directed reference edge, current corner and proposed
corner make the operation visible before Apply. The diagram uses stable
boundary references and the same flat layout transforms as construction;
it neither remeshes nor reads simulation state. It is not a whole-contour
validity check. The normal transaction still validates geometry and seams.

CPU validation: all 49 desktop unit tests passed, one optional preview ignored;
this includes the three construction UI tests (labels, explicit Apply,
keyboard focus, rotated geometry and stale references). Desktop binary Clippy
passed with warnings denied. No native window or GPU was used. The earlier
revision of #38 had 12 green CI checks; the follow-up requires fresh CI.

## Numeric point construction — 23 October 2026

Task EXO-CAD-002 / issue #36 adds Project, Distance and Perpendicular actions
to the selected point's Piece inspector. It reuses the original Rust line API
from #26. `ConstructionRef` identifies a corner by panel ID and outgoing
boundary name; `Command::ConstructPoint` resolves both pieces in board space,
converts the result to target material coordinates and uses ordinary anchor
movement, compilation and history. No persisted schema or solver changes.

Signed fields are in millimetres. Projection and distance use an infinite line;
curved reference edges are rejected. Perpendicular offset starts at the
orthogonal projection and follows +90 degrees in numerical board coordinates.
The inspector previews coordinates; only Apply mutates the document. Other
pieces retain their board positions even when legacy layouts were implicit.
This is a one-time construction, not a live dimensional constraint. See
`docs/authoring.md` for the workflow.

The previous Freehand UI PR #35 was merged as `3bac583` after all 12 CI checks
passed. Catalog PR #37 records its completion and enables this narrower UI
task without touching the `src/atelier.rs` scope reserved by EXO-UX-001.

Validation: the baseline full CPU suite passed 305 tests including its doctest.
After this change, 37 targeted CPU tests pass (authoring, constructions and
drawing_commands, including six new construction cases); 48 desktop unit
tests pass with one optional preview ignored. The two new headless UI tests
check visible millimetres, explicit Apply, invalid input and text-field focus.
Targeted desktop Clippy with warnings denied, rustfmt and the release
`cloth-fit` build pass. This pass did not launch a native window or use the GPU;
native visual acceptance remains separate from these CPU checks.

## Freehand panel integration — 23 October 2026

PR #27's CPU fitter is merged at `8b69e5c`; its six CI checks passed before
merge. Task EXO-CAD-009 / issue #33 integrates it through `Command::Freehand`
and the 2D board's Freehand control. The new-panel transaction preserves
independent cubic controls, existing panel/seam IDs and material metres.
Preview and commit use contour validation; no solver/contact code changes.

The UI captures delivered pointer events, fits on release, shows the closing
edge and requires Create panel. Pending strokes are transient; committed
panels use the existing document/history pipeline. See `docs/authoring.md`
for gestures, bounds and limitations. Existing-contour editing remains
EXO-CAD-006, not part of this implementation.

Local validation: seven fitter tests and four freehand authoring tests pass;
46 desktop unit tests pass (one optional preview ignored), including pointer
capture, release outside the canvas, overflow and focus cancellation. Targeted
desktop Clippy is warning-free and the release `cloth-fit` binary builds.
A short native Windows check confirmed the Freehand controls and rejection of
a zero-area stroke. Native testing stopped when user input was detected; a
valid curved panel and its history/serialization are covered by CPU tests,
not claimed as a completed manual native drawing test. No solver benchmark
or private garment was used.

**22 October — shared Rust rewrite hub.** The owner selected this repository
as the native Rust coordination/integration point and explicitly requested
parallel agents and a task mailbox. Read [COORDINATION.md](../COORDINATION.md),
the [pinned EXO feature audit](exo-feature-audit.md) and
[67 atomic tasks](../coordination/TASKS.md). The first 16 task discussions are
linked from hub issue #8. The coordinator uses authenticated comment authors,
exclusive file/directory scopes, explicit release and a durable bot ledger;
it does not start agents, merge PRs or copy EXO's GPL source/assets. Thirty
coordination tests and five catalog tests pass locally. Live registration,
claim, duplicate rejection, heartbeat, review and release all passed, leaving
zero active claims. The CPU suite passes 288 tests and CPU all-target Clippy
is warning-free. See [validation](rewrite-hub-validation.md). The first original Rust
slice, [net material metrics](production-metrics.md), has five passing CPU
tests and a working `cloth-template metrics` CLI (public T-shirt: 0.7976 m2,
0.15952 kg). Production physics and the user's saved garment are unchanged.
The previous GitHub CPU run passed its tests but failed a new Clippy 1.99
lint. Constant-size chunk iteration in tests/examples now uses `as_chunks`;
the `drafting_tools.rs` correction matches FireflyTheReal's
[PR #4](https://github.com/erythrofr/ClothCraft/pull/4), head
`43018fc959b311a6029bb0ffc586619786938e50`, with attribution preserved.
The PR itself and the remaining PRs are not merged by this workstream.

**21 October — collaboration snapshot and basic editing.** The owner requested committing and publishing the accumulated prototype, practical editor fixes and an English contribution kit. Read [editor basics](editor-basics.md) and [contributor task briefs](contributor-kit.md). Two boundary clicks now expose a primary seam action near the pointer, including explicit easing consent. Clean view suppresses all 3D editing overlays without changing seams. Grab adds a connected-surface radius and strength: the old point grab is unchanged at radius zero; a brush divides the same stiffness budget 25% point / 75% mass-weighted radial attachments. These are implicit unary springs on CPU/hybrid GPU, with unchanged collision restrictions. Multi-panel contour selections move transactionally in board space; Delete removes panel groups with seam cleanup and undo. No new jitter correction, solver default, material law or collision law is promoted. Research adapters remain separate from the editor. The owner's open garment is not a benchmark input for this pass; the future benchmark will be prepared by the owner. Validation: 283 CPU tests, 44 desktop UI tests (one optional test ignored), warning-free CPU/desktop Clippy, 55 native authoring actions and a successful native Grab gesture. The opt-in GPU brush pull/hold/release passes force, contact-coverage, separation and motion checks over 36 steps. CPU/GPU trajectories are not equivalent; see the measured limits and reproduction commands in [editor release validation](editor-release-validation.md). The release executable is rebuilt. This snapshot includes the accumulated solver laboratory and the editing changes; private garment files and local run artifacts are excluded.

**20 October — five-column dress video delivered.** The owner requested a bounded 350-step visual comparison, not renewed autonomous solver development. See the recorded comparison section in [solver-lab](solver-lab.md). `solver_compare --record-states` exports render geometry and positions outside step timings; the Python recorder, CPU renderer and validator are reusable. Four CPU adapters complete 350 steps; XPBD fails positive-separation checking at its 289th diagnostic state (288 preceding checked states). The failure is clearly labelled in playback. All five 120-step positions match their respective historical captures exactly; the existing VBD control is preserved. Video: `output/solver-video-20261020/comparison-350steps.mp4`, 2560x1440 H.264, half-speed, 350 physical slots plus initial/final holds. `comparison.html` provides frame stepping and physical-time playback; hashes, raw traces and validation are alongside it. The new small contact oracle is not a dress column. Original garment, production physics and GPU kernels unchanged. Build, targeted CPU Clippy, rustfmt, recording checks, full video decode and visual checks pass. No GPU use, commit or push. Broad solver research remains paused pending discussion.

**20 October — final isolated certificate check; research paused.** Read [moving separating planes](moving-contact-separator.md) and [validation](moving-contact-separator-validation.json). A stronger opt-in continuous separation certificate rescues the synthetic step 479 in eight iterations (force residual 2.70e-9 N, decreasing energy, unchanged clearance). All six contact kernel tests pass. No long run, complete pull/release or dress validation with this final option; it is not promoted. The exact residual cache and earlier short protocols are documented below. Source, binary and reproducible isolated replay are archived under `output/moving-separator-20261020`. Production/editor/GPU and the user garment are unchanged by this research pass. The owner requested finishing only the pending experiment and then discussing the overall results; do not launch another matrix automatically.

**20 October — long-tail contact diagnosis and search-path repair.** Read [long-tail evidence](contact-long-tail.md). All four old constrained-search tails fail before 900 steps (369/539/489/780), despite the four successful 180-step protocols. Exact replay instrumentation shows swept EE violations and certificate exhaustion dominate the small accepted step; removing OGC bounds is not justified. Opt-in `--newton-path-repair` adds search-only swept linearizations, with no physical reactions, and rescues all four isolated failures (51–103 iterations). All four fresh 180-step pulling/held-release protocols pass unchanged physical/geometry/energy gates; matching trajectories remain exactly equal to the previous policy. The longer repaired eased-moving trajectory also fails at step 479; only steps 180–478 are accepted. Full-run gates remain false. Exact residual-sample reuse preserves all old diagnostics across four isolated rescues and a complete short run, avoiding 85.7–88.7% of residual evaluations. Nineteen targeted Rust tests, four passive-analysis tests and CPU all-target Clippy pass. Dense CPU reference only, 36–54 seconds on isolated difficult steps; not a realtime or dress fix. Production/editor/GPU and garment unchanged. Evidence under `output/contact-tail-20261020`.

**20 October — hard geometric residual search: four synthetic protocols pass.** Read [method/results](constrained-contact-search.md), [validation](constrained-contact-search-validation.json). A feasible primal working-set/null-space QR oracle minimizes the natural residual subject to linearized gaps and nonnegative reactions. The captured 79-variable optimum matches independent SciPy SLSQP. The SAME `--constrained-newton` policy passes all four 180-step sewn protocols (matching/eased, moving/held), with unchanged OGC/swept/full physical gates, max energy rise 2.004e-14 J and continued post-release motion. No scene-specific selection. Thirty-nine targeted CPU tests and all-target CPU Clippy pass; endpoint and prior bounded x/v replays are exact. CPU dense finite-difference oracle costs 311–513 ms/step on 16 vertices, NOT realtime, long-tail or whole-dress proof. Artifacts, two binaries, source and reproducible quality gate are under `output/constrained-residual-20261020`. Production/editor/GPU and garment unchanged. Next: longer tails and varied geometry/easing/timestep/mesh, then sparse/analytic search validated against this reference before whole-dress testing.

**20 October — reaction-bounded residual search.** Read [method/results](bounded-contact-search.md), [validation](bounded-contact-search-validation.json). Independent Rust QR working-set least squares agrees with twelve SciPy BVLS fixtures and a captured 79-variable contact matrix. Direct `--bounded-newton` passes 3/4 full sewn protocols, but regresses matching held; `--combined-newton --fallback-bounded` preserves the previous two passing trajectories exactly and rescues neither failure. No universal winner. The failed-matrix optimum requests a geometric gap of -1.024e-9 m; unchanged swept checks reject it. This is evidence to impose hard geometric inequalities in residual minimization, not relax clearance. Thirty-five targeted CPU tests, all-target CPU Clippy, formatting/diff checks and two exact endpoint baseline replays pass. Eight full runs, binary/source hashes and reproduction script are in `output/bounded-residual-20261020`. Dense 16-vertex CPU oracle only; production/editor/GPU and garment unchanged.

**20 October — unilateral contact transitions.** Read [method/results](unilateral-newton.md), [validation](unilateral-newton-validation.json). New research active-set search passes 2/4 full sewn pull/release protocols (matching held and 10% eased moving), compared with 1/4 for rank search. Both retain 1 mm separation and no measured post-release energy increase. Natural-residual direction solves isolated matching step 87 but regresses complete trajectories; combining candidates also regresses matching held. Keep all negative controls. Failure traces distinguish safe-but-nondescent trials from reaction-cone rejection. Thirty-one targeted CPU tests, all-target CPU Clippy, formatting/diff checks pass; two endpoint baseline x/v replays are exact. Source/binaries and 12-run reproduction are archived under `output/unilateral-newton-20261020`. Dense CPU oracle only, not realtime or whole-dress validation. Production/editor/GPU and garment unchanged. Next: constrained residual descent at zero reactions, retaining swept collision and full convergence gates.

**20 October — rank-aware contact search.** Read [method and results](contact-rank.md), [validation](contact-rank-validation.json). The captured 65-variable Newton system has rank 64 but an admissible SVD solution. An independent two-QR oracle matches it. `--rank-newton` plus actual physical convergence checks completes the 180-step eased moving-release protocol, with max energy rise 8.78e-15 J. Matching protocols fail at step 87; eased held fails at 133 on nonnegative reaction transitions. Incomplete inner QPs remain diagnostic search proposals, never physical acceptance. All geometry/swept gates remain. Not a dress/production fix or realtime backend (89.5 ms/step on 16 CPU vertices). Twenty-eight targeted CPU tests and all-target CPU Clippy pass. Endpoint baseline x/v replay exactly; editor/GPU/garment unchanged. Next: coupled nonnegative reaction active sets.

**20 October — coupled discrete-force pilot, not promoted.** Read [method and failures](discrete-contact-solve.md), [validation](discrete-contact-solve-validation.json). Opt-in `deforming_contact_probe --discrete-forces --newton-forces` separates discrete force rows from endpoint geometric constraints. A lagged geometric-QP proposal and a nonsymmetric finite-difference Newton proposal compete on residual merit under unchanged OGC/swept checks. Both isolated synthetic post-release energy peaks now become decreases with small force residuals. Full sewn trajectories still FAIL: redundant active rows block initial settling and pulling; no complete sewn release/fluency gate passes. Do not install this in the editor or claim a dress jitter fix. No GPU used; production and user garment unchanged. Next: coupled redundant-contact active sets and globalization, preserving all inequalities and the negative results. `contact_residual`/`contact_newton` are small CPU research modules; the dense finite-difference path is not scalable.

**20 October — invariant discrete contact rows, offline only.** Read [the construction, literature and integration boundary](discrete-contact-work.md), [audit](discrete-contact-validation.json). `solver_lab::discrete_contact` implements a VF/EE distance discrete gradient in six squared-distance invariants, using a lifted old/new metric for witness minimization. Six tests cover chain work, midpoint torque/resultant, objectivity, shrinking-motion limits, flat sliding and CCD counterexamples. Freezing endpoint barycentrics is retained as a rejected negative control: it creates tangential drag. Two exact resumed synthetic steps capture actual reactions; substituting invariant rows at fixed positions/multipliers changes positive contact work to nonpositive within roundoff, with max chain error 1.42e-16 m. This is NOT a corrected trajectory, integrator, production jitter fix or angular-momentum guarantee for backward Euler. Do not replace the geometric Jacobian in the current symmetric QP with this force row. Next: separate endpoint feasibility and discrete reactions in a coupled nonlinear solve, retaining OGC/swept checks and testing material work too. Shared fixture is in `examples/support/deforming_fixture.rs`; `--capture-reactions` and `discrete_contact_probe` reproduce the offline audit. Targeted 52 CPU tests and CPU all-target Clippy pass; editor/GPU/production unchanged.

**20 October — combined sewn self-contact and discrete contact work.** Read [the experiment and energy identity](sewn-self-contact.md), [gates](sewn-self-contact-validation.json). A 16-vertex folded/eased three-panel fixture reproduces a late moving-release stall. New opt-in `IndependentPivotBlock` finishes boundary active-set updates; the public 48-coordinate captured QP converges in two sweeps where three prior methods fail 32,768. Replaying the stalled nonlinear step now converges in 27 iterations. All four matching/eased, moving/held protocols complete with geometry and force gates, but BOTH moving protocols fail energy decay. The audit closes to 1.09e-19 J and attributes the peak rise to positive discrete contact work, not force residual. This is not a production jitter diagnosis or fix. Full-step costs remain 5.6–280 ms on only 16 vertices. Next: contact time-discretization/work consistency with momentum and release gates, plus remaining repair-QP failures; never mask this with damping/sleep/energy clamps. `--resume`, progress/iteration capture and `dense_qp_replay` isolate synthetic failures. Scalar energy queries retain `Dual<0>` arithmetic and match full-assembly traces. Forty-six targeted CPU tests and CPU all-target Clippy pass; GPU/editor/production unchanged.

**20 October — redundant contact blocks and exact Schur reuse.** Read [the method and limits](independent-contact-blocks.md) and [measurements](independent-contact-validation.json). Opt-in independent dual blocks retain every inequality and all KKT gates, removing singular-block fallbacks on the deforming two-layer fixture. A bounded, per-QP Schur cache preserves cached/uncached frame traces exactly. Moving/held release and all 18 timing repetitions pass; maximum difference from the old active-block trajectory is 2.06e-9 m. Median moving-release cost falls from 24.23 to 17.88 ms, but held release is slightly slower with caching. This is eight vertices, not a dress or realtime result. Forty-four targeted CPU tests, CPU all-target Clippy and formatting pass. Production/editor/GPU unchanged. Next: combine folds, unequal seams and self-contact, then sparse/matrix-free solving against this oracle; do not promote based on low kinetic energy or these tiny timings.

**20 October — coupled deforming VF/EE and swept-path correction.** Read [the experiment and failures](deforming-contact.md). New full moving-side Jacobians and separating-plane path certificates have derivative/objectivity/balance and tunneling/subdivision tests. Eight-vertex, two-layer cloth retains original material energies, OGC bounds and 49 eligible VF/EE pairs. No path correction falsely freezes moving release (80 unconverged steps despite low energy). Refreshed path rows leave 10 failures; accumulated rows leave three at budget 96. Accumulated correction with budget 384 passes both 180-step release protocols, using at most 157 iterations, but the hard case costs 31 ms/step and has 232,094 rank-deficient dual-block fallbacks. Do NOT promote or claim garment realtime. Next: rank-aware conditional active blocks that retain every inequality, then folds/eased seams and scalable solving. Production/GPU/editor unchanged; no dress replay.

**20 October — coupled material/sewing and hard-floor contact.** Read [the experiment](coupled-contact.md). `coupled_patch` reuses production energy factors and exact gradients with a dense Gauss–Newton metric. `dense_contact` couples all participating coordinates, with coordinate and active-block dual methods. Eight 360-step 12-vertex sewn-patch runs (matching/10%-eased seams, moving/held release) meet full force/complementarity and geometry gates. Active blocks reduce this small CPU probe from 22.6–50.2 to 1.28–2.83 ms/step, with max position difference 3.65e-9 m; not dress FPS. Eased seams retain legitimate elastic energy. Five new tests plus previous regressions pass (37 total). Production unchanged. Next: BOTH sides of deforming VF/EE self-contact, swept geometry and changing/rank-deficient contact sets, then a scalable solve checked against this dense oracle. No whole-dress validation or jitter-fix claim.

**20 October — hard-contact QP / guarded release gate.** Read [the experiment](unilateral-contact.md). An independent SPD 3D inequality QP now reports feasibility, stationarity and complementarity, retaining the full coupled metric. Six kernel tests include duplicate-force consistency and an independent dense active-set oracle. A finite-geometry working set passes sixteen 480-step planar point/rigid-wire moving/held-release runs: minimum swept clearance 1 mm, maximum analytical position error 1.733e-10 m. Three example tests cover swept paths and release. The all-linearized alternative fails all sixteen runs near feature transition; preserve these failures. This is a different hard-contact law, NOT a complete cloth backend or a production jitter fix. Next gate: coupled deforming contacts/material/seams, explicit initial feasibility and true deforming-feature clearance, before whole-dress integration. Production/GPU/editor unchanged; no new dress trajectory.

**20 October — local surface field passes plane/release, fails mesh fidelity.** Read [the results](local-surface-contact.md). `local_surface` differentiates a normalized compact plane field through sample geometry; anchored/scaled evaluation preserves planar query derivatives and handles common weight scales. Six guarded 480-step moving/held-release runs match analytical plane positions/velocities exactly, with 1 mm separation. Keep the explicit mixed-layer and concave-crease counterexamples: normal coherence alone is insufficient, empty support must not mean zero force, and a field barrier does not protect the original triangles. A read-only 225-contact dress audit (seed face + eligible edge neighbors) gives up to 1.665 mm gap error and 1.734 mm field value on the actual mesh, with unchanged production contacts/bounds. This recipe is not promoted. Next: stable patch ownership and conservative agreement with original geometry before any whole-dress force integration. No GPU, editor change or new dress trajectory.

**20 October — two-sided force trial rejected.** Read [the force and release results](two-sided-contact-trial.md). `two_sided_contact` now differentiates local-minimum factors through both feature neighborhoods, combines all four pair types with the existing mollifiers and activation, and accepts both sides. It is an independent trial, NOT full GCP. Despite positive continuous energy and decreasing post-release energy, it produces large flat-plane lateral forces and blocks/deflects pull/release. Full two-surface-patch scans with a fixed overcomplete candidate set retain the ripple. Do not promote it or tune away the evidence; preserve the negative gates. Production and GPU are unchanged. Next work needs triangulation-consistent surface aggregation and must retain OGC bounds; MLS is a research lead, not an available self-contact solution.

**20 October — feature hierarchy coverage.** Read [the snapshot audit](feature-hierarchy.md). Direct BVH queries now enumerate VF, EE, VE and VV independently with the world's original seam exclusions; do not derive lower candidates only from accepted parents. Exact-snapshot coverage rejects stale geometry/topology and reports missing lower witnesses and factor errors. Six hierarchy tests plus 25 existing contact/release tests pass. Frozen dress and prior release snapshots pass geometric handoff checks at 3/6/12 mm, with production contacts/bounds unchanged. This does NOT assemble GCP forces or run a new dress trajectory; directional factors, open two-sided cloth, quadrature and full integration remain open. Fresh hierarchy construction costs about 160 ms at the nominal radius and is research-only. Do not put it on the production step or claim a jitter fix.

**20 October — parallel contact gates.** Read [the rejected weighting and new feature kernels](parallel-contact-gates.md). Product-weighting forest nodes and links restores positivity but fails duplicate-force consistency (50% excess at equal half weights, persisting as tau tends to zero). Retain that rejection gate. Independent GCP Appendix A VE/VF/EE mollifiers now have CPU derivative/limit tests; they are NOT a full contact potential or backend. A read-only frozen-dress audit classifies 694 existing active terms (41 fractional factors), without creating the complete GCP candidate set or advancing cloth. Full directional factors, lower-dimensional coverage, two-sided cloth, quadrature and solver incidence remain mandatory before integration. Production and geometric guards are unchanged.

**20 October — graph factorization and endpoint boundary.** Read [the follow-up](forest-factor-and-boundary.md). The research kernel now factors structural components independently, retaining zero links and limiting each dense component to 128 nodes. Disconnected padding no longer disables two-node cancellation. An inactive connected extension exposed another false `-225000 N/m` curvature; the smooth wire path now selects the symmetric generalized Hessian at exact single-endpoint/interior ties using direct endpoint stationarity. Values/gradients are unchanged at the mathematical boundary. Endpoint reversal, all-vertex derivative tests and extended moving/held-release pass. Production and the original finite-distance routine remain unchanged. Double-endpoint/parallel cases, general rotated floating-point ties, VF assembly, full dress stepping and whole-step cost remain open; the standalone kernel benchmark is not an FPS claim.

**20 October — smooth forest kernel, not promoted.** Read [the results](smooth-forest-contact-results.md) and [derivation](smooth-forest-contact-proposal.md). Differentiated rooted-forest averaging removes the hard-forest cusp on the tested triangle and preserves the barrier bound on sampled dress graphs. Algebraic cancellation fixes a wrong two-edge shared-endpoint Hessian. The headless moving/held-release gate passes for small tau, but adaptive static scans expose nonzero sliding bias; large tau produces dragging spikes. The 128-node dense limit rejects some 12 mm stress graphs explicitly. This is not assembled into VBD, VF contact or GPU, and no new dress trajectory was simulated. General feature ties, parallel edges, complete high-arity incidence/halo and whole-dress quality/cost remain gates. Keep production unchanged and preserve the negative controls.

**20 October — whole-wire assembly audit.** Read [the audit and rejected graph experiment](wire-quadrature-audit.md). The frozen dress and prior pull/release endpoint pass the unmollified signed-density gate at 3 mm; 6/12 mm stress audits expose negative densities. A generic cycle fixture produces attraction. Skipping cycle subtractions restores the barrier bound but creates a measured 222.5 N force cusp when merge order changes. Neither law is installed. The subsequent [smooth forest kernel](smooth-forest-contact-proposal.md) is described above; it remains separate from the solver. Preserve all negative gates, original seam exclusions and checkpoint mollifier-reference lengths.

**20 October — local contact quadrature gate.** Read [the scope and protocol](contact-patch.md). Two-element face/wire kernels subtract the shared-feature barrier, with algebraic cancellation before AD at exact feature ties. Their isolated pull/release follows an analytical frictionless reference; the naive sums deflect the probe even while energy decreases. This is NOT assembled into the detector or production VBD, and is not a dress jitter fix. Whole-mesh positivity, ownership/exclusions and near-parallel EE treatment remain open. Keep the production law unchanged and preserve the stronger sliding/derivative gates.

**20 October — finite primitive distances.** Read [the experiment](primitive-contact.md) and [results](primitive-contact-results.md). A CPU-only law recomputes finite VF/EE distances, with a force halo that retains the original OGC movement regions. The four captured/synthetic transitions and nine early dress refreshes have zero measured refresh delta, but a two-triangle frictionless-plane test produces 79.55 N of spurious tangential force. It is not promoted; the editor law is unchanged. Preserve this stronger sliding gate and the matched dress pull/release evidence. `--primitive-distances` and `--interior-edges` are mutually exclusive research options. GCP directional/mollification machinery and IMLS were studied, not implemented.

**20 October — production contact capture.** Read [the follow-up](contact-refresh-follow-up.md). Passive VBD capture identifies a separate +0.088282 J point–face activation; the six-step replay remains byte-identical to its control. A public concave-face fixture distinguishes this from the earlier EE event. The EE experiment stays off: mixed jitter results and added CPU cost fail promotion. A trial L-BFGS variant failed the floor convergence gate and was removed from callable backends; its negative evidence is archived in ignored output. No production force law or GPU code changed.

**19 October — EE transition investigation.** Read [the diagnosis, experimental potential and headless reproduction](edge-transition.md). A public separated eight-vertex fixture reproduces endpoint rejection followed by finite-energy EE activation. The CPU-only `experimental_interior_edges` switch exercises a compact interior potential through the existing VBD solver; it defaults off and the GPU rejects it. Preserve the unchanged collision bounds and baseline. Passive VBD refresh diagnostics and previous-detection capture geometry distinguish feature churn from cache misses. This is research, not a promoted jitter fix.

**19 October — solver consistency.** Read [the derivation, scope and reproduction](solver-consistency.md) and [results](solver-consistency-results.md). The lab adds full-residual Gauss–Newton/PCG and a finite-AVBD hybrid with full target stiffness and coupled polishing. Original prototypes remain controls. Per-sweep diagnostics separate force residual, stiffness completion and contact-refresh energy changes; every-step intersection audits are opt-in. `scripts/solver-consistency.ps1` runs the fixed dress and matched pull/release, including smaller-step XPBD, on CPU. No production solver, GPU kernel or editor executable was changed.

**19 October — alternative solver laboratory.** See [scope and reproduction](solver-lab.md). `solver_lab::Backend` runs VBD, a safety-limited XPBD hybrid, or the finite-stiffness ramp branch of AVBD on the same compiled garment. The editor remains unchanged. `examples/solver_compare.rs` archives state/protocol, runs matched quiet and pull/release cases, and audits external traces. `experiments/box3d` links a pinned native Box3D checkout; its particle lattice changes the material/sewing model and lacks cloth surface contact coverage. It must never be advertised as an equivalent replacement merely because its body solver is fast. All new backends are CPU research code; `--gpu-control` explicitly selects the existing hybrid VBD control. No commit or push in this pass.

**19 October — CPU settling zoo and local-solve probes.** Read [the zoo, findings and gates](settling-zoo.md). Eight synthetic fixtures, seeded size/easing variants, continuous/cold/contact-only restarts and matched pull/release now run headlessly via `scripts/settling-zoo.ps1`. A 15% eased seam reaches force-balanced rest even after a long release; cold prediction injects a transient. Rebuilding only contacts preserves the continuous final state. Some nearly motionless floor cases instead have unbalanced forces: extending line search from 10 to 32 trials resolves these tested stalls while keeping the same energy and bounds. An unshifted-SPD probe improves sliding but is insufficient and fails some cases on its own. Both probes are **off by default**, WGSL and the installed desktop binary are unchanged. No GPU used. The final six experiment batches complete 87,600 accepted steps / 115 final intersection checks; 28 default final states match the pre-probe executable byte for byte. The dress still needs matched validation before any production change.

**19 October -- dress checkpoint and panel tools.** Read [the checkpoint/jitter evidence](dress-checkpoint-and-jitter.md) and [panel tools](panel-tools.md). The dress has a disconnected falling panel, so global speed is not its settling measure. A portable draped checkpoint preserves velocities; predictor/contact caches rebuild on reload. Matched rest and pull/release runs retain collision checks; 64 iterations and smaller substeps do not meet the combined quality/cost gate. Production physics is unchanged. Internal-line ownership now follows the clicked boundary; Measure (M), material access and paired linked mirrors X/Y are implemented. Linked geometry edits commit transactionally from either partner; topology-changing operations require unlinking first.

**19 October — directional release and headless physics lab.** The follow-up
[directional-contact change](directional-contact.md) releases all nine initial
stalls in the saved ruffled dress. Verified fixed separating half-spaces replace
only very close pairs' isotropic restrictions; residual balls and the unseen-pair
query envelope remain. VBD enables it by default; sparse directional vertices
are solved in CPU f64 in the hybrid path. No damping/sleep, material change,
seam-specific rule or collision exclusion was added. The 360-step matched
pull/hold/release replay passes final intersection checks and a separate fresh
CPU contact oracle; the oracle trajectory is byte-identical. Complete-step
mean is 19.66 ms versus 20.13 ms for the isotropic baseline on RTX 3090; this
does not establish a steady 60 Hz rate. `scripts/physics-lab.ps1` provides a
seeded CPU geometry zoo and opt-in GPU replay, with no editor window. Preserve
the current-iterate segment clipping and sparse adaptive warm start: clipping
from the old detection center erased already accepted tangential motion. The
older isotropic solver still has finite-iteration sliding/momentum limitations;
this is not a universal jitter fix. The preceding investigation below is historical.

**19 October — new ruffled dress: collapsed-triangle stalls reproduced, not fixed.** Read [the evidence and rejected trial](collapsed-triangle-stalls.md). Nine unpinned vertices are restricted by two almost rank-deficient triangles; five remain restricted even on full f64 CPU. A constrained local-Newton trial failed to release them and was reverted in source and executable. Keep production physics unchanged. Issue reports now record triangle area ratios/altitudes and compressed faces. The public two-triangle regression preserves the distinction between force feasibility and collision bounds. The pull/release harness has a production-only mode and an opt-in CPU contact oracle for GPU runs. The user's new dress is copied in ignored local evidence; do not confuse it with the previous Garment or claim that the geometry stall has been repaired.

**18 October - broader solver review and comparison plan.** Read [the primary-source landscape and proposed benchmark](solver-landscape-2026-10.md). Keep VBD/OGC as the baseline; distinguish matched-model XPBD/compliant-ALM experiments from complete-engine Newton/PPF comparisons. Planar-DAT, multilevel solving, Disney material work and Catto's rigid-body techniques have separate scopes and limitations. Plan includes the future ruffled dress, existing Garment, public fixtures, matched pull/release, full physical-time cost and sequential timing followed by synchronized playback. Documentation only: no simulations, GPU use, backend activation, executable replacement, commit or push. Owner is rendering; coordinate any later GPU workload.

**18 October - coupled seam refinement evaluated, kept off.** Read [the method, rejected variants and reproduction](seam-block-refinement.md). The research API `set_seam_block_sweeps` builds components from sewing quadrature, never names or private-file indices. The retained candidate couples sewing and membrane search curvature while checking the full unchanged objective and original OGC balls. Matched rest and pull/hold/release runs preserve collision checks but fail the combined jitter/performance gate; do not enable it in the editor. A 64-iteration comparison reduces the final release motion metric but is too slow and is not a convergence certificate. Current prediction, damping and normal trajectories remain unchanged; no executable replacement, commit or push. Private traces stay ignored.

**18 October — CPU edge-contact SIMD and motion diagnosis.** Read [scope and measurements](cpu-contacts-and-jitter.md). Runtime AVX batches four edge pairs in f64, with the scalar oracle and portable fallback; current distances, feasible regions, canonical contacts and original OGC balls are preserved. Two 361-state CPU replays of the saved Garment match all contacts/bounds bitwise and reduce full CPU detection by 9.8–10.6%; this is not a hybrid full-step/GPU FPS measurement. The offline `contact_motion_probe` and `audit_vertex_forces` localize highpass motion around `seam_5` (90/80 mm easing), including an oscillating endpoint with no active contact and millimetre-scale fresh bounds. This supports investigating coupled seam/material convergence, but does not prove a cause or fix jitter. Keep prediction/damping unchanged. The scalar/SIMD pull/hold/release regression uses the same controls and compares the whole trajectory. Private captures remain ignored; no GPU run, desktop replacement, commit or push.

**16 October — Box3D / Roblox / contact stability research.** Read [the source review and experiment order](contact-stability-research.md). Box3D's substeps, contact push/relaxation, accumulated impulses and feature-matched warm starts were checked at a pinned revision. AVBD is the likely Roblox reference; its public 3D sample has serial solving and a quadratic broadphase, not the million-object GPU implementation. Planar-DAT (2026) is relevant to directional restriction/sliding but does not establish finite-iteration energy conservation. GCP, PAA and JGS2 address distinct model/convergence issues; read scopes and limitations are recorded. Prioritize diagnostics and coupled seam solving with unchanged laws, then a compliant ALM comparison; keep directional contact bounds a separate validated experiment. Documentation only, no GPU, simulation, physics change, commit or push.

**16 October — CPU energy audit and pull/release research.** No GPU use or production physics changes: owner rendering. Read [energy accounting and evidence](energy-and-release.md). `vbd/audit.rs` exposes opt-in read-only f64 energy components and a backward-Euler balance; it is not called from steps/workers. `energy_probe` scripts 40-vertex unequal sewing through settle/pull/hold/release, or replays existing states on CPU using an independent detector. Fixed-contact remainder, final residual work, control changes and contact-refresh potential changes are separate; algebraic closure is not a convergence certificate. The saved Garment has energy rises on 108/300 post-warm-up steps but a net decrease, not proof of perpetual oscillation. The two-mass research script eliminates scalar-sweep energy rises with an exact coupled solve of unchanged laws. This supports investigating coupled seam modes; no cloth block solver/damping fix was enabled. Three audit tests, four VBD tests and CPU all-target Clippy pass. Keep the earlier rejected prediction guard removed. Actual GPU pull/release and realtime validation remain pending authorization.

**16 October — jitter correction reverted after user testing.** The owner reported impaired sliding, sticking and stress releasing in jerks despite a lower oscillation metric. Removed the complete-objective prediction rejection on CPU/GPU, its component graph, reduction dispatches/metadata and the accompanying exact-unchanged-candidate shortcut. Prior adaptive initialization, local line search, contact safeguards and earlier performance work remain. `motion.rs` and its UI/report integration remain passive. Do not restore the rejected guard merely because its settled RMS improved: release after dragging and smooth relaxation must be acceptance criteria. See [the experiment and rollback](settled-jitter.md); the old performance evidence is explicitly historical and rejected. Jitter remains unresolved. Private geometry stays ignored. No commit or push.

**16 October — draped garment realtime.** Read [the pass and measurement caveats](draped-realtime.md) and [evidence](draped-realtime-validation.json). Three final native samples from the private garment at 30/60 s deliver 60.59, 60.59 and 60.85 physics steps/s at ~60 rendering FPS. The 1,800-step comparison from 30 to 60 s improves mean step 18.87 → 14.76 ms (P95 27.43 → 17.60), with bitwise-identical final positions/velocities/time. Keep compact contact incidence, lossless canonical keys with large-ID fallback, eight-byte GPU candidate records with overflow retries, the equivalent scalar line-search energy, reusable CPU staging and the same-order coloring. Sparse f64 scheduling must preserve every sequential energy dependency. `gpu_profile` exposes packing/encoding/wait/post/cleanup; step timing now includes temporary destruction. CLI logging is buffered, so old/new CLI wall differences include that separate saving. The collision oracle agrees for 120 + 120 draped steps, the fresh final CPU probe passes and six GPU regressions pass. No reduction of mesh, iterations, dt or collision bounds. P95 still exceeds one frame; this is measured realtime throughput, not a universal hard-deadline guarantee. No commit or push in this pass.

**16 October — GPU contact search.** Read [the implementation and remaining limit](gpu-contact-search.md) and [measurements](gpu-contact-validation.json). The hybrid backend now refits and queries the moving BVHs on GPU, with conservative projection filters, resident fixed geometry/local exclusion lists and complete retries on output overflow. The CPU still computes exact f64 closest features, feasible regions and original OGC movement balls. Static VBD incidence is resident; readbacks wait for their own submission. The final 1,800-step garment trajectory exactly matches the prior CPU-contact baseline. A consecutive 240-step comparison changes mean full step from 35.22 to 16.22 ms; the long run averages 17.93 ms (P95 22.53). **60 physics steps/s is still not sustained:** final native measurements deliver 54.03 initially and 45.45 after draping, despite ~60 rendering FPS. There are no CPU pair-cache rebuilds on the accelerated path, but GPU waits and precise CPU contact processing remain significant. `--cpu-contact-filter` restores the full CPU detector; `--check-gpu-contacts` checks exact contact/bound equality every step and is diagnostic, not a benchmark. No collision, mesh or iteration reduction; no commit or push in this pass.

**16 October — simulation continuity, cache spikes and cursor sewing.** Read [realtime-follow-up.md](realtime-follow-up.md) and [measurements](realtime-validation.json). The updated private garment stopped after 241 steps at the old global 2 µm cutoff; precision-partitioned dispatches now complete 1,800 steps and pass a fresh CPU intersection/separation check. Keep the original collision balls, f64 sparse work and local seam exclusions. The temporal cache stores BVH leaf pairs; resident static GPU terms and optional fixed-32 subgroup reductions reduce other costs. Repeated 240-step trajectories match the baseline exactly; cache rebuilds drop from ~25–31 ms to ~5 ms. **The private garment still misses 60 physics steps/s:** native measurement is 32.1, versus 60.4 for the reference T-shirt and 58.9 for the dress. No resolution/iteration reduction. The workspace now reports actual steps/s and visible solver failures. Cursor sewing supports click confirmation, easing/direction, seam selection/deletion; the 2D toolbar exposes box/lasso and point feedback in both views. Five opt-in GPU tests and the 21/23/55-action native scenarios pass. No commit or push in this pass.

**16 October — GPU precision stall.** Read [precision-stall.md](precision-stall.md). Tiny OGC balls can lose nearly all available movement to the f32 packing margin. The hybrid solver now retains those vertices in f64 and performs sparse, energy-checked local minimizations within the original balls. `vbd/local_step.rs` is shared with CPU VBD; do not replace this with an unconditional push or remove contact exclusions to free a vertex. `precision_vertices` / `precision_ms` expose the extra work. The candidate cache uses a two-radius motion budget with a matching conservative search envelope. It preserves the trajectory, reduces reconstruction frequency and increases tail spikes. 136 CPU tests and four opt-in GPU tests pass. The private capture remains under ignored output paths; the GPU regression uses an independent synthetic patch.

**16 October — issue capture and quick tools.** Read [issue-capture-and-quick-tools.md](issue-capture-and-quick-tools.md). Q opens cursor-local drafting/mirror/boolean actions; viewport sewing controls share the inspector draft (F direction, E easing, Shift+wheel reversal). Ellipse and sector tools use the existing shape transactions. D pauses for visible-face marking and portable local evidence export. Marks never enter physics or persist as mesh indices; topology changes invalidate them. No automatic notification or simulation repair. Current validation results are in the linked guide.

**16 October — documents and sewing.** Read [documents-and-sewing.md](documents-and-sewing.md). Native document dialogs, dirty state, portable avatar assets and recovery; partial ranges in 2D/3D; ordered 1:N/M:N seam transactions, numeric editing, directional handles, deletion and undo. New optional fields preserve legacy loading; old readers reject files using extensions. Do not flatten chains to unrelated seams or reconstruct rest coordinates from draped geometry. README is now a concise English product/development overview. The 55-action native authoring scenario passes, including partial/M:N sewing and real motion; a three-step GPU gradient check also passes. Read [validation](document-sewing-validation.json) and [native workspace notes](workspace-ui.md#native-verification--16-october). Final CPU/Clippy results are recorded in the document guide. GPU use is authorized for this pass only.

**15 October — essential authoring toolkit research.** Read [essential-authoring-tools.md](essential-authoring-tools.md) for the official-manual comparison, audited gaps and concrete acceptance cases. Prioritize usable document lifecycle and editable partial/multi-edge sewing, then pins/freeze, arrangement, measurement/organization, offsets/cuts and linked symmetry. Model seam ranges/notches, grain and pins are not complete UI features. This pass changes documentation only; existing uncommitted implementation work is preserved, with no GPU use, commit or push.

**15 October — workspace UI pass.** Read [workspace-ui.md](workspace-ui.md) before changing pane layout or rendering. Compact vertical tool rail; resizable/focusable 3D and 2D panes; Piece/Fabric/Simulation inspector tabs; persistent viewport display settings. 4× MSAA with capability fallback, gradient/solid backgrounds and procedural ground/grid/contact-style shadow are implemented; native GPU validation is still pending. CPU checks only, no app launch or running executable replacement. New code/UI/docs are English. The authoring smoke now opens the Fabric tab. No solver or project format changes.

**15 October — radial tools and CPU research.** `atelier/radial.rs` adds right-click tool switching; `selection.rs` provides 2D panel/point marquee, group layout dragging and clipboard adapters. `authoring/clipboard.rs` copies semantic panels/materials/internal seams transactionally with fresh IDs and preserved compatible drape. Read [controls and limits](authoring.md#fast-tool-switching-box-selection-and-clipboard). The physics cost changes prune distant cached pairs using current AABBs and reuse contact incidence for deterministic coloring. Read [research assessment](research-2026-10-15.md) and [validation](cpu-research-validation.md). **No GPU run or native window launched:** owner rendering in Unreal. Custom montage unavailable; jitter remains unconfirmed/unresolved. AVBD and the other reviewed alternative methods remain unimplemented.

**15 October — Firefly integration.** Numeric points/splits/targets, snapping, camera navigation, English light/dark UI and CI adapted from FireflyTheReal / julienfoss, through `b2cb17f`, on top of our mirrors/booleans/internal sewing. Read [integration scope, fixes and credit](firefly-integration.md). Physics is unchanged; no GPU run. Earlier UI labels and plans below are historical.

**15 October — CPU pattern drafting.** Numeric shapes, independent X/Y mirrors and ±X/±Y copies, booleans with holes/islands, internal Bézier paths sewable in 2D/3D and eased ruffle strips. Read [drafting-tools.md](drafting-tools.md) for UI, optional `holes`/`lines`, tests and limitations. The solver is unchanged; internal paths constrain the CDT and use existing sewing. Booleans reject reference loss; mirrors migrate seam orientation. CPU and compilation only, no workspace launch or GPU test. The Web menu references Teagan/Titan/Jett; FreeSewing/SVG import remains unimplemented. Following paragraphs are historical.

Remade submission: [PR #49](https://github.com/replicraft/remade/pull/49), opened 15 October 2026 from `erythrofr/remade:catalog/clothcraft`. The local catalog validates (`uv run --locked --project scripts python scripts/validate_catalog.py`); directory publication still requires maintainer review/merge. The working clone is ignored under `output/remade-submission/`; only the ClothCraft entry and removal of the corresponding Marvelous request are proposed. ClothCraft has published the MIT license since `a29b85f`.

For a new GPU workload, follow authorization in the current request. Read [AGENTS.md](../AGENTS.md), [architecture](architecture.md), [OGC/VBD](ogc.md), then [meshing](meshing.md). License/submission notes below describe the preceding 15 October pass.

**15 October — Remade preparation and MIT license.** The owner explicitly chose MIT. `LICENSE` and Cargo metadata carry it; README, AI entry point, icon provenance and English contribution guide agree. MakeHuman assets remain CC0. README states the Marvelous Designer behavioral target and lack of native compatibility/verified parity; available formats and solvers are unchanged. Remade submission targets `status: alpha`, `compatibility: targeting`, category `creative`, Rust, Windows only. A proposed PR is not an accepted catalog entry.

**Earlier pass — identity and manual-based roadmap.** The original ram icon is `assets/branding/clothcraft-icon.png`; visual sources and full prompts are in [its provenance](../assets/branding/README.md). The workspace embeds it through `include_bytes!` as the eframe window icon; README displayed it at that time. It is not yet a Windows executable/installer icon resource. Nine additional Marvelous articles were actually read and referenced in [manual-study.md](manual-study.md#authoring-backlog-review-2026-10-14). The [roadmap](../ROADMAP.md#3-concrete-authoring-backlog-from-the-manual-study) supplies task IDs, dependencies and criteria for portable saving, dimensions/splits, partial sewing, arrangement points, pins, symmetry, internal lines, sewing chains and folds. Those tasks were planned, not implemented by that pass.

**Earlier pass — workspace clarity and cost.** Read [workspace-polish.md](workspace-polish.md) for measurements, commands and limitations. Visible selection reuses the avatar's static BVH; the 2D board uses indexed vertices and boundary projection reuses the camera matrix. Physics and resolution remain identical. `atelier/workspace.rs` owns style/piece browsing; `atelier/seam_links.rs` shows colored correspondences in both views. `CompiledSeam::guides` is a transient display cache, derived with the same trimming/reversal/notches as sewing; do not turn it into persistent indices or physical yarns. Three background links, nine for the active pair, bounded tessellation. **Simulation** contains single-step and flat-arrangement reset. English README, [ordered roadmap](../ROADMAP.md) and [input/output contracts](interoperability.md) state remaining gaps. Actually inspected CLO/Marvelous screenshots are referenced in [manual-study.md](manual-study.md).

**Earlier pass — panel rotation.** **Edit** exposes a round rotation handle on the 2D board; **Move 3D (G)** and **Rotate 3D (R)** are directly accessible. Shift snaps to 15° increments. X/Y/Z rings also work edge-on; numeric rotations and gizmos share a central pivot. 3D placement flattens the selected piece while preserving other drapes. Optional `layout_rotation_degrees` is independent of physics, like `layout_2d`; zero is omitted to preserve historical cache signatures. Bézier handles use the inverse board transform; local-origin changes compensate rotation. Read [gestures, contract and validation](authoring.md). Do not promise intersection prevention during placement.

**Earlier physics pass — [contact jitter](jitter.md).** Nearby terms remain through `rq` even with zero energy; activation remains at `r`. This prevents a one-step-delayed repulsion. GPU translated coordinates and position differences reduce f32 errors. Preserve dormant-term coloring and original bounds. `contact_terms` distinguishes retained terms from active contacts. Shoulder oscillation P95: −88% on T-shirt, −85% on apron; some spikes remain. 78 CPU tests, three opt-in GPU tests and native grabbing pass. T-shirt: about 60 frames/s and 60 steps/s; apron: about 60 frames/s but 50 steps/s (0.836×), missing the realtime gate. `examples/motion_probe.rs` and `scripts/analyze-motion.py` compare trajectories independently of rendering. Values below describe preceding passes.

## Initial publication and editing

Read the [AI entry point](../AI_START_HERE.md), [roadmap](../ROADMAP.md), [authoring guide](authoring.md) and [manual study](manual-study.md). The editor introduced one shared 2D board: Bézier pen, rectangle, editable points/handles, piece layout, boundary sewing from 2D/3D, then gizmo placement. `board.rs` owns 2D interactions, `edges_3d.rs` visible 3D selection, `garment/curves.rs` curve subdivision. CPU commands validate the document before replacement; the worker ignores old generations. Industrial formats and a common backend contract remain to be built.

Prioritize [artificial-stretch correction and seam deletion](adaptive-initialization.md). [Fabric/performance validation](perf-fabrics-validation.md) predates that correction and used eight iterations; the default is now 16. The [immobile-panel fix](apron-validation.md), [board validation](board-validation.md) and [first-publication validation](publication-validation.md) are historical. `serde_json/float_roundtrip` is needed to reproduce the exact mesh after saving. 2D layout changes neither rest UVs nor 3D state. Physical edits rebuild caches, but `Edit::state_after` retains positions/velocities for panels compatible by ID and local topology, including mass changes; only new, remeshed or moved panels restart from arrangement.

Conservative inertial prediction was missing on GPU: a free rectangle fell far too slowly. Adding full-gravity prediction then exposed artificial elasticity at limited iteration budgets. **Do not return to either version:** `vbd/prediction.rs` uses adaptive VBD initialization §3.7 with damping correction, still within OGC bounds. The inertial target retains full gravity. Opt-in GPU tests check analytical falling, topology growth and five seconds of suspended cloth. The two pink boundaries remain a preview: the historical **Sew and simulate** action committed the relationship before starting the worker. The seam list is accessible in all modes; selecting a sewn boundary exposes **Delete seam** or Delete, with Ctrl+Z and preserved drape. The newer confirmation workflow is documented at the top of this file.

**Quality/performance of that earlier pass:** 76 CPU tests, two opt-in GPU tests and 37 native actions pass. On a fresh 25 mm T-shirt after four seconds, the old eight-iteration version left 362.51 mm seam gap and 51.61% stretch P95. Adaptive initialization alone reduces these to 2.18 mm / 8.35%; the new 16-iteration default gives 2.61 mm / 4.79%. After ten seconds: 2.19 mm / 4.48%, then about 60 frames/s and 60 physical steps/s on RTX 3090. The apron remains at 52.36 steps/s (0.873×) with significant local deformation: neither realtime nor final quality gates pass. Read [protocol, measurements and limits](adaptive-initialization.md). BVH traversal gains in [the previous pass](perf-fabrics-validation.md) remain historical. CPU detection still dominated at that stage; preserve both free-fall **and** supported-cloth regressions.

**Materials:** `src/fabrics.rs` supplies nine presets and conversion between extension under 5 N / 5 cm and membrane coefficient. `authoring::Command::Fabric` handles transactional assignment; `atelier/fabrics_ui.rs` exposes surface density, garment mass, warp/weft stretch, thickness and stiffnesses. Editing one piece detaches a shared material. Mechanical values are estimates; only referenced masses/thicknesses derive from specimens or supplier specifications. Read [sources/limits](fabrics.md), then [performance research](performance-research.md). AVBD and Fabric-101 models were not implemented by this historical pass; later AVBD-related lab work remains distinct from editor backends.

Editing tasks identified at that stage included numeric point movement, dedicated hole editing, offsets, partial sewing, multiple selection, portable saving and initial-intersection feedback. Numeric primitives, boolean holes and internal paths were available in the drafting pass above. Several other items have since been implemented; use the current [authoring guide](authoring.md) and [roadmap](../ROADMAP.md), not this historical list, to choose new work.

## Turbo pass

Read [the historical Turbo measurements](turbo-perf.md) and [the current GPU contact search](gpu-contact-search.md). The CPU backend/fallback retains the conservative temporal cache. The hybrid backend refits and queries BVHs on GPU, then recomputes exact f64 contacts and movement balls on CPU every step. `contact_profile` separates these costs; `detection_ms` also includes coloring. The GPU uses a cooperative workgroup per vertex and resident static terms/incidence. The native worker runs independently of rendering, with one pending result and a real-window `--ui-perf-smoke` measurement. `scripts/turbo-perf.ps1 -UiPerf` explicitly uses the GPU.

## Current execution path

- `cloth-fit` defaults to VBD + OGC. Without `--gpu-sim`, the CLI stays f64 CPU; the workspace uses the hybrid GPU backend on a worker while the interface remains responsive.
- `--reference` retains Newton/PCG and historical vertex/avatar contact. `first-fit.md` and `first-fit-results.json` are historical, before OGC and wider patterns.
- `ogc/` implements feasible regions, reciprocal VF, EE, self-contact, quadratic/logarithmic activation and conservative bounds. `vbd.rs` uses the same FEM/sewing energies as the reference.
- `gpu_vbd.rs` + `vbd.wgsl` compute VBD forces/local updates on GPU. `gpu_vbd/contact_bvh.wgsl` refits/queries BVHs; exact contact geometry, movement bounds, coloring and dynamic packing remain CPU work. No AVBD, PD, IPC or MAS editor backend is available. Research adapters are described separately above.
- `atelier.rs`: 3D on the left, unified 2D board and contextual inspector on the right; examples in the top menu. Left-button grab, right-button orbit, middle-button pan, Space to play/pause. Attachments are energy terms, not forced displacements that bypass contacts. Current Grab brush settings are described in [editor basics](editor-basics.md).
- `render.rs`: GPU-resident avatar, camera matrix applied in WGSL, interpolated normals. Rendering and simulation have distinct measurements.
- T-shirt/dress patterns were widened. Initial arrangement uses separated planes in front/behind the mannequin, without per-vertex warping that could introduce intersections between vertices. OGC rejects old intersecting scenes; rebuild an arrangement.
- Templates v1/v2, 2D rest geometry in metres, per-panel oriented materials, constrained Delaunay and exports are preserved. CC0 MakeHuman mannequin: 1.75 m / 26,756 triangles.

## Reproduce

```powershell
.\scripts\check-cpu.ps1
.\scripts\start-atelier.ps1
.\scripts\ogc-benchmark.ps1 -Gpu -Steps 360 -MeshMm 30
```

Numerical GPU validation is explicit: `cloth-fit --gpu-sim --check-gpu-gradients` compares f32 energies/gradients with f64 AD before every step; it is not a performance measurement. `--gpu-benchmark` measures rendering only; `--gpu-sim` runs hybrid physics. The CLI exposes `--dt` and `--iterations`.

Read [OGC contracts](ogc.md) before changing the solver. Full historical reports are under `output/ogc-gpu/`; retained measurements are in [OGC validation](ogc-validation.md). A `--steps 0` screenshot of a saved project shows the saved state, not necessarily a fresh arrangement.

## Remaining priorities and historical context

1. Reduce exact f64 contact processing and synchronization costs while preserving movement restrictions. GPU BVH refit/query and conservative rejection have explicit overflow retries; precise geometry/incidence still require CPU work. Native 60 physical steps/s is not established across all dense garments and full trajectories. Do not describe this as a fully GPU solver.
2. Allocations/material caches are reused, and cooperative workgroups improved occupancy. Avoid full per-step transfers and validate dense/animated scenes. `gpu_compute_ms` excludes CPU work and transfers.
3. Isotropic bounds restrict sliding; the hybrid backend refreshes once per step. The later sparse directional extension is documented above and in [directional contact](directional-contact.md). Further GPU refresh/directional changes need separate validation.
4. Seams remain finite penalties. Exclusions are local to sewn correspondences, with no guarantee for those pairs. Investigate sewn topology or augmented coupling to close seams without degenerating triangles.
5. Friction, animated avatars, multilayer thickness and calibrated materials remain absent. OGC forces are per pair and their calibration depends on resolution.
6. Preserve physical tests: finite differences, action/reaction, objectivity, internal C2 join, VF/EE crossing, accumulated bounds, invalid initial state, pins and mouse grabbing. Intersection diagnostics use floating-point tolerances, not exact predicates.

## Publication

Initial publication repository: `git@github.com:erythrofr/ClothCraft.git`, branch `main`. `output/` and `target/` are ignored. The owner selected MIT; see `LICENSE`. No OGC/IPC Toolkit author code was incorporated; sources are cited in `ogc.md`. Spade remains pinned in Cargo; MakeHuman provenance is under `assets/makehuman/`. CPU CI is configured in `.github/workflows/cpu.yml`; inspect its GitHub status rather than assuming success.
