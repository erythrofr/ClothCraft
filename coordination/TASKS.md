# Rust rewrite task catalog

Generated from `coordination/tasks.json` with `node scripts/rewrite-tasks.mjs markdown`. Do not edit this view directly.

[Start and claim work](../COORDINATION.md) · [Live assignments](https://github.com/erythrofr/ClothCraft/issues/8) · [Feature audit](../docs/exo-feature-audit.md)

Manifest status describes eligibility, not current ownership. A ready task may already be claimed: check the live board and wait for acknowledgement. Blocked tasks are planning briefs; review_existing means review the linked contribution before implementing anything.

Reference: [mikristian/exo-sample-3d@352c6086b622](https://github.com/mikristian/exo-sample-3d/tree/352c6086b622caeda95f16d9bd923624b95e05d9). Reading evidence is not runtime validation.

| Task | Area | Status | Dependencies | Discussion |
|---|---|---|---|---|
| [EXO-UX-008](#exo-ux-008) — Correct workspace format capability information | workspace | ready | EXO-CORE-001 | Not registered |
| [EXO-UX-007](#exo-ux-007) — Copy unheld panels from garments with authored holds | workspace | done | EXO-CORE-001 | Not registered |
| [EXO-COORD-003](#exo-coord-003) — Avoid redundant compilation for metadata-only pull requests | coordination | done | EXO-COORD-002 | Not registered |
| [EXO-QA-006](#exo-qa-006) — Ship and verify the local authoring process across platforms | release | done | EXO-UX-006 | [Issue](https://github.com/erythrofr/ClothCraft/issues/151) |
| [EXO-COORD-001](#exo-coord-001) — Verify live task claim, heartbeat and release coordination | coordination | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/9) |
| [EXO-COORD-002](#exo-coord-002) — Explain malformed reservation commands without changing ownership | coordination | done | EXO-COORD-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/129) |
| [EXO-CORE-001](#exo-core-001) — Agree editor, document and solver ownership contract | architecture | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/10) |
| [EXO-CORE-002](#exo-core-002) — Record provenance and licensing for candidate contributions | provenance | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/11) |
| [EXO-REV-001](#exo-rev-001) — Reconcile the two notch and allowance contributions | review | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/12) |
| [EXO-REV-002](#exo-rev-002) — Split and review darts, persistent POM and cutline proposal | review | review_existing | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/13) |
| [EXO-REV-003](#exo-rev-003) — Review physical SVG output contribution | review | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/14) |
| [EXO-REV-004](#exo-rev-004) — Reconcile feature map and current stable lint contributions | review | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/15) |
| [EXO-REV-005](#exo-rev-005) — Extract reviewable boundaries from the EXO Studio and session proposal | review | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/16) |
| [EXO-CAD-001](#exo-cad-001) — Implement exact numeric construction operations | cad | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/17) |
| [EXO-CAD-002](#exo-cad-002) — Add numeric construction inspector actions | cad | done | EXO-CAD-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/36) |
| [EXO-CAD-003](#exo-cad-003) — Define topology reference migration for pattern edits | cad | blocked | EXO-CORE-001, EXO-REV-001, EXO-REV-002 | Not registered |
| [EXO-CAD-004](#exo-cad-004) — Unfold one half-pattern across a straight fold edge | cad | blocked | EXO-CAD-003 | Not registered |
| [EXO-CAD-005](#exo-cad-005) — Add bounded-error freehand-to-Bezier fitting | cad | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/18) |
| [EXO-CAD-006](#exo-cad-006) — Connect freehand drawing to transactional contour editing | cad | blocked | EXO-CAD-005, EXO-CAD-003 | Not registered |
| [EXO-CAD-007](#exo-cad-007) — Edit hole contours with the existing point tools | cad | blocked | EXO-CAD-003 | Not registered |
| [EXO-CAD-008](#exo-cad-008) — Implement offset paths and cutline corner policy | cad | blocked | EXO-REV-001, EXO-REV-002 | Not registered |
| [EXO-SEW-001](#exo-sew-001) — Add a read-only sewing construction audit | sewing | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/19) |
| [EXO-SEW-002](#exo-sew-002) — Define authored trims and construction annotations | sewing | ready | EXO-CORE-001 | Not registered |
| [EXO-SEW-003](#exo-sew-003) — Add trim editing, picking and previews | sewing | ready | EXO-CORE-001 | Not registered |
| [EXO-SEW-004](#exo-sew-004) — Specify and validate physical zipper or button closure | physics | blocked | EXO-SEW-002, EXO-PHY-001 | Not registered |
| [EXO-SEW-005](#exo-sew-005) — Define elastic seam and gathering mechanics | physics | ready | EXO-SEW-001, EXO-PHY-001 | Not registered |
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
| [EXO-IO-001](#exo-io-001) — Import a documented SVG pattern subset | interchange | done | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/99) |
| [EXO-IO-002](#exo-io-002) — Import generic 2D DXF pattern entities | interchange | done | EXO-CORE-001 | Not registered |
| [EXO-IO-003](#exo-io-003) — Export generic DXF cut and sewing geometry | interchange | blocked | EXO-REV-002, EXO-MFG-002 | Not registered |
| [EXO-IO-004](#exo-io-004) — Add one industrial DXF dialect with independent fixtures | interchange | blocked | EXO-IO-002, EXO-IO-003, EXO-MFG-003 | Not registered |
| [EXO-IO-005](#exo-io-005) — Support OBJ and MTL material-aware round trips | interchange | blocked | EXO-LOOK-001 | Not registered |
| [EXO-IO-006](#exo-io-006) — Export static glTF/GLB garment assets | interchange | blocked | EXO-LOOK-001 | Not registered |
| [EXO-IO-007](#exo-io-007) — Import static glTF/GLB avatars | interchange | done | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/60) |
| [EXO-IO-008](#exo-io-008) — Produce tiled physical PDF pattern sheets | interchange | blocked | EXO-REV-003, EXO-MFG-002 | Not registered |
| [EXO-LOOK-001](#exo-look-001) — Integrate visual fabric appearance without resetting physics | appearance | ready | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/126) |
| [EXO-LOOK-002](#exo-look-002) — Render the basic fabric appearance model | appearance | blocked | EXO-LOOK-001 | Not registered |
| [EXO-LOOK-003](#exo-look-003) — Generate deterministic procedural textile maps | appearance | blocked | EXO-LOOK-001 | Not registered |
| [EXO-LOOK-004](#exo-look-004) — Import and manage fabric texture assets | appearance | blocked | EXO-LOOK-001 | Not registered |
| [EXO-LOOK-005](#exo-look-005) — Define material-space garment graphic placements | appearance | ready | EXO-CORE-001 | Not registered |
| [EXO-LOOK-006](#exo-look-006) — Render and edit garment graphics | appearance | blocked | EXO-LOOK-005 | Not registered |
| [EXO-LOOK-007](#exo-look-007) — Define reproducible stage, lighting and camera settings | appearance | done | EXO-CORE-001 | Not registered |
| [EXO-LOOK-008](#exo-look-008) — Render stages and export still images | appearance | blocked | EXO-LOOK-007 | Not registered |
| [EXO-AV-001](#exo-av-001) — Define avatar landmarks and body measurements | avatar | done | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/56) |
| [EXO-AV-002](#exo-av-002) — Add body-aware panel arrangement assistance | avatar | blocked | EXO-AV-001 | Not registered |
| [EXO-AV-003](#exo-av-003) — Expose pin editing and an explicit freeze policy | avatar | ready | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/116) |
| [EXO-AV-004](#exo-av-004) — Show avatar collision coverage and initialization problems | avatar | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/20) |
| [EXO-UX-001](#exo-ux-001) — Publish a typed command capability registry | workspace | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/21) |
| [EXO-UX-002](#exo-ux-002) — Add a searchable command palette | workspace | ready | EXO-UX-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/109) |
| [EXO-UX-003](#exo-ux-003) — Persist workspace layouts and tool visibility | workspace | ready | EXO-UX-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/113) |
| [EXO-UX-004](#exo-ux-004) — Add group 3D transforms and marquee selection | workspace | ready | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/104) |
| [EXO-UX-005](#exo-ux-005) — Create a provenance-aware garment template browser | workspace | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/22) |
| [EXO-UX-006](#exo-ux-006) — Expose a versioned headless authoring session adapter | automation | done | EXO-CORE-001, EXO-REV-005, EXO-UX-001 | Not registered |
| [EXO-QA-001](#exo-qa-001) — Build public cross-editor behavioral fixtures | validation | done | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/54) |
| [EXO-QA-002](#exo-qa-002) — Package a clean-machine Windows test release | release | ready | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/23) |
| [EXO-QA-003](#exo-qa-003) — Verify native macOS and Linux build paths | release | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/24) |
| [EXO-PHY-001](#exo-phy-001) — Define capabilities for real interchangeable solver adapters | physics | done | EXO-CORE-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/58) |
| [EXO-PHY-002](#exo-phy-002) — Compare candidate engines on shared quality gates | physics | blocked | EXO-PHY-001, EXO-QA-001 | Not registered |
| [EXO-PHY-003](#exo-phy-003) — Evaluate foam and padding as a separate material experiment | physics | blocked | EXO-PHY-001 | Not registered |
| [EXO-CAD-009](#exo-cad-009) — Integrate the freehand fitter and create new panels in the 2D workspace | cad | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/33) |
| [EXO-SEW-006](#exo-sew-006) — Expose cached sewing diagnostics in the native inspector | sewing | done | EXO-SEW-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/43) |
| [EXO-QA-004](#exo-qa-004) — Exercise editor tools with a deterministic named-widget harness | validation | done | EXO-SEW-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/47) |
| [EXO-CAD-010](#exo-cad-010) — Place a pattern point at the intersection of two reference edges | cad | done | EXO-CAD-001, EXO-CAD-002, EXO-QA-004 | [Issue](https://github.com/erythrofr/ClothCraft/issues/50) |
| [EXO-CAD-011](#exo-cad-011) — Edit independent curve points and mirrored splits in the native 2D workspace | cad | blocked | EXO-REV-001, EXO-REV-002, EXO-CAD-003 | [Issue](https://github.com/erythrofr/ClothCraft/issues/68) |
| [EXO-MFG-015](#exo-mfg-015) — Create and manage saved pattern measurements in the native 2D UI | manufacturing | ready | EXO-REV-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/69) |
| [EXO-CAD-012](#exo-cad-012) — Add editable pattern text annotations to the native Piece inspector and board | cad | blocked | EXO-REV-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/70) |
| [EXO-SEW-007](#exo-sew-007) — Preview and create a cut-and-sewn dart from the native pattern UI | sewing | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/71) |
| [EXO-PHY-004](#exo-phy-004) — Expose correctly timed contact and residual diagnostics in the native Simulation inspector | physics | done | — | [Issue](https://github.com/erythrofr/ClothCraft/issues/72) |
| [EXO-IO-009](#exo-io-009) — Integrate static avatar import into the workspace | interchange | done | EXO-IO-007, EXO-UX-005 | [Issue](https://github.com/erythrofr/ClothCraft/issues/64) |
| [EXO-IO-010](#exo-io-010) — Import reviewed DXF contours as editable native panels | interchange | done | EXO-IO-002 | Not registered |
| [EXO-IO-011](#exo-io-011) — Import reviewed SVG patterns in the native workspace | interchange | done | EXO-IO-001 | [Issue](https://github.com/erythrofr/ClothCraft/issues/103) |
| [EXO-QA-005](#exo-qa-005) — Trace native appearance history through actual UI controls | validation | done | EXO-QA-004 | [Issue](https://github.com/erythrofr/ClothCraft/issues/135) |
| [EXO-UX-009](#exo-ux-009) — Expose native authoring tools in the command palette | workspace | ready | EXO-UX-001 | Not registered |

## EXO-UX-008

**Correct workspace format capability information**

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/workspace.rs`
- `README.md`

**Acceptance**

- Describe actual supported import and export directions in the workspace and README using the existing SVG, DXF and avatar import contracts.
- Clearly distinguish generic DXF outlines, physically scaled SVG subsets and static OBJ/glTF/GLB avatars from unsupported industrial dialects, animated assets and GLB export.
- Do not change importers, solvers or docs/interoperability.md while the markings contribution is pending. Validate the rendered text against actual menu handlers and documentation.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/167

User-visible information fix only; register issue #167 and obtain an accepted claim after scope review. Interoperability table correction is separately coordinated with #12.

## EXO-UX-007

**Copy unheld panels from garments with authored holds**

Status: done. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/authoring/clipboard.rs`
- `tests/pattern_clipboard.rs`
- `docs/pins.md`

**Acceptance**

- Filter clipboard holds to selected panel identities; preserve selected holds so unsupported held-panel paste continues to fail explicitly.
- Unheld selections can round-trip and paste even when other panels are pinned or frozen; preserve original holds, material geometry, live positions, velocities and time.
- Reject malformed external clipboard hold references without silently dropping constraints; preserve version 1, history, sewing and legacy documents.
- Exercise pinned and frozen sources, mixed/held selections, round-trip, atomic rejection and unchanged state on CPU; do not change solver, contacts, worker or authoring.rs.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/164
- https://github.com/erythrofr/ClothCraft/pull/166

Delivered by #166, merged as 6ffbf341b77a08e29f3bb840fc924b2d2e6e4df0. CPU targeted tests, full no-default suite and strict Clippy passed; seven hosted checks passed. Selected held panels still reject paste; authored target remapping remains unsupported. Reservation released on #164.

## EXO-COORD-003

**Avoid redundant compilation for metadata-only pull requests**

Status: done. Dependencies: EXO-COORD-002.

**Files / directories**

- `.github/workflows/cpu.yml`
- `.github/workflows/build.yml`
- `.github/workflows/release-windows.yml`
- `.github/workflows/rewrite-catalog.yml`
- `scripts/ci-change-scope.mjs`
- `scripts/ci-change-scope.test.mjs`
- `scripts/ci-policy.test.mjs`
- `docs/ci-policy.md`

**Acceptance**

- Classify the exact PR base/head diff with an audited explicit metadata-path allowlist. Unknown/source/asset/template/workflow/build/Cargo changes and unavailable, empty, malformed or truncated diff information require full validation; inspect both rename paths and deletions.
- Always emit the seven existing required check names, with an explicit metadata-only decision summary rather than claiming a compilation ran. No top-level path filters. Main pushes and manual runs retain full validation.
- Always run catalog, coordinator, classifier and CI-policy checks. Preserve the trusted serialized coordinator and read-only PR permissions; never execute untrusted PR input with privileged credentials.
- Do not upload stale binaries or advertise metadata decisions as tested release artifacts. Retain current platform checks for all full-validation cases.
- Add offline cases for allowed metadata, mixed/source/assets/workflows, rename/delete and failed/malformed diff acquisition. Verify real GitHub completion for metadata-only and source-changing revisions and record observed timings.
- Revise unconditional-CPU policy assertions coherently with the approved decision gate; any uncertainty defaults to full checks. Document the allowlist rationale and limitations.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/158
- https://github.com/erythrofr/ClothCraft/issues/8#issuecomment-6431998448
- https://github.com/erythrofr/ClothCraft/pull/160

Delivered by #160, merged as a7b9feca37bfda1b0267bb0257c8ed4e40d3b02a after seven checks. Exact-path metadata experiment #161 completed seven checks in 5–29 seconds per job excluding queue, with compilation and artifact uploads skipped; source-changing #160 ran full checks. See #158 for run IDs, failure fallback and remaining runner-queue limitations. Reservation released.

## EXO-QA-006

**Ship and verify the local authoring process across platforms**

Status: done. Dependencies: EXO-UX-006.

**Files / directories**

- `.github/workflows/build.yml`
- `scripts/check-packaged-session.py`
- `docs/install.md`

**Acceptance**

- Build and stage cloth-session with the existing Linux, macOS and Windows executables; retain assets, notices and exact revision metadata.
- Exercise the staged executable in a directory containing spaces with a bounded CPU-only protocol client: verify hello/version/request IDs, explicit open of a bundled template, guarded edit, undo/redo and serialized template round-trip through a fresh process.
- Require clean EOF and exit; reject malformed replies, mismatched revisions, no-op edits and timeouts. Keep generated fixtures isolated and never overwrite user documents.
- Preserve existing platform CPU coverage and seven required check names. Do not initialize a GPU or imply live-editor attachment.
- Document artifact names, invocation and limitations. Distinguish protocol acceptance from native editor interaction and hardware/driver certification.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/151
- https://github.com/erythrofr/ClothCraft/issues/8#issuecomment-6431098836
- https://github.com/erythrofr/ClothCraft/pull/150
- https://github.com/erythrofr/ClothCraft/pull/153

Delivered in #153, merged as 3e8a1424aeebf89a30dc793137ca651eecea4d45 after seven green checks at 40d78eb9bc50771cd5f93af84d3bc3f2a333ea90. Inspected release job logs on Linux 121951688890, macOS 121951689218 and Windows 121951689349 each confirm 17 requests in two processes: polygons, sewing, stale guards, history and exact fresh-process reopen from a path with spaces. Local failure probes reject malformed replies, wrong IDs, early/nonzero exit, extra output, no-op edits and response/EOF hangs. Seven CI policy tests pass. Reservation release was accepted on #151. This completes distribution/protocol acceptance, not EXO-QA-002 native dialogs or driver certification.

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

## EXO-COORD-002

**Explain malformed reservation commands without changing ownership**

Status: done. Dependencies: EXO-COORD-001.

**Files / directories**

- `scripts/coordination/engine.mjs`
- `scripts/coordination/engine.test.mjs`
- `docs/agent-coordination-protocol.md`

**Acceptance**

- Recognized malformed verbs report exact accepted syntax and the Commands documentation link; unknown verbs use bounded help without echoing arbitrary input.
- Reducer tests prove malformed commands do not change ownership, heartbeat, phase or scopes, including missing labels, extra arguments and malformed release-force.
- Preserve strict parsing, valid commands, edited-comment rejection, authorization and deterministic replay. Never infer identity or expire reservations automatically.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/8#issuecomment-6419823081
- https://github.com/erythrofr/ClothCraft/issues/129
- https://github.com/erythrofr/ClothCraft/pull/132

Delivered by #132 at f691a465 after all seven hosted checks passed at ff3e690. All 43 coordinator/catalog/CI-policy tests passed. Live malformed status comment 6423988589 returned the exact correction syntax and protocol link; the complete tasks state was identical before and after. Evidence: issue #129 comment 6424009052. Strict grammar, authorization, edited-comment rejection and reservation ownership remain unchanged. No automatic expiry or takeover.

## EXO-CORE-001

**Agree editor, document and solver ownership contract**

Status: done. Dependencies: none.

**Files / directories**

- `docs/exo-contract.md`

**Acceptance**

- Document metres, stable panel/boundary IDs, rest/state separation and unsupported EXO fields.
- Specify which data is authoritative, revision preconditions, cache invalidation and version negotiation; include one synthetic interchange example.
- Maintain current Project v1 / GarmentTemplate v2 compatibility; no new backend selector.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_DATA_MODEL.md
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CONVERSION_STATUS_2026-10-18.md
- https://github.com/erythrofr/ClothCraft/pull/30

A bounded design decision with maintainer approval, not a request to rewrite all schemas. Completed in merged PR #30. Accepted design boundary documented on issue #10. Independently validated native synthetic template: two panels, one seam, 38 vertices, 44 triangles. Proposed session/revision transport remains unimplemented; this completes the design task only.

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

Status: done. Dependencies: none.

**Files / directories**

- `src/garment/polygon.rs`
- `src/garment/markings.rs`
- `src/garment/shapes.rs`
- `src/garment/presets.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/fitting.rs`
- `src/atelier/board.rs`
- `src/atelier/authoring_ui.rs`
- `src/garment/export.rs`
- `tests/pattern_markings.rs`
- `tests/pattern_print_svg.rs`
- `src/pattern_import.rs`
- `src/garment/svg_import.rs`
- `src/garment/mod.rs`
- `docs/markings.md`
- `docs/interoperability.md`

**Acceptance**

- Compare PR1 and PR6 schema/semantics before choosing or reconciling them; avoid duplicate representations.
- Verify curved boundaries, round trips, mirror/split/delete behavior and metadata-only state preservation.
- Keep complete cutting contours and exported notch markers inside physical sheet bounds; cover unchanged holes and exact/near-notch splits with explicit preservation or refusal.
- Exercise native controls through the CPU named-widget harness, keeping UI draft state in authoring_ui.rs and leaving the reserved src/atelier.rs entrypoint untouched.
- Reject malformed outer/hole point and edge counts before marking helpers index them; add regressions for the public helpers and the compile path.
- Report provenance and rebase/test on current main; merge only after review.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/patternSewingNotches.js
- https://github.com/erythrofr/ClothCraft/pull/1
- https://github.com/erythrofr/ClothCraft/pull/6

Delivered by PR #6, merged as 3f52d66f400c5d04f6e9b58c5402694f4717b867 from 3809c0f72b11012296e999838e767eed92a704d3. Maintainer acceptance/provenance review and independent 24-marking + 6-print CPU retest are recorded on issue #12 (comment 6549374620); all seven hosted checks passed. Firefly's release was accepted (comment 6549401947). One optional notch schema, complete/refused cutting contours, malformed-input rejection, curve/split/mirror/round-trip tests, physical SVG containment and CPU widget/transition coverage are integrated. Notches remain sewing-line guides; seam correspondence, cut-edge marks, tiling/PDF, native pointer and physical-printer calibration are separate follow-ups. Preserve the merged implementation and attribution.

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
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/pull/80

PR7 touches physics as well as CAD. This task reviews authoring slices; it does not authorize promoting its solver changes. PR #66 (e3994ae80c496eb3e6371309ccabb8e4b7bea3ab) is a later source-only candidate on the same old fork base; compare it rather than assuming it supplies native UI. Focused native UI follow-ups are EXO-CAD-011, EXO-MFG-015 and EXO-SEW-007. Diagnostics are separately scoped under EXO-PHY-004; the EXO session remains outside this owner-requested work. Partial delivery: #80 merged the isolated DartCutSew transaction with full chain protection and seven focused tests; it did not deliver persistent POMs or manufacturing cutlines. Native dart UI is tracked separately in EXO-SEW-007. Do not re-import the old unsafe split migration or count this broad review task as done.

## EXO-REV-003

**Review physical SVG output contribution**

Status: done. Dependencies: none.

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
- https://github.com/erythrofr/ClothCraft/pull/77

PR #77 integrates Mikyle Couto's PR #3 on current main with author attribution, early artifact validation and bounds for outward curves. Six targeted CPU tests pass; Edge 156 headless measurements on four actual CLI exports put the 100 mm ruler within 0.001 mm, with every sewing contour contained. Existing preview remains separate. Physical printing, seam allowances, nesting, tiling and PDF remain unimplemented/unverified; this completes the reviewed SVG subset, not production pattern printing. Preserve this exporter when reconciling PR #6. See docs/interoperability.md and issue #14 for evidence.

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

Status: done. Dependencies: none.

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
- https://github.com/erythrofr/ClothCraft/pull/32

At audit time PR2 had 2212998 additions. Counts are review scope, not functional completeness. Completed in merged PR #32. Accepted bounded review on issue #16. Separates authoring, session and solver proposals and identifies follow-up slices. No bulk EXO code/assets approved or imported; historical source claims retain their stated verification limits.

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

Status: done. Dependencies: none.

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
- https://github.com/erythrofr/ClothCraft/pull/27

Completed in merged PR #27. Original Rust fitter accepted and integrated in #35. Error is measured at input sample chord-length parameters, not a continuous Hausdorff guarantee; bounded inputs, corners and duplicate handling have CPU tests.

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

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/trims.rs`
- `tests/trim_model.rs`
- `src/garment/mod.rs`
- `src/garment/template.rs`
- `src/garment/presets.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/authoring/clipboard.rs`
- `src/atelier/authoring_ui.rs`
- `src/fitting.rs`
- `docs/trims.md`

**Acceptance**

- Persist bounded, uniquely identified buttons, buttonholes, zipper paths and topstitch rows as panel-local material-space construction metadata. Validate units, geometry and panel references atomically; preserve legacy document loads.
- Implement authoring transactions with undo/redo and save/reopen. Specify and test panel duplication, deletion, clipboard, mirror, remesh and topology edits: preserve attachment identity or explicitly reject unsupported operations instead of silently dropping or misplacing trims.
- Metadata-only edits and undo/redo preserve physical mesh signature, drape and worker/solver state. Exercise actual authoring and editor-install paths and project save/reopen on CPU; distinguish these checks from a concurrent worker or native-window run.
- Treat every trim as visual/manufacturing metadata, not a physical fastener; document unsupported physical behavior. Reconcile shared files and schema semantics with the open marking and CAD contributions before implementation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/trims.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/hardwareStyleProperties.js

A standalone type cannot satisfy saved authoring, lifecycle and drape-preservation requirements. This scope covers the persistent foundation; native editing and rendering remain in EXO-SEW-003. Registration or a scope change is not an assignment.

## EXO-SEW-003

**Add trim editing, picking and previews**

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/trims_ui.rs`
- `src/atelier/board.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/authoring_smoke.rs`
- `src/atelier/chrome.rs`
- `src/atelier/edges_3d.rs`
- `src/atelier/selection.rs`
- `src/render.rs`
- `src/garment/embedding.rs`
- `tests/embedding.rs`
- `tests/trim_authoring.rs`
- `src/atelier.rs`
- `docs/trims.md`

**Acceptance**

- Provide a native workflow to create, select, move, edit and delete all supported trim types, with explicit panel ownership, validation, cancellation and one undoable transaction per confirmed operation. Clearly label objects nonphysical.
- Display trim previews on the rotated/translated 2D panel and on the corresponding deformed 3D surface without changing rest geometry or simulation. Resolve material coordinates using transient attachments, invalidate them on remesh, bound work and report unsupported/out-of-panel geometry rather than silently misplace it.
- For detailed panels, investigate bounded material-space embedding and reuse the existing editor visibility acceleration instead of quadratic path rejection or repeated exhaustive rays. Preserve deterministic triangle ties, hole rejection, current-position cache invalidation and safe failure; compare accelerated results with exhaustive CPU references, and measure cost without claiming simulation or window FPS gains. Never reuse an editor visibility cache as a collision guarantee.
- Exercise real controls and commands with the named-widget CPU harness, preview geometry and cache invalidation, rollback, undo/redo and Save/Open. Respect diagnostic overlays and visibility settings; distinguish CPU tests from opt-in native-window/GPU visual acceptance.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/proceduralHardwarePreview.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/clo7NativeHardwareActions.js

The concrete persistent trim foundation merged in #195 (0df7bb5); it is sufficient to start the native workflow without waiting for the broader SEW-002 review of independent open contributions. SEW-002 remains open, and this change does not claim its acceptance or reduce this task's UI/preview requirements. Inspector and viewport paths overlap #6 and SEW-002; check the live board and open PRs before claiming. Existing embed_point/embed_path can derive transient 3D attachments, but cost, remesh invalidation and out-of-panel behavior require explicit handling. The scalability scope adds the shared material embedding and editor visibility implementation and tests; coordinate with EXO-UX-004 and existing contributors, release and reclaim after any scope change, and do not change physical collision behavior.

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

Status: ready. Dependencies: EXO-SEW-001, EXO-PHY-001.

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

Dependencies SEW-001 and PHY-001 are delivered. Ready for a bounded CPU research probe, not a production solver change. First reproduce the current compiled-seam energy/force behavior and unequal-length geometric easing on a public two-panel fixture. Any experimental elastic law must state rest length, stiffness units and energy, verify gradients with finite differences, and test pull/hold/release from identical x/v/time and material geometry. Report residual motion and complete step cost separately; no arbitrary projection, sleep threshold or increased damping as a claimed physical fix. Keep the experiment opt-in and current easing/worker/contact behavior unchanged. Only docs/elastic-seams.md and examples/elastic_seam_probe.rs are authorized; request a reviewed expansion if production internals are inaccessible. Register a task issue and obtain an accepted claim before implementation.

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

Persistent POM schema is already proposed in PR7; do not invent a second representation. EXO-MFG-015 is the separate single-size persistent pattern-measurement UI slice. Reuse its reviewed model/UI when extending to size/tolerance reports; do not block the single-size tool on grading.

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

Status: done. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/svg_import.rs`
- `tests/svg_import.rs`
- `src/garment/mod.rs`
- `Cargo.toml`
- `Cargo.lock`
- `docs/svg-import.md`

**Acceptance**

- Parse explicit physical units/transforms and closed contours with a stated curve tolerance.
- Reject external/script content and unsupported ambiguity; bound input resources.
- Produce unsewn editable pieces and a loss report; never infer seams from nearby paths.
- Measure curve tolerance after all transforms in metres; verify physical units, viewBox origin/aspect handling and reflected/nonuniform transforms against independent fixtures.
- Explicitly handle or reject compound holes, open contours, nested viewports and unsupported style/clipping semantics; never silently import distorted or incomplete outlines.
- Bound bytes, nesting, tokens, output points and piece count, and test invalid input rejection without external file/network resolution.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/svgPatternImport.js
- https://github.com/erythrofr/ClothCraft/pull/101

Merged in #101 as dcbc3154 after all seven checks passed at 4aea2c3. Strict physical SVG reader and prepared editable conversion; nine CPU fixtures cover units/transforms/tolerance, rejection budgets, source preservation, undo/redo and save/reload. Independent implementation over quick-xml 0.41.0 (MIT) and svgtypes 0.16.1 (MIT OR Apache-2.0); no EXO source transplant. docs/svg-import.md records exact subset and losses. No native import dialog yet; EXO-IO-011 is the UI follow-up. Reader reservation released on issue #99.

## EXO-IO-002

**Import generic 2D DXF pattern entities**

Status: done. Dependencies: EXO-CORE-001.

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
- https://github.com/erythrofr/ClothCraft/pull/88

PR #88 merged after all seven CI checks passed at 7948994. Ten locked CPU tests and strict Clippy passed, including an independently generated ezdxf 1.4.5 fixture; a separate full-file smoke read 17,738 bytes with three paths, explicit millimetre units and no issues. ASCII planar geometry adapter only; no native picker, automatic stitching, block transforms or industrial dialect semantics. Issue #87 records the evidence and accepted scope release. Native panel conversion/UI is EXO-IO-010.

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

Status: done. Dependencies: EXO-CORE-001.

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
- https://github.com/erythrofr/ClothCraft/pull/62

Merged PR #62 implements the bounded static geometry library importer; all four CI workflows passed at b3dcc521. Native file-picker, confirmation and portable project integration are EXO-IO-009, not claimed by this completed library slice.

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

**Integrate visual fabric appearance without resetting physics**

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/appearance.rs`
- `tests/appearance.rs`
- `src/garment/mod.rs`
- `src/garment/template.rs`
- `src/garment/presets.rs`
- `src/authoring.rs`
- `src/authoring/clipboard.rs`
- `src/fitting.rs`
- `src/atelier/fabrics_ui.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/chrome.rs`
- `src/render.rs`
- `src/cloth.wgsl`
- `src/gpu_bench.rs`
- `tests/shader.rs`
- `docs/fabric-appearance.md`

**Acceptance**

- Define validated fabric color, roughness, normal/texture references and material-space scale/orientation with explicit color-space, units and asset-identity conventions. Preserve current defaults and legacy document serialization when appearance is absent.
- Integrate supported appearance into the native fabric inspector and rendered cloth, using shared fabric IDs. Preserve diagnostic overlay precedence; unsupported texture/normal assets must not be advertised as rendered. Do not stop at an unused schema.
- Appearance-only edits and Undo/Redo preserve positions, velocities, simulation time, physical cache signature and solver/worker state. Route changes through the existing transactional history/installer; appearance does not infer measured mechanics.
- Preserve appearance ownership across duplicate, clipboard, delete, material edits and portable save/reopen; explicitly reject unsupported asset operations rather than silently dropping references.
- Test invalid-input rollback, old-file defaults, exact physical-signature invariance, history/drape preservation, named inspector controls and actual renderer data preparation. Validate WGSL on CPU; record GPU/native-window acceptance separately and run it only with current authorization.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricSurfaceModel.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricPbrAppearance.js
- https://github.com/erythrofr/ClothCraft/issues/126
- https://github.com/erythrofr/ClothCraft/pull/128

Solid color and roughness merged in #128 as ff5053b after seven successful checks at 654fd9d. Shared Fabric inspector edits bind to actual rendering and preserve drape, worker state and physical cache identity. Acceptance harness #137 merged as 0b38329 after seven green checks at 647128e: native paused history, in-flight Apply/Undo/Redo, isolated Save/Open, visible roughness, exact RGB editing, independent-fabric isolation and flat strain-overlay precedence have recorded evidence at explicit revisions. The earlier manual Undo observation was not reproduced by instrumented native history checks; do not claim its root cause was established. Texture/normal assets and material-space transforms remain unsupported, so LOOK-001 stays incomplete. See docs/fabric-appearance.md and #137; no upstream code/assets imported.

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

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/garment/graphics.rs`
- `tests/graphic_placements.rs`
- `src/garment/mod.rs`
- `src/garment/template.rs`
- `src/garment/presets.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/authoring/clipboard.rs`
- `src/atelier/authoring_ui.rs`
- `src/fitting.rs`
- `docs/graphics.md`

**Acceptance**

- Persist bounded, uniquely identified material-space placements with stable panel IDs and opaque asset references; legacy documents load unchanged and existing valid panel IDs remain referencable. Unresolved asset IDs are metadata, not evidence of portable image loading.
- Reject invalid or dangling records atomically. Specify and test duplicate, remove, mirror, topology edits, clipboard and remesh behavior; preserve or explicitly reject references rather than silently lose or orphan them.
- Metadata-only edits and undo/redo preserve drape, physical mesh signature and worker/solver state. Exercise actual authoring/install paths and save/reopen, not only serialization or a reset flag.
- No third-party artwork fixtures. Asset storage/loading, rendering and native editing remain separate work; coordinate overlapping shared files with the open markings PR #6 before implementation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativeGarmentGraphics.js
- https://github.com/erythrofr/ClothCraft/pull/178
- https://github.com/erythrofr/ClothCraft/pull/180
- https://github.com/erythrofr/ClothCraft/pull/182

The merged placement math and transient per-triangle UVs are not document persistence, asset loading, rendering or a UI. Scope expansion enables a coordinated durable metadata slice; PR #6 overlaps authoring.rs, geometry.rs, authoring_ui.rs and fitting.rs. Confirm current claims and reconcile its review before touching shared paths. This scope change does not complete the task or grant rights to EXO source/assets.

## EXO-LOOK-006

**Render and edit garment graphics**

Status: blocked. Dependencies: EXO-LOOK-005.

**Files / directories**

- `src/render/graphics.rs`
- `src/atelier/graphics_ui.rs`
- `tests/graphics_ui.rs`
- `src/atelier.rs`
- `src/render.rs`
- `src/cloth.wgsl`
- `src/document.rs`
- `src/fitting.rs`
- `src/garment/graphics.rs`
- `src/garment/template.rs`
- `src/authoring.rs`
- `src/authoring/clipboard.rs`
- `src/atelier/documents_ui.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/board.rs`
- `src/atelier/authoring_smoke.rs`
- `tests/graphic_placements.rs`
- `tests/shader.rs`
- `docs/graphics.md`
- `Cargo.toml`
- `Cargo.lock`

**Acceptance**

- Implement a usable native workflow to import PNG, place/rotate/scale it on the selected 2D panel, pick/delete and undo/redo; render the placement on the correct front/back draped 3D panel with explicit clipping and layering. Do not advertise unsupported image formats or vector execution.
- Persist portable project-owned image assets and placement identities across Save, Save As, reopen, duplicate and clipboard operations. Handle missing files, overwrite/collision and partial write failures explicitly without corrupting the previous document or silently dropping artwork.
- Bound compressed and decoded PNG input, dimensions, asset counts and GPU resources; reject invalid data safely. Specify sRGB/linear and alpha conventions, preserve panel identity and existing diagnostic-overlay precedence, and do not change physical rest geometry, solver, drape or worker state for visual edits.
- Cover actual native control transactions with the named-widget CPU harness, asset serialization and portability, rejection/rollback, triangle UV preparation and WGSL validation. Record native-window/GPU visual acceptance separately, opt-in with current authorization; use only original or suitably licensed fixtures.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativeGarmentGraphics.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativeGraphicStorage.js

Artwork overlays can be implemented over the already shipped solid color/roughness renderer without requiring the separate fabric texture/normal-map pipeline. LOOK-005 must be fully accepted first. The scope includes shared paths also present in open #6 and #188; inspect and coordinate their current heads and claims before editing. If multiple contributors are active, review smaller non-overlapping asset, UI and renderer scopes and release shared files while waiting; preserve the end-to-end acceptance gate. A scope proposal or stored opaque asset ID does not itself make images usable or grant EXO code/assets.

## EXO-LOOK-007

**Define reproducible stage, lighting and camera settings**

Status: done. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/stage_settings.rs`
- `tests/stage_settings.rs`
- `src/atelier.rs`
- `src/render/appearance.rs`
- `src/render.rs`
- `src/cloth.wgsl`
- `tests/shader.rs`
- `docs/stage-settings.md`

**Acceptance**

- Persist camera/environment/light settings separately from solver inputs.
- Preserve current background/floor controls and existing preferences.
- Validate values and asset references; decorative geometry is not a physical collider.
- Expose bounded directional-light rotation and ambient/key intensity controls through the existing Presentation UI. Wire both legacy/diagnostic and authored-optics shader paths to the same presentation settings; defaults preserve current lighting. Do not add fake HDRI or asset controls.
- Keep old preferences and fixed-rig presentation snapshots loadable with documented defaults. Save the new configurable rig with explicit version/identity validation; reject unsupported assets or invalid snapshots without partial application.
- Validate host/WGSL uniform layout and named controls on CPU; use separately authorized native captures to check directional changes and intensity endpoints. Presentation edits must preserve garment/history/worker state. Clearly distinguish illustrative lighting and floor-shadow presentation from calibrated materials or physical collision.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/createStageEnvironment.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sceneCameraViewport.js
- https://github.com/erythrofr/ClothCraft/blob/54930c6487990e0bacec851495df01f3fecd601b/docs/stage-settings.md
- https://github.com/erythrofr/ClothCraft/pull/121
- https://github.com/erythrofr/ClothCraft/pull/157

Delivered by #121 and #157. Camera/environment/lighting presentation is separate from solver state, with validated versioned snapshots and legacy defaults. CPU layout and nested-menu fixtures passed; short native Windows captures and Save/Reset/Restore interaction are documented in docs/stage-settings.md. Both shading paths use bounded directional rotation and ambient/key gains. HDRI, multiple lights, decorative geometry and directional floor shadows remain unsupported; no photometric or simulation-performance claim. Reservation released on #120.

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

Status: done. Dependencies: EXO-CORE-001.

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
- https://github.com/erythrofr/ClothCraft/pull/57
- https://github.com/erythrofr/ClothCraft/pull/57

Merged PR #57: versioned metre-based landmarks and explicitly confirmed measurements, separate visual/collision asset identities, and 8 CPU tests. Foundation only: no anatomical inference, surface attachment or measurement UI.

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

Dependencies are now satisfied, but scope/behavior review is still required before promotion. Existing Command::Place and Placement already define metre translation and Rx*Ry*Rz rotation of local (u,-v,0); reuse these transactions. Named body landmarks, persistence and avatar-replacement invalidation are not supplied by generic placement. Specify whether anchors are authored or derived before choosing schema paths; persistent anchors may require a reviewed fitting-document scope expansion. Initial separation must use the actual avatar/cloth validation path, not a bounds-only clearance promise. Account for open appearance PR #128 before editing the shared garment module. No implementation claim yet.

## EXO-AV-003

**Expose pin editing and an explicit freeze policy**

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/pins_ui.rs`
- `src/authoring.rs`
- `tests/pin_authoring.rs`
- `src/atelier.rs`
- `src/garment/pins.rs`
- `src/garment/mod.rs`
- `src/garment/template.rs`
- `src/garment/presets.rs`
- `src/atelier/authoring_ui.rs`
- `docs/pins.md`

**Acceptance**

- Reuse material-space pin_points instead of persisting mesh indices.
- Define pin versus freeze semantics and preserve undo/reload/remeshing behavior.
- Test release motion and stale-worker invalidation on CPU; GPU validation remains opt-in.
- Pin at the current drape and release without returning the panel to its flat arrangement. Persist material-space identity and world targets through ordinary template history and save/reload; preserve legacy documents and cache signatures when the new fields are absent.
- Whole-panel freeze retains collision participation. Reject unsupported topology changes atomically with an explicit release-first error; never silently lose holds or retarget arbitrary mesh indices.
- Test held vertices, release from zero held velocity, unchanged free-panel motion, invalid-target rollback, undo/redo, serialization, remesh policy and production worker-generation invalidation. No position projection or disabled contacts to conceal invalid initialization.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/backends/protocol.js

Issue #116 records the source audit and contract. Existing pin_points bind to initial placement and changing pins resets the panel; the native tool must not expose that reset as pin-at-current-position. Approved extension includes optional template-level target/freeze records, compiler/constructor integration, real history/state transitions and CPU acceptance. No worker, energy, collision or solver algorithm changes are authorized by this task. Follow docs/pins.md; claim before implementation.

## EXO-AV-004

**Show avatar collision coverage and initialization problems**

Status: done. Dependencies: none.

**Files / directories**

- `src/avatar/diagnostics.rs`
- `src/avatar.rs`
- `src/atelier/avatar_diagnostics.rs`
- `src/atelier/chrome.rs`
- `tests/avatar_diagnostics.rs`
- `docs/avatar-diagnostics.md`

**Acceptance**

- Report actual collider geometry identity, bounds and supported static-mesh assumptions.
- Show diagnostics separately from cosmetic avatar appearance.
- No collision approximations may be silently substituted to improve appearance/performance.
- Expose a read-only native inspection action with explicit freshness, coverage and unavailable checks; no per-frame mesh analysis or mutation of the solver/contact cache.
- Exercise closed, open, nonmanifold and inconsistently oriented fixtures plus named-widget refresh/staleness behavior on CPU; topology checks must not be described as proof of no intersections or valid initial separation.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/meshAvatarContact.js
- https://github.com/erythrofr/ClothCraft/pull/96

Completed in PR #96, merged as 42addbc1c1c66aff5fe711112c3f6ed4685dc13b after seven green checks. Properties > Simulation exposes bounded asynchronous static-mesh inspection and the existing CPU VBD initialization gate, with explicit freshness and no live solver/cache mutation. Five CPU backend tests, 87 active desktop tests and strict Clippy passed; three named-widget tests exercise real jobs and failures. Topology is not an intersection/global-containment certificate; local sewing exclusions remain. Native GPU appearance was not tested. See docs/avatar-diagnostics.md and issue #20 for evidence and confirmed reservation release.

## EXO-UX-001

**Publish a typed command capability registry**

Status: done. Dependencies: none.

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
- https://github.com/erythrofr/ClothCraft/pull/29
- https://github.com/erythrofr/ClothCraft/pull/97

Completed through merged PR #97 (c558dc6), preserving Mikristian original authorship from #29. Twelve implemented native commands have typed metadata, availability reasons and checked runtime dispatch. All seven checks passed at a8c601f. CPU fixtures cover metadata, worker disconnect and export failures; native GPU window acceptance is not claimed. See docs/command-registry.md for queue/completion and undo/export limitations. The board confirms the reservation is released.

## EXO-UX-002

**Add a searchable command palette**

Status: ready. Dependencies: EXO-UX-001.

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
- https://github.com/erythrofr/ClothCraft/pull/110

Palette merged in #110 as 742b4ef; backdrop dismissal/no-click-through regression merged in #142 as 2fb90fd. Commands or Ctrl/Cmd+Shift+P use the shared registry and dispatcher. Follow-up #143 at 1c516f3 tests the production launch boundary with actual egui text focus, modal, pointer and keyboard events; eight focused tests, 121 full desktop CPU tests (one optional preview ignored) and strict Clippy pass. #143 CI/review remain pending. Native platform input-isolation acceptance is still distinct; task remains incomplete. See docs/command-registry.md and #109. Source reservations released; inspect existing implementation before claiming follow-up work.

## EXO-UX-003

**Persist workspace layouts and tool visibility**

Status: ready. Dependencies: EXO-UX-001.

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
- https://github.com/erythrofr/ClothCraft/pull/114

PR #114 merged as fcc7356 after seven green checks at da2f4ad; named presentation profiles are implemented. Five profile fixtures and 110 desktop CPU tests pass (one optional preview ignored), plus strict desktop Clippy. Scope and native-window acceptance limits are in the PR. Reservation released on #113; obtain a fresh accepted claim before follow-up edits. Do not duplicate the proposed profile store.

## EXO-UX-004

**Add group 3D transforms and marquee selection**

Status: ready. Dependencies: EXO-CORE-001.

**Files / directories**

- `src/atelier/selection.rs`
- `src/atelier/gizmo.rs`
- `src/atelier/authoring_ui.rs`
- `src/authoring.rs`
- `tests/group_placement.rs`
- `src/atelier.rs`

**Acceptance**

- Define visible-only versus through selection and the group transform pivot.
- Commit one transaction, preserving each panel rest shape and explicit drape reset policy.
- Test cancel/undo, linked pairs, hidden geometry and generation invalidation.
- For remaining headless acceptance, extract the existing CPU install/cancel transitions behind thin Atelier wrappers and test those production functions. Preserve reset/selection/history semantics; do not create a test-only replacement installer or change physics.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/meshSelection.js
- https://github.com/erythrofr/ClothCraft/pull/111

Group placement merged in #105 as 2f9f9c5 after seven green checks: shared-pivot transforms and bounded visible/Alt-through marquee. Follow-up #111 merged as 07c4988: direct production cancellation/install CPU tests cover x/v/time restoration, history, group placement, invalid input, layout-only preservation and stale generation filtering. Full native pointer flow and concurrent worker timing remain separate acceptance; see docs/group-placement.md. Reservation released on #104. Claim the remaining validation slice rather than recreating the feature or transition fixture.

## EXO-UX-005

**Create a provenance-aware garment template browser**

Status: done. Dependencies: none.

**Files / directories**

- `src/template_catalog.rs`
- `src/atelier/template_browser.rs`
- `tests/template_catalog.rs`
- `src/lib.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/documents_ui.rs`
- `docs/template-browser.md`

**Acceptance**

- Index bundled original templates with preview, metadata, units and source/license.
- Validate templates before opening; loading replaces a document only after user-visible confirmation.
- External patterns are explicit imports, not automatically downloaded or declared redistributable.
- Exercise the real browser widgets through the CPU named-widget harness, including cancel, confirmation and invalid input.
- Opening a template starts a new document: preserve the current document on cancellation or validation failure; clear its saved path and undo history only after successful replacement.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/openSourcePatternToolCatalog.js
- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/projectFileLibrary.js
- https://github.com/erythrofr/ClothCraft/pull/63

Owner-approved scope amendment: integrate through authoring_ui.rs and documents_ui.rs while atelier.rs remains reserved by EXO-UX-001. No solver changes. Completed in merged PR #63 at 92127e54 after all CI checks passed. Six original embedded templates, flat previews, native template JSON import and explicit safe document replacement; CPU named-widget tests cover cancel, confirmation, invalid avatar, keyboard focus and a small window. Native dialogs and GPU visual acceptance remain untested; examples are ungraded engineering fixtures.

## EXO-UX-006

**Expose a versioned headless authoring session adapter**

Status: done. Dependencies: EXO-CORE-001, EXO-REV-005, EXO-UX-001.

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
- https://github.com/erythrofr/ClothCraft/pull/123
- https://github.com/erythrofr/ClothCraft/pull/125
- https://github.com/erythrofr/ClothCraft/pull/131

Scoped headless adapter acceptance completed by merged #123, #125 and #131 (latest 64443ee). The canonical cloth-session JSON-lines process routes ten advertised commands to native transactional authoring with guarded session/revision, preparation/cancellation, undo/redo and bounded framing. Eight CPU protocol tests, real interactive process acceptance and strict Clippy passed; all seven CI checks passed before #131 merged. Earlier handoffs kept the broader automation effort open for live-editor attachment and packaging; those remain unsupported, but are outside this task's three declared headless acceptance criteria and file scope. This completion does not claim full native-command coverage, live UI control, physics execution or distributable packaging. Read #122 before extending the existing adapter; do not create a competing protocol. Claim release is confirmed.

## EXO-QA-001

**Build public cross-editor behavioral fixtures**

Status: done. Dependencies: EXO-CORE-001.

**Files / directories**

- `tests/fixtures/rewrite/`
- `docs/rewrite-fixtures.md`

**Acceptance**

- Create original small garments covering curves, holes, partial seams, trims and invalid inputs as supported.
- Pin each source model/revision and record losses when converting between representations.
- Do not redistribute private garments, upstream proprietary references or unreviewed EXO assets.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_VALIDATION_TEST_PLAN.md
- https://github.com/erythrofr/ClothCraft/pull/55
- https://github.com/erythrofr/ClothCraft/pull/55

Merged PR #55: 11 original public fixtures, 29 CLI semantic checks and 4 Python tests; an incorrect-area negative control fails. These Python checks are local, not wired into CI. No private garments or copied assets.

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
- https://github.com/erythrofr/ClothCraft/pull/82

 Follow-up #82 merged as 8d57f745 after all seven checks passed at 8a6014b. The extracted-package native launch/capture step completed on hosted Windows (job 121735456975); exact-head PowerShell syntax was also checked locally. This proves CLI project write/load and native launch/capture, not native Save, Export, editing, dialogs, clipboard or physical GPU certification. EXO-QA-002 remains incomplete. Check the live board: merging this increment did not release the contributor reservation.

## EXO-QA-003

**Verify native macOS and Linux build paths**

Status: done. Dependencies: none.

**Files / directories**

- `.github/workflows/build.yml`
- `docs/platform-validation.md`

**Acceptance**

- Build the CPU core and desktop targets on named platform/toolchain versions.
- Document platform-specific dialogs, paths, clipboard and GPU backend limitations.
- A successful compile is distinct from native interaction/GPU acceptance.

**Evidence and related contributions**

- https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RELEASE_STATUS.md
- https://github.com/erythrofr/ClothCraft/pull/45

Completed in merged PR #45. Named-platform CPU tests and desktop linkage verified from completed jobs and recorded image/toolchain metadata in docs/platform-validation.md. Native window, dialogs, clipboard and GPU acceptance remain pending and are not implied by this build-path task.

## EXO-PHY-001

**Define capabilities for real interchangeable solver adapters**

Status: done. Dependencies: EXO-CORE-001.

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
- https://github.com/erythrofr/ClothCraft/pull/59

Merged PR #59 documents and validates real adapter capabilities. Research backends remain opt-in; no production solver selector was added.

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

Status: done. Dependencies: EXO-SEW-001.

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
- https://github.com/erythrofr/ClothCraft/pull/46

Original Rust UI adapter, no EXO code/assets copied. Keep cache in AuthoringUi separately from SewingDraft so selecting another seam does not discard the report. Use existing generation invalidation conservatively. No new solver telemetry, automatic repair, document fields, atelier.rs or command-registry changes. A synchronous explicit audit can pause the UI on large geometry; document this limit rather than claiming a background job. Completed in merged PR #46 after all 13 CI checks passed. CPU audit tests and a native Windows inspection passed; see docs/sewing-audit-ui.md.

## EXO-QA-004

**Exercise editor tools with a deterministic named-widget harness**

Status: done. Dependencies: EXO-SEW-001.

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
- https://github.com/erythrofr/ClothCraft/pull/49

Owner-requested reusable internal testing. Begin from the merged audit UI (#46) and obtain an accepted claim after releasing EXO-SEW-006. atelier.rs is excluded because command-registry work owns that shared file. No new dependencies, private garments, solver changes or EXO source copied. Completed in merged PR #49 after all 13 CI checks passed. Six named-widget scenarios and 58 editor tests passed; one optional preview ignored. Desktop Clippy passed. See docs/widget-harness.md for CPU-only scope and limits.

## EXO-CAD-010

**Place a pattern point at the intersection of two reference edges**

Status: done. Dependencies: EXO-CAD-001, EXO-CAD-002, EXO-QA-004.

**Files / directories**

- `src/authoring.rs`
- `src/atelier/authoring_ui.rs`
- `tests/drawing_commands.rs`
- `docs/authoring.md`

**Acceptance**

- Resolve two straight reference edges by stable panel/boundary IDs in board space, including rotated panels, using the existing Rust intersection primitive.
- Expose Intersection in the point inspector with two edge selectors and a preview of both lines and the proposed point; reject missing, curved, degenerate and parallel references explicitly.
- Do not mutate before Apply; validate through the existing transaction and preserve exact undo/redo and other panels.
- Use the named-widget CPU harness for real selector/mode/Apply events and invalid/stale cases, plus rotated geometry and undo regressions.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/26
- https://github.com/erythrofr/ClothCraft/pull/49
- https://github.com/erythrofr/ClothCraft/pull/52

Original Rust integration of an existing CPU primitive. No solver, serialized document schema, atelier.rs or command-registry edits; no upstream code/assets copied. Infinite reference lines, not segment-clamped intersection. Completed in merged PR #52. Merged after all 13 checks succeeded. 23 drawing-command and 59 editor tests passed; one optional preview ignored. Named-widget scenario exercises both reference menus, invalid/stale cases, Apply and exact undo. Desktop Clippy passed. Infinite straight lines only; no persistent constraints or GPU acceptance.

## EXO-CAD-011

**Edit independent curve points and mirrored splits in the native 2D workspace**

Status: blocked. Dependencies: EXO-REV-001, EXO-REV-002, EXO-CAD-003.

**Files / directories**

- `src/garment/polygon.rs`
- `src/garment/curves.rs`
- `src/garment/domain.rs`
- `src/garment/presets.rs`
- `src/garment/shapes.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/board.rs`
- `tests/curve_point_authoring.rs`
- `docs/authoring.md`
- `docs/handoff.md`

**Acceptance**

- Expose Add/Edit/Remove curve point and Split at point on a selected named outer boundary in the native Piece inspector and 2D board, with millimetre input and visible handles/preview; do not substitute a freehand-new-panel tool.
- Keep stable authored point/boundary identities and cubic geometry through split, including knot-to-vertex promotion and verified linked mirrored splits as one atomic edit.
- Use the reviewed topology-reference mapping for partial/chain seams, measurements, target lengths and markings; reject ambiguous or unsupported edits with an actionable message and no mutation.
- Prove cancel, invalid input, text focus, one-step undo/redo, JSON reopen and rotated-layout editing using real named egui controls plus independent curve geometry checks.
- Preserve current linked-panel semantics, material rest metres and state invalidation; no EXO interface or session dependency.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/issues/13
- https://github.com/erythrofr/ClothCraft/pull/66

Owner-requested native ClothCraft UI slice after reviewing PR #66. Work on a feature branch in NicTanghe/Hamerons_ClothCraft and submit a separate PR to erythrofr/ClothCraft:main. Exclude exo-session, the EXO application, print/hardware adapter fields and unrelated solver changes. Review existing contributions and preserve attribution; no permission to copy incompatible EXO source is implied. This issue is a proposed task until the catalog change is merged, a maintainer registers it, and the coordinator accepts a claim. Use the existing CPU named-widget harness; GPU/native-window acceptance remains opt-in. This is distinct from EXO-CAD-006/009 freehand stroke fitting. Do not add a second topology migration framework.

## EXO-MFG-015

**Create and manage saved pattern measurements in the native 2D UI**

Status: ready. Dependencies: EXO-REV-001.

**Files / directories**

- `src/garment/polygon.rs`
- `src/garment/domain.rs`
- `src/garment/presets.rs`
- `src/garment/shapes.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/fitting.rs`
- `src/atelier/measure.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/board.rs`
- `tests/persistent_pattern_measurements.rs`
- `docs/authoring.md`
- `docs/handoff.md`
- `src/garment/markings.rs`
- `src/garment/svg_import.rs`
- `src/pattern_import.rs`
- `src/authoring/linked.rs`
- `tests/pattern_markings.rs`
- `tests/persistent_pom_references.rs`

**Acceptance**

- Complete the missing saved-model and transactional authoring integration together with the native UI, reviewing the schema/geometry foundation in PR #227 and the existing #66 proposal; do not require completion of unrelated cutline or solver work in broad review task #13.
- Extend the current temporary ruler with an explicit Save measurement workflow: choose two stations on one panel's named boundaries, give a label, and save a stable material-space measurement.
- Show selectable saved measurements and their straight-line rest-space distance in millimetres; support rename/delete and display overlays using the compiled material boundaries.
- Reuse the reviewed POM representation, with boundary arclength fractions and stable IDs; preserve or explicitly reject references through split, mirror, duplicate, delete and boolean operations.
- Keep metadata-only changes from remeshing or disturbing the drape; cover history, v1/v2 compatibility and save/reopen.
- Exercise create/rename/delete/cancel, invalid or stale references and keyboard focus through real named UI controls on CPU.
- Scope this PR to a useful single-size pattern ruler; exclude body/geodesic measurements, draped lengths, grading and tolerance tables.
- Keep the physical mesh fingerprint, metadata-only installer, playback and worker generation coherent; test the real shared installer on CPU in addition to prepared commands and persistence. Constructor-only additions to importers, presets and marking fixtures must remain mechanical.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/issues/13
- https://github.com/erythrofr/ClothCraft/pull/7
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/pull/227

Owner explicitly requests a usable UI in the existing draft PR #227 on NicTanghe/Hamerons_ClothCraft:feature/persistent-pattern-measurements. Issue #69 is already registered. This amendment makes the single-size model + native UI a complete slice: it retains the accepted markings prerequisite and incorporates the missing persistent-measurement backend rather than waiting for every unrelated part of #13. Do not mark EXO-REV-002 or EXO-CAD-003 complete. Review the #66 schema and #227 geometry, preserve attribution, avoid a competing representation, and keep all existing reference-preservation gates. Additional importer/marking fixture paths are for coherent empty defaults; linked.rs is for explicitly reviewed measurement metadata/geometry behavior. No CLI expansion is necessary because the UI is the real caller. Use named CPU controls and the production installer; GPU/native-window checks stay opt-in. Eligibility is not ownership: obtain an accepted claim before source edits. Keep solver, session, manufacturing cutline and graded-size work separate.

## EXO-CAD-012

**Add editable pattern text annotations to the native Piece inspector and board**

Status: blocked. Dependencies: EXO-REV-001.

**Files / directories**

- `src/garment/polygon.rs`
- `src/garment/domain.rs`
- `src/garment/presets.rs`
- `src/garment/shapes.rs`
- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/fitting.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/board.rs`
- `tests/pattern_annotations.rs`
- `docs/authoring.md`
- `docs/handoff.md`

**Acceptance**

- Provide Add label, text/position editing and Delete in the native Piece inspector; show actual saved labels on the 2D board using panel layout transforms.
- Use stable annotation IDs and local material coordinates from the reconciled markings model; do not introduce a parallel annotation representation.
- Support undo/redo and JSON reopen, with explicit mirror/duplicate/delete behavior and finite, unit-aware position validation.
- Keep labels as metadata: no mesh, mass, grain, sewing or drape changes when adding or editing text.
- Use CPU named-widget scenarios for create/edit/delete/cancel, rotated layouts, invalid values and text-field keyboard ownership.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/1
- https://github.com/erythrofr/ClothCraft/issues/12
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/pull/1
- https://github.com/erythrofr/ClothCraft/pull/66

Owner-requested native ClothCraft UI slice after reviewing PR #66. Work on a feature branch in NicTanghe/Hamerons_ClothCraft and submit a separate PR to erythrofr/ClothCraft:main. Exclude exo-session, the EXO application, print/hardware adapter fields and unrelated solver changes. Review existing contributions and preserve attribution; no permission to copy incompatible EXO source is implied. This issue is a proposed task until the catalog change is merged, a maintainer registers it, and the coordinator accepts a claim. Use the existing CPU named-widget harness; GPU/native-window acceptance remains opt-in. PR #1 proposes storage/commands, but not native label editing. Notch and allowance UI is already proposed by PR #6 under issue #12; retain that existing review rather than duplicate it. Construction trims/BOM semantics remain EXO-SEW-002.

## EXO-SEW-007

**Preview and create a cut-and-sewn dart from the native pattern UI**

Status: done. Dependencies: none.

**Files / directories**

- `src/authoring.rs`
- `src/authoring/geometry.rs`
- `src/garment/polygon.rs`
- `src/garment/seam.rs`
- `src/atelier/authoring_ui.rs`
- `src/atelier/board.rs`
- `tests/physical_dart_authoring.rs`
- `docs/authoring.md`

**Acceptance**

- Select a supported unsewn straight boundary and expose Dart with intake position/width and depth in millimetres; show cut legs and apex before explicit Apply.
- Apply one validated transaction that removes the triangular intake and creates the reversed dart-leg sewing relation in the existing implicit objective; preserve stable boundary references and mass/area accounting.
- Reject unsupported curved/sewn/annotated boundaries, incompatible references, invalid or intersecting geometry, and failed compilation without altering the document.
- Support Cancel, one-step undo/redo, save/reopen and coherent remeshing/cache invalidation; do not add a post-solver position projection.
- Exercise real named UI controls on CPU and verify analytic cut area, seam-leg correspondence and unaffected panels. Describe this as a cut-and-sewn dart, not uncut fold mechanics or proven fit.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/7
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/issues/13
- https://github.com/erythrofr/ClothCraft/pull/80
- https://github.com/erythrofr/ClothCraft/pull/7
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/pull/80
- https://github.com/erythrofr/ClothCraft/pull/85

Backend #80 and native UI #85 merged (d0c6e6c). All seven CI checks passed on 7577480. CPU desktop suite: 80 passed, one optional ignored; 18 authoring/dart regressions passed. Named-control tests cover Apply/Cancel, stale selection, narrow inspector, analytic mass, serialization and undo/redo. Cut-and-sewn darts only; unsupported geometry remains rejected. No native GPU/window visual acceptance claimed. Issue #71 records the handoff and accepted release.

## EXO-PHY-004

**Expose correctly timed contact and residual diagnostics in the native Simulation inspector**

Status: done. Dependencies: none.

**Files / directories**

- `src/vbd.rs`
- `src/vbd/audit.rs`
- `src/gpu_vbd.rs`
- `src/atelier/worker.rs`
- `src/atelier/chrome.rs`
- `tests/vbd_final_diagnostics.rs`
- `docs/solver-challenge.md`
- `docs/handoff.md`

**Acceptance**

- Review the final-state diagnostic changes in PR #66 against current upstream, including its existing offline audit, directional bounds and sparse precision refinement; submit a separate focused diagnostic PR.
- Provide an explicit native Simulation inspector action or opt-in sampling control showing accepted-state contact separation/count and free-DOF residual with units, sample time, freshness and backend availability.
- Distinguish accepted-state measurements from pre-update contact detection and mixed-color gradients, and unconstrained residual from constrained equilibrium/KKT; never display an unavailable GPU value as zero.
- Verify pinned/free normalization, inertia, seam and contact gradients with independent CPU oracles and state-preservation checks; include an actual named-widget control/presentation test.
- Measure complete step overhead on matched CPU scenes and keep expensive resampling opt-in unless the performance gate supports a default change; distinguish compute, step and rendering time.
- Preserve collision coverage, predictor, accepted trajectory and rejection policy. The proposed fixed 2 micrometre GPU rejection gate is a separate physics decision and is not authorized by this diagnostic UI task.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/13#issuecomment-6376032311
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/pull/76
- https://github.com/erythrofr/ClothCraft/issues/72#issuecomment-6411088338
- https://github.com/erythrofr/ClothCraft/pull/66
- https://github.com/erythrofr/ClothCraft/pull/76

Delivered by FireflyTheReal in PR #76, merged as b4f8a89680b3a7dcb052ef640262ce1d2e275aa1 after seven green CI checks. Sample final state is an explicit one-shot action: accepted-position contact detection and free-DOF backward-Euler residual, units, physical time, cost, backend and freshness. Requests/results carry generation and request IDs. Five independent numerical tests and seven desktop CPU transport/presentation tests passed in maintainer review; state and next-step trajectory preservation are covered. The contributor recorded matched CPU step/sample timings in docs/solver-challenge.md; sampling stays opt-in and its cost remains outside step_ms. GPU-accepted states use a labelled CPU audit, never fabricated GPU residuals or timings. Native GPU/window runtime acceptance was not performed in this review. This completes the scoped diagnostic implementation and CPU acceptance, not a jitter fix, KKT certificate or changed collision/rejection policy. Broad #66 solver changes remain unmerged. Handoff and release are recorded on issue #72.

## EXO-IO-009

**Integrate static avatar import into the workspace**

Status: done. Dependencies: EXO-IO-007, EXO-UX-005.

**Files / directories**

- `src/avatar_import.rs`
- `src/lib.rs`
- `src/atelier/avatar_import_ui.rs`
- `src/atelier/documents_ui.rs`
- `tests/avatar_import.rs`
- `docs/avatar-import.md`

**Acceptance**

- Expose explicit local OBJ/glTF/GLB import with source, counts, bounds, metre units and loss warnings before confirmation; reject ambiguous scene selection without silent fallback.
- Prepare validated canonical OBJ geometry with an owned staging lifetime; preserve v1 project compatibility and portable save/recovery. Never overwrite the source asset.
- Explain and apply drape reset on avatar replacement, preserving authored rest geometry, seams and live simulation settings. Cancel and preparation failure leave the active project and worker generation unchanged.
- Invalidate old worker responses on successful commit, clear transient interactions and mark the document dirty. Saved assets survive staging cleanup.
- Test actual named controls and shared production transactions on CPU: cancel, invalid input, transforms, save/reload after staging cleanup and old OBJ compatibility.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/62
- https://github.com/erythrofr/ClothCraft/issues/64
- https://github.com/erythrofr/ClothCraft/pull/74

Merged PR #74 at ea8ae2c implements native static avatar import with confirmation, owned canonical OBJ staging, portable save and worker-generation invalidation. All 12 required CI checks passed on source 39c61c9; CPU named-widget and format tests cover the task acceptance. Native OS picker/GPU acceptance remains untested. Geometry only: no rigging, animation, textures, guessed scale or collision repair; dense import is synchronous. See docs/avatar-import.md and issue #64 for evidence.

## EXO-IO-010

**Import reviewed DXF contours as editable native panels**

Status: done. Dependencies: EXO-IO-002.

**Files / directories**

- `src/pattern_import.rs`
- `src/lib.rs`
- `src/atelier/pattern_import_ui.rs`
- `src/atelier/documents_ui.rs`
- `tests/pattern_import.rs`
- `docs/pattern-import.md`

**Acceptance**

- Expose local DXF selection, explicit source scale/units and a bounded 2D preview with layer, entity, closure and unsupported-entity information before confirmation. Missing units require user input; never silently guess.
- Let the user explicitly select closed contours to create unsewn editable panels. Keep cut/sew source paths separate; reject ambiguous nested, overlapping or self-intersecting contours rather than guessing holes, seams or manufacturing semantics. Open paths remain visible as excluded geometry.
- Prepare and validate the complete addition before changing the active garment. Allocate stable panel/boundary IDs, preserve existing rest geometry, seams, fabrics and avatar, and append the selected panels as one undoable edit. Explain the dependent drape reset before Apply.
- Cancel, invalid files and compilation failures preserve document/history/worker generation. Successful Apply marks dirty, resets dependent caches and discards stale worker responses. Save/reopen and undo/redo preserve imported material dimensions.
- Use named UI controls and production transactions on CPU to exercise scale confirmation, contour selection, losses, Cancel, one Apply, failure rollback, existing-panel preservation and save/reload. Include independent DXF fixtures and document generic-DXF limitations; do not claim industrial dialect support.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/pull/88
- https://github.com/erythrofr/ClothCraft/issues/87
- https://github.com/erythrofr/ClothCraft/issues/90#issuecomment-6413493886
- https://github.com/erythrofr/ClothCraft/pull/92

Delivered by #92 as d98e889 after all seven checks passed at fb4e203. Five backend tests and 84 active desktop CPU tests passed locally, including four named-widget importer checks; strict Clippy passed. Explicit release accepted on #90 as receipt 6413296156. Uses the existing document/history installer and preserves unchanged-panel state. Native OS-picker/GPU visual acceptance remains unverified. Generic planar DXF only: no export, industrial AAMA/ASTM semantics, automatic holes, line joining or sewing inference. See docs/pattern-import.md.

## EXO-IO-011

**Import reviewed SVG patterns in the native workspace**

Status: done. Dependencies: EXO-IO-001.

**Files / directories**

- `src/atelier/svg_import_ui.rs`
- `src/atelier/documents_ui.rs`
- `src/atelier/authoring_smoke.rs`
- `docs/svg-import.md`

**Acceptance**

- Expose File > Import SVG patterns with bounded local UTF-8 reading, source identity, physical dimensions, explicit curve tolerance, loss report and outline preview before applying. No external resource resolution or guessed scale.
- Preview SVG +Y downward and let the user select outlines, an existing fabric and mesh spacing. Changing source or tolerance invalidates reviewed selection and acknowledgement; stale previews cannot apply.
- Reuse garment::svg_import preparation and the existing authoring/history installer. Add stable unsewn panels in a separated arrangement; preserve existing rest geometry, materials, seams, avatar and unchanged-panel drape; invalidate stale worker responses and mark dirty.
- Cancel, Escape, invalid input and failed compilation preserve document/history/generation. Respect current authoring drafts and the normal unsaved-window-close flow.
- Use named-control CPU tests and real shared transactions for selection/acknowledgement, stale Apply, cancellation, one apply, rollback, drape preservation, undo/redo and portable save/reopen. Document native picker/GPU acceptance separately.
- Extend the existing opt-in native authoring smoke with a public SVG fixture and actual dialog responses through svg_import_tick/install_edit. Verify one history entry, dirty state, unchanged-panel state preservation and invalidation of an outstanding worker result; a dispatched click or prepared Edit alone is not acceptance. Use bounded failure-reporting phases. A smoke-only file adapter may choose an isolated output-local fixture, but normal user file dialogs and other smoke scenarios must remain unchanged. Keep GPU execution opt-in and out of default CPU CI.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/103
- https://github.com/erythrofr/ClothCraft/pull/101
- https://github.com/erythrofr/ClothCraft/pull/107
- https://github.com/erythrofr/ClothCraft/pull/149
- https://github.com/erythrofr/ClothCraft/pull/155

Delivered by #107, #149 and #155 (last merge 8ea3c1e994e34fdc71a3a1ed67458dc7e07da76f after seven checks passed at aa476b3). Four CPU adapter fixtures cover invalid input, cancellation, rollback, preparation, history and portable reopen. #149 records actual Windows picker/import/save/reopen. #155's nine native actions traverse the real installer with a deliberately delayed real worker reply: original x/v/time preserved, stale generation rejected, clean-to-dirty transition and one history entry with Undo/Redo. Native code 488e34c; full desktop CPU suite 132 passed, one optional preview ignored. Reservation released on #103. This completes the scoped SVG workflow, not general concurrency, all native platforms or GPU-solver certification. See docs/svg-import.md for exact evidence and remaining limits.

## EXO-QA-005

**Trace native appearance history through actual UI controls**

Status: done. Dependencies: EXO-QA-004.

**Files / directories**

- `src/atelier/authoring_smoke.rs`
- `src/atelier/fabrics_ui.rs`
- `src/atelier/documents_ui.rs`
- `docs/native-appearance-acceptance.md`

**Acceptance**

- Reuse the opt-in native authoring smoke entrypoint and actual control responses for appearance Apply, pointer Undo/Redo and keyboard history. Missing candidate support or controls must fail explicitly, never skip to success.
- Emit structured observations of authored optics, history availability, playing state, worker generation and x/v/time. Check paused state equality and preservation of an in-flight worker response; do not bypass the normal edit/history installer.
- Exercise text keyboard ownership, restoration of default optics and isolated public-fixture save/reopen. The native smoke document adapter may select only fresh output-local fixture paths, reuse normal Save/Open installation, and bypass interactive recovery/file dialogs only for this explicit scenario. Preserve ordinary user document behavior and all other smoke modes. Distinguish a dispatched event from a verified state change and fail on timeout, no-op or rejected history.
- Keep GPU execution opt-in and outside default CPU tests/CI. Document exact candidate revision, commands, partial failures and unverified visual appearance. Production fixes outside this scope require a separate coordinated handoff.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/135
- https://github.com/erythrofr/ClothCraft/pull/128#issuecomment-6424222657
- https://github.com/erythrofr/ClothCraft/pull/128
- https://github.com/erythrofr/ClothCraft/pull/137

Completed in #137, merged as 0b383296bfa40f747428c88242a60a9644d34aaf after seven successful checks at 647128e and review of the four-file diff. Six opt-in native scenarios use actual controls and verified state gates: paused history/text ownership/default restore, in-flight Apply/Undo/Redo continuity, isolated Save/Open and color/roughness captures. Independent-fabric and flat strain-overlay comparisons have separate recorded evidence at explicit revisions. The integrated desktop CPU suite passed 129 tests (one optional preview ignored), and strict desktop Clippy passed. See docs/native-appearance-acceptance.md for exact fixtures, commands, failures and limits. This completes the scoped acceptance harness, not LOOK-001 or general native-platform certification. Reservation release accepted on #135.

## EXO-UX-009

**Expose native authoring tools in the command palette**

Status: ready. Dependencies: EXO-UX-001.

**Files / directories**

- `src/atelier/commands.rs`
- `src/atelier/command_palette.rs`
- `src/atelier/board.rs`
- `src/atelier.rs`
- `tests/command_registry.rs`
- `docs/command-registry.md`

**Acceptance**

- Add descriptors and search aliases for existing native authoring tools; do not advertise nonexistent operations or unwired shortcuts.
- Dispatch through the same set_authoring_tool transition as the toolbar/radial menu, including existing move/rotate modes; preserve draft, focus, modal and runtime availability behavior.
- Expose the existing freehand mode through the palette using one shared activation transition with the board toolbar. Preserve cancellation, replace mode and draft semantics; do not advertise an unwired shortcut or alter the drawing algorithm.
- CPU tests cover stable unique registry keys, each tool mapping, palette search, keyboard activation, disabled contexts and existing input isolation. Native-window acceptance is separate and GPU opt-in.
- Keep Firefly-owned authoring_ui.rs untouched; no changes to garment physics, geometry, contact or solver.

**Evidence and related contributions**

- https://github.com/erythrofr/ClothCraft/issues/171
- https://github.com/erythrofr/ClothCraft/pull/173

PR #173 merged the existing authoring tool descriptors and dispatch. Freehand remains a separate existing mode whose activation is inline in board.rs. The scope expansion allows one shared transition for palette and toolbar, not a claim or proof of native-window acceptance. Board changes overlap draft #200 and open contribution #6; coordinate their live scopes and review existing diffs before editing.
