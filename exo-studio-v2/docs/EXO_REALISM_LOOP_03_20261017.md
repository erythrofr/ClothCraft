# EXO V2 — Realism/preview reliability loop 03 (October 17, 2026)

## Shipped locally

The signed app `~/Applications/EXO ClothCraft Studio V2.app` has the latest
web-assets-only release. The original Swift executable, Rust session binary,
and persisted garment files were preserved. Installation was performed with
`integrations/clothcraft/macos/build-web-only-v2.sh` and its dedicated staging
folder. The preceding installed web assets were backed up under
`integrations/clothcraft/output/app-backups/EXO-V2-web-before-native-bridge-repair-20261017`.
This release was signed and reopened; `codesign --verify --deep --strict` passed.

## Changes

1. **Photographic scan upload:** The EXO draft viewport and native fabric
   surface previously called `Texture.needsUpdate=true` while the
   `TextureLoader`'s image was not yet decoded. The native code path now
   waits for the real image update. Built and tested current EXO web app:
   **zero** of the previously observed 124 startup warnings, with actual
   fabric-on-ball and photographic maps still visible.
2. **Correct native bridge for signed app:** A separate concurrent local
   build had inadvertently baked fallback ports 5193/5191 into the installed
   UI. The packaged web app now **always** resolves the native bridge to
   `http://127.0.0.1:5385` when served from port 5386; standalone
   development ports retain their separate behavior. On the installed app,
   the 2D Rust pattern panels and Fabric Property Editor loaded again.
3. **Stage gallery resource budget:** Five stage cards display PNGs captured
   directly from the five actual GLB scenes, rather than all allocating
   independent WebGL scenes immediately. The real GLBs still load on hover
   and when a stage is chosen. The five card images are 19–49 KB.
4. **T-shirt illustration:** The inspected source-derived tee assembly
   replaces separated tubular sleeve geometry with more continuous
   shoulder-to-cuff lofts and a rounded collar following sampled neckline
   edges. Its illustrative assembly has 25 meshes and 14,769 triangles.
   **It is not a cloth solver result, fully sewn manifold, or guaranteed
   production silhouette.**

## Exact installed validation

- `codesign --verify --deep --strict`: **PASS**
- `GET :5385/health`: native backend ready
- Native `.cc-board [data-panel]` on installed `:5386`: **PASS**
- `qa-installed-v2-inline-fabrics.mjs`: **PASS**, 400 presets, swatches
  and 13 docked native controls, no floating panel or page exceptions
- `qa-assistant-actions.mjs`: **PASS**, 13 registered actions
- `qa-fabric-ball-geometry.mjs`: **PASS**, 11,025 vertices and 21,632
  triangles in the optical sheet; zero NaNs/intersections
- `qa-stage-curated-20261017.mjs`: **PASS** at 1440 and 390px. Five
  genuine poster files; live hover GLB mesh counts 226/96/108/68/65;
  selection of R02 loads 96 3D meshes
- New `qa-realism-next-20261017.mjs`: **PASS** on an isolated current
  production build at 1440 and 390px: zero idle tile WebGL canvases,
  zero texture-upload warnings, no page exceptions or missing scan/stage
  assets
- Final installed `:5386` startup check: **PASS**, zero prior empty-
  image upload warnings and zero JavaScript exceptions

The existing `:5188` process is a stale **Vite preview** of `dist`, not
live source. Testing newer code against 5188 without rebuilding `dist`
produces false negative comparisons. Staging in a separate output directory
and serving a temporary Vite preview avoided this mistake.

## Remaining realism and scope limitations

- Built-in 3D garment previews are illustrative; CLO-like body contact,
  cloth fit, correct seam closure and measured physical calibration require
  further native solver/render work.
- Five rooms are real GLB assets but their geometry/material/lighting
  remain below high-end offline photography.
- 400 fabrics are visual/preset variants; multiple presets reuse the same
  scanned surface. GSM, bending, stretch and thickness remain estimated
  without physical sample testing.
- EXO has a growing action/MCP foundation, **not** autonomous control of
  every possible editor operation.
- Updates to the signed web frontend can race other agents working in the
  same repo. Keep using isolated staging, release checks, and a distinct
  backup before replacing the installed web assets.
