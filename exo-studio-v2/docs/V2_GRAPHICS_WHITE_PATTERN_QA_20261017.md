# V2 graphics, white pattern and orientation QA — October 17, 2026

## Scope

New isolated Playwright script: `integrations/clothcraft/qa-v2-graphics-white-pattern-20261017.mjs`. It starts disposable native Rust bridge and Vite servers on `127.0.0.1:5683` and `:5684`, creates a private output workspace, opens one headless Chrome instance and releases its own subprocesses on completion. The user's live saved garment project is not modified.

The browser assertions cover: visible native front panel; Graphic tab and SVG upload; `canvas.dataset.garmentGraphicCount === '1'`; geometry screenshot; X/Y/scale/rotation slider changes; exact white SVG drafting fill `#f7f8f7`; FR/GR active toggles; F/S/C viewBox validity; native fabric preset apply without changing white drafting fills; preservation of artwork and placement through IndexedDB after reload; no uncaught page errors. Screenshots and `results.json` are intended to be saved in each isolated QA output directory. A canvas dataset count measures graphic objects; the screenshot is separately required to assess actual artwork visibility and alignment.

## Run status

**Blocked during service startup; browser assertions were not reached.** The initial attempt was interrupted while starting the disposable services. A subsequent run failed because the first interrupted run left local QA ports occupied; only those two QA listener processes were terminated. The clean retry with the 110-second run deadline reported `QA timed out at stage services`. A port check following the retry confirmed no remaining listeners at `5683` or `5684`. This is an isolated runtime startup failure, **not evidence of a rendering defect or a QA pass**.

The test is syntax-valid (`node --check` passed). No screenshot was produced on the clean retry because the test did not open its browser. The app's graphic count, visible placement, fabric apply, reload persistence and orientation controls therefore remain **unverified by this run**. Existing app code was not modified in this task.

## Next verification

Inspect the native Rust bridge and Vite startup logs and rerun once both disposable ports respond to `/health` and the Vite root. Then review `graphics-canvas-after-upload.png` and before/after reload screenshots for visible print placement. The renderer's native overlay uses the deformed panel mesh geometry and panel UV coordinates; this test must confirm actual displayed geometry independently of the renderer's count attribute.

## Final focused rerun — isolated diagnostics

The one additional isolated run wrote per-process logs (`rust.stdout.log`, `rust.stderr.log`, `vite.stdout.log`, `vite.stderr.log`) and `results.json` into `integrations/clothcraft/output/qa-v2-graphics-white-pattern-ueeBbJ/`. **Both services passed readiness:** Rust `/health` returned success, Vite root returned success, and neither process reported a premature exit (`exitCode: null` during readiness). Rust stdout confirms `personal bridge listening at http://127.0.0.1:5683`; Vite stdout confirms `VITE v6.4.3 ready in 737 ms`. The initial transient `fetch failed` values remain in `lastError` for diagnosis but did not prevent service readiness. Both stderr logs were empty.

**Browser failure:** `locator.waitFor` timed out after 50 seconds at `stage: native-front-pattern`, waiting for `.cc-board [data-panel="front"]` to become visible. No uncaught JavaScript page errors were captured before this assertion (`pageerrors: []`). This may be test setup timing, a template not loaded in the isolated native session, or an application boot/render issue; the current evidence cannot distinguish them. No graphics upload or fabric change was executed, no screenshots were generated, and no rendering or persistence result can be claimed. The isolated runtime was closed and the live saved app/project was not changed. No further runs were made.
