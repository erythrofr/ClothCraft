# Seam allowance and notches (MARK-01)

Implemented on **18 October 2026**. This is the first slice proposed by
[feature-map.md](feature-map.md): per-boundary **2D seam allowance** and **notches** as stable
draft data in material coordinates, carried onto the printed cutting line. Everything here is
CPU authoring and export; it does not change the solver, the document format version, or the
meaning of the existing fields.

## What it is, and what it is not

- **It is** two maps on `PolygonPattern`: `seam_allowances` (metres, keyed by the stable
  boundary id) and `notches` (a list per boundary, each with a position, a marker length and a
  shape). A joined **cutting contour** is derived on demand from the sewing contour plus the
  allowances. Both maps are *draft data*: they add no area, mass, hinge or constraint.
- **It is not** a change to the physical model. A marking never rebuilds the mesh, never resets
  the drape, and never enters the mesh fingerprint. `authoring::same_physics` and
  `fitting::mesh_signature` both clear the two maps, exactly as they already clear
  `target_lengths`.
- **It is not** `MARK-02`. Notch **correspondence** (a matched pair across a seam and a
  length-difference report) is a separate, unstarted slice. The seam compiler's own `notches`
  field is untouched.

## The data model

`PolygonPattern` gains two optional, `skip_serializing_if`-empty fields. Historical files load
unchanged, and a fresh pattern serialises neither key.

```json
{
  "seam_allowances": { "hem": 0.01, "side-left": 0.01 },
  "notches": {
    "hem": [{ "at": 0.5, "length_m": 0.005, "kind": "v" }],
    "side-left": [{ "at": 0.3, "length_m": 0.008, "kind": "slit" }]
  }
}
```

- `at` is a fraction of the boundary's **sampled arclength** in the open interval `(0, 1)`.
  Because it is a fraction of the named boundary, it survives resizing, remeshing and mirroring
  (mirroring stores `1 - at`).
- `length_m` is the marker depth from the sewing line, in metres; `kind` is `v` (default) or
  `slit`.
- Allowances are absolute widths in metres, keyed by the same boundary ids the sewing editor
  already uses. The identifier is the contract; no vertex or triangle index is stored.

A marking boundary is a **closed** boundary: an outer edge or a hole rim. An open internal line
has two sides and is refused with a clear message, so an allowance is never silently
one-sided.

## The cutting contour

`PolygonPattern::cutting_contour()` returns `None` when no allowance is set, otherwise a
`CuttingContour { outer, holes }`:

1. Every named boundary is sampled by the existing `edge_points`, and each segment is offset
   outward from the material by its boundary's allowance. Outward is to the right of the
   directed boundary, which points away from the material for both the counter-clockwise outer
   contour and a clockwise hole.
2. Adjacent offset segments are **joined with a miter** at their line intersection, so a mixed
   contour (some edges allowanced, some not) stays closed. Parallel edges simply meet.
3. A miter longer than eight times the local allowance becomes an explicit bevel instead of a
   hidden spike.
4. The result is validated: the loop must be simple and keep its winding, and **no point may
   fall inside the material**. That last check is what catches a closed gap: a per-segment
   offset can overshoot a thin feature and fold shut while still tracing a simple loop.

A contour that cannot be represented is **refused**, not approximated. The command returns an
error, the transaction is abandoned, and the document is untouched — the acceptance criterion
"explicit failure when the offset self-intersects".

Holes shrink by their allowance (the cut line moves into the hole, adding material); a hole
that would close or invert is refused.

## Notches

`PolygonPattern::notch_marker(edge, notch)` returns the marker polyline in material
coordinates. A `v` notch is a small wedge straddling the sewing line and pointing outward; a
`slit` is a single outward segment.

A notch must satisfy the published editor rule: it stays **at least 1 mm from either end** of
its boundary, its length is in `(0, 50 mm]`, and its allowance is in `[0, 100 mm]`. A violation
is a transaction error, never a silent drop. `validate_markings` also rejects a marking that
references an unknown boundary, so a rename, split or mirror that forgets to migrate a marking
fails loudly.

## Migration and refusal

| Operation | Markings |
|---|---|
| `Mirror` | reversed contour ⇒ `at` becomes `1 - at`; allowances are absolute, unchanged |
| `SplitBoundary` | the allowance is copied to both halves; each notch keeps its material arclength position |
| `RemovePoint` | refused when either rejoined boundary carries an allowance or notch (ambiguous) |
| `Boolean` | refused when an operand carries an allowance or notch, like lines and target lengths |
| `Shape`, `Dimensions`, `Anchor`, `MovePoints` | carried through unchanged: fractions and widths are geometry-independent |
| Clipboard | copied with the panel, like every other field |

## Export

- `export::pattern_svg` (the existing unscaled preview) draws the joined cutting contour as a
  dashed orange path and each notch as a red marker.
- `export::pattern_print_svg` is a new **true-scale** sheet in millimetres: one panel per page,
  1 mm = 1 mm, with the stitch line, the cutting line, the holes, the internal lines, the
  notches, the grain line and a **100 mm ruler** that proves the scale. It is written to
  `patterns-print.svg` beside `patterns.svg` by `write_artifacts`.
