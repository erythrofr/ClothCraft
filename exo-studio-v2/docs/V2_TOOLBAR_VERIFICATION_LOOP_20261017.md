# V2 toolbar verification loop — 2026-10-17

## Observed result

Final isolated browser/Rust run: **16/16 targeted assertions passed, zero browser JavaScript exceptions**. Both native Sew and Polygon commits persisted and their Undo operations restored the original seam/panel counts. The right `Surface / strain view` button also toggled on/off successfully in focused Pattern mode after the palette visibility repair. The earlier intermittent Sew Undo failure was a test race: the native snapshot could show the committed seam while React's request was still busy. The test now waits for the embedded footer's `Rust session ready` status before dispatching Undo. Final run log: `/tmp/exo-toolbar-final-readiness.log`. This is targeted coverage, **not proof that every CLO toolbar feature is implemented**. The test uses a disposable workspace and dedicated ports 5575 and 5576.

## Tested toolbar behavior

| Control | Observation | Result |
|---|---|---|
| Left 3D move, hand/stretch, rotate | Each selects the corresponding embedded native viewport mode | PASS (mode switch only) |
| Left strain map | Renderer switches to strain then back to surface | PASS |
| Right Surface / strain view | Focused Pattern palette button toggles strain on then off on the rendered canvas | PASS |
| Left reset 2D arrangement | Rust receives `edit-batch`, time and particle positions remain unchanged, undo restores layout | PASS |
| Embedded native sewing | Sew mode exposes visible seam-creation panel; Create seam is disabled without two boundary edges | PASS (availability only) |
| Embedded 2D Draw | Draw button enters pen mode | PASS (mode switch only) |
| Right Split, Curve, Measure | SVG 2D board changes `data-native-tool` to requested tool | PASS (mode switch only) |
| Right Fit 3D view | Live renderer increments camera fit counter | PASS |
| Right Mirror | Actual native `Mirror` command creates a panel; undo restores panel count | PASS |
| Native Sew commit | Two distinct unsown 2D edges selected; `data-native-create-seam` commits Rust `Sew` and increases seam count; undo restores count | PASS |
| Native Polygon commit | Three 2D points followed by Close pattern commits Rust `Polygon` and increases panel count; undo restores count | PASS |
| Runtime | No uncaught page exceptions | PASS |

The testing loop initially found false negatives caused by treating React mode switches as HTTP POST operations, reading undo state before native request completion, and comparing normalized project JSON byte for byte (`layout_2d: [0,0]` appears after normalization). These were corrected by checking UI modes, polling for asynchronous undo, and comparing effective panel layouts. The final run passed.

## Inventory and unimplemented scope

The browser script captures every currently visible left toolbar button and focused right toolbar button, with the left buttons' `data-clo-implementation` classification. Full observed labels and classification are in `report.json`. The published reference classification in `docs/V2_TOOLBAR_FUNCTIONAL_REPAIR_20261017.md` counts **13 native**, **9 inspect-only**, and **48 unavailable** CLO-reference actions; those classifications are source capability declarations, not behavioral passes. Full Map can display unavailable positions and clicking their informational affordance is not native authoring.

Still lacking demonstrated end-to-end native authoring: internal lines and corner splits; dragging a 3D garment region; garment/avatar measurement authoring; pin/tack attachment; topstitch, trim, zipper and button attachment; grading; seam allowance; notch creation; 3D surface drawing; textile finishing. Native Sew and Polygon commits and Undo are verified, as is the focused right strain toggle.

## Final additional run evidence

`/tmp/exo-toolbar-final-readiness.log`: **16/16 passed** with zero browser runtime errors. The right strain button was exercised in focused Pattern mode. Native Sew and Polygon each committed and undid successfully. No additional loops required.

## Repeatable command and follow-up

Run `node integrations/clothcraft/qa-v2-toolbar-coverage-20261017.mjs` after building `research/oss/clothcraft/target/debug/exo-session`. Inspect the emitted temporary `report.json`, screenshot and per-check result. A failure sets a nonzero process status. For the next verification pass, automate selecting two genuinely distinct boundary edges, assert that Create seam becomes enabled, commit an actual native `Sew`, then undo; likewise commit Draw geometry and use native snapshot comparisons rather than selected-tool flags. Keep those changes separate from live saved work.
