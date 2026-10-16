import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,refreshSimulationAnalysis} from '../src/core/physics.js'
const tests=[]
for(const type of ['tee','pants','perturbed-tee']){
 const project=createTemplateProject(type==='pants'?'pants':'tee')
 const simulation=buildSimulation(project)
 if(type==='perturbed-tee'){const p=[...simulation.pieces.values()][0].particles[0];p.position.x+=.1;p.position.z+=.075;p.contactDepth=.02}
 const ordered=[...simulation.pieces.values()].flatMap(piece=>piece.particles)
 const ref=new Map(ordered.map((p,i)=>[p,i]))
 const encode=c=>({type:c.type,a:ref.get(c.a),b:ref.get(c.b),rest:c.rest,seamId:c.seamId??null,...(c.type==='seam-virtual'?{sourceParticles:c.sourceParticles.map(p=>ref.get(p)),targetParticles:c.targetParticles.map(p=>ref.get(p)),sourceWeights:c.sourceWeights,targetWeights:c.targetWeights}:{})})
 const snapshot={particles:ordered.map(p=>({...Object.fromEntries(['thickness','contactDepth','patternV','wrapMode'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]])),position:{x:p.position.x,y:p.position.y,z:p.position.z},seamIds:[...(p.seamIds||[])]})),constraints:simulation.constraints.map(encode),seamConstraints:simulation.seamConstraints.map(encode)}
 const original=JSON.stringify(snapshot),originalProject=JSON.stringify(project)
 refreshSimulationAnalysis(simulation,project)
 tests.push({type,project,snapshot,original,originalProject,expected:simulation,ordered})
}
const bin=process.env.GARMENT_CLOTH_ANALYSIS_TEST||'/tmp/garment-cloth-analysis-test'
const run=spawnSync(bin,['--json-lines'],{input:tests.map(t=>JSON.stringify({project:t.project,simulation:t.snapshot})).join('\n')+'\n',encoding:'utf8',maxBuffer:100*1024*1024})
if(run.error)throw run.error
assert.equal(run.status,0,run.stderr)
const results=run.stdout.trim().split('\n').map(JSON.parse)
assert.equal(results.length,tests.length)
for(let i=0;i<tests.length;i++){
 const t=tests[i],r=results[i];assert.equal(r.ok,true,r.error)
 let maxError=0,checks=0
 const near=(a,b,path)=>{assert.equal(typeof a,typeof b,path);if(typeof a==='number'){maxError=Math.max(maxError,Math.abs(a-b));assert.ok(Math.abs(a-b)<1e-7,`${path}: ${a} != ${b}`);checks++;return}if(Array.isArray(a)){assert.equal(a.length,b.length,path);a.forEach((x,i)=>near(x,b[i],path+'['+i+']'));return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const k of Object.keys(a))near(a[k],b[k],path+'.'+k);return}assert.deepEqual(a,b,path)}
 for(const k of ['strain','fit','quality'])near(r.result[k],t.expected[k],k)
 for(let j=0;j<t.ordered.length;j++)for(const k of ['strain','strainSamples','easeCm','pressureIndex'])near(r.result.particles[j][k],t.ordered[j][k],`particles[${j}].${k}`)
 assert.equal(JSON.stringify(t.snapshot),t.original)
 assert.equal(JSON.stringify(t.project),t.originalProject)
 console.log(JSON.stringify({fixture:t.type,particles:t.ordered.length,seams:t.expected.seamConstraints.length,numericChecks:checks,maxError}))
}
