# Public-manual behavior ledger

## Feature-map reconciliation (2026-10-23)

The [native feature map](feature-map.md) reconciles FireflyTheReal's PR #5
(`74cd0157de5aa51e90172f59fd79dc01e05b25f5`) with main at `e569ac1` and the
canonical EXO task catalog. It corrects historical missing-feature claims
for saved simulation state, periodic recovery, linked mirrors, pane resizing
and the board ruler. Pending PRs remain separate from merged capabilities.

Actually re-read: the visible category index at
<https://www.marvelousdesigner.com/manuals>. This establishes category names,
not detailed behavior or implementation internals. The CLO product URL
<https://www.clo3d.com/en/product/clo> returned a JavaScript/bot verification
shell; <https://support.clo3d.com/hc/en-us/categories/115000064648> could not be
fetched. PR #5's reported release-JSON readings were not repeated and remain
attributed to that contribution. No new detailed CLO behavior is asserted.
The existing dated article records below retain their original reading scope.

## Essential-tool review (2026-10-15)

The [essential-authoring-tool report](essential-authoring-tools.md) records the newly consulted official CLO/Marvelous sources, a current code audit, a prioritized minimum toolkit and acceptance cases. This extends the older backlog with organization/visibility, explicit simulation states, measurement/grain editing and Cut / Cut & Sew; it distinguishes 3D authoring from manufacturing requirements. No implementation or GPU validation was performed during this research pass. Tool priorities are our recommendation, not a ranking supplied by the manuals.

