import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
import {nativeServiceBackend,assessNativeSolverResult} from '../src/core/backends/nativeServiceBackend.js'
import {browserPbdBackend} from '../src/core/backends/browserPbdBackend.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'backend-session-')),'runner')
const cc=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/simulation_quality.cpp','native_cpp/core/native_solver_acceptance.cpp','native_cpp/core/native_backend_session.cpp','native_cpp/tests/test_native_backend_session.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(cc.status,0,cc.stderr)
for(const template of ['tee','pants']){
const project=createTemplateProject(template)
const simulation=buildSimulation(project)
const payload=buildNativeSimulationPayload(project)
const particleRefs=[...simulation.pieces.values()].flatMap(piece=>piece.particles)
assert.equal(particleRefs.length,payload.particles.length)
const snapshot={particles:particleRefs.map(p=>({position:p.position.toArray(),previous:p.previous.toArray(),contactDepth:p.contactDepth||0})),pieceOrder:[...simulation.pieces.keys()],pieces:Object.fromEntries([...simulation.pieces].map(([id,piece])=>[id,{particles:piece.particles.map(p=>({position:p.position.toArray(),previous:p.previous.toArray(),contactDepth:p.contactDepth||0}))}]))}
const browserSimulation={pieces:Object.fromEntries([...simulation.pieces].map(([id,piece])=>[id,{particles:piece.particles.map(p=>({position:p.position.toArray(),contactDepth:p.contactDepth||0})),faces:piece.faces.map(f=>[...f])}])),constraints:simulation.constraints,seamConstraints:simulation.seamConstraints,anchorConstraints:simulation.anchorConstraints,fuseConstraints:simulation.fuseConstraints,strain:simulation.strain||{}}
const result={state:{particles:payload.particles.map((p,i)=>({position:[i/100,1,2],previous:[i/100,0,2],contactDepth:-2}))},frames:3,runtimeMs:15,stats:{finite:true}}
const cases=[result,{state:{particles:[]},frames:5},{state:{particles:result.state.particles.map((p,i)=>i===2?{...p,previous:[0,NaN,0]}:p)}}]
const input=cases.map(result=>({project,simulation:snapshot,payload,result,browserSimulation,request:{},protocolVersion:1}))
const run=spawnSync(binary,['--json-lines'],{cwd:root,encoding:'utf8',input:input.map(JSON.stringify).join('\n')+'\n',maxBuffer:128*1024*1024})
assert.equal(run.status,0,run.stderr)
const output=run.stdout.trim().split('\n').map(JSON.parse)
assert.equal(output.length,cases.length)
for(let i=0;i<cases.length;i++){
 const v=output[i];assert.equal(v.ok,true,v.error);assert.equal(v.sourceUnchanged,true)
 assert.equal(v.session.frame,0);assert.equal(v.disposed.disposed,true);assert.equal(v.disposed.abortController.aborted,true)
 assert.equal(v.session.serviceUrl,'http://127.0.0.1:5191')
 assert.match(v.syncError,/requires asynchronous stepAsync/)
 assert.equal(v.browserStats.pieces,simulation.pieces.size)
 for(const [id,piece] of simulation.pieces){assert.deepEqual(v.browserPieces[id].vertices,piece.particles.map(p=>p.position.toArray()));assert.deepEqual(v.browserPieces[id].faces,piece.faces)}
 if(i===0){assert.equal(v.adopted.frame,3);assert.equal(v.adopted.payload.particles[1].position[0],.01);assert.equal(v.adopted.particleRefs[0].contactDepth,0);assert.deepEqual(v.nativeStats.fitAssessment,assessNativeSolverResult(cases[0]));assert.equal(v.nativeStats.frame,3);assert.equal(v.nativeStats.elapsedMs,15);let offset=0;for(const id of snapshot.pieceOrder){for(const particle of v.adopted.simulation.pieces[id].particles)assert.deepEqual(particle.position,result.state.particles[offset++].position)}}
 else{assert.equal(v.adopted,null);assert.match(v.error,/particle count mismatch|finite coordinates/)}
}
}
console.log('Native backend session snapshots pass create, fail-closed adoption, frame, stats, browser piece state and disposal checks')
console.log('Unported: browser simulation creation/physics, refreshSimulationAnalysis, async Promise/AbortSignal and live service transport; no entire-backend export parity claimed')
