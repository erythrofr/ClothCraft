# EXO ClothCraft V2: Free / Open-Source Avatar Research

Research date: 2026-10-16. Scope: a realistic, proportionally configurable **adult male fitting mannequin comparable in presentation to the CLO3D Thomas reference**, plus a reproducible female/neutral avatar family. A similar aesthetic does **not** grant permission to copy, package or publish CLO avatar geometry, likeness assets, textures or screenshots.

## Decision in brief

**Primary path: MakeHuman Community + MPFB2**. Generate and customize a clean, neutral adult male body using CC0 core graphical assets. Export a deliberately light, unoccluded simulation/collision body and a separate fully shaded, optionally rigged presentation body. Keep the original scene's fitting measurements authoritative until Rust has verified body-mesh contact support.

**Secondary path: Blender Studio Human Base Meshes v1.4.1 (CC0)** for a better sculpting and retopology reference if the MPFB torso, hands or facial anatomy is insufficient. Blender meshes are a starting shape, not an out-of-the-box parametric avatar system. Do not confuse this asset bundle with Blender Studio's different CC-BY assets.

**Available today in the workspace:**

* `public/avatars/makehuman-base.obj`, with the adjacent `MAKEHUMAN-LICENSE.ASSETS.md` notice and `README.md`.
* Original adjacent `../garment-studio/public/avatars/opensew/theo.glb` (male) and `nora.glb` (female). The adjacent opensew README states they were generated in MPFB from CC0 MakeHuman assets; revalidate the generation/texture provenance before new public distribution. Their GLBs are in the *original Garment Studio* directory, not a confirmed working V2 avatar preset.
* Original `../garment-studio/public/avatars/clo-thomas.glb` is a **reference/rights-unverified asset**; exclude from public EXO distributions and demonstrations absent separate permission.

## Candidate comparison

| Candidate | Free? | Asset rights | Thomas-style realism | Parametric fit | Fit for public EXO | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **MPFB2 / MakeHuman for Blender** | Yes | Bundled graphics and exports: **CC0**; addon code **GPL** | High *potential* after materials, skin, hair and shape work; not photoreal out of the box | Strong morph targets, rigs, proportions | **Recommended** | Preferred production pipeline; can generate a reproducible avatar family |
| **MakeHuman desktop** | Yes | Core graphics/exports **CC0**; code **AGPL** | Similar to MPFB; customization required | Strong body parameterization | **Recommended alternative** | Can generate meshes without embedding its application code |
| **Blender Studio Human Base Meshes** | Yes | Human Base Meshes v1.4.1 **CC0** | Excellent sculpt / anatomy topology foundation, but generally lacks a finished realistic look | Not equivalent to MPFB slider system | **Recommended supplemental asset** | Add skin, hair, armature and body target design if used as main base |
| **CharMorph** | Yes | Addon code open; **individual base** licenses vary (CC0, CC-BY or AGPL) | Can produce custom bodies | Good with suitable base | Conditional | Inspect each base's actual license; **do not use `mb_*` AGPL bodies as unrestricted bundled assets** |
| **MB-Lab** | Yes | Original database and generated 3D models **AGPL-3** | Good potential | Parametric | Not first choice | Source explicitly warns AGPL applies to generated 3D characters; unlike CC0, redistribution carries obligations |
| **SMPL-X** | Downloadable for research | **Noncommercial research/art** terms with distribution restrictions | Anatomically useful technical reference | Very strong shape/pose model | **Do not bundle under a free public/commercial assumption** | Obtain a separate commercial license if ever required |
| **Standalone CC0 avatar meshes (e.g. some Blendkit models)** | Sometimes | Per-asset license, verify individually | Varies | Usually limited | Optional | A free mesh/CC0 model is not necessarily an open-source generator or a rigged body |

These are qualitative engineering evaluations, **not** measured feature completion percentages or independent proof of likeness to CLO Thomas.

## Primary source links and license evidence

1. MPFB project: https://github.com/makehumancommunity/mpfb2 ; overview https://static.makehumancommunity.org/mpfb/about.html ; license https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md . MPFB offers parametric body modeling, procedural skin/eyes, rigs and assets; bundled graphical assets and exported output are CC0. **Its GPL application code is a different license from its exported assets.**
2. MakeHuman project: https://github.com/makehumancommunity/makehuman ; official licensing https://static.makehumancommunity.org/about/license.html ; repo license https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md . Core graphical assets are CC0, application code AGPL. A third-party hair, eye, skin or garment downloaded from a community repository can have its own license, even if the base is CC0.
3. Blender Studio official CC0 **Human Base Meshes v1.4.1**: https://www.blender.org/download/demo-files/ (Asset Bundles, listed as 49 MB – CC0); detailed introduction https://studio.blender.org/training/realistic-human-research/use-of-base-meshes/ . Check the specific downloaded bundle/version's licensing rather than assuming everything on the downloads page is CC0.
4. CharMorph license-by-base explanations: https://charmorph-docs.readthedocs.io/en/main/Creating%20A%20Character.html ; project https://github.com/Upliner/CharMorph . Current project documentation lists Antonia and Reom CC-BY, MB-Lab AGPL, and Vitruvian CC0; verify included files and restrictions before use.
5. MB-Lab original license: https://github.com/animate1978/MB-Lab/blob/master/license.txt ; the original repository is archived. Its generated 3D character license is not equivalent to unrestricted CC0.
6. SMPL-X official restriction: https://smpl-x.is.tuebingen.mpg.de/modellicense.html . Noncommercial availability is not permission to redistribute into a public fashion design product or use commercially.

