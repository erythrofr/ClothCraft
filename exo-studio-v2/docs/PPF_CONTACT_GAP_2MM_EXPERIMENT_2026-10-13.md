# PPF 2 mm contact gap: real Metal A/B test

Using the corrected horizontal-arm avatar and the right-sleeve-only depth reversal, an isolated 10-frame Metal PPF solve was run with garment `contactGap = 0.002 m`, `contactOffset = 0`.

| Metric | Previous right-sleeve baseline | 2 mm gap test |
|---|---:|---:|
| Peak body triangle-pair crossings | 141 | 135 |
| Final body triangle-pair crossings | 128 | 135 |
| Peak cloth non-adjacent triangle-pair crossings | 10 | 6 |
| Final cloth non-adjacent triangle-pair crossings | 7 | 2 |
| Seam-gap closure | 99.77% | 99.71% |

The solve completed and the contact audit covered all ten frames. The new candidate reduced garment self-intersections but slightly increased final body crossings. It **does not** meet the intersection-free requirement and must not be advertised as safe or production-ready. Cloth crossed the body for the first time at frame 2 in this experiment. At frame 9 the last two cloth self-crossing pairs occur at `front/sleeve-right` and `back/sleeve-left`; the 135 body crossings still require contact trajectory and avatar-collider investigation.

Preserved independently in `blender_bridge/fixtures/tee-ppf-contact-gap-2mm-experiment.json` and `blender_bridge/output/tee-ppf-contact-gap-2mm-{configured,solved}.blend`, `tee-ppf-contact-gap-2mm-{report,sewing,contact}.json`. Do not overwrite the earlier best-fit evidence until physical acceptance passes.
