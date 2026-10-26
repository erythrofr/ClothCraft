# EXO contribution provenance and license gates

Audit date: 2026-10-22. Task: [EXO-CORE-002](https://github.com/erythrofr/ClothCraft/issues/11).
**This is an evidence/decision register, not permission to import code, assets, or
binaries, and not a legal opinion.** No transfers or license changes are made
by this document.

## Fixed source revisions and baseline

| Project/evidence | Exact revision | Observed license / limit |
|---|---|---|
| [EXO Sample 3D](https://github.com/mikristian/exo-sample-3d/tree/352c6086b622caeda95f16d9bd923624b95e05d9) | `352c6086b622caeda95f16d9bd923624b95e05d9` | [README](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/README.md) and [CONTRIBUTING](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/CONTRIBUTING.md) declare **GPL-3.0-only for original source where rights are held**; [LICENSE](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/LICENSE) contains GPLv3. Third-party content retains its own rights. |
| [ClothCraft integration baseline](https://github.com/erythrofr/ClothCraft/tree/595ed1e3a75324c91ef992b2012f9916c3ff20b9) | `595ed1e3a75324c91ef992b2012f9916c3ff20b9` | [LICENSE](https://github.com/erythrofr/ClothCraft/blob/595ed1e3a75324c91ef992b2012f9916c3ff20b9/LICENSE) is MIT for original code; bundled files such as MakeHuman assets have separate notices. |
| [ClothCraft legacy fork base](https://github.com/mikristian/ClothCraft/commit/78b359cb2cbf8367e3615a5679d30184a14f851b) | `78b359cb2cbf8367e3615a5679d30184a14f851b` | Base of many open feature proposals; being based on MIT code does **not** resolve the ownership/license of added files. |

These revisions pin the **inspected evidence**, not every commit that may
subsequently appear on either repository's default branch. Follow
[COORDINATION.md](../COORDINATION.md), the [live board](https://github.com/erythrofr/ClothCraft/issues/8)
and the [feature audit](exo-feature-audit.md) for task ownership and functional
status. This document does not create another task board.

### Rules for future integrations

1. **Behavioral reference, original Rust implementation:** the method, inputs,
   constraints and observable tests may inform independently written code,
   without copying or mechanically translating EXO implementation, comments,
   data tables, tests, or graphics. Record the EXO revision as a *reference*,
   and the original ClothCraft author/commit as the *implementation*. Passing
   equivalent fixtures does not, by itself, prove copyright independence.
2. **Copied or adapted EXO implementation:** **not approved for inclusion in
   MIT-licensed original ClothCraft source** on GPL-3.0-only terms alone.
   GPLv3 can accept suitably licensed MIT code, but GPLv3-covered code cannot
   simply be relicensed to MIT by a downstream recipient. Request a separate,
   documented MIT-compatible grant from **all relevant rights holders**,
   covering the exact code and revision; the EXO repository owner's approval
   alone is insufficient if another contributor owns parts of that code.
   Alternatively, discuss a different clearly separated distribution/licensing
   design with ClothCraft maintainers before implementation.
3. **Third-party assets/libraries:** inspect the file-specific original source,
   copyright, grant, version, modification history, and required notices.
   An EXO folder's GPL text does not turn CC0 assets into GPL, nor does one
   CC0/MIT notice authorize the entire EXO folder or screenshot collection.
   License compatibility does not establish source authenticity or allow a
   trademark, model identity, or commercial brand to be reused.
4. **Unverified or proprietary materials:** do not import. A public screenshot,
   vendored archive, dependency reference, or generated derivative is not a
   redistribution grant. No restricted CLO3D files, user garments, unlicensed
   scans, private datasets, or external solver binaries are part of this task.

## Proposed transfer candidates (all **not imported** by this audit)

Each source path below is pinned to the EXO commit above unless a separate
PR revision is explicitly shown. An entry labelled *original rewrite* is a
permitted **development route**, not a determination that any submitted PR has
already met the independence requirement.

| Candidate behavior / artifact and exact upstream source | Source license evidence | Intended handling / remaining decision |
|---|---|---|
| Point constructions and geometry: [`src/core/draftingConstructions.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingConstructions.js), [`src/core/draftingTopology.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/draftingTopology.js) | EXO GPL-3.0-only original source policy | **Original rewrite** using geometric requirements and independent tests. Do not transfer JS source or mechanically translate it. Numeric constructions proposed in ClothCraft [PR #26](https://github.com/erythrofr/ClothCraft/pull/26) require their own review. |
| Freehand fitter: [`src/core/vectorFreehandFit.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/vectorFreehandFit.js) and Bézier tooling [`vectorPatternBezier.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/vectorPatternBezier.js) | EXO GPL-3.0-only original source policy | **Original rewrite** route, not a source port. See proposed ClothCraft [PR #27](https://github.com/erythrofr/ClothCraft/pull/27); independently review its provenance and tests before accepting. |
| Notches/seam allowance: [`patternSewingNotches.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/patternSewingNotches.js), [`patternAllowancePreview.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/patternAllowancePreview.js) | EXO GPL-3.0-only original source policy | **Original rewrite / review existing**, do not duplicate or merge blindly. ClothCraft [PR #1](https://github.com/erythrofr/ClothCraft/pull/1) and [#6](https://github.com/erythrofr/ClothCraft/pull/6) overlap; check both authorship and design under EXO-REV-001. |
| CAD darts, measurement, cutlines and DXF: [`nativePatternExportPreparation.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/nativePatternExportPreparation.js), [`measurements.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/measurements.js), [`dxf.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/dxf.js) | EXO GPL-3.0-only original source policy | **Original rewrite / review existing** [PR #7](https://github.com/erythrofr/ClothCraft/pull/7). PR #7 touches `src/vbd.rs` and `src/gpu_vbd.rs`: physics and licensing review are separate gates, not authorized by CAD review. |
| Manufacturing algorithms: [`marker.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/marker.js), [Rust marker kernel](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/rust/exo_marker_kernel/src/lib.rs), [`productionCost.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/productionCost.js) | EXO GPL-3.0-only original source policy, absent a documented per-file compatible grant | **Original rewrite only** for MIT modules. Existing algorithm/code/heuristic implementations (including existing Rust) are **not** MIT merely because they use Rust. Record numerical fixtures independent of EXO implementation. |
| Sewing, trim and fabric visuals: [`sewingConstruction.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/sewingConstruction.js), [`trims.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/trims.js), [`fabricPbrGenerator.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/fabricPbrGenerator.js) | EXO GPL-3.0-only original source policy | **Original rewrite** of documented contracts; no copied shader programs, baked outputs, scans or algorithm-specific code. Physical seam/fabric acceptance is independent of visual resemblance. |
| GUI, agents and runtime integration: [`clothcraftApiClient.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/clothcraftApiClient.js), and [ClothCraft Studio V2 PR #2](https://github.com/erythrofr/ClothCraft/pull/2) | EXO GPL-3.0-only project policy; PR #2 has distinct internal and third-party contents | **Do not bulk-import.** Separate authored app source, bridge contracts, third-party libraries, bundled assets and individual generated screenshots. A transport adapter does not transfer a solver. Review ownership and per-path notices before any split PR. |
| Physical SVG printing: [`markerArtifacts.js`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/markerArtifacts.js) | EXO GPL-3.0-only original source policy | **Original rewrite / review existing** [PR #3](https://github.com/erythrofr/ClothCraft/pull/3); independently check physical units and attribution, rather than port JS. |

### Third-party and asset-level exceptions (verify each exact file)

| Candidate / pinned evidence | Observed notice | Decision |
|---|---|---|
| EXO [`public/avatars/README.md`](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/public/avatars/README.md), [MakeHuman CC0 notice](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/public/avatars/MAKEHUMAN-LICENSE.ASSETS.md); ClothCraft [bundled asset notice](https://github.com/erythrofr/ClothCraft/blob/595ed1e3a75324c91ef992b2012f9916c3ff20b9/assets/makehuman/LICENSE.ASSETS.md) | MakeHuman base mesh declared **CC0 1.0** in the referenced asset documentation | Compatible *if provenance is independently confirmed for the exact mesh*. Keep the separate notice; do not extend the CC0 claim to a modified/proprietary avatar or collision implementation. ClothCraft already has separately noticed MakeHuman assets—no need to recopy from EXO. |
| EXO Studio V2 PR #2 [`public/fabric-scans-ambientcg/Fabric003/manifest.json`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/public/fabric-scans-ambientcg/Fabric003/manifest.json) | Asset declares **ambientCG CC0-1.0**, links to original asset and lists checksums for its color, normal and roughness JPGs | **Potential compatible asset**, not approved en masse. Independently fetch/verify original ambientCG release, exact maps/hashes and any naming/attribution before copying. Never treat an optical scan as calibrated fabric mechanics. |
| EXO Studio V2 PR #2 [fabric showcase attribution](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/concepts/exo-community-ui/fabric-showcase-assets/ATTRIBUTION.md) | Some ambientCG scans are identified as CC0; several project-native EXO scan triplets have **source attribution still to verify** | **Mixed / unresolved.** Do not distribute every scan solely based on a folder-level claim. Resolve each triplet, source and redistribution right. |
| EXO Studio V2 PR #2 [`native_cpp/vendor/nlohmann/json.hpp`](https://github.com/mikristian/ClothCraft/blob/b20d4a3aeab0a41f52d86b0643d9230d8891afd8/exo-studio-v2/native_cpp/vendor/nlohmann/json.hpp) | Header declares **SPDX-License-Identifier: MIT** and Niels Lohmann copyright (version 3.11.3) | Potentially reusable on MIT terms with required notice/provenance; prefer a managed versioned dependency. Not needed for a Rust port merely because it was bundled in EXO. |
| EXO screenshot gallery ([README](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/README.md)); ClothCraft [branding notice](https://github.com/erythrofr/ClothCraft/blob/595ed1e3a75324c91ef992b2012f9916c3ff20b9/assets/branding/README.md) | Gallery documents its own UI captures; ClothCraft icon documents separate generation and visual references, not a license for reference images | **Do not assume screenshots, designs, marks or references are MIT.** Separate first-party original work, third-party UI/media, licensed textures and independent marks. No screenshot/icon import authorized. |

## Open contributions and commit-level review queue

These are **proposed** ClothCraft changes, not an assertion that each author
has made a verified MIT rights grant for every newly added file. PR head
revisions were retrieved from GitHub on the audit date, not from branch names
alone. All were open at that inspection.

| PR | Author and exact head | License/provenance gate before integration |
|---|---|---|
| [#1](https://github.com/erythrofr/ClothCraft/pull/1) | mikristian `cdd0ece346d4ceca39bd8299e99df8d951e89b5c` | Audit original notches/markings versus EXO source; reconcile with #6. |
| [#2](https://github.com/erythrofr/ClothCraft/pull/2) | mikristian `b20d4a3aeab0a41f52d86b0643d9230d8891afd8` | **High-risk bulk snapshot** (1,868 files at audit): original EXO-derived app vs third-party scans, vendor, images, fonts and binaries require **separate** permission/notice records; do not merge whole. |
| [#3](https://github.com/erythrofr/ClothCraft/pull/3) | mikristian `c0ea77d16972abfdc7986a16e3dc3a529a6f0daf` | Review independent physical SVG implementation and fixtures. |
| [#4](https://github.com/erythrofr/ClothCraft/pull/4) | FireflyTheReal `43018fc959b311a6029bb0ffc586619786938e50` | Appears to be a separate Rust lint contribution; verify authorship/license under contributor process and avoid duplicated fix. |
| [#5](https://github.com/erythrofr/ClothCraft/pull/5) | FireflyTheReal `74cd0157de5aa51e90172f59fd79dc01e05b25f5` | Documentation/reference mapping: attribution, quotation and third-party manual links, no assumption that cited features are implemented. |
| [#6](https://github.com/erythrofr/ClothCraft/pull/6) | FireflyTheReal `7cf763903306bbb2e6a8e2746d7822bef23d9d51` | Separate author's proposed notch/allowance implementation; investigate overlap with #1, preserve both credits. |
| [#7](https://github.com/erythrofr/ClothCraft/pull/7) | mikristian `c9a7d00d9d29f608c4963a63e410bf9e7b3cbbfa` | Split CAD/authoring, session bridge and physics; inspect source ancestry, third-party fixtures and any adapted EXO content. |
| [#26](https://github.com/erythrofr/ClothCraft/pull/26) | erythrofr `25c96123b6d10c45a553d278c5d5d0facc45763b` | Review original metric construction API against independent implementation claim. |
| [#27](https://github.com/erythrofr/ClothCraft/pull/27) | mikristian `8d4c31e9c6971a13b54906d2929495feefb23c17` | Review original freehand fitting API against independent implementation claim. |

## Integration follow-up — 26 October 2026

The 22 October tables above remain a dated inventory, not current merge status.
This follow-up records selected integrations against ClothCraft main
`11a12e8ae1a08a08fb35500c7238e02d7bed08db`. It does not certify every
intervening contribution or replace the per-file evidence requirements below.

| Contribution | Exact source and integration | Observed origin evidence / remaining question |
|---|---|---|
| Native command registry | [#29](https://github.com/erythrofr/ClothCraft/pull/29), source `33b79f0c55ead4dba35c2d4c5472d1f7f4860d1a`; [#97](https://github.com/erythrofr/ClothCraft/pull/97), reviewed head `a8c601fbed27662e932e4c1b3d3b3328f9af8d3c`, merged `c558dc64300c85e8cd244379476ae6479a20c5dd` | #29 explicitly states that EXO GPL implementation was not imported or transliterated. #97 documents retaining Mikristian's authorship while adapting the native dispatcher. Treat this as the contributor's origin statement plus integration evidence, not an independent similarity audit. Paths: `src/atelier/commands.rs`, `src/atelier.rs`, `tests/command_registry.rs`. |
| Cut-and-sewn dart transaction | [#66](https://github.com/erythrofr/ClothCraft/pull/66), source `e3994ae80c496eb3e6371309ccabb8e4b7bea3ab`; [#80](https://github.com/erythrofr/ClothCraft/pull/80), head `59938e65e0aaa98f573a073e7ca376c43f809419`, merged `e727f2c77badbe9e3117b97133ba8446e3b4d73b` | **Adapted contribution**, not an independent rewrite claim. #80 identifies the bounded `DartCutSew` slice and retains Mikyle Couto's attribution in `src/authoring.rs`. The pinned fork [LICENSE](https://github.com/mikristian/ClothCraft/blob/e3994ae80c496eb3e6371309ccabb8e4b7bea3ab/LICENSE) is MIT, but #66 describes its proposal as EXO-derived. The inspected description/comments do not resolve whether this particular Rust slice was independently authored or translated from EXO source. Path-specific origin clarification is requested on #66; do not infer a grant for the entire proposal. |
| Native dart controls | [#85](https://github.com/erythrofr/ClothCraft/pull/85), head `75774806f5cb15426e5a18ab2b216eae04dad5e3`, merged `d0c6e6c2f2d978eb36d400637db785d1f1b4be53` | Native adapter and preview over #80, with backend attribution retained. Its merge does not resolve the backend origin question above. Paths: `src/atelier/authoring_ui.rs`, `src/atelier/board.rs`, `docs/authoring.md`. |
| Physical SVG reader | [#101](https://github.com/erythrofr/ClothCraft/pull/101), head `4aea2c321ab624dd4cb17d51a9a7faf83db6ed05`, merged `dcbc3154dd7eaa11fc23b2010e28bc734dc8266d` | [Pinned implementation notes](https://github.com/erythrofr/ClothCraft/blob/dcbc3154dd7eaa11fc23b2010e28bc734dc8266d/docs/svg-import.md) state independent implementation from behavior/specifications, with no EXO JavaScript or assets copied. The old proposed #3 is not the source claimed by this reader. The notes identify `svgtypes`/`quick-xml` separately; their inclusion is not permission to copy unrelated EXO code. |

Verification performed here: GitHub PR head/merge metadata and descriptions;
selected task/PR comments; the pinned #66 fork license; local production
attribution and implementation notes at the stated main revision. No exhaustive
copyright similarity or rights-holder investigation was performed. No code,
asset or binary is imported by this follow-up. Existing runtime behavior is
unchanged. Keep EXO-CORE-002 open while the source-specific questions remain.

## Evidence required before an actual code or asset transfer

For **each path** proposed for copying or adapting, attach a review record to
its specific task or PR (do **not** silently amend this register's claim):

- **Identity:** source repository, immutable commit, exact file path, blob
  hash and destination path; mark source as original / adapted / third-party /
  generated / unknown and specify what expression, if any, was reused.
- **Rights:** author and copyright owner(s), exact license text or compatible
  permission covering that expression and revision, redistribution conditions
  and required attribution/NOTICE. A PR author, GitHub account login or
  repository owner is not automatically every file's copyright holder.
- **Decision:** maintainer-reviewed allow / reject / investigate status,
  date, reviewer and immutable evidence link. If a separate grant is
  necessary, identify who must sign it and preserve a link to the complete
  grant before importing. The current state is **investigate**, not allow.
- **Engineering:** independent behavior specification and fixture source,
  test and benchmark results (with command/platform), material-coordinate
  units and model/solver invariants; no comparison numbers inferred from an
  import or passing build alone.

### Explicitly unresolved owner decisions

1. **EXO owner and all other rightsholders:** whether to grant permission
   under MIT-compatible terms for *specified* original EXO modules to be
   incorporated into the MIT ClothCraft repository. No such grant was found
   or presumed in the materials reviewed. A general declaration of
   cooperation is not a dual-license grant.
2. **ClothCraft maintainers:** whether any proposed GPL-covered component
   should instead live as a clearly separated integration under its own
   distribution conditions, or be rejected/reimplemented independently.
   No change to ClothCraft's MIT license is proposed here.
3. **Third-party owners/sources:** confirm exact scan, asset and dependency
   provenance, license, notices and redistribution scope *before* bundling;
   repository presence is insufficient.
4. **PR authors/reviewers:** confirm provenance for every proposed patch
   (especially #2 and the authoring/physics mix in #7) and identify where
   genuinely original MIT-authorized contributions begin and EXO adaptations
   end.

**Audit method and limitations:** read the pinned EXO `LICENSE`,
`README.md`, `CONTRIBUTING.md`, selected EXO file paths, ClothCraft
`LICENSE`, scoped task documents and per-asset notices. Examined GitHub PR
metadata and locally inspected representative PR #2 assets and PR #7 changed
paths. No exhaustive line-by-line copyright similarity scan, rights-holder
verification, dependency audit, external asset provenance verification or
legal determination was performed. No code was executed or copied from EXO;
no binaries or assets were imported. Update this ledger from specific,
verifiable evidence when a new revision, license notice or decision appears.
