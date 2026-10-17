import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createTemplateProject } from '../src/data/templates.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'
import { inspectNativeAssemblyPose } from '../src/core/backends/nativeAssemblyPreflight.js'

const binary = path.resolve('native_backend/bin/garment_xpbd_cli')
if (!existsSync(binary)) throw new Error('Run native_backend/scripts/build_garment_xpbd_cli.sh first')

const reports = []
for (const kind of ['tee', 'hoodie', 'zip-hoodie']) {
  const payload = buildNativeSimulationPayload(createTemplateProject(kind), { quality: 'quality' })
  assert.deepEqual(payload.initialAssembly, inspectNativeAssemblyPose(payload), 'Preflight must be deterministic')
  assert.equal(payload.initialAssembly.status, 'STAGING_REQUIRES_REPAIR')
  assert.equal(payload.initialAssembly.simulationFitApproved, false)
  assert.ok(payload.initialAssembly.initialSeamGapMaximumMm > 100)
  assert.ok(payload.initialAssembly.initialMeshPeakEdgeStrainPercent > 50)
  assert.ok(payload.initialAssembly.worstSewingGroups.length > 0)
  reports.push({kind, initialSeamGapMaximumMm:payload.initialAssembly.initialSeamGapMaximumMm,initialMeshPeakEdgeStrainPercent:payload.initialAssembly.initialMeshPeakEdgeStrainPercent,worstSeam:payload.initialAssembly.worstSewingGroups[0].seamId})
}

const target=buildNativeSimulationPayload(createTemplateProject('tee'),{quality:'quality'})
const corrupted=structuredClone(target)
corrupted.particles[0].position[2]=NaN
assert.throws(()=>inspectNativeAssemblyPose(corrupted),RangeError)

const workspace=mkdtempSync(path.join(tmpdir(),'gs-first-frame-'))
try {
  const run = (name,settings={},removeSeams=false) => {
    const payload=structuredClone(target)
    Object.assign(payload.settings,{captureStartupStages:true,...settings})
    if(removeSeams)payload.constraints=payload.constraints.filter(constraint=>constraint.type!=='seam')
    const input=path.join(workspace,`${name}.json`),output=path.join(workspace,`${name}.result.json`)
    writeFileSync(input,JSON.stringify(payload))
    execFileSync(binary,[input,output,'1'],{timeout:12000,stdio:['ignore','pipe','pipe']})
    return JSON.parse(readFileSync(output,'utf8'))
  }
  const baseline=run('baseline')
  const noBody=run('no-body',{particleBodyContact:false})
  const noSeams=run('no-seams',{},true)
  const trace=baseline.startupStageTrace
  assert.ok(trace.length>=9)
  const stage=(name,rows=trace)=>rows.find(item=>item.stage===name)
  assert.ok(stage('distance-constraints').maxEdgeStrainPercent>stage('initial').maxEdgeStrainPercent*2,
    'Initial sewing force must be separately measurable from the starting pose')
  assert.ok(stage('particle-avatar-contact').maxEdgeStrainPercent>stage('self-collision').maxEdgeStrainPercent*1.1,
    'Body projection first-frame shock must be directly measurable')
  assert.ok(stage('seam-recovery').maxSeamGapMm<stage('particle-avatar-contact').maxSeamGapMm,
    'Seam recovery should close some pair gaps instead of silently doing nothing')
  assert.ok(baseline.fitTrajectory.peakFullMeshEdgeStrainPercent>noBody.fitTrajectory.peakFullMeshEdgeStrainPercent*2,
    'The failure should be distinguishable from a contact-free reference')
  assert.ok(stage('distance-constraints',noSeams.startupStageTrace).maxEdgeStrainPercent < stage('distance-constraints').maxEdgeStrainPercent,
    'No-sewing ablation must reduce the immediate distance-constraint shock')
  console.log(JSON.stringify({pass:true,checkedGarments:reports,baselineFirstFramePeakStrainPercent:baseline.fitTrajectory.peakFullMeshEdgeStrainPercent,contactDisabledPeakStrainPercent:noBody.fitTrajectory.peakFullMeshEdgeStrainPercent,firstIterationTrace:trace.map(item=>({stage:item.stage,peakStrainPercent:+item.maxEdgeStrainPercent.toFixed(1),seamGapMm:+item.maxSeamGapMm.toFixed(1)})),fitCertified:false},null,2))
} finally {rmSync(workspace,{recursive:true,force:true})}
