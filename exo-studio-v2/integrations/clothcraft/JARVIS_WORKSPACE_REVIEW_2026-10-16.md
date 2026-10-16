# Jarvis handoff: EXO ClothCraft Studio (16 October 2026)

This records the reviewed state of Jarvis's previously uncommitted work on the **private** EXO `integration/clothcraft-private` branch, and what was finished afterward. It is separate from EXO `main`, the standalone upstream `ClothCraft.app`, and the original `EXO Sample 3D ClothCraft.app`.

## Jarvis's implementation found in the workspace

- A new `ClothCraftWorkspace.jsx` and CSS view with simultaneous **3D garment + 2D pattern** editing, shared panel/edge highlighting, native avatar display, sewing guides, point/curve dragging, pattern primitives, mirrors/booleans, ruffle/internal-line authoring, movable 3D panels, fabric properties and simulation controls.
- `exo-session.rs`: persistent JSON-over-stdio Rust adapter on ClothCraft's own authoring history, garment template and VBD/Offset Geometric Contact solver, with revision counters, undo/redo, save/reopen, CPU and explicitly opt-in GPU path. This adapter is project-local and is copied into an ignored/untracked upstream checkout only during packaging; it is not an upstream contribution.
- `workspace.mjs` and local `POST /workspace`: one persistent backend process for an editing session instead of starting a new Rust process for every physics frame; serialized calls and periodic persisted fitting-project snapshots in the app's Application Support directory.
- An **independent desktop application** `~/Applications/EXO ClothCraft Studio.app` using an AppKit/WebKit window and localhost-only ports **5286** (UI) and **5285** (session service). It does not replace the original EXO app or upstream native ClothCraft app.
- Four screenshots of linked selection, sewing controls, and the T-shirt/dress at 6 simulated seconds.

## Jarvis's 360-step research run

Recorded in ignored `integrations/clothcraft/output/workspace-fit-20261016/report.json` (not a certified sample, values rounded):

| Fixture | Physics time | Final peak seam gap | Final p95 extension | Active contacts | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| T-shirt | 6 s | **1.991 mm** | **3.409%** | 234 | Visually promising; no physical certification |
| Dress | 6 s | **332.666 mm** | **17.088%** | 383 | Assembly remains unacceptable |

The dress has a large side/shoulder seam issue despite appearing partially draped on the mannequin. One simulation's peak/minimum metrics are **not** a global intersection-free proof. There is no friction or complete swept cloth/body CCD, no validated production fit, and the user-visible scenes are engineering fixtures rather than accurate industrial garment patterns.

## Work completed after review

1. Fixed repeated browser QA to open a fresh T-shirt fixture rather than depending on a previous session's persistent time. The 2D/3D selection, duplicate/undo, sewing edge selection, native step, save and reload end-to-end test now passes on reruns.
2. Inspected Node/Rust session lifecycle and added tests for the opening requirement, play/pause concurrency, stale revisions, shutdown and pending requests. Rust `cargo check --locked -j 2 --bin exo-session`, native document checks and syntax validation passed.
3. Confined the new workspace launch link to its dedicated Studio app rather than adding a dead shortcut to the original personal EXO app. Corrected the new app's window/menu naming.
4. Successfully rebuilt and signed the dedicated **EXO ClothCraft Studio.app**, opened the installed app, verified its native AppKit window and localhost services, and loaded the linked editor without browser exceptions. Its installed backend answered `snapshot` and a physics step with `ClothCraft GPU VBD + CPU OGC`.
5. Ran a separate **one-second 60-step GPU T-shirt smoke** without changing Jarvis's 360-step data. It finished with 273.32 mm maximum seam gap and 21.68% p95 extension, so a brief GPU run cannot be treated as fitted. A fresh 6-second per-fixture GPU trajectory is still a future validation item.
6. Kept private Thomas assets inside local app bundles and ignored working directories, not in Git commits. The original EXO `main` branch and upstream ClothCraft `main` tracked files remain unchanged.

## Usage and limitations

Open **Finder → Applications → EXO ClothCraft Studio** for the new integrated workspace. Open **EXO Sample 3D ClothCraft** for the older full EXO workspace or **ClothCraft** for the unmodified upstream Rust/egui desktop editor. These are three distinct apps.

The Studio toolbar has T-shirt/Dress fixtures, Open project, Save/export, drawing, linked sewing, pattern and fabric controls, simulation start/pause, step and undo/redo. Save/export is still the correct way to preserve an explicit copy of a session. Live state persists locally, but not every crash scenario has been tested. Editing a garment can invalidate its mesh and require assembly from rest state; no factory fit approval is implied by the 3D appearance.

**Next physics priorities:** make dress initial layout and seam correspondence sound before investing in more iterations; compare full GPU/CPU trajectories and minimum-distance/contact candidates on the same fixtures; add mesh/face penetration screening and reliable collision-safe assembly before certifying fit. Separately improve artwork, materials, avatar selection and production interchange; these are not silently inherited from the original EXO interface.
