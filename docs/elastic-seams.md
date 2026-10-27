# Elastic seams: CPU investigation

This is an opt-in research probe, not a new editor backend or a calibrated
thread material. Production VBD/OGC, contact exclusions and easing are unchanged.

## Two different mechanisms

The existing seam penalizes separation between paired material-boundary points:
`E = 0.5 * k * sum(w * |gap|²)`. Here `k` is N/m², quadrature weight `w` is m,
gap is m and energy is J. Weights integrate the mean length of both boundaries.
`allow_ease` permits unequal material lengths; it does not change their rest
geometry or define an elastic thread. The cloth must accommodate the mismatch.

A possible longitudinal thread instead has rest length L0 and axial rigidity
EA in N. The independent analytical candidate in the probe is tension-only:
`E = EA/(2 L0) * max(L-L0, 0)²`. Its tension is
`EA/L0 * max(L-L0, 0)`. It has zero compression force and a continuous first
derivative, but discontinuous second derivative at L=L0. EA is an assumed
parameter, not a measured fabric or thread value. This expression alone does
not provide attachment, bending, friction, hysteresis, or contact semantics.

**The candidate is not coupled into cloth dynamics.** Doing that requires an
explicit choice of thread path, rest lengths, attachment correspondence and
consistent objective/gradient/Hessian assembly. Adding a force after the
production solve would not be an acceptable implementation.

## Run

Use a new output directory; the probe refuses to replace an existing run.
Its parent must exist. No GPU or window is used.

```powershell
$env:RAYON_NUM_THREADS = '2'
cargo test --locked --no-default-features -j 2 --example elastic_seam_probe -- --test-threads=2
cargo run --locked --no-default-features -j 2 --example elastic_seam_probe -- --output output/elastic-seam-run
cargo run --locked --no-default-features -j 2 --example elastic_seam_probe -- --iterations 32 --replay output/elastic-seam-run --output output/elastic-seam-replay
```

The public two-panel fixture has 48 vertices, nonmatching boundary meshes and
15% length mismatch by default. The probe writes the material template, initial
state, per-step energy/control trace and summary. It performs 120 settling
steps, 60 pull steps, 30 hold steps and at least 90 release steps. The default
360-step run has 150 release steps. Time step is 1/60 s. The imposed displacement
is 4 cm with a smooth ramp; grab stiffness is 100 N/m.

Replay requires identical serialized template and initial state, matching step
count and phases, and finite targets. It reuses the recorded world-space targets
rather than anchoring a new grab on an already diverging trajectory. Traces also
report RMS velocity in m/s, including pinned vertices in the denominator.

The production seam gradient is checked against central differences before
simulation. Existing `tests/garment.rs` separately covers Hessians, force/torque
balance, rigid motion and quadrature on nonmatching meshes. Solver-call wall
time excludes independent energy/contact audits and output writing. End-state
intersection validation is an additional gate, not a general proof for all
inputs. Positive autonomous energy deltas are reported rather than suppressed.

The trace also contains a backward-Euler balance with the diagnostic
pre-step contact set held fixed at both endpoints. It reports residual RMS per
free degree of freedom, residual work, damping and implicit losses, nonlinear
remainder and algebraic balance error. Contact refresh at the end and any
repeated pre-step refresh are recorded at the same positions; grab activation,
movement and release are recorded separately as control energy changes.
`reconciliation_error_j` checks that these terms reproduce the difference
between consecutive fresh energy samples. The detector is a separate clone and
never changes the solver's caches. Its measured time is reported separately
from the complete `solver.step` call.

The frozen diagnostic contacts can differ from the solver's changing internal
contacts. Residuals also include movement-bound reactions, not only incomplete
iteration; they are not an equilibrium or collision certificate. A small balance
error verifies bookkeeping, not physical accuracy. Contact-model refresh must
not be conflated with solver work or with control input.

## Initial observation

On the initial implementation, the 360-step CPU run completed with final
intersection validation passed. Maximum seam-gradient error was 6.77e-10 N.
Release energy fell from 0.1639390577 J to 0.1638280701 J, with 40 positive
within-release deltas (largest 6.85e-7 J). Mean high-pass displacement over the
last 60 steps was 11.66 micrometres. This is not an immobility certificate:
high-pass displacement does not measure force balance or slow drift.

The earlier matched-control 16/32-iteration experiment on issue #147 reduced
the number of autonomous energy rises, but did not reduce final high-pass
motion. Increasing iterations is therefore not accepted as a jitter fix.

The new probe's strict 32-iteration replay gave 23 positive release deltas
(maximum 3.30e-7 J), compared with 40 (6.85e-7 J) at 16 iterations. Tail mean
high-pass motion increased from 11.66 to 15.13 micrometres. Both final intersection
checks passed. A separate equal-length fixture gave 41 positive release deltas,
maximum 4.01e-6 J and tail mean high-pass motion 15.00 micrometres. Its geometry
and grab anchor differ, so this is a diagnostic control, not a matched causal
comparison. Unequal lengths are not necessary for small energy rises in this
experiment. No general conclusion about the private dress follows.

Replaying the unequal-length trace on the equal-length fixture was rejected
with `Replay template.json differs from current fixture`, as intended.

## Matched residual audit, 27 October 2026

On Windows, CPU only, two Rayon workers, dev profile, the public 48-vertex,
15%-mismatch fixture was run for 300 steps at 1/60 s. The 32-iteration run
replayed exactly the 16-iteration run's 300 grab targets; serialized template
and initial state matched byte-for-byte. The 60-step tail falls entirely within
release. These are small diagnostic runs, not a garment or GPU benchmark.

| Iterations | Tail frozen-contact residual RMS, mean | Tail high-pass motion, mean | Mean solver step | Mean separate audit |
|---|---:|---:|---:|---:|
| 16 | 62.05 µN | 26.80 µm | 6.57 ms | 0.69 ms |
| 32 | 36.77 µN | 33.94 µm | 13.15 ms | 0.73 ms |

Final intersection validation passed in both runs. Maximum algebraic balance
errors were 7.12e-17 J and 5.17e-17 J; maximum reconciliation errors were
1.11e-16 J and 4.82e-17 J. Contact-refresh differences were zero in this fixture,
so it does not test a changing contact model. At release the control term removed
about 2.90e-6 J of grab-spring energy in each run. An independent trace check
verified 300 finite residual rows, matching controls and the grab transition.

More iterations reduced this particular residual but increased the measured
tail high-pass motion and roughly doubled solver time. These observations do not
establish a jitter fix, and do not imply comparable behavior on the private dress.

An additional CPU regression starts with a small patch near a floor and a
nonzero grab spring. It deliberately removes diagnostic contact terms to create
nonzero model changes before and after one actual VBD step, then checks those
changes separately from the grab energy and step energy. This manufactured
feature-set change tests the accounting, not whether OGC actually changes its
contact set that way. A naturally changing contact feature and its physical
effect remain unverified by this case.

## Remaining work

- Separately compare equal-length and unequal-length fixtures without conflating
  their geometry. Strict replay intentionally rejects a changed template.
- Report velocity, force residuals and windowed motion, not only endpoint motion.
- Find and validate a naturally changing contact-feature case; the manufactured
  accounting regression alone does not establish contact continuity.
- Validate any proposed elastic dynamics against its own consistent energy,
  including slack/taut transitions, objectivity and pull/hold/release.
- No calibrated elastic seam, nonlinear thread data, native UI, GPU implementation
  or production behavior change is delivered by this probe.
