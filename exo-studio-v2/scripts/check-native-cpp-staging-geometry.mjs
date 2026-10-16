import assert from 'node:assert/strict'
import * as THREE from 'three'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {stagedPanelPositions,setStagedGeometry} from '../src/core/staging.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const executable=resolve(mkdtempSync(resolve(tmpdir(),'gs-staging-')),'runner')
const compile=spawnSync('clang++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/staging_geometry.cpp','native_cpp/tests/test_staging_geometry.cpp','-o',executable],{cwd:root,encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
function native(op,data){const p=spawnSync(executable,[],{input:JSON.stringify({op,...data})+'\n',encoding:'utf8'});assert.equal(p.status,0,p.stderr);const parsed=JSON.parse(p.stdout);assert.equal(parsed.ok,true,parsed.error);return parsed.result}
function close(a,b,label){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=2e-7*Math.max(1,Math.abs(a),Math.abs(b)),label+' '+a+' vs '+b);return}
 if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label+' keys');for(const k of Object.keys(a))close(a[k],b[k],label+'.'+k);return}
 assert.deepEqual(b,a,label)
}
let checks=0
const flats=[{x:-20,y:0},{x:20,y:0},{x:20,y:55},{x:-20,y:55},{x:0,y:20}]
const wraps=['flat','front','back','lower-front','lower-back','left-arm','right-arm','left-leg-front','left-leg-back','right-leg-front','right-leg-back','hood-left','hood-right','neck','waist-band','left-wrist','right-wrist']
for(const wrap of wraps)for(const heightCm of [120,180,250])for(const rotated of [false,true]){
 const simPiece={flatVertices:flats,piece:{arrangement3d:{wrap,x:.04,y:.9,z:.03,flip:true,stagingOffsetX:.015,stagingOffsetY:-.025,stagingOffsetZ:.04,...(rotated?{stagingRotationX:14,stagingRotationY:42,stagingRotationZ:-33}:{})}}}
 const avatar={heightCm};const source=structuredClone(simPiece)
 const expected=stagedPanelPositions(simPiece,avatar).map(v=>({x:v.x,y:v.y,z:v.z}))
 close(expected,native('positions',{simPiece,avatar}),wrap+' '+heightCm)
 assert.deepEqual(simPiece,source);checks++
}
for(const empty of [{piece:{},flatVertices:[]},{piece:{},flatVertices:null}]){
 close(stagedPanelPositions(empty),native('positions',{simPiece:empty}),'empty');checks++
}
const points=[{x:0,y:1,z:2},{x:3,y:4,z:5},{x:-2,y:6,z:8}]
const fitted=points.map(p=>({x:p.x+1,y:p.y-2,z:p.z+3}))
for(const blend of [-1,0,.25,1,2])for(const count of [2,3]){
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3))
 const success=setStagedGeometry(geometry,points,fitted,blend)
 const adapter={attributes:{position:{array:Array(count*3).fill(0),count}}}
 const cpp=native('geometry',{geometry:adapter,positions:points,fitted,blend})
 assert.equal(cpp.success,success)
 if(success){
  const expected=Array.from(geometry.getAttribute('position').array)
  const actual=cpp.geometry.attributes.position.array.map(v=>Math.fround(v))
  close(expected,actual,'geometry')
  assert.equal(cpp.geometry.attributes.position.needsUpdate,true)
  assert.equal(cpp.geometry.computedVertexNormals,true)
  assert.equal(cpp.geometry.computedBoundingSphere,true)
 }else assert.deepEqual(cpp.geometry,adapter)
 checks++
}
assert.equal(checks,114)
console.log('Staging C++/THREE.js parity passed: '+checks+' fixtures; transform and BufferGeometry adapter')
