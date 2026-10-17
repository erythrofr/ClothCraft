# Garment Studio — open-source release readiness audit

Date: 2026-10-13. **Verdict: NOT READY TO PUBLISH.** GPL-3.0-only has been selected and the license file added, but other blockers remain. Read-only inspection of the local working repository, current dependency lockfile, existing license policies, assets, and native build configuration. No code, credentials, assets or Git history were changed by this audit. No remote repository was created or made public. This is a technical compliance assessment, not legal advice.

## Severity-ranked findings

| ID | Severity | Evidence | Remediation / release gate |
|---|---|---|---|
| OS-01 | PARTIALLY RESOLVED | Owner selected **GPL-3.0-only**; official root `LICENSE` added 2026-10-13. | Verify ownership/permission for all included original and contributed files; align source headers, notices, contributor attestations and trademark policy before publishing. |
| OS-02 | BLOCKER | `public/avatars/clo-thomas.glb` exists locally; `native_app/build.sh` supports `INCLUDE_PRIVATE_THOMAS=1`, and existing portability docs forbid redistributing CLO-derived Thomas without permission. | Exclude proprietary Thomas from all public source, sample projects, downloadable releases, Git history and release pipelines; substitute licensed/CC0 avatar. Confirm source rights of each asset. |
| OS-03 | BLOCKER | Current working tree contains numerous uncommitted/new files and locally staged/private fixtures; only 87 paths are currently Git-tracked. | Create a separate sanitized publication candidate with an explicit allowlist, then inspect all files, blobs and history; do not `git add .`, push current working tree or publish this directory blindly. |
| OS-04 | HIGH | `git remote -v` returned no remote. No GitHub team protections, CI enforcement or repository permissions can be confirmed. | Create GitHub organization/repository only after approval, enforce protected `main`, required reviews/checks, CODEOWNERS and minimal token permissions. |
| OS-05 | HIGH | No complete third-party notices/SBOM. `package-lock.json` metadata lists 110 MIT, 6 ISC, 1 Apache-2.0, 1 BSD-3-Clause and 1 CC-BY-4.0 installed npm package records (not legal verification). | Generate exact lockfile/SBOM attribution, check nested transitive assets/licenses, preserve licenses in distributed app; examine CC-BY-4.0 asset attribution and any commercial usage terms. |
| OS-06 | HIGH | `docs/LICENSING.md` notes PPF runtime bundled third-party enumeration incomplete and keeps it in ignored `research/ppf-local/`. | Keep PPF optional and absent from public release; inspect its third-party notices and dependency tree before redistribution. |
| OS-07 | HIGH | Blender GPL and Seamly2D GPL integrations are discussed in project policy. | Keep integration boundaries documented and reviewed; IPC separation does not automatically resolve derivative/combined-work questions. Do not vendor/link GPL code without compatible licensing assessment. |
| OS-08 | HIGH | No completed historical secret scan. `.gitignore` excludes `.env*`, SDK vendor files, native builds and model caches, but `.gitignore` does not sanitize existing Git history or accidentally tracked content. | Run secret scanner across all refs/history and candidate publication tree; rotate exposed credentials if discovered; perform manual PII/absolute path review; do not paste raw secret matches into public issues. |
| OS-09 | MEDIUM | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/*`, and `.github/PULL_REQUEST_TEMPLATE.md` exist, but contribution license attestation remains unresolved. | Decide DCO vs CLA with legal input, add maintainer review ownership, security policy, support channels, vulnerability handling and PR checklist gates. |
| OS-10 | MEDIUM | Native app uses private-asset inclusion flags; previous local builds used `INCLUDE_PRIVATE_THOMAS=1`. | Public build CI must set `INCLUDE_PRIVATE_THOMAS=0` and assert no prohibited asset in app contents; create separate private developer build profile. |
| OS-11 | MEDIUM | No verified public build/release provenance, notarization process, universal architecture tests or reproducible artifact SBOM. | Build from clean checkout on CI, verify native bundle, run CAD/export/physics smoke tests, produce signed checksummed releases and provenance. |
| OS-12 | MEDIUM | The master plan includes 924 GS checkboxes; current task status is not an audited implementation matrix. | Start with 20–40 curated good-first-issue / priority tickets; tag component owner, dependencies, acceptance tests and docs. Avoid mass-importing unfinished unverified claims. |

## Recommended license decision (pending owner approval)

**Decision recorded: GPL-3.0-only.** The root `LICENSE` contains the official GNU GPL version 3 text. This is a project-level license selection, not a certification that every file may legally be distributed under it. Original authorship, third-party compatibility, notices and any linked/combined-work implications still require review. No permission is granted to redistribute CLO Thomas or other proprietary assets.

## Asset and component disposition

- **Original app source:** candidate for public licensing only after ownership confirmation, copyright review and final `LICENSE` file.
- **MakeHuman CC0 base:** asset license file exists at `public/avatars/MAKEHUMAN-LICENSE.ASSETS.md`; verify exact exported model provenance and embedded derivatives before shipping.
- **CLO Thomas:** **exclude**; local `public/avatars/clo-thomas.glb` is a release blocker if accidentally packaged, regardless of whether currently tracked.
- **CLO SDK integration:** wrapper code may be publishable if original; vendor SDK, headers, binaries and access credentials must remain excluded; confirm SDK agreement permits any distributed wrapper/interoperation.
- **PPF runtime:** optional local research adapter only until complete third-party notice and runtime license review.
- **Blender bridge:** review independent-script license and GPL integration scope; do not package Blender source/binaries casually.
- **Seamly2D:** separate optional external bridge until distribution architecture reviewed.
- **Model checkpoints/body scans/fixtures:** do not publish unless rights, provenance, model terms, privacy and redistribution are established.
- **npm dependency graph:** metadata scan is a triage result, not proof of licensing; exact distribution manifest required.

## Publication gate checklist

- [x] Select core license: GPL-3.0-only; official text added.
- [ ] Complete rights-holder/contributor permission and source-level license/notice review.
- [ ] Inventory all shipped code, fonts, images, 3D avatars, example garments, data, solver binaries and models with SPDX/license evidence.
- [ ] Prove proprietary Thomas and other restricted files absent from source history and public build artifacts.
- [ ] Scan full Git history and candidate release for credentials/PII and resolve all findings.
- [ ] Produce clean public allowlist export without local research directories or unreviewed untracked files.
- [ ] Generate `THIRD_PARTY_NOTICES.md` and SBOM; verify attribution and native dependency obligations.
- [ ] Add SECURITY.md, CODEOWNERS, ownership policy, contribution attestations and PR gates.
- [ ] Establish CI for `npm run build`, `npm run check:non-simulation`, safe physics smoke, native public bundle, dependency/security/license checks.
- [ ] Verify clean-room macOS build from fresh checkout without private assets, network credentials or proprietary SDK.
- [ ] Configure protected branches, minimal permissions, issue triage and release approval.
- [ ] Publish explicit limitations: garment collision/fitting currently not production-certified.
- [ ] Only after all blockers close: owner authorizes creating a public repository and publishing a tagged preview release.

## Audit limits and next actions

No exhaustive forensic history scan, executable binary SBOM, proprietary SDK legal review, authorship certification, public clean-checkout CI or shipped-app contents validation was performed. These require separate evidence and signoff. Existing repo remains private/local and untouched. First action should be asset and history quarantine, then licensing/rights decision, then a sanitized preview repo with CI.

## External primary references

- Apache license application and NOTICE: https://apache.org/legal/apply-license.html
- Apache-2.0 license text: https://www.apache.org/licenses/LICENSE-2.0.html
- GNU GPL FAQ on independent programs and combined works: https://www.gnu.org/licenses/gpl-faq.en.html
- GitHub guidance on sensitive data and history: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- GitHub secret scanning: https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning
