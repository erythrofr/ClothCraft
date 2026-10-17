# EXO CLO7 Native Tool Support Audit

Audit date: 2026-10-16. This is a source-level capability assessment of the **Rust V2 native session**, not a claim that all buttons have been wired through the signed application. The reference inventory is in `src/data/clo7ToolbarOrder.js`. Identifiers are prefixed `3d:` or `2d:` because the observed columns reuse A01 and B01.

## Verification basis

- `integrations/clothcraft/exo-session.rs` provides state-changing `edit`, `step`, `reset`, `pose-panel`, `pull-panel`, `grab`, history and JSON snapshots. The edit dispatcher includes `Polygon`, `MovePoints`, `BoardTransform`, `InternalLine`, `Sew`, `RemoveSeam`, `Fabric`, `CurvePoint`, `Mirror` and related primitives.
- `src/components/ClothCraftWorkspace.jsx` exposes live modes for edit, sewing, pen, internal lines, move/rotate, stretch, viewport display toggles, and the Rust authoring bridge.
- `src/components/ClothCraftSceneV2.jsx` contains the live 3D draped-panel selection and placement/grab interaction.
- `src/components/RightToolPalette.jsx` contains legacy V1 and browser UI actions, some of which are deliberately blocked for native V2. Its action labels alone do **not** establish Rust capability.
- `src/App.jsx` renders the 3D reference columns using the old action entries. The registry is for prime to wire independently and conservatively.

## Policy

`native` means there is an existing V2 interaction that meaningfully changes tool state, authored garment geometry, seam constraints, or simulated cloth state. `inspect` means the corresponding information is currently displayable but the named editing operation is missing; inspection must not be represented as execution of that operation. `unavailable` means keep disabled. Tool switching itself is insufficient proof of implementing a manufacturing operation.

## Verified native subset

| CLO slot | Tool | Actual verified Rust V2 behavior |
| --- | --- | --- |
| `3d:A01` | Simulate | `simulation.toggle` |
| `3d:A02` | Select/Move | `viewport3d.selectMove` |
| `2d:A01` | Transform Pattern | `pattern2d.selectTransform` |
| `2d:A02` | Edit Pattern | `pattern2d.editPoints` |
| `2d:A04` | Polygon | `pattern2d.drawPolygon` |
| `2d:A05` | Internal Polygon/Line | `pattern2d.drawInternalLine` |
| `2d:B03` | Free Sewing | `sewing.freeSew` |

The simulation action needs an open valid session. Pattern editing requires editable panel and appropriate vertex/edge selection; sewing requires compatible boundary ranges. Native placement is an EXO operation, not proof of full CLO selection and gizmo parity.

## Unsupported features and limitations

CLO button hardware, zip fastening, seam tape, PBR texture painting, piping, binding, pressure/steam, topstitch physics, automated grading, true notch and seam allowance tools, avatar measurement authoring, real 3D pen, and hi-resolution garment remeshing lack corresponding V2 session operations. Legacy V1 state updates and visual browser selection are **not** substitutes. The current physics reports no friction and is not fit-certified. No per-slot runtime click-through or signed app smoke test was performed by this worker.

## Wiring guidance

Use `getClo7NativeCapability('3d','A01')` (or `'2d'`) to retrieve a stable capability. Enable editing clicks only for `mode === 'native'` and connect `nativeAction` to the actual V2 workspace command for the selected panel. Display inspection as read-only using `inspectionAction`, clearly identified as inspection. Disable `unavailable` with the registry reason in the tooltip. Do not turn a CLO operation on based solely on the `action` field of the observational inventory. Revalidate through live app interactions before increasing the native count.

**Integration contract:** Keep `getClo7NativeCapability(dimension,position)` and the seven `nativeAction` strings stable for the App and RightPalette consumers. 3D and 2D share local A/B slot numbers; always pass the dimension separately. `inspect` records are display-only and should never dispatch `nativeAction`. The QA script now asserts the exact seven-action mapping so accidental renames fail loudly.

Run `node integrations/clothcraft/check-clo7-native-capabilities.mjs` after modifying the inventory or registry. This checks coverage and constraints; it does not verify a native GUI launch.

## Post-audit implementation update

The first source-only audit above identified seven native routes. The subsequent tested implementation loop extended the same registry to **11 native actions, 9 inspection-only routes, and 50 unavailable native CLO commands**. New native routes include 3D segment/free sewing selection, reset of the 3D arrangement, and 2D segment sewing. Temporary 2D metric tape is inspection-only, not saved production POM. The CLI integration regression and signed installed application smoke both pass. See `docs/EXO_CLO7_BUTTON_FUNCTIONAL_LOOP_20261016.md` for the current full 70-row breakdown. The earlier seven-action table is retained as the historical initial source audit, not the current installed-app count.
