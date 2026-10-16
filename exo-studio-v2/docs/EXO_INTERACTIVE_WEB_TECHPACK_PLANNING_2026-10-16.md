# EXO Web Tech Pack — Living Product Specification, Revisions & Factory Collaboration
**Future concept research and implementation plan | 16 October 2026 | No build authorized**

**Program navigation:** [Integrated ecosystem master architecture](EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md), [shared platform/physics/material candidate backlog](EXO_ECOSYSTEM_CANDIDATE_ENGINEERING_BACKLOG_2026-10-16.md) and [community creator marketplace](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md).

**Vision:** transform the static 2D paper/PDF tech pack into a secure **interactive garment product website**. A designer and manufacturer inspect an approved 2D/3D garment, measurements, size grading, trims, fabrics, construction instructions, reference images and sample review threads in one linked workspace. Each update is documented, compared, accepted or rejected, and attributed to the correct person. The original factory export remains available as a **versioned fallback**, but the living web specification becomes the collaborative source for future product development.

**Cross-references:** [EXO marketplace and collaboration architecture](EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md), [EXO physical/visual garment research](EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md), [EXO production pipeline](EXO_PRODUCTION_PIPELINE.md), [technical pattern/manufacturing parity plan](GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md).

## 1. Target experiences and views

**Designer Workspace:** full editable product source, technical drawings, formulas, grading, fabrics and suppliers, costs, confidential sample notes, design inspirations, internal targets, restricted assets, manufacturing release tools, private team tasks and proposal merges.

**Manufacturer Workspace:** the specific approved release and selected fields explicitly shared with this factory: measurement/size charts and tolerances, pattern package when authorized, construction callouts, BOM material identifiers, approved colors, trim placement, QA expectations, reference photos and sample comments. Manufacturer can flag manufacturing concerns, attach production photos, propose alternate stitch/materials and request clarification. Changes are **proposed**, not immediately authoritative.

**Public/Portfolio View:** only a separately published visual outfit presentation and any intentionally public facts. No internal POM rows, proprietary measurement formulas, construction recipes, raw pattern coordinates, vendor costs or factory messages should be sent to browser clients from this view.

**Buyer/License View:** if a designer sells a downloadable garment pattern or tech pack, show only the purchased licensed package/version; a marketplace purchase does not automatically grant access to the internal collaborative factory workflow.

### User flow: hoodie sample review
1. Designer creates a hoodie in EXO Studio, links fit avatar, fabric profile, variant/size run and a visual garment preview.
2. Designer opens **Web Tech Pack > Draft 04**, adds chest/waist/sleeve length tables, tolerance notes, grading, construction stitches, padded-hood details, hardware BOM and reference images.
3. Internal patternmaker and brand lead review with annotations pinned to 2D panel edges and 3D shoulder/hood geometry.
4. Designer creates immutable **Factory Release R01** from a specified garment source revision, POM, BOM and construction snapshot. Release shows creation time, author, status and full hash.
5. Assigned Manufacturer A receives a secure project-scoped link to R01, can see permitted drawings and download only approved pattern/export attachments.
6. Factory attaches a photo of Sample 1 and comments on the sleeve cuff row: “The opening is 1.2 cm too wide relative to R01 tolerance.” Designer gets an assigned issue linked to the specific size and POM ID.
7. Designer edits a new Draft 05, adjusts the point of measure, updates tech notes, checks the pattern source and asks for review.
8. Diff screen compares R01 and proposed R02: updated cuff dimensions across sizes, fabric and stitch spec unchanged, revised reference photo added, unresolved comments flagged.
9. Approved R02 is issued; Manufacturer A must acknowledge receipt. R01 remains accessible as superseded evidence rather than silently changing.
10. Subsequent Sample 2 feedback attaches to R02, not to an undefined 'latest' floating version.

**Result:** creators and factories can reconstruct exactly what was approved, when, by whom, with which garment/measurement files. A screenshot and PDF of each release can be generated for offline production.

## 2. Browser layout and content panels

Proposed route /teams/{team}/styles/{style}/techpacks/{pack}/revisions/{revision}; public routes never mirror this private path unless specifically approved.

