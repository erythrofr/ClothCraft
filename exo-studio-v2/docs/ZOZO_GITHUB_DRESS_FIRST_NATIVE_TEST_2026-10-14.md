# Garment Studio first fabric test: original ZOZO GitHub dress

**Implemented October 14, 2026 in the running Garment Studio native desktop bundle.**

## What is actually integrated

The first reference garment uses the *original* upstream `st-tech/ppf-contact-solver/examples/fitting.ipynb` and the Codim-IPC asset `Projects/FEMShell/input/dress_knife/stage.obj`, **not a re-drawn or approximate dress**. The stage OBJ includes **14 distinct panels, 15,656 garment vertices, 29,456 garment triangles, and 851 explicit stitching constraints**. The original animated body has another 12,811 native pinned vertices and 25,472 triangles.

The full original **240 frame advances = 241 output samples** of Rust/Metal PPF simulation were already executed and independently audited. Source data is in `logs/ppf-upstream-fitting-full-20261014.json` and `logs/ppf-upstream-full-audit-20261014.json`.

New local asset pack:

```
public/references/zozo-dress/manifest.json  (provenance + independent frame-by-frame QA)
public/references/zozo-dress/meshes.json    (native XYZ indexed 14 original panels + pinned body)
public/references/zozo-dress/frames.bin     (241 exact original raw native Rust frames)
```

Generated using `node scripts/prepare-zozo-reference-dress.mjs`. This generator validates topology and maps the original 14 panel groups to the reordered/rotated solver vertices using exact geometric correspondence, preserving native vertex positions. It copies every raw frame **byte-for-byte**, without garment snapping, visual synthesis, resimulation or retargeting.

`node scripts/check-zozo-reference-dress.mjs` verifies 14 panel groups, 851 stitches, 241 frames, full face coverage, no foreign body IDs, 6 sampled frames identical to the native run, and the original audit's failure records.

## How to use in the actual desktop app

The app is `/Users/mikylecouto/Applications/GarmentStudioNative.app`. It has been updated *in place* with the tested Vite UI/assets while preserving the native executable, WebKit localStorage, CLO Thomas private GLB and all existing project documents. App signature was refreshed and verified; its **Workspace > Reload Interface** item was invoked to show the update in the already running app. The prior UI assets were backed up under `native_app/backups/zozo-github-dress-20261014-202941/`.

In **Fit** or **Sewing**, click **OPEN GITHUB DRESS · ORIGINAL PPF TEST**. This switches the left 3D viewport to the original GitHub dress with its actual animated pinned body. The right 2D editor and saved patterns remain unchanged. Use **START**, **PLAY/PAUSE**, **FINAL FRAME**, **HIDE/SHOW BODY** and the 0–240 frame scrubber. Clicking **RETURN TO EDITABLE GARMENT** returns to the user's live editable 3D garment; the dress test never imports fake garment patterns or changes their sewing edges.

There is no separate trial created or submitted when the button is clicked: this is a **read-only playback of an actual previously run Rust/Metal simulation**. This avoids consuming more GPU resources when reviewing the canonical benchmark. Physical resimulation continues to be available as a separate native solver experiment, subject to validation.

## The physical fit is not certified

This completed original solver trajectory has crossing pairs at **frame 87: 2**, **frame 90: 492**, and **frame 174: 2**, despite much better seam closure by its final frame (average 0.112 cm, worst 0.460 cm). The renderer and panels show this as `EXPERIMENTAL · NOT VERIFIED FIT`. The audit *does not* certify all-frame swept CCD. This test demonstrates real fabric dynamics, sewn assembly and scene playback, **not** reliable CLO3D-grade collision-safe fitting.

Next production priority: make the original GitHub test pass frame export and contact QA, then move to the harder user-designed Thomas T-shirt near-body setup (still maximum initial seam gap 18.742 cm vs 3 cm required) without altering its original sewing or avatar.

## Verification performed

- `node scripts/prepare-zozo-reference-dress.mjs`: PASS.
- `node scripts/check-zozo-reference-dress.mjs`: PASS.
- `npm run build`: PASS.
- Browser automation on `http://127.0.0.1:5188/`: clicked **Fit**, loaded exact original dress, checked frame 0 / frame 90 / frame 240 audit counts and seam gaps, returned to live garment; **no JavaScript console/page errors**.
- `npm run check:ppf-payload`: PASS.
- Installed app bundle contains the exact hash-identical original solver frame cache and bundled UI; `codesign --verify --deep --strict`: PASS.
- Running app remained open; its Workspace **Reload Interface** item invoked successfully.

**Important maintenance:** the local ~79 MB generated reference pack is git-ignored, as it consists of original third-party example data plus a recorded native run; regenerate from the installed local reference after a clone or when setting up another Mac. The source and test scripts remain in the repository.
