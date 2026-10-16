# Foundation Tee 2D pattern correction

## Local references inspected

1. User's CLO archive:
   `~/Documents/CLO_Automation/TShirt_Demo/TShirt_Automated_EndToEnd.zprj`.
   The archive contains a proprietary `.zpac` and avatar files, but the
   readable `.xml` is primarily lighting/environment, not a reliably parsed
   manufacturing pattern. It is **not** treated as a verified numeric master.
2. The already downloaded open-source
   [GarmentCode](https://github.com/maria-korosteleva/GarmentCode) project,
   `research/oss/GarmentCode/assets/design_params/t-shirt.yaml` and
   `assets/Patterns/shirt_mean_specification.json`. These demonstrate body
   panels, sleeve panels, parametric collar/shirt settings and stitch graphs.
   The eight-panel source spec with 18 stitches is not numerically identical
   to Garment Studio's 4-panel/14-seam demo. It was not copied point-for-point.
3. No confirmed authorized **Miguel T-shirt** pattern data file was identified
   in the local document/download search. Do not label this draft an exact
   replica of Miguel's work or a manufacturer-approved production master.

## What changed

The Foundation Tee now preserves its four pieces and all 14 named seam
relationships while correcting *both* sides of the armhole/sleeve seam.
Seven-point short sleeve anchors stay in place, with a raised quadratic
sleeve cap. Front and back armhole curve controls are slightly straighter,
matching cap geometry without extreme curvature.

| Check | Previous Foundation Tee | Revised Foundation Tee |
| --- | --- | --- |
| Four pieces / 14 seams | Yes | Yes |
| Max sleeve-to-body segment mismatch | about 7.7% | **0.213%** |
| All seam length status values | some warning/error | all good |
| Front deeper neckline than back | Yes | Yes |
| 160cm XPBD regression peak strain | ~178% | ~144% |
| 200cm XPBD regression peak strain | ~112% | ~112% |
| Wider-upper-body XPBD regression | not specifically retested | passes current guard |

These XPBD peak strain numbers are algorithmic, not physical stretch
certifications; the existing guard allows extreme transient local strain.
Correct seam lengths do **not** establish a production-ready fitting grade.

The new template loads corrected geometry automatically when selected anew.
Already saved `tee` projects can use **Pattern > Match T-Shirt Armholes +
Sleeves**; this edits only the two armhole curve pairs in front/back and the
sleeve cap curves while preserving saved pattern vertices, current fabrics,
named seams, project name and 3D placements. The editor Undo stack preserves
the prior draft.

Regression:

```bash
node scripts/check-tee-precision.mjs
node scripts/check-avatar.mjs
```

## What still needs true pattern engineering

- Fit the neckline, shoulder slope, sleeve pitch, bicep ease and hem length
  to Thomas's actual human measurements, not just an approximate 180cm body.
- Model physical sewn rib collar, hem and cuffs and garment ease allowance.
- Grade according to a supplier-approved base size and measurement chart.
- Validate full-body drape without penetration, and make a physical sample.
- Import and compare an explicitly licensed official T-shirt tech pattern
  before claiming exact garment-maker pattern equivalence.
