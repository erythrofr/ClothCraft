# CLO 7 dual toolbar screenshot transcription and EXO gap audit

**Captured reference:** locally saved image of **CLO 7.0.242**. **Assessment date:** 2026-10-16. This is a transcription **inferred from the saved local screenshots, not a fresh inspection of the live CLO application**. A/B refer to the two physical vertical columns *within each strip*, read independently from top to bottom. A row number pairs positions at comparable height; it does **not** assert that icons in A and B share an action or group. Divider bands and icon groups do not necessarily align across columns. Icons with a small triangle expose further choices; a screenshot identifies the displayed representative only, not the full flyout. **H/M/L** = high / medium / low visual identification confidence. Names of ambiguous icons are descriptions rather than verified CLO command strings.

## Reference files and image pointers

- Full application reference: `/blender-mac-workspace/garment-studio/qa-clo-reference-screen-20261012.png`.
- 3D strip (left): `screenshots/clo-v7-left3d-reference-native.png`.
- 2D strip (right): `screenshots/clo-v7-right2d-reference-native.png`.
- EXO four-column browser audit screenshot: `screenshots/clo-v7-exo-4column-audit.png`.
- These crops are narrow, icon-only, and lack tooltips; divider positions are visible. Revisit the original full screenshot or collect tooltip screenshots to resolve L-confidence names before declaring pixel- or nomenclature-exact parity.

## Left physical strip: CLO 3D, columns A and B

The following two lists preserve the **top-to-bottom physical sequence in each column**. Horizontal divider bands are written `— divider —` in their observed relative order, and are part of the target presentation. Rows pair the nth *icon* of the columns; because their dividers are independent, the paired icons are not invariably on one horizontal baseline.

| Icon ordinal | Column A (left subcolumn, top → bottom) | Column B (right subcolumn, top → bottom) |
|---:|---|---|
| 1 | Large down arrow, simulation dropdown / gravity-like control **(M)**; starts or selects simulation mode | Running person, avatar animation / motion **(M)**; movement playback or pose |
| 2 | Four-direction blue cross + pointer, transform/move 3D garment **(H)**; object translation | Curved segment with nodes, edit curve or 3D arrangement curve **(L)**; reshape a path |
| 3 | Dotted brush + pointer, mesh/brush selection **(M)**; select painted surface regions | Curved segment and brush/pointer, curve edit variant **(L)**; manipulate curve |
| 4 | T-shirt with perimeter nodes, select/edit garment shape **(M)**; select garment or its silhouette | Curved segment with repeated marks, curve/arrangement variant **(L)**; manipulate path points |
| 5 | Solid jigsaw/block, pattern/component edit tool **(L)**; operations on a selected part | Curved fabric panel with nodes **(L)**; edit a 3D line or seam path |
| 6 | Two blocks joined by dot, attachment/component operation **(L)** | Curved panel and tool tip **(L)**; modify a 3D path |
| 7 | Two blocks and curved connector, seam/connection operation **(L)** | Rolled or folded checker fabric, fabric fold/roll representation **(L)** |
| 8 | Person beside block/panel, placement relative to avatar **(L)** | Checkered T-shirt, texture/render appearance mode **(M)**; display mapped garment material |
| 9 | Thin diagonal pin with endpoint **(H)**; place/edit pin | Checkered T-shirt variant **(M)**; second texture/material display |
| 10 | Fabric with pin and pointer **(M)**; pin to garment or alternate pin mode | Button with four holes and linking mark **(M)**; button-related edit |
| 11 | Wireframe cube + curved arrow **(M)**; arrange/rotate object or avatar-relative placement | Four-hole button **(H)**; place/edit button |
| 12 | Vest front / shirt panel **(M)**; garment arrangement or fastening | Padlock linked to button **(M)**; lock/button constraint |
| 13 | Shirt split into two opposing halves **(M)**; arrangement/symmetry | Vertical zipper/teeth with handle **(M)**; zipper edit |
| 14 | Person wearing T-shirt **(M)**; avatar/garment display or arrangement | Fabric swatch with cylindrical/rolled edge **(L)**; material display |
| 15 | Meshed geometric frame with upward arrow **(L)**; mesh placement/retopology-type operation | Two-tone vertically split swatch, variant 1 **(M)**; display or assign color/material |
| 16 | Bent measuring tape **(H)**; curved measurement | Two-tone vertically split swatch, variant 2 **(M)**; material mode |
| 17 | Straight ruler **(H)**; linear measurement | Two-tone vertically split swatch, variant 3 **(M)**; material mode |
| 18 | T-shirt with vertical zip/teeth **(M)**; zipper on garment | Two-tone vertically split swatch, variant 4 **(M)**; material mode |
| 19 | T-shirt with visible zipper/placket **(M)**; second zipper mode | U-shaped magnet with arrows **(M)**; attraction/constraint operation |

