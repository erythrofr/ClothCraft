# PPF contact safety engineering · October 13, 2026

This note records verified behavior and changes made after the first functional PPF Metal sewing integration. It does **not** claim a collision-free fitted T-shirt.

## Current implementation and checks

- The Garment Studio Sewing inspector submits a genuine PPF Metal job, traces 98 stitch pairs across 14 seam groups, and permanently saves Blender `.blend` plus PC2 animation.
- Every simulation frame is assessed in `blender_bridge/check_ppf_dynamic_contact.py` against nine analytic avatar collider meshes and non-adjacent garment triangles.
- The sewing panel now explicitly labels **collision quality failed** whenever any exported frame contains detected cloth/body or non-adjacent cloth/cloth triangle crossings. Gap closure is displayed independently from contact safety.
- The staging solver `blender_bridge/tune_ppf_staging.py` searches sleeve Y and Z, torso clearance and arm offset. Its output now explicitly states `contactValidationRequired: true` because pre-simulation clearance does not guarantee collision-free sewing.
- Native arm64 app rebuild succeeded and was installed/opened with `--tee-test`; original non-test user project remains separated.

## Evidence

| Configuration | Mean sewn gap after 10 frames | Avatar triangle intersections | Cloth self-intersections | Result |
|---|---:|---:|---:|---|
| Flat exploded panels, optimized sleeve height +0.35 m | 1.583 cm | Up to 606 | Up to 19 | Sewing closes rapidly, contact audit **fails** |
| Cylindrically prewrapped sleeve experiment (`r=0.09 m`) | 0.884 cm | Up to 638 | Up to 65 | Sewing better, contact audit **worse**; **not enabled by default** |
| PPF contact gap experiment 20 mm with offset 5 mm | N/A | N/A | N/A | PPF build **failed**: 1,723 initially overlapping/threatening element pairs. Rejected. |
| Existing expanded 20-frame flat-stage solve | Unfinished | N/A | N/A | Metal solver timed out around frame 15; lengthening simulation alone is not a fix. |

These intersection figures come from exported frame mesh BVH triangle tests. They must not be confused with PPF's own continuous-time internal contact guarantees, which require independent solver-level interpretation. The exported output remains an **experimental garment simulation**, not a certified intersection-free cloth solve.

## Next research priority

1. Determine why PPF's internal strain-limited contact reports plausible solver completion despite output triangles crossing the static avatar. Confirm mesh winding, orientation, whether the static proxy is an actual collision participant at each frame, the solver's PPF intersection-allowance groups, and the add-on's PC2 coordinate space.
2. Validate signed distance to avatar, not only surface crossing; a completely enclosed garment body region can still penetrate without a triangle crossing.
3. Prototype separate Shell objects with `cross_stitch_json` barycentric constraints (see installed addon `debug/scenarios/bl_stitch_merge.py`) and verify shell-to-shell contact during stitch closure.
4. Use a progressive sew-preparation phase and adapt stitch strength gradually while preserving all garment rest lengths; never simply increase stitch force by 10x (already timed out).
5. Improve shoulder/armhole pattern cap geometry: test corresponding edge arc lengths, seam orientation, and flat-pattern construction. Avatar proxy itself should be replaced with verified triangle meshes where possible.

## Source/test references

- `scripts/analyze-ppf-sewing.mjs`, `scripts/qa-ppf-sewing-job.mjs`
- `blender_bridge/check_ppf_dynamic_contact.py`
- `blender_bridge/output/tee-ppf-metal-v3-dynamic-contact.json`
- `blender_bridge/output/tee-ppf-cylinder-r090-contact.json`
- `blender_bridge/output/ppf-mv6c7fk3-contact-report.json`
- `scripts/export-cylindrical-ppf-tee.mjs`
- `ppf_backend/server.mjs`
- Original solver: https://github.com/st-tech/ppf-contact-solver

Conclusion: keep PPF as an offline experimental solver and XPBD as the responsive editor solver. **Do not use gap closure alone as acceptance** for garment physics; accept only once both sewn geometry and body contact validation pass throughout a complete sequence.
