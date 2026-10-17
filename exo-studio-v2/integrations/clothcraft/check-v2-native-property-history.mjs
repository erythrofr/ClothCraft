import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'

const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-history-'))
let workspace=createWorkspace(output)
const request=async payload=>{
 const result=await workspace.request(payload)
 assert(result.ok,result.error||JSON.stringify(payload))
 return result.data
}
try {
 let state=await request({op:'open',preset:'tshirt'})
 const panel=state.template.panels[0],fabric=state.template.fabrics[0]
 const edits=[['panel',panel.id,panel.name,'EXO History Panel'],['fabric',fabric.id,fabric.name,'EXO History Fabric']]
 for(const [target,id,original,updated] of edits){
  const key=target==='panel'?'panels':'fabrics'
  const current=state.revision
  state=await request({op:'set-property',revision:current,target,id,field:'name',value:updated})
  assert.equal(state.template[key].find(entry=>entry.id===id).name,updated)
  assert(state.canUndo)
  const unchanged=await request({op:'set-property',revision:state.revision,target,id,field:'name',value:updated})
  assert.equal(unchanged.revision,state.revision,'Same value must not make an undo transaction')
  state=await request({op:'undo',revision:state.revision})
  assert.equal(state.template[key].find(entry=>entry.id===id).name,original)
  state=await request({op:'redo',revision:state.revision})
  assert.equal(state.template[key].find(entry=>entry.id===id).name,updated)
 }
 const named=state.template.panels.find(item=>item.polygon?.edges?.length)
 if(named){
  const edge=named.polygon.edges[0]
  const previous=named.polygon.target_lengths?.[edge]
  const target=previous===0.125?0.135:0.125
  state=await request({op:'line-spec',revision:state.revision,panel:named.id,edge,target_m:target})
  assert.equal(state.template.panels.find(p=>p.id===named.id).polygon.target_lengths[edge],target)
  state=await request({op:'undo',revision:state.revision})
  assert.equal(state.template.panels.find(p=>p.id===named.id).polygon.target_lengths?.[edge],previous)
  state=await request({op:'redo',revision:state.revision})
  assert.equal(state.template.panels.find(p=>p.id===named.id).polygon.target_lengths[edge],target)
 }
 await request({op:'save'})
 workspace.close()
 workspace=createWorkspace(output)
 state=await request({op:'snapshot'})
 for(const [target,id,,updated] of edits){
  const key=target==='panel'?'panels':'fabrics'
  assert.equal(state.template[key].find(entry=>entry.id===id).name,updated)
 }
 console.log(JSON.stringify({passed:true,checks:['native rename undo/redo','native no-op revision','save/reopen',...(named?['named edge line-spec undo/redo']:[])]}))
} finally {workspace.close()}
