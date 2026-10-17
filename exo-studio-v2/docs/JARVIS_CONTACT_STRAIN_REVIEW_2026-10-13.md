# Garment Studio: shoulder contact and strain review

Date: 2026-10-13. Scope: review of the existing Blender-Mac project; no solver, UI, garment, or deployment changes made.

## Conclusion

Use ZOZO's PPF solver as the coupled contact/strain reference and offline fitting backend. The installed integration is real, but it has not achieved verified shoulder settling. More iterations or stronger seam attraction in the preview alone will not establish the required behavior.

Reference: https://github.com/st-tech/ppf-contact-solver

Reviewed the upstream README, installed Blender add-on, current Garment Studio sources, and saved PPF results. Installed runtime is dated 2026-09-22; current upstream documentation is not proof that this installed build has identical behavior. Upstream describes penetration-free successful steps and strict strain bounds, not guaranteed completion of every scene or a real-time replacement.

Project root on Blender Mac: `/Users/mikylecouto/Chat On Steroids Workspace/garment-studio`.

## Findings, in priority order

### 1. High: PPF strain limiting is not enabled explicitly for the current Thomas fixtures

`src/core/backends/ppfPayload.js:20` emits `strainLimitPercent` only when supplied as an override. `blender_bridge/ppf_prepare_scene.py:234` enables the limiter only when that field exists. The installed add-on's `models/groups.py:132` defaults `enable_strain_limit` to false (the numeric 5% value is not itself an enabled constraint).

The exact-contact, optimized-contact, and body-safe Thomas fixtures provide density, friction, and shrink values but no strain limit. Therefore these jobs do not explicitly request the solver capability central to the user's requirement. Read back the actual encoded/resolved parameters before trusting a new run; do not silently rely on an inherited default. This is a source/configuration finding, not a claim that enabling one switch will fix contact.

### 2. High: contact projection can violate the preview's just-solved textile constraints

`src/core/physics.js:1624` implements stiffness-weighted distance projection; it does not enforce a strict finite-element strain bound. At `:2439` the solver relaxes distances, then applies contact and several stabilization passes, finishing with contact again (`:2477`). The committed state is not jointly checked for both contact feasibility and strain bounds.

`collideAvatar` (`:2075` onward) also uses overlapping analytic body parts and region/height-dependent projection choices. This explains a plausible mechanism for the observed conflict: a contact correction can pull nearby cloth vertices far apart, while correcting their distance can move them back toward the body. It is not evidence that the visual Thomas mesh is itself collision-safe.

### 3. High: the newest saved real-Thomas PPF solve still fails the exported-frame contact audit

`blender_bridge/output/tee-thomas-body-safe-solve.json` reports a completed Metal job, 500 vertices, and 10 PC2 samples. Its accompanying `tee-thomas-body-safe-dynamic.json` reports:

- Frames 0–2: no reported cloth/body or cloth/self crossings.
- First reported crossings: frame 3.
- Peak body triangle-pair crossings: 183.
- Peak non-adjacent cloth triangle-pair crossings: 67.
- Final frame: 177 body pairs and 56 self pairs.

This is newer evidence than the overnight nine-proxy experiments: `ppf_prepare_scene.py:95` now supports the evaluated Thomas skin, simplified to approximately 18,000 faces. Initial clearance therefore does not explain away the later failure.

Do not conclude that the upstream solver guarantee is false. First reconcile the installed solver's contact policy, encoded static body, successful-step status, surface/vertex remapping, transforms, and exported PC2 frames with the audit. The existing auditor already treats PC2 as Blender-space; blindly applying another axis conversion would be a regression. Reproduce the frame-2-to-3 failure in a minimal case before changing collision tolerances.

### 4. High: existing passing checks do not enforce the requested physical outcome

Freshly ran `node scripts/check-cloth-surface-contact.mjs`, using its default 90 frames:

| Avatar | Contact assist | Max sampled intrusion | Mean structural deformation | Peak structural deformation |
|---|---|---:|---:|---:|
| 160 cm | Off | 16.637 mm | 7.46% | 137.19% |
| 160 cm | On | 15.989 mm | 7.33% | 127.73% |
| 180 cm | Off | 56.730 mm | 9.72% | 426.10% |
| 180 cm | On | 9.831 mm | 10.24% | 397.71% |
| 200 cm | Off | 12.084 mm | 7.29% | 129.00% |
| 200 cm | On | 14.721 mm | 7.22% | 113.68% |

All six cases reported `collisionFree: false`, yet the script exited successfully because it asserts only finite measurements and nonzero sampling. Its measurements are analytic-proxy surface samples, not exact Thomas-mesh CCD. Strain is the code's absolute structural-edge length deviation, not a calibrated principal material strain. The test also starts from `buildSimulation`; it is not proof of the viewport's complete staged-start path.

`scripts/check-tall-tee-shoulder-contact.mjs` accepts peak deformation below 2.0 for the 200 cm case and only finite values at 180 cm. These are diagnostic/stability checks, not fitting acceptance criteria.

### 5. Medium: improving PPF does not automatically change the interactive Simulate button

`src/core/backends/registry.js:4` registers browser PBD and the native service, not PPF. `src/components/GarmentViewport.jsx:377` defaults to `browser-pbd`. The PPF job/export path is separate. Fixing the Blender integration alone must not be presented as fixing interactive preview physics.

## Recommended implementation sequence

1. Freeze a reproducible four-panel tee/Thomas test fixture, current source revision, staged pose, rest geometry, material properties, and seam correspondence. Preserve current experiments.
2. Make PPF strain limit and material/contact parameters explicit and read back their encoded values. Choose a justified cotton-jersey limit; use a strict low-strain verification fixture separately rather than assuming jersey behaves like denim.
3. Reconcile the first failing PPF frame with solver-native validation and the export audit, including static-body registration, mesh validity, mapping, coordinate space, and contact allowances. Do not hide penetration by shrinking the avatar or widening its collision shell.
4. Solve sewing progressively from a collision-clear pose while retaining the original rest metric. Validate shoulder/armhole seam lengths and correspondence; remove temporary placement support before judging settling.
5. Gate acceptance on all-frame cloth/body and self-contact checks, strain bounds, closed seams, and measured shoulder clearance/settling—not seam closure percentage alone. Include containment/signed-distance checks as well as surface crossings, and assess the full-resolution visual body separately from the decimated collider.
6. Once offline PPF passes, expose its verified result distinctly in the UI. Improve the preview's coupled constraints separately and repeat identical acceptance fixtures; retain honest backend labels.

## Completion criteria

The tee rests on Thomas's shoulders after temporary supports are released; it does not levitate, penetrate, or exceed the declared material strain limits. Seams meet a documented closure tolerance. The result remains stable over a specified settling interval and passes front/back/side visual inspection plus geometric checks. Numerical tolerances must be established with a validated reference, not chosen merely to make the current output pass.

## Review boundary

No code fix or new Metal solve was performed in this review. The fresh browser diagnostic and existing PPF artifacts support the findings above; the precise origin of the PPF export/contact discrepancy remains unresolved. The separate CLO jeans repair is not complete: its saved working checkpoint improved the front fit, while cuffs and blue wash remain pending.
