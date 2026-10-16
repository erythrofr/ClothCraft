import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import * as THREE from 'three'
import {createGeometry,updateGeometryFabricUV,syncGeometry,syncAnalysisColors} from '../src/core/physics.js'
import {buildSimulation} from '../src/core/physics.js'
import {createTeeTemplate,createPantsTemplate} from '../src/data/templates.js'
const root=resolve(import.meta.dirname,'..'),binary=resolve(mkdtempSync(resolve(tmpdir(),'garment-geometry-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/geometry_buffer_adapter.cpp','native_cpp/tests/test_geometry_buffer_adapter.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const cases=[],expected=[]
const V=(x,y,z)=>new THREE.Vector3(x,y,z)
const capture=g=>({attributes:Object.fromEntries(['position','color','uv','normal'].filter(k=>g.getAttribute(k)).map(k=>{const a=g.getAttribute(k);return [k,{array:Array.from(a.array),itemSize:a.itemSize,count:a.count}]})),index:Array.from(g.index?.array||[]),groups:g.groups.map(x=>({...x}))})
for(const family of ['tee','pants']){
 const count=family==='tee'?6:8
 const particles=Array.from({length:count},(_,i)=>({position:V((i%3)*.12,Math.floor(i/3)*.13,(i%2)*.04),pressureIndex:i/(count-1),easeCm:i*.7,strain:i*.024}))
 const flatVertices=particles.map((p,i)=>({x:(i%3)*15,y:Math.floor(i/3)*20}))
 const faces=family==='tee'?[[0,1,3],[1,4,3],[1,2,4],[2,5,4]]:[[0,1,3],[1,4,3],[1,2,4],[2,5,4],[3,4,6],[4,7,6]]
 const fabric={texture:{repeatWidthCm:17,repeatHeightCm:29}}
 const piece={particles,flatVertices,faces,piece:{grainAngleDeg:34},fabric}
 const jsonPiece={...piece,particles:particles.map(p=>({...p,position:{...p.position}}))}
 const geometry=createGeometry(piece)
 cases.push({op:'create',piece:jsonPiece});expected.push(capture(geometry))
 const nextFabric={texture:{repeatWidthCm:8,repeatHeightCm:13}}
 assert.equal(updateGeometryFabricUV(piece,geometry,nextFabric),true)
 cases.push({op:'uv',piece:jsonPiece,geometry:expected.at(-1),fabric:nextFabric});expected.push({updated:true,geometry:capture(geometry)})
 for(const mode of ['surface','pressure','ease','strain']){
  const g=createGeometry(piece);syncAnalysisColors(piece,g,mode)
  cases.push({op:'colors',piece:jsonPiece,geometry:capture(createGeometry(piece)),mode});expected.push({updated:true,geometry:capture(g)})
 }
 const g=createGeometry(piece);const input=capture(g)
 for(const p of piece.particles)p.position.z+=.0125
 syncGeometry(piece,g,{simulation:{visualWrapAssist:false}})
 cases.push({op:'sync',piece:{...jsonPiece,particles:piece.particles.map(p=>({...p,position:{...p.position}}))},geometry:input,project:{simulation:{visualWrapAssist:false}}});expected.push({updated:true,geometry:{...capture(g),boundingSphere:{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius}}})
}
// Exercise actual triangulated garment parts produced by the application's solver.
for(const [label,template] of [['real-tee',createTeeTemplate],['real-pants',createPantsTemplate]]){
 const sim=buildSimulation(template())
 const piece=sim.pieces.values().next().value
 assert.ok(piece?.faces.length>0&&piece?.particles.length>3,label)
 const serialized={particles:piece.particles.map(p=>({position:{x:p.position.x,y:p.position.y,z:p.position.z}})),faces:piece.faces,flatVertices:piece.flatVertices,piece:{grainAngleDeg:piece.piece?.grainAngleDeg||0},fabric:piece.fabric}
 const geom=createGeometry(piece)
 cases.push({op:'create',piece:serialized});expected.push(capture(geom))
 const adjusted={texture:{repeatWidthCm:8,repeatHeightCm:12}}
 updateGeometryFabricUV(piece,geom,adjusted)
 cases.push({op:'uv',piece:serialized,geometry:capture(createGeometry(piece)),fabric:adjusted});expected.push({updated:true,geometry:capture(geom)})
 console.log(`${label} fixture: ${piece.particles.length} vertices, ${piece.faces.length} faces`)
}
const run=spawnSync(binary,[],{input:JSON.stringify({cases}),encoding:'utf8',maxBuffer:12*1024*1024})
assert.equal(run.status,0,run.stderr)
const results=JSON.parse(run.stdout);let comparisons=0
const compare=(a,b,path='')=>{if(typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-5*Math.max(1,Math.abs(b)),`${path} ${a} != ${b}`)}else if(Array.isArray(b)){assert.equal(a.length,b.length,path);b.forEach((v,i)=>compare(a[i],v,`${path}[${i}]`))}else if(b&&typeof b==='object'){for(const k of Object.keys(b))compare(a[k],b[k],`${path}.${k}`)}else assert.deepEqual(a,b,path)}
for(let i=0;i<cases.length;i++){assert.equal(results[i].ok,true,results[i].error);const result=results[i].result;compare(result,expected[i],`case ${i}`);comparisons++}
console.log(`geometry adapter C++/THREE parity: ${comparisons}/${cases.length} tee/pants synthetic mesh operations`)
