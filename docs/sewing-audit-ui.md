# Sewing audit in the editor

Open **Properties → Piece → Sewing audit**, then click **Run audit**. No
simulation is required. The audit reads the current document's material rest
boundaries; it does not measure the separation of draped panels.

Expand a seam to see its stable ID, side lengths in millimetres, signed
**B − A** difference, direction, easing policy, boundary owners and errors.
Correspondence intervals show local length differences: equal total lengths
do not necessarily mean equal lengths between notches. Required easing can
be intentional, for example for gathers; it is not a diagnosis of jitter.
Shared material endpoints are counted as construction information, not as
physical contacts. See [the audit contract](sewing-audit.md) for limitations.

**Inspect seam** opens the existing sewing draft. This does not save an edit
or add an undo step. Apply changes through the ordinary sewing controls, or
cancel the draft. Duplicate seam IDs cannot be opened unambiguously and their
inspection button is disabled. The audit never repairs or enables easing
automatically.

## Snapshot behavior

Reports are computed only on **Run audit / Refresh audit**, not each rendered
frame. They live separately from the sewing draft. A changed editor generation
marks the snapshot **Out of date** and disables navigation until refreshed.
This deliberately includes some changes that do not affect material lengths,
such as tool changes and placement previews. Simulation frames alone do not
invalidate it. Loading another document resets the cache.

Refresh replaces the previous snapshot, including on a fatal geometry error;
an old successful result must not look like a new successful result. The audit
is synchronous and can pause the interface on a large document. There is no
background worker, persistent report, solver telemetry or document-format
change in this implementation.

## Contributor handoff

The adapter and its CPU egui/cache tests are in `src/atelier/sewing_ui.rs`.
`AuthoringUi` owns the cache and mounts the section before panel-specific
properties, so it is accessible without a selected piece. Task:
[EXO-SEW-006](https://github.com/erythrofr/ClothCraft/issues/43).
This is original Rust code; no EXO implementation or assets were copied.

Targeted CPU checks (graphics libraries compiled, no GPU initialized):

```powershell
cargo test --locked -j 2 --bin cloth-fit sewing_ui -- --test-threads=2
cargo test --locked --no-default-features -j 2 --test sewing_audit -- --test-threads=2
```

Native-window acceptance is separate from these CPU checks. Keep GPU use
explicitly authorized and do not add it to the default test suite.

Validation on 23 October 2026: all 52 editor tests passed (one optional
preview ignored), all 15 headless sewing-audit tests passed, targeted Clippy
with warnings denied passed, and the optimized `cloth-fit` binary built.
The native Windows check used the shipped T-shirt, paused: Run audit reported
eight seams, expanding a row displayed its material lengths, Inspect seam
opened the existing draft and highlighted both views, and Escape cancelled
the draft. Tool switching marked the snapshot stale and disabled inspection.
This was an interface check, not a physics or performance benchmark.

For follow-up automation, extend the existing named-widget target mechanism
in `src/atelier/authoring_smoke.rs` rather than relying on desktop coordinates.
It records visible widget centers, scrolls off-screen targets into view and
drives egui pointer events. An audit scenario should assert document/history
invariance, stale navigation, refresh failures and local easing. That harness
file is outside EXO-SEW-006's reserved scope; this slice tests the audit button
headlessly and checks native integration separately.
