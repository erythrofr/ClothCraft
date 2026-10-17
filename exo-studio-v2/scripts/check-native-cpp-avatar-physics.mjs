import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import * as THREE from 'three'
import {getAvatarHeightScale,getAvatarUpperBodyDimensions,getAvatarArmPose,getAvatarTorsoRadii,boundaryIndicesForEdge,avatarClearance,measureAvatarSurfaceIntrusion} from '../src/core/physics.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-avatar-physics-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/avatar_physics.cpp','native_cpp/tests/test_avatar_physics.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const avatars=[{}, {heightCm:195,chestCm:115,shoulderWidthCm:52,neckCm:43,bicepCm:40,armLengthCm:80,waistCm:85,hipCm:102,armAngleDeg:35},{heightCm:145,chestCm:60,waistCm:30,hipCm:160,armAngleDeg:90},{heightCm:220,chestCm:150,waistCm:140,hipCm:70,armAngleDeg:-5}]
const cases=[]
for(const avatar of avatars){cases.push({op:'height',avatar},{op:'upper',avatar});for(const side of [-1,1])cases.push({op:'arm',avatar,side});for(const y of [.3,.65,1.08,1.24,1.45,1.57,1.95])cases.push({op:'torso',avatar,y});for(const position of [{x:0,y:1.25,z:0},{x:.25,y:1.58,z:.03},{x:0,y:1.85,z:0},{x:-.3,y:1.1,z:0},{x:0,y:.2,z:0},{x:.2,y:1.6,z:.12}])for(const particle of [null,{wrapMode:'front',patternV:.8,seamIds:['Shoulder']},{wrapMode:'left-arm',patternV:.95},{wrapMode:'back',patternV:.2}])cases.push({op:'clearance',avatar,position,particle})}
const piece={edgePaths:[[{x:0,y:0},{x:10,y:0},{x:10,y:10}]],flatVertices:[{x:10,y:8},{x:2,y:0},{x:10,y:0},{x:0,y:5},{x:9,y:2},{x:10,y:10},{x:0,y:0}]}
cases.push({op:'boundary',piece,edgeIndex:0},{op:'boundary',piece,edgeIndex:12})
const simulation={pieces:[{id:'front',particles:[{position:{x:-.1,y:1.2,z:0},patternV:.2,wrapMode:'front',seamIds:[]},{position:{x:.1,y:1.2,z:0},patternV:.2,wrapMode:'front',seamIds:[]},{position:{x:0,y:1.4,z:0},patternV:.5,wrapMode:'front',seamIds:[]}],faces:[[0,1,2]]}]}
for(const avatar of avatars)cases.push({op:'measure',avatar,simulation})
function convert(x){if(x instanceof THREE.Vector3)return {x:x.x,y:x.y,z:x.z};if(Array.isArray(x))return x.map(convert);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,convert(v)]));return x}
function expected(q){const a=q.avatar;switch(q.op){case 'height':return getAvatarHeightScale(a);case 'upper':return getAvatarUpperBodyDimensions(a);case 'arm':return getAvatarArmPose(a,q.side);case 'torso':return getAvatarTorsoRadii(a,q.y);case 'boundary':return boundaryIndicesForEdge({...q.piece,flatVertices:q.piece.flatVertices.map(p=>new THREE.Vector2(p.x,p.y))},q.edgeIndex);case 'clearance':return avatarClearance(new THREE.Vector3(q.position.x,q.position.y,q.position.z),a,q.particle);case 'measure':return measureAvatarSurfaceIntrusion({pieces:new Map(q.simulation.pieces.map(p=>[p.id,{...p,particles:p.particles.map(part=>({...part,position:new THREE.Vector3(part.position.x,part.position.y,part.position.z)}))}]))},a)}}
function compare(a,b,label){if(typeof a==='number'){assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b)),label+': '+a+' vs '+b);return}if(Array.isArray(a)){assert.equal(b.length,a.length,label);a.forEach((x,i)=>compare(x,b[i],label+'.'+i));return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),label);for(const k of Object.keys(a))compare(a[k],b[k],label+'.'+k);return}assert.deepEqual(b,a,label)}
const native=spawnSync(binary,[],{input:JSON.stringify({cases}),cwd:root,encoding:'utf8'})
assert.equal(native.status,0,native.stderr)
const results=JSON.parse(native.stdout);assert.equal(results.length,cases.length)
for(let i=0;i<cases.length;i++){assert.equal(results[i].ok,true,JSON.stringify(cases[i]));compare(convert(expected(cases[i])),results[i].result,cases[i].op+' '+i)}
console.log('Avatar native/JS parity passed: '+cases.length+' cases across seven exports. Avatar surface intrusion correction is validated separately on real and perturbed tee/pants fixtures.')
