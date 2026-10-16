import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildPpfPayload,buildExplodedPpfPayload} from '../src/core/backends/ppfPayload.js'

// End-to-end direct native authored-pattern -> C++ XPBD snapshot -> C++ PPF
// payload, without a JS-generated nativePayload passthrough.
const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
function compare(actual,expected,path='root'){
  if(typeof expected==='number'){
    assert.equal(typeof actual,'number',path)
    assert.ok(Number.isFinite(actual)&&Number.isFinite(expected) &&
      Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),
      `${path}: native ${actual} vs JS ${expected}`)
    return
  }
  if(Array.isArray(expected)){
    assert.ok(Array.isArray(actual),path+' expected array')
    assert.equal(actual.length,expected.length,path+' length')
    for(let i=0;i<expected.length;i++)compare(actual[i],expected[i],path+'['+i+']')
    return
  }
  if(expected&&typeof expected==='object'){
    assert.ok(actual&&typeof actual==='object'&&!Array.isArray(actual),path)
    assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),path+' field names')
    for(const key of Object.keys(expected))compare(actual[key],expected[key],path+'.'+key)
    return
  }
  assert.strictEqual(actual,expected,path)
}
const optionsCases=[{}, {staging:false,frameCount:35,stepSize:.002},
  {objectName:'custom-shell',frameRate:24}]
let verified=0
for(const garmentType of ['tee','pants']){
  const project=createTemplateProject(garmentType)
  const original=JSON.stringify(project)
  for(const options of optionsCases){
    for(const [op,builder] of [
      ['ppf-build-payload',buildPpfPayload],
      ['ppf-build-exploded-payload',buildExplodedPpfPayload]
    ]){
      const expected=builder(project,options)
      const request={protocol:'garment-studio.native-cad.v1',
        document:project,op,args:{options}}
      const result=spawnSync(binary,[],{input:JSON.stringify(request)+'\n',
        encoding:'utf8',maxBuffer:128*1024*1024})
      if(result.error)throw result.error
      assert.equal(result.status,0,result.stderr)
      const response=JSON.parse(result.stdout.trim())
      assert.equal(response.ok,true,response.error)
      assert.equal(response.fitCertified,false)
      compare(response.payload,expected,garmentType+'.'+op)
      assert.equal(response.payload.shell.faces.length,expected.shell.faces.length)
      verified++
    }
  }
  assert.equal(JSON.stringify(project),original,'authored garment project mutated')
}
console.log(`C++ direct authored-garment PPF payload parity: ${verified}/${verified} JS tee/pants staged and exploded fixtures, no precompiled JS nativePayload, fitCertified=false`)
