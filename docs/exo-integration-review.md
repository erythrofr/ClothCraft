# EXO Studio / native-session proposal: bounded integration review

**Task:** [EXO-REV-005](https://github.com/erythrofr/ClothCraft/issues/16).
**Status:** contributor review proposal, **not** merge approval or a Rust
conversion certificate. Audit: 2026-10-22. No code, assets, licenses, model
formats or solver behavior are changed by this document.

## Sources and decision boundaries

| Evidence pinned at review | What it actually contains |
| --- | --- |
| [PR #2](https://github.com/erythrofr/ClothCraft/pull/2), head [`b20d4a3aeab0a41f52d86b0643d9230d8891afd8`](https://github.com/mikristian/ClothCraft/commit/b20d4a3aeab0a41f52d86b0643d9230d8891afd8) | **1,868 changed files**, **2,212,998 additions** reported by GitHub: a separate nested `exo-studio-v2/` app, not an upstream Rust editor replacement. File count is review scope, **not** feature coverage. |
| [PR #7](https://github.com/erythrofr/ClothCraft/pull/7), head [`c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa`](https://github.com/mikristian/ClothCraft/commit/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa) | **38 changed files**, **5,537 additions** reported by GitHub. Includes authoring, model extensions, a ~900-line `src/bin/exo-session.rs`, tests and **edits to both** `src/vbd.rs` and `src/gpu_vbd.rs`. |
| Upstream ClothCraft [`595ed1e3a75324c91ef992b2012f9916c3ff20b9`](https://github.com/erythrofr/ClothCraft/commit/595ed1e3a75324c91ef992b2012f9916c3ff20b9) | Current integration baseline: native egui UI, Rust `GarmentTemplate` v1/v2, `FittingProject` v1, existing authoring/history, VBD + OGC simulation; **no production EXO session protocol**. |
| EXO [data-model review](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_DATA_MODEL.md) and [conversion review](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CONVERSION_STATUS_2026-10-18.md) at `352c6086b622caeda95f16d9bd923624b95e05d9` | Describes an **evolving** JS authoring project, separate normalized simulation transport and experiments. None establishes an immutable EXO document file format or proof of Rust source parity. |

These head commits are **not** automatically based on the latest upstream:
both #2 and #7 were proposed from an older ClothCraft ancestry. Before
acceptance, every selected patch requires a focused current-main rebase,
conflict resolution and independent validation. Both PRs were open and
unmerged when reviewed.

The reviewed tasks [EXO-CORE-001 / PR #30](https://github.com/erythrofr/ClothCraft/pull/30)
(document and solver authority), [EXO-CORE-002 / PR #28](https://github.com/erythrofr/ClothCraft/pull/28)
(provenance) and [EXO-UX-001 / PR #29](https://github.com/erythrofr/ClothCraft/pull/29)
(native command registry) are **review-stage proposals**, not merged
dependencies. A follow-up must read the **merged** version, not assume these
open PRs supply production APIs.

## PR #2: components that must stay distinct

Every following source link points to a file at the immutable #2 head.

| Component / representative evidence | Boundary and disposition |
| --- | --- |
| **Web/Three.js app:** [`src/App.jsx`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/App.jsx), [`ClothCraftWorkspace.jsx`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/components/ClothCraftWorkspace.jsx), [`ClothCraftGraphicEditor.jsx`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/components/ClothCraftGraphicEditor.jsx) | React/JSX and rendering/presentation. **Keep separate** from egui/native Rust source. Treat claims of toolbar coverage, graphics and garment preview as UI behavior to test; they neither establish editable Rust semantics nor physical cloth validity. |
| **EXO JS canonical authoring / normalized transport:** [`src/core/project.js`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/core/project.js), [`src/core/backends/protocol.js`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/core/backends/protocol.js) | **Requirements/fixture reference only.** JS coordinates are commonly cm; ClothCraft stores material metres. Normalized backend requests are not a drop-in `FittingProject`. Unknown fields, curves, attachment graphs and simulation material laws need explicit loss reports, not silent conversion. |
| **Node orchestration:** [`integrations/clothcraft/bridge.mjs`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/integrations/clothcraft/bridge.mjs), [`agent-api.mjs`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/integrations/clothcraft/agent-api.mjs) | **Separate external process boundary.** Do not merge HTTP, agent execution, environment routing or file access into `model`, `garment`, `solver` or egui. An eventual adapter must have local-only access controls, schema allowlists, path restrictions, cancellation and explicit user approval for destructive operations. No arbitrary shell or remote automation from document JSON. |
| **Native bridge process:** [`integrations/clothcraft/exo-session.rs`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/integrations/clothcraft/exo-session.rs) | An EXO-side Rust example is not evidence that the current upstream `src/bin/` supports its ABI, requests or revisions. Compare separately to #7 session candidate and the contract before proposing a Rust transport PR. |
| **Apple/Swift host:** [`native_app/GarmentStudioNative.swift`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/native_app/GarmentStudioNative.swift), [macOS workspace host](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift) | Mac-specific AppKit/WebKit/build infrastructure, **not** a multiplatform Rust native UI. A future distributable must enumerate entitlements, code signing, OS compatibility and actual installed bundled binaries. Do not add it to core CI by default. |
| **Native C++ experiment:** [`native_cpp/core/garment_document.hpp`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/native_cpp/core/garment_document.hpp) | Distinct transactional JSON design, **not** an ABI or interchangeable substitute for Rust `authoring::apply`. Port only independently specified invariants after license/provenance review; do not copy/transliterate source into MIT. |
| **Styles, SVG icons, screenshots and graphics:** [icon manifest](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/assets/toolbar-icons/manifest.json), [`src/clo-interface.css`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/src/clo-interface.css) | Review original ownership, third-party references and trademarks per file. A graphic editing demo, including the Nike swoosh mentioned in #2, is **not** permission to redistribute that branding. |
| **Fabric scans and avatar assets:** [ambientCG Fabric003 manifest](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/public/fabric-scans-ambientcg/Fabric003/manifest.json), [mixed scan attribution](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/concepts/exo-community-ui/fabric-showcase-assets/ATTRIBUTION.md), [MakeHuman CC0 notice](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/public/avatars/MAKEHUMAN-LICENSE.ASSETS.md) | **Split per asset and verify exact origin/hash/license**. A manifest declaring CC0 is evidence to verify, not validation of bytes or permission for unrelated EXO scans, avatars, proprietary graphics, branded assets or screenshot collections. PBR color/normal/roughness is appearance data, not certified cloth mechanics. |
| **Third-party code/dependencies/build:** [nested `package.json`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/package.json), [nested GPLv3 `LICENSE`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/LICENSE) | Preserve license separation and dependency provenance. EXO declares GPL-3.0-only for original work while upstream ClothCraft is MIT. **Do not import or mechanically translate EXO-covered code into MIT** without rights-holder authorization and a compatible grant. A nested license file does not relicense the upstream Rust tree. |

In the inspected #2 tree, file counts by top-level nested prefix include
`scripts/` 377, `public/` 301, `native_cpp/` 270, `docs/` 250,
`src/` 223, `concepts/` 154 and `integrations/` 106. These are **Git tree
counts**, not unique capabilities or independently approved packages. The
branch also contains native host files, research, media and screenshots.
Attempting to fold this snapshot into the native Rust `main` would add
different languages, release/tooling and licensing assumptions at once.

## PR #7: exact split boundaries and review risks

The #7 diff was inspected from its original base
`78b359cb2cbf8367e3615a5679d30184a14f851b` to the head above.
The 38 changed paths separate into the following candidate units; none should
be merged just because a narrow subset's test passed on the PR author's branch.

| Slice / source | Acceptance required before any isolated Rust PR |
| --- | --- |
| **Editable contour/cubic operations:** [`src/garment/polygon.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/garment/polygon.rs), [`src/garment/curves.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/garment/curves.rs), [`src/authoring.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/authoring.rs) | Extract the *smallest* independently representable contour operations. Check stable edge IDs, curve controls, undo/redo, seam split migration, exact metres, old v1/v2 JSON and typed invalid geometry. Many existing authoring methods already exist on current `main`; review semantic diffs rather than replacing entire files. |
| **Notch/persistent POM/dart metadata:** [`tests/persistent_pom_references.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/tests/persistent_pom_references.rs), [`tests/physical_cut_sewn_dart_20261020.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/tests/physical_cut_sewn_dart_20261020.rs), [`tests/notch_pair_atomic.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/tests/notch_pair_atomic.rs) | Separate authored metadata and seam semantics from a physically cut-and-sewn dart. Pair-notches must be atomic; measures and notches survive split/mirror/duplicate/delete or **fail closed**. Dart geometry is not proof of calibrated fold mechanics. Coordinate with [EXO-REV-001](https://github.com/erythrofr/ClothCraft/issues/12) (#1/#6 overlap) and [EXO-REV-002](https://github.com/erythrofr/ClothCraft/issues/13), rather than opening competing implementations. |
| **Manufacturing cutline output:** [`src/garment/cutline.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/garment/cutline.rs), [`tests/cutline_production.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/tests/cutline_production.rs) | Independent factory-scale ruler/calibration and seam-vs-cut line checks, concave curves and notch orientation. A generic DXF/SVG proof is not certified AAMA/ASTM or factory approval. Coordinate with the [physical SVG review](https://github.com/erythrofr/ClothCraft/issues/14) / PR #3. |
| **Native session candidate:** [`src/bin/exo-session.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/bin/exo-session.rs), [`src/fitting.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/fitting.rs) | **Must be a separate protocol/adapter review**, not implicit acceptance in a CAD PR. Existing JSON-lines routes use `revision`, `command` and command-kind string decoding. Validate session identity, version handshake, stale-write rejection, rollback, cancellation, unsupported fields, local path restrictions, no shell execution and round-trip with current `FittingProject` v1. Session additions reference #7-only fields and types; do not assume isolated `exo-session.rs` compiles on `main`. |
| **Production solver/diagnostics edits:** [`src/vbd.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/vbd.rs), [`src/gpu_vbd.rs`](https://github.com/mikristian/ClothCraft/blob/c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa/src/gpu_vbd.rs) | **EXCLUDE from authoring/session PRs.** Diff includes final accepted-state contact detection, residual/accounting changes and a GPU minimum-separation gate. Requires dedicated contact coverage/performance tests, unchanged OGC feasibility/physics laws, equal-scene CPU/GPU comparison, pinned hardware and opt-in GPU authorization. New detection work changes step cost; no claim of equivalent convergence/penetration/performance from existing PR7 tests alone. |

At #7 head, `src/bin/exo-session.rs` holds its own `Session.revision:
u64`; its handler compares `v["revision"]` for most operations, exempting
`snapshot` and `save`, and increments the revision for several operations
including editing and simulation/reset. In contrast, review-stage [PR #30](https://github.com/erythrofr/ClothCraft/pull/30)
proposes session-scoped authored-document revisions **separate** from worker
generations/dynamic-state updates. **This is an unresolved semantic conflict,
not a compatible implemented API.** Pick a reviewed revision model first and
test stale writes and simulator updates independently. A transport adapter
must not turn a runtime step into an unexpected authored geometry revision.

The #7 claimed targeted test run covers some Rust behavior on its proposed
branch; it is **not** proof that the session is ready on current main, that
GPU solver modifications satisfy release gates, or that production CAD
round-trips in an independent factory application.

## Ordered follow-up PR slices (proposed, not registered claims)

1. **Document/rights decision first:** get maintainer review of #30 and
   provenance review #28, record exact source ownership/license for *each*
   intended transfer. Block copied/adapted GPL EXO implementations from MIT
   Rust until a valid rights-holder grant exists. An independent implementation
   may use behavioral requirements without reproducing implementation text.
2. **Read-only session introspection, Rust-only:** after protocol approval,
   one small local capability/version and template-validation adapter, with
   no editable command dispatch, network listener or EXO bulk assets.
   Tests: version rejection, unknown fields, v1/v2 template fixtures,
   correct units, stable IDs and nonmutating failure.
3. **Single transactional authoring action:** one already-supported Rust
   `authoring::Command` through a checked, session-scoped
   `expectedRevision` handler (e.g. a safe layout-only edit). Prove
   success/undo, stale revision, cancelled change, unchanged original on
   failure, and no stale solver result publication. Register a new scoped task
   before touching shared authoring/dispatch files.
4. **One CAD feature at a time from #7:** choose an unmet operation only
   after comparing current main and existing #1/#3/#6/#7 contributions;
   isolate source and CPU fixtures. Suggested review order:
   stable point/POM metadata → atomic notch pair → measured physical cutline
   → cut-and-sewn dart, each contingent on its own schema and physical checks.
   Do **not** batch solver modifications with these.
5. **Optional EXO web view as a separate product:** if the maintainer wants
   a dual-app distribution, publish with explicit GPL/MIT component boundary,
   separate lockfile, approved assets, isolated build/signing and non-default
   CI. Do not silently adopt its Swift host, Node agent APIs or proprietary
   graphics as ClothCraft's native Rust app.
6. **Physics review independently:** isolate the #7 `vbd.rs` and
   `gpu_vbd.rs` proposals as a solver task only after direct comparison
   with current accepted-state telemetry. Reproduce CPU contact and seam
   invariants, performance cost, and opt-in GPU parity; reject or revise
   proposals that lose collision coverage or change the energy/constraints.

These are **recommendations for future registered tasks**, not permission to
take another agent's locked files. [The live board](https://github.com/erythrofr/ClothCraft/issues/8)
and current task manifest still control claims and exact scopes.

## Review gates and handoff

- **Owner decision:** Should the dual EXO UI remain a separate distributable,
  or is there a *small* native egui functionality gap to implement
  independently? No product switch is implied by #2.
- **API decision:** Resolve the incompatible revision semantics between #7
  and PR #30 before accepting any session adapter. Clarify where dynamic
  state, editable template, saved file and revision are authoritative.
- **Provenance decision:** Confirm per-file permission and attribution,
  including third-party visual assets. Do not redistribute screenshots,
  trademarks, unlicensed project-native scans or private avatars on the
  strength of a nested GPL or CC0 file elsewhere in the tree.
- **Engineering gates:** pin source/base/head hashes, apply one focused
  patch to current main, run CPU tests and strict lint for touched modules,
  validate old v1/v2 documents and authoring undo, compare independent
  physical/export fixtures; GPU tests remain opt-in.
- **Negative cases:** unsupported EXO fields and source units must produce
  explicit diagnostics; stale revision or failed import must leave valid
  resident data untouched; a solver test must not silently substitute avatar
  collision geometry or remove an OGC exclusion.

**Work performed for this review:** inspected fixed Git tree and source
diffs; no mass merge, library patch, runtime build, installed-application
inspection, proprietary file import or GPU experiment. Existing PR claims
are reported as claims unless independently verified here. This document is
the handoff for maintainer selection of the next bounded contribution; it is
not a blanket approval of either proposed PR.
