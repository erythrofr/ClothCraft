import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {inspectNativeAssemblyPose} from '../src/core/backends/nativeAssemblyPreflight.js'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-assembly-preflight-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/native_assembly_preflight.cpp','native_cpp/tests/test_native_assembly_preflight.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const base={particles:[{id:'a',pieceId:'front',position:[0,0,0]},{id:'b',pieceId:'back',position:[.03,0,0]},{id:'c',pieceId:'front',position:[0,.1,0]}],pieces:[{id:'front',particleIndices:[0,1,2],flatVerticesM:[[0,0,0],[.03,0,0],[0,.1,0]],faces:[[0,1,2]]}],constraints:[{type:'seam',a:0,b:1,seamId:'neck'}]}
const copy=x=>structuredClone(x)
const cases=[{payload:base}]
for(const gap of [.02999,.03,.03001,.08]){const p=copy(base);p.particles[1].position[0]=gap;cases.push({payload:p})}
for(const edge of [1,1.2,1.2001,1.7]){const p=copy(base);p.particles[2].position[1]=edge*.1;cases.push({payload:p})}
for(const opts of [{maximumInitialSeamGapMm:50},{maximumInitialEdgeStrainPercent:5},{maximumInitialSeamGapMm:0,maximumInitialEdgeStrainPercent:0}])cases.push({payload:base,options:opts})
for(const virtualGap of [.01,.12]){const p=copy(base);p.constraints=[];p.virtualSeams=[{sourceIndices:[0,2],sourceWeights:[.5,.5],targetIndices:[1],targetWeights:[1],seamId:'virtual'}];p.particles[1].position[0]=virtualGap;cases.push({payload:p})}
for(const broken of [null,{}, {particles:[],pieces:[]},(()=>{const p=copy(base);p.particles[0].position=[null,0,0];return p})(),(()=>{const p=copy(base);p.constraints[0].b=99;return p})(),(()=>{const p=copy(base);p.pieces[0].faces=[[0,1,77]];return p})(),(()=>{const p=copy(base);p.virtualSeams=[{sourceIndices:[77],sourceWeights:[1],targetIndices:[0],targetWeights:[1]}];return p})()])cases.push({payload:broken})
try{const tee=createTemplateProject('tee');const payload=buildNativeSimulationPayload(tee);if(payload?.particles?.length)cases.push({payload})}catch(e){console.log('Tee build fixture unavailable: '+e.message)}
const snapshot=JSON.stringify(cases)
const js=cases.map(({payload,options})=>{try{return {ok:true,result:inspectNativeAssemblyPose(payload,options)}}catch(e){return {ok:false,error:e.message}}})
assert.equal(JSON.stringify(cases),snapshot,'JS mutated input')
const run=spawnSync(binary,[],{input:JSON.stringify({cases}),cwd:root,encoding:'utf8'})
assert.equal(run.status,0,run.stderr)
const cpp=run.stdout.trim().split('\n').map(JSON.parse)
assert.equal(cpp.length,cases.length)
for(let i=0;i<cases.length;i++)assert.deepEqual(cpp[i],js[i],'parity fixture '+i)
console.log('Native assembly preflight JS/C++ parity: '+cases.length+' passed')