**Top:** style name, development season, SKU, colorway, current status (Draft / In Review / Changes Requested / Approved / Released / Superseded / Archived), active source document and release version, factory partner, language and updated timestamp.

**Left contents:** Overview, Moodboard/References, Technical Flat, 3D Garment, POM & Sizes, Grade Rules, Fabric/Material, Trims/Hardware, Sewing & Construction, Colorways/Artwork, Labels & Packaging, BOM & Costing, Sampling, QC/Approvals, Files, Revision History.

**Center:** selectable 2D flat diagrams and 3D garment with annotations. Manufacturer can click zipper, seam, printed graphic or edge and read only permitted technical callouts. Images can be zoomed, layered and commented upon. Side-by-side visual for original vs revised garment at matched camera and pose. Simple mobile read-only layout with anchored comment cards when canvas is too small.

**Right:** properties/measurements and contextual comments, task assignee, linked sample photos, approval state, discussion history, change proposals, mentions and files. Pinned comments should have resolved/open filters and mention notification controls.

**Footer / sidebar:** status changes, upcoming sampling dates, references to approved PDF/export ZIP and audit history; keyboard-accessible comment navigation.

**Version comparison:** per-field colored diff at category level, including centimeters/millimeters with tolerance, size chart modifications, color/material changes, added/removed pattern pieces, stitch/fastener changes, images, and approval notes. Some 3D geometry differences cannot be represented as simple numeric values; provide 2D contour/3D ghost overlays in matching coordinate frames plus a changed-panel list.

## 3. Technical source data reused from EXO

Existing EXO already generates useful manufacturing artifacts: src/core/measurements.js builds a structured Tech Pack object; src/core/factoryPackage.js generates tech-pack.json, pom-spec.csv, cost/factory data and export ZIP; native_cpp/core/tech_pack_export.cpp and native_cpp/core/factory_package_files.cpp offer a parallel native path including factory-spec.html, materials-bom.csv, construction-seams.csv and trims-hardware.json. These are **existing export paths**, not evidence of an operational collaborative Tech Pack website.

The future web schema should import stable EXO IDs and original source revision; it should not parse PDF text to recover manufacturing facts. Accept a semantic schema version, SI canonical measures, display cm/mm/in conversions, sizes and grading metadata, and links to visual read-only source previews. If some EXO fields are missing, show **not supplied** rather than fabricating a value.

### Version data types (proposal)
- TechPack: packId, garmentId, teamId, ownerId, currentWorkingDraft, releasedVersionIds, factoryScopes, productStatus.
- TechPackRevision: revisionId, parentRevisionId, sourceGarmentRevision, contentHash, actor, createdAt, status, schemaVersion, reviewPolicy, fieldChangeSet.
- SectionSnapshot: refImage entries, drawings, POM table, fabric/profile references, BOM, trims, artwork, grading, construction, labeling, packaging, qcNotes, supplier-facing instructions.
- SpecLine: stable lineId, category, pointOfMeasure, description, sizeDimensionValues, baseSize, toleranceUpper/Lower, methodOfMeasurement, units, validationStatus.
- Attachment: fileId, source type, uploader, version, access classification, malware scan state, external provenance/license, linked entity ID.
- Sample: factory, sampleRound, size/colorway, shipped/received dates, measurement report, photo set, problems and resolution state.
- Proposal: proposed patch with expectedRevision and target IDs, factory notes, priority, affected variants, evidence and review decision.
- Release: immutable snapshot hash, approver IDs and time, approved buyer/factory audience, signature/acknowledgment, supersedes, export manifest.
- Comment: threadId, stable anchor object, author, mentions, createdAt, visibility scope, status, assignedTo, edit history and evidence.

**Sample state graph:** Draft → Internal Review → Approved → Released; Released may become Superseded only when another approved release is issued. Rejected proposals and unresolved comments remain historical records. Edits to a released version must never occur in-place; create a new draft based on its snapshot.

## 4. Designer vs manufacturer view: security is mandatory

