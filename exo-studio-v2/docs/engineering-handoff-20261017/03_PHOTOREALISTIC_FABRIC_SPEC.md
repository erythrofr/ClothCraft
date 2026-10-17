# EXO ClothCraft Studio V2 — photorealistic fabric engineering specification

Date: 2026-10-17. Target: `/Users/mikylecouto/Chat On Steroids Workspace/exo-clothcraft-v2`, specifically its left Fabric Library, hover/detail preview and native V2 garment materials. This is an execution plan, not a claim that photorealism is already achieved.

## 1. Goal and external reference

Reference URL: https://connect.clo-set.com/detail/83716d480d604d17bdbed2920ae4ae16

Automated fetch returned HTTP 403/challenge; the reference pixels/material metadata were not inspected. Obtain a user-provided screenshot or view through an authorized interactive browser before visual signoff. Do not bypass access controls or copy protected material assets. The target from the user's description is clear: **a real-looking fabric sheet draped over a ball**, with visible weave, yarn texture, color variation, convincing lighting, hanging corners and folds—not merely a sphere painted with a fabric image.

Success has three separate dimensions:

1. **Surface realism:** real-scale weave, believable fibers/roughness/sheen/color.
2. **Drape realism:** gravity-shaped folds, appropriate stiffness/weight response and collision-clear support.
3. **Presentation realism:** photographic lighting, camera, shadows, color management and consistent UI rendering.

A good shader cannot repair implausible drape; a good cloth mesh cannot repair incorrect UV scale; a path tracer cannot recover nonexistent material data.

## 2. Verified current source and gaps

- `FabricDrapeBallPreview.jsx`: already renders a square sheet over a ball, not just a bare sphere. `createPreviewDrapeGeometry` is deterministic analytic posing based on estimated bend/GSM; it explicitly does **not** run the native solver.
- Current optical sheet uses a 270 cm span and repeats maps by `270 / repeatWidthCm` and `270 / repeatHeightCm`. This is internally declared, but needs a calibrated physical specimen scene rather than arbitrary presentation sizing. Keep units explicit and test conversion.
- Current lighting uses hemisphere + directional sources, a dark background and a gradient shadow plane. A gradient is not geometric contact shadow or self-shadowing.
- Image loading includes licensed-scan paths, procedural fallback, scan tinting and roughness balancing. Current preview explicitly loads albedo, normal and roughness; do not assume all opacity, height, transmission or anisotropy maps are implemented there.
- `ClothCraftFabricLibrary.jsx` already mounts the draped preview. `FabricMaterialPreview.jsx` is a separate preview path; `ClothCraftSceneV2.jsx`/`clothcraftFabricSurface.js` are the native garment rendering path. These must share a single material interpretation.
- Related modules: `fabricBallGeometry.js`, `fabricSurfaceModel.js`, `textileProcedurals.js`, `fabricPbrAppearance.js`, `photographicScanToning.js`.
- Existing 400-fabric catalog and scan audit scripts are useful inventories, not evidence that 400 distinct calibrated fabric scans or measured physical materials exist. Keep scanned, procedural, recolored and estimated provenance distinct.

## 3. Scope / deliverables

Deliver: versioned fabric schema; asset validation/ingestion; calibrated rendering service/component; reusable drape fixtures; real-time preview and optional high-quality cached still; shared garment/ball material conversion; native physics parameter mapping; UI states/controls; six-material benchmark suite; visual evidence; performance metrics; migration/rollback report.

Do not rewrite the application, implement all cloth physics from scratch, or start expensive rendering/simulation for every catalog item. First prove six representative materials, then batch only after correctness and resource budgets are demonstrated.

## 4. Material data contract

Proposed schema (adapt existing fields and migrate compatibly):

