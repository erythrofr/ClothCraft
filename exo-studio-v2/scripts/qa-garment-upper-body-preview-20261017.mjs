import assert from 'node:assert/strict'
import { createTemplateProject } from '../src/data/templates.js'
import { garmentThreeViewPose } from '../src/components/garmentThreeViewPose.js'

for (const templateId of ['hoodie', 'zip-hoodie']) {
  const pieces = createTemplateProject(templateId).pieces
  const poseFor = id => {
    const index = pieces.findIndex(piece => piece.id === id)
    assert(index >= 0, `${templateId}: source piece ${id} exists`)
    return garmentThreeViewPose(pieces[index], templateId, index, pieces.length)
  }
  const frontIds = templateId === 'zip-hoodie' ? ['front-left', 'front-right'] : ['front']
  const back = poseFor('back')({ x: 0, y: 35 })
  for (const id of frontIds) {
    const front = poseFor(id)({ x: id === 'front-left' ? -10 : id === 'front-right' ? 10 : 0, y: 35 })
    assert(front.z > back.z + .1, `${templateId}: ${id} is in front of back`)
  }
  const left = poseFor('sleeve-left')
  const right = poseFor('sleeve-right')
  for (const [id, pose, side] of [['left', left, -1], ['right', right, 1]]) {
    const crown = pose({ x: 0, y: 62 })
    const cuff = pose({ x: 0, y: 0 })
    assert(side * cuff.x > side * crown.x + 1, `${templateId}: ${id} sleeve extends outward`)
    assert(cuff.y < crown.y - .5, `${templateId}: ${id} sleeve cuff points downward`)
    assert(cuff.toArray().every(Number.isFinite), `${templateId}: finite sleeve coordinates`)
  }
  assert(Math.abs(left({ x: 3, y: 28 }).x + right({ x: 3, y: 28 }).x) < 1e-8)
  assert(pieces.some(piece => piece.id.startsWith('hood-')), `${templateId}: hood is source authored`)
  assert(poseFor('hood-left')({ x: 5, y: 20 }).y < -1.3, `${templateId}: accessory stays beneath torso`)
}
for (const id of ['pants', 'skirt']) {
  const pieces = createTemplateProject(id).pieces
  const p = pieces[0]
  const a = garmentThreeViewPose(p, id, 0, pieces.length)({ x: 0, y: 0 })
  assert(a.toArray().every(Number.isFinite), `${id}: original pattern-study pose remains valid`)
}
console.log('PASS: hoodie/zip hoodie torso, sleeves and accessory layouts; lower-body pattern study preserved')
