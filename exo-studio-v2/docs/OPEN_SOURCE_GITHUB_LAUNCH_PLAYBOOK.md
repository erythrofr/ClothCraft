# Garment Studio — GitHub launch playbook

**Not yet published.** The local GPL-3.0-only public candidate is a preview pending full security/IP clearance and owner approval. Never push the existing private workspace or its Git history as a substitute for a sanitized initial import.

## Steps in the correct order

1. Resolve blockers reported in `docs/OPEN_SOURCE_RELEASE_READINESS_AUDIT_2026-10-13.md`, worker security/license audits and the candidate inventory. Verify all license texts and source-asset rights.
2. Create a fresh, **private** GitHub organization/repository (once the owner supplies or selects its name). Use a separate private staging checkout from the allowlisted release candidate; do not inherit any local `.git` history.
3. Regenerate with `node scripts/prepare-public-source.mjs /path/to/new/empty/staging`, inspect **all contents**, run a dedicated credential scanner, secret scanning and release gate, then a clean install/build/check and native bundle smoke.
4. Publish first only to the *private* staging repository; keep private until the release review has signed off. Do not invite untrusted contributors to a repo containing restricted assets.
5. Create `cad`, `simulation`, `product-ui`, `avatars-render`, `manufacturing`, `platform`, and `maintainers` teams with least-privilege permissions. Assign two owners/reviewers for cross-team schema and release changes.
6. Replace `.github/CODEOWNERS` placeholders with real GitHub team handles. Enable protected `main`, approved PRs, required CI, blocked force pushes, signed releases, and least-privilege `GITHUB_TOKEN`.
7. Create a GitHub Project with fields described in `docs/OPEN_SOURCE_ISSUE_BOARD_STARTER.md`. Curate 20–40 initially verified issues from the 924-item master plan.
8. Configure a non-public vulnerability reporting channel, issue moderation, Discussions and release process.
9. Once clearance is complete, confirm owner approval and switch repository visibility to public; announce contributor onramp. Publish pre-release builds only if tests, code signing and distribution obligations are fulfilled.

## Important local limitations

No `gh` CLI or authenticated GitHub remote has been detected on the Blender Mac. The team structure, branch protection, project board, repository and invitations are **not** live until configured on an account with admin rights. A successful local smoke/build does not mean the app is notarized or the solver is manufacturing-grade. Do not claim a complete GPL redistribution review until all runtime/library/model dependencies and third-party notices are checked.
