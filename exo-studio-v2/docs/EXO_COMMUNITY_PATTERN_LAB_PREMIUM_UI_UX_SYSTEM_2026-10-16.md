# EXO Community + Pattern Lab — Premium Website and In-App UI/UX Specification
**16 October 2026 | Product design research and future implementation blueprint | NO PRODUCTION BUILD**

**Clickable concept:** [Prototype homepage](../concepts/exo-community-ui/index.html) · [UI source](../concepts/exo-community-ui/app.js) · [Design CSS](../concepts/exo-community-ui/styles.css) · [Browser QA](../concepts/exo-community-ui/qa-ui.mjs) · [Screenshots](../concepts/exo-community-ui/previews/).

**Second-round detailed UX review:** [Full item page, creator rights wizard, role-aware tech pack and in-editor Pattern Lab](EXO_COMMUNITY_UI_ROUND2_SCREEN_EVIDENCE_AND_BUILD_PLAN_2026-10-16.md).

**Context:** [Community architecture](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md) · [Web Tech Packs](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md) · [Ecosystem master plan](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md) · [Physics, fabrics and immersive rooms](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md).

## 1. Product philosophy and creative direction

The goal is a premium fashion-design network, **not a generic marketplace with pattern thumbnails**. The website should feel like a publication and fashion archive, yet behave like a precise professional asset tool. Every garment has a creator and original source. Every downloadable file has explicit permissions, units, supported formats and versions. Every factory spec remains confidential unless the owner grants specific access.

Design goal: beautiful enough for a fashion label to feature a collection; usable enough for a professional patternmaker to search, inspect and import during an active CAD session. Claims of being 'better than CLO-SET' or 'better than Sketchfab' require side-by-side usability tests; this plan describes differentiators, not demonstrated superiority.

**Two interfaces, one system of record:**

- **EXO Community website:** discover creators and assets, follow collections, inspect 3D looks, buy/download permitted source, publish work, participate in teams and open manufacturer Tech Packs.
- **EXO Pattern Lab inside the native application:** compact dark tool for current-project search, technical inspection, license/format checks, nondestructive preview and later authorized imports. Native garment CAD and physics remain the primary experience.

The same versioned asset catalog, license/entitlement rules, thumbnails and creator identities underpin both. The public UI can be editorial and expressive; the CAD UI must be dense, focused, reversible and trustworthy.

## 2. Design tokens, typography and art direction

The prototype uses a warm architectural palette:

| Purpose | Initial token | Guideline |
| --- | --- | --- |
| Page paper | #f4f2ec | Warm neutral background, never flat clinical white |
| Inset paper | #eeece5 | Search, filter and content areas |
| Primary ink | #242823 | Editorial text and strong contrast |
| Ink banner | #222620 | Header actions and section bands |
| Boundary | #d8d6cf | 1px fine rules |
| Secondary text | #73756d | Use sparingly and contrast-check |
| Warm accent | #b8a27c | Textile/heritage accent, not every button |
| App chrome | #252a2c | Dark Pattern Lab surface |
| App workspace | #272b2c / #33383a | CAD panels and utility chrome |

Editorial font: a licensable high-quality display serif (prototype uses Playfair Display) for campaign statements, collection hero, room title and creator profiles. Interface font: humanist/neutral sans (DM Sans or Manrope); precision metadata: monospaced (DM Mono). Production must review font redistribution, fallback and offline support. Do not bundle or expose private font files.

Spacing: base unit 4 px, steps 8/12/16/24/32/48/64/96 px. Mostly squared cards, restrained 1px outlines, minimal shadows, purposeful still photography. Use motion as feedback only: 150–250ms hover/panel transitions; modal entry may be slower; never animate measurement numbers. Respect reduced motion and motion-sickness preferences.

**Media direction:** curated images, true fabric-scale macro crops, mannequin hero shots on consistent backdrops, original Blender stage renders, technical flats with real labels. The current clickable concept uses simple SVG illustrations **only as placeholders**, not actual physically simulated clothing. Future art pass must use authorized garment previews without private source metadata. Avoid huge gradients, busy glass effects, invented reviews and fake production-readiness badges.

**Accessibility commitment:** WCAG 2.2 AA goal. Audit actual text contrast (especially muted microtype), keyboard access, dialog focus return/trapping, touch targets, reduced motion, screen reader labels, non-WebGL fallback, and zoom to 200% without lost functions. Tiny editorial mono labels in the concept are not exempt from legibility requirements.

