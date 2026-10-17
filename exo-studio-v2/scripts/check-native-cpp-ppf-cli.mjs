import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'

// Test ONLY against an ephemeral loopback mock. Never submit a real PPF job.
const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const jobId='job 1/Ω'
const pathId='job%201%2F%CE%A9'
const requests=[]
let polls=0
const server=createServer(async(request,response)=>{
  let raw=''
  for await(const chunk of request)raw+=chunk
  const body=raw?JSON.parse(raw):null
  requests.push({method:request.method,path:request.url,body})
  response.setHeader('Content-Type','application/json')
  if(request.url==='/health')response.end(JSON.stringify({ok:true,version:'mock-ppf'}))
  else if(request.url==='/jobs' && request.method==='POST')
    response.end(JSON.stringify({ok:true,job:{id:jobId,status:'queued'}}))
  else if(request.url===`/jobs/${pathId}`){
    polls++
    response.end(JSON.stringify({ok:true,job:{id:jobId,status:polls>=3?'done':'running'}}))
  }else if(request.url===`/jobs/${pathId}/preview?frame=2&stage=pre+view%2F%CE%A9&validatedOnly=true`)
    response.end(JSON.stringify({ok:true,preview:{readonly:true,frame:2}}))
  else {
    response.statusCode=404
    response.end(JSON.stringify({ok:false,error:'unrecognized mock PPF request'}))
  }
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const baseUrl=`http://127.0.0.1:${server.address().port}`
const document={id:'ppf-cli-test',pieces:[],seams:[],fabrics:{},avatar:{},simulation:{}}
async function cli(op,args={}){
  const child=spawn(binary,[],{stdio:['pipe','pipe','pipe']})
  let output='',error=''
  child.stdout.on('data',bytes=>output+=bytes)
  child.stderr.on('data',bytes=>error+=bytes)
  child.stdin.end(JSON.stringify({protocol:'garment-studio.native-cad.v1',document,op,args})+'\n')
  const [code]=await once(child,'close')
  assert.equal(code,0,error)
  return JSON.parse(output.trim())
}
try{
  const health=await cli('ppf-service-health',{options:{baseUrl}})
  assert.equal(health.ok,true,health.error)
  assert.equal(health.health.version,'mock-ppf')
  assert.deepEqual(requests.at(-1),{method:'GET',path:'/health',body:null})

  const submission=await cli('ppf-service-submit',{options:{baseUrl,frames:4,
    minTorsoDepth:.22,minArmOffset:.6,allowExplodedExperimental:true}})
  assert.equal(submission.ok,true,submission.error)
  assert.equal(submission.fitCertified,false)
  assert.deepEqual(submission.job,{id:jobId,status:'queued'})
  const request=requests.at(-1)
  assert.equal(request.method,'POST')
  assert.equal(request.path,'/jobs')
  assert.equal(request.body.project.id,document.id)
  assert.deepEqual(request.body.options,{frames:4,minTorsoDepth:.22,
    minArmOffset:.6,allowExplodedExperimental:true})

  const preview=await cli('ppf-service-preview',{id:jobId,options:{baseUrl,frame:2,
    stage:'pre view/Ω',validatedOnly:true}})
  assert.equal(preview.ok,true,preview.error)
  assert.equal(preview.readOnly,true)
  assert.deepEqual(preview.preview,{readonly:true,frame:2})
  assert.equal(requests.at(-1).path,
    `/jobs/${pathId}/preview?frame=2&stage=pre+view%2F%CE%A9&validatedOnly=true`)

  const fetched=await cli('ppf-service-job',{id:jobId,options:{baseUrl}})
  assert.equal(fetched.ok,true,fetched.error)
  assert.equal(fetched.job.status,'running')
  assert.equal(requests.at(-1).path,`/jobs/${pathId}`)

  const done=await cli('ppf-service-wait',{id:jobId,options:{baseUrl,pollMs:1,timeoutMs:2500}})
  assert.equal(done.ok,true,done.error)
  assert.equal(done.job.status,'done')
  assert.equal(done.progressChecks,2)
  assert.equal(done.fitCertified,false)

  const remote=await cli('ppf-service-health',{options:{baseUrl:'https://example.org'}})
  assert.equal(remote.ok,false)
  assert.match(remote.error,/allowRemote/)
  console.log('Native PPF CLI integration passed: health, guarded submission, percent-encoded job status/preview, progress polling and remote rejection on ephemeral localhost mock')
}finally{server.close()}