```json
{
  "schemaVersion": 2,
  "id": "stable-fabric-id",
  "revision": 1,
  "name": "Cotton twill",
  "construction": {"family": "twill", "repeatMm": [20, 20], "warpYarnsPerCm": null, "weftYarnsPerCm": null},
  "optical": {
    "baseColorFactorLinear": [1, 1, 1],
    "roughnessFactor": 0.8,
    "metalness": 0,
    "normalConvention": "OpenGL",
    "normalStrength": 1,
    "heightScaleMm": 0.15,
    "sheen": 0.3,
    "anisotropy": 0,
    "transmission": 0
  },
  "physical": {"gsm": 240, "thicknessMm": 0.6, "warpStretch": null, "weftStretch": null, "shear": null, "bendWarp": null, "bendWeft": null, "friction": null, "calibrationStatus": "estimated"},
  "assets": {
    "baseColor": {"uri": "asset:sha256", "colorSpace": "sRGB"},
    "normal": {"uri": "asset:sha256", "colorSpace": "linear"},
    "roughness": {"uri": "asset:sha256", "colorSpace": "linear"},
    "height": null,
    "opacity": null
  },
  "provenance": {"kind": "procedural", "source": null, "license": null, "generatorVersion": "version-id"}
}
```

Numbers above illustrate structure, not calibrated textile facts. Define dimensions/units for every physical coefficient against the actual native solver model; generic normalized slider values cannot be mislabeled SI constants. Missing calibration stays null/estimated. Appearance parameters and physical response must remain independent.

Additional fields: bit depth, dimensions, channel packing, physical scan dimensions, warp direction, source hash, crop/tiling transform, per-panel UV transform, colorway derivation, opacity mode, displacement midpoint, renderer profile and validation report. Use content-addressed local assets; save projects with portable references or packaged maps, never expiring blob URLs.

## 5. Asset ingestion / backend pipeline

1. **Register source:** licensed scan or user-owned photo/procedural recipe; record source, license, attribution and restrictions. Recolored versions retain original scan identity and derived-colorway metadata.
2. **Decode/validate:** dimension/pixel limits, supported formats, finite parameters, channel count, correct color space, normal convention, matching crop/aspect and physical scan size. Corrupt files reject atomically.
3. **Normalize non-destructively:** preserve originals; generate deterministic derived assets with pipeline version/hash. Strip baked directional illumination where feasible; do not claim measured albedo from an uncontrolled photo.
4. **Prepare maps:** seamless color, normal, roughness, optional height, opacity, anisotropy direction/strength and translucency. Derived maps must be labeled estimated. Photo-to-normal is not a substitute for a measured scan.
5. **Tile QA:** repeated 3×3 view, edge discontinuity, normal seams, directional continuity and autocorrelation to catch conspicuous repetition. Use deterministic variation that does not change repeat scale or randomize every frame.
6. **Generate LODs:** 512 px thumbnail tier, 1–2K interactive, 4K closeup only on demand; measured benefits before larger textures. KTX2/Basis may reduce GPU memory, but compare normal/roughness fidelity and device support. Preserve high-bit-depth height in offline source pipeline.
7. **Cache/publish locally:** asset manifest keyed by source hash + transforms + material schema + generator version. Atomic output writes; interrupted jobs resume from last completed stage without duplicate catalog records.
8. **Validation evidence:** attach provenance, checks, rendered neutral/oblique samples, scale ruler and family identification. Catalog entries without required maps remain available as honest fallback, not “scanned photorealistic.”

Proposed asynchronous asset job API may reuse existing local worker infrastructure: submit material revision + renderer profile, query stage/progress, cancel, fetch manifest. Limit concurrency and preserve native simulation responsiveness. Never run preprocessing inside React render or pointermove.

## 6. Geometry: cloth over a ball

### Calibrated benchmark scene

Choose and version an explicit physical scene, e.g. 200 mm support-sphere diameter, 400×400 mm swatch, material thickness and a scale ruler. These are **proposed fixture dimensions**, not measurements of the inaccessible CLO-SET asset. Scene units should be meters; convert map dimensions and solver inputs exactly once. Keep top support cap, equatorial transition, hanging skirt and all four corners visible at three-quarter angle.