- It is **not** nesting and **not** tiling: pages are never packed together, and a panel wider
  than the page is not split. Multi-page tiling and deterministic nesting remain
  `LAYOUT-01`, and a PDF remains `PDF-01`.

## Use the tools

In **Edit**, click an outer boundary on the 2D board. The inspector shows the boundary length
and, below the boundary tools, **Seam allowance** and **Notches**:

- Type a width in mm and **Apply allowance** to offset that boundary; **Clear allowance**
  removes it. The cutting line is drawn on the board immediately. A boundary without a stored
  allowance opens the field on the **10 mm** default width, so the draft is one click from being
  applied; the stored value replaces it from then on.
- Type a position (mm from the start), a marker length and a shape, then **Add notch**. Existing
  notches are listed with their position, length and shape and can be removed one at a time.

The board draws the cutting contour and the notches in every tool, so the cut is always visible.

## Limits

- The offset is a per-segment offset with a miter join, not a Minkowski dilation. It is exact
  for convex and gently concave boundaries and refuses the cases it cannot represent; it does
  not round corners or repair itself.
- A dropped notch reproduces the published 1 mm end rule; there is no "snap to a corner
  recommendation".
- Notches are draft markers. They are not cut into the mesh, they add no notch energy, and the
  seam compiler does not consume them yet (`MARK-02`).
- The true-scale sheet has no nesting, tiling, cut count or PDF output (`LAYOUT-01`, `BOM-01`,
  `PDF-01`).

## Sources and behaviour

The workflow wording — per-boundary seam allowance width, notch placement with a 1 mm
clearance from a segment point, a default notch type, inner-shape versus pattern-outline display,
and duplicating a notch onto the seam allowance — is consistent with the public CLO / Marvelous
Designer articles already cited by [essential-authoring-tools.md](essential-authoring-tools.md)
(*Edit Seam Allowance Properties*, *Notch*) and with the option and validation labels shipped
with the application, cross-checked against the installed build for wording. No proprietary
code, resource or garment example was imported; the model, geometry and tests here are
independently written.

## Implementation and validation

| File | Responsibility |
|---|---|
| `src/garment/markings.rs` | `Notch`, `NotchKind`, validation, joining and the cutting contour |
| `src/garment/polygon.rs` | the two optional fields; `build` validates the markings |
| `src/authoring.rs`, `src/authoring/geometry.rs` | `SeamAllowance`, `SetNotch`, `RemoveNotch`; migration and refusal |
| `src/garment/export.rs` | preview markings and the true-scale `patterns-print.svg` |
| `src/atelier/board.rs`, `authoring_ui.rs` | boundary inspector and board overlay |
| `src/atelier/authoring_smoke.rs` | native pointer scenario: `markings_allowance`, `markings_notch` |
| `src/garment/shapes.rs`, `src/fitting.rs` | mirror migration; cache-signature cleanup |
| `tests/pattern_markings.rs` | nine CPU tests (see below) |

`tests/pattern_markings.rs` covers: a 10 mm allowance grows the cutting contour by exactly
20 mm while leaving meshed area and `same_physics` unchanged and not resetting the drape; a
one-sided allowance moves only that edge; a horseshoe whose gap a 3 mm allowance would close is
refused transactionally; a notch survives a JSON round trip and a dangling reference fails to
compile; the 1 mm end rule; append/remove; split migration; mirror reflection; refusal by
`RemovePoint` and `Boolean`; and the cutting line, notch and 100 mm ruler in both SVGs.

The feature is also exercised through the **real native application**. The authoring pointer
scenario (`cloth-fit --steps 0 --ui-authoring-smoke`) now selects a boundary, clicks
**Apply allowance** (the 10 mm default) and **Add notch** on the actual inspector widgets, and
reports four new assertions in `authoring.json`:

- `allowance_applied` — the boundary carries the width and `cutting_contour()` resolves;
- `notch_added` — the boundary carries a notch;
- `markings_preserved_physics` — `same_physics` and the drape `state.x` are unchanged by the
  offsets;
- `markings_exported` — the reloaded `fitting-project.json` still carries the allowance and the
  notch.

Two inspector targets (`duplicate`, `focus`) moved from the unclipped `smoke_target` to the
clip-aware `smoke_target_ui` that the other in-pane widgets already use: the taller boundary
inspector pushed "Frame the panel" out of the pane, so the unclipped target was clicked in empty
space and the 3D rotation rings then missed. On this machine the four new assertions pass and the
scenario completes 57/57 pointer actions.

The scenario still reports one pre-existing failure, `partial_and_multi_edge_sewing`, which also
fails on an unmodified checkout of this commit on the same machine: the second chained edge is
never attached to side B, so the exported seam has an `a_tail` of length 1 and an empty `b_tail`.
It belongs to the partial multi-edge sewing path (`SEW-01`), not to the markings, and is left
untouched here.

All default tests stay on CPU. `cargo test --locked --no-default-features -j 2` passes, and the
library and this test pass `cargo clippy -- -D warnings`. (The repository's
`--all-targets` clippy gate currently also trips a pre-existing `chunks_exact` lint in
`tests/drafting_tools.rs`, which is unrelated to this pass and is addressed by the
`chore/clippy-as-chunks` change.)
