import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {buildMarker} from '../src/core/marker.js'
import {createTeeTemplate,createPantsTemplate} from '../src/data/templates.js'
const root=resolve(import.meta.dirname,'..'),bin=resolve(mkdtempSync(resolve(tmpdir(),'marker-exact-')),'runner')
const compile=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/marker_exact.cpp','native_cpp/tests/test_marker_exact.cpp','-o',bin],{cwd:root,encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
const cases=[]
for(const template of [createTeeTemplate,createPantsTemplate]){
 const original=template()
 for(const width of [150,75,30,2,500])cases.push({project:original,width,gap:1.5})
 const altered=structuredClone(original);for(const p of altered.pieces){p.grainAngleDeg=37;p.marker={allowCrossGrain:true};p.cutQuantity=2}
 for(const width of [150,50,25])cases.push({project:altered,width,gap:0.7})
 cases.push({project:original,width:150,gap:2,options:{fabricId:'main'}})
 cases.push({project:original,width:150,gap:2,options:{fabricId:'missing'}})
}
const output=spawnSync(bin,[],{input:JSON.stringify({cases}),cwd:root,encoding:'utf8',maxBuffer:32*1024*1024})
assert.equal(output.status,0,output.stderr)
const values=JSON.parse(output.stdout)
let passed=0;const mismatches=[]
const near=(a,b,path)=>{if(typeof b==='number'){if(!(Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b))))throw Error(path+': '+a+' != '+b)}else if(Array.isArray(b)){assert.equal(a.length,b.length,path);b.forEach((v,i)=>near(a[i],v,path+'['+i+']'))}else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const k of Object.keys(b))near(a[k],b[k],path+'.'+k)}else assert.deepEqual(a,b,path)}
for(let i=0;i<cases.length;i++){const c=cases[i],expected=buildMarker(c.project,c.width,c.gap,c.options);try{assert.equal(values[i].ok,true,values[i].error);near(values[i].result,expected,'case '+i);passed++}catch(e){mismatches.push({case:i,width:c.width,message:e.message})}}
console.log(JSON.stringify({passed,total:cases.length,mismatches:mismatches.slice(0,10)},null,2))
if(mismatches.length)process.exitCode=1
