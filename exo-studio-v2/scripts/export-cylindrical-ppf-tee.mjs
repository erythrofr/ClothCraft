import fs from 'node:fs'
import path from 'node:path'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'
import { buildExplodedPpfPayload, validatePpfPayload } from '../src/core/backends/ppfPayload.js'

// An isolated feasibility fixture. DO NOT silently replace users' saved tee
// patterns: this tests wrapping a sleeve around the *vertical* analytic arm
// contact proxy before PPF sewing. The standard planar stage remains intact.
const destination = process.argv[2] || 'blender_bridge/fixtures/tee-ppf-cylinder-experiment.json'
const radius = Number(process.argv[3] || 0.09)
const sleeveY = Number(process.argv[4] || 0.35)
if (radius < 0.07 || radius > 0.15 || sleeveY < 0 || sleeveY > 0.6) {
  throw new Error('Use cylinder radius 0.07..0.15 m and sleeveY 0..0.60 m')
}
const project = createTeeTemplate()
const native = buildNativeSimulationPayload(project)
const payload = buildExplodedPpfPayload(project, { frameCount: 10, torsoDepth: 0.16, armOffset: 0.51 })
const nativePieces = new Map(native.pieces.map((piece) => [piece.id, piece]))
const centerX = Number(project.avatar.shoulderWidthCm || 46) * 0.005 + 0.18

for (const piece of payload.shell.pieces) {
  if (piece.id !== 'sleeve-left' && piece.id !== 'sleeve-right') continue
  const source = nativePieces.get(piece.id)
  const side = piece.id === 'sleeve-left' ? -1 : 1
  source.flatVerticesM.forEach(([x, y], index) => {
    // Arc length is preserved: d(theta) * radius == d(flat-x). No artificial
    // stretch is introduced across the sleeve's width at this stage.
    const theta = x / radius
    const globalIndex = piece.particleIndices[index]
    payload.shell.vertices[globalIndex] = [
      side * (centerX + radius * Math.cos(theta)),
      1 + y + sleeveY,
      radius * Math.sin(theta),
    ]
  })
}
payload.scene.staging = {
  strategy: 'experimental-cylindrical-arm-v1',
  sleeveRadiusM: radius,
  sleeveYOffsetM: sleeveY,
  avatarArmCenterXM: centerX,
  note: 'Research-only collision-safe rolled sleeves around analytic avatar arms; not the default garment pipeline',
}
const check = validatePpfPayload(payload)
if (!check.ok) throw new Error(check.errors.join('; '))
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, JSON.stringify(payload, null, 2) + '\n')
console.log(JSON.stringify({ destination, project: project.name, vertices: payload.shell.vertices.length,
  faces: payload.shell.faces.length, stitches: payload.shell.stitchEdges.length, staging: payload.scene.staging }))
