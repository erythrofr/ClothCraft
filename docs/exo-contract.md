# EXO ↔ ClothCraft editor, document and solver ownership contract

**Status:** proposed integration contract for maintainer review, **not a shipped
protocol or compatibility claim**. Scope: [EXO-CORE-001](https://github.com/erythrofr/ClothCraft/issues/10),
2026-10-22. This document changes no runtime, serialization, solver, license,
or import behavior. No EXO implementation has been copied.

## Evidence baseline and version boundary

- ClothCraft source inspected at [`595ed1e3a75324c91ef992b2012f9916c3ff20b9`](https://github.com/erythrofr/ClothCraft/commit/595ed1e3a75324c91ef992b2012f9916c3ff20b9):
  [`src/project.rs`](../src/project.rs), [`src/fitting.rs`](../src/fitting.rs),
  [`src/garment/template.rs`](../src/garment/template.rs),
  [`src/garment/polygon.rs`](../src/garment/polygon.rs),
  [`src/garment/seam.rs`](../src/garment/seam.rs),
  [`src/authoring.rs`](../src/authoring.rs) and
  [`src/document.rs`](../src/document.rs).
- EXO's [document model](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_DATA_MODEL.md)
  and [Rust conversion audit](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/docs/EXO_RUST_CONVERSION_STATUS_2026-10-18.md),
  revision [`352c6086b622caeda95f16d9bd923624b95e05d9`](https://github.com/mikristian/exo-sample-3d/commit/352c6086b622caeda95f16d9bd923624b95e05d9),
  are *behavioral requirements*, not evidence of equivalent serialization or
  an MIT-compatible grant. See [provenance task #11](https://github.com/erythrofr/ClothCraft/issues/11).
- Existing **on-disk**, validated native schemas (distinct from this proposal):

  | Native item | Actual accepted version | Authority / limitations |
  | --- | --- | --- |
  | `Project` in `project.rs` | `version: 1` | Historical one-panel pattern/scene; not EXO multi-piece project, no native mesh cache in file |
  | `GarmentTemplate` | `format: "marvelous-cloth-template"`, `version: 1` or `2` | Editable fabric IDs, panel IDs, material rest geometry, seam references; v2 supports named polygon edges, holes and internal lines; rectangle v1 remains readable |
  | `FittingProject` | `version: 1` | Wraps a `GarmentTemplate`, avatar path, solver/interactive settings and optional cached `State`/`mesh_signature` |
  | EXO JavaScript document / simulation request | evolving JS object; separately `garment-studio.simulation` v1 | **Different models**; no native EXO interchange reader in ClothCraft and no automatic one-to-one field transfer |

Both native document models use strict Serde decoding of known fields. An
external EXO JSON object or envelope **cannot be loaded directly** as a
`GarmentTemplate` or `FittingProject`. Existing APIs do not expose a shared
wire-level revision counter, negotiate capabilities or implement an EXO
transaction endpoint. Those features must be implemented and tested under a
separate scoped task before anybody advertises them.

## Authoritative data and ownership

| Layer | Authoritative owner | Derived / forbidden assumptions |
| --- | --- | --- |
| Editable pattern | `GarmentTemplate`: panels, ID-labelled polygon edges/paths, holes, fabrics, grain, sewing graph | Rust `authoring::apply` validates a **cloned** candidate and returns an `Edit`. Never reconstruct material shape from drape or treat mesh vertices as durable IDs |
| Panel material coordinates | Local `DVec2` **metres**; polygons use a numerical CCW contour with `v` displayed downward | `layout_2d` and `layout_rotation_degrees` are board presentation only. Their edits must not rotate/scale rest UVs or alter physical coefficients |
| Sewing relationships | `SeamSpec.id`, `BoundaryRef.panel` plus polygon `edge` name (or v1 rectangle `side`), range and direction; optional ordered A/B tails, notches and explicit `allow_ease` | Ranges are `[start,end]` on **normalized rest arclength**, *not* Bézier parameter, 3D length or a persistent particle index. Compiler may reject overlapping ownership, invalid notches or unsupported topology edits |
| Fabric and grain | `Fabric.id` → shared `FabricProperties`; `Panel.fabric` and `Panel.grain_degrees` | Bind directional physical material per panel on compile. EXO's `gsm` is g/m²; Rust `density` is kg/m². Similar names for stretch, bending or visual shading do **not** prove physically equivalent laws |
| Initial placement | `Panel.placement.translation` in 3D metres and `rotation_degrees` (XYZ) | Staging is not material geometry. Polygon pins use local metre `pin_points`; rectangle `pins` use corner enums |
| Generated model | `GarmentTemplate::compile` produces `CompiledGarment` meshes, material binding, panel ranges, quadrature and initial positions | Triangulation and barycentric references are disposable compiled data. Remeshing must re-establish attachments, constraints, contact and derived caches |
| Accepted dynamic state | `FittingScene.state: State {x,v,time}` in 3D metres, m/s, seconds; simulation worker accepts a generation-matched result | Current `State` does not encode solver-independent warm-start/contact history. Display FPS, screenshot or penetration appearance does not establish physical acceptance |
| Avatar collision input | `FittingProject.avatar_path` → validated OBJ surface / `MeshCollider` for the compiled fitting scene | Keep collider identity and actual geometry distinct from a *visual-only* avatar. No swapping in a guessed silhouette, radius or lower-resolution mesh to make the scene look valid |
| Saved file / export | Native `FittingProject::save/load`, template save/load and separate export tools | Project and its portable adjacent avatar assets travel together. OBJ/SVG/diagnostic artifacts are **outputs**, not lossless editable authoring documents |

### Units and identifiers

- Internal SI contract: geometry/placement/clearance **m**; time **s**;
  velocity **m/s**; fabric areal density **kg/m²**; force **N**;
  membrane **N/m**; bending **N·m**; sewing stiffness **N/m²**.
  `grain_degrees` and placement Euler angles are **degrees**, not radians.
- EXO drafting points documented in **cm** must be divided by **100** before
  entering Rust material coordinates; EXO `gsm` must be divided by **1,000**
  to reach Rust kg/m². Conversions must be explicit, finite, bounded and
  tested, not inferred from numerical size. They do **not** calibrate EXO's
  material law or authorize a physical material coefficient mapping.
- Every panel, fabric and seam ID must be unique in its native scope; IDs must
  meet Rust's 1–80 ASCII alphanumeric/`_`/`-` validation. Polygon edge names
  are stable semantic boundary keys **within their panel**. `BoundaryRef.side`
  is required in the current Serde shape even when `edge` selects a v2 named
  polygon edge. A retopology operation must migrate affected named references
  deliberately or reject the transaction.
- Runtime mesh vertex IDs, triangle IDs, array indices, UI selection IDs and
  solver contact candidates are **not** persistent sewing anchors. Use
  `panel ID + named edge + rest-arclength interval` (and reversal) to resolve
  seam correspondence after recompilation.
- Do not conflate project ID, panel ID, file path, client request ID,
  **document revision**, and **worker generation**. The last two have different
  purposes and neither is currently an on-disk `GarmentTemplate` field.

## Proposed adapter v1 (future work, NOT implemented)

If implemented after review, a thin local bridge should expose a protocol
**separate from every existing JSON file schema**, for example
`"clothcraft.exo.contract"` + `protocolVersion: 1`. Exact spelling and
operations are **proposals**, not a supported API. An adapter must negotiate
its own version before decoding a request and unwrap the native template; it
must not insert envelope fields into a `GarmentTemplate`.

1. **Handshake:** return protocol name, a supported version list (initially
   `[1]` if implemented), *actual* native file formats/versions,
   read/validate/write capabilities and backend limitations. Unknown major
   version → `unsupported_protocol_version`; unsupported operation or field
   → `unsupported_operation` / `unsupported_field`. Never claim a deployed
   solver or cross-format adapter merely because an enum lists it.
2. **Session:** issue a fresh opaque `documentSession` on open or new document,
   and an adapter-managed monotonically increasing `revision` (e.g. 0 on
   open, +1 on successful authored mutation). This is **not** currently
   serialized by Rust. Revision tokens must not survive as valid across a
   different session or recreated process without an explicit persistence
   contract. A rejected or cancelled edit does not increment revision.
3. **Validation-only import:** explicitly select source units/schema, convert
   to a complete candidate native document, report unknown/lossy EXO fields,
   then run existing Rust compilation **before** changing editor state.
   Applying a validated import must be a *separate*, confirmed transaction.
   Unknown/unsafe content cannot be silently dropped.
4. **Transactional edit:** require both `documentSession` and
   `expectedRevision`; reject wrong session or mismatched revision
   (`stale_revision`) before acting. Convert only supported operations into
   existing `authoring::Command` variants and validate with
   `authoring::apply`. Commit the candidate atomically, record history and
   bump revision **only** on success; cancellation and failure preserve the
   original document and history. See existing [authoring](authoring.md) and
   [documents/sewing](documents-and-sewing.md) behavior; no generic JSON Patch.
5. **Publication to solver:** compile all dependent panel meshes, fabric
   bindings, named boundary and seam quadrature data, collision state, render
   attachments and rest-dependent caches. Advance an independent in-memory
   **topology/worker generation** before accepting a new simulation result;
   reject completions from the old generation. Maintain the production VBD +
   OGC path; another backend requires separate quality gates.
6. **Unsupported EXO fields:** fail closed for EXO grading runs, seam
   allowances, BOM/tech-pack, fasteners/zipper physics, visual PBR textures,
   `ratio`, `gatherSide`, `elasticRatio`, `openFraction`,
   `junctionScale`, and other EXO-only fields unless a separately reviewed
   semantic mapping exists. Do not translate EXO simulation settings directly
   to Rust coefficients or claim that a preview constitutes a simulated fit.
   An importer may *report* these fields without persisting them.

### Invalidation matrix (required adapter behavior)

| Successful action | Authoritative edit | Derived state to rebuild / preserve |
| --- | --- | --- |
| Contour/curve, hole, internal path, sew/unsow, pins, physical placement, shared fabric mechanics, grain or meshing changes | Candidate validated `GarmentTemplate` | Recompile affected model and seam references, recompute masses/rest attachment mapping, invalidate OGC and solver caches, increment worker generation. Retain only compatible drape through current `Edit::state_after` rules, not blind array copy |
| Board layout, UI tool, inspector or other purely cosmetic presentation | Only UI/presentation metadata | **Do not** change material coordinates, masses or physics; no mesh rebuild required. Still record a document revision for a persisted authored layout mutation |
| Appearance-only texture or display adjustment | External renderer/UI state only until an approved format exists | Preserve physical mesh/state; never silently change cloth coefficients |
| Accepted solver step | Current dynamic state, not rest template | Update `x`, `v`, `time` only for matching worker generation. Keep a step error separate from a template edit rejection; do not increment authored document revision by default |
| Save/reopen project with optional cached drape | `FittingProject` v1 and portable avatar reference | `mesh_signature` is a **noncryptographic FNV-1a cache fingerprint**, not an authoring revision or security checksum. `FittingProject::compile` rejects stale cached state when signature mismatches. Preserve valid state only with matching geometry, cache signature and vector lengths |

This table defines **adapter acceptance conditions**, not a promise that every
path already has a selective incremental invalidator. The existing app may
rebuild more than the minimum. Current `authoring::History` stores editable
templates (up to 32 undo snapshots) and is not a persistent cross-process
revision log.

### Failure and compatibility rules

Each proposed response must distinguish `invalid_payload`,
`unsupported_protocol_version`, `unsupported_document_version`,
`unsupported_field`, `unsupported_operation`, `stale_session`,
`stale_revision`, `invalid_reference`, `invalid_geometry`,
`cache_mismatch`, `compilation_failed`, `cancelled`,
`missing_asset`, and `io_failure` with a stable code and human-readable
detail. On every **non-successful edit**: preserve the last valid template,
revision, undo stack, solver-visible generation, and accepted state. For a
successful document replace/open, preserve the previous document until the
new one fully validates and missing avatar assets are resolved or the user
cancels. **Native `Project` v1, `GarmentTemplate` v1/v2 and `FittingProject` v1
must remain readable without introducing any envelope or EXO-only fields.**

## Synthetic interchange example

This represents a **future, read-only `validate_snapshot` request** carrying
a genuine native `GarmentTemplate` v2 payload. The wrapper/operation is not
shipped; only the object under `template` is intended for the current Rust
`GarmentTemplate` reader. No proprietary garment, EXO asset or real user
data is included. Coordinates are SI metres; sides refer to the named
boundaries, and reversed B matches opposing boundary directions.

```json
{
  "protocol": "clothcraft.exo.contract",
  "protocolVersion": 1,
  "operation": "validate_snapshot",
  "requestId": "synthetic-001",
  "documentSession": "example-session-01",
  "expectedRevision": 0,
  "units": "m",
  "template": {
    "format": "marvelous-cloth-template",
    "version": 2,
    "name": "Synthetic twin panels",
    "fabrics": [{
      "id": "fabric-1",
      "name": "Uncalibrated synthetic fabric",
      "properties": {
        "warp": 350.0, "weft": 180.0, "shear": 45.0,
        "compression_ratio": 0.15, "compression_transition": 0.005,
        "bend_warp": 0.00008, "bend_weft": 0.00004,
        "density": 0.2, "thickness": 0.001
      }
    }],
    "panels": [
      {
        "id": "front", "name": "Front", "fabric": "fabric-1",
        "pattern": {"width": 0.2, "height": 0.3, "nx": 1, "ny": 1},
        "polygon": {
          "points": [[0.0, 0.0], [0.2, 0.0], [0.2, 0.3], [0.0, 0.3]],
          "edges": ["top", "right", "bottom", "left"],
          "subdivisions": 0
        },
        "grain_degrees": 0.0,
        "placement": {"translation": [0.0, 0.0, 0.0], "rotation_degrees": [0.0, 0.0, 0.0]},
        "pins": []
      },
      {
        "id": "back", "name": "Back", "fabric": "fabric-1",
        "pattern": {"width": 0.2, "height": 0.3, "nx": 1, "ny": 1},
        "polygon": {
          "points": [[0.0, 0.0], [0.2, 0.0], [0.2, 0.3], [0.0, 0.3]],
          "edges": ["top", "right", "bottom", "left"],
          "subdivisions": 0
        },
        "grain_degrees": 0.0,
        "placement": {"translation": [0.23, 0.0, 0.0], "rotation_degrees": [0.0, 0.0, 0.0]},
        "pins": []
      }
    ],
    "seams": [{
      "id": "join-01",
      "a": {"panel": "front", "side": "right", "edge": "right", "range": [0.0, 1.0]},
      "b": {"panel": "back", "side": "left", "edge": "left", "range": [0.0, 1.0]},
      "reverse_b": true, "notches": [], "stiffness": 1000.0,
      "allow_ease": false
    }]
  }
}
```

For the current implementation, **extract `template`** as a standalone
JSON file and run `cargo run --locked --no-default-features -j 2 --bin
cloth-template -- validate <file.json>` (or its built binary). Passing native
validation proves only that this synthetic template compiles; it does not
prove the proposed wrapper, `expectedRevision`, external EXO input or GUI
loading work. A future adapter test should reject a changed/unknown edge,
wrong units, stale revision, mismatched session and EXO-only field **without
mutating the resident document**.

**Validation observed on 2026-10-22:** extracting the embedded `template`
with Python's `json` module and running the native Rust `cloth-template
validate` command against this revision produced **2 panels, 1 seam, 38
vertices, 44 triangles, 0.03 m initial staged seam gap and no compiler
warnings**. This demonstrates a compiler-valid *native* example, not a
completed EXO bridge or a simulated fit.

## Decisions needed before the protocol can ship

1. **Maintainer agreement:** approve or amend protocol name/version, field
   support table, revision lifetime, error names and named-boundary rules.
2. **Implementation ownership:** separate task for a local adapter with
   explicit read/validate/commit and conflict tests; no arbitrary code,
   unscoped filesystem actions or shell execution from request contents.
3. **Compatibility testing:** run canonical v1 rectangular, v2 polygon,
   partial/reversed/notched/chained seam, save/reopen/undo and stale-cache
   fixtures; independently reject unsupported EXO fields. Verify unchanged
   `Project` v1 / `FittingProject` v1 behavior and no unintended contact or
   solver effects before accepting an implementation.
4. **Rights:** examine [EXO provenance](https://github.com/erythrofr/ClothCraft/issues/11)
   before any code or asset transfer. This contract is original prose based on
   public functionality and Rust declarations, not an EXO source port.
