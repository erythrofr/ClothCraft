import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import * as js from '../src/core/draftingPrecision.js'

const root=resolve(import.meta.dirname,'..')
const temp=mkdtempSync(join(tmpdir(),'drafting-precision-'))
const bin=join(temp,'precision')
const near=(a,b,path='result')=>{
  if(typeof a==='number' && typeof b==='number') {
    assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6,`${path}: JS ${a} C++ ${b}`)
  } else if(Array.isArray(a)&&Array.isArray(b)) {
    assert.equal(a.length,b.length,path)
    a.forEach((v,i)=>near(v,b[i],path+'.'+i))
  } else if(a && b && typeof a==='object' && typeof b==='object') {
    assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),path)
    for(const k of Object.keys(a))near(a[k],b[k],path+'.'+k)
  } else assert.deepEqual(b,a,path)
}
const a={x:1,y:2,id:'a',gradeRule:{dx:1}},b={x:19,y:-4},control={x:29,y:50}
const piece={points:[a,b,{x:30,y:10},{x:0,y:40}],curves:{},name:'test'}
const cases=[]
const add=(op,args)=>cases.push({op,args})
for(const value of [0,12,-5,'42',true,'','not-number',100001,null])add('assertDraftCoordinate',{value})
for(const angleDeg of [-360,-90,0,45,90,270])add('pointFromPolar',{anchor:a,lengthCm:12.34,angleDeg})
add('pointFromPolar',{anchor:a,lengthCm:-1,angleDeg:10})
add('polarFromPoints',{anchor:a,point:b})
for(const index of [0,1,3]) {
  add('precisePointEdit',{piece,index,options:{x:index+2,y:12}})
  add('precisePointEdit',{piece,index,options:{mode:'polar',lengthCm:12,angleDeg:48}})
}
add('precisePointEdit',{piece,index:0,options:{x:19,y:-4}})
add('precisePointEdit',{piece:{...piece,locked:true},index:1,options:{x:5,y:6}})
add('precisePointEdit',{piece,index:99,options:{x:5,y:6}})
for(const index of [0,1,2,3]){
  add('preciseCurveEdit',{piece,index,options:{cx:5,cy:-12}})
  add('preciseCurveEdit',{piece,index,options:{mode:'chord',alongCm:3.5,depthCm:5.2}})
}
add('preciseCurveEdit',{piece,index:0,options:{mode:'invalid'}})
add('curveChordCoordinates',{a,control,b})
for(const t of [0,.1,.3,.5,.75,1,1.4]) {
  add('quadraticAt',{a,control,b,t})
  add('quadraticDerivative',{a,control,b,t})
}
for(const [start,end] of [[0,1],[.2,.7],[.7,.2],[1,1],[-10,10],[.00001,.99999]])add('quadraticArcLength',{a,control,b,start,end})
for(const fraction of [-1,0,.1,.3,.5,.9,1,2,'bad'])add('quadraticAtLengthFraction',{a,control,b,fraction})
for(const fraction of [0,.5,1])add('quadraticAtLengthFraction',{a,control:a,b:a,fraction})
try {
  const compile=spawnSync('c++',['-std=c++17','-O2','-I'+join(root,'native_cpp/vendor'),join(root,'native_cpp/core/drafting_precision.cpp'),join(root,'native_cpp/tests/test_drafting_precision.cpp'),'-o',bin],{encoding:'utf8',timeout:120000})
  assert.equal(compile.status,0,compile.stderr||compile.error?.message)
  const unit=spawnSync(bin,[],{encoding:'utf8'})
  assert.equal(unit.status,0,unit.stderr||unit.stdout)
  const native=spawnSync(bin,['--json'],{input:cases.map(c=>JSON.stringify(c)).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000})
  assert.equal(native.status,0,native.stderr||native.error?.message)
  const results=native.stdout.trim().split('\n').map(JSON.parse)
  assert.equal(results.length,cases.length)
  let failures=0
  for(let i=0;i<cases.length;i++){
    const {op,args}=cases[i]
    let result, error
    try {
      switch(op){
        case 'assertDraftCoordinate':result=js.assertDraftCoordinate(args.value);break
        case 'pointFromPolar':result=js.pointFromPolar(args.anchor,args.lengthCm,args.angleDeg);break
        case 'polarFromPoints':result=js.polarFromPoints(args.anchor,args.point);break
        case 'precisePointEdit':result=js.precisePointEdit(args.piece,args.index,args.options);break
        case 'curveChordCoordinates':result=js.curveChordCoordinates(args.a,args.control,args.b);break
        case 'preciseCurveEdit':result=js.preciseCurveEdit(args.piece,args.index,args.options);break
        case 'quadraticAt':result=js.quadraticAt(args.a,args.control,args.b,args.t);break
        case 'quadraticDerivative':result=js.quadraticDerivative(args.a,args.control,args.b,args.t);break
        case 'quadraticArcLength':result=js.quadraticArcLength(args.a,args.control,args.b,args.start,args.end);break
        case 'quadraticAtLengthFraction':result=js.quadraticAtLengthFraction(args.a,args.control,args.b,args.fraction);break
      }
    } catch(e){error=e.message}
    if(error){assert.equal(results[i].ok,false,`${i} ${op} expected rejection`);assert.equal(results[i].error,error,`${i} ${op} error`);failures++}
    else {assert.equal(results[i].ok,true,`${i} ${op}: ${results[i].error}`);near(result,results[i].value,`${i} ${op}`)}
  }
  console.log(JSON.stringify({pass:true, cases:cases.length, expectedRejections:failures, nativeUnit:unit.stdout.trim(), scope:'10 drafting precision functions and annotated geometry'}))
} finally {rmSync(temp,{recursive:true,force:true})}
