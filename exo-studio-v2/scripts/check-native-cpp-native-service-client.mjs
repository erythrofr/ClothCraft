import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {getNativeBackendHealth,getNativeServiceHealth,runNativeBackend,solveWithNativeService,stepNativePayload} from '../src/core/backends/nativeServiceClient.js'
const binary='/tmp/garment-native-service-client-test'
const sdk=spawnSync('xcrun',['--show-sdk-path'],{encoding:'utf8'}).stdout.trim()
const built=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor',...(sdk?['-isysroot',sdk]:[]),'native_cpp/core/native_service_client.cpp','native_cpp/tests/test_native_service_client.cpp','-lcurl','-o',binary],{encoding:'utf8'})
assert.equal(built.status,0,built.stderr)
const received=[]
let mode='ok'
const server=createServer(async(req,res)=>{
 let body='';for await(const chunk of req)body+=chunk
 received.push({method:req.method,url:req.url,body:body?JSON.parse(body):null})
 res.setHeader('Content-Type','application/json')
 if(mode==='http'){res.statusCode=503;res.end(JSON.stringify({ok:false,error:'service unavailable'}))}
 else if(mode==='bad'){res.end(JSON.stringify({ok:false,error:'simulation rejected'}))}
 else if(mode==='fallback'){res.statusCode=502;res.end(JSON.stringify({ok:false}))}
 else res.end(JSON.stringify(req.url==='/health'?{ok:true,service:'mock',version:1}:{ok:true,result:{runtimeMs:12,request:{accepted:true},state:[1,2,3]}}))
})
server.listen(5191,'127.0.0.1');await once(server,'listening')
// Running curl synchronously on the server's event loop would deadlock; keep
// mock in this process and run native worker asynchronously.
async function native(operation,value,options={}){
 const child=spawn(binary,[],{stdio:['pipe','pipe','pipe']});let output='',errors=''
 child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>errors+=d)
 child.stdin.end(JSON.stringify({operation,value,options})+'\n')
 const [code]=await once(child,'close');assert.equal(code,0,errors)
 return JSON.parse(output.trim())
}
const project={id:'fixture',pieces:[]},payload={particles:[{position:[0,1,0]}]}
const checks=[
 ['health',()=>getNativeBackendHealth(),null,{}],
 ['serviceHealth',()=>getNativeServiceHealth(),null,{}],
 ['run',()=>runNativeBackend(project),project,{}],
 ['solve',()=>solveWithNativeService(project),project,{}],
 ['step',()=>stepNativePayload(payload),payload,{}],
 ['solve',()=>solveWithNativeService(project,{frames:3,quality:'draft',clothModel:'distance',bendingModel:'distance',experimentalSewFirst:true}),project,{frames:3,quality:'draft',clothModel:'distance',bendingModel:'distance',experimentalSewFirst:true}],
 ['step',()=>stepNativePayload(payload,{frames:2}),payload,{frames:2}],
]
try{
 for(const [operation,invoke,value,options] of checks){
  const js=await invoke(),jsRequest=received.at(-1)
  const cpp=await native(operation,value,options),cppRequest=received.at(-1)
  assert.equal(cpp.ok,true,`${operation}: ${cpp.error}`);assert.deepEqual(cpp.value,js)
  assert.deepEqual(cppRequest,jsRequest,`${operation} request parity`)
  console.log(JSON.stringify({operation,responseParity:true,requestParity:true,request:jsRequest}))
 }
 for(const status of ['http','bad','fallback']){
  mode=status;for(const operation of ['health','run','solve','step']){
   const invoke={health:()=>getNativeBackendHealth(),run:()=>runNativeBackend(project),solve:()=>solveWithNativeService(project),step:()=>stepNativePayload(payload)}[operation]
   let error;try{await invoke()}catch(e){error=e.message}
   assert.ok(error)
   const nativeResponse=await native(operation,operation==='step'?payload:project)
   assert.equal(nativeResponse.ok,false);assert.equal(nativeResponse.error,error)
   console.log(JSON.stringify({status,operation,errorParity:true,error}))
  }
 }
 const remote=await native('health',null,{baseUrl:'https://example.org'})
 assert.equal(remote.ok,false);assert.match(remote.error,/allowRemote/)
 console.log('Remote URL rejected by default; no real solver started')
}finally{server.close()}
