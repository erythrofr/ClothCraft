# ZOZO PPF upstream dress: animation-keyframe contact forensics

**Owner:** Garment Studio continuation of Jarvis's October 14 native PPF work.  
**Primary upstream reproduction:** `logs/ppf-upstream-fitting-full-20261014.json`.  
**New non-destructive analysis:** `scripts/analyze_ppf_reference_motion_contact_20261014.py` and `logs/ppf-upstream-motion-contact-localization-20261014.json`.  
**Status:** Collision hypothesis localized; original benchmark is **not accepted as a penetration-free fit**. No changes were made to user projects, installed CLO, or upstream Rust solver.

## Jarvis's independently reproduced upstream baseline

Jarvis ran the *installed* `st-tech/ppf-contact-solver` upstream fitting notebook setup with its original dress/Codim-IPC assets: 240 frame advances / **241 raw saved samples** on Metal, 15,656 cloth vertices, 29,456 cloth triangles, 25,472 prescribed-body triangles and **851 sewn constraints**. This run completed and produced a plausible final rendered dress with **0.11219 cm mean / 0.46010 cm maximum** final seam gap and **1.097995** peak measured principal stretch (reference strain limit 1.10). Nevertheless the all-frame raw mesh audit found definite cloth/body intersections. Its final result is not independently full-trajectory safe.

The intersections are confirmed independently by strict float64 triangle crossing checks in Blender and by the installed upstream Rust intersection checker. The previous audit `logs/ppf-upstream-full-audit-20261014.json` covers all 241 samples; a final snapshot alone is not evidence of continuous safety, and **swept CCD remains unverified**.

## New forensics: all failing frames are pin-animation boundaries

| Saved solver frame | Physics time | Cloth/body triangle-pair crossings | Upstream pinned-body keyframe | P95 body target velocity jump | Percentile among 118 pin transitions |
| --- | ---: | ---: | --- | ---: | ---: |
| **87** | 1.4500 s | 2 | operation boundary 38 | **0.970 m/s** | **99.15th** |
| **90** | 1.5000 s | **492** | operation boundary 40 | **0.621 m/s** | **95.76th** |
| **174** | 2.9000 s | 2 | operation boundary 96 | **0.483 m/s** | **87.29th** |

These three are **all collision-positive frames in the entire 241-sample run**. All match explicit pinned-body animation segment boundaries (`t = 0.5 + 0.025k`) to native solver frame timestamps, including the 60 FPS `statistics_N.cbor` records. The interpolator in the original example is **piecewise linear**. The velocity changes above are computed from three consecutive original `pin-0-op-*.bin` target arrays (12,811 body vertices) and the 25 ms pin segment duration. They are *velocity discontinuities*, **not body position discontinuities**.

**Crucial control:** there are large velocity jumps at other keyframes too, including one even larger at **frame 84 / 1.40 s** (1.224 m/s P95), yet frame 84 is collision-free. Therefore temporal alignment is compelling but **does not prove** keyframe discontinuity is the sole cause of penetration. Cloth state, local relative movement, numerical tolerances and solver contact time-stepping could all contribute.

**Encoded pinned-body target check:** the body position at frame 90 closely matches its *correct* animation target (`pin-0-op-39.bin` plus the original body Y translation `-0.78 + jitter`) to **0.00871 mm maximum** across its pinned vertices. At frame 87 the maximum target deviation is under **0.955 mm**, and at frame 174 under **0.793 mm**. This rules out a wholesale incorrect avatar-position transform at the worst frame; it does not prove full body/cloth contact correctness.

## Collision localization and relative frame movement

