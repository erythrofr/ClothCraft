import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {inspectStagedAvatarContact} from '../src/core/backends/seamAssembly.js'

const executable=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
function native(project,payload) {
  const request={protocol:'garment-studio.native-cad.v1',
    document:project,op:'seam-inspect-avatar-contact',args:{payload}}
  const run=spawnSync(executable,[],{encoding:'utf8',
    input:JSON.stringify(request)+'\n',maxBuffer:64*1024*1024})
  if(run.error)throw run.error
  assert.equal(run.status,0,run.stderr)
  const result=JSON.parse(run.stdout.trim())
  assert.equal(result.ok,true,result.error)
  assert.equal(result.readOnly,true)
  assert.equal(result.sweptCollisionCertified,false)
  return result.inspection
}
const variants=[
  ['baseline',()=>{}],
  ['body-center',payload=>{for(const p of payload.particles) {
    p.position[0]*=.58;p.position[2]*=.32
  }}],
  ['sagging',payload=>{for(const p of payload.particles){
    p.position[1]=Math.max(.01,p.position[1]-.20)
  }}],
  ['leg-and-shoulder-contact',payload=>{for(const p of payload.particles){
    if(p.wrapMode?.includes('leg')||p.wrapMode==='front'){
      p.position[0]*=.84;p.position[2]*=.58
    }
  }}],
  ['reversed-front-back',payload=>{for(const p of payload.particles){
    if(p.wrapMode==='front'||p.wrapMode==='back')p.position[2]*=-1
  }}],
]
let count=0
for(const name of ['tee','pants']){
  const project=createTemplateProject(name)
  const originalProject=JSON.stringify(project)
  const base=buildNativeSimulationPayload(project)
  for(const [label,modify] of variants){
    const payload=structuredClone(base)
    modify(payload)
    const originalPayload=JSON.stringify(payload)
    const expected=inspectStagedAvatarContact(payload)
    const actual=native(project,payload)
    assert.deepEqual(actual,expected,
      `${name}/${label}: sampled collision report mismatch`)
    assert.equal(actual.sweptCollisionCertified,false)
    assert.equal(JSON.stringify(payload),originalPayload,'source payload changed')
    count++
  }
  assert.equal(JSON.stringify(project),originalProject,'source project changed')
}
console.log(`Native direct sampled-avatar-contact inspection: ${count} tee/pants and staged collision fixtures, exact JS diagnostic JSON parity, no CCD certification`)
