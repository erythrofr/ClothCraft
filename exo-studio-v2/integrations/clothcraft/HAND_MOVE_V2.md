# V2 Hand / Move behavior (2026-10-16)

- Hand uses upstream `atelier.rs::pick_and_drag`: nearest visible cloth triangle, barycentric three-vertex attachment, ray-normal drag plane and 150 N/m `vbd::Grab`. Pointer motion updates a latest-target mailbox; the worker samples it each fixed 1/60 s step. Physics and rendered geometry keep updating WHILE the mouse is held. Release/cancel removes the attachment and simulation continues. No brush teleport, no local deformation preview, no rewritten rest geometry. This supersedes the earlier paused 16 cm brush approximation. The native VBD/GPU VBD implementations, fabric law and OGC contact are unchanged.
- Select and Move pause automatic stepping on entry. Move translates a whole draped panel rigidly through `pose-panel`, preserving other panel positions, rest UVs and sewing. Its translation gizmo and rotation rings are separate from Hand, which hides the gizmo. Switch to Hand or press SIM to resimulate the placed panel.
- Click empty viewport space to clear selected panel and its gizmo.
- Reset Panels is in the top toolbar and at the bottom-right tool rail. It stops physics and restores initial arrangements without deleting authored patterns, seams or fabrics.
- Pause/save holds the service busy guard. Read-only snapshots during that operation use cached state instead of colliding with a native RPC.
- Mode tokens guard stale poll/release requests; pointer cancellation, lost capture and focus loss release Hand. Cancelled direct Move does not commit a pose.
- Avatar: matte nonmetallic grey (#555b64).

## Validation

`check-v2-pull-physics.mjs`: real native brush, untouched remote vertices/panels, finite VBD steps after grab/release.
`check-workspace.mjs`: native editing, invalid edit rollback, save/reload, play/pause and closing pending RPC.
`qa-v2-hand-mode.mjs`: real toolbar, actual mouse brush, automatic time/geometry advance after release, Select pause, cancelled grab, repeated toolbar selection, rapid mode transitions, reset while running.
`qa-v2-move-mode.mjs`: actual mouse rigid translation, ring rotation, untouched other panels/rest UVs, native stepping after clear off-body placement, Hand hides gizmo, Move pauses, click-off removes orb, grey avatar.

Tests use isolated saved-project copies and native services. A moved panel that intersects the avatar/another panel cannot initialize OGC: the UI explains how to reposition/reset instead of presenting a frozen simulation as success. Moving sewn pieces far away creates large temporary seam strain. Successful stepping is not evidence of converged fit or calibrated fabric behavior.

## Elastic recovery regression

`EXO_CLOTHCRAFT_GPU=1 node integrations/clothcraft/check-v2-elastic-recovery.mjs` uses an isolated settled T-shirt with the source-referenced cotton-blend jersey preset. After an 80 mm outward pull with a 160 mm brush, four simulated seconds reduced local edge-strain P95 from 45.05% to 4.55% (pre-pull 4.85%); the grabbed vertex returned within 0.91 mm of its prior position. The check requires return within 10 mm, strain within 2 percentage points of baseline, finite positions and unchanged rest UVs. This verifies recovery for this fixture/load, not universal calibration or wall-clock realtime. No snap-back projection or rest-mesh overwrite.

## Upstream live-grab port

Source: `research/oss/clothcraft/src/atelier.rs::pick_and_drag`, `atelier/worker.rs`, `vbd.rs::Grab` (upstream MIT notice retained). EXO adapts input and mailbox transport, and directly uses the original native solver/Grab type. `qa-v2-live-grab.mjs` tests actual pointer hold, three-vertex weights, repeated targets, render/time advancement before release, no legacy brush calls, release/cancel, Select and reset. `check-v2-live-grab.mjs` tests the same 8 cm target with jersey, denim and stretch knit: held displacements 61.36 / 27.76 / 66.86 mm; residual offsets after four release seconds 0.72 / 2.15 / 0.68 mm. Material values remain reference estimates, but the selected material actually participates in the live response.

## Subsequent regression fixes: native spring lifecycle, SIM, and error recovery

- A former worker-cleanup request omitted the required Rust document revision. It failed silently on Pause and could leave a real spring attached to the paused cloth. The bridge now sends the current revision with `{op:'grab',grab:null}`, validates the response, and releases the spring before persisting the stopped state. `check-v2-grab-pause-resume.mjs` covers three independent GPU grab/pause/play cycles.
- A failed VBD/OGC step must not make the saved garment unrecoverable: Rust rolls back partially modified particles to their last valid snapshot and discards solver caches on failed steps. The bridge never overwrites the last valid saved drape on a failed simulation and does not autosave an OGC error during Pause.
- Failed snapshot responses still contain an authoritative revision and garment state. The React workspace now accepts that state even when an OGC error is reported; Reset Panels can use the current revision instead of being blocked by the stale-snapshot failure. `check-v2-error-recovery.mjs` reproduced a saved V2 OGC self-intersection, verified the user project copy wasn't overwritten by the failed step, and verified the reset preserved the authored garment and resumed physics.
- Pressing the original top **SIM** after Select/Move/Rotate starts native garment dynamics and switches to **Fabric Hand** automatically. The mode effect reuses the same simulation loop; it doesn't start a competing one. `qa-v2-move-mode.mjs` checks off-body rigid translation, SIM → Hand, reassembly steps, and gizmo hiding.
- A separate GPU test on the saved V2 garment moved one panel 450 mm outside its original assembly, then simulated 240 native frames. Its centre returned roughly 234 mm toward the sewn position over four simulation seconds without an invalid contact. This is physical seam-guided reassembly, **not** an instant geometric reset or guaranteed completion in a fixed wall-clock period.
