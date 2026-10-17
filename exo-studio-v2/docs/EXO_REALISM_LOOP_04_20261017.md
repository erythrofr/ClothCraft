# EXO ClothCraft Studio V2 · Realism loop 04

**Status:** installed, signed, reopened, acceptance tests green on October 17, 2026.

## What changed

### Garment pattern viewer

The garment hover remains an honest, source-derived **fixed three-view pattern arrangement**. This is intentionally separate from a sewn 3D garment or a physical simulation. Source paths and sewing references remain authoritative.

- Front/back body panels bow slightly inward through the middle, giving the surface depth without altering their 2D cutlines.
- Sleeve poses now face outward with upright caps and consistent cuffs, rather than flipping one sleeve upside down.
- The previous thin edge-on side view is now an oblique side angle, and the third image is a three-quarter view. All labels and accessibility descriptions match those angles.
- A garment-template-specific source QA checks sleeve symmetry, normals, cuff/cap directions, and inward panel curvature. The source cutlines are not automatically sewn.
- On the installed 1440-pixel and 390-pixel viewer, the Foundation Tee preview has **four source panels displayed in three views, 24 rendered meshes, and 11,229 triangles** with no page exceptions.

**Fidelity limitation:** this is a static, posed template demonstration, not cloth collision or drape over a body; source textile scans, real stitch closure and a more faithful sewn neck/cuff still need deeper work. It does not yet match CLO3D’s fully assembled garment simulation.

### Fabric material viewer

The secondary Material inspector now uses the actual displayed span when setting the fabric-on-ball UV repeat rather than stretching one photographic scan over the whole cloth sphere. Its drape, ball, and 1.8 cm yarn-level macro views now maintain comparable scale. Invalid tile measurements are bounded, changes to the fabric scan, mass or bend invalidate the appropriate preview, discarded generated maps are disposed, and late image load callbacks cannot reapply a previously removed texture.

This improves optical texture reliability. **No physical material test data was measured or inferred from photographs**; visual drape remains illustrative.

### Release safeguards

`scripts/qa-installed-v2-bridge-smoke.mjs` now verifies that the signed V2 app’s Rust bridge on port 5385 is alive and that at least one native 2D pattern appears. It rejects page exceptions, premature WebGL texture uploads, and attempts to connect to the obsolete development ports 5191/5193.

`integrations/clothcraft/macos/build-web-only-v2.sh` now performs that acceptance test after installation and signing. If the test fails, it restores the previous signed web resources automatically. **Rust/Swift binaries and garment projects are never rebuilt or replaced by this release path.**

## Verification

| Check | Result |
| --- | --- |
| Isolated production Vite build | PASS, 1,892 modules |
| Source tee sleeve/curvature/normal QA | PASS |
| Material preview UV, six-channel and disposal QA | PASS |
| Installed 1440 / 390 stage, garment, fabric tests | PASS |
| Stage library | 5 GLB-derived posters, 0 idle tile WebGL canvases |
| Fabric-on-ball | 11,025 vertices, valid WebGL, 0 failed scan assets |
| Installed native Fabric Property Editor | PASS, docked, 400 presets |
| In-app assistant actions | PASS, 13 registered actions |
| Native Rust bridge smoke | PASS, 2 visible pattern panels |
| Code signature | PASS |
| Browser exceptions / image-upload warnings | 0 / 0 |

Installed location: `~/Applications/EXO ClothCraft Studio V2.app`.

Rollback copy: `integrations/clothcraft/output/app-backups/EXO-V2-web-before-fabric-preview-loop04-20261017`.

## Important machine constraint and follow-up

The Mac had approximately **4.9 GB free** immediately after the installed tests, and the EXO backup collection exceeded **1.4 GB**. The original backups and source assets were kept. Future Blender/CLO material-asset imports and native rebuilds should not run until storage is increased; a practical working target is 25 GB free.

Priority for subsequent realism work: source-derived sewn garment surfaces with proper shoulder/armhole junctions, stitched seams and more accurate collar topology, calibration of textile PBR appearance against real swatches, and realistic stage light transport. Static preview geometry must not be mistaken for a verified physical solver.
