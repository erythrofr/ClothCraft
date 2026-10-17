# T-shirt sleeve orientation: completed Metal A/B comparison

Three independent 10-frame PPF Metal solves were audited against every garment triangle and every static avatar collider. All began with zero detected crossings. Results:

| Staging variant | Peak avatar crossings | Final avatar crossings | Peak cloth crossings | Final cloth crossings | Seam closure |
|---|---:|---:|---:|---:|---:|
| Both sleeves as originally staged | 127 | 117 | 64 | 44 | 99.65% |
| Right sleeve depth reversed | 141 | 128 | **10** | **7** | **99.77%** |
| Both sleeve depths reversed | 134 | 121 | 22 | 20 | 99.62% |

**Selection:** right-sleeve-only is the best experimental candidate for self-collision and sewing quality, not yet a validated collision-free solution. Reversing both sleeves is a regression relative to right-only. No variant should be marked physically safe; the arm colliders still intersect the cloth in the final frame.

For reproducibility:

- Right-only source `blender_bridge/fixtures/tee-ppf-mirrored-right-experiment.json`; solved scene `blender_bridge/output/tee-ppf-mirrored-right-solved.blend`; audits `tee-ppf-mirrored-right-contact.json` and `tee-ppf-mirrored-right-sewing.json` in `blender_bridge/output/`.
- Both-sleeves source `blender_bridge/fixtures/tee-ppf-both-sleeves-flipped.json`; solved scene `blender_bridge/output/tee-ppf-both-sleeves-solved.blend`; audits `tee-ppf-both-sleeves-contact.json` and `tee-ppf-both-sleeves-sewing.json` in `blender_bridge/output/`.

**Next actual blocker:** contact barrier / sewing trajectory against the arm colliders. The remaining seven self-crossings in the right-only candidate occur at the front/left sleeve (four), back/right sleeve (two) and back/left sleeve (one). Improving these must not reintroduce the original 44 crossings or worsen body penetration without explicit acceptance.
