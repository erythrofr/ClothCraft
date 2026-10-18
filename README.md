# ClothCraft

ClothCraft is an open-source garment editor written in Rust. It connects editable 2D patterns, sewing relationships and 3D placement to a cloth simulation.

**Early alpha.** Basic drafting and fitting work, but most of the work needed for a production garment tool remains ahead. Expect incomplete tools, uncalibrated materials and simulation failures on difficult arrangements.

![ClothCraft workspace](docs/screenshots/workspace.png)

## Run

Install Rust stable, then run from the repository root:

```sh
cargo run --release --locked -j 2 --bin cloth-fit -- --steps 0 --view
```

The editor starts with a T-shirt and the bundled MakeHuman mannequin. A graphics adapter supported by wgpu is required for the desktop workspace. Command-line tools and numerical tests also build without graphics dependencies.

```sh
# Reopen an editable garment
cargo run --release --locked -j 2 --bin cloth-fit -- --project path/to/garment.json --steps 0 --view

# Validate a template on CPU
cargo run --locked --no-default-features -j 2 --bin cloth-template -- validate examples/templates/tshirt.json
```

Windows is the primary development platform. Equivalent macOS and Linux acceptance testing is still needed.

## Working with garments

- **Draw:** rectangles, ellipses, arc sectors and Bézier contours on a shared 2D board. Edit points and dimensions; mirror, duplicate, combine or subtract pieces; add holes and internal sewing paths.
- **Mark:** select an outer boundary and give it a seam allowance (mm) and notches. The joined cutting line and the notches are drawn on the board and printed; they are draft data and never change the simulation. See the [markings guide](docs/markings.md).
- **Sew:** select boundaries in either view. Sew full edges or partial ranges, edit their lengths, reverse their direction and assemble ordered chains on both sides. Unequal lengths require explicit easing. Existing seams can be edited or deleted.
- **Arrange:** move and rotate pieces in 3D. Board layout is separate from material rest geometry.
- **Simulate:** start or pause with Space; use Grab to pull the cloth. Inspect seam gaps, stretch and full-step timings in Properties → Simulation.
- **Save:** File → Save / Save As stores the editable garment and current simulation state. Keep the JSON and its adjacent `.assets` directory together when moving a project. File → Open can relink a missing OBJ avatar. Recovery snapshots are separate from saved documents.

Right-click either canvas for the radial tool menu. Ctrl+C/V copies selected pieces and their internal seam relationships; Ctrl+Z undoes an edit. Drag the dividers to resize the views. Viewport gear menus contain display and navigation options.

[Document and sewing guide](docs/documents-and-sewing.md) · [Authoring reference](docs/authoring.md) · [Workspace controls](docs/workspace-ui.md)

## Supported files

| Data | Input | Output |
|---|---|---|
| Editable garment | ClothCraft project / template JSON | Project / template JSON |
| Static avatar | OBJ | — |
| Simulated surface | — | OBJ geometry and material-space UVs |
| Pattern preview | — | SVG; not a print-to-scale production pattern |
| Print sheet | — | mm-scaled `patterns-print.svg` with seam allowance, notches and a 100 mm ruler; one piece per page, no nesting or tiling |
| Research data | — | Metrics, fiber frames and geometric grain guides |

Export writes interchange artifacts to the session output folder, separately from Save. DXF-AAMA/ASTM, MTL, GLB, Alembic, USD, FBX, PDF printing and grading-rule adapters are **not implemented**. CLO and Marvelous Designer project files are not supported.

See the [format plan](docs/interoperability.md) for units, supported entities and acceptance criteria.

## Physics

The interactive engine uses VBD with OGC contact. GPU execution is hybrid: contact detection and parts of the step remain on the CPU. A double-precision Newton reference is available for numerical comparisons.

The authoring model is independent of the renderer and solver. The aim is to compare and replace physics backends without replacing garment documents or editing tools. A general solver plugin interface does not exist yet.

Current limits include finite iteration budgets, penalty sewing, local collision exclusions at seams, no Coulomb friction and no animated avatars. Contact requires an initially separated arrangement. Material presets are estimates, not measured calibration. Remeshing resets affected simulation geometry. The displayed floor is visual only.

[Contact contract](docs/ogc.md) · [Material evidence](docs/fabrics.md) · [Solver comparison protocol](docs/solver-challenge.md)

## Development

Start with [CONTRIBUTING.md](CONTRIBUTING.md), [AI_START_HERE.md](AI_START_HERE.md) and [the handoff](docs/handoff.md). The [roadmap](ROADMAP.md) separates implemented features from planned work, and the [feature map](docs/feature-map.md) tracks the published CLO/Marvelous function families against it. Human and AI-assisted contributions follow the same review and validation requirements.

```powershell
.\scripts\check-cpu.ps1
```

Or run the core checks directly:

```sh
cargo test --locked --no-default-features -j 2 -- --test-threads=2
cargo clippy --locked --no-default-features --all-targets -j 2 -- -D warnings
cargo build --locked -j 2
```

These commands do not run GPU workloads. Native window and GPU tests are opt-in. Performance contributions should report the same scenes, resolution, material parameters and simulated duration, including quality metrics and full-step cost.

| Area | Entry point |
|---|---|
| Document I/O | `src/document.rs`, `src/fitting.rs` |
| Editing transactions and undo | `src/authoring.rs` |
| Pattern geometry, meshing and seams | `src/garment/` |
| Desktop workspace | `src/atelier/` |
| Material energy and reference solver | `src/energy.rs`, `src/solver.rs` |
| Interactive physics and contact | `src/vbd.rs`, `src/ogc/`, `src/gpu_vbd.rs` |

## License and credits

Original source and documentation are [MIT-licensed](LICENSE). The MakeHuman assets retain their [CC0 notice and provenance](assets/makehuman/LICENSE.ASSETS.md); dependencies retain their own licenses. See the [artwork record](assets/branding/README.md) for the generated project icon.

Some authoring and camera tools were adapted from FireflyTheReal / julienfoss's fork; [integration notes](docs/firefly-integration.md) record their provenance and subsequent changes.

ClothCraft is independent of CLO, Marvelous Designer and ArtCraft. Public manuals inform workflow research; proprietary code, icons and garment examples are not included. The [manual study](docs/manual-study.md) records the references consulted.
