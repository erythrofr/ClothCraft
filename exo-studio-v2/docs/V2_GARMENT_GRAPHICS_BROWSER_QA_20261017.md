# V2 garment graphics browser QA — October 17, 2026

## Result: PASS — 6/6 isolated browser checks

Executed `node integrations/clothcraft/qa-v2-garment-graphics-browser-20261017.mjs` with a **disposable Rust workspace** and compiled Vite `preview` frontend on localhost ports 5463/5464. The final run returned `pass: true`, six assertions passed, and `pageerrors: []`. The test did **not** open, edit, or overwrite the user's installed V2 garment project.

| Verified behavior | Result |
| --- | --- |
| Object Browser > Graphic reveals the native controlled editor | PASS |
| SVG artwork upload creates one actual garment graphic overlay (`data-garment-graphic-count=1`) | PASS |
| Graphic horizontal/vertical placement, scale and rotation controls update | PASS |
| 2D pattern panel fills remain neutral white as 3D artwork is added | PASS |
| Page reload restores both artwork and placement from IndexedDB sidecar | PASS |
| Browser has no uncaught JavaScript errors | PASS |

### Evidence

Result JSON: `integrations/clothcraft/output/qa-v2-garment-graphics-U575Xc/results.json`

Screenshots (inspected):

- `integrations/clothcraft/output/qa-v2-garment-graphics-U575Xc/graphics-before-reload.png`
- `integrations/clothcraft/output/qa-v2-garment-graphics-U575Xc/graphics-after-reload.png`

The screenshot shows actual Rust garment and avatar geometry, a selected front T-shirt panel, the native Graphic editor with printed-artwork placement controls, and the separate white 2D pattern panels. The overlay is produced by `src/core/nativeGarmentGraphics.js` from a normalized-UV clone of the native cloth panel mesh, and `src/components/ClothCraftSceneV2.jsx` rebuilds it on garment snapshot/artwork changes. Unit coverage in `scripts/check-garment-graphics.mjs` also passed PNG/JPEG imports, document roundtrip, placement normalization, and invalid input rejection.

### Earlier infrastructure blockers resolved

Initial Vite **development** server tests stalled on `page.goto` amid concurrent builds; those runs did not reach any UI assertions. The final passing test uses the already-compiled static `vite preview` bundle with an isolated Rust workspace request proxy. The test's Playwright range inputs also required canonical numeric values (`0.4`, `0.7` rather than `0.40`, `0.70`); these were test-only corrections.

### Accuracy and persistence limits

This feature is a **visual print/decal** on the physically simulated garment's current triangulated UV surface. It is **not** an authored Rust ink layer, physical screen-print thickness, machine-ready graphic placement, or CLO proprietary graphic implementation. Artwork is saved as a local EXO IndexedDB sidecar under `exo-native-garment-artwork-v1`, separately from Rust project save/exports. An explicit JSON artwork-layout export is available in the editor. Rendering is tied to current UV geometry, but garment fit is not certified; direct 3D texture painting and factory artwork outputs require later implementation. The passing test confirms a loaded graphic overlay count and screenshot; it does not provide quantified print distortion or color fidelity across all materials.
