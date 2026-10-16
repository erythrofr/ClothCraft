import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createTemplateProject} from '../src/data/templates.js'
import {SIMULATION_PROTOCOL,SIMULATION_PROTOCOL_VERSION,buildSimulationRequest,validateSimulationRequest,serializeSimulationRequest,backendResultSummary} from '../src/core/backends/protocol.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-sim-protocol-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/simulation_protocol.cpp','native_cpp/tests/test_simulation_protocol.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
function native(op,payload){const process=spawnSync(binary,[],{input:JSON.stringify({op,...payload})+'\n',encoding:'utf8'});assert.equal(process.status,0,process.stderr);return JSON.parse(process.stdout)}
function compare(a,b,label){if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(a),Math.abs(b)),label+': '+a+' != '+b);return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),label+' keys');for(const k of Object.keys(a))compare(a[k],b[k],label+'.'+k);return}assert.deepEqual(b,a,label)}
const project=createTemplateProject('blank'),requestId='sim-parity-fixed-2026'
let count=0
assert.equal(SIMULATION_PROTOCOL,'garment-studio.simulation');assert.equal(SIMULATION_PROTOCOL_VERSION,1)
const variants=[
 project,
 {...project,pieces:[...project.pieces,{id:'curve',points:[{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}],curves:{0:{cx:4,cy:-3}},pins:[{x:1,y:2}],layerIndex:2.6,cutQuantity:0,simulationResolution:8}],fabrics:{main:{gsm:220,thickness:.005,stretchWarp:-1,friction:.6}},seams:[{id:'join',a:{pieceId:project.pieces[0].id,edgeIndex:0},b:{pieceId:'curve',edgeIndex:0},ratio:1.2}],avatar:{height:180}},
 {...project,pieces:[{id:'metadata',points:[{x:0,y:0},{x:4,y:0},{x:0,y:5}],internalLines:[{name:'line'}],gradeRule:{x:1},fusedToPieceId:'other',surfaceAttachments:[{id:5}]}],revision:'invalid',fabrics:{main:{gsm:'invalid',thickness:-1,bend:null}}},
 {...project,pieces:[],seams:[]}
]
for(const p of variants){
 const expected=buildSimulationRequest(p,{requestId}),actual=native('build',{project:p,options:{requestId}})
 assert.equal(actual.ok,true);compare(expected,actual.result,'build '+count);count++
 for(const req of [expected,{...expected,protocol:'bad',version:4},{...expected,pieces:[...expected.pieces,...expected.pieces]},{...expected,seams:[{id:'missing',a:{pieceId:'unknown'},b:{pieceId:'missing'}}]}]){
  const js=validateSimulationRequest(req),cpp=native('validate',{request:req});compare(js,cpp.result,'validate');count++
  let serial;try{serial={ok:true,result:serializeSimulationRequest(req)}}catch(e){serial={ok:false,error:e.message}}
  const cppSerial=native('serialize',{request:req});if(serial.ok){assert.equal(cppSerial.ok,true);compare(JSON.parse(serial.result),JSON.parse(cppSerial.result),'serialize parsed')}else compare(serial,cppSerial,'serialize rejection');count++
 }
}
for(const result of [{},{backendId:'native',protocolVersion:2,pieces:[{},{}],frame:13,stats:{fps:60}},{backendId:'cpu',protocolVersion:'3',pieces:{a:1},frame:'5',stats:{collision:4}}]){
 compare(backendResultSummary(result),native('summary',{result}).result,'summary');count++
}
assert.equal(count,39)
console.log('Simulation protocol native/JS parity passed: '+count+' cases')
