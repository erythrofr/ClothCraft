# EXO ClothCraft Studio V2 — native menu routing

2026-10-17. This pass repairs a distinct application-level defect: the CLO-style React menubar and the macOS-native menu dispatched some commands to the *legacy* garment project, even when the visible 3D/2D garment lived in the Rust-backed V2 workspace. A visual button press was not evidence that the visible garment changed.

## Native command contract

`src/core/cloNativeMenuBridge.js` explicitly classifies commands. In `src/App.jsx`, `executeStudioAction` checks the native route first when `engine=clothcraft`; V1 continues using its existing code paths. `src/components/ClothCraftWorkspace.jsx` receives events through the existing `exo-clothcraft-command` listener. All actual garment edits remain Rust revision-guarded, with native history and physical state.

| Menus | V2 result |
| --- | --- |
| File: New / Open | Native T-shirt starting fixture with confirmation / native JSON project file chooser and guarded import |
| File: Save / Export | Native Rust Save / JSON download; not legacy draft save |
| Edit: Undo / Redo / Delete selected | Rust history / confirm native panel removal; does not alter hidden V1 project |
| 3D: Simulate, Reset, Move, Rotate, Fabric Hand, Orbit, Fit camera | Native simulation/placement/view commands |
| 3D: Sewing display, Display: Wireframe, Surface / Strain | Native renderer display state |
| 2D: Select, Points, Split, Curve, Internal line, Notch, Temporary tape, Sew | Switches the actual native 2D board tool and editing mode |
| 2D: Add pattern / Mirror | Native polygon pen / Mirror selected editable panel |

The currently unsupported **persistent** cloth-pin/fastener editing, legacy graphic and material creation, unsupported avatar imports and legacy grid toggle explicitly report limitations in V2. Browsers and workspace layout navigation remain shared UI controls, not claims of Rust production functionality.

## Production considerations

New opens the native `tshirt` fixture after a confirmation, not a blank manufacturing-grade document. Import expects a compatible EXO/ClothCraft JSON document; it does not decode proprietary CLO project files. The native Open control uses a hidden file input in the embedded workspace so no legacy V1 document picker can overwrite the wrong model. `Save` writes the native runtime project; `Export` downloads a JSON copy. Native save/open are not yet a full multi-document Save As/autorecovery solution.

The source map can be checked with `node --input-type=module` imports of `getCloNativeMenuRoute`; live interaction tests and their actual results are recorded separately in `docs/V2_NATIVE_MENU_TOOLBAR_QA_20261017.md` once executed. Keep the tests in a disposable backend directory; never use the user's active saved garment as a fixture.
