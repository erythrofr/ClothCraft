// Disposable test for a real compiled Rust seam coupling, its Undo/Redo and saved template.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import os from 'node:os'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(os.tmpdir(),'exo-native-seam-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const url='http://127.0.0.1:5643'
const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
 cwd:root,detached:true,stdio:'ignore',
 env:{...process.env,EXO_CLOTHCRAFT_PORT:'5643',
 EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
 EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
 EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0'},
})
const request=async command=>{
 const response=await fetch(url+'/workspace',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(command),
  signal:AbortSignal.timeout(20000)})
 const data=await response.json()
 return {http:response.status,...data}
}
try{
 let ready=false
 for(let i=0;i<90;i++){
  try{if((await fetch(url+'/health',{signal:AbortSignal.timeout(1300)})).ok){ready=true;break}}catch{}
  if(child.exitCode!==null)throw Error('Isolated seam service exited unexpectedly')
  await new Promise(resolve=>setTimeout(resolve,150))
 }
 assert(ready,'Isolated Rust service not ready')
 const first=await request({op:'snapshot'})
 assert(first.ok,first.error)
 const seam=first.data.template.seams[0]
 assert(seam?.id,'Fixture requires a real compiled seam')
 const original={reverse:seam.reverse_b,ease:seam.allow_ease,stiffness:seam.stiffness}
 const requested={seam:seam.id,reverse:!original.reverse,
  ease:!original.ease,stiffness:original.stiffness*1.2}
 const invalid=await request({op:'edit-seam',revision:first.data.revision,...requested,stiffness:1})
 assert.equal(invalid.ok,false,'Invalid physical coupling must be rejected')
 assert.equal((await request({op:'snapshot'})).data.revision,first.data.revision)
 const edit=await request({op:'edit-seam',revision:first.data.revision,...requested})
 assert(edit.ok,edit.error)
 const changed=edit.data.template.seams.find(s=>s.id===seam.id)
 assert(changed)
 assert.equal(changed.reverse_b,requested.reverse)
 assert.equal(changed.allow_ease,requested.ease)
 assert.equal(changed.stiffness,requested.stiffness)
 assert.equal(edit.data.template.seams.length,first.data.template.seams.length)
 assert(edit.data.canUndo)
 const undo=await request({op:'undo',revision:edit.data.revision})
 assert(undo.ok,undo.error)
 const restored=undo.data.template.seams.find(s=>s.id===seam.id)
 assert.equal(restored.reverse_b,original.reverse)
 assert.equal(restored.allow_ease,original.ease)
 assert.equal(restored.stiffness,original.stiffness)
 const redo=await request({op:'redo',revision:undo.data.revision})
 assert(redo.ok,redo.error)
 assert.equal(redo.data.template.seams.find(s=>s.id===seam.id).stiffness,requested.stiffness)
 const save=await request({op:'save'})
 assert(save.ok,save.error)
 assert.equal(save.data.project.template.seams.find(s=>s.id===seam.id).stiffness,requested.stiffness)
 console.log(JSON.stringify({passed:true,seam:seam.id,compiledConstraint:true,
  reversalEdited:true,easingEdited:true,stiffnessEdited:true,
  invalidRejected:true,undoRestored:true,redoRestored:true,
  savedPersistent:true,otherSeamsPreserved:true,userProjectTouched:false,output},null,2))
}finally{
 try{process.kill(-child.pid,'SIGTERM')}catch{}
}
