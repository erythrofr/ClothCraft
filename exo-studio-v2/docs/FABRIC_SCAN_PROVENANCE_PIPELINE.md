# EXO Fabric Scan Provenance and 400-Preset Asset Intake

## Inventory and truthful baseline

The 400 versioned presets live in `src/data/defaultProject.js`. The 80 reference archetypes and 320 constructed variations are *specifications*, not 400 measured fabric scans. Their physical parameters retain their existing estimated/measured status. The registry in `src/core/fabricAssetRegistry.js` records visual assets independently and never certifies physics from an image. Without an approved manifest, all 400 remain Grade D (no verified appearance asset).

Run `node scripts/check-fabric-assets.mjs` to audit the baseline, or `node scripts/check-fabric-assets.mjs path/to/approved-manifest.json` to validate a provenance manifest and print per-preset gaps. The validator is intentionally strict: missing assets, unclear redistribution rights, or unverified hashes fail intake; no automatic download occurs. Manifest checks read local file bytes and compare SHA-256. Remote HTTPS URLs can be recorded in registry metadata but are rejected during manifest intake until an approved local copy is supplied. `asset://` paths are relative to the manifest directory, `./` paths are relative to the manifest, and `/assets/` paths resolve under `public/assets/`. Manifest keys are `assets`, `assignments`, and `parentSharing`.

## Scan intake requirements

For every received source, retain the **original downloaded file**, its creator and source, an acquisition date, license evidence, attribution text and URL if CC-BY, rights holder if original, capture method if a scan, and cryptographic SHA-256 of the exact bytes. Confirm the license actually covers redistribution, derivative processing and intended product usage before setting `licensePermission: true`. CC0 permits broad reuse; CC-BY requires attribution and its license conditions; `original` requires documented ownership or grant. A generic website copyright notice or a CC-BY-NC/ND asset does not qualify.

Assets must declare `origin: "scan"` for genuine camera capture / photogrammetry, or `origin: "procedural"` with the generator named. A procedural map cannot become a photographic scan merely by assigning a photorealistic shader. Capture calibrated rulers, color charts, flat even lighting, multiple view/light conditions, and construction / lot metadata where practical. Record measured physical repeat size in millimeters, independent of pixel resolution. Avoid inferring repeat scale from image pixel dimensions.

Represent color, normal, roughness, opacity, and height as separate `kind` entries. Color is sRGB; every data texture is linear. Normals must declare OpenGL or DirectX convention explicitly. Packed ORM/ARM textures require a documented extraction step before registering individual grayscale maps. Record width, height, tileability and available mip levels. Tone transformations are optional `{exposureEV, saturation, hueDegrees, gamma}` metadata; preserve unmodified originals and derive transformed outputs under distinct hashes and IDs.

## Example manifest (schema illustration, not real scanned evidence)

```json
{
  "assets": [
    {
      "id": "sample-color-v1",
      "kind": "color",
      "origin": "scan",
      "license": "original",
      "licensePermission": true,
      "uri": "asset://fabric-scans/sample-color.png",
      "sha256": "REPLACE_WITH_REAL_64_CHARACTER_SHA256",
      "provenance": {
        "source": "studio session / swatch inventory ID",
        "creator": "photographer name",
        "rightsHolder": "rights holder",
        "captureMethod": "calibrated cross-polarized macro photography",
        "acquiredAt": "2026-10-16"
      },
      "repeatMm": { "widthMm": 100, "heightMm": 100 },
      "image": { "width": 4096, "height": 4096, "mipLevels": 13, "tileable": true },
      "colorSpace": "sRGB",
      "tone": { "exposureEV": 0, "saturation": 1, "hueDegrees": 0, "gamma": 1 }
    }
  ],
  "assignments": { "REPLACE_WITH_EXISTING_PRESET_ID": { "color": "sample-color-v1" } },
  "parentSharing": {}
}
```

The example contains placeholders and must **not** be submitted as an approved manifest. `parentSharing` maps a variant ID to the preset whose appearance maps it uses. It shares verified visual maps only; it does not share physical-test results or imply that distinct fabric weights have identical surface appearance. Assets optionally declare `presetIds` as a restrictive allowlist of all approved direct and inherited consumers.

## Appearance evidence grades

| Grade | Requirement | Interpretation |
| --- | --- | --- |
| A | Scanned color + scanned normal + scanned roughness, all tileable, declared repeat/resolution and licensed provenance | Complete core scanned PBR evidence; other maps optional |
| B | Scanned color plus at least one additional genuine scanned map | Partial scan-backed visual evidence |
| C | At least one approved visual asset; procedural or solitary scanned map | Illustrative or incomplete appearance |
| D | No approved assets | No licensed visual evidence |

Grade A does **not** imply measured elasticity, friction, reflectance, material certification, or photo accuracy. Grade B–C textures need human inspection for seams, weave direction, scale, color, and lighting before production presentation.

## Operational pipeline

1. Secure original capture or a source with documented approved rights; archive license snapshot and original bytes.
2. Compute SHA-256 for each individual map, retain asset URI and source attribution, measure width/height of real repeat, and identify normal convention.
3. Export sRGB color and linear data maps; generate mips and verify tile seams. Preserve scan vs procedural origin when deriving normals or roughness from photographs (derived maps are procedural unless physically captured).
4. Add verified map records, IDs and per-preset assignments to a version-controlled JSON manifest. Declare conscious parent sharing for compatible variants.
5. Run `node scripts/check-fabric-assets.mjs path/to/manifest.json`; resolve all failures and review 400-item grade counts and `gaps`.
6. Preview 2D swatch and rendered 3D garment under standardized illumination. Audit repeat scale, PBR energy/roughness, seam continuity, perceptual colors and attribution in released exports.
7. Independently test and calibrate areal mass, thickness, warp/weft/bias curves, bending and friction for physical simulation; retain laboratory protocol and specimen identity.

The registry is designed for integration by calling `createFabricAssetRegistry(FABRIC_PRESETS, manifest)`, `registry.resolve(presetId)` and `registry.coverage()`. It never fetches remote assets, guesses texture URLs, applies shader transforms, or marks missing photographs as complete.
