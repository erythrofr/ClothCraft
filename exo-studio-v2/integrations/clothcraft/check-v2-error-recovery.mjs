// Verify the installed garment's contact error is recoverable, but only
// inside a disposable COPY. Do not rewrite the installed application's save.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
import {createWorkspace} from './workspace.mjs'

const folderOriginal=path.join(os.homedir(),'Library/Application Support/EXO-ClothCraft-Studio-V2/Output/workspace')
// Prefer the preserved pre-fix drape, not the now-repaired live save.
const backups=path.join(folderOriginal,'backups')
const candidate=fs.existsSync(backups)?fs.readdirSync(backups).filter(name=>name.startsWith('hand-physics-fix-')).sort().at(-1):null
const source=candidate?path.join(backups,candidate,'fitting-project.json'):path.join(folderOriginal,'fitting-project.json')
const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-recovery-test-'))
const folder=path.join(output,'workspace')
fs.mkdirSync(folder,{recursive:true})
fs.copyFileSync(source,path.join(folder,'fitting-project.json'))
const w=createWorkspace(output)
const send=async data=>w.request(data)
try{
 const opened=await send({op:'snapshot'})
 assert(opened.ok,opened.error)
 const authoring=JSON.stringify(opened.data.template)
 const running=await send({op:'play'})
 assert(running.ok,running.error)
 let invalid
 for(let i=0;i<70;i++){
  await sleep(100)
  const state=await send({op:'snapshot'})
  if(!state.ok){invalid=state;break}
 }
 assert(invalid,'Expected to reproduce the V2 saved garment contact error before resetting')
 assert(/OGC|intersection|overlap/i.test(invalid.error),invalid.error)
 const savedBefore=fs.readFileSync(path.join(folder,'fitting-project.json'))
 const stopped=await send({op:'pause'})
 assert.equal(stopped.ok,false,'Expected failed solver state to be reported by Pause')
 assert.deepEqual(fs.readFileSync(path.join(folder,'fitting-project.json')),savedBefore,'Failed solver must not overwrite saved project')
 const reset=await send({op:'reset',revision:invalid.data.revision})
 assert(reset.ok,reset.error)
 assert.equal(reset.data.time,0)
 assert.equal(JSON.stringify(reset.data.template),authoring,'Reset must preserve authored garment and sewing')
 assert.equal(reset.data.grabActive,false)
 const stepped=await send({op:'step',revision:reset.data.revision,steps:1})
 assert(stepped.ok,stepped.error)
 assert(stepped.data.time>0)
 assert(stepped.data.positions.flat().every(Number.isFinite))
 const saved=await send({op:'save'})
 assert(saved.ok,saved.error)
 console.log(JSON.stringify({passed:true,originalError:invalid.error,failedStepDidNotOverwriteSave:true,authoredGarmentPreserved:true,resetResumesPhysics:true,output}))
}finally{w.close()}
