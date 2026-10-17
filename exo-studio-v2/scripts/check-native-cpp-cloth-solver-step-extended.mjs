import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,stepSimulation} from '../src/core/physics.js'

const root=resolve(import.meta.dirname,'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'cloth-step-extended-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/cloth_solver_step_extended.cpp','native_cpp/tests/test_cloth_solver_step_extended.cpp','native_cpp/build-cmake/libgarment_cad_core.a','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const vector=v=>[v.x,v.y,v.z]
function snapshotOf(sim){
 const particles=[...sim.pieces.values()].flatMap(piece=>piece.particles).sort((a,b)=>a.simIndex-b.simIndex)
 const refs=new Map(particles.map((p,i)=>[p,i]))
 return {particles:particles.map(p=>({position:vector(p.position),previous:vector(p.previous),invMass:p.invMass,damping:p.damping,contactDepth:p.contactDepth??0})),pieces:[...sim.pieces.values()].map(piece=>({id:piece.id,fabric:{damping:piece.fabric?.damping??.985},particleIndices:piece.particles.map(p=>refs.get(p))})),constraints:sim.constraints.map(c=>({type:c.type,a:refs.get(c.a),b:refs.get(c.b),rest:c.rest,stiffness:c.stiffness,targetParticles:c.targetParticles?.map(p=>refs.get(p))})),anchors:(sim.anchorConstraints||[]).map(c=>({particle:refs.get(c.particle),target:vector(c.target),axes:c.axes??'',stiffness:c.stiffness})),maxThickness:sim.maxThickness,elapsed:sim.elapsed}
}
const cases=[],comparisons=[]
for(const template of ['tee','pants'])for(const substeps of [1,2,4])for(const frames of [1,2]){
 const project=createTemplateProject(template)
 project.simulation={...project.simulation,selfCollision:false,collisions:false,continuousSurfaceContact:false,bodyTriangleContactAssist:false,substeps,wind:{enabled:false}}
 const sim=buildSimulation(project),snapshot=snapshotOf(sim)
 const unsupported=snapshot.constraints.some(c=>c.a===undefined||c.b===undefined||c.type==='seam-virtual'||(c.type==='surface-stitch'&&c.targetParticles?.length))
 if(unsupported){console.log(JSON.stringify({template,substeps,frames,skipped:'unsupported seam constraint'}));continue}
 cases.push({snapshot,project,dt:1/60,frames});for(let i=0;i<frames;i++)stepSimulation(sim,project,1/60)
 comparisons.push({template,substeps,frames,reference:snapshotOf(sim)})
}
const first=cases[0]
assert.ok(first,'At least one native-compatible real garment fixture required')
cases.push({...first,project:{...first.project,simulation:{...first.project.simulation,collisions:true}}})
cases.push({...first,project:{...first.project,simulation:{...first.project.simulation,selfCollision:true}}})
cases.push({...first,project:{...first.project,simulation:{...first.project.simulation,wind:{enabled:true,speed:3}}}})
const execution=spawnSync(binary,[],{cwd:root,input:JSON.stringify({cases}),encoding:'utf8',maxBuffer:150*1024*1024})
assert.equal(execution.status,0,execution.stderr)
const answers=JSON.parse(execution.stdout)
assert.equal(answers.length,cases.length)
for(let i=0;i<comparisons.length;i++){
 const {template,substeps,frames,reference}=comparisons[i],actual=answers[i]
 assert.equal(actual.ok,true,`${template} ${substeps}/${frames}: ${actual.error}`)
 let maxPositionError=0,maxPreviousError=0,rms=0,n=0
 assert.equal(actual.result.particles.length,reference.particles.length)
 for(const particle of actual.result.particles)assert.equal(particle.contactDepth,0,'collision-disabled contact depth must remain zero')
 for(let j=0;j<reference.particles.length;j++)for(let axis=0;axis<3;axis++){
  const positionError=Math.abs(actual.result.particles[j].position[axis]-reference.particles[j].position[axis])
  const previousError=Math.abs(actual.result.particles[j].previous[axis]-reference.particles[j].previous[axis])
  maxPositionError=Math.max(maxPositionError,positionError)
  maxPreviousError=Math.max(maxPreviousError,previousError)
  rms+=positionError*positionError;n++
 }
 rms=Math.sqrt(rms/n)
 console.log(JSON.stringify({template,substeps,frames,particles:reference.particles.length,maxPositionError,maxPreviousError,rms}))
 assert.ok(maxPositionError<1e-7&&maxPreviousError<1e-7,`numerical parity failure ${template} ${substeps}/${frames}: ${maxPositionError} / ${maxPreviousError}`)
 assert.ok(Math.abs(actual.result.elapsed-reference.elapsed)<1e-12,'elapsed time mismatch')
}
for(let i=comparisons.length;i<answers.length;i++){
 assert.equal(answers[i].ok,false,'unsupported collision/wind path must reject')
 assert.match(answers[i].error,/unsupported/i)
}
assert.deepEqual(cases[0].snapshot.particles[0].position,first.snapshot.particles[0].position,'input snapshot must not mutate')
console.log(`PASS ${comparisons.length} physically collision-disabled runs; collision/wind modes fail closed; full parity unverified`)
