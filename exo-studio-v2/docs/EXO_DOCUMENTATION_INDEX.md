# EXO Sample 3D — documentation map

This is the starting point for the **EXO Sample 3D** technical knowledge base. The focus is a garment-design application that connects **editable 2D patterns, staged 3D cloth, physics research, material appearance, avatars, and manufacturing exports**. Some tooling is mature enough to test; other systems are exploratory. A large number of historical notes are kept for transparency but are **not** acceptance evidence for final fit or factory certification.

## Reading routes

| Goal | Start here | Then read |
| --- | --- | --- |
| Understand the vision | [Main README](../README.md) | [Feature atlas](EXO_FEATURE_ATLAS.md), [Master roadmap](EXO_MASTER_ROADMAP.md) |
| Build or extend the app | [Developer guide](EXO_DEVELOPER_GUIDE.md) | [Architecture](EXO_ARCHITECTURE.md), [Canonical data model](EXO_DATA_MODEL.md) |
| Improve cloth physics | [Simulation research](EXO_SIMULATION_RESEARCH.md) | [Validation plan](EXO_VALIDATION_TEST_PLAN.md), [Backend API](BACKEND_API.md) |
| Make garments / production data | [Production pipeline](EXO_PRODUCTION_PIPELINE.md) | [Feature atlas](EXO_FEATURE_ATLAS.md), [Production gap audit](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md) |
| Prepare a contribution | [Contribution playbook](EXO_CONTRIBUTION_GUIDE.md) | [CONTRIBUTING](../CONTRIBUTING.md), [Security](../SECURITY.md) |
| Find media or demo provenance | [Media gallery](EXO_MEDIA_GALLERY.md) | [Full V16 film](../media/exo-sample-3d-v16-showcase.mp4) |
| Evaluate release readiness | [Public-release status](EXO_RELEASE_STATUS.md) | [Licensing](LICENSING.md), [GitHub setup](GITHUB_SETUP.md) |

## Core technical reference manuals

1. **[EXO Architecture](EXO_ARCHITECTURE.md)** — domains, service boundaries, renderer, transport, simulators, exporters and local workflow.
2. **[EXO Feature Atlas](EXO_FEATURE_ATLAS.md)** — module-by-module capability map and verified vs partial behavior.
3. **[EXO Data Model](EXO_DATA_MODEL.md)** — patterns, seams, fabrics, avatars, project persistence, invariants and interchange.
4. **[EXO Developer Guide](EXO_DEVELOPER_GUIDE.md)** — workstation setup, debug tools, test commands and API examples.
5. **[EXO UI, Rendering and Avatars](EXO_UI_RENDERING_AND_AVATARS.md)** — viewport, natural floor grid, neutral mannequin, lighting and cameras.
6. **[EXO Fabric, Materials and Trims](EXO_FABRIC_MATERIALS_AND_TRIMS.md)** — optical/physical fabric model, repeat scales, textures and construction.
5. **[EXO Master Roadmap](EXO_MASTER_ROADMAP.md)** — phases M0–M7, backlog, blocked features, readiness and acceptance.
6. **[EXO Simulation Research](EXO_SIMULATION_RESEARCH.md)** — JS PBD, Rust PPF, C++/XPBD, contact, fit, stability and physical calibration.
7. **[EXO Validation Test Plan](EXO_VALIDATION_TEST_PLAN.md)** — benchmark fixtures, nonpenetration, material realism and determinism tests.
8. **[EXO Production Pipeline](EXO_PRODUCTION_PIPELINE.md)** — pattern-to-factory data, grading, marker, BOM/POM, DXF, XML and packaging.
9. **[EXO Contribution Guide](EXO_CONTRIBUTION_GUIDE.md)** — module ownership, code quality and external contributor process.

## Presentation and release documents

