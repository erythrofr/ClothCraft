# EXO fabric evidence ingestion (schema version 1)

The 400 catalog entries are garment design specifications. Catalog values are primarily estimates. An external laboratory must test an identifiable physical swatch before that swatch's properties can be called measured. Never attach a test from a different finishing treatment or fabric lot to a catalog variant without documenting the linkage.

## API

`src/core/fabricEvidenceCalibration.js` exports `validateFabricEvidence(record, FABRIC_PRESETS)`, `calibrateFabricEvidence(record, FABRIC_PRESETS)`, and `ingestFabricEvidence(records, FABRIC_PRESETS)`. All return data without mutating the catalog or native solver. The batch importer rejects duplicate `fabricId + sampleId` pairs. A failed validation throws with a field-specific message. The calibration output includes `grade`, `physical`, `solverSuggestions`, `differences`, `flags`, and the original validated `evidence` for a JSON roundtrip.

Example import:

```js
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { calibrateFabricEvidence } from '../src/core/fabricEvidenceCalibration.js'

const result = calibrateFabricEvidence({
  schemaVersion: 1,
  fabricId: 'denim', // use an existing catalog ID
  provenance: {
    sampleId: 'laboratory-lot-01',
    evidenceUri: 'https://example.org/specimens/01',
    sourceReference: 'Report and test run 01',
    method: 'record actual standardized fixtures and methods here',
    condition: 'record measured temperature, humidity, pretreatment here',
  },
  measurements: {
    arealMass: { value: 300, unit: 'g/m²', uncertainty: 3 },
    thickness: { value: 0.7, unit: 'mm', uncertainty: 0.02 },
    tensile: {
      warp: {widthMm: 50, gaugeLengthMm: 100, observations: [
        {extensionMm: 1, forceN: 4}, {extensionMm: 2, forceN: 8}
      ]},
      weft: {widthMm: 50, gaugeLengthMm: 100, observations: [
        {extensionMm: 1, forcePerWidth: {value: .05, unit:'N/mm'}},
        {extensionMm: 2, forcePerWidth: {value: .1, unit:'N/mm'}}
      ]}
    },
    shear: {value: 100, unit: 'N/m'},
    bending: {warp: {value: .0001, unit:'N·m'}, weft: {value: .00008, unit:'N·m'}}
  }
}, FABRIC_PRESETS)
```

These are **synthetic illustration values**, never production evidence. The importer requires an evidence URI, sample ID and source reference; supports numeric measurement uncertainties but does not create confidence intervals from unknown test distributions. An actual test report should include conditioning, equipment, calibration date, test standard, specimen geometry, loading speed, load cycles, replicate IDs, direction and force definitions, sample/lot construction, test pressure for thickness, temperature and humidity. Verify reuse and scan licensing separately.

## Units and mechanics

Accepted areal mass `g/m²` or `kg/m²`, thickness `mm`, force `N` per specimen, normalized membrane force `N/mm` (force divided by strip width), shear `N/m`, and bending rigidity `N·m` per unit width according to the reporting convention. Tensile points must have increasing extension `mm` relative to the explicit gauge length, positive force and at least two points in each reported direction. The importer converts density to `kg/m²`, thickness to `m`, and membrane force to `N/m`; fit stiffness uses measured engineering strain and regression through the origin. Load–unload hysteresis, creep, bending method conventions, transverse contraction, shear fixture effects, nonlinear anisotropy and sample variability remain unmodeled. The regression is flagged `derived-approximation` and must be calibrated independently to native solver behavior.

Directly convertible, labeled `measured`: solver `density` (kg/m²) and `thickness` (m) only, plus physical bending/shear values under their reported units. Shear and bending solver suggestions stay `derived-approximation` until the native backend's convention is verified. The React `stretchWarp/stretchWeft` fields do not have a reference-force definition, so no tensile modulus is converted to those percentages. `bend` is an arbitrary normalized control and cannot be recovered from measured N·m. Neither color, roughness, geometry scans, finish chemistry nor friction can be inferred from these mechanical curves.

## Evidence grades

Grade A: all seven measurements (mass, thickness, two directional tensile curves, shear, two directional bending measurements), plus declared method and conditions. Grade B: at least four measurements including both tensile axes. Grade C: at least two measurements without B/A completeness. Grade D: one measurement. These represent **completeness**, not laboratory accreditation, measurement accuracy or fabric authenticity. Missing measurements are never filled with invented values. The native cloth solver must still be validated against separate physical drape and force trials before promoting suggested coefficients.

`differences` compares incoming measured mass and thickness to catalog estimates, recording original value, observed value, absolute delta and relative delta. It deliberately does not compare tensile moduli to percentage stretch controls; those have incompatible definitions. Repeat samples with unique IDs may be ingested, but aggregating them statistically requires an explicit experimental design.

Run `node scripts/check-fabric-evidence.mjs` to validate all 400 catalog identifiers, bad-unit and malformed evidence rejection, specimen conversions, grade tiers and roundtrip serialization.