A real fabric sheet has approximately preserved material area, anisotropic stretch limits and gravity-driven folds. Existing analytic posing gives an attractive fallback but can distort metric lengths/area and cannot certify material-specific drape. Compute per-triangle rest/current area ratio and principal stretch for the preview mesh. Record this as visual distortion diagnostics; reject extreme distortions rather than hiding them with texture tricks.

### Two legitimate preview tiers

- **Fast presentation:** existing analytic sheet, improved continuity/corner structure, clearly marked illustrative. No implied friction/contact calibration. Maintain UVs from flat rest coordinates.
- **Validated drape:** offline/native solver settle of swatch on support; preserve actual committed final geometry, rest UVs, mesh revision and parameter provenance. Save/cache result; hover only loads it. Test collision clearance, no flipped triangles, reasonable strain and convergence. A final collision-free frame alone does not certify the full trajectory.

Do not reuse one drape mesh for all fabric families while claiming physical response. Initial benchmark set: rigid denim, cotton poplin, jersey knit, silk/satin, wool/fleece and sheer mesh. Heavier/stiffer materials should have measurably different fold scales than light fluid fabrics when physical coefficients are calibrated. GSM alone does not determine bend stiffness.

Generate thickness along normals with seam-safe edge treatment. Use a distinct support mesh and physically consistent contact gap equal to material/collision thickness. No arbitrary screen-space offset. Avoid smooth-sphere silhouette masquerading as hanging fabric.

## 7. UV, yarn scale and deformation

1. Rest pattern coordinates are authoritative. `u = warpDistanceMm / repeatWidthMm`, `v = weftDistanceMm / repeatHeightMm`, then apply grain/UV rotation and offset in a documented order.
2. Carry rest UVs through native remeshing and deformed rendering. No world-space projection that makes weave swim when cloth moves.
3. Match all channels to identical crop, repeat, rotation and scale. Normal tangent frame follows grain and UV orientation; fix DirectX/OpenGL Y convention explicitly.
4. Separate **structure frequency** (weave/yarns), **fiber relief**, **color variation**, **print repeat**, and **macro wrinkles**. One noisy normal map cannot stand in for all five.
5. Show a labeled 10–20 mm macro patch with a scale ruler. At full-swatch distance fine weave should naturally minify; never exaggerate yarn to keep it visible everywhere.
6. Mipmaps and anisotropic filtering are required. Tune normal minification/roughness compensation to avoid sparkling/moire. Clamp anisotropy to device maximum; preserve crisp-but-stable macro detail during orbit.
7. Prefer tangent-space normal/bump for sub-pixel fibers, actual displacement only when tessellation supports it and silhouette needs it. Millimeters of displacement must convert to meters; avoid turning cloth into inflated rubber.

## 8. Shader / optical model

Create one adapter, e.g. `createFabricMaterial(materialDescriptor, rendererProfile)`, used by drape ball, macro swatch, garment and exported renders. It owns channel assignment, physical UV scale, color conversions, opacity, sheen and fallback semantics. Do not maintain separate hand-tuned interpretations in each component.

- Base color is albedo without baked lighting. sRGB textures decode to linear; lighting/compositing in linear; encode once for display.
- Ordinary textile metalness = 0. Metallic yarn/coatings require evidence and region masks, not global metalness for visual punch.
- Roughness and sheen vary by fiber/construction; satin directional lobes, velvet/fleece grazing response and cotton broad diffuse response need family-specific treatment.
- Anisotropy follows warp/tangent direction and rotates with grain; never infer all optics solely from display-name regex.
- Clearcoat is for an actual finish, not a generic fabric gloss enhancer. Avoid current blanket clearcoat behavior when no finish metadata exists.
- Sheer fabrics need coverage/opacity plus two-sided scattering/transmission as supported. Alpha blending is not physically sufficient; document real-time limits, sorting behavior and shadow transmission.
- Subtle fuzz can use a bounded shell/fin-layer method at hero scale; do not add millions of fibers to a hover. Offline renderer can support actual hair/fiber geometry for macro proof.
- Recolor in linear/material-aware space; do not multiply a dark colored scan by another saturated swatch and crush it. Neutralize original tint only when provenance and method justify it. Preserve yarn-to-yarn variation.
- Roughness balancing cannot silently replace measured data. Store transforms and allow original/derived comparison.

