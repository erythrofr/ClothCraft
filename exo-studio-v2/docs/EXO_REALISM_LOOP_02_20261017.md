# EXO V2 — second realism iteration (17 October 2026)

## Result

This pass was installed as a **web-assets-only update** to the signed local
`~/Applications/EXO ClothCraft Studio V2.app`. The existing Swift executable,
Rust session binary, native fabric physics state and user project files were
not overwritten. The full native installer had correctly refused to package
because its in-repository copy of `exo-session.rs` differed from the native
checkout. The web-only release script avoids touching that conflict:
`integrations/clothcraft/macos/build-web-only-v2.sh`.

The prior installed web resources were backed up to
`integrations/clothcraft/output/app-backups/EXO-V2-web-before-realism-20261017`
before replacement. The new bundle was built in an independent staging folder,
validated for its stage GLBs, fabric scans, 3D avatars, material-preview UI and
the installed 5385 bridge URL, then signed and verified. EXO V2 was reopened
after signing.

## Stage quality

Four originally authored EXO Blender rooms were enhanced non-destructively.
The source work is in `docs/stage-refined-blender-sources`; the selected
runtime assets retain the established IDs:

| Room | New meshes | New polygons | Embedded images |
| --- | ---: | ---: | ---: |
| R02 Mountain Runway | 96 | 6,344 | 6 |
| R03 Mirror Stage | 108 | 5,288 | 5 |
| S01 Botanical Studio | 68 | 3,486 | 5 |
| S10 Garden Entrance | 65 | 3,468 | 6 |

The architectural pass added bevels, metal/stone/wood/plaster material detail,
trim and fixtures and associated UV/PBR images. The fifth featured room,
MIKRISTIAN Cathedral House, retains its existing 226-mesh GLB. These are
actual GLTF meshes, **not thumbnail impostors**. They remain stylized
architectural scenes, not certified photorealistic scans.

## Garment previews

`GarmentLibraryPreview.jsx` now uses real template cutlines and seam
references, tessellated shallow curved surfaces, softened textile-style
shading, more coherent stitch appearance and direct orbit controls. It
improves inspection of pattern assemblies but **does not replace a simulated
closed sewn garment**. The real garment viewport and Rust cloth simulation
were left unchanged.

## Fabric specimen on ball

`src/core/fabricBallGeometry.js` uses an editable visual square cloth sheet
over a rounded dome rather than revolving a uniform cylinder. Corners hang
farther than edge centers. Preset bend and GSM affect the *estimated visual*
folds, not measured cloth physics. Each visual mesh has 11,025 vertices and
21,632 triangles. The preview uses repeat-scaled fabric maps, has an enlarged
scan texture detail inset, and the library now shows flat swatch and draped
ball side by side.

The renderer's internal support sphere was moved inside the generated cloth
to avoid patches of hard gray support visible through the fabric. A separate
headless geometry regression rejects nonfinite coordinates, support
intersection, incorrect UV/vertex counts and the loss of deeper square
corners; it checks both rigid denim (390 GSM) and silk twill (95 GSM).
**Appearance is illustrative until fabric specimens are physically tested.**

## Installed-app acceptance

- Signed EXO V2 application and native 5385 health endpoint: **PASS**
- Five GLB stage thumbnails and selected R02 viewport at 1440 and 390:
  **PASS**, actual mesh counts 226/96/108/68/65, zero page exceptions
- Fabric-ball + 400 presets + 2 editable SVG patterns / no automatic seams:
  **PASS**
- 13 verified in-app assistant action definitions and QA: **PASS**
- Docked native fabric inspector and scrolling 400-preset list: **PASS**
- Full library stage mesh manifest: **15 ready GLBs; five unfinished hidden**
- Rust session source merge/rebuild: **NOT performed**, because divergent
  concurrent session work requires a separate merge and native regression.

One later console diagnostic showed several Three.js
`Texture marked for update but no image data found` messages while the
material-preview textures were loading. Browser tests reported zero page
exceptions and verified the visible scanned swatch/ball, but texture
streaming should be audited further before claiming full material parity.

## Next measurable fidelity gates

For actual CLO3D-level quality, use physically tested specimen data (areal
mass, thickness, warp/weft/bias stress curves and bending measurements),
matching texture capture and scene lighting, calibrated garment body
collisions and a closed sewn shell. Compare screenshots under identical
focal length, lighting, color management and material tile size. Do not
equate mesh count, visual wrinkles, or source images with calibrated fit.
