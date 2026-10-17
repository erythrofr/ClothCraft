import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import * as THREE from 'three'
import {correctAvatarSurfaceIntrusion} from '../src/core/physics.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-avatar-correction-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/avatar_physics.cpp','native_cpp/core/avatar_surface_correction.cpp','native_cpp/tests/test_avatar_surface_correction.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const make=(z,wrapMode='front',invMass=1)=>({id:'panel',fabric:{thickness:.002,friction:.3},faces:[[0,1,2]],particles:[{position:{x:-.05,y:1.2,z},previous:{x:-.05,y:1.2,z},wrapMode,invMass,patternV:.4,patternU:-.2,collisionSideZ:1},{position:{x:.05,y:1.2,z},previous:{x:.05,y:1.2,z},wrapMode,invMass,patternV:.4,patternU:.2,collisionSideZ:1},{position:{x:0,y:1.4,z},previous:{x:0,y:1.4,z},wrapMode,invMass,patternV:.6,patternU:0,collisionSideZ:1}]})
const cases=[]
for(const z of [0,.04,.14,.25])for(const collisions of [true,false])for(const maxCorrectionM of [0,.003])cases.push({project:{avatar:{},simulation:{collisions,collisionMargin:.012}},simulation:{pieces:[make(z)]},options:{maxCorrectionM}})
for(const wrap of ['front','back','left-leg-front'])cases.push({project:{avatar:{heightCm:182},simulation:{collisions:true}},simulation:{pieces:[make(.02,wrap,0)]},options:{}})
function jsRun(q){
 const pieces=new Map(q.simulation.pieces.map(p=>[p.id,{
  ...p,particles:p.particles.map(a=>({...a,
   position:new THREE.Vector3(a.position.x,a.position.y,a.position.z),
   previous:new THREE.Vector3(a.previous.x,a.previous.y,a.previous.z)
  }))
 }]))
 const result=correctAvatarSurfaceIntrusion({pieces},q.project,q.options)
 const simulation={pieces:[...pieces.values()].map(p=>({
  ...p,particles:p.particles.map(a=>({...a,
   position:{x:a.position.x,y:a.position.y,z:a.position.z},
   previous:{x:a.previous.x,y:a.previous.y,z:a.previous.z}
  }))
 }))}
 return {result,simulation}
}
const native=spawnSync(binary,[],{input:JSON.stringify({cases}),cwd:root,encoding:'utf8'})
assert.equal(native.status,0,native.stderr)
const actual=native.stdout.trim().split('\n').map(JSON.parse)
function match(a,b,path){if(typeof a==='number'){assert.ok(Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(a)),path+': '+a+' vs '+b);return}if(Array.isArray(a)){assert.equal(b.length,a.length,path);a.forEach((v,i)=>match(v,b[i],path+'.'+i));return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),path);for(const key of Object.keys(a))match(a[key],b[key],path+'.'+key);return}assert.deepEqual(b,a,path)}
let passed=0;const differences=[]
for(let i=0;i<cases.length;i++){try{match(jsRun(cases[i]),actual[i],'case '+i);passed++}catch(error){differences.push({case:i,reason:error.message})}}
console.log(JSON.stringify({passed,total:cases.length,differences},null,2))
if(differences.length)process.exitCode=1
