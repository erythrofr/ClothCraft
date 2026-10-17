import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import * as geo from '../src/core/project.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const bin=resolve(mkdtempSync(resolve(tmpdir(),'project-geometry-')),'test')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/project_geometry.cpp','native_cpp/tests/test_project_geometry.cpp','-o',bin],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
function native(op,payload){const run=spawnSync(bin,[],{input:JSON.stringify({op,...payload})+'\n',encoding:'utf8'});assert.equal(run.status,0,run.stderr);const value=JSON.parse(run.stdout);assert.equal(value.ok,true,value.error);return value.result}
function compare(a,b,path='root'){if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(a),Math.abs(b)),path+' '+a+' vs '+b);return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),path+' keys');for(const k of Object.keys(a))compare(a[k],b[k],path+'.'+k);return}assert.deepEqual(b,a,path)}
let count=0
const pieces=[
 {id:'square',points:[{x:0,y:0,id:'p1'},{x:20,y:0},{x:20,y:15},{x:0,y:15}],seamAllowance:1},
 {id:'curved',points:[{x:0,y:0},{x:20,y:0},{x:20,y:15},{x:0,y:15}],curves:{0:{cx:10,cy:-8},2:{cx:10,cy:20}},seamAllowance:1.2,edgeSeamAllowances:{0:2.5,1:0,2:3}},
 {id:'clockwise',points:[{x:0,y:0},{x:0,y:15},{x:20,y:15},{x:20,y:0}],edgeSeamAllowances:{0:0.8,2:2}},
 {id:'triangle',points:[{x:0,y:0},{x:8,y:0},{x:2,y:12}],seamAllowance:0},
 {id:'degenerate',points:[{x:0,y:0},{x:0,y:0},{x:0,y:10},{x:5,y:10}],seamAllowance:2}
]
for(const piece of pieces){
 for(const op of ['polygonArea','pieceArea']){const args=op==='polygonArea'?{points:piece.points}:{piece};compare(op==='polygonArea'?geo.polygonArea(piece.points):geo.pieceArea(piece),native(op,args),op);count++}
 for(const segments of [4,8,12])for(const op of ['samplePieceBoundary','seamAllowanceBoundary']){compare(geo[op](piece,segments),native(op,{piece,segments}),op);count++}
 for(let edgeIndex=0;edgeIndex<piece.points.length;edgeIndex++){
  for(const op of ['sampleEdge','getEdgeSeamAllowance','edgeLength','facingGeometryForEdge']){compare(geo[op](piece,edgeIndex),native(op,{piece,edgeIndex,segments:8}),piece.id+'.'+op);count++}
  for(const fraction of [0,.13,.5,1]){compare(geo.edgePointAt(piece,edgeIndex,fraction),native('edgePointAt',{piece,edgeIndex,fraction}),piece.id+'.edgePointAt');count++}
  compare(geo.edgeRangeLength(piece,edgeIndex,.1,.75),native('edgeRangeLength',{piece,edgeIndex,start:.1,end:.75}),'edgeRangeLength');count++
  compare(geo.closestEdgeFraction(piece,edgeIndex,{x:5,y:3}),native('closestEdgeFraction',{piece,edgeIndex,point:{x:5,y:3},segments:40}),'closestEdgeFraction');count++
 }
}
const project={pieces}
compare(geo.projectArea(project),native('projectArea',{project}),'projectArea');count++
for(const pair of [[0,1],[1,2],[2,3]]){
 const seam={id:'seam-'+pair.join('-'),name:'Test seam',a:{pieceId:pieces[pair[0]].id,edgeIndex:0,startT:.1,endT:.8},b:{pieceId:pieces[pair[1]].id,edgeIndex:0,startT:.2,endT:.7},reverseB:true}
 compare(geo.seamLengthReport(project,seam),native('seamLengthReport',{project,seam}),'seamLengthReport');count++
 compare(geo.seamWalkReport(project,seam,9),native('seamWalkReport',{project,seam,sampleCount:9}),'seamWalkReport');count++
}
assert.ok(count>100)
console.log('Project geometry JS/C++ parity passed: '+count+' checks across all 14 exports')
