import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {optimizeTriangleQuality} from '../src/core/physics/qualityTriangulation.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const runner=resolve(mkdtempSync(resolve(tmpdir(),'gs-quality-parity-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/quality_triangulation.cpp','native_cpp/tests/test_quality_triangulation.cpp','-o',runner],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const native=(mesh,options={})=>{
  const process=spawnSync(runner,[],{input:JSON.stringify({mesh,options})+'\n',encoding:'utf8'})
  assert.equal(process.status,0,process.stderr)
  return JSON.parse(process.stdout)
}
function boundary(faces){
  const count=new Map()
  for(const [a,b,c] of faces)for(const [u,v] of [[a,b],[b,c],[c,a]]){
    const key=[Math.min(u,v),Math.max(u,v)].join(':')
    count.set(key,(count.get(key)||0)+1)
  }
  return [...count].filter(([,n])=>n===1).map(([key])=>key).sort()
}
const cases=[
  {name:'square',vertices:[[0,0],[5,0],[5,3],[0,3]],faces:[[0,1,2],[0,2,3]]},
  {name:'convex-skew',vertices:[[0,0],[7,0],[5,1],[0,5]],faces:[[0,1,2],[0,2,3]]},
  {name:'concave',vertices:[[0,0],[6,0],[2,2],[6,6],[0,6]],faces:[[0,1,2],[0,2,4],[2,3,4]]},
  {name:'degenerate',vertices:[[0,0],[1,0],[2,0],[0,4]],faces:[[0,1,2],[0,2,3]]},
  {name:'nonmanifold',vertices:[[0,0],[4,0],[2,3],[2,-3],[2,1]],faces:[[0,1,2],[1,0,3],[0,1,4]]},
  {name:'metadata',vertices:[{x:0,y:0,id:'a'},{x:10,y:0},{x:7,y:2},{x:0,y:10}],faces:[[0,1,2],[0,2,3]]},
  {name:'empty',vertices:[],faces:[]},
]
let seed=0x13579bdf
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296}
for(let n=0;n<90;n++){
 const sides=3+Math.floor(random()*8)
 const angles=Array.from({length:sides},(_,i)=>(i+(random()-.5)*.25)*2*Math.PI/sides)
 const vertices=angles.map(t=>{const radius=2+random()*10;return [Math.cos(t)*radius,Math.sin(t)*radius]})
 const faces=Array.from({length:sides-2},(_,i)=>random()<.5?[0,i+1,i+2]:[0,i+2,i+1])
 cases.push({name:'random-'+n,vertices,faces})
}
let checks=0,flipped=0
for(const mesh of cases)for(const options of [{},{passes:0},{passes:1},{passes:8,minImprovement:.1},{passes:3,minImprovement:0}]){
 const js=optimizeTriangleQuality(mesh,options),cpp=native(mesh,options)
 assert.equal(cpp.ok,true,mesh.name+': '+cpp.error)
 assert.deepEqual(cpp.result,js,mesh.name+' '+JSON.stringify(options))
 assert.deepEqual(boundary(cpp.result.faces),boundary(mesh.faces),mesh.name+' boundary changed')
 assert.deepEqual(cpp.result.vertices,mesh.vertices,mesh.name+' vertex metadata changed')
 checks++;flipped+=cpp.result.flips
}
console.log('Quality triangulation parity passed: '+checks+' JS/native fixtures; '+cases.length+' meshes, '+flipped+' total flips across options; boundaries and vertex metadata preserved')
