// Native, disposable test of persistent notch and seam allowance in compiled
// Rust template. Uses an isolated port and folder; no personal garment edits.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(os.tmpdir(),'exo-native-markings-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const url='http://127.0.0.1:5644'
const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
 cwd:root,detached:true,stdio:'ignore',
 env:{...process.env,EXO_CLOTHCRAFT_PORT:'5644',
 EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
 EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
 EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0'},
})
const request=async command=>{
 const response=await fetch(url+'/workspace',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(command),
  signal:AbortSignal.timeout(20000)})
 return {...(await response.json()),http:response.status}
}
try{
 let ready=false
 for(let i=0;i<90;i++){
  try{if((await fetch(url+'/health',{signal:AbortSignal.timeout(1300)})).ok){ready=true;break}}catch{}
  if(child.exitCode!==null)throw Error('Isolated native marking server exited')
  await new Promise(resolve=>setTimeout(resolve,150))
 }
 assert(ready,'Isolated Rust service unavailable')
 const first=await request({op:'snapshot'})
 assert(first.ok,first.error)
 const panel=first.data.template.panels.find(item=>item.polygon?.edges?.length)
 assert(panel,'Fixture requires polygon pattern')
 const edge=panel.polygon.edges[0],base={panel:panel.id,edge}
 const oldTriangleCount=first.data.triangles.length
 const oldVertexCount=first.data.positions.length
 const edit=await request({op:'edit',revision:first.data.revision,
  command:{kind:'Notch',...base,t:.37,depth_m:.006}})
 assert(edit.ok,edit.error)
 const afterNotch=edit.data.template.panels.find(p=>p.id===panel.id).polygon
 assert.equal(afterNotch.notches[edge].length,1)
 assert.equal(afterNotch.notches[edge][0].t,.37)
 assert.equal(afterNotch.notches[edge][0].depth_m,.006)
 assert.equal(edit.data.positions.length,oldVertexCount,'Notch changed simulated particle mesh')
 assert.equal(edit.data.triangles.length,oldTriangleCount,'Notch changed pattern triangle count')
 const allowance=await request({op:'edit',revision:edit.data.revision,
  command:{kind:'SeamAllowance',...base,width_m:.012}})
 assert(allowance.ok,allowance.error)
 const afterAllowance=allowance.data.template.panels.find(p=>p.id===panel.id).polygon
 assert.equal(afterAllowance.seam_allowances[edge],.012)
 assert.equal(allowance.data.positions.length,oldVertexCount)
 const invalid=await request({op:'edit',revision:allowance.data.revision,
  command:{kind:'Notch',...base,t:2,depth_m:.006}})
 assert.equal(invalid.ok,false)
 const afterInvalid=await request({op:'snapshot'})
 assert.equal(afterInvalid.data.revision,allowance.data.revision,'Invalid marker changed revision')
 const undo=await request({op:'undo',revision:allowance.data.revision})
 assert(undo.ok,undo.error)
 assert.equal(undo.data.template.panels.find(p=>p.id===panel.id).polygon.seam_allowances?.[edge],undefined)
 const undoAgain=await request({op:'undo',revision:undo.data.revision})
 assert(undoAgain.ok,undoAgain.error)
 assert.equal(undoAgain.data.template.panels.find(p=>p.id===panel.id).polygon.notches?.[edge],undefined)
 const redo=await request({op:'redo',revision:undoAgain.data.revision})
 assert(redo.ok,redo.error)
 const redoAgain=await request({op:'redo',revision:redo.data.revision})
 assert(redoAgain.ok,redoAgain.error)
 const save=await request({op:'save'})
 assert(save.ok,save.error)
 const stored=save.data.project.template.panels.find(p=>p.id===panel.id).polygon
 assert.equal(stored.notches[edge][0].t,.37)
 assert.equal(stored.seam_allowances[edge],.012)
 console.log(JSON.stringify({passed:true,panel:panel.id,edge,notchM:.006,allowanceM:.012,
  persistedNative:true,unchangedSimulationVertices:true,unchangedTriangleCount:true,
  invalidRejected:true,undoTwice:true,redoTwice:true,saveRetainsBoth:true,
  touchesPersonalProject:false,output},null,2))
}finally{try{process.kill(-child.pid,'SIGTERM')}catch{}}
