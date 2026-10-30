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

To study timestep sensitivity, `--hz` accepts 40, 60 or 120. Supply at least
five seconds of steps, for example `--hz 40 --steps 240`, `--hz 60 --steps
360`, or `--hz 120 --steps 720` for six seconds. Each run settles for two
seconds, pulls for one and holds for half a second; the last second is the
reported tail. The default remains 360 steps at 60 Hz. Replay is step-indexed
and rejects different timestep metadata; legacy replays without a summary are
accepted only at 60 Hz. The grab anchor is taken from each run's own trajectory,
so independently generated runs do not have identical world-space targets.
High-pass motion and positive-delta counts depend on sampling rate and are not
directly comparable across rates. Report physical time and full step cost,
not just frames per second; these small fixtures do not establish garment
accuracy or collision safety along every step.

For matched pull targets across rates, record a six-second 120 Hz run, then
replay it at 60 or 40 Hz using `--resample-replay`, `--replay <run>` and
respectively `--steps 360` or `--steps 240`. Each lower-frequency step uses the
recorded target at the same end-of-step physical time; no interpolation or
extrapolation is used. The source must have exactly the matching duration,
valid timing metadata and an integer rate ratio; 60→40 and upsampling are
refused. This option cannot be combined with the equal-seam control, whose
comparison contract requires identical settings. The same controls do not
make the trajectories or contact sets identical, and this is not a solver
accuracy guarantee.

Add `--audit-every-step` to check the initial and each accepted state for
intersections with an independent OGC world. The summary records the number of
samples and total audit time separately from solver step timings; the run stops
with a labeled error on the first rejected state. This samples states only: it
does not test continuous motion between them, and the existing local sewing
exclusions still apply. It does not modify the solver's contact caches. Without
the option, the original end-state-only check and its cost are unchanged.

On one six-second public two-panel pull/hold/release run at each rate, the
40/60 Hz runs used aligned targets from the 120 Hz trace. The sampled checks
passed for 241, 361 and 721 states respectively and took 44.61, 68.36 and
134.61 ms in total on this CPU, outside the solver-step timer. For each run,
the energy, motion, target, seam gap and contact/control diagnostic fields in
every trace row matched its unaudited counterpart exactly; timings were not
compared. These observations are not proof of continuous separation, do not
cover excluded sewing pairs, and are not a dress or GPU benchmark.

One Windows CPU run per rate on the public 48-vertex fixture, with 16
iterations and six seconds of simulated time, gave mean solver-step costs of
7.69 ms at 40 Hz, 8.07 ms at 60 Hz and 7.99 ms at 120 Hz. The independent
end-state intersection check passed in each run. Separate diagnostic work and
output are excluded from those step timings; the runs are not a GPU or dress
benchmark. The 60 Hz controls also replayed with 32 iterations, while a 60 Hz
trace was rejected for a 120 Hz replay before creating output. These samples
do not establish convergence: pull anchors and samples differ between rates.

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

For an autonomous settling experiment, `--idle-only` disables the grab for
all steps, while retaining gravity and pinned vertices. A replay must use the
same mode; a rejected cross-mode replay does not create an output directory.
For example, use two new directories:

```powershell
cargo run --locked --no-default-features -j 2 --example elastic_seam_probe -- --steps 300 --iterations 16 --idle-only --output output/seam-idle
cargo run --locked --no-default-features -j 2 --example elastic_seam_probe -- --steps 300 --iterations 16 --idle-only --replay output/seam-idle --equal-seam-control --output output/seam-idle-equal
```

The summary records `idle_only`, `observation_phase`, start and end energy,
positive energy deltas, and corresponding counts and maximum rise over the
last 60 steps. The legacy release fields remain available for pull runs and are
null for idle runs. Older replay metadata without `idle_only` denotes pull mode.
The equal-length control uses a partial boundary: its seam coverage and pairing
also differ, so it does not isolate length mismatch as the sole cause.

One 300-step CPU run at 16 iterations had mean last-60-step high-pass
displacements of 14.17 micrometres for the unequal seam and 23.22 micrometres
for the equal partial seam. Energy decreased overall in both; respectively 28
and 20 of the last 60 samples rose, with maximum increases of 4.08e-10 J and
4.76e-10 J. These are observations of this small synthetic fixture, not evidence
about a user garment, long-term stability, or an intersection-free trajectory.
The independent contact audit and end-state-only intersection check have the
limits explained below.

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
contact set that way.

An additional CPU test moves a single 12 cm square patch, initially 2.8 mm
above a narrow triangular floor, with a 5 cm horizontal grab for 20 steps and
then releases it for 10 steps (1/60 s). Independent detection before and
after each VBD step recorded 12 changes in the contact identity set on the
tested machine; the maximum absolute difference between the refreshed and
frozen diagnostic contact energies was 0.01142 J. The algebraic reconciliation
closed within 1e-10 J, and the endpoint intersection check passed at each step.
The refreshed and frozen sets are diagnostic models, not a record of the
solver's internal iterations; this does not establish physical energy creation,
continuous collision safety, a seam effect, garment behavior or a jitter fix.
The case has one panel and no seam. Its purpose is to make a real detector-set
transition reproducible; it is not a matched garment or performance benchmark.

## Remaining work

- Study additional matched fixtures: the partial-edge control changes seam coverage
  and correspondence as well as the length ratio.
- Report velocity, force residuals and windowed motion, not only endpoint motion.
- Investigate contact-feature transitions in a sewn garment and compare force
  and energy continuity; the one-panel diagnostic case does not establish it.
- Validate any proposed elastic dynamics against its own consistent energy,
  including slack/taut transitions, objectivity and pull/hold/release.
- No calibrated elastic seam, nonlinear thread data, native UI, GPU implementation
  or production behavior change is delivered by this probe.

## Matched partial-edge control, 28 October 2026

This CPU-only probe compares the same initial 48-vertex panels, material,
state, settings and 300 recorded pull/hold/release controls. The baseline sews
the full 0.30 m edge to the full 0.345 m edge; the control sews it to a
0.30 m portion of the latter edge. The control also changes coverage and
correspondence, so it cannot isolate the effect of length ratio alone. The
control refuses a mismatched baseline template, state, settings or step count.

```powershell
cargo run --locked --no-default-features -j 2 --example elastic_seam_probe -- --output output/seam-baseline --steps 300 --iterations 16
cargo run --locked --no-default-features -j 2 --example elastic_seam_probe -- --output output/seam-control --steps 300 --iterations 16 --replay output/seam-baseline --equal-seam-control
```

On the tested Windows machine with two Rayon workers, tail high-pass motion
was 26.80 µm for the baseline and 119.77 µm for the control; mean frozen-contact
residual was 62.05 µN and 247.46 µN respectively. Mean step times were 6.21
and 6.15 ms (single runs, without diagnostic time). Both passed the final
intersection check; this is not continuous collision certification. Contact
refresh energy was zero in both runs. More motion in the equal-length control
does not establish a cause or a fix, and these tiny fixtures are not the dress.
