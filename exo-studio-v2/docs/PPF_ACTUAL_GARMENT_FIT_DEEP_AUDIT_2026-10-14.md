# ZOZO PPF Contact Solver — actual garment-fit integration audit

**Date:** 2026-10-14. **Verdict:** REAL PPF SOLVER EXECUTED; GARMENT FIT FAILED. This report distinguishes upstream solver behavior from our garment-mesh/Blender/solver pipeline. It does not claim the final CLO-style dressed T-shirt is complete.

## 1. Proven upstream implementation and our integration

Upstream: <https://github.com/st-tech/ppf-contact-solver>. The locally installed native arm64 runtime has executable `target/release/ppf-cts-server` and `target/release/ppf-contact-solver`; `research/ppf-local/runtime/.../examples/fitting.ipynb` provides a stitched dress (`load_CIPC_stitch_mesh`, `asset.add.stitch`, `dress.stitch`) and an explicitly **pinned body mesh** (`body.pin`) with time-varying pose. PPF's native solver is fundamentally its own Rust implementation; the future C++/Qt editor should invoke this upstream solver behind an adapter, not replace its physics with an unverified in-house approximation.

Our actual path:

1. `src/core/backends/ppfPayload.js` creates cloth triangles, stable piece/pattern-index mappings, 98 loose stitch links, physical material settings, avatar type, and simulation settings.
2. `ppf_backend/server.mjs` stages individual panels and, for the supported four-piece Thomas tee, optionally performs progressively folded nonrigid sleeve/torso/shoulder assembly followed by rigid seam alignment. It applies a maximum 3 cm initial stitch separation gate before invoking PPF.
3. `blender_bridge/ppf_prepare_scene.py` creates one continuous cloth object with loose stitch edges and a separate physical Thomas body collider. PPF's Blender add-on is configured with SHELL garment group, STATIC or prescribed/pinned SHELL body group, explicit metric 1 mm contact gaps, 5% strain limiter, real loose stitch edges, gravity and collision policy; post-solver exact seam snapping is disabled.
4. `blender_bridge/ppf_run_configured.py` encodes the real scene into upstream PPF's native server, builds and advances it on Apple Silicon Metal, fetches solver result into a PC2 animation, and saves a Blender scene.
5. `scripts/analyze-ppf-sewing.mjs`, `blender_bridge/check_ppf_dynamic_contact.py`, `check_thomas_ipc_ccd.py`, and `check_ppf_fit_clearance.py` independently check actual cloth frames. `ppf_backend/fitAcceptance.mjs` prevents a physically invalid run from being labelled accepted.

## 2. Actual historical Metal evidence (October 13 fixture)

Source folder: `blender_bridge/output/ppf-fit-tuning-20261013/`.

| Evidence | Measured result |
| --- | --- |
| Native solver executed | `backendType=mac_native`, `device=GPU`, encode/build/run/fetch/saved all completed |
| Real trajectory | 20 PC2 frames, 500 cloth vertices, 768 cloth faces |
| Sewing topology | 98 stitch pairs, 14 seam groups |
| Sewing movement | 24.792 cm initial mean gap to 1.010 cm final; 95.93% mean-gap reduction |
| Largest remaining seam separation | 9.979 cm, unacceptable |
| Native body collisions | First at frame **3**, up to **192** avatar triangle intersection pairs |
| Cloth self collisions | 0 measured by the triangle intersection test |
| Maximum principal stretch | 1.04944 (within 5% configured limiter) |
| Swept CCD | Fails at transition into frame **3** |
| Fit clearance | Shoulder mean 2.603 cm, shoulder p90 5.887 cm, torso mean 2.789 cm; all above acceptance limits |
| Native/export geometry parity | **0 m maximum PC2 coordinate error**; native body intersections match Blender audit on every frame |
| Acceptance | **FAIL**: collision, seams, swept CCD and shoulder fit fail |

**Important:** The native body audit confirms the penetration exists **in the actual native solver output**; the PC2 conversion is not responsible for these crossings. The solver is computing cloth and the stitches are pulling pieces together; this is not merely a 3D visual animation. However it is physically unsafe and not an accepted garment fit.

The saved Blender `tee-configured.blend` has **SHELL garment and STATIC Thomas avatar** (verified by reading the actual installed PPF Blender object groups), `allowInterGroupIntersection=false`, and `postSnapExactly=false`. Therefore the historical regression is a genuine case of inter-group crossings **despite** a nominally enabled contact policy. The upstream fitting reference uses a pinned dynamic body; this discrepancy deserves a controlled A/B test, but it is **not yet proof** that STATIC group type alone caused the crossings.

## 3. Separate unresolved assembly blocker

The most recent Thomas tee initialization experiments refined 976 cloth vertices and 1,632 faces with 98 physical stitch pairs. Their best post-aligned pose had **7.406 cm mean initial gap and 19.291 cm maximum gap**, despite no detected initial self/body intersections and no more than 4.582% edge distortion. Current PPF fitting preparation intentionally refuses to run a production fitting trajectory if *any* sewn-pair starting gap exceeds 3 cm. Thus that new initial assembly has **not** yet yielded an accepted production Metal PPF drape.

