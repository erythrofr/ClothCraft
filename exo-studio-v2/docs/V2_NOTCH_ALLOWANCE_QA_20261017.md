# EXO ClothCraft V2 — Notch and seam allowance QA (2026-10-17)

## Scope

The native Rust `research/oss/clothcraft/src/authoring.rs` implements `Notch`, `RemoveNotch`, and `SeamAllowance` with per-boundary persistence. `integrations/clothcraft/exo-session.rs` forwards these command kinds. The V2 board's `editConstructionEdge` dispatches `Notch` and `SeamAllowance` on contour clicks, and dispatches their removal or clearing through Option-click. `src/App.jsx` maps native `2d:A08` to `notch` and `2d:A09` to `allowance`; the V2 board renders `data-native-notch` and `data-native-allowance` guides.

## Executed verification

Command: `node integrations/clothcraft/qa-v2-notches-allowances-20261017.mjs`

Result: **PASS**, exit code `0`, compiled native `exo-session` via standalone workspace server. Disposable output was `/var/folders/f5/g84wvtpj3gg2d5_9ngt4yykr0000gn/T/exo-notches-allowances-qa-d094zZ`; panel `front`, boundary `neck-left`. Baseline revision `0`, both markings revision `2`.

The test verifies persisted 6 mm notch, persisted 12 mm seam allowance, invalid fraction rejection without revision increment, two-step Undo/Redo, notch removal, zero-width allowance clearing, Undo of both removals, and native project save retaining the restored markings. Throughout these operations, vertex positions, triangles, velocity arrays, simulation time, sewing links, polygon points, curves, and internal/construction line data are compared with the original snapshot.

The test starts a temporary server on port `5687` with a unique `EXO_CLOTHCRAFT_OUTPUT_DIR`, uses the existing compiled Rust binary, and terminates its server on exit. It never reads or writes the live saved project.

## Limits / next validation

The passing native checks establish actual Rust execution and history persistence. The V2 contour click and SVG rendering were verified by source inspection, **not** by automated end-to-end browser pointer interactions in this file. A browser interaction test should independently click the right toolbar Notch and Seam Allowance actions, click an SVG `[data-2d-edge-hit]` boundary, and assert `data-native-notch` / `data-native-allowance` elements appear and remain after save/reload. This test does not establish production export of markers or manufacturing tolerance accuracy.
