# PPF T-pose arm collider correction, October 13 2026

## Root-cause geometry fix

`blender_bridge/ppf_prepare_scene.py` previously created each avatar arm as a vertically elongated ellipsoid `(armRadius, armRadius, 0.36*height)` although the target pose is T-shaped. The actual collision body therefore contained two vertical poles, not arms. The corrected collider is elongated along X: `(0.36*height, armRadius, armRadius)`. `scene.avatarArmAxis: 'vertical'` remains available for legacy A/B reproduction; the anatomically correct horizontal version is now the default.

## Native Metal 10-frame A/B results

| Metric | Old vertical arm proxy | Correct horizontal arm proxy |
|---|---:|---:|
| Initial body triangle crossings | 0 | 0 |
| First body crossing frame | 3 | 4 |
| Peak body triangle crossings | 502 | 127 |
| Final body triangle crossings | 502 | 117 |
| Peak non-adjacent cloth crossings | 8 | 64 |
| Final non-adjacent cloth crossings | 0 | 44 |
| Final mean seam gap | Earlier result | **0.112 cm** |
| Seam gap closure | Earlier result | **99.65%** |

The body-crossing peak improved approximately 75%, but **self-intersection regressed** and neither run is collision-free. This is an experimental physical improvement, not a production-grade finished drape. The previous vertical-arm experiment remains reproducible by setting `scene.avatarArmAxis` to `vertical` in the PPF payload.

## Saved artifacts

- `blender_bridge/output/tee-ppf-horizontal-arms-experiment.blend`
- `blender_bridge/output/tee-ppf-horizontal-arms-solved.blend`
- `blender_bridge/output/tee-ppf-horizontal-arms-report.json`
- `blender_bridge/output/tee-ppf-horizontal-arms-sewing.json`
- `blender_bridge/output/tee-ppf-horizontal-arms-contact.json`

Next: address the new fabric self-collision concentration in sleeves/armholes. Investigate actual pattern boundary lengths, stitching order and separate piece cross-stitches before treating the 99.65% seam closure as success. Keep all-frame contact acceptance mandatory.
