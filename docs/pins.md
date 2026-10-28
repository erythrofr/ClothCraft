# Pin and freeze implementation contract

Status: native holds merged in #119; grouped selection follow-up for
EXO-AV-003, issue #116.
Native inspector integration is implemented; a real-window acceptance run is
still pending. Do not mark the task
complete based on the CPU prerequisites alone.

## Inspector controls

Pause simulation, select a panel and open its Piece inspector. **Freeze panel**
holds its current shape; **Unfreeze panel** releases the freeze while retaining
individual pins. On polygon panels, selected contour points across panels
can be pinned/unpinned in one atomic history action. **Release panel pins**
removes all authored individual pins on that panel. These controls leave legacy template pins unchanged.
Expand **Individual authored pins** to see their material coordinates and
release one pin without removing the others. The list is virtualized for large
selections; its Release buttons require a paused, unfrozen panel and use the
same validated, undoable hold transaction as the other pin controls.
**Freeze selected panels** and **Unfreeze selected panels** appear when more
than one panel is selected. They freeze only panels not already frozen, leaving
existing frozen targets unchanged; unfreeze removes freezes for selected panels
while retaining individual and legacy pins. Each group action is one history
transaction, validates the source once and compiles one candidate.
**Release selected panel pins** releases authored individual pins from all
selected panels in one history action, while leaving other panels and legacy
pins alone. The group control is disabled if any selected panel is frozen; it
does not silently release only part of the selection. A frozen
selected panel or any stale contour point rejects the entire pin/unpin request.
The grouped transaction validates the source once and compiles the candidate
once, regardless of the number of selected panels.

Controls are disabled while simulation/worker work or placement previews are
active. Applying a hold and restoring holds through Undo/Redo runs the existing
CPU VBD initialization check before consuming history or installing the edit.
This is an explicit-action cost, never a per-repaint check. Initialization checks
the candidate endpoint; it does not certify a continuous path for Undo moves.

The `codex/pin-acceptance` implementation branch contains CPU prerequisites:
current-state target capture and `garment::pins::resolve_targets`. The latter
validates finite material/world coordinates, bounded target counts, exact
unambiguous panel/UV identity, duplicate requests and existing pin conflicts
without mutating the compiled mesh. Its record can round-trip through serde,
and `GarmentTemplate.pin_targets` now carries these optional version-2 records.
Empty records are omitted, preserving legacy serialized fields. Compilation
resolves targets and initializes held vertices at their world targets, while
retaining the original arrangement and legacy constraints separately.
`prepare_pin_edit` prepares a pin/release candidate without committing history;
its caller must still run the physical initialization gate. `restore_checked`
allows that gate to reject an undo/redo before consuming history. The native
inspector and held-document undo/redo paths now use this validation.

Copy/paste of authored holds, mirroring or arranging held panels, and replacing
a held garment remain unsupported. Clipboard capture retains holds belonging to
selected panels so that paste rejects them explicitly rather than dropping
constraints. It excludes holds on unselected panels, so a free selection can be
copied even when another panel is pinned or frozen. Clipboard data referring to
holds on missing panels is rejected. This does not implement target remapping.
Deleting a panel removes only that panel's targets.
An individual pin survives a remesh only when its exact material vertex remains.
`frozen_panels` stores complete sampled target sets and a versioned FNV-1a
material-topology fingerprint. Compilation rejects missing/duplicate points,
conflicting holds and changed topology; the fingerprint detects changes and is
not a cryptographic authenticity check. `prepare_freeze_edit` captures the
current shape or removes the freeze without removing independent pins. These
transactions remain uncommitted candidates until the native initialization gate
accepts them. Empty freeze records are omitted from legacy serialization.

## Current behavior

`Panel.pin_points` identifies rest-mesh vertices by material coordinates.
Compilation binds them to the panel's initial placement. Legacy rectangular
corner pins behave similarly. `Edit::state_after` still resets a panel when
legacy pins, rest topology or arrangement change. Authored target changes
instead preserve the compatible drape, set held targets/velocities and release
from zero held velocity. Rest coordinates never come from the drape.

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

The branch passes 113 desktop CPU tests (one optional preview ignored), eleven
pin/freeze CPU fixtures and strict desktop Clippy. Fixtures include full fitting
project save/reopen with cached x/v/time, hold-sensitive cache invalidation,
empty-field serialization compatibility, physical freeze/release, named
controls and avatar-initialization rejection. The widget fixture exercises the
production controls and preparation gate; it does not instantiate a native
window. The production installer/generation fixture also covers freeze, rejected
avatar initialization during Undo, successful release and stale worker results.

CI caught a compatibility regression in the first PR revision: state restoration
reapplied unchanged legacy pins during copying. Explicit compiled authored-hold
membership now limits restoration to the new constraints, including authored
targets which coincide with legacy pins. The existing clipboard test remains
unchanged and is part of the regression gate.

Grouped-selection follow-up: 117 desktop CPU tests passed (one optional preview
ignored), including the named Pin/Unpin controls over two polygon panels and
rejection of stale contour indices. All 13 pin/freeze fixtures passed, including
one-step undo of a grouped hold, unchanged drape/time/free velocities, and
atomic rejection when one selected panel is invalid or frozen. Strict Clippy
passed for the desktop binary and pin fixtures. No native window or GPU was
used for these checks.