**Access is controlled server-side per team, project, release, actor role and exact file**, not just CSS tabs. Designer can see internal cost assumptions and factory quotes separately; Manufacturer A sees only their explicitly approved release and related discussion, not Manufacturer B's pricing, drafts or internal creative comments. A guest link may be time-limited and restricted to a specific released revision; “unlisted” alone is not sufficiently safe.

Review roles: Owner / Designer / Patternmaker / Approver / Manufacturer / QC / Guest. Permissions include view_public_preview, read_private_working_draft, modify_design_spec, propose_factory_change, comment, upload_sample_evidence, approve_internal, release_to_factory, factory_acknowledge, download_pattern_package and access_costs. Assign grants at project and release scope, and explicitly deny grants by default.

**Private mode:** a creator can still publish the outfit visually to the public social site, while hiding full measurements, pattern geometry, PPF parameters and the whole tech pack. This requires a sanitized visual-only package and no unapproved technical metadata in the GLB, network response or public image alt text.

## 5. Comments tied to stable 2D and 3D anchors

**2D anchor:** reference garment sourceVersion, panelId, curveId/edgeId/pointId, local (u,v)/distance along edge plus fallback world-space XY in canonical units, visibility, and viewport transform version. Best anchor is a stable logical edge or measurement ID rather than raw pixel location.

**3D anchor:** mesh asset version, triangle ID + barycentric weights + optional surface normal and garment panel ID. A physically simulated mesh can be remeshed/reindexed: prefer logical source panel/feature identifier; if remapping fails, mark **anchor needs relinking** and keep the original screenshot so the remark does not jump to an unrelated vertex.

**Measurement anchor:** pointOfMeasure stable ID + size/colorway and field path. **BOM anchor:** line item ID and vendor/material row. **Image anchor:** stable image ID and normalized [0..1] XY. **Workflow anchor:** sampling stage, date, release version or request ID.

Each thread should support reply, mention, assign, resolve/reopen, attachment, notify participants and immutable edit/audit records. A factory cannot rewrite earlier acknowledged statements or approved specs without an audit trail. A comment edit may be allowed with separate original and new text records under retention rules.

### Collaboration technology choice
Yjs/CRDT can handle concurrent rich-text notes and ephemeral presence, but measurement tables, BOM quantities, source pattern geometry and release approval must use validated server transactions and expectedRevision locking. Two people entering different numbers for the same cuff width cannot safely “auto-merge” into a new production value. Show a conflict with both proposals, not silent last-write-wins. Offline comments sync only after server ACL and released revision are revalidated.

## 6. Data correctness: BOM, size runs and reference images

POM changes need cross-size constraints, e.g. allowed tolerance by size and method of measurement, not simply free-form paragraphs. The draft editor shows cm/in preview conversion but stores one canonical unit. Compare original design measurements with *actual pattern or 3D derived measured values* only if those measurements are robustly extracted. Display separate columns for target spec, tested sample actual, deviation and approve/rework decision.

BOM must preserve supplier, material ID, supplier SKU, composition, estimated usage/quantity by garment/size, unit price, effective date, colorway restrictions and substitutes. Public garment pages never reveal confidential supplier/unit costs unless approved. Production export source XML/CSV/JSON fields must correspond to displayed release, with hashes to prevent ambiguity.

Reference imagery is not merely a moodboard decoration. Store target detail (e.g. cuff shape, topstitch, lining, wash outcome), uploader, rights, size-specific scope, review status, and linkage to the relevant panel, POM, BOM or construction line. Present images alongside the actual accepted spec; a factory sees whether an image is “inspiration,” “illustrative non-binding” or “approved manufacturing reference.”

A Technical Flat is distinct from a beauty render. It must show authorized seam construction, grain/curve references and technical dimensions, not claim production correctness based on the photo scene. An external downloaded pattern's license may permit viewing but not factory mass production; attach license terms to each approved package.

## 7. Manufacturing workflow and sampling iteration

**Dev Stage:** concept → first pattern → proto sample → fit sample → size set → preproduction sample → production release → shipment QC. These are configurable labels per manufacturer; the product must not invent a globally mandatory supply-chain process.

