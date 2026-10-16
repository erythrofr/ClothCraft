# ZOZO PPF on-body integration audit — October 13, 2026

Reference: https://github.com/st-tech/ppf-contact-solver, particularly `examples/fitting.ipynb`. Its preassembled dress mesh uses `load_CIPC_stitch_mesh`, `asset.add.stitch`, and an independent body triangle mesh. This does not mean a new four-piece flat T-shirt can drape onto any avatar without careful pose, seam topology and collision-free initialization.

## Change made

1. `blender_bridge/tune_ppf_staging.py` now evaluates every candidate against the actual Blender STATIC collider that the job will use. This applies to both Garment Studio's measurement-based proxy and the local CLO Thomas skin; the old proxy-only method could select colliding candidates.
2. `ppf_backend/server.mjs` runs `check_ppf_dynamic_contact.py --initial-only` against the configured Blender scene, rejecting intersecting cloth/body or cloth/self geometry before a Metal solve. Previous preflight checked garment self-intersection but did not test true avatar triangles.
3. The Sewing UI now reports whether actual initial body contact was verified separately from seam closure and the all-frame fit acceptance.

## Verified preflight

Template: default foundation T-shirt (500 vertices, 768 triangles). Before tuning: 20 body intersection pairs, zero cloth-self intersection pairs. After staging optimization: zero body and zero self intersection pairs, verified with nine independently built avatar STATIC meshes. The tuned 3D solver-space pose is saved as `blender_bridge/fixtures/tee-body-preflight-tuned-20261013.ppf.json` and the detailed report as `blender_bridge/output/tee-body-preflight-tuned-20261013.json`. Staging parameters: torso depth 0.16 m, arm offset 0.51 m, sleeve height shift 0.35 m, sleeve depth shift 0.0 m.

## Not yet proven

This is an **initial frame** fix, not a successful on-body *simulated garment*. Existing 10-frame PPF sewing runs still show sleeve/body and cloth/self intersections after initial safe frames, and some fail the prescribed 5% strain cap. Continue rejecting a final fit unless all-frame contact, seam gaps, strain, and when required swept CCD pass. No automatic finished outfit has been certified or imported back into the WebGL viewport. Native Metal is an offline solver, not real-time fitting.

Future engineering should build a correctly preassembled, nonintersecting shirt shell around the avatar (or coordinate separate SHELL groups and cross-object barycentric stitches), progressively tighten armhole seams, and validate every solver frame. The video demonstrates those capabilities for its own correctly prepared input, not a generic automatic flat-pattern sewing guarantee.