- [EXO Media Gallery](EXO_MEDIA_GALLERY.md): current screenshots, real-scene provenance and V16 review.
- [EXO Public Release Status](EXO_RELEASE_STATUS.md): public-source safeguards and items needing approval.
- [EXO Project History](EXO_PROJECT_HISTORY.md): source-grounded chronology of development milestones and experimental findings.
- [EXO Milestone Issue Board](EXO_MILESTONE_ISSUE_BOARD.md): prioritized actionable tickets with acceptance criteria.
- [GitHub Publishing Setup](GITHUB_SETUP.md): authorization, remotes, pushes and local asset exclusions.
- [Third-party Licensing](LICENSING.md): GPL choice, CC0 MakeHuman base, research checkout and Rust PPF terms.
- [Security Policy](../SECURITY.md): vulnerability handling, credentials and threat disclosure.
- [Contributor entry point](../CONTRIBUTING.md): pull-request expectations.

## Research archive and provenance

These existing documents are useful **history**, not specifications all features currently meet. Re-run the named tests and inspect current code before turning experimental results into product claims.

| Topic | Historical document |
| --- | --- |
| CLO-inspired feature parity research | [Master legacy plan](GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md) |
| Application architecture and simulator | [October 13 architecture audit](ARCHITECTURE_AUDIT_CLOTH_SIMULATION_2026-10-13.md) |
| Production and DXF parity | [October 15 export/production audit](CLO_EXPORT_PRODUCTION_PARITY_2026-10-15.md) |
| Native C++ mapping inventory | [Native conversion audit](SAMPL3D_NATIVE_CPP_CONVERSION_LOOP_2026-10-15.md) |
| Original garment fit benchmark | [T-shirt fitting test](FIRST_TEE_FIT_TEST_2026-10-13.md) |
| Rust PPF body/garment R&D | [PPF actual garment audit](PPF_ACTUAL_GARMENT_FIT_DEEP_AUDIT_2026-10-14.md) |
| Textile surface parity | [Fabric parity audit](SAMPL3D_FABRIC_PARITY_AUDIT_2026-10-15.md) |
| Original avatar / ZOZO reference | [ZOZO fitting reference](ZOZO_EXACT_FITTING_REFERENCE_2026-10-13.md) |
| QA and open-source governance | [Open-source release guide](OPEN_SOURCE_RELEASE_READINESS_AUDIT_2026-10-13.md) |
| Qt desktop native prototype | [Qt 6 desktop checkpoint](SAMPL3D_NATIVE_QT_DESKTOP_BUILT_2026-10-15.md) |

## How to read status claims

A test count or export mapping number is **not** a weighted percentage of commercial-CAD capability. Where a document says “parity,” check exactly what is compared: serialized arrays, shapes, individual contact coordinates, input validation, visual thumbnails or whole multi-frame physical behavior. The acceptance bar for the live solver is stronger than a unit test: stable sewn clothing, physically meaningful parameters, full collision/contact evidence, consistent multi-frame evolution and reproducible performance.

Likewise, “factory ZIP generated” is not interchangeable with production approval. Grading points, cutline order, units, seam allowances, physical samples, BOM completeness and machine-specific DXF semantics require independent verification.

## Suggested collaboration model

- **Bug report:** minimized project, deterministic steps, expected vs observed metrics and unmodified screenshots.
- **New feature:** owner/beneficiary, document schema effect, UI entry point, subsystem contract, permissions, tests and rollback.
- **Solver change:** model assumptions, mathematical formulation, fixtures, accuracy/stability and run-to-run convergence.
- **Production change:** dimensions, serialization units, reversible import/export, factory signoff and sample validation.
- **Documentation change:** cite source paths/tests; update the feature-atlas status rather than silently rebranding a prototype as finished.

See the [issue templates](../.github/ISSUE_TEMPLATE/) and the [contributor playbook](EXO_CONTRIBUTION_GUIDE.md) to open work items.

---

**EXO Sample 3D is experimental open-source engineering software. Its present UI and promotional film do not certify collision-free garment fitting or production manufacturing instructions.**