**3D column A divider landmarks:** after icon 1, after 3, after 4, after 8, after 10, after 14, after 16, and near the two ending garment-zipper icons. **3D column B landmarks:** after icon 1, after 3, after 6, after 9, after 12, after 13 and before the lower swatch cluster. The crop shows thin double/triple horizontal rules; treat these as spacer/boundary elements, never as clickable actions. Some neighboring divider positions are approximate due to the narrow source.

**3D capabilities illustrated:** simulation/animation, 3D transform and mesh selection, edit paths, pins, avatar arrangement, measurement, button and zipper placement, material appearance and physical attraction. A drawn icon alone does not prove that EXO has a corresponding operation or that CLO's underlying modes are fully identified.

## Right physical strip: CLO 2D, columns A and B

| Icon ordinal | Column A (left subcolumn, top → bottom) | Column B (right subcolumn, top → bottom) |
|---:|---|---|
| 1 | Pointer + cyan triangular pattern **(H)**; select/transform pattern | Pattern/rectangle joined to another shape **(M)**; segment/shape-related edit |
| 2 | Three joined points **(H)**; edit points/segments | Rectangular pattern between round endpoints **(M)**; transform or adjust segment |
| 3 | Filled square, diagonal edge and node **(M)**; line/polygon operation | Curved section between endpoints **(M)**; curve edit |
| 4 | Folded-corner polygon **(M)**; create/edit polygon pattern | Magnifier + pattern block **(M)**; find/select related pattern piece |
| 5 | Nested rectangle/pattern contour **(M)**; offset/internal shape | Iron **(H)**; steam/iron tool |
| 6 | Dashed outline nested in square **(M)**; trace/selection boundary | T-shirt at neck/collar **(M)**; garment placement or arrangement operation |
| 7 | Two overlapping shield-like shapes **(L)**; fold/pleat or pattern manipulation | Rolled checker material **(L)**; fabric/material operation |
| 8 | Crossing lines with selectable nodes **(M)**; edit internal lines or intersection | Checkered T-shirt **(M)**; texture/print display or assignment |
| 9 | T-shirt contour with center cutout **(M)**; edit pattern outline | Checkered T-shirt variant **(M)**; alternative material/display operation |
| 10 | Vertical segment with nodes **(H)**; measure/edit line or length | Diagonal dotted stitch line **(M)**; edit stitch/topstitch |
| 11 | Vertical dotted dimension/ruler **(M)**; segment measurement | Horizontal dotted line with endpoints **(M)**; seam/stitch/line type |
| 12 | Horizontal ruler with endpoints **(H)**; linear distance measurement | Vertical wavy line with endpoints **(M)**; elastic/gather line |
| 13 | Large serif A **(H)**; text/annotation | Horizontal wavy line with endpoints **(M)**; gather/elastic line variant |
| 14 | Large serif A, variant **(M)**; edit text or 2D annotation variant | Pattern with plus badge **(M)**; add/copy or combine pattern pieces |
| 15 | Rectangle with vertical dashed divisions **(M)**; pattern grading/pleat or repeated fold | Padded quilted vest **(M)**; padding/quilting related operation |
| 16 | T-shirt with zigzag cut and points **(M)**; 2D pattern cutting/slashing | — blank below last pictured icon — |
| 17 | Person with divided shirt **(M)**; arrangement/segment association with avatar | — blank — |

