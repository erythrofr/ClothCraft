# EXO hardware, trims, and material knowledge base

Research snapshot: **2026-10-16**. The specifications below distinguish official CLO/Marvelous Designer functionality, current EXO implementation, and future development. Example sizes and shading values in the EXO catalog are **illustrative**, not verified supplier specifications. Proprietary references are for feature comparison; do not redistribute vendor 3D assets.

## Sources: official product and feature documentation

1. CLO **Button Style Property**, including information, thread types, width, thickness, weight, materials, Tech Pack inclusion, and linked buttonhole width (2024.1): https://support.clo3d.com/hc/en-us/articles/115000573587--Style-Property-Button
2. CLO **Edit Button Style**, including shape picker, ligne units, dimensions, weight and open/save: https://support.clo3d.com/hc/en-us/articles/115015832688-Edit-Button-Style
3. CLO **Property Editor** selection context: https://support.clo3d.com/hc/en-us/articles/115004877468-Property-Editor
4. Marvelous Designer **Object Browser (2025.0)**, Scene/Fabric/Graphic/Button/Buttonhole/Topstitch/Puckering/Trim and zipper style (2025.1) tabs: https://support.marvelousdesigner.com/hc/en-us/articles/47358171722265-Object-Browser-Ver-2025-0
5. Marvelous Designer **Button Property Editor (2025.0)**: https://support.marvelousdesigner.com/hc/en-us/articles/47358121260441-Button-Property-Editor-ver-2025-0
6. Marvelous Designer **Button Property Setting**, including angle, thread length (0–1 cm), collision, 2D measurements and polygon optimization: https://support.marvelousdesigner.com/hc/en-us/articles/47358408637721-Button-Property-Setting
7. Marvelous Designer **Button Thread Material**: Cross/Parallel/Square and independent material/texture/color/glossiness/opacity: https://support.marvelousdesigner.com/hc/en-us/articles/47358460972057-BUTTON-STYLE-PROPERTIES-Button-Thread-Material-Above-ver4-2-0
8. Marvelous Designer **Register Custom OBJ as Button**, mesh naming conventions `REN_BUTTON` and `REN_THREAD`, multiple OBJ sizes: https://support.marvelousdesigner.com/hc/en-us/articles/47358452715161-ADD-CUSTOM-BUTTON-AND-BUTTONHOLE-Register-Custom-OBJ-as-Button
9. Marvelous Designer **Zipper Style**, one/two-way configurations, gauge, individual component dimensions, reusable style and .ZPS: https://support.marvelousdesigner.com/hc/en-us/articles/48920706512665-ZIPPER-Zipper-Style
10. Marvelous Designer **Zipper Tape Properties**, width, thickness, particle distance, tooth/OBJ mode, chain width and fold: https://support.marvelousdesigner.com/hc/en-us/articles/47358231940889-ZIPPER-Zipper-Tape-Properties
11. Marvelous Designer **Independent zipper component materials**: https://support.marvelousdesigner.com/hc/en-us/articles/47358264161433-ZIPPER-Assign-Different-Materials-to-Slider-Puller-Stopper-Teeth
12. Marvelous Designer **Create Zippers**, two-edge placement and simulation interaction: https://support.marvelousdesigner.com/hc/en-us/articles/47358168494745-ZIPPER-Create-Zippers
13. Official **Marvelous Designer 2026.1 release** lists improved zipper placement, zipper end extension, pinching and seamline ripping beta: https://www.marvelousdesigner.com/products/release

Official release features are targets for parity, not evidence EXO has implemented those tools. Some documented menus/features differ between CLO and Marvelous Designer versions.

## Desired editor journey

Left **Library > Materials > Hardware & Trims** opens nested groups for Buttons, Buttonholes, Zippers, Snaps, Eyelets/Grommets, Rivets, Buckles/Adjusters, Cord Stops, Labels/Patches and Imported 3D Trims. Every result is a real thumbnail with name, type, dimensional unit and material. Selecting a style highlights it; dragging or applying it to a pattern creates an instance anchored to a piece (or a paired edge/path for a zipper).

Right **Object Browser** lists scene hardware by category and style. Select a style to edit all linked instances or select a single instance to override rotation, position, thread length, collision and geometry optimization. The corresponding **Property Editor** lives within the right docked panel and exposes collapsible Information, Shape/Dimensions, Construction, Material, Thread Material, Attachment, Simulation, LOD and Production/Tech Pack sections. Never use a blocking center-screen dialog for routine hardware editing. Keep selection synchronized across 2D, 3D, Object Browser and inspector.

Style change propagation must be explicit: editing a shared style updates all instances inheriting it; an instance override stays local. Expose **Reset to Style**, **Duplicate Style**, **Replace Style** and **Save Style**. Store stable style and instance IDs, avoid coupling scene-graph object identity to displayed labels, and include undo/redo transactions.

## Data contract and metadata

A hardware definition should contain:

