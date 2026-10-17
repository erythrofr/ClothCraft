import assert from 'node:assert/strict'
import { CLO7_NATIVE_TOOL_CAPABILITIES as entries, CLO7_NATIVE_TOOL_BY_ID as byId, getClo7NativeCapability } from '../../src/core/clo7NativeToolCapabilities.js'
import { CLO7_3D_A, CLO7_3D_B, CLO7_2D_A, CLO7_2D_B } from '../../src/data/clo7ToolbarOrder.js'

const source=[['3d', 'A',CLO7_3D_A],['3d','B',CLO7_3D_B],['2d','A',CLO7_2D_A],['2d','B',CLO7_2D_B]]
const ids=source.flatMap(([dimension,,slots])=>slots.map(({id})=>`${dimension}:${id}`))
assert.equal(ids.length,70,'observed inventory must remain 70')
assert.equal(new Set(ids).size,70,'dimension-qualified slots must be unique')
assert.equal(entries.length,70)
assert.deepEqual(entries.map(({id})=>id),ids,'retain CLO row order')
assert.deepEqual(Object.keys(byId),ids)
const valid=new Set(['native','inspect','unavailable'])
for(const entry of entries){
  assert.ok(valid.has(entry.mode),`unknown mode for ${entry.id}`)
  assert.ok(entry.label && entry.reason)
  assert.equal(getClo7NativeCapability(entry.dimension,entry.position),entry)
  assert.equal(typeof entry.nativeAction==='string',entry.mode==='native',`native action claim mismatch: ${entry.id}`)
  assert.equal(typeof entry.inspectionAction==='string',entry.mode==='inspect',`inspection claim mismatch: ${entry.id}`)
  assert.ok(Object.isFrozen(entry))
}
assert.equal(getClo7NativeCapability('3d','X99'),null)
// Integration contract: the App and right palette dispatch these exact keys.
// An action rename must be coordinated with both consumers.
const expectedNativeActions={
  '3d:A01':'simulation.toggle',
  '3d:A02':'viewport3d.selectMove',
  '3d:A03':'viewport3d.meshBrushSelect',
  '3d:A05':'sewing.editExisting',
  '3d:A06':'sewing.freeSew',
  '3d:A07':'sewing.freeSew',
  '3d:A13':'arrangement.reset2d',
  '3d:A14':'arrangement.reset3d',
  '3d:A15':'simulation.redrape',
  '2d:A01':'pattern2d.selectTransform',
  '2d:A02':'pattern2d.editPoints',
  '2d:A04':'pattern2d.drawPolygon',
  '2d:A05':'pattern2d.drawInternalLine',
  '2d:A06':'pattern2d.basePolygon',
  '2d:A07':'pattern2d.traceContour',
  '2d:A08':'pattern2d.placeNotch',
  '2d:A09':'pattern2d.setSeamAllowanceGuide',
  '2d:A13':'pattern2d.editAnnotation',
  '2d:A14':'pattern2d.addAnnotation',
  '2d:B01':'sewing.editExisting',
  '2d:B02':'sewing.freeSew',
  '2d:B03':'sewing.freeSew',
}
assert.deepEqual(Object.fromEntries(entries.filter(e=>e.mode==='native').map(e=>[e.id,e.nativeAction])),expectedNativeActions)
const totals=Object.fromEntries([...valid].map(mode=>[mode,entries.filter(e=>e.mode===mode).length]))
console.log(JSON.stringify({coverage:entries.length,totals,native:entries.filter(e=>e.mode==='native').map(e=>[e.id,e.nativeAction])},null,2))
