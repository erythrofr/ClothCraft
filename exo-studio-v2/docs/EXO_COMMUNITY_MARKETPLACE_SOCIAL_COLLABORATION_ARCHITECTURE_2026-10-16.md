# EXO Community — Profiles, Garment Pattern Pool, Creator Marketplace & Collaboration
**Product + platform architecture research | 2026-10-16 | Concept only, no implementation**

**User experience extension:** [Premium web Community, in-editor Pattern Lab, and sample Web Tech Pack design system](EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_MASTER_2026-10-16.md). Isolated clickable prototype: [Website and Pattern Lab](../concepts/exo-community-ui/index.html). Demo-only rights and import states; no production service is enabled.

**Program navigation:** [Integrated ecosystem implementation program](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md) and [creator marketplace / team candidate engineering issues](EXO_ECOSYSTEM_CANDIDATE_ENGINEERING_BACKLOG_2026-10-16.md).

**Product direction.** Build an independent consumer-facing EXO Community website, connected to EXO Studio via explicit user-controlled publish and download workflows. The site is a Sketchfab-like fashion network: people have maker profiles, outfits, patterns, fabrics, sewing assets, rigged avatars, Blender studios and fashion show environments. Others can browse a huge free pool, download legally allowed assets, pay for others, remix with correct attribution, collaborate with teams, follow designers and visit walkable virtual fashion spaces.

**Protect creator agency:** Public visibility of a beautiful garment is not consent to share editable CAD patterns, grading rules, a manufacturing tech pack, raw measured fabric data, private team discussions or full-resolution meshes. Uploaded source, presentation derivatives, approved downloads, team-only working versions and public profile entries must be different storage/security concepts.

Related: [EXO PPF/materials/rooms research](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md), [spatial blueprint](EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md), [execution backlog](EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md), [interactive web tech pack future](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md).

## 1. Two products, one creator identity

**EXO Studio** is the local native/browser garment editor: editable 2D patterns, dimensions, native/PPF simulations, material authoring, 3D avatars, local pattern manufacturing export, staged photography and immersive wardrobe. Production data stays local until expressly uploaded or connected.

**EXO Community** is the website: public/private creator pages, a 3D viewer, free pattern pool, commercial marketplace, remix tree, likes/follows/collections, creator rooms and collaborative team workrooms. It only receives artifacts the creator chooses to publish or share, never blanket access to local disk.

**EXO Teams / Product Development** adds organization projects, separate permissions, comments, review/approval and interactive web tech packs. A brand may invite manufacturers to review an approved specification without offering that proprietary source to random followers.

Suggested website navigation:
- Discover: personalized but controllable chronological/search feed, categories, latest public garment looks, pattern pool and trending studios.
- Patterns: free/open and paid CAD/pattern listings with formats, sizes, number of pieces, seam-allowance status and compatibility notes.
- Marketplace: Garments, Patterns, Fabrics/Materials, Trims/Hardware, Avatars, Studios/Scenes, Runways, Collections, Tools/Templates.
- Profiles: creator's bio, collections, visual garment wall, followers/following, remix credits, stores, work published, external links and badges.
- Rooms: immersive private/public outfit museums from verified published Look assets.
- Teams: workspaces, review queues, assigned tasks, secure files, comments and live Tech Packs.
- My Library: owned assets, downloaded licenses, saved patterns, purchased items, remixes and subscriptions.
- Upload/Publish: guided wizard with private content selection, license, copyright, preview, scan and final publish confirmation.

## 2. Models of publication: never treat public as downloadable

A product/creator entry can expose different packages:

| Publish intent | Public can see | Public receives | Ownership constraint |
| --- | --- | --- | --- |
| Private project | Nothing | No network response | Owner/team only |
| Unlisted proof/review | Selected preview only, gated link | No download unless granted | Token scoped and revocable |
| Public visual portfolio | Thumbnails, filtered 3D display, permitted notes | No editable pattern/mesh source | Viewer-only derivative with no confidential metadata |
| Free pattern | Preview + selected distributable pattern files | ZIP/DXF/SVG/AAMA only if legitimately exported and documented | Explicit free license and creator permission |
| Open remix project | View + specified source, version and dependencies | Source files under clear permission to fork | Preserve upstream credits, derivative terms |
| Paid digital product | Teaser and license tiers | Entitled signed download after confirmed transaction | Seller rights and platform settlement |
| Team project | Role-filtered metadata, previews and annotations | Files based on project role and explicit grant | Organization/workroom ACL |
| Factory tech pack | Approved snapshot and revisions | Factory-scoped approved specifications and authorized packages | Manufacturer cannot silently edit designer's master |