| Field group | Suggested fields | Purpose |
| --- | --- | --- |
| Identity | id, name, kind, subkind, vendorId?, SKU?, revision, source, license | Durable reference and provenance |
| Dimensions in mm | width, height, diameter, thickness, holeDiameter, holeSpacing, shankHeight, postLength, gripRange | Shape and technical spec; preserve units |
| Geometry | meshUri?, primitiveType, orientation, pivot, transforms, geometryVariants, LODs, bevelRadius | Full physical silhouette and performance |
| Materials | slots by mesh part: baseColor, metalness, roughness, normal, roughnessMap, metallicMap, opacity, transmission, clearcoat, anisotropy | 3D appearance |
| Thread | stitchPattern, threadLengthCm, threadCount, threadMaterial, threadColor, loopOffset | Visible attachment |
| Attachment | garmentPieceId, localUV/localXY, faceNormal, edgeId?, pathRange?, mountType, pairedWithId?, layerIndex | Position and relationship |
| Collision | enabled, rigidShape?, massG?, contactOffset, friction, bendConstraint? | Simulation, once solver supports it |
| Production | supplier, MOQ?, finishCode?, materialComposition?, needle/stitch guidance, washTest?, nickelCompliance?, BOMQty | Tech pack and purchasing |
| Validation | units, measurementStatus, sourceDocument, testRecord?, reviewDate | Prevent artistic examples from becoming manufacturing dimensions |

Store asset definitions separately from garment instances. Example normalized instance: `{id, hardwarePresetId, garmentPieceId, xCm, yCm, rotationDeg, materialOverrides, linkedStyle: true}`. For a zipper use `{leftEdgeRef, rightEdgeRef, startOffsetCm, endOffsetCm, sliderFraction, separating}` and component-specific materials. For sew-through buttons, hole spacing and actual hole depth must agree with geometry; for tack/rivet fittings, validate shaft length against the fabric stack.

## Material renderer requirements

Use linear-light physically based shading, correctly tagged sRGB base-color maps and linear roughness/metalness/normal maps, environment lighting, shadowing and an exposure-controlled tone mapper. Offer roughness, metallic, base color, normal intensity and map tiling per material slot; use clearcoat for varnished resin and anisotropy for directional brushing if supported. Separate shader slots for metal rim/resin center, thread, zipper chain/tape/puller/slider and snaps' cap/socket/stud/post. PBR slider numbers are *appearance tuning*, not measurable supplier properties.

Geometry requires correct physical scale: 1 mm = 0.001 m in Three.js and 0.1 cm for pattern annotations; do not multiply twice. Orient button fronts along fabric surface normals. Render front/back/shank and actual perforations, with bevels, depth and proper occlusion. Compute stable local attachment transforms from barycentric coordinates on the garment mesh and update them after remeshing; surface anchors must not drift as the cloth deforms. Use GLB/glTF for runtime meshes, with optional OBJ import conversion/validation. Avoid treating plain circles or normal-map details as sufficient for high-fidelity closeups.

Provide progressive mesh quality (preview/render), lazy thumbnail loading, GPU instancing for repeated fittings where possible, cached geometry, and a slider for polygon count. Use bounded maps and texture compression for large inventories. Test both dark and light materials under neutral studio, low-key and outdoor HDRI settings with an on-screen ruler or known-size calibration object.

## Current EXO implementation (source-audited 2026-10-16)

- `src/data/hardwarePresets.js` exposes `HARDWARE_PRESETS`, `HARDWARE_KINDS`, `listHardwarePresets`, `getHardwarePreset`, `hardwareToPatternAnnotation`. It now contains expanded **illustrative** catalog button variants, plus zippers, snaps, rivets and buckles.
- `src/App.jsx` imports that registry and supports choosing/appending buttons, buttonholes and zippers to pattern collections; placements reference `hardwarePresetId`.
- `src/components/HardwareButton3D.js` creates physically scaled beveled button meshes, actual 2/4 drilled holes, square/oval button outlines, shanks/tacks, separate visible stitch strands, material roughness, metalness and clearcoat. `src/components/GarmentViewport.jsx` anchors these to animated garment normals. They remain appearance geometry without rigid-body collision or supplier-certified manufacturing specifications.
- `src/components/HardwareLibrary.jsx`, `src/components/CloUI.jsx`, `src/components/CloPropertyEditorAccordion.jsx` and `src/core/cloPropertyCommands.js` now link a selected library style to the docked right Object Browser and editable instance width/thickness/thread/PBR fields; placement is explicit and works on EXO draft garment pieces.
- `public/hardware-thumbnails/` contains **28 separately baked 352×352 Three.js rendered covers** for all published hardware presets, generated through `scripts/generate-hardware-thumbnails.mjs`. The left Library and Object Browser use those actual mesh renders rather than flat CSS placeholders. They are artistic studio renders, not manufacturer photos or physically scanned texture data.
- `src/components/ZipperHardware3D.js` and `src/components/GarmentViewport.jsx` now assemble deforming zipper tape geometry, instanced teeth, slider housing and puller, and end stops on EXO draft patterns. Button and zipper shader parameters are appearance values. The zipper is attached to the draft garment mesh, but this does not imply native solver rigid contact.
- The zipper tape uses a repeatable procedural woven normal/roughness map with physical-distance UVs; metal parts receive subtle roughness variation. These texture maps use linear data and require real fabric/metal scans before any measured supplier-fidelity claim.
- `src/components/ButtonholeHardware3D.js` replaced schematic flat buttonhole boxes with 3D recessed-looking opening, satin stitches and raised thread borders for round-end and keyhole presets. This is an overlay: underlying cloth topology is not actually perforated.
- The right Property Editor can now edit zipper instances with a slider, fasten toggle, end extension (0–80 mm), chain/tape/tooth dimensions and distinct tape, teeth, slider, puller and stopper colors. Explicitly linking an existing sewn edge pair updates the EXO draft seam's `openFraction` and can visually disengage teeth; arbitrary unpaired annotations remain visual hardware.
- Snap/rivet/buckle records are currently **catalog-only** without a confirmed placement/editor bridge. Do not mark them usable in 3D until a live selection/placement workflow and a rendered instance are verified.
- This knowledge-base work does **not** implement an advanced rigid fastener solver, fully validated production BOM, manufacturer-specific compliance claims, or parity with all CLO/MD 2026.1 features.

