import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createTemplateProject} from '../src/data/templates.js'
import {projectToGarmentCode,garmentCodeToProject,garmentCodeRoundTripSummary} from '../src/core/garmentCode.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-garment-code-')),'runner')
const build=spawnSync('clang++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor','native_cpp/core/garment_code.cpp','native_cpp/tests/test_garment_code.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
function native(op,input){const p=spawnSync(binary,[],{input:JSON.stringify({op,...input})+'\n',encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout)}
function compare(a,b,path='root'){if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),path+' '+a+' vs '+b);return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path+' keys');for(const k of Object.keys(a))compare(a[k],b[k],path+'.'+k);return}assert.deepEqual(b,a,path)}
const examples=[]
for(const name of ['tee','hoodie','tshirt','blank']){try{examples.push({name,project:createTemplateProject(name)})}catch{}}
examples.push({name:'parametric',project:{id:'param',name:'Parametric demo',version:1,revision:4,pieces:[{id:'front',name:'Panel',points:[{x:0,y:0},{x:12,y:0},{x:12,y:20},{x:0,y:20}],curves:{0:{cx:5,cy:-3}},arrangement3d:{x:.2,y:.4,z:.6},gradeRule:{base:'M'},seamAllowance:1.5},{id:'back',name:'Panel',points:[{x:0,y:0},{x:12,y:0},{x:0,y:18}],curves:{},arrangement3d:{x:-.2,y:.3,z:0}}],seams:[{id:'join',type:'normal',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'back',edgeIndex:1}}],interchange:{garmentCode:{parameters:{width:12},parameterOrder:['width'],properties:{units_in_meter:100}}}}})
let checks=0
for(const {name,project} of examples){
 const spec=JSON.parse(JSON.stringify(projectToGarmentCode(project))),ex=native('export',{project});assert.equal(ex.ok,true,ex.error);compare(spec,ex.result,name+' export');checks++
 const sum=garmentCodeRoundTripSummary(project),cpp=native('summary',{project});assert.equal(cpp.ok,true,cpp.error);compare(sum,cpp.result,name+' summary');checks++
 const base=structuredClone(project)
 const imported=garmentCodeToProject(spec,base),result=native('import',{spec,base,timestamp:imported.updatedAt,ids:'fixture'})
 assert.equal(result.ok,true,result.error);compare(imported,result.result,name+' import');checks++
 const again=projectToGarmentCode(result.result);compare(projectToGarmentCode(imported),again,name+' re-export');checks++
}
const malformed=[
 {pattern:{panels:{Broken:{vertices:[null],edges:[{endpoints:[0,0]}]}}}},
 {pattern:{panels:{Broken:{vertices:[[0,0],[1,0],[0,1]],edges:[{endpoints:'invalid'}]}}}},
 {pattern:{panels:{Broken:{vertices:[[0,0],[1,0],[0,1]],edges:null}}}},
]
let rejected=0
for(const spec of malformed){
 let jsRejected=false
 try{garmentCodeToProject(spec,{id:'base'})}catch{jsRejected=true}
 const cpp=native('import',{spec,base:{id:'base'},timestamp:'2026-10-15T12:00:00.000Z',ids:'fixture'})
 if(jsRejected){assert.equal(cpp.ok,false,'Malformed JS-rejected import accepted by native');rejected++}
}
assert.ok(checks>=12)
console.log('GarmentCode JS/native parity passed: '+checks+' checks across '+examples.map(e=>e.name).join(', ')+'; '+rejected+' malformed imports rejected by both')
