# EXO V2 — Fabric + CLO CONNECT stage realism loop 05

Date: October 17, 2026. Installed in the signed local EXO ClothCraft Studio V2 Mac app.

## Source-backed fabric changes

- Library hover continues to display one full flat swatch next to the 3D fabric ball. The photographic flat scan and ball use the same EXO dye/wash colorway transform.
- A labelled **WEAVE ~1.8 CM** microscope-style close-up of the real licensed scan is rendered inside the *flat swatch*, not over the 3D ball. The source repeat dimensions are estimates, so the crop dimension is approximate.
- The 3D ball continues to support shared cloth/support orbit, mouse-wheel and keyboard zoom, and selectable soft / raking / daylight setups.
- Removed a useless shadow receiver while WebGL self-shadow maps are intentionally disabled for the open two-sided illustration; the contact cue is a soft ground gradient, reported accurately as such. Avoids sharp black self-shadow triangles.
- The drape remains a visual square textile sheet over a ball. Neither folds nor GSM/thickness/stiffness are physical specimen calibration or a Rust simulated sew result.

## Stage upgrades

The **R03 Mirror Runway** was rebuilt as an authored Blender GLB with wall mirror bays, metal mullions, light strips, doorway treatment, and a modeled runway. Previous 108 meshes / 8 materials -> **130 meshes / 11 materials**, 5 embedded images. The original Blender source remains preserved; refined source: `docs/stage-refined-blender-sources/EXO_STAGE_R03_MIRROR_RUNWAY.blend`. Its exported GLB is about 1.16 MB.

The **S01 Botanical Studio** from the immediately preceding stage pass retains 350 real meshes instead of capsule-shaped greenery and plain cubes. It still lacks the realism of a fully ray-traced interior.

All five actual GLB-powered stage thumbnails were recaptured into `public/stage-posters/` (21–46 KB each). Five 3D preview IDs are preserved: cathedral / R02 / R03 / S01 / S10. Cards use poster images at rest to avoid allocating five WebGL renderers; hover loads the corresponding actual GLB.

## Installed acceptance

- Signed app: `~/Applications/EXO ClothCraft Studio V2.app`; `codesign --verify --deep --strict`: PASS.
- Native Rust health/2D panel: PASS (two Rust panels, zero obsolete development-port requests). No Rust/Swift executable overwritten.
- Native left fabric library: PASS, 400 presets, scrollable. Right fabric property editor: PASS, docked and editable, zero floating legacy widgets.
- Fabric-ball lighting and zoom, denim/silk macro scan, no missing scans or page exceptions: PASS.
- Fabric-ball shared orbit desktop/mobile: PASS, without covering the drape with a miniature swatch.
- Fabric library + SVG pattern import: PASS; SVG cutline import did not invent seams.
- Stage gallery at 390px: PASS; five actual stills, 0 idle card canvases, real GLB hover on demand.
- Production browser QA at 1440/390: PASS, zero page exceptions/texture-upload warnings/missing asset requests.

Installed-release rollback copy: `integrations/clothcraft/output/app-backups/EXO-V2-web-before-macro-r03-studio-20261017`. The release script signed the web-only app and ran its native smoke check before accepting the update.

## Material-quality findings and next gaps

The 400 library entries are not 400 unique verified textile scans. 67 CC0 scan sources are installed, only 44 distinct sources are actively referenced by 385 photo-backed presets, and 15 presets use procedural optical maps. Roughness/normal maps use linear/NoColorSpace; base color uses sRGB. There is no measured and certified garment physics dataset yet.

The updated studio render is still a low-detail authored interactive GLB, not equal to premium CLO CONNECT seller renders. Remaining shortcomings include realistic reflection probes or ray tracing, detailed foliage and furnishings, higher-resolution PBR texture capture, more accurate draped fabric physics, and physically calibrated stage exposure. No third-party paid seller models were copied or represented as owned.

### Disk constraint

After signing and acceptance, the Mac showed roughly **1.4 GB free**. The external `Expansion` disk is **not mounted** under `/Volumes` in this session. Older backups, installed files and original source data are preserved. Stop large imports/rebuilds until at least 25 GB free to avoid corrupting ongoing native and Blender work; move old backups to the external drive only after it is connected and verified.
