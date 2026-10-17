# EXO CLO7 70-button native construction loop — verified 2026-10-17

## Scope, install and protection

The user asked to continue implementing **real** functionality beyond the completed CLO 7.0.242 toolbar order. This loop modifies EXO ClothCraft Studio **V2** with tested native pattern construction, compiled seam editing and a separately qualified EXO draft hardware authoring surface. The signed app is `~/Applications/EXO ClothCraft Studio V2.app`, served natively on Rust/UI ports 5385/5386; it is not opened as a browser. The V1 worktree remains clean. Disposable QA fixture folders and services were used for all geometry edits, undo, redo and saves; the personal V2 fitting document was not used in destructive QA. Concurrent unrelated modifications in the shared V2 worktree were preserved.

## New genuine Rust tool operations

### 2D Notch (CLO 2D A08)

- `Command::Notch { panel, edge, t, depth_m }` writes a stable, saved, per-edge notch in the **Rust PolygonPattern** (`notches`). `t` is a named-edge fraction 0 < t < 1 of sampled material arclength; depth is in metres. `Command::RemoveNotch` removes a stored marker by its exact saved fractional identifier. The SVG 2D board computes location from real mesh UV boundary samples and renders a short outward line. Click a boundary while **Notch** is selected to insert a 6 mm mark; Option-click near an existing mark to delete it. There is no fake cutout geometry.
- Rust tests cover validation, geometry direction, serde compatibility, stable per-edge data and undo/redo. Node `check-v2-native-markings.mjs` tests an actual compiled Rust process: insert, invalid rejection, two undos/two redos, and a saved JSON template, with unchanged simulated vertex/triangle count.

### 2D Seam Allowance (CLO 2D A09)

- `Command::SeamAllowance { panel, edge, width_m }` saves a per-edge cutting-guide width. Clicking a boundary sets 10 mm; Option-click removes. The SVG displays a dashed outward guide. This is a **construction annotation**, not a joined, self-intersection-repaired cutting polygon, DXF-ready cutting contour or additional simulated cloth. The stitched contour, UV triangulation and physics are unchanged.
- It survives saved JSON and Rust Undo/Redo. The authoring layer validates width between 0 and 500 mm; zero clears. Geometry is compiled before accepting the edit. The native source marks optional maps `serde(default)` for older garment files; unused maps serialize to nothing.

### Existing seam editor (CLO 3D A05, 2D B01)

- Rust session adapter `edit-seam` edits the **actual compiled sewing constraint** for a saved existing seam: reversing the B edge, allowing unequal lengths/easing, and coupling stiffness (1,000–1,000,000 N/m²). Selection stays tied to stable native seam IDs and boundary refs. The operation compiles before recording its transaction, refuses invalid stiffness without revision change and resets the simulated pose on accepted physical changes. Rust Undo/Redo restores/reapplies the previous seam specification.
- `ClothCraftNativeSeamEditor.jsx` appears from **Edit Sewing** in the right-side Sewing workflow, with a seam selector, Reverse/Ease controls, stiffness and Apply. Only an explicit click mutates the Rust fixture. Node `check-v2-native-seam-edit.mjs` tests compiled changes, invalid rejection, Undo/Redo and saved JSON; it passed.

## Five persistent EXO draft construction actions (not Rust physical hardware)

New `src/core/clo7NativeHardwareActions.js` exposes `applyDraftHardwareAction(project, command)` and immutable `constructDraftHardware` for `button`, `buttonhole`, `topstitch`, `zipper`, and `binding`, using existing genuine EXO garment project collections, geometry sampling and BOM consumers. The CLO-style detail panel exposes **Add EXO draft construction (saved, undoable)** for suitable controls only when using EXO's draft editor with an unlocked selected garment piece. It never claims to alter the native Rust physics document in hybrid mode. Existing distinct preset/hardware browser workflows remain. Test `check-v2-hardware-native-actions.mjs` passed all five, including data validation, paths, JSON, factory BOM and history snapshots.

## Verification / current progress

- Exact original CLO7 toolbar row order and labels retained **70/70**: 3D A/B 20/18, 2D A/B 17/15.
- Current truthful registry: **17 native action positions**, **7 inspection-only positions**, **46 missing true native CLO operations**. A CLO operation is only counted as native if the existing Rust action is meaningful; a related draft object, preview or informational button never counts.
- `node integrations/clothcraft/check-clo7-native-capabilities.mjs`: 70 correct typed capability entries.
- `node integrations/clothcraft/qa-v2-clo-toolbar-actions.mjs`: disposable Rust+headless client; all 70 interacted with, polygon created and undone, modes selected, real notch and allowance created from the buttons, native seam editor visible, temporary tape distance and clearing checked, zero JS errors. This is a hidden QA browser fixture, not the user-visible app.
- `node integrations/clothcraft/check-v2-native-markings.mjs`: PASS with native saved notch and allowance + undo/redo and untouched mesh count.
- `node integrations/clothcraft/check-v2-native-seam-edit.mjs`: PASS with native compiled constraint, saved changes, undo/redo and invalid rejection.
- `node integrations/clothcraft/check-v2-hardware-native-actions.mjs`: PASS for all 5 EXO draft types, persisted project and BOM integration.
- `npm run check:non-simulation`: PASS; existing precision drafting, cloth fabric and factory checks unaffected.
- `node integrations/clothcraft/qa-v2-right-inspector.mjs`: PASS with independent contextual dropdowns.
- `npm run clothcraft:build-v2-workspace`: PASS. Codesign deep+strict PASS, `open -a "$HOME/Applications/EXO ClothCraft Studio V2.app"` successful. Installed `node integrations/clothcraft/qa-v2-clo-toolbar-installed.mjs`: 70/70 metadata and names, 17/7/46, readable tooltips and zero errors. App remains a native signed `.app`. V1 git worktree clean.

## Remaining command work (46 of 70)

Full CLO parity is **not** achieved. True native buttons, fasten/undoable buttonhole topology, physical zipper and binding contacts, full topstitch seam physics, steam/press/puckering, re-meshing, graded production POM, motion and complex sewing operations require separately implemented native commands with validated physical or geometry effects. Notch and allowance marking guides are real persisted draft geometry references but are not certified manufacturing cut contours. The hybrid user interface deliberately labels reference-only items and may open implementation details without claiming those CLO functions run.

Further implementation should sequence: (1) joined cutting-contour generation with corner/intersection repair and graded POM, (2) hardware native typed objects with secure path↔surface anchoring, (3) physical button/zipper and binding/tape constraints, (4) real topstitch/steam finishing physics, (5) fit and exporter regression checks per source type. Preserve explicit solver and undo tests before promoting any of the 46 remaining reference positions.
