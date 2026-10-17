import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-layout-batch-')),w=createWorkspace(output)
let s
async function request(data){const r=await w.request({revision:s?.revision,...data});assert(r.ok,r.error);if(r.data?.template)s=r.data;return r.data}
try{
 await request({op:'open',preset:'tshirt'})
 const initial=structuredClone(s),commands=s.template.panels.map((p,i)=>({kind:'BoardTransform',panel:p.id,origin:[i*.9,0],rotation_degrees:0}))
 const bad=await w.request({op:'edit-batch',revision:s.revision,commands:[commands[0],{...commands[1],panel:'missing-panel'}]})
 assert.equal(bad.ok,false)
 await request({op:'snapshot'})
 assert.deepEqual(s.template,initial.template);assert.equal(s.revision,initial.revision);assert.equal(s.canUndo,initial.canUndo)
 await request({op:'edit-batch',commands})
 const arranged=structuredClone(s)
 assert.deepEqual(s.positions,initial.positions);assert.deepEqual(s.uv,initial.uv)
 await request({op:'undo'});assert.deepEqual(s.template,initial.template)
 await request({op:'redo'});assert.deepEqual(s.template,arranged.template)
 const saved=await request({op:'save'});await request({op:'open',project:saved.project});assert.deepEqual(s.template,arranged.template)
 console.log(JSON.stringify({passed:true,output,checks:['invalid batch fully rolls back with no history','rest UV and drape preserved','one-step undo/redo','native save/reopen']}))
}finally{w.close()}
