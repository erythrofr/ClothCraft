# CLO3D functional parity workspace

This workspace applies the publicly documented methodology and two
standard-library tools from the MIT-licensed
[replica-skill](https://github.com/Jakeschincariol/replica-skill)
to our independently engineered Garment Studio app.

## Regenerate the grounded feature score

```sh
npm run check:clo-parity
npm run check:clo-parity-ci
```

The authoritative editable inventory is `features.csv` with evidence paths.
`parity.md` is generated. The score is a weighted snapshot of **43 selected
user-visible behaviors**, not an exhaustive percentage of CLO3D source
capabilities, not a release approval, and not a physical fitting certificate.
Each `partial` credits exactly one-half of its selected behavior.

Before changing a `clone=no` row to `yes`, require a real implementation,
an explicit acceptance test and a clean result. A UI control alone is not a
functioning CAD or draping feature. Read `recon.md` and `test-plan.md` for
scoped screens, flows and known blocked cases.

## Visual parity

The MIT `scripts/vendor/replica-skill/imgdiff.py` compares same-size PNGs
by structural edge layout or exact pixels. We have since located a **real
local CLO Academic 7.0.242 male T-shirt reference** taken from the user's
own running program, described in
`docs/CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md`. Its pattern geometry
differs from our Foundation Tee and CLO's 2026.1 toolbar is customizable;
the measured 2D *chrome-only* score is explicitly not a full CLO visual
or feature parity percentage.

Use project-owned screenshots of the current application under
`replica/clone-screens/`. Put licensed original-app screenshot reference
files separately in `replica/screens/`; these are for private comparison,
not redistribution.

`npm run capture:clo-2d` successfully captured a **real isolated
Garment Studio 2D drafting pane** at a 1440 × 900 browser viewport
(`replica/clone-screens/S01-2d-pattern-window.png`, 85,526 bytes);
zero browser errors in the initial capture. The current version also saves
the complete local app screenshot, so the adjacent 2D editing rails can be
included in the comparison. These images are Git-ignored.

Run the **current, reproducible comparison** with:

```sh
npm run check:clo-2d-visual
```

It crops the local, private CLO7 reference to its 2D Pattern Window,
normalizes the equivalent Garment Studio 2D pane, masks the unmatched
garment outlines, computes the replica-skill chrome-only edge-layout
score, and writes a bounded JSON report to `replica/diffs/`.
The user-owned CLO screenshot and both cropped images remain Git-ignored.

Example (recompare a matched rendering by hand):

```sh
python3 scripts/vendor/replica-skill/imgdiff.py \
  replica/screens/S01-CLO7-chrome-only.png \
  replica/diffs/S01-own-after-chrome-only.png \
  --json --out replica/diffs/S01-2d-diff.png
```

## REA build archaeology (own application only)

REA, from https://github.com/morluto/rea (MIT), was used on **only our
compiled JavaScript/HTML assets**, not any CLO3D executable or the private
Thomas model. Its validated static graph and bounded findings are recorded in
`evidence/rea-own-garment-js-2026-10-14.json`.

The large raw immutable Evidence JSON is saved as a verified gzip file
`replica/evidence/raw/rea-owned-js-20261014.evidence.json.gz` locally,
**Git-ignored** and not included in the published repository. It can be
extracted to `/tmp` for REA's future cross-version comparisons. REA labels
its result **partial static coverage**;
module/endpoint candidates alone cannot certify a feature or native runtime
behavior. In particular shader extension identifiers inferred as possible
endpoints are not confirmed network calls.

An opt-in future recheck can repeat this exact acquisition in a temporary
directory, without registering a global MCP server:

```sh
mkdir -p /tmp/gs-rea-target/assets
cp dist/index.html /tmp/gs-rea-target/
cp dist/assets/*.js /tmp/gs-rea-target/assets/
npm_config_cache=/tmp/gs-rea-npmcache npx -y rea-agents@6.5.0 \
  analyze-javascript-application /tmp/gs-rea-target --json \
  > /tmp/gs-rea-current-evidence.json
node --max-old-space-size=2048 scripts/summarize-rea-evidence.mjs \
  /tmp/gs-rea-current-evidence.json \
  replica/evidence/rea-own-garment-js-2026-10-14.json
```

The CLI downloads its own dependencies to npm's temporary cache. Running the
commands again updates the small summary; it does not overwrite the preserved
compressed 2026-10-14 baseline unless you do so intentionally. Do not
invoke `rea setup` or install Hopper/Ghidra on Jarvis without a separately
reviewed, explicitly approved agent configuration. No source code of another
vendor is copied or packaged.
