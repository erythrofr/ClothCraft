# EXO Ecosystem — Integrated Research and Execution Program
**Version:** concept planning v1 | **Date:** 2026-10-16 | **Status:** FUTURE WORK ONLY

**New UI research and clickable concept:** [EXO Community + Pattern Lab premium UI/UX master](EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_MASTER_2026-10-16.md), [production design specification](EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_SYSTEM_2026-10-16.md) and [isolated HTML prototype](../concepts/exo-community-ui/index.html). This is not integrated with the native app or a deployed website.

**New premium UX research and working isolated UI prototype:** [EXO Community + Pattern Lab Design System and Build Plan](EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_MASTER_2026-10-16.md). Prototype source: [EXO Community/UI concept](../concepts/exo-community-ui/index.html), with public website, sample asset detail, embedded Pattern Lab mock, and sample Web Tech Pack revision comparison. The live EXO app and real community website are **not** modified/deployed.

**Issue-level planning:** [39 additional PPF/material/studio/community task cards](EXO_ECOSYSTEM_CANDIDATE_ENGINEERING_BACKLOG_2026-10-16.md), plus [48 spatial tasks](EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md) and [14 Web Tech Pack tasks](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md). None are filed or approved for development.

This is the **decision and execution layer** tying together four independent, technical research documents:

- [PPF physics, measured materials, lighting and immersive wardrobe studios](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md).
- [Community creator profiles, pattern pool, remix marketplace and collaboration](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md).
- [Interactive 2D/3D Web Tech Pack and designer/factory revision approvals](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md).
- [Spatial/projected garment workshop and original ten-page implementation plan](EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md) plus [the original future-concepts master](EXO_SPATIAL_PROJECTION_GARMENT_STUDIO_AND_AR_CONCEPTS_2026-10-16.md).

**Scope lock:** Nothing in this plan authorizes building or deploying a site, connecting accounts, publishing patterns, charging buyers, uploading work, enabling camera capture, modifying garments, running PPF jobs or altering the installed EXO app. All task IDs below are candidate issues, not filed or assigned issues.

## A. Product map and central principle

**EXO Studio** remains the desktop/native authoring and simulation app. It owns editable garments, original patterns, 2D/3D source, live ClothCraft VBD, optional audited PPF high-fidelity jobs, physical textile test data, procedural/scanned PBR materials, and Blender-created studio presentation. Users retain local ownership of design files.

**EXO Community** is a separate social and marketplace website. Creators have profiles and private brain-like garment libraries; publish selected Looks as visual-only; optionally grant or sell a specific pattern, garment display mesh, material/PBR texture, manufacturing template, trim, studio scene, avatar or runway asset. Other users follow, curate, download, remix with explicit rights and enter walkable rooms of permitted Looks.

**EXO Teams / Tech Packs** is a secured workspace on the platform for people developing real garments with other designers, suppliers and manufacturers. The interactive spec includes CAD-linked POM tables, graded sizes, fabrics, trim/BOM, construction and sampling notes, reference photos, pinned comments and immutable manufacturer-specific releases. Factories may propose edits; they cannot silently overwrite a designer's approved source.

**Three unequal levels of access must always remain separate:**
1. **Can see** a public or team-approved sanitized rendered outfit.
2. **Can download** particular asset files under exact free or purchased license.
3. **Can edit/approve** private source geometry, manufacturing data or a team's working release.

One right never implies the other two. An authorized manufacturer may have full pack data while the creator's followers see only a fashion film or orbitable, reduced 3D view.

### Example day-in-the-life
A user opens their private **Wardrobe Room**, sees all their owned or imported hoodie collections on mannequins, and clicks a garment. The inspector shows fabric weight and measured/estimated reliability, material textures, 2D/3D previews and two simulation badges (interactive preview vs PPF full-frame verified/rejected). From there they can enter a self-authored Concrete Studio, choose a camera/light and render photos. For a chosen garment the **Tech Pack** shows the approved size/spec, comments from Manufacturer A on sleeve construction and designer responses. Once ready, the user may publish **only a visual-only public Look** on their profile. A different item may publish a legally licensed **free or paid pattern** and receive remix citations. The hidden source, client list and factory chat remain private.

