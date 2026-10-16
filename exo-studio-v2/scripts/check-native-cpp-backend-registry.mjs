import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {registerSimulationBackend,replaceSimulationBackend,getSimulationBackend,listSimulationBackends,createSimulationSession} from '../src/core/backends/registry.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'garment-backend-registry-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/backend_registry.cpp','native_cpp/tests/test_backend_registry.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const definition=(id,metadata={},extra={})=>({id,metadata,create:true,step:true,...extra})
const actions=[
 {op:'register',backend:definition('parity-alpha',{label:'Alpha',kind:'cpu',capabilities:{gpu:false,keys:['a','b']}})},
 {op:'register',backend:definition('parity-beta')},
 {op:'list'},
 {op:'register',backend:definition('parity-alpha')},
 {op:'register',backend:definition('invalid-empty',{},{create:false})},
 {op:'register',backend:definition('invalid-step',{},{step:false})},
 {op:'register',backend:definition('invalid-async',{}, {async:true})},
 {op:'replace',backend:definition('parity-alpha',{label:'Updated',kind:'service',maturity:'preview',capabilities:{layers:2}})},
 {op:'list'},
 {op:'replace',backend:definition('parity-gamma',{kind:'hybrid'},{async:true,stepAsync:true})},
 {op:'get',id:'parity-alpha'},
 {op:'get',id:'missing'},
 {op:'session',id:'parity-alpha',project:{id:'tshirt',time:42}},
 {op:'session',id:'parity-gamma',project:{id:'jeans'}},
 {op:'session',id:'missing'},
 {op:'list'},
]
const jsBackend=spec=>({id:spec.id,...spec.metadata,async:spec.async,create:spec.create?function(project){return {backendId:this.id,project,frame:0,createdAt:'2026-10-15T00:00:00.000Z'}}:undefined,step:spec.step?()=>{}:undefined,stepAsync:spec.stepAsync?()=>{}:undefined})
const expected=[]
for(const a of actions){
 try{
  let result
  if(a.op==='register')result=registerSimulationBackend(jsBackend(a.backend)).id
  else if(a.op==='replace')result=replaceSimulationBackend(jsBackend(a.backend)).id
  else if(a.op==='get')result=getSimulationBackend(a.id)?.id??null
  else if(a.op==='list')result=listSimulationBackends().filter(b=>b.id.startsWith('parity-'))
  else if(a.op==='session'){const s=createSimulationSession(a.project,a.id);result={backend:s.backend.id,session:s.session}}
  expected.push({ok:true,result})
 }catch(error){expected.push({ok:false,error:error.message})}
}
// Native adapter starts empty because actual JS backend closures cannot cross into C++.
const native=spawnSync(binary,[],{cwd:root,input:JSON.stringify({actions}),encoding:'utf8'})
assert.equal(native.status,0,native.stderr)
const actual=JSON.parse(native.stdout)
assert.equal(actual.length,expected.length)
for(let i=0;i<actions.length;i++)assert.deepEqual(actual[i],expected[i],`Registry parity at ${i}: ${JSON.stringify(actions[i])}`)
console.log(`Native backend registry parity passed: ${actions.length} actions (deterministic session timestamp)`)
