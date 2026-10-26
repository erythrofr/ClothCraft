# Native appearance acceptance

This harness is a diagnostic candidate for EXO-QA-005, exercised against the
unmerged appearance implementation in PR #128. It does not certify that feature
or alter the solver. Separate opt-in scenarios cover paused appearance history,
live worker continuity, and isolated Save/Open. Their observed results and
remaining visual acceptance limits are recorded below.

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
was tested; `passed` applies only to the selected scenario. Pixel appearance,
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

## Save-path diagnostic

Two follow-up native attempts (`output/appearance-history-20261026-c/` and
`output/appearance-history-20261026-d/`) injected Ctrl+S with and without text
focus. Both exited 1: no Save, no generation increment, no saved fixture.
Inspection found that `documents_ui::document_tick` returns early whenever
`self.smoke` is true, before processing document shortcuts. Therefore neither
attempt establishes a production Save failure or a text-focus bug.

The unsuccessful extension was removed at that stage, retaining the verified
14-phase history/text-ownership probe. Scope amendment #138 subsequently allowed
the isolated document adapter described below, preserving the default smoke
guard and ordinary document behavior. The failed attempts remain diagnostic
evidence, separate from the later successful run.

## Opt-in worker extension

`CLOTHCRAFT_AUTHORING_SCENARIO=appearance-worker` appends six actions to the
paused scenario: start simulation, stage custom optics, Apply, Undo, Redo, stop.
The ordinary appearance scenario remains 14 actions. The extension records
pending state and simulation time when each input is dispatched; Apply and
history require a pending dispatch followed by a later worker state in the same
generation. Waiting for that state does not resend the click and is bounded by
the scenario deadline. Nonfinite state, simulation errors or unexpected playback
state fail acceptance. This is continuity evidence, not a physics benchmark or
proof of collision robustness. The native execution result below applies to
the exact tested revision and public fixture.

The live probe additionally requires the compiled garment Arc identity to remain
unchanged and exact restoration of the expected optical values after Redo.
Generation/time alone would not detect an accidental same-generation model
replacement; merely accepting any nonempty appearance would miss wrong values.
The native result below exercised these checks.

## Isolated document extension

After scope amendment #138, `appearance-documents` enables a separate 20-phase
scenario. Its first 14 phases are the paused history probe. It then enables and
applies optics, sends Ctrl+S, disables and applies default optics, and sends
Ctrl+O to restore the saved appearance. Save/Open use the ordinary application
transactions; only their fixture-path selection and recovery/dialog handling are
adapted. The expected generation increments are checked, and reopening must
restore exact x/v/time and clear document history. Open is deliberately allowed
to replace the compiled model; appearance-only edits must retain its Arc.

The adapter is reachable only in smoke mode with this explicit scenario. It
atomically reserves `appearance-acceptance.clothcraft.json` under the requested
output directory and refuses existing paths. Open only targets that reserved
fixture. The ordinary loader refuses missing avatar assets before its picker
when this explicit scenario is active; no separate preflight/load race exists.
Ordinary documents and other smoke scenarios keep their existing paths.
CPU tests cover output-local reservation, overwrite refusal and missing output
folders. The successful native run below uses this isolated path adapter;
it does not certify interaction with the operating system file picker.


## Native worker and document results — 2026-10-27

Both scenarios ran on revision `e53931da8fd94483e8af601b608327d0f9b0f0fe`
with owner authorization for short GPU-rendered window tests. The solver stayed
on CPU with two threads. The public 40 mm T-shirt had 1,026 vertices and 1,838
triangles. Both processes exited 0 and both reports recorded 20/20 verified
transitions, including the initial paused history and text-focus checks.

| Scenario | Observed result | Local evidence directory |
|---|---|---|
| `appearance-worker` | Apply/Undo/Redo dispatched with a worker request pending; later states advanced, generation stayed 0, model identity stayed unchanged and expected optics were restored. Final simulated time: 0.8 s. | `output/appearance-worker-20261027-a/` |
| `appearance-documents` | Ctrl+S saved the isolated fixture; after disabling optics, Ctrl+O restored the saved appearance and exact paused x/v/time. Generation advanced to 1 on Save and 2 on Open; Open cleared history. | `output/appearance-documents-20261027-a/` |

Each directory contains `authoring.json` and a final `ui.png`. Reproduce with
the command above, substituting the scenario environment variable and a fresh
output directory. The inspected worker capture shows the Fabric controls and
rendered garment. It is not an intermediate color/roughness comparison.

These results establish the tested history, continuity and persistence behavior,
not complete EXO-LOOK-001 acceptance. Shared-material visual coverage, a visual
comparison of different colors/roughness values, native picker interaction and
the text editor's typed-text undo stack remain outside this evidence. The worker
report is not a throughput measurement or proof of collision correctness.


## Paired roughness capture fixtures (native runs pending)

`appearance-matte` ends after the initial Apply (two verified actions).
`appearance-glossy` ends after applying lower roughness (six verified actions).
Both reuse the ordinary state gates and the application's final `ui.png` capture,
so the window closes only through the existing screenshot path. They remain
paused on the same initial geometry. Run each with the same public fixture,
window size and fresh output directory to compare shading without drape changes.

The report identifies `capture_variant` and explicitly limits `passed` to those
short fixture sequences. A captured image is not a visual acceptance result;
inspect both images and their optical values before drawing a conclusion.
These variants do not replace the full history, worker or document scenarios.
No native execution of these new variants has been verified yet.


### Highlight framing

The initial front-view captures at `e3c18ac` passed their state gates but produced
identical 3D viewport pixels. A CPU evaluation of the shader's flat-panel/front
view explains this: roughness 0.8 and 0.0 both round to RGB (188, 191, 195).
This is not evidence that roughness reaches every rendered surface correctly.

The paired capture variants now use the same orthographic view toward
normalize(-0.4, -0.8, 0.6), reflecting the fixed key light about the fixture's
+Z normal. Target, distance and physical geometry are retained. This fixture
assumes the public flat T-shirt; arbitrary panel orientations need another view.
Other scenarios and the normal editor camera are unchanged. CPU validation checks
the light/view half-vector aligns with +Z. New native captures are still required;
the earlier pixel-identical images do not validate this new framing.
