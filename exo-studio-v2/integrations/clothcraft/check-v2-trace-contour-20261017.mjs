import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-trace-native-'))
let workspace=createWorkspace(root)
const request=async data=>{const result=await workspace.request(data);assert(result.ok,result.error);return result.data}
try{
 let state=await request({op:'open',preset:'tshirt'})
 state=await request({op:'edit',revision:state.revision,command:{kind:'Polygon',points:[[0,0],[0.16,0],[0.16,0.2],[0,0.2]],fabric:state.template.fabrics[0].id}})
 const originalCount=state.template.panels.length
 const source=state.template.panels.at(-1)
 assert(source,'Fixture needs straight native polygon')
 const invalid=await workspace.request({op:'trace-contour',revision:state.revision,panel:'missing-panel'})
 assert.equal(invalid.ok,false)
 assert.equal((await request({op:'snapshot'})).revision,state.revision)
 state=await request({op:'trace-contour',revision:state.revision,panel:source.id})
 assert.equal(state.template.panels.length,originalCount+1)
 const traced=state.template.panels.at(-1)
 assert.notEqual(traced.id,source.id)
 assert.equal(traced.fabric,source.fabric)
 const normalized=points=>points.map(([x,y])=>[Number((x-points[0][0]).toFixed(8)),Number((y-points[0][1]).toFixed(8))])
 assert.deepEqual(normalized(traced.polygon.points),normalized(source.polygon.points))
 assert.equal(state.template.seams.length,(await request({op:'snapshot'})).template.seams.length)
 state=await request({op:'undo',revision:state.revision})
 assert.equal(state.template.panels.length,originalCount)
 state=await request({op:'redo',revision:state.revision})
 assert.equal(state.template.panels.length,originalCount+1)
 await request({op:'save'})
 workspace.close();workspace=createWorkspace(root)
 state=await request({op:'snapshot'})
 assert.equal(state.template.panels.length,originalCount+1)
 assert.deepEqual(normalized(state.template.panels.at(-1).polygon.points),normalized(source.polygon.points))
 console.log(JSON.stringify({passed:true,source:source.id,trace:traced.id,checks:['independent contour','matching geometry and fabric','invalid ID rejected','undo','redo','save/reopen']}))
}finally{workspace.close()}
