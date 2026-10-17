# Garment Studio · CLO visual icon QA (October 13, 2026)

**Source of comparison:** local CLO 7.0.242 window screenshot `qa-clo-reference-screen-20261012.png`, cropped toolbars at `native_app/qa/clo-actual-2d-tools.png` and `native_app/qa/clo-actual-3d-tools.png`. The independent 76-icon contact sheet is `native_app/qa/custom-icon-76-contact-sheet.png`.

**Scope:** This inventory validates the rendered command → SVG icon mapping in Garment Studio. It does **not** establish that all 76 icons are pixel-identical to a proprietary CLO release. Different CLO builds and grouped toolbars differ in grouping/order. CLO UI reference: https://support.clo3d.com/hc/en-us/articles/59637467539225-Customize-Toolbar .

## High-priority reference shapes, checked independently

| UI icon | Source observation | Implemented vector | Accuracy status |
|---|---|---|---|
| Sewing machine | Industrial machine silhouette in CLO sewing/editor toolbar grouping | Independent arm, spool, needle, wheel, presser-foot/base path in `CadToolIcon.jsx`; appears left Sew Edges, left Sewing Inspector and right Free Sewing | **Functionally recognizable at 20px**; exact proprietary pixel geometry not asserted |
| Polygon | CLO 2D polygon creation icon shows a square-like planar polygon with one upper-right clipped corner | Five-edge polygon outline/fill, **no page-fold crease**; creates actual 5-node geometric pattern | **Five-edge silhouette checked**; full arbitrary-point polygon drafting still separate |
| Edit point / triangular nodes | Three control points connected into a triangular path | Three explicit circular nodes and two/three simple connecting edges | **Shape category checked** |
| Cyan drafting triangle | Bright cyan right-triangle footprint in top 2D toolbar | Original filled right triangle plus selection cursor | **Color and basic triangle silhouette checked** |

## Right toolbar · 34 command/icon mappings

| # | Tool | Icon ID | Visual-review state |
|---:|---|---|---|
| 1 | Select and transform 3D fabric | `select-3d` | Custom semantic icon; no exact shape certification |
| 2 | Move 3D fabric | `move-3d` | Custom semantic icon; no exact shape certification |
| 3 | Rotate 3D fabric | `rotate-3d` | Custom semantic icon; no exact shape certification |
| 4 | Fabric hand | `hand` | Custom semantic icon; no exact shape certification |
| 5 | Surface / strain view | `surface` | Custom semantic icon; no exact shape certification |
| 6 | Toggle mesh wireframe | `wireframe` | Custom semantic icon; no exact shape certification |
| 7 | 3D sewing correspondence | `seam-links` | Custom semantic icon; no exact shape certification |
| 8 | 2D pattern select | `select-2d` | Compared to local reference category |
| 9 | Edit pattern points | `points` | Compared to local reference category |
| 10 | Split pattern edge | `split` | Custom semantic icon; no exact shape certification |
| 11 | Adjust pattern curve | `curve` | Custom semantic icon; no exact shape certification |
| 12 | Internal line / dart | `internal` | Custom semantic icon; no exact shape certification |
| 13 | Pattern notch | `notch` | Custom semantic icon; no exact shape certification |
| 14 | Tape measure / ruler | `measure` | Custom semantic icon; no exact shape certification |
| 15 | Cloth pin | `pin` | Custom semantic icon; no exact shape certification |
| 16 | Free sewing | `sew` | Compared to local reference category |
| 17 | Button or snap fastener | `fastener` | Custom semantic icon; no exact shape certification |
| 18 | Fabric browser | `fabric` | Custom semantic icon; no exact shape certification |
| 19 | Graphic browser | `graphics` | Custom semantic icon; no exact shape certification |
| 20 | Button browser | `buttons` | Custom semantic icon; no exact shape certification |
| 21 | Buttonhole browser | `buttonholes` | Custom semantic icon; no exact shape certification |
| 22 | Topstitch browser | `topstitch` | Custom semantic icon; no exact shape certification |
| 23 | Trims / zipper | `trim` | Custom semantic icon; no exact shape certification |
| 24 | Grading browser | `grading` | Custom semantic icon; no exact shape certification |
| 25 | Points of measure | `pom` | Custom semantic icon; no exact shape certification |
| 26 | Scene hierarchy | `scene` | Custom semantic icon; no exact shape certification |
| 27 | Fabric physical properties | `material` | Custom semantic icon; no exact shape certification |
| 28 | Fit analysis | `fit` | Custom semantic icon; no exact shape certification |
| 29 | Simulate / pause | `simulate` | Custom semantic icon; no exact shape certification |
| 30 | Reset flat arrangement | `reset` | Custom semantic icon; no exact shape certification |
| 31 | Fit 3D view | `camera` | Custom semantic icon; no exact shape certification |
| 32 | Create mirrored pattern copy | `mirror` | Custom semantic icon; no exact shape certification |
| 33 | Export garment file | `export` | Custom semantic icon; no exact shape certification |
| 34 | Physical seam-closure tool | `seam-weld` | Custom semantic icon; no exact shape certification |