## 9. Lighting, camera and color management

Version a shared studio rig: large soft key 30–60 degrees off camera, broad weaker fill, restrained rim, neutral environment, matte ground. Use an authorized neutral HDRI with prefiltered environment (PMREM in Three.js) plus controlled lights. Avoid simultaneous arbitrary exposure boosts and strong ambient fill that erase weave.

Real-time: contact shadows or correctly configured shadow maps, stable bias, self-shadow where feasible, optional restrained AO that does not darken albedo. Replace painted gradient shadow as the final-quality solution. Ground shadow belongs to cloth/support geometry; no floating specimen or black halo.

Camera: calibrated three-quarter product view, moderate perspective (approximately 50–85 mm equivalent as a proposed starting point), entire cloth within frame with hanging corners visible. Macro camera uses physical patch dimensions. Fixed exposure/white balance across material comparison; no per-material auto-exposure that makes all fabrics identical.

Specify working linear color space, texture transfer functions, tone mapper, output profile and exposure. Current ACESFilmic can remain if consistently used; benchmark against offline output under matched settings. Color accuracy requires calibrated capture/display; report visual match, not spectrophotometric accuracy, without measurement. Compare color numerically under neutral unlit/albedo conditions, not directly between differently lit screenshots.

## 10. UI contract

- Library: lightweight cached thumbnails; hover detail lazily mounts one preview. Never allocate 400 WebGL canvases.
- Detail: draped ball as hero; macro weave inset; front/side/turntable controls; zoom within useful physical limits; material name, construction, GSM/thickness and provenance.
- Toggles: Studio / Neutral diagnostic lighting; Drape / Macro; optional wireframe/UV debug confined to engineering mode.
- Apply: explicit target scope (selected panel, selected set, entire garment), follows existing V2 interaction; hover and orbit do not apply. Optical changes and physical changes indicate whether re-simulation is needed.
- States: loading poster, interactive ready, high-quality render queued/ready, stale material revision, missing map with fallback, WebGL unavailable, solver unavailable/cancelled, failed asset decode.
- Updating material while a texture loads must not paint the previous fabric onto the new item. Use generation IDs and abort semantics. Dispose replaced maps after last consumer releases them.
- Native garment and preview must read the same descriptor revision. Color selection updates cached/interactive/native paths coherently; undo restores both optical and physical assignment.

## 11. High-quality render path

For hero stills/exports, use a dedicated Blender/Cycles or equivalent offline adapter, not a synchronous hover action. Feed the exact mesh/rest UV/material descriptor and scene version. Bake nothing that destroys source maps. Proposed delivery: 1024–2048 px hero PNG plus scale-labeled macro, optional transparent cutout; preserve linear EXR for renderer comparison if needed.

Choose samples by convergence/noise threshold, not a marketing number. Denoising must not erase weave; inspect both noisy/raw and denoised macro crops. Cache by material revision, geometry hash, scene/camera version and renderer settings. Jobs support cancellation and bounded concurrency. Renderer errors fall back to valid interactive preview, never a stale image from another fabric. No cloud upload or paid compute is implied by this local plan.

## 12. Performance targets (proposed, measure on target Mac)

| Tier | Budget / acceptance target |
|---|---|
| Catalog scrolling | Cached image thumbnails; no new per-row render loops; virtualization for full catalog |
| Warm hover | p95 <=250 ms after dwell; cold preview <=1 s with immediate poster |
| Interactive orbit | p95 frame <=33 ms at 760 px detail, capped DPR; no main-editor input blocking |
| GPU memory | One active preview, target <=128 MB including maps; release after close/eviction |
| Texture tiers | 512/1K/2K default; 4K only when macro/export benefit demonstrated |
| Async jobs | Bounded queue; cancellation acknowledged; last valid asset remains usable |