- **Frame 87:** 2 body crossings: *one* cloth triangle (`4629`) intersecting two body triangles around XYZ ≈ `(0.167, −0.13, 0.095)` m. The affected body vertices moved 12–16 mm since the preceding 60 FPS frame; affected cloth vertices moved ~13–14 mm.
- **Frame 90:** 492 body crossings: **178 unique cloth triangles**, **142 unique body triangles**, split across multiple connected cloth components. The largest cloth connected component accounts for **311 crossing pairs**, second for **75 pairs**. The involved vertices cover several anatomical regions, not one single degenerate triangle; the broad AABB extends approximately Y = −0.17..+0.47 m. The affected body vertices moved ~2–8 mm in the preceding frame; affected cloth vertices moved ~3–7.4 mm.
- **Frame 174:** 2 body crossings involving one cloth triangle (`1624`), two body triangles, around XYZ ≈ `(0.092, +0.394, −0.063)` m. Affected body vertices moved ~3.7–7.9 mm, cloth ~4.4–6.5 mm.
- The native `statistics_N.cbor` stream confirms collision frames correspond to solver output times 1.45, 1.50, 2.90 seconds. It also reports active contact handling at those times; **contact_count does not itself certify penetration-free contacts**.

Contact metadata is sourced directly from native raw `vert_N.bin`, `tri.bin`, `pin-ind-0.bin`, `pin-0-op-N.bin` and native statistics CBORs. Report stores the raw input SHA-256 hashes, runtime executable SHA-256, the original notebook/asset hashes and the solver commit observed in its stdout. We did not produce a new fitted garment, alter solver binary parameters or hide failed frames.

## Bounded A/B experiment (separate from the old run)

Implemented `scripts/compare_ppf_reference_pin_policy_20261014.py` for **one variable at a time**:

1. `--policy smooth`: same 120 body-pose targets, stitch topology, rest geometry, materials, 25 ms keyframe times, jitter, momentum/`dt` schedule, original Rust solver and Metal. Replaces the pin interpolation from `linear` to upstream-supported `smooth` (this eliminates nonzero velocity precisely at isolated keyframe endpoints, but may introduce short stop/go accelerations).
2. `--policy stationary`: pins the body at the original start pose and removes target motion; this is a negative control, not an equivalent animated-dress task.

Both are isolated, uniquely named sessions with the existing shared runtime lock, finite execution time and no modification to the original baseline. The 96-frame *smooth* run was started as a bounded experiment; inspect `logs/ppf-upstream-smooth96-20261014.json` for its **actual** state. Its result must not be called a fit until the native run completes and a fresh raw-frame audit detects no crossings. A 96-frame negative result would only cover the first original 90-frame contact burst, not the later event at frame 174.

**Important interpretation:** changing pin easing does **not** change the actual target mesh position at exact keyframe endpoints. Any improvement there would result from changed cloth dynamics / relative motion over preceding substeps, not from relocating the animated body at those endpoints.

### A/B results: native solver completed but the Python wrapper misreported timeout

The smooth-interpolation experiment's Python orchestration wrapper reported a timeout at the 300-second mark, before the last file flushes were visible, and wrote `state=error`, `nativeSamples=88`. **Preserve that original runner report unchanged.** Independent post-run inspection establishes that the unique native Rust/Metal session subsequently wrote `vert_0.bin` through `vert_96.bin` (**97 contiguous native samples**), its valid `finished.txt` timestamp (`2026-10-14 19:50:00 EDT`), the native `simulation finished` log marker, and an empty error log. The native execution actually **completed 96 frame advances**. The discrepancy is an asynchronous wrapper deadline/finish race, not a missing last frame in the native solver output. `scripts/audit_ppf_pin_policy_ab_20261014.py` explicitly records both `runFinished:false` *as originally reported by the wrapper* and `completeTrajectory:true` *as independently demonstrated by the native output artifacts*.

Original and smooth runs share exactly the same upstream source asset hashes (dress, body, notebook), mesh/stitch counts, `param.toml` values **except** run length (`240` vs `96`), `dyn_param.txt`, seeded body offset and all **120 position targets**. The smooth session's `info.toml` explicitly encodes `transition="smooth"` for all 120 operations (original: `linear`). This is a controlled interpolation-policy comparison for **frames 0–96**.

