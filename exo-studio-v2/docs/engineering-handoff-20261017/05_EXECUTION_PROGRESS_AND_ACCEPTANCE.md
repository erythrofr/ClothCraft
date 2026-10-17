# EXO V2 engineering handoff — implementation progress

Updated: 2026-10-17. Scope: EXO ClothCraft Studio V2 only.

This document records **new implementation and verification activity**, not
completion of every requirement in the four source specifications. All current
modifications remain in the source worktree. This pass did **not** rebuild,
relaunch, or overwrite the user's installed native V2 application.

## Source of truth / Jarvis access

- The requested handoff is already present locally in this folder: four
  specifications/reports, README and toolbar-inventory.json. A ZIP is not
  necessary to inspect these files.
- Jarvis Mac remote SSH aliases were probed read-only. The Tailscale host name
  failed to resolve and the LAN connection timed out. Consequently no
  separate Jarvis Mac copy could be compared; the accessible V2 files were
  used as the actual execution source.
- The date-stamped inventory originally reports 19 native / 7 inspect /
  44 unavailable tool slots. The *current source registry* now reports
  21 native / 7 inspect / 42 unavailable. This is a registry/capability
  count, **not** 21 complete per-slot user acceptance signoffs.
- No reset, clean, commit, push, destructive app rebuild or CLO install
  modification was performed for this handoff work.

## Per-Markdown execution matrix

| Source document | Implemented in this pass | Verified | Still open |
| --- | --- | --- | --- |
| 01_TOOLBARS_ENGINEERING_SPEC.md | Native 2D supplemental toolbar shortcuts now route through the same verified capability/action path as the CLO strip. Missing handlers and genuinely unavailable native actions stay disabled or explain why. Added full 70-slot machine-readable acceptance comparison. | Toolbar registry 70/70 IDs; native annotation create/edit/delete/Undo/JSON reopen; native notch and seam-allowance invalid input, Undo/Redo and save. | 42 native-unavailable slots remain; per-tool operational gestures, production projects, exports and installed-app parity are not established by registry checks. |
| 02_GARMENT_HOVER_VISUAL_SPEC.md | Garment/Pattern preview opening works from keyboard focus and a visible touch affordance. Tab enters actual preview controls; Escape closes and restores initiating tile focus; moving focus between popup buttons no longer closes it. Scrolling within popup details no longer dismisses it. Existing current source shows curved unsewn source panels rather than claiming physical assembly. | New focus/touch browser QA: 7/7 interactions at desktop/mobile. Existing full-app hover QA: 1440x900 and 390x844 passed, 8 meshes, 3,743 triangles, 4 source panels and 38 source cut edges, no page errors. Screenshots archived in docs/qa/engineering-handoff-20261017/after/. | Exact IMG_6936 image unavailable; visual curved-panel arrangement still not reference-certified; no validated sewn cloth mesh, no 100-cycle GPU leakage audit or installed app verification. |
| 03_PHOTOREALISTIC_FABRIC_SPEC.md | Shared deterministic 270 cm swatch size and repeat helpers; consistent sanitized repeat dimensions for procedural maps and scans; diagnostic UV/area distortion metadata; clearer illustrative status; ordinary fabrics no longer inherit blanket clearcoat and explicit anisotropy can override family heuristics. | New fabric spec QA passed with two 3,528-triangle fixtures; existing fabric-ball geometry QA passed; full 400-PBR preset optics balance test passed (385 scan roughness-balanced / 15 procedural fallback). | Analytic fold distortions are substantial: denim total area ratio 1.131, triangle range 0.758–2.957; silk total 0.984, triangle range 0.562–2.957. Not native gravity/contact/strain simulation, not calibrated fiber/lighting parity; original CLO reference still inaccessible. |
| 04_IMPLEMENTATION_AND_VALIDATION.md | Preserved historical status; updated source-level validation without rewriting the older record. New tests and screenshots provide auditable results. | npm run build passed (1891 modules, existing large-chunk warning). Native annotation/notch/allowance integration tests passed in disposable workspaces. | Native installed app/session not rebuilt or restarted; release gating, screenshot parity and stress benchmarks remain future work. |

