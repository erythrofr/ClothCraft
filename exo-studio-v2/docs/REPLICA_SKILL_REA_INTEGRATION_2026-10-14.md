# Garment Studio: replica-skill + REA integration

**Date:** October 14, 2026.

## Repositories checked

1. [Jakeschincariol/replica-skill](https://github.com/Jakeschincariol/replica-skill)
   at commit `77c9436fb3d18c3d58169efb8caf4fe906b0dc51`. MIT.
   A local clean checkout's standard-library unit suite passed **57 tests**.
   The exact unmodified `parity.py` and `imgdiff.py` are vendored in
   `scripts/vendor/replica-skill/` alongside the MIT LICENSE.
2. [morluto/rea](https://github.com/morluto/rea)
   at commit `9a44fea3479a2ad463fdad2b14e86b412717f771`. MIT.
   Installed *temporary version-pinned CLI* `rea-agents@6.5.0`, without
   registering an MCP service, changing a global agent config, launching
   Hopper or touching CLO3D. Static inspection of a 1.6 MB Garment Studio
   JS/HTML-only bundle completed successfully.

## What is integrated into the actual project

- `replica/recon.md`: screens S01–S07, workflows F01–F05, public reference
  links, evidence confidence and ownership boundaries.
- `replica/features.csv`: 43 independently reviewable CLO-style user
  capabilities and their priority, state, missing behavior and source/test.
- `replica/parity.md`: reproducible weighted feature snapshot, generated
  using the upstream replica-skill algorithm.
- `replica/test-plan.md`: happy/negative/edge tests, unresolved cases and
  actual runnable browser/geometry checks.
- `scripts/generate-clo-parity.py` and package script commands:
  `npm run check:clo-parity` and `npm run check:clo-parity-ci`.
  The check verifies all evidence paths exist; invalid/malformed statuses
  and stale reports fail closed.
- `scripts/vendor/replica-skill/imgdiff.py` can compare matching reference
  screenshots when a suitable source image is supplied.
- `scripts/capture-clo-2d-reference.mjs` and `npm run capture:clo-2d`
  take a deterministic **own-app 2D workspace PNG** (1440 × 900 viewport)
  in an isolated browser test session. Actual run: 85,526 PNG bytes,
  zero JavaScript errors; the PNG is kept Git-ignored for future comparisons.
- `scripts/summarize-rea-evidence.mjs` distills REA's raw Evidence without
  committing the very large artifact or any user-owned licensed avatar.
- `replica/evidence/rea-own-garment-js-2026-10-14.json`: one real
  version-pinned REA inspection of the shipped Garment Studio JS.
- `replica/evidence/raw/rea-owned-js-20261014.evidence.json.gz`:
  the full authenticated REA record retained as a **local, Git-ignored**
  16 MB gzip baseline, not a redistributable artifact.

## Initial scores

**Selected-feature weighted parity: 54.1% (43 features).**

- 25 features are marked must-have; **8 fully implemented**, leaving 17
  incomplete.
- Current weakest measured area: physically correct simulation **16.7%**;
  this is 3 specifically selected simulated behaviors, not a numerical
  quality measurement of cloth fit.
- No authentic same-viewport/same-state CLO3D screenshots were compared.
  **Visual parity was not measured.**

This 54.1% result cannot replace or be averaged with the previous informal
38% complete-CLO-competitor estimate. The inventory is selected and
nonexhaustive, and yes/partial/no observations follow public documentation
and tests, not a black-box full CLO3D acceptance suite.

## REA real run result, with evidentiary limits

Mode: local **static analysis**, no target code execution.

| Observable | Value |
| --- | ---: |
| Relevant inventoried files | 4 |
| Parsed JavaScript assets | 3 |
| Visited AST nodes | 455232 |
| Static findings | 112 |
| Validated graph nodes and edges | 64 nodes / 121 edges |
| Parser failures | 0 |
| Coverage | **Partial** |

The analysis inferred seven storage-related nodes and JavaScript application
structure, but no native macOS/AppKit or PPF process behavior. REA's static
`endpoint` candidates included **WebGL extension names**; therefore those
candidates are *not* proof of actual network communications. This makes the
tool valuable for evidence inventory and packaged-bundle regression checking,
not a substitute for our existing project source, browser acceptance or
native solver trajectory tests.

**Scope boundary:** Both upstream tools are useful for workflow comparison,
QA and measuring our own program. They do **not** provide CLO3D's
proprietary C++ code, pattern fitter, licensed assets, or a working cloth
simulation. No 3D simulation feature was falsely changed to pass.

**Later same-day update:** We discovered an actual CLO7 reference screenshot
from the user's running CLO Academic session. It has now been used for a
matched-size, garment-content-masked chrome layout comparison with
Garment Studio's own 2D viewport and main tool columns. See
`docs/CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md` for the authentic
reference, 71.3 → 72.3 chrome-only score, implementation changes,
repeatable QA and strict limits.

## Recommended next engineering use

1. Pick a public reference screenshot and the corresponding local workspace
   in the **same state and viewport**. Capture, structural-diff, then refine
   the highest-impact toolbar/layout mismatch. Source screenshots remain
   private reference assets and never ship with Garment Studio.
2. Expand missing `must` features into acceptance cases, starting with
   topology-safe 2D draft constraints and true dart/slash operations.
3. Keep solver assembly and skin collision gated by the actual PPF physical
   acceptance report. The first entirely sewn, collision-free Thomas tee
   remains the highest impact technical milestone.
4. Re-run REA on later *owned compiled artifacts* to compare source/bundle
   boundaries, never to claim simulated or visual parity from static graph
   candidates alone.
