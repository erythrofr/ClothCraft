# Native command registry

`src/atelier/commands.rs` describes twelve implemented workspace commands.
`Atelier::dispatch_command` in `src/atelier.rs` is their checked runtime adapter.
The registry is a foundation for additional UI adapters, not a command palette,
remote API or universal inventory of every authoring tool.

Each descriptor contains a typed ID, stable key, label, context, actual wired
shortcut, undo policy and backend requirement. Do not add planned tools or
invent shortcuts just to make the list look complete.

| Commands | Behavior and limits |
|---|---|
| `simulation.toggle`, `simulation.step` | Send requests to the existing worker. Space toggles simulation. Step requires a paused, non-pending context. Successful submission does not mean the physical step finished successfully. |
| `simulation.reset` | Rebuild the flat arrangement. Not undoable through authoring history. |
| `file.export` | Write session artifacts through the existing exporter. Filesystem failures propagate. The artifact set is not an atomic transaction; a later failure can leave earlier files written. Undo does not restore disk files. |
| `workspace.view_split`, `workspace.view_garment`, `workspace.view_patterns` | Change the workspace view preference. |
| `workspace.inspector`, `workspace.reset_layout` | Toggle the inspector or restore default workspace layout preferences. |
| `workspace.preferences` | Open settings; this is not an authoring-history edit. |
| `example.tshirt`, `example.dress` | Load the existing presets. History restores the prior template, not prior simulated positions, velocities, caches or exported files. |

## Adding a UI caller

Read availability from the current `CapabilityContext` and show the returned
reason for disabled commands. Recheck through `dispatch_command` when invoking;
do not duplicate simulation, export or preset logic in a palette or toolbar.
Workspace and example commands remain usable without an existing garment.
Simulation and file operations require a document.

The desktop context optimistically assumes a worker and filesystem are
available. Actual channel sends and file writes can still fail after the
snapshot. These errors are surfaced by dispatch; asynchronous worker results
remain responsible for completion and solver errors. A future automation
adapter must preserve that distinction and must not turn a queued request
into a false completion report.

## Evidence and next tasks

PR #97 integrated Mikristian's contribution from #29, preserving its original
authorship, then corrected availability, undo metadata and runtime errors.
All seven hosted checks passed at
`a8c601fbed27662e932e4c1b3d3b3328f9af8d3c` before merge
`c558dc64300c85e8cd244379476ae6479a20c5dd`.

Five CPU tests in `tests/command_registry.rs` cover descriptors and availability.
Desktop CPU tests exercise the real worker-channel and export helpers,
including disconnect, early/late write failures and unchanged project state.
They do not instantiate every dispatch action in a native GPU window; no such
visual acceptance is claimed.

EXO-UX-002 (searchable palette), EXO-UX-003 (workspace profiles) and EXO-UX-006
(headless session adapter) can now be scoped against this implementation.
Read their catalog entries and open contributions, then obtain a claim before
editing. In particular, inspect the existing session proposal before creating
a competing protocol. Eligibility is not ownership.