| Native frame | Original linear | Modified smooth | Difference |
| --- | ---: | ---: | --- |
| 87 / 1.45 seconds | **2** cloth/body triangle crossings | **0** | Eliminated in observed discrete frame |
| 90 / 1.50 seconds | **492** cloth/body crossings | **4** | **99.19% fewer**, but still fails contact acceptance |
| 96 / 1.60 seconds | **0** | **0** | Both clear at this output frame |

The **only** surviving positive smooth contact frame across all 97 saved samples is frame 90. Its **four** intersections are concentrated on **one cloth triangle (`3100`) crossing four body triangles (`34640`, `34795`, `34796`, `34798`)**, around XYZ ~`(0.147, 0.448, -0.093)` metres, rather than the original 178-cloth-triangle, 142-body-triangle event.

Crucially, the residual four are **independently confirmed** by Blender BVH and strict float64 edge/triangle crossing tests at frame 90 (Rust, Blender BVH and strict test all report exactly 4). The independent check also finds zero at samples 0, 89 and 96. Evidence: `logs/ppf-upstream-smooth96-ab-audit-20261014.json`, `logs/ppf-upstream-smooth96-independent-crossings-20261014.json` and regression `scripts/check-ppf-pin-policy-ab.mjs`.

**Inference and boundary:** smoothing the *pinned avatar's keyframe transitions* strongly reduces these discrete geometric penetrations while leaving the physical scene and target body geometry unchanged. However four still remain at frame 90, no independent **swept CCD** has passed, and the original later crossing at frame 174 is outside this 96-frame experiment. This is a major diagnostic improvement, **not a fully collision-safe physical fitting implementation or a validated Thomas fit**.

The experimental Python runner now provides a bounded `--completion-grace` option (default 25 seconds, only if within 12 frames of the requested end) and checks an actual native `finished.txt` plus all expected frame files before reporting success. This prevents recurrence of the observed timeout/completion race without disabling time bounds or killing unrelated solver processes.

## Reproducibility and acceptance commands

```bash
RUNTIME=research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64
"$RUNTIME/python/bin/python" scripts/analyze_ppf_reference_motion_contact_20261014.py \
  --run-report logs/ppf-upstream-fitting-full-20261014.json \
  --out logs/ppf-upstream-motion-contact-localization-20261014.json \
  --windows 80:96,168:178
node scripts/check-ppf-upstream-motion-contact.mjs

# Explicit, *optional* bounded experiment; run only when no other PPF session
# holds the shared runtime lock. Do not run concurrent GPU fitting experiments.
"$RUNTIME/python/bin/python" scripts/compare_ppf_reference_pin_policy_20261014.py \
  --runtime "$RUNTIME" --assets research/oss/Codim-IPC \
  --policy smooth --frames 96 --timeout 300 \
  --report logs/ppf-upstream-smooth96-20261014.json
```

## Remaining science and engineering priorities

1. Observe outcome and raw frames of the bounded smooth/interpolation A/B run. Compare frames 87 and 90 with identical source meshes and target timestamps, not just final rendering.
2. If smooth does not resolve crossings, consider a stationary-body control and a deliberately time-subdivided pinned-motion reproduction. Keep geometry, contact enablement and fabric parameters fixed while varying one factor. No acceptance gate is to be relaxed.
3. Audit the **solver's continuous-time contact policy across 25 ms prescribed-motion segments**, its substepping and contact barrier near body animation keyframes. The collected body target residual rules out an obvious coordinate-transform error at frame 90.
4. Separately continue Thomas's *initial assembly* challenge: worst stitch gap **18.742 cm**, while production PPF gate requires **≤3 cm** with ≤5% fabric distortion and no initial body/self crossings. No successful PPF reference reproduction implies that Thomas's exploded pattern is correctly staged.

**Conclusion:** Jarvis's upstream simulation and native C++ transport are real advances, but neither C++/Qt migration nor a fully physical, collision-safe garment fit is finished. This forensics pass identifies a small set of reproducible, spatially localized boundary-time failures and provides a controlled way to test their cause. Do not alter accepted-simulation conditions or promote failed trajectories to a production preview.
