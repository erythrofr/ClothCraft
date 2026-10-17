import assert from 'node:assert/strict'
import { mkdtempSync,writeFileSync,readFileSync,rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {inspectNativeAssemblyPose} from '../src/core/backends/nativeAssemblyPreflight.js'
import {assembleNativeSeams} from '../src/core/backends/seamAssembly.js'
import {assessNativeSolverResult} from '../src/core/backends/nativeServiceBackend.js'

const reports=[]
const scratch=mkdtempSync(path.join(tmpdir(),'gs-sew-first-'))
try {
  for(const garment of ['tee','hoodie','zip-hoodie']) {
    const project=createTemplateProject(garment)
    const savedSnapshot=JSON.stringify(project)
    const original=buildNativeSimulationPayload(project,{quality:'quality'})
    const assembled=buildNativeSimulationPayload(project,{quality:'quality',experimentalSewFirst:true})
    const assembledAgain=buildNativeSimulationPayload(project,{quality:'quality',experimentalSewFirst:true})
    assert.deepEqual(assembled.particles.map(p=>p.position),assembledAgain.particles.map(p=>p.position),'Preassembly must be deterministic')
    assert.equal(JSON.stringify(project),savedSnapshot,'Never mutate original garment pattern')
    assert.deepEqual(assembled.pieces,original.pieces,'Original cut mesh and pattern topology must remain identical')
    assert.deepEqual(assembled.constraints,original.constraints,'Sewing topology and rest lengths cannot be rewritten')
    assert.deepEqual(assembled.anchors,original.anchors,'Manual pins and fitting targets cannot be rewritten')
    assert.deepEqual(assembled.initialAssembly,inspectNativeAssemblyPose(assembled))
    assert.equal(assembled.assemblyExperiment.collisionCertified,false)
    assert.equal(assembled.assemblyExperiment.safeToAutoApply,false)
    assert.ok(assembled.assemblyExperiment.collision.checked>0)
    assert.ok(assembled.initialAssembly.initialSeamGapMaximumMm < original.initialAssembly.initialSeamGapMaximumMm*.15,
      `${garment}: Sew-first should dramatically close initial sewn boundaries`)
    assert.ok(assembled.initialAssembly.initialMeshPeakEdgeStrainPercent < original.initialAssembly.initialMeshPeakEdgeStrainPercent,
      `${garment}: Sew-first should improve initial rest-edge strain`)
    assert.ok(assembled.particles.every(p=>p.position.every(Number.isFinite)))
    reports.push({garment,initialMaxGapMm:original.initialAssembly.initialSeamGapMaximumMm,assembledMaxGapMm:assembled.initialAssembly.initialSeamGapMaximumMm,
      initialPeakStrain:original.initialAssembly.initialMeshPeakEdgeStrainPercent,assembledPeakStrain:assembled.initialAssembly.initialMeshPeakEdgeStrainPercent,
      sampledBodyIntrusionMm:assembled.assemblyExperiment.collision.maximumIntrusionMm,collisionCertified:false})

    if(garment==='tee') {
      const frozen=structuredClone(original)
      frozen.particles[0].invMass=0
      const position=frozen.particles[0].position.slice()
      const staged=assembleNativeSeams(frozen,{iterations:300,seamStiffness:.7})
      assert.deepEqual(staged.particles[0].position,position,'Frozen/pinned particles must not move')
      assert.deepEqual(frozen.particles[0].position,position,'A preassembly candidate cannot modify input particle state')

      const input=path.join(scratch,'tee.json'),output=path.join(scratch,'tee-result.json')
      writeFileSync(input,JSON.stringify(assembled))
      execFileSync('native_backend/bin/garment_xpbd_cli',[input,output,'60'],{timeout:30000,stdio:['ignore','pipe','pipe']})
      const result=JSON.parse(readFileSync(output,'utf8'))
      assert.equal(result.stats.finite,true,'Candidate must not produce nonfinite coordinates')
      assert.equal(result.fitTrajectory.frames.length,60)
      const assessment=assessNativeSolverResult(result)
      assert.equal(assessment.status,'FAILED','Do not call the initial assembly a valid physical drape')
      assert.equal(assessment.factoryApproved,false)
      reports[reports.length-1].nativeTrajectoryPeakStrainPercent=+result.fitTrajectory.peakFullMeshEdgeStrainPercent.toFixed(1)
      reports[reports.length-1].nativeTrajectoryMaximumSeamMm=+result.fitTrajectory.peakSewnGapMm.toFixed(1)
      reports[reports.length-1].nativeFit=assessment.status
    }
  }
  console.log(JSON.stringify({pass:true,experimental:true,defaultUnchanged:true,patternsImmutable:true,allPatternsValidated:true,qualityGatePreventsAutoAcceptance:true,reports},null,2))
} finally {rmSync(scratch,{force:true,recursive:true})}
