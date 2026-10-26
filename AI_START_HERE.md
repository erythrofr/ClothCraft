# Agent entry point

ClothCraft is a research prototype. Make one verifiable improvement at a time.

**Joining the Rust rewrite effort? Read [COORDINATION.md](COORDINATION.md)
first.** It links the atomic task catalog and live assignment board. Obtain a
confirmed claim before editing; check existing PRs and scope conflicts. The
board is shared across human contributors and their agent sessions. This
repository is the owner's Rust integration point; EXO remains an independent
reference project, with its own licensing and maintainers.

ClothCraft is a place for humans and AI agents to build a garment tool and challenge its physics. Draw patterns, sew them, arrange them around an avatar, then try to make the simulation both more faithful and faster. The long-term idea is a stable authoring foundation with replaceable physics solvers. Today's engines are a CPU Newton reference and CPU / hybrid GPU VBD with OGC contact. There is no plugin ABI or universal solver selector yet.

Both AI-assisted and human contributions are welcome. A convincing contribution includes the experiment that could prove it wrong. The [contributor kit](docs/contributor-kit.md) has ready-to-scope task briefs; the [roadmap](ROADMAP.md#current-contribution-queue) identifies current priorities. Read the implementation before choosing a task: historical notes include rejected experiments.

## Your first ten minutes

The [CPU solver laboratory](docs/solver-lab.md) now has opt-in XPBD and finite-stiffness AVBD experiments beside the VBD control, plus a separate native Box3D particle lattice. These are research candidates, not editor backends. Their different integration/contact limits are part of the benchmark contract.

1. Read [AGENTS.md](AGENTS.md), [handoff](docs/handoff.md) and [architecture](docs/architecture.md). Inspect the code before trusting a historical result.
2. Run `cargo test --locked --no-default-features -j 2 -- --test-threads=2`. This does not use a GPU.
3. Choose one bounded task from the [rewrite catalog](coordination/TASKS.md) and obtain its confirmed assignment through [COORDINATION.md](COORDINATION.md). The broader [ROADMAP.md](ROADMAP.md) retains product goals and historical IDs; it is not a second ownership registry. State inputs, observable behavior, failure cases and what will remain unsupported.
4. Keep editable panel/boundary IDs and material coordinates stable. Rebuild every dependent cache after topology changes. Never derive rest shape from a drape.
5. Leave a small reproducible example, relevant checks, and a precise handoff. Report failures as well as improvements.

## Pick a door

| Want to help with… | Start here | A useful next contribution |
|---|---|---|
| Pattern authoring | `src/authoring.rs`, `src/authoring/geometry.rs`, `src/atelier/board.rs` | Primitives, mirrors, booleans/holes and internal sewing exist; numeric point tools and unsewn splits are integrated from Firefly. Paired linked mirrors are implemented; see `docs/panel-tools.md`. Next: offsets, same-panel symmetry and dedicated notch editing. Read `docs/documents-and-sewing.md` for save/open and partial/chain sewing. Read `docs/firefly-integration.md` and `docs/drafting-tools.md` |
| Placement tools | `src/atelier/gizmo.rs` | Arrangement points and collision diagnostics before simulation |
| Sewing | `src/garment/seam.rs`, `src/atelier/edges_3d.rs` | Extend partial/chain sewing with notch editing and manufacturing semantics |
| Interoperability | [input/output contracts](docs/interoperability.md), [format roadmap](ROADMAP.md#interoperability), [native DXF pattern import](docs/pattern-import.md) | Generic planar DXF import is implemented; industrial dialects remain open. Add independently sourced fixtures with units, transforms and round-trip tests |
| Faster contact | `src/ogc/`, `src/gpu_vbd/contact_filter/`, `tests/gpu_contact_filter.rs` | Preserve conservative GPU BVH coverage and overflow retries; read [the contact contract](docs/gpu-contact-search.md) and [draped-scene profiling](docs/draped-realtime.md) before changing compact incidence, canonical keys or precision scheduling |
| Collapsed-face stalls | `src/ogc/directional.rs`, [directional bounds and lab](docs/directional-contact.md) | Preserve fixed separating half-spaces plus residual balls, the unseen-pair envelope, sparse f64 solves and pull/release gates. Reproduce with `scripts/physics-lab.ps1`; GPU opt-in |
| Better physics | `src/energy.rs`, `src/vbd.rs`, `src/solver.rs` | Friction or an alternative backend evaluated on the same physical scenes |
| Draped benchmark | [Checkpoint and residual-motion evidence](docs/dress-checkpoint-and-jitter.md) | Preserve velocities, distinguish connected components, compare restart transients and full physical-time costs |
| Synthetic settling | [CPU settling zoo](docs/settling-zoo.md), `examples/settling_zoo.rs` | Distinguish quiet force balance, exhausted contact searches, cold predictor disturbances and decaying release. Local solve probes remain opt-in; do not treat low motion as a pass |
| Motion diagnosis | `src/motion.rs`, `src/vbd/prediction.rs` | The [objective-based prediction rejection was reverted](docs/settled-jitter.md): it reduced the jitter metric but spoiled interactive motion. Preserve passive diagnostics; evaluate release, sliding and relaxation as well as settled traces |
| Energy and release | `src/vbd/audit.rs`, `examples/energy_probe.rs` | [CPU audit and coupled-mode research](docs/energy-and-release.md); separate stored energy, dissipation, residual work and changing contact/control models. No production correction yet |
| Contact stability research | [Box3D, Roblox AVBD and recent methods](docs/contact-stability-research.md) | Pinned source review, reading scope and experiment order; distinguish collision feasibility, force convergence and energy balance. No alternative backend enabled |
| CPU contact SIMD and jitter | [Measured scope and diagnosis](docs/cpu-contacts-and-jitter.md), `examples/contact_motion_probe.rs` | Four-pair f64 AVX with scalar oracle; preserved collision bounds and pull/release trajectory. Garment hotspots point toward coupled seam/material investigation, not an established jitter fix |
| Coupled seam experiments | `src/vbd/seam_blocks.rs`, [results and limits](docs/seam-block-refinement.md) | Opt-in coupled sewing/membrane search failed the combined jitter/performance gate. Keep it off; compare complete material patches and matched pull/release before any GPU port |
| Comparing solver families | [October research and benchmark plan](docs/solver-landscape-2026-10.md) | Matched-model XPBD/VBD experiments, external Newton/PPF comparisons, complete cost and synchronized pull/release playback; research only, no new backend enabled |
| Fabric calibration | `src/fabrics.rs`, [fabric evidence](docs/fabrics.md) | Replace estimated mechanical presets with measured directional curves and validate the model fit |
| Performance evidence | [solver challenge](docs/solver-challenge.md) | Reproduce the baseline, then compare quality and full-step cost |

## Deliver a reviewable result

Before editing, state the concrete behavior or hypothesis, the files you expect to change and the validation that would reject the change. Preserve unrelated work. After editing, report the observed result, remaining failures, reproduction command and whether the editor behavior changed. Keep research variants opt-in until they pass the shared quality gates.

For solver work, compare the same rest mesh, mass, material, seam map, dt and initial x/v/time. Preserve predictor history when a protocol requires an exact restart. Separate assembly motion, physical oscillation, residual forces and contact-refresh energy changes. Use the same pull/hold/release controls. Rendering FPS is not simulated time per wall second.

For UI work, verify cancelled operations, undo/redo, text-field keyboard ownership and save/reload. Keep model transactions independent of the UI. For format work, test import and export separately with independent fixtures and explicit units.

## Useful rules of engagement

- No imaginary benchmarks, silent mesh reductions, fake backend dropdowns or "fully GPU" claims for a hybrid pipeline.
- Keep the f64 reference. Faster is interesting only when you explain the quality tradeoff.
- GPU runs are opt-in. Coordinate with the person using the machine before occupying their GPU; never put them in ordinary CI.
- Read public manuals as behavioral references, write original code and examples, record sources. Do not import proprietary implementations or assets.
- Do not overwrite another contributor's work. Prefer a focused branch and PR with the exact reproduction command.
- Original source and documentation are MIT-licensed; preserve [LICENSE](LICENSE). The bundled MakeHuman assets retain their own CC0 notice, and dependencies retain their respective licenses. Public reference manuals are not project-owned assets.

Suggested first message in a contribution: **“I changed X; on scene Y, at settings Z, this is the quality/cost difference, and this is the case that still fails.”**
