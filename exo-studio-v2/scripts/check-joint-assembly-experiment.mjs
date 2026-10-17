import assert from 'node:assert/strict'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {assembleNativeSeams} from '../src/core/backends/seamAssembly.js'

const rows=[]
for(const garment of ['tee','hoodie','zip-hoodie']){
  const project=createTemplateProject(garment)
  const projectSnapshot=JSON.stringify(project)
  const payload=buildNativeSimulationPayload(project,{quality:'quality'})
  const original=JSON.stringify(payload)
  const baseline=assembleNativeSeams(payload,{iterations:300,seamStiffness:.7})
  for(const weight of [.1,.3,1]){
    const options={iterations:300,seamStiffness:.7,jointConstraintMode:true,jointContactWeight:weight}
    const candidate=assembleNativeSeams(payload,options)
    const again=assembleNativeSeams(payload,options)
    assert.deepEqual(candidate.particles.map(p=>p.position),again.particles.map(p=>p.position),'Joint research solver must be deterministic')
    assert.equal(JSON.stringify(project),projectSnapshot,'Project pattern must not mutate')
    assert.equal(JSON.stringify(payload),original,'Input solver payload must not mutate')
    assert.deepEqual(candidate.constraints,payload.constraints,'No sewing/rest constraints can be rewritten')
    assert.deepEqual(candidate.pieces,payload.pieces,'No pattern cut geometry can be rewritten')
    assert.equal(candidate.assemblyExperiment.safeToAutoApply,false)
    assert.equal(candidate.assemblyExperiment.collisionCertified,false)
    assert.ok(candidate.particles.every(p=>p.position.every(Number.isFinite)))
    rows.push({garment,weight,seamGapMm:candidate.initialAssembly.initialSeamGapMaximumMm,peakEdgeStrainPercent:candidate.initialAssembly.initialMeshPeakEdgeStrainPercent,
      maximumIntrusionMm:candidate.assemblyExperiment.collision.maximumIntrusionMm,
      baselineSeamGapMm:baseline.initialAssembly.initialSeamGapMaximumMm,
      baselinePeakStrainPercent:baseline.initialAssembly.initialMeshPeakEdgeStrainPercent,
      baselineIntrusionMm:baseline.assemblyExperiment.collision.maximumIntrusionMm})
  }
}
assert.ok(rows.every(r=>r.maximumIntrusionMm>30),'Research candidates must not be misrepresented as collision-safe')
console.log(JSON.stringify({pass:true,simulationFitApproved:false,defaultUnchanged:true,patternsImmutable:true,candidates:rows},null,2))
