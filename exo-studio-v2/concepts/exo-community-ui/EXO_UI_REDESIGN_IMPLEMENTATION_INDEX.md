# EXO Community - black UI redesign: implementation index

**Status:** proposed redesign, not an implemented release.
**Date:** October 16, 2026.
**Companion deliverables:** *EXO Community UI Redesign - 20 Page Masterplan* PDF and complete editable Markdown provided in the ChatGPT conversation. This in-repository document translates the 20 chapters into a build-order checklist.

## Design goal

An unmistakably EXO design language: #050505 canvas, white typography, precise spacing, real photographic work, one unified marketplace, a clean For You feed, and purposeful optional motion. Borrow CLO-SET CONNECT's **information architecture**, not its proprietary assets or specific visual code. Translate Apple's principles of simplicity, progressive disclosure and accessibility into EXO's own identity. “100x” means an ambitious uplift in coherence, speed and perceived craft - it is not a measured result.

## Existing verified baseline

- `index.html`, `app.js`: routes, catalog, editing/viewer interactions and separate project navigation.
- `project-home.js`, `project-infinite-hero.css`, `home-v5.css`: CSS-3D photo wheel, eight curated image tiles and black homepage.
- `fabric-index.json`, `fabric-store.js`: 400 source-derived EXO fabric presets, filters, saved items and detailed inspector. Values are largely **estimated**, not scanned/verified physical material measurements.
- `community-social.js`, `designer-profiles.js`: browser-local For You, Following, Grid, saved works, Forum and demo portfolios. There is **no multi-user social backend**.
- `ar-experience.js`: camera-consent manual overlay studio and table-pattern preview. There is **no true body tracking, ARKit plane detection or projector output**.
- `qa-community-v4.mjs`: historical 39/39 browser suite from previous iteration. Re-run after each redesign stage; past success is not future verification.

## CONNECT comparison (public observations)

The public CONNECT homepage shows Curator's Pick, Community Highlight, Popular Community Posts and the Store categories Garment, Fabric, Trim, Avatar and Scene. Store paths expose search, featured sorting and context-dependent facets. CONNECT's public Fabric page lists Fabric Type, Composition, Usage Type, Season, Color, Pattern, Physical Property, Supplier, Official and Price. The public Garment page lists Curator's Pick, Following, Fbx/Gltf, Gender & Age, Style, Genre & Mood, Software, Official and Price. CONNECT has creator discovery, portfolio pages and a topical community. Details behind sign-in and actual purchase/licensing were **not verified**.

Sources:

- https://connect.clo-set.com/
- https://connect.clo-set.com/store
- https://connect.clo-set.com/store/fabric
- https://connect.clo-set.com/store/garment
- https://connect.clo-set.com/creator
- https://connect.clo-set.com/community
- https://developer.apple.com/design/human-interface-guidelines/

## The 20-chapter build sequence

| Chapter | Focus | Implementation ticket and acceptance |
|---|---|---|
| 01 | Product intent | Approve black, photo-first design charter; no extra decoration, fake sales or fake AR claims. |
| 02 | Baseline audit | Capture current 390/834/1280/1440 screenshots; inventory DOM/URLs/media and console errors before edits. |
| 03 | CONNECT benchmark | Map category/facet/navigation patterns as public evidence; never copy licensed media or source. |
| 04 | Information architecture | Consolidate six navigation purposes: Home, Marketplace, For You, Forum, AR Studio, Profile; route state survives Back/Forward. |
| 05 | Black color tokens | Use #050505 canvas, #0E0E0E control surfaces, #181818 elevation, #F5F5F5 primary text, #303030 separators. |
| 06 | Typography + grid | System font stack, 12-column desktop grid, 44px touch targets, readable metadata >=11-12px, shared spacing scale. |
| 07 | Homepage hero | 3+ large real photo squares immediately below nav, no H1/gradient above them; infinite wrap + arrows + swipe + pause/reduced-motion. |
| 08 | Curator Picks | Eight unique real project photos, square and source-credited, click through to correct project/creator. |
| 09 | Marketplace | One shell for All/Garments/Fabrics/Trims/Avatars/Scenes/Patterns; compact header and URL-backed filters. |
| 10 | Fabric Store | Authentic textures, ten relevant CONNECT-inspired facets, truthful physical-data confidence, compare and exact inspector selection. |
| 11 | Product detail | Large 3D/2D/media stage, stable control locations, category-specific specs, rights/provenance and recoverable URL. |
| 12 | Search + filters | Global command search, contextual facets, 30+ progressive cards, result count, empty/error states and keyboard support. |
| 13 | For You feed | Large 4:5 media, clear creator, real source project, Like/Save/Comment/Share, Following + Grid, local-demo labeling. |
| 14 | Creators + Forum | Portfolio-first creator identity; topic-focused forum; verified/invented stats clearly distinguished. |
| 15 | AR Studio | Polish manual camera modes first; tracked body fit, calibrated planar projection and physical projector integration are future gated scopes. |
| 16 | Motion + GitHub skills | Reuse Mason Terra gallery and Jarvis motion design; transform/opacity animations, reduced-motion, 60fps target and no background grain. |
| 17 | Responsive + accessibility | 320/390/768/1024/1440/1920 layouts, keyboard/screen-reader support, contrast, 200% zoom and no horizontal overflow. |
| 18 | Component architecture | Consolidate layered styles into tokens/components/features; avoid stacking new global edition stylesheets. |
| 19 | Six-sprint roadmap | S0 audit, S1 foundations/home, S2 marketplace/fabrics, S3 social/profiles, S4 AR polish, S5 production QA. |
| 20 | Ship criteria | Performance, accuracy, accessibility, image provenance, comprehensive screenshots and documented unsupported features. |

