# EXO Community / Edition Three — Design and QA

**2026-10-16** · Isolated localhost research prototype at **http://127.0.0.1:5499/**.

## Why another redesign was required

The previous iteration looked like a technical file catalog with a hoodie symbol repeated across the homepage and discovery cards. Its very small typography, four cramped desktop columns, thin sample metadata, and large blank regions made the garment less important than controls. The optical material atlas was useful, but a background mismatch caused the text and specimens to compete visually. Mobile showed the same hierarchy stretched vertically with too little focus.

## Implemented design changes

| Surface | Before | Edition Three |
| --- | --- | --- |
| Home hero | Large static 2D hoodie vector | Large interactive rotating 3D form study; single leading headline and strong studio / collection actions |
| Featured storytelling | Only simple category strip | Two editorial image-first feature studies: denim construction and textile microstructure |
| Discover | Four small square graphic tiles per row | Three larger object previews per row on desktop; numbered works, creator identity, type, clear metadata and deliberate empty space |
| Preview art | Hoodie reused for jacket and patterns | Hooded sweater, jeans, rib collar / cuffs and distinct armored cropped moto construction studies |
| Pattern detail | Dense split view and unprioritized technical labels | More prominent construction display, calmer product/specification section, linked 2D panels and selected regions |
| Material atlas | Tiny swatches and conflicting dark text colors | Fully dark specimen-book design consistent with the site; six distinct textures, folds, color variations, construction intent and provisional numerical notes |
| Material product page | Generic small surface tile | Large layered textile specimen stage with dedicated material profile and full optical atlas below |
| Mobile | Header collision risks, crowded card information | Two-row header with every category visible, preserved profile control, deliberate two-column cards with no cropped canvas and readable single-column editorial spreads |
| Full garment inspection | Confined preview stage and three near-identical thumbnails | Expandable full-screen studio on desktop/mobile; explicit 3D, flat-cut and wireframe options; Escape to exit and focus containment |

All reference meshes, pattern pieces, material numerical fields and media are **procedural fictional studies**. This report does not assert real CLO3D equivalence, fit, actual DXF, factory readiness or measured textile physics.

## Real browser verification

The deterministic regression runner is `node concepts/exo-community-ui/qa-ui.mjs` from the EXO repository. It uses Chromium through the installed Playwright dependency, produces full-page desktop/mobile screenshots and checks:

- 8 catalog assets, 4 mounted object previews, 2 editorial featured items, clickable live studio entry.
- Search, discipline and license filters, reset, responsive layout, category transitions.
- 3D canvas orbit via arrow key; 2D cut view and linked part-selection toggles; wireframe.
- Full-screen inspection, 3D/2D/wireframe view mode switching, keyboard dismissal and document scroll restoration, with mobile horizontal-overflow check.
- Garment-specific anatomy for jeans, modular rib and armored moto with material defaults.
- Six textile studies, color and property tabs, synchronization of selected surface with visualizer.
- Material page hero distinct from garment 3D and inspector background checked for dark color; no interactive controls nested inside gallery buttons.
- Interactive Pattern Lab, creator profile, public details, mock asset rights, Tech Pack role/revision differences, publishing/privacy flow.
- Page errors and mobile horizontal overflow.

**Outcome on latest run:** all reported checks passed and **zero browser JavaScript errors**. Primary screenshot files:

- `previews/01-website-desktop.png`
- `previews/04-website-mobile.png`
- `previews/09-full-asset-page.png`
- `previews/10-full-asset-mobile.png`
- `previews/15-moto-garment-detail.png`
- `previews/16-material-object-profile.png`
- `previews/16-expanded-pattern-studio.png`
- `previews/17-expanded-pattern-mobile.png`

## Final visual refinement loop

The second screenshot comparison surfaced a clipping bug in the catalog: the procedural canvas retained a 340-pixel desktop minimum height inside much smaller mobile cards, hiding the garment's lower half. Card canvases now inherit the containing card's exact height and their visual overlays are pared down. The original product-page footer duplicated viewport rotation labels; those duplicate canvas labels have been removed. The compact grid-mode switch also now has sufficient width for its label. All five mobile categories fit across the second header row.

The larger studio view is explicitly a **reference study**. Its meshes remain procedurally illustrated surfaces and the materials remain intentionally uncalibrated. Independent DXF, cloth-physics, and manufacturer data require separate development and testing.

## Intentional limitations

No live marketplace accounts, payments, usable DXF downloads, licensed asset previews, actual fabric measurements, manufacturing signoff or connection to real EXO garment state. A production-quality 3D creator marketplace will ultimately require user-authorized source garments or real GLB/glTF models, verified materials and compatibility checks. This redesign concentrates on a working high-fidelity front-end concept and does not claim to solve those separate backend problems.
