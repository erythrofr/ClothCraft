# Rust rewrite task catalog

Generated from `coordination/tasks.json` with `node scripts/rewrite-tasks.mjs markdown`. Do not edit this view directly.

[Start and claim work](../COORDINATION.md) · [Live assignments](https://github.com/erythrofr/ClothCraft/issues/8) · [Feature audit](../docs/exo-feature-audit.md)

Manifest status describes eligibility, not current ownership. A ready task may already be claimed: check the live board and wait for acknowledgement. Blocked tasks are planning briefs; review_existing means review the linked contribution before implementing anything.

Reference: [mikristian/exo-sample-3d@352c6086b622](https://github.com/mikristian/exo-sample-3d/tree/352c6086b622caeda95f16d9bd923624b95e05d9). Reading evidence is not runtime validation.

| Task | Area | Status | Dependencies | Discussion |
|---|---|---|---|---|
| [EXO-COORD-001](#exo-coord-001) — Verify live task claim, heartbeat and release coordination | coordination | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/9) |
| [EXO-CORE-001](#exo-core-001) — Agree editor, document and solver ownership contract | architecture | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/10) |
| [EXO-CORE-002](#exo-core-002) — Record provenance and licensing for candidate contributions | provenance | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/11) |
| [EXO-REV-001](#exo-rev-001) — Reconcile the two notch and allowance contributions | review | review_existing | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/12) |
| [EXO-REV-002](#exo-rev-002) — Split and review darts, persistent POM and cutline proposal | review | review_existing | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/13) |
| [EXO-REV-003](#exo-rev-003) — Review physical SVG output contribution | review | review_existing | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/14) |
| [EXO-REV-004](#exo-rev-004) — Reconcile feature map and current stable lint contributions | review | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/15) |
| [EXO-REV-005](#exo-rev-005) — Extract reviewable boundaries from the EXO Studio and session proposal | review | review_existing | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/16) |
| [EXO-CAD-001](#exo-cad-001) — Implement exact numeric construction operations | cad | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/17) |
| [EXO-CAD-002](#exo-cad-002) — Add numeric construction inspector actions | cad | done | EXO-CAD-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/36) |
| [EXO-CAD-003](#exo-cad-003) — Define topology reference migration for pattern edits | cad | blocked | EXO-CORE-001, EXO-REV-001, EXO-REV-002 | Not registered |
| [EXO-CAD-004](#exo-cad-004) — Unfold one half-pattern across a straight fold edge | cad | blocked | EXO-CAD-003 | Not registered |
| [EXO-CAD-005](#exo-cad-005) — Add bounded-error freehand-to-Bezier fitting | cad | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/18) |
| [EXO-CAD-006](#exo-cad-006) — Connect freehand drawing to transactional contour editing | cad | blocked | EXO-CAD-005, EXO-CAD-003 | Not registered |
| [EXO-CAD-007](#exo-cad-007) — Edit hole contours with the existing point tools | cad | blocked | EXO-CAD-003 | Not registered |
| [EXO-CAD-008](#exo-cad-008) — Implement offset paths and cutline corner policy | cad | blocked | EXO-REV-001, EXO-REV-002 | Not registered |
| [EXO-SEW-001](#exo-sew-001) — Add a read-only sewing construction audit | sewing | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/19) |
| [EXO-SEW-002](#exo-sew-002) — Define authored trims and construction annotations | sewing | blocked | EXO-CORE-001 | Not registered |
| [EXO-SEW-003](#exo-sew-003) — Add trim editing, picking and previews | sewing | blocked | EXO-SEW-002 | Not registered |
| [EXO-SEW-004](#exo-sew-004) — Specify and validate physical zipper or button closure | physics | blocked | EXO-SEW-002, EXO-PHY-001 | Not registered |
| [EXO-SEW-005](#exo-sew-005) — Define elastic seam and gathering mechanics | physics | blocked | EXO-SEW-001, EXO-PHY-001 | Not registered |
| [EXO-MFG-001](#exo-mfg-001) — Report net material area and mass from rest geometry | manufacturing | done | — | Not registered |
| [EXO-MFG-002](#exo-mfg-002) — Add cut quantities and manufacturing metadata | manufacturing | blocked | EXO-CORE-001, EXO-REV-001 | Not registered |
| [EXO-MFG-003](#exo-mfg-003) — Define sizes and point grading rules | manufacturing | blocked | EXO-CORE-001, EXO-CAD-003 | Not registered |
| [EXO-MFG-004](#exo-mfg-004) — Generate and validate a graded size run | manufacturing | blocked | EXO-MFG-003 | Not registered |
| [EXO-MFG-005](#exo-mfg-005) — Add grading table and size preview UI | manufacturing | blocked | EXO-MFG-004 | Not registered |
| [EXO-MFG-006](#exo-mfg-006) — Expose persistent POM measurements and size reports | manufacturing | blocked | EXO-REV-002, EXO-MFG-004 | Not registered |
| [EXO-MFG-007](#exo-mfg-007) — Define cutting-marker inputs and validity checks | manufacturing | blocked | EXO-MFG-002, EXO-CAD-008 | Not registered |
| [EXO-MFG-008](#exo-mfg-008) — Implement a deterministic baseline cutting layout | manufacturing | blocked | EXO-MFG-007 | Not registered |
| [EXO-MFG-009](#exo-mfg-009) — Add marker inspection and physical SVG export | manufacturing | blocked | EXO-MFG-008, EXO-REV-003 | Not registered |
| [EXO-MFG-010](#exo-mfg-010) — Compute transparent fabric cost estimates | manufacturing | blocked | EXO-MFG-008 | Not registered |
| [EXO-MFG-011](#exo-mfg-011) — Export a bill of materials | manufacturing | blocked | EXO-MFG-002, EXO-SEW-002 | Not registered |
| [EXO-MFG-012](#exo-mfg-012) — Export a revision-stamped HTML technical pack | manufacturing | blocked | EXO-MFG-006, EXO-MFG-011 | Not registered |
| [EXO-MFG-013](#exo-mfg-013) — Add manufacturing preflight diagnostics | manufacturing | blocked | EXO-MFG-004, EXO-MFG-008, EXO-MFG-011 | Not registered |
| [EXO-MFG-014](#exo-mfg-014) — Package consistent manufacturing artifacts | manufacturing | blocked | EXO-MFG-010, EXO-MFG-012, EXO-MFG-013, EXO-IO-003 | Not registered |
| [EXO-IO-001](#exo-io-001) — Import a documented SVG pattern subset | interchange | blocked | EXO-CORE-001 | Not registered |
| [EXO-IO-002](#exo-io-002) — Import generic 2D DXF pattern entities | interchange | blocked | EXO-CORE-001 | Not registered |
| [EXO-IO-003](#exo-io-003) — Export generic DXF cut and sewing geometry | interchange | blocked | EXO-REV-002, EXO-MFG-002 | Not registered |
| [EXO-IO-004](#exo-io-004) — Add one industrial DXF dialect with independent fixtures | interchange | blocked | EXO-IO-002, EXO-IO-003, EXO-MFG-003 | Not registered |
| [EXO-IO-005](#exo-io-005) — Support OBJ and MTL material-aware round trips | interchange | blocked | EXO-LOOK-001 | Not registered |
| [EXO-IO-006](#exo-io-006) — Export static glTF/GLB garment assets | interchange | blocked | EXO-LOOK-001 | Not registered |
| [EXO-IO-007](#exo-io-007) — Import static glTF/GLB avatars | interchange | blocked | EXO-CORE-001 | Not registered |
| [EXO-IO-008](#exo-io-008) — Produce tiled physical PDF pattern sheets | interchange | blocked | EXO-REV-003, EXO-MFG-002 | Not registered |
| [EXO-LOOK-001](#exo-look-001) — Separate visual fabric properties from mechanics | appearance | blocked | EXO-CORE-001 | Not registered |
| [EXO-LOOK-002](#exo-look-002) — Render the basic fabric appearance model | appearance | blocked | EXO-LOOK-001 | Not registered |
| [EXO-LOOK-003](#exo-look-003) — Generate deterministic procedural textile maps | appearance | blocked | EXO-LOOK-001 | Not registered |
| [EXO-LOOK-004](#exo-look-004) — Import and manage fabric texture assets | appearance | blocked | EXO-LOOK-001 | Not registered |
| [EXO-LOOK-005](#exo-look-005) — Define material-space garment graphic placements | appearance | blocked | EXO-CORE-001 | Not registered |
| [EXO-LOOK-006](#exo-look-006) — Render and edit garment graphics | appearance | blocked | EXO-LOOK-005, EXO-LOOK-002 | Not registered |
| [EXO-LOOK-007](#exo-look-007) — Define reproducible stage, lighting and camera settings | appearance | blocked | EXO-CORE-001 | Not registered |
| [EXO-LOOK-008](#exo-look-008) — Render stages and export still images | appearance | blocked | EXO-LOOK-007 | Not registered |
| [EXO-AV-001](#exo-av-001) — Define avatar landmarks and body measurements | avatar | blocked | EXO-CORE-001 | Not registered |
| [EXO-AV-002](#exo-av-002) — Add body-aware panel arrangement assistance | avatar | blocked | EXO-AV-001 | Not registered |
| [EXO-AV-003](#exo-av-003) — Expose pin editing and an explicit freeze policy | avatar | blocked | EXO-CORE-001 | Not registered |
| [EXO-AV-004](#exo-av-004) — Show avatar collision coverage and initialization problems | avatar | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/20) |
| [EXO-UX-001](#exo-ux-001) — Publish a typed command capability registry | workspace | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/21) |
| [EXO-UX-002](#exo-ux-002) — Add a searchable command palette | workspace | blocked | EXO-UX-001 | Not registered |
| [EXO-UX-003](#exo-ux-003) — Persist workspace layouts and tool visibility | workspace | blocked | EXO-UX-001 | Not registered |
| [EXO-UX-004](#exo-ux-004) — Add group 3D transforms and marquee selection | workspace | blocked | EXO-CORE-001 | Not registered |
| [EXO-UX-005](#exo-ux-005) — Create a provenance-aware garment template browser | workspace | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/22) |
| [EXO-UX-006](#exo-ux-006) — Expose a versioned headless authoring session adapter | automation | blocked | EXO-CORE-001, EXO-REV-005, EXO-UX-001 | Not registered |
| [EXO-QA-001](#exo-qa-001) — Build public cross-editor behavioral fixtures | validation | blocked | EXO-CORE-001 | Not registered |
| [EXO-QA-002](#exo-qa-002) — Package a clean-machine Windows test release | release | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/23) |
| [EXO-QA-003](#exo-qa-003) — Verify native macOS and Linux build paths | release | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/24) |
| [EXO-PHY-001](#exo-phy-001) — Define capabilities for real interchangeable solver adapters | physics | blocked | EXO-CORE-001 | Not registered |
| [EXO-PHY-002](#exo-phy-002) — Compare candidate engines on shared quality gates | physics | blocked | EXO-PHY-001, EXO-QA-001 | Not registered |
| [EXO-PHY-003](#exo-phy-003) — Evaluate foam and padding as a separate material experiment | physics | blocked | EXO-PHY-001 | Not registered |
| [EXO-CAD-009](#exo-cad-009) — Integrate the freehand fitter and create new panels in the 2D workspace | cad | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/33) |
| [EXO-SEW-006](#exo-sew-006) — Expose cached sewing diagnostics in the native inspector | sewing | ready | EXO-SEW-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/43) |
| [EXO-QA-004](#exo-qa-004) — Exercise editor tools with a deterministic named-widget harness | validation | ready | EXO-SEW-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/47) |

## EXO-COORD-001

**Verify live task claim, heartbeat and release coordination**

Status: done. Dependencies: none.

**Files / directories**

- `scripts/coordination/`
- `docs/agent-coordination-protocol.md`

**Acceptance**

- Pass offline reducer tests for ownership, stale reservations, scope overlap and malformed requests.
- Exercise one authorized live claim, heartbeat and release on the canonical GitHub issue, verifying the public state after every command.
- Reject competing takeover of active or stale reservations; never execute code or shell text supplied in issue comments.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/blob/main/COORDINATION.md

Completed 22 October: 30 offline coordinator tests and 5 catalog tests pass. Live registration, claim, duplicate rejection, heartbeat, review and explicit release succeeded; hub observed with zero active claims. See docs/rewrite-hub-validation.md and issue #9. The coordinator does not wake remote agents.

## EXO-CORE-001

**Agree editor, document and solver ownership contract**

Status: ready. Dependencies: none.

**Files / directories**

- `docs/exo-contract.md`

**Acceptance**

- Document metres, stable panel/boundary IDs, rest/state separation and unsupported EXO fields.
- Specify which data is authoritative, revision preconditions, cache invalidation and version negotiation; include one synthetic interchange example.
- Maintain current Project v1 / GarmentTemplate v2 compatibility; no new backend selector.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_DATA_MODEL.md
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CONVERSION_STATUS_2026-10-18.md

A bounded design decision with maintainer approval, not a request to rewrite all schemas.

## EXO-CORE-002

**Record provenance and licensing for candidate contributions**

Status: ready. Dependencies: none.

**Files / directories**

- `docs/exo-provenance.md`

**Acceptance**

- Inventory exact upstream commits and licenses for each proposed code or asset transfer.
- Separate behavior-inspired original Rust work from copied/adapted EXO code; obtain owner decisions for any incompatible transfer.
- Do not import EXO assets, implementation or binaries merely because a task cites them.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/LICENSE
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/README.md

EXO declares GPL-3.0-only; ClothCraft is MIT. No license change is authorized by this backlog.

## EXO-REV-001

**Reconcile the two notch and allowance contributions**

Status: review_existing. Dependencies: none.

**Files / directories**

- `src/garment/polygon.rs`
- `src/garment/markings.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/atelier/board.rs`
- `src/atelier/authoring_ui.rs`
- `src/garment/export.rs`
- `tests/pattern_markings.rs`
- `src/garment/mod.rs`
- `src/atelier.rs`

**Acceptance**

- Compare PR1 and PR6 schema/semantics before choosing or reconciling them; avoid duplicate representations.
- Verify curved boundaries, round trips, mirror/split/delete behavior and metadata-only state preservation.
- Report provenance and rebase/test on current main; merge only after review.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/patternSewingNotches.js
- https://github.com/erythrofr/ClothCraft/pull/1
- https://github.com/erythrofr/ClothCraft/pull/6

Existing proposals are not merged or independently validated by the inventory. Shared model edits need exclusive ownership.

## EXO-REV-002

**Split and review darts, persistent POM and cutline proposal**

Status: review_existing. Dependencies: none.

**Files / directories**

- `src/garment/cutline.rs`
- `src/garment/curves.rs`
- `src/garment/domain.rs`
- `src/garment/seam.rs`
- `src/garment/polygon.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `tests/cutline_production.rs`
- `tests/persistent_pom_references.rs`
- `src/garment/mod.rs`

**Acceptance**

- Separate authoring, document migration, adapter and physics changes in PR7 before integration.
- Check cut-and-sew dart topology, boundary identity, POM migration and actual cutline units against original fixtures.
- Explicitly review src/vbd.rs and src/gpu_vbd.rs changes separately; no solver modification may enter via an authoring review unnoticed.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativePatternExportPreparation.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/measurements.js
- https://github.com/erythrofr/ClothCraft/pull/7

PR7 touches physics as well as CAD. This task reviews authoring slices; it does not authorize promoting its solver changes.

## EXO-REV-003

**Review physical SVG output contribution**

Status: review_existing. Dependencies: none.

**Files / directories**

- `src/garment/export.rs`
- `src/bin/cloth-template.rs`
- `tests/pattern_print_svg.rs`
- `docs/interoperability.md`
- `src/garment/mod.rs`

**Acceptance**

- Inspect PR3 physical dimensions, viewBox, layout and curve fidelity.
- Check a known 100 mm fixture in an independent SVG consumer.
- Retain preview export separately and document print/allowance limits.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/markerArtifacts.js
- https://github.com/erythrofr/ClothCraft/pull/3

Review an existing contribution instead of reimplementing it in parallel.

## EXO-REV-004

**Reconcile feature map and current stable lint contributions**

Status: done. Dependencies: none.

**Files / directories**

- `docs/feature-map.md`
- `docs/manual-study.md`
- `tests/drafting_tools.rs`

**Acceptance**

- Check PR4 against the current supported compiler and avoid duplicating an already fixed lint.
- Merge useful PR5 source references into one roadmap without claiming listed methods are implemented.
- Reconcile references with this task ledger, retaining contributor attribution.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_FEATURE_ATLAS.md
- https://github.com/erythrofr/ClothCraft/pull/4
- https://github.com/erythrofr/ClothCraft/pull/5
- https://github.com/erythrofr/ClothCraft/pull/39

The 22 October bootstrap incorporates the PR4-equivalent chunks_exact-to-as_chunks test fix, credits FireflyTheReal commit 43018fc959b311a6029bb0ffc586619786938e50, and extends it across research tests/examples for Clippy 1.99. PR4 is not merged; PR5 feature-map review remains open. Do not replace the canonical task registry with a second assignment board. Completed in merged PR #39; all 12 CI checks passed before merge.

## EXO-REV-005

**Extract reviewable boundaries from the EXO Studio and session proposal**

Status: review_existing. Dependencies: none.

**Files / directories**

- `docs/exo-integration-review.md`

**Acceptance**

- Inventory PR2 components and separate web application, assets, native bridge and Rust candidates.
- Compare the exo-session portion of PR7 with the proposed versioned editor contract.
- Produce small follow-up slices; do not merge the 1868-file application snapshot as a Rust rewrite.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CONVERSION_STATUS_2026-10-18.md
- https://github.com/erythrofr/ClothCraft/pull/2
- https://github.com/erythrofr/ClothCraft/pull/7

At audit time PR2 had 2212998 additions. Counts are review scope, not functional completeness.

## EXO-CAD-001

**Implement exact numeric construction operations**

Status: done. Dependencies: none.

**Files / directories**

- `src/authoring/constructions.rs`
- `tests/constructions.rs`
- `src/authoring.rs`

**Acceptance**

- Provide finite, unit-aware point projection, distance-along-line and line intersection operations.
- Reject degenerate/parallel inputs explicitly; test rotated and translated cases.
- Keep a pure CPU API independent of editor/model mutation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingConstructions.js
- https://github.com/erythrofr/ClothCraft/pull/26

Merged #26 (61833c6). Five CPU construction tests and one doctest passed; CI passed before merge. Original Rust implementation, no upstream source translation.

## EXO-CAD-002

**Add numeric construction inspector actions**

Status: done. Dependencies: EXO-CAD-001.

**Files / directories**

- `src/authoring.rs`
- `src/atelier/authoring_ui.rs`
- `tests/drawing_commands.rs`
- `docs/authoring.md`
- `docs/handoff.md`

**Acceptance**

- Expose projection, perpendicular and distance actions on stable selected points.
- One validated edit creates one undo record; invalid edits leave the document unchanged.
- Verify text focus and visible units with headless UI events.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingPrecision.js
- https://github.com/erythrofr/ClothCraft/pull/38

Point inspector integration using the original Rust API from #26. No src/atelier.rs edits: EXO-UX-001 owns that file. Selected contour point references use panel and named boundary identity; projection, signed distance and perpendicular offset use straight reference edges only. Completed in merged PR #38; all 12 CI checks passed before merge.

## EXO-CAD-003

**Define topology reference migration for pattern edits**

Status: blocked. Dependencies: EXO-CORE-001, EXO-REV-001, EXO-REV-002.

**Files / directories**

- `src/authoring/topology_refs.rs`
- `tests/topology_refs.rs`
- `src/authoring.rs`

**Acceptance**

- Specify mapping of stable boundaries, partial seams, markings, POM and linked mirrors through split/merge.
- Reject ambiguous migrations rather than dropping references.
- Round-trip a curved sewn fixture and verify identity and material coordinates.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingTopology.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CUTLINE_REFERENCE_PRESERVATION_20261018.md



## EXO-CAD-004

**Unfold one half-pattern across a straight fold edge**

Status: blocked. Dependencies: EXO-CAD-003.

**Files / directories**

- `src/authoring/unfold.rs`
- `src/authoring.rs`
- `tests/unfold.rs`

**Acceptance**

- Produce one valid full contour with reflected curves and material metadata.
- Handle/reject seams, marks and holes on the fold with explicit rules.
- Preserve original document on overlap/degeneracy; undo restores exact prior template.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingUnfold.js

A one-time unfold is distinct from linked symmetry between two separate panels.

## EXO-CAD-005

**Add bounded-error freehand-to-Bezier fitting**

Status: ready. Dependencies: none.

**Files / directories**

- `src/garment/freehand.rs`
- `tests/freehand.rs`
- `src/garment/mod.rs`

**Acceptance**

- Fit finite 2D samples with cubic segments and a stated maximum error.
- Handle duplicates, corners, tiny strokes and input/output limits deterministically.
- Keep sampling in material metres; fitting alone must not create a panel.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/vectorFreehandFit.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/vectorPatternBezier.js



## EXO-CAD-006

**Connect freehand drawing to transactional contour editing**

Status: blocked. Dependencies: EXO-CAD-005, EXO-CAD-003.

**Files / directories**

- `src/atelier/board.rs`
- `src/authoring.rs`
- `tests/freehand_authoring.rs`
- `src/atelier.rs`

**Acceptance**

- Preview a stroke then commit only valid closed geometry.
- Preserve curve/boundary identity policy and explicit cancellation.
- Undo/save/reload reproduce the fitted contour.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/vectorFreehandFit.js



## EXO-CAD-007

**Edit hole contours with the existing point tools**

Status: blocked. Dependencies: EXO-CAD-003.

**Files / directories**

- `src/atelier/board.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `tests/hole_editing.rs`
- `src/atelier.rs`

**Acceptance**

- Select and edit hole anchors/curves with unambiguous contour scope.
- Reject hole/outside-boundary or hole/hole intersections atomically.
- Preserve outer sewing references and verify remeshing cache invalidation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingTopology.js



## EXO-CAD-008

**Implement offset paths and cutline corner policy**

Status: blocked. Dependencies: EXO-REV-001, EXO-REV-002.

**Files / directories**

- `src/garment/offsets.rs`
- `tests/offsets.rs`
- `src/garment/mod.rs`

**Acceptance**

- Offset straight and sampled curved paths with explicit join/cap/tolerance policy.
- Handle concave corners, narrow radii, holes and self-intersections with diagnostics.
- Keep sewing/rest contours separate from manufacturing cutlines.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/patternAllowancePreview.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativePatternExportPreparation.js

Coordinate with reviewed cutline implementation; extend it instead of adding a competing offset engine.

## EXO-SEW-001

**Add a read-only sewing construction audit**

Status: done. Dependencies: none.

**Files / directories**

- `src/garment/seam.rs`
- `src/garment/seam/audit.rs`
- `src/bin/cloth-template.rs`
- `tests/sewing_audit.rs`
- `docs/sewing-audit.md`

**Acceptance**

- Report lengths, easing intervals, dangling references and seam junction degree using stable IDs.
- Reuse compiler correspondence including partial/chained/reversed intervals.
- Distinguish authored mismatch from measured simulated seam gap; never alter the solver.
- Provide a headless CLI report with explicit units, deterministic diagnostics and documented invalid-input behavior.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sewingConstruction.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sewingLengthDiagnostics.js
- https://github.com/erythrofr/ClothCraft/pull/41

Merged as 0d5384a after all 12 CI checks passed. CPU-only garment::seam::audit and cloth-template audit-sewing report compiler-based material lengths, local easing, invalid references/correspondence, overlapping ownership and exact shared endpoints. Fifteen new tests passed; docs/sewing-audit.md states limits. No solver or document schema changes. UI presentation is EXO-SEW-006.

## EXO-SEW-002

**Define authored trims and construction annotations**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/trims.rs`
- `tests/trim_model.rs`
- `src/garment/mod.rs`

**Acceptance**

- Represent buttons, buttonholes, zipper paths and topstitch rows by material-space attachments.
- Validate units, IDs and supported geometry; preserve old document loads.
- Mark each object as visual/manufacturing metadata unless a real physical adapter exists.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/trims.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/hardwareStyleProperties.js



## EXO-SEW-003

**Add trim editing, picking and previews**

Status: blocked. Dependencies: EXO-SEW-002.

**Files / directories**

- `src/atelier/trims_ui.rs`
- `src/atelier/board.rs`
- `src/render.rs`
- `tests/trim_authoring.rs`
- `src/atelier.rs`

**Acceptance**

- Create/select/move/delete trims in an inspector with clear attachment scope.
- Preview placements in 2D/3D without changing rest geometry or simulation.
- Save/reload and undo retain trim identity and parameters.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/proceduralHardwarePreview.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/clo7NativeHardwareActions.js



## EXO-SEW-004

**Specify and validate physical zipper or button closure**

Status: blocked. Dependencies: EXO-SEW-002, EXO-PHY-001.

**Files / directories**

- `docs/physical-closures.md`
- `examples/closure_probe.rs`
- `tests/physical_closures.rs`

**Acceptance**

- Define units, contact exclusions and closure state transitions before implementation.
- Test partial opening, reopening and pull/release with original collision coverage.
- Do not claim physical closure because a zipper mesh is visible.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/backends/protocol.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sewingConstruction.js

Research/acceptance task; production integration requires a separate reviewed result.

## EXO-SEW-005

**Define elastic seam and gathering mechanics**

Status: blocked. Dependencies: EXO-SEW-001, EXO-PHY-001.

**Files / directories**

- `docs/elastic-seams.md`
- `examples/elastic_seam_probe.rs`

**Acceptance**

- Distinguish geometric easing from a measured elastic seam law.
- Use units and compare force/energy derivatives and unequal-length release.
- Retain current easing semantics and document unsupported combinations.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/backends/protocol.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sewingConstruction.js



## EXO-MFG-001

**Report net material area and mass from rest geometry**

Status: done. Dependencies: none.

**Files / directories**

- `src/garment/production_metrics.rs`
- `tests/production_metrics.rs`
- `src/bin/cloth-template.rs`
- `docs/production-metrics.md`
- `src/garment/mod.rs`

**Acceptance**

- Report per-panel and per-fabric net area, mass and counts from the compiled rest mesh.
- Check holes, multiple fabrics, rigid placements and unchanged input state.
- Expose a CPU CLI report; label it net cloth only, not cut allowance, nesting or purchasing.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/productionCost.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/measurements.js

Original Rust slice implemented in src/garment/production_metrics.rs; five targeted CPU property tests passed. The CPU cloth-template metrics command was exercised on the public T-shirt: net area 0.7976 m2 and mass 0.15952 kg. See docs/production-metrics.md. This does not implement cut quantities, allowances, nesting or persistent POM.

## EXO-MFG-002

**Add cut quantities and manufacturing metadata**

Status: blocked. Dependencies: EXO-CORE-001, EXO-REV-001.

**Files / directories**

- `src/garment/manufacturing.rs`
- `tests/manufacturing_metadata.rs`
- `src/garment/mod.rs`

**Acceptance**

- Store cut quantity, fold/face/nap policy and fabric-roll assumptions with explicit defaults.
- Validate integer/range/units and preserve existing documents.
- Metadata-only edits do not reset drape or alter material mass.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/project.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/marker.js



## EXO-MFG-003

**Define sizes and point grading rules**

Status: blocked. Dependencies: EXO-CORE-001, EXO-CAD-003.

**Files / directories**

- `src/garment/grading.rs`
- `tests/grading_model.rs`
- `src/garment/mod.rs`

**Acceptance**

- Represent base size, ordered size names and stable-point displacement rules in metres.
- Reject duplicate sizes, broken references and nonfinite rules.
- Separate size variation from mesh resolution and board layout.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/grading.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/rust/exo_grading_kernel/src/lib.rs



## EXO-MFG-004

**Generate and validate a graded size run**

Status: blocked. Dependencies: EXO-MFG-003.

**Files / directories**

- `src/garment/grading.rs`
- `tests/grading_run.rs`
- `src/garment/mod.rs`

**Acceptance**

- Transform contours, curves, internal paths and dependent manufacturing references coherently.
- Preserve source garment and validate every generated size including sewn intervals.
- Report rejected sizes and geometric/seam discrepancies; no hidden fixture-specific curve repair.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/grading.js



## EXO-MFG-005

**Add grading table and size preview UI**

Status: blocked. Dependencies: EXO-MFG-004.

**Files / directories**

- `src/atelier/grading_ui.rs`
- `tests/grading_ui.rs`
- `src/atelier.rs`

**Acceptance**

- Edit rules and preview sizes with clear base/derived ownership.
- Switching preview does not overwrite the base pattern or stale simulation.
- Undo/save/reload preserves rules and selected preview policy.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/grading.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_FEATURE_ATLAS.md



## EXO-MFG-006

**Expose persistent POM measurements and size reports**

Status: blocked. Dependencies: EXO-REV-002, EXO-MFG-004.

**Files / directories**

- `src/atelier/measurements_ui.rs`
- `src/garment/measurement_reports.rs`
- `tests/measurement_reports.rs`
- `src/garment/mod.rs`
- `src/atelier.rs`

**Acceptance**

- Reuse reviewed stable measurement references; distinguish rest, draped and target dimensions.
- Export an explicit size/tolerance/unit table with missing values reported.
- Test reference migration, curve arclength and measurement updates after grading.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/measurements.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/rust/exo_measurement_kernel/src/lib.rs
- https://github.com/erythrofr/ClothCraft/pull/7

Persistent POM schema is already proposed in PR7; do not invent a second representation.

## EXO-MFG-007

**Define cutting-marker inputs and validity checks**

Status: blocked. Dependencies: EXO-MFG-002, EXO-CAD-008.

**Files / directories**

- `src/garment/marker.rs`
- `tests/marker_inputs.rs`
- `src/garment/mod.rs`

**Acceptance**

- Group pieces by fabric and expand cut quantities without modifying authored panels.
- Apply grain, nap, allowed rotations, roll width and clearance in metres.
- Reject unplaceable pieces and distinguish missing from placed quantities.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/marker.js



## EXO-MFG-008

**Implement a deterministic baseline cutting layout**

Status: blocked. Dependencies: EXO-MFG-007.

**Files / directories**

- `src/garment/marker.rs`
- `tests/marker_layout.rs`
- `src/garment/mod.rs`

**Acceptance**

- Generate repeatable placements with independent overlap/roll-boundary checks.
- Report consumed roll length and net/cut utilization separately.
- Preserve grain/nap restrictions; document packing quality rather than claiming optimal nesting.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/marker.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/rust/exo_marker_kernel/src/lib.rs



## EXO-MFG-009

**Add marker inspection and physical SVG export**

Status: blocked. Dependencies: EXO-MFG-008, EXO-REV-003.

**Files / directories**

- `src/atelier/marker_ui.rs`
- `src/garment/marker_export.rs`
- `tests/marker_export.rs`
- `src/garment/mod.rs`
- `src/atelier.rs`

**Acceptance**

- Inspect placed/unplaced pieces with dimensions and material grouping.
- Export physical-scale marker coordinates and a calibration ruler.
- Show constraints and failed placement reasons; rendering is not cut approval.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/markerArtifacts.js



## EXO-MFG-010

**Compute transparent fabric cost estimates**

Status: blocked. Dependencies: EXO-MFG-008.

**Files / directories**

- `src/garment/costing.rs`
- `tests/costing.rs`
- `src/garment/mod.rs`

**Acceptance**

- Use explicit currency and price per roll metre; never substitute zero for missing prices.
- Report incomplete markers and quantities instead of a false complete total.
- Export quoted CSV safely and list excluded labor/trims/shipping/taxes.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/productionCost.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/rust/exo_fabric_cost_kernel/src/lib.rs



## EXO-MFG-011

**Export a bill of materials**

Status: blocked. Dependencies: EXO-MFG-002, EXO-SEW-002.

**Files / directories**

- `src/garment/bom.rs`
- `tests/bom.rs`
- `src/garment/mod.rs`

**Acceptance**

- List fabric, piece and trim requirements with units and stable identifiers.
- Escape XML/CSV and retain missing supplier/price information explicitly.
- Cross-check quantities against the document; no guessed manufacturing certification.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/bomXml.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/factoryPackage.js



## EXO-MFG-012

**Export a revision-stamped HTML technical pack**

Status: blocked. Dependencies: EXO-MFG-006, EXO-MFG-011.

**Files / directories**

- `src/garment/tech_pack.rs`
- `tests/tech_pack.rs`
- `src/garment/mod.rs`

**Acceptance**

- Render piece specifications, construction notes, material/BOM and measurements from one document revision.
- Escape all user text and use deterministic local assets only.
- Flag unsupported/incomplete sections; validate dimensions against the source report.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/techPackHtmlExport.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/digitalTechPack.js



## EXO-MFG-013

**Add manufacturing preflight diagnostics**

Status: blocked. Dependencies: EXO-MFG-004, EXO-MFG-008, EXO-MFG-011.

**Files / directories**

- `src/garment/preflight.rs`
- `tests/preflight.rs`
- `src/garment/mod.rs`

**Acceptance**

- Report geometry, identifiers, quantities, references, grading and marker blockers with stable codes.
- A failed or missing check cannot become a success by omission.
- Keep document validity, physical fit and manufacturing approval as separate statuses.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/productionPreflight.js



## EXO-MFG-014

**Package consistent manufacturing artifacts**

Status: blocked. Dependencies: EXO-MFG-010, EXO-MFG-012, EXO-MFG-013, EXO-IO-003.

**Files / directories**

- `src/garment/factory_package.rs`
- `tests/factory_package.rs`
- `src/garment/mod.rs`

**Acceptance**

- Build a versioned manifest containing one document revision, units, file hashes and preflight results.
- Prevent path traversal/duplicate archive entries and keep output deterministic.
- Missing required outputs fail explicitly; a ZIP is not factory certification.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/factoryPackage.js



## EXO-IO-001

**Import a documented SVG pattern subset**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/svg_import.rs`
- `tests/svg_import.rs`
- `src/garment/mod.rs`

**Acceptance**

- Parse explicit physical units/transforms and closed contours with a stated curve tolerance.
- Reject external/script content and unsupported ambiguity; bound input resources.
- Produce unsewn editable pieces and a loss report; never infer seams from nearby paths.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/svgPatternImport.js

Original parser/adapter or license-compatible dependency; do not transplant browser SVG code.

## EXO-IO-002

**Import generic 2D DXF pattern entities**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/dxf_import.rs`
- `tests/dxf_import.rs`
- `src/garment/mod.rs`

**Acceptance**

- Document entity subset, units, layer treatment and closure tolerance.
- Use independent line/polyline/curve fixtures and explicit unsupported-entity reports.
- Preserve separate cut/sew lines; do not advertise AAMA/ASTM compliance.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/dxf.js



## EXO-IO-003

**Export generic DXF cut and sewing geometry**

Status: blocked. Dependencies: EXO-REV-002, EXO-MFG-002.

**Files / directories**

- `src/garment/dxf_export.rs`
- `tests/dxf_export.rs`
- `src/garment/mod.rs`

**Acceptance**

- Reuse reviewed cutline output and write explicit units/layers/entities.
- Validate known dimensions in an independent DXF consumer.
- Distinguish generic DXF from the industrial AAMA/ASTM dialects.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/dxf.js
- https://github.com/erythrofr/ClothCraft/pull/7

PR7 contains cutline/DXF work; review and extend that slice before writing another exporter.

## EXO-IO-004

**Add one industrial DXF dialect with independent fixtures**

Status: blocked. Dependencies: EXO-IO-002, EXO-IO-003, EXO-MFG-003.

**Files / directories**

- `src/garment/dxf_industrial.rs`
- `tests/dxf_industrial.rs`
- `docs/dxf-industrial.md`
- `src/garment/mod.rs`

**Acceptance**

- Choose and name AAMA or ASTM scope first, including grade rules, grain and notch encoding.
- Verify import and export separately against independent redistributable fixtures.
- Publish losses and supported entities; leave the other dialect explicitly unsupported.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_PRODUCTION_PIPELINE.md

EXO generic DXF output is not evidence of industrial dialect completeness.

## EXO-IO-005

**Support OBJ and MTL material-aware round trips**

Status: blocked. Dependencies: EXO-LOOK-001.

**Files / directories**

- `src/avatar.rs`
- `src/garment/obj_materials.rs`
- `tests/obj_materials.rs`
- `src/garment/mod.rs`

**Acceptance**

- Preserve groups, UVs, normals, material assignments and supported textures with explicit units.
- Bound and normalize referenced paths; do not fetch external resources silently.
- Check in Blender and an independent parser; retain geometry-only compatibility.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_FEATURE_ATLAS.md



## EXO-IO-006

**Export static glTF/GLB garment assets**

Status: blocked. Dependencies: EXO-LOOK-001.

**Files / directories**

- `src/garment/gltf_export.rs`
- `tests/gltf_export.rs`
- `src/garment/mod.rs`

**Acceptance**

- Export world transforms, mesh attributes, units and a documented PBR subset.
- Validate indices/material assignments and open in an independent viewer.
- Do not claim rigging, animation or editable sewing round trips.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_FEATURE_ATLAS.md



## EXO-IO-007

**Import static glTF/GLB avatars**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/gltf_avatar.rs`
- `tests/gltf_avatar.rs`
- `src/lib.rs`

**Acceptance**

- Apply scene transforms and units coherently to visual and collision geometry.
- Validate triangulated finite meshes and report unsupported skinning/animation.
- Use bounded asset loading and independently generated transform fixtures.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_UI_RENDERING_AND_AVATARS.md



## EXO-IO-008

**Produce tiled physical PDF pattern sheets**

Status: blocked. Dependencies: EXO-REV-003, EXO-MFG-002.

**Files / directories**

- `src/garment/pdf_export.rs`
- `tests/pdf_export.rs`
- `src/garment/mod.rs`

**Acceptance**

- Set physical page dimensions, overlap, registration marks and a 100 mm ruler.
- Preserve cut/sew distinction, labels and printer scaling instructions.
- Render/measure multipage fixtures; document tolerance and unsupported fonts/curves.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/markerArtifacts.js



## EXO-LOOK-001

**Separate visual fabric properties from mechanics**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/appearance.rs`
- `tests/appearance.rs`
- `src/garment/mod.rs`

**Acceptance**

- Define color, roughness, normal/texture references and scale/orientation with explicit conventions.
- Appearance-only edits preserve positions, velocities and solver caches.
- Old documents load with current visual defaults; absent optics do not invent physical calibration.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricSurfaceModel.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricPbrAppearance.js



## EXO-LOOK-002

**Render the basic fabric appearance model**

Status: blocked. Dependencies: EXO-LOOK-001.

**Files / directories**

- `src/render.rs`
- `src/render/materials.rs`
- `tests/material_render_data.rs`

**Acceptance**

- Map color/roughness/normal inputs consistently with color-space declarations.
- Keep texture scale tied to material coordinates and grain, not screen or drape dimensions.
- Provide opt-in visual fixtures; default CPU tests validate render data without GPU workloads.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricSurfaceModel.js



## EXO-LOOK-003

**Generate deterministic procedural textile maps**

Status: blocked. Dependencies: EXO-LOOK-001.

**Files / directories**

- `src/appearance/textiles.rs`
- `tests/textile_maps.rs`
- `src/lib.rs`

**Acceptance**

- Use declared seeds, dimensions and units for a small weave/knit subset.
- Check tiling, finite values, channel meaning and bounded memory.
- Label generated optics as visual appearance, not yarn-level simulation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/textileProcedurals.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricPbrGenerator.js



## EXO-LOOK-004

**Import and manage fabric texture assets**

Status: blocked. Dependencies: EXO-LOOK-001.

**Files / directories**

- `src/appearance/assets.rs`
- `src/atelier/fabrics_ui.rs`
- `tests/appearance_assets.rs`
- `src/atelier.rs`
- `src/lib.rs`

**Acceptance**

- Import/relink supported local maps into portable project assets with size limits.
- Distinguish sRGB albedo and linear data channels; preserve original file provenance.
- A missing map produces a visible fallback and never changes physical fabric parameters.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricAssetRegistry.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricPbrFileNaming.js



## EXO-LOOK-005

**Define material-space garment graphic placements**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/graphics.rs`
- `tests/graphic_placements.rs`
- `src/garment/mod.rs`

**Acceptance**

- Store stable panel IDs, physical placement transform and asset references.
- Validate bounds, units, sidedness and deletion/remeshing behavior.
- Graphic edits preserve drape and rest geometry; no third-party brand artwork fixtures.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativeGarmentGraphics.js



## EXO-LOOK-006

**Render and edit garment graphics**

Status: blocked. Dependencies: EXO-LOOK-005, EXO-LOOK-002.

**Files / directories**

- `src/render/graphics.rs`
- `src/atelier/graphics_ui.rs`
- `tests/graphics_ui.rs`
- `src/atelier.rs`
- `src/render.rs`

**Acceptance**

- Place/rotate/scale graphics in material space with correct draped mapping.
- Support pick/delete/undo and portable save/reload.
- Bound/sanitize supported vector/image inputs; do not execute embedded SVG content.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativeGarmentGraphics.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativeGraphicStorage.js



## EXO-LOOK-007

**Define reproducible stage, lighting and camera settings**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/stage_settings.rs`
- `tests/stage_settings.rs`
- `src/atelier.rs`

**Acceptance**

- Persist camera/environment/light settings separately from solver inputs.
- Preserve current background/floor controls and existing preferences.
- Validate values and asset references; decorative geometry is not a physical collider.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/createStageEnvironment.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sceneCameraViewport.js



## EXO-LOOK-008

**Render stages and export still images**

Status: blocked. Dependencies: EXO-LOOK-007.

**Files / directories**

- `src/render/stages.rs`
- `src/atelier/stage_ui.rs`
- `tests/stage_render_data.rs`
- `src/atelier.rs`
- `src/render.rs`

**Acceptance**

- Provide original or redistributable stage fixtures with provenance.
- Render/export selected resolution with optional overlays and declared color space.
- Record camera/environment state for repeatability; no claimed path tracing or garment-fit certification.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/createStageEnvironment.js



## EXO-AV-001

**Define avatar landmarks and body measurements**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/avatar_measurements.rs`
- `tests/avatar_measurements.rs`
- `src/lib.rs`

**Acceptance**

- Separate visible mesh, collision mesh and named body landmarks.
- Store stable units and explicit user-confirmed measurement conventions.
- Test synthetic bodies and missing/ambiguous landmarks without guessing a size.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/seamlyMeasurements.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_UI_RENDERING_AND_AVATARS.md



## EXO-AV-002

**Add body-aware panel arrangement assistance**

Status: blocked. Dependencies: EXO-AV-001.

**Files / directories**

- `src/garment/arrangement.rs`
- `src/atelier/arrangement_ui.rs`
- `tests/arrangement.rs`
- `src/garment/mod.rs`
- `src/atelier.rs`

**Acceptance**

- Offer placement previews from named landmarks with reversible commit.
- Preserve rest shape/grain and expose overlap/initial-separation diagnostics.
- Reject invalid initialization rather than silently teleporting simulated cloth.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/patternBodyArrangement.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/autoFitPlacement.js



## EXO-AV-003

**Expose pin editing and an explicit freeze policy**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/pins_ui.rs`
- `src/authoring.rs`
- `tests/pin_authoring.rs`
- `src/atelier.rs`

**Acceptance**

- Reuse material-space pin_points instead of persisting mesh indices.
- Define pin versus freeze semantics and preserve undo/reload/remeshing behavior.
- Test release motion and stale-worker invalidation on CPU; GPU validation remains opt-in.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/backends/protocol.js

Core pin data already exists; dedicated editing and freeze semantics do not.

## EXO-AV-004

**Show avatar collision coverage and initialization problems**

Status: ready. Dependencies: none.

**Files / directories**

- `src/atelier/avatar_diagnostics.rs`
- `tests/avatar_diagnostics.rs`
- `src/atelier.rs`

**Acceptance**

- Report actual collider geometry identity, bounds and supported static-mesh assumptions.
- Show diagnostics separately from cosmetic avatar appearance.
- No collision approximations may be silently substituted to improve appearance/performance.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/meshAvatarContact.js



## EXO-UX-001

**Publish a typed command capability registry**

Status: ready. Dependencies: none.

**Files / directories**

- `src/atelier/commands.rs`
- `tests/command_registry.rs`
- `src/atelier.rs`

**Acceptance**

- List only implemented commands with context, shortcuts, undo behavior and backend requirements.
- Unavailable commands show explicit reasons and cannot dispatch fake actions.
- Keep the registry usable by toolbar and future automation adapters.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/workspaceCommandIndex.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/clo7NativeToolCapabilities.js



## EXO-UX-002

**Add a searchable command palette**

Status: blocked. Dependencies: EXO-UX-001.

**Files / directories**

- `src/atelier/command_palette.rs`
- `tests/command_palette.rs`
- `src/atelier.rs`

**Acceptance**

- Search aliases and invoke the same validated commands as current UI.
- Respect text focus, Escape, keyboard navigation and disabled contexts.
- Keep radial menu intact; palette dispatch does not duplicate authoring logic.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/workspaceCommandIndex.js



## EXO-UX-003

**Persist workspace layouts and tool visibility**

Status: blocked. Dependencies: EXO-UX-001.

**Files / directories**

- `src/atelier/workspace_profiles.rs`
- `tests/workspace_profiles.rs`
- `src/atelier.rs`

**Acceptance**

- Save/restore panel split, visible tool groups and view preferences with schema defaults.
- Invalid/offscreen dimensions recover to a usable layout.
- Workspace changes never modify garment document or solver settings implicitly.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/workspaceProfiles.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/studioCustomization.js



## EXO-UX-004

**Add group 3D transforms and marquee selection**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/selection.rs`
- `src/atelier/gizmo.rs`
- `src/authoring.rs`
- `tests/group_placement.rs`
- `src/atelier.rs`

**Acceptance**

- Define visible-only versus through selection and the group transform pivot.
- Commit one transaction, preserving each panel rest shape and explicit drape reset policy.
- Test cancel/undo, linked pairs, hidden geometry and generation invalidation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/meshSelection.js

Current 2D group point/panel selection already exists; avoid replacing it.

## EXO-UX-005

**Create a provenance-aware garment template browser**

Status: ready. Dependencies: none.

**Files / directories**

- `src/template_catalog.rs`
- `src/atelier/template_browser.rs`
- `tests/template_catalog.rs`
- `src/atelier.rs`
- `src/lib.rs`

**Acceptance**

- Index bundled original templates with preview, metadata, units and source/license.
- Validate templates before opening; loading replaces a document only after user-visible confirmation.
- External patterns are explicit imports, not automatically downloaded or declared redistributable.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/openSourcePatternToolCatalog.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/projectFileLibrary.js



## EXO-UX-006

**Expose a versioned headless authoring session adapter**

Status: blocked. Dependencies: EXO-CORE-001, EXO-REV-005, EXO-UX-001.

**Files / directories**

- `src/bin/cloth-session.rs`
- `src/session_protocol.rs`
- `tests/session_protocol.rs`
- `src/lib.rs`

**Acceptance**

- Route supported requests through existing transactional commands with expected revision.
- Report capability/version, invalid input, stale revisions, cancellation and undo coherently.
- Keep transport local and do not execute arbitrary code or shell fields from requests.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CONVERSION_STATUS_2026-10-18.md
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/clothcraftApiClient.js
- https://github.com/erythrofr/ClothCraft/pull/7

Evaluate existing exo-session proposal first; use one canonical adapter rather than competing protocols.

## EXO-QA-001

**Build public cross-editor behavioral fixtures**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `tests/fixtures/rewrite/`
- `docs/rewrite-fixtures.md`

**Acceptance**

- Create original small garments covering curves, holes, partial seams, trims and invalid inputs as supported.
- Pin each source model/revision and record losses when converting between representations.
- Do not redistribute private garments, upstream proprietary references or unreviewed EXO assets.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_VALIDATION_TEST_PLAN.md



## EXO-QA-002

**Package a clean-machine Windows test release**

Status: ready. Dependencies: none.

**Files / directories**

- `scripts/package-windows.ps1`
- `.github/workflows/release-windows.yml`
- `docs/install.md`

**Acceptance**

- Package executable and required redistributable assets/notices with version/hash metadata.
- Verify launching/opening/saving from a clean directory with spaces in its path.
- Provide clear prototype/unsupported-hardware notes; do not require an AI subscription to install.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RELEASE_STATUS.md



## EXO-QA-003

**Verify native macOS and Linux build paths**

Status: ready. Dependencies: none.

**Files / directories**

- `.github/workflows/build.yml`
- `docs/platform-validation.md`

**Acceptance**

- Build the CPU core and desktop targets on named platform/toolchain versions.
- Document platform-specific dialogs, paths, clipboard and GPU backend limitations.
- A successful compile is distinct from native interaction/GPU acceptance.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RELEASE_STATUS.md



## EXO-PHY-001

**Define capabilities for real interchangeable solver adapters**

Status: blocked. Dependencies: EXO-CORE-001.

**Files / directories**

- `docs/solver-adapter-contract.md`
- `src/solver_lab/mod.rs`

**Acceptance**

- Specify lifecycle, rest/state ownership, collision/material/seam capabilities and error semantics.
- Map existing real adapters to declared capabilities without exposing failed experiments as editor modes.
- Retain current VBD/OGC production behavior and explicit physical-time reporting.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/backends/registry.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/backends/protocol.js



## EXO-PHY-002

**Compare candidate engines on shared quality gates**

Status: blocked. Dependencies: EXO-PHY-001, EXO-QA-001.

**Files / directories**

- `docs/solver-comparison-protocol.md`
- `examples/solver_compare.rs`

**Acceptance**

- Pin exact rest mesh/material/seams/x/v/time/control protocol and collision scope.
- Report pull/hold/release, separation, convergence and full-step cost before performance rankings.
- Do not interpret a PPF connector or visible preview as validated garment physics.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_SIMULATION_RESEARCH.md

GPU work needs fresh owner authorization. No solver promotion is implied by this task.

## EXO-PHY-003

**Evaluate foam and padding as a separate material experiment**

Status: blocked. Dependencies: EXO-PHY-001.

**Files / directories**

- `docs/padding-experiment.md`
- `examples/padding_probe.rs`

**Acceptance**

- Define dimensional material and contact assumptions distinct from thin cloth.
- Check compression/release energy and geometry against analytic or measured references.
- Do not add UI claims or replace cloth mechanics until a real model passes its gates.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/foamCompressionModel.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/foamPaddingGeometry.js

EXO has a separate compression prototype; its presence does not establish general solid mechanics.

## EXO-CAD-009

**Integrate the freehand fitter and create new panels in the 2D workspace**

Status: done. Dependencies: none.

**Files / directories**

- `src/atelier/board.rs`
- `src/atelier/authoring_ui.rs`
- `src/authoring.rs`
- `tests/freehand_authoring.rs`
- `docs/authoring.md`
- `docs/handoff.md`

**Acceptance**

- First verify and integrate PR #27 after successful CI; do not substitute or duplicate its fitter.
- Capture a stroke, preview fitted asymmetric cubics and the closing edge, then commit only a valid new panel.
- Cancel, undo/redo and save/reload preserve existing panels, seams and stable IDs.
- Reject invalid/self-intersecting contours and sample/segment overflow without mutating the document.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/27
- https://github.com/erythrofr/ClothCraft/pull/27
- https://github.com/erythrofr/ClothCraft/pull/35

Merged #35 (3bac583) after all 12 CI checks passed. 22 targeted CPU integration tests and 46 desktop tests passed locally. New-panel Freehand UI implemented; existing-contour replacement remains EXO-CAD-006.

## EXO-SEW-006

**Expose cached sewing diagnostics in the native inspector**

Status: ready. Dependencies: EXO-SEW-001.

**Files / directories**

- `src/atelier/sewing_ui.rs`
- `src/atelier/authoring_ui.rs`
- `docs/sewing-audit-ui.md`

**Acceptance**

- Expose a deliberate Audit/Refresh action in the sewing inspector using garment::seam::audit; never compile a report every rendered frame.
- Display seam IDs, material lengths and signed mismatch in millimetres, local easing and errors without claiming simulation convergence or measured seam gap.
- Cache results and explicitly mark them stale after the project generation changes; never display stale diagnostics as current.
- Allow selecting an existing seam for inspection/editing through the existing draft path without mutating the document or history until Apply.
- Cover cached-state freshness, malformed input reporting and headless egui presentation on CPU; keep GPU/native-window acceptance separate.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/41
- https://github.com/erythrofr/ClothCraft/blob/main/docs/sewing-audit.md

Original Rust UI adapter, no EXO code/assets copied. Keep cache in AuthoringUi separately from SewingDraft so selecting another seam does not discard the report. Use existing generation invalidation conservatively. No new solver telemetry, automatic repair, document fields, atelier.rs or command-registry changes. A synchronous explicit audit can pause the UI on large geometry; document this limit rather than claiming a background job.

## EXO-QA-004

**Exercise editor tools with a deterministic named-widget harness**

Status: ready. Dependencies: EXO-SEW-001.

**Files / directories**

- `src/atelier/authoring_smoke.rs`
- `src/atelier/authoring_smoke/widget_harness.rs`
- `src/atelier/sewing_ui.rs`
- `src/atelier/authoring_ui.rs`
- `docs/widget-harness.md`

**Acceptance**

- Register current-frame named widgets and reject missing, duplicate, disabled, stale or clipped targets explicitly.
- Inject pointer press/release, bounded drag, keyboard and text events through real egui controls with deterministic frame timing; never substitute direct model calls for UI interaction.
- Exercise sewing-audit refresh, inspection and stale state, plus numeric construction controls; assert resulting state and cancellation rather than only dispatched input.
- Run the new scenarios without a window, OS input injection or GPU initialization; preserve existing opt-in native smoke paths.
- Document scenario authoring, stable widget names, actionable failure output and limits of headless acceptance.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/46

Owner-requested reusable internal testing. Begin from the merged audit UI (#46) and obtain an accepted claim after releasing EXO-SEW-006. atelier.rs is excluded because command-registry work owns that shared file. No new dependencies, private garments, solver changes or EXO source copied.