At each sample round the factory can upload sample photos, POM actuals, workmanship findings, production feasibility, material alternates and shipping evidence. The designer reviews deviations and either accepts-with-reason, requests rework, or drafts a formal spec change. A sample approval must name size/colorway, fabric lot where relevant, inspector and exact release hash. It cannot blanket-approve later unreviewed size changes.

**Change Request** records target revision, rationale, proposed field diff, affected BOM/POM/pattern list, cost/schedule impact estimate, manufacturer discussion and final decision. Approved requests create or update a **new draft**; the designer publishes a new immutable release after review. Manufacturers acknowledge R01→R02 and the site shows that R01 is superseded. For factories offline, distribute a release-tagged PDF/ZIP with a QR/link/reference ID; that export never becomes a mutable “latest.pdf” with no snapshot.

## 8. Feature-level engineering work packages

| Task | Dependencies | Build specification | Completion proof |
| --- | --- | --- | --- |
| TP-001 Define TechPack/Revision schema | EXO source inventory | Stable IDs, variant/size, line-level units, release hashes | Semantic version migration and fixture round-trip |
| TP-002 Authoring-source adapter | TP-001 | Import existing tech-pack.json, BOM/POM and native patterns read-only | Same known garment and sizes in web view |
| TP-003 Visual 2D/3D viewer | TP-002 | Sanitized geometry, technical flat and optional 3D garment panels | Public vs factory rights validated |
| TP-004 POM & measurement editor | TP-001,002 | Canonical mm/cm, tolerances, grade rules and sample actuals | Unit/size invariants; conflicting changes rejected |
| TP-005 BOM & materials editor | TP-001,002 | Variant-specific fabric/trim item refs, supplier annotations, costing ACL | No price/private data leaked to external view |
| TP-006 Reference image and sample round | TP-001 | Secure image uploader, linked callouts, sample metadata and status | No unapproved attachments or leaks |
| TP-007 Anchored comments & tasks | TP-003–006 | Comments on stable POM, panel, vertex, BOM, image and stage IDs | Persist across revisions or become explicit orphan |
| TP-008 Role-based factory portal | TP-001,007 | Secure manufacturer accounts, scoped release viewer and proposal rights | Manufacturer A cannot access B or design private notes |
| TP-009 Version diff & immutable release | TP-004–008 | Snapshot, compare, approve, supersede and acknowledge | Two releases reconstructable bit-for-bit |
| TP-010 PDF/ZIP fallback export | TP-009 | Numbered snapshot outputs, downloadable under ACL, hash + timestamp | Output matches approved fields, historical export unchanged |
| TP-011 Notifications/mentions | TP-007,008 | Team/factory mentions, review reminders, digests and mute | Scope-correct notifications without confidential excerpts |
| TP-012 Mobile & accessibility QA | TP-003–011 | Read-only mobile, keyboard comments, color contrast and zoom | Independent actor/capability tests |
| TP-013 Integration with social portfolio | TP-008,009 | Publish only explicit visual-only derivative from pack | Public cannot fetch POM/BOM/private file bytes |
| TP-014 Audit, rollback & security | all | Append-only event trail, ACL regression, restore and import conflict | Every approved change attributed; no silent overwrite |

**Proposed sequencing:** TP-001–003 (read-only spec page) → TP-004–007 (working review room) → TP-008–010 (factory-controlled release) → TP-011–014 (safe notifications/public integration and reliability). Do not start public factory invitation until the ACL and immutable snapshot engine passes repeated tests.

### Qualitative staffing and effort
Dedicated backend/security, EXO CAD schema expert, UI/3D specialist and production-apparel reviewer. A basic read-only Tech Pack linked to an existing design may be a several-week prototype; manufacturer-grade permissions, concurrent reviews, versioned releases, audit and robust exported factory files are a multi-month independent product effort, dependent on schema and review cycles. **No approved delivery date or spend is implied.**

## 9. Proposed web screen sketches (textual)

**Designer:** header "HOODIE 001 · Draft 05 · Awaiting Pattern Review"; subnav "3D / 2D / Measurements / Fabrics / Construction / Samples / Versions"; left technical drawing; right open issue "Cuff POM #C17 Sample1 +1.2cm" assigned to designer; inline side-by-side R01→Draft05, private cost table and button "Request approval" (not automatically release).

