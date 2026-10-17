import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import * as THREE from 'three'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'
import {resolveSelfCollisions} from '../src/core/physics/selfCollision.js'

const binary=process.env.GARMENT_CPP_SELF_COLLISION_TEST ||
  'native_cpp/build-cmake/native_self_collision_tests'
let cases=0
function snapshot(sim){
  const pieces={}
  for(const [id,piece] of sim.pieces){
    pieces[id]={particles:piece.particles.map(p=>({
      simIndex:p.simIndex,pieceId:p.pieceId,invMass:p.invMass,
      layerIndex:p.layerIndex,wrapMode:p.wrapMode,collisionSideZ:p.collisionSideZ,
      position:{x:p.position.x,y:p.position.y,z:p.position.z},
    }))}
  }
  return {pieces,collisionExclusions:[...sim.collisionExclusions],
    fusedPiecePairs:[...sim.fusedPiecePairs]}
}
for(const template of ['tee','pants']){
  for(const mode of ['baseline','small-overlap','frozen','stacked','cross-piece-overlap']){
    const project=createTemplateProject(template)
    const sim=buildSimulation(project)
    if(mode==='small-overlap'){
      for(const piece of sim.pieces.values())for(let i=0;i<piece.particles.length;i++){
        const particle=piece.particles[i]
        if(i%7===0)particle.position.z*=.6
      }
    }
    if(mode==='frozen'){
      const first=sim.pieces.values().next().value
      for(let i=0;i<first.particles.length;i+=3)first.particles[i].invMass=0
    }
    if(mode==='stacked'){
      const first=sim.pieces.values().next().value
      for(let i=0;i<first.particles.length;i+=4){
        const src=first.particles[i],neighbor=first.particles[(i+1)%first.particles.length]
        src.position.copy(neighbor.position).add(new THREE.Vector3(.003,0,0))
      }
    }
    if(mode==='cross-piece-overlap'){
      const pieces=[...sim.pieces.values()]
      assert.ok(pieces.length>=2)
      const a=pieces[0].particles[9],b=pieces[1].particles[23]
      a.position.copy(b.position).add(new THREE.Vector3(.003,0,0))
    }
    const initial=snapshot(sim),original=JSON.stringify(initial)
    const minimumDistance=Math.max(.004,sim.maxThickness*2+
      (project.simulation?.selfCollisionMargin??.002))
    resolveSelfCollisions(sim,minimumDistance)
    const expected=snapshot(sim)
    const run=spawnSync(binary,['--json-lines'],{
      input:JSON.stringify({simulation:initial,minimumDistance})+'\n',
      encoding:'utf8',maxBuffer:48*1024*1024})
    if(run.error)throw run.error
    assert.equal(run.status,0,run.stderr)
    const actual=JSON.parse(run.stdout.trim())
    let maxPositionDifferenceM=0,rms=0,count=0,differences=0,movedFromSource=0
    for(const [id,piece] of Object.entries(expected.pieces))
      for(let i=0;i<piece.particles.length;i++)for(const axis of ['x','y','z']){
        const native=actual.pieces[id].particles[i].position[axis]
        const js=piece.particles[i].position[axis]
        const delta=Math.abs(native-js)
        assert.ok(Number.isFinite(native),template+'/'+mode+' nonfinite particle')
        maxPositionDifferenceM=Math.max(maxPositionDifferenceM,delta)
        rms+=delta*delta;count++
        if(delta>1e-7)differences++
        if(Math.abs(js-initial.pieces[id].particles[i].position[axis])>1e-7)
          movedFromSource++
      }
    rms=Math.sqrt(rms/count)
    assert.equal(JSON.stringify(initial),original,'native/JS simulation inputs modified')
    console.log(JSON.stringify({template,mode,particleScalars:count,
      maxPositionDifferenceM,rmsPositionDifferenceM:rms,differences,
      movedFromSource,
      fullAvatarCollisionCertified:false}))
    if(mode==='cross-piece-overlap')
      assert.ok(movedFromSource>0,template+' overlap fixture did not exercise collision response')
    assert.equal(differences,0,template+'/'+mode+' JS/native body-independent self-collision mismatches')
    cases++
  }
}
console.log('Native body-independent self collision matched JS for '+cases+' real and perturbed garment fixtures')
