# EXO premium garment hardware: initial procedural library

## Origin and rights

The `d-ring`, `prong-buckle`, and `slide-adjuster` `.glb` meshes and `.png` previews are newly created original procedural models by the EXO project, generated with `scripts/hardware-premium/generate.py`. They contain no third-party downloaded geometry or textures. The project may dedicate these generated assets to CC0 1.0; the script itself remains subject to repository licensing. There is no outside creator to attribute. These assets are illustrative artistic mockups; actual production hardware requires supplier CAD and metrology.

## Asset contract

| Preset ID | Model | Render | Size description |
| --- | --- | --- | --- |
| `d-ring` | `/hardware-premium/d-ring.glb` | `/hardware-premium/d-ring.png` | 25 mm nominal inner width, 4 mm nominal round wire |
| `prong-buckle` | `/hardware-premium/prong-buckle.glb` | `/hardware-premium/prong-buckle.png` | 43 × 40 mm nominal outer envelope, rounded frame with raised prong |
| `slide-adjuster` | `/hardware-premium/slide-adjuster.glb` | `/hardware-premium/slide-adjuster.png` | 31 × 20 mm nominal frame, central friction bar |

Existing preset IDs and public `/hardware-thumbnails/` paths are preserved. On the three targeted records, optional `modelAsset`, `previewImage`, `assetOrigin`, `assetLicense`, and `previewMethod` provide integration metadata. GLBs contain only hardware meshes, with local origin at hardware centre; geometry uses metres, aligned primarily in the XY plane and suitable for scale conversion at placement time. Renders are premium studio presentation images, not physically simulated cloth contact, galvanic finish measurement, certified performance, or vendor provenance.

## Regeneration

Run `/Applications/Blender.app/Contents/MacOS/Blender -b -t 2 --python scripts/hardware-premium/generate.py` from repository root. It overwrites only the three files of each type inside `public/hardware-premium`.

Final visual quality pass: the single-prong buckle has a top-centre hinge barrel intersecting its frame and a tongue extending towards the opposing rail. Studio lights were reduced, metallic roughness increased, and AgX exposure lowered by 0.65 stop while maintaining softbox highlights. The three rendered PNGs are 768 × 768; all three GLBs were successfully parsed and measured with `trimesh`. Reviewed `contact-sheet.jpg` after regeneration. Geometry remains illustrative; the hinged geometry is static and does not include rotational joints or physical fastener simulation.

## Integration requirement

`HardwareLibrary.jsx` now uses `preset.previewImage` when available for static library tiles, falling back to the legacy thumbnails for untouched presets. On hover, `PremiumHardware3DPreview.jsx` loads the real `preset.modelAsset` GLB and supports drag-to-rotate, with a studio image fallback if the 3D renderer cannot load. Only the selected hover creates a WebGL canvas. This is a visual asset integration; it does not yet place the buckle on fabric or add fastener joints, material collision, stitching constraints, or supplier production certifications.
