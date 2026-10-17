import assert from 'node:assert/strict'
import { createTemplateProject } from '../src/data/templates.js'
import { garmentPreviewPose } from '../src/core/garmentPreviewGeometry.js'
import { garmentThreeViewPose } from '../src/components/garmentThreeViewPose.js'

const project = createTemplateProject('tee')
const pieces = project.pieces
for (const side of ['left', 'right']) {
  const sleeve = pieces.find(piece => piece.id === 'sleeve-' + side)
  assert.ok(sleeve, side + ' source pattern exists')
  const pose = garmentThreeViewPose(sleeve, 'tee', 0, pieces.length)
  const crown = pose({ x: 0, y: 25 })
  const cuff = pose({ x: 0, y: 0 })
  const sign = side === 'left' ? -1 : 1
  assert.ok(sign * cuff.x > sign * crown.x + .6, side + ' cuff must point outward')
  assert.ok(cuff.y < crown.y - .2, side + ' cuff must hang below its crown')
  assert.ok(Number.isFinite(cuff.z), side + ' cuff must remain finite')
}
const leftPose = garmentThreeViewPose(pieces.find(piece => piece.id === 'sleeve-left'), 'tee', 0, pieces.length)
const rightPose = garmentThreeViewPose(pieces.find(piece => piece.id === 'sleeve-right'), 'tee', 0, pieces.length)
for (const point of [{x:-12,y:3},{x:0,y:25},{x:14,y:17}]) {
  const left = leftPose(point), right = rightPose(point)
  assert.ok(Math.abs(left.x + right.x) < 1e-8)
  assert.ok(Math.abs(left.y - right.y) < 1e-8)
  assert.ok(Math.abs(left.z + right.z) < 1e-8)
}
for (const id of ['front', 'back']) {
  const piece = pieces.find(entry => entry.id === id)
  const current = garmentThreeViewPose(piece, 'tee', 0, pieces.length)
  const original = garmentPreviewPose(piece, 'tee-exploded', 0, pieces.length)
  const middle = { x: 0, y: 40 }, edge = { x: 24, y: 40 }
  const inward = id === 'front' ? -1 : 1
  assert.ok(inward * (current(middle).z - original(middle).z) > .28, id + ' bows inward toward the panel gap')
  assert.ok(Math.abs(current(edge).z - original(edge).z) < .065, id + ' outer seam stays close')
}
console.log('PASS three-view source pose: mirrored downward sleeves and stronger center-panel curvature')
