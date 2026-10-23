# Native feature map and rewrite entry points

Reviewed against `main` at `e569ac1bbe82fca2c5c0339f1ada551380ed4fc4`
on 23 October 2026. This is a code-oriented inventory, not a product-parity
claim, benchmark or second assignment board. Start with [COORDINATION.md](../COORDINATION.md),
then use the [task catalog](../coordination/TASKS.md) and its live board before
editing. A task's static eligibility does not mean that its files are free.

This review follows FireflyTheReal's [PR #5](https://github.com/erythrofr/ClothCraft/pull/5),
head `74cd0157de5aa51e90172f59fd79dc01e05b25f5`. Its useful contribution is the
family-by-family inventory and explicit separation of missing features from
implemented behavior. The table below is a fresh reconciliation with current
Rust callers and the EXO task IDs. It does not import EXO implementation code.

## What an agent can actually build on

“Present” means a real native path exists, not that the entire family is
production-ready. “Partial” names the useful subset and its limits. “Pending”
means an open contribution is not part of this audited main revision.

| Family | Native state at the audited revision | Evidence / entry point | Next catalog work |
|---|---|---|---|
| Documents | Partial: Open/Save/Save As, accepted simulation state, portable avatar assets and dirty-session recovery every 60 seconds. No multi-document workspace or versioned recovery history. | [Document contract](documents-and-sewing.md), `atelier/documents_ui.rs` | A tabs/history proposal needs its own reviewed scope; no invented task ID. |
| Workspace | Partial: resizable 2D/3D panes, Piece/Fabric properties, radial tools, context actions and preferences. No searchable command palette. | [Workspace](workspace-ui.md), `atelier/layout.rs`, `atelier/radial.rs` | EXO-UX-001 registry, then EXO-UX-002 search; EXO-UX-003 saved layouts. PR #29 remains pending. |
| Selection | Partial: linked 2D/3D panel and boundary selection; 2D point box/lasso, group moves and semantic clipboard. Do not infer a full group 3D transform workflow. | [Editor controls](editor-basics.md), `atelier/selection.rs` | EXO-UX-004 group 3D transforms. |
| Drawing | Partial: polygon, rectangle, ellipse, arc sector, cubic contours, internal paths, booleans and new freehand panels. Freehand replaces neither existing sewn contours nor holes. | [Authoring](authoring.md), `atelier/board.rs`, `garment/freehand.rs` | EXO-CAD-003 reference migration before EXO-CAD-006 existing-contour editing and EXO-CAD-007 hole tools. |
| Numeric construction | CPU line construction API is present; the projection/distance/perpendicular inspector is pending in PR #38, not in this base. Existing numeric point and size controls remain available. | `authoring/constructions.rs`, [PR #38](https://github.com/erythrofr/ClothCraft/pull/38) | EXO-CAD-002; do not duplicate that integration. |
| Symmetry | Partial: independent mirrors and bidirectional linked pairs, unlink, undo and semantic copy. No symmetry within one panel; no arbitrary relation graph. | [Panel tools](panel-tools.md), `authoring/linked.rs` | EXO-CAD-004 unfold after topology-reference work; a linked pair is not an unfolded panel. |
| Measurement | Partial: read-only board ruler with distance, X/Y and angle; boundary lengths and net rest area/mass. No persistent POM or 3D geodesic tape. | `atelier/measure.rs`, [Production metrics](production-metrics.md) | EXO-MFG-006 persistent POM after required reviews. |
| Sewing | Partial: full/partial named boundaries, ordered multi-edge chains, direction and explicit easing, internal sewing. These are not turned seams, seam tape or a physical zipper. | [Sewing contract](documents-and-sewing.md), `garment/seam.rs` | EXO-SEW-001 audit; EXO-SEW-002/003 annotations; EXO-SEW-004 physical closures and EXO-SEW-005 elastic/gathering mechanics. |
| Allowances, notches, darts | Unmerged proposals need reconciliation. Compiler sewing correspondence is not a complete notch authoring/printing workflow. | [PR #1](https://github.com/erythrofr/ClothCraft/pull/1), [#6](https://github.com/erythrofr/ClothCraft/pull/6), [#7](https://github.com/erythrofr/ClothCraft/pull/7) | EXO-REV-001/002 first, then EXO-CAD-008 offsets. |
| Placement and avatar | Partial: OBJ avatar surface intake and panel translation/rotation. No complete body landmarks, body-aware wrapping or persistent pin editor. | [Arrangement workflow](authoring.md), `atelier/gizmo.rs` | EXO-AV-001 landmarks, EXO-AV-002 arrangement, EXO-AV-003 pins/freeze; EXO-AV-004 collision diagnostics. |
| Physics | Research prototype: CPU / hybrid GPU VBD + OGC; historical Newton reference. Alternative solver laboratory candidates are not production editor backends. Residual motion, dense-mesh cost and difficult cases remain. | [Architecture](architecture.md), [Solver challenge](solver-challenge.md) | EXO-PHY-001 capability contract and EXO-PHY-002 comparisons. No solver change justified by a feature checklist. |
| Fabric and appearance | Partial: shared mechanical properties, panel grain and estimated presets. No calibrated universal fabric database or complete PBR/texture authoring pipeline. | [Fabric evidence](fabrics.md) | EXO-LOOK-001/002 mechanics/appearance separation and rendering; EXO-LOOK-003/004 maps/assets; EXO-LOOK-005/006 graphics. |
| Manufacturing | Net material metrics exist. Cut quantities, grading, validated cutting markers, costs, BOM and technical packs are future work. Net mesh area is not purchased yardage. | [Production metrics](production-metrics.md) | EXO-MFG-002 through EXO-MFG-014, in manifest dependency order. |
| Exchange | Partial: editable JSON; OBJ geometry intake/output; SVG preview. No apparel DXF, glTF/GLB or physical PDF implementation on this base. | [Direction-specific format matrix](interoperability.md), `garment/export.rs` | EXO-REV-003 reviews physical SVG PR #3; EXO-IO-001 through EXO-IO-008 cover separate adapters. |
| Templates | Built-in examples and external generator links exist, not an integrated online pattern importer or provenance-aware library. | [Pattern library investigation](drafting-tools.md#web-pattern-library-investigation) | EXO-UX-005 template browser. |
| Animation and rendering | Interactive viewport exists. Complete timeline, animated avatar/cache exchange and offline production rendering are not supplied by the current editor. | [Roadmap](../ROADMAP.md), [Interchange](interoperability.md) | EXO-LOOK-007/008 stage/stills; animation needs a separate reviewed model and scope. |

## Corrections to the original proposal

The PR #5 status table is historical. In particular:

- Save already includes the accepted simulation state, and dirty-session
  recovery runs periodically; it is not limited to snapshots on manual writes.
- Pane resizing, the board ruler and linked mirrored editing already exist.
- Freehand creation has since landed, while numeric construction UI is pending.
- “Cloth simulation implemented” must not be read as completion of an entire
  commercial simulation family, soft bodies or validated Metal acceleration.
- A linked mirror, net material report or preview SVG does not establish
  unfolding, a manufacturing BOM or print-to-scale support respectively.
- Proposed historical IDs such as `DRAW-03` are not reservations. Use EXO IDs
  in the canonical manifest, and retain its dependencies and review gates.

The source changes associated with the lint-only [PR #4](https://github.com/erythrofr/ClothCraft/pull/4)
(`43018fc959b311a6029bb0ffc586619786938e50`, FireflyTheReal) are already represented
in `tests/drafting_tools.rs`: `as_chunks::<3>().0.iter()` and
`DVec3::from_array(*p)`. No second patch is needed. That observation does not
mean PR #4 itself was merged. See EXO-REV-004's issue for executed checks.

## Public reference scope

The [Marvelous manual index](https://www.marvelousdesigner.com/manuals) was
read on 23 October. Its visible categories include drawing/editing, sewing,
arrangement, measurements, fabrics, trims, animation and interchange. Those
headings help organize this inventory; they do not specify algorithms or
prove detailed feature parity. Previously read individual articles are
recorded in [the source ledger](manual-study.md).

PR #5 reports consulting CLO's product page, release-feature JSON and manual
index. During this review, the CLO product page returned a JavaScript/bot
verification shell and its support category could not be fetched. The
release-feature JSON was not re-read. Their detailed claims are therefore
attributed to the proposal, not presented as independently verified here.
No proprietary source, icons or assets were imported.

Hosted accounts, external AI generation and vendor hardware are outside this
native rewrite slice. Their appearance in a commercial manual does not
automatically add them to ClothCraft's accepted backlog.
