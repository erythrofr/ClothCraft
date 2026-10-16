# Blender Bridge

This bridge imports a canonical Garment Studio garment document into Blender without making Blender the owner of production data.

Current proof imports:

- editable 2D pattern meshes
- separate 3D arranged garment meshes
- fabric/material metadata
- seam relationship objects and seam custom properties
- avatar measurements plus the CC0 MakeHuman detailed base mesh, with a measurement-driven proxy fallback
- garment/piece/fabric/layer custom properties
- solidify thickness for preview rendering

The 2D pattern and sewing-guide collections are hidden from beauty renders but remain in the `.blend` scene.

## Run

```bash
node scripts/export-blender-fixture.mjs tee blender_bridge/fixtures/tee.garment.json
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python blender_bridge/import_garment.py -- \
  --input blender_bridge/fixtures/tee.garment.json \
  --output blender_bridge/output/tee.blend \
  --render blender_bridge/output/tee-preview.png
```

Or:

```bash
npm run check:blender
```

The current detailed avatar is a render/fitting visualization while Garment Studio's analytic measurement body remains the collision reference. The next avatar step is mapping Garment Studio measurements to MakeHuman/MPFB morph targets, followed by optional detailed body-mesh collision.

Future bridge work should also feed simulated garment meshes/caches into the same scene objects rather than changing the production document schema.


## PPF final-contact bridge

The Blender bridge also contains an optional PPF Contact Solver path for high-quality final cloth/contact refinement on supported runtimes. Payload preparation keeps sewing constraints as pure loose edges and uses a zero-self-intersection exploded staging pose because PPF intentionally refuses intersecting shell starts.

Lightweight checks:

```bash
npm run check:ppf-payload
npm run check:ppf-bridge
```

The real Metal solve is deliberately separate from the normal regression suite:

```bash
npm run check:ppf-metal
```

That command requires the local PPF runtime, refuses to run alongside another PPF process, requires at least 4 GiB free, optimizes the staging pose, verifies zero shell self-intersections, configures Blender, executes the native Metal solve and validates the fetched PC2 cache.
