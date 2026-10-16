# Rust/Metal PPF reference: repeatability audit and 180-frame smooth pinned-body fitting

**Date:** October 14, 2026.  
**Software:** Garment Studio; installed ZOZO/ST-Tech PPF Contact Solver.  
**Status:** Test harness + independently checked physical evidence. NOT a collision-safe fitted garment. Installed C++/Qt app, existing CLO projects and original Rust solver were not changed.

## Executed simulations

The original saved source is a *completely executed* 240-frame Rust Metal run with the upstream Codim-IPC dress, pinned animated body, 851 sewn constraints and linear pin interpolation. There are **241** saved outputs and definite body crossings at 87:2, 90:492, 174:2. Its final dress looks plausible; zero terminal-step `### intersection detected` lines were logged despite these **exported output** crossings. See `docs/NATIVE_PPF_INTEGRATION_CHECKPOINT_2026-10-14.md`.

Three independently executed **smooth interpolation** A/B sessions now exist, all using exactly the same input dress, body, body jitter, all 120 prescribed body-pose targets and the same original material/dynamic-timestep settings (except requested output horizon for the 180-frame variant):

| Test | Output frames present | Confirmed discrete cloth/body intersection frames | Max recorded pair count | Physical fit passed? |
| --- | ---: | --- | ---: | --- |
| Original upstream (linear pins) | 0–240, 241 total | 87:2, 90:492, 174:2 | 492 | **No** |
| Smooth reference A, 96 frames | 0–96, 97 total | 90:4 | 4 | **No** |
| **Smooth reference B, 96 frames, exact same settings** | 0–96, 97 total | **95:4** | 4 | **No** |
| Smooth reference C, 180 frames | 0–180, 181 total | **138:2** | 2 | **No** |

All output frames in the smooth runs were checked with the installed upstream Rust geometric triangle intersection detector. Independently, **Blender BVH plus strict float64 edge/triangle crossing** checks reproduced the exact counts for relevant positive and negative frames: `logs/ppf-upstream-smooth96-independent-crossings-20261014.json`, `logs/ppf-upstream-smooth96-repeat-independent-selected-20261014.json` and `logs/ppf-upstream-smooth180-independent-selected-20261014.json`.

**Smooth reference C's first 181 samples passed the reference material strain/stitched-seam checks**: 851 physical stitches, maximum principal stretch **1.097546** (configured bound 1.10), **0 faces above the reference 10% stretch threshold** at sampled outputs, final average stitched gap **0.114465 cm**, final worst gap **0.615093 cm**. It still has two real crossings at frame **138** and it has NOT passed independent swept CCD. This is a reference dress, **not Thomas's T-shirt** and not a certified virtual garment fit.

The frame-138 body collision is exactly at pin-animation segment boundary **t=2.300 s**, operation boundary 72, where the P95 velocity jump of the original linear target sequence is **0.520 m/s** (approximately 90.7th percentile among 118 transitions). Two body triangles (`35044`, `35046`) intersect one cloth triangle (`16004`) near `(−0.138, +0.450, +0.048)` metres. No body crossings were detected at frame 174 of the completed smooth-180 run, but a different two-pair event appeared at frame 138. **This redistribution is not elimination of contact failure.**

## Confirmed run-to-run lack of bitwise reproducibility

`scripts/audit_ppf_repeatability_20261014.py` compared both independent **96-frame smooth experiments A and B** after successful raw solver completion. Importantly, this is a true A/A test: not an artifact of changing `frames=96` to `frames=180`.

- **All 132 native encoded solver binary files under the two sessions' `bin/` directories are SHA-256 identical**, including mesh geometry, stitching indices/weights, all 120 body pose targets and collider indices.
- The two `param.toml`, `dyn_param.txt`, `info.toml` and `param_summary.txt` files are byte-identical. Both use the same installed compiled Rust solver binary, the same seeded jitter and the same 96-frame horizon. The session file paths differ, as expected; the pickle encodes session identity/metadata and is not asserted to be byte identical.
- The first **saved frame 0 is bitwise identical**, but the first differing native saved geometry occurs at **frame 1**. Across frames 0–96, the peak cloth-vertex disagreement between A and B is **12.566 mm** and peak pinned-body disagreement is **1.854 mm**.
- The very first accepted-step `time` and `final_dt` logs already diverge at roughly 1e−9 seconds after the initial step. The divergence grows, changing the set of contact-positive output frames from **90** to **95** even though scene files and explicit simulation settings match. These are real different native integration trajectories, not only a different export interpolation alpha.
- Comparing A to the smooth **180-frame** run found the same frame-1 disagreement and up to **20.920 mm** peak cloth displacement by frame 96. A horizon change can confound that pair, but **cannot explain the A/A disagreement** where the horizon is identical.

