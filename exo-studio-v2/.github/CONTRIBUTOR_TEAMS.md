# EXO Sample 3D development teams (proposal)

These are areas of responsibility, **not** existing GitHub teams. Create real teams under the owner's GitHub organization and replace the placeholders in CODEOWNERS only after inviting actual maintainers.

| Suggested team | Primary scope | Required review focus |
|---|---|---|
| `cad` | 2D geometry, constraints, pattern editing, measurements | determinism, production geometric tolerances |
| `simulation` | native/web/PPF backends, cloth, contact, seams | collision safety, strain, stability and regressions |
| `product-ui` | layout, accessibility, object browser, navigation | consistent state, interaction and appearance |
| `avatars-render` | character assets, 3D viewport, materials | provenance and licensing, graphics fidelity |
| `manufacturing` | grading, marker, trims, DXF, factory outputs | export reproducibility, industrial data integrity |
| `platform` | native shell, packaging, CI, security, releases | public build gates, provenance, cross-platform |
| `maintainers` | shared canonical model, architecture, releases | cross-team contracts and merge approval |

## Ownership and integration

1. Open a scoped issue and assign a subsystem/team, acceptance tests and dependencies. Use existing `GS-XX-YY-ZZ` roadmap IDs where they apply.
2. Work on a short-lived branch named `feature/GS-XX-YY-ZZ-short-description` or `fix/issue-123-short-description`.
3. Open a draft PR early when modifying canonical document schemas or any shared backend contract; coordinate design before implementation diverges.
4. Merge into protected `main` only after required CI checks and review. Use squash merge and a clear linked issue; do not create long-lived branches per team.
5. Stable release tags are cut from passing `main` only, following a separate release-candidate review.

## CODEOWNERS setup

The current CODEOWNERS file deliberately has no owners because the organization and usernames are not yet known. Replace it with real `@ORG/team` entries **after the teams exist**. Example (not active):

```
* @ORG/maintainers
/src/core/physics/ @ORG/simulation
/src/core/backends/ @ORG/simulation
/src/components/ @ORG/product-ui
/native_app/ @ORG/platform
.github/ @ORG/platform
```

Enable GitHub rulesets, require 1–2 approvals as appropriate, required `build-and-check`, stale review dismissal, restricted direct pushes to `main`, and vulnerability reporting. GitHub branch rules and GitHub Projects must be configured on the hosting account; local files alone do not enforce those protections.
