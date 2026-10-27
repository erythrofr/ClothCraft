# Presentation and lighting

Workspace → Presentation controls a single world-space directional light.
Rotation and tilt are degrees relative to the original rig; Ambient and Key
light are dimensionless gains from 0 to 2. Defaults are zero rotation/tilt and
unit gains. Reset lighting restores those defaults without changing the camera.

Both the legacy/diagnostic color path and authored fabric optics use the rig.
These paths retain their different shading models. This is illustrative
lighting, not a measured textile BRDF or a calibrated exposure control.
The avatar uses the same mesh lighting. The background, grid and floor shadow
retain their existing presentation behavior: the shadow is not a directional
shadow map and rotating the light does not move it. No HDRI loader, multiple
lights or decorative geometry is supplied.

Preferences persist in the session output folder. Save presentation explicitly
writes `presentation.json` there, containing camera and viewport appearance;
Restore validates the entire snapshot before applying it. Neither operation
edits material rest coordinates, garment history or solver settings.

New snapshots use version 2 and `clothcraft-directional-v2`. Version 1 snapshots
with `clothcraft-fixed-v1` remain accepted with default light parameters.
A version 1 identity with nondefault light parameters is rejected. Unsupported
rigs, invalid camera/light/shadow values and oversized snapshots are rejected
without partially changing the live view. Missing light fields in older
preferences use defaults; out-of-range preference values are sanitized.

CPU coverage checks directional rotation, finite bounds, old snapshot loading,
round-trip persistence, rejection without mutation and named reset/save/restore
controls. The shader layout test parses and validates WGSL without a GPU and
checks the 112-byte View uniform with offsets 0, 64, 80 and 96.
The named-control fixture also drags all four sliders through egui pointer
events and verifies that each changes a bounded live lighting value.

On 27 October 2026, three short Windows native smoke runs used the public
40 mm T-shirt, paused at time zero: default lighting, yaw 120 degrees, and
zero ambient/key gains. All exited successfully and their captures were
inspected: rotation changed avatar/cloth shading; zero gains produced black
mesh surfaces while annotations and background remained visible. These runs
loaded isolated preferences; they did not exercise the parent menu. They also
do not validate simulation performance.

Two further Windows captures used the existing `appearance-glossy` native
harness, with both gains set to zero or two. Each report passed all six
expected actions and the captures were inspected. The authored-optics cloth
was black with zero gains and bright with visible saturation at maximum gains.
This confirms endpoint response, not photometric accuracy. These runs exercised
fabric appearance controls, not the Presentation parent menu. Native menu
interaction remains pending.

The first native menu check exposed automatic closure after a slider click.
The submenu now explicitly closes on outside clicks; Save/Restore close it
after their action. A CPU regression fixture opens the nested Workspace menu,
drags rotation, resets it and invokes Save, checking that controls remain
available until the explicit action. The updated full atelier suite passed
134 tests (one optional preview ignored), and strict desktop all-target Clippy
passed. The corrected native menu still needs its follow-up check.