## B. System decomposition and integration rules

\`\`\`mermaid
flowchart TB
  subgraph Local["EXO Studio / local device"]
    CAD["Editable pattern, seams, materials & revisions"]
    LIVE["Interactive native VBD cloth + Hand"]
    PPF["Isolated offline PPF contact jobs"]
    RENDER["Blender masters / Three.js previews / local render"]
    CAD --> LIVE
    CAD --> PPF
    CAD --> RENDER
    PPF -->|"accepted or rejected + exact fixture"| RENDER
  end
  CAD -->|"explicit selected release/upload only"| PUB["Publisher + rights/permission gate"]
  RENDER -->|"sanitized visual derivatives only"| PUB
  PUB --> OBJ["Private source storage + safe public preview derivatives"]
  subgraph Web["Separate EXO Community / Teams platform"]
    ID["Identity / profiles / organizations / ACL"]
    REG["Immutable versioned asset registry"]
    SOCIAL["Explore / follow / collections / creator rooms"]
    LIC["Free / paid entitlement + remix licenses"]
    PACK["Interactive versioned Web Tech Pack"]
    JOB["Quarantined conversion / thumbnail jobs"]
    OBJ --> JOB
    OBJ --> REG
    ID --> REG
    REG --> SOCIAL
    REG --> LIC
    REG --> PACK
  end
\`\`\`

**Boundary:** the website never mounts the user's entire EXO workspace or raw native localhost Rust commands. EXO Studio initiates a narrow, authenticated, explicit artifact publication job, lists every file to be sent and the permissions, and receives a publish receipt with exact version/hash. A remote viewer cannot start native PPF runs or read local pattern vertices unless a separately authorized future service explicitly offers those operations through reviewed capabilities.

### Four catalogs, one identity graph
- **Garment catalog:** source garment + exact variants/sizes + editable and display derivatives + fabrication readiness.
- **Materials catalog:** physical specimen profile separate from PBR visual texture/profile; each can carry independent licensing.
- **Studio catalog:** original editable Blender masters, downloadable studio recipes, optimized web scenes, cameras and lighting rigs.
- **Community catalog:** publication packages, author/team, free/paid rights, dependency/remix lineage, gallery rooms, reviews and collections.

Use stable UUIDs with immutable version IDs, origin and content hashes. The same garment source can support 15 different Looks without copying the original. A pattern listing can point to an authorized immutable production package while the creator's private working Tech Pack remains hidden.

## C. Technical data contracts worth specifying before code

| Domain | Required entity & IDs | Immutable versus mutable | Forbidden assumption |
| --- | --- | --- | --- |
| Design | Garment, PatternPiece, Edge, Seam, Revision | Release immutable; working branch revisioned | 3D mesh implies editable CAD |
| Physics | MaterialPhysicalProfile, SolverRun, ColliderVersion, AcceptanceReport | Solver run snapshot + QA immutable | Solver completed means safe fit |
| Optics | MaterialVisualProfile, TextureSet, MapProvenance | Versioned texture source and render profile | Beautiful texture implies measured physics |
| Studio | StudioMaster, StudioRuntime, Look, RenderJob | Master protected, published Look frozen | Blender GLB retains entire lighting rig |
| Platform | Account, Profile, Organization, AssetVersion, PublicationPackage | Published asset version and license receipt immutable | Public preview means source download |
| Collaboration | ProjectACL, Comment, Proposal, Revision, FactoryRelease, Acknowledgment | Proposal audited; factory release immutable | Factory can edit accepted spec directly |
| Marketplace | Offer, Entitlement, Purchase, Settlement, Refund, LicenseGrant | Purchase receipt and delivered version immutable | Payment frontend flag grants download |

**Concept API examples (not active):**
- \`POST /v1/publish/preview\` — preview selected files, metadata and rights that *would* be uploaded; no side effect.
- \`POST /v1/publish/commit\` — explicit creator confirmation; upload approved source/derivative with expected version and idempotency key.
- \`GET /v1/assets/{id}/versions/{v}/preview\` — sanitized permitted derivative, never underlying private source.
- \`POST /v1/remixes\` — validate immutable origin, all parent licenses, selected allowed derivative files and creator attribution.
- \`POST /v1/teams/{id}/techpacks/{pack}/proposals\` — propose structured field patch referencing parent release and stable comment anchor.
- \`POST /v1/techpacks/{pack}/releases\` — approver-only, revision-guarded immutable snapshot, generate exact export manifest.
- \`POST /v1/techpacks/{pack}/releases/{release}/acknowledgments\` — factory scoped to received release.
- \`POST /v1/orders/checkout\` and webhook settlement — price/entitlement calculated and verified server-side; no direct client-chosen prices.

**Database/caching split:** relational database for access, comments, product, asset versions, orders, factory releases and immutable audit; private object storage for source, public CDN for specifically generated display derivatives; explicit safe upload/conversion workers; search index of only public metadata. The local app should not depend on an internet round trip to continue using its existing 2D CAD/simulator.

### Capability model for visual-only publishing
The owner selects what is visible: rendered still, orbitable simplified GLB, optional branded studio and selected public fabric descriptions. The publish processor strips source patterns/grades, measurement tables, internal comments, PPF solver coefficients where private, texture EXIF/hidden paths, glTF extras and unpublished other people's IP. Private source files get independent storage keys never transmitted in public responses. Server ACL and signed asset access controls are tested per request. 'Hide Download' UI alone does not secure a file already sent to the browser.

## D. Hybrid physics and trustworthy fabric status

**Interactive engine:** native ClothCraft VBD/GPU VBD supports hand dragging and fast visual response in user workflow. It is appropriate for temporary constraints, stop/reset and room look previews once cached. Its nine native materials are not a completed, lab-calibrated apparel physics library.

**High-fidelity contact engine:** PPF is a separate asynchronous Rust/Metal batch backend with independently checked trajectory. Its existing EXO run history contains real body crossings and excessive seam gaps; baseline acceptance explicitly failed. Next work must prioritize sound initial sewing assembly, static-vs-pinned body A/B, material conversion and independent full-frame plus swept contact tests. A green 'Fit Verified' badge must not appear on a solver merely finishing with finite output.

**Material model:** a cloth's **physical** sheet mass, thickness, warp/weft/bias stretch, shear, bending, friction pairs, hysteresis and compression are a measured specimen or a flagged estimate. **Visual** albedo, normal, roughness, textile sheen, anisotropy, UV repeat/grain and clearcoat are independent rendering assets. Show both:
- Physical: \`Measured\` / \`Calibrated to solver X\` / \`Estimated preset\` / \`Unknown\`.
- Visual: \`Scanned, scale-checked\` / \`Procedural\` / \`Uploaded, unverified\`.
- Fit: \`Visual preview\` / \`Solver ran, rejected\` / \`Accepted for reference fixture\` / \`External garment validation\`.

User can select a material under a local hoodie's panels and instantly see woven/knit optics, but to claim credible drape, material coefficients must be fit from the actual sample using known experimental loading, documented solver mappings and same reference garment. Tie source specimen to PBR texture rights only if creator licensed both.

**Solving and cost:** production site starts with uploaded previews and already cached drape. No anonymous, user-uploaded mesh automatically triggers PPF Metal jobs. Future compute processing needs queuing, per-user quotas, memory/time constraints, cancellation, malware/file type checks and acceptance reports; schedule and charges must be explicitly approved.

## E. Virtual wardrobe room, photography and web viewer

Local EXO Studio provides the primary private **walkable closet/gallery**, with original Blender stages such as White Infinity, Gray Fabric Lab, Concrete Gallery, Architectural Archive, Black Void, Muslin, Runway and Outdoor. The user can navigate WASD/mouse or teleport, choose mannequins and cameras, swap garments, walk into a photography studio and export a local Look. Multiple sizes/colorways and saved avatar poses should feel like an organized fashion collection rather than a filesystem.

Web EXO Community reuses **only licensed/sanitized published Look derivatives**, optimizes GLB and KTX2 textures, lazy-loads each showroom, restricts private content, and offers accessible 2D galleries. A public room should never reference unapproved private materials/patterns. Users may download or license original scene assets only when that package is explicitly offered separately.

**Performance plan:** 1 room/10 avatars first, then 20 and several rooms; scene LOD, texture streaming, renderer disposal, shader cache, instanced decor and navigation colliders. Measured FPS and memory on target desktop/mobile matter more than a scene screenshot. Never simulate all outfits in PPF while browsing; use cached drape/visual meshes.

**Photography:** three original Blender masters before dozens of presets. One neutral e-commerce and one fabric lab for truthful textile checks; a creative Concrete/Gallery set for campaigns. Each Look records garment and asset hashes, avatar rig, pose, lighting, camera, tone mapping and license. A WebGL scene must recreate its own light rig because Blender World and area lights are not faithfully carried by a generic GLB export. Premium offline renders remain a separate local Blender job.

## F. Interactive tech packs and manufacturer collaboration as independent product

The web Tech Pack should feel like a **living garment specification website**, not just an embedded PDF. It has tabbed 2D/3D technical views, size POM tables with method/tolerance, material BOM, cost-restricted sections, construction lines, hardware and zipper references, fit photos, sampling rounds, per-component comments and revision timeline.

The designer owns a Draft branch with private formula, cost and sourcing information. An internal reviewer may annotate actual panel, seam, 3D triangle, measurement row or image. The designer explicitly makes immutable **Release R01** with linked EXO source revision and export hashes. Manufacturer A receives only the approved sections/files and can annotate, upload sample measurements/photos, request alternates and acknowledge. A request to change the cuff width becomes **a proposal**, not a silent edit. The designer creates Draft 02, resolves comments, tests pattern/tech pack, approves **Release R02** and the factory sees exactly what changed. The platform remembers R01 as superseded evidence.

Existing EXO source already generates \`tech-pack.json\`, \`factory-spec.html\`, \`pom-spec.csv\`, material/BOM, trims/hardware and DXF export in original Garment Studio; this is a schema/asset source, **not an interactive online techpack feature yet**. The website should ingest typed metadata, not derive production specs from screenshot OCR. CLO-SET and Techpacker currently provide relevant 3D tech packs, 3D annotations, revisions and factory comments; EXO's differentiator could be linking every item to native pattern/sewing IDs, formally approved immutable manufacturing releases and a community view-only boundary.

**No cross-tenant leakage:** Manufacturer B may not see A's unit prices, quotes, comments or approved private patterns, even if both collaborate with the same brand. Public followers and marketplace buyers should not receive draft manufacturing notes unless the creator intentionally packages them under a separate license.

## G. Creator marketplace and remix network

**Public profiles:** username/cover/bio, favorite Looks, authored garments, studio rooms, followers/following, free patterns, shop items, licensed remixes, collections and optional verified brand/team account. Private 'My Brain Library' remains separate: drafts, all pattern iterations, measurements, hidden notes, visual references, unfinished design and purchased assets.

**Publishing classes:** private, unlisted specifically granted, public visual-only, free licensed download, remixable project, paid downloadable asset, team workspace or approved factory release. A listing may have multiple *different* permissioned packages (public still and purchasable DXF; downloadable scene but private original .blend).

**Free mass pattern pool:** structured size metadata, format validation, author/source license, production-readiness flag, description/preview and download receipts; filters by garment type, style, size, file format and permitted remix/commercial usage. Creators can upload free work without losing ownership. Paid pattern downloads add entitlement, seller onboarding and refund/chargeback handling.

**Attribution:** every fork tracks exact parent asset revision and rights. Terms distinguish personal use, commercial sewing/production, derivative remixes, source redistribution and promotional use. A studio may contain third-party HDRIs whose original owners do not permit redistributing texture binary files. A contributor royalty graph is a future legally reviewed capability, not something safely inferred merely from asset dependencies.

**Social:** follow, like, save, comment, remix request, personalized/chronological feed, creator room visit, shared collections, mute/block/report, and moderation. A view-only author can opt out of comments and downloadable derivatives. Keep chronological option for discovery and audit recommendation quality before popularity loops.

**Team working:** organization roles and per-project ACL, direct garment sharing, invitations/revocations, pinned comments and review queue. A future CRDT may safely merge text/cursor presence, but simultaneous CAD point edits, critical BOM quantities and approved versions need revision guard and conflict review.

**Commerce/security:** quarantine untrusted uploaded files; never execute arbitrary .blend, model scripts or ZIP payloads on the server unsandboxed. Payments must be verified via provider webhooks, not client flags. Follow seller identity verification, taxes/reporting, platform liability and licensing advice with counsel before launching paid commerce. U.S. copyright and other laws differ by jurisdiction and asset type; don't assume all patterns or designs have identical rights.

## H. Program sequence with specific exit gates

### P0 — Plan, rights and canonical geometry
**Owner:** product/EXO architect, security, apparel technologist. **Deliverables:** sample garments and hashed source fixtures, source-of-truth decision, units, license/consent policy, cloud/compute threat model. **Gate:** user confirms intended prototype and publishing rights; no existing private project automatically uploaded.

### P1 — Local material provenance + PPF research
**Owner:** native/physics + textiles. **Deliverables:** unified material measurements/version scheme, typed solver adapters, failing historic PPF fixture, controlled contact A/B test plan, identical-swatch render test. **Gate:** invalid physical simulation remains rejected, no claimed full fit until tests pass.

### P2 — Studio library and first walkable room
**Owner:** Blender/look-dev, graphics. **Deliverables:** three original studios, versioned Look metadata, 10 mannequins/looks in private walkable hall, accessible list fallback, material inspector. **Gate:** original garment hashes unchanged, no licensing violations, target FPS/LOD measured.

### P3 — Community core, creator profiles and safe read-only previews
**Owner:** web/data/security. **Deliverables:** accounts, profiles, private/public asset boundary, source-safe upload, sanitized preview and creator libraries. **Gate:** cross-account negative ACL tests and malicious file rejection; published preview has no private CAD/techpack bytes.

### P4 — Free downloads, remix licensing and collection graph
**Owner:** platform/rights. **Deliverables:** free asset pages, immutable versions, licenses/receipts, search/follows, source dependency graphs and format readout. **Gate:** unlicensed remix blocked and granted download package hashed.

### P5 — Team workflow + read-only interactive Web Tech Pack
**Owner:** EXO interoperability, web full-stack. **Deliverables:** garment/POM/BOM/technical view linked to typed native exports, private factory role and annotated comments. **Gate:** Manufacturer A cannot see B/private fields; measurement units and size variants match known EXO fixture.

### P6 — Draft/release workflow + sampling
**Owner:** apparel specialist, backend/security. **Deliverables:** structured change requests, sample photos/measurements, version diff, approver-signed R01/R02 and acknowledgment, historical export hashes. **Gate:** released specs immutable and diff reproducible, access revocable.

### P7 — Paid marketplace and seller operations
**Owner:** commerce/legal/security. **Deliverables:** seller accounts, payment provider integration, order entitlements, refunds, payout/tax controls, moderation and support operations. **Gate:** unauthorized download denied, chargeback handled according to defined rights, financial audit trail retained.

### P8 — Public creator rooms and advanced collaboration
**Owner:** realtime/graphics/privacy. **Deliverables:** public walkable creator showcases with only licensed derivatives, optional shared view/presence, optimized 3D rooms and accessibility. **Gate:** room performance, permissions and moderation at real expected traffic.

### P9 — Optional advanced PPF, royalties and AR
**Owner:** research/physics/commercial. **Deliverables:** validated PPF high-quality processing only after physical contact acceptance, legally reviewed multi-author revenue shares, separately scoped AR try-on/fit research. **Gate:** never present unvalidated output or noncommercial research model as factory-grade or unrestricted commercial product.

### Prioritization: working slices, not dependency lock-in
Do **not** require PPF to pass to launch a local visual studio. Do **not** require the paid store to provide a free community pool. Do **not** require expensive 3D rooms before simple creator galleries and download pages. Tech Pack collaboration may ship for a private small brand/workshop before a public social launch, if permissions/version contracts are ready. Keep authorization for these as separate decisions.

## I. Early integrated test matrix

| Acceptance fixture | Required evidence | Failure behavior |
| --- | --- | --- |
| 220 GSM jersey | 0.220 kg/m² canonical mass; real swatch provenance; texture not treated as physics | Reject inconsistent units and clearly label estimates |
| Hoodie PPF result | Full-frame seam gaps, strain, independent body/self crossings and swept report | Rejected output remains visible as diagnostic, not a verified fit |
| White/Concrete/Black studios | Same accepted Look, original .blend scene and camera/light manifest | Missing maps/lighting flag; sources not overwritten |
| Wardrobe Hall | Ten original private Looks, walk/teleport, click-to-inspect, list fallback | Do not leak other accounts' assets |
| Visual-only portfolio page | Sanitized GLB; private POM, pattern rules and tech pack excluded from all network bytes | Privacy test fails release |
| Free remixable pattern | Explicit license, source hash, size/format metadata, parent credit | Deny fork if licence doesn't allow |
| Paid pattern | Buyer entitled to exact immutable paid package, no unauthorized direct object-store access | Reject and audit unsigned/non-entitled request |
| Manufacturer review | A sees only approved R01 fields, comments pinned to cuff POM | Cross-factory access denied |
| Revised sample R02 | Immutable R01+R02 with field-level diff, actor, acknowledgment | Old release cannot be overwritten |
| Security scanning | Untrusted ZIP/GLB/.blend processed with sandbox and quotas | Reject/hold without exposing filesystem |

## J. Architecture and research references

- Existing [EXO source-to-factory artifacts](EXO_PRODUCTION_PIPELINE.md).
- [PPF actual garment collision failure audit](PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md).
- [Fabric optics, physical and PBR authoring source](EXO_FABRIC_MATERIALS_AND_TRIMS.md).
- [Interactive Web Tech Pack details](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md).
- [CLO-SET Web Tech Pack Construction](https://support.clo-set.com/hc/en-us/articles/45303219780377-Web-Tech-Pack-Construction); [3D annotations with Web Tech Pack](https://support.clo-set.com/hc/en-us/articles/45303128139673--2025-04-Updates-in-CLO-SET-Annotation-work-with-3D-Tech-Pack).
- [Techpacker maker/factory versioned sharing](https://helpcenter.techpacker.com/hc/en-us/articles/360022720553-How-to-share-a-Tech-pack-with-Manufacturers).
- [CLO-SET CONNECT free/paid store](https://connect.clo-set.com/store); [component creator design-source policy](https://support-connect.clo-set.com/hc/en-us/articles/45304332338713-Design-Source-Policy).
- [Khronos glTF sheen](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_sheen/README.md); [material anisotropy](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_anisotropy/README.md).
- [Yjs collaborative shared types](https://docs.yjs.dev/getting-started/working-with-shared-types); [OWASP upload safety](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/File_Upload_Cheat_Sheet.md).
- [Stripe Connect marketplace settlements](https://stripe.com/connect); [Three.js PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html).

**No-build decision:** This ecosystem program is a concept and implementation plan only. No EXO source code, system configuration, public account, browser session, payment connection or garment files were changed by this document.