Read on 2026-10-14. Entry point: [Marvelous Designer manuals](https://www.marvelousdesigner.com/manuals). The current site exposes section shells; the linked official support articles provide the actual text. No proprietary code, tutorial assets, screenshots or interface artwork were imported into ClothCraft.

| Official article actually read | Behavior identified (paraphrase) | Independent ClothCraft scope | Remaining work |
|---|---|---|---|
| [Polygon](https://support.marvelousdesigner.com/hc/en-us/articles/47358178952345-Polygon) | Build a contour with successive points, close it, cancel points or the operation | Meter-based canvas, 10 mm snap, straight contour validation, either winding, Delaunay compilation | Precise lengths, holes and symmetry (editable points/curves implemented in the follow-up below) |
| [Segment Sewing (2D)](https://support.marvelousdesigner.com/hc/en-us/articles/47358199517209-Segment-Sewing-2D) | Pair boundaries, inspect direction and length difference | Two named full edges, endpoint labels, length delta, explicit reversal/easing and penalty seam | Internal/free sewing; basic correspondence lines are implemented in the follow-up below |
| [Move/Rotate Pattern with Gizmo](https://support.marvelousdesigner.com/hc/en-us/articles/47358192192665-Move-Rotate-Pattern-with-Gizmo) | Manipulate a selected panel with directional translation and rotation controls while simulation is off | Independent world-axis arrows/rings, numeric placement, release-to-commit, Escape-to-cancel | Plane handles, local axes and body arrangement guides |

Implementation choices come from our own data and solver contracts: meters in rest coordinates, immutable compiled topology, named edges, whole-document validation, generation invalidation and template history. Similar workflow intent does not imply identical implementation, full feature parity or formal clean-room certification.

## Initial study queue (superseded by the dated follow-ups)

- Internal lines, holes, precise dimensions and symmetry; basic curve/point editing is implemented.
- Free sewing, 1:N / M:N sewing, notch and seam property tools.
- Arrangement points, bounding volumes and body-aware placement.
- Fabric editing, simulation controls and failure diagnostics.
- Import/export entities, options and fidelity checks, mapped to [our format requirements](../ROADMAP.md#interoperability).

For each new family, record the exact public URL, date, a short paraphrase, an independently written behavior specification, edge cases and status. Do not paste manual pages or treat undocumented internals as known.

## Internal drafting follow-up (2026-10-15)

Read [Internal Polygon/Line](https://support.marvelousdesigner.com/hc/en-us/articles/47358276422297-Internal-Polygon-Line): draw paths within a pattern using successive points and curved gestures. ClothCraft now has its own open internal Bézier paths, editable handles and whole-path sewing in 2D/3D, plus an eased-strip helper for ruffles. Numeric primitives, independent mirrors and polygon booleans/holes are also implemented. Linked symmetry, offsets, joined/crossing paths and fold arrangement remain absent. [Data, tests and limits](drafting-tools.md) supersede the historical status cells below.

Also read the official FreeSewing Teagan, Titan and Jett pages, commercial-use FAQ and export guide linked in [the pattern-library investigation](drafting-tools.md#web-pattern-library-investigation). The UI links to their generator. JSON/YAML are settings exports; SVG carries geometry. No imported online pattern, generator integration or automatic seam inference is claimed.

## Unified-board follow-up (2026-10-14)

Read [Edit AI Bezier Curve](https://support.marvelousdesigner.com/hc/en-us/articles/47358445584537-Edit-AI-Bezier-Curve) and [3D Segment Sewing](https://support.marvelousdesigner.com/hc/en-us/articles/47358302592409-3D-Segment-Sewing-VER4-2-0). The observed behaviors are editable curve handles, conversion between straight/curved boundaries, and pairing garment segments directly in 3D with shared seam visibility. ClothCraft now provides independent implementations of those basic interactions; modifier conventions and complete feature parity are not claimed.

The [W3C SVG path specification](https://www.w3.org/TR/SVG/paths.html) defines the cubic representation (two endpoints and two controls). ClothCraft uses that standard representation with its own de Casteljau subdivision, a fixed 0.25 mm tolerance, and stable edge-name reconstruction after meshing. Source curves and sewing identities are preserved; exact curve intersection predicates remain outside this version.

## Workspace and interchange follow-up (2026-10-14)

Visually inspected the [CLO workspace screenshot in its support community](https://support.clo3d.com/hc/en-us/community/posts/32258824030361-Stitch-line-sewing-1-away-from-fabric-when-simulated) and the [Marvelous Designer workspace in this artist's test](https://www.behance.net/gallery/188719303/Marvelous-Designer-Tests-First-Renders). These are visual references, not specifications of current releases. Both show a 3D view beside a shared 2D board, contextual tool areas and object/properties panels. Images were viewed in the browser and were not copied into the repository.

Also read the official [Marvelous UI settings](https://support.marvelousdesigner.com/hc/en-us/articles/47358169509273-User-Interface-Above-ver4-2-0), [2025 UI changes](https://support.marvelousdesigner.com/hc/en-us/articles/47358126161177-UI-Changes-Ver-2025-0) and [segment sewing](https://support.marvelousdesigner.com/hc/en-us/articles/47358199517209-Segment-Sewing-2D). Grouped tools, a clear selected/hover state and correspondence direction are useful workflow principles. ClothCraft independently implements a compact grouped toolbar, a real piece browser, contextual properties, sparse colored seam links, endpoint ticks and a pending-seam label. No proprietary icons, asset browser or nonfunctional menus were copied.

The format review is recorded separately in [interoperability.md](interoperability.md), with source URLs, implemented subsets and distinct import/export milestones. The full CLO/Marvelous manuals have not been exhaustively reviewed. Feature resemblance is not evidence of algorithm equivalence or complete compatibility.

## Authoring backlog review (2026-10-14)

Revisited the [official manual index](https://www.marvelousdesigner.com/manuals) and read the nine official support articles linked below. This pass extends planning, not the authoring implementation. Article descriptions are brief behavioral paraphrases; the proposed storage, solver and test contracts are our own engineering decisions. Existing lower-level support is called out separately from missing UI tools.

| Source ID / article actually read | Behavior observed | Current ClothCraft status | Independent next slice / edge case |
|---|---|---|---|
| MD-01 · [Add Point/Split Line](https://support.marvelousdesigner.com/hc/en-us/articles/47358427280153-Add-Point-Split-Line) | Insert a point by clicking or specifying a length, ratio or equal subdivision count | Existing anchors move; contour point insertion/removal and measured splits are absent | DRAW-02: split material arclength and migrate named boundary references transactionally; account for sewn curves and zero-length pieces |
| MD-02 · [Free Sewing (2D)](https://support.marvelousdesigner.com/hc/en-us/articles/47358239854361-Free-Sewing-2D) | Choose seam endpoints freely, inspect direction and length differences, use a matching-length guide | UI joins whole named edges; compiler already supports trimmed boundary ranges | SEW-01: editable partial ranges shared by 2D/3D, numeric metric lengths and explicit easing; reject zero/overlapping invalid ranges without losing the draft |
| MD-03 · [Linked Editing](https://support.marvelousdesigner.com/hc/en-us/articles/47358366174233-Linked-Editing) | Mirror/instance copies can share edits; relations can be applied or removed | Duplication exists, linked editing/symmetry does not | DRAW-03: explicit relation graph and unlink transaction; preserve orientation and avoid recursive updates |
| MD-04 · [Offset as Internal Line](https://support.marvelousdesigner.com/hc/en-us/articles/47358442871705-Offset-as-Internal-Line) | Offset a contour or segment by chosen distances, optionally repeatedly or toward either side | No internal-line model, offset tool or holes | DRAW-04: distinguish guides, cuts and structural lines; test concave/self-crossing offsets rather than silently repairing them |
| MD-05 · [1:N Free Sewing](https://support.marvelousdesigner.com/hc/en-us/articles/47358236137113-1-N-Free-Sewing-2D) and [M:N Free Sewing](https://support.marvelousdesigner.com/hc/en-us/articles/47358268690585-M-N-Free-Sewing-2D) | Compose ordered seam sides across multiple pieces, check lengths/direction and cancel the last or entire draft | No chain editor or chain-level sewing entity; pairwise compiler has explicit notch correspondence | SEW-02: ordered semantic ranges plus cumulative material arclength; test discontinuities, reversal, easing and partial cancellation |
| MD-06 · [Arrangement Points / Flip Wrap Direction](https://support.marvelousdesigner.com/hc/en-us/articles/47358262924185-Arrange-Pattern-with-Arrangement-Points-Flip-Wrap-Direction) | Body-volume anchors offer placement previews and wrapping; gizmos refine placement | Only manual flat arrangement and numeric/gizmo transforms exist | ARR-01: independent anchor frames and clearance diagnostics for the supported avatar; flat placement first, curved wraps only after intersection checks exist |
| MD-07 · [Pins](https://support.marvelousdesigner.com/hc/en-us/articles/47358146159769-Pins) | Create/remove point or region pins in either view; optionally attach to the avatar | Static template pins and transient barycentric grabbing exist; no complete persistent pin editor | SIM-01: persist material locations, expose attachment semantics and separate world/avatar targets; define remesh behavior before adding region selection |
| MD-08 · [Fold Arrangement](https://support.marvelousdesigner.com/hc/en-us/articles/47358260153881-Fold-Arrangement) | Arrange a fold about an internal line before simulation, with a rotation control | Whole-panel rotation exists; local fold arrangement does not | ARR-02: piecewise placement with preview/undo, independent from rest geometry or a constitutive crease; reject invalid initial contact |

The [concrete backlog](../ROADMAP.md#3-concrete-authoring-backlog-from-the-manual-study) maps these sources to priorities, prerequisites and observable completion criteria. Save/recovery and realtime quality gates are ClothCraft project needs, not behaviors inferred from an unread page. No article establishes the proprietary solver's internal algorithm. Darts, trims, complete manufacturing workflows and the rest of the manual remain a future reading queue.


## Viewport controls follow-up (2026-10-15)

Read the official [3D Window](https://support.marvelousdesigner.com/hc/en-us/articles/47358233197593-3D-Window) and [3D Window Display Icons](https://support.marvelousdesigner.com/hc/en-us/articles/47358200025497-3D-Window-Display-Icons) articles. They describe a dedicated 3D work area with local display controls, including grid/shadow and surface visibility. Visually inspected the screenshot supplied by the user; an official linked online image was found but not successfully displayed. Our independent implementation groups display controls behind a gear dropdown, prioritizes two resizable canvases, and uses our own vector icons. [Implemented features and render limits](workspace-ui.md); no product parity or GPU acceptance is claimed.
