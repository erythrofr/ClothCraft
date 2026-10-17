import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
import {CLO7_NATIVE_TOOL_CAPABILITIES as tools} from '../src/core/clo7NativeToolCapabilities.js'

const palette=readFileSync(new URL('../src/components/RightToolPalette.jsx',import.meta.url),'utf8')
const panel=readFileSync(new URL('../src/components/CloToolActionPanel.jsx',import.meta.url),'utf8')
for(const [name,source] of [['RightToolPalette',palette],['CloToolActionPanel',panel]]){
  assert.ok(transformSync(source,{loader:'jsx',format:'esm'}).code,`${name} JSX parses`)
}
const requiredAliases={select:'A01',point:'A02','create-polygon':'A04',internal:'A05',notch:'A08',allowance:'A09',sew:'B03',measure:'A11','annotation-add':'A14','annotation-edit':'A13'}
const mapBody=palette.match(/const NATIVE_EXTRA_CAPABILITIES = Object\.freeze\(\{([\s\S]*?)\}\)/)?.[1]
assert.ok(mapBody,'native shortcut map exists')
for(const [action,slot] of Object.entries(requiredAliases)){
  assert.match(mapBody,new RegExp(`(?:['"]?${action}['"]?)\\s*:\\s*['"]${slot}['"]`),`${action} must target ${slot}`)
  const capability=tools.find(t=>t.id===`2d:${slot}`)
  assert.ok(capability && capability.mode!=='unavailable',`${action} cannot target unavailable native operation`)
}
assert.match(palette,/nativeCapability\?\.mode==='unavailable'/,'native shortcut capability checked')
assert.match(palette,/Boolean\(nativeCapability\) && typeof onCloTool !== 'function'/,'missing native handler disables shortcuts')
assert.match(panel,/isNative&&<button/,'only native operations display Run')
assert.equal(tools.length,70)
const totals=Object.fromEntries(['native','inspect','unavailable'].map(mode=>[mode,tools.filter(t=>t.mode===mode).length]))
// V2 is edited concurrently; the dated 19/7/44 baseline must not freeze
// subsequent honest INSPECT or NATIVE capability changes. Enforce semantics
// and individual slot evidence rather than stale aggregate counts.
assert.equal(Object.values(totals).reduce((sum,n)=>sum+n,0),70)
assert.ok(totals.native>=19,'Previously verified native authoring must not disappear')
for(const tool of tools){
  if(tool.mode==='native')assert.ok(tool.nativeAction && tool.reason,'Native slots require an action and explanation: '+tool.id)
  if(tool.mode==='inspect')assert.ok(tool.inspectionAction && tool.reason,'Inspect slots need a real destination: '+tool.id)
  if(tool.mode==='unavailable')assert.ok(!tool.nativeAction&&!tool.inspectionAction,'Unavailable tool cannot have a runnable action: '+tool.id)
}
const handoff=JSON.parse(readFileSync(new URL('../docs/engineering-handoff-20261017/toolbar-inventory.json',import.meta.url),'utf8'))
const spec=readFileSync(new URL('../docs/engineering-handoff-20261017/01_TOOLBARS_ENGINEERING_SPEC.md',import.meta.url),'utf8')
const oldById=new Map(handoff.tools.map(entry=>[entry.id,entry]))
assert.equal(oldById.size,70)
// Track headings line by line; each contract includes blank lines.
const specContracts=new Map()
const lines=spec.split('\n')
let current=null
for(const line of lines){
  const heading=line.match(/^### ((?:3d|2d):[AB]\d\d) — /)
  if(heading){current=heading[1];specContracts.set(current,{})}
  else if(current){
    const field=line.match(/^- \*\*(Observed|Interaction|Engineering|Acceptance):\*\* (.*)$/)
    if(field)specContracts.get(current)[field[1].toLowerCase()]=field[2]
    if(line.startsWith('## 5.'))current=null
  }
}
assert.equal(specContracts.size,70,'all handoff acceptance sections must be recoverable')
const acceptance=tools.map(tool=>{
  const older=oldById.get(tool.id)
  const contract=specContracts.get(tool.id)
  assert.ok(older && contract?.acceptance && contract?.engineering,`missing handoff row ${tool.id}`)
  assert.equal(older.label,tool.label,`label drift ${tool.id}`)
  return {
    id:tool.id,label:tool.label,dimension:tool.dimension,column:tool.column,position:tool.position,
    handoffStatus:older.status,currentStatus:tool.mode,
    handoffAction:older.action??null,currentAction:tool.nativeAction??tool.inspectionAction??null,
    statusChanged:older.status!==tool.mode,
    acceptance:contract.acceptance,engineeringGap:contract.engineering,
    currentEvidence:tool.reason,
    acceptanceResult:'not_end_to_end_verified',
    undoResult:'not_verified_per_slot',saveReopenResult:'not_verified_per_slot',
    scopeNote:tool.mode==='native'?'Native capability claim only; acceptance contract may remain incomplete.':tool.mode==='inspect'?'Read-only or temporary inspection; no authoring completion claim.':'Unavailable native command; no edit action claimed.'
  }
})
for(const id of ['2d:A13','2d:A14']){
  assert.equal(acceptance.find(row=>row.id===id)?.currentStatus,'native','Persistent authored annotation must remain native: '+id)
}
const matrix={generatedFrom:['src/core/clo7NativeToolCapabilities.js','docs/engineering-handoff-20261017/toolbar-inventory.json','docs/engineering-handoff-20261017/01_TOOLBARS_ENGINEERING_SPEC.md'],count:70,handoffCounts:handoff.counts,currentCounts:totals,changes:acceptance.filter(row=>row.statusChanged).map(({id,handoffStatus,currentStatus})=>({id,handoffStatus,currentStatus})),verificationScope:'Registry and UI guard audited; tests for annotation and markings are separate. Row-specific acceptance is unverified unless separately documented.',tools:acceptance}
if(process.argv.includes('--write-matrix'))writeFileSync(new URL('./qa-toolbar-handoff-20261017.acceptance.json',import.meta.url),JSON.stringify(matrix,null,2)+'\n')
console.log(JSON.stringify({passed:true,total:tools.length,totals,shortcuts:requiredAliases,jsxSyntax:'passed',limitations:'Static routing audit; native mutation tests are separate.'},null,2))
