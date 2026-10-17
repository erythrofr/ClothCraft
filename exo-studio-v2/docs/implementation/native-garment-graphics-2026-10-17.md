# Native Garment Graphics — integration and verification

## Wired integration

The shared V2 workspace currently imports `ClothCraftGraphicEditor` in
`src/components/ClothCraftWorkspace.jsx`, passes `graphics={nativeGraphics}` to
`ClothCraftSceneV2`, and mounts the editor into `#cc-native-graphic-editor`.
The Rust snapshot is not modified by graphic placement.

Editor API:

```jsx
<ClothCraftGraphicEditor
  graphics={nativeGraphics}
  onChange={setNativeGraphics}
  panels={snapshot.template.panels}
  panelId={selected?.panel ?? 'front'}
  disabled={busy || playing}
/>
```

The editor accepts SVG, PNG, JPEG and performs a safe SVG subset import before
converting all artwork to local PNG data URLs. It supports panel selection,
front/back/both sides, normalized center, scale, rotation, visibility, removal,
and self-contained JSON layout export/restore.

Scene integration, inside the existing panel-loop after `geometry.uv` exists:

```js
const forPanel = graphics.filter(item => item.panel === panel.id && item.visible !== false)
attachGarmentGraphics(panelMesh, forPanel)
```

`attachGarmentGraphics` adds a front and/or rear render layer with cloned native
UV triangles and vertices. These rendered layers inherit the current Rust panel
shape and deform together on subsequent snapshot rebuilds. Their alpha texture
contains only the artwork, leaving the underlying fabric visible elsewhere.
Normals from the source mesh make printed artwork respond to studio lighting.
Printed graphics are rendered through a separate material. The cloth solver,
fabric physical properties, cutting patterns and seam topology remain unchanged.

Data model: `{id,name,panel,dataUrl,width,height,center:[x,y],scale,rotation,side,visible}`.
`center` is top-left based normalized panel bounds; `scale` is a fraction of
panel UV width; `rotation` uses degrees; `side` is `front`, `back` or `both`.
`serializeGarmentGraphics`/`deserializeGarmentGraphics` accept version 1 JSON.

## Validation

Run `node scripts/qa-native-garment-graphics.mjs`. It runs in a disposable
headless Chrome page, tests SVG sanitization, Illustrator-style SVG class color
rasterization, PNG/JPEG import, JSON round trip, native mesh UV projection,
material lighting mode, disposal, and actual React editor add/change/remove
interactions. This test neither accesses nor saves a user's native project.

`npm run build` also passed on the shared workspace, with Vite's existing large
bundle warning.

## Known limits

Graphics are renderer-side UV artwork. No physical ink, thread, material
displacement, UV seam clipping beyond the existing panel triangle surface, or
solver-attached decal constraints are implemented. The layout JSON is a portable
EXO visual project sidecar, not a print-ready factory file or a UV texture
embedded inside Rust OBJ/GLB export. SVG filters, scripts, linked assets, embedded
images and external fonts are removed for safety; some intricate SVG artwork
will not survive this restricted import with pixel-perfect fidelity.

The workspace currently persists the JSON to `localStorage` per panel list and
garment name. Large photographic PNG data URLs can exceed browser local storage
capacity. In that case, the editor's Export layout JSON action is the manual
backup; Restore layout JSON reimports the saved layout with its embedded images.

Current workspace effect recreates all native panel meshes when the
`graphics` collection changes. If drag performance is insufficient, have the
scene update only its attached graphic children on graphic changes while keeping
fabric material/cloth meshes stable. The helper and editor remain self-contained.
