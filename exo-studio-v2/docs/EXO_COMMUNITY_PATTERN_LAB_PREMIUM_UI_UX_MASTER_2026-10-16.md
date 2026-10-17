# EXO Community + In-App Pattern Lab
## Premium product design system, IA, UX specification, and build plan
**Research revision:** 2026-10-16 | **Scope:** design-only prototype and specifications | **Status:** not integrated or deployed

**Prototype:** ../concepts/exo-community-ui/index.html (isolated HTML/CSS/JS)
**Prototype QA:** ../concepts/exo-community-ui/qa-ui.mjs (independent localhost browser checks, no EXO services)
**Round-two design evidence:** [Asset pages, publishing permissions, Pattern Lab, Tech Pack role views, and ten QA screenshots](EXO_COMMUNITY_UI_ROUND2_SCREEN_EVIDENCE_AND_BUILD_PLAN_2026-10-16.md).
**Previous foundation:** [Community/marketplace](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [Master ecosystem](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md), [Web Tech Pack](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md), [101-task candidate backlog](EXO_ECOSYSTEM_CANDIDATE_ENGINEERING_BACKLOG_2026-10-16.md).

## 1. The product-design thesis

**Benchmark target:** visually more intentional, operationally faster, and more transparent about garment provenance and usage rights than a generic 3D asset marketplace. No measured superiority over CLO-SET, Sketchfab, Adobe Substance or Blendkit is claimed; that requires comparative usability testing.

EXO Community has an **editorial identity** with a serious searchable asset engine behind it. The homepage needs to feel like a curated contemporary design publication. Asset pages need technical precision and unambiguous rights; no fashionable UI treatment may obscure size, file type, author, whether a pattern was physically validated, or the difference between a video showcase and editable manufacturing source. Community profiles emphasize a designer's work, not social engagement counters. Tech Pack collaboration looks like enterprise production software, not a social feed.

Pattern Lab in EXO Studio is **production-workflow UI**. It should not reproduce the public website, its giant hero, checkout funnel, social feed or many secondary navigation choices. It should be a high-contrast dark utility drawer or dock, with compact search, license/format/size filtering, fast preview, eligibility, and an explicit 'Add to project' operation with revision/undo and non-destructive import validation. The current ClothCraftWorkspace Library tab holds basic starting blocks, not a community search; Pattern Lab is a new feature requiring separate backend/storage and native integration.

The right emotional balance is **quietly premium** rather than ornamental: typography, deliberate spacing, excellent asset previews, evidence-backed specifications, a precise neutral palette, subtle microinteractions, and absolutely predictable task outcomes.

### Design principles
- **Asset first:** catalog thumbnails present genuine source-authorized content, not stock clothing imagery unrelated to the asset; thumbnail variants are visually consistent for comparison.
- **Rights first:** View Only, Free Download, Paid, Remix Permitted, Source Available, External Dependency and Verified/Estimated indicators must be visible before destructive or paid action.
- **Frictionless return to making:** finding assets from the CAD editor should not lose the selected panel, current simulation state, undo history, document, camera, or unsaved work.
- **Physical honesty:** 3D beauty render, measured textile, solver validation and production-ready patterns require different labels.
- **Secure by design:** sanitized public GLB cannot contain hidden editable pattern coordinates, POM, secret fields or paid source data.
- **Inclusive control:** keyboard search and focus, explicit accessible labels, tap-friendly targets, responsive layouts and motion controls.
- **No empty promises:** disabled features and long-running operations show why and how to resolve, never silently fail or produce a false 'Imported' toast.

## 2. Competitive UI research and useful patterns

| Reference | Observed public capability | What to emulate | EXO differentiation to validate |
| --- | --- | --- | --- |
| CLO-SET / CONNECT | Digital product workflows, 3D garments, marketplace creator items, tech pack and annotations | Domain-specific metadata and linked 3D content | First-class editable patterns, licensed remixes, physics evidence, precise native app handoff |
| Sketchfab | Model pages, orbitable 3D, annotations, backgrounds, privacy and embedding | Quality-focused viewer and confident preview controls | Apparel-specific sew lines, sizes, garment versions, physical/visual material provenance |
| Adobe Substance 3D Assets | Deep type/appearance/format filters, materials/scenes, in-app asset browsing | Unified cross-app search and applied filters | Import permissions and pattern/CAD semantics rather than generic model-only assets |
| Blendkit / Blender add-on | Search, preview, download and drag-to-scene workflows in authoring viewport | Workflow continuity and local download status | Explicit pattern size/units, compatibility and native revisioned import |
| Techpacker and CLO-SET Web Tech Pack | Construction/measurement notes, factory collaboration, revision sharing | Real manufacturing document context | Immutable manufacturer release, anchored native EXO geometry IDs, private vs public view separation |
| Baymard Institute applied-filter research | Applied filters visibly summarize active criteria, improving orientation | Removable chips, category-specific filters, clear reset | Rich physical textile/mfg metadata in addition to ordinary commerce price |
| WCAG 2.2 | Accessible controls, keyboard focus and target sizing | Minimum interactive hit targets and visible focus | Specialist 2D/3D controls remain operable without hand tracking or pointer precision |

Reference URLs: https://connect.clo-set.com/store ; https://sketchfab.com/plans ; https://substance3d.adobe.com/assets ; https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/interface/substance-3d-assets ; https://github.com/BlenderKit/Blendkit ; https://techpacker.io/ ; https://baymard.com/research-articles/how-to-design-applied-filters ; https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum ; https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance .

### Explicit quality comparisons, not vague 'better than'
Goal 1: find a specific denim pattern by silhouette, sizes, DXF, free/remix and source-validation status with no irrelevant search results.
Goal 2: inspect a 3D garment without believing that it includes source 2D patterns.
Goal 3: import an authorized pattern within a few focused steps without replacing an existing garment by accident.
Goal 4: see the maker, version and license before requesting a download.
Goal 5: open a colleague's revisioned Tech Pack, identify a changed cuff size and comment directly on the POM.
Goal 6: publish a portfolio-only garment while independently denying strangers access to manufacturing measurements.
Each goal needs task-time, completion, error-rate and subjective-design testing with actual patternmakers and creators. Branding alone cannot establish superiority.

## 3. Information architecture: website

**Primary navigation**: Discover / Patterns / Materials / Garments / Studios / Creators. Additional contextual destinations: Community Collections, Showrooms, Teams, Web Tech Packs, My Library, Upload, Saved, Notifications, Store, Account Settings and Help. Most visitors see 5–6 primary links, not fifteen; advanced menus group secondary categories.

**Homepage**: a tasteful editorial campaign/featured original garment, single confident search CTA, major library disciplines, curated collections, creator spotlights, recently shared free files, studio environments, education/verified production resources, footers and clear license explainer.

**Explore/search**: query field, type chips, left desktop filter column, removable applied chips, result count, grid density control, sorting and content-quality badges. Filters vary by asset type: Patterns need sizes, fit, grading, CAD format, seam allowances, garment category; Fabrics need visual/physical type, GSM range, construction, scan/procedural, shader compatibility; Studios need Blender master/runtime support, scene scale, camera/light count and platform performance; Garments need editability, file types, rig/avatar compatibility, real fabric accuracy. Search suggestions can blend categories and creator handles, but the results must preserve scope.

**Asset detail**: hero viewer or technical flat; title/creator/verified-origin; price and license; size variant, download format, native app version support, mechanical vs visual material status and source-draft provenance. Tabs Overview, Specifications, Files, License, Updates, Dependencies, Reviews/Q&A and Remixes. Related assets and author collections must not distract from the action in the primary detail fold.

**Creator profile**: visual cover + curated headline works, Studio/Patterns/Materials/Scenes tabs, public 3D fashion room, maker description, own collections, remixes and influences (where permitted), shop and follow. Public view clearly separates social portfolio from files available for purchase or remix.

**My Library**: Owned uploads, downloaded/free grants, paid licenses, saved bookmarks, collections, team-shared and local links, each with source/version badge, latest available update, offline cached status and app compatibility.

**Teams/Tech Packs**: calm dense productivity screens; project list, sample milestone, garment spec navigation, image/3D/2D workspace, POM/BOM grid, contextual pinned comments, comparison view, release/version audit, manufacturer account scopes. Avoid hiding role permissions behind stylistic tabs.

**Publishing**: explicit wizard: Source / Derivative & Preview / Metadata / Rights / Files & Size / Review / Publish. The system explains exactly which asset binaries become public, remain private, and are downloadable. For a paid asset, payouts/terms/rights checks are separate from pressing Publish.

## 4. UI routes and URL contract (proposed)

Public routes: /, /explore, /patterns, /materials, /garments, /studios, /creators, /@handle, /@handle/collections/:slug, /asset/:slug, /asset/:slug/remixes, /rooms/:slug, /license/:id.

Authenticated: /me/library, /me/projects, /me/saved, /me/uploads/new, /me/orders, /me/settings, /teams/:org/projects/:project, /teams/:org/techpacks/:id/releases/:revision.

State should be URL-backed for web search and asset details: q, type, sort, price, size, format, license, author, verified, cursor (not 100 hidden query fields). Encode/filter robustly; do not leak confidential search terms into public URLs from private team views. Support browser back/forward, shareable public asset and collection views, and stable canonical public detail URLs.

**Responsive behavior**: wide desktop >1200: 12-column catalog grid and fixed 240 px filter column; 768–1200: collapsible filters and 3-column results; phone: sticky search/Filters/Sort and two-column thumbnails, with price/license immediately legible. Web Tech Packs should give a high-utility one-column read-only/approval mobile view and preserve desktop dual 2D+3D composition for deep edits.

## 5. Visual language and design tokens

### Premium light editorial website
- Surface: parchment #F4F2EC, muted warm gray #EEECE5, ink #242823, divider #D8D6CF, caption #73756D, architectural olive #555B51, soft gold/sand #B8A27C.
- Typography: large expressive high-contrast editorial serif for hero/collection headings (prototype uses Playfair Display with Georgia fallback); serious neutral sans for function (DM Sans fallback); DM Mono for provenance, revision IDs, labels, units, file and status data. No giant calligraphy inside measurement tables.
- Type hierarchy: heroic 64–112 px title depending on viewport, section 36–58 px, asset title 12–15 px, readable 14–16 px editorial paragraph for final production, compact 11–13 px metadata, 10–11 px monospaced labels.
- Spacing grid: 4 px base with 8/12/16/24/32/48/64/80; card gutters ~14–20 desktop; content max width ~1560; display margin ~4–5vw; details 44–60 px padding.
- Component language: mostly squared corners, fine hairline borders, discreet hover transforms on images only, clear active underlines, measured shadows. Decorative effects must never obscure actual technical data.
- Imagery: original garments rendered in standardized product-photo conditions, alternate close-up, flat, model, on-avatar and technical pattern preview. Cohesive backgrounds categorized by editorial, lab, or original studio; consistent scales make cards browsable.
- Motion: 120–240 ms transitions for hover/cards, ~300 ms modal entrance; no unrequested parallax; optional reduced-motion mode and inert animation when battery/performance limited.

### Dark Pattern Lab embedded in EXO Studio
- Shell: charcoal #202326, panel #252A2C, hover #39423E, border #4D5750, text #DEE0DC, secondary #A1A9A2, selected warm gray #D4D0C4.
- Native UI labels and functional controls should visually match the actual application's general hierarchy, not forcibly overwrite every already-published EXO theme.
- Desktop dock width 360–420 px; 280–350 in narrower windows; allow floating/detached view by later preference. Pattern Lab closes/reopens without resetting search filter or selected app garment.
- Search field immediately visible; one row of category chips; compact result list with 64–80 px preview, title/creator/format/license; contextual inspector pinned at bottom; import action protected by compatibility and rights checks.
- Dark interface is not 'premium' merely because it is black; it needs excellent contrast, cursor/focus affordances, low UI noise and a stable workspace.

### Status representation
Status is always **text plus icon/color**, never color-only. Examples: View only, Free pattern, Paid license, Authorized, Compatibility warning, Missing textures, Pattern source included, Visual mesh only, Measured GSM, Estimated physics, Contact simulation rejected, Need download, Offline cache, Importing, Imported to project.

Do not give the same badge to 'well-rendered' and 'measured physically'. A washed denim PBR texture is not proof of true denim stretch or shrink.

## 6. Component inventory and state variations

**Global search / command palette:** suggestions, categories, recent queries stored only with consent, keyboard up/down/enter, clear, working/unavailable/empty states; Ctrl/Cmd+K. Inside app search should bias local compatible assets and show “From my library” vs “Community”.

**Asset card:** aspect-ratio consistent preview, title and creator, category, price, supported format, license/remix and source verification. Hover offers quick preview/save, never auto-buy. Card focus has full equivalent action.

**Filter panel:** type, free/paid/view-only, format, size, category-specific properties, measured/estimated flag, studio source, compatible version. Show result count and chips with one-click individual clear; avoid silently discarding query when changing a category unless the user wants reset.

**Modal/asset detail:** keyboard focus trap, Escape/backdrop close, ARIA label, no loss of scroll state, imagery fallback for assets with no 3D mesh, clear side tabs, license CTA. Release-ready detail would be a full route; demo uses modal for speed.

**Preview viewer:** orbit/pan/zoom plus front/back/left/right resets, HDRI light presets, material channels, technical flat and seam overlays where authorized. Download source never depends on the browser's ability to inspect unsanitized source data. Progressive quality: poster → low LOD → full view, with WebGL failure fallback.

**In-app import guard:** asset selection → compatibility report → draft preview → choose import destination and options → explain undo/impact → confirm download if free/licensed → quarantine/dependency check → native garment transaction → undoable commit → success record. For garment assets, “place mannequin” is different from “replace source pattern”; for material, “apply to selected panel” vs “create library asset” must be explicit. Studios/avatars are scene resources and not sewing geometry.

**Collections:** Save, organize, un-save, move between private/public collections, collection source rights, remixes, update notifications, offline cache for app.

**Creator pages:** multi-asset showcase, collections, bio, follow, authored source rights, sorted newest/curated, no implied source license from public viewing.

**Team review:** field-level comments, pinned 2D/3D anchors, assignments, sample photos, editable Draft vs immutable Approved Release; manufacturer scope clearly displayed, not inferred from selected UI tab.

**Purchase:** price/currency/asset version, free preview, personal/commercial license, creator attribution and refund disclosures before checkout. Denied entitlement and cancelled payment are normal states; avoid accidental downloads.

**Upload:** guided metadata and license selection, visual-public preview vs downloadable source package, file scan/conversion progress, format/size checks, external dependency warnings, legal attestation, rollback/withdraw status.

### Complete states to design before implementation
Idle, loading skeleton, partial loaded, no results, no connection, offline cached, guest not signed in, licensing required, not compatible, file validation rejected, render unsupported, permission revoked, stale version, import conflict, payment pending, checkout failed, download in progress, external texture missing, project dirty, physical status estimated, team invite expired, comments orphaned after geometry revision, optimistic action reverted. Each requires explicit user-facing content and safe recovery.

## 7. In-app Pattern Lab navigation and precise integration

### Existing EXO surface constraints
The workspace currently contains an asset browser at the left with Pieces, Seams, Library and History. The Library includes starting fixtures (tee/dress) and shape tools; it is **not** an online marketplace. Preserve these authoring controls. Pattern Lab should be a new view within the existing tab or a new tab accessible from the asset browser and workspace command palette. It can appear as a docked right/left panel, narrow sheet or resizable floating window, depending on actual UI architecture and viewport state. Do **not** remove CLO-like editor toolbars, replace the Rust VBD Hand, change panel selection or reinterpret keyboard shortcuts during integration.

### Suggested real integration boundary
New client modules would include a PatternLabPanel component, SearchFilters module, AssetInspector, LicenseBadge, ImportPreparationDialog, AssetPreview3D, AssetPreview2D, and app adapter. A separate shared client for Community API handles typed search, signed entitlements and asset metadata. Native app bridge should accept **typed, allowlisted, revision-guarded import operations**; it must not expose a general file path download or executable script call. The editor should receive a validated local asset package and choose an operation based on asset type. New garment source with authorized editable patterns is not interchangeable with a GLB scene derivative.

Proposed capabilities: search, asset.detail, preview, save, download authorized, importPattern, applyFabricPhysical, applyFabricVisual, importStudioScene, importAvatar, addTrim, and importStatus. Begin with read-only search/preview; add one import type at a time under isolated fixtures and manual review.

**Native source of truth:** EXO authored garment revision remains unchanged until a successful confirmed transaction. Import must record assetId/version/hash, license grant, selected variant/size/units, target document/panel, dependency IDs and resulting undo entry. If import fails, selected fabric, garment geometry and scene camera should remain exactly as before.

**Hand tool interaction:** while panel preview/selection is active, no imported external garment geometry should accidentally become the Hand target; simulation should not lose its active state due to a slow remote download. Resolve native mode/selection at commit, not from stale initial search.

### Recommended in-app user journeys
- **Pattern:** select Pattern Lab > Search “straight-leg” > filter DXF + Free + 28–38 sizes > view pattern thumbnail and source scale > preview as non-destructive overlay in 2D > choose “Import as new pattern pieces” > verify seams/size and units > explicit transaction > Undo available.
- **Material:** selected hoodie front panel > search “French terry 460” > compare measured vs estimated mechanical data and visual PBR > choose visual only or physical profile if truly mapped and compatible > preview under neutral light > apply only to selected panel > Undo.
- **Studio:** browse original Concrete Atelier > inspect licensing/light rig dependencies > preview temporarily > add to Studio Library > place Look in studio; existing garment remains intact.
- **View-only:** inspect a creator's padded jacket in a 3D viewer; no download/import control available if only the sanitized display derivative is licensed. Provide Save to collection or Contact creator option.
- **Paid:** see paid price and exact right before leaving native editor for secure checkout; after confirmed entitlements recheck package hash and legal license at actual import time. No silent charges.
- **Offline:** show saved/local assets and local source projects; remote results clearly marked unavailable, with no undo/view state destroyed.

### Proposed API payload fragments
Search request filters: type, category, q, sort, price, remixPermission, fileFormats, sizes, measuredOnly, softwareCompatibility, limit and cursor. Response: assetId, assetVersion, previewSafeUrl, title, author, asset type, display-only/available downloads, price currency, license ID, rights, verification status, format and compatibility. No private sourceStorageKey in public response.

Import preparation request: assetId, version, authenticated entitlement, target project revision, chosen size/grain/units, mode, local capability data. Response: verified package hash, warning list, units mapping, estimated resources, predicted non-destructive operation, required confirmation. Commit requires a fresh revision, user action and save/history support. Background progress/abort and retry must be visible.

Example security guarantee: backend may provide public sanitized GLB but must not provide an editable underlying pattern automatically; the native bridge must never accept a remote URL as arbitrary executable source code.

## 8. Layout details and presentation quality standards

**Desktop website (1440 CSS px reference):** 26 px research banner for prototype only, 75 px header, ~550–620 px two-column editorial hero, high contrast dark category navigation strip, full-width discovery section, filter width ~214–240 px, 4-up catalog at desktop, large original garment asset cards, appropriate air around headlines. Detail dialog visually divides a 3D preview/art and the technical rights/spec panel. Production asset detail should be navigable by URL and not only modal.

**Desktop application (1440 CSS px reference):** 63 px app titlebar and existing tool rail; 2D and 3D split remains visible under the dock, Pattern Lab ~377 px with search and list; bottom mini-inspector for license/preview/import states; command focus moves into lab without modifying current Rust simulator. Prototype only simulates this state.

**Narrow desktop/tablet:** primary header navigation collapses as needed, 3-up results, filter drawer with applied chips. In-app drawer may overlay the 2D workspace rather than compress the 3D canvas below useful width.

**Mobile web (~390 CSS px):** stacked hero, swipe-free browse nav that remains keyboard accessible, two-column card grid, obvious Filter button, modal becomes vertically scrollable, no enormous desktop tech pack tables forced into one viewport. Public social and shopping flows should work on mobile; full local CAD editing is not assumed mobile-ready.

**Contrast/accessibility:** interactive control size should aim ≥40 px for major touch controls, exceeding WCAG 2.2 AA minimum 24 CSS px where applicable. Visible keyboard focus, text contrast ≥4.5:1 for normal type and ≥3:1 for large text/UI icons, semantic headings, decorative SVG labeled or hidden appropriately, ARIA live results count, reduced motion, keyboard modal trapping, appropriate focus restoration and 200–400% text zoom without clipping. These are QA requirements; visual prototype requires formal accessibility audit and is not claimed certified.

**Production performance targets (provisional):** search text response initial visual skeleton under 150 ms on cached queries, network-backed results under ~800 ms p75 with pagination, preview poster first meaningful paint quickly, initial 3D preview loaded progressively, facet toggles reflected immediately, gallery scroll stable at 50+ items, lazy-loading thumbnails, KTX2/LOD for rooms. Define metrics by device and tested latency, not marketing.
 
## 9. Prototype coverage and honest limitations

Implemented in the isolated concept HTML: editorial homepage with original SVG demonstration garments/materials/studios, category-specific discovery, query search, checkbox licensing/type/file-format filters, removable active filter chips, sort and grid density toggles, asset detail modal, tabbed specs/license, demo saved collection, and simulated EXO Pattern Lab dock with search, categories, free-first, preview overlay and demo library addition. **The creator profile screen** now has cover art, public featured work, patterns/materials tabs and privacy messaging. **The Teams screen** opens a detailed illustrative Web Tech Pack with Designer/Manufacturer view switching, R01/R02 measurement comparison, 2D/3D/Reference presentation tabs, mock review threads and demo comment interaction. These are local UI states, not production records or real role policy.

**Not implemented in prototype:** real 3D WebGL model loading, true dynamic Pattern Lab integration into EXO, authentication, shopping, source download, paid checkout, uploading, social activity, manufacturer team web app/backend, actual Tech Pack release, native import transactions, permissions backend, asynchronous asset conversion or network/CDN. All inventory is invented sample design data; imagery is custom original SVG conceptual illustration. Any “Preview” overlay is just UI, never an import into Rust cloth, and the prototype states this.

This distinction is mandatory before stakeholders approve implementation. An excellent demo cannot be called a live marketplace.

## 10. Design-to-build phased roadmap and acceptance

### UX0 — Research acceptance and IA signoff
Review information architecture with 2–3 pattern designers, one apparel production specialist and 1–2 experienced 3D creators; record top tasks and sources of confusion. Establish success benchmarks and brand rights. **Gate:** agree exactly what “showcase,” “open pattern,” “free,” “remix,” and “approved manufacturing source” mean.

### UX1 — Production design system foundation
Replace prototype-only CSS with reusable typed design tokens, semantic components, icon mapping, full focus/contrast audit, 1440/1024/768/390 layouts, loading/error/empty states and asset content guidelines. **Gate:** all screen templates pass visual QA and keyboard tests.

### UX2 — Authenticated creator profile + catalog search
Implement backend permission-safe public previews, creator pages, source version rights and secure search filters with URL state. **Gate:** no private project/source leaks under cross-account requests; query state sharable where allowed.

### UX3 — Full asset detail + visual viewers
Build read-only 2D technical viewer and sanitized 3D GLB viewer with camera controls, annotations where permitted, formats, sizes, license and provenance; dependency packaging warning. **Gate:** visual-only listings cannot download source; no false physical measurement claims.

### UX4 — In-app Pattern Lab read-only
Integrate dock without changing existing panels/modes; sign-in state, asset search, preview, download availability and local library state. **Gate:** after opening/closing Pattern Lab, the currently edited garment, selected panel, Rust simulation and undo stack remain unchanged.

### UX5 — First authorized import path
Implement ONE safe import type first (e.g., visual material texture with exact rights or basic dimension-validated 2D pattern under target fixture). Preview → prepare → native revision guard → undoable commit. **Gate:** wrong formats, license, units, materials, stale revisions and cancellation never alter current garment.

### UX6 — Community social / teams / Tech Pack
Design and ship owner-controlled collections, follower controls and comment threads after rights; then private team role scopes and read-only versioned Web Tech Packs. **Gate:** reviewer/Manufacturer A cannot access secret patterns or Manufacturer B pricing.

### UX7 — Paid store, uploader and rich studio libraries
Only after seller verification, entitlement checks, upload scanning, payout/tax and licensing review. Optimize Blender studio formats, gallery rooms and creator portfolio media. **Gate:** no purchase rights from client-side price changes; no unauthorized binary source access; tested mobile/keyboard purchasing paths.

### Prototype measurable QA tasks
- Full archive has 8 example assets; Patterns category has exactly 2; searching “terry” returns expected item.
- Filtering Free yields 3 examples, with removable applied filter chip and correct result count; clearing restores 8.
- Asset detail Specs shows the correct textile/format; License tab explicitly explains demonstration/non-transfer.
- A View Only asset cannot be imported from Pattern Lab; free demo can be added ONLY to fake local library and does not modify EXO source.
- Lab opens/closes, search filters results and price sorting, dark studio workspace remains visible. Mobile web includes working filter drawer.
- Teams → Interactive Tech Pack opens the designer/manufacturer sample, changing R02 to R01 updates illustrative cuff measurement and revision status, and a demo note stays explicitly local.
- Creator avatar → Profile shows source-protected public portfolio; switching Work/Patterns/Materials gives the correct illustrative asset set.
- No JS page errors, runtime fetches, authenticated claims or downloads in the prototype.

## 11. Candidate UI work package IDs

UI-001 Brand/art direction, typography, accessible token system and reference photography.
UI-002 Responsive navigation, homepage and category landing.
UI-003 Unified asset card grid, advanced filters, removable applied chips and saved searches.
UI-004 2D/3D garment detail, technical metrics, rights and optional controlled downloads.
UI-005 Creator profile, project gallery, collections, follow and privacy.
UI-006 Asset upload/publish rights flow with preflight/redacted derivative preview.
UI-007 Creator's private brain library, draft vs published status and purchased licenses.
UI-008 In-app Pattern Lab dock integration, resize, search and discover tabs, keyboard shortcuts.
UI-009 Pattern Lab asset inspector, download/compatibility/provenance and preview.
UI-010 Type-safe reversible native import command flow, with revision/undo/security controls.
UI-011 Free/remix/paid entitlements and creator dependency/license graph.
UI-012 Interactive Tech Pack designer, manufacturer, comments and immutable factory version views.
UI-013 Blender lighting studio/wardrobe rooms and progressive WebGL optimization.
UI-014 Mobile/accessibility localization, dark mode, skeleton/error/recovery states.
UI-015 Formal comparative benchmark study with target users and measured completion/error times.

These 15 design work packages supplement, rather than replace, the existing 101 proposed engineering tasks; nothing is filed, assigned or approved to implement in the application from this research.

**Recommended first iteration:** UI-001 → UI-003 and UI-008 in parallel, shared with API rights schema; the strongest experience comes from good search and immediate work integration, not a larger homepage hero.
