# Corner tool implementation plan

Status: proposed, awaiting coordination approval. Corner rounding and coupled
corner-handle editing are not implemented by this document or its draft PR.
The owner requested a planning draft before source work starts.

Task: [EXO-CAD-014, issue #233](https://github.com/erythrofr/ClothCraft/issues/233).
The separate [administration PR #239](https://github.com/erythrofr/ClothCraft/pull/239)
proposes the interaction contract and file scope. This plan starts from upstream
main `5a7400f0bea90ca8ab0d289efe204ed18a681ccc`; it does not import the pending
measurement or cutout contributions.

## Intended interaction

The left vertical toolbar gains a **Corner rounding** tool. Activating it uses
the normal tool transition and selects a corner on the 2D board without moving
the anchor or the whole piece. The tool exposes two buttons, **Radius** and
**Shape**, with a visible active state.

In **Radius**, dragging the corner's rounding control changes a circular
fillet's radius, measured in material millimetres. A live outline and numeric
readout show the proposed result. Numeric entry and Apply provide exact radius
input. A pointer release commits one valid drag as one undo entry. A click
that only selects, or a drag that returns to the original value, adds no entry.

In **Shape**, dragging the Bezier handles changes their positions, directions
and lengths to reshape the rounding profile. This is the owner's clarified
interaction: the profile comes from the Bezier controls. It can become flatter
or squarer within the cubic representation. The chosen sharp, smooth or
symmetric rule governs the incident handles:

| Corner rule | Handle behavior |
|---|---|
| Sharp | Incident handles move independently. |
| Smooth | Opposite collinear handles retain independent lengths. |
| Symmetric | Opposite collinear handles have equal lengths. |

Smooth denotes geometric tangent continuity, G1. It does not assert C1 or C2
continuity for the curve parameterization. Missing or zero-length handles need
an explicit, tested conversion policy.

A manually reshaped corner is labelled **Custom Bezier shape** when it no
longer follows the constructed circle. The Radius readout must not claim that
such a custom curve has an exact circular radius. Switching back to Radius
uses the saved construction source and previews the circular replacement.

## Geometry and transaction contract

Construction uses panel-local rest coordinates in metres. Input converts from
millimetres once; pointer positions pass through the inverse board camera and
panel layout transforms. Zoom, pan, board rotation and piece rotation must not
change the physical radius. Draped 3D positions never define the construction.

The CPU constructor resolves a corner through panel and named-boundary
identities. It finds the fillet tangencies and preserves the remaining authored
segments. A circular arc stored as ordinary cubic Beziers is an approximation:
the implementation must document and independently verify its geometric error
in millimetres. That bound is separate from rendering and meshing flattening.
Unsupported curved or degenerate configurations fail with an actionable reason.

Re-editing a radius must start from saved authored construction data rather
than repeatedly trimming the current approximation. The final optional schema
needs review against the current polygon and measurement model. It must load
historical documents with compatible defaults and retain stable boundary IDs.
No document field is introduced by this planning commit.

Each gesture captures the source document identity and geometry revision.
Pointer motion updates a transient geometric preview. Release prepares and
validates the complete CPU edit, including any linked mirrored partner, before
the normal installer records history. An invalid preview cannot install.
No full remesh is required merely to draw each preview frame.

Escape, focus loss, mode/tool changes, stale geometry and failed compilation
cancel the gesture with no document or history mutation. Text fields and
modals retain keyboard ownership. Undo/Redo and document replacement invalidate
stale targets and previews. Existing measurement-draft decisions must remain
effective when entering or leaving this tool.

## References and mirrored pieces

Keep unchanged boundary identities stable. A fillet introduces a deterministic
new boundary and trims portions of its incident boundaries. Supported station
migration must map the retained material intervals explicitly; a station on a
removed interval cannot be silently clamped or reassigned to the new fillet.
Whole, partial and chained seams, saved/staged measurements, target lengths,
allowances, notches and other affected attachments need preservation or atomic
refusal with a useful error. Existing labels and unaffected references remain.

Review and reuse the measurement task's operation-specific mappings after its
handoff. The corner tool must not introduce a competing station representation.
If a required mapping is unsupported, reject the whole operation before any
document, history or live-state installation.

Use the existing linked-mirror reflection once, from either member of a pair.
Both pieces validate and install in one transaction. A partner failure rejects
both changes. Preserve independent panel IDs, layout, placement, fabric and
grain policy. Actual rest edits rebuild dependent caches; compatible unaffected
panels retain their state. A corner-rule metadata edit that leaves controls
unchanged must not invalidate physical state unnecessarily.

Geometry-preserving curve splitting remains in EXO-CAD-011 (#68). Subdivision
of a cubic-rounded segment uses de Casteljau, with independent checks against
the original curve. Flattening/resampling is not authored-curve subdivision.
Interior cuts and synchronized material cutouts remain separate work.

## Proposed integration points

These are proposed boundaries, subject to the reviewed scope and handoff.
The helper files below do not exist yet and must only be added with real
implementations and callers.

| Area | Existing adapter or proposed implementation |
|---|---|
| CPU commands, validation and history | `src/authoring.rs`; proposed `src/authoring/corners.rs` |
| Curves and optional authored corner data | `src/garment/curves.rs`, `src/garment/polygon.rs` |
| Linked propagation and reference policies | `src/authoring/linked.rs`, `src/authoring/geometry.rs` |
| Toolbar and shared transitions | `src/atelier/authoring_ui.rs` |
| Pointer picking, transforms and preview | `src/atelier/board.rs`; proposed `src/atelier/corner_ui.rs` |
| Glyph, hints and minimal module/input wiring | `src/atelier/icons.rs`, `src/atelier/view_controls.rs`, `src/atelier.rs` |
| Physical cache classification | `src/fitting.rs`, only as needed for nonphysical corner metadata |

Constructor defaults, importers and fixtures must be updated coherently if an
optional polygon field is approved. These mechanical changes are listed in the
administration amendment. Solver, contact, worker clock and GPU kernels stay
outside this feature.

## Acceptance evidence to collect after approval

- A 90-degree straight corner with a 10 mm radius has independently verified
  tangencies, trim distances and circle-approximation error. Test invalid,
  nonfinite, oversized and unsupported constructions without mutation.
- Shape drags change actual cubic controls and curvature. Sharp handles remain
  independent; smooth handles remain opposite/collinear with unequal lengths;
  symmetric handles remain opposite/collinear with equal lengths.
- Test both mirror directions, source reconstruction on radius re-edit,
  retained/removed reference intervals, atomic partner failures and legacy JSON.
- Drive the actual toolbar, mode buttons, corner and handle gestures through
  named CPU egui controls and the production installer. Include rotated/zoomed
  layouts, text focus, Escape, lost focus, mode switches and stale targets.
- Verify one-step Undo/Redo and Save/Open, including the next coupled-handle
  edit after reopen. Inspect state/history/generation rather than treating a
  delivered pointer event as proof of success.
- Run relevant geometry/reference tests and the editor CPU suite with at most
  two build jobs and two test/Rayon threads. Native-window/GPU acceptance is
  separate, opt-in work. Record commands and observed limits in the handoff.

## Start condition

The current task is registered but closed and blocked. A maintainer needs to
review the scope amendment, reopen the task, resolve its prerequisite path and
coordinate the overlapping EXO-MFG-015 reservation. Then request the normal
corner assignment and wait for the authoritative board's accepted claim.
An open draft PR, green CI, task registration or approval of this plan alone
does not establish source ownership. This plan does not release another session
or mark a prerequisite complete.
