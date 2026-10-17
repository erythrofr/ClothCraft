# Hardware and hanger quality audit — 17 October 2026

## Verified inventory

## Visual curation review

Evidence: [`docs/hardware-contact-sheet-20261017.jpg`](hardware-contact-sheet-20261017.jpg), a labeled composite of all 28 actual on-disk renders viewed at once. The sheet was visually inspected (image content, rather than PNG validity alone). The **18 featured renders** are ten comparatively stronger buttons, all five distinct zipper styles, and three buckle/ring designs. The remaining ten stay in the data model and are available from the new **All designs** button or search, so previously placed hardware is not removed.

The examples hidden from the featured view are `denim-copper-rivet` and `flat-rivet` (oversized lateral cylinders/posts in thumbnail), `denim-tack-button` and `jean-fly-button` (plain discs with too little recognizable fastening geometry), `horizontal-buttonhole` and `keyhole-buttonhole` (flat schematic stitched strips), `ring-spring-snap` and `sew-on-snap` (nearly identical generic cylinder illustrations that fail to distinguish assemblies), `oval-toggle-button` (oblique slab with holes unlike a finished outerwear toggle), and `leather-wrapped-button` (bare rounded puck with dotted rim; leather grain/seams underdeveloped). These judgments are about *thumbnail appearance*, not supplier specification or physical quality.

Run `node scripts/qa-hardware-curation.mjs` with the existing Vite server on port 5188 to exercise the default, expanded, and restored featured sets. **PASS**: 18 featured and 28 full assets, weaker rivet hidden then recovered, zero page errors. Existing `qa-hardware-library-inspector.mjs` assumes all fourteen buttons are visible by default and needs that old assertion updated before rerunning in featured mode.

- **28 hardware presets**: 14 buttons, 2 buttonholes, 5 zippers, 2 snaps, 2 rivets, 3 buckles/rings. Each has a different, valid, square PNG render in `public/hardware-thumbnails`, dimensions in millimetres, basic material information, and PBR parameters. These renders were generated procedurally with Three.js; they are **not photos or supplier CAD**.
- **Two imported hanger meshes**: `innerscene-shoulder-form.glb` (4 meshes, 3 materials, 743 KiB) and `innerscene-clip-rail.glb` (13 meshes, 6 materials, 832 KiB). `Library3DAssetPreview` uses them for the `wood` and `trouser-clip` live previews, with a procedural fallback on load error. The origin labels in source reference Innerscene and CC0; this audit verified the files and their GLB content **but did not independently verify the original download license**.
- **Other hanger variants**: `chrome`, `velvet`, and `padded` remain procedural Three.js models with independently rendered PNG thumbnails. They should be described as illustrative rather than authentic manufacturer geometry. The `wood` card and the separate `trouser-clip` card use local mesh files for live hover.

## Product quality and production limitations

Keep the full catalog for now: every hardware variant has a distinct render and metadata, and these types serve different sewing and manufacturing tasks. Reducing it arbitrarily would remove useful buttonhole, zipper or trim options. The most serious limitations are functionality and physical fidelity, not missing images. `hardwareToPatternAnnotation` directly supports buttons and buttonholes; zippers and press hardware use separate integration paths, and several hardware assets have no complete placed, physically simulated fastener. A rendered zipper does not guarantee functional teeth or sliders in garment simulation. Geometry is artistic and dimensions are estimates, requiring supplier drawings and tests for tooling, load ratings, corrosion and durability.

The existing thumbnail generator `scripts/generate-hardware-thumbnails.mjs` constructs metal and polymer PBR material variants, button sewing details, teeth, sliders, rivets and buckles. Its rendered photographs are static PNGs for responsive grid performance; the enlarged hover preview uses the corresponding render. The imported hanger hover loads GLB geometry in a separate WebGL canvas. Do not advertise static hardware PNGs as freely rotatable models.

## Reproducible checks

`node scripts/check-hardware-quality.mjs` validates six kind names, metadata and PBR ranges, unique square PNG images, and GLB headers, scene meshes and material counts. Initial run: **PASS**, 28 unique render files, two structurally valid mesh models. This tests integrity, not visual realism or licensing.

For UI integration, `node scripts/qa-hardware-library-inspector.mjs` and `node docs/hanger-assets/qa-hanger-browser.mjs` are the existing visual/browser test entrypoints. The former checks selection and editor integration at 1440px and 390px; the latter verifies hanger hover and imported-mesh status. Browser results should be reported separately from the static integrity checks.

## Next supplier-grade improvements

Obtain authorized supplier CAD drawings, measured dimensions and licensed GLBs for snaps, buckles, zippers and specialty buttons. Use calibrated neutral-light PBR reference renders with comparable physical scales, consistent camera angles and explicit model provenance. Add placement and assembly interaction tests for unsupported press fasteners before treating them as manufacturer-ready garment components.
