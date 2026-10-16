# Imported body + T-shirt draping with ZOZO/ST-Tech PPF

## Actual source and status

- Solver: `st-tech/ppf-contact-solver`, installed in `research/runtime/ppf-addon` (Blender extension API) and `research/ppf-local/runtime/...-macos-arm64` (Metal-capable solver).
- Actual API used: `solver.create_group(..., type='SHELL')`, `solver.create_group(..., type='STATIC')`, `group.create_pin(mesh_name, vertex_group_name)`, and `group.param` properties. It is analogous to the upstream sheet-over-sphere example, with an imported body collider and imported T-shirt triangles.
- **Demonstrated:** Imported Theo GLB, baked its skinned pose into a static triangle mesh, imported a 500-vertex/768-face shirt OBJ, created and registered 36 shoulder pins, set density (0.22 kg/m²), normalized Young's modulus (5500), Poisson ratio (.35), bend (4.3), friction (.35), and 5% strain limit, checked **zero starting body intersections and zero starting cloth self intersections**, and saved `blender_bridge/output/ppf-body-tee-smoke-v2.blend`. The JSON report is `blender_bridge/output/ppf-body-tee-smoke-v2.report.json`.
- **Not demonstrated:** The full imported-body pipeline has **not** completed a drape. A Metal solve of that scene terminated at frame 1 without a completion marker. The failed JSON is `blender_bridge/output/ppf-body-tee-solved-solver-report.json`; no solved garment was produced. This is not a guaranteed fitting result.
- The existing PPF sewing workflow within Garment Studio has completed 10-frame solves, but collision audits have found residual intersections in some results. See `docs/PPF_PHYSICAL_SEWING_IMPLEMENTATION_2026-10-13.md`.

## Reproducible configuration

```bash
cd garment-studio
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 \
  --python blender_bridge/ppf_body_tee_pipeline.py -- \
  --body public/avatars/opensew/theo.glb \
  --body-name CD_Man_Body \
  --garment blender_bridge/output/reference-tee-shell.obj \
  --output blender_bridge/output/ppf-body-tee-smoke-v2.blend \
  --placement front --frames 4 \
  --density-kg-m2 0.22 --young-normalized 5500 \
  --poisson 0.35 --bend 4.3 --friction 0.35 \
  --strain-limit-pct 5
```

Use `--pin-indices 3,14,15,22` to supply precisely chosen collar/shoulder
pins; otherwise the script reuses an existing `PPF_Shoulder_Pins` vertex
group or anchors the top 4% of vertices. Use `--auto-pin-top-pct 5` to adjust
that fraction. Pin selection must reflect actual placement and desired
garment motion. An overly broad pin group can make the cloth undrapeable.

For a long sleeve garment or a body with accessories, isolate the actual
skin mesh via `--body-name` and separately validate what was excluded.
The script freezes skinning/armature deformation at frame 1 to make a truly
static collider. This is right for a posed fitting mannequin but **not**
for an animated body (animated colliders require PPF deformation caches).

## Solving and exporting

Append to the command:

```bash
--run --runtime research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64 \
--port 19308 --run-timeout 240
```

The script calls `blender_bridge/ppf_run_configured.py`, checks its JSON
`ok` status and only upon success uses `blender_bridge/ppf_export_frame.py`
to fetch the last PC2 frame and write a triangle-mesh OBJ next to the solved
Blend file. The exporter itself was independently verified against an
existing completed PPF Metal solve (`ppf-export-smoke.obj`, 500 vertices,
768 polygons).

### Pose/placement rules

`--placement front` positions the whole mesh in front of the body with a
bounding-box clearance. It verifies the imported-body *contact pipeline*,
not an already worn/assembled shirt. For an actual dressed shirt use
`--placement around` after positioning a welded/sewn continuous shell
around a body **without initial penetration or self-intersections**. The
script rejects initial surface intersections instead of quietly accepting
them, and checks finite output through the shared PPF runner. Current CLO
Thomas GLB is a locally user-provided, textured visual asset, not
automatically the exact body collision surface in the in-app PPF job.

### Physics and installation caveats

Blender 5.0+ is required. The installed Blender extension must be registered
as `bl_ext.user_default.ppf_contact_solver`, with a matching cbor2 wheel and
the compatible `ppf-cts-server` / `ppf-contact-solver` backend. On Apple
Silicon the local native backend can use Metal GPU. CUDA/ROCm backend selection
is platform-specific; a Metal-only Mac build will not serve CUDA. Long solves
can be slow or stall, especially with tight stitched armholes.

PPF's `young_mod_density_normalized` is a separate group RNA field, while
the shell API facade exposes `shell_young_modulus`. The default 5500 is a
solver-normalized **illustrative** textile setting based on the local PPF
Cotton family, not a certified laboratory Young's modulus in Pa. Surface mass
is `GSM/1000` kg/m². More accurate fabric behavior requires measured
stretch, bending, friction, Poisson ratio and unit-consistent calibration.

The solver is designed for penetration-free contact and strain limiting,
but neither a valid starting scene nor numerical convergence is automatic.
For production acceptance audit **every frame** for cloth/body triangle
crossings, cloth self-intersections, surface clearance, peak strain and named
seam-endpoint gaps. A 5% configured strain limit is not proof that every
output triangle passes 5%. Do not use these results as a certified pattern fit
until all independent checks pass.
