import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  DRAFT_CONSTRUCTION_MODES, constructionReferencePoint, lineIntersection,
  projectOntoLine, pointAlongLine, mirrorPointAcrossLine, preciseConstructionEdit,
} from '../src/core/draftingConstructions.js'

const root=resolve(import.meta.dirname,'..')
const directory=mkdtempSync(join(tmpdir(),'garment-drafting-constructions-'))
const binary=join(directory,'runner')
const run=(command,args,other={})=>spawnSync(command,args,{cwd:root,encoding:'utf8',...other})
const base={points:[{x:0,y:0,id:'A'},{x:4,y:0,id:'B'},{x:4,y:4,id:'C',grading:{locked:true}},{x:0,y:4,id:'D'}]}
const P=(x,y)=>({x,y})
const cases=[{op:'modes'}]
for(const index of [1,2,4,0,5,1.2,'2',null]) cases.push({op:'reference',piece:base,index})
for(const [a,b,c,d] of [[P(0,0),P(2,2),P(0,2),P(2,0)],[P(0,0),P(2,0),P(1,0),P(4,0)],[P(3,-5),P(8,5),P(0,-2),P(7,3)]]) cases.push({op:'intersection',a,b,c,d})
for(const p of [P(2,3),P(-10,0),P(1e-4,-5)]) {
  cases.push({op:'projection',p,a:P(0,0),b:P(4,1)},{op:'mirror',p,a:P(0,0),b:P(4,1)})
}
for(const distance of [-12,0,12,'2',null,'bad',100001]) for(const perpendicular of [false,true])
  cases.push({op:'along',a:P(1,2),b:P(4,6),distance,perpendicular})
for(const construction of ['line','normal','foot','mirror','intersection','unknown']) {
  for (const index of [2,0,8,'2',null,2.5]) cases.push({op:'edit',piece:base,index,options:{construction,a:1,b:2,c:2,d:4,distanceCm:2}})
}
cases.push({op:'projection',p:P(2,3),a:P(0,0),b:P(0,0)})
cases.push({op:'mirror',p:P(2,3),a:P(0,0),b:P(0,0)})
cases.push({op:'along',a:P(0,0),b:P(0,0),distance:4})
cases.push({op:'edit',piece:{...base,locked:true},index:2,options:{construction:'normal',distanceCm:2}})
cases.push({op:'edit',piece:base,index:2,options:{construction:'line',distanceCm:0}})
cases.push({op:'edit',piece:base,index:2,options:{construction:'line',distanceCm:4}})

function reference(c) {
  switch(c.op) {
    case 'modes': return DRAFT_CONSTRUCTION_MODES
    case 'reference': return constructionReferencePoint(c.piece,c.index)
    case 'intersection': return lineIntersection(c.a,c.b,c.c,c.d)
    case 'projection': return projectOntoLine(c.p,c.a,c.b)
    case 'along': return pointAlongLine(c.a,c.b,c.distance,{perpendicular:c.perpendicular})
    case 'mirror': return mirrorPointAcrossLine(c.p,c.a,c.b)
    case 'edit': return preciseConstructionEdit(c.piece,c.index,c.options)
  }
}
function js(c) {try{return {ok:true,value:reference(c)}}catch(error){return {ok:false,error:error.message}}}
function compare(a,b,path='root') {
  if(typeof a==='number' && typeof b==='number') return Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b))
  if(Array.isArray(a)&&Array.isArray(b)) return a.length===b.length&&a.every((v,i)=>compare(v,b[i],`${path}.${i}`))
  if(a&&b&&typeof a==='object'&&typeof b==='object') return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>k in b&&compare(a[k],b[k],`${path}.${k}`))
  return a===b
}
try {
  const compiled=run('clang++',['-std=c++17','-O1','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/drafting_constructions.cpp','native_cpp/tests/test_drafting_constructions.cpp','-o',binary])
  if(compiled.status!==0) throw Error(`Compilation failed: ${compiled.stderr}`)
  const unit=run(binary,[])
  if(unit.status!==0) throw Error(`Native unit failed: ${unit.stderr}`)
  const output=run(binary,['--jsonl'],{input:cases.map(v=>JSON.stringify(v)).join('\n')+'\n'})
  if(output.status!==0) throw Error(`Native runner failed: ${output.stderr}`)
  const lines=output.stdout.trim().split('\n').map(line=>JSON.parse(line))
  if(lines.length!==cases.length) throw Error(`Expected ${cases.length} rows, got ${lines.length}`)
  for(let i=0;i<cases.length;i++) if(!compare(js(cases[i]),lines[i])) {
    throw Error(`Parity mismatch case ${i}: ${JSON.stringify(cases[i])}\nJS: ${JSON.stringify(js(cases[i]))}\nC++: ${JSON.stringify(lines[i])}`)
  }
  console.log(`C++ drafting constructions: native unit passed, ${cases.length} JS parity cases passed`)
} finally {rmSync(directory,{recursive:true,force:true})}
