# Garment Studio open-source launch execution — 2026-10-13

## Verified accomplishments

- User chose **GPL-3.0-only**; root `LICENSE` and related documentation are present, subject to rights verification.
- Created an unpublished independent source snapshot outside the original repository: `garment-studio-public-preview-20261013-10` (348 copied files, no old Git history, approximately 14 MB before npm install).
- Private Thomas and all filenames containing Thomas are deliberately excluded; the original private development tree and assets are **not deleted**.
- The independent slim v08 candidate (same core source and tests, prior to v10's metadata/team-doc-only refinements) passed fresh isolated `npm ci`, `npm run build`, `npm run check:non-simulation`, public filename gate, `INCLUDE_PRIVATE_THOMAS=0 INCLUDE_PREPARED_SOLVES=0 bash native_app/build.sh arm64`, and strict ad-hoc codesign verification. Logs at `/tmp/gs-oss-final08-{install,build,tests,native}.log`. Later staging revisions were not revalidated exhaustively.
- Introduced GitHub Actions CI starters (`public-ci.yml`, `public-native-macos.yml`), contribution PR template, proposed team roles/CODEOWNERS placeholder, ideas discussion template, board specification and private-first launch playbook.
- Generated 20 unpublished local issue drafts in the sibling folder `garment-studio-issue-drafts-20261013` for maintainer review before creating public issues.
- Public candidate's initial basic credential/home-path heuristic scans found no candidate source matches after redacting path metadata, but these are not a complete secret/history scan.

## Why no public push has occurred

**Publication clearance is incomplete.** No GitHub remote, GitHub CLI authentication or official organization/team IDs were available, and unpublished source does not imply rights to distribute all assets. A GPL choice alone cannot legalize restricted third-party materials. Do not convert the private original repository/history directly into a public remote.

Remaining gates: review third-party legal provenance and notices, complete a professional secret scan of source/history, verify public source excludes references to unavailable assets in the UI, execute official GitHub CI, decide owner/team handles and repository URL, and configure security advisories, branch rules and contributor invitation policy. Full cloth simulation correctness is an independently acknowledged product-quality gap.

## Recommended first publication process

1. Finalize security and legal audits; fix blockers and resolve attribution/ownership.
2. Rebuild sanitized source snapshot via `scripts/prepare-public-source.mjs` into a new empty folder.
3. Review complete candidate and run all required CI locally; do **not** commit the private working tree.
4. Create a **private** official GitHub repository and upload only the sanitized candidate as an initial clean history.
5. Create actual GitHub contributor teams, update CODEOWNERS to real identities and enable protected `main` and mandatory checks.
6. Import only verified issues from the local draft batch, then consider carefully changing visibility to public after a final signoff.