## Left toolbar · 42 mappings

| # | Tool tooltip | Visual-review state |
|---:|---|---|
| 1 | Simulate / pause · Space | Custom semantic icon; exact CLO pixel geometry unverified |
| 2 | Simulation modes · top left | Custom semantic icon; exact CLO pixel geometry unverified |
| 3 | 3D fabric hand tool | Custom semantic icon; exact CLO pixel geometry unverified |
| 4 | Combined garment-centered 3D gizmo (T) | Custom semantic icon; exact CLO pixel geometry unverified |
| 5 | 3D move garment | Custom semantic icon; exact CLO pixel geometry unverified |
| 6 | 3D rotate selected fabric | Custom semantic icon; exact CLO pixel geometry unverified |
| 7 | Toggle sewing guides in 3D | Compared to visible CLO drafting/stitching reference |
| 8 | Toggle garment mesh wireframe | Custom semantic icon; exact CLO pixel geometry unverified |
| 9 | Strain map | Custom semantic icon; exact CLO pixel geometry unverified |
| 10 | Select / move | Custom semantic icon; exact CLO pixel geometry unverified |
| 11 | Sew edges | Compared to visible CLO drafting/stitching reference |
| 12 | Edit points | Custom semantic icon; exact CLO pixel geometry unverified |
| 13 | Split edge / add point | Custom semantic icon; exact CLO pixel geometry unverified |
| 14 | Add pattern | Compared to visible CLO drafting/stitching reference |
| 15 | Curve edges | Custom semantic icon; exact CLO pixel geometry unverified |
| 16 | Internal line / dart | Custom semantic icon; exact CLO pixel geometry unverified |
| 17 | Manual cloth pin | Custom semantic icon; exact CLO pixel geometry unverified |
| 18 | Add notch | Custom semantic icon; exact CLO pixel geometry unverified |
| 19 | Button / snap / hook fastener | Custom semantic icon; exact CLO pixel geometry unverified |
| 20 | Tape measure | Custom semantic icon; exact CLO pixel geometry unverified |
| 21 | Delete selected | Custom semantic icon; exact CLO pixel geometry unverified |
| 22 | Compact / expanded toolbar | Custom semantic icon; exact CLO pixel geometry unverified |
| 23 | Show or hide 2D drafting grid | Custom semantic icon; exact CLO pixel geometry unverified |
| 24 | Show or hide 2D sewing links | Compared to visible CLO drafting/stitching reference |
| 25 | Open fabric properties | Custom semantic icon; exact CLO pixel geometry unverified |
| 26 | Open avatar properties | Custom semantic icon; exact CLO pixel geometry unverified |
| 27 | Open sewing inspector | Compared to visible CLO drafting/stitching reference |
| 28 | Open selected pattern properties | Compared to visible CLO drafting/stitching reference |
| 29 | Open fitting and simulation controls | Custom semantic icon; exact CLO pixel geometry unverified |
| 30 | Open production and grading | Custom semantic icon; exact CLO pixel geometry unverified |
| 31 | Open renderer settings | Custom semantic icon; exact CLO pixel geometry unverified |
| 32 | Frame avatar in 3D | Custom semantic icon; exact CLO pixel geometry unverified |
| 33 | Duplicate selected pattern | Compared to visible CLO drafting/stitching reference |
| 34 | Create mirrored pattern copy | Compared to visible CLO drafting/stitching reference |
| 35 | Show or hide object browser | Custom semantic icon; exact CLO pixel geometry unverified |
| 36 | Browse fabric assets | Custom semantic icon; exact CLO pixel geometry unverified |
| 37 | Open topstitch object browser | Custom semantic icon; exact CLO pixel geometry unverified |
| 38 | Open button object browser | Custom semantic icon; exact CLO pixel geometry unverified |
| 39 | Open trims and zipper browser | Custom semantic icon; exact CLO pixel geometry unverified |
| 40 | Open size grading browser | Custom semantic icon; exact CLO pixel geometry unverified |
| 41 | Open points-of-measure browser | Custom semantic icon; exact CLO pixel geometry unverified |
| 42 | Inspect garment pressure distribution | Custom semantic icon; exact CLO pixel geometry unverified |

