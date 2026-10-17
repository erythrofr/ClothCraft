# Open-source public-candidate verification — 2026-10-13

**Scope:** This report covers only local verification of the sanitized preview, not legal redistribution clearance or external GitHub configuration. It does not certify garment draping quality or manufacture readiness. The private working tree, assets and old Git history were not published, modified, cleaned or deleted as part of this pass.

## Verified passing candidate

Candidate `a separate unpublished sibling staging folder (`garment-studio-public-preview-20261013-02`)` was generated from a fresh allowlist snapshot without copying the working `.git` directory. Reported 571 selected files, 211 excluded paths (at generation time). Its built-in filename release gate passed.

Checks executed from the candidate:

- `npm ci --ignore-scripts --no-audit --no-fund` using isolated `/tmp/gs-public-npm-cache`: PASS
- `npm run build`: PASS
- `npm run check:non-simulation`: PASS
- `INCLUDE_PRIVATE_THOMAS=0 INCLUDE_PREPARED_SOLVES=0 bash native_app/build.sh arm64`: PASS
- `codesign --verify --deep --strict native_app/build/arm64/GarmentStudioNative.app`: PASS (local ad-hoc signature, **not Apple Developer signing or notarization**)
- `find ...GarmentStudioNative.app -iname '*thomas*'`: no matches

Detailed local command logs: `/tmp/gs-oss-candidate-02-{install,build,check,native}.log`. No remote build or native interaction smoke test has run. Private Thomas is retained in the original working tree for existing user workflows.

## Unresolved release-quality defects

1. Public code still advertises CLO Thomas and OpenSew Theo/Nora in the avatar selector even when their assets are absent in this sanitized preview; selecting unavailable options can fail. The public release must hide unavailable assets based on manifest/runtime detection, while private features continue to work in private builds.
2. This public preview is **not notarized** and its ad-hoc signature is unsuitable for polished distributed binaries. Add Apple Developer signing, hardened runtime and notarization after account approval.
3. The native scene still calls `loadThomas()` and shows a missing-OBJ status instead of automatically loading MakeHuman. Public native scene functionality needs a CC0 fallback or a clearly documented model-free state.
4. Import/exports and collision simulation are not certified end-to-end. A successful build and non-simulation tests do not establish production readiness.
5. Security worker and third-party provenance audits are required before any public push; CODEOWNERS requires real team handles. No GitHub remote was configured in this audit.

## Newly prepared contributor infrastructure

- `.github/CONTRIBUTOR_TEAMS.md` documents proposed teams, ownership responsibilities, branch/merge strategy.
- `docs/OPEN_SOURCE_GITHUB_LAUNCH_PLAYBOOK.md` defines the private-first publication process.
- `docs/OPEN_SOURCE_ISSUE_BOARD_STARTER.md` specifies GitHub Project fields and curated first issues.
- `scripts/generate-public-issue-pack.mjs` generated 20 **local unpublished** draft issue files at `a separate unpublished sibling folder (`garment-studio-issue-drafts-20261013`)`.
- `.github/workflows/public-native-macos.yml` adds a CI starter for macOS native builds and Thomas-asset verification (not executed on GitHub yet).

## Latest slim clean candidate (more current)

The refreshed staging folder `garment-studio-public-preview-20261013-08` contains 346 selected source files and only four required native garment fixture JSON files. Copy size approximately 14 MB before dependency install. Re-generated from source with no old `.git` history and no filenames containing `thomas`. Fresh isolated `npm ci`, `npm run build`, `npm run check:non-simulation`, filename release gate, arm64 `native_app/build.sh`, and `codesign --verify --deep --strict` **all passed**. Logs: `/tmp/gs-oss-final08-{install,build,tests,native}.log`. This is not a complete legal/security clearance.

A further identical slim source export (`garment-studio-public-preview-20261013-09`) removes private absolute home paths from its candidate inventory. The v08 compiled build remains the latest fully rebuilt artifact; v09 changes only generated-inventory metadata.

**Publication status: HOLD.** Verify third-party rights, full secret scans, missing-asset UX and open-source source completeness; secure hosting and release settings before public release.
