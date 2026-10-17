import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {assembleNativeSeams,inspectStagedAvatarContact} from '../src/core/backends/seamAssembly.js'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
function cli(document,op,args){
  const input={protocol:'garment-studio.native-cad.v1',document,op,args}
  const run=spawnSync(binary,[],{input:JSON.stringify(input)+'\n',
    encoding:'utf8',maxBuffer:96*1024*1024})
  if(run.error)throw run.error
  assert.equal(run.status,0,run.stderr)
  return JSON.parse(run.stdout.trim())
}
for(const type of ['tee','pants']){
  const document=createTemplateProject(type)
  const payload=buildNativeSimulationPayload(document)
  const pristine=JSON.stringify(document)
  const before=JSON.stringify(payload)
  const inspection=cli(document,'seam-inspect-avatar-contact',{payload})
  assert.equal(inspection.ok,true,inspection.error)
  assert.equal(inspection.sweptCollisionCertified,false)
  const expected=inspectStagedAvatarContact(payload)
  assert.deepEqual(inspection.inspection,expected)

  const options={iterations:6,seamStiffness:.3,restStiffness:.7,
    positionStiffness:.002,maxMoveM:.012,seamPasses:2}
  const js=assembleNativeSeams(payload,options)
  const cpp=cli(document,'seam-assemble-conventional',{payload,options})
  assert.equal(cpp.ok,true,cpp.error)
  assert.equal(cpp.fullExportParity,false)
  assert.equal(cpp.fitCertified,false)
  assert.deepEqual(cpp.assembled.initialAssembly,js.initialAssembly)
  assert.deepEqual(cpp.assembled.assemblyExperiment.collision,js.assemblyExperiment.collision)
  assert.equal(cpp.assembled.particles.length,js.particles.length)
  let errorSquared=0,maxDifference=0
  for(let i=0;i<js.particles.length;i++){
    const a=js.particles[i].position,b=cpp.assembled.particles[i].position
    const error=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
    errorSquared+=error*error
    maxDifference=Math.max(maxDifference,error)
  }
  const rms=Math.sqrt(errorSquared/js.particles.length)
  assert.ok(rms<1e-10,`native assembled sewing drift: ${rms}`)
  for(const advanced of [{contactConstrained:true},{jointConstraintMode:true},
    {contactConstrained:true,jointConstraintMode:true}]){
    const want=assembleNativeSeams(payload,{...options,...advanced})
    const returned=cli(document,'seam-assemble-conventional',
      {payload,options:{...options,...advanced}})
    assert.equal(returned.ok,true,returned.error)
    assert.deepEqual(returned.assembled.initialAssembly,want.initialAssembly)
    assert.deepEqual(returned.assembled.assemblyExperiment,want.assemblyExperiment)
    for(let i=0;i<want.particles.length;i++)
      for(let k=0;k<3;k++)
        assert.ok(Math.abs(returned.assembled.particles[i].position[k]-
          want.particles[i].position[k])<=1e-7,
          type+' advanced position mismatch')
  }
  assert.equal(JSON.stringify(document),pristine)
  assert.equal(JSON.stringify(payload),before)
  console.log(JSON.stringify({garment:type,particleCount:js.particles.length,
    rmsPositionErrorMeters:rms,maxPositionErrorMeters:maxDifference,
    inspectionParity:true,advancedContactParity:true,fitCertified:false}))
}
