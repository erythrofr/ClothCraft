# EXO Community and Pattern Lab — Second-Round UI Design Review and Delivery Gates
**Date:** 2026-10-16  
**Status:** High-fidelity static/clickable concept only; no production software integration, public deployment, accounts, uploaded patterns, imported CAD, purchases, or releases.

This file records the second-round interactive website/user-interface prototype, evidence, and the exact requirements to develop it professionally. It supplements the [main UI system specification](EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_SYSTEM_2026-10-16.md), the [premium UX master](EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_MASTER_2026-10-16.md), [community and licensing architecture](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [Web Tech Packs](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md), and the [ecosystem implementation program](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md).

## 1. Deliverable inspection index

**Isolated concept:** [Open local concept HTML](../concepts/exo-community-ui/index.html). Styles: [Website and Pattern Lab](../concepts/exo-community-ui/styles.css), [premium secondary pages](../concepts/exo-community-ui/screens-v2.css). Scripts: [main UI state](../concepts/exo-community-ui/app.js), [publication and product workflows](../concepts/exo-community-ui/screens-v2.js). Evidence: [browser QA](../concepts/exo-community-ui/qa-ui.mjs) and [screenshot folder](../concepts/exo-community-ui/previews/). Historical early screen explorations are retained as screens.js/screens.css for reference but are **not loaded** in the consolidated prototype, to avoid conflicting click handlers.

| Capture | Main feature and design purpose |
| --- | --- |
| [01 desktop home](../concepts/exo-community-ui/previews/01-website-desktop.png) | Brand statement, editorial hero and full catalog |
| [02 quick preview](../concepts/exo-community-ui/previews/02-asset-detail.png) | Overview/spec/license tabbed lightweight asset inspection |
| [03 in-editor dock](../concepts/exo-community-ui/previews/03-app-pattern-lab.png) | Compact contextual Pattern Lab beside mock CAD viewport |
| [04 mobile homepage](../concepts/exo-community-ui/previews/04-website-mobile.png) | Responsive browsing and facet-trigger layout |
| [05 mobile Pattern Lab](../concepts/exo-community-ui/previews/05-app-pattern-lab-mobile.png) | Constrained-window workspace presentation |
| [06 interactive Tech Pack](../concepts/exo-community-ui/previews/06-web-techpack.png) | Review comments, R01/R02 measurement difference and role controls |
| [07 creator profile](../concepts/exo-community-ui/previews/07-creator-profile.png) | Source-protected garment, pattern, material portfolio |
| [08 publisher review](../concepts/exo-community-ui/previews/08-publish-rights-wizard.png) | Four-step permission and public-file preview |
| [09 full asset page](../concepts/exo-community-ui/previews/09-full-asset-page.png) | Detail, spec provenance, rights, compatibility CTA |
| [10 mobile asset page](../concepts/exo-community-ui/previews/10-full-asset-mobile.png) | One-column asset hero, inspector and license visibility |

The art is custom vector garment illustration with imaginary products and prices. The work is intentionally not misrepresented as photoreal Blender modeling, an operational e-commerce store, a real purchased pattern, or a working native EXO import.

## 2. Screen-by-screen product contract

### 2.1 Public homepage and browse
One hero statement, one strong path to the pattern archive, and a carefully typeset editorial product grid. Category nav into Patterns, Materials and Studios retains filter support. All filters and result counts must come from real permission-filtered backend responses when implemented. Search must never leak private team asset titles. Display anonymous public contents by default; logging in adds authorized personal/team results only with explicit scope chips.

**Product acceptance:** a first-time visitor can identify which cards are visual-only, free, paid, remixable and what files are included before acting. All cards have a creator; neutral card media remains consistent regardless of upload source.

### 2.2 Creator profile
A professional cover treatment, maker practice description, public collections and accessible switching among garment Looks, patterns, materials and studios. Owner-only unpublished drafts and private factory work are completely absent from anonymous/public page responses rather than being CSS-hidden. Following and showroom links need explicit sign-in, rate limits and privacy mechanisms before implementation.

**Product acceptance:** a public creator page is a branded portfolio by choice, with no leaked source filenames, licensing ambiguity or forced display of other users' purchased assets.

### 2.3 Full item/asset detail
The second-round full page includes a large portrait-format garment illustration, front/detail/rights image modes, description, creator, available formats, construction/material attributes, explicit access rights, a saved-to-collection action and an in-app Pattern Lab jump. No hover-only critical controls. In a production page, the same layout should host valid GLB viewer with view-only watermark optional and a fallback still image if WebGL is unavailable.

**Product acceptance:** a user knows whether the listed garment is an editable 2D pattern, a render-only GLB, PBR texture-only, measured physics profile, or Blender studio master. "3D" alone does not imply editable or physically validated. Restricting download means do not transmit the original source binary.

### 2.4 In-app Pattern Lab
Dark technical library dock, compact source list and selected asset inspector, while mock 2D/3D garment viewports remain visible. Its per-category compatibility matrix now explicitly distinguishes:
- **Patterns:** expected authoring destination; DXF/seam/units must validate before any editable import.
- **Materials:** optical PBR swatch versus separately measured cloth coefficients; appearance must not alter physics without a deliberate second action.
- **Garments:** display/reference meshes are not the original sewn 2D pattern source.
- **Studios:** stage assets belong in a photography library, not as 2D editable panel geometry.

The demo's Preview is only a temporary overlay and the Add to mock library increments an in-memory counter. Future import must be authenticated, validated, transactionally committed to a non-destructive target and Undo capable. Opening Pattern Lab must never restart EXO simulation, steal fabric Hand events, discard selected panels or corrupt the current document.

### 2.5 Interactive Tech Pack
The concept displays technical garment and illustrative size measurement data, pinned comments, a before/after cuff measurement and selectable revisions. A new role-aware section separately depicts:
- **Designer:** private internal planning and permission to request editing on a working branch.
- **Manufacturer:** approved-delivery-only status, read/comment/request-change permissions, no direct overwrite of the canonical release.

This is a client-side illustration only. An actual permission boundary **must** be implemented server-side and enforced on every field, object and download request. Role changes in a demo UI are not authentication. R01/R02 values are fictional acceptance examples and are not manufacturing-ready measurements.

### 2.6 Publishing wizard
The consolidated wizard has four steps: identify asset, choose audience, select files, review public-facing package. Default is a public **visual-only** listing with still image and optimized preview; editable DXF, grading, technical pack and original Blender asset are disabled for this mode. Switching to private clears public-file candidates. Free and paid modes are offered as UI previews, but cannot upload, sell, download or grant rights.

**Production gate:** no real remote publish action until the operator has reviewed actual uploaded files including extracted GLB metadata/texture references, accepted applicable asset and sublicensing rights, verified source ownership, chosen the exact sanitized derivative package, and confirmed the anonymous public view. A "finish preview" button in this research model never calls a backend.

## 3. Design system refinements needed before engineering

The visual prototype currently uses warm paper, charcoal, olive and subdued stone accents with a decorative serif and compact system typography. Before production:
- Maintain minimum legible body sizes. The small mono/caption type useful to describe a fashion image must not be used for all functional text; increase essential form labels to at least readable UI defaults and test browser text scaling.
- Check WCAG 2.2 AA text/background contrast across catalog names, gray mini-labels, disabled states, top navigation and dark editor dock.
- Fully keyboard-operate publishing visibility options, asset galleries, filters, Pattern Lab list, Tech Pack comments and role controls. After closing an asset modal, focus must return to the originating card.
- Public image/gallery contrast must not depend on a specific monitor, projector or ambient color environment.
- Mobile publication fields and CTA must remain usable at 320–390px. Do not show desktop-only multi-column tables without a responsive semantic equivalent.
- Use meaningful asset thumbnails backed by actual owner-authorized Blender/CLO/EXO source once approved; the prototype's SVG illustration is an art-direction placeholder, not a proof of product visual fidelity.
- Keep color as support, not sole indicator of View Only/Free/Paid/Remix, physically measured/estimated, imported/not imported or approved/rejected.

## 4. Implementation boundaries and dependency chart

**Public UI:** responsive site shell → search + filters → asset cards/detail/profile → safe preview + sanitized GLB → login/private library → creator publishing → free licensed downloads → teams/Tech Packs → paid marketplace after legal/financial readiness.

**Embedded EXO:** mount Pattern Lab as a new contained component around existing 2D/3D workspace → read-only personal/community search → license + type inspector → ephemeral ghost preview → version-guarded authorized import → native Undo → saved local receipt. The live Library/Pieces/Seams/History must not be replaced or refactored merely to display this prototype.

**API and schemas first:** Creator, Asset, AssetVersion, PackageVersion, Entitlement, PreviewDerivative, CompatibilityProfile, PatternImportReceipt, StudioAsset, FabricPhysicalProfile, MaterialVisualProfile, TeamRelease, FactoryRoleGrant, AuditEvent. Public can request only sanitized thumbnails, previews and permitted metadata. Private source and paid files require a server-side grant and an authorized short-lived delivery URL. Never return a private object-store key in an anonymous JSON response.

**Computation:** do not trigger remote PPF cloth jobs from public preview loads. 3D asset conversion, scans, thumbnail generation and mesh validation run in isolated workers with time/size quotas and file-type checks.

### Indicative follow-up tasks
- **UI-R2-01:** Convert all demo routes to a real route/view model with URL state, history/back restoration and keyboard focus.
- **UI-R2-02:** Replace eight illustrative assets with a small set of creator-authorized EXO/CLO/Blender exported fixtures, with verifiable source rights and hashes.
- **UI-R2-03:** Build standalone accessible pages for profile/detail/Publish/Tech Pack from shared tokens, without tightly coupling them to native EXO app.
- **UI-R2-04:** Add real type-aware facets, correct backend pagination, accurate hit counts and search/error/empty state coverage.
- **UI-R2-05:** Verify actual remote download/preview rights and package filenames before any enabled Import button.
- **UI-R2-06:** Build reusable license and privacy review component displaying "what public users receive" and "what stays private".
- **UI-R2-07:** Implement a versioned local EXO ImportCoordinator for one safe DXF or visual-material flow with provenance and Undo.
- **UI-R2-08:** Add owner/team/manufacturer role ACL and selective field serialization (not CSS roles), immutable R01/R02 snapshots, anchored comments and revision diff.
- **UI-R2-09:** Validate 3D garment texture resolution, surface mass/physics provenance, PBR optical map separation, studio source lighting/hdr limitations, and render fallback.
- **UI-R2-10:** Execute formal real-user studies comparing representative CLO-SET CONNECT/Sketchfab workflows. Capture completion time, errors, licensing comprehension and aesthetics feedback; avoid unverifiable superiority marketing.

## 5. Automated browser QA and next research gates

The isolated Playwright test covers search, categories, sort/filter chips, asset-detail information, full detail page, source-rights labels, cross-surface handoff to Pattern Lab, mock-only compatible importing, role-aware Tech Pack, version measurement comparison, sample comment, profile, four-step wizard, mobile screens, and expected JavaScript failures. All screenshots are generated from a local loopback-only static server.

**Known untested production behavior:** real auth, server-side permissions, malicious file upload, live search, uploads, transactions/payments, geometry import, PPF physics, 3D garment renderer, manufacturer release signing and valid merchant content. No green browser QA test can be used as evidence that any of these are deployed or reliable.

**Recommended first next approved engineering slice:** a standalone static design-token library + read-only asset cards/detail + offline/local Pattern Lab search using three properly licensed sample assets; then one reversible, validated import. Avoid connecting public traffic or payments while source privacy is still theoretical.

## 6. Directional conclusion

The public website should feel like an editorial fashion world; the native app's Pattern Lab should feel like a precise instrument for sourcing and using licensed garment components. Both must be consistent on asset identity and rights. This second-round concept demonstrates a coherent interaction vocabulary but does **not** claim production feature completeness, real 3D fashion simulation, safety certification, or successful import into EXO V2.

**No build directive:** Keep changes confined to the independent concept folder, its local QA captures, and Markdown research. The actual EXO app, saved garments, fabric physics, CLO3D files, plugins, hardware, user accounts and public websites remain untouched by this round.

