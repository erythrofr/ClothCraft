import fs from 'node:fs'
import path from 'node:path'

// Measures ACTUAL sewn-pair closure from PPF's animated PC2 vertex cache.
// This is deliberately separate from mesh-export checks: 98 loose edges in
// Blender do not, by themselves, prove that the physical stitch solver ran.
const [payloadFile = 'blender_bridge/fixtures/tee-ppf-metal-tuned.json',
  solveFile = 'blender_bridge/output/tee-ppf-metal-report.json',
  outFile = 'blender_bridge/output/tee-ppf-metal-sewing-report.json'] = process.argv.slice(2)
const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'))
const solve = JSON.parse(fs.readFileSync(solveFile, 'utf8'))
if (!solve.ok || !solve.pc2?.finite) throw new Error('PPF solve did not return finite cloth frames')
const stitches = payload.shell.stitchEdges || []
const vertices = payload.shell.vertices || []
if (!stitches.length) throw new Error('No sewing edges in PPF payload')
if (!stitches.every(({ a, b, seamId }) => Number.isInteger(a) && Number.isInteger(b) && a !== b &&
  a >= 0 && b >= 0 && a < vertices.length && b < vertices.length && seamId)) {
  throw new Error('Sewing edges must reference valid distinct fabric vertices and named seams')
}
const bytes = fs.readFileSync(solve.pc2.path)
if (bytes.toString('ascii', 0, 11) !== 'POINTCACHE2') throw new Error('Invalid PPF PC2 magic')
const version = bytes.readInt32LE(12)
const count = bytes.readInt32LE(16)
const samples = bytes.readInt32LE(28)
if (version !== 1 || count !== vertices.length || samples < 2 || samples > 10000 ||
  bytes.length < 32 + count * samples * 12) throw new Error('Invalid or incomplete PPF PC2 vertex cache')

const metric = (positions) => {
  const bySeam = new Map()
  const distances = stitches.map(({ a, b, seamId }) => {
    const va = positions[a], vb = positions[b]
    const distance = Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2])
    if (!Number.isFinite(distance)) throw new Error(`Non-finite stitch distance: ${seamId}`)
    if (!bySeam.has(seamId)) bySeam.set(seamId, [])
    bySeam.get(seamId).push(distance)
    return distance
  })
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
  const sorted = [...distances].sort((a, b) => a - b)
  return {
    meanCm: Number((100 * mean(distances)).toFixed(3)),
    p95Cm: Number((100 * sorted[Math.floor(0.95 * (sorted.length - 1))]).toFixed(3)),
    maxCm: Number((100 * sorted.at(-1)).toFixed(3)),
    bySeam: Object.fromEntries([...bySeam].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => [name, { pairs: values.length, meanCm: Number((100 * mean(values)).toFixed(3)) }])),
  }
}

const frames = []
for (let f = 0; f < samples; f += 1) {
  const positions = []
  for (let v = 0; v < count; v += 1) {
    const offset = 32 + (f * count + v) * 12
    const position = [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)]
    if (!position.every(Number.isFinite)) throw new Error(`PPF vertex ${v} is not finite at frame ${f}`)
    positions.push(position)
  }
  frames.push({ frame: f, ...metric(positions) })
}
const initial = frames[0], final = frames.at(-1)
const closurePercent = Number((100 * (1 - final.meanCm / initial.meanCm)).toFixed(2))
const worstSeams = Object.entries(final.bySeam)
  .map(([id, data]) => ({ id, ...data, startingCm: initial.bySeam[id]?.meanCm ?? null }))
  .sort((a, b) => b.meanCm - a.meanCm)
const report = {
  ok: closurePercent > 1,
  backend: solve.device,
  garment: payload.project.name,
  stitchedPairs: stitches.length,
  seamGroups: new Set(stitches.map((item) => item.seamId)).size,
  framesAnalyzed: samples,
  materialStitchStiffness: payload.fabrics?.main?.material?.stitchStiffness ?? 1,
  closurePercent,
  initialMeanGapCm: initial.meanCm,
  finalMeanGapCm: final.meanCm,
  finalP95GapCm: final.p95Cm,
  finalMaxGapCm: final.maxCm,
  worstSeams: worstSeams.slice(0, 8),
  samples: frames.map(({ frame, meanCm, p95Cm, maxCm }) => ({ frame, meanCm, p95Cm, maxCm })),
  source: { payload: path.resolve(payloadFile), simulationReport: path.resolve(solveFile), pc2: solve.pc2.path },
}
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (!report.ok) throw new Error('PPF sewing constraints did not visibly close the stitch gap')
