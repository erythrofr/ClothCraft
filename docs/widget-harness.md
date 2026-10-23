# Named-widget UI tests

The editor has a CPU-only egui input harness for repeatable tool tests. It
does not open a native window, capture the screen, move the system mouse,
initialize wgpu or require desktop automation. Graphics libraries still need
to compile and link because the controls belong to the desktop binary.

Run the named scenarios, or the complete editor suite:

```powershell
$env:RAYON_NUM_THREADS = '2'
cargo test --locked -j 2 --bin cloth-fit named_widgets -- --test-threads=2
cargo test --locked -j 2 --bin cloth-fit -- --test-threads=2
```

The code lives in `src/atelier/authoring_smoke/widget_harness.rs`, included
only under `cfg(test)`. Widget annotations are also test-only. There is no
registry or input-driver overhead in the shipped application. Existing
opt-in native GPU smoke scenarios remain separate and unchanged.

## Register and drive a real control

Give the actual egui response a stable semantic name. Do not create a second
button for testing, guess desktop coordinates, or call a model operation in
place of a click. The annotation belongs beside the production widget:

```rust,ignore
let response = ui.button("Apply construction");
#[cfg(test)]
super::authoring_smoke::widget_harness::named(
    ui, &response, "construction.apply",
);
if response.clicked() {
    // The ordinary application callback.
}
```

A scenario supplies its state and a render callback. The callback mounts real
controls and dispatches their returned commands through the ordinary CPU
authoring API. Fixture setup may construct a document directly; the operation
under test must come from the UI event.

```rust,ignore
let mut harness = Harness::new(egui::vec2(500.0, 650.0));
harness.frame(&mut case, &mut draw);
harness.click("construction.mode.1", &mut case, &mut draw)?;
harness.replace_text("construction.value", "100", &mut case, &mut draw)?;
assert!(!case.history.can_undo());
harness.click("construction.apply", &mut case, &mut draw)?;
assert!(case.history.can_undo());
```

Available operations are `frame`, `resize`, `click`, `drag`, `key` and
`replace_text`. Drag uses a relative delta from the named widget and 1–120
movement steps; non-finite or excessively long paths fail before pressing.
Keyboard events require verified focus. Replacing text clicks the named field,
sends Select All and then a text event. It does not write directly into the
field's backing string.

## Failure behavior

- Each render pass replaces the registry. Missing controls cannot reuse an
  old rectangle. Resizing invalidates targets until another frame is rendered.
- Duplicate names, disabled controls, clipped/invisible responses and
  unfocused keyboard targets fail with the frame number, known names and
  action trace. Tests must explicitly reveal or scroll hidden controls before
  clicking them; this version has no automatic reveal operation.
- Clicks use separate press/release frames. A target that changes or vanishes
  during a gesture causes cancellation and pointer release. A failed gesture
  is not a transaction rollback: callbacks may already have changed draft
  state, so discard the fixture or assert the expected cancellation behavior.
- Frames use a fixed 1/60-second clock and disabled UI animation. There are
  no wall-clock sleeps or indefinite retries. Explicit frames after model
  changes make the next input use newly rendered controls.

Names in the first scenarios:

| Name | Control |
| --- | --- |
| `audit.refresh` | Run/refresh sewing audit |
| `audit.seam.<seam-id>.toggle` | Expand a seam's report |
| `audit.seam.<seam-id>.inspect` | Open its sewing draft |
| `construction.mode.0` | Projection mode |
| `construction.mode.1` | Distance mode |
| `construction.mode.2` | Perpendicular mode |
| `construction.value` | Millimetre text input |
| `construction.apply` | Apply the construction |

Names are test protocol keys, not visible labels or saved mesh indices. Scope
repeated controls by authored object ID. Deliberately invalid duplicate IDs
must not silently select the first matching widget.

## Coverage and limits

Harness self-tests exercise successful clicks, text replacement and drags;
missing/duplicate/disabled/clipped targets; stale rectangles after resize or
removal; unfocused input; malformed drag paths; and disappearing targets
during press or immediately before drag release.

The sewing scenario uses the real audit controls and shared sewing-draft
constructor. It checks explicit-only refresh, local easing with equal total
lengths, inspection without document mutation, stale navigation rejection and
a fatal refresh replacing the previous report. The construction scenario
uses the real numeric controls and CPU command dispatcher: invalid text
disables Apply, Enter does not commit, Apply produces a history entry, and
undo restores the document.

These are component integration tests, not a complete headless `Atelier`.
They do not validate native file dialogs, OS clipboard behavior, GPU rendering,
window focus, compositor occlusion or a solver step. Assertions remain the
scenario author's responsibility: successful input delivery alone is not proof
of correct behavior. Add further controls and scenarios within their reviewed
task scopes. Original Rust implementation; no VisionBot or EXO code copied.

Task: [EXO-QA-004](https://github.com/erythrofr/ClothCraft/issues/47).

Validation on 23 October 2026: six named-widget scenarios passed on CPU
(0.01 seconds for the final targeted run, excluding compilation). The complete
editor suite passed 58 tests with one optional preview ignored. Desktop
all-targets Clippy with warnings denied and formatting checks passed. No
native window, GPU workload or desktop automation was used for this slice.