**View-only is not perfect DRM:** users may screenshot visible artwork or reverse-engineer some approximate geometry. Security means **never transmit restricted source bytes**, not simply hiding a download button. Generate genuinely reduced/rebaked display derivatives that omit proprietary 2D coordinates, formulas, grade rules, source filenames, metadata, author comments and precise manufacturing seam labels. Scrubbing glTF extras and metadata is necessary but not sufficient; inspect network payloads. Even an accurate 3D view may expose commercially relevant visual design, which the creator accepts when publishing.

## 3. Rich catalog taxonomy and universal asset records

**AssetType:** garment pattern, garment display/look, fabric physical profile, fabric visual/PBR scans, hardware trim, graphic/print, embroidery/seam template, avatar/pose/rig, studio environment, runway set, collection/lookbook, manufacturing template and tutorial.

**Asset record:** assetId UUID, type, creator/team owner, title, slug, summary, searchable tags, garment category, applicable sizes/region standards, software/format compatibility, asset source reference, rights and license, base price and currency, preview references, thumbnails, approved downloadable package refs, dependency IDs/versions, content hash, publishing state, editability badge, external source provenance, maturity/validation status and moderation status.

**Pattern specifics:** paper/reference pattern vs verified production-grade document, dimension units, grading coverage, seam allowance type, notches, drill marks, grainline, internal construction lines, number of pieces, fabric width/layout advice, optional PDF/SVG/DXF/other legally interoperable formats. Public listing must not claim factory-ready accuracy from unverified SVG screenshots.

**Fabric specifics:** sample source, measured GSM and thickness, optional loading curves/solver coefficients, physical calibration status, weave/knit description, UV repeat scale, separately licensed texture maps, author and colorway. A material can be downloaded as visual-only (PBR textures) without giving the commercial lab measurement set, or vice versa where terms allow.

**Studio specifics:** source .blend allowed only when creator authorizes, portable GLB scene when compatible, original HDRIs and props with their own rights, cameras/lights, environment preview, performance budgets and scene license. A studio's purchased license does not magically include permission to redistribute bundled third-party material packs.

**Derivatives:** each derived publication links sourceAssetId and exact sourceRevision, the base material/trim/studio dependency manifest, declared transformations, original creator credit, evidence of license compatibility and a graph of upstream distribution terms.

### Creator profile layout
Cover image and username; studio alias/handle; public biography and optional verified business profile; featured outfits in 3D, public room entrance, Pattern Pool submissions, fabrics/studios tabs, followers/following, saved collections, remix lineage and seller store. A private dashboard holds draft and team projects, unshared studies and paid sales reports, never visible merely because the public visits the profile.

Suggested creator types: independent designer, clothing brand, patternmaker, textile artist, 3D artist, factory account and educator. No occupation claim is verified until the platform has a responsible verification process.

## 4. Remix graph and licenses are the product, not an afterthought

Creators want to build on a shared sweatshirt base, modify panels and publish a new hoodie or reuse an original fabric/studio. A naive download button will break attribution and potentially infringe rights.

**Core principles:** the upload author must attest that they hold redistribution and derivative rights; remixable requires an explicit license that permits modification; paid/downloadable is *not* automatically remixable or resellable; each derived item records exact upstream versions and original authors. Store a license receipt at each download and purchase.

**User-facing options:** visual display only; free personal use; free with attribution; open commercial remix under a specified compatible license; paid personal/commercial usage with optional redistribution rights; separate extended physical-production usage. Do not invent ambiguous 'free to use however you want' permissions. Creative Commons licenses can cover some art assets; source code uses software licenses; garment patterns and manufacturing terms may need carefully drafted industry-specific license terms and local legal review.

