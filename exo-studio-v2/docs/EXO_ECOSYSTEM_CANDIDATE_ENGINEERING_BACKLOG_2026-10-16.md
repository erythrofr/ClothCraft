# EXO Future Ecosystem — Detailed Candidate Engineering Backlog
**October 16, 2026 | Research-only issue definitions, NOT filed or authorized**

The spatial table/projection plan already holds **48 SP task cards** in [the spatial execution backlog](EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md). The [Interactive Web Tech Pack research](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md) separately specifies **14 TP tasks**. This document adds **39 PPH/MAT/STU/COM candidate cards**. Together these contain **101 distinct future task identifiers** across all plans, not 101 approved development tickets.

Read these before scheduling: [Ecosystem master implementation program](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md), [PPF/materials/room engineering](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md), [Community/marketplace research](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [Web Tech Pack plan](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md). 

**No-build boundary:** Candidate tasks are descriptions, not implementation requests. No remote GitHub issues, account connections, hardware purchases, code edits or garment mutations from this document.

## Priority principles

**First:** source versioning, physical units, permissions, sample licensing and negative QA fixtures. **Second:** local visual material/studio value and a source-safe community profile/free pattern prototype. **Then:** private team tech packs and immutable factory releases, followed by paid marketplace. **After independent proof:** optional cloud PPF compute, social creator rooms and royalty/AR features. These tracks can run in parallel after their data/security contracts are stable.

Use source hashes, measured/frozen reference garments, signed download receipts and source-safe test accounts as standard evidence. A nice render is not a physics certification, a public post is not a pattern license, and a manufacturer comment is not approval to modify a release.

## P — PPF collision, sewing, and material solver adapters

### PPH-001 — Freeze failing PPF benchmark fixtures
**Dependencies:** PPF fit audit. **Suggested owner:** Physics/QA. **Scope and acceptance:** Store original Thomas tee, upstream dress trajectories, input hashes, native output frames and rejection report. Done when each fixture's historical crossings and seam gaps are reproduced as documented without editing source assets.

### PPH-002 — Typed canonical cloth-to-PPF payload
**Dependencies:** PPH-001. **Suggested owner:** Native physics. **Scope and acceptance:** Track mm/m units, seam IDs, triangle winding, rest metric, stitch pair correspondence, material and body groups. Done when source/target mesh and stitch checks round-trip with 0 data loss in a controlled fixture.

### PPH-003 — Separated solver backends and immutable jobs
**Dependencies:** PPH-002. **Suggested owner:** Architecture. **Scope and acceptance:** Define native VBD interactive vs PPF offline jobs, idempotent config hash, cancel and quotas. Done when a failed PPF job cannot change a valid local VBD saved garment.

### PPH-004 — Garment preassembly and sewing initialization
**Dependencies:** PPH-002. **Suggested owner:** Garment/physics. **Scope and acceptance:** Build valid off-body/near-assembled staging that reduces seam target gaps without self intersections. Done when all planned seam groups satisfy a documented maximum separation before native run.

### PPH-005 — Avatar body policy A/B experiment
**Dependencies:** PPH-001, PPH-004. **Suggested owner:** Physics. **Scope and acceptance:** Compare STATIC to explicitly pinned-SHELL body with identical rest mesh/material/time, isolated output directories and same collision policy. Done only with independent body intersection audits, not visual frame samples.

### PPH-006 — Full-frame collision and swept validation
**Dependencies:** PPH-003. **Suggested owner:** Physics/QA. **Scope and acceptance:** Run triangle intersection, body clearance, strain and time-continuous collision checks over complete trajectory. Done when the historical native PPF fit is rejected at known failing frames.

### PPH-007 — PPF accepted/rejected report integration
**Dependencies:** PPH-006. **Suggested owner:** App/QA. **Scope and acceptance:** Expose accepted/rejected/failed/cancelled and detailed seam/contact metrics to asset library. Done when a rejected run is never labeled fitted/certified or published automatically.

### PPH-008 — Live cloth hand lifecycle and physical continuity
**Dependencies:** PPH-003. **Suggested owner:** Native solver. **Scope and acceptance:** Preserve responsive native VBD grab through start/move/release, camera loss and mode changes. Done when 100 injected cancellations leave zero held native springs.

### PPH-009 — Material parameter mapping and calibration
**Dependencies:** MAT-005, PPH-002. **Suggested owner:** Textile/physics. **Scope and acceptance:** Fit measured specimen curves separately to native VBD and PPF coefficient models. Done when identical physical tests are reproduced within a chosen tolerance for multiple textile samples.

### PPH-010 — Optional cost-controlled PPF job service
**Dependencies:** PPH-007, COM-010. **Suggested owner:** Backend/security. **Scope and acceptance:** Only accept explicitly approved, scanned, quota-limited jobs; support abort/log/charge policy. Done when no public upload can trigger unreviewed GPU compute.

## M — Measured fabrics, textures, and hardware

### MAT-001 — Unified canonical material manifest
**Dependencies:** Existing EXO fabric fields. **Suggested owner:** Textiles/architecture. **Scope and acceptance:** Separate mechanical specimen profile from visual PBR and render variants, with measured/estimated provenance. Done when nine native presets map without unit errors and retain explicit limitations.

### MAT-002 — Mass, thickness, conditioning specimen protocol
**Dependencies:** MAT-001. **Suggested owner:** Textile specialist. **Scope and acceptance:** Record sample size/conditioning, repeated GSM and thickness measurements, batch IDs and uncertainty. Done with raw lab-ready data and no unsupported universal fiber values.

### MAT-003 — Warp/weft/bias and shear measurements
**Dependencies:** MAT-002. **Suggested owner:** Textile specialist. **Scope and acceptance:** Capture load/extension curves in multiple directions, repeat holds/releases and data uncertainties. Done with independent repeatability/quality notes.

### MAT-004 — Bend, friction, compression and hysteresis tests
**Dependencies:** MAT-002. **Suggested owner:** Textile specialist. **Scope and acceptance:** Measure bending strips, paired sliding surfaces and loft/compression; identify unsupported effects. Done with raw measurements and model uncertainty.

### MAT-005 — Solver-independent physical specimen contract
**Dependencies:** MAT-003, MAT-004. **Suggested owner:** Physics/textile. **Scope and acceptance:** Define canonical SI curves and separate backend conversion modules. Done with unit tests proving no raw PPF Young's modulus is blindly copied into native VBD N/m field.

### MAT-006 — PBR textile source and texture rights schema
**Dependencies:** MAT-001. **Suggested owner:** Graphics/rights. **Scope and acceptance:** Store albedo, normal, roughness, anisotropy, sheen, repeat pitch, front/back, color space, photo provenance and licensing. Done with independent render/physics status badges.

### MAT-007 — Real-scale UV and grain orientation pipeline
**Dependencies:** MAT-006. **Suggested owner:** Graphics. **Scope and acceptance:** Check yarn/weave repeats in metric scale for twill denim, jersey, French terry, suede and leather. Done when panel transforms do not distort grain or modify physical rest constraints.

### MAT-008 — Neutral reference lighting and scan comparisons
**Dependencies:** MAT-006, STU-002. **Suggested owner:** Graphics/material. **Scope and acceptance:** Create standardized sphere/swatch/hanging strip under fixed neutral camera/light and separate channel debug. Done when source and runtime map results are compared at macro/micro scale.

### MAT-009 — Multi-layer fabric and trim R&D
**Dependencies:** MAT-005, MAT-007. **Suggested owner:** Research. **Scope and acceptance:** Study padded/trapunto layer, leather/suede friction, stiff hardware, zipper contact and bonded materials. Done with documented unsupported mechanics and explicit fallback previews.

### MAT-010 — Publishable material quality taxonomy
**Dependencies:** MAT-005, MAT-008. **Suggested owner:** Product/data. **Scope and acceptance:** Show measured vs estimated mechanical data, scanned vs procedural visual source, calibration, device and license. Done when no source confidence is hidden on a public material listing.

## S — Fashion photo studio and immersive walkable gallery

### STU-001 — StudioAsset and Look schema
**Dependencies:** COM-001, MAT-006. **Suggested owner:** Graphics/data. **Scope and acceptance:** Separate .blend original master, web GLB stage, camera/light environment and immutable Look assignment. Done when scenes/garments are referenced without source duplication.

### STU-002 — Three original Blender photo stage masters
**Dependencies:** STU-001. **Suggested owner:** Blender art. **Scope and acceptance:** Author White Infinity, Neutral Gray and Concrete/Black original geometry and camera/light rigs. Done when master .blend references and source licenses are recorded.

### STU-003 — Portable runtime stage conversion
**Dependencies:** STU-002. **Suggested owner:** Graphics. **Scope and acceptance:** Bake/convert compatible geometry and reconstruct Blender World/area lighting as runtime scene recipe. Done with calibrated render comparison and warnings for unsupported shader components.

### STU-004 — Look photography UI and render receipts
**Dependencies:** STU-003, MAT-008. **Suggested owner:** UI/graphics. **Scope and acceptance:** Camera angles, rig poses, lighting/exposure, front/back/detail stills and turntables with versioned output settings. Done when rendering never mutates garment or stage masters.

### STU-005 — Walkable private wardrobe lobby
**Dependencies:** STU-001, COM-003. **Suggested owner:** 3D interaction. **Scope and acceptance:** A navigation-safe room for ten private mannequin Looks, WASD/teleport, clickable garments and a 2D gallery fallback. Done when unauthorized garment bytes cannot appear in another profile.

### STU-006 — Multiple collection rooms and performance
**Dependencies:** STU-005. **Suggested owner:** Graphics/QA. **Scope and acceptance:** Material gallery, runways, scene portals, LOD, KTX2, lazy load, collider proxies, accessibility and device performance. Done with recorded FPS/memory and failure fallback.

### STU-007 — Public creator-room publication controls
**Dependencies:** STU-006, COM-007. **Suggested owner:** Platform/security. **Scope and acceptance:** Publicize only sanitized expressly licensed Looks/Studios. Done when public GLB and requests contain no private CAD/techpack data.

## C — Creator platform, marketplace, community, and teams

### COM-001 — Identity, organization and asset version schema
**Dependencies:** Source and rights inventory. **Suggested owner:** Backend. **Scope and acceptance:** Define users, profiles, teams, projects, assets, versions, licenses, grants, offers, receipts and event audit. Done with relational migration and read-only privacy QA fixtures.

### COM-002 — Upload ownership and quarantine pipeline
**Dependencies:** COM-001. **Suggested owner:** Security/backend. **Scope and acceptance:** User-approved source files enter non-executable quarantine with file magic, size, archive depth and path traversal checks. Done with malicious ZIP/.blend and bomb-asset rejection tests.

### COM-003 — Private asset brain/library
**Dependencies:** COM-001, COM-002. **Suggested owner:** App/data. **Scope and acceptance:** Organize drafts/garment Look/patterns/materials/studios under one owner without public exposure. Done when a different account cannot enumerate private paths or metadata.

### COM-004 — Sanitized 3D previews and public creator pages
**Dependencies:** COM-003. **Suggested owner:** Graphics/security. **Scope and acceptance:** Generate source-stripped GLB/thumbnails, creator profile sections and viewer. Done when public network inspection cannot recover undisclosed 2D patterns or factory specs.

### COM-005 — Public searchable free pattern pool
**Dependencies:** COM-004. **Suggested owner:** Search/rights. **Scope and acceptance:** Search by garment/size/format/license with permitted free downloads and receipts. Done when verified free downloadable assets are source-hashed and unauthorized source remains private.

### COM-006 — Open remix attribution and rights graph
**Dependencies:** COM-005. **Suggested owner:** Rights/backend. **Scope and acceptance:** Immutable origin/version lineage, allowed derivatives and dependency license compatibility checks. Done when forbidden resale/remix is rejected and attribution survives fork.

### COM-007 — Creator feed, follows and collections
**Dependencies:** COM-004. **Suggested owner:** UI/backend. **Scope and acceptance:** Profile follow, bookmarks, feed sorting, public Looks, studio room links, mute/block/report and privacy controls. Done with identity/visibility/revocation tests.

### COM-008 — Team roles and private collaboration
**Dependencies:** COM-003. **Suggested owner:** Security/team. **Scope and acceptance:** Server ACL for owner, admin, designer, specialist, manufacturer, guest; scoped invites and logs. Done when guest/manufacturer cannot retrieve an unrelated project's source.

### COM-009 — Structured review and Yjs note collaboration
**Dependencies:** COM-008. **Suggested owner:** Collaboration. **Scope and acceptance:** Yjs shared text/comment drafts plus optimistic revision for CAD/BOM/POM critical fields. Done when simultaneous conflicting production edits require explicit resolution.

### COM-010 — Worker quota, licensing and moderation gates
**Dependencies:** COM-002. **Suggested owner:** Infrastructure/security. **Scope and acceptance:** Per-user upload/convert size, preview compute budgets, copyright reports, retention/removal and appeals. Done when unauthenticated file cannot force costly native solver execution.

### COM-011 — Paid marketplace with entitlement checks
**Dependencies:** COM-006, COM-010. **Suggested owner:** Commerce/legal. **Scope and acceptance:** Verified seller onboarding and payment webhook handling, immutable orders/refunds, signed file rights and receipts. Done with complete purchase/refund/chargeback and denied free download tests.

### COM-012 — Creator royalties, asset splits and team enterprise
**Dependencies:** COM-011. **Suggested owner:** Legal/product. **Scope and acceptance:** Future component revenue split graph and commercial team rights. Done only after legal/rate policy, accounting, negative cycles/thresholds and independent financial reviews.

## Tech Pack task index (existing specification)

The [Web Tech Pack research](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md) contains **TP-001 through TP-014**: schema, existing source adapter, 2D/3D review, POM editor, BOM, sample photos, anchored comments, factory portal, immutable releases/diffs, exports, notifications, accessibility, safe social preview and audit/security. Do not duplicate these as a separate product; they consume the same COM account/ACL/version infrastructure and the same EXO design assets. Required shared dependencies: COM-001/002/008/009, MAT-001, SP source integrity, and a reliable permission-filtered viewer.

## Proposed integrated demonstration order

**D0: Architecture proof** — a synthetic garment and measured specimen complete the source-data manifest through local EXO, upload preview and private authorized viewer without exposing hidden POM.

**D1: Local studio** — one hoodie saved in EXO opens on an avatar inside a source-owned White Product/Concrete/Black Studio; the photo result links back to the unchanged garment revision.

**D2: Free pattern publication** — a separate properly licensed open-source pattern posts to a creator account, with sizes/units, immutable hash, download license and remix lineage. Other users cannot reach private garment data.

**D3: Factory Web Tech Pack** — manufacturer accepts R01 for a specific hoodie and submits sample-photo/POM feedback; designer creates R02 with a diff, grants, and recorded acknowledgment; existing R01 remains immutable.

**D4: Physics quality** — the local offline PPF historical fitting fails expected collision and sewing QA, then an independently validated new reference fixture passes defined thresholds or remains rejected. No simulator should claim success from a final beauty frame alone.

**D5: Gallery room and shop** — visitor walks through published Looks with a flat-gallery fallback, buys a specifically licensed material/studio asset and receives the exact entitled version after verified payment. No unpublished source can be recovered via CDN.

**Important:** All demonstrations are proposed future tests. None has been executed in this research turn.

