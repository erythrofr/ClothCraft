import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,stepSimulation} from '../src/core/physics.js'
const binary=process.env.GARMENT_CLOTH_COLLISION_STEP_TEST||'/tmp/garment-cloth-collision-step-test'
if(!process.env.GARMENT_CLOTH_COLLISION_STEP_TEST){
 const compile=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor',
  'native_cpp/core/cloth_collision_step.cpp','native_cpp/core/assembled_cloth_snapshot.cpp',
  'native_cpp/core/cloth_meshing_pipeline.cpp','native_cpp/core/cloth_seam_constraints.cpp',
  'native_cpp/core/avatar_physics.cpp','native_cpp/tests/test_cloth_collision_step.cpp','-o',binary],{encoding:'utf8',maxBuffer:4*1024*1024})
 assert.equal(compile.status,0,compile.stderr||compile.error?.message)
}
for(const name of ['tee','pants']){
 const project=createTemplateProject(name);project.simulation.collisions=true
 const js=buildSimulation(project);const initial=[...js.pieces.values()].flatMap(p=>p.particles.map(p=>p.position.toArray()))
 stepSimulation(js,project,1/60)
 const expected=[...js.pieces.values()].flatMap(p=>p.particles.map(p=>p.position.toArray()))
 const result=spawnSync(binary,['--json-lines'],{input:JSON.stringify({project})+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
 assert.equal(result.status,0,result.stderr)
 const response=JSON.parse(result.stdout.trim());assert.equal(response.ok,true,response.error)
 const native=response.result
 assert.equal(native.particleCount,expected.length)
 let rms=0,maxDifference=0,minNativeY=Infinity,minJsY=Infinity,movedDown=0,movedUp=0,jsMovedUp=0
 for(let i=0;i<expected.length;i++){
  const actual=native.particles[i].position
  assert.ok(actual.every(Number.isFinite))
  const error=Math.hypot(...actual.map((v,j)=>v-expected[i][j]));rms+=error*error;maxDifference=Math.max(maxDifference,error)
  minNativeY=Math.min(minNativeY,actual[1]);minJsY=Math.min(minJsY,expected[i][1]);
  if(actual[1]<initial[i][1]-1e-7)movedDown++;if(actual[1]>initial[i][1]+1e-7)movedUp++
  if(expected[i][1]>initial[i][1]+1e-7)jsMovedUp++
 }
 rms=Math.sqrt(rms/expected.length)
 assert.ok(minNativeY>=-2,'no catastrophic fall-through')
 assert.ok(native.minimumAvatarClearance>=-1e-4,'analytic avatar vertex penetration')
 assert.equal(native.fullStepParity,false)
 // Baseline from the previous verified native analytic-clearance implementation.
 const baseline=name==='tee'?{rms:0.07410258956487834,up:310}:{rms:0.05499587070586809,up:162}
 assert.ok(rms<=baseline.rms+1e-8,`regressed prior RMS: ${rms} > ${baseline.rms}`)
 console.log(JSON.stringify({name,particles:expected.length,meanPositionErrorM:rms,maxPositionErrorM:maxDifference,
  priorRmsM:baseline.rms,rmsImprovementM:baseline.rms-rms,priorMovedUp:baseline.up,
  minJsY,minNativeY,movedDown,movedUp,jsMovedUp,minAvatarClearanceM:native.minimumAvatarClearance,
  contactProjections:native.contactProjections,collisionsEnabled:native.collisionsEnabled,fullStepParity:native.fullStepParity,unported:native.unported}))
}
