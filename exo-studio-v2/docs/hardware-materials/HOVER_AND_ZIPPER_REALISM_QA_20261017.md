# EXO ClothCraft Library Hover and Hardware Realism Loop

## What this implementation actually delivers

This loop replaces category-by-category inconsistent sidebar hover behavior with the shared
`LibraryAssetHover` component, and supplies real (not icon-only) 3D presentation for
garments and hangers. Every supported left Library category shares a dark enlarged card:
Garment, Avatar, Hanger, Fabric, Material, Hardware and Trims, Stage and Patterns.
Preview content is mounted lazily after a hover/focus delay. The Library tile retains
its click/apply command. The enlarged card is a **visual inspection surface**, not a
guarantee of cloth solver/rigid-fastener fidelity.

The garment inspector uses local EXO drafting geometry. Its boundaries are sampled from
`createTemplateProject(templateId)` / `samplePieceBoundary(piece)`, and its authored
sewing-line references are projected over shallow 3D panels. Style lines, sewing lines,
and pattern edges can be independently toggled. That is a true Three.js visualization
of local 2D patterns with 3D thickness; it is **not** a final simulated drape.

## Manufacturer-style zipper rendering: fidelity work

The previous viewport zipper renderer built repeated rectangular tooth boxes and box-like
sliders. Current `ZipperHardware3D.js` supports:

* Beveled, tapered interlocking tooth geometry for stamped metal and injected molded
  chain families, batched with `THREE.InstancedMesh`.
* Separate nylon/invisible-coil wound loop geometry for these families, not reusing
  stamped tooth blocks; their material is less metallic than metal hardware.
* A shaped channel slider body and an actual aperture in each extruded pull tab.
  The aperture is verified with a Three.js raycast through its center.
* Independent tape/chain materials, deterministic woven normal and roughness texture
  maps, metal micro-roughness, metal top/bottom stops, and two-slider support.
* Off-line studio product covers in `public/hardware-thumbnails/`, regenerated
  from those more detailed shapes with visible teeth, tape reinforcement/stitch rails,
  shaped slider housing, pull-tab aperture and stopper details.

These are high-detail **illustrative CAD/PBR meshes**, not supplier-certified
engineering geometry or photographed/scanned hardware. In particular, manufacturer
measurement tolerances, actual YKK/other proprietary profiles, zipper tensile
forces, rigid slider/teeth collision, actual garment tape physics, and contact/
fastening of model import are not verified.

## Reference-backed parity notes

According to the official CLO manuals:

* [Zipper Style](https://support.clo3d.com/hc/en-us/articles/48635221523353-Zipper-Style)
  supports chain/slider/puller/stopper styles, individual dimensions and weight,
  material customization, one/two-way locks and asset-specific `.ZPS` styles.
* [Create and Edit Zipper](https://support.clo3d.com/hc/en-us/articles/115004529388-Create-and-Edit-Zipper)
  supports a two-edge tool and slider editing.
* [Slider/Puller/Stopper OBJ Registration](https://support.clo3d.com/hc/en-us/articles/900004852686-Slider-Puller-Stopper-OBJ-Registration)
  documents named OBJ meshes, coordinate/origin rules and separately registered
  teeth/slider/puller/stops.
* [3D Sewing](https://support.clo3d.com/hc/en-us/articles/360007863993-3D-Sewing)
  and [Show Style Line](https://support.clo3d.com/hc/en-us/articles/115000410827-Show-Style-Line)
  show source-outline, sewing and style-line views in actual 3D garment windows.

For full parity beyond this loop, add true supplier asset-registration/editing
with original UVs, provenance metadata and unit calibration; a properly calibrated
two-edge tape and cloth constraint system; direct 3D slider manipulation; and
independent physical validation of material hardware with measured specifications.

## Deterministic validation

```bash
node scripts/qa-hardware-zipper-manufacturing-geometry.mjs
EXO_QA_URL=http://127.0.0.1:5188 node scripts/qa-library-hover-all.mjs
node scripts/qa-zipper-hardware.mjs
node scripts/qa-zipper-two-way-ui.mjs
node scripts/qa-fabric-sidebar-400.mjs
npm run build
```

The geometry test measures multiple families' normal-bearing vertices, two
slider assemblies, the metal pull-tab through-hole and distinct engaged/open
teeth, and therefore cannot pass just because a 2D cover exists.

Asset sourcing must check each model's license before copying the file into
`public/`; index/search text alone does not imply that bytes were acquired.
Do not import a Sketchfab model marked NoAI or restricted without clear
permission, and do not label locally modeled hardware as manufacturer-supplied.

## Real licensed hanger assets in the editor

Two original Innerscene CC0 textured binary GLBs have been downloaded and
validated (glTF magic, byte length, SHA-256 recorded in
`docs/hanger-assets/README.md`):

* `public/hangers/innerscene-shoulder-form.glb`: wooden hanger, 760,760 B,
  [source / CC0 statement](https://www.innerscene.com/tools/library/3d-parts/shoulder-form-closet-accessory-9d23a205).
* `public/hangers/innerscene-clip-rail.glb`: trouser clip hanger, 851,916 B,
  [source / CC0 statement](https://www.innerscene.com/tools/library/3d-parts/clip-rail-closet-accessory-6c515d60).

The existing wood and new trouser-clip Library styles load those GLBs in the
enlarged hover preview using `GLTFLoader`, with the same scene rendered by
the main `GarmentViewport.jsx` display prop. Failed imports use explicitly
identified procedural fallback geometry, never a silent fake. The remaining
chrome/velvet/padded types are original procedural meshes with dark Blender
studio thumbnail renders. Five static tile images avoid allocating WebGL
contexts in every item of the sidebar.

The deterministic editor check
`node scripts/qa-cc0-hanger-main-viewport.mjs` passed at 1440px and 390px.
The selected wood scene contained 6 imported meshes; the trouser clip scene
contained 17. The main canvas explicitly reports
`data-hanger-geometry-source="imported-cc0-glb"`.
The imported hangers are visual display props only: they do not provide
real hanger-to-cloth deformation, rigid-body contact, or load-bearing tests.