**2D column A divider landmarks:** after approximately icon 9, 12, 14 and 15; top border, around icon 5/6, and between 9/10 also show heavy rules. **2D column B landmarks:** after approximately icon 4, 5, 6, 9 and 13, with a further rule near the quilted vest. Preserve visible vertical spacing between independent groups. The right A/B strips have unequal icon counts and cannot be reconstructed faithfully by simply alternating a 34-element list across rows.

**2D capabilities illustrated:** pattern creation and editing, point/curve operations, nesting/offset and internal shapes, textile finishing and steaming, measurements, annotations, stitch paths, gather/elastic indications, additions and padding. Several lower icons cannot be identified to a precise CLO 7 tooltip from this crop alone.

## EXO source audit: BEFORE implementation (historical gaps)

The following table records the **BEFORE** state inspected for the original audit. It is retained as change history, **not a description of the current toolbar layout**. Files now use the manifest and reference renderers described below.

| Area | Actual EXO ordering in source | Key mismatch with screenshot |
|---|---|---|
| EXO left 3D A, top → bottom | `simulate`, `select-3d`, `wireframe` (mesh-select), `curve` (disabled), `seam-links`, `sew`, `pin` | Only 7 slots; simulation is close, but missing many interim groups and numerous 3D measurement, avatar, finishing and display icons. `wireframe` is re-used for a mesh-select affordance. |
| EXO left 3D B | `simulation-modes`, `hand`, `move-3d`, `rotate-3d`, `wireframe`, `surface` | Only 6 slots; CLO crop starts with running-person avatar animation and curves, then progresses through buttons, zipper, swatches and magnet. EXO repeats generic motion/view actions instead. |
| EXO left auxiliary 2D A | `select-2d`, `points`, `split`, `curve`, `internal` | The screenshot's full 2D strip belongs on the right physical side; EXO has an extra reduced set under the left 3D strip. |
| EXO left auxiliary 2D B | `polygon-tool`, `notch`, `fastener`, `measure` | Four shortcuts do not reproduce native column B's finishing/stitch/gather/padding order. |
| EXO right palette A | `select-2d`, `points`, `curve`, `split`, `internal`, `mirror`, `notch`, `measure`, `grading`, `pom`, `scene`, `fabric`, `material`, `graphics`, `camera`, `fit`, `export` | Positions 3/4 are reversed relative to the image's distinct line/polygon family; browser/navigation utilities occupy slots where CLO has shape construction, measured lines, text and graded/pleated/cut patterns. |
| EXO right palette B | `seam-links`, `sew`, `seam-weld`, `topstitch`, `fastener`, `buttons`, `buttonholes`, `trim`, `pin`, `simulate`, `reset`, `select-3d`, `move-3d`, `rotate-3d`, `hand`, `surface`, `wireframe` | Leading sewing icons do not match top pattern/curve/iron section; bottom 3D camera and display commands are misplaced on the 2D strip, while wavy stitch/elastic and quilted/filled garments are missing. |

The historical `RIGHT_PALETTE_TOOLS` inventory has **34 EXO action entries**, not 34 native CLO 2D icons. `seam-weld` has a null action and remains disabled. The older dedicated `Edit Styleline` disabled button has been replaced by manifest reference slots. Browser-opening commands such as `buttons`, `topstitch`, or `material` do not themselves establish physical tool parity.

## AFTER implementation: current source mapping and status (2026-10-16)

