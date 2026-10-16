import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {DEFAULT_SIZES,sizeOffset,gradePointForPiece,gradePiece} from '../src/core/grading.js'
import {createTemplateProject} from '../src/data/templates.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-grading-helpers-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/grading_helpers.cpp','native_cpp/tests/test_grading_helpers.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const cases=[{op:'sizes'}]
const gradingOptions=[null,{}, {baseSize:'M',sizes:['XS','S','M','L','XL','XXL'],widthPerSizeCm:3,lengthPerSizeCm:1.2},{baseSize:'S',sizes:['S','M','L'],widthPerSizeCm:4,lengthPerSizeCm:2},{baseSize:'missing',sizes:['S','M','L'],widthPerSizeCm:0,lengthPerSizeCm:0}]
const curved={id:'synthetic',points:[{x:-10,y:0,gradeRule:{enabled:true,dxPerSize:-2,dyPerSize:'0.3'},tag:'A'},{x:10,y:0},{x:10,y:24,gradeRule:{enabled:false}},{x:-10,y:24}],curves:{0:{cx:0,cy:-5},2:{cx:0,cy:30}},internalLines:[{a:{x:-5,y:3,label:'internal'},b:{x:5,y:15},id:'dart'}],fabricId:'cotton',metadata:{version:12}}
const tee=createTemplateProject('tee')
const pieces=[curved,...(tee.pieces||[]).slice(0,3)]
for(const grading of gradingOptions)for(const size of ['XS','S','M','L','XL','XXL','unknown']){
 cases.push({op:'offset',grading,size})
 for(const piece of pieces){
  cases.push({op:'piece',piece,grading,size})
  for(const point of piece.points.slice(0,3))cases.push({op:'point',piece,grading,size,point})
 }
}
const before=JSON.stringify({pieces,gradingOptions})
const expected=cases.map(q=>{switch(q.op){case 'sizes':return DEFAULT_SIZES;case 'offset':return sizeOffset(q.grading,q.size);case 'point':return gradePointForPiece(q.piece,q.grading,q.size,q.point);case 'piece':return gradePiece(q.piece,q.grading,q.size)}})
assert.equal(JSON.stringify({pieces,gradingOptions}),before,'JS mutated fixtures')
const native=spawnSync(binary,[],{input:JSON.stringify({cases}),cwd:root,encoding:'utf8'})
assert.equal(native.status,0,native.stderr)
const actual=JSON.parse(native.stdout);assert.equal(actual.length,cases.length)
function parity(a,b,path){if(typeof a==='number'){assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),path+' '+a+' != '+b);return}if(Array.isArray(a)){assert.equal(a.length,b.length,path);a.forEach((v,i)=>parity(v,b[i],path+'['+i+']'));return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),path);for(const key of Object.keys(a))parity(a[key],b[key],path+'.'+key);return}assert.deepEqual(b,a,path)}
for(let i=0;i<cases.length;i++)parity(JSON.parse(JSON.stringify(expected[i])),actual[i],cases[i].op+' #'+i)
console.log('Grading helpers JS/C++ parity passed: '+cases.length+' cases; no JS source mutation')
