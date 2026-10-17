// Native QA against a disposable workspace, never the user's saved project.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(tmpdir(),'exo-notches-allowances-qa-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const binary=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(binary),'Compiled native exo-session binary missing')
const port=5687,base=`http://127.0.0.1:${port}`
const server=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
 cwd:root,detached:true,stdio:'ignore',env:{...process.env,
 EXO_CLOTHCRAFT_PORT:String(port),EXO_CLOTHCRAFT_OUTPUT_DIR:output,
 EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
 EXO_CLOTHCRAFT_SESSION_BIN:binary,EXO_CLOTHCRAFT_GPU:'0'}})
const req=async payload=>{
 const response=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)})
 return response.json()
}
const polygon=(data,id)=>data.template.panels.find(p=>p.id===id)?.polygon
const immutable=data=>({positions:data.positions,triangles:data.triangles,
 velocities:data.velocities,time:data.time,seams:data.template.seams,
 construction:data.template.panels.map(p=>({id:p.id,points:p.polygon?.points,
 curves:p.polygon?.curves,construction_lines:p.polygon?.construction_lines,
 internal_lines:p.polygon?.internal_lines}))})
const check=(value,label)=>assert(value,label)
try{
 let up=false
 for(let i=0;i<100;i++){
  try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(1000)})).ok){up=true;break}}catch{}
  if(server.exitCode!==null)throw Error('Native server exited prematurely')
  await sleep(170)
 }
 check(up,'Native workspace service not ready')
 const initial=await req({op:'snapshot'});check(initial.ok,initial.error)
 const panel=initial.data.template.panels.find(p=>p.polygon?.edges?.length)
 check(panel,'No editable contour in native fixture')
 const edge=panel.polygon.edges[0],id=panel.id,unchanged=immutable(initial.data)
 const edit=async(data,command)=>{
  const result=await req({op:'edit',revision:data.revision,command})
  check(result.ok,`${command.kind}: ${result.error}`)
  assert.deepEqual(immutable(result.data),unchanged,`${command.kind} changed construction, stitches or drape`)
  return result.data
 }
 const notch={kind:'Notch',panel:id,edge,t:.37,depth_m:.006}
 const allowance={kind:'SeamAllowance',panel:id,edge,width_m:.012}
 let state=await edit(initial.data,notch)
 assert.deepEqual(polygon(state,id).notches[edge],[{t:.37,depth_m:.006}])
 state=await edit(state,allowance)
 assert.equal(polygon(state,id).seam_allowances[edge],.012)
 const bad=await req({op:'edit',revision:state.revision,command:{...notch,t:2}})
 assert.equal(bad.ok,false,'Invalid notch accepted')
 assert.equal((await req({op:'snapshot'})).data.revision,state.revision)
 const both=state
 let undone=await req({op:'undo',revision:state.revision});check(undone.ok,undone.error)
 assert.equal(polygon(undone.data,id).seam_allowances?.[edge],undefined)
 assert.deepEqual(immutable(undone.data),unchanged)
 undone=await req({op:'undo',revision:undone.data.revision});check(undone.ok,undone.error)
 assert.equal(polygon(undone.data,id).notches?.[edge],undefined)
 let redone=await req({op:'redo',revision:undone.data.revision});check(redone.ok,redone.error)
 redone=await req({op:'redo',revision:redone.data.revision});check(redone.ok,redone.error)
 assert.equal(polygon(redone.data,id).seam_allowances[edge],.012)
 assert.deepEqual(polygon(redone.data,id).notches[edge],[{t:.37,depth_m:.006}])
 assert.deepEqual(immutable(redone.data),unchanged)
 state=await edit(redone.data,{kind:'RemoveNotch',panel:id,edge,t:.37})
 assert.equal(polygon(state,id).notches?.[edge],undefined)
 state=await edit(state,{kind:'SeamAllowance',panel:id,edge,width_m:0})
 assert.equal(polygon(state,id).seam_allowances?.[edge],undefined)
 let undoRemoval=await req({op:'undo',revision:state.revision});check(undoRemoval.ok,undoRemoval.error)
 assert.equal(polygon(undoRemoval.data,id).seam_allowances[edge],.012)
 undoRemoval=await req({op:'undo',revision:undoRemoval.data.revision});check(undoRemoval.ok,undoRemoval.error)
 assert.deepEqual(polygon(undoRemoval.data,id).notches[edge],[{t:.37,depth_m:.006}])
 const save=await req({op:'save'});check(save.ok,save.error)
 const saved=save.data.project.template.panels.find(p=>p.id===id).polygon
 assert.equal(saved.seam_allowances[edge],.012)
 assert.deepEqual(saved.notches[edge],[{t:.37,depth_m:.006}])
 console.log(JSON.stringify({passed:true,output,panel:id,edge,commands:['Notch','SeamAllowance','RemoveNotch','SeamAllowance(clear)'],invalidRejected:true,undoRedo:true,savePersists:true,constructionAndDrapePreserved:true,baselineRevision:initial.data.revision,markedRevision:both.revision},null,2))
}finally{try{process.kill(-server.pid,'SIGTERM')}catch{}}
