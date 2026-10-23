# Authored sewing audit

`cloth-template audit-sewing` inspects a template without running a simulation,
opening a window or initializing a GPU. It reports authored material lengths,
not the distance between draped surfaces. This is a construction diagnostic,
not a fit-quality score or a guarantee that a garment will settle.

```powershell
cargo run --locked --no-default-features -j 2 --bin cloth-template -- audit-sewing examples/templates/two-panel.json
```

The default input is **GarmentTemplate JSON**, such as the exported
`template.json`. To inspect an editor save directly, use
`cloth-template audit-sewing --project path/to/Garment.clothcraft`.
This reads the template embedded in fitting-project v1 JSON; it does not load
the avatar asset, simulate, or validate/reuse the draped state. The report is
not a full project validation. Other project versions are rejected.
Input JSON is
parsed directly rather than through the normal compile-on-load function, so
an invalid seam does not hide all subsequent diagnostics.

The command writes a versioned JSON report to stdout. It exits successfully
only when `valid` is true. Invalid sewing still produces the report, then
returns a nonzero exit status and a short message on stderr. Malformed JSON,
invalid material geometry or more than 512 seams are fatal: no partial
geometry report is promised. The command never saves or repairs its input.

## Reading the report

- `geometry_basis` is `compiled_material_rest_boundaries`. Lengths are in
  metres and use the same sampled rest boundary as the compiler, not an
  analytic Bézier integral or the current 3D shape.
- `seams` follows document order. Stable seam/panel/edge IDs identify authored
  objects; `seam_index` disambiguates invalid duplicate seam IDs within this
  report. It is not a persistent mesh index.
- `a` and `b` list original chain segments, including normalized boundary
  ranges and segment reversals. `reverse_b` reverses the complete B chain,
  exactly as in the compiler. Named edges take precedence over rectangle sides.
- `lengths_m` and `difference_m` are available when both sides resolve.
  The signed difference is **B minus A**. A missing side does not erase the
  lengths of other valid segments. Non-finite input ranges appear as null
  with an error; null never means the whole boundary.
- `intervals` follows the authored monotone correspondence knots, including
  implicit endpoints. Each interval reports its two rest lengths and whether
  it requires easing under the compiler's relative tolerance (`1e-8`). Two
  equal total lengths can still require local easing. `allow_ease` remains
  the original explicit policy; the audit does not enable it in the document.
- Seam-level `errors` cover ID, correspondence and ownership problems;
  segment-level `errors` identify references and ranges that cannot resolve.
  Error codes are machine-readable; messages give context. They are not
  localized. A bad seam does not prevent other seams from being inspected.

`valid` means that this audit found no authored-sewing error on the compiled
geometry. It says nothing about initial intersections, convergence, fabric
calibration or simulation performance. Successful compiler correspondence
does not make unequal-length sewing a physical gathering model.

## Junctions and overlapping ownership

`junctions` lists exact coincident **material endpoints on the same panel**
that belong to at least two distinct seam records. The degree counts distinct
seam records, not segment ends: two adjacent segments of one chain do not
inflate the degree. Endpoints retain side, segment and boundary parameters;
no vertex or triangle indices are serialized.

This is endpoint incidence, not a graph of physical contacts. It does not
detect interior crossings, merge nearby coordinates, join different panels
because their 3D positions happen to coincide, or infer seam junctions through
the opposite side of a correspondence. Exact floating-point coordinate
equality is intentional; near-coincident endpoints can remain separate.
High degree is informational, not automatically an error.

Ownership checks use the compiler's named-boundary/legacy-side identity and
normalized range tolerance (`1e-12`). Touching ranges are allowed; overlapping
intervals, including sewing one interval to itself, are errors. A sorted sweep
reports each affected seam/boundary once rather than enumerating every
conflicting pair. Different named boundaries that geometrically overlap are
not identified as the same boundary by this check.

## Implementation and validation

The original Rust implementation is in `garment::seam::audit`. Material
geometry is compiled once from a temporary copy without seams. Boundary
resolution uses the compiler's boundary maps and `BoundaryCurve`; trimming,
chain reversal and knot validation use `BoundaryCurve::concatenate` and
`CompiledSeam::compile`. To measure intervals even when explicit easing is
missing, a local seam copy permits easing solely for correspondence inspection.
Neither the source template nor any compiled solver state is modified.

The library and command are CPU-only. UI integration is not included in this
slice. EXO-SEW-001 is tracked on [issue #19](https://github.com/erythrofr/ClothCraft/issues/19).
No EXO implementation or asset was copied. Tests in `tests/sewing_audit.rs`
exercise compiler agreement, local easing, invalid input, ownership, material
endpoint incidence, deterministic output and the real CLI's error exit path.

Validation on 23 October 2026: 15 audit tests, 12 garment tests and 3 sewing-chain
tests passed with graphics disabled and two test threads. These include 36
compiler-policy combinations, curved boundaries, dense ownership conflicts,
and project input without an avatar asset. Targeted Clippy with warnings
denied, formatting checks and the CPU release build of `cloth-template` passed.
The baseline complete CPU suite passed 311 tests before this addition. This
is not native UI acceptance or a solver performance benchmark.
