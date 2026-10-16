import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
import { resolveSelfCollisions } from '../src/core/physics/selfCollision.js'
import { resolveSolverTimestep } from '../src/core/physics/timestep.js'
import { avatarContactParameters, projectAvatarContacts } from '../src/core/physics/avatarContactPass.js'
import { assessSimulationFit } from '../src/core/physics/qualityGate.js'
import { nativeServiceBackend, assessNativeSolverResult } from '../src/core/backends/nativeServiceBackend.js'
import { inspectClothMesh } from '../src/core/physics/meshQuality.js'
import { getSimulationBackend, replaceSimulationBackend } from '../src/core/backends/registry.js'

// A numeric invalid dt must not silently poison all particle coordinates.
assert.throws(() => resolveSolverTimestep({}, NaN), RangeError)
assert.throws(() => resolveSolverTimestep({}, Infinity), RangeError)
assert.throws(() => resolveSolverTimestep({}, -0.002), RangeError)
assert.throws(() => resolveSolverTimestep({gravity:NaN}, 1/60), RangeError)
assert.throws(() => resolveSolverTimestep({selfCollisionMargin:NaN}, 1/60), RangeError)
assert.throws(() => resolveSolverTimestep({},1/60,NaN), RangeError)
assert.equal(resolveSolverTimestep({}, 0), null)
const schedule = resolveSolverTimestep({gravity:9.81,substeps:3,iterations:9},1/60,.002)
assert.equal(schedule.substeps,3)
assert.equal(schedule.iterations,3)
assert.ok(Math.abs(schedule.gravityStep-9.81*(1/180)**2)<1e-12)

const project = createTeeTemplate()
assert.throws(()=>nativeServiceBackend.step(),/stepAsync/)
assert.throws(()=>replaceSimulationBackend({id:'invalid-no-step',create:()=>({})}),/must implement/)
assert.throws(()=>replaceSimulationBackend({id:'invalid-async',create:()=>({}),step:()=>{},async:true}),/stepAsync/)
assert.equal(getSimulationBackend('invalid-no-step'),null)
const simulation = buildSimulation(project)
const sleeveMesh = simulation.meshQuality['sleeve-right']
assert.ok(sleeveMesh?.slenderFaces > 0,'Existing sleeve mesh should flag thin rest triangles')
assert.ok(sleeveMesh.maximumAspect > 25,'Expected high-aspect sleeve triangles to be detected')
assert.equal(sleeveMesh.qualityApproved,false)
assert.ok(simulation.meshQuality.front.maximumAspect>100,'Bodice mesh should report its needle-thin triangles')
assert.throws(()=>inspectClothMesh([[0,0],[1,0],[0,1]],[[0,1,9]]),RangeError)
const front = simulation.pieces.get('front')
const previous = front.particles[0].position.clone()
assert.equal(stepSimulation(simulation,project,0),simulation)
assert.ok(front.particles[0].position.equals(previous))
assert.equal(simulation.elapsed,0)
assert.throws(()=>stepSimulation(simulation,project,NaN),RangeError)
assert.ok(front.particles[0].position.equals(previous),'NaN dt must not damage particle state')
stepSimulation(simulation,project,1/60)
assert.ok(simulation.elapsed>0)
assert.ok(simulation.quality?.acceptance)
assert.equal(simulation.quality.acceptance.factoryApproved,false)

// Test cross-piece collision pairs and frozen-particle handling without the
// sewing constraints. The module must be independently reusable and stable.
const A={simIndex:0,pieceId:'a',position:new THREE.Vector3(0,0,0),invMass:1,layerIndex:0}
const B={simIndex:1,pieceId:'b',position:new THREE.Vector3(.003,0,0),invMass:1,layerIndex:0}
const pair={pieces:new Map([['a',{particles:[A]}],['b',{particles:[B]}]]),collisionExclusions:new Set(),fusedPiecePairs:new Set()}
resolveSelfCollisions(pair,.01)
assert.ok(Math.abs(B.position.x-A.position.x)>.009,'Close particles should separate symmetrically')
assert.ok(Math.abs(A.position.x+B.position.x-.003)<1e-9,'Center of mass should not drift')

const calls=[]
const policy = avatarContactParameters(project,{fabric:{thickness:.003,friction:.4},layerIndex:2})
assert.equal(policy.friction,.4)
assert.ok(policy.margin>project.simulation.collisionMargin+.003)
const contactScene={pieces:new Map([['one',{fabric:{thickness:.003,friction:.4},layerIndex:2,particles:[{invMass:0},{invMass:1}]}]])}
const count=projectAvatarContacts(contactScene,project,(particle,avatar,margin,friction)=>calls.push({particle,avatar,margin,friction}),{movableOnly:true})
assert.equal(count,1)
assert.equal(calls.length,1)
assert.equal(calls[0].margin,policy.margin)
assert.equal(calls[0].avatar,project.avatar)