## 3. Site navigation and page-by-page experience

**Global:** Discover / Patterns / Garments / Fabrics / Materials / Hardware / Studios / Avatars / Creators; plus search, Following, Collections, Personal Library, Publish, Teams, Tech Packs, Help and profile. On mobile group secondary categories into a clear Browse dropdown or scrollable tab row without clipped critical destinations.

**Homepage:** editorial hero with one primary pattern-library CTA; a secondary tour into the app; four category gateways; curated collections; featured creator; new originals; popular remixable items; professional tool benefits. The current working prototype represents hero, navigation, category gateways, indexed grid and in-app teaser. Future homepage needs authentic gallery media and editorial curation policy.

**Category/search:** one primary search, relevant filters only, clear applied-filter chips, visible result count and sorting, grid/list view, remembered search in URL, back navigation with scroll restoration, skeleton/error/empty states. Baymard studies support visible applied-filter summaries so users do not forget the current scope. Mobile filters should open a modal sheet with summary, Reset and explicit Show N Results confirmation.

**Pattern search facets:** silhouette/category, size range, region grading system, cut size units, number of graded sizes, file format (DXF/SVG/PDF/native EXO), seam allowance, knit/woven suitability, free/paid, remix rights, source/editability status and documented production-preflight level.

**Material search facets:** knit/woven, fibers, composition, measured GSM and thickness range, available albedo/normal/roughness/height maps, tile repeat mm, front/back nap, physical measurement confidence, simulator profile compatibility, license and source scan rights.

**Studio search facets:** original Blender master availability, GLB runtime, indoor/outdoor, lighting preset, HDRI provenance, avatar compatibility, scene complexity, target renderer, commercial usage/license and scene file size.

**Garment search facets:** creator, type/silhouette, materials, colorways, sizes, digital mannequin/pose compatibility, visual-only vs editable/source availability, simulation status and measured garment validation.

**Asset listing card:** thumbnail and alternate view, category, asset name, maker identity, free or paid availability, editability/deliverable format and limited quality indicators. No hidden license. Creator profile is a separate navigable target; hover reveals inspect, not an accidental import.

**Asset detail—the central page:** large 3D viewer with 2D technical flat and image fallback; camera presets (front/back/detail); detail/specification/license/update/remix tabs; creator profile and attribution; size and file-format matrix; physical versus visual material badges; timestamp/version changelog; exact contents of downloads; compatibility notes; commercial/remix permissions; buyer CTA. The viewer must not expose hidden pattern geometry or factory data. For a view-only portfolio item, show a clear View only message and never an enabled source import button.

**Creator profile:** designer name and visual identity; cover/hero Look; public collection wall; pattern pool, fabric scans, studio assets and runway rooms; follower stats only if real; remix lineage; publish/subscribe/contacts if authorized. Private owner's Brain Library tab includes drafts, garment versions, measurements, notes, purchased assets and team workspaces, never visible to strangers.

**Upload wizard:** select category → pick exact source files → scan and validate → generate private preview → select rights and downloadable packages → check units/version/license → preview public anonymous page → confirm publication. Rights options must distinguish view-only, free download, remixable under explicit terms, paid personal/commercial licenses, team-only and factory release. Show a manifest of **every file visible to another user**. A public listing should never silently include raw source uploaded for preview.

**Teams and Tech Packs:** separate professional workspace; overview, tasks, approvals, source revisions, manufacturer-specific access, anchored comments on POM/seam/3D garment, sample photos, BOM and immutable R01/R02 factory releases. A manufacturer may propose revisions but may not overwrite accepted designer specs.

**Personal walk-through room:** viewer-controlled 3D archive of mannequins and collections, look inspection and studio-door navigation. This is a separate gallery mode with a fully functional flat/accessible browse alternative and strict public-vs-private asset filtering.

## 4. In-app Pattern Lab: interface and behavior

Current EXO source inspection: the actual ClothCraftWorkspace.jsx asset browser already has **Pieces, Seams, Library, History**. The Library is presently a starting-fixture tab (e.g., T-shirt/Dress), **not** a server-backed asset marketplace. Preserve existing tabs. Add Pattern Lab as a distinct dock/workspace entry or separate tab within EXO, not a wholesale replacement.

**Default dock width:** ~360–420px on wide displays, with minimum viable CAD viewport; expanded explorer/fullscreen mode for detailed 2D/3D and asset/version comparisons. On small app windows prefer an overlay or separate contained view to crushing the native 3D/2D workspace.