**Manufacturer:** header "HOODIE 001 · Approved R01 · Acknowledge Revision"; center construction drawing and approved size chart; right sections "Factory Questions / Upload Sample / Propose Change"; R02 notice only after approved; no source formula edit controls, private design notes, or internal cost fields.

**Public:** header "HOODIE 001 by Creator"; 3D orbit, stage photo, fabric description and allowed public notes; optional Buy/Download Pattern if separately licensed. No techpack version/internal notes or factory assets transmitted.

## 10. Prior art: what existing products prove

[Techpacker](https://techpacker.io/) publicly advertises digital card-based tech packs, real-time comments, teamwork and version comparison. Its help pages document versioned sharing to manufacturers and note read-only factory functions including commenting and attaching files. [Backbone](https://intercom.help/backbone-help-center/en/articles/5803263-product-feedback-revisions) documents product feedback revisions and pulling fit/sample reports into tech packs. This validates **specific feature categories**, not a claim that all competitors have the exact EXO 3D-native data/approval model.

EXO should differentiate by a first-class **native garment-to-TechPack link** (stable 2D/3D garment IDs), comment anchoring in the actual cloth scene, exact version/size diff, independently approved factory snapshots, 3D rooms and creator-public storefront privacy separation.

**Additional directly relevant CLO-SET benchmark (verified 2026-10-16):** [CLO-SET's Web Tech Pack Construction documentation](https://support.clo-set.com/hc/en-us/articles/45303219780377-Web-Tech-Pack-Construction) describes an online tech pack populated from a garment's 3D content, data synchronized from CLO3D BOM, editable construction markers and annotation of materials, trims and sewing methods. It notes that the Construction pane's support differs between its legacy and newer content-page views; do not infer all accounts/products expose the same menu. Its [2025 annotation update](https://support.clo-set.com/hc/en-us/articles/45303128139673--2025-04-Updates-in-CLO-SET-Annotation-work-with-3D-Tech-Pack) describes selecting pattern, fabric or trim components in a 3D Tech Pack pane and creating linked 3D annotations. **This proves the 3D data-linked approach is commercially relevant, not that EXO can copy CLO proprietary source or inherits CLO cloud features automatically.**

**Differentiation gates for EXO:** (1) the browser never uses PDF extraction as the authoritative POM/BOM source; (2) comment anchors carry stable EXO pattern feature IDs and a mesh revision rather than only pixels; (3) factories read exact approved release Rnn and must acknowledge changes; (4) the system can publish a visual-only social Look without delivering private techpack/manufacturing records; (5) permitted downloads and pattern licensing are separately recorded from manufacturer collaboration grants. Competitors may already provide portions of these; validate actual release/version before making comparison claims.

Research:
- Techpacker current feature overview: https://techpacker.io/
- Techpacker secure factory sharing and versions: https://helpcenter.techpacker.com/hc/en-us/articles/360022720553-How-to-share-a-Tech-pack-with-Manufacturers
- Techpacker comments: https://helpcenter.techpacker.com/hc/en-us/articles/360017617214-How-to-communicate-with-team-members-and-manufacturers
- Techpacker factory role behavior: https://documentation.techpacker.com/techpack/communicate/share.html
- Backbone product revisions: https://intercom.help/backbone-help-center/en/articles/5803263-product-feedback-revisions
- Yjs shared text for concurrent notes: https://docs.yjs.dev/getting-started/working-with-shared-types
- CLO-SET Web Tech Pack Construction and BOM integration: https://support.clo-set.com/hc/en-us/articles/45303219780377-Web-Tech-Pack-Construction
- CLO-SET Annotation and 3D Tech Pack: https://support.clo-set.com/hc/en-us/articles/45303128139673--2025-04-Updates-in-CLO-SET-Annotation-work-with-3D-Tech-Pack

**Decision:** Treat the Web Tech Pack as a collaborative, permissioned product development room with machine-readable source data, immutable release approvals and linked manufacturing evidence; static PDF becomes one export of a frozen version, not the sole collaboration interface. Nothing is built or published by this document.
