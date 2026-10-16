import fs from 'node:fs'

// Report where loose-edge sewing constraints pull each piece. A small final
// gap alone is not sufficient: seams can close *through* the avatar or cloth.
const [payloadPath, outputPath] = process.argv.slice(2)
if (!payloadPath) throw new Error('Usage: node scripts/analyze-ppf-seam-trajectories.mjs payload.json [report.json]')
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
const vertices = payload.shell.vertices
const pieces = new Map(payload.shell.pieces.flatMap(piece => piece.particleIndices.map(i => [i, piece.id])))
const seams = new Map()
for (const edge of payload.shell.stitchEdges) {
  const a = vertices[edge.a], b = vertices[edge.b]
  const id = edge.seamId || 'unnamed'
  if (!a || !b) throw new Error(`Invalid seam endpoint: ${id}`)
  const distanceM = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const item = {a: edge.a, b: edge.b, fromPiece: pieces.get(edge.a), toPiece: pieces.get(edge.b), distanceM}
  if (!seams.has(id)) seams.set(id, [])
  seams.get(id).push(item)
}
const report = [...seams].map(([id, edges]) => ({
  id, count: edges.length,
  meanDistanceM: edges.reduce((s, x) => s + x.distanceM, 0) / edges.length,
  maxDistanceM: Math.max(...edges.map(x => x.distanceM)),
  pieces: [...new Set(edges.flatMap(x => [x.fromPiece, x.toPiece]))],
  longestPairs: [...edges].sort((a, b) => b.distanceM - a.distanceM).slice(0, 3),
})).sort((a, b) => b.meanDistanceM - a.meanDistanceM)
const result = {staging: payload.scene.staging, seams: report, totalStitchPairs: [...seams.values()].reduce((n, x) => n + x.length, 0)}
if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