## Parity and development matrix

| Feature | CLO / Marvelous Designer reference | EXO status in audited files | Completion criteria |
| --- | --- | --- | --- |
| Button library by style | Object Browser Button tab | Registry + selection/placement code | Searchable docked category grid; scene styles and presets separated |
| Diameter/width and thickness | Button Style Property | Registry supports dimensions; circular viewport geometry | Editable docked fields update live 2D, 3D, persistence |
| Custom button shape OBJ | Register Custom OBJ as Button | Not demonstrated | Import, validate mesh, pivot, front/back, hole geometry and size variants |
| Weight and thread type | Button properties | Metadata partial | Thread topology & independent color/material; mass field retained |
| Realistic metal/resin finishes | Button Material | PBR hints in registry | True mesh part material slots, HDRI inspection and textures |
| Buttonhole linkage | CLO linked fastened buttonhole width | Pair IDs in App | Bidirectional constrained changes with override and tests |
| Fastener collision and active fastening | Button Property Setting | Approximate visuals | Solver-backed rigid collision and constraints, open/close tests |
| Zipper component controls | MD Zipper Style/Material | **Implemented in EXO draft as visible 3D components** with property edits | Next: component-specific PBR maps, slider rigid contact, supplier accuracy |
| Zipper placement/end extension | MD 2026.1 release | **Partial:** edge-following 3D tape, pair selection, slider and visual terminal extension | Next: full directional end choice, correct constrained zipper tape physics, preview drag ghost |
| Snaps and rivets | Hardware catalog direction | Data entries only | Pair assembly, layer thickness checks, editor + viewport |
| Eyelets/grommets | Planned catalog | No item in current registry | Cut/perforation + ring/washer placement and collision |
| Fabric labels / patches | Planned trim category | Not audited/verified | Woven/printed/embossed materials, stitches and BOM metadata |
| Manufacturing grade validation | Supplier specific | Illustrative dimensions only | Attach supplier technical drawings, measured samples and test provenance |

## High-value end-to-end acceptance scenarios

1. **Dress shirt:** pick 11 mm four-hole pearl button; place 7 along placket; set cross thread white; drag matching buttonholes; enlarge shared style to 12 mm; verify paired widths, count and export BOM.
2. **Tailored coat:** place 22 mm metal shank buttons; adjust coat-weight thread shank and independent stitch material; toggle fastening and confirm button/cloth contact in both poses.
3. **Moto jacket:** dark nickel snap cap/socket with realistic recessed face and a separating #8 molded zipper. Independently edit puller, slider, teeth and tape; test closed/open, thick leather overlap and side profile.
4. **Raw denim:** jean tack button, copper rivets, metal fly zipper and waistband buttonhole; confirm grip range, rivet pairing, zipper length and tech pack totals.
5. **Utility bag:** webbing tri-glide, D-ring, grommet and metal cord end; inspect strap threading and stresses before accepting solver-level behavior.
6. **Luxury branding:** two-material gold-rim button with emblem geometry, leather embossed patch and sewn woven care label; export materials, licenses, placements and thumbnails.
7. **High count:** 80 small buttons on a garment and dozens of trim instances; check frame time, texture memory, selection, undo and no instance drift through simulated drape.
8. **Round trip:** save project, reopen, verify instance IDs, local placement, link inheritance, textures and 2D/3D selection; test unknown/missing external mesh fallback transparently.

## Build sequence

1. Normalize type definitions, validation and style-vs-instance state. Add data migration tests for old `piece.buttons[]` structures.
2. Add the docked left inventory and right Object Browser inspector. Prove selection/apply/modify/undo/persist across multiple garments.
3. Implement physically scaled procedural round, square, domed, shank, tack and toggle geometry; build stitching and independent material slots.
4. Support external glTF/OBJ trim meshes, secure local asset management, preview thumbnails, optimization and licensing.
5. Build zipper topology and per-component controls; implement matching edge and slider operations.
6. Add snaps, rivets, grommets and labels with genuine attachments and support for different layers.
7. Integrate the suitable rigid/cloth coupling backend; only claim collision or fastening physics after measurable tests.
8. Add supplier spec calibration, BOM/tech-pack output, regression fixtures, mobile/desktop dock layout QA and high-load rendering tests.

