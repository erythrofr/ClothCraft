# Launching the contributor project board

Do **not** import all 924 roadmap checks as public issues. They are requirements, not an audited inventory of absent features. Start with 20–40 evidence-based issues and add more once maintainer review capacity is known.

## Suggested Project fields

- **Status:** Backlog, Triage, Ready, In progress, Review, Testing, Done
- **Area:** CAD, Simulation, Sewing, 3D/Avatars, Materials, Manufacturing, Interchange, UI, Platform/QA, Docs
- **Priority:** P0 (blocks milestone), P1 (necessary), P2 (enhancement)
- **Release:** M0–M8
- **Roadmap ID:** `GS-XX-YY-ZZ`
- **Owner:** single responsible contributor; team reviewers can be separate
- **Blocked by:** links to prerequisite issue numbers, not free-form text alone
- **Verification:** unreviewed, absent, partial, implemented-unverified, verified, blocked

## First issue batch (proposals; verify exact current state before opening)

1. Add automated license and secret scanning to release candidate CI with documented severity rules.
2. Produce machine-readable SPDX/CycloneDX software bill of materials for npm and native dependencies.
3. Inventory public-facing sample avatars, textures, fonts and fixture provenance.
4. Verify native macOS build from clean checkout; document/sign a debug artifact.
5. Make public code paths avoid offering unavailable private CLO Thomas avatar as default selectable option.
6. Add automated library/file dialog smoke tests for opening a sample project.
7. Standardize canonical garment document schema and publish a compatibility test suite.
8. Add a reproducible tiny manufacturing-ready T-shirt fixture including CAD seams and grading.
9. Add deterministic mesh generation regression tests with tolerances.
10. Add seam pairing / ease / direction validation to assembly tests.
11. Add numerical penetration/collision metrics to the full-body drape CI fixture.
12. Add 180/200cm avatar sizing and arm-pose regression fixtures.
13. Add no-GPU graceful fallback for public native preview.
14. Document cloth material calibration methodology and mechanical units.
15. Validate DXF roundtrip dimensional tolerances and annotation preservation.
16. Verify factory exports retain complete piece IDs, grainlines, notches and BOM.
17. Define API versioning and error-handling conventions for solver backends.
18. Add keyboard navigation and screen-reader labels for core CAD editing actions.
19. Add contributor development environment bootstrap on macOS.
20. Write issue triage, review, merge, and security incident handling playbook.

For each issue, include a reproducible baseline, exact expected output, affected paths, test commands and an owner. Only mark `good first issue` after confirming the work is genuinely small and isolated.
