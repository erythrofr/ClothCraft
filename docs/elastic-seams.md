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

## Remaining work

- Separately compare equal-length and unequal-length fixtures without conflating
  their geometry. Strict replay intentionally rejects a changed template.
- Report velocity, force residuals and windowed motion, not only endpoint motion.
- Validate any proposed elastic dynamics against its own consistent energy,
  including slack/taut transitions, objectivity and pull/hold/release.
- No calibrated elastic seam, nonlinear thread data, native UI, GPU implementation
  or production behavior change is delivered by this probe.
