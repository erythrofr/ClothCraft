# Native XPBD + IPC Thomas: collision-constrained step prototype

Date: October 13, 2026. Scope: actual execution on the Blender Mac. This is an isolated numerical prototype, **not enabled in the live garment simulation**.

## Implemented

- `blender_bridge/native_ipc_step.py` uses the existing native C++ XPBD binary to predict one cloth simulation frame at a time and native compiled **IPC Toolkit 1.6.0 Tight Inclusion CCD** against the *real evaluated Thomas body* (10,000 vertices / 17,999 triangular faces). The staged four-piece shirt has 500 vertices / 768 cloth triangles.
- Garment Studio XYZ ↔ Blender XYZ conversions are explicit: `(x,y,z)` → `(x,-z,y)` and back.
- Every prediction is validated against swept real-body collision. Unsafe motions are backtracked below IPC's computed maximum safe linear step fraction; previous positions are synchronized for truncated motions to avoid injecting fictitious Verlet velocity.
- The prototype refuses a starting pose that already intersects the body. It verifies the accepted pose is free of sampled triangle-body crossings after every update. No proprietary Thomas mesh bytes are copied into the application payload or report.
- Automated regression command: `npm run check:native-ipc-prototype`. It stages the same Foundation Tee pattern in a collision-free four-panel arrangement, runs four frames, verifies collision checks, and records the remaining seam gap.

## Results

| Frame | Maximum safe step | Applied after 5% margin | Prediction collision-free? |
|---|---:|---:|---|
| 1 | 0.104342 | 0.099125 | no |
| 2 | 0.006303 | 0.005988 | no |
| 3 | 0.000889 | 0.000844 | no |
| 4 | 0.000225 | 0.000214 | no |

- All four **accepted, truncated** movements avoid detectable cloth-to-Thomas triangle crossings, but that is *not* sufficient to sew and fit the garment.
- Average stitch-pair gap starts at **42.44 cm** and remains **37.90 cm** after four frames. At frame four only **0.021%** of the native predicted motion could be applied. The approach stalls because a global fractional step shrinks every vertex movement when just a few cloth/body triangles collide.
- Existing native garment test `node scripts/check-native-garment.mjs` currently fails the tee structural-strain regression (peak `14.419` vs 2.2 gate) on the existing native solver. The prototype did not cause this regression: it never modifies the native C++ solver or production settings.

## Why this does not go live yet

The current XPBD solver independently closes seams and projects analytic body collisions. Merely restricting the *global* movement fraction against Thomas's mesh makes cloth/body tunneling safer while preventing sewing convergence. The next approach needs **localized, coupled contact response**: preserve noncolliding particle motions, construct and solve contact gradients/barrier energies for involved vertex-face and edge-edge pairs, update stitch constraints in the same iterative solve, and add cloth/self continuous collision checks. This cannot be replaced by more iterations or manual pattern scaling.

## Commands and evidence

- `npm run check:native-ipc-prototype` — PASS: four accepted steps contact-safe, reports known seam limitation.
- `npm run check:ipc-thomas` — existing ten-frame PPF audit remains a required guard.
- `npm run check:ppf-acceptance` — existing fit-rejection guard.
- Web physics/build/UI regression checks also run independently.

The original native solver, viewport, fabric presets, project patterns, backend selection and user assets were not changed by this prototype. Explicitly **do not advertise accepted clothing fit or 60-FPS collision-safe draping** on these results alone.
