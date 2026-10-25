# Native UI follow-ups to PR #66

Audit: 25 October 2026. Baseline: upstream `main` at
`83184c58b8e877cb635627d7f31c76d0e7c8266e`. Source candidate:
[PR #66](https://github.com/erythrofr/ClothCraft/pull/66) at
`e3994ae80c496eb3e6371309ccabb8e4b7bea3ab`.

This is an issue and scope proposal. It adds no editor controls and does not
mark the source candidates, their tests or their manufacturing claims as
accepted. Branches for this work belong in
`NicTanghe/Hamerons_ClothCraft`; PRs target `erythrofr/ClothCraft:main`.

## Existing work and missing native workflows

| Capability | Existing proposal / review | Native UI follow-up |
| --- | --- | --- |
| Independent curve points, exact splits and mirrored topology | PR #66; review #13. Current freehand panel creation and paired linked-panel tools are different capabilities. | [#68 / EXO-CAD-011](https://github.com/erythrofr/ClothCraft/issues/68): edit handles and points, preview and split, preserve semantic references. |
| Saved points of measure | PRs #7/#66; review #13. The current board ruler is temporary. EXO-MFG-006 also includes grading/size reports. | [#69 / EXO-MFG-015](https://github.com/erythrofr/ClothCraft/issues/69): save, select, rename and delete single-size rest-space measurements without waiting for grading. |
| Notches and seam allowances | [PR #6](https://github.com/erythrofr/ClothCraft/pull/6) already proposes native controls, board display and export; [review #12](https://github.com/erythrofr/ClothCraft/issues/12) reconciles it with PR #1. | Reuse #12 and #6; no duplicate issue or competing schema. Paired-notch semantics in #66 still require reconciliation. |
| Pattern text labels | PR #1 and PR #66 contain metadata/commands. PR #6 does not provide the label workflow. | [#70 / EXO-CAD-012](https://github.com/erythrofr/ClothCraft/issues/70): add, edit and delete labels through the Piece inspector and board. |
| Cutting outlines | PR #6 already proposes joined offsets, cutting-line display and physical SVG; [review #14](https://github.com/erythrofr/ClothCraft/issues/14) covers the separate SVG proposal #3. #66 adds another cutline candidate. | Reconcile under #12/#13/#14, then extend EXO-CAD-008 for its broader geometry cases. No second offset engine or export implementation. |
| Cut-and-sewn darts | PRs #7/#66; review #13. No focused native dart UI PR found. | [#71 / EXO-SEW-007](https://github.com/erythrofr/ClothCraft/issues/71): preview intake/apex, explicitly apply, sew the legs and undo. |
| Final-state contact and residual diagnostics | PRs #7/#66 change solver measurement timing; [review finding](https://github.com/erythrofr/ClothCraft/issues/13#issuecomment-6376032311). Current upstream already has passive motion diagnostics and an offline audit. | [#72 / EXO-PHY-004](https://github.com/erythrofr/ClothCraft/issues/72): separate physics review, opt-in sampling and correctly labelled native Simulation diagnostics. |

PR #66 changes no files under `src/atelier/` and supplies no native egui
controls for these additions. Its documentation describes tools in the
separate EXO interface; those descriptions are not evidence that the tools
exist in ClothCraft. PRs #1, #3, #6, #7 and #66 were open and unmerged when
their current metadata was inspected. Contributor-reported validation was
not reproduced by this audit.

## Integration order and acceptance

Keep the existing reviews for #1/#6 and #7/#66. Their notch representations
conflict (`t/depth_m` versus `at/length_m/kind`); do not merge them as two
parallel stores. The reviews also cover topology and saved-document
compatibility. New native workflows reuse the resulting reviewed model.

Each issue requires its own feature PR with real native controls, preview
where relevant, failure and cancellation behavior, undo/redo, save/reopen and
CPU tests through the existing named-widget harness. Schema, state
preservation and physical changes also need independent property tests.
Pure CPU/model success is insufficient evidence of an editor workflow.

The curve task depends on the existing topology-reference contract. The
single-size measurement task deliberately does not depend on graded-size
generation. Metadata-only labels and measurements must preserve the mesh and
drape. Darts change rest topology and require coherent remeshing; a cut-and-
sewn dart is not an uncut folded dart or proof of physical fit.

Diagnostic work stays separate from authoring. Reuse current audit machinery,
measure complete step overhead and keep expensive sampling explicit. The
fixed 2 micrometre GPU rejection gate in #66 changes step acceptance and is
not adopted by the diagnostic task. Existing collision bounds, predictor and
interactive trajectories remain acceptance requirements.

## Coordination and exclusions

The proposed catalog entries and issue links need maintainer review and
registration before a coordinator claim can be accepted. An issue, branch
or fork is not a reservation. Existing active reservations remain intact;
in particular, avoid the reserved `src/atelier.rs` entry point. This proposal
does not release claims, mark reviews done or waive dependencies.

The requested work excludes the EXO session bridge, web/Swift application,
graphics/hardware adapter fields and unrelated solver policies. Do not copy
EXO implementation or assets into this MIT project without the required
compatible provenance; candidate Rust contributions need per-file review
and retained attribution.
