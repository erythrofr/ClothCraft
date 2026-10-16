import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
const results=[]
for (const heightCm of [180,200]) {
  const project=createTeeTemplate()
  project.avatar.heightCm=heightCm
  const simulation=buildSimulation(project)
  for (let i=0;i<120;i++) stepSimulation(simulation,project,1/60)
  const seamGap=simulation.seamConstraints.reduce((sum,c)=>sum+c.a.position.distanceTo(c.b.position),0)/simulation.seamConstraints.length
  const result={heightCm,peakStrain:simulation.strain.max,averageStrain:simulation.strain.average,meanSeamGapCm:seamGap*100}
  results.push(result)
  assert.ok(Number.isFinite(result.peakStrain)&&Number.isFinite(result.meanSeamGapCm),'finite cloth simulation')
  if (heightCm===200) {
    assert.ok(result.peakStrain<2,`200cm T-shirt has extreme local armhole strain ${result.peakStrain}`)
    assert.ok(result.averageStrain<.12,`200cm average textile strain ${result.averageStrain}`)
  }
}
console.log(JSON.stringify({pass:true,results},null,2))
