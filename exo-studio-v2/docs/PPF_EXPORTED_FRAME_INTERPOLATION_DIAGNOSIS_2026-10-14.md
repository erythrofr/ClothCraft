# ZOZO/PPF output-frame interpolation and cloth/contact divergence

**Date:** October 14, 2026.  
**Project:** Garment Studio hybrid C++/Qt + Rust PPF.  
**Experiment:** Read-only analysis of Jarvis's completed installed-upstream Rust/Metal fitting benchmark and independent smooth-pin A/B. No original solver binary, saved CLO file, installed app, user pattern, or existing project was modified.

## Specific engineering finding in the installed Rust implementation

**The collision acceptance gate checks the *committed solver pose*, not necessarily the final video frame returned by the PPF backend.** The two are not always the same 3D mesh.

Relevant installed source:

- `research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64/crates/ppf-cts-solver/src/driver/step.rs`, final committed-pose `contact.check_intersection(...)` at approximately lines 2625–2706. The solver logs `### intersection detected` if this check finds a crossing and marks `intersection_free=false`.
- The *same runtime's* `crates/ppf-cts-solver/src/backend.rs`, `write_frame_outputs` around lines 415–629. When an integration step spans an output time, the exporter **linearly interpolates unpinned cloth vertices from step start/end states**. In contrast, **pinned body vertices evaluate the exact scripted body pose at the output time and linearly interpolate only their step residuals**. The exported frame is therefore a hybrid resampling of cloth and a known body path.
- Its caller in `backend.rs` around lines 1240–1280 outputs all crossed video-frame timestamps after the step advances. There is **no independent collision check in the export writer** following that interpolation in the inspected source. This is a candidate explanation of how a terminal `check_intersection` can be clean yet a saved frame contains crossed cloth/body triangles.

That mechanism is verifiable from installed *source*, not an inference from a screenshot. It **does not prove** all observed intersections originate solely in the writer: a final device kernel omission, narrow-phase tolerance difference or physics-substep crossing could coexist. We have not captured live solver step meshes and performed independent off-device contact checks at each exact commit.

## Native logs: how far the worst failing frames are from real solver states

`scripts/analyze_ppf_export_interpolation_20261014.py` reconstructs logged integration step start times and accepted `final_dt` from the **original unmodified native stdout**, then computes the exporter lerp fraction for each video-frame timestamp.

| Output frame | Native reference (linear body pins) | Independently run smooth-body experiment |
| --- | ---: | ---: |
| 87 (1.45 s) | 17.5% between checked steps | 48.6% between checked steps |
| **90 (1.50 s)** | **54.2% between checked steps** | **56.5% between checked steps** |
| 92 (1.5333 s) | 39.8% between checked steps | 30.3% between checked steps |
| 93 (1.55 s) | 15.0% between checked steps | 67.5% between checked steps |
| 174 (2.90 s) | 50.6% between checked steps | Not captured by the 96-frame experiment |

**Neither native stdout contained `### intersection detected` at any solver committed step**, yet independent native Rust and Blender strict triangle checks found 492 crossings in the *exported* original frame 90 and four in the *exported* smooth frame 90. At frame 90, neither exported cloth state equals one of the two CCD/committed-step states; the exporter blends them, while using the body target at exactly 1.5 s.

## Quantitative pinned-body pose mismatch at frame 90

`scripts/audit_ppf_pin_export_chord_20261014.py` reconstructs the source pin motion with the actual upstream `smoothstep` (`u²(3−2u)`) and original 25 ms segment target meshes. It measures the difference between the exact body pose at output time and an ordinary chord between scripted body poses at the two solver-step endpoints. This is **not the observed physical cloth/body penetration depth**.

| Frame 90 body discrepancy | Linear input | Smooth input |
| --- | ---: | ---: |
| Median over 12,811 pins | 0.243 mm | 0.145 mm |
| 95th percentile over all pins | 1.541 mm | 0.785 mm |
| Maximum anywhere on body | 3.023 mm | 1.161 mm |
| Median for sampled body vertices involved in reported crossings | 1.258 mm | **0.674 mm** |