## Source artifacts and ownership

### Toolbar subagent

- src/components/RightToolPalette.jsx
- src/core/clo7NativeToolCapabilities.js (current native capability registry)
- scripts/qa-toolbar-handoff-20261017.mjs
- scripts/qa-toolbar-handoff-20261017.acceptance.json

The JSON matrix contains all 70 actual IDs, source handoff versus current
registry statuses, actions, engineering gaps, acceptance contracts, and
conservative NOT VERIFIED flags for end-to-end, Undo and Save/reopen until
each slot has a dedicated test. In particular, native annotation A13/A14
were added by other ongoing V2 work since the dated handoff; this pass did
not falsely claim to have authored their Rust implementation.

### Material subagent

- src/components/FabricDrapeBallPreview.jsx
- src/core/fabricBallGeometry.js
- src/core/fabricPbrAppearance.js
- scripts/qa-fabric-handoff-20261017.mjs
- docs/fabric-handoff-results-20261017.md

### Garment hover and integration

- src/components/LibraryAssetHover.jsx
- src/components/LibraryAssetHover.css
- scripts/qa-library-hover-accessibility-20261017.mjs
- scripts/qa-garment-hover-20261017.mjs — expectations reconciled with the
  current intentionally unsewn camera modes FRONT, 3/4 VIEW and SIDE
- docs/qa/engineering-handoff-20261017/after/garment-hover-1440.png
- docs/qa/engineering-handoff-20261017/after/garment-hover-390.png

## Reproducible tests

Run from EXO V2 project root. Focused commands have passed:

    node scripts/qa-toolbar-handoff-20261017.mjs --write-matrix
    node integrations/clothcraft/check-clo7-native-capabilities.mjs
    node integrations/clothcraft/qa-v2-native-annotation-api.mjs
    node integrations/clothcraft/qa-v2-notches-allowances-20261017.mjs
    node scripts/qa-fabric-handoff-20261017.mjs
    node scripts/qa-fabric-ball-geometry.mjs
    node scripts/qa-v2-handoff-six-material-benchmark-20261017.mjs
    node scripts/check-400-pbr-balance.mjs
    EXO_QA_URL=http://127.0.0.1:5199 node scripts/qa-library-hover-accessibility-20261017.mjs
    EXO_QA_URL=http://127.0.0.1:5199 EXO_QA_CYCLES=12 node scripts/qa-v2-handoff-hover-lifecycle-20261017.mjs
    EXO_QA_URL=http://127.0.0.1:5199 EXO_QA_FULL_APP=1 node scripts/qa-garment-hover-20261017.mjs
    npm run build

The interactive browser tests use Vite dev at localhost:5199; tests should
not be pointed at a Vite production preview's source-only harness path.

### Third verification wave — independent QA agents

- scripts/qa-v2-handoff-hover-lifecycle-20261017.mjs: **12 repeated actual
  Library hover open/close cycles passed** at desktop, opening exactly one
  preview popup/one preview canvas and leaving zero preview popups/canvases
  after dismissal. Focus Tab/Shift+Tab/Escape and touch-open/close checks
  also passed, with zero page errors. The test measures DOM element lifecycle,
  not retained WebGL contexts/GPU memory bytes. This is not yet the
  specified 100-cycle resource-stress signoff.
- scripts/qa-v2-handoff-six-material-benchmark-20261017.mjs: **six synthetic
  procedural fixture families passed**, each 2,401 vertices / 4,608 triangles,
  with finite flat UV coordinates, nondegenerate area ratios, valid repeat
  dimensions and explicit unmeasured provenance. Details are in
  docs/qa/engineering-handoff-20261017/fabric-benchmark-results.md.
  Across the fixtures the peak local triangle area ratio was 2.9319,
  confirming these images are illustrative rather than physically calibrated.
- Both additional worker assignments were QA-only, preserving all shared
  app/native source while independently checking the earlier implementation.

## Next implementation priorities — not falsely marked complete

1. **All toolbar operations:** implement the 42 unavailable native commands
   in prioritized user-value order with distinct Rust operation semantics,
   native Undo/Save/reopen, boundary and malformed-input tests. Move a slot to
   native only after those acceptance checks.
