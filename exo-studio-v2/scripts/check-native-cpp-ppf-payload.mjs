import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {ppfSolverFabricPreset,ppfTemporaryShoulderSupports,buildPpfPayload,buildDressedPpfPayload,buildExplodedPpfPayload,validatePpfPayload,ppfPayloadSummary} from '../src/core/backends/ppfPayload.js'

const bin=process.env.GARMENT_PPF_PAYLOAD_TEST||'/tmp/garment-ppf-payload-test'
const cases=[]
for(const fabric of [{},{id:'washed-denim'},{name:'silk organza'},{id:'fleece-terry'},{name:'jeans'}])cases.push({op:'preset',fabric})
for(const frames of [3,15,60,120])cases.push({op:'supports',pieces:[],frames})
const shoulderPieces=['front','back'].map((id,offset)=>({id,flatVerticesM:[[-.21,1],[-.2,.98],[.21,1],[.2,.98]],particleIndices:[offset*4,offset*4+1,offset*4+2,offset*4+3]}))
cases.push({op:'supports',pieces:shoulderPieces,frames:60})
cases.push({op:'supports',pieces:shoulderPieces,enabled:false})
for(const template of ['tee','pants']){
 const project=createTemplateProject(template),native=buildNativeSimulationPayload(project)
 for(const options of [{},{staging:false,frameCount:35,stepSize:.002},{objectName:'custom-shell',frameRate:24}]){
  cases.push({op:'build',project,native,options})
  cases.push({op:'exploded',project,native,options})
 }
 const result={backendId:'native-pbd-xpbd',frames:40,pieces:native.pieces.map(piece=>({id:piece.id,vertices:piece.particleIndices.map(index=>native.particles[index].position),faces:piece.faces}))}
 cases.push({op:'dressed',project,native,result})
 const dressed=buildDressedPpfPayload(project,native,result)
 cases.push({op:'validate',payload:dressed})
 cases.push({op:'summary',payload:dressed})
}
const invalid={protocol:'wrong',shell:{vertices:[[0,0,0],[1,0,0],[0,1,0]],faces:[[0,0,2]],stitchEdges:[{a:0,b:1,seamId:'abc'},{a:1,b:0,seamId:'abc'}]},avatar:{mode:'local-thomas-body-mesh'},scene:{}}
cases.push({op:'validate',payload:invalid})
cases.push({op:'summary',payload:invalid})
cases.push({op:'dressed',project:{},native:{},result:{}})

function expected(c){try{
 let result
 switch(c.op){
  case 'preset':result=ppfSolverFabricPreset(c.fabric);break
  case 'supports':result=ppfTemporaryShoulderSupports(c.pieces,c.enabled,c.frames);break
  case 'build':result=buildPpfPayload(c.project,c.options);break
  case 'exploded':result=buildExplodedPpfPayload(c.project,c.options);break
  case 'dressed':result=buildDressedPpfPayload(c.project,c.native,c.result,c.options);break
  case 'validate':result=validatePpfPayload(c.payload);break
  case 'summary':result=ppfPayloadSummary(c.payload);break
 }
 return {ok:true,result}
}catch(e){return {ok:false,error:e.message}}}
const run=spawnSync(bin,['--json-lines'],{input:cases.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024})
if(run.error)throw run.error
assert.equal(run.status,0,run.stderr)
const output=run.stdout.trim().split('\n')
assert.equal(output.length,cases.length)
let passed=0
for(let i=0;i<cases.length;i++){
 const actual=JSON.parse(output[i]),want=expected(cases[i])
 try{assert.deepEqual(actual,want)}catch(e){
  console.error('Mismatch case',i,cases[i].op,'template',cases[i].project?.templateId)
  if(actual.ok&&want.ok){for(const key of Object.keys(want.result??{})){if(JSON.stringify(actual.result[key])!==JSON.stringify(want.result[key]))console.error('key',key,'actual',JSON.stringify(actual.result[key]).slice(0,500),'expected',JSON.stringify(want.result[key]).slice(0,500))}}
  throw e
 }
 passed++
}
console.log('PPF C++ parity passed:',passed,'JS fixtures across tee, pants, staged, exploded, dressed, validators, presets and supports')