## Automated acceptance gates

- `node native_app/qa/check-custom-icons-and-clean-views.mjs` proves 42 left buttons / 34 right positions, all populated by SVG shapes, 34 **unique right-side** icon drawings and 39 distinct left-side drawings.
- Verifies the sewing machine in both toolbars, unclipped polygon path, actual five-vertex polygon creation, no added browser JavaScript errors, and all redundant viewport overlay bars absent.
- More faithful icon work needs a **specific high-resolution CLO tooltip + icon** for each remaining source command; descriptions from a product manual are not sufficient to certify a one-to-one bitmap outline.
- No proprietary CLO application icon resources were extracted or redistributed. All vectors were authored in `src/components/CadToolIcon.jsx`; keep separately licensed app icon assets out of source distribution.

## Related 2D/3D viewport cleanup

- Removed two foot-level arrangement/selection overlays, floating GIZMO/MOVE/ROTATE/ORBIT selector above model, floating camera preset row, additional 3D visibility strip and the 2D SEAMS / +/- / TIDY / FOCUS / FIT ALL strip.
- Navigation shortcuts: 2D mouse wheel zoom, `F` fit, `Shift+F` selected focus, `Shift+A` tidy, `+/-` zoom on focused 2D canvas; `T`, `G`, `R`, `Q` select the 3D combined/move/rotate/orbit tools.
- Minor 2D SVG grid stroke opacity increased from 0.035 to 0.13 and major from 0.075 to 0.32, without affecting fabric geometry.

**Not icon work:** Physically guaranteed collision, continuous sewing and CLO-equivalent garment physics are not established by any of these UI changes.

## Original-vector refinement loop 2 (October 13, 2026)

Redrew ten previously generic-looking glyphs with more recognizable garment-CAD construction: split edge (inserted vertex and cross), internal dart (two dart legs and dashed center fold), notch (V-cut into actual edge), tape measure (graduated angled ruler), cloth pin (head and long tapered shank), buttonhole (dense stitched oval), topstitch (parallel dashed seam tracks), puckering (wavy gathered material), grading (nested graded pattern outlines), and POM (horizontal bidirectional chest measure). All artwork is original React SVG in `src/components/CadToolIcon.jsx`, preserving the same command IDs and click behavior.

Automated regression: `node native_app/qa/check-custom-icons-and-clean-views.mjs`, `node native_app/qa/check-toolbar-actions.mjs`, and `node native_app/qa/check-major-clo-ui.mjs` all pass. `bash native_app/test_bundle.sh arm64` passes. Rebuilt and installed `~/Applications/GarmentStudioNative.app`; the installed `Contents/Resources/web/index.html` byte-matches the latest `dist/index.html`. The Mac screen capture for this loop was black (possibly a locked/blank display), so **visual inspection of the actual foreground native window was not independently established for loop 2**. The generated headless browser screenshot and contact sheet (`native_app/qa/clean-view-custom-sewing-polygon-icons.png`, `native_app/qa/custom-icon-76-contact-sheet.png`) show the revised toolbar artwork. No claim of pixel-identical CLO icons.

## Original-vector refinement loop 3 (October 13, 2026)

