# Existing solver adapter contract

This contract covers `solver_lab::Backend`, an in-process CPU laboratory API.
It is not a plugin ABI, editor selector or EXO transport. Original documentation
and metadata are derived from the Rust implementation. No upstream solver code
is imported. See [the laboratory](solver-lab.md) and
[comparison requirements](solver-challenge.md) for experimental limitations.

## Capabilities describe implementations, not quality certification

`Algorithm::capabilities()` and `Backend::capabilities()` identify the actual
adapter and its restrictions. All five adapters execute on the CPU in f64.
The production hybrid GPU path is a separate API and is not advertised here.
Box3D is an external harness with a different discretization, not a variant
of this registry. Historical Newton is also outside this API.

| ID | Role | Finite material stiffness during a step |
|---|---|---|
| `vbd` | Production CPU implementation used as a lab control | Target stiffness |
| `xpbd` | Experimental sequential XPBD/OGC hybrid | Target stiffness |
| `xpbd-primal` | Experimental coupled primal solve | Target stiffness |
| `avbd-finite` | Experimental finite-stiffness AVBD adaptation | Adaptive ramp; may remain below target |
| `avbd-target` | Experimental ramp with coupled polishing | Target completion schedule; no convergence certificate |

The target model is the existing orthotropic membrane, normal-difference
bending and weighted finite-stiffness sewing energy. Alternative adapters
factor that energy into scalar constraints. Matching the target energy does
not imply matching finite-iteration trajectories or effective stiffness.
Construction currently restricts factors to 1–4 vertices, including the VBD
control because this laboratory constructor compiles the shared factors.
Do not infer support for arbitrary multi-body constraints from weighted seams.

All adapters use the existing OGC surface contact and conservative movement
regions. Bounds depend on an initially separated arrangement and the documented
local sewing exclusions; they are not a repair algorithm for intersecting
inputs. The supplied avatar is static. Cloth self-contact, avatar contact,
fixed pins and the barycentric/patch Grab are supported within those existing
contracts. Coulomb friction, animated avatar updates and hard augmented joints
are not implemented by this interface. Do not substitute a sphere lattice or
change the collision mesh to satisfy a requested capability silently.

## Ownership and lifecycle

1. Compile material rest geometry into an `Arc<CompiledGarment>`. Rest positions,
   mass, material orientation and seam quadrature remain owned by that model.
   Never obtain rest coordinates from a draped `State`.
2. Construct `Backend::new` with the selected algorithm, compiled garment,
   optional avatar surface and a compatible state. Initialization validates
   geometry and builds incidence/contact caches; it can fail.
3. Call `step` with a mutable state, validated settings and optional Grab.
   Accepted steps update x/v/time. Invalid input must not partially install
   x/v/time. Diagnostics and internal caches can change on a rejected attempt;
   this is not a rollback guarantee for the whole Backend object.
4. Replace the Backend after remeshing, rest/material/seam changes or avatar
   geometry changes. Public research internals are not a safe cache-invalidation
   interface. Do not mutate `reference.garment` or `reference.world` to implement
   a production switch without a separately reviewed lifecycle.
5. Switching algorithms constructs a new Backend from the same immutable
   compiled model and an explicit x/v/time checkpoint. Predictor history,
   contact caches, multipliers and adaptive stiffness are not portable.
   Even switching back to the same algorithm is a cold restart. Preserve or
   reset velocity deliberately and record that decision in the experiment.

Grab weights represent a convex barycentric attachment: finite, nonnegative
and summing to one within the implementation's tolerance. The lab additionally
requires three distinct vertex IDs. Patch attachments follow `Grab::valid_patch`.
Invalid controls are errors, not extrapolating attachments or clamped guesses.

## Time, failures and diagnostics

On an accepted fixed-dt step, physical time advances by `settings.dt` seconds.
`VbdMetrics.dt_s` is that increment and `time_s` is the resulting state clock.
`step_ms` is host elapsed work, not physical time or rendered frame duration.
Compare simulated seconds per wall second and complete step distributions;
equal sweep counts do not imply equal numerical work.

Errors are currently descriptive Rust strings, not stable transport codes.
Callers must surface the error and keep the last accepted state. Do not advance
a GUI clock on a failed step, silently retry with weaker contact, or replace a
failed method with another solver without an explicit user policy. A repeatable
restart after a failure may require reconstructing the backend and its caches.

Metric sampling is part of the capability description:

- VBD's residual accumulates pre-update gradients from the last color sweep,
  normalized over all vertices. It is not a final-state free-DOF residual.
  Optional coupled refinement can occur after it is sampled.
- The other adapters evaluate a final primal residual with free-DOF
  normalization. This is an unconstrained gradient, not a constrained KKT
  certificate or proof that a cloth garment has reached equilibrium.
- VBD's contact metrics describe its last detection. The other adapters report
  a freshly detected final minimum distance, but their contact/term counts still
  come from the last in-loop detection. Consumers must not present these mixed
  observations as one synchronized final collision audit.

These facts are recorded, not numerically changed, by this contribution.
An independent surface audit and matched pull/hold/release tests remain required
before promoting any experimental backend. No benchmark speed or settling claim
follows from successful construction or a one-step contract test.

## CPU validation

Run the adapter contract tests without graphics or GPU initialization:

```sh
cargo test --locked --no-default-features -j 2 --lib adapter_contract -- --test-threads=2
```

Tests exercise real adapter construction and stepping on an original small
garment, accepted physical time, unchanged state on invalid settings/controls,
cold restarts and descriptive capability distinctions. They are API regression
tests, not the production collision, convergence or performance acceptance suite.
