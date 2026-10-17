import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,stepSimulation} from '../src/core/physics.js'
const root=resolve(import.meta.dirname,'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'cloth-contacts-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/cloth_solver_step_contacts.cpp','native_cpp/core/avatar_contact_kernel.cpp','native_cpp/core/self_collision.cpp','native_cpp/core/cloth_simulation.cpp','native_cpp/tests/test_cloth_solver_step_contacts.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const vec=v=>[v.x,v.y,v.z]
function snapshot(sim){const particles=[...sim.pieces.values()].flatMap(p=>p.particles).sort((a,b)=>a.simIndex-b.simIndex),ref=new Map(particles.map((p,i)=>[p,i]));return {particles:particles.map(p=>({position:vec(p.position),previous:vec(p.previous),invMass:p.invMass,contactDepth:p.contactDepth??0,simIndex:p.simIndex,wrapMode:p.wrapMode??'',patternU:p.patternU,patternV:p.patternV,collisionSideZ:p.collisionSideZ,constructionSideZ:p.constructionSideZ,avatarHeightScale:p.avatarHeightScale,seamBoundary:p.seamBoundary,seamIds:[...(p.seamIds||[])]})),pieces:[...sim.pieces.values()].map(p=>({id:p.id,layerIndex:p.layerIndex??0,fabric:{damping:p.fabric?.damping??.985,friction:p.fabric?.friction??.3,thickness:p.fabric?.thickness??.002},particleIndices:p.particles.map(x=>ref.get(x))})),constraints:sim.constraints.map(c=>({type:c.type,a:ref.get(c.a),b:ref.get(c.b),rest:c.rest,stiffness:c.stiffness,targetParticles:c.targetParticles?.map(p=>ref.get(p))})),seamIndices:(sim.seamConstraints||[]).map(c=>sim.constraints.indexOf(c)).filter(i=>i>=0),anchors:(sim.anchorConstraints||[]).map(c=>({particle:ref.get(c.particle),target:vec(c.target),axes:c.axes??'',stiffness:c.stiffness})),maxThickness:sim.maxThickness,elapsed:sim.elapsed,collisionExclusions:[...(sim.collisionExclusions||[])],fusedPiecePairs:[...(sim.fusedPiecePairs||[])]}}
const cases=[],references=[]
for(const template of ['tee','pants'])for(const frames of [1,2])for(const collisions of [false,true])for(const selfCollision of [false,true]){
 const project=createTemplateProject(template)
 project.simulation={...project.simulation,collisions,selfCollision,substeps:1,continuousSurfaceContact:false,bodyTriangleContactAssist:false,wind:{enabled:false}}
 const sim=buildSimulation(project),initial=snapshot(sim)
 if(initial.constraints.some(c=>c.a===undefined||c.b===undefined||c.type==='seam-virtual'||(c.type==='surface-stitch'&&c.targetParticles?.length)))continue
 for(let i=0;i<frames;i++)stepSimulation(sim,project,1/60)
 cases.push({snapshot:initial,project,frames,dt:1/60});references.push({template,frames,collisions,selfCollision,state:snapshot(sim)})
}
const run=spawnSync(binary,[],{cwd:root,encoding:'utf8',input:JSON.stringify({cases}),maxBuffer:200*1024*1024})
assert.equal(run.status,0,run.stderr)
const answers=JSON.parse(run.stdout)
assert.equal(answers.length,cases.length)
// Opt-in JS stage probe: import a transformed copy of the module from a data
// URL, retaining the real imported helpers and leaving source files unchanged.
if(process.argv.includes('--trace-stages')){
 let source=readFileSync(resolve(root,'src/core/physics.js'),'utf8')
 source=source.replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,pathToFileURL(resolve(root,'src/core/physics.js'))).href}'`)
 source=source.replace("from 'three'",`from '${import.meta.resolve('three')}'`)
 const probe=`globalThis.__contactStage?.(simulation,'first-contact');`
 source=source.replace('projectAvatarContacts(simulation, project, collideAvatar)\n',`projectAvatarContacts(simulation, project, collideAvatar)\n        ${probe}\n`)
 source=source.replace('stabilizeFuseLayers(simulation)\n',`stabilizeFuseLayers(simulation)\n        globalThis.__contactStage?.(simulation,'stabilized');\n`)
 source=source.replace('projectAvatarContacts(simulation, project, collideAvatar, { movableOnly: true })\n',`projectAvatarContacts(simulation, project, collideAvatar, { movableOnly: true })\n        globalThis.__contactStage?.(simulation,'second-contact');\n`)
 const physics=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
 const target=cases.find(x=>x.frames===1&&x.project.simulation.collisions&&!x.project.simulation.selfCollision)
 const stageTruth=[]
 globalThis.__contactStage=(sim,stage)=>{if(stageTruth.length>=3)return;stageTruth.push({stage,particles:snapshot(sim).particles})}
 const js=physics.buildSimulation(target.project)
 physics.stepSimulation(js,target.project,1/60)
 delete globalThis.__contactStage
 const tracing={...target,snapshot:{...target.snapshot,traceStages:true}}
 const tracedRun=spawnSync(binary,[],{cwd:root,encoding:'utf8',input:JSON.stringify({cases:[tracing]}),maxBuffer:200*1024*1024})
 const native=JSON.parse(tracedRun.stdout)[0]
 if(native.ok)for(const truth of stageTruth){const matching=native.result.stageTrace?.find(x=>x.stage===truth.stage);if(!matching)continue;let previousDifferences=0,positionDifferences=0,first=null;for(let j=0;j<truth.particles.length;j++)for(let axis=0;axis<3;axis++){
  const previousError=Math.abs(truth.particles[j].previous[axis]-matching.particles[j].previous[axis]);const positionError=Math.abs(truth.particles[j].position[axis]-matching.particles[j].position[axis]);if(previousError>1e-7){previousDifferences++;first??={particle:j,axis,js:truth.particles[j].previous[axis],cpp:matching.particles[j].previous[axis]}}if(positionError>1e-7)positionDifferences++}
  console.log(JSON.stringify({traceStage:truth.stage,previousDifferences,positionDifferences,first,particle24:truth.stage==='second-contact'?{js:truth.particles[24],cpp:matching.particles[24],preJS:stageTruth[1]?.particles[24],preCPP:native.result.stageTrace?.[1]?.particles[24]}:undefined}))}
}
let fullStepParity=true
for(let i=0;i<answers.length;i++){
 const a=answers[i],r=references[i]
 if(!a.ok){console.log(JSON.stringify({...r,state:undefined,error:a.error,fullStepParity:false}));fullStepParity=false;continue}
 let max=0,sum=0,count=0,movedUp=0,maxPreviousError=0,contactDepthMismatches=0,firstPrevious=null,previousMismatchCount=0
 for(let j=0;j<r.state.particles.length;j++)for(let axis=0;axis<3;axis++){
  const actual=a.result.particles[j].position[axis],expected=r.state.particles[j].position[axis],error=Math.abs(actual-expected)
  max=Math.max(max,error);sum+=error*error;count++
  if(axis===1&&actual-expected>1e-7)movedUp++
 }
 for(let j=0;j<r.state.particles.length;j++){
  for(let axis=0;axis<3;axis++){const delta=Math.abs(a.result.particles[j].previous[axis]-r.state.particles[j].previous[axis]);maxPreviousError=Math.max(maxPreviousError,delta);if(delta>1e-7){previousMismatchCount++;firstPrevious??={index:j,pieceId:cases[i].snapshot.pieces.find(p=>p.particleIndices.includes(j))?.id,axis,expected:r.state.particles[j].previous[axis],actual:a.result.particles[j].previous[axis],position:r.state.particles[j].position,initial:cases[i].snapshot.particles[j]}}}
  if(Math.abs((a.result.particles[j].contactDepth??0)-(r.state.particles[j].contactDepth??0))>1e-7)contactDepthMismatches++
 }
 const rms=Math.sqrt(sum/Math.max(1,count)),positionPassed=max<=1e-7,previousPassed=maxPreviousError<=1e-7,passed=positionPassed&&previousPassed&&contactDepthMismatches===0
 fullStepParity&&=passed
 console.log(JSON.stringify({template:r.template,frames:r.frames,collisions:r.collisions,selfCollision:r.selfCollision,particles:r.state.particles.length,maxError:max,maxPreviousError,previousMismatchCount,firstPrevious,contactDepthMismatches,rms,movedUpMismatch:movedUp,positionPassed,previousPassed,passed,fullStepParity:false}))
}
console.log(JSON.stringify({tested:answers.length,fullStepParity:false,allCasesWithinTolerance:fullStepParity,triangleCcdVerified:false}))
// This diagnostic adapter cannot substitute for collision projections interleaved
// with every constraint sweep or the JS post-contact stabilization pipeline.
