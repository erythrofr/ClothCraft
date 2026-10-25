# ClothCraft roadmap

Build a useful garment authoring tool whose physics can evolve independently. Public Marvelous Designer manuals inform expected interactions; ClothCraft implements its own code, data model, UI and test fixtures. This is an independent implementation effort, not an affiliated product or a claim of formal clean-room certification.

Status: research prototype, October 2026. **Most of the product is still missing. A roadmap item is not a supported feature.** Read the [source/behavior ledger](docs/manual-study.md), [current authoring guide](docs/authoring.md) and [input/output capability matrix](docs/interoperability.md).

The [15 October essential-tool review](docs/essential-authoring-tools.md) compares the current code with official CLO/Marvelous workflows. It proposes user-visible slices and acceptance examples: reliable documents, partial and multi-edge sewing, pins/freeze, arrangement, measurements and visibility, offsets/cuts, linked symmetry and grain. Manufacturing-specific release gates are separate. This is research and planning, not an implementation update.

## Current contribution queue

**22 October — coordinated native Rust rewrite.** Start at
[COORDINATION.md](COORDINATION.md), inspect the
[EXO comparison](docs/exo-feature-audit.md), then choose an atomic task from
[the task catalog](coordination/TASKS.md). The machine-readable manifest
records dependencies, file scopes, evidence and existing PRs; the
[live board](https://github.com/erythrofr/ClothCraft/issues/8) records current
ownership. Existing product goals below remain valid. A catalog entry is not
a completed feature or a claim that EXO has validated it in production.

Updated 21 October 2026. The first goal is a coherent editing workflow around the existing solver. The physics work needs reproducible evidence, not a new default engine selected on reputation. Contributors may work independently on these tracks; announce a narrow scope before changing shared schemas. [Task prompts and reporting templates](docs/contributor-kit.md) are available for people using coding assistants.

| ID | Remaining task | Starting point / dependencies | Acceptance |
|---|---|---|---|
| UX-01 | Validate and refine the first-time sewing workflow | `atelier/sewing_ui.rs`, `board.rs`, `edges_3d.rs`; existing partial/chain model | An unfamiliar user selects two intended boundaries, sees direction and unequal-length policy, confirms once, then selects/deletes/undoes the seam in either view |
| UX-02 | Consistent selection and editing across pieces | `atelier/selection.rs`, `authoring.rs` | Box/lasso, point/piece selection, group edits and Delete have explicit scope; text fields retain keyboard ownership; one edit is one undo entry; linked mirrors do not update twice |
| UX-03 | Clear inspection and viewport controls | `atelier/view_controls.rs`, `chrome.rs` | A clean mesh view is reachable in one action; selection and sewing overlays have predictable visibility; Grab radius/strength are discoverable and do not change materials |
| UX-04 | Arrangement and measurements for real drafting | ARR-01, SIM-01, `atelier/gizmo.rs` | Body-aware placement, pin editing and useful measurements preserve material coordinates and report unsupported operations |
| PHYS-01 | Diagnose persistent motion on a settled benchmark | `vbd/audit.rs`, `motion.rs`; owner-provided final benchmark pending | Distinguish assembly motion, cold-restart history, contact-refresh discontinuity and final force residual; preserve velocities and record identical pull/hold/release controls |
| PHYS-02 | Continuous contact response without artificial sticking | `ogc/`, existing rejected contact trials | Preserve separation checks and force coverage; pass rest, frictionless sliding and release; report energy/force continuity and full-step cost; keep unproven variants opt-in |
| PHYS-03 | Evaluate real alternative solver adapters | `solver_lab/`, solver challenge | Same rest mesh/materials/seams/controls; report quality before speed; do not expose failed lab candidates as editor modes |
| PERF-01 | Reduce complete-step cost on dense garments | `gpu_vbd/`, `ogc/`; baseline before optimization | Same mesh, dt, iterations and collision scope; P50/P95, simulated/wall time, GPU waits and CPU costs; independent collision and deformation checks |
| MAT-01 | Replace estimates with measured material fits | `fabrics.rs`, `energy.rs`; reusable source data | Units, directional measurements, fit errors, derivatives/objectivity and a stated calibration range |
| IO-01 | OBJ + MTL static asset round trip | `avatar.rs`, `garment/export.rs` | Units/axes, groups, UVs, normals and material assignments checked in independent tools; explicit losses |
| IO-02 | Static glTF/GLB import and export | Canonical mesh/material model; separate direction-specific adapters | Document supported PBR/texture subset, transforms and units; independent reader/writer fixtures |
| IO-03 | DXF-AAMA and DXF-ASTM pattern exchange | Stable pattern entities, grain and notch semantics | Separate dialect fixtures; correct physical dimensions; distinguish cut/sew lines and unsupported entities |
| IO-04 | Tiled pattern printing and cutting metadata | Physical SVG sewing outlines and 100 mm ruler available; printer output unverified | PDF/tiling, cutting allowances and labels; measured print tolerance |
| IO-05 | Animated cache and production exchange | Animation/time-sample model first | Alembic/USD, then FBX scope tested separately; stable topology policy, timestamps and external playback |
| QA-01 | Portable public benchmark pack | Small original garments and synthetic fixtures with provenance | Fresh checkout reproduces edit/save/reload and matched solver runs; large private captures are not required |

The owner reports useful collision robustness but residual wiggles and slow physical progress on finer meshes, including an 8 mm editing trial. This is user feedback, not a measured benchmark or a universal safety/performance claim. The next agreed dress benchmark has not yet been finalized. Keep historical captures labelled with their revision and settings.

## Next milestones, in order

16 October update: Open/Save/Save As, portable avatar assets and local recovery are implemented, followed by partial ranges and ordered 1:N/M:N sewing. See [document and sewing contracts](docs/documents-and-sewing.md). Multi-document tabs, asset cleanup, dedicated notch editing and manufacturing sewing semantics remain open. The rows below retain the broader acceptance goals.

Each row is a contribution-sized track, not a promised release date. Finish one verifiable slice before adding another format or toolbar.

| Order | Outcome | Start in | Acceptance / evidence |
|---|---|---|---|
| P0.1 | Reliable save/open and portable projects | `fitting.rs`, `atelier.rs` | File picker, explicit save vs export, relative/relinked avatar paths, autosave recovery; reopen the same document/state after a forced shutdown |
| P0.2 | Understandable drawing and sewing | `atelier/board.rs`, `authoring.rs`, `garment/seam.rs` | Numeric dimensions, add/remove contour points, clear orientation and preflight intersections; a new user completes a top without editing JSON |
| P0.3 | Stable cloth at a measured realtime budget | `ogc/`, `vbd.rs`, `gpu_vbd.rs` | Shirt/apron/dress, supported and free cloth, multiple mesh densities; report step P50/P95, delivered physical time, seam gaps, stretch and intersections. Preserve accuracy checks |
| P1.1 | Practical static asset interchange | `avatar.rs`, `garment/export.rs`, future adapters | OBJ+MTL round trip, then static GLB; explicit units/axes, groups, normals and UVs; Blender and a second independent viewer agree |
| P1.2 | Industrial pattern exchange | canonical pattern model + new format adapters | DXF-AAMA and DXF-ASTM separately; import/export contours, grain and notches with independent fixtures; cutting vs sewing lines are explicit |
| P1.3 | Usable pattern printing | `garment/export.rs` | Physical SVG/PDF page dimensions, 100 mm ruler, tiling, labels and allowances; printed measurements agree within documented tolerance |
| P2.1 | Production animation exchange | future adapters + animation model | Fixed-topology Alembic cache; USD mesh/material/time samples; FBX avatar skinning/animation import; playback and unit/time tests in external DCCs |
| P2.2 | Truly replaceable solvers | `fitting.rs`, `solver.rs`, `vbd.rs` | One lifecycle/capability contract, two real adapters, shared scene suite; no fake backend selector |
| P3 | Manufacturing and richer appearance | pattern/gradation and material adapters | Named grading dialect, size rules and reversible grades; USDZ packaging; optional legacy caches and SBSAR baking |

The format priorities below remain product priorities: a **critical** animation format is still blocked by an animation/data-model milestone. Format names alone are not deliverables. Paired linked mirrors and a read-only 2D ruler now exist ([scope](docs/panel-tools.md)). Friction, layered cloth, calibrated materials, same-panel symmetry and 3D surface measurements remain substantial tasks. Basic independent mirrors, holes and internal sewing now exist; see [their limits](docs/drafting-tools.md).

## 1. Draw → sew → arrange → simulate

- [x] Unified metric 2D board, rectangle/pen creation with straight and cubic Bézier boundaries; constrained Delaunay meshing.
- [x] Linked 2D/3D panel/edge selection, duplicate/delete, whole-edge sewing from either view, direction and explicit easing.
- [x] Sparse colored seam links and endpoint ticks in 2D/3D, linked hover/selection and distinguishable pending previews.
- [x] World-axis translation/rotation gizmos, numeric transforms, transactional preview and undo/redo.
- [x] Direct 3D move/rotate tools (G/R), edge-on rotation rings, 15° snapping and 2D board rotation independent of physical rest/grain.
- [x] Save editable templates/projects and reopen through the CLI; preserve v1/v2 data compatibility.
- [x] Edit existing anchors and Bézier handles; pan/zoom, snapping and saved 2D layouts.
- [x] Numeric primitives (rectangle, circle/ellipse, arc sector), independent X/Y mirrors and ±X/±Y copies.
- [x] Union/intersection/subtraction with holes and islands; internal Bézier sewing paths and eased ruffle strips (CPU validation; native/GPU acceptance still pending).
- [x] Numeric point movement, rectangle resizing, multi-point selection, unsewn contour splits and target lengths (CPU validation; native interaction pending).
- [x] Camera presets/orthographic views, board view rotation, English UI and light/dark preferences, adapted from FireflyTheReal; see [integration notes](docs/firefly-integration.md).
- [x] Radial tools, 2D panel/point marquee, group board movement and Ctrl+C/V with internal seams (CPU/headless checks; native acceptance pending).
- [ ] Same-panel symmetry, group rotation/3D transforms, 3D marquee, line offsets and dedicated hole point editing. Paired linked copies already exist.
- [ ] Import verified reusable patterns: FreeSewing Teagan/Titan/Jett are linked from the Web menu; SVG geometry and semantic sewing adapters remain planned ([investigation](docs/drafting-tools.md#web-pattern-library-investigation)).
- [x] Partial ranges in both views, numeric range editing, direction handles, ordered 1:N / M:N sewing and seam editing/deletion.
- [ ] Dedicated notch editing, automatic correspondence and manufacturing sewing semantics.
- [ ] Arrangement points, body-aware placement and useful preflight intersection feedback.
- [x] Native project picker, Open/Save/Save As, dirty state, portable OBJ assets and local recovery.
- [ ] Multi-document tabs, portable texture/material dependencies and managed recovery history.
- [ ] Seam allowance, grain annotations, graded sizes and print layouts.

Acceptance: an unfamiliar user can draft a simple top, join its intended boundaries, place it outside the avatar, simulate, save and reproduce the same editable garment. New formats must not store transient mesh indices as sewing references.

## 2. Physics as a replaceable module

- [x] Authoring and material-space model independent of egui/wgpu; CPU-only build.
- [x] CPU Newton reference; CPU VBD; hybrid GPU VBD/OGC; real window timing and force checks.
- [ ] Common backend lifecycle/capability contract, exercised by two real adapters before exposing a new selector.
- [ ] Standard scene suite and machine-readable quality/cost comparisons for alternative solvers.
- [x] First headless dress screening with VBD control, XPBD/OGC, finite-stiffness AVBD and a native Box3D lattice. [Results and failed gates](docs/solver-lab-results.md); no new editor backend promoted.
- [x] Conservative GPU BVH candidate search, explicit overflow retries and resident fixed geometry; exact contact geometry/bounds remain on CPU ([scope](docs/gpu-contact-search.md)).
- [ ] Fully resident GPU contact, fewer transfers, dense scenes and animated avatars.
- [ ] Friction, layered garments, better seam closure and calibrated material response.

The [18 October solver review](docs/solver-landscape-2026-10.md) proposes matched-model VBD/XPBD/compliant-ALM comparisons and separate external Newton/PPF evaluations, with a ruffled dress, small fixtures and matched pull/release controls. The saved Garment now has diagnostic and trajectory evidence; the [coupled seam experiment](docs/seam-block-refinement.md) failed its combined quality/performance gate and stays disabled. Next: complete-material-patch diagnosis and a reusable benchmark before another production correction. XPBD/OGC and finite-stiffness AVBD now have CPU research adapters; a separate native Box3D lattice is also tested. They are not selectable editor backends. DAT and the other external candidates remain unimplemented. The [15 October review](docs/research-2026-10-15.md) remains historical background.

The challenge is **more accurate AND faster**, with disclosed tradeoffs. Keep authoring, import/export and benchmarks useful even if a future solver replaces today's engine. See [solver challenge](docs/solver-challenge.md).

## Interoperability

The priorities below are the product requirements. Within the critical group, implement small, validated slices instead of advertising a full format after parsing one example. Import and export are separate capabilities.

| Format | Industry use | Priority | Current support / next milestone |
|---|---|---|---|
| DXF-AAMA / DXF-ASTM | Industrial sewing pattern exchange | **Critical** | Planned. Layers, units, contours, notches, grain and piece IDs; independent AAMA/ASTM fixtures and explicit unsupported-entity diagnostics |
| OBJ + MTL | Static garments, avatars, Blender, Maya | **Critical** | **Partial:** avatar OBJ import and garment OBJ export; no MTL/material round trip. Add groups, material assignments and documented axes/UV conventions |
| glTF / GLB | Modern 3D assets, PBR, realtime visualization | **Critical** | Planned. Static garment/avatar round trip first, then materials, textures and animation capabilities |
| Alembic `.abc` | Animated simulation caches for VFX/cinematics | **Critical** | Planned. Fixed-topology position/normal cache, timestamps, units and DCC playback fixture |
| OpenUSD `.usd/.usda/.usdc` | Production pipelines and Chaos Cloth workflows | **Critical** | Planned. Mesh/material/time-sample interchange; validate any Chaos-specific schema separately |
| FBX `.fbx` | Rigged characters, animation, Unreal, Unity, DCC | **High** | Planned. Avatar hierarchy, skinning, bind transforms and sampled animation; select dependency/distribution strategy before integrating |
| PDF / SVG | Print and share 2D patterns | **High** | **Partial:** annotated preview and physical SVG sewing outlines with a 100 mm ruler. No PDF, tiling or allowances; physical printer validation remains open |
| Grading rule files | S/M/L/XL size ranges, industrial manufacturing | **High** | Planned. Identify concrete dialects; explicit units, size tables, stable point identities and reversible grade application |
| USDZ `.usdz` | AR and product presentation | **Medium** | Planned after USD: packaging, material/texture validation and viewer fixture |
| MDD / PC2 | Legacy deformation-cache pipelines | **Secondary** | Planned. Fixed vertex order, frame/time conversion and topology mismatch rejection |
| SBSAR | Procedural Substance materials | **Secondary** | Planned. Dependency/runtime evaluation and material baking workflow; appearance parameters are not calibrated cloth physics |

Every adapter must declare supported entities, units, axes/handedness, topology policy, material mapping and losses. Reject or report unsupported data instead of silently flattening it. Put adapters around the canonical garment model, not inside a solver. Add round-trip tests and open-source or self-authored fixtures with provenance. **Input and output have separate acceptance criteria** in [the interchange plan](docs/interoperability.md). Native CLO/Marvelous project files are not supported; do not infer editable garment support from mesh import.

## 3. Concrete authoring backlog from the manual study

The nine articles reviewed in the [dated manual ledger](docs/manual-study.md#authoring-backlog-review-2026-10-14) inform the tasks below. These are target acceptance criteria, not completed milestones. DRAW-01 has numeric primitive dimensions; DRAW-03 has independent mirrors; DRAW-04 has holes and internal sewing paths. Their remaining scopes still need work. These are independent behavior specifications, not a plan to copy proprietary code or file formats.

| ID / milestone | Small deliverable | Dependencies / starting point | Done when |
|---|---|---|---|
| SAVE-01 / P0.1 | Open, Save As, dirty-state feedback and portable avatar references | `fitting.rs`, `atelier.rs`; foundation for every later task | A saved shirt reopens from another directory with matching material/rest/state; missing avatar gives relink UI; cancelled or failed writes preserve the previous file |
| DRAW-01 / P0.2 | Rectangle width/height and numeric anchor movement in mm | `authoring.rs`, `atelier/board.rs`; current metric model | A 400 × 600 mm rectangle keeps exact dimensions through save/load; invalid values are atomic; one edit is one undo entry |
| DRAW-02 / P0.2 | Add/remove a contour point; split by arclength, ratio or count | DRAW-01; named-edge migration in `garment/curves.rs` and `authoring.rs`; MD-01 | Split a sewn Bézier without changing its outline; migrate seam ranges or reject explicitly; no dangling references after undo/remesh |
| SEW-01 / P0.2 | Interactive partial-edge sewing in both views with numeric length and endpoint handles | Existing `BoundaryRef.range` / compiler correspondence; `board.rs`, `edges_3d.rs`; MD-02 | Sew 100 mm of a 400 mm edge to another piece, reverse/edit/delete it, undo and reload; selected subranges and preview match the physical seam |
| ARR-01 / P0.2 | Named body arrangement anchors with preview, normal direction and clearance diagnostics | `avatar.rs`, `authoring.rs`, `gizmo.rs`; MD-06 | Place front/back/sleeve panels on an arbitrary supported avatar; show offending pieces before simulation; retain 2D rest data and undo the placement |
| SIM-01 / P0.3 | Edit persistent pins from 2D/3D and distinguish them from temporary mouse grabbing | Material-coordinate attachment model + solver capabilities; MD-07 | Pin/unpin a patch and resume; report what survives remeshing; no persisted triangle indices, hidden forces or silent conversion between hard and soft constraints |
| DRAW-03 / P1 authoring | Mirror copies with optional linked outline/sewing edits, plus unlink | DRAW-02; explicit relation model; MD-03 | Edit one sleeve and update its counterpart exactly once; mirrored winding, grain and seam orientation remain valid; unlink and undo are deterministic |
| DRAW-04 / P1 authoring | Internal lines, offsets and holes as distinct semantic objects | DRAW-02; topology/model migration and constrained mesher; MD-04 | A 10 mm internal offset remains attached to its piece; reject self-crossing offsets; a hole removes area/mass while a guide line does not |
| SEW-02 / P1 authoring | 1:N, then M:N ordered sewing chains and editable notch correspondences | SEW-01; DRAW-04 for internal-line sewing; MD-05 | Sew two short edges to one long edge with visible ordering and explicit ease; cancel partial input; preserve totals, orientation and notches after remeshing |
| ARR-02 / P1 authoring | Fold placement preview about an internal line | DRAW-04 + ARR-01; MD-08 | Fold a cuff/hem and undo it without changing material rest; preflight initial intersections; distinguish placement from a physical crease constraint |

Recommended follow-up: finish the remaining **SAVE-01** / **SEW-01** acceptance work and add dedicated notch editing. DRAW-01 has numeric dimensions and point editing; DRAW-02 has unsewn boundary splits. Keep DRAW-02 and SEW-01 in separate reviewable changes. ARR-01 and physical performance work can proceed independently once they share the same document transactions. Do not block a usable save/draw/sew loop on automatic sewing, animation or visual trim tools.

### Release evidence, not feature counts

- A new user completes **T-shirt → added apron → simple dress** using only the UI, saves, closes and reloads each garment. Record the actual action sequence and any manual recovery.
- Every topology edit checks area/mass, stable semantic references, undo/redo and compatibility with old documents. Future schema changes need explicit migrations; do not silently change existing v1/v2 interpretation.
- For each physical backend, publish identical fixtures, settings and material data with seam gap, stretch, penetration diagnostics, step P50/P95 and simulated/wall time. Target >=0.95× physical time and >=55 UI frames/s on a named reference machine; this is an acceptance target, **not current universal performance**.
- Every import/export adapter must meet the separate direction-specific [interchange contract](docs/interoperability.md). Preserve the critical/high priorities above; manufacturing semantics and animation prerequisites determine implementation order.

## 4. Public-manual study queue

Next reading: darts/pleats, seam allowance, topstitch vs structural sewing, zippers/buttons, fabric testing/calibration, measurement, animation, retopology and UV/export details. Read each family before writing its implementation specification. Automatic sewing is later work, after explicit sewing and arrangement are reliable; generic AI automation is not a substitute for a correct garment model. Track observations, independent specifications, implementation status and acceptance cases in [manual-study.md](docs/manual-study.md). The full manual has not been exhaustively reviewed.
