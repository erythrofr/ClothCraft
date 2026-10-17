import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {createFabricBallGeometry,fabricBallGeometryDiagnostics} from '../src/core/fabricBallGeometry.js'
import {fabricSwatchRepeatDimensions,fabricSwatchMapRepeats,fabricProceduralSwatchRepeats} from '../src/core/fabricPbrAppearance.js'
import {validateFabricEvidence,calibrateFabricEvidence} from '../src/core/fabricEvidenceCalibration.js'

// Deterministic synthetic workloads. No GPU, native simulation, or specimen data.
const families=[['denim',420,1.45],['poplin',120,.8],['jersey',190,.45],['satin',85,.18],['fleece',320,.95],['sheer',65,.15]]
const cases=[null,undefined,'',-10,0,NaN,Infinity,-Infinity,'oops','12.5',.00001,1e9]
let dimensionChecks=0,geometryChecks=0,provenanceChecks=0
for(const candidate of cases){
 const texture={repeatWidthCm:candidate,repeatHeightCm:candidate}
 const dimensions=fabricSwatchRepeatDimensions(texture)
 const repeats=fabricSwatchMapRepeats(texture)
 assert.ok(Object.values(dimensions).every(v=>Number.isFinite(v)&&v>=.5))
 assert.ok(repeats.every(v=>Number.isFinite(v)&&v>0))
 if(candidate===null||candidate===undefined||candidate===''||typeof candidate==='number'&&(!Number.isFinite(candidate)||candidate<=0)||candidate==='oops')assert.equal(dimensions.repeatWidthCm,20)
 dimensionChecks++
}
assert.deepEqual(fabricSwatchMapRepeats({repeatWidthCm:0,repeatHeightCm:-1}),[13.5,13.5])
for(const candidate of [0,-5,NaN,Infinity,'bad',undefined])assert.ok(fabricProceduralSwatchRepeats(candidate).every(n=>n===90))

const syntheticEvidence={schemaVersion:1,fabricId:'synthetic',provenance:{sampleId:'NOT-A-REAL-SAMPLE',evidenceUri:'https://example.org/placeholder',sourceReference:'synthetic QA only'},measurements:{arealMass:{value:250,unit:'g/m²'}}}
const derived=calibrateFabricEvidence(syntheticEvidence,{synthetic:{gsm:180}})
assert.equal(derived.physical.arealMassKgM2.status,'measured')
assert.equal(derived.physical.arealMassKgM2.sampleId,'NOT-A-REAL-SAMPLE')
assert.equal(derived.provenance.evidenceUri,syntheticEvidence.provenance.evidenceUri)
assert.equal(derived.solverSuggestions.density.status,'measured')
assert.ok(derived.flags.some(s=>s.includes('No graphical/PBR')))
provenanceChecks+=5
for(const [mutation] of [[{provenance:{...syntheticEvidence.provenance,evidenceUri:'javascript:alert(1)'}}],[{provenance:{...syntheticEvidence.provenance,sampleId:''}}],[{measurements:{arealMass:{value:NaN,unit:'g/m²'}}}],[{measurements:{arealMass:{value:-1,unit:'g/m²'}}}],[{measurements:{}}]]){
 assert.throws(()=>validateFabricEvidence({...syntheticEvidence,...mutation},{synthetic:{}}))
 provenanceChecks++
}
const iterations=42,started=performance.now(),ratios=[],warnings=[],perFamily={}
for(let iteration=0;iteration<iterations;iteration++)for(const [name,baseGsm,baseBend] of families){
 const gsm=iteration%7===0?1e12:iteration%7===1?-1e10:iteration%7===2?0:baseGsm*(.6+(iteration%6)*.16)
 const bend=iteration%9===0?1e12:iteration%9===1?-1e10:iteration%9===2?0:baseBend
 const fabric={name,gsm,bend,provenance:'procedural'}
 const mesh=createFabricBallGeometry(fabric,{segments:16,rings:16})
 try{
  const pos=mesh.getAttribute('position'),uv=mesh.getAttribute('uv'),index=mesh.getIndex()
  assert.equal(pos.count,289);assert.equal(uv.count,289);assert.equal(index.count,1536)
  assert.equal(mesh.userData.measuredMaterial,false)
  assert.equal(mesh.userData.visualModel,'square-cloth-draped-over-sphere')
  assert.equal(fabric.provenance,'procedural')
  for(let i=0;i<pos.count;i++){
   assert.ok([pos.getX(i),pos.getY(i),pos.getZ(i),uv.getX(i),uv.getY(i)].every(Number.isFinite),`${name}/${iteration} nonfinite geometry`)
   assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1)
  }
  const diagnostic=fabricBallGeometryDiagnostics(mesh)
  assert.equal(diagnostic.triangles,512)
  assert.equal(diagnostic.invalidTriangles,0)
  assert.equal(diagnostic.illustrativeOnly,true)
  assert.ok([diagnostic.minAreaRatio,diagnostic.maxAreaRatio,diagnostic.totalAreaRatio].every(v=>Number.isFinite(v)&&v>0))
  ratios.push(diagnostic.totalAreaRatio)
  perFamily[name]=(perFamily[name]||0)+1
  if(diagnostic.minAreaRatio<.95||diagnostic.maxAreaRatio>1.05)warnings.push({family:name,iteration,min:Number(diagnostic.minAreaRatio.toFixed(3)),max:Number(diagnostic.maxAreaRatio.toFixed(3))})
  geometryChecks++
 }finally{mesh.dispose()}
}
assert.equal(geometryChecks,iterations*families.length)
const elapsedMs=performance.now()-started
const result={pass:true,deterministic:true,mode:'CPU-only analytic display mesh',seed:'fixed iteration sequence',iterations,fixtureFamilies:families.map(f=>f[0]),meshes:geometryChecks,dimensionChecks,provenanceChecks,elapsedMs:Number(elapsedMs.toFixed(2)),meanMsPerMesh:Number((elapsedMs/geometryChecks).toFixed(3)),totalAreaRatioRange:[Number(Math.min(...ratios).toFixed(4)),Number(Math.max(...ratios).toFixed(4))],nonConservingMeshCount:new Set(warnings.map(w=>`${w.family}/${w.iteration}`)).size,examples:warnings.slice(0,6),perFamily,limitations:['geometry shape is illustrative, not a physical solve','performance includes assertions and JS allocations; no GPU measurements','synthetic evidence URI is a schema fixture, not an actual lab record']}
assert.ok(result.nonConservingMeshCount>0,'expected illustrative area-distortion warning absent')
console.log(JSON.stringify(result,null,2))
