# Upstream ZOZO fitting example — local reproducibility

Upstream: https://github.com/st-tech/ppf-contact-solver, commit `7232f4033515e1e72359f4ce5145456ce7d156f7`.

The reference demonstration is **not** a flat 2D pattern auto-placement algorithm. `examples/fitting.ipynb` loads a preassembled triangulated dress `dress_knife/stage.obj` with its CIPC stitching data, and a 121-frame animated human surface from `Rumba_Dancing/shell*.obj`. It creates a dress shell with `asset.add.stitch('glue', S)`, a separate body surface, applies the stitches, pins and animates the body, then builds and runs a 240-frame solver session. The motion in the video is supplied by the animated body meshes; the solver does not synthesize dancing from a static body.

## Installed and validated

- Unmodified upstream source at `research/oss/ppf-contact-solver` (latest fetched main commit at time of check).
- Installed native Apple Silicon Metal/CPU runtime at `research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64`.
- Installed exact source assets at `research/oss/Codim-IPC/Projects/FEMShell/input/dress_knife/stage.obj` and `.../Rumba_Dancing/shell*.obj`.
- Original fitting notebook copied to `research/ppf-local/fitting-reproduction/fitting-local.ipynb` with only its sparse-clone step replaced by the local asset path. Generate again with `python3 scripts/prepare-zozo-fitting-reference.py`.
- Native upstream Python frontend successfully parsed 15,656 dress vertices / 29,456 faces, two stitching collections, and 12,811 body vertices / 25,472 faces. This is an input/API smoke test, **not** a completed 240-frame solve.

## Remaining Garment Studio integration

Garment Studio's 2D pieces and sewing graph must be exported as a valid preassembled shell and a correctly aligned stitch mapping comparable to ZOZO's CIPC `stage.obj`. It must then supply the intended stationary or animated body mesh, run ZOZO's `App` session or the existing Blender PPF service, import its simulation frames into the garment viewer, and audit collision, seam closure, and strain. Merely copying the notebook and installing the runtime does not supply a generic pattern-to-body fitting algorithm. Keep the existing offline backend and live XPBD simulation separate until the full path passes tests.

The user-provided Box link `https://zozo.ent.box.com/s/pdcswk4ytzqgo98cjo91ensprgxz2umm` returned HTTP 404 in the current environment; do not claim its video was downloaded or reviewed.

**Safety:** Upstream warns not to execute `warmup.py` locally. No broad install or source overwrite is needed; the relevant source/runtime/data are already installed. Do not silently replace Garment Studio's interactive solver with an unverified offline workflow.
