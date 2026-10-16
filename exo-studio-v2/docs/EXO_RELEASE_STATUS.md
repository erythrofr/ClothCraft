# EXO Sample 3D — public release status and outstanding engineering gates

## What this publication is

The **EXO Sample 3D** GitHub source is a GPL-3.0-only research/development release: first-party browser garment-CAD code, reproducible tests, optional native/PPF adapters, documentation, current UI captures and the full V16 promotional film. It is **not** a stable industrial pattern-CAD certification, commercial manufacturing approval or guarantee of correct garment fitting.

### Acceptance categories

| Area | Current evidence | Remaining acceptance |
| --- | --- | --- |
| Source and UI | Clean checkout can install/build; 2D/3D drafting tools and tests exist | Broader long-running regression suite, cross-platform packaging |
| Media | Eight current real-interface screenshots, V16 MP4 | Clearer future photo/PBR material demonstration and fit-accepted garment |
| Avatar | Neutral MakeHuman-derived fitting avatar with CC0 license reference | Body/cloth contact verified on more poses and measurements |
| Sewing | Seam and staging algorithms with numerous parity fixtures | High-velocity multi-frame cloth/body collision validation |
| Rust PPF | Optional local external service and request/response bridge | End-to-end production-fit acceptance; external runtime remains unbundled |
| Native XPBD/C++ | Research modules and several parity tests | Stable general solver and certified continuous collision response |
| Fabric materials | PBR optical controls and procedural photo maps | Physically calibrated coefficients and live-render output parity |
| Production | DXF, BOM, POM, markers and factory ZIP generators | Independent cutter import and factory sample sign-off |
| Licensing | GPL main license, CC0 avatar notice, external dependency policy | Per-release historical rights audit and complete binary SBOM |

## Public source checklist

- [x] Correct GitHub owner identified and local source preserved in Git.
- [x] Generated SDKs, binary builds, research checkouts, proprietary avatars and secrets excluded from normal source tree.
- [x] V16 video included at a GitHub-compatible file size, full timeline preserved.
- [x] Recent app screenshots captured from an isolated Foundation Tee test session with a neutral mannequin and visible grid.
- [x] Extensive technical documentation and transparent product maturity claims.
- [x] Inspect HEAD and the seven reachable historical commits for common sensitive filenames and GitHub/API-key signatures (no matching secret files found; pattern checks are not a substitute for a full security audit).
- [x] Pass clean staged-tree source filename gate, isolated npm clean install, Vite public build, non-simulation suite and physics tests.
- [ ] Verify included soundtrack and any contributed photography have valid publication rights.
- [x] Push and verify GitHub `main` commit SHA, then confirm the public repository and current 3D gallery are accessible without authentication.
- [x] Enable GitHub's private vulnerability reporting for responsible disclosure.
- [ ] Revisit security/dependency inventory and compatibility reports for every subsequent release.

## Engineering gates for stable software

**Geometry.** Editing points, Béziers, internal lines, notches, seam allowances and mirrored/grading construction should preserve reversibility, precision and saved history. Correctness requires explicit fixture tolerances and repeatable export/import tests.

**Sewing.** Full/partial seams, easing/gathering, zipper/virtual seams, fused layers, pins and stages must preserve constraint endpoints and construction semantics. Visual adjacency is not the same as a tested sewn joint.

**Cloth dynamics.** Repeatable benchmarks across tee, pants, hoodie and zipper garments must demonstrate no unacceptable body penetration or self-intersection, stable strain, meaningful friction/thickness, no float-up, and acceptable multi-frame motion. Particle distance to body surface alone is insufficient evidence for swept-triangle collision detection (CCD).

**Production.** Independently verify graded DXF units/layers/polyline closure, notch/grainline rules, marker widths and quantities, POM values, BOM completeness, factory ZIP contents and physical sample cut validation. A 24-file ZIP does **not** prove a factory-ready package.

**Materials.** Match color spaces, normal/roughness maps and textile repeat scale in the current viewport; separately calibrate fabric constitutive properties with physical textile data.

**Desktop and interchange.** Ensure browser and native views preserve canonical project semantics, robustly import/export standard CAD formats, isolate external processes and do not allow background tools to corrupt saved patterns.

## Responsible claims in a public README

Appropriate: *experimental open-source apparel CAD platform; editable 2D/3D workspaces; Rust PPF and native backend research; source test coverage; partial production tooling; development showcase video.*

Not justified: *commercial CLO3D equivalence, 100% validated simulation, zero body intersection for all garments, production-grade cutter certification, full native C++ rewrite, or physically accepted sizing across all avatars.*

## Security, privacy and third-party rights

Public Git publishes **full accessible history**, not merely the current file set. A removed API key or proprietary model can remain downloadable from an old commit. Review all reachable commits, binary blobs, issue attachments, docs, media, contributor metadata, and GitHub Actions permissions. Keep passwords, signing identities, private garment patterns, commercial avatar assets, downloaded SDKs and local model datasets out of published history. The installed third-party Rust PPF solver must retain its own source license and transitive dependency notices; it is not automatically included by linking to it.

For questions about source ownership, audio/music rights or redistributing reference pictures, do not assume a public website or repo conveys permission. See [licensing](LICENSING.md), [security](../SECURITY.md), and [Rust backend](RUST_BACKEND.md).

## Release operations

1. Run the deterministic source build and non-simulation checks.
2. Reproduce sample garments and document any physics discrepancies.
3. Confirm all README screenshot/video links and media byte lengths.
4. Verify git status and remote tracking; never force-push over independent contributors.
5. Require PR reviews for canonical project schema or solver acceptance changes.
6. Keep a private master of high-bitrate media files away from the source repo.
7. Re-evaluate public release claims after each new solver or factory qualification gate.

See the [master roadmap](EXO_MASTER_ROADMAP.md) and [validation plan](EXO_VALIDATION_TEST_PLAN.md) for prioritized work and measurable acceptance criteria.

---

Return to the [README](../README.md) or [documentation index](EXO_DOCUMENTATION_INDEX.md).