The four photographed columns are now represented as **four independent immutable-order arrays** in `src/data/clo7ToolbarOrder.js`, with each slot carrying `{id, label, icon, action, after}`. `id` is the column-letter/1-based ordinal identifier (`A01` etc.); `after` adds a visual gap beneath the icon. Manifest icons are **original EXO approximations**, not copied CLO artwork, and uncertainty remains encoded in labels (`unverified`).

| Physical reference strip | Manifest array | Renderer and position | Slot count | Present behavior |
|---|---|---|---:|---|
| Left, 3D A | `CLO7_3D_A` | `src/App.jsx`, `CLO 7 · 3D ORDER`, first `clo-left-3d-column` | **19** | `renderClo7ThreeDSlot`: only `simulate`, `transform`, `mesh-select`, `pin` actions have handlers; remaining slots disabled with reference-only tooltip. |
| Left, 3D B | `CLO7_3D_B` | `src/App.jsx`, same order strip, second column | **19** | Screenshot-positioned approximations; **none** of this column's action names has a handler in the 3D reference renderer, so all reference buttons are disabled. |
| Right, 2D A | `CLO7_2D_A` | `src/components/RightToolPalette.jsx`, `CLO 7 · 2D ORDER`, first `clo-reference-column` | **17** | `renderCloReference` enables only exact matches between manifest `slot.action` and `RIGHT_PALETTE_TOOLS` entry action. |
| Right, 2D B | `CLO7_2D_B` | `src/components/RightToolPalette.jsx`, second reference column | **15** | Same exact-action gating, with unmatched/unsupported slots disabled. |

**Key implementation distinction:** The new four-column placement is now in the UI, but **slot presence does not assert functional parity**. `renderClo7ThreeDSlot` uses a deliberately narrow handler map. `renderCloReference` calculates `mapped = slot.action && entry?.[2] === slot.action` and disables the slot if the matching EXO action is unavailable or mismatched. Missing icon behavior therefore remains visibly unavailable rather than silently executing another operation. The new `after` spacer flag approximates physical group breaks; exact source-pixel spacer geometry and flyout nesting remain unverified.

The left rail retains **EXO · 3D EXTRAS** after the reference 3D strip (simulation quality, fabric hand, move, rotate, wireframe, strain), and the right palette retains **EXO · EXTRA TOOLS** after its reference 2D strip. `RIGHT_PALETTE_TOOLS` now has **35** entries (34 original entries plus the new functional polygon-creation shortcut). Eleven unique original-action IDs are placed in the 2D reference mapping: `CLO_REFERENCE_LEFT_COLUMN` (7) and `CLO_REFERENCE_RIGHT_COLUMN` (4). The other **24** IDs remain in `EXO_EXTRA_LEFT_COLUMN`/`EXO_EXTRA_RIGHT_COLUMN`; this matches the passing browser QA observation. The overall interactive EXO workspace also retains toolbars and buttons outside these right-palette arrays.

**Acceptance evidence:** `scripts/qa-clo-v7-four-column-order.mjs` browser QA was reported **PASSED** by the main agent: **19/19** 3D A/B and **17/15** 2D A/B reference icon counts, left A/B then right A/B physical ordering, and **24 extra EXO actions retained**. The script checks the four manifest-based `data-clo-slot` sequences and the separate right-side extras container; see `screenshots/clo-v7-exo-4column-audit.png`. This document records that reported run; it does not independently rerun a browser session. The script's explicit extras assertion requires at least 15 buttons, and its printed count should be consulted for exact totals.

Remaining acceptance conditions: compare icon drawing, vertical distances, dividers, flyout triangles, tooltip wording and multi-tool menus against authenticated CLO 7 references; validate behavior in isolation for each enabled EXO action; independently verify that every ambiguous tool has the correct identity before marking it parity-complete. A reference-only disabled icon meets **order/visibility** acceptance but does not satisfy **command/physics** acceptance.

## Follow-up verification and interpretation rules

