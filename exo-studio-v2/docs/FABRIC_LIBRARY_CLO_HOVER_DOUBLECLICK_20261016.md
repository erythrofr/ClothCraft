# EXO Fabric Library: CLO-inspired hover preview and material application

## Implemented interaction

The left **Library > Fabric** lists 400 EXO presets with search and construction-family filtering. The enlarged dark preview appears after approximately 480 ms of pointer hover and includes the scanned reference photograph, fabric name, estimated mass/thickness, centimeter repeat, available PBR map channels, optical roughness/sheen and provenance. The preview is transient and does not capture pointer events. Keyboard focus can expose the same preview; single-click opens in-list material details.

Double-clicking a fabric applies the material to the **selected pattern piece**. Holding **Shift** while double-clicking applies it to **all garment panels**. The focused row supports Alt+Enter for selected and Shift+Enter for all. The in-row Apply button performs the selected-panel action.

In the EXO draft workspace the action imports or reuses a swatch and updates the pattern's `fabricId`. The assigned garment's Three.js physically based shader uses the selected color/normal/roughness channels and the associated repeat scale.

In the native Rust ClothCraft workspace the action passes the shared catalog ID into the authoritative native workspace, maps its existing `CLOTHCRAFT_FABRICS` record, then executes the real Rust Fabric command for the selected panel (or all panels) with estimated physical properties. This changes the actual persisted native assignment and its rendered visual material; the native preset name can differ from the EXO library display name for the same ID (for example, EXO `Rigid Denim` maps to native `Denim`). The 3D renderer reuses installed CC0 scans where available. Native undo/redo and project save/reopen continue to use the native data model.

## CLO3D reference

- [Fabric Information Preview](https://support.clo3d.com/hc/en-us/articles/360000504327-Fabric-Information-Preview): hover roughly 0.5 seconds to inspect details in the Library.
- [Add & Apply Fabric Style](https://support.clo3d.com/hc/en-us/articles/360047313154-Add-Apply-Fabric-Style): double-click to load a fabric, assign to selected patterns, or drag into the scene. EXO intentionally combines import and assign in the requested double-click workflow.
- [New Library (Beta)](https://support.clo3d.com/hc/en-us/articles/38939105493785-New-Library-Beta): dockable Library and larger preview.

## Accuracy and limits

The library contains 400 material **presets**, with 385 photo-backed appearance configurations referencing **67 distinct CC0 1K scan sets**, and 15 procedural fallback configurations. 400 presets does not mean 400 distinct physically photographed specimens. Some fabric names use related-family surface proxies. Physical values are estimates or third-party reference figures that may not represent an exact specimen. This work does not establish physical or visual parity with CLO3D, especially at thread-level zoom, multiple scattering, measured anisotropy, fabric hand, stretch, or shearing.

Future quality improvements require matched 2K/4K+ real textile photo sets, accurate repeat measurements, neutral color charts, calibrated studio lighting and corresponding warp/weft/bend/shear/friction tests. A texture map alone cannot identify or validate a fabric's measured mechanics.

## Repeatable tests

```sh
npm run build
npm run qa:fabric-sidebar
npm run qa:fabric-hover-apply
npm run qa:fabric-native-doubleclick
npm run qa:fabric-showcase
node scripts/qa-400-fabric-ui.mjs
EXO_FABRIC_QA_LIMIT=24 node integrations/clothcraft/check-v2-fabrics.mjs
```

The native double-click test creates an isolated Rust workspace at a temporary location, updates actual native fabric assignments and verifies shader framebuffer changes. It does not edit the installed user's garment. The installed V2 app can be checked separately through its local read-only browser UI without applying materials to the user's saved project.
