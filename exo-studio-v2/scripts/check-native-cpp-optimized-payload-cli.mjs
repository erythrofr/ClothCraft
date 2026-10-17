import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
function near(a,b,path){
  if(typeof b==='number'){
    assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),
      path+' numeric mismatch')
    return
  }
  if(Array.isArray(b)){
    assert.ok(Array.isArray(a),path+' must be array')
    assert.equal(a.length,b.length,path+' length mismatch')
    for(let i=0;i<b.length;i++)near(a[i],b[i],path+'['+i+']')
    return
  }
  if(b&&typeof b==='object'){
    assert.ok(a&&typeof a==='object',path+' must be object')
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path+' keys')
    for(const key of Object.keys(b))near(a[key],b[key],path+'.'+key)
    return
  }
  assert.deepEqual(a,b,path)
}
for(const template of ['tee','pants']){
  const project=createTemplateProject(template)
  const before=JSON.stringify(project)
  const options={experimentalOptimizeMesh:true}
  const expected=buildNativeSimulationPayload(project,options)
  const request={protocol:'garment-studio.native-cad.v1',document:project,
    op:'native-build-optimized-payload-experimental',args:{options}}
  const response=spawnSync(binary,[],{input:JSON.stringify(request)+'\n',
    encoding:'utf8',maxBuffer:96*1024*1024})
  if(response.error)throw response.error
  assert.equal(response.status,0,response.stderr)
  const native=JSON.parse(response.stdout.trim())
  assert.equal(native.ok,true,native.error)
  assert.equal(native.fitCertified,false)
  assert.equal(native.fullPayloadParity,false)
  assert.equal(native.researchOnly,true)
  assert.equal(native.payload.fullPayloadParity,false)
  for(const key of ['project','avatar','settings','particles','constraints',
    'virtualSeams','anchors','collisionExclusions','fusedPiecePairs','initialAssembly'])
    near(native.payload[key],expected[key],template+'.'+key)
  assert.equal(native.payload.pieces.length,expected.pieces.length)
  let qualityDifferences=0
  for(let i=0;i<expected.pieces.length;i++){
    const wanted=structuredClone(expected.pieces[i])
    const actual=structuredClone(native.payload.pieces[i])
    const nativeQuality=JSON.stringify(actual.meshQuality)
    const jsQuality=JSON.stringify(wanted.meshQuality)
    if(nativeQuality!==jsQuality)qualityDifferences++
    delete wanted.meshQuality
    delete actual.meshQuality
    near(actual,wanted,template+'.pieces['+i+']')
  }
  assert.equal(JSON.stringify(project),before,'authored project mutated')
  console.log(JSON.stringify({template,particles:expected.particles.length,
    constraints:expected.constraints.length,
    exclusions:expected.collisionExclusions.length,
    qualityDifferencePieces:qualityDifferences,
    topologyAndPhysicsParity:true,fullPayloadParity:false,fitCertified:false}))
}
