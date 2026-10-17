# EXO ClothCraft Studio V2 — curved garment/pattern hover specification

Date: 2026-10-17. Target repository: `/Users/mikylecouto/Chat On Steroids Workspace/exo-clothcraft-v2` on Blender Mac. Read `01_TOOLBARS_ENGINEERING_SPEC.md` for version boundaries, preservation rules and native command architecture.

## 1. Desired result and reference status

Hovering a garment in the **left Library panel** opens a clean, substantial 3D presentation: recognizably curved fabric pattern pieces, smooth surfaces, readable contour thickness, restrained seams and studio lighting. It must not look like a flat SVG, a noisy triangulation diagram, rigid cardboard, or a collection of disconnected tube primitives masquerading as a sewn garment.

User reference: **IMG_6936**. Only its filename was delivered in this conversation; its pixels were not available for review. Exact reference matching is therefore pending attachment. This spec is based on the user's verbal direction and inspected V2 code/screenshots, not an invented description of the missing image. Once supplied, archive the original unchanged with provenance and compare curvature, arrangement, camera, background, seam weight, light direction and crop.

## 2. Existing V2 implementation — reuse it

- `src/components/LibraryAssetHover.jsx` owns delayed hover portal, screen positioning, focus opening and dismissal. Garment portal already permits interaction.
- `src/components/GarmentLibraryPreview.jsx` renders true template-derived geometry with view selectors, rotation and style/sewing/edge toggles.
- `src/core/garmentPreviewGeometry.js` contains source-boundary sampling, curved poses, subdivided panel meshes, edge thickness and stitch paths.
- `src/components/assembledTeePreviewGeometry.js` supplies a special tee illustration. It is not validated physical assembly.
- `src/App.jsx` passes this preview to both Garment and Patterns categories. Preserve existing tile activation/import behavior; hover must never apply a template.
- Existing preview has a dark studio treatment and uses a generic knit material. Exact source-family/material realism remains future work.

Inspected existing screenshot showed an assembled tee representation with disconnected/open-looking shoulder and sleeve relationships. Do not call that a physically sewn garment. The safer immediate presentation is separated, curved source panels; assembled modes remain explicit illustrations until replaced with validated geometry.

## 3. Immediate source update and concurrent-work reconciliation

Small scoped changes were applied to the V2 preview component and presentation geometry, with pre-edit backups in `docs/qa/engineering-handoff-20261017/before/`:

- Stronger smooth generic-panel curvature, reduced high-frequency ripple and wider column spacing.
- Dynamic bounding-box recalculation on orbit for camera framing.
- View-aware heading and orbit text distinguishing curved panels from illustrative assembly.
- An initial change to open on separated curved panels and avoid tee-specific assembled posing.

**Concurrent-edit observation:** another process changed these same files during validation. The latest inspected source returned the default to `three-quarter` and added a dedicated `tee-exploded` pose. Those changes were preserved, not overwritten. The generic-panel curvature/spacing, orbit reframing and view-aware labels remained in the inspected source. Therefore **do not claim that the final source now defaults to exploded mode**. Coordinate the final default/reference composition with the other active editor before further changes.

These changes are presentation-only: no solver input, sewing topology, pattern dimensions, user project, fabric assignment or native engine was altered by this task. The native app bundle was not rebuilt. Source build and preview QA status are recorded in `04_IMPLEMENTATION_AND_VALIDATION.md`. Current assembly visuals still have visible contour/attachment issues; functional QA is not a visual-quality signoff.

## 4. Final visual contract

### Geometry

Use sampled authored outlines including curves, not a generic shirt silhouette. Triangulate valid contours, preserve holes and winding, subdivide to support smooth curvature, and derive normals from the posed surface. Retain source piece IDs on meshes. A curved presentation mapping must be isolated from rest geometry and carry `presentationOnly=true` in diagnostic metadata.

Every selected template's pieces must be represented or the UI must show a declared subset/count. Remove the existing silent 14-piece cap in favor of a bounded layout strategy: large assemblies can use progressive mesh loading or selected-piece detail, but cannot falsely claim every panel is visible. Filter hidden/fused layers deliberately and explain the selection.

Use a coherent thickness shell or edge strip based on material thickness with capped visual minimum for legibility. Keep minimum exaggeration metadata; do not use exaggerated thickness for physics. Offset edge strips along actual surface normals rather than a world-Z assumption. Avoid back-face inversions, edge gaps and duplicate coplanar surfaces.

For assembled previews, use a stored, validated cloth mesh or explicit art-directed assembly asset linked to the template revision. Do not stretch panels until seams appear closed. If no assembly is available, fall back to curved panels with a truthful label. Front/back/three-quarter selectors must correspond to actual camera/view changes, not different unrelated assets.

### Composition

At desktop, use the existing large hover card (up to 760 px) only if it fits without obscuring the entire work area. On narrow screens use a tap-open detail sheet rather than depending on mouse hover. Fit the entire silhouette with approximately 8–12% visual margin. Space separated pieces so contours are unambiguous; identify a hovered panel by name without permanent label clutter. Use one calm background, soft directional key, gentle fill and low-contrast contact/shadow cues where geometrically appropriate.

