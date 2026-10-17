# EXO Platform Expansion — Phased Execution and Dependency Register
**2026-10-16 | Planning only | No work authorized**

This annex unifies: [PPF/materials/studios](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md), [community marketplace](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [web tech pack](EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md), [original spatial 10-page implementation blueprint](EXO_SPATIAL_STUDIO_TEN_PAGE_IMPLEMENTATION_BLUEPRINT_2026-10-16.md) and its [48-task original backlog](EXO_SPATIAL_STUDIO_EXECUTION_BACKLOG_2026-10-16.md). This adds **new planning items**, not external issue tracker submissions.

## 1. Strategy: two products and one safe link

Build two deployables, sharing explicit asset ID/version contracts:

- **EXO Studio Desktop/Local:** design source, physical cloth, PBR, visualization, local manufacturing exports, private garment vault. The source CAD document never changes because someone views an online portfolio.
- **EXO Community Web:** identity, profiles, follower feed, public/free/paid assets, pattern pool, Remix lineage, team projects, shared workrooms, interactive factory Tech Packs. Website storage must distinguish sanitized public derivatives from private source, purchased files and team specs.
- **Authorized Sync/Publisher:** explicit opt-in from Studio; creator chooses exact garment revision, visibility, downloadable source, texture license, 3D preview and public notes. No public browser can call the native solver or local file system directly.

The first launch can use prepared original garments and still/GLB previews **without** physics cloud compute, multiplayer, payments or a factory release workflow. Integrate those only when access controls and versioning are reliable.

## 2. Dependencies across product tracks

| Track | Depends on | Earliest safe measurable slice |
| --- | --- | --- |
| Physical materials | Canonical units + specimen provenance | 4 measured or explicitly unmeasured native profiles with drape tests |
| PPF offline contact | Valid sewing staging + accepted physics harness | A reference garment with complete, independently accepted frame trajectory |
| Visual textiles | Separate PBR map schema + asset rights | Real-scale maps on flat and draped swatches under fixed lights |
| Virtual photo studios | Versioned Look and avatar assets | Three original Blender stages and repeatable front/back renders |
| Walkable clothing room | Valid optimized look meshes and viewer permissions | One private room, 10 mannequins, keyboard+accessible browse |
| Community profiles | Identity + private/public storage isolation | Sanitized visual-only public profile and secure private draft |
| Free Pattern Pool | Rights grant + upload scan + format metadata | Free licensed patterns with verified files and receipts |
| Paid marketplace | Entitlement, financial/legal review and payouts | One approved paid texture/pattern, refunds & release controls tested |
| Team collaboration | Organization/project ACL + revision model | Controlled notes/comments on authorized item, no cross-tenant leaks |
| Interactive web Tech Pack | EXO POM/BOM adapter + role ACL + immutable releases | Reconstructable approved factory snapshot, comments and proposal loop |
| Live coediting CAD | Deterministic edit/merge/conflict model | Two distinct pattern edits resolved with no silent last-write-wins |
| Creator remix royalties | License dependency graph + order/refund accounting | Reproducible right-to-resell proof and settlement ledger |

### Strong recommendation
Do **not** put the entire public website and payments behind PPF solver correctness. It can launch independently as a safe portfolio and free-license library. Likewise don't couple native cloth editor stability to public upload moderation or marketplace checkout. Use versioned boundaries and controlled adapters.

## 3. Additional work packages (planning IDs)

### Material/PPF validation (PX)
- **PX-001:** inventory Rust VBD and legacy EXO physical parameter units, source values and evidence; owner cloth engineer; DONE if every canonical field/units and missing capability is captured with fixtures.
- **PX-002:** design MaterialPhysicalProfile and MaterialVisualProfile schemas linked by stable material ID; owner data/graphics; DONE if one measured/unmeasured profile round-trips between swatch, solver, garment and export without a unit collision.
- **PX-003:** create standardized fabric specimen workflow: GSM, thickness, warp/weft/bias force curves, bending/friction, release hysteresis; owner apparel researcher; DONE with raw test measurements and specimen identifiers.
- **PX-004:** fit backend-specific VBD parameters to specimen results; owner physics; DONE with repeatable force/stretch/drape response, calibrated uncertainty and no false 'measured' default.
- **PX-005:** separately fit PPF shell parameters for same specimens; owner PPF engineer; DONE when identical experiments are comparable and source parameter conversion explicitly documented.
- **PX-006:** reproduce upstream PPF reference scenes using exact pinned shell/static choices; owner solver QA; DONE with complete raw frames/versions.
- **PX-007:** repair garment seam initialization and register body groups; owner meshing/sewing; DONE when starting gaps and intersections pass gates without post-snap magic.
- **PX-008:** run independent full-frame contact+seam+strain/swept auditing; owner solver QA; DONE when rejected prior test cases still fail and any accepted new fixture shows zero prohibited contacts.
- **PX-009:** implement offline isolated Reference SolveJob states and source hash/acceptance reports; owner native/backend; DONE when a failed run cannot overwrite good caches.
- **PX-010:** develop measured or clearly approximate multi-scale PBR materials and trims; owner look-dev/graphics; DONE when color space, repeat scale and front/back material behavior pass under neutral and studio lighting.

### Photography and immersive room (RX)
- **RX-001:** define Look+Studio+Camera+Lights manifest with source/license reference; owner graphics; DONE when saved Look renders from exact reproducible assets.
- **RX-002:** author original white cyc, concrete gallery and black stage Blender scene masters; owner artist; DONE with .blend, rights, light/camera presets, thumbnails.
- **RX-003:** implement portable web scene derivative + runtime light reconstruction; owner renderer; DONE with validated glTF material/geometry and documented area/world lighting differences.
- **RX-004:** plan cancellable local high-quality render queue with source revisions; owner render pipeline; DONE when retry/failure cannot corrupt approved output.
- **RX-005:** design My Room lobby, Collection, Pattern Archive, Material Lab and Stage scenes; owner UX/artist; DONE with routes, navigation map and single-room usability test.
- **RX-006:** test first-person movement, mannequin collision and point-click accessibility alternative; owner web graphics; DONE with no camera stuck/through-wall and reliable list fallback.
- **RX-007:** optimize scene geometry/LOD, textures and memory; owner graphics QA; DONE with documented p95 frame times on target Mac/browser and memory budget.
- **RX-008:** privacy inspect all room GLBs and network endpoints; owner security; DONE when private POM/pattern/BOM bytes cannot be fetched by an unrelated account.

### Community profiles, Pattern Pool and marketplace (CX)
- **CX-001:** choose typed public/private artifact and creator/team identity model; owner architecture; DONE with private/public permissions matrix and threat model.
- **CX-002:** implement sanitized PreviewAsset builder and source-file rights validator; owner security/data; DONE when public model contains no nonpublished CAD/hidden measurements.
- **CX-003:** plan account/profile/follows/collections and feed with safety controls; owner web; DONE with privacy/blocked-user cases and search access tests.
- **CX-004:** define licensed free pattern upload/download UX with format, grade, size and source attribution; owner marketplace; DONE with malicious file tests and download receipt.
- **CX-005:** add asset registry and trusted derivative license graph; owner data/legal; DONE when downstream remix cannot publish incompatible sources.
- **CX-006:** add organization, team, project ACL and guest invitations; owner backend/security; DONE with cross-tenant denial and scoped revoke tests.
- **CX-007:** comment/task/annotation engine tied to stable garment or BOM IDs; owner collaboration; DONE when remeshing marks orphaned threads rather than attaching wrong geometry.
- **CX-008:** sandbox untrusted ZIP/OBJ/GLB/.blend processing and sanitize public thumbnails; owner infra; DONE against OWASP upload/path traversal, file size and malformed mesh tests.
- **CX-009:** design marketplace entitlement, seller onboarding, checkout and license receipt; owner payments/legal; DONE with authorized seller, refund, signed-download and tax-ownership review.
- **CX-010:** design dependency-aware revenue share, if adopted; owner payments/legal; DONE with transparent calculation, loops prevented, claims/appeals and chargeback ledger.
- **CX-011:** moderation/rights/takedown/appeal + creator protection and spam throttling; owner trust/safety; DONE with operational incident and support plan.
- **CX-012:** mobile public 3D preview, flat accessible fallback and notification settings; owner web accessibility; DONE with performance, keyboard and screen reader tests.

### Interactive web tech-pack and factory collaboration (TX)
- **TX-001:** import structured EXO tech-pack.json, POM size runs and BOM into versioned TechPack schema; owner data/manufacturing; DONE with parity to known project and explicit missing fields.
- **TX-002:** manufacturer role and project-scope visibility with proof of isolation from other factories; owner security; DONE with negative cross-tenant access.
- **TX-003:** contextual 2D/3D/POM/BOM comments and reference-image attachments; owner web UI; DONE when anchors persist across revisions or are marked unresolved.
- **TX-004:** draft/compare/approve/release immutable spec workflow; owner backend/manufacturing; DONE with exact two-version diff and audit.
- **TX-005:** factory proposal/acknowledgment and sample photo/POM actual review; owner collaboration; DONE with approval authority kept with designer.
- **TX-006:** signed factory-specific release downloads and consistent PDF/ZIP fallback; owner export/security; DONE when factory R01 cannot silently mutate after R02 and downloadable hash matches accepted source.
- **TX-007:** manufacturing technical validation and external partner walkthrough; owner apparel QA; DONE with field-level review of POM/BOM/size tolerances, sample reports and permission audit.
- **TX-008:** connect user profile's public showroom entry to private TechPack only via controlled explicit link; owner architecture; DONE with non-leakage of internal costs/patterns/review comments.

## 4. Logical releases and rough sequencing

**Release P: private creator portfolios.** Foundation identity, source-sanitized derivative, profile and 3D preview. Value: public fashion presentation without leaking patterns. No payments or multiuser editing. No need to solve PPF first.

**Release F: free pattern commons.** Licensed free files, metadata, search, download receipts, creator attribution, proper moderation. This alone differentiates EXO from static sample galleries.

**Release S: personal wardrobe rooms and photo studios.** Original Blender scene library, saved Looks, walkable private showroom with accessible 2D catalog alternate. Public rooms only after authorization QA.

**Release T: product development and factory Tech Packs.** Versioned POM/BOM, anchored comments, designer/factory roles, immutable approved releases and sample revision loop. Can be monetized as team software separately from free pool.

**Release M: paid marketplace.** Seller onboarding, financial/tax/legal review, entitlements, payouts, licensing and compliant refunds. Never use payments as substitute for original author permission.

**Release PPF+: high-fidelity reference solver.** Require accepted cloth contact/sewing benchmarks and material calibration; use offline jobs. Do not tie its timeline to public website launch.

**Release AR: on-device or projector-based interactive garment mode.** Follows calibrated projection and physics lifecycle tests from the spatial plan, not automatically implied by a public 3D gallery.

**Rough planning bands:** portfolio/free commons can take several months with a full-stack team once safety and schema are scoped; secure manufacturer and paid-marketplace functions each add months of QA/permissions/legal work. Reference solver contact is independent research with uncertain convergence. The phased table is not a delivery promise or staffing commitment.

## 5. Immediate next planning choices, not questions blocking this document

1. Choose EXO Community as **separate website** under a future domain/subdomain; no domain lookup/purchase needed now.
2. Keep local garment owner files private by default.
3. Define standard assets: Visual Look, Pattern, Fabric Physical Profile, Fabric PBR, Trim, Avatar, Stage, TechPack Release.
4. Adopt formal licenses instead of vague 'free to use'; decide whether physical garment manufacture is part of each entitlement.
5. Decide whether marketplace revenue is future business or initial requirement; recommend **free and view-only first**.
6. Build a minimal 3D room from original Blender assets as a presentation feature, not a simulated multiplayer game.
7. Keep PPF reference solver jobs private, queued, rate-limited and unverified until independent fit acceptance.
8. Set factory approval as a separate explicit workflow, not an automatic consequence of an edited 3D garment.

**No-build boundary:** These planning IDs are not GitHub issues; no code, database, hosted site, existing tech pack, app state or real garment was changed.

