# EXO 3D library hover preview

Component: `src/components/Library3DAssetPreview.jsx`. CSS is imported automatically.

```jsx
import Library3DAssetPreview, {
  createHanger3D,
  createLibraryStudioStage3D,
} from './components/Library3DAssetPreview.jsx'

<Library3DAssetPreview kind="hanger" variant="wood" height={210} />
<Library3DAssetPreview kind="hanger" variant="chrome" height={210} />
<Library3DAssetPreview kind="hanger" variant="velvet" height={210} />
<Library3DAssetPreview kind="hanger" variant="padded" height={210} />
<Library3DAssetPreview kind="stage" variant="studio" height={210} />
<Library3DAssetPreview kind="stage" variant="concrete" height={210} />
<Library3DAssetPreview kind="stage" variant="dark" height={210} />
<Library3DAssetPreview kind="stage" variant="cathedral" height={210} />
<Library3DAssetPreview kind="avatar" variant="clo-thomas" height={210} />
```

The `category` prop is accepted as an alias for `kind`. `label`, `className`,
`interactive` (pointer rotation; default true), and `height` are optional.
Mount only within the active hover/popover to avoid unnecessary WebGL contexts.
The component renders on pointer movement or size change and does not keep a
continuous frame loop. It releases geometries, materials, GLTF textures,
renderer, and WebGL context on unmount.

For garments in the live Three scene, `createHanger3D('wood')` returns
an independently positionable `THREE.Group`; attach to your viewport scene
and dispose on removal. `createLibraryStudioStage3D('studio')` creates a
full 3D studio room. These are genuine mesh models with PBR materials and lights.

## Model provenance and limits

`public/library-3d/MIKRISTIAN_Cathedral_House.glb` is copied unchanged
from the existing user workspace
`../mikristian-cathedral-house/MIKRISTIAN_Cathedral_House.glb`
(1.7 MB original). No new external asset licence was inferred or claimed.
The GLTFLoader option is the only preview using an imported room asset;
the other stage variants are procedural meshes. The stage floor receives
shadow maps; browser rendering varies with GPU. Avatar preview is a
procedural mannequin for navigation and is not an imported CLO avatar or
accurate anatomical reference. Hardware uses separate existing components.

The preview does not alter persistent garment project geometry, cloth fitting,
collision, stage selection or physics by itself. Parent UI integrates selection.

## Avatar model availability (verified)

The local workspace `../garment-studio/public/avatars` contains source GLBs,
now copied to the exact `public/avatars` paths already referenced in App and
GarmentViewport. The built preview server returned HTTP 200 and
`model/gltf-binary` for all three:

| Variant | Hosted path | Size |
| --- | --- | --- |
| clo-thomas | /avatars/clo-thomas.glb | 92,783,524 bytes |
| theo | /avatars/opensew/theo.glb | 934,156 bytes |
| nora | /avatars/opensew/nora.glb | 934,656 bytes |

All are loaded only after the hover component mounts. A HEAD availability check
precedes GLTFLoader decoding to detect SPA index fallback or absent files. Failed
loads display the procedural stand. Scene resources and WebGL contexts are
disposed when the card unmounts, and cancelled late loads are disposed. Thomas
is a large 88 MiB source; first hover may take longer than the other two and
requires more GPU memory. The `makehuman-base` hover explicitly labels its
procedural display stand; the existing OBJ is not silently presented as a
loaded MakeHuman mesh.

### Lightweight Thomas hover asset

The Thomas hover now loads `/avatars/preview/clo-thomas.glb`, a simplified
real mesh derived from the existing Thomas GLB with trimesh. The original
`/avatars/clo-thomas.glb` (92,783,524 bytes) remains untouched for fitting.
The preview is 1,207,524 bytes (98.7% smaller), with 29,668 faces and a
neutral untextured material. This quick hover LOD retains the silhouette
but does not reproduce the source's detailed photographic materials.
