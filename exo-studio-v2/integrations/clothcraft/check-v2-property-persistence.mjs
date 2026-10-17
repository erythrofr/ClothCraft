import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'

const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-property-persistence-'))
let workspace=createWorkspace(output)
try {
 let r=await workspace.request({op:'open',preset:'tshirt'})
 assert(r.ok,r.error)
 const panel=r.data.template.panels[0],fabric=r.data.template.fabrics[0]
 let revision=r.data.revision
 for(const [target,id,value] of [['panel',panel.id,'P-001'],['fabric',fabric.id,'F-001']]){
  r=await workspace.request({op:'set-property',target,id,field:'itemNo',value,revision})
  assert(r.ok,r.error)
  assert.equal(r.data.propertyMetadata[target==='panel'?'panels':'fabrics'][id].itemNo,value)
  assert.equal(r.data.revision,revision)
 }
 for(const [field,value] of [['construction','French Terry'],['supplier','Fabric Mill'],['owner','EXO Studio']]){
  r=await workspace.request({op:'set-property',target:'fabric',id:fabric.id,field,value,revision})
  assert(r.ok,r.error)
  assert.equal(r.data.propertyMetadata.fabrics[fabric.id][field],value)
  assert.equal(r.data.revision,revision)
 }
 r=await workspace.request({op:'set-property',target:'fabric',id:fabric.id,field:'owner',value:null,revision})
 assert(r.ok,r.error)
 assert.equal(r.data.propertyMetadata.fabrics[fabric.id].owner,'')
 r=await workspace.request({op:'set-property',target:'fabric',id:fabric.id,field:'owner',value:'EXO Studio',revision})
 assert(r.ok,r.error)
 const names=[['panel',panel.id,'EXO Front Panel'],['fabric',fabric.id,'EXO French Terry']]
 for(const [target,id,value] of names){
  r=await workspace.request({op:'set-property',target,id,field:'name',value,revision})
  assert(r.ok,r.error)
  assert.equal(r.data.revision,revision+1,'native name edits must increment the revision')
  revision=r.data.revision
  assert.equal(r.data.template[target==='panel'?'panels':'fabrics'].find(item=>item.id===id).name,value)
 }
 for(const invalid of [
  {target:'panel',id:panel.id,field:'itemNo',value:'STALE',revision:revision+1},
  {target:'panel',id:'missing',field:'itemNo',value:'UNKNOWN',revision},
  {target:'fabric',id:fabric.id,field:'itemNo',value:'\n',revision},
  {target:'fabric',id:fabric.id,field:'supplier',value:'x'.repeat(129),revision},
  {target:'fabric',id:fabric.id,field:'owner',value:23,revision},
  {target:'fabric',id:'missing',field:'construction',value:'Knit',revision},
  {target:'fabric',id:fabric.id,field:'construction',value:'stale',revision:revision+1},
  {target:'panel',id:panel.id,field:'supplier',value:'Unknown',revision},
  {target:'panel',id:panel.id,field:'name',value:'stale',revision:revision-1},
  {target:'fabric',id:'unknown-fabric',field:'name',value:'Unknown',revision},
  {target:'panel',id:'unknown-panel',field:'name',value:'Unknown',revision},
  {target:'fabric',id:fabric.id,field:'name',value:'',revision},
  {target:'fabric',id:fabric.id,field:'name',value:'x'.repeat(121),revision},
  {target:'panel',id:panel.id,field:'unknown',value:'Unsupported',revision},
 ]){r=await workspace.request({op:'set-property',...invalid});assert.equal(r.ok,false)}
 r=await workspace.request({op:'snapshot'})
 assert.equal(r.data.revision,revision,'invalid edits must not advance the revision')
 for(const [target,id,value] of names)assert.equal(r.data.template[target==='panel'?'panels':'fabrics'].find(item=>item.id===id).name,value)
 assert.equal(r.data.propertyMetadata.panels[panel.id].itemNo,'P-001')
 assert.equal(r.data.propertyMetadata.fabrics[fabric.id].itemNo,'F-001')
 for(const [field,value] of [['construction','French Terry'],['supplier','Fabric Mill'],['owner','EXO Studio']])assert.equal(r.data.propertyMetadata.fabrics[fabric.id][field],value)
 workspace.close()
 workspace=createWorkspace(output)
 r=await workspace.request({op:'snapshot'})
 assert(r.ok,r.error)
 for(const [target,id,value] of names)assert.equal(r.data.template[target==='panel'?'panels':'fabrics'].find(item=>item.id===id).name,value,'native name must persist across restart')
 assert.equal(r.data.propertyMetadata.panels[panel.id].itemNo,'P-001')
 assert.equal(r.data.propertyMetadata.fabrics[fabric.id].itemNo,'F-001')
 for(const [field,value] of [['construction','French Terry'],['supplier','Fabric Mill'],['owner','EXO Studio']])assert.equal(r.data.propertyMetadata.fabrics[fabric.id][field],value)
 assert.equal(fs.existsSync(path.join(output,'workspace','fitting-project.json.properties.json')),true)
 console.log('PASS: native panel/fabric names increment revision and persist across restart; itemNo and fabric metadata persist; invalid/unknown/stale edits rejected')
} finally {workspace.close()}
