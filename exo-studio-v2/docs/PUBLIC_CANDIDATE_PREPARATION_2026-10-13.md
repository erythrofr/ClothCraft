# Public source candidate — preparation status

Created 2026-10-13. The official working tree and private app remain untouched. A separate **unpublished** sanitized candidate is at `/tmp/garment-studio-public-candidate-v2-20261013` on the Blender Mac. `node scripts/prepare-public-source.mjs <empty-path-outside-repo>` regenerates a snapshot without publishing it.

- GPL-3.0-only root license and contribution policy are present.
- A public CI starter checks build, non-simulation tests and blocks files named CLO Thomas in `public` and `dist`.
- Initial candidate has 449 allowlisted files; private `clo-thomas.glb` and `native_app/assets/clo-thomas.obj` are excluded.
- Original workspace `npm run build` passed. This is **not** a fresh candidate `npm ci` or complete public build verification.
- `.github/CODEOWNERS` is a placeholder pending actual organization and team handles; no branch protections or public repo have been created.
- SECURITY.md contains a provisional disclosure path; configure GitHub private vulnerability reporting before launch.

**Critical remaining gate:** allowlist exclusion is not a legal or security audit. The candidate may still contain private file paths, project-specific notes, research descriptions, unreviewed sample assets, or restricted text. Its history is not scrubbed; publish it only as a new repository after a complete file-by-file rights/secret review, separate full scanner, dependency SBOM and verified clean build. Never push the current working tree or its old history by default. Native app and solver fixture coverage require additional checks. Public version may need an approved avatar replacement where original avatar is omitted.

**Latest candidate:** `/tmp/garment-studio-public-candidate-v3-20261013` uses an explicit small documentation allowlist instead of copying every internal audit/handoff note. Previous v2 is superseded. The local heuristic scanner is only a preliminary check, not a substitute for Gitleaks or a full manual review.
