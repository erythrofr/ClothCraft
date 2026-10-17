// Native CLO 2D A13/A14 annotation acceptance without touching installed data.
// Add / edit / remove, Undo, and JSON project reopen run in a disposable server.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const folder=mkdtempSync(join(tmpdir(),'exo-annotations-'))
mkdirSync(join(folder,'workspace'),{recursive:true})
const native=join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(native),'Native compiled engine missing')
const port=5665,base=`http://127.0.0.1:${port}`
const server=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{cwd:root,detached:true,stdio:'ignore',env:{...process.env,EXO_CLOTHCRAFT_PORT:String(port),EXO_CLOTHCRAFT_OUTPUT_DIR:folder,EXO_CLOTHCRAFT_REPO:join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:native,EXO_CLOTHCRAFT_GPU:'0'}})
const post=async data=>{const response=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});const value=await response.json();assert(value.ok,`${JSON.stringify(data)}: ${value.error||response.status}`);return value.data}
try{
 let ready=false
 for(let n=0;n<100;n++){try{const response=await fetch(base+'/health',{signal:AbortSignal.timeout(800)});const status=await response.json();if(status.ok&&status.nativeReady){ready=true;break}}catch{}await sleep(250)}
 assert(ready,'Disposable native session did not start')
 const initial=await post({op:'snapshot'}),panel=initial.template.panels[0].id
 const annotations=s=>s.template.panels.find(p=>p.id===panel).polygon.annotations||[]
 assert.equal(annotations(initial).length,0)
 let result=await post({op:'edit',revision:initial.revision,command:{kind:'Annotation',panel,text:'CUT ON FOLD',position:[.22,.31]}})
 assert.equal(annotations(result).length,1)
 const id=annotations(result)[0].id
 assert.equal(annotations(result)[0].text,'CUT ON FOLD')
 const afterAdd=await post({op:'save'})
 assert.equal(afterAdd.project.template.panels.find(p=>p.id===panel).polygon.annotations[0].id,id)
 result=await post({op:'edit',revision:result.revision,command:{kind:'Annotation',panel,id,text:'SEW GUIDE',position:[.25,.32]}})
 assert.equal(annotations(result)[0].text,'SEW GUIDE')
 const edited=await post({op:'save'})
 assert.equal(edited.project.template.panels.find(p=>p.id===panel).polygon.annotations[0].text,'SEW GUIDE')
 result=await post({op:'edit',revision:result.revision,command:{kind:'RemoveAnnotation',panel,id}})
 assert.equal(annotations(result).length,0)
 result=await post({op:'undo',revision:result.revision})
 assert.equal(annotations(result)[0].text,'SEW GUIDE')
 const reopened=await post({op:'open',project:edited.project})
 assert.equal(annotations(reopened)[0].id,id)
 assert.equal(annotations(reopened)[0].text,'SEW GUIDE')
 console.log(JSON.stringify({pass:true,tool:'CLO 2D Pattern Annotation',panel,id,add:true,edit:true,delete:true,undo:true,jsonReopen:true,compiledEngine:native,disposableWorkspace:folder},null,2))
}finally{try{process.kill(-server.pid,'SIGTERM')}catch{}}
