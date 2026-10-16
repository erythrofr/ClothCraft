# Garment Studio — Claude Code project guide

This folder is the **live source repository** for Garment Studio, a CLO3D-inspired garment CAD and manufacturing application. You may read and edit its source, run tests, and propose incremental improvements when requested. Work on this exact folder; do not make a separate clone or silently replace the project with a generated starter app.

## Working rules

- Preserve existing uncommitted changes and user files. **Never** use `git reset --hard`, `git clean -fd`, mass deletions, or wholesale rewrites. Check `git status --short` before editing.
- Prefer small, reviewable changes with focused tests. Do not overwrite a file that another agent is actively modifying; coordinate first.
- Do not claim CLO3D parity or production-ready simulation unless an end-to-end test proves it. Report precise successes and failures.
- Do not launch long-running simulation, GPU jobs, browser farms, or native rebuilds unless asked. Do not kill unknown processes or modify unrelated projects.
- Never commit API keys, personal data, licensed avatar binaries, or generated caches.

## Codebase orientation

- `src/App.jsx` — main React application and editing actions.
- `src/components/PatternEditor.jsx` — 2D pattern editor.
- `src/components/GarmentViewport.jsx` — 3D scene and mesh inspector.
- `src/components/CloUI.jsx` — CLO-inspired Object Browser and library UI.
- `src/core/` — pattern geometry, DXF, grading, marker, manufacturing, and backends.
- `native_backend/`, `ppf_backend/`, `blender_bridge/` — native and Blender physics/geometry integration. Preserve existing research and solver assets.
- `native_app/` — macOS application wrapper and build scripts.
- `docs/` — architecture, audits, research, and known gaps.
- `scripts/` — reproducible engineering and QA checks.

## Checks

- `npm run build` — production Vite build.
- `npm run check:non-simulation` — DXF, manufacturing, markers, and mesh-selection checks.
- `node scripts/check-dxf-construction-fidelity.mjs` — geometry/metadata DXF round trip.
- Other focused `npm run check:*` commands are listed in `package.json`.

## Collaboration with other AI coding agents

This repository is also edited by other assistants. Start each task by inspecting current source and `git status`, and avoid assuming any previous summary is current. Make an explicit plan for cross-cutting changes. Always describe changed files, tests, remaining limitations, and whether a native app was actually rebuilt. Prefer the user's currently open Garment Studio project over creating unrelated samples.

### Current Jarvis worker architecture handoff (October 14, 2026)

The user chose a **hybrid C++/Qt6 desktop + native C++ CAD document + original Rust ZOZO PPF Contact Solver** architecture, not a whole-application Rust rewrite. Read `docs/JARVIS_WORKER_HANDOFF_CPP_RUST_PPF_2026-10-14.md` before continuing native work. `native_cpp/` has compiled/tests-passing CAD and PPF preflight code, but the native Qt GUI is unbuilt because the full C++ Qt6 SDK is absent; do not claim it is installed. The current Thomas shirt still fails the 3 cm PPF preassembly gate (18.742 cm worst stitched gap), so physical fitting is not finished. Preserve original projects, working Swift/WebKit app and upstream Rust solver, and use a tested C++↔Rust/native service boundary.

**Follow-up Rust PPF contact study:** `docs/PPF_UPSTREAM_PIN_MOTION_FORENSICS_2026-10-14.md` analyzes Jarvis's 240-frame upstream benchmark. All failing frames coincide with pinned-body animation segment boundaries. In a separate 96-frame Metal reference run with upstream-supported **smooth** (rather than linear) body interpolation, frame-87 crossings dropped **2 → 0**, and frame-90 crossings dropped **492 → 4** (independently validated in Blender). Native output completed although the Python experiment wrapper reported a timeout race; `scripts/check-ppf-pin-policy-ab.mjs` verifies this without rewriting the original report. **Four intersections remain and swept CCD is not certified.** Do not silently enable smooth interpolation for production or mark the garment fitted; isolate those residual crossings and test beyond frame 174 before deciding on a solver policy.

**New exporter/solver fidelity diagnosis:** Read `docs/PPF_EXPORTED_FRAME_INTERPOLATION_DIAGNOSIS_2026-10-14.md`. The installed PPF Rust code *checks committed solver poses*, but its video writer linearly interpolates free cloth between steps and independently evaluates prescribed pinned body at the exact output timestamp. At original frame 90, the exported free cloth was interpolated with alpha **0.542**; with smooth pins alpha **0.565**. No internal `### intersection detected` was logged in either native run, yet the exported frames independently showed 492 and 4 body crossings. Dense checks of **interpolated playback geometry** between exported frames 92–93 found **17** (linear) and **11** (smooth) crossing pairs, even though the 60fps endpoints were clear. That sampling is *not* actual solver substeps or swept CCD. Treat output interpolation as a high-priority **hypothesis**, not proven sole cause: capture actual committed-step vertices and compare before changing the native Rust solver or releasing validated previews. `node scripts/check-ppf-export-interpolation-regression.mjs` passes. Never repair these errors by visual snapping or by disabling contact checks.

**Latest smooth-body multi-run reproducibility (October 14, 2026):** Read `docs/PPF_METAL_REPEATABILITY_AND_SMOOTH180_RESULTS_2026-10-14.md`. Three *actual completed* Rust/Metal smooth runs were audited: smooth-96 A has **four frame-90 crossings**, same-input/same-parameters smooth-96 B has **four frame-95 crossings**, and smooth-180 C has **two frame-138 crossings**. Frame 138 is another pinned-body keyframe boundary. Blender independently confirmed the strict crossings. The two independent 96-frame runs consumed **all 132 byte-identical solver binary inputs**, identical simulation params, and identical dynamic scheduling, yet their saved cloth geometry diverged starting frame 1 (up to **12.566 mm** peak through frame 96). The installed Rust source also acknowledges run-to-run nondeterminism. Smooth-180 C still preserves reference material strain (max principal 1.097546 vs 1.10 bound) and final seam closure (mean 0.1145 cm, max 0.6151 cm), **but NONE of the smooth runs is physically accepted**, and this reference dress is not Thomas's shirt. Regression: `node scripts/check-ppf-multirun-robustness.mjs` and `node scripts/check-ppf-smooth180-materials.mjs`. Next priority: trace **actual committed-step geometry vs interpolated output** and the first-step numerical divergence in an isolated Rust build; do not replace the production solver with a guessed fix or dilute the QA gate.

### CLO3D parity research workflow (replica-skill and REA)

Read `docs/REPLICA_SKILL_REA_INTEGRATION_2026-10-14.md` and
`replica/README.md` before claiming any new 1:1 parity milestone.
`replica/features.csv` lists sourced functional comparison obligations;
`npm run check:clo-parity` regenerates the selected-feature snapshot and
`npm run check:clo-parity-ci` verifies it. Update only with real implementation
and matching regression evidence. Do not confuse the selected-feature score
with full product completeness or a visually measured 1:1 estimate.

MIT-licensed `replica-skill` utilities are vendor-noticed under
`scripts/vendor/replica-skill/`. REA v6.5.0 was run via scoped CLI to inspect
**our own bundled JavaScript**; the compact audit is in
`replica/evidence/rea-own-garment-js-2026-10-14.json`. REA's static graph
claims partial coverage, not confirmed runtime or native solver function.
No REA global MCP registration, source cloning of CLO3D or redistribution
of private vendor graphics should be performed without separate review.
