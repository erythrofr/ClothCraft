import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import * as THREE from 'three'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'avatar-kernel-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/avatar_contact_kernel.cpp','native_cpp/tests/test_avatar_contact_kernel.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
// VM extraction evaluates the unmodified JS source's actual collision helpers.
// Existing ESM imports are replaced with dependencies supplied by the harness.
const source=readFileSync(resolve(root,'src/core/physics.js'),'utf8')
const sections=[[122,157],[177,202],[1746,1928],[1952,1962],[2145,2243]]
const lines=source.split('\n')
const isolated=sections.map(([start,end])=>lines.slice(start-1,end).join('\n').replace(/^export /gm,'')).join('\n')
const impl=new Function('THREE',`const EPSILON=1e-6;${isolated};return collideAvatar`)(THREE)
const cases=[]
for(const garment of ['tee','pants']){
 const project=createTemplateProject(garment),simulation=buildSimulation(project)
 const particles=[...simulation.pieces.values()].flatMap(x=>x.particles)
 for(const particle of particles.filter((_,i)=>i%Math.max(1,Math.floor(particles.length/110))===0)){
  for(const perturb of [0,.03]){
   const p={position:[particle.position.x+perturb,particle.position.y-perturb*.5,particle.position.z+perturb*.25],previous:particle.previous.toArray(),invMass:particle.invMass,wrapMode:particle.wrapMode,patternU:particle.patternU,patternV:particle.patternV,avatarHeightScale:particle.avatarHeightScale,collisionSideZ:particle.collisionSideZ,seamBoundary:particle.seamBoundary,seamIds:[...(particle.seamIds||[])],contactDepth:particle.contactDepth||0}
   cases.push({particle:p,avatar:project.avatar,margin:project.simulation?.collisionMargin??.012,friction:.3,garment})
  }
 }
}
const results=spawnSync(binary,['--json-lines'],{cwd:root,encoding:'utf8',input:cases.map(JSON.stringify).join('\n')+'\n',maxBuffer:32*1024*1024})
assert.equal(results.status,0,results.stderr)
const output=results.stdout.trim().split('\n').map(JSON.parse)
assert.equal(output.length,cases.length)
let mismatches=0,first=null,maxError=0
const diagnostics=[]
for(let i=0;i<cases.length;i++){
 const c=cases[i],a=output[i];assert.equal(a.ok,true,a.error)
 const sourceParticle={...c.particle,position:new THREE.Vector3(...c.particle.position),previous:new THREE.Vector3(...c.particle.previous)}
 impl(sourceParticle,c.avatar,c.margin,c.friction)
 const values=[...sourceParticle.position.toArray(),...sourceParticle.previous.toArray(),sourceParticle.contactDepth||0]
 const observed=[...a.particle.position,...a.particle.previous,a.particle.contactDepth||0]
 for(let j=0;j<values.length;j++){
  const err=Math.abs(values[j]-observed[j]),relative=err/Math.max(1,Math.abs(values[j]))
  maxError=Math.max(maxError,relative)
  if(relative>1e-7){mismatches++;const detail={case:i,garment:c.garment,channel:j,expected:values[j],native:observed[j],relative};first??=detail;if(diagnostics.length<20)diagnostics.push({...detail,input:c.particle})}
 }
}
console.log(JSON.stringify({fixtures:cases.length,mismatches,maxError,first,diagnostics}))
assert.equal(mismatches,0,'Avatar kernel requires exact JS parity; leave named export uncounted')