## Exact local Jarvis / GitHub design reference inventory

- `/skills/motion-design/SKILL.md` and `/skills/motion-design/director/context-adaptation.md`: premium 350-600ms animation, purposeful easing, reduced-motion and 60fps guidance. (Virtual paths in the skill reader; do not pass `/skills` as a terminal shell path.)
- `/blender-mac-workspace/mason-terra-webgl/docs/SCROLL_SYSTEMS.md`
- `/blender-mac-workspace/mason-terra-webgl/src/gallery-variants.js` and `gallery-variants.css`: ribbon, orbit, stack, helix and loop variants.
- `/blender-mac-workspace/mason-terra-webgl/src/base.css`, `home.css`, `home.js`: restrained editorial grid, scale and scroll/transform approach.
- `/blender-mac-workspace/mason-terra-design-pass-20261002/DESIGN.md` and `REVIEW.md`: later accessibility refinements, minimum readable metadata, remove nested cards, limit WebGL DPR near 1.5, DOM fallback, focus restoration, viewport regression checks.
- Skill sources referenced in Mason Terra documentation: https://github.com/greensock/gsap-skills/tree/main/skills/gsap-scrolltrigger and `gsap-performance`; https://github.com/sickn33/agentic-awesome-skills/tree/main/skills/scroll-experience.

Do **not** directly reproduce Mason Terra's earlier 7-8px navigation labels, global custom cursor, grain overlays, heavy pinned sequences or gradient atmospherics; these conflict with the EXO direction.

## Recommended implementation PR breakdown

1. **P0-01 Audit:** `docs/screenshots/` and route snapshot baseline; attach tests/results.
2. **P0-02 Tokens:** `design/tokens.css`, typography, spacing, radius and icon standards.
3. **P0-03 Shell:** nav, route state, responsive bar, search, focus and error boundaries.
4. **P0-04 Media:** media manifest with source and rights, AVIF/WebP sizes, alt/focal point and fallback.
5. **P0-05 Home:** hero autoplay/pause, borderless black canvas, curator metadata and project deep-links.
6. **P0-06 Card primitives:** one asset/project card anatomy, loading skeleton and grid densities.
7. **P0-07 Marketplace:** record type schema, URL backed facets, 417-source-entry search and sorting.
8. **P0-08 Fabrics:** truthful confidence metadata, inspector, swatch media and responsive filters.
9. **P0-09 Viewer:** 3D/2D/photo modes, rights controls, failure fallbacks and GPU cleanup.
10. **P1-01 Social:** For You/Following/Grid, stable creator attribution, locally saved-state migration.
11. **P1-02 Profiles/Forum:** portfolio-first design, real-network boundary and stateful dialogs.
12. **P1-03 AR:** camera preview quality, calibration messaging, manual controls and explicit device-compatibility UX.
13. **P1-04 Code cleanup:** delete obsolete CSS only after every migrated flow passes visual/interaction tests.
14. **P1-05 Production QA:** axe, Playwright screenshot baselines, Lighthouse and device/zoom matrix.
15. **P2 future:** Auth/social backend, permissions/licensing, payments, body landmarks, camera plane calibration, projector pipeline.

## Core gate and measurements

- User can identify the hero as **real project photography** in under two seconds.
- 3+ large visible photos, plain black page, autoplay with pause/reduced-motion.
- Find one known garment and one known fabric in <=3 intentional actions, with correct metadata and detail inspector.
- LCP target <=2.5s, INP <=200ms, CLS <=0.1 on representative devices; measure instead of claiming.
- 0 broken image requests, dead controls, missing focus indicators, false license claims, or camera streams left running after AR exit.
- WCAG 2.2 AA target; automated checks supplemented by manual touch/keyboard/screen-reader inspection.
- Every migration PR includes before/after visual QA and a brief explanation of what improved.

## Suggested schedule / explicit dependencies

S0 days 1-3 audit -> S1 days 4-8 foundation and Home -> S2 days 9-14 marketplace/fabrics -> S3 days 15-19 creator/social -> S4 days 20-24 AR polish -> S5 days 25-30 accessibility, performance and launch review. **30 working days is a planning estimate assuming design and frontend engineering capacity; not a promise.**

**Important:** This is a specification/documentation change only. No application UI, authentic licensed marketplace assets, real social database, or production AR feature was modified to satisfy this planning request.
