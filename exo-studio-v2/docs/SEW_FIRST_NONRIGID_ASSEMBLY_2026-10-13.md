# Garment Studio · Sew-first nonrigid assembly pass

**Implementation:** `src/core/backends/seamAssembly.js`  
**Date:** 2026-10-13  
**Status:** experimental, opt-in, **not a validated body drape**

## Problem and implemented approach

The initial native world-space garment pose has shoulder seams 188 mm apart on the tee, with body collision and sewing constraints making large, competing frame-one corrections. Translating complete pieces rigidly is insufficient because the actual armhole and sleeve-cap seam samples must converge while material rest-edge lengths stay as close as possible to the original 2D manufacturing pattern.

The new `assembleNativeSeams(payload)` algorithm works on a deep copy of the compiled simulation payload. It constructs the unique undirected cloth rest edges from *actual triangulation*, uses the same indexed sewing pairs as the native XPBD backend, and alternates symmetric sewn-edge zero-distance projections with cloth rest-length projections. The staged result is computed over a deterministic, bounded iteration budget; positions of particles with zero inverse mass remain fixed. Original pattern vertices, cut topology, fabric metadata, sewing pairs, seam rest lengths, manual anchor targets, and saved garment documents are **never modified**. Previous positions are reset to the prepared pose to prevent artificial launch velocities when handed off to XPBD.

Unlike rigid piece moves, cloth vertices inside each piece can move nonrigidly to reduce local sewn-edge gaps. `inspectNativeAssemblyPose()` measures sewing separation and edge strain before/after. `inspectStagedAvatarContact()` samples all dressed vertices and triangle centroids against the analytic avatar, including explicit unknown continuous triangle CCD. The staging operator **does not apply an unvalidated contact solver**.

## Reproducible results

Test: `npm run check:sew-first-assembly` (native XPBD tee run included). The T-shirt/hoodie/zip fixtures use 300 iterations, seam stiffness .7, rest-edge stiffness .7. All figures below are initial 3D *pre-simulation* measurements.

| Garment | Initial maximum seam gap | Sew-first maximum seam gap | Initial peak rest-edge strain | Sew-first peak rest-edge strain | Largest sampled body intrusion |
| --- | ---: | ---: | ---: | ---: | ---: |
| T-shirt | 188.45 mm | **3.90 mm** | 139.31% | **26.17%** | **92.89 mm** |
| Hoodie | 196.21 mm | **4.82 mm** | 149.83% | **45.85%** | **89.51 mm** |
| Zip hoodie | 252.61 mm | **12.51 mm** | 104.21% | **51.14%** | **95.14 mm** |

**This is partial progress, not a ready fit.** The large avatar intrusions prove that stitched geometry alone is insufficient. A 60-frame quality native solve starting from the new tee staging is finite, but produces ~**1,366% peak full-trajectory strain** and a **109.8 mm worst sewn gap**. The default native tee baseline is ~1,516% peak strain and ~24.8 mm worst seam gap. Thus changing the default to this pose would regress sewn closure during draping, despite the improved starting pose.

Explored and *rejected as default*: direct projected-avatar separation during preassembly, shoulder-top constraints, joint Adam rest/seam/body energy minimization, and exact elliptical torso projection. They trade off penetration, strain and seam gaps; they do not pass realistic material fit or continuous collision tests. Unused experimental optimizer code was discarded rather than left as dead architecture.

## How to test in the app

1. Open **3D Form → Drape / Fitting → Native XPBD**.
2. Enable **Experimental sew-first preassembly** (off by default).
3. Run **Solve Native XPBD · 60 Frames**. Inspect the initial improvement, sampled avatar intrusion and all-frame physical fit status.
4. **FIT FAILED** remains the correct label when the native trajectory does not meet the material/sewing contact quality gate.
5. Disable the toggle to return to the unchanged production-development solver startup.

This opt-in affects the native **solver request only**; it never overwrites the user's 2D design or saved garment projects. In `nativePayload.js`, `options.experimentalSewFirst===true` or `project.simulation.experimentalNativeSewFirst===true` selects the research pipeline. The native HTTP service honors the experimental flag. Test coverage includes `scripts/check-sew-first-assembly.mjs` (immutability, determinism, seam closure, fixed-particle handling, quality rejection), `scripts/qa-sew-first-workflow.mjs` (real UI and service) and all preexisting garment geometry tests.

## Remaining engineering gap before automatic fitting

The production target is **a nonrigid contact-constrained sewing initialization**, not a seam-only relaxation followed by violent body projection. It requires a common representation of the avatar's *real surface* (not just overlapping analytic torso/arm proxies), a consistent surface-side/geodesic shoulder parameterization, seam convergence with intrinsic rest metrics, robust vertex-face/edge-edge cloth/body collision and a continuous trajectory solver. The current native contact routines, which project each shape sequentially, conflict with new seam positions; this cannot be fixed by changing one stiffness multiplier.

Do not make sew-first the default until actual T-shirt, hoodie and zip hoodie trajectory tests demonstrate calibrated strain, acceptable sewing gaps, all-frame contact clearance (swept triangle CCD and self-intersections), stable garment orientation and user-approved visual fit. No physical sample has been approved.
