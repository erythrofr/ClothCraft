// No GUI/browser dependency; proves the CLO A06 dimensional Base Polygon uses
// genuine Rust creation, save, and undo in a throwaway native project.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const out=mkdtempSync(join(tmpdir(),'exo-native-base-primitive-'))
mkdirSync(join(out,'workspace'),{recursive:true})
const binary=join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(binary))
const port=5655,url=`http://127.0.0.1:${port}/workspace`
const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{cwd:root,detached:true,stdio:'ignore',env:{...process.env,EXO_CLOTHCRAFT_PORT:String(port),EXO_CLOTHCRAFT_OUTPUT_DIR:out,EXO_CLOTHCRAFT_REPO:join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:binary,EXO_CLOTHCRAFT_GPU:'0'}})
const post=async args=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});const j=await r.json();assert(j.ok,JSON.stringify(j.error));return j.data}
try{
 let ready=false
 for(let i=0;i<90;i++){try{const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(800)});const j=await r.json();if(j.ok&&j.nativeReady){ready=true;break}}catch{}await sleep(250)}
 assert(ready,'Native server not ready')
 const original=await post({op:'snapshot'})
 const cmd={kind:'Primitive',shape:'rectangle',size:[.415,.625],origin:[0,0],fabric:original.template.fabrics[0].id}
 const created=await post({op:'edit',revision:original.revision,command:cmd})
 assert.equal(created.template.panels.length,original.template.panels.length+1)
 const save=await post({op:'save'})
 assert.equal(save.project.template.panels.length,created.template.panels.length)
 const restored=await post({op:'undo',revision:created.revision})
 assert.equal(restored.template.panels.length,original.template.panels.length)
 console.log(JSON.stringify({pass:true,source:'Rust authoring::Primitive',dimensionsMm:[415,625],panelsBefore:original.template.panels.length,created:created.template.panels.length,undone:restored.template.panels.length,saved:true,isolatedFolder:out},null,2))
}finally{try{process.kill(-child.pid,'SIGTERM')}catch{}}
