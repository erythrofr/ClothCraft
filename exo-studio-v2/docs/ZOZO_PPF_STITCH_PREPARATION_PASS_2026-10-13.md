# ZOZO cloth-on-avatar stitch preparation — engineering pass

The user requested a genuinely fitted sewn T-shirt using ST-Tech ZOZO PPF, not simply playback. The installed upstream and local runtime remain intact.

## Root cause and diagnosis

The four 2D pieces arrive as two flat torso panels and two flat sleeve panels, linked by 98 physical stitch pairs. In the untouched PPF export their front/back panels were 0.72 m apart and the sleeve armhole pairs were about 0.58–0.78 m apart, before PPF tried to close these lengths. An already assembled, near-body, sewn dress in the upstream `examples/fitting.ipynb` is a different preparation problem. An initial no-crossings check does not ensure those long seam springs won't cut through the body during a dynamic solve.

## This pass

- Examined actual vertex coordinates and per-seam spring gap lengths, rather than infer fitting from screenshots.
- Evaluated alternative torso depths, sleeve arm offsets, sleeve heights and torso height against the actual Blender mannequin triangle collision surfaces.
- Kept lower user-configured clearance bounds (`--min-torso-depth`, `--min-arm-offset`) enforced for production. Testing tighter values without a complete body-contact preflight produced 60 crossings; therefore reduced clearance is *not* safe to enable as a default.
- Retested the safe base staging: `blender_bridge/output/tee-zozo-safer-staging.ppf.json`, corresponding `.blend`, and `tee-zozo-safer-initial-contact.json` preserve 98 stitch pairs with zero initial cloth/body and cloth/self triangle crossings.
- `npm run check:ppf-staging`, `node scripts/check-ppf-preview.mjs`, `node scripts/check-ppf-fit-acceptance.mjs` and `npm run build` passed. Rebuilt, signed, installed and opened the native Mac app.

## Still blocking a verified ZOZO fit

At the time of this pass, a *separate* Metal job using the same runtime was already active (port 19381, under `blender_bridge/output/ppf-fit-tuning-20261013`). Its final simulation/contact report had not been written. No competing GPU job was launched and no active solver process was terminated. Existing prior PPF attempts show body crossings after sewing despite valid initial geometry; this pass does **not** certify a fully dressed garment. The remaining engineering target is an explicitly preassembled stitched shell that keeps the armhole and shoulder seam gaps small without slicing through the body, then an independent all-frame contact/strain/seam acceptance run.
