# CLO-inspired Garment Studio visual and workflow pass

Implemented October 13, 2026 in the existing React/WebGL garment studio. The user's saved garment and simulation engine were not reset or modified by this UI pass.

## 2D drafting viewport

- Replaced avatar guide images with a single solid gray human silhouette (no photo, face, or texture).
- Neutral light gray drafting stage with an SVG grid that extends beyond the current view box on all sides; zoom/pan remain synchronized in 2D units.
- Allowed additional fine-detail zoom (view-box width as small as 1.5 drafting units; previously limited to 25).
- Added technical bodice center/chest reference guides, point markers, and red notch display. The reference overlays do **not** change graded cut-piece geometry, measurements or sewing indices.
- Right-click opens a real 2D action menu to select/edit points/curves, add notches and sewing, zoom to piece or all pieces, toggle the grid, or create an actual saved center internal line on the selected piece.
- Retained bright-yellow selected cut contours and a **gray**, not yellow, outer transform rectangle.

## 3D visualization

- Neutral vertical studio gradient dark-gray at the top and near-white at the bottom, brighter PBR lighting, light floor and subtle perspective grid.
- Increased orbit camera zoom to a 0.12× avatar-height camera-target distance with cursor-based zoom; did not alter the cloth solver.
- Retained synchronized yellow selected piece outline; all fabrics continue to use physical and PBR material parameters.
- Stage library presets (Studio, Softbox, Neutral, Dramatic) change live lighting parameters using existing render settings.

## Surrounding interface

- Object Browser footer has a ListTree icon and five real expandable groups: 2D Pattern, Sewing, 3D Form, Material, Environment, with nested navigation to existing editors.
- Pattern library uses miniature rendered **flat cut pattern pieces**, rather than garment silhouettes; saved draft geometry itself is unchanged.
- Fabric library selection and new preset selection now assign the chosen swatch to the currently selected garment panel, with an explicit Apply to All control.
- Hardware/trims library entries have CAD icon previews and invoke existing button, buttonhole, zipper, binding, and topstitch creators.
- Surrounding chrome follows an unsaturated dark-gray CLO-inspired palette. This is not pixel-exact proprietary CLO artwork.

## Validation

- `npm run build` completed after consolidating updates.
- `node scripts/qa-clo-2d-drafting.mjs`: **pass** — canvas color, blank silhouette, zoom deeper than old cap, full grid coverage, and context-menu creation of real internal line.
- `node scripts/qa-clo-visual-workflows.mjs`: **pass** — 5 categories, applying fabric to current/all panels, rendering flat pattern thumbnails, switching stage presets.
- `node scripts/qa-viewport-selection-icons.mjs`: **pass** — yellow selected contour, gray selection rectangle, linked selection, working 2D/3D icon controls.
- Rebuilt and signed native arm64 bundle; synchronized its website resources into the installed Mac app while preserving the private Thomas avatar. Restart the installed app to load the updated resources.

## Scope notes

- A real T-shirt is sewn from separate front, back, and sleeve **cut patterns**. Bodice patterns do not include attached sleeves; sleeve pieces remain separate because removing them would invalidate sewing and simulation, which were deliberately preserved.
- Chest/center reference guides are technical overlays unless explicitly converted into stored internal lines.
- This is a CLO-inspired UX update, not a claim of exact CLO UI, tool/index parity, collision-certified drape, or improved cloth simulation.
