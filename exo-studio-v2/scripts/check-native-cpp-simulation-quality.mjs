import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {assessSimulationFit} from '../src/core/physics/qualityGate.js'
import {inspectClothMesh} from '../src/core/physics/meshQuality.js'
import {resolveSolverTimestep} from '../src/core/physics/timestep.js'
const cases=[]
for(const strain of [undefined,0,15,15.01,100,'bad',null])
 for(const seam of [undefined,0,5,5.1,'bad'])
  cases.push({op:'fit',quality:{structural:{maxStrainPercent:strain},sewing:{maxGapMm:seam},
   collision:{triangleCcdVerified:true,allFrameIntersectionFree:true,maximumIntrusionMm:.2}}})
for(const intrusion of [undefined,null,0,.5,.51,'bad'])
 for(const cert of [true,false])
  cases.push({op:'fit',quality:{structural:{maxStrainPercent:0},sewing:{maxGapMm:0},
    collision:{triangleCcdVerified:cert,allFrameIntersectionFree:cert,maximumIntrusionMm:intrusion}}})
cases.push({op:'fit',quality:{structural:{maxStrainPercent:18},sewing:{maxGapMm:6},
collision:{maximumIntrusionMm:2}},options:{maximumStructuralStrainPercent:25,maximumSeamGapMm:7,maximumPenetrationMm:3}})
const vertices=[[0,0],[1,0],[0,1],[2,0],[0,0],[4,0],[0,.00001]]
for(const faces of [[],[[0,1,2]],[[0,1,3]],[[0,4,4]],[[0,5,6]],[[0,1,2],[0,5,6]],[[0,9,2]],[[0,1]],[[0,-1,2]]])
 for(const options of [{},{aspectLimit:1,minimumAltitudeCm:1,worstCount:2}])
  cases.push({op:'mesh',vertices,faces,options})
for(const dt of [0,1/60,1/15,1/100,-.1])
 for(const settings of [{},{substeps:3,iterations:12,gravity:0},{substeps:4,iterations:14,selfCollisionMargin:.08},{substeps:0,iterations:0},{gravity:-1},{selfCollisionMargin:-1}])
  cases.push({op:'timestep',dt,settings,maxThickness:.004})
function expected(c){try {
 let result
 if(c.op==='fit')result=assessSimulationFit(c.quality,c.options)
 if(c.op==='mesh')result=inspectClothMesh(c.vertices,c.faces,c.options)
 if(c.op==='timestep')result=resolveSolverTimestep(c.settings,c.dt,c.maxThickness)
 return {ok:true,result:JSON.parse(JSON.stringify(result))}
}catch{return {ok:false}}}
const runner=process.env.GARMENT_SIMULATION_QUALITY_TEST||'/tmp/garment-native-simulation-quality-test'
const execution=spawnSync(runner,['--json-lines'],{input:cases.map(c=>JSON.stringify(c)).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024})
if(execution.error)throw execution.error
assert.equal(execution.status,0,execution.stderr)
const lines=execution.stdout.trim().split('\n')
assert.equal(lines.length,cases.length)
function compare(a,b,path='result'){
 if(typeof b==='number'){assert.ok(typeof a==='number'&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${path}: ${a} !== ${b}`);return}
 if(Array.isArray(b)){assert.equal(a.length,b.length,path);b.forEach((v,i)=>compare(a[i],v,`${path}[${i}]`));return}
 if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const k of Object.keys(b))compare(a[k],b[k],`${path}.${k}`);return}
 assert.deepEqual(a,b,path)
}
cases.forEach((c,i)=>{const actual=JSON.parse(lines[i]),want=expected(c);assert.equal(actual.ok,want.ok,`case ${i}`);if(want.ok)compare(actual.result,want.result,`case ${i}`)})
console.log(`native simulation quality parity passed: ${cases.length} JS/C++ cases`)
