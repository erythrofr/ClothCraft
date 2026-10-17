import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,stepSimulation} from '../src/core/physics.js'

const bin=process.env.GARMENT_CLOTH_SIM_TEST||'/tmp/garment-cloth-simulation-test'
const cases=[]
const vector=v=>[v.x,v.y,v.z]
function snapshotOf(sim){
 const particles=[...sim.pieces.values()].flatMap(piece=>piece.particles).sort((a,b)=>a.simIndex-b.simIndex)
 const pieces=[...sim.pieces.values()].map(piece=>({id:piece.id,fabric:{damping:piece.fabric?.damping??.985},particleIndices:piece.particles.map(p=>p.simIndex)}))
 const refs=new Map(particles.map((p,i)=>[p,i]))
 const constraints=sim.constraints.map(c=>({type:c.type,a:refs.get(c.a),b:refs.get(c.b),rest:c.rest,stiffness:c.stiffness}))
 const anchors=(sim.anchorConstraints||[]).map(c=>({particle:refs.get(c.particle),target:vector(c.target),axes:c.axes??'',stiffness:c.stiffness}))
 return {particles:particles.map(p=>({position:vector(p.position),previous:vector(p.previous),invMass:p.invMass,damping:p.damping})),pieces,constraints,anchors,maxThickness:sim.maxThickness,elapsed:sim.elapsed}
}
function supported(sim){return sim.constraints.every(c=>Number.isInteger(c.a?.simIndex)&&Number.isInteger(c.b?.simIndex)&&!['seam-virtual'].includes(c.type)&&!(c.type==='surface-stitch'&&c.targetParticles?.length))}
for(const template of ['tee']){
 const project=createTemplateProject(template);project.simulation={...project.simulation,selfCollision:false,collisions:false,wind:{enabled:false}}
 const sim=buildSimulation(project)
 const snapshot=snapshotOf(sim)
 console.log('JS mesh snapshot',template,'particles',snapshot.particles.length,'constraints',snapshot.constraints.length,'anchors',snapshot.anchors.length,'supported',supported(sim))
 cases.push({op:'build',project,snapshot})
 if(supported(sim))cases.push({op:'step',project,snapshot,dt:1/60,simulation:sim})
}
const rectangle={particles:[
 {position:[0,1,0],previous:[0,1,0],invMass:0,damping:.985},
 {position:[1,1,0],previous:[1,1,0],invMass:1,damping:.985},
 {position:[1,0,0],previous:[1,0,0],invMass:1,damping:.985},
 {position:[0,0,0],previous:[0,0,0],invMass:1,damping:.985}],
 pieces:[{id:'rectangle',fabric:{damping:.985},particleIndices:[0,1,2,3]}],
 constraints:[{a:0,b:1,type:'structural',rest:1,stiffness:.9},{a:1,b:2,type:'structural',rest:1,stiffness:.9},{a:2,b:3,type:'structural',rest:1,stiffness:.9},{a:3,b:0,type:'structural',rest:1,stiffness:.9},{a:0,b:2,type:'bend',rest:Math.SQRT2,stiffness:.2}],
 anchors:[],maxThickness:.002,elapsed:0}
const project={simulation:{gravity:9.81,collisions:false,selfCollision:false,iterations:7,substeps:1}}
cases.push({op:'build',project,snapshot:rectangle})
cases.push({op:'step',project,snapshot:rectangle,dt:1/60})
cases.push({op:'step',project,snapshot:rectangle,dt:0})
cases.push({op:'step',project:{simulation:{collisions:true,selfCollision:false}},snapshot:rectangle})
const proc=spawnSync(bin,['--json-lines'],{input:cases.map(({simulation,...c})=>JSON.stringify(c)).join('\n')+'\n',encoding:'utf8',maxBuffer:100*1024*1024})
if(proc.error)throw proc.error
assert.equal(proc.status,0,proc.stderr)
const lines=proc.stdout.trim().split('\n').map(JSON.parse)
assert.equal(lines.length,cases.length)
let matched=0
for(let i=0;i<cases.length;i++){
 const c=cases[i],actual=lines[i]
 if(c.op==='build'){assert.equal(actual.ok,true,JSON.stringify(actual));assert.deepEqual(actual.result.particles,c.snapshot.particles);assert.deepEqual(actual.result.constraints,c.snapshot.constraints);matched++;continue}
 if(c.project.simulation.collisions){assert.equal(actual.ok,false);assert.match(actual.error,/does not yet support/);matched++;continue}
 assert.equal(actual.ok,true,JSON.stringify(actual).slice(0,300))
 if(c.dt===0){assert.deepEqual(actual.result,c.snapshot);matched++;continue}
 if(c.simulation){
  stepSimulation(c.simulation,c.project,c.dt)
  const want=snapshotOf(c.simulation).particles
  const got=actual.result.particles
  assert.equal(got.length,want.length)
  let maxError=0
  for(let j=0;j<got.length;j++)for(let axis=0;axis<3;axis++)maxError=Math.max(maxError,Math.abs(got[j].position[axis]-want[j].position[axis]))
  console.log('tee one-step position max difference in metres',maxError)
  assert.ok(maxError<1e-8,`tee position error ${maxError}`)
 }
 matched++
}
console.log('Cloth adapter verified',matched,'snapshot and step cases; collision and live meshing parity remain unsupported')
