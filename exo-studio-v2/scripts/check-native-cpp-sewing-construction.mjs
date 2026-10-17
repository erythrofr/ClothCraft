import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {seamEndpointInterval,seamEndpointOverlap,validateNewSeam,auditSewingConstruction} from '../src/core/sewingConstruction.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const bin=resolve(mkdtempSync(resolve(tmpdir(),'garment-sewing-cpp-')),'test')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/sewing_construction.cpp','native_cpp/tests/test_sewing_construction.cpp','-o',bin],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const native=(op,fields)=>{const proc=spawnSync(bin,[],{input:JSON.stringify({op,...fields})+'\n',encoding:'utf8'});assert.equal(proc.status,0,proc.stderr||proc.stdout);const value=JSON.parse(proc.stdout);assert.equal(value.ok,true);return value.result}
function same(expected,actual,location='root'){
 if(typeof expected==='number'&&typeof actual==='number'){assert.ok(Math.abs(expected-actual)<1e-7*Math.max(1,Math.abs(expected),Math.abs(actual)),location+': '+expected+' vs '+actual);return}
 if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),location+' keys');for(const key of Object.keys(expected))same(expected[key],actual[key],location+'.'+key);return}
 assert.deepEqual(actual,expected,location)
}
let checks=0
for(const endpoint of [{pieceId:'a',edgeIndex:0},{startT:0,endT:1},{startT:.2,endT:.6},{startT:-.1},{startT:.6,endT:.2},{startT:0,endT:1.01},{startT:'bad'}]){
 same(seamEndpointInterval(endpoint),native('interval',{endpoint}));checks++
}
const a={pieceId:'a',edgeIndex:0,startT:.1,endT:.3},b={pieceId:'a',edgeIndex:0,startT:.3,endT:.5}
for(const pair of [[a,b],[a,{...b,startT:.2}],[a,{...a,pieceId:'b'}],[a,{...a,startT:.1,endT:.100001}]]){
 same(seamEndpointOverlap(...pair),native('overlap',{a:pair[0],b:pair[1]}));checks++
}
const makePiece=(id,width=40)=>({id,name:id,points:[{x:0,y:0},{x:width,y:0},{x:width,y:20},{x:0,y:20}]})
const project={pieces:[makePiece('a'),makePiece('b')],seams:[]}
const seam=(as,ae,bs=as,be=ae)=>({a:{pieceId:'a',edgeIndex:0,startT:as,endT:ae},b:{pieceId:'b',edgeIndex:0,startT:bs,endT:be}})
const scenarios=[seam(.1,.3),seam(.3,.30001),seam(.1,1.1),seam(.1,.5,.2,.3),{...seam(.1,.3),b:{pieceId:'lost',edgeIndex:0}},{...seam(.1,.3),b:{pieceId:'a',edgeIndex:0,startT:.1,endT:.3}}]
for(const proposed of scenarios){same(validateNewSeam(project,proposed),native('validate',{project,seam:proposed}));checks++}
project.seams.push({id:'first',name:'First constructed range',...seam(.1,.3)})
for(const proposed of [seam(.3,.5),seam(.2,.4),seam(.4,.5,.1,.2)]){
 same(validateNewSeam(project,proposed),native('validate',{project,seam:proposed}));checks++
}
for(const options of [{},{allowOverlappingLayers:true},{excludeSeamId:'first'}]){
 same(validateNewSeam(project,seam(.1,.3),options),native('validate',{project,seam:seam(.1,.3),options}));checks++
}
same(auditSewingConstruction(project),native('audit',{project}));checks++
project.seams.push({id:'second',...seam(.15,.25)})
same(auditSewingConstruction(project),native('audit',{project}));checks++
project.pieces[0].active3d=false
same(auditSewingConstruction(project,{maxExamples:2}),native('audit',{project,options:{maxExamples:2}}));checks++
const fixture='research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-sewn-EXPERIMENTAL.garment.json'
try{const imported=JSON.parse(readFileSync(resolve(root,fixture),'utf8'));same(auditSewingConstruction(imported),native('audit',{project:imported}));checks++}catch(e){if(e.code!=='ENOENT')throw e;console.log('Imported CLO fixture unavailable; remaining fixture comparisons passed')}
assert.ok(checks>=27)
console.log('Sewing construction JS/C++ parity passed: '+checks+' cases')
