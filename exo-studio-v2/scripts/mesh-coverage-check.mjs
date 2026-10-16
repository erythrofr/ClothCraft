import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSimulation } from '../src/core/physics.js'
import { pieceArea } from '../src/core/project.js'

const project = createDefaultProject()
const simulation = buildSimulation(project)

for (const [id, piece] of simulation.pieces) {
  let triangleArea = 0
  for (const [a, b, c] of piece.faces) {
    const pa = piece.flatVertices[a]
    const pb = piece.flatVertices[b]
    const pc = piece.flatVertices[c]
    triangleArea += Math.abs((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)) * 0.5
  }
  const patternArea = pieceArea(piece.piece)
  console.log(JSON.stringify({
    id,
    patternArea: Number(patternArea.toFixed(3)),
    triangleArea: Number(triangleArea.toFixed(3)),
    ratio: Number((triangleArea / patternArea).toFixed(5)),
    vertices: piece.flatVertices.length,
    faces: piece.faces.length,
  }))
}
