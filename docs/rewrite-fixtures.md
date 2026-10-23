# Public authoring contract fixtures

Task: [EXO-QA-001](https://github.com/erythrofr/ClothCraft/issues/54).
The files in `tests/fixtures/rewrite/` are original MIT-licensed synthetic
patterns for contributors implementing editing and interchange. They contain
no private Garment, EXO implementation, commercial pattern or avatar asset.
They test native document behavior, not simulation quality or cross-editor
compatibility that has not been implemented.

## Run

Build the current CPU CLI with two jobs, then run the fixture verifier:

```powershell
cargo build --locked --no-default-features -j 2 --bin cloth-template
python tests/fixtures/rewrite/verify.py --cli target/debug/cloth-template.exe --self-test
python -m unittest discover -s tests/fixtures/rewrite -p test_verify.py
```

On Linux/macOS omit `.exe`. Python 3 uses only the standard library. The
runner sets two Rayon threads, invokes only `validate`, `metrics` and
`audit-sewing`, and runs sequentially with a 30-second limit per process.
It retains at most 1 MB of each report in memory (temporary output files
may grow until the process exits or times out). It does not launch a window,
initialize a GPU, simulate, overwrite fixtures or create exported artifacts.

Each case has a SHA256 in `manifest.json` (CRLF normalized to LF for Git
checkouts across platforms); changed content requires deliberate
review of both geometry and expectations. The runner never updates hashes
or expected results. It prints the CLI binary hash and native source baseline;
that hash identifies the tested binary, not proof of its source provenance.
Build from the recorded checkout before reporting results.

These checks are **explicit local checks**, not automatically discovered by
`cargo test` or wired into CI in this task. Workflow changes require their
own coordination scope. The ordinary CPU and desktop suites remain separate.

## Cases and independent expectations

All lengths are metres, areas m², masses kg and density kg/m². The synthetic
fabric has density 0.2 kg/m²; its stiffness is uncalibrated test data. Panels
have separate flat placements and board layouts, with 0.6 m spacing.

| Case | Expected behavior |
|---|---|
| Legacy rectangle | v1 rectangle, 0.4 × 0.3 = 0.12 m², mass 0.024 kg |
| Hole | v2 panel minus a clockwise 0.1 × 0.1 m hole: 0.11 m² |
| Internal strip | A 0.30 m internal path sewn to a 0.30 × 0.08 m strip; total 0.144 m² |
| Partial reversed | Half of each 0.30 m edge: 0.15 m; retains segment reversal separately from whole-side reversal |
| Chain | One 0.40 m edge joined to two ordered 0.20 m edges on distinct panels |
| Local easing | Equal 0.40 m totals; notch maps 0.10 to 0.30 m and then 0.30 to 0.10 m; both intervals require easing |
| Curved | Two cubic boundaries with analytic area/length, compared within sampling tolerances |
| Invalid easing | The same local mismatch without explicit easing is rejected |
| Invalid reference | A missing named edge reports `invalid_reference`, without selecting a substitute |
| Invalid unknown field | An unmapped external field is rejected by strict schema decoding |
| Invalid contour | A crossed outer contour is rejected before sewing audit |

The curved boundary is defined independently as
`x(t)=0.4t`, `y(t)=0.15t(1-t)`, for `0 <= t <= 1`. Its area under the curve
is 0.01 m², so each panel has area 0.11 m². Its exact length is
`0.5*sqrt(w*w+a*a) + w*w/(2*a)*asinh(a/w)`, with `w=0.4`, `a=0.15`.
The manifest allows 0.0002 m² for the combined sampled area and 0.0005 m
per sampled seam length, accounting for the compiler's 0.25 mm flattening
bound. Straight geometry uses 1e-10 absolute tolerances. Expectations do not
freeze triangle counts or vertex ordering.

Successful geometry cases check panel/seam counts, total area and mass, plus
the relevant audit lengths, identities or easing flags. Invalid sewing cases
require a nonzero exit **and** structured `valid=false` diagnostics. Schema
and contour failures happen before a structured sewing report and are
checked separately. Fatal contour error text is deliberately not treated as
a stable protocol code.

## Sharing with another editor or agent

The baseline is native ClothCraft commit
`678797f23e9072c9245b150f24523a0ecb3dd673`, with `GarmentTemplate` v1/v2
and the documented [editor contract](exo-contract.md). The fixtures have no
draped cache and must never be interpreted as captured solver checkpoints.
Their JSON can be opened as native templates; it is not EXO interchange JSON.

A future converter should record its exact source/destination revisions,
units, each supported field and every loss. Compare semantic geometry and
sewing correspondence, not a screenshot or identical tessellation. Preserve
stable panel/boundary IDs, partial ranges, chain order, notches and explicit
easing. Do not flatten an unsupported chain or silently discard an internal
line, hole or unknown field just to make an import succeed.

No EXO-to-native or native-to-EXO conversion has been run here. Authored trims,
grading, PBR assets and persistent measurements remain outside the currently
supported native fields; no pretend fixtures for those features are supplied.
As adapters implement them, add independently authored cases and explicit
loss/rejection expectations under reviewed task scopes.

## Falsification and observed validation

`--self-test` deliberately claims the rectangle has area 12 m² (100 times
too large), runs the real CLI and requires the comparison to fail on that
area field. The comparator tests also reject NaN/infinity, numeric strings,
boolean-as-number values, wrong diagnostic codes and missing fields.

Observed on Windows, 24 October 2026: 11 cases passed 29 CLI checks; the
deliberately wrong area was rejected; all four verifier tests passed.
This is authoring/compiler acceptance only. It does not prove seam settling,
collision safety, performance, cross-editor conversion or native UI behavior.
