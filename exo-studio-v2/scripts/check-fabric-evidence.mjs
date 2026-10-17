import assert from 'node:assert/strict'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { calibrateFabricEvidence, ingestFabricEvidence, validateFabricEvidence } from '../src/core/fabricEvidenceCalibration.js'

assert.equal(Object.keys(FABRIC_PRESETS).length,400)
const specimen = id => ({
  schemaVersion:1, fabricId:id,
  provenance:{sampleId:`lab-${id}`, evidenceUri:'https://example.org/test-report/001', sourceReference:'Test report 001',method:'strip tensile + shear + cantilever', condition:'20 C; 65% RH'},
  measurements:{
    arealMass:{value:245,unit:'g/m²',uncertainty:2},
    thickness:{value:.8,unit:'mm',uncertainty:.03},
    tensile:{warp:{widthMm:50,gaugeLengthMm:100,observations:[{extensionMm:1,forceN:5},{extensionMm:2,forceN:10}]},
      weft:{widthMm:50,gaugeLengthMm:100,observations:[{extensionMm:1,forcePerWidth:{value:.08,unit:'N/mm'}},{extensionMm:2,forcePerWidth:{value:.16,unit:'N/mm'}}]}},
    shear:{value:92,unit:'N/m',uncertainty:4},
    bending:{warp:{value:.00009,unit:'N·m'},weft:{value:.00007,unit:'N·m'}}
  }
})
const records = Object.keys(FABRIC_PRESETS).map(specimen)
const calibrated = ingestFabricEvidence(records,FABRIC_PRESETS)
assert.equal(calibrated.length,400)
assert.equal(new Set(calibrated.map(x=>x.fabricId)).size,400)
for (const record of calibrated) {
  assert.equal(record.grade,'A')
  assert.equal(record.physical.arealMassKgM2.value,.245)
  assert.equal(record.physical.thicknessM.value,.0008)
  assert.equal(record.physical.warpTensileFit.value.stiffnessNPerM,10000)
  assert.equal(record.physical.weftTensileFit.value.stiffnessNPerM,8000)
  assert.equal(record.solverSuggestions.warp.status,'derived-approximation')
  assert.equal(record.solverSuggestions.density.status,'measured')
  assert.equal(record.differences.gsm.measured,245)
  assert.equal(record.differences.thickness.measured,.0008)
  assert.deepEqual(validateFabricEvidence(JSON.parse(JSON.stringify(record.evidence)),FABRIC_PRESETS),record.evidence)
}
const copy = obj => structuredClone(obj)
const bad = (transform,pattern) => {
  const record=specimen(Object.keys(FABRIC_PRESETS)[0])
  transform(record)
  assert.throws(()=>calibrateFabricEvidence(record,FABRIC_PRESETS),pattern)
}
bad(r=>{r.fabricId='nonexistent'},/Unknown fabricId/)
bad(r=>{r.provenance.evidenceUri='javascript:alert(1)'},/unsupported URI/)
bad(r=>{r.measurements.arealMass.unit='ounces'},/expected g\/m² or kg\/m²/)
bad(r=>{r.measurements.thickness.value=-1},/positive finite/)
bad(r=>{r.measurements.tensile.warp.observations[1].extensionMm=.4},/extensions must increase/)
bad(r=>{r.measurements.tensile.warp.observations[0].forceN=NaN},/positive finite/)
bad(r=>{r.measurements.tensile.weft.observations[0].forcePerWidth.unit='N/m'},/expected unit N\/mm/)
bad(r=>{r.measurements.tensile.warp.observations[0].forcePerWidth={value:1,unit:'N/mm'}},/exactly one/)
bad(r=>{r.measurements.tensile.warp.observations=[]},/two measured points/)
bad(r=>{r.measurements.bending.warp.unit='N/m'},/expected unit N·m/)
const low=copy(records[0]);low.measurements={arealMass:{value:.245,unit:'kg/m²'}}
assert.equal(calibrateFabricEvidence(low,FABRIC_PRESETS).grade,'D')
const medium=copy(records[0]);delete medium.measurements.shear;delete medium.measurements.bending
assert.equal(calibrateFabricEvidence(medium,FABRIC_PRESETS).grade,'B')
const intermediate=copy(records[0]);delete intermediate.measurements.tensile
assert.equal(calibrateFabricEvidence(intermediate,FABRIC_PRESETS).grade,'C')
assert.equal(calibrateFabricEvidence(low,FABRIC_PRESETS).physical.arealMassKgM2.value,.245)
assert.throws(()=>ingestFabricEvidence([records[0],records[0]],FABRIC_PRESETS),/Duplicate/)
console.log(`Fabric evidence validation PASS: ${calibrated.length} catalog specimens, unit conversions, A–D grades, provenance, rejected invalid evidence and JSON roundtrip`)