A single uncompressed 4K RGBA texture is about 64 MiB before mipmaps (~85 MiB with full chain). Several maps quickly exceed a small hover budget. Record actual allocations and choose LODs rather than raising limits blindly.

## 13. Quality gates / benchmark suite

For each of the six representative materials produce the same front/three-quarter/side/back, macro, albedo-only, roughness-only and UV-checker renders. Record scene, asset hashes, map provenance, repeat dimensions, renderer/device, timing and memory.

- **Geometry:** finite vertices/normals, no inverted triangles; no support penetration beyond justified numeric tolerance; no unintended holes; silhouette clearly shows sheet and corners. Validated drape also reports strain/collision/convergence evidence.
- **Scale:** known ruler across 100 mm patch matches expected repeat count within 1%; macro patch label matches actual sampled physical area.
- **Color:** albedo decode/encode reference fixture within 1/255 for unfiltered samples; any perceptual color target is measured in controlled conditions, not an arbitrary screenshot DeltaE claim.
- **Texture:** no visible UV seams, stretched grain, normal flip, moire or sparkling during orbit; warp direction matches 2D/3D.
- **Distinctness:** reviewer can distinguish denim twill, jersey loops, satin sheen, poplin weave, wool fuzz and mesh transparency under identical light—not merely by different colors.
- **Parity:** applying a fabric to a known 100 mm garment panel produces the same repeat, orientation and material interpretation as the ball/macro view.
- **Lifecycle:** rapid hover switching, 100 open/close cycles, texture load failure, WebGL context loss, offline assets, cancel during render and stale revisions all recover cleanly.
- **Reference review:** once CLO-SET pixels are available, score drape silhouette, weave readability, microrelief, highlight softness, shadow contact and color presentation separately. Require explicit human acceptance, not a blanket “looks realistic” assertion.

## 14. Execution packets and dependencies

1. **F0 baseline/reference:** inspect current V2 code, capture six existing previews, obtain reference pixels, audit catalog provenance. Deliver baseline + gap sheet.
2. **F1 schema/ingestion:** descriptor/migration, map validation, physical repeat and asset hashing. Deliver fixtures and round-trip tests; prerequisite for all later packets.
3. **F2 common renderer:** shared material adapter, UV/tangent conventions, color pipeline and cached textures. Deliver ball/garment parity test.
4. **F3 drape geometry:** calibrated sphere/swatch scene, illustrative fallback and native offline settle pipeline with quality report. Does not block F2's static calibration.
5. **F4 studio/macro:** lighting, shadows, camera, macro inset and performance budgets. Deliver six side-by-side materials.
6. **F5 high-quality adapter:** deterministic offline render manifest, queue/cache/cancel and comparison evidence.
7. **F6 UI integration:** lazy hover/detail, native assignment, focus/touch, error states and lifecycle audit.
8. **F7 scale catalog:** only after six pass, process catalog with resumable manifest; preserve estimated/scanned distinctions and failures.
9. **F8 V2 delivery:** source build, focused existing tests, actual app verification after safe packaging, screenshots and known limitations.

Observed relevant scripts to reuse after checking their assertions: `check-fabric-realism.mjs`, `check-fabric-realism-showcase.mjs`, `check-fabric-assets.mjs`, `check-scan-colorways.mjs`, `check-fabric-evidence.mjs`, `check-400-pbr-balance.mjs`, `check-400-mesh-optics.mjs`, `qa-fabric-library-hover-apply.mjs`, `qa-fabric-sidebar-400.mjs`, `qa-fabric-realism-showcase-ui.mjs`, and `integrations/clothcraft/qa-v2-fabric-library-doubleclick.mjs`. Do not claim all pass merely because files exist.

Final handoff must include source diff, descriptor schema, six reference renders, timings/memory, physics-versus-illustration labels, test logs, scan rights/provenance and exact installed-app status. Do not declare CLO-SET parity before reference inspection and matched visual review.
