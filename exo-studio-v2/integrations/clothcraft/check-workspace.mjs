import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-clothcraft-workspace-'))
const workspace=createWorkspace(output)
let state
const request=async data=>{const r=await workspace.request({...data,revision:state?.revision});if(r.ok&&r.data?.template)state=r.data;return r}
try{
 await assert.rejects(workspace.request({op:'edit',command:{kind:'RemovePanel',panel:0}}),/Open a garment/)
 let r=await request({op:'open',preset:'tshirt'});assert(r.ok,r.error);assert(state.avatar.positions.length>100);const original=structuredClone(state)
 r=await request({op:'edit',command:{kind:'BoardTransform',panel:state.template.panels[0].id,origin:[1.2,.3],rotation_degrees:25}});assert(r.ok,r.error);assert.deepEqual(state.positions,original.positions);assert.deepEqual(state.uv,original.uv)
 r=await request({op:'edit',command:{kind:'Anchor',panel:state.template.panels[0].id,anchor:0,position:state.template.panels[0].polygon.points[1]}});assert(!r.ok,'Degenerate edit must fail');assert.equal(r.data.revision,state.revision)
 const seam=state.template.seams[0];r=await request({op:'edit',command:{kind:'RemoveSeam',seam:seam.id}});assert(r.ok,r.error);assert.equal(state.template.seams.length,original.template.seams.length-1)
 r=await request({op:'undo'});assert(r.ok,r.error);assert.equal(state.template.seams.length,original.template.seams.length)
 r=await request({op:'edit',command:{kind:'RemoveSeam',seam:seam.id}});assert(r.ok,r.error)
 r=await request({op:'edit',command:{kind:'Sew',a:seam.a,b:seam.b,reverse:seam.reverse_b,ease:seam.allow_ease}});assert(r.ok,r.error);assert.equal(state.template.seams.length,original.template.seams.length)
 r=await request({op:'step',steps:1});assert(r.ok,r.error);assert(state.time>0);assert.notDeepEqual(state.positions,original.positions)
 const simulated=structuredClone(state)
 r=await request({op:'save'});assert(r.ok,r.error);const saved=r.data.project;assert(saved.mesh_signature);assert.equal(saved.state.x.length,state.positions.length)
 r=await request({op:'open',project:saved});assert(r.ok,r.error);assert.deepEqual(state.positions,simulated.positions);assert.deepEqual(state.uv,simulated.uv);assert.equal(state.time,simulated.time)
 const stale=await workspace.request({op:'reset',revision:999999});assert(!stale.ok)
 r=await workspace.request({op:'play'});assert(r.ok,r.error)
 r=await workspace.request({op:'pause'});assert(r.ok,r.error);assert.equal(r.data.running,false)
 const inFlight=workspace.request({op:'step',steps:4,revision:r.data.revision})
 workspace.close()
 await assert.rejects(inFlight,/Workspace closed|ClothCraft worker stopped/)
 console.log(JSON.stringify({passed:true,checks:['reject-command-before-open','upstream-avatar','layout-preserves-physics','invalid-edit-rollback','seam-delete-undo-create','native-step','save-reload-drape','stale-revision-rejected','play-pause','close-rejects-pending-rpc'],vertices:state.positions.length,triangles:state.triangles.length,metrics:simulated.metrics,output},null,2))
}finally{workspace.close()}
