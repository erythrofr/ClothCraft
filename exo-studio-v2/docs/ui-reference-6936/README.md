# EXO pattern hover visual reference — IMG_6936

Reference photo: `screenshots/reference-IMG_6936.jpg`. The image shows large bright off-white garments/pattern sections against near-black surroundings. One arrangement reads as a short-sleeved front shirt and another as separated body and curved sleeve sections. The surface is gently bowed and throws soft textile-shading gradients; cut edges and seams are visible without overwhelming CAD overlays.

## Implemented direction

- Garment **and** Patterns hover open a wide dark library preview rather than a small icon-only thumbnail. Tile click actions still load the original editable EXO template.
- Three-dimensional panel surfaces are generated from actual EXO template outlines and seam data. `garmentPreviewPose` positions the tee's front and back side-by-side with short sleeve panels angled outward, with modest depth and shape-conforming shading.
- The **Pattern Exploded** view is the starting view. **Front** and **3/4 View** also expose an illustrative assembled tee for context; these views are artistic assembly studies, not simulated cloth.
- Pattern edges, source seam links and decorative stitch paths can be independently displayed; drag rotation remains supported.
- The lightweight hover triangulation caps cell subdivision at six and the small stitch tubes cap their length resolution. In a Node timing smoke check, the four tee pieces generated 3,743 triangles in approximately 19 ms, compared with about 10,876 triangles before the cap.
- The panel and edge geometry are sourced from templates, but the transforms do not calculate strain, gravity, fabric contact or a production-grade fitting simulation.

## QA and follow-up

`npm run build` succeeded after integration. Headless Chromium initially stalled under simultaneous Rust compilation; the focused browser fixture subsequently passed at desktop **1440 × 900** and mobile **390 × 844**. Both Garment and Patterns popups open at 762 px (desktop) or 368 px (mobile) with one canvas each. The D-ring, prong buckle and slide adjuster all reported real imported GLBs loaded on both viewports, with no browser page errors. The test report is `qa-report.json`; example visual captures are `qa-garment-1440.png`, `qa-garment-390.png` and the three `qa-hardware-*.png` previews. The default image uses the **Pattern Exploded** view.

Regenerate a screenshot with `EXO_QA_URL=http://127.0.0.1:5299 EXO_QA_EXPLODED=1 node docs/ui-reference-6936/qa-visual.mjs` while `npm run dev -- --port 5299 --strictPort` is serving the repo. This is a component fixture using the actual production hover and 3D preview code; the installed native app must also be packaged and inspected separately.

The reference is a photographed screen, so its colors and precise camera calibration cannot be extracted reliably. The aim is faithful visual hierarchy and recognizable curved pattern composition. More accurate seam-to-seam assembly and physically plausible folds depend on a fitting solver and calibrated garment construction.