## What the current EXO V2 actually supports

`src/components/ClothCraftSceneV2.jsx` (verified around lines 756–760 on 2026-10-16) renders `snapshot.avatar.positions` and `snapshot.avatar.triangles` using `buildIndexedMesh`. The V2 scene does **not** have a working direct OBJ/GLB visual-avatar import flow in that component. A new GLB placed under `public/avatars/` would not automatically become the Rust collision model.

`../garment-studio/src/components/GarmentViewport.jsx` is a separate, earlier application which has OBJ/GLTF loading, visual-avatar upgrade and analytic fitting collider code. Its code and assets can inform design, but should not be confused with tested Rust V2 functionality. `public/avatars/README.md` notes that the detailed MakeHuman OBJ in Garment Studio was visual-only, with an analytic measurement-driven collision reference at the time of that note.

Integration must deliberately support **two synchronized representations**:

* **Display avatar:** clean GLB/glTF with PBR skin/eye materials, stable normals, optional hair, neutral A-pose and armature. Faces and hair should not block ray selection of cloth or steal hand-mode drag events.
* **Fit/collision avatar:** solid, preferably hairless watertight or validated contact-safe triangle mesh; consistent vertex winding and no holes at the crotch, underarm, neck and finger gaps; height/waist/chest/hip values fitted to the active measurements. Rust must receive the actual body mesh and update it when pose or measurements change; display-only geometry is insufficient.

### Proposed first avatar: `EXO Male 01`

* Adult realistic male, average/slim-athletic proportions, neutral warm skin, anatomically credible face, natural short brown hair for optional presentation; avoid copying Thomas's exact distinct textures or geometry.
* **Simulation default:** short/no hair, relaxed A-pose with hands separated from hips, feet apart enough for trouser panels and stable crotch contact. Give the arms a deliberate gap from the torso for sleeve clearance.
* Expose anthropometric control inputs: stature, shoulder width, chest, waist, hip, torso length, upper/lower arm, inseam, thigh, calf and stance. Individual values must be checked against the deformed collision mesh; multiplying uniform scale is not enough.
* Store a reproducible MPFB preset and a provenance manifest: upstream repository/revision, exporter/version, exact core-vs-third-party material licenses, vertex/triangle counts, blend or source preset, units, coordinate axes, skeleton names, default pose, known measurement errors and asset SHA-256.
* Export `display.glb` and a separate `collision.obj` or native normalized triangle buffer. Keep cloth simulation deterministic relative to the collision model; use the existing snapshot transport for the actual solver mesh.

## Practical integration milestones

1. **Source/licensing gate:** Review Theo and Nora generation scripts and bundled GLB textures; isolate any outside assets. Do not introduce Thomas or other rights-unverified CLO files into public releases.
2. **Generate pilot:** Make a purpose-built MPFB avatar in Blender with stable face/body topology. Capture neutral front/side/three-quarter comparisons under the same camera/FOV as the existing fitting reference, then iterate based on qualitative match.
3. **Import pipeline:** Create an explicit, validated body mesh import path into V2's Rust-owned avatar snapshot and solver; optional GLB renderer can remain separate from the collision model. Declare transform matrix, centimeters/meters, up axis, face winding, body origin and rest pose once.
4. **Measurement consistency:** Compare generated mesh surface measurements with the UI values (including under-bust/chest, waist, hip, inseam). Maintain a mismatch diagnostic overlay until deformation and collision agree.
5. **Contact QA:** Drape T-shirt and trousers, enable gravity, move and grab cloth, reset arrangement, rotate avatar and inspect neck, shoulder, underarm, groin, knees, wrist and hem. Verify the hand tool does not move the avatar or camera accidentally and that dragging sim fabric interacts with the same solver collider the UI depicts.
6. **Avatar library:** Add male/female presets and an import model control only after the collision/selection contract works. Include license metadata on each source asset; keep the core presets free of restricted 3D content.

## Acceptance criteria for a public `EXO Male 01`

- Generated model source + license manifest checked; no CLO-derived mesh, texture, hair or third-party rights-unclear asset shipped.
- A-pose renders as a recognizable full adult body with independent anatomical legs rather than a skirt-like silhouette.
- Export/import preserves scale, handedness, orientation and pose in browser and Rust.
- Cloth contacts the **rendered** body correctly in representative moving/paused tests; any remaining analytic proxy discrepancy is disclosed.
- Morphing waist/chest changes both visible torso and collision shape and updates fitted pattern guides or explicitly warns when disconnected.
- Pose/rig control and optional display hair never obstruct cloth selection, fabric grabbing, or neutral camera orbit.
- Performance and license metadata accompany public screenshots, repository demos and distributable binaries.

**Out of scope for this research-only task:** downloading or installing additional avatar generators; importing a mesh into the Rust solver; asserting Thomas-equivalent fidelity; or distributing restricted CLO assets. This document records choices and an integration gate, not a claim that these tasks have already been implemented or QA-tested.