Maintain the application's neutral theme. After receiving IMG_6936, choose the actual reference background/exposure rather than assuming light or dark. No new branding redesign is required.

### Fabric surface

Use the shared material contract in `03_PHOTOREALISTIC_FABRIC_SPEC.md`. Cotton, denim, rib and wool cannot all inherit the same knit texture. Thread scale stays in physical coordinates, not screen pixels. Low-amplitude normal/bump relief and appropriate sheen should reveal fabric without a plastic clearcoat. Macro weave is optional on zoom; do not inflate yarn size to force visibility at thumbnail scale.

Style, sewing and edge controls hide/show the corresponding real geometry only. Decorative seam paths must be labeled as presentation data; display source sewing relationships separately when exact stitch geometry is unavailable. Never show a floating decorative hem ring as a finished sewn hem.

## 5. Interaction state machine

`closed -> hoverPending -> opening -> ready/error -> closing -> closed`.

- Mouse/pen: existing delay can remain near 350–480 ms; cancel pending open on leave. Crossing tile-to-card gap must not flicker.
- Keyboard: focus opens discoverable preview; Tab enters interactive controls without immediately closing; Escape closes and returns focus to invoking tile. The current unconditional tile blur dismissal needs an explicit focus-within/relatedTarget policy before claiming full accessibility.
- Touch: explicit preview button or long-press with visible fallback; tapping Apply remains distinct. Preserve V2 double-click garment/fabric behavior where currently supported.
- Scrolling/reflow: dismiss or reposition deterministically; visualViewport/resize changes keep all controls reachable. Tall content scrolls inside the detail card, not offscreen.
- Rotation: pointer capture, pointer cancel/lost capture cleanup, keyboard left/right controls; reset camera. Refit on orbit/resize or use a rotation-invariant bounding sphere. Respect reduced motion; no forced perpetual spin.
- Activation: template apply/import occurs only through existing explicit tile action. Preview, view switching, toggling edges or orbiting must not change native revision or dirty the project.
- Loading/error: visible poster skeleton, ready state and honest fallback. WebGL unavailable leaves asset selection functional; no empty black rectangle.

## 6. Asset and lifecycle contract

Proposed `GarmentPreviewManifest`: templateId, templateRevision/hash, sourcePieceIds, previewKind (`curved-panels`, `illustrative-assembly`, `validated-simulation`), mesh URI/hash, materials, units, bounds, camera presets, source/reference provenance, generator version and validation report. Never mark `validated-simulation` from a posed illustration.

Cache by geometry + material + presentation version. Keep one active hover renderer; static thumbnails are cached images. Dispose geometry, textures, materials, observers and pointer handlers on close. Late async assets must check request generation and disposal state. Abort/cancel stale work when hovering another item. Bound caches by bytes and evict least-recently-used entries; do not create hundreds of hidden canvases.

Proposed budgets on the target Mac, to measure rather than assume: warm hover ready p95 <=250 ms after delay, cold <=1 s with poster fallback; orbit p95 frame <=33 ms; one active preview <=100k triangles and <=64 MB texture/GPU allocations. Establish actual baselines before tuning budgets.

## 7. Implementation sequence for the executing agent

1. Receive/read reference; record target visual rubric and preserve original.
2. Audit current source and existing worktree changes; read immediate update report to avoid reimplementing it.
3. Fix hover accessibility and deterministic lifecycle; add reference-backed composition without changing apply behavior.
4. Improve geometry thickness, all-piece handling and template-specific poses; retain source mapping.
5. Integrate shared materials, physical weave scale and studio rig.
6. Add valid assembly assets where available, with provenance and fallback; do not run expensive solves on hover.
7. Capture desktop, narrow-screen, front/side/back and macro evidence; compare with actual reference.
8. Package only after tests and user-session preservation. Report whether installed app, source preview or both were updated.

## 8. Acceptance matrix

- Tee, hoodie, trousers and skirt: expected IDs/counts, finite coordinates, valid triangles, no missing curved boundaries; no cross-panel overlap in separated layout.
- 1440×900 and 390×844: preview fully within viewport, controls reachable, no blank canvas; resize while open.
- Open from actual left Library, not only a component harness; enter card, change views, orbit, toggle all detail layers, dismiss with Escape, reopen another item.
- Native document before/after hover is identical; no simulation starts and template is not applied.
- 100 open/close cycles: one active WebGL context, no monotonically increasing retained geometry/texture count after disposal; no stale texture after rapid item changes.
- WebGL failure, malformed template, missing material, late load and zero-piece template show honest fallback with usable asset control.
- Human visual review: smooth curvature, calm light, no faceting, floating stitch rings, disconnected fake shoulders, impossible thickness or oversized weave; exact reference resemblance remains pending IMG_6936.

Existing `scripts/qa-garment-hover-20261017.mjs` is useful for component/view controls, but its default path is a source-only harness. Run against Vite dev, or set its full-app mode explicitly; Vite preview serves the production app fallback for that harness path. A passing harness is not installed-native-app verification.
