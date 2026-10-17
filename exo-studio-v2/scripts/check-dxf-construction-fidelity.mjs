import assert from 'node:assert/strict'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { projectToDxf, parseDxfPatterns } from '../src/core/dxf.js'
import { pieceArea } from '../src/core/project.js'

const project = createDefaultProject()
const front = project.pieces.find(piece => piece.id === 'front')
front.buttonholes = [{ id: 'roundtrip-test-buttonhole', x: 7.4, y: 28.2, lengthCm: 3.2, orientationDeg: 26 }]
front.internalLines = [{ id: 'roundtrip-test-fold', type: 'fold', a: { x: -6, y: 10 }, b: { x: -8, y: 35 } }]
front.grainAngleDeg = 21
const dxf = projectToDxf(project, 'M')
assert.match(dxf, /\$INSUNITS\n70\n4/)
const imported = parseDxfPatterns(dxf)
assert.equal(imported.scaleToCm, 0.1)
assert.equal(imported.pieces.length, project.pieces.length)
const frontImported = imported.pieces.find(piece => piece.name.toLowerCase() === 'front')
assert.ok(frontImported)
assert.ok(frontImported.buttonholes.length >= 1)
assert.ok(frontImported.internalLines.some(line => line.type === 'fold'))
assert.ok(Math.abs(frontImported.grainAngleDeg - 21) < 1e-5)
assert.ok(Math.abs(pieceArea(frontImported) - pieceArea(front)) < 0.1)
const hole = frontImported.buttonholes[0]
assert.ok(Math.abs(hole.x - 7.4) < 0.01)
assert.ok(Math.abs(hole.y - 28.2) < 0.01)
assert.ok(Math.abs(hole.lengthCm - 3.2) < 0.01)
assert.ok(Math.abs(hole.orientationDeg - 26) < 1e-5)
console.log(JSON.stringify({pass:true, pieces:imported.pieces.length, grain:frontImported.grainAngleDeg, buttonhole:hole, fold:frontImported.internalLines.find(line=>line.type==='fold')}))