**Dock structure:** Pattern Lab header + online/offline badge; global search (Cmd/Ctrl+K or /), category chips, asset filters, compact rows, type and rights badge, preview/compatibility inspector, non-destructive primary action, saved-project library, recent installs and history. Scroll results independently of the garment viewport. The current concept shows this layout as a mock native app next to a 3D front and a 2D pattern.

**Entry points:** EXO tool rail, the asset browser, Fabric Property Editor Browse Material, workspace command palette, an asset drag/import context action, Studio tab and optional File > Import. These are **future integration targets**, not already wired native controls.

**Selection:** clicking a search item does **not** mutate the current project. The inspector can show asset description, authors, license, exact files and compatibility. Preview button shows a transient ghost/swatches/studio scene. Cancel/Esc clears it without a garment revision. Only after validated permission, conversion and user confirmation does Import mutate a reversible project transaction.

**Type-specific imports:**
- Native EXO or compatible 2D pattern: add pieces in new layer or create new project with explicit mm/cm conversion, seam graph and expectedRevision guard.
- OBJ/GLB garment: import as display/reference mesh only unless a tested conversion restores source patterns.
- PBR material: set visual maps, UV pitch and side; do not change physical coefficients by default.
- Measured physical fabric: store source data and independently mapped native/PPF coefficients with uncertainty flags.
- Trim: import stable BOM/geometry IDs and size/quantity metadata.
- Blender studio: add to private scene library with shader/light conversion warning; never assume lossless .blend→GLB or execute arbitrary uploaded scripts.
- Paid item: show entitlement and licensed files; no simulated checkout is a real import.
- View-only item: inspect only; disable import with explicit cause.
- Unsupported file: offer read-only reference or abort, not a silently malformed object.

**Example task:** User selects hoodie front panel > Browse Fabrics > search French terry > choose 460 GSM visual preset, see estimated physical status > Preview under neutral light > confirm optical material map without changing elasticity > Undo in EXO. Another path: search a free DXF trouser block, verify sizing and attribution, preview piece layout, add to a new garment document, then Undo.

**Connection boundary:** new AssetSearchService, Rights/EntitlementService, AssetPreviewAdapter and AssetImportCoordinator; private local cache; typed source revisions. A public website request may never directly invoke native cloth solver or arbitrary local commands. Browser session/auth state remains separate from actual garment project state. Exiting Pattern Lab should not change selected tool, simulation, camera or pending garment edit.

**Offline behavior:** user-authorized local library remains usable, remote search visibly unavailable, cached owned assets marked by last known version, no price/purchase promises while disconnected.

## 5. States, permissions and content integrity

| Scenario | Website response | Pattern Lab response |
| --- | --- | --- |
| Loading | Stable card skeletons with aspect ratio preserved | Compact placeholder rows, no app freeze |
| Zero results | Show applied filters, reset and suggestions | Clear category/query reset |
| Anonymous user | Public sanitized previews only | Preview only, ask to connect for private assets |
| Creator view-only | Showcase and explicit restriction | No Import button entitlement |
| Free licensed pattern | Exact permitted files/size/source labels | Source validation before import |
| Paid, not entitled | Transparent license and verified checkout | License preview; website payment flow |
| Entitled | Receipt and immutable version download | Versioned import, copy/backup/Undo |
| Unsupported model | Still images/technical flat fallback | Compatibility warning and reference option |
| Source revision changed | Version changelog and diff | Offer pin/upgrade; never silent overwrite |
| Camera/WebGL unavailable | Static viewer | Same CAD workspace unaffected |
| Malicious/corrupt source | Hold in quarantine | Reject with actionable diagnostic |
| Factory-private spec | Server denies public view | Only exact role-approved release allowed |

Never rely on frontend buttons to enforce security. Hide source bytes through server-authorized storage separation and sanitation of GLB metadata, preview manifests and cache. Owner-controlled privacy should be tested by logging in as another creator, anonymous guest, buyer and unrelated factory. A 3D visual showcase is not perfect DRM; the enforceable promise is that private design/source files are not transmitted.

## 6. Performance and accessibility acceptance

