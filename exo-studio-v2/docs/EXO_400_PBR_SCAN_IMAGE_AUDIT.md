# EXO 400 — local PBR scan image audit

**Scope:** 67 locally installed CC0 scan sets under `public/fabric-scans/` and `public/fabric-scans-ambientcg/`; 201 original JPEG maps (67 color, 67 normal, 67 roughness). This checks optical image properties only. It does **not** calibrate fabric physics or test the WebGL material renderer. This sample cannot establish scanner color calibration, physically correct reflectance, roughness, or normal-map orientation.

**Overall grade: B / usable with targeted review.** All 67 complete sets are present. The 201 JPEGs have traceable full-file SHA256 digests and per-image normalized RGB statistics in `docs/reports/EXO_400_SCAN_IMAGE_METRICS.json`. There are no maps flagged for an extreme cross-edge tile mismatch under the deliberately conservative heuristic; this does not prove seamless repeat tiling. No image is deemed objectively invalid by this automated pass.

## Priority for renderer / material integration

1. **P1 — validate eight ambientCG normals in the shader** (`Fabric032`, `Fabric034`, `Fabric036`, `Fabric061`, `Fabric062`, `Fabric066`, `Fabric077`, `Fabric082A`). Their thumbnail-derived mean lengths after RGB→[-1,1] decoding are approximately **0.69–0.85** rather than 1. This can be caused by encoding/channel conventions, softened JPEG data or resampling, and need not be defective. Check orientation and shading using a directional light and normalize decoded vectors where appropriate. Preserve source hashes and originals.
2. **P2 — visually inspect five low-dynamic-range roughness maps:** Poly Haven `bi_stretch`, `crepe_georgette`, `stretch_poplin` and ambientCG `Leather038`, `Leather039`. Measured maximum sampled-channel ranges are approximately **0.024–0.031** on [0,1]. This may be an intentionally uniform finish; check whether gloss variation should be visible at the intended scale. Do not invent roughness contrast in the originals.
3. **P2 — inspect two directional-pattern flags:** `gingham_check/color.jpg` and ambientCG `Fabric019/normal.jpg`. Strong directional column/row averages can arise naturally from a woven plaid or fabric grain. Check expected weave orientation and UV tiling in the render.
4. **P3 — inspect near-flat assets only where a material looks implausibly uniform.** **76 maps** trip the maximum-channel RGB standard-deviation threshold below 0.012: **26 color, 30 normal, 20 roughness**. Near-flat normal and roughness maps can be appropriate. In particular, flat source colors can be appropriate for uniform cloth or serve as simple proxies rather than detailed fabric photography.

These flags overlap. For example, some of the five low-range roughness maps are among the 20 near-flat roughness maps. Treat totals as indicators, not distinct defective images.

## Measurement method and limits

Run `python3 scripts/check-400-scan-optics.py` from the project root. The script reads all source originals, SHA256-hashes their full bytes, decodes each via Pillow, converts to RGB and evaluates a bilinearly resized thumbnail no larger than 256×256 for efficient, repeatable comparison. The JSON records dimensions, full-file byte count, hash, normalized RGB mean/std, grayscale percentiles, opposing-edge pixel differences and their ratios to adjacent-pixel differences, stripe candidate ratios, roughness channel/range estimates, and normal decoded-vector length and blue-channel diagnostics.

JPEG compression, EXIF interpretation, subsampling, source texture direction, channel packing and thumbnail scaling can affect these figures. Opposite-edge differences are a simple first-pass seam indicator, not a proof of repeatability; high-frequency edges or deliberate gradients may require visual inspection of full-size tiled images. Normal length is calculated on a bilinear thumbnail without reconstructing a normal map's intended compression or coordinate basis. Roughness varies with shader, tone mapping and viewing conditions; image range alone is not a measured BRDF. SHA256 is suitable for proving exact file identity across later passes.

## Recommended acceptance pass

Review the eight flagged normals as actual tangent-space shader inputs, first on a neutral planar sample and then on curved garments. Compare positive/negative green-channel interpretation and verify that tangent-space normalization is correct. Examine the five low-contrast roughness maps under grazing illumination; preserve their authored values unless art direction or physical measurement supports edits. Tile the two banding candidates 3×3 at actual intended UV density. Finally, prioritize near-flat **color** maps used for hero fabrics where photographic detail is expected. All related source file paths and SHA256 hashes are available in the report for exact follow-up.

**Reproducibility:** the JSON includes a generation timestamp and complete raw-image digests. This audit used existing disk assets only; no scans were downloaded or modified. Results describe image data, not the optical truth of any physical textile.
