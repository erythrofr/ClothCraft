import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {assembleNativeSeams,inspectStagedAvatarContact} from '../src/core/backends/seamAssembly.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-native-seam-')),'runner')
const build=spawnSync('clang++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/native_seam_assembly.cpp','native_cpp/tests/test_native_seam_assembly.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
function native(mode,payload,options={}){const p=spawnSync(binary,[],{input:JSON.stringify({mode,payload,options})+'\n',encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout)}
function compare(a,b,path='root'){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),path+': '+a+' != '+b);return}
 if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),path+' keys');for(const k of Object.keys(a))compare(a[k],b[k],path+'.'+k);return}
 assert.deepEqual(b,a,path)
}
const create=(virtual=false)=>({
 avatar:{heightCm:180},
 particles:[
 {id:0,pieceId:'front',position:[3,3,2],previous:[3,3,2],invMass:1,wrapMode:'front'},
 {id:1,pieceId:'front',position:[3.2,3,2],previous:[3.2,3,2],invMass:1,wrapMode:'front'},
 {id:2,pieceId:'front',position:[3,3.2,2],previous:[3,3.2,2],invMass:1,wrapMode:'front'},
 {id:3,pieceId:'back',position:[3.5,3,2],previous:[3.5,3,2],invMass:1,wrapMode:'back'},
 {id:4,pieceId:'back',position:[3.7,3,2],previous:[3.7,3,2],invMass:1,wrapMode:'back'},
 {id:5,pieceId:'back',position:[3.5,3.2,2],previous:[3.5,3.2,2],invMass:0,wrapMode:'back'},
 ],
 pieces:[
 {id:'front',particleIndices:[0,1,2],flatVerticesM:[[0,0,0],[.2,0,0],[0,.2,0]],faces:[[0,1,2]]},
 {id:'back',particleIndices:[3,4,5],flatVerticesM:[[0,0,0],[.2,0,0],[0,.2,0]],faces:[[0,1,2]]}
 ],
 constraints:[{type:'seam',a:1,b:3,seamId:'zipper'},{type:'seam',a:2,b:5,seamId:'shoulder'}],
 virtualSeams:virtual?[{seamId:'weighted',sourceIndices:[0,1],sourceWeights:[.25,.75],targetIndices:[3,4],targetWeights:[.6,.4],rest:.008}]:[]
})
let comparisons=0
for(const virtual of [false,true])for(const options of [
 {iterations:0},{iterations:1},{iterations:4,seamPasses:1},
 {iterations:8,seamStiffness:.6,restStiffness:.4,positionStiffness:0},
 {iterations:14,maxMoveM:.003,seamPasses:3},
 ]){
 const payload=create(virtual),source=structuredClone(payload)
 const expected=assembleNativeSeams(payload,options)
 const actual=native('assemble',payload,options)
 assert.equal(actual.ok,true,actual.error)
 compare(expected,actual.result,'assemble '+virtual+' '+JSON.stringify(options))
 assert.deepEqual(payload,source,'source input mutated')
 comparisons++
}
for(const payload of [create(false),create(true)]){
 const expected=inspectStagedAvatarContact(payload)
 const actual=native('inspect',payload)
 assert.equal(actual.ok,true)
 compare(expected,actual.result,'nonpenetrating inspection')
 comparisons++
}
for(const options of [{iterations:-4},{iterations:1002,seamPasses:0,positionStiffness:0},{iterations:2,seamPasses:0}]) {
 const input=create(true),source=structuredClone(input)
 const expected=assembleNativeSeams(input,options)
 const actual=native('assemble',input,options)
 assert.equal(actual.ok,true,actual.error)
 compare(expected,actual.result,'iteration limits '+JSON.stringify(options))
 assert.deepEqual(input,source)
 comparisons++
}
for(const options of [{jointConstraintMode:true},{contactConstrained:true}]){
 const actual=native('assemble',create(),options)
 assert.equal(actual.ok,false,'unsupported solver mode must be rejected explicitly')
 assert.match(actual.error,/require a supplied full avatar solver adapter/)
}
console.log('Native seam assembly JS/C++ parity passed: '+comparisons+' fixtures (unconstrained iterative seam/rest projection, virtual anchors, stable source, and nonpenetrating contact diagnostics)')
