import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { inspectDraftTopology, isDraftEditValid } from '../src/core/draftingTopology.js'
import { unfoldDraftPiece } from '../src/core/draftingUnfold.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const output=resolve(mkdtempSync(resolve(tmpdir(),'gs-topology-parity-')),'runner')
const compile=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/drafting_topology.cpp','native_cpp/core/drafting_unfold.cpp','native_cpp/tests/test_drafting_topology_unfold.cpp','-o',output],{cwd:root,encoding:'utf8'})
if(compile.status!==0)throw new Error('C++ compilation failed: '+compile.stderr)
function native(mode,piece,extra={}) {
 const input={mode,piece,...extra}
 const run=spawnSync(output,[],{input:JSON.stringify(input)+'\n',encoding:'utf8',cwd:root})
 if(run.status!==0)throw new Error(run.stderr)
 return JSON.parse(run.stdout)
}
function compare(a,b,path='root'){
 if(typeof a==='number'&&typeof b==='number'){if(Math.abs(a-b)>1e-7*Math.max(1,Math.abs(a),Math.abs(b)))throw new Error(path+': '+a+' != '+b);return}
 if(Array.isArray(a)&&Array.isArray(b)){if(a.length!==b.length)throw new Error(path+' length mismatch');a.forEach((v,i)=>compare(v,b[i],path+'.'+i));return}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const keys=Object.keys(a).sort(),other=Object.keys(b).sort()
  if(JSON.stringify(keys)!==JSON.stringify(other))throw new Error(path+' keys: '+keys+' vs '+other)
  for(const k of keys)compare(a[k],b[k],path+'.'+k)
  return
 }
 if(a!==b)throw new Error(path+': '+JSON.stringify(a)+' != '+JSON.stringify(b))
}
const samples=[
 {name:'missing-points'},
 {name:'too-few',points:[{x:0,y:0},{x:1,y:1}]},
 {name:'bad-point',points:[{x:0,y:0},{x:8,y:0},{x:'bad',y:3}]},
 {name:'out-of-range',points:[{x:0,y:0},{x:100001,y:0},{x:0,y:8}]},
 {name:'triangle',points:[{x:0,y:0},{x:8,y:0},{x:0,y:8}]},
 {name:'square',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}]},
 {name:'bowtie',points:[{x:0,y:0},{x:8,y:8},{x:0,y:8},{x:8,y:0}]},
 {name:'curved',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:{0:{cx:4,cy:-2}}},
 {name:'coincident',points:[{x:0,y:0},{x:8,y:0},{x:8,y:0},{x:0,y:8}]},
 {name:'zero',points:[{x:0,y:0},{x:5,y:0},{x:8,y:0}]},
 {name:'bad-curve',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:{1:{cx:2}}},
 {name:'zero-control',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:{0:0}},
 {name:'null-control',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:{0:null}},
 {name:'array-control',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:[{cx:4,cy:-2}]},
 {name:'array-curve-intersection',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:[{cx:4,cy:18},{cx:10,cy:4}]},
 {name:'curved-inward',points:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],curves:{0:{cx:4,cy:6},2:{cx:4,cy:2}}},
 {name:'collinear-overlap',points:[{x:0,y:0},{x:8,y:0},{x:4,y:0},{x:4,y:8},{x:0,y:8}]}
]
let seed=0x13579bdf
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
for(let iteration=0;iteration<45;iteration++){
 const size=3+Math.floor(random()*7),rotation=random()*Math.PI*2
 const points=Array.from({length:size},(_,i)=>{
  const theta=rotation+i*2*Math.PI/size,radius=3+random()*7
  return {x:Math.cos(theta)*radius,y:Math.sin(theta)*radius}
 })
 if(iteration%3===0)points.reverse()
 const curves={}
 if(iteration%2===0){const a=points[0],b=points[1];curves[0]={cx:(a.x+b.x)/2+(random()-.5)*5,cy:(a.y+b.y)/2+(random()-.5)*5}}
 if(iteration%4===0){const a=points[1],b=points[2];curves[1]={cx:(a.x+b.x)/2+(random()-.5)*5,cy:(a.y+b.y)/2+(random()-.5)*5}}
 samples.push({name:'random-'+iteration,points,curves})
}
let checks=0
for(const piece of samples){
 for(const count of [4,16,24,63]){compare(inspectDraftTopology(piece,{curveSamples:count}),native('topology',piece,{options:{curveSamples:count}}).result,piece.name+' topology');checks++}
 for(const edit of [
  {pointIndex:1,point:{x:7,y:1}},
  {pointIndex:0,point:{x:-1,y:3}},
  {pointIndex:999,point:{x:2,y:3}},
  {pointIndex:1.5,point:{x:2,y:3}},
  {edgeIndex:0,curve:{cx:1,cy:-4}},
  {edgeIndex:0,curve:null},
  {edgeIndex:1,curve:null},
  {edgeIndex:0},
  {edgeIndex:999,curve:null},
  {edgeIndex:0,curve:{cx:1}},
  {}
 ]){compare(isDraftEditValid(piece,edit),native('edit',piece,{edit}).result,piece.name+' edit '+JSON.stringify(edit));checks++}
}
const half={id:'half',name:'Vest (half)',points:[{id:'a',x:0,y:0,gradeRule:{enabled:true,dxPerSize:1,dyPerSize:2}},{id:'b',x:0,y:12},{id:'c',x:8,y:12},{id:'d',x:8,y:0}],edgeSeamAllowances:{1:1.2,2:2},notches:[{id:'n',edgeIndex:1,t:.3}],internalLines:[{id:'line',a:{x:2,y:2},b:{x:6,y:9}}]}
for(const edge of [0,1,2,3]){
 let js,nat
 try{js={ok:true,result:unfoldDraftPiece(half,edge)}}catch(e){js={ok:false,error:e.message}}
 nat=native('unfold',half,{foldEdgeIndex:edge})
 compare(js,nat,'unfold edge '+edge);checks++
}
const bad={...half,locked:true}
compare({ok:false,error:'Unlock this pattern before unfolding'},native('unfold',bad,{foldEdgeIndex:0}),'locked unfold');checks++
const halfVariants=[
 half,
 {...half,name:'Curve Pattern (half)',curves:{1:{cx:4,cy:15}},notches:[{edgeIndex:2,t:.25,id:'notch-2',matchGroupId:'A',matchedSeamId:'B'}]},
 {...half,name:'Notched Fold',notches:[{id:'fold-notch',edgeIndex:0,t:.5}]},
 {...half,name:'Curved Fold',curves:{0:{cx:-2,cy:6}}},
 {...half,name:'Coincident Fold',points:[{x:0,y:0},{x:0,y:0},{x:8,y:12},{x:8,y:0}]},
 {...half,name:'Unlocked Fabric',edgeSeamAllowances:{0:null,1:0,2:2.5}},
 {...half,name:'Array Allowances',edgeSeamAllowances:[null,0,2.5]},
 {...half,name:'String Notch Index',notches:[{id:'string-notch',edgeIndex:'1',t:'0.3',matchGroupId:'A',matchedSeamId:'B'}]},
 {...half,name:'Locked String',locked:'yes'},
 {...half,name:'Generic Metadata',points:half.points.map((p,i)=>({...p,graded:true,gradeRule:{enabled:true,dxPerSize:i+1,dyPerSize:2*i-1}})),internalLines:[{id:'line',name:'Dart',a:{x:0,y:1},b:{x:0,y:9}},{name:'Guide',a:{x:1,y:1},b:{x:6,y:7}}]},
 {...half,name:'Truthy Grading Metadata',points:half.points.map((p,i)=>({...p,gradeRule:{enabled:'yes',dxPerSize:String(i+1),dyPerSize:String(2*i-1)}}))}
]
for(let i=0;i<halfVariants.length;i++)for(const edge of [0,1,2,3]){
 const piece=halfVariants[i]
 let js
 try{js={ok:true,result:unfoldDraftPiece(piece,edge)}}catch(e){js={ok:false,error:e.message}}
 compare(js,native('unfold',piece,{foldEdgeIndex:edge}),'variant '+i+' edge '+edge);checks++
}
for(const foldEdgeIndex of [-1,4,1.5,'0',null,true]){
 let js
 try{js={ok:true,result:unfoldDraftPiece(half,foldEdgeIndex)}}catch(e){js={ok:false,error:e.message}}
 compare(js,native('unfold',half,{foldEdgeIndex}),'invalid fold index '+JSON.stringify(foldEdgeIndex));checks++
}
assert.equal(checks,15*samples.length+4+1+4*halfVariants.length+6,'Expected topology, edit and unfold parity coverage')
console.log('Topology and unfold C++ parity passed: '+checks+' cases')
