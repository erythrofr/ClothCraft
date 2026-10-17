# EXO universal library hover preview — implementation

The left Library now supplies enlarged, dark, non-blocking contextual previews for **Garment, Avatar, Hanger, Fabric, Hardware and Trims, Material, Stage and Patterns**. Existing 400 fabric previews remain as implemented. A shared `LibraryAssetHover` component attaches to the asset tile itself without changing the tile's click behavior, renders one portal only after a 480 ms hover, clamps the popup inside the viewport, and closes on mouse exit, keyboard Escape, scrolling or resizing.

The Garment category previews the garment silhouette and description. Patterns shows the actual editable 2D pattern templates with pieces and grainline guides. Avatar now lazily displays available local GLB models for CLO Thomas, Theo and Nora and retains a clearly labeled procedural fallback for MakeHuman. Imported avatar meshes are visual references; they are not proof of calibrated fit collision.

The Hanger category contains four editable display choices (sculpted walnut, polished chrome, non-slip velvet and satin-padded). Their hanger bodies and hooks are Three.js geometry with physical materials, displayed in a live WebGL hover preview and on the standard 3D garment viewport when selected. Hangers do **not** exert cloth contact forces or physically carry the simulated garment; they are visual presentation props.

Hardware and Trims has 27 preset assets, with large 3D-rendered PBR thumbnail images of buttons, buttonholes, zippers, snaps, rivets, and buckles/rings. Hover details show dimensions, finishes and construction. Five construction action tiles also have enlarged previews, with icon-only indications for topstitch/binding where dedicated 3D geometry is not yet provided.

Stage includes 20 original procedural Three.js room/runway interpretations plus a **user-owned existing 3D asset**, `MIKRISTIAN_Cathedral_House.glb` (approx. 1.7 MB). The room is actually loaded from local GLB into the standard garment viewer, alongside stylized physically shaded stage variants. Choosing a stage changes visual scene geometry without rebuilding the cloth simulation or modifying pattern dimensions. The 20 other stages are *inspired by public listings*, not copies of third-party CLO CONNECT scene packages; the cathedral geometry is locally sourced. EXO still needs a more complete physically calibrated renderer and matched commercial architectural textures to claim photoreal studio parity.

## Validation

Run:

```sh
npm run build
npm run qa:library-hover
npm run qa:fabric-sidebar
node scripts/qa-hardware-library-inspector.mjs
node scripts/qa-stage-library-3d.mjs
```

The universal test validates eight category popups, dark card styling, media presence and viewport bounds, selection of a hanger resulting in garment scene meshes, and actual GLB stage load (226 meshes in the fixture); it also checks missing local assets and JavaScript errors. Existing cloth physics is unaffected by selecting a visual hanger or stage.

## Known limits

There are still differences between visual previews and physically certified fabrics/hardware. Some category previews are vector template diagrams, and a few hardware construction actions remain symbols. The CLO Thomas hover uses a locally derived approximately 1.2 MB lightweight mesh from the user's 88 MB original GLB. The original full-resolution model remains available for the main avatar editor. The preview LOD preserves its silhouette while simplifying materials and fine features. Full desktop CAD layout remains wider than a 390-pixel viewport even though the Library's internal scroll works on mobile.
