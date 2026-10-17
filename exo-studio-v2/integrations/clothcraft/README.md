# EXO × ClothCraft — personal integration branch

This integration lives on the separate `integration/clothcraft-private` branch. The canonical EXO worktree and the upstream ClothCraft contribution branch are independent. ClothCraft remains upstream MIT-licensed software; EXO's original files remain GPL-3.0-only. The bridge preserves source EXO projects and runs ClothCraft's actual CPU Rust utilities as separate processes, after generating compatible template JSON using EXO's existing native C++ exporter.

## Separate native ClothCraft.app (macOS)

**New third workspace:** Jarvis's linked 2D/3D **EXO ClothCraft Studio.app** and its tested, opt-in Rust session backend are documented in [Jarvis workspace review (16 October 2026)](JARVIS_WORKSPACE_REVIEW_2026-10-16.md). This is not the upstream native ClothCraft app, and it does not replace the original full EXO application. Use `npm run clothcraft:build-workspace` to rebuild the standalone integrated Studio.

**Current hybrid interface:** [Actual EXO Sample 3D shell around ClothCraft's 3D/2D workspace](EXO_SHELL_UI_INTEGRATION_2026-10-16.md). `?desktop=1&engine=clothcraft` uses the real EXO application—its menus, original library, full double-column left tools, right tool palette, object browser, inspector, project strip and bottom simulation bar—not a simplified copy. The center displays ClothCraft's original linked Rust-backed 3D and 2D views. Working common actions are routed to Rust; highly specialized EXO tools operate on the separate EXO draft until a genuine shared-data adapter exists. The earlier compact UI is preserved only as `engine=clothcraft-lab` for development tests.

**V1/V2 states:** The protected local `studio/v1-full-exo-ui-20261016` tag keeps the complete first Studio unchanged. The isolated `feature/studio-v2-clo-visuals` branch and `EXO ClothCraft Studio V2.app` introduce the actual original EXO combined 360° gizmo, original floor lighting, original `FlatAvatarSilhouette`, shared drafting axis and ClothCraft native draped-panel pose manipulation. [Read the V1/V2 state and recovery guide](../../docs/EXO_STUDIO_V1_V2_STATE_MANAGEMENT.md). Build V2 with `npm run clothcraft:build-v2-workspace` from its own worktree; do not use the V1 build command in this worktree.

ClothCraft's own Rust/egui **editor** is also installed independently at `~/Applications/ClothCraft.app`, next to but not inside `EXO Sample 3D ClothCraft.app`. This is the actual native desktop GUI from the unmodified upstream ClothCraft checkout, using `wgpu` (the macOS Metal renderer), not the EXO WebKit interface or a wrapped website. The first Mac desktop build passed `cloth-fit --steps 0 --ui-smoke` and produced a native UI screenshot, then the installed app launched and macOS's window registry confirmed a 1512×900 ClothCraft editor window.

Open from Finder → Applications → ClothCraft, or run:

```sh
open -a "$HOME/Applications/ClothCraft.app"
```

To rebuild it locally from the upstream Rust `cloth-fit` desktop binary, use `npm run clothcraft:build-native-app`. Compile that binary once with the desktop feature enabled (`cargo build --locked -j 2 --bin cloth-fit` using the local Rust toolchain). The app includes ClothCraft's original MIT license, its own ram-head Finder/Dock icon and CC0 MakeHuman OBJ with asset notices. The executable starts paused (`--steps 0 --view`) and keeps artifacts in `~/Library/Application Support/ClothCraft/Workspace`. Use ClothCraft's **Export** control to persist edits; this early alpha **does not autosave**. On a later launch, the wrapper reopens `fitting-project.json` in that folder if present. Diagnostics go to `~/Library/Logs/ClothCraft/clothcraft.log`. An ad-hoc local macOS signature is applied; the app is not notarized, release-qualified or intended for redistribution.

This desktop editor is independent of EXO and does not automatically sync EXO patterns, avatar assignments or simulation state. See the integration commands below for explicitly exported interchange. Upstream's README currently lists Windows as the only release-exercised desktop platform, so this successful Mac window smoke is useful but **does not constitute full macOS qualification or a certified garment fit**.

## Run from the EXO private worktree

For the live personal UI, run `npm run clothcraft:start` to launch both local servers from one terminal (Ctrl+C stops both). Alternatively, start `npm run clothcraft:serve` in one terminal and `npm run clothcraft:dev` in another. Open `http://127.0.0.1:5174` and select the **Production** workspace; the two ClothCraft controls near the bottom validate the editable EXO garment in Rust or bake downloadable ClothCraft OBJ + template JSON. Baking opens an orbitable, read-only 3D preview of the actual ClothCraft mesh inside EXO, alongside saving the OBJ. The private port 5174 allows the original EXO server to stay on 5173 without interference. The localhost bridge listens on 5193 and accepts only requests from the EXO development origins.

### Installed standalone macOS application

The same personal integration also has a **real signed macOS `.app`** in `~/Applications/EXO Sample 3D ClothCraft.app`. Double-click it from Finder/Applications or launch with:

```sh
open -a "$HOME/Applications/EXO Sample 3D ClothCraft.app"
```

It opens a native AppKit window with an embedded WebKit interface rather than a Chrome tab. The bundle contains the compiled EXO interface, native C++ exporter, ClothCraft Rust template/fit executables, a locally licensed CC0 mannequin and its own Node runtime. The app **automatically starts** its two loopback services on ports 5284 (interface) and 5283 (Rust bridge), then stops those processes when quitting normally. No Vite dev server or terminal command is needed just to open the installed app. Browser downloads in the standalone app go to your `~/Downloads` folder, while generated intermediate Rust artifacts are stored outside the signed app in `~/Library/Application Support/EXO-Sample-3D-ClothCraft/Output/`.

Rebuild/reinstall after changes with `npm run clothcraft:build-app` (requires Xcode Swift compiler, locally built EXO C++ CLI and ClothCraft Rust binaries). This is a **personal arm64 macOS build** with an ad-hoc local signature, not a notarized or publicly distributed app. Full ClothCraft solver convergence, on-avatar fit and independent industrial file approvals are still unverified.

### Avatar loading and model-switch regression

The personal app builder takes the already-existing user-owned Thomas export from `../garment-studio/public/avatars/clo-thomas.glb` (or `EXO_PERSONAL_AVATAR_ROOT`) and locally created CC0 Theo/Nora GLBs and installs them **only inside this personal `.app`**. These models are not copied into this Git checkout, never staged into a public repository, and must not be redistributed without reviewing applicable rights. `EXO_INCLUDE_PERSONAL_AVATARS=0 npm run clothcraft:build-app` intentionally omits them. Missing optional avatars are visibly disabled rather than silently replaced by a large analytic proxy; MakeHuman remains the available neutral base. Selecting Thomas no longer leaves the wrong oversized/duplicate visual model when the asynchronous GLB loader finishes. All detailed models are normalized to the current project height and previous loads are discarded on rapid switching.

Run `npm run clothcraft:check-avatars` while the installed app is open to check MakeHuman → Thomas → MakeHuman → Theo → Nora and a rapid-switch race. The test verifies that each selected model has exactly one displayed avatar root, correct 1.8 m height at default measurements and no browser page errors. It does not prove that the selected mesh is a physically certified collision body or substitute for live user-visible WebKit QA.

### Experimental Rust VBD + OGC contact path

Open **Fit → ClothCraft Rust · VBD + OGC → Run ClothCraft VBD + OGC Contact** in the personal EXO app. This is a real, opt-in, fixed-step **batch Rust solver** on the EXO garment converted through the existing C++ exporter. It is *not* a drop-in JavaScript contact correction or a substitute for the regular realtime EXO `SIMULATE` button. The Rust executable and upstream MIT `LICENSE` are included in the personal app. Runs execute on two CPU threads and are limited to 1–30 steps, with no concurrent contact trials. The existing editable garment and active EXO simulation remain unchanged.

The runtime loads a body-only, user-owned CLO Thomas collision surface from a **private** OBJ generated at build time from the user's local `native_app/assets/clo-thomas.obj`. MakeHuman uses the CC0 `body` surface from the same OBJ displayed in EXO. Both are normalized to 180 cm in the same frame as their corresponding visible avatar and uniformly scaled to the project height. Thomas hair, shoes and eyes are *not* collision solids. Other avatars (Theo, Nora, arbitrary imported GLBs) are deliberately **not yet supported** by this Rust backend, rather than silently substituting the wrong mannequin; they continue to work in the normal EXO renderer/simulation. No private Thomas geometry is committed to the repository.

The local Rust service endpoint is `POST /contact-simulate` with `{document, avatarModel, steps}`. Each run has a distinct private UUID directory in Application Support, an immutable native fitting-project snapshot, body-only `avatar.obj`, a Rust `run.json`, and actual simulated `solution/cloth.obj`. The response includes measured seam gap, p95 edge extension, closest-feature distance, active contacts, and experimental screening thresholds. A comparison dialog overlays the actual cloth and avatar meshes in one camera. **No result is marked collision-certified or fit-accepted:** OGC assumes no unresolved initial intersections, reports two-sided normal contact, does not implement friction, does not repair arbitrary existing penetrations, and is not a swept continuous collision or factory-fit certificate. Strong contact features cannot repair a garment starting with disconnected distant sleeves. Initial assembly and proper seam closure remain priority work.

Validation on the four-panel EXO tee: Rust VBD+OGC completed with Thomas and MakeHuman for 1 step. A 3-step Thomas trial reported 62 active contacts and 1,349.1 mm maximum seam gap, so **fit remains rejected**. The installed app's end-to-end button test displayed the combined 3D preview and the rejection status without browser errors. Legacy avatar and production checks passed. Rebuild via `npm run clothcraft:build-app` after backend changes and reopen the app.

Clone ClothCraft into `research/oss/clothcraft` (ignored) or set `EXO_CLOTHCRAFT_REPO` to an existing checkout. Install an appropriate Rust toolchain; ClothCraft's README lists Windows as the only locally validated desktop. The EXO CAD exporter needs to be built once:

```sh
python3 -m cmake -S native_cpp -B native_cpp/build-cmake -DGARMENT_BUILD_QT=OFF
python3 -m cmake --build native_cpp/build-cmake --target garment_cad_cli --parallel 2
node integrations/clothcraft/bridge.mjs status
node integrations/clothcraft/bridge.mjs export
node integrations/clothcraft/bridge.mjs validate
node integrations/clothcraft/bridge.mjs bake
node integrations/clothcraft/bridge.mjs simulate --steps 5
node integrations/clothcraft/bridge.mjs prepare
node integrations/clothcraft/bridge.mjs fit --steps 1
```

`export` requires only the EXO C++ CLI; `validate`, `bake` and `simulate` delegate to the actual ClothCraft `cloth-template` Rust executable or `cargo run` with the CPU-only build. Choose a custom garment with `--input path/to/project.json`. The generated candidate template and diagnostic report are under `integrations/clothcraft/output/` (ignored); `--output` chooses another directory. `prepare` creates a ClothCraft fitting project referencing the licensed CC0 mannequin; `fit` attempts a CPU fitting step and records failures; `open` launches the native ClothCraft editor with `cloth-fit --view`. Use `--avatar /path/to/model.obj` if needed. All commands fail visibly if the backend is missing or rejects the data.

## Scope and limitations

The C++ exporter preserves source panel IDs, named seam references, converted quadratic Bézier controls, and basic fabrics/grain parameters. ClothCraft does not automatically receive EXO's notches, production annotations, grading, fasteners, calibrated materials or avatar-specific fittings. The EXO project remains the source of truth. EXO's exported separated panels can have unacceptable initial seam gaps, and existing ClothCraft CPU solver contact/fit remains experimental; do not use any result as factory or body-fit certification. Mac GPU window availability is unverified. See [native ClothCraft compatibility research](../../docs/CLOTHCRAFT_CPP_RUST_INTEROP_2026-10-15.md) and upstream `docs/template-format.md` for format assumptions.

### First real integration check (15 October 2026)

- C++ export parity passed using `node scripts/check-clothcraft-interchange.mjs` (4 panels, 14 seams, 18 curve controls).
- ClothCraft's actual Rust `cloth-template validate` accepted the emitted tee: 2,006 vertices, 3,619 triangles; initial maximum seam gap 1.4842 m.
- Rust `cloth-template bake` created `cloth.obj`, `patterns.svg`, `fibers.json`, `grain-guides.obj` and its template snapshot. The live EXO Production buttons returned a `.json` and `.obj`, and the baked OBJ displayed in the internal interactive preview without page errors.
- Rust reference CPU `cloth-template simulate --steps 5` executed all steps but reported **0 converged steps**, so the process returned an error by design. The final maximum seam gap was 0.1085 m; this is still an unacceptable cloth assembly.
- The experimental `cloth-fit` CPU VBD/OGC path ran one step with 8 contacts, but its maximum seam gap remained 1.3982 m. Neither experiment validates body contact, continuous collision detection, industrial fit or a stable sewn T-shirt.

These fixture measurements are diagnostics at one source revision, not generalized physical or cross-platform performance claims. Improving initial piece placement, seam closure, motion and collision testing is the next real simulation integration milestone.

Upstream contributions should be developed independently against `erythrofr/ClothCraft`, tested under its MIT licensing requirements, and submitted as focused PRs. Neither worktree is automatically merged into the other.