The installed Rust source itself acknowledges that the physical solver is *non-deterministic run to run* in `crates/ppf-cts-solver/src/driver/pcg.rs` around line 2650. Its Metal contact/force kernels also use atomic floating-point additions, which can be order-sensitive. The exact source of the observed divergence in **this** production scene (float atomics, GPU work scheduling, runtime initialization or some other internal nondeterminism) has **not** been isolated, so do not ascribe the full measured effect to one particular kernel without step-level tracing.

**Engineering consequence:** one visually clean smooth run is insufficient evidence for robust contact, because independent runs of the *same* input may intersect at a different frame or body part. Repeated independent evaluations and a strict fail-closed acceptance gate are needed.

## Output interpolation adds another independently measured discrepancy

See `docs/PPF_EXPORTED_FRAME_INTERPOLATION_DIAGNOSIS_2026-10-14.md`. The upstream Rust driver checks committed step geometry with `contact.check_intersection`, but the video writer interpolates free cloth and evaluates the pinned body at exact output time. At original frame 90 the free-cloth exported position used lerp alpha **0.542**; in smooth-96 A, **0.565**. No terminal solver step reported a crossing, yet saved outputs showed 492 and four. Between clear 60 Hz output frames 92 and 93, sampling the linear video-interpolation curve at intermediate times finds **11** crossed pairs for smooth-96 A. This is *not* swept CCD of the solver's true trajectory, and it cannot distinguish every possible source of collision.

The newer smooth-180 run has **zero saved frame crossings around original late frame 174**, and also zero at frame 90, yet **two at frame 138**. Interframe sampling around 134–141 and 170–178 found no extra smooth-positive interpolation samples beyond the frame-138 event, while the original linear trajectory still showed contact near frame 174. Interframe checking at all other frame intervals, independent physics-step trajectory CCD, and true contact acceptance are still missing.

## Reproducible regression checks

```bash
node scripts/check-ppf-pin-policy-ab.mjs
node scripts/check-ppf-smooth180-materials.mjs
node scripts/check-ppf-multirun-robustness.mjs
node scripts/check-ppf-export-interpolation-regression.mjs
node scripts/check-ppf-pin-chord-audit.mjs

# Re-run offline physics measures (installed upstream PPF Python environment):
PPFPY=research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64/python/bin/python
"$PPFPY" scripts/audit_ppf_repeatability_20261014.py \
 --runs logs/ppf-upstream-smooth96-20261014.json \
        logs/ppf-upstream-smooth96-repeat-20261014.json \
        logs/ppf-upstream-smooth180-20261014.json \
 --compare-up-to 96 --out logs/ppf-smooth-multirun-repeatability-20261014.json
```

## Next native engineering tasks

1. Make an **isolated instrumented copy** of the Rust solver for **committed-step vertex dumps** around keyframe times; compare the internal contact-gate mesh against the exact cloth/body mesh written to output. Do **not** modify the installed upstream binary in place. Solve the sampling issue without post-snap mesh hacks or weakening self/body collision filters.
2. Audit floating-point and GPU reduction order in the exact **first substep**, where two identical trials already diverge. Separate nondeterministic initial contact ordering from numerical sensitivity or process state. A deterministic debug mode with serial/stable reductions is an appropriate experiment, but only if it keeps genuine physics and independent contact checking.
3. A clean reference must pass **all required saved-frame and swept-CCD intervals**, across multiple independent runs, with stable sewing, material strain and final clearance. Do not certify dress/sleeves on the strength of one final snapshot or one 96-frame run. A full-length smooth 240-frame A/B would still be necessary to evaluate the entire animation beyond 180.
4. The Thomas-shirt problem remains separate and unfinished: the maximum near-sewn initial stitch gap is **18.742 cm vs the required 3 cm**, despite no initial mesh intersections and fabric rest-edge deformation below 5%. No improvement to the reference dress should be presented as having solved this 2D-to-3D garment assembly blocker.

**Bottom line:** True Rust physics is executing and sewing, and smooth body animation **massively reduces** the worst discrete body crossings, but does not eliminate them reliably. The immediate priorities are deterministic/debuggable solver steps, synchronized physical frame export and contact QA that rejects unsafe output.
