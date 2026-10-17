import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildMarker} from '../src/core/marker.js'

function close(a,b,path){
  if(typeof b==='number'){
    assert.ok(typeof a==='number'&&Number.isFinite(a)&&
      Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b)),
      `${path}: ${a} vs ${b}`)
    return
  }
  if(Array.isArray(b)){
    assert.ok(Array.isArray(a),path+' expected array')
    assert.equal(a.length,b.length,path+' array length')
    b.forEach((v,i)=>close(a[i],v,path+'['+i+']'))
    return
  }
  if(b&&typeof b==='object'){
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path+' keys')
    for(const key of Object.keys(b))close(a[key],b[key],path+'.'+key)
    return
  }
  assert.strictEqual(a,b,path)
}

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const requests=[]
for(const kind of ['tee','pants'])for(const width of [150,75,30]){
  const document=createTemplateProject(kind)
  const args={fabricWidth:width,gap:1.5,options:{fabricId:'main'}}
  requests.push({document,args,kind,width})
}
const input=requests.map(({document,args})=>JSON.stringify({
  protocol:'garment-studio.native-cad.v1',document,op:'marker-build-exact',args,
})).join('\n')+'\n'
const run=spawnSync(binary,[],{input,encoding:'utf8',maxBuffer:64*1024*1024})
if(run.error)throw run.error
assert.equal(run.status,0,run.stderr)
const answers=run.stdout.trim().split('\n').map(JSON.parse)
assert.equal(answers.length,requests.length)
for(let i=0;i<requests.length;i++){
  const {document,args,kind,width}=requests[i]
  const before=JSON.stringify(document)
  const expected=buildMarker(document,args.fabricWidth,args.gap,args.options)
  assert.equal(answers[i].ok,true,answers[i].error||'native marker failed')
  assert.equal(answers[i].factoryCertified,false)
  close(answers[i].marker,expected,`${kind} ${width}cm`)
  assert.equal(JSON.stringify(document),before)
}
console.log(`Native exact marker CLI parity passed: ${requests.length} tee/pants, width and fabric fixtures; factoryCertified=false`)
