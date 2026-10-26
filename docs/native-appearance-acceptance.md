# Native appearance acceptance

This harness is a diagnostic candidate for EXO-QA-005, exercised against the
unmerged appearance implementation in PR #128. It does not certify that feature
or alter the solver. The current first slice covers paused appearance history;
in-flight worker preservation and save/reopen remain to
be implemented in this scenario.

## Current scenario

The existing `--ui-authoring-smoke` entrypoint selects this scenario when
`CLOTHCRAFT_AUTHORING_SCENARIO=appearance`. Start from a public fixture with no
custom appearance. The scenario selects its first panel's Fabric inspector,
waits for pending work to drain, and records positions, velocities, simulation
time and worker generation. It uses response-derived visible control positions,
not desktop coordinates.

It enables custom appearance, applies it, uses toolbar Undo/Redo, stages and
applies a lower roughness, repeats toolbar history, then sends Ctrl+Z and
Ctrl+Shift+Z through egui input. It then focuses the real fabric-name text field
and sends Ctrl+Z, requiring the field to retain focus and appearance history to
remain unchanged. Finally it disables custom appearance and applies
the legacy default. Every phase requires the expected optical state and exact
preservation of the paused physical state before advancing. Sending a click is
not counted as acceptance. A missing target, incorrect transition or 30-second
deadline writes a failed report. Keyboard modifiers are explicitly released.

`authoring.json` records each verified action, observed optical state,
Undo/Redo availability, generation, pending/playing state, time, application
status and errors. Its `scope` and `remaining_acceptance` fields delimit what
was tested; `passed` applies only to this paused scenario. Pixel appearance,
shared-material visual coverage and full EXO-LOOK-001 acceptance remain separate.
No private garment is required.

## Reproduction

Only run the native command with current owner authorization for GPU use:

```powershell
$env:RAYON_NUM_THREADS = '2'
$env:CLOTHCRAFT_AUTHORING_SCENARIO = 'appearance'
$env:CLOTHCRAFT_SMOKE_SIZE = '1600x980'
cargo run --locked --features desktop -j 2 --bin cloth-fit -- --mesh-mm 40 --steps 0 --threads 2 --ui-authoring-smoke --output output/appearance-history-check
```

Use a fresh output directory for each comparison. Record the source revision
and inspect the JSON report and process exit status. This command renders a
native window; it is not a default CPU test or CI requirement.

The input-driver and named-control tests run on CPU:

```powershell
cargo test --locked --features desktop -j 2 --bin cloth-fit appearance_ -- --test-threads=2
```

CPU input fixtures verify that pointer delivery cannot advance a phase without
a document observation, missing targets cannot produce a click, and keyboard
Undo/Redo reaches egui with the intended modifier state and releases it. They
are not a substitute for running the application scenario.

## Observed local run

The 2026-10-26 native run against appearance candidate
`654fd9d86019180bb9957431492a79bb42e429db` plus this harness completed with
exit code 0 and 12/12 verified transitions. The public 40 mm T-shirt fixture
contained 1,026 vertices and 1,838 triangles. All phases preserved exact paused
positions, velocities, simulation time and worker generation. Roughness moved
from 0.8 to 0.0, and both toolbar and keyboard history restored the expected
values. Five focused CPU tests also passed.

Evidence is generated locally in `output/appearance-history-20261026-a/`:
`authoring.json` contains the state observations and `ui.png` the final window.
The final image shows restored default appearance; it does not establish a
visual comparison of intermediate color or roughness states. The earlier manual
Undo failure was not reproduced by this paused scenario. Its cause remains
unresolved; the remaining acceptance cases above still apply.

The text-field extension adds two phases (14 total). The 12-phase result above
predates that extension and is not evidence that the added phases passed.

The extended native run in `output/appearance-history-20261026-b/` exited 0
with 14/14 verified phases. Both text-focus phases reported
`text_field_focused: true`; Ctrl+Z left committed roughness at 0.0 and preserved
physical state. This verifies suppression of document Undo while the real name
field owns focus; it does not test the text editor's own typed-text undo stack.
Strict desktop Clippy passed after this extension.
