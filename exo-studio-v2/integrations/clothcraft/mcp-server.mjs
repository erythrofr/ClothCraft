#!/usr/bin/env node
// Model Context Protocol stdio facade for the EXISTING versioned local API.
// It shares the app's revision-checked Rust session; never starts a second
// solver, runs shell commands or accepts arbitrary tool names.
import {createInterface} from 'node:readline'

const candidate=process.env.EXO_MCP_BRIDGE_URL||'http://127.0.0.1:5385'
const parsed=new URL(candidate)
if(parsed.protocol!=='http:'||!['127.0.0.1','localhost','::1','[::1]'].includes(parsed.hostname)
  ||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search)throw Error('EXO MCP requires an explicit loopback bridge URL')
const bridge=parsed.origin
const allowEdits=process.env.EXO_MCP_ALLOW_EDITS==='1'
const definition=(name,description,properties={},required=[],readOnly=true)=>({
 name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},
 annotations:{readOnlyHint:readOnly,destructiveHint:false,openWorldHint:false},
})
const str={type:'string'},revision={type:'integer',minimum:0}
const tools=[
 definition('exo_capabilities','Inspect the exact native EXO agent capabilities and limitations.'),
 definition('exo_status','Read the local native garment session status.'),
 definition('exo_project_summary','Read panel, material and sewing summaries from the current Rust project.'),
 definition('exo_line_inspect','Measure a named edge in real 2D and 3D geometry.',{panel:str,edge:str},['panel','edge']),
 definition('exo_step_simulation','Advance the actual Rust cloth solver 1–4 steps; requires the current revision and EXO_MCP_ALLOW_EDITS=1.',{expectedRevision:revision,steps:{type:'integer',minimum:1,maximum:4}},['expectedRevision','steps'],false),
 definition('exo_pause_simulation','Pause the native solver at a verified revision; requires EXO_MCP_ALLOW_EDITS=1.',{expectedRevision:revision},['expectedRevision'],false),
 definition('exo_set_line_target','Set a 2D pattern line target specification in centimeters (annotation, no physical deformation). Requires EXO_MCP_ALLOW_EDITS=1.',{expectedRevision:revision,panel:str,edge:str,targetCm:{type:'number',minimum:.01,maximum:1000}},['expectedRevision','panel','edge','targetCm'],false),
]
const route={
 exo_line_inspect:'line.inspect',
 exo_step_simulation:'simulation.step',
 exo_pause_simulation:'simulation.pause',
 exo_set_line_target:'line.setTargetSpecification',
}
async function request(path,body){
 const options={method:body?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}
 const response=await fetch(bridge+path,options)
 let payload
 try{payload=await response.json()}catch{throw Error('EXO bridge returned invalid JSON')}
 if(!response.ok||payload.ok===false)throw Error(payload.error||payload.code||`EXO service returned HTTP ${response.status}`)
 return payload
}
function summarize(value){
 const data=value.data||{}
 return {revision:data.revision??null,name:data.template?.name||data.name||'Current native project',
  panels:(data.template?.panels||[]).map(p=>({id:p.id,name:p.name||p.id,fabric:p.fabric,edges:p.polygon?.edges||[]})),
  fabrics:(data.template?.fabrics||[]).map(f=>({id:f.id,name:f.name,properties:f.properties})),
  seams:(data.template?.seams||[]).length,
  time:data.time,running:Boolean(data.running),busy:Boolean(data.busy)}
}
async function call(name,args={}){
 const spec=tools.find(item=>item.name===name)
 if(!spec)throw Error('Unsupported tool')
 const schema=spec.inputSchema
 if(args===null||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!(key in schema.properties))||schema.required.some(key=>!(key in args)))throw Error('Invalid or missing tool arguments')
 if(!spec.annotations.readOnlyHint&&!allowEdits)throw Error('Editing disabled. Launch MCP with EXO_MCP_ALLOW_EDITS=1 only after reviewing actions and project revisions.')
 let result
 if(name==='exo_capabilities')result=await request('/agent/v1/capabilities')
 else if(name==='exo_status')result=await request('/agent/v1/status')
 else if(name==='exo_project_summary')result=summarize(await request('/agent/v1/actions',{action:'workspace.snapshot'}))
 else result=await request('/agent/v1/actions',{action:route[name],...args})
 return {content:[{type:'text',text:JSON.stringify(result)}],isError:false}
}
function send(payload){process.stdout.write(JSON.stringify(payload)+'\n')}
const rl=createInterface({input:process.stdin,crlfDelay:Infinity})
rl.on('line',async line=>{
 let msg
 try{
  msg=JSON.parse(line)
  if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')throw Error('Invalid JSON-RPC')
  if(!Object.hasOwn(msg,'id'))return
  const id=msg.id
  if(msg.method==='initialize')return send({jsonrpc:'2.0',id,result:{protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'exo-clothcraft-local',version:'0.1.0'}}})
  if(msg.method==='ping')return send({jsonrpc:'2.0',id,result:{}})
  if(msg.method==='tools/list')return send({jsonrpc:'2.0',id,result:{tools}})
  if(msg.method==='tools/call'){
   try{return send({jsonrpc:'2.0',id,result:await call(msg.params?.name,msg.params?.arguments??{})})}
   catch(error){return send({jsonrpc:'2.0',id,result:{content:[{type:'text',text:error.message}],isError:true}})}
  }
  return send({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}})
 }catch(error){send({jsonrpc:'2.0',id:msg?.id??null,error:{code:-32600,message:error.message}})}
})
