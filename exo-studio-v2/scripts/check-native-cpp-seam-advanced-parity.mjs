import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {assembleNativeSeams} from '../src/core/backends/seamAssembly.js'

// Invoke after rebuilding garment_cad_cli. This script intentionally does not
// silently accept unsupported operations or relax experimental safety flags.
const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
// The conversion coverage runner limits each parity script to two minutes.
// Keep its default lane short enough for CI; --full retains all 120 cases.
const full=process.argv.includes('--full')
const errors=[],stats={cases:0,passed:0,maxPositionDifferenceM:0}
const tolerance=1e-7
function near(a,b,path){
  if(typeof a==='number'&&typeof b==='number'){
    const diff=Math.abs(a-b)
    if(!Number.isFinite(diff)||diff>tolerance*Math.max(1,Math.abs(a),Math.abs(b)))
      errors.push({path,expected:a,actual:b,difference:diff})
  }else if(Array.isArray(a)&&Array.isArray(b)){
    if(a.length!==b.length)errors.push({path,expectedLength:a.length,actualLength:b.length})
    for(let i=0;i<Math.min(a.length,b.length);i++)near(a[i],b[i],`${path}[${i}]`)
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
    const keys=new Set([...Object.keys(a),...Object.keys(b)])
    for(const key of keys){
      if(!(key in a)||!(key in b))errors.push({path:`${path}.${key}`,missing:key in a?'native':'JS'})
      else near(a[key],b[key],`${path}.${key}`)
    }
  }else if(a!==b)errors.push({path,expected:a,actual:b})
}
function cli(document,payload,options){
 const input={protocol:'garment-studio.native-cad.v1',document,op:'seam-assemble-conventional',args:{payload,options}}
 const run=spawnSync(binary,[],{input:JSON.stringify(input)+'\n',encoding:'utf8',maxBuffer:128*1024*1024})
 if(run.error)throw run.error
 if(run.status!==0)throw Error(`CLI exited ${run.status}: ${run.stderr}`)
 const response=JSON.parse(run.stdout.trim())
 if(response.ok!==true)throw Error(`CLI rejected advanced mode: ${response.error}`)
 if(response.fitCertified!==false||response.fullExportParity!==false)
   throw Error('Native CLI incorrectly claims fit/full parity certification')
 return response.assembled
}
const baseOptions={seamStiffness:.3,restStiffness:.7,positionStiffness:.002,maxMoveM:.012}
const cases=[]
for(const iterations of (full?[0,1,4,6]:[0,4]))
 for(const seamPasses of (full?[1,2]:[1]))
  for(const mode of [
   {},{contactConstrained:true},{jointConstraintMode:true},
   {contactConstrained:true,jointConstraintMode:true}
  ])cases.push({iterations,seamPasses,...mode})
for(const contactMarginM of (full?[0,.001,.004,.012]:[0,.012])){
 cases.push({iterations:4,seamPasses:2,contactConstrained:true,contactMarginM})
 cases.push({iterations:4,seamPasses:2,jointConstraintMode:true,contactMarginM,jointContactWeight:.6})
}
for(const type of ['tee','pants','weighted-zipper']){
 const document=createTemplateProject(type==='weighted-zipper'?'tee':type)
 const payload=buildNativeSimulationPayload(document)
 if(type==='weighted-zipper'){
  const a=payload.pieces[0].particleIndices,b=payload.pieces[1].particleIndices
  payload.constraints.push({type:'seam',a:a[0],b:b[0],seamId:'synthetic-zipper-front'})
  payload.virtualSeams=[{seamId:'weighted-zipper',sourceIndices:[a[1],a[2]],
   sourceWeights:[.25,.75],targetIndices:[b[1],b[2]],targetWeights:[.6,.4],rest:.008}]
 }
 for(const spec of cases){
  const options={...baseOptions,...spec},prefix=`${type} ${JSON.stringify(spec)}`
  const immutablePayload=JSON.stringify(payload),immutableDocument=JSON.stringify(document)
  const prior=errors.length
  try{
   const js=assembleNativeSeams(payload,options),native=cli(document,payload,options)
   assert.equal(JSON.stringify(payload),immutablePayload,`JS mutated source: ${prefix}`)
   assert.equal(JSON.stringify(document),immutableDocument,`JS mutated document: ${prefix}`)
   near(js.particles.map(x=>x.position),native.particles.map(x=>x.position),`${prefix}.particles.position`)
   near(js.particles.map(x=>x.previous),native.particles.map(x=>x.previous),`${prefix}.particles.previous`)
   near(js.initialAssembly,native.initialAssembly,`${prefix}.initialAssembly`)
   near(js.assemblyExperiment,native.assemblyExperiment,`${prefix}.assemblyExperiment`)
   for(let p=0;p<js.particles.length;p++)for(let axis=0;axis<3;axis++){
    const diff=Math.abs(js.particles[p].position[axis]-native.particles[p].position[axis])
    stats.maxPositionDifferenceM=Math.max(stats.maxPositionDifferenceM,diff)
   }
   if(native.assemblyExperiment.collisionCertified!==false||
      native.assemblyExperiment.safeToAutoApply!==false||
      native.assemblyExperiment.enabledForProduction!==false)
    errors.push({path:`${prefix}.certification`,actual:native.assemblyExperiment})
  }catch(error){errors.push({path:prefix,error:String(error)})}
  stats.cases++
  if(errors.length===prior)stats.passed++
  else if(errors.length<30)console.error('MISMATCH',JSON.stringify(errors.slice(prior,prior+4)))
 }
}
console.log(JSON.stringify({binary,mode:full?'full-120-fixtures':'bounded-ci-fixtures',
  stats,mismatchCount:errors.length,firstErrors:errors.slice(0,25),
  physicalFitCertified:false},null,2))
if(errors.length)process.exitCode=1