Do not conflate these two distinct failures: (a) latest, more geometrically careful preassembly does not meet the fit-start gate, and (b) an earlier, explicitly experimental run bypassing the assembly limitation did run Metal but penetrated Thomas after frame 3.

## 4. Verified fixes in this pass

1. **Input integrity:** `validatePpfPayload` now checks every 3D vertex for finite metric coordinates, degenerate/invalid triangle indices, duplicate or invalid stitches, seam IDs and stitches accidentally overlapping mesh triangle edges. All existing tee, hoodie, zip-hoodie and pants source payload fixtures pass; deliberately corrupted fixtures are rejected.
2. **No silent collider changes:** Thomas payloads must explicitly name `scene.avatarRepresentation` (`pinned-shell` or `static`). `ppf_prepare_scene.py` also refuses a Thomas scene whose collision group type was omitted. Older saved diagnostic scenes are still readable, but new fitting configurations may not silently switch to STATIC.
3. **Actual frame acceptance:** fit acceptance requires full contiguous contact and sewing coverage, matching final seam metrics, nonzero actual stitch count, zero per-frame collision/strain violations, full ordered swept CCD intervals and shoulder clearance from the final frame. A misleading `allFrames...=true` summary can no longer suppress a bad intermediate frame.
4. **Independent historical audit:** `node scripts/audit-ppf-real-fit.mjs --expect-failed` verifies the *real* saved PPF GPU run, PC2 binary, input cloth topology, frame counts, sewing, native body-contact consistency, swept CCD and clearance. It intentionally confirms the historical run remains **REJECTED**. Without `--expect-failed` the same command exits nonzero for unacceptable physical fit.

Tests passed: `node scripts/check-ppf-payload.mjs`, `node scripts/check-ppf-fit-settings.mjs`, `node scripts/check-ppf-fit-acceptance.mjs`, `node scripts/check-ppf-assembly-acceptance.mjs`, `node scripts/check-ppf-staging-seams.mjs`, the real-fit audit, Python source compilation and `bash scripts/check-ppf-physical-settings.sh`. The Blender configuration smoke test confirms explicit metric 1 mm avatar/cloth gaps, 5% strain limiting, and correct independently configurable pinned-body contacts. **These are correctness and fail-closed improvements, not a solved shirt.**

## 5. Next experiments required before declaring proper integration

**P0 — Reproduce upstream fitting on this runtime.** Run the unmodified locally bundled `examples/fitting.ipynb` (or equivalent headless case) in an isolated solver work directory and record known-good stitch/boundary/body collision behavior. This establishes that the exact current runtime/config actually solves the upstream dress case on this Mac; compiling/loading PPF isn't enough.

**P0 — Controlled STATIC vs pinned-shell comparison.** Starting from the **same** valid zero-intersection near-assembled garment, identical thickness/material/gravity/frames, compare Thomas as STATIC and SHELL+fully pinned. Record native solver contact groups, exact encoded geometry, collision-policy bits, vertex/frame mapping and independent post-export triangle+IPC swept checks. The current saved failed fixture was STATIC; upstream `fitting.ipynb` used an explicitly pinned body. Avoid claiming the alternative fixes collisions before obtaining measurements.

**P0 — Valid 3 cm-near stitched assembly.** Improve the *actual 2D-to-3D sewing geometry* at shoulders, sides and armholes with remeshing/strain-safe fold/placement; retain all 98 stitch correspondences. A stage with 19 cm open seams is not yet a dressed shirt. Do not artificially weld/snap seam vertices after solver output.

**P0 — Inspect contact constraint participation.** Audit upstream encoded group meshes and collision constraints, not only Blender UI flags. Check body winding, thin/open surface/contact orientation, excluded adjacency, inter-group pairs, discrete-vs-swept contact trajectory and the correctness of `STATIC`/`SHELL` interface. The independent native BVH crossing evidence makes this essential.

**P1 — Proper garment solver handoff and fit output.** Independent full-frame criteria: zero triangle and swept collisions, no enclosed cloth skin penetrations, bounded principal stretch, final seam mean ≤0.2 cm, final seam max ≤1 cm, shoulder mean clearance ≤1.5 cm, shoulder p90 ≤3 cm, torso mean ≤2 cm. Confirm final hem height/drape and material calibration with real textile measurements; thresholds are engineering gates, not factory certifications.

**Safety:** Existing PPF/Blender processes and prior GPU jobs may already be present. Do not kill other workers, bypass the initial assembly guard, or run many full-resolution PPF experiments concurrently. Preserve the existing working Garment Studio app and user documents; never replace the user-facing simulation with an unverified output. Full native C++/Qt migration must retain this independent acceptance boundary while consuming the Rust-first upstream PPF engine through a native adapter.
