import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {createTeeTemplate,createPantsTemplate} from '../src/data/templates.js'
import {cloneProject,touchProject,getPiece,makeRectanglePiece,uniqueId} from '../src/core/project.js'
const root=resolve(import.meta.dirname,'..'),bin=resolve(mkdtempSync(resolve(tmpdir(),'gs-project-utils-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/project_utilities.cpp','native_cpp/tests/test_project_utilities.cpp','-o',bin],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const time=1729000000123,random=.23456789,timestamp=new Date(time).toISOString()
const cases=[],expected=[]
function add(q,e){cases.push(q);expected.push(e)}
function deterministic(fn){const now=Date.now,rng=Math.random;Date.now=()=>time;Math.random=()=>random;try{return fn()}finally{Date.now=now;Math.random=rng}}
for(const project of [createTeeTemplate(),createPantsTemplate()]){
 const before=JSON.stringify(project)
 add({op:'clone',project},cloneProject(project))
 const touched=cloneProject(project);const isoDate=globalThis.Date;class FixedDate extends isoDate{constructor(...args){super(...(args.length?args:[time]))}}globalThis.Date=FixedDate;try{touchProject(touched)}finally{globalThis.Date=isoDate}
 add({op:'touch',project,timestamp},touched)
 for(const piece of project.pieces.slice(0,2))add({op:'get',project,id:piece.id},getPiece(project,piece.id))
 add({op:'get',project,id:'__missing__'},null)
 assert.equal(JSON.stringify(project),before,'input mutation detected')
}
for(const prefix of ['id','piece','test'])add({op:'unique',prefix,time,random},deterministic(()=>uniqueId(prefix)))
for(const index of [0,2,9])add({op:'rectangle',index,time,random},deterministic(()=>makeRectanglePiece(index)))
add({op:'get',project:{pieces:[]},id:'missing'},null)
const run=spawnSync(bin,[],{cwd:root,input:JSON.stringify({cases}),encoding:'utf8',maxBuffer:24*1024*1024})
assert.equal(run.status,0,run.stderr)
const actual=JSON.parse(run.stdout)
assert.equal(actual.length,cases.length)
for(let i=0;i<cases.length;i++){assert.equal(actual[i].ok,true,`case ${i}: ${actual[i].error}`);assert.deepEqual(actual[i].result,JSON.parse(JSON.stringify(expected[i])),`case ${i} ${cases[i].op}`)}
console.log(`project utilities C++/JS parity: ${cases.length}/${cases.length} cases; deterministic clock/random supplied externally`)
