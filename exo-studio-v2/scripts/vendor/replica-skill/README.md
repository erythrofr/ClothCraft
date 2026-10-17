# Replica-skill utilities used in Garment Studio

Upstream: https://github.com/Jakeschincariol/replica-skill

- Commit reviewed: `77c9436fb3d18c3d58169efb8caf4fe906b0dc51`
- License: MIT, included in this directory as `LICENSE`.
- Imported unchanged from `replica-diff/`: `parity.py`, `imgdiff.py`.
- Independent upstream verification on the checkout: 57 unittest cases pass.

These Python standard-library programs compare a *feature matrix* and two
same-state PNGs. They do not inspect CLO3D source, simulate fabric, certify
manufacturing geometry, or grant access to proprietary assets. Layout scores
must not be reported without a real source reference screenshot.

Examples:

```sh
python3 scripts/vendor/replica-skill/parity.py replica/features.csv --markdown
python3 scripts/vendor/replica-skill/imgdiff.py \
  replica/screens/2d-pattern-reference.png \
  replica/clone-screens/2d-pattern.png \
  --json
```

Screenshots of the target belong to local reference material and should not
be redistributed with the product. Reuse the project-owned original icon and
style assets in any shipped work.
