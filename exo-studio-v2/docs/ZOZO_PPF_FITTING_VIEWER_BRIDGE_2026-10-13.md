# ZOZO PPF fitting bridge — local engineering pass

Upstream reference: `research/oss/ppf-contact-solver/examples/fitting.ipynb`. Their dress has already been triangulated and encoded with stitching data, and the moving body uses prescribed animated geometry. Garment Studio still requires a robust pattern assembly and a certified all-frame dynamic solve to match the demo.

## Completed

- Garment Studio serializes authored panel/edge sewing correspondence into PPF loose-edge stitching constraints; the Metal solver already produces persistent PC2 animations and validated contact/sewing reports.
- Native async PPF service now stores each completed job's **exact tuned PPF payload** alongside the PC2, preserving a reversible global-vertex-to-pattern mapping after temporary solver jobs are removed.
- New local `GET /jobs/:id/preview?frame=N` endpoint converts PC2 Blender coordinates into Garment Studio Y-up coordinates, remaps triangles into the original four pattern pieces, and marks failed fit acceptance **experimental**. `validatedOnly=true` rejects bad fits.
- Garment Studio's Sewing section has read-only PPF playback UI and a frame scrubber, and the 3D viewport can overlay original per-piece mesh geometry from the solver without editing 2D patterns, simulation rest lengths or the interactive XPBD session.
- `scripts/check-ppf-preview.mjs` validates PC2 format, coordinates, piece mapping, errors and experimental labelling. A real existing 10-frame T-shirt PC2 was decoded: 500 vertices / 768 triangles, four pieces (155/155/95/95 vertices), preserving topology.
- Original `npm run check:ppf-payload`, `npm run check:ppf-acceptance`, `npm run check:ppf-staging`, and production Vite build passed. The native Mac app was rebuilt, code-signature-verified, installed and opened.

## Strict limitation

This is a functional source-data import and display bridge, **not** a verified on-body fitting solve: original attempts report collisions/strain failures. Viewer explicitly warns for experimental results. The reference 240-frame ZOZO dress run has not been finished in this pass, and Garment Studio's own four-panel shirt still needs a proven collision-free *dynamic* assembly solve. Persisted jobs must be created with the new service code to expose the preview route (historical jobs with no stored tuned payload cannot use it).

## Next engineering actions

Test a bounded T-shirt Metal solve with the updated staging, compare first/last all-frame penetration/strain/seam metrics, improve garment-over-body placement and sleeve-cap seam ordering, then test the asynchronous viewer endpoint end-to-end with a real successful job. Do not accept collision-violating simulations as production-ready garments.