1. **Maintain the implemented four independent ordered arrays:** `CLO7_3D_A`, `CLO7_3D_B`, `CLO7_2D_A`, `CLO7_2D_B`. Current dividers are represented by `after` spacing flags, not standalone divider entries or full flyout metadata. Do not interleave a flattened list.
2. **Map icon descriptions to verified CLO tooltips:** use the saved screenshot first, then compare official 2021 guide icon imagery; gather actual CLO 7 tooltips for M/L entries and distinguish the primary displayed icon from all submenu variants. Retain `unverified` metadata until mapped.
3. **Extend verified EXO capabilities individually:** existing renderers disable unsupported slots. Only enable an action after checking its semantics. A click to a library tab is distinct from creating a physical button, zipper or topstitch on cloth.
4. **Keep special UI separate:** EXO extras sections now retain additional commands. Continue preserving simulation mode popovers, object browsers, main workspace tabs and general camera/export access without inserting them into photographed CLO positions.
5. **Verify ordering visually** at the exact full-height strip dimensions against both crops. Assert A and B independently, test divider positions, flyout arrows, hover names, and action enabled/disabled states. Functionality validation is separate from icon/order parity.

## Official reference and version caveats

- CLO, [2021 toolbar guide (original attachment)](https://support.clo3d.com/hc/en-us/article_attachments/48293801440281). Historical nomenclature/icon reference; a 2021 guide is not definitive evidence of the CLO **7.0.242** custom arrangement. The attachment is large and was not fully parsed in this audit.
- CLO, [Customize Toolbar](https://support.clo3d.com/hc/en-us/articles/59637467539225-Customize-Toolbar), updated 2026-09-28, describes **2026.1** Group Tools, Rearrange Tools, save/load Tool Set and Reset to Default. It states that rearrangement can modify order and visibility. These newer features cannot be presumed to exist in the same form in CLO 7.

**Critical qualifier:** the requested layout is the **captured local user's CLO 7 toolbar state**, not a verified universal factory/default order. **An initial UI layout implementation now exists and the reported browser ordering QA passed**. This does not certify exact ambiguous tool names, exact proprietary icon artwork, pixel-precise spacing, flyouts, or previously unsupported CLO functionality.

## Native V2 usability refinement after feedback — working tools first

The earlier 70-slot reference map was too cluttered for daily use because most reference positions lacked a corresponding Rust-backed command. The normal native editing layout now displays only mapped working controls in their CLO-reference relative order. Full reference positions remain inspectable through the FULL MAP toggle on the left 3D rail and MAP on the right 2D rail. Unsupported commands remain disabled rather than being presented as functional. Additional EXO tools remain available in an expandable EXO TOOLS section.

**Installed V2 toolbar smoke validation:** 3D A has 5 visible functional reference buttons, 3D B has 4, 2D A has 3, and 2D B has 2. The full photographic reference remains 19/19/17/15. Normal mode shows zero disabled reference placeholders; 24 additional EXO action slots remain available on demand. These counts exclude the separate, working native viewport corner toolbars.

**Native tool synchronization:** Clicking supported right-side 2D commands now sends the exo-clothcraft-select-2d-tool event to the actual Rust-backed board and its corner tool controls. Point mode hides the transform marquee and exposes vertices; Select mode brings back the marquee. Legacy V1-only actions are not misrepresented as live Rust pattern edits.

**Pattern guide:** The selected front T-shirt pattern now includes a vertical center-front line. It is calculated from the torso center at chest height and the actual cut outline, then clipped and transformed with the pattern. Existing chest and belly horizontal guides and the white fabric appearance remain.

**Tests:** scripts/qa-clo-v7-four-column-order.mjs verifies normal/expanded order; integrations/clothcraft/qa-v2-2d-marquee.mjs verifies center-front clipping, tool switching, move/rotation and deselection; scripts/qa-installed-v2-native-toolbar.mjs verifies the signed installed V2 bundle's served native UI and correct tool behavior. Mac app installation, codesign, local native service health, avatar preservation and saved garment backups were verified. Exact CLO proprietary icon likeness and unsupported tool physics are not certified.
