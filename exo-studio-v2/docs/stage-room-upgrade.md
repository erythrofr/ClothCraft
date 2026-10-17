# EXO stage room export and integration

The **20 original EXO .blend files** under `docs/research/clo-connect-community/blender-scenes` were inspected with Blender 5.1.2. They are authored EXO interpretations of public CONNECT listing concepts, **not downloaded CLO CONNECT seller models**. The original Blender source generator uses geometric primitives and basic procedural materials. These rooms are real mesh assets, but **they are not yet photorealistic or production-grade environments**.

Run `/Applications/Blender.app/Contents/MacOS/Blender -b -t 2 --python scripts/export-stage-scenes-blender.py` from the repository root to rebuild the binary files and manifest. Run `node scripts/check-stage-scenes.mjs` to confirm GLB headers, byte lengths, source geometry thresholds and stage IDs. Manifest: `public/stage-scenes/manifest.json`.

## Readiness

Ready exported GLBs: **R01–R05; S01; S05–S12; S14** (15 total, about 4.8 MB combined). The UI loads a room only upon selection or hover preview. Ready rooms retain original Blender meter scale with Y-up GLB export, garment anchor at world origin, and room architecture extending behind the garment. Three.js owns disposal after stage switches and abandoned asynchronous loads.

Unfinished: **S02, S03, S04, S13, S15**. These assets have 7–8 mesh objects and just 42–48 polygons each. They are hidden from the curated stage catalog to prevent inadequate staged renders. Their original `.blend` files remain available for further modeling. No GLB was exported for these five.

## Quality follow-up

The current rooms use flat Blender procedural materials and simple geometric set dressing. Improve the five unfinished rooms with meaningful structures, then add detailed surfaces, UV-based texture maps, realistic light rigs and optimized geometry to each scene. Re-export and update the readiness list, catalog status and measurements when finished. The separate cathedral model continues using its existing GLB. Real-time lights from the garment viewport remain in effect; source `.blend` lights/cameras are deliberately excluded from lightweight GLBs.

## Curated catalog (October 17, 2026)

The default Stage Library deliberately exposes exactly **five selectable room scenes**: **MIKRISTIAN Cathedral House** (existing Blender GLB, approximately 226 meshes), **R02**, **R03**, **S01**, and **S10**. The neutral **Empty studio** control clears the selection and is not counted as a room. These five show genuine GLB-backed Three.js thumbnails instead of flat CSS illustrations. Other stage files and exports remain saved for future development and are hidden from the default catalog.

**Work in progress, not photoreal:** Even the five featured environments are early geometric scene interpretations with basic materials and staging. A higher polygon count or larger mesh count alone does not establish realism. Curated selection means they are relatively stronger candidates, not finished production assets.
