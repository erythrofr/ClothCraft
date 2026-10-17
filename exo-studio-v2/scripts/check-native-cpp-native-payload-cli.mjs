import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
function numericalParity(actual,expected,path='root'){
  if(typeof actual==='number'&&typeof expected==='number'){
    assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&
      Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),
      `${path}: C++ ${actual}, JS ${expected}`)
    return
  }
  if(Array.isArray(expected)){
    assert.ok(Array.isArray(actual),path+' expected array')
    assert.equal(actual.length,expected.length,path+' array length')
    for(let i=0;i<expected.length;i++)numericalParity(actual[i],expected[i],path+'['+i+']')
    return
  }
  if(expected&&typeof expected==='object'){
    assert.ok(actual&&typeof actual==='object'&&!Array.isArray(actual),path+' expected object')
    assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),path+' fields')
    for(const key of Object.keys(expected))numericalParity(actual[key],expected[key],path+'.'+key)
    return
  }
  assert.strictEqual(actual,expected,path)
}
for(const name of ['tee','pants','tee-virtual']){
  const project=createTemplateProject(name==='tee-virtual'?'tee':name)
  if(name==='tee-virtual')project.seams[0].useExactCorrespondence=true
  const before=JSON.stringify(project)
  const expected=buildNativeSimulationPayload(project)
  const request={protocol:'garment-studio.native-cad.v1',
    document:project,op:'native-build-solver-payload',args:{}}
  const proc=spawnSync(binary,[],{input:JSON.stringify(request)+'\n',
    encoding:'utf8',maxBuffer:96*1024*1024})
  if(proc.error)throw proc.error
  assert.equal(proc.status,0,proc.stderr)
  const response=JSON.parse(proc.stdout.trim())
  assert.equal(response.ok,true,response.error||'native solver builder error')
  assert.equal(response.fitCertified,false)
  const actual=response.payload
  assert.equal(actual.fullPayloadParity,false,'general solver parity must not be asserted')
  assert.ok(actual.parityUnsupported.length>0)
  for(const key of ['project','avatar','settings','particles','constraints',
    'virtualSeams','anchors','collisionExclusions','initialAssembly']) {
    numericalParity(actual[key],expected[key],name+'.'+key)
  }
  assert.equal(actual.pieces.length,expected.pieces.length)
  let otherPieceMismatch=0
  for(let i=0;i<actual.pieces.length;i++){
    const received=structuredClone(actual.pieces[i])
    const want=structuredClone(expected.pieces[i])
    const nativeWorst=received.meshQuality?.worst
    const jsWorst=want.meshQuality?.worst
    delete received.meshQuality?.worst
    delete want.meshQuality?.worst
    numericalParity(received,want,`piece ${i} outside worst triangles ${name}`)
    if(JSON.stringify(nativeWorst)!==JSON.stringify(jsWorst))otherPieceMismatch++
  }
  assert.equal(JSON.stringify(project),before,'authored project mutated')
  console.log(JSON.stringify({name,
    particles:actual.particles.length,
    constraints:actual.constraints.length,
    exclusions:actual.collisionExclusions.length,
    pieceWorstRankDiscrepancies:otherPieceMismatch,
    noFitCertification:true}))
}
