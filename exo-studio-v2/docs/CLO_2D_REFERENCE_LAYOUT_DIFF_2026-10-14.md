# CLO7 → Garment Studio 2D window visual-layout comparison

**Evidence captured and measured:** October 14, 2026.
**Verdict:** A real side-by-side comparison and focused tool-chrome
correction were completed. This is **not** CLO3D 1:1 certification.

## Authentic reference, provenance and comparability

- Original: **CLO Academic 7.0.242**, `Male_T-shirt.zpac`, captured from
  the user's running macOS application (3,024 × 1,964 px). Original screenshot
  and source/app evidence:
  `research/clo-reference/live-audit-20261014/current-workspace.png`,
  `docs/CLO_ACTIVE_TSHIRT_ASSEMBLY_REFERENCE_2026-10-14.md`.
- The source has a **2D Pattern Window with two vertical tool rails on its
  right, a five-icon utility strip on its left, and a centered title**.
  Source normalized crop from screenshot: (1488, 198)–(2344, 1817).
- Garment Studio: real isolated Foundation Tee in the browser desktop shell,
  **1440 × 900** viewport, source crop (688, 70)–(1126, 859). The crop
  includes **both the 2D canvas and the adjacent 2D/sewing tool palette**.
  Screenshot created with `npm run capture:clo-2d`.
- CROPPED SOURCE IS PRIVATE: `replica/screens/S01-CLO7-male-tee-2d-reference.png`.
  Screenshots are locally Git-ignored; never package or redistribute the
  CLO screenshot or private avatar/garment assets.

### What is and isn't comparable

The source CLO male tee has **seven** distinct pattern objects in the
original document/export; our Foundation Tee has **four** flat panels.
Their 2D garment drawings, notches and layer semantics are therefore not
pixel-corresponding. The exact CLO version is **7.0.242**, not CLO
2026.1; newer CLO tool groups can be rearranged or grouped by users
([CLO official customizable toolbar guide](https://support.clo3d.com/hc/en-us/articles/59637467539225-Customize-Toolbar)).

To avoid a fabricated similarity result, we **mask the changing drawing
interior** in both screenshots and compare only normalized UI furniture:

| Region | Pixel crop (438 × 789 normalized) | What it tests |
| --- | --- | --- |
| Viewport header | full width × y 0–43 | Height, placement, title |
| Left utility strip | x 0–100, y 43–340 | Tool family shape and placement |
| Right double tool rail | x 355–438, y 43–715 | Twin column density and positions |

Reproduce: `npm run check:clo-2d-visual`.
Algorithm: MIT `scripts/vendor/replica-skill/imgdiff.py`,
edge-map, 12 horizontal grid columns, default structural mode.
Artifacts: `replica/diffs/S01-CLO7-vs-own-before-layout.json` and
`replica/diffs/S01-CLO7-vs-own-after-layout.json`.

## Measured result

| Selected metric | Prior | Revised |
| --- | ---: | ---: |
| **Chrome-only structural edge-layout score** | **71.3 / 100** | **72.3 / 100** |
| 2D viewport header height | 43 px | 27 px |
| Left in-canvas quick-tool group width | ~72 px | 35 px |
| All-tools main twin-rail first-button offset from palette top | ~111 px | **34 px** |
| Browser JavaScript errors in final dedicated capture | — | **0** |

The main tool icons now begin almost immediately below the palette header,
instead of being pushed down by a redundant two-by-two workflow switcher.
The upper-left tool block is now a narrow **single-column utility strip**,
and the real 2D window header has a centered **2D Pattern Window** label,
with units and number of pattern pieces preserved at left.

The pixel metric **did not improve at every intermediate step**. The first
rail simplification scored 69.2, compared with the 71.3 baseline. We
investigated instead of reporting a false win. Aligning the centered
header with the actual source yielded the final 72.3 score. This small
net increase is a legitimate result of the stated bounded metric,
not an overall CLO3D parity claim or a physics milestone.

### Independent drafting canvas color check

Measured unoccupied lower-canvas patch (normalized
`x 220:330; y 650:750`):

- CLO reference median RGB: **(199, 199, 199)**.
- Garment Studio median RGB: **(197, 198, 200)**.

The neutral drafting background is already close. The blue/gray fabric
outline, selection overlays, production markings and different panel layout
were **not** scored for one-to-one material or garment similarity.

## Actual implementation changes

- `src/components/PatternEditor.jsx`: visible 2D title renamed to
  `2D Pattern Window` while retaining piece count/units.
- `src/components/PatternDraftingEnhancements.css`: compact 27-pixel
  2D titlebar, centered window title, single-column 35-pixel CAD utility
  strip and accessible tool-family flyouts. Active tool shows cyan accent.
- `src/components/RightToolPalette.jsx` and CSS: All Tools mode retains
  the complete **34 original CAD icon actions** in two vertical columns,
  removing the extra workflow-switch block in that mode only. The top
  Workspace selector continues to switch modes; Focused Tools mode retains
  its explicit quick workflow buttons. No new fake tool commands were added.
- `scripts/capture-clo-2d-reference.mjs`: now captures the entire local
  viewport for repeatable neighboring-toolbar comparison, validates the
  slim utility strip and main rail top offset, and checks for page errors.
- `scripts/qa-clo-2d-layout-diff.py`: fixed source/clone crop coordinates,
  private reference preservation, content masking, upstream algorithm,
  error-checked JSON report with limits.
- Two existing browser QA fixtures were updated to exercise the **current**
  actual behaviors: select tool explicitly before testing synchronized
  2D/3D selection; target the renamed create-and-apply Cotton Poplin
  command in the fabric library.

## Engineering tests

- `npm run capture:clo-2d`: PASS, correct geometry and zero page errors.
- `npm run check:2d-nonblocking`: PASS; dragging patterns still does
  not open the retired measurement popup or context menu.
- `node scripts/qa-viewport-selection-icons.mjs`: PASS after correcting
  the stale test flow to explicitly select the pattern tool.
- `node scripts/qa-clo-interface.mjs`: PASS after using the new material
  preset command's actual accessibility title.
- `npm run check:drafting-ui`: PASS.
- `npm run check:clo-layout-fabric-ui`: PASS.
- `npm run check:clo-parity-ci`: PASS.
- `npm run build`: PASS.

## Next gap

The larger remaining visible differences are the particular original icon
shapes/typography, 2D tool family count and grouping, asset browser,
object/property inspector styling, plus **unequal reference garment
geometry**. The current tooling can repeat the exact same cropped comparison
for later revisions, but full CLO3D visual and functional equivalence
requires additional matched-state references and behavioral acceptance.

Independent native garment fit is **still unresolved**. No static screenshot
or UI layout change certifies correct sewing/PPF collision and drape.
