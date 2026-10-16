import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const received=[]
const server=createServer(async(request,response)=>{
  let body=''
  for await(const chunk of request)body+=chunk
  const json=body?JSON.parse(body):null
  received.push({method:request.method,path:request.url,body:json})
  response.setHeader('Content-Type','application/json')
  if(request.url==='/health')response.end(JSON.stringify({ok:true,engine:'mock-native'}))
  else if(request.url==='/simulate'||request.url==='/step')
    response.end(JSON.stringify({ok:true,result:{frames:2,runtimeMs:17,request:json,state:{particles:[]}}}))
  else{response.statusCode=404;response.end(JSON.stringify({ok:false,error:'missing endpoint'}))}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
const baseUrl=`http://127.0.0.1:${port}`
const document={id:'test',pieces:[],seams:[],avatar:{},simulation:{},fabrics:{}}
async function cli(op,args={}){
  const child=spawn(binary,[],{stdio:['pipe','pipe','pipe']})
  let output='',error=''
  child.stdout.on('data',data=>output+=data)
  child.stderr.on('data',data=>error+=data)
  child.stdin.end(JSON.stringify({protocol:'garment-studio.native-cad.v1',
    document,op,args})+'\n')
  const [exitCode]=await once(child,'close')
  assert.equal(exitCode,0,error)
  return JSON.parse(output.trim())
}
try{
  const health=await cli('native-service-health',{options:{baseUrl}})
  assert.equal(health.ok,true,health.error)
  assert.equal(health.health.engine,'mock-native')
  assert.deepEqual(received.at(-1),{method:'GET',path:'/health',body:null})

  const solved=await cli('native-service-solve',{options:{baseUrl,frames:2,quality:'draft'}})
  assert.equal(solved.ok,true,solved.error)
  assert.equal(solved.fitCertified,false)
  assert.equal(solved.solverResult.elapsedMs,17)
  assert.equal(received.at(-1).path,'/simulate')
  assert.equal(received.at(-1).body.frames,2)
  assert.equal(received.at(-1).body.quality,'draft')
  assert.equal(received.at(-1).body.project.id,document.id)

  const step=await cli('native-service-step',{
    payload:{particles:[]},options:{baseUrl,frames:2}})
  assert.equal(step.ok,true,step.error)
  assert.equal(step.solverResult.elapsedMs,17)
  assert.equal(received.at(-1).path,'/step')
  assert.deepEqual(received.at(-1).body,{payload:{particles:[]},frames:2})

  const remote=await cli('native-service-health',{options:{baseUrl:'https://example.org'}})
  assert.equal(remote.ok,false)
  assert.match(remote.error,/allowRemote/)
  console.log('Native C++ local HTTP CLI: health, solve, step and remote-denial integration passed on ephemeral localhost mock')
}finally{server.close()}
