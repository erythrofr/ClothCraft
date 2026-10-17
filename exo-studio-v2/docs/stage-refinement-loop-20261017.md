# EXO stage realism refinement — 2026-10-17

Four existing authored Blender room stages were refined with genuine GLB geometry and embedded image textures. The original research-source blend files were preserved unchanged. Rebuild with `/Applications/Blender.app/Contents/MacOS/Blender -b -noaudio --python scripts/new-stage-refinement-blender.py`.

| Stage | Before meshes / polygons | After meshes / polygons | After materials / embedded images | GLB bytes |
| --- | --- | --- | --- | --- |
| R02 | 41 / 6,014 | 96 / 6,344 | 9 / 6 | 1,306,176 |
| R03 | 53 / 4,958 | 108 / 5,288 | 8 / 5 | 1,185,016 |
| S01 | 25 / 3,228 | 68 / 3,486 | 8 / 5 | 1,076,844 |
| S10 | 26 / 3,234 | 65 / 3,468 | 10 / 6 | 1,154,132 |

Material improvements: generated 256×256 pixel albedo image variation for mineral limestone, poured concrete, coarse plaster, brushed metal, timber and graphite; physical roughness and metalness exported through glTF's PBR metallic-roughness model. Each image is embedded in the GLB, not dependent on runtime texture URLs. UV mapping uses Blender's existing primitive unwrap.

Geometry improvements: shallow panel joints in the rear wall, perimeter skirting and brass reveal edges, modeled recessed ceiling housing and diffusers, runway edge ticks and grooved gallery panels, studio reflector frames and floor expansion lines, garden timber screening and pool coping. Additional meshes have narrow bevel modifiers and weighted normals. Existing model origin, runway, source room shell and garment insertion anchor remain in place.

Editable refined scene files: `docs/stage-refined-blender-sources/EXO_STAGE_{R02,R03,S01,S10}_REFINED.blend`. Exported stages: `public/stage-scenes/{R02,R03,S01,S10}.glb`. The scene manifest was updated only for these four stages. The browser loads actual glTF mesh geometry.

Validation: Blender 5.1.2 background export successful for all four rooms. Direct GLB JSON inspection confirmed 96/108/68/65 mesh objects and 6/5/5/6 embedded images. The repository's `node scripts/check-stage-scenes.mjs` reported 15 ready GLBs; the five other unfinished source scenes remain out of scope.

Limits: This is a credible geometry/material pass, not a verified photoreal room. Generated procedural color textures are lightweight and retain simplified architectural geometry; the planted garden foliage is still basic spheres. Offline Cycles and on-screen browser screenshots have not been visually compared in this pass. Lighting in the editable Blender scenes is preserved, but glTF export excludes lights by current design; visual appearance in the web viewer depends on its stage environment lighting.
