# Garment Studio: CLO-informed initial assembly implementation

**Date:** October 14, 2026. **Status:** measurable, independently validated improvement to the four-piece Thomas starting pose. **Not an accepted CLO-level physical fit.** The initial sewn-edge separation is still too high for the regular ZOZO PPF start gate.

## Real sources and safety

- CLO's open `Male_T-shirt.zpac` was exported through CLO's official GUI as multiple unwelded OBJ objects with exact `SeamLinePair` XML metadata. Saved under `research/clo-reference/live-audit-20261014/exports/`.
- The CLO reference has seven pattern objects, 23 seam line groups and 182 explicit sewn-point correspondences. It is itself an *arranged, not fully closed* pose; its worst export seam gap is 36.804 cm and cannot be treated as a solver-ready target.
- The Garment Studio reference is the existing 976-vertex / 1,632-triangle Thomas Foundation Tee with **four pattern pieces and 98 actual stitches**. The tested original pose was `blender_bridge/output/rigid-postalign-20261013/pose-final.json` (worst gap **19.291 cm**, mean **7.406 cm**).
- All new geometric candidates use the Thomas GLB's real triangulated skin collider (10,000 vertices, 17,999 triangles), rather than cylinder/sphere proxies. No running user project or original CLO export was replaced.

## New implementation and experiments

1. `blender_bridge/optimize_ppf_clo_harmonic_20261014.py`: experimental harmonic distribution of sewn-border motion through independent mesh pieces; preserves source triangle IDs, 2D rest lengths, stitch list and materials. Every accepted intermediate proposal must satisfy real triangle/BVH collision and fabric strain bounds. This approach stopped after accepting tiny motions because further displacement intersected the avatar.
2. `blender_bridge/optimize_ppf_ellipse_preassembly_20261014.py`: anatomy-driven, approximately isometric ellipse torso construction using numerical arclength inversion. Searched 2,625 full-body candidates; 675 exceeded maximum fabric strain and the remaining 1,950 had avatar-body intersections (1,482 also self-intersected). The partial ellipse blend was also tested, including reduced blend fractions, but did not pass both constraints simultaneously. Its candidates were therefore **rejected** and not installed as a new pose.
3. `blender_bridge/audit_ppf_thomas_torso_sections_20261014.py` and `audit_ppf_body_girth_20261014.py`: read-only real-skin cross-section studies. The central **closed torso** cross-section circumference is approximately 0.8083 m at Y=1.07 m, 0.7807 m at Y=1.20 m and 0.8792 m at Y=1.30 m. At comparable levels, the front + back draft width is ~1.011–1.048 m, indicating adequate nominal circumference/ease. The earlier global silhouette half-width was contaminated by arm/body-part loops, so copying it into a torso ellipse would be incorrect. Above the upper chest, section loops are open and should **not** be used as calibrated torso girth.
4. Existing strict preflight-preserving contact-constrained relaxation and rigid seam alignment were run sequentially on the current actual garment/Thomas pose. Best validated output is now saved as `blender_bridge/output/ppf-clo-assembly-20261014/best-validated-initial-pose.json` (see `best-validation-summary.json`).
5. `scripts/check-clo-thomas-assembly-candidate.mjs`: independent sewing, topology, fabric and contact/strain contract validation. Does **not** let a visually improved candidate bypass the ≤3 cm start gate. It exits code 2 when actual preassembly fails, even with zero intersections.

## Best new pose: actual measurements

| Metric | Prior accepted-safe pose | Current best safe pose | Production gate |
| --- | ---: | ---: | ---: |
| Mean sewn-point gap | 7.406 cm | **7.173 cm** | Final dynamic fit requires ≤0.2 cm |
| Worst sewn-point gap | 19.291 cm | **18.742 cm** | **≤3 cm** initial PPF preflight |
| Intrinsic rest-edge change | 4.582% | **4.365%** | ≤5% |
| Avatar triangle intersections in initial pose | 0 | **0** | 0 |
| Cloth self intersections in initial pose | 0 | **0** | 0 |
| Vertices >2 mm behind oriented skin | 0 | **0** | 0 |
| Physical stitch identities preserved | 98 | **98** | All |

Worst unresolved seam regions after optimization: shoulder right 18.742 cm, shoulder left 18.735 cm, torso side right 18.400 cm and torso side left 18.306 cm. These are **real** 3D distances between pairs designated to sew together; the fabric remains much too open. Our safety limit is not relaxed, and no production PPF simulation was launched with this pose.

## Reproduce and verify

From the Garment Studio repository:

```sh
node scripts/check-clo-thomas-assembly-candidate.mjs \
  blender_bridge/output/ppf-clo-assembly-20261014/best-validated-initial-pose.json \
  blender_bridge/output/ppf-clo-assembly-20261014/rigid-pass3-report.json

node scripts/check-ppf-assembly-acceptance.mjs
node scripts/check-ppf-rigid-postalign.mjs
node scripts/check-ppf-payload.mjs
```

The first command deliberately exits nonzero with `preassemblyApprovedForPpf:false` because the worst gap is still 18.742 cm. The others pass independent legacy regression tests. The saved `rigid-pass3-signed.json` confirms no initial torso/sleeve vertex extends >2 mm behind the nearest oriented Thomas skin face; note that this is a local proxy for signed occupancy rather than a full watertight inside/outside proof.

## Structural blockers: what the next algorithm must change

The new anatomical measurements show that **short pattern circumference is not the main blocker**. A global mathematical ellipse still intersects Thomas and sometimes other garment panels, especially near the transition to shoulders and arms, while limited local relaxation becomes trapped by body contact. A further one-pass rigid alignment is insufficient.

The next substantial geometry solver should fit a *piecewise developable, body-relative garment surface*: individual torso circumference/height cross-sections, explicit seam arclength boundary constraints, shoulder cap and neckline paths over the skin, sleeves parameterized along each actual arm centerline, and continuation from an initially expanded/distant non-intersecting pose to a close fitted pose with cloth material rest-edge preservation. It should solve fabric shape and contact together using constrained optimization, **not** simply interpolate a tube into the already positioned shirt. Validate the interior of each movement path, not just its endpoints; otherwise collision tunneling could be missed.

The existing ZOZO PPF implementation remains the native full physical solver. Garment Studio must supply a valid stitched starting topology/pose, then prove the trajectory with full-frame swept CCD, body/self triangle checks, seam convergence and shoulder drape. Completion cannot be claimed until those checks pass.