2. **Garment visuals:** capture IMG_6936 reference; improve shape, fabric
   thickness and all-piece layout; add explicit validated asset manifests
   rather than inventing a sewn shirt from disconnected source panels.
3. **Physical textile preview:** calibrate a 400 mm physical swatch fixture,
   real solver drape and support clearance, UV-scale ruler and independent
   six-fabric benchmark. Do not treat optical heuristics as physical proof.
4. **Integrated installed-native V2 acceptance:** plan a safe release window
   to preserve running user sessions, rebuild/install once, then execute
   documented repeatability, keyboard/touch, graphics, 2D/3D saving/export
   and actual Mac memory/frame-time tests.

**Current status: PARTIAL IMPLEMENTATION WITH PASSING FOCUSED QA.**

## Fourth implementation loop — source panels, tangent thickness, and expanded QA

This follow-up completed another bounded implementation pass without changing
the native garment solver, garment documents or the installed application.

### Source-piece coverage

The existing Library renderer silently used `slice(0,14)` for every template.
The authored **501 Jeans** template contains **24 valid pattern pieces**, so
ten were omitted while the card claimed a complete source-panel presentation.

- Added `src/core/garmentPreviewPaging.js` and panel-group controls in
  `src/components/GarmentLibraryPreview.jsx/.css`, providing **14 + 10**
  source pieces across two selectable groups in the 501 preview.
- Three fixed viewports reuse the same source panel geometry. The browser
  exposes exact source/displayed/hidden/invalid counts, page/group number,
  and source piece IDs for audit. The visible label now says
  `1–14 OF 24 SOURCE PANELS` or `15–24 OF 24 SOURCE PANELS` instead of
  implying that 24 are visible simultaneously.
- Selection is read-only; switching a preview group does not apply a template
  to a document. The group index resets when selecting a different template.
- Per-group geometry stays capped to preserve the lightweight 3-view popup
  rather than multiplying GPU buffers across every panel at once.

### Curved panel edge correctness

`src/core/garmentPreviewGeometry.js` now calculates a differential
presentation normal at each boundary point and extrudes the illustrative
cut-edge ribbon along the **local surface normal**, not world-Z. Curved
sleeves and panels no longer receive a fixed-axis rim regardless of their
orientation. Both surface and rim carry source IDs and
`presentationOnly=true` metadata. The visual width remains an
**illustrative** thickness, not a fabric measurement.

### Tests and concurrent-build handling

- `node scripts/qa-garment-preview-paging-20261017.mjs` — **PASS**.
  Verified all 24 original 501 IDs exactly once across groups of 14/10,
  clamped page bounds, explicit invalid-piece counts, non-world-Z normal
  extrusion, and desktop 1440px/mobile 390px page switching without JS
  errors.
- Historical hover tests were updated to the current static three-view
  renderer (one WebGL context) rather than requiring obsolete single-view
  rotate/exploded controls. Full-app hover tests passed on desktop and mobile.
  Keyboard/touch focus tests passed **7/7** and popup lifecycle passed
  **12/12** open/close cycles with no extra popup canvases.
- Independent agents added
  `integrations/clothcraft/qa-v2-handoff-tool-dispatch-20261017.mjs`
  (real React component callbacks under a test host: **six routing checks
  passed**, no Rust mutation claim) and
  `scripts/qa-v2-handoff-fabric-stress-20261017.mjs`
  (**252 synthetic swatch meshes**, 12 invalid texture repeat inputs, 10
  provenance assertions; all passed). The fabric test explicitly warns that
  all 252 meshes violate its local area-conservation threshold; it does
  not establish physical drape fidelity.
- A default `npm run build` attempt encountered an `ENOTEMPTY` on
  shared `dist/fabric-scans` while another build was writing that folder.
  Rather than deleting or racing shared output, an isolated
  `npx vite build --outDir /tmp/exo-v2-handoff-loop2-build-20261017`
  **passed**. The existing large-chunk warning remains.

**Still unresolved:** the 42 unavailable native toolbar slots, native
cloth/contact benchmarks, physically calibrated fabric scans, exact visual
parity with reference IMG_6936, and installed-native application verification.