## 2026.1 verified release parity: exact scope and truth labels

The official [Marvelous Designer 2026.1 release page](https://www.marvelousdesigner.com/products/release) and [August 24, 2026 announcement](https://www.marvelousdesigner.com/resources/newsroom/448aa11bc06d4b91a63668ca1d12a96e) are the references for this matrix. These are **Marvelous Designer capabilities**, not automatically features of CLO or EXO. The older CLO button property reference is separately linked above; it establishes button parameter expectations, not any particular Marvelous Designer 2026.1 simulation capability.

| Official MD 2026.1 item | Verified vendor behavior and specific official source | EXO truthful state | Recommended scope |
| --- | --- | --- | --- |
| **Brush Pinching** | Stroke-based push/pull on simulated cloth; size, focal radius, lazy distance, stroke weight display, strength, inward direction and averaged normals in [Brush Pinching manual](https://support.marvelousdesigner.com/hc/en-us/articles/59781111736345-Brush-Pinching) | **Unimplemented as verified MD-equivalent tool** | Independent cloth-sculpt interaction after hardware editor quality gates |
| **Pinching Simulation Override** | Temporary override of global/fabric simulation values; rest-shape update/reset in [official manual](https://support.marvelousdesigner.com/hc/en-us/articles/59782132043289-Pinching-Simulation-Override) | **Unimplemented as verified override** | Separate transient settings transaction from saved cloth material parameters |
| **Seamline Ripping Tool [Beta]** | Part/full seam designated rip area, force-driven opening/fraying with rip and fray properties; [official manual](https://support.marvelousdesigner.com/hc/en-us/articles/59816167297433-Seamline-Rip) | **Unimplemented as solver-backed ripping** | Research branch only after topology and seam constraints have rigorous tests; preserve Beta label |
| **MacOS GPU Simulation** | Metal-based simulation on Apple Silicon per [2026.1 release](https://www.marvelousdesigner.com/products/release) | **No verified parity**; any existing EXO native or WebGL work does not establish Metal cloth solver parity | Benchmark existing EXO backend on Apple Silicon; investigate Metal only against measured bottlenecks |
| **Garment OBJ UV Preservation** | Preserves original UVs **and material data when OBJ is imported as a Garment** per [2026.1 release](https://www.marvelousdesigner.com/products/release) | **Unverified / not established as implemented**; generic OBJ model import is not the same test | Preserve per-corner UVs, smoothing, groups, `mtllib`, material assignment and texture paths on a garment-import round trip |
| **Zipper Placement Improvement** | Better zipper alignment and ghost behavior per [2026.1 release](https://www.marvelousdesigner.com/products/release) | **No verified equivalent** | Correct paired edge alignment, slanted segments, reversed seams and preview under movement |
| **Zipper End Extension** | User-specified extension length/direction on curved/slanted edges, confirmed by [2026.1 release](https://www.marvelousdesigner.com/products/release) and [Zipper Style manual](https://support.marvelousdesigner.com/hc/en-us/articles/48920706512665-ZIPPER-Zipper-Style) | **Partial, visually verified:** a shared millimeter end extension changes EXO 3D terminal geometry; independent end direction and cloth coupling are unimplemented | Store separate start/end extension, choose direction, enforce consistent tape/path on curved seams |
| **Align Collision Direction with Render Direction** | Align thickness directions in [release notes](https://www.marvelousdesigner.com/products/release) | **Unverified** | Debug normal, visual thickness direction and contact offset side by side |
| **Variable Fold Angle** | Separate fold angle at either end of an internal line per [release](https://www.marvelousdesigner.com/products/release) | **Unverified** | Defer until fold controls and solver response can be observed |
| **Time-Based Autosave** | Multiple recovery versions per [release](https://www.marvelousdesigner.com/products/release) | **Versioned time-based recovery unverified** | Atomic snapshots, retention and corruption recovery tests |

**Parity language rule:** say “cataloged”, “rendered”, “editable”, “persistent”, “simulated”, or “validated” only when separately demonstrated by code and an acceptance run. A screenshot of an inspector is evidence of layout, not evidence of a solver. Mark every roadmap feature **proposed**, **in progress**, **implemented but unverified**, or **verified with test evidence**. Claims about CLO and Marvelous Designer must retain product/version attribution. The MD announcement describes Beta seam ripping; do not generalize it as fully released production quality.

## Scene graph, style inheritance and selection protocol

Maintain a serializable **document graph** distinct from the Three.js runtime scene graph. The document graph owns identity and edits; the rendering layer is a disposable projection. Proposed conceptual hierarchy:

```text
Project
  ├─ AssetLibrary
  │    ├─ HardwareStyle[id] → dimensions, construction, materialSlotRefs, geometryAssetRef
  │    ├─ MaterialDefinition[id] → PBR maps and sampler settings
  │    └─ MeshAsset[id] → GLB/OBJ provenance, bounds, UVs, submeshes, license
  ├─ Garment[id]
  │    ├─ PatternPiece[id] → edges, seam refs, deformation mesh
  │    ├─ HardwareInstance[id] → styleId, pieceId, surfaceAnchor, overrides
  │    ├─ PairedFastener[id] → buttonId, buttonholeId, connection state
  │    └─ ZipperAssembly[id] → edgePair, path alignment, end extensions, parts
  └─ SceneState → selectionId, activeMode, visibility, camera, viewport quality

Runtime Three.js (derived, never canonical)
  garment meshes + attachment transforms + shared geometry/material caches
```

**Selection workflow:** select a library style to stage placement; clicking a supported pattern creates an instance and clears only placement state; clicking a placed mesh or its 2D marker resolves the same instance ID; selecting it in the right Object Browser focuses the same object; editing properties opens one undoable transaction. Multi-selection supports bulk style assignment but respects locked per-instance values. Deleting an instance must remove or explicitly mark its pair relation; deleting a used library style must request replacement or preserve a frozen embedded copy.

**Anchor resilience:** store a semantic anchor (pattern piece ID, 2D pattern coordinates, side, layer and orientation) as canonical; cache triangle index + barycentric weights as an optimization only. Triangle indices become invalid after remeshing. Reproject from 2D pattern coordinates after triangulation changes, then compute local tangent frame from edges or UV derivatives and align the trim face to the deformed normal. For seam/zipper anchors store paired ordered edge IDs and normalized arclength coordinates rather than raw transient vertices.

**Asset ownership:** loaded mesh geometry and map textures should be reference-counted across instances. Duplicate style creates new style ID while optionally sharing immutable mesh asset and maps. A single editor action must not mutate a cached Three.js material used by unrelated style instances; use explicit copy-on-write. A mesh with a negative determinant requires winding/normal handling. Preserve custom pivot, unit scale, UV sets, material slot names and handedness on import.

**Recommended action commands:** `ADD_HARDWARE_INSTANCE`, `SET_INSTANCE_OVERRIDE`, `CHANGE_HARDWARE_STYLE`, `REPLACE_HARDWARE_STYLE`, `PAIR_FASTENERS`, `UNPAIR_FASTENERS`, `UPDATE_ZIPPER_PATH`, `SET_ZIPPER_EXTENSION`, `IMPORT_HARDWARE_MESH`, `DELETE_HARDWARE_INSTANCE`. Each command carries stable IDs, before/after values for undo, document revision, and validation errors. Render and save are deterministic projections of accepted document state.

## Persisted project schema and migration rules

The following is a **proposed target contract**, not an assertion that EXO currently saves this structure:

```json
{
  "schemaVersion": 3,
  "units": { "patterns": "cm", "hardware": "mm", "runtime": "m" },
  "hardwareStyles": {
    "style-shirt-11": {
      "id": "style-shirt-11", "kind": "button", "shape": "round",
      "dimensionsMm": { "diameter": 11, "thickness": 2, "holeDiameter": 1.4 },
      "geometryAssetId": "mesh-button-4hole-v1",
      "materialSlots": { "shell": "mat-ivory", "thread": "mat-thread-white" },
      "source": { "type": "illustrative-preset", "measurementStatus": "estimate" }
    }
  },
  "hardwareInstances": [
    {
      "id": "instance-1", "styleId": "style-shirt-11", "pieceId": "front-left",
      "anchor": { "patternXYCm": [8.1, 32.6], "side": "front", "rotationDeg": 0 },
      "overrides": { "threadLengthCm": 0.3 }, "pairedId": "buttonhole-1"
    }
  ],
  "materials": {
    "mat-ivory": {
      "baseColor": "#e9e2d4", "metalness": 0, "roughness": 0.32,
      "textures": { "baseColor": null, "normal": null, "orm": null }
    }
  },
  "assetManifest": []
}
```

**Migration policy:** read existing `piece.buttons[]`, `piece.buttonholes[]` and `piece.zippers[]` without losing unknown fields. Treat `hardwarePresetId` as a source style reference; map legacy `diameterCm` to millimeters once at import. Build deterministic local instance IDs for missing IDs, preserve pair IDs and orientation, and keep a reversible legacy export adapter until coverage is proven. Unsupported styles load visibly as “missing mesh / retained metadata”, never silently disappear. Exporting and reimporting twice must not drift dimensions or multiply any placements. Unknown version numbers fail with clear actionable errors rather than replacing a document.

**Persistence tests:** compare canonical JSON after save/reload independent of key order; confirm count, stable IDs, style sharing, instance override precedence, zipper edge references, source attribution, material map URIs and local coordinate precision. For an absent external texture, retain its declared URI and show a deterministic fallback. Write atomically to temporary content and replace after verification; save transaction history separately from source asset bytes.

## PBR texture and mesh handoff specification

| Map/channel | Color space / interpretation | Typical application | Failure case to test |
| --- | --- | --- | --- |
| Base color / albedo | sRGB texture → linear shading; avoid baked directional light | dyed resin, leather, zipper tape, button inlay | mismatch between swatch and lit mesh |
| Metalness | Linear scalar/map: 0 dielectric, 1 ideal metal | steel, brass, copper, plating | painted dark metal mistakenly reads as black plastic |
| Roughness | Linear scalar/map, 0 glossy → 1 diffuse microfacets | brushed nickel, matte polymer | inverted gloss/roughness produces wet-look fabric |
| Normal | Linear tangent-space XYZ; document green-channel convention | stamped rims, woven tape, embossing | inverted normal-Y produces reversed stitching relief |
| Height/displacement | Linear; explicit millimeter scale and render-level displacement budget | engraved button crests, leather grain | displacement punches through thin button walls |
| Ambient occlusion | Linear, preferably separate from physically meaningful light | inset sewing holes, fastener crevices | multiplying AO twice creates dirty blacks |
| Alpha/opacity | Linear alpha; alpha test or blending chosen per material | mesh/net label, transparent decorative finish | sorting halos and disappearing thin faces |
| Transmission/IOR | Numeric physical material params; thickness where relevant | translucent horn/resin | unrealistic transparent metal |
| Clearcoat and clearcoat roughness | Independent material layer | polished resin, coated enamel | specular clipping in white light |
| Anisotropy | Numeric direction + supported tangent/frame mapping | radial brushed steel, machined pullers | brushing direction spins across repeated instances |
| Emissive | sRGB color map interpreted by renderer as specified | rare illuminated tech trims | unrelated exposure changes swamp garment |
| ORM packed RGB | R=occlusion, G=roughness, B=metallic by glTF convention | efficient glTF hardware assets | channels imported in wrong order |

**Per-component map slots:** button shell/insert/rim/stitches; snap cap/socket/stud/post; zipper left/right tape, teeth, slider body, puller and end stops; grommet front/washer; buckle frame/prong; woven label face/reverse/stitch. The asset inspector should show original map resolution, URI, license, color space and source, plus a checkerboard “missing/invalid map” fallback. Never fabricate scans or manufacturer testing from a procedural preset.

**Geometry test fixture:** make a calibrated 20 mm four-hole button with physically open holes and 2.5 mm thickness. Under neutral HDRI, compare front, three-quarter, edge and reverse. A 1 mm reference bar measures 1 mm under a known camera scale. Repeated buttons have identical dimensions across garment pieces, no inverted normals, no z-fighting against fabric and correct thread orientation. Imported OBJ assets with independent UV islands and MTL groups retain their segmentation after mesh conversion; verify UV at known vertices and material slot names after save/reload.

**Render quality ladder:** interactive draft mesh 24–48 radial segments, inspection 64–96, still-image export higher only where silhouette requires it. Actual limits should be profiled rather than assumed. Cache identical geometry and atlas small textures where copyright/license permits; retain higher quality materials at close zoom. Set mobile fallback behavior explicitly, including native dimensions and selectable markers even when expensive shaders are disabled.

## 32 additional implementation and product use cases

These are **future acceptance scenarios**, not claims of completed EXO functions. Each has an objectively checkable outcome.

| # | Scenario | Expected behavior and acceptance evidence |
| --- | --- | --- |
| 9 | Oxford shirt two-hole conversion | Replace seven four-hole buttons with two-hole style; maintain all anchor IDs and counts |
| 10 | Double-breasted coat shared style | 12 domed shank buttons inherit same finish; editing style roughness updates all 12 |
| 11 | Mixed gold/silver jacket | Two materials coexist on adjacent trims; editing gold does not mutate silver |
| 12 | Enamel logo shank button | Separate enamel face, metallic rim and shank; export keeps three material slots |
| 13 | Square resin blazer button | 18 mm square silhouette measures 18 mm in X/Y and does not render circular |
| 14 | Oversized oval toggle coat | 36×12 mm elongated toggle remains oriented with fabric tangent during drape |
| 15 | Pearl blouse highlight | Clearcoat glint responds to environment light while diameter remains unchanged |
| 16 | Custom four-hole sewing | Switch cross/parallel/square stitch patterns; count and thread materials visibly update |
| 17 | Shank height clearance | Change shank 3→5 mm and confirm increased front/back separation by 2 mm |
| 18 | Button rotation from inspector | Rotate 45° around surface normal; 2D marker and 3D orientation both persist |
| 19 | Thread length across thick wool | 0.2→0.6 cm thread length alters attachment mesh, not main button diameter |
| 20 | Buttonhole paired resize | Change button 11→14 mm; linked hole receives configured clearance, overrides remain local |
| 21 | Keyhole jacket placket | Keyhole eye correctly aligns with shank button and stays connected after mirror |
| 22 | Denim button press geometry | Cap and tack are distinct parts; selected stack depth produces validated fit warning |
| 23 | Rivet backing assembly | Front rivet and back post remain paired through transform/save/reload |
| 24 | Decorative studs on leather | 40 instances share geometry without unique 4K textures; count remains exactly 40 |
| 25 | Four-part snap pair | Cap/socket/stud/post use four selectable meshes and cannot be closed against themselves |
| 26 | Hidden jacket snap | Socket/receiver hidden beneath overlap; 3D select works with transparency mode |
| 27 | Rain shell waterproof snap | Color/roughness variants and supplier test fields survive tech pack export |
| 28 | Eyelet and washer | Ring diameter, inner opening and reverse washer are measurable and paired |
| 29 | Hoodie drawcord eyelets | Two symmetric eyelets mirror without reversing texture normals |
| 30 | Lace-up corset grommets | 20 holes distribute at constant pattern arclength within declared tolerance |
| 31 | Metal jeans fly | Curved #4 zipper path retains tape/teeth/slider material slots after reopen |
| 32 | Jacket separating zip | Opening/closing state animates slider coordinate and separation where simulation supports it |
| 33 | Two-way ski jacket zip | Top and bottom sliders maintain valid ordering and independent puller meshes |
| 34 | Invisible dress zipper | Concealed coil is occluded from face view and visible from correct reverse view |
| 35 | Zipper end extension | 8 mm end extension in selected direction measures 8 ± 0.5 mm in pattern units |
| 36 | Zipper ghost placement | Drag two edge selections over a curved jacket; preview never crosses or flips tape |
| 37 | Strap tri-glide buckle | Adjust 25 mm strap width; bar spacing maintains needed clearance and mesh scale |
| 38 | Roller buckle on backpack | Frame, prong and roller remain separate movable/selectable components |
| 39 | Woven composition label | Front/back artwork, wash icons, stitch anchors and source URI persist |
| 40 | Leather debossed patch | Normal/height maps change perceived embossing without distorting fabric scale |

For cases involving fastener mechanics, waterproofing or load bearing, pass is contingent on real physical tests and supplier evidence. A successful rendered screenshot alone does not satisfy those scenarios. The eight earlier scenarios remain useful broader full-garment acceptance tests.

## Milestone order, exit gates and measured QA

Prioritize visible and reliable button workflows before developing expensive dynamic cloth interactions. Proposed targets below are **acceptance thresholds**, not measured EXO performance.

| Milestone | Work package | Measurable exit gate |
| --- | --- | --- |
| **M0 – inventory and baselines** | Capture current UI and document/preset schema and render traces | 14 button styles identified; 3 fixture garments; save/reload baseline; no undocumented feature marked verified |
| **M1 – connected button editing** | Left catalog → pattern placement → right Object Browser → property inspector | Place 10 buttons; editing width/thickness/roughness updates all intended 3D meshes within one frame; undo/redo 20 edits restores exact JSON; zero console errors |
| **M2 – closeup-grade shapes** | Square/oval/shank/tack topology, holes, thread meshes, 2–3 slot materials | Six styles pass frontal/edge/rear screenshots; width and thickness within ±0.25 mm; no missing normals or intersections in standard poses |
| **M3 – durable save/import** | Stable document IDs, overrides, mesh manifest and legacy migration | 100 repeated save/reopen cycles without lost instances, material slots or pair refs; old project fixture migrates with zero count change |
| **M4 – zipper editing** | Paired edges, tape and chain controls, 2026.1-style end extension | Straight, curved and slanted fixtures each pass left/right path alignment; 8 mm extension renders within ±0.5 mm; direction persists |
| **M5 – manufactured trim families** | Snaps, eyelets, rivets, buckles, labels and part-specific materials | Two scene fixtures per family; correct front/reverse component count; 100% schema validation; no claim of physical coupling |
| **M6 – imported mesh and texture fidelity** | OBJ→runtime GLB with UV/material slot preservation and provenance | Three multi-material OBJ fixtures retain UV values within 1e-5, correct slot names/map UV association and real-world bounds |
| **M7 – simulation and release-parity research** | Solver-backed collision/fastening; investigate Brush Pinching, ripping and Metal | Each capability gets independent repeatable numerical tests before promotion from research; unsupported features clearly marked |

**QA matrix:** desktop 1440 px and narrow 390 px widths; neutral/dark HDRI; low and high tessellation; 1, 10, 80 and 250 hardware instances; Windows and macOS where available; GPU renderer and software fallback; project schema v1/v2/v3 migration; imported missing/corrupted texture assets; duplicate/rename/delete; garment mirrored/retriangulated/draped. Inspect console warnings, JS errors, detached scene graph nodes, memory over repeated apply/delete and 2D/3D selection divergence.

**Perf budget proposal:** 80 mid-detail buttons on a representative garment should keep pointer selection response below 100 ms at the 95th percentile on the team's target Apple Silicon device, and 1440 px interactive camera navigation at or above 30 fps in a reproducible benchmark scene. Measure actual baseline and GPU memory before accepting the budget; never assert a benchmark without device, browser, renderer, scene and capture method.

**Evidence record for each milestone:** commit/revision, exact test command, fixture project hash, OS/GPU, screenshots (front/side/reverse), expected/actual dimensions, saved project diff, error count, date and reviewer. A feature is “verified” only with this artifact trail. The right panel should expose the current editing capability without quietly displaying inactive controls as if they were functional.

## Latest integration QA: rendered EXO hardware (2026-10-16)

- `node scripts/generate-hardware-thumbnails.mjs`: reproducibly creates 28 individual physically shaded 352×352 PNG covers from the local preset registry, including a distinct `two-way-outerwear-zipper` cover showing two opposing slider assemblies. Library thumbnail and selected Object Browser preview use `/hardware-thumbnails/<preset-id>.png`; generation occurs offline so browsing does not create 28 simultaneous WebGL renderers.
- `node scripts/qa-hardware-library-inspector.mjs`: desktop 1440 and mobile 390, Draft and native selection/inspection, dimensions and roughness edits, no floating dialogs or JavaScript runtime exceptions. Native placement remains disabled until an actual Rust placement command exists.
- `node scripts/qa-zipper-hardware.mjs`: verifies rendered zipper assets load, one-edge visual zipper geometry, live slider tooth engagement, slider progress, 12 mm end extension, and explicit seam pairing. The EXO draft persisted zipper seam changes from a 25% zipped slider position to `openFraction: 0.75`, unfastens to `1`, then restores `0.75` when re-fastened. Runs at 1440 and 390 widths, draft and native.
- A focused buttonhole browser probe after production build found a placed keyhole instance in the live Three.js scene as **one group with four child meshes** at both 1440 and 390 widths, with zero page exceptions. These scene counts verify geometry exists, not supplier-authentic physical fabrication.
- `npm run check:physics` and `node scripts/check-400-clo-parity.mjs` have passed following the zipper changes; this does not establish Rust rigid-body zipper or needle-thread contact accuracy.

**Unimplemented CLO/MD behaviors still requiring separate work:** dragging slider meshes directly on 3D geometry (the current dual controls are in the docked right Property Editor); true cloth-edge zipper ghost placement; fabric seam allowances stitched to separate tape cloth particles; physical slider/teeth interference and rigid-body contact; rigid-body shank and snap closure; true cutting and overcast stitches around buttonholes; independent directional extension and gap-fill on difficult curved edges; supplier mesh UV/material import; measured texture scans; native Rust solver parity. Do not treat a shaded render or successful DOM interaction as proof of rigid contact.

## Next loop: independently opening two-way zipper (2026-10-16)

This extension maintains the earlier EXO Draft single-slider project schema. `piece.zippers[]` may now store `twoWay: true`, `sliderFraction` for the primary closing pull (1 = fully closed), `bottomSliderFraction` for the opposite-end opening pull (0 = closed at that end), and `startExtensionMm`/`endExtensionMm` (each 0–80). Older assets that supply only `endExtensionMm` retain the former same-length extension behavior until the start value is customized. The right Property Editor now exposes independently adjustable sliders and an engaged-chain percentage readout, plus individual terminal dimensions. These values persist in the same undoable project editing transaction as other hardware settings.

For an explicitly paired sewn-edge seam, `syncPairedZipperSeam()` now projects both opening regions onto `seam.openStartFraction` and `seam.openEndFraction`, swapping them correctly with the selected `openFrom` direction. The existing `seam.openFraction` remains for older/single-ended paths; two-ended values take precedence only in EXO Draft browser physics. The solver releases seam stations at either open terminal, including matching interpolated virtual-seam samples, leaving closed stations between the two sliders. If the combined opening reaches a full seam length, there is no locked segment. Two sliders and their separate metal pullers animate on the corresponding deforming cloth-edge mesh, but they are still visual rigid-body approximations rather than simulated hard teeth.

**Measured verification:** `node scripts/qa-zipper-two-end-physics.mjs` passes discrete seam counts of 5 closed / 3 open from either end / 1 open at both ends / 0 fully released, and virtual-seam counts of 25 / 17 / 17 / 9 / 0. `node scripts/qa-zipper-two-way-ui.mjs` passes using the dedicated `two-way-outerwear-zipper` preset at both 1440px and 390px: two genuine Three.js slider assemblies; 92 tooth instances, 60 engaged and 32 visibly disengaged after 80% primary closure plus 15% opposite opening; 8 mm start and 14 mm end extension; reversing direction swaps openings from 0.15/0.20 to 0.20/0.15, including persisted paired seam fields; unfastening releases the seam and restoring Fasten restores the sliders' prior closure. No page JavaScript exceptions. Exact test commands, the UI build state and any future render inspections must accompany release claims.

**Still required for full physical parity:** independent physical slider collision and stop-to-stop ordering, two-way separation-pin constraints, two-way sewn tape cloth elements and seam allowance shaping, direct 3D manipulator and ghost preview, a rigged zipper-specific Rust backend protocol and solver implementation, a cloth–teeth interpenetration test, supplier-calibrated friction/strength and imported assets with verified UVs. The current implementation is visually and geometrically functional in EXO Draft, not a manufacturer-validated fastening assembly.
