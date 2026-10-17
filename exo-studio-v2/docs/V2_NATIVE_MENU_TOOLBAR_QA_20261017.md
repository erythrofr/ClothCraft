# Native V2 menu and right toolbar QA — 2026-10-17

## Isolation

Run `node integrations/clothcraft/qa-v2-native-menu-toolbar-20261017.mjs`. The test creates a temporary Rust output workspace, launches one isolated localhost Rust server and Vite instance on a unique port pair, and opens one headless Chrome browser. It does not use the live EXO project. Its JSON output records every assertion, captured native operations, native request errors and browser JS errors; non-passing runs exit 1.

## Observed browser result

Latest run after the native workspace contention fix: output `/var/folders/f5/g84wvtpj3gg2d5_9ngt4yykr0000gn/T/exo-menu-toolbar-qa-p8cX4L/report.json`, ports 26718/26719, exit **0**, **16/16 PASS**.

**PASS:** native menu `2d.notch`, `2d.curve`, `2d.internal`, `3d.move`, `3d.rotate`, `3d.camera`; `file.open` clicks the hidden native import input; `file.save` produces a native `/workspace` save request; Cmd+S from right sidebar also produces native save; right palette notch and seam allowance selection; 2D toolbar returns to edit mode; SVG arclength contour clicks persist native notch and seam allowance with visible markers, preserved drape and triangles; native menu Undo and Redo restore allowance history; zero uncaught browser JS errors. The captured final Rust operation sequence includes `Notch`, `SeamAllowance`, `undo`, and `redo`. `nativeErrors: []`, `jsErrors: []`.

**FAIL:** None in the latest run.

Earlier runs identified a real race: 3D-to-2D mode changes triggered redundant `grab:null` and `pause` requests and the first Notch/Undo could return `Workspace busy; wait for the current operation`. The prime fixed native workspace mode effects and serialized edits; the latest rerun emitted no rejected native requests. The QA also switched contour hit testing from endpoint averaging to sampled SVG arclength midpoint and waits for native readiness before asserting rendering/history.

## Follow-up

The Rust marking authoring lifecycle independently passed in `qa-v2-notches-allowances-20261017.mjs`. The browser QA now verifies actual pointer clicks and their visible/serialized effects with history restoration. The hidden file picker is tested for click invocation, not a file import transaction; 3D camera/transform commands are checked through live UI mode and fit state, not a simulated multi-frame garment movement.
