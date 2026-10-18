# Hello, next intelligence 👋

**Make the cloth better. Bring receipts.**

ClothCraft is a place for humans and AI agents to build a garment tool and challenge its physics. Draw patterns, sew them, arrange them around an avatar, then try to make the simulation both more faithful and faster. The long-term idea is a stable authoring foundation with replaceable physics solvers. Today's engines are a CPU Newton reference and CPU / hybrid GPU VBD with OGC contact. There is no plugin ABI or universal solver selector yet.

If you want to vibe-code a better solver: welcome. A convincing contribution includes the experiment that could prove it wrong.

## Your first ten minutes

1. Read [AGENTS.md](AGENTS.md), [handoff](docs/handoff.md) and [architecture](docs/architecture.md). Inspect the code before trusting a historical result.
2. Run `cargo test --locked --no-default-features -j 2 -- --test-threads=2`. This does not use a GPU.
3. Choose one bounded task from [ROADMAP.md](ROADMAP.md) or the [feature map](docs/feature-map.md). The manual-backed backlog has stable task IDs (`SAVE-01`, `DRAW-01`, `SEW-01`, etc.), dependencies and acceptance cases. State inputs, observable behavior, failure cases and what will remain unsupported.
4. Keep editable panel/boundary IDs and material coordinates stable. Rebuild every dependent cache after topology changes. Never derive rest shape from a drape.
5. Leave a small reproducible example, relevant checks, and a precise handoff. Report failures as well as improvements.

## Pick a door

| Want to help with… | Start here | A useful next contribution |
|---|---|---|
| Pattern authoring | `src/authoring.rs`, `src/authoring/geometry.rs`, `src/atelier/board.rs` | Primitives, mirrors, booleans/holes and internal sewing exist; numeric point tools, unsewn splits, seam allowance and notches are integrated (see `docs/markings.md`). Next: linked symmetry and a measured internal-line offset. Read `docs/documents-and-sewing.md` for save/open and partial/chain sewing. Read `docs/firefly-integration.md` and `docs/drafting-tools.md` |
| Feature selection | [feature map](docs/feature-map.md) | `MARK-01` (seam allowance and notches) is implemented; pick the next ordered slice (`MARK-02` notch correspondence, `MEASURE-01`, `LAYOUT-01`, …) and record its acceptance case. Statuses are a code audit, not parity claims |
| Placement tools | `src/atelier/gizmo.rs` | Arrangement points and collision diagnostics before simulation |
| Sewing | `src/garment/seam.rs`, `src/atelier/edges_3d.rs` | Extend partial/chain sewing with notch correspondence (`MARK-02`) and manufacturing semantics |
| Interoperability | [input/output contracts](docs/interoperability.md), [format roadmap](ROADMAP.md#interoperability) | Small, independently sourced fixtures with units, transforms and round-trip tests |
| Faster contact | `src/ogc/`, `tests/ogc_cache.rs` | GPU broad phase with conservative coverage and explicit overflow handling |
| Better physics | `src/energy.rs`, `src/vbd.rs`, `src/solver.rs` | Friction or an alternative backend evaluated on the same physical scenes |
| Fabric calibration | `src/fabrics.rs`, [fabric evidence](docs/fabrics.md) | Replace estimated mechanical presets with measured directional curves and validate the model fit |
| Performance evidence | [solver challenge](docs/solver-challenge.md) | Reproduce the baseline, then compare quality and full-step cost |

## Useful rules of engagement

- No imaginary benchmarks, silent mesh reductions, fake backend dropdowns or "fully GPU" claims for a hybrid pipeline.
- Keep the f64 reference. Faster is interesting only when you explain the quality tradeoff.
- GPU runs are opt-in. Coordinate with the person using the machine before occupying their GPU; never put them in ordinary CI.
- Read public manuals as behavioral references, write original code and examples, record sources. Do not import proprietary implementations or assets.
- Do not overwrite another contributor's work. Prefer a focused branch and PR with the exact reproduction command.
- Original source and documentation are MIT-licensed; preserve [LICENSE](LICENSE). The bundled MakeHuman assets retain their own CC0 notice, and dependencies retain their respective licenses. Public reference manuals are not project-owned assets.

Suggested first message in a contribution: **“I changed X; on scene Y, at settings Z, this is the quality/cost difference, and this is the case that still fails.”**
