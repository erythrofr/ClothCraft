import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {NATIVE_QUALITY_PROFILES,resolveNativeQuality,buildNativeSimulationPayload,nativePayloadSummary} from '../src/core/backends/nativePayload.js'
import {createTemplateProject} from '../src/data/templates.js'
const cases=[{op:'profiles'}]
for(const options of [{},{quality:'draft'},{quality:'balanced'},{quality:'quality'},{quality:'invalid'},
 {clothModel:'strain-triangle',bendingModel:'isometric-xpbd'},{clothModel:'strain-triangle',bendingModel:'distance'},
 {clothModel:'strain-triangle',bendingModel:'distance',allowUnsafeCombination:true},
 {bendingModel:'isometric-xpbd'},{clothModel:'distance',bendingModel:'isometric-xpbd'},
 {quality:'quality',clothModel:'distance'}, {quality:'balanced',bendingModel:'distance'}])
 cases.push({op:'quality',options})
for(const payload of [{},{project:{name:'Custom'},particles:[1,2],pieces:[1],settings:{quality:'quality'}},
 {project:{name:'Tee'},pieces:[],particles:[],constraints:[],virtualSeams:[],anchors:[],
 initialAssembly:{status:'BLOCKED',initialSeamGapMaximumMm:25,initialSeamGapAverageMm:8,
 initialMeshPeakEdgeStrainPercent:3,worstSewingGroups:[{seamId:'seam-A'}]}}])
 cases.push({op:'summary',payload})
// For a real generated tee, parity compares the native summary against JS.
const tee=buildNativeSimulationPayload(createTemplateProject('tee'))
cases.push({op:'summary',payload:tee})
for(const options of [{},{quality:'quality'},{quality:'balanced'}]){
 const payload=buildNativeSimulationPayload(createTemplateProject('tee'),options)
 cases.push({op:'summary',payload})
}
// Explicit native adapter fixture: mesh is already constructed, with stable simIndex refs.
const project={id:'test',name:'Simple',templateId:'custom',avatar:{},simulation:{}}
const simulation={pieces:{front:{piece:{name:'Front',fabricId:'main'},fabric:{},
 particles:[{id:'p0',simIndex:0,position:{x:0,y:0,z:0},previous:{x:0,y:0,z:0},invMass:1},
 {id:'p1',simIndex:1,position:{x:1,y:0,z:0},previous:{x:1,y:0,z:0},invMass:1}],
 flatVertices:[{x:0,y:0},{x:100,y:0}],faces:[],meshQuality:{qualityApproved:true}}},
 constraints:[{type:'structural',aSimIndex:0,bSimIndex:1,rest:1,stiffness:.9}],
 maxThickness:.002,initialAssembly:{status:'BLOCKED'},collisionExclusions:['0:1'],fusedPiecePairs:[]}
cases.push({op:'build',project,simulation})
cases.push({op:'build',project,simulation:{pieces:{}}})
function expected(c){try{
  const result=c.op==='profiles'?NATIVE_QUALITY_PROFILES:c.op==='quality'?resolveNativeQuality(c.options):
   c.op==='summary'?nativePayloadSummary(c.payload):null
  return {ok:true,result}
 }catch(e){return {ok:false,error:e.message}}}
const proc=spawnSync(process.env.GARMENT_NATIVE_PAYLOAD_TEST||'/tmp/garment-native-payload-test',['--json-lines'],{
 input:cases.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
if(proc.error)throw proc.error
assert.equal(proc.status,0,proc.stderr)
const lines=proc.stdout.trim().split('\n')
assert.equal(lines.length,cases.length)
let matched=0,adapter=0
for(let i=0;i<cases.length;i++){
 const actual=JSON.parse(lines[i]);const c=cases[i]
 if(c.op==='build'){if(i===cases.length-2){assert.equal(actual.ok,true,actual.error);assert.equal(actual.result.particles.length,2);assert.equal(actual.result.constraints.length,1);adapter++}
 else{assert.equal(actual.ok,false);adapter++}continue}
 const want=expected(c);assert.equal(actual.ok,want.ok,`case ${i}`)
 if(want.ok)assert.deepEqual(actual.result,want.result,`case ${i}`)
 else assert.equal(actual.error,want.error,`case ${i}`)
 matched++
}
console.log(`Native payload parity: ${matched} JS quality/profile/summary fixtures; ${adapter} C++ premeshed-adapter checks`)
