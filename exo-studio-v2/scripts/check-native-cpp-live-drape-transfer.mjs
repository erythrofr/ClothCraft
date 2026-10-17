import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {captureDrape,transferDrape,measureSeamGap,captureParticlePositions,restoreParticlePositions} from '../src/core/liveDrapeTransfer.js'
const p=(x,y,z)=>({position:{x,y,z},previous:{x,y,z}})
const make=(curve=false)=>({pieces:{
 front:{flatVertices:[{x:0,y:0},{x:1,y:0},{x:0,y:1}],faces:[[0,1,2]],
 particles:[p(0,0,.1),p(1,0,.2),p(0,1,.3)]},
 back:{flatVertices:[{x:5,y:5}],faces:[],particles:[p(0,0,0)]}
},seamConstraints:[{a:p(0,0,0),b:p(.002,0,0)},{}]})
function jsSimulation(s){
 const clone=structuredClone(s)
 return {...clone,...(clone.pieces?{pieces:new Map(Object.entries(clone.pieces))}:{})}
}
function snapshotToJson(m){if(m==null)return null;return Object.fromEntries(m)}
function jsExpected(c){
 const sim=jsSimulation(c.simulation)
 let result
 if(c.op==='capture')result=snapshotToJson(captureDrape(sim))
 if(c.op==='seams')result=measureSeamGap(sim)
 if(c.op==='capturePositions')result=Object.fromEntries(capturePositions(sim))
 if(c.op==='restore'){
  const snap=captureParticlePositions(sim)
  for(const item of snap){item.points=c.snapshot[([...sim.pieces].find(([_,v])=>v===item.piece)||[])[0]]||[]}
  restoreParticlePositions(snap)
  result={...sim,pieces:Object.fromEntries(sim.pieces)}
 }
 if(c.op==='transfer'){
  const entries=Object.entries(c.snapshot||{})
  const snap=c.snapshot===null?null:new Map(entries)
  const validate=c.validation?.maxDistanceFromOriginalM!==undefined
   ?(particle,origin)=>Math.hypot(particle.position.x-origin.x,particle.position.y-origin.y,particle.position.z-origin.z)<=c.validation.maxDistanceFromOriginalM:null
  const stats=transferDrape(snap,sim,c.maxOffsetM,validate)
  result={stats,simulation:{...sim,pieces:Object.fromEntries(sim.pieces)}}
 }
 return result
}
function capturePositions(sim){return captureParticlePositions(sim).map(({piece,points})=>[[...sim.pieces].find(([_,p])=>p===piece)[0],points])}
const base=make()
const source=jsSimulation(base)
const snapshot=snapshotToJson(captureDrape(source))
const moved=make();moved.pieces.front.flatVertices=[{x:.2,y:.2},{x:1.8,y:.3},{x:.8,y:.1},{x:0,y:.9}]
moved.pieces.front.particles.push(p(0,0,0))
const cases=[
 {op:'capture',simulation:base},{op:'capture',simulation:{pieces:{}}},{op:'capture',simulation:{}},
 {op:'seams',simulation:base},{op:'seams',simulation:{seamConstraints:[]}},{op:'capturePositions',simulation:base},
 ...[.035,.5,0].map(maxOffsetM=>({op:'transfer',simulation:moved,snapshot,maxOffsetM})),
 {op:'transfer',simulation:moved,snapshot,maxOffsetM:.035,validation:{maxDistanceFromOriginalM:.01}},
 {op:'transfer',simulation:moved,snapshot:null},{op:'transfer',simulation:{pieces:{orphan:moved.pieces.front}},snapshot:{}},
 {op:'restore',simulation:moved,snapshot:{front:[{x:0,y:0,z:.4},{x:1,y:0,z:.3}],back:[{x:2,y:3,z:4}]}},
]
const native=spawnSync(process.env.GARMENT_DRAPE_TEST||'/tmp/garment-native-live-drape-test',['--json-lines'],{input:cases.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',maxBuffer:1024*1024})
if(native.error)throw native.error
assert.equal(native.status,0,native.stderr)
const lines=native.stdout.trim().split('\n')
assert.equal(lines.length,cases.length)
function compare(a,b,path=''){
 if(typeof b==='number'){assert.ok(typeof a==='number'&&Math.abs(a-b)<1e-8,`${path}: ${a} != ${b}`);return}
 if(Array.isArray(b)){assert.equal(a.length,b.length,path);b.forEach((x,i)=>compare(a[i],x,path+'['+i+']'));return}
 if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const [k,v] of Object.entries(b))compare(a[k],v,path+'.'+k);return}
 assert.deepEqual(a,b,path)
}
let checked=0
for(let i=0;i<cases.length;i++){
 const expected=jsExpected(cases[i]),actual=JSON.parse(lines[i])
 assert.equal(actual.ok,true,'case '+i+' '+actual.error)
 compare(actual.result,expected,'case '+i);checked++
}
console.log(`live drape transfer JS/C++ snapshot adapter parity passed: ${checked} cases`)
