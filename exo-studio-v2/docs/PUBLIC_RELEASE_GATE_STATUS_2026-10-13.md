# Garment Studio — Public Release Gate Status

**Public repository: NOT CREATED. Publication: NOT AUTHORIZED / NOT PERFORMED.**

## Implemented

- GPL-3.0-only project license selected and text added; contributor docs updated.
- Standalone allowlisted public source snapshot script `scripts/prepare-public-source.mjs` (outside the workspace; never uploads).
- Current candidate: `/tmp/garment-studio-public-candidate-v6-20261013`; 416 copied files, 357 excluded paths. Local private CLO Thomas assets excluded.
- `scripts/check-public-release.mjs` checks for prohibited private filenames and essential source files. This intentionally **fails on the private working tree** (Thomas is retained there) and **passes on the public candidate**.
- `.github/workflows/public-ci.yml` runs npm installation, build, non-simulation tests, and public-asset gates. It is untested on GitHub runners until repository creation.
- `docs/NPM_LICENSE_INVENTORY.json` inventories 119 package-lock package entries: 110 MIT, 6 ISC, 1 Apache-2.0, 1 BSD-3-Clause, 1 CC-BY-4.0. This is not a full native/asset SBOM or legal verification.
- CODEOWNERS is intentionally a placeholder: GitHub team IDs are not yet known.

## Outstanding before publication

1. Full Git history and source-content secret scan using a dedicated tool; local filename/regex checks are insufficient.
2. Human-reviewed copyright provenance and asset licenses, including MakeHuman, OpenSew models, third-party solver/native libraries, CLO SDK wrappers, images/fonts and bundled examples.
3. Complete native/transitive third-party notices and release SBOM; validate CC-BY-4.0 package obligations.
4. Clean candidate macOS native application build and functional acceptance, not just browser build and non-simulation tests.
5. Confirm code-owner team names and configure actual GitHub repository, required checks, protected branches, issue board and security reporting.
6. Obtain explicit user authorization before any public push or invitations. Do not publish local Git history.

## Validation record

- Candidate v4: `npm ci` with isolated npm cache PASS; `npm run build` PASS; `npm run check:non-simulation` PASS.
- Candidate v6: asset filename gate PASS before build; full isolated build/check status is in `/tmp/gs-public-v6-{install,build,check}.log` and must be verified before marking pass.
- Initial npm install failed due to permissions in existing user npm cache; isolated cache resolved it without modifying that cache.
- The candidate is an ephemeral `/tmp` directory and should be regenerated or moved to a stable private staging path after review.