const failed=assessSimulationFit({structural:{maxStrainPercent:982},sewing:{maxGapMm:34},collision:{triangleCcdVerified:false}})
assert.equal(failed.status,'FAILED')
assert.ok(failed.failures.includes('excessive-structural-strain'))
const uncertified=assessSimulationFit({structural:{maxStrainPercent:2},sewing:{maxGapMm:1},collision:{triangleCcdVerified:false}})
assert.equal(uncertified.status,'UNVERIFIED')
assert.equal(uncertified.factoryApproved,false)
const unacceptableNative=assessNativeSolverResult({stats:{finite:true,fullMeshEdgeStrainMax:3.3937,seamMaxDistance:.02181}})
assert.equal(unacceptableNative.status,'FAILED')
assert.ok(unacceptableNative.failures.includes('excessive-structural-strain'))
assert.ok(unacceptableNative.failures.includes('open-sewing-seams'))
const hiddenFirstFrameStrain=assessNativeSolverResult({stats:{finite:true,fullMeshEdgeStrainMax:.03,seamMaxDistance:.001},fitTrajectory:{allFramesFinite:true,peakFullMeshEdgeStrainPercent:1400,peakSewnGapMm:28}})
assert.equal(hiddenFirstFrameStrain.status,'FAILED','A bad earlier frame must not pass because the final frame settled')
const invalidNative=assessNativeSolverResult({stats:{finite:false}})
assert.equal(invalidNative.status,'FAILED')
assert.ok(invalidNative.failures.includes('native-solver-nonfinite'))

// Simulate a late HTTP result and ensure disposing a native session cancels
// transport, marks it immutable and cannot adopt stale cloth data.
const realFetch=globalThis.fetch
let signal
try {
  globalThis.fetch=(_url,{signal:requestedSignal}={})=>{
    signal=requestedSignal
    return new Promise((_resolve,reject)=>{
      if (signal.aborted) return reject(Object.assign(new Error('Aborted'),{name:'AbortError'}))
      signal.addEventListener('abort',()=>reject(Object.assign(new Error('Aborted'),{name:'AbortError'})),{once:true})
    })
  }
  const nativeSession=nativeServiceBackend.create(project)
  assert.ok(nativeSession.payload.pieces.every(piece=>piece.meshQuality?.faces>0))
  const firstPos=nativeSession.particleRefs[0].position.clone()
  const request=nativeServiceBackend.stepAsync(nativeSession,8)
  assert.ok(signal && !signal.aborted)
  nativeServiceBackend.dispose(nativeSession)
  assert.ok(nativeSession.disposed)
  assert.ok(signal.aborted)
  assert.equal(await request,nativeSession)
  assert.equal(nativeSession.frame,0)
  nativeServiceBackend.adoptResult(nativeSession,{frames:8,state:{particles:[]}})
  assert.ok(nativeSession.particleRefs[0].position.equals(firstPos))
  const replacement=nativeServiceBackend.reset(nativeSession)
  assert.ok(replacement!==nativeSession && !replacement.disposed)
  nativeServiceBackend.dispose(replacement)

  // Reject corrupt native results atomically before overwriting any live
  // JS or native-payload particle positions.
  const validationSession=nativeServiceBackend.create(project)
  const initial=validationSession.payload.particles[0].position.slice()
  const resultParticles=validationSession.payload.particles.map(p=>({position:p.position.slice(),previous:p.previous.slice()}))
  resultParticles[2].position[1]=NaN
  assert.throws(()=>nativeServiceBackend.adoptResult(validationSession,{frames:8,state:{particles:resultParticles}}),/finite/)
  assert.deepEqual(validationSession.payload.particles[0].position,initial)
  assert.equal(validationSession.frame,0)
  nativeServiceBackend.dispose(validationSession)
} finally {globalThis.fetch=realFetch}

console.log(JSON.stringify({pass:true,tests:['finite timestep validation','zero-frame no-op','independent symmetric self-collision','central avatar-contact policy','thin-rest-mesh detection','non-certified fit diagnostics','stale native request abortion','atomic malformed reply rejection'],teePanels:simulation.pieces.size,sleeveMesh:{slenderFaces:sleeveMesh.slenderFaces,maximumAspect:sleeveMesh.maximumAspect},bodiceMaximumAspect:simulation.meshQuality.front.maximumAspect},null,2))
