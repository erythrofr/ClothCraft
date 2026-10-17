import assert from 'node:assert/strict'
import { createTemplateProject } from '../src/data/templates.js'
import { garmentThreeViewPose } from '../src/components/garmentThreeViewPose.js'
import { garmentPreviewPose } from '../src/core/garmentPreviewGeometry.js'

const pieces = createTemplateProject('tee').pieces
const byId = id => {
  const index = pieces.findIndex(piece => piece.id === id)
  assert(index >= 0, `missing source template piece ${id}`)
  return { piece: pieces[index], index }
}
const posed = (id, point) => {
  const { piece, index } = byId(id)
  return garmentThreeViewPose(piece, 'tee', index, pieces.length)(point)
}
const finite = vector => vector.toArray().every(Number.isFinite)

for (const id of ['sleeve-left', 'sleeve-right']) {
  const { piece, index } = byId(id)
  const pose = garmentThreeViewPose(piece, 'tee', index, pieces.length)
  const cap = piece.points[0]
  const cuffs = [piece.points[3], piece.points[4]]
  const capPosition = pose(cap)
  const cuffPositions = cuffs.map(pose)
  assert(cuffPositions.every(cuff => capPosition.y > cuff.y + .1), `${id} cap must remain higher than either cuff`)
  assert(cuffPositions.every(cuff => Math.abs(cuff.x) > Math.abs(capPosition.x) + .25), `${id} cuff must extend away from torso`)
  for (const source of [cap, ...cuffs, { x: 1, y: 12 }, { x: -1, y: 12 }]) {
    const world = pose(source)
    const dx = pose({ x: source.x + .01, y: source.y }).sub(world)
    const dy = pose({ x: source.x, y: source.y + .01 }).sub(world)
    assert(finite(world) && finite(dx) && finite(dy), `${id} finite surface`)
    assert(dx.cross(dy).length() > 1e-7, `${id} surface normal must not collapse`)
  }
}
for (const point of [{ x: 0, y: 45 }, { x: -12, y: 40 }, { x: 12, y: 40 }]) {
  const depths = ['front', 'back'].map(id => posed(id, point).z)
  const raw = ['front', 'back'].map(id => {
    const { piece, index } = byId(id)
    return garmentPreviewPose(piece, 'tee-exploded', index, pieces.length)(point).z
  })
  assert(depths[0] > depths[1], 'front and back surfaces must remain separated')
  assert(depths[0] - depths[1] < raw[0] - raw[1], 'middle torso bends toward the interior')
}
const a = posed('sleeve-left', { x: 0, y: 25 })
const b = posed('sleeve-right', { x: 0, y: 25 })
assert(Math.abs(a.x + b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8, 'sleeve caps mirror at the same height')
console.log('PASS: source tee sleeve caps, cuffs, normals, symmetry and inward panel curvature')
