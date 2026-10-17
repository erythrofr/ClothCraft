# EXO Fabric Realism — Milestone 01

## What works

- Five curated fabric directions: black heavyweight French terry, raw indigo denim, ribbed cotton, washed leather, technical nylon.
- Each loads three local CC0 photographed appearance maps (color, tangent-space normal, roughness) with source references in `src/core/fabricRealismShowcase.js` and `src/data/defaultProject.js`.
- The main EXO editor applies the selected preset to a project fabric slot, which is then rendered by the existing Three.js physically-based garment materials using centimeter-based UVs. Use Object Browser > Fabric, select a fabric, then expand **Fabric Library & Texture** to choose the preset and inspect its optical properties.
- In the live material inspector: switch between yarn/finish inspection and a stylized draped sheet; edit lighting, yarn magnification, roughness, normal detail and sheen. The last three update the garment material values as well.
- EXO Community Fabric Store now has a dedicated five-scan WebGL lighting study and responsive controls. The community study intentionally does not edit a garment project.

## Evidence and limits

- Original local images are approximately 1K wide, not new 2K/4K scans. Each appearance triplet is CC0; attribution/provenance is documented, including source URLs.
- **French terry and raw denim are construction appearance references**; rib cotton, leather wash and nylon are related-family or surface proxies. A visual match does not prove fiber content.
- Color/normal/roughness maps affect optical appearance. Material values such as GSM, stretch, bending, friction, thickness and damping are authoring estimates, not certified lab tests. Draped preview geometry is an optical demonstration; true drape comes from the main simulator and depends on its model's present limitations.
- Full production equivalence requires measured specimen physical repeat sizes, a calibrated lighting/color pipeline, reliable measured warp/weft/shear/bend forces and higher-resolution source scans where fine yarn reconstruction needs it. Any eventual CLO/ZFAB import must check licensing and format compatibility.

## Verification

```sh
npm run build
npm run check:fabric-showcase
npm run qa:fabric-showcase
node scripts/check-fabric-realism.mjs
```

`qa:fabric-showcase` requires the EXO Vite preview serving the current `dist` at `http://127.0.0.1:5188` by default. Override with `EXO_QA_URL` for another EXO instance. For local QA screenshots, set `EXO_CAPTURE=1` to write the two preview captures into `screenshots/`.

## Next milestone

Capture a real black French terry swatch beside a scale ruler and neutral color target. Generate a seamless repeat with color/normal/roughness at adequate source resolution, photograph a matching actual sample for fit and drape, and record measured warp/weft, shear, cantilever bend, thickness, areal mass and friction with evidence metadata. Tune one hoodie simulation and compare its photographed drape to a matched EXO render before applying the calibration workflow to the other families.