**Composite remix licensing:** a derivative garment may incorporate an original base pattern, a paid denim visual material, a button asset and a licensed runway stage. Its public metadata can credit all contributors, but the right to package or resell component files depends on every original license. Some assets are *reference in project* rather than redistributable. Automatically show conflicts and block a publication containing incompatible rights.

**Royalty split** (long-term optional): map dependencies to an entitlement graph, choose explicit percentages and order-of-operations for each paid sale, cap complexity/cycles, handle refunds/chargebacks, and store settlement evidence. This is a commercial/legal project of its own, not something a runtime asset hash alone can solve. [CLO-SET CONNECT's design-source policy](https://support-connect.clo-set.com/hc/en-us/articles/45304332338713-Design-Source-Policy) offers a concrete reference for distributing proceeds to component creators; do not simply copy its fee schedule or assume the same terms work for EXO.

### Marketplace economics research
[CLO-SET CONNECT](https://connect.clo-set.com/store) already lists Garment, Fabric, Trim, Avatar and Scene categories with free/paid publishing and basic/extended licensing. Its help center currently says it charges 30% commission; this is a competitive observation, **not** a recommended EXO fee. [Sketchfab](https://sketchfab.com/plans) demonstrates 3D annotations, profiles, embedding and private/unlisted controls. Differentiate EXO by genuine pattern source/size metadata, author-approved remix rights, material mechanics, interactive factory tech packs and local EXO app round trips.

[Stripe Connect](https://stripe.com/connect) is a candidate for seller onboarding, marketplace settlements, payouts, refunds and fee splitting. Its pricing, tax collection roles, supported geographies and liability must be reviewed when implementing; do not hardcode a nonexistent fee or claim it handles every seller's tax obligations automatically. Paid sales should require a real entitlements state and signed short-lived download, not a frontend purchase flag.

## 5. Collaboration: independent editing, review, and permissions

**Team workspace:** organization brand, teams, project boards, roles, shared asset registry, milestones, assigned tasks, review notes, garment version history and manufacturing partners. Invite by verified user/account and explicit project scope, with invitation expiry/revocation.

Proposed roles (least privilege):
- Owner: invite/revoke admins, modify rights, publish and initiate sales.
- Admin/Manager: manage team work and assign reviews; cannot transfer ownership without owner approval.
- Designer/Patternmaker: edit authorized garment sources/measurements and propose a revision.
- Material specialist: edit approved fabric/trim records, not unrestricted all-project assets.
- Reviewer: annotate and approve only when designated; no general edit.
- Manufacturer: read approved release snapshot, propose questions/change requests and attach sample evidence; **cannot silently overwrite canonical spec**.
- Client/Guest: restricted preview/feedback, expiration and watermark optional.
- Public user: only sanctioned released files and public derivative.

**Real-time collaboration:** rich-text descriptions, comments, checklists and annotations can use a CRDT such as Yjs for concurrent text; structured garment CAD editing should initially use transaction locks/optimistic revisions, deterministic operations and conflict resolution, **not** merge arbitrary point edits by last-write-wins. An edit to the same curve control point at two devices needs a visible conflict rather than hidden data loss. Live viewers may follow a coworker's camera, inspect a diff or comment anchored to an object stable ID.

**Branching and approvals:** Draft branch → internal review → technical/pattern review → manufacturer request → approved immutable Release, with ability to fork a new draft. One release version is always identifiable for a purchase/factory run; a previous approval must not be implicitly inherited after measurement or material changes. Events have actor, clock time, old/new revision, project/garment, before/after data paths and reason.

**Comments:** anchor to pattern panel ID and point/edge stable ID, 3D triangle barycentric surface with mesh revision, BOM line, size/measurement row, image pixel normalized coordinates or document page/section. When geometry changes, try remap anchor with known stable IDs; otherwise mark **unresolved / orphaned** rather than silently pinning to an unrelated point. Thread, mentions, resolution, assigned owner, due date and evidence image belong to the comment record. See the [web tech pack plan](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md).

## 6. Web architecture and systems

**Frontend:** separate EXO Community app (e.g., modern React framework, browser 3D renderer built atop Three.js); public SEO pages, profile and catalog. The existing EXO desktop app should integrate only through a user-controlled publisher/importer with scoped account authentication, not by opening local ports to the internet.

**Backend:** authenticated API, relational database for profiles/permissions/assets/orders/version metadata, private blob/object storage for originals, derivative/CDN storage for public preview, entitlement service for purchased assets, search index with optional semantic tags, background job queue for thumbnails/virus scans/conversions. Organization/project isolation enforced on server, not just hidden frontend tabs. Audit logs are append-only from the application perspective.

**File pipeline:** signed upload destination → quarantine → MIME/magic/type scan and strict allowed formats → decompression bomb / path traversal / executable-content checks → size, file count, triangle, texture and archive limits → provenance/license review → safe source storage → sandboxed parser/render conversion → public derivative preview → user approves exact publish bundle → CDN. Never directly execute code embedded in a model asset or Blender .blend; studio scene processing is a sandboxed offline job. Follow the [OWASP upload guidance](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/File_Upload_Cheat_Sheet.md?plain=1).

**Private boundaries:** raw original patterns, manufacturing specs, personally identifying account data, factory notes and all purchased sources live in private storage. Every download checks entitlement and exact asset version at request time. Public search only indexes public sanitized metadata. A profile viewer should never receive hidden measurements or private object-store URLs. Avoid 'unlisted' as the sole protection for confidential factory specs.

### Conceptual normalized database entities
users / profiles / organizations / org_members / teams / projects / project_members / garments / source_revisions / assets / asset_versions / asset_files / licenses / entitlements / imports / derivative_edges / collections / collection_items / follows / reactions / comments / threads / moderation_reports / studio_rooms / looks / reviews / releases / manufacturer_partners / orders / order_items / payment_events / settlements / notifications / immutable_audit_events.

**Relational invariants:** asset_versions immutable when published; orders reference stable offered asset version/license price at purchase time; derivation graph is acyclic (unless explicitly represented as non-derivative reference); creator can remove future sales while retaining necessary proof for prior buyers under policy; hard deletion/erasure honors privacy law and retained transaction obligations. Sales or asset counts on a profile are derived from authorized queries, not editable arbitrary fields.

### Example asset manifest (illustrative only)

    asset: "uuid"
    type: "garment-pattern"
    owner: "creator-uuid"
    edition: "2026.1"
    visibility: "public-preview-only"
    previews: ["approved-preview-id"]
    sourceFiles: ["private-source-object-id"]
    downloads: []
    grants: [{ principal: "team", role: "viewer" }]
    sourceDependencies: []
    rights: { display: true, download: false, remix: false }
    provenance: { uploader: "...", rightsAttested: true }
    validation: { unitsChecked: false, productionReady: false }

This is a **schema sketch**, not a functioning security policy or final licence legal text. All grants require backend verification; a public JSON snippet should never expose private source object IDs to a different account.

## 7. Trust, moderation, creator protection and community safety

Large public libraries require active safety design: copyrighted works, counterfeit brand logos, misleading 'certified fit' listings, spyware disguised as downloadable tools, plagiarized patterns, unauthorized human scans/photos, explicit or harmful imagery, harassment in comments and spam. Design reporting, appeal and action workflows, a repeat-infringer/copyright notice process, seller verification where needed, rate limits, bot protection, account recovery and moderation audit records.

A 'verified garment' badge must mean a documented technical process, not paid status. Separate **3D preview checked**, **pattern scale checked**, **measured textile source**, **simulation contact-checked**, **manufacturer approved**, and **community reviewed**, each with its own evidence. Never display a generic 'physically accurate' stamp based on a beauty render.

Protect against scraping only to the extent possible; a public view naturally exposes visual design. The material promise is that proprietary source data stays private unless the owner grants it. Each buyer/download receives receipts of license terms, file hashes and seller identity; sellers can see usage summaries without automatically learning buyers' private project files.

Follow controls: chronological feed available, mute/block creators, disable comments, disable remix requests, private bookmarks and opt-out of personalized recommendations. Give creators analytics without exposing individual user behavior beyond what the terms and privacy notice permit.

## 8. Product phases and realistic build order

| Gate | Future release | Key deliverable and acceptance |
| --- | --- | --- |
| C0 | Rights, schema and privacy strategy | License vocabulary, creator protections, upload threat model, public/private manifests |
| C1 | Public visual gallery + profiles | Account, creator portfolio, authorized thumbnails and 3D viewer; private data never transmitted |
| C2 | Free pool + downloads | Searchable licensed pattern files, verifiable hashes, format metadata, free entitlements and download receipts |
| C3 | Remix lineage | Fork explicit remixable source only, attribution and dependency tree; incompatible terms block publish |
| C4 | Teams and secure project review | Role-based assets, comments, release snapshots and correct revocation/permission QA |
| C5 | Paid marketplace | Seller onboarding, order entitlements, payout/refund accounting, buyer rights and tax/compliance review |
| C6 | Virtual wardrobe rooms and studio assets | Walkable user rooms, scene template downloads, source-safe optimized GLB |
| C7 | Advanced multiplayer and revenue-share derivatives | Presence, optional shared showroom, robust rights splitting and moderation at scale |

Do **not** implement payments before correct entitlements/licensing or a safe uploader. Do **not** implement collaborative direct CAD edits before reliable version/revision management. Do **not** start public uploaded PPF processing before job isolation, cost controls and physical validity checks.

**Suggested relative effort:** profile/gallery prototype 4–8 engineer-weeks once the platform foundation exists; free pool and safe importer 4–8; teams/comments 6–12; paid marketplace 6–12+ plus legal/accounting; remix royalties and large 3D rooms substantially more. These are nonbinding exploratory bands, not calendar estimates or a promise that this is a small side project.

### QA success journeys
**Creator:** signup → private draft hoodie → publish sanitized view-only showcase → another account views geometry but receives no editable size/measurements/edge data → remove it → confirm access revoked. **Patternmaker:** upload explicitly licensed free pattern with sizing → format/scale validations → stranger downloads with receipt → forks only where remix license allows → original creator linked. **Brand team:** invite a reviewer and manufacturer into a specific garment release → guest sees approved spec, comments, no confidential formulas → approval history cannot be rewritten. **Seller:** post paid texture pack → customer receives exact entitled version after charge → revoked link prevents fresh unauthorized download; refund and rights behavior follows explicit store policy. **Gallery:** 20 mannequin looks in a walkable original room, optimized with LOD, and a list fallback for accessibility.

## 9. Platform business model: options to evaluate, not decided

Potential revenue streams: low commission on paid digital item sales; optional paid extra storage for large libraries; brand/team seats; optional advanced offline PPF batch processing with transparent compute credits; premium showroom hosting; custom branded pages or manufacturer review seats. **Keep a meaningful free tier** for public patterns and educational collaboration. Core private drawing rights and safety features should not be withheld for monetization.

Do not assume 'free download' licenses can be flipped to paid without respecting prior rights. Publish versioned product/licensing changes for new customers and preserve historical entitlements. Test economics: median storage per garment, upload conversion costs, image CDN, GPU rendering, payment fees, refund exposure and support/moderation before setting platform pricing.

## 10. External reference documentation

- [CLO-SET CONNECT Store](https://connect.clo-set.com/store) and [uploading/licensing options](https://support-connect.clo-set.com/hc/en-us/articles/45304331487769-Uploading-Items): marketplace categories and free/paid tiers.
- [CONNECT design-source and component royalties](https://support-connect.clo-set.com/hc/en-us/articles/45304332338713-Design-Source-Policy): derivative revenue attribution precedent, not EXO terms.
- [Sketchfab plans](https://sketchfab.com/plans): profile previews, embed/annotation and private/unlisted capabilities as documented by vendor.
- [Stripe Connect](https://stripe.com/connect): marketplace onboarding and payouts.
- [Yjs shared types](https://docs.yjs.dev/getting-started/working-with-shared-types): candidate for collaborative rich text/comments, not a reason to merge physical CAD geometry without review.
- [OWASP secure file upload](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/File_Upload_Cheat_Sheet.md?plain=1): public upload threat model.
- [GitHub license guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository): public viewing alone does not authorize use and derivatives.

**Decision:** The site should be an independent creator platform over the same intentional asset/garment identity model, with publicly visible fashion work, independently licensed downloadable sources, a huge free pattern pool, optional paid products, accessible walkthrough rooms and robust team/project ACLs. **Nothing is uploaded, sold, published or deployed by this research.**
