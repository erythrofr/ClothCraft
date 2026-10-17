# EXO Sample 3D — Developer Setup, API and Validation Guide

> **Version:** Repository inspection on 15 October 2026. EXO Sample 3D is the documentation-facing name of the source tree whose npm package is named `exo-sample-3d`. Commands assume a checkout of this repository; native and PPF execution additionally require local toolchains/runtime dependencies. None of the checks described here certify physical fit or factory readiness.

## Contents
1. [Project checkout and prerequisites](#project-checkout-and-prerequisites)
2. [Browser workstation](#browser-workstation)
3. [Full local environment](#full-local-environment)
4. [HTTP backend interfaces](#http-backend-interfaces)
5. [Native C++ build](#native-c-build)
6. [Qt desktop application](#qt-desktop-application)
7. [Editing a garment safely](#editing-a-garment-safely)
8. [Simulation diagnostics](#simulation-diagnostics)
9. [Materials and graphics](#materials-and-graphics)
10. [Production exports](#production-exports)
11. [Testing and parity](#testing-and-parity)
12. [Debugging playbook](#debugging-playbook)
13. [Contribution and release practices](#contribution-and-release-practices)

## Project checkout and prerequisites

The main application uses Node.js with ES modules, Vite 6, React 19, Three.js, `three-mesh-bvh`, `fflate` and `fast-xml-parser`. Refer to `package.json` and the existing package lock when resolving exact installed versions. The codebase is an actively evolving work tree; running `npm install` or `npm ci` may update local `node_modules` but should not overwrite application source.

```sh
git clone https://github.com/mikristian/exo-sample-3d.git
cd exo-sample-3d
npm ci
npm run dev
```

The public repository path above reflects the current project repository; branch and clone ownership should be verified before pushing. `npm run dev` starts Vite bound to `127.0.0.1`, as configured in `package.json`. Open the address printed by Vite; do not assume a fixed port when another local server already owns the default.

For development, install a Node.js version compatible with the lockfile and Vite requirements, a recent Chrome or Chromium-based browser with WebGL, Git and a C++17 toolchain when working on native modules. macOS local native/PPF service paths require a compatible environment; the build scripts and available binaries should be audited on other platforms instead of assuming macOS paths are portable.

The high-level source entry points are `src/main.jsx`, `src/App.jsx`, `src/components/CloUI.jsx`, `src/components/PatternEditor.jsx` and `src/components/GarmentViewport.jsx`. Editing tools should generally be implemented in the relevant component and a reusable `src/core` function, so the operation can be tested independently of its button or shortcut.

## Browser workstation

`npm run build` runs the production Vite build and writes distributable assets to the configured output directory. `npm run preview` starts the local preview bound to `127.0.0.1`. A passing build verifies module resolution and compilation, not that every interaction or rendering flow works. Use the browser console and manual checks for material maps, WebGL limits, avatar selection and screenshot-specific layouts.

For an authoring workflow, start with `createDefaultProject()` in `src/data/defaultProject.js`, load it in the React workspace and inspect its defined `pieces`, `seams`, `fabrics`, `avatar` and `simulation` fields. Work on a clone when implementing a transformation, increment its revision through `touchProject`, then verify that pattern geometry and subsequent 3D/production projections update together. The project keeps drafting coordinates in centimeters; solver payload adapters own conversion.

The interface's rendered controls include a 2D workspace, 3D viewport, materials, staging/fit areas and manufacturing pages. A realistic development test is to change a pattern point, compare affected seam lengths, render the updated drape and generate a production output from the same revised data. Discrepancies across these consumers indicate an integration or cache invalidation issue.

## Full local environment

The npm scripts define the following primary combinations:

| Command | Intended role | Caveat |
|---|---|---|
| `npm run dev` | Browser editor on loopback | Does not imply native services started |
| `npm run dev:full` | Scripted combined environment (`scripts/dev-full.mjs`) | Inspect process output for actual child services |
| `npm run native:serve` | Local native XPBD service | May build CLI and needs its native toolchain |
| `npm run native:health` | Query native service on default port 5191 | Requires running service |
| `npm run ppf:serve` | PPF orchestrator on default port 5192 | Requires Blender and local PPF runtime for solving |
| `npm run ppf:health` | PPF service health request | Health may indicate unavailable runtime resources |
| `npm run check` | Broad chained build/check suite | Passing is a regression signal, not exhaustive parity |

Environment variables read by `native_backend/server.mjs`: `GS_NATIVE_HOST` (defaults to `127.0.0.1`) and `GS_NATIVE_PORT` (defaults to `5191`). The server's CLI build script is `native_backend/scripts/build_garment_xpbd_cli.sh`, and the expected executable is `native_backend/bin/garment_xpbd_cli`. The service limits frames and request body size; handling of invalid project data should be tested with a known fixture before integrating a new UI client.

Variables read by `ppf_backend/server.mjs`: `GS_PPF_HOST` and `GS_PPF_PORT`, `BLENDER`, `PPF_RUNTIME`, `PPF_MIN_FREE_KB`, `PPF_JOB_PORT_START`. Defaults include a local Blender app and a macOS ARM64 PPF runtime in `research/ppf-local/runtime`. The PPF implementation uses spawned processes, a local job map, storage checks and a single active-job guard. Those checks make it a local experimental service; it is not a hardened internet-facing service.

Keep backend services on loopback for routine development. The native service currently sends permissive CORS response headers and no visible authentication on its local endpoints. Do not expose it on a public network without appropriate service security design and review. The PPF service also returns CORS headers and can launch heavy processes.

## HTTP backend interfaces

The native XPBD service implementation is `native_backend/server.mjs`. It supports:

| Method | Path | Role |
|---|---|---|
| `GET` | `/health` | Check native CLI readiness; may build binary if missing |
| `POST` | `/simulate` | Run garment simulation using `project` body |
| `OPTIONS` | Relevant paths | CORS preflight |

The simulation request expects an authored `project` with a nonempty `pieces` list. Supported request options in the inspected handler include `frames`, `quality`, `clothModel` and `bendingModel`. The response is JSON with `ok: true` and `result` on success; errors include an `error` field and status code. The service clamps frame count to a safe interval, defaulting to 90. It selects a distance cloth model for draft/preview and a strain-triangle model for quality/ultra, with isometric-XPBD bending in quality/ultra.

Example programmatic request, executed from a script running inside the repository so a real project fixture is available:

```js
import { createDefaultProject } from './src/data/defaultProject.js'

const response = await fetch('http://127.0.0.1:5191/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project: createDefaultProject(),
    frames: 10,
    quality: 'draft',
  }),
})
const payload = await response.json()
if (!response.ok || !payload.ok) {
  throw new Error(payload.error || `Native service returned ${response.status}`)
}
console.log(payload.result.request, payload.result.runtimeMs)
```

Do not paste a normalized `buildSimulationRequest` protocol object into `/simulate` without verifying the receiving path: the service currently invokes `buildNativeSimulationPayload(project,...)` on an authored project. There are two different adapters serving different contracts. `src/core/backends/protocol.js` declares `garment-studio.simulation` v1, while `nativePayload.js` constructs the native CLI's solver payload.

The PPF service supports `GET /health`, `POST /jobs`, `GET /jobs` and per-job lookup / preview endpoints in `ppf_backend/server.mjs`. `src/core/backends/ppfPayload.js` builds its expected payload; use `ppf_backend/fitAcceptance.mjs`, `assemblyAcceptance.mjs` and `previewFrames.mjs` to understand result interpretation. A PPF job's `status`, `phase`, `error` and acceptance metrics each answer different questions. A successful transport request does not mean the garment was assembled acceptably.

## Native C++ build

`native_cpp/CMakeLists.txt` requires CMake 3.20+, C++17, LibXml2 and CURL. The `garment_cad_core` static library includes the document, geometry, drafting, export, cloth, avatar and material modules; `garment_cad_cli` is its command-line client. C++ tests are configured through CTest.

```sh
cmake -S native_cpp -B native_cpp/build -DCMAKE_BUILD_TYPE=Debug
cmake --build native_cpp/build --parallel 4
ctest --test-dir native_cpp/build --output-on-failure
```

This produces a build separate from the Vite web bundle. The native source directory includes `native_cpp/vendor/nlohmann/json.hpp`; JSON serves as a migration bridge across rich JS and typed native consumers. Do not mistake a compiled `garment_cad_core` symbol for evidence that React actually invokes that symbol. Native CLI invocation and input JSON format should be inspected in `native_cpp/cli/main.cpp` before scripting an operation.

When changing a C++ implementation originally modeled after JS, first identify the exported JS function and how its callers construct inputs. Build a representative frozen fixture from the authored tee/pants project, run both implementations and compare complete semantic results. Position data should be checked using a published absolute/relative tolerance, but metadata, array sizes, feature flags and serialized values may require exact comparison. For an exporter, also compare byte outputs separately from numerical geometry, because insertion-key order and number formatting may matter to downstream diffs.

## Qt desktop application

Qt is optional and tested by the CMake `find_package(Qt6 6.4 COMPONENTS Widgets QUIET)` branch. With an available compatible Qt6 SDK, the native target is `GarmentStudioQt`, with implementation in `native_cpp/desktop/main.cpp`, `main_window.cpp`, `pattern_canvas.cpp`, `staging_view.cpp` and related headers. A successful CMake configure without Qt can still produce the core and CLI but will not automatically provide the desktop executable.

To verify desktop availability, inspect the CMake configure output and list built targets using `cmake --build native_cpp/build --target help`. Then build `GarmentStudioQt` only if it exists in the configured target list. Run from the actual generated bundle/binary location; macOS `MACOSX_BUNDLE` output layout depends on generator/configuration. Qt feature parity with React needs workflow testing, not just launch success. A minimal meaningful test is creating an editable pattern, saving/reloading it and reproducing its exported geometry through the native core.

## Editing a garment safely

Start by expressing the change as a pure transformation on project geometry. `src/core/project.js` holds essential geometry operations; `src/core/draftingPrecision.js` and `src/core/draftingTopology.js` should supply reusable precision and topology behavior. Changes must preserve piece identity and seam references unless the operation explicitly splits or replaces a piece. If an edge is split, remap seam references and edge-level annotations, then run geometry and sewing tests.

Five authoring invariants deserve explicit attention:

1. Points and quadratic controls remain finite centimeter coordinates.
2. A piece has an ordered, closed, nondegenerate stitch-line contour.
3. A seam references existing piece IDs and valid edge/range selections.
4. Grain direction, allowance, notches and measurement definitions survive edits.
5. The revision updates when canonical source data changes.

The generic simulation request validator does not enforce all these invariants. Production preflight checks additional requirements, and a new drafting tool may need its own geometry-specific validator.

For native changes, `native_cpp/core/garment_document.hpp` exposes `Document::apply(operation, arguments, expectedRevision)` and inverse snapshot transactions. Inspect operation dispatch in `garment_document.cpp`; do not invent unsupported operation names. For undo-aware feature additions, compare the full document before and after forward/reverse operations, not just the rendered piece.

## Simulation diagnostics

The relevant simulation directories are `src/core/physics/`, `src/core/backends/`, `native_backend/src/` and `native_cpp/core/`. Investigation should follow the actual frame:

```text
authored project
    -> normalize and validate
    -> triangulate and initialize particles
    -> build seam and attachment constraints
    -> stage relative to avatar
    -> integrate and solve cloth constraints
    -> project avatar/self contacts
    -> update prior positions and friction state
    -> calculate diagnostics / render or export
```

Where ordering differs across engines, capture checkpoints rather than fitting final numbers. Compare initial positions, seam pairs, intermediate contact corrections, resulting positions, previous positions, contact depth, and analysis fields. A mismatch only in previous positions after one frame may become a large mismatch after the next frame; changing only the final positions would hide the cause.

Use `npm run check:physics`, `npm run check:backend`, `npm run check:native-garment`, `npm run check:native-quality` and focused `scripts/check-native-cpp-*.mjs` checks. There are separate development checks `npm run check:ppf-payload`, `npm run check:ppf-acceptance`, `npm run check:ppf-bridge` and `npm run check:ppf-settings`. Solver results can be affected by the locally installed PPF runtime; record its build/path in test evidence.

## Materials and graphics

Begin with the preset shape in `src/data/defaultProject.js`. The JS fabric and PBR modules are `fabricSurfaceModel.js`, `fabricPbrGenerator.js`, `fabricPbrFileNaming.js` and `textileProcedurals.js`. `FabricMaterialPreview.jsx` and `GarmentViewport.jsx` show how appearance reaches the UI.

The mechanical fields use `gsm`, thickness in meters, fractional warp/weft stretch, bend, friction and damping. The appearance fields include color, normal, roughness, opacity, sheen, anisotropy and centimeter-scale weave. Mechanical and visual changes have different cache effects. If a user changes roughness alone, the cloth should retain particle positions and drape; if a user changes warp stretch, solver state may need recomputation.

For tests, use `npm run check:materials` and `npm run check:fabric-visual` where the appropriate browser dependencies exist. Pixel-level C++ parity requires fixture outputs from the browser generator, attention to byte clamping, interpolation/seed order and normal-channel conventions.

## Production exports

The authored document flows through `src/core/factoryPackage.js`. Its imports identify production submodules: `buildSizeRun`, `gradeProject`, `buildFabricMarkers`, `buildTechPack`, `projectToDxf`, `inspectProduction`, `projectToBomXml`, `markerToPdf`, `markerToSvg`, `buildFabricCostRun`, and `fabricCostRunToCsv`.

Run `npm run check:production`, `npm run check:factory` and `npm run check:production-handoff` for broad JS regressions. DXF round-trip tooling appears in `scripts/dxf-roundtrip-check.mjs` and `scripts/check-dxf-construction-fidelity.mjs`. Specific JSON/DXF/native equivalence checks appear in files named `scripts/check-native-cpp-*.mjs`; inspect current cases and assertions before treating their output as a milestone.

A useful package verification matrix records each output filename, semantic purpose, dimensions/units, whether it was actually included, whether native and JS are byte-equal, and whether an independent target application imported it correctly. JSON exact-content parity may fail solely from field ordering, but a manufacturer's parser can also care about formatting conventions; assess both serialization and semantics.

## Testing and parity

`package.json` exposes a broad `npm run check` chain and many focused commands. For a small change, run the narrow relevant check first, then broaden when there is a justified cross-module risk. For a change to fabric rendering, use `check:materials`; for edge topology, use `check:drafting-topology`; for native protocol code, use `check:backend` and related native tests; for factory output, use production and factory suites.

When reporting a parity result, include:

| Field | Required description |
|---|---|
| Baseline | JS function, exact source revision and fixture |
| Candidate | Native function, build configuration and invoked adapter |
| Input coverage | Tee/pants, sizes, seams, materials, options and frames |
| Geometry result | Exact or max absolute/relative error for vectors |
| Stateful result | Previous positions, velocities, contact history and counts |
| Metadata result | Flags, ranking fields, unit properties, warnings and output shape |
| Serialization result | Bytes, files, hashes, line differences and known causes |
| Exclusions | Unsupported options, environment prerequisites, untested variants |

Never convert an experimental parity result into `fitCertified: true` or `factoryCertified: true` without explicit acceptance conditions being met and independently measured. A broad conversion percentage that mixes export-count inventory, compiled modules and complete end-to-end workflows has little engineering meaning; publish each dimension separately.

## Debugging playbook

If the web UI loads but no 3D garment appears, check the browser console, project data and mesh generation path before changing solver constants. If a visual material edit resets drape, examine `visualOnlyChanges.js` and `liveDrapeTransfer.js`. If seam sections twist, compare edge order, seam reverse settings, and assignment of stitch samples. If contact oscillates, capture both current and previous positions on adjacent frames; inspect damping and friction updates around contact constraints.

If `native:health` fails, start `native:serve`, verify the binary build script and inspect service stderr. If `ppf:health` reports missing runtime, verify `BLENDER`, `PPF_RUNTIME` and available disk space; no amount of browser UI tweaking substitutes for that dependency. If Qt does not build, examine the CMake Qt6 discovery branch and native framework/linker messages. If factory ZIP equality fails, compare file inventory first, then per-file bytes, then source-field order and number formatting.

When diagnosing numerical parity, isolate a smallest representative fixture and keep logs outside source files. Use real tee and pants fixtures to validate broad claims after synthetic unit tests pass. Record every discovered discrepancy as a reproducible assertion or diagnostic, so later refactors cannot silently reintroduce it.

## Contribution and release practices

Keep source code, generated files and local runtime artifacts clearly separated. The presence of locally configured runtime directories, third-party garment references or proprietary avatar material does not grant public redistribution rights. Keep private assets, local secrets, environment-specific executable paths and generated PPF job artifacts out of public commits.

For each substantial feature, a reviewable change should show the user-visible behavior, the core implementation, a focused test or reproducible inspection, and any documented limitation. Update capability notes when a previously experimental module becomes integrated, and include the exact check proving its new status. Avoid declaring complete CLO equivalence, universal collision guarantees or factory validation from one simulation/demo run.

For public presentation, the current README references `screenshots/v16-promo-preview.jpg` and `media/garment-studio-v16-promo.mp4`. Such media demonstrates UI appearance at capture time and should be versioned alongside credible technical notes. Screenshot imagery should depict the actual application build, and videos should identify future capabilities as future work.

Additional references: [System Architecture](EXO_ARCHITECTURE.md), [Feature Atlas](EXO_FEATURE_ATLAS.md), [Garment Data Model](EXO_DATA_MODEL.md), [Existing Backend API](BACKEND_API.md), [Native C++/Qt plan](NATIVE_CPP_QT_REWRITE_PLAN_2026-10-14.md), and [Export parity audit](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md).
