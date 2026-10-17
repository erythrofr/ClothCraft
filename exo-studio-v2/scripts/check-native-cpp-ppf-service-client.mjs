import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {getPpfServiceHealth,submitPpfFinalSolve,getPpfJob,getPpfJobPreview,waitForPpfJob} from '../src/core/backends/ppfServiceClient.js'
const binary='/tmp/garment-ppf-service-client-test'
const sdk=spawnSync('xcrun',['--show-sdk-path'],{encoding:'utf8'}).stdout.trim()
const build=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor',...(sdk?['-isysroot',sdk]:[]),'native_cpp/core/ppf_service_client.cpp','native_cpp/tests/test_ppf_service_client.cpp','-lcurl','-o',binary],{encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
let mode='ok',poll=0
const seen=[]
const server=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):null;seen.push({method:req.method,path:req.url,body});res.setHeader('Content-Type','application/json');
 if(mode==='http'){res.statusCode=503;res.end(JSON.stringify({ok:false,error:'ppf unavailable'}));return}
 if(mode==='body'){res.end(JSON.stringify({ok:false,error:'ppf rejected'}));return}
 if(mode==='fallback'){res.statusCode=502;res.end(JSON.stringify({ok:false}));return}
 let result={ok:true};if(req.url==='/health')result.version=1;else if(req.method==='POST')result.job={id:'job 1/Ω',status:'queued'};else if(req.url.includes('/preview'))result.preview={readonly:true,frame:2};else if(mode==='poll'){poll++;result.job={id:'wait',status:poll<3?'running':'done'}}else if(mode==='jobError')result.job={id:'wait',status:'error',error:'solver stopped'};else result.job={id:'job 1/Ω',status:'done'};res.end(JSON.stringify(result))
})
server.listen(5192,'127.0.0.1');await once(server,'listening')
async function native(operation,{value,id,options={}}={}){const p=spawn(binary,[],{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.stdin.end(JSON.stringify({operation,value,id,options})+'\n');const [code]=await once(p,'close');assert.equal(code,0,err);return JSON.parse(out.trim())}
const project={id:'ppf-mock',pieces:[]},id='job 1/Ω'
const checks=[['health',()=>getPpfServiceHealth(),{}],['submit',()=>submitPpfFinalSolve(project),{value:project}],['submit',()=>submitPpfFinalSolve(project,{frames:4,minTorsoDepth:.22,minArmOffset:.6,allowExplodedExperimental:true}),{value:project,options:{frames:4,minTorsoDepth:.22,minArmOffset:.6,allowExplodedExperimental:true}}],['job',()=>getPpfJob(id),{id}],['preview',()=>getPpfJobPreview(id),{id}],['preview',()=>getPpfJobPreview(id,{frame:2,stage:'pre view/Ω',validatedOnly:true}),{id,options:{frame:2,stage:'pre view/Ω',validatedOnly:true}}]]
try{
 for(const [op,js,args] of checks){const expected=await js(),jsRequest=seen.at(-1),cpp=await native(op,args),cppRequest=seen.at(-1);assert.equal(cpp.ok,true,cpp.error);assert.deepEqual(cpp.value,expected);assert.deepEqual(cppRequest,jsRequest);console.log(JSON.stringify({op,requestParity:true,responseParity:true,path:jsRequest.path}))}
 for(const state of ['http','body','fallback']){mode=state;for(const [op,js,args] of checks.filter(x=>['health','submit','job','preview'].includes(x[0])).filter((v,i,a)=>a.findIndex(x=>x[0]===v[0])===i)){
  let err;try{await js()}catch(e){err=e.message}assert.ok(err);const cpp=await native(op,args);assert.equal(cpp.ok,false);assert.equal(cpp.error,err);console.log(JSON.stringify({state,op,errorParity:true}))}}
 mode='poll';poll=0;let progress=[];const jsResult=await waitForPpfJob('wait',{pollMs:1,timeoutMs:2000,onProgress:j=>progress.push(j.status)});assert.equal(jsResult.status,'done');poll=0;progress=[];const cpp=await native('wait',{id:'wait',options:{pollMs:1,timeoutMs:2000}});assert.equal(cpp.ok,true,cpp.error);assert.deepEqual(cpp.value,jsResult);assert.equal(cpp.progress,3);console.log(JSON.stringify({op:'wait',status:'done',progress:cpp.progress}))
 mode='jobError';let expectedError;try{await waitForPpfJob('wait',{pollMs:1,timeoutMs:100})}catch(e){expectedError=e.message}const failure=await native('wait',{id:'wait',options:{pollMs:1,timeoutMs:100}});assert.equal(failure.error,expectedError)
 const remote=await native('health',{options:{baseUrl:'https://example.org'}});assert.equal(remote.ok,false);assert.match(remote.error,/allowRemote/)
 console.log('PPF service client mock parity passed; remote rejected; no solver launched')
}finally{server.close()}
