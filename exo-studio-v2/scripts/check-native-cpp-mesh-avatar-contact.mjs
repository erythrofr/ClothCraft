import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import * as THREE from 'three'
import {createAvatarMeshCollider,selectAvatarBodyMeshes,sampleMeshContact,correctMeshAvatarContacts} from '../src/core/meshAvatarContact.js'
const vertices=[[0,0,0],[.1,0,0],[0,.1,0]]
const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial())
mesh.name='Body';mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));mesh.geometry.setIndex([0,1,2])
const group=new THREE.Group();group.add(mesh)
const jsonAvatar={meshes:[{name:'Body',vertices,faces:[[0,1,2]]}]}
const collider=createAvatarMeshCollider(group)
assert.ok(collider)
const cases=[
 {op:'create',avatar:jsonAvatar},
 {op:'create',avatar:jsonAvatar,options:{maxTriangles:0}},
 {op:'select',avatar:jsonAvatar,model:'clo-thomas'},
 {op:'select',avatar:jsonAvatar,model:'other'},
 ...[[.03,.03,.002],[.03,.03,-.002],[.03,.03,.02],[.2,.2,.1]].map(point=>({op:'sample',collider:{triangles:[vertices],bounds:{min:[0,0,0],max:[.1,.1,0]}},point})),
 {op:'correct',collider:{triangles:[vertices],bounds:{min:[0,0,0],max:[.1,.1,0]}},simulation:{pieces:{a:{particles:[{position:{x:.03,y:.03,z:.001},previous:{x:.03,y:.03,z:.001},invMass:1},{position:{x:.02,y:.02,z:.001},previous:{x:.02,y:.02,z:.001},invMass:0}]}}}},
]
const res=spawnSync(process.env.GARMENT_MESH_AVATAR_TEST||'/tmp/garment-native-mesh-avatar-test',['--json-lines'],{input:cases.map(JSON.stringify).join('\n')+'\n',encoding:'utf8'})
if(res.error)throw res.error
assert.equal(res.status,0,res.stderr)
const lines=res.stdout.trim().split('\n')
assert.equal(lines.length,cases.length)
let matched=0
function near(a,b,where=''){if(typeof b==='number'){assert.ok(Math.abs(a-b)<2e-6,`${where}: ${a} vs ${b}`)}else if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((v,i)=>near(a[i],v,where+i))}else if(b&&typeof b==='object'){for(const k of Object.keys(b))near(a[k],b[k],where+'.'+k)}else assert.deepEqual(a,b,where)}
for(let i=0;i<cases.length;i++){
 const c=cases[i],out=JSON.parse(lines[i]);assert.equal(out.ok,true,out.error)
 if(c.op==='create'){const expected=c.options?.maxTriangles===0?null:{triangleCount:1,skippedMeshes:0};if(expected)near(out.result,expected);else assert.equal(out.result,null);matched++}
 if(c.op==='select'){const expected=selectAvatarBodyMeshes(group,c.model);assert.equal(out.result.mode,expected.mode);assert.deepEqual(out.result.names,expected.names);matched++}
 if(c.op==='sample'){const p=new THREE.Vector3(...c.point);const expected=sampleMeshContact(collider,p);if(expected===null)assert.equal(out.result,null);else near(out.result,{inside:expected.inside,distance:expected.distance,intrusion:expected.intrusion,nearest:expected.nearest.toArray(),direction:expected.direction.toArray()});matched++}
 if(c.op==='correct'){
  const s={pieces:new Map(Object.entries(c.simulation.pieces).map(([id,p])=>[id,{particles:p.particles.map(v=>({...v,position:new THREE.Vector3(v.position.x,v.position.y,v.position.z),previous:new THREE.Vector3(v.previous.x,v.previous.y,v.previous.z)}))}]))}
  const expected=correctMeshAvatarContacts(s,collider);near(out.result.stats,expected);matched++
 }
}
console.log(`mesh avatar contact C++/THREE parity: ${matched}/${cases.length} representative fixtures`)
collider.dispose()