PPF's reference shell contact-gap setting is 1 mm. These pose differences are of a comparable order of magnitude, making **output-time pin/cloth synchronization** a relevant hypothesis. Body mesh motion can amplify penetration risk if the free-cloth chord and exact pin pose do not follow the same curved path. This mismatch is a *geometric comparison*, not an internal proof of the solver's cause.

## Extra hazards invisible to a frame-only audit

The new `scripts/audit_ppf_interframe_contact_20261014.py` samples eight equal fractions between each **saved 60 Hz output frame**, using the original installed Rust geometry intersection detector on a linear approximation between successive outputs. This is not the actual solver substep trajectory and **must never be labeled swept CCD**.

| Original source | Saved frames 92 and 93 | Unsaved interframe sampled peak |
| --- | --- | ---: |
| Original linear body animation | Both zero crossings | **17** crossing pairs |
| Smooth body animation | Both zero crossings | **11** crossing pairs |

The unobserved danger in the smooth case occurs around **1.5396–1.5417 seconds**, near body position `(0.095,0.331,0.114)` m. This demonstrates why a 60 Hz frame-only mesh audit is an insufficient *test specification*: interpolated playback geometry may be crossed at times not represented by the saved endpoints. It is not full CCD evidence about the *internal* solver's path.

Regression: `node scripts/check-ppf-export-interpolation-regression.mjs` passes against the logged Rust runs and refuses to mark the mesh physically fitted.

## High-confidence next engineering experiment (safe independent branch, not an installed solver overwrite)

1. **Capture the actual bracketed solver step poses** around 1.50 s and 1.54 s, with their step timestamps, while leaving original simulation dynamics, body targets and source meshes unchanged. Independently test those exact GPU-committed poses with the upstream Rust detector and Blender strict triangle checks. This separates a defect in the solver collision gate from a defect *introduced by export interpolation*.
2. **Change only export sampling strategy in an isolated build**: run the solver so that each requested visible timestamp is an actual accepted physics step, or use a collision-aware export sample. The former should preserve real solver physics and avoid visual post-snap hacks, but needs careful handling of very short remaining time intervals and CCD-reduced steps; it must be tested, not assumed correct. **Do not patch the installed upstream production binary blindly.**
3. Fail closed if the exported interpolated mesh still contains *any* triangle crossings, even when the solver's committed-step gate is clean. Preserve the per-frame and swept-CCD requirements and do not treat a clean final frame as a pass.
4. The cloth-body PPF reference and the real Thomas T-shirt are separate problems. The Thomas initial assembly still needs a near-sewn configuration within the required ≤3 cm worst stitch separation, no initial intersections and ≤5% intrinsic edge strain before GPU fitting can be accepted.

## Reproduce with existing (non-running) artifacts

```bash
python3 scripts/analyze_ppf_export_interpolation_20261014.py \
  --runs logs/ppf-upstream-fitting-full-20261014.json logs/ppf-upstream-smooth96-20261014.json \
  --audit logs/ppf-upstream-full-audit-20261014.json \
  --out logs/ppf-output-interpolation-audit-20261014.json

PPFPY=research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64/python/bin/python
"$PPFPY" scripts/audit_ppf_interframe_contact_20261014.py \
  --runs logs/ppf-upstream-fitting-full-20261014.json logs/ppf-upstream-smooth96-20261014.json \
  --intervals 84:93 --substeps 8 \
  --out logs/ppf-interframe-linear-vs-smooth96-20261014.json

"$PPFPY" scripts/audit_ppf_pin_export_chord_20261014.py \
  --interpolation-audit logs/ppf-output-interpolation-audit-20261014.json \
  --runs logs/ppf-upstream-fitting-full-20261014.json logs/ppf-upstream-smooth96-20261014.json \
  --frame 90 --out logs/ppf-pin-chord-vs-exact-frame90-20261014.json

node scripts/check-ppf-export-interpolation-regression.mjs
```

**Status:** This is a validated diagnostic study and regression tooling, not a repaired physical fitting solver or a pass of swept CCD.
