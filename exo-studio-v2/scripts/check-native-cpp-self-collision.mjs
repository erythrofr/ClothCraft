import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import * as THREE from 'three'
import {resolveSelfCollisions} from '../src/core/physics/selfCollision.js'
const make=(particles,extra={})=>({pieces:{a:{particles:particles.filter(p=>p.pieceId==='a')},b:{particles:particles.filter(p=>p.pieceId==='b')}},...extra})
const particle=(simIndex,pieceId,x,y,z,extra={})=>({simIndex,pieceId,invMass:1,position:{x,y,z},...extra})
const cases=[
 make([particle(0,'a',0,0,0),particle(1,'a',.005,0,0)]),
 make([particle(0,'a',0,0,0,{invMass:0}),particle(1,'a',.005,0,0)]),
 make([particle(0,'a',0,0,0),particle(1,'b',0,0,0,{layerIndex:1,wrapMode:'left-arm'})]),
 make([particle(0,'a',0,0,0),particle(1,'b',0,0,0,{layerIndex:1,wrapMode:'right-leg-front'})]),
 make([particle(0,'a',0,0,0),particle(1,'b',0,0,0)],{fusedPiecePairs:['a|b']}),
 make([particle(0,'a',0,0,0),particle(1,'b',0,0,0)],{collisionExclusions:['0:1']}),
 make([particle(0,'a',0,0,0),particle(1,'a',.005,0,0),particle(2,'b',0,.005,0),particle(3,'b',0,0,.005)]),
]
let seed=1279
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
for(let c=0;c<30;++c){const ps=[];for(let i=0;i<12;++i)ps.push(particle(i,i%2?'b':'a',(rand()-.5)*.06,(rand()-.5)*.06,(rand()-.5)*.06,{invMass:i%7===0?0:1,layerIndex:i%3,wrapMode:i%4===0?'left-arm':i%4===1?'right-leg':'',collisionSideZ:1}));cases.push(make(ps))}
function jsCase(source,minimumDistance){
 const simulation={...source,pieces:new Map(Object.entries(source.pieces).map(([key,piece])=>[key,{...piece,particles:piece.particles.map(p=>({...p,position:new THREE.Vector3(p.position.x,p.position.y,p.position.z)}))}])),fusedPiecePairs:new Set(source.fusedPiecePairs||[]),collisionExclusions:new Set(source.collisionExclusions||[])}
 resolveSelfCollisions(simulation,minimumDistance)
 return Object.fromEntries([...simulation.pieces].map(([key,piece])=>[key,piece.particles.map(p=>p.position.toArray())]))
}
const fixtures=cases.flatMap(simulation=>[.02,.0000001].map(minimumDistance=>({simulation,minimumDistance})))
const command=spawnSync(process.env.GARMENT_SELF_COLLISION_TEST||'/tmp/garment-native-self-collision-test',['--json-lines'],{input:fixtures.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024})
if(command.error)throw command.error
assert.equal(command.status,0,command.stderr)
const lines=command.stdout.trim().split('\n');assert.equal(lines.length,fixtures.length)
for(let i=0;i<fixtures.length;++i){
 const native=JSON.parse(lines[i]),expected=jsCase(fixtures[i].simulation,fixtures[i].minimumDistance)
 for(const [id,positions] of Object.entries(expected)){
  const actual=native.pieces[id].particles
  positions.forEach((position,j)=>position.forEach((x,k)=>{
   const value=actual[j].position[['x','y','z'][k]]
   assert.ok(Math.abs(x-value)<1e-8,`fixture ${i} ${id} particle ${j} axis ${k}: JS ${x}, C++ ${value}`)
  }))
 }
}
console.log(`native self-collision parity passed: ${fixtures.length} deterministic and seeded JS/C++ fixtures`)
