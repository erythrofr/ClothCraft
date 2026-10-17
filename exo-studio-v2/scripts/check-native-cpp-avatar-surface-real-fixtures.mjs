import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import * as THREE from 'three'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,correctAvatarSurfaceIntrusion} from '../src/core/physics.js'

const binary=process.env.GARMENT_CPP_AVATAR_CORRECTION_TEST||resolve(mkdtempSync(resolve(tmpdir(),'gs-surface-real-')),'runner')
if(!process.env.GARMENT_CPP_AVATAR_CORRECTION_TEST){
 const build=spawnSync(process.env.CXX||'c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core',
 'native_cpp/core/avatar_physics.cpp','native_cpp/core/avatar_surface_correction.cpp',
 'native_cpp/tests/test_avatar_surface_correction.cpp','-o',binary],{encoding:'utf8'})
 assert.equal(build.status,0,build.stderr)
}
const plainVec=v=>({x:v.x,y:v.y,z:v.z})
const initialCases=[]
for(const name of ['tee','pants']){
  const project=createTemplateProject(name)
  const simulation=buildSimulation(project)
  const pieces=[...simulation.pieces.values()].map(piece=>({
    id:piece.id,
    fabric:piece.fabric,
    faces:piece.faces,
    particles:piece.particles.map(particle=>({...particle,
      position:plainVec(particle.position),
      previous:plainVec(particle.previous)}))
  }))
  initialCases.push({project,simulation:{pieces},options:{},name})
  const perturbed=structuredClone(pieces)
  for(const piece of perturbed)for(let i=0;i<piece.particles.length;i++){
    // Intentionally stage particles nearer the body to exercise correction.
    if(i%5===0){
      piece.particles[i].position.z*=.18
      piece.particles[i].previous.z*=.18
    }
  }
  initialCases.push({project,simulation:{pieces:perturbed},options:{maxCorrectionM:.003},name:name+'-perturbed'})
}
function jsRun(c){
  const simulation={pieces:new Map(c.simulation.pieces.map(piece=>[piece.id,{
    ...piece,particles:piece.particles.map(particle=>({...particle,
      position:new THREE.Vector3(...['x','y','z'].map(axis=>particle.position[axis])),
      previous:new THREE.Vector3(...['x','y','z'].map(axis=>particle.previous[axis]))
    }))
  }]))}
  const result=correctAvatarSurfaceIntrusion(simulation,c.project,c.options)
  return {result,simulation:{pieces:[...simulation.pieces.values()].map(piece=>({
    ...piece,particles:piece.particles.map(particle=>({...particle,
      position:plainVec(particle.position),previous:plainVec(particle.previous)}))
  }))}}
}
function compare(a,b,path='root'){
  if(typeof b==='number'){
    assert.ok(typeof a==='number'&&Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b)),
      `${path}: C++ ${a} vs JS ${b}`)
    return
  }
  if(Array.isArray(b)){
    assert.ok(Array.isArray(a),path)
    assert.equal(a.length,b.length,path+'.length')
    b.forEach((value,i)=>compare(a[i],value,path+'['+i+']'))
    return
  }
  if(b&&typeof b==='object'){
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path+'.keys')
    for(const [key,value] of Object.entries(b))compare(a[key],value,path+'.'+key)
    return
  }
  assert.deepEqual(a,b,path)
}
const before=JSON.stringify(initialCases)
const child=spawnSync(binary,[],{
  input:JSON.stringify({cases:initialCases})+'\n',
  encoding:'utf8',maxBuffer:64*1024*1024})
if(child.error)throw child.error
assert.equal(child.status,0,child.stderr)
const answers=child.stdout.trim().split('\n').map(JSON.parse)
assert.equal(answers.length,initialCases.length)
for(let i=0;i<initialCases.length;i++){
  const expected=jsRun(initialCases[i])
  compare(answers[i],expected,initialCases[i].name)
  const request={protocol:'garment-studio.native-cad.v1',
    document:initialCases[i].project,op:'avatar-surface-correct-proxy',
    args:{simulation:initialCases[i].simulation,options:initialCases[i].options}}
  const integrated=spawnSync(process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli',
    [],{input:JSON.stringify(request)+'\n',encoding:'utf8',maxBuffer:64*1024*1024})
  if(integrated.error)throw integrated.error
  assert.equal(integrated.status,0,integrated.stderr)
  const response=JSON.parse(integrated.stdout.trim())
  assert.equal(response.ok,true,response.error)
  assert.equal(response.fitCertified,false)
  compare(response.stats,expected.result,initialCases[i].name+'.cli.stats')
  compare(response.simulation,expected.simulation,initialCases[i].name+'.cli.simulation')
  console.log(JSON.stringify({fixture:initialCases[i].name,
    correctedFaces:answers[i].result.correctedFaces,
    correctedVertices:answers[i].result.correctedVertices,
    accepted:answers[i].result.accepted,
    faceIntrusionsAfter:answers[i].result.after.penetratingFaces}))
}
assert.equal(JSON.stringify(initialCases),before,'fixture input mutated')
console.log('Native C++/JS real T-shirt/pants avatar surface correction parity passed')
