import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {gradeProject} from '../src/core/grading.js'
const binary='/tmp/garment-graded-geometry-parity-bridge-test'
const compile=spawnSync('c++',['-std=c++17','-O1','-ffp-contract=off','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/graded_geometry_parity_bridge.cpp','native_cpp/tests/test_graded_geometry_parity_bridge.cpp','native_cpp/build-cmake/libgarment_cad_core.a','-o',binary],{encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
const cases=[]
for(const tag of ['tee','pants'])for(const size of ['XS','S','M','L','XL']){
 const project=createTemplateProject(tag);project.grading.sizes=['XS','S','M','L','XL'];cases.push({tag,project,size})
}
const input=JSON.stringify({cases})
const run=spawnSync(binary,[],{input,encoding:'utf8',maxBuffer:100*1024*1024})
assert.equal(run.status,0,run.stderr)
const results=JSON.parse(run.stdout)
const bits=value=>{const buffer=new ArrayBuffer(8),dv=new DataView(buffer);dv.setFloat64(0,value,false);return dv.getBigUint64(0,false).toString(16).padStart(16,'0')}
function compare(a,b,path,details){if(typeof b==='number'&&typeof a==='number'){details.total++;if(bits(a)!==bits(b)){details.mismatch++;if(details.first.length<6)details.first.push({path,native:a,js:b,nativeBits:bits(a),jsBits:bits(b)})}}else if(Array.isArray(b)){for(let i=0;i<b.length;i++)compare(a?.[i],b[i],path+'['+i+']',details)}else if(b&&typeof b==='object'){for(const key of Object.keys(b))compare(a?.[key],b[key],path+'.'+key,details)}}
for(let i=0;i<cases.length;i++){
 const {tag,project,size}=cases[i],js=gradeProject(project,size),r=results[i]
 const gradeFields=(data)=>({pieces:data.pieces.map(p=>({points:p.points,curves:p.curves,internalLines:p.internalLines})),customMeasurements:data.customMeasurements})
 const bridge={total:0,mismatch:0,first:[]},native={total:0,mismatch:0,first:[]}
 compare(gradeFields(r.bridge),gradeFields(js),'grade',bridge)
 compare(gradeFields(r.native),gradeFields(js),'grade',native)
 console.log(JSON.stringify({tag,size,bridge,native}))
 assert.deepEqual(project,cases[i].project,'source unchanged')
}
