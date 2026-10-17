# Garment library preview — October 17, 2026

Scope: local EXO ClothCraft V2 garment-library hover preview. Tested against the current shared source tree and served production build on port 5188. The tree contains concurrent work by other agents; only garment preview files, supporting geometry, and isolated QA files were targeted in this pass.

## Result

The original garment-library hover rendered front/back pattern panels and two sleeves as widely spaced grid tiles with only lightly curved center surfaces. The revised preview has a more expressive source-panel study and a separate assembly study, both with orbit controls, drafting-derived sampled contours, knit-color PBR material, thickness at source-panel edges, original seam and topstitch offsets, and studio lighting.

For the Foundation Tee, the joined view reuses triangulated front/back source boundaries, including the drafted neckline. Sleeve cylinders are illustrative folded proxies: their length and cuff circumference are taken from the source sleeve pieces; their sewn 3D placement is art-directed. The exploded option renders original front, back, and sleeve drafting silhouettes, including source curves, with posed curvature. **Neither view is a physically solved drape or factory fit validation.**

The tee source has **4 pieces, 38 drafting edges, and 14 seam links**. The installed 1440px/390px exploded view reported 8 surface/thickness meshes and 3,743 surface triangles, plus 48 active detail objects. The joined assembly was separately verified with 24 meshes and 17,666 triangles.

## Interaction and layout

The full Library popup originally contained a 543px inner preview inside a 470px media slot. Rotate and detail buttons overlapped popup information. Browser-assisted scrolling fired the library popup's global scroll-dismiss handler. Scoped CSS now constrains the preview height, makes the garment portal interactive, and clips internal programmatic scrolling.

The full app hover was exercised at **1440 × 900** and **390 × 844**. Front, 3/4 View, Pattern Exploded, rotation, Style Lines, Sewing Lines, and Pattern Edges all passed. Tests verify that each detail toggle changes the visible rendered detail count. **Zero page errors** observed; tested popup bounds fit their viewport widths.

Validation:

- npm run build — PASS; 1,891 transformed modules. Pre-existing aggregate bundle-size warning remains.
- Isolated component QA: EXO_QA_URL=http://127.0.0.1:5197 EXO_QA_PHASE=verified node scripts/qa-garment-hover-20261017.mjs — PASS at desktop and mobile sizes.
- Installed full-app QA: EXO_QA_FULL_APP=1 EXO_QA_URL=http://127.0.0.1:5188 EXO_QA_PHASE=installed node scripts/qa-garment-hover-20261017.mjs — PASS at desktop and mobile sizes.
- Popup lifecycle QA: node scripts/qa-garment-hover-lifecycle-20261017.mjs — PASS; stays open across consecutive inspection actions.

## Images

| Capture | Location |
| --- | --- |
| Before, desktop | [before-1440.png](./before-1440.png) |
| Before, mobile | [before-390.png](./before-390.png) |
| After, installed desktop | [installed-1440.png](./installed-1440.png) |
| After, installed mobile | [installed-390.png](./installed-390.png) |
| Joined assembly front | [front-1440.png](./front-1440.png) |
| Joined 3/4 view | [improved-1440.png](./improved-1440.png) |
| Exploded source pattern | [exploded-1440.png](./exploded-1440.png) |

Remaining quality gap: folded sleeve surfaces are authored shapes with wrinkles, not a solved sewn garment. CLO-like physical drape, stitch tension, wrinkling, and avatar contact require a preview-safe garment solver.
