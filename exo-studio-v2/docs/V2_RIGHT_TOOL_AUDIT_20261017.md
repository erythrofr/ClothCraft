# V2 right 2D toolbar audit — 17 October 2026

Scope: `src/components/RightToolPalette.jsx`. The authoritative CLO positions are `src/data/clo7ToolbarOrder.js`; the native capability classification is `src/core/clo7NativeToolCapabilities.js`. This audit does not certify CLO feature parity.

## Working native drafting routes

| Slot | Function | Route from the right palette | Expected native result |
| --- | --- | --- | --- |
| A01 | Transform Pattern | `onCloTool(A01,'2d')` | Select or move panel placement |
| A02 | Edit Pattern | `onCloTool(A02,'2d')` | Edit native points |
| A04 | Polygon | `onCloTool(A04,'2d')` | Create native geometry |
| A05 | Internal Polygon/Line | `onCloTool(A05,'2d')` | Author internal line |
| A08 | Notch | `onCloTool(A08,'2d')` | Set persistent 6 mm boundary notch; Option-click removal |
| A09 | Seam Allowance | `onCloTool(A09,'2d')` | Set persistent 10 mm per-edge cutting guide; Option-click clears |
| B01 | Edit Sewing | `onCloTool(B01,'2d')` | Open native existing-seam editing mode |
| B02/B03 | Sewing | `onCloTool(B02/B03,'2d')` | Enter native sewing mode |

`Notch` and `Seam Allowance` are now accessible in focused Pattern mode and in the CLO-ordered full strip. Both routes are available in EXO extras only where not duplicated in the native reference strip. Their explanatory tooltips describe persistent Rust marking behavior instead of claiming a cut notch or a change to mesh topology.

`Split` and `Curve` remain in EXO-focused tools as existing 2D selection events. They are intentionally not promoted to otherwise unsupported CLO reference positions. Their full workflow and native Undo should be checked by the prime against the board drawing logic. The 2D `reset` action invokes `onReset2d` (the supplied Rust `reset-2d` callback); the independent bottom `RESET 3D` invokes `resetSimulation` (the supplied Rust `reset`). This distinction avoids accidentally resetting the 3D pose while requesting a flat layout reset.

## Controls that should not claim native authoring

Reference slots classified `inspect` open details or related views. Slots classified `unavailable` open explanatory detail only when `onCloTool` exists and remain marked non-operational for accessibility. EXO `pin` and `fastener` extras are disabled in native V2; the additional Seam Allowance control is disabled outside the native editor because no legacy handler exists. Nonexistent actions remain disabled. Supported statuses on reference buttons are computed from the native capability map rather than CLO icon similarities or stale `slot.action` values.

## Integration contract

`App.jsx` already passes `onCloTool={activateCloTool}`, `onReset2d`, and `resetSimulation`, so this pass requires **no new App or Board props**. `activateCloTool` currently switches `pattern2d.placeNotch` to the `notch` board tool and `pattern2d.setSeamAllowanceGuide` to `allowance`, via `exo-clothcraft-select-2d-tool`. The 2D board must continue handling pointer placement, Option-click removal, native commit and Undo. That behavior is outside this worker's file ownership.

## Validation limits

The build validates JSX integration and imports. A successful build alone does not prove Rust geometry mutation or Undo; those require separate native session/board integration tests with `EXO_CLOTHCRAFT_OUTPUT_DIR` set to a temporary folder, without opening or modifying the user's live project.