Redesigned the three 3D manipulation controls with color-differentiated XYZ axis arrows and rotation-ring shapes, plus 3D seam correspondence, snap/fastener, fabric roll, and zipper trim symbols. These are original SVGs in `src/components/CadToolIcon.jsx`, not extracted CLO assets. `npm run build`, `check-custom-icons-and-clean-views.mjs`, `check-toolbar-actions.mjs`, and `native_app/test_bundle.sh arm64` pass. The installed native arm64 app contains the current web bundle. Pixel-exact CLO fidelity and complete physical sewing behavior are not implied by icon tests.

## Garment CAD icon legibility loop 5

A further pass simplified the 20px curve-edit icon to emphasize tangent handles and edit nodes, added a separate paired-edge `sew-pair` silhouette for free-sewing connection semantics, and refined the independently drawn `sewing-stitch` illustration. We deliberately preserved the recognizable sewing-machine icon on the user-facing Sew Edges/Inspector commands to avoid shifting the verified reference. SVGs are in `src/components/CadToolIcon.jsx`. The full 76-tool render check and toolbar-action test pass; native arm64 bundle tests pass and the installed app contains the same compiled web bundle. The additional sewing-connection SVG is a reusable design asset, not yet a separate new toolbar button. Pixel-perfect identity with CLO's proprietary artwork remains unverified.

## Side-by-side native CLO dual toolbar / CLO-style studio pass (October 13, 12:19)

Captured native CLO 7 user-owned screenshot at `qa-clo-reference-screen-20261012.png`. Cropped the **two vertical tool strips immediately right of the 2D drafting window** (`native_app/qa/reference-clo-right-two-bars.png`), the left 3D tool strips (`native_app/qa/reference-clo-left-3d-bar.png`) and avatar/grey backdrop (`native_app/qa/reference-clo-rear-gradient.png`). Retained the source screenshots as QA artifacts, not packaged assets. Compared against the installed Garment Studio capture `native_app/qa/clo-dual-toolbars-installed-native.jpg` and headless capture `native_app/qa/right-dual-column-clo-rebuild.png`.

Garment Studio now renders **two actual independent 17-action columns**, drawing, polygon editing, point/curve, notches and grading on the column beside the 2D surface, sewing and fabric operations on the adjacent column. Neutral greys (`#303135` / `#2b2d31`) replace blue-black sidebars; blue only identifies selected actions. Both columns retain all 34 **existing** action slots (one knowingly disabled planned physical seam-closure command); no nonexistent CLO tools were pretended to work. The layout is modeled on the reference structure but not pixel-identical tool-for-tool because CLO's source screenshot contains more commands and different grouped tool functions. `node native_app/qa/check-dual-reference-columns.mjs` verifies two columns, 17+17, 34 distinct icons and geometry; `check-custom-icons-and-clean-views`, `check-major-clo-ui`, and `check-toolbar-actions` pass.

The 3D viewport now has a grey gradient backdrop with studio fog; stage selection uses visible yellow outline and emissive yellow fabric tint in staged and simulated states. Browser PBD solver supports hands-on nearby-particle grab during **running** simulation, plus paused full-panel translation/rotation. Native/PPF solver hand-grab semantics are not equivalent yet. `check-paused-cloth-gizmo.mjs` and `check-garment-centered-gizmo.mjs` pass. 2D point/curve interaction was independently verified in `check-point-curve-transform.mjs` and `check-2d-editor-immediate-feedback.mjs`: an anchor moved from (-27,50) to (-9.8,61.5) without modifying original seams, and curve control persisted; updates render during pointer drag.

**Physics limitation:** `npm run check:avatar` still fails for the 200 cm avatar at **866.0% peak local structural strain** (threshold 250%). 160 cm avatar tests pass at 162.8%, but neither level meets calibrated CLO textile physics standards. Our analytic body collider is not CLO's actual Thomas skinned triangle collider, so we cannot yet claim accurate no-penetration or final on-body fit. `npm run check:partial-seams` and baseline `npm run check:physics` pass. Further work requires validating the 200 cm failure by identifying the overstretched vertex pair and collision/neckline origin, implementing a corrected true collision solver or tested geometric safety projection, and repeating fit / strain / self-contact tests before announcing simulation parity.
