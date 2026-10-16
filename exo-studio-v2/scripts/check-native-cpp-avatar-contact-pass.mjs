import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {avatarContactParameters,projectAvatarContacts} from '../src/core/physics/avatarContactPass.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const runner=resolve(mkdtempSync(resolve(tmpdir(),'gs-avatar-contact-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/avatar_contact_pass.cpp','native_cpp/tests/test_avatar_contact_pass.cpp','-o',runner],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
function native(mode,payload){const p=spawnSync(runner,[],{input:JSON.stringify({mode,...payload})+'\n',encoding:'utf8'});assert.equal(p.status,0,p.stderr);const parsed=JSON.parse(p.stdout);assert.equal(parsed.ok,true,parsed.error);return parsed.result}
let checks=0
const fabrics=[{}, {thickness:0,friction:0},{thickness:.012,friction:.92},{thickness:-.002,friction:-.1}]
for(const fabric of fabrics)for(const layerIndex of [0,1,3,-2])for(const collisionMargin of [undefined,0,.02]){
 const project={simulation:collisionMargin===undefined?{}:{collisionMargin}},piece={fabric,layerIndex}
 assert.deepEqual(native('params',{project,piece}),avatarContactParameters(project,piece));checks++
}
for(const disabled of [false,true])for(const movableOnly of [false,true])for(const hasAvatar of [false,true]){
 const project={simulation:{collisions:!disabled,collisionMargin:.009},...(hasAvatar?{avatar:{shape:'capsule'}}:{})}
 const pieces=[
  {fabric:{thickness:.003,friction:.7},layerIndex:2,particles:[{id:0,invMass:1},{id:1,invMass:0},{id:2,invMass:-1}]},
  {fabric:{thickness:0,friction:0},layerIndex:0,particles:[{id:3,invMass:0.5},{id:4,invMass:0}]}
 ]
 const simulation={pieces:new Map(pieces.map((p,i)=>['p'+i,structuredClone(p)]))}
 const jsCalls=[]
 const jsCount=projectAvatarContacts(simulation,project,(particle,avatar,margin,friction)=>{
  jsCalls.push({particle:structuredClone(particle),avatar:avatar??null,margin,friction})
  particle.projected=true
 },{movableOnly})
 const cpp=native('callback',{simulation:{pieces:pieces.map(p=>structuredClone(p))},project,options:{movableOnly}})
 assert.equal(cpp.processed,jsCount)
 assert.deepEqual(cpp.calls,jsCalls)
 assert.deepEqual(cpp.simulation.pieces,Array.from(simulation.pieces.values()))
 const events=native('candidates',{simulation:{pieces},project,options:{movableOnly}})
 assert.equal(events.processed,jsCount)
 assert.deepEqual(events.events.map(e=>({particle:e.particle,avatar:e.avatar,margin:e.margin,friction:e.friction})),jsCalls)
 checks++
}
assert.equal(checks,56)
console.log('Avatar contact C++/JS parity passed: '+checks+' cases; injected callbacks, filtered contacts, mutation, and candidate events')
