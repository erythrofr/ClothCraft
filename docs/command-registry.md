# Native command registry

`src/atelier/commands.rs` describes twelve implemented workspace commands.
`Atelier::dispatch_command` in `src/atelier.rs` is their checked runtime adapter.
The native command palette uses this registry. It is not a remote API or a
universal inventory of every authoring tool.

## Find a command

Choose **Commands…** in the top toolbar, or press **Ctrl/Cmd+Shift+P** when
no text field, modal or editing gesture owns the input. Search a label, stable
command key or an alias such as `tee`, `properties` or `3d`. All search words
must match; matching is case-insensitive. Up/Down moves the highlighted result;
Enter or a click requests that command. Escape, Close or losing focus dismisses
the palette. Unavailable commands remain visible with their reason.

The result area keeps a fixed height while filtering so the search field does
not move under the pointer. The existing radial menu remains available outside
the palette. Viewport input is blocked while the palette is open, including
its closing frame. Commands use the same checked dispatch route as buttons;
starting a simulation still queues work rather than certifying completion.

PR #110 merged as `742b4ef` after seven green checks at `d38e3d0`. Five CPU
fixtures exercise the actual launcher/search controls, aliases, navigation,
disabled context at activation, single request and Escape. The complete desktop
CPU suite passed 104 tests (one optional preview ignored). Outer Atelier input
barriers and dispatch wiring were source-reviewed; no native-window test was
run. EXO-UX-002 (#109) retains that interaction acceptance follow-up. Do not
reimplement the palette merely because the task remains open.

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

EXO-UX-002 retains palette interaction acceptance. EXO-UX-003 (workspace
profiles) and EXO-UX-006 (headless session adapter) can be scoped against the registry.
Read their catalog entries and open contributions, then obtain a claim before
editing. In particular, inspect the existing session proposal before creating
a competing protocol. Eligibility is not ownership.
