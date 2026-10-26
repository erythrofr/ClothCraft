# Pin and freeze implementation contract

Status: design and scope for EXO-AV-003, issue #116. The native pin/freeze
tool described here is not implemented yet. Do not advertise these controls
until their production paths and acceptance tests exist.

## Current behavior

`Panel.pin_points` identifies rest-mesh vertices by material coordinates.
Compilation binds them to the panel's initial placement. Legacy rectangular
corner pins behave similarly. `Edit::state_after` currently resets a panel
when its compiled pins change. Exposing that behavior as “pin here” would
return draped cloth to its arrangement, including on release.

The inspected EXO protocol at `352c6086b622` serializes pins and a locked flag;
it does not establish a physical freeze algorithm. This design is independent
of that implementation. No upstream source is copied.

## Intended behavior

- **Pin here:** bind a selected material point to its current world position,
  measured in metres. Preserve its material rest geometry and other free
  vertices. Persistent identity uses panel ID and material UV, not mesh indices.
- **Freeze panel:** hold the current sampled shape with zero held velocity,
  while retaining the panel in cloth/avatar contact detection. Freeze is not
  selection locking, hiding, global pause or removal from the physical mesh.
- **Release:** remove the selected authored holds at the current shape/time.
  Retain existing free velocities; released held vertices start at zero
  velocity. Do not restore momentum captured before freezing.

Existing legacy pins keep their semantics. New controls must distinguish
them from authored world targets and report conflicts explicitly. Do not
silently override a legacy pin with a different target.

## Persistence and topology

Use an optional template-level collection for new target/freeze records so
ordinary template history and the physical fitting-cache fingerprint include
them. Default absence must serialize exactly as before: historical documents
and their unchanged mesh signatures must continue loading. Validate bounded
counts, finite metre coordinates, panel references, duplicates and conflicts.
Update both template constructors and preserve legacy template v1/v2 behavior.

The first implementation must explicitly reject unsupported remeshing or rest
geometry edits while a panel is frozen. A stored material/topology fingerprint
can enforce this policy. Tell the user to release before editing; never silently
drop a hold or map it to an arbitrary nearest vertex. An individual material
pin must resolve unambiguously after a supported remesh or reject the edit
atomically. Interpolated remeshing of frozen surfaces is a future extension,
not an inferred feature of storing material coordinates.

## Transactions and collision safety

Prepare, compile and validate a candidate before recording history or changing
the live scene. Reuse the production installer and generation filter. A hold
change rebuilds dependent worker/contact caches even if x and time are retained.
The existing pin-array comparison in `state_after` needs deliberate treatment:
do not remove it globally and thereby preserve states incompatible with pins.

Pin-at-current-position must be continuous. Undo/redo of older target records
may request a different position: validate the candidate using the existing
initialization rules and reject an invalid edit without consuming history.
Do not present endpoint initialization validation as continuous collision
coverage during an authoring edit. No additional solver position projection,
contact exclusions or damping are part of this task.

## Acceptance

Use synthetic CPU fixtures, not private garments. Test a displaced panel,
pin/hold/release under gravity, a separately moving free panel, finite state,
zero held velocity and unchanged rest geometry/material/mass. Exercise legacy
pin conflicts, invalid targets, rollback, undo/redo, save/reopen, old signatures,
supported pin remesh and explicit frozen-remesh refusal. Call the production
generation filter and install/cancel paths to prove stale results cannot undo
the edit. Add named-widget tests for the actual controls.

CPU evidence does not replace a native-window check. GPU use remains opt-in.
Keep solver, energy, contact kernels and worker algorithms unchanged.
