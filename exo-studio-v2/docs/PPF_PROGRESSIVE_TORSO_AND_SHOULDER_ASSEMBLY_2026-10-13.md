# Current Foundation Tee: progressive torso and shoulder assembly

**Local engineering report — October 13, 2026**

## Implementation

The current setup is a four-piece Foundation Tee with 98 physical sewing pairs and the local CLO Thomas mesh. The T-shirt is **not fully fitted, sewn, or trajectory validated**.

The backend now runs three contact-screened assembly passes before the production PPF quality gate:

1. **Nonrigid sleeve assembly** in blender_bridge/nonrigid_ppf_assembly.py refines the sleeve mesh and wraps each tapered sleeve using a developable cone. The original 2D sewing endpoints and IDs are preserved.
2. **Torso-side progressive fold** in blender_bridge/optimize_ppf_torso_bend.py uses two independent shallow cylinders to bring the front and back seams closer without pushing the panels through Thomas's upper arms.
3. **Shoulder fold** in blender_bridge/tune_ppf_shoulder_folds.py bends the upper panels with a strain cap and rejects any body/self intersection.

4. **Rigid four-piece seam post-alignment** in blender_bridge/rigid_postalign_ppf_assembly.py searches each piece's rotation and translation after bending. Every candidate is screened against Thomas skin triangles, garment self intersections, oriented skin normals, and manufactured 2D edge lengths. This cannot stretch fabric, and uses the actual 98 stitch-pair correspondences rather than drawing seams as visual lines. Alternative worst-seam weight searches were tested; the default 0.23 performed best.

An additional signed-distance guard checks that no starting vertex lies more than 2 mm behind the oriented Thomas skin. The saved pose is strictly an **initial arrangement**, not a validated physical fit. The service persists it to a local JSON file and provides a read-only preview at /jobs/:jobId/preview?stage=initial-assembly, even when the final-fit job fails closed at the remaining seam gap.

## Current-template results

| Metric | Exploded staging | Sleeves | Torso | Shoulder |
| --- | ---: | ---: | ---: | ---: |
| Average separation of the 98 stitch pairs | 33.461 cm | 15.973 cm | 10.599 cm | **9.565 cm** |
| Worst seam gap | 34.5+ cm | 32.0 cm | 29.868 cm | **23.856 cm** |
| Maximum garment pattern-edge distortion | — | 2.430% | at most 2.430% by piece | **4.582%** |
| Initial body/self intersections | 0 / 0 | 0 / 0 | 0 / 0 | **0 / 0** |

With the fourth stage (rigid post-alignment, 10 rounds), the **current best result is 7.406 cm mean seam gap, 19.291 cm worst seam**, with zero initial BVH body/self crossings, zero cloth vertices over 2 mm behind Thomas skin, and **4.582% maximum total manufactured edge change**. Both underarm seam groups remain under 1 cm maximum gap.

Both underarm seams start within **0.901 cm maximum separation**, with **0.869 cm mean**. The refined mesh contains **976 vertices, 1,632 faces**, and the unchanged **98 physical stitch pairs**.

The selected pose passes independent Blender configured-scene loading and frame-zero triangle contact audits, plus an oriented-skin normal check with zero vertices deeper than 2 mm behind skin. These checks **do not** certify between-frame CCD or a finished sewn garment.

The earlier high-resolution 1,764-vertex CPU PPF test timed out at frame 1. A 976-vertex Metal run failed during PPF build. Those solver failures remain separate work; no all-frame validated PPF trajectory has been produced.

## Remaining limitations

The **19.3 cm worst seam** remains far above the **3 cm initial assembly** gate. The final sewing fit gate is stricter still. Simply snapping seam vertices would not be physically correct and could conceal severe pattern distortion or avatar penetration.

An experimental seam-relaxation stage in blender_bridge/relax_ppf_seam_assembly.py attained roughly **9.198 cm mean** and **23.437 cm maximum** gap, but its strain approached **4.97%** and did not meaningfully solve the remaining shoulder closure. It is deliberately **not enabled by default**.

Run npm run check:ppf-nonrigid for the real-Thomas regression and fail-closed acceptance, including independent Blender frame-zero contact checks of the post-aligned pose. Source fixtures remain in blender_bridge/output/sleeve-refine-20261013 and blender_bridge/output/rigid-postalign-20261013. The service pipeline was restarted and live-tested on the current tee template; it saved the improved initial preview and correctly rejected the still-open seams. The complete simulated drape requires further shoulder/side seam topology convergence, a running native PPF trajectory, independent swept IPC CCD, and shoulder-clearance certification.
