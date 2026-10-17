# Garment Studio · avatar-derived 2D drafting guides

The former schematic 2D-human SVG has been replaced by front orthographic render
guides sourced from the same installed geometry that drives the 3D avatar viewer.

| Avatar model | Mesh source | Drafting asset |
| --- | --- | --- |
| CLO Thomas | `public/avatars/clo-thomas.glb` | `public/avatars/guides/clo-thomas.png` |
| Theo | `public/avatars/opensew/theo.glb` | `public/avatars/guides/theo.png` |
| Nora | `public/avatars/opensew/nora.glb` | `public/avatars/guides/nora.png` |
| MakeHuman base | `public/avatars/makehuman-base.obj` | `public/avatars/guides/makehuman-base.png` |

The asset stays in world-space behind the editable 2D SVG pattern geometry,
anchored to drafting origin (165,85) and following avatar-model selection and
height adjustment. The source render is neutral gray, transparent, properly
cropped and centered. It cannot intercept click/drag/sewing interaction.
This is the **actual projected mesh outline** of the chosen built-in model,
not a manually drawn generic human icon.

Regeneration:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/render-avatar-guides.py
python3 scripts/normalize-avatar-guides.py
node scripts/qa-avatar-guides.mjs
```

The Thomas GLB is a user-provided locally licensed asset; the generated guide
should not be redistributed without the asset's applicable rights. A user
imported custom OBJ/GLB currently gets a generic fallback contour; a dynamic
projection of arbitrary newly imported meshes is not yet implemented.

**Important:** This front projection is only a drafting visual. It does not
turn the rendered 3D Thomas geometry into the cloth collision mesh. The browser
physics still uses its measurement-derived analytic collider. Exact-body
contact must be independently configured and tested in PPF.