Quality metrics should be measured, not claimed:
- Read/write: a viewer finds a free graded DXF pattern, knows the format/license/size before action, and locates original author.
- Search: multi-select filters, clear individual chips and URL state, back restores category and scroll.
- Import: cancel and failed conversion leave saved garment hash unchanged; one successful import corresponds to one Undo step; no 100×/1000× scale errors.
- Licenses: view-only is nonimportable; paid requires server verified entitlement; remix rights are independent of payment.
- Access: public buyer cannot retrieve private POM, materials cost, factory threads or hidden edge coordinates.
- Pattern Lab: open/close/search 100 times during native 2D/3D editing without leaving a Hand constraint, changing garment mode or blocking app UI.
- Mobile: 390px, 768px, 1024px, 1440px screenshots show no clipped critical controls; keyboard and touch workflows complete.
- Accessibility: WCAG 2.2 AA audit, focus states and return focus after modal close, 200% zoom, readable contrast, non-WebGL fallback and reduced-motion.
- Performance: catalog image lazy-loading, cancellable search requests, genuine skeleton states, optimized GLB and thumbnails; test actual target hardware/network before setting contractual p95 budgets.

## 7. Production development phases (future work only)

**U0 — UX review:** approve sitemap, site/app split, terminology, desktop/mobile screenshots and flows. Owner: product, apparel designer, UI designer. Gate: agreed mock user tasks.

**U1 — Shared design system and ACL model:** tokens, reusable components, actual sample data contracts, license schema and sanitizer. Owner: design system/backend/security. Gate: components and negative privacy tests.

**U2 — Public discovery/read-only profiles:** search, facet chips, asset page/viewers, public creator pages, fallback images. Owner: frontend/backend. Gate: real designer/patternmaker product-find testing.

**U3 — Read-only native Pattern Lab:** dock/expand view mounted within EXO native shell, does not affect Rust state, works offline. Owner: EXO frontend/native. Gate: no selected-tool or simulation state loss.

**U4 — Validated reversible import:** free compatible source pattern first, then optical PBR, visual GLB, trim and studio; ensure Undo and exact file receipts. Owner: CAD/asset conversion/security. Gate: source stability and dimension tests.

**U5 — Publishing private/public:** account, upload quarantine, preview generation and explicit rights; then profiles/follows. Owner: platform/security. Gate: anonymous cannot fetch protected source.

**U6 — Teams/manufacturer review:** anchored comments, versioned Tech Packs, immutable factory releases and notifications. Owner: product/back-end/apparel technologist. Gate: cross-factory isolation and release diff QA.

**U7 — Marketplace/immersive rooms:** free pool, remix lineages and later seller onboarding/paid entitlements, walkable rooms and CDN optimization. Owner: product/commerce/graphics. Gate: legal, performance, rights and refund validation.

## 8. What is already prototyped, and what is not

**Working isolated prototype:** a designed homepage, eight fictitious catalog asset cards across four categories, clickable categories and filters, applied chips, keyword search, sort, detailed asset modal with tabs, saved collections in memory, profile and team concept pages, an in-app dark Pattern Lab screen with category search, rights-checked mock import and preview, desktop/mobile responsive rendering, keyboard shortcut, and screenshots captured using Chrome/Playwright.

**Not implemented:** production 3D garment/scene rendering, actual editable 2D patterns, authentication, upload/download, real licensing/entitlements, commerce, actual garment imports, stable local sync, manufacturers, collaborative Tech Packs, live sensor/camera interaction, contact solver services, public deployment or native app integration. Concept SVG is illustration, not a renderer.

**Known remaining visual tasks:** expand separate full profile and publishing screens beyond concept pages; increase dark cloth/viewer contrast; polish the mobile navigation and filter sheet; add side-by-side pattern/material/3D viewer with real permitted sample assets; formal contrast accessibility audit and benchmark studies against relevant live systems.

## 9. Verified research references

- CLO-SET CONNECT: https://connect.clo-set.com/store
- Sketchfab 3D profiles/viewers: https://sketchfab.com/plans
- Adobe Substance 3D Assets: https://substance3d.adobe.com/assets
- BlenderKit: https://www.blenderkit.com/
- Baymard product listings: https://baymard.com/research/ecommerce-product-lists
- Baymard applied filters: https://baymard.com/research-articles/how-to-design-applied-filters
- Accessibility WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Existing EXO asset browser: [ClothCraft workspace JSX](../src/components/ClothCraftWorkspace.jsx)
- Existing integration notes: [EXO shell integration](../integrations/clothcraft/EXO_SHELL_UI_INTEGRATION_2026-10-16.md)

**Decision:** adopt a unified data model with purpose-built editorial website and in-app Pattern Lab. Focus on exact files, professional metadata, careful rights, nondestructive preview, reversible import and design quality. All work remains concept-only until separately authorized.
