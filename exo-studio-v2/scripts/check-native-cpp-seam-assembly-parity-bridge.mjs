import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {assembleNativeSeams,inspectStagedAvatarContact} from '../src/core/backends/seamAssembly.js'

const binary='/tmp/garment-seam-assembly-parity-bridge-test'
const build=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor',
 'native_cpp/core/seam_assembly_parity_bridge.cpp','native_cpp/core/native_seam_assembly.cpp',
 'native_cpp/core/seam_assembly_advanced.cpp',
 'native_cpp/core/avatar_physics.cpp','native_cpp/tests/test_seam_assembly_parity_bridge.cpp',
 '-o',binary],{encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
function native(payload,options={},mode='assemble'){
 const p=spawnSync(binary,{input:JSON.stringify({payload,options,mode})+'\n',encoding:'utf8',maxBuffer:64*1024*1024})
 assert.equal(p.status,0,p.stderr)
 return JSON.parse(p.stdout.trim())
}
for(const name of ['tee','pants']){
 const project=createTemplateProject(name),payload=buildNativeSimulationPayload(project)
 const jsInspect=inspectStagedAvatarContact(payload)
 const cInspect=native(payload,{},'inspect')
 assert.equal(cInspect.ok,true,cInspect.error)
 const contactFields=['checked','penetrating','maximumIntrusionMm','sampledAvatarClearanceOnly','sweptCollisionCertified']
 const contactParity=contactFields.filter(field=>typeof jsInspect[field]==='number'?Math.abs(jsInspect[field]-cInspect.result[field])<=.01:jsInspect[field]===cInspect.result[field])
 const options={iterations:6,seamStiffness:.3,restStiffness:.7,positionStiffness:.002,maxMoveM:.012,seamPasses:2}
 const js=assembleNativeSeams(payload,options),cpp=native(payload,options)
 assert.equal(cpp.ok,true,cpp.error)
 let sumSquared=0,maxDifference=0
 for(let i=0;i<js.particles.length;i++){
  const a=js.particles[i].position,b=cpp.result.particles[i].position
  const error=Math.hypot(...a.map((v,j)=>v-b[j]))
  sumSquared+=error*error;maxDifference=Math.max(maxDifference,error)
 }
 const rms=Math.sqrt(sumSquared/js.particles.length)
 assert.ok(rms<1e-10,`${name} conventional assembled positions diverged: ${rms}`)
 assert.equal(contactParity.length,contactFields.length,`${name} contact diagnostics diverged`)
 const metrics=['initialSeamGapMaximumMm','initialSeamGapAverageMm','initialMeshPeakEdgeStrainPercent']
 const differences=Object.fromEntries(metrics.map(k=>[k,{js:js.initialAssembly[k],native:cpp.result.initialAssembly[k],difference:cpp.result.initialAssembly[k]-js.initialAssembly[k]}]))
 for(const k of metrics)assert.ok(Math.abs(differences[k].difference)<=.01,`${name} ${k} diverged`)
 assert.deepEqual(cpp.result.assemblyExperiment.collision,js.assemblyExperiment.collision)
 assert.deepEqual(cpp.result.initialAssembly,js.initialAssembly)
 console.log(JSON.stringify({name,particles:js.particles.length,inspect:{js:jsInspect,native:cInspect.result,matchingFields:contactParity.length,totalFields:contactFields.length},assembly:{rmsPositionErrorM:rms,maxPositionErrorM:maxDifference,metrics:differences,jsCollision:js.assemblyExperiment.collision,nativeCollision:cpp.result.assemblyExperiment.collision},fullExportParity:false}))
 assert.equal(cpp.result.assemblyExperiment.collisionCertified,false)
 assert.equal(cpp.result.assemblyExperiment.safeToAutoApply,false)
 for(const advanced of [{contactConstrained:true},{jointConstraintMode:true},
   {contactConstrained:true,jointConstraintMode:true}]){
   const opts={...options,...advanced}
   const want=assembleNativeSeams(payload,opts)
   const got=native(payload,opts)
   assert.equal(got.ok,true,got.error)
   assert.equal(got.result.assemblyExperiment.contactConstrained,Boolean(advanced.contactConstrained))
   assert.equal(got.result.assemblyExperiment.jointConstraintMode,Boolean(advanced.jointConstraintMode))
   assert.equal(got.result.assemblyExperiment.collisionCertified,false)
   for(let index=0;index<want.particles.length;index++)
     for(let axis=0;axis<3;axis++)
       assert.ok(Math.abs(got.result.particles[index].position[axis]-
         want.particles[index].position[axis])<1e-7,
         name+' '+JSON.stringify(advanced)+' particle '+index+' axis '+axis)
   assert.deepEqual(got.result.initialAssembly,want.initialAssembly)
   assert.deepEqual(got.result.assemblyExperiment,want.assemblyExperiment)
 }
}

// Synthetic zipper and weighted virtual seam exercise the less common
// constraint paths while keeping a real template avatar and mesh geometry.
const synthetic=buildNativeSimulationPayload(createTemplateProject('tee'))
const baseline=structuredClone(synthetic)
const first=synthetic.pieces[0].particleIndices
const second=synthetic.pieces[1].particleIndices
const [a,b]=[first[0],second[0]]
synthetic.constraints.push({type:'seam',a,b,seamId:'synthetic-zipper-front'})
synthetic.virtualSeams=[{
 seamId:'synthetic-weighted-zipper',sourceIndices:[first[1],first[2]],
 sourceWeights:[.25,.75],targetIndices:[second[1],second[2]],
 targetWeights:[.6,.4],rest:.008,
}]
for(const options of [
 {iterations:1,seamPasses:1},
 {iterations:9,seamPasses:3,positionStiffness:0},
 {iterations:0},
 {iterations:4,seamStiffness:.55,restStiffness:.25,maxMoveM:.003},
]){
 const snapshot=structuredClone(synthetic)
 const js=assembleNativeSeams(synthetic,options)
 const cpp=native(synthetic,options)
 assert.equal(cpp.ok,true,cpp.error)
 assert.deepEqual(synthetic,snapshot,'JavaScript must preserve the source payload')
 assert.deepEqual(baseline.particles,synthetic.particles,'synthetic constraints must not mutate existing particles')
 let maxDifference=0
 for(let i=0;i<js.particles.length;i++){
  const diff=Math.hypot(...js.particles[i].position.map((v,j)=>v-cpp.result.particles[i].position[j]))
  maxDifference=Math.max(maxDifference,diff)
  assert.ok(diff<1e-10,`synthetic particle ${i} diverged by ${diff}m`)
  assert.deepEqual(cpp.result.particles[i].previous,cpp.result.particles[i].position)
 }
 assert.deepEqual(cpp.result.initialAssembly,js.initialAssembly)
 assert.deepEqual(cpp.result.assemblyExperiment.collision,js.assemblyExperiment.collision)
 console.log(JSON.stringify({fixture:'synthetic-zipper-virtual-seam',options,maxPositionErrorM:maxDifference,fullExportParity:false}))
}

// Failure contracts are explicit. Missing geometry and out-of-range particle
// references must fail instead of generating a plausible-looking staged pose.
for(const invalid of [
 {payload:{particles:[],constraints:[],avatar:synthetic.avatar},error:/pieces/},
 {payload:{...synthetic,constraints:[{type:'seam',a:-1,b:9999,seamId:'bad'}]},error:/./},
]){
 const actual=native(invalid.payload,{iterations:0})
 assert.equal(actual.ok,false,'invalid input was accepted')
 assert.match(actual.error,invalid.error)
}
console.log(JSON.stringify({invalidFixtures:2,advancedContactModes:'tested on tee/pants with JS parity',fitCertified:false}))
