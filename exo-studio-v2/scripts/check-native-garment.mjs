import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildOutput = execFileSync(path.join(root, 'native_backend/scripts/build_garment_xpbd_cli.sh'), [], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim().split(/\r?\n/)
const binary = buildOutput.at(-1)
if (!binary || !fs.existsSync(binary)) throw new Error('Native garment XPBD binary was not produced')

const cases = [
  {
    id: 'tee',
    frames: 60,
    expectedPieces: 4,
    bounds: { minY: [1.0, 1.15], maxY: [1.65, 1.80] },
    limits: { strainAvg: 0.16, strainMax: 2.2, seamAvg: 0.02, seamMax: 0.08 },
  },
  {
    id: 'pants',
    frames: 120,
    expectedPieces: 4,
    bounds: { minY: [0.009, 0.02], maxY: [0.95, 1.08] },
    limits: { strainAvg: 0.13, strainMax: 0.85, seamAvg: 0.02, seamMax: 0.05 },
  },
]

const summaries = []
for (const test of cases) {
  const fixture = path.join(root, `native_backend/fixtures/${test.id}.native-sim.json`)
  const resultPath = path.join(root, `native_backend/output/${test.id}.native-result.json`)
  execFileSync('node', [path.join(root, 'scripts/export-native-sim-fixture.mjs'), test.id, fixture], { cwd: root, stdio: 'pipe' })
  const input = JSON.parse(fs.readFileSync(fixture, 'utf8'))
  const stdout = execFileSync(binary, [fixture, resultPath, String(test.frames)], { cwd: root, encoding: 'utf8' })
  const summary = JSON.parse(stdout.trim().split(/\r?\n/).at(-1))
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))

  if (result.backendId !== 'native-pbd-xpbd') throw new Error(`${test.id}: unexpected native backend ${result.backendId}`)
  if (result.frames !== test.frames) throw new Error(`${test.id}: expected ${test.frames} frames, got ${result.frames}`)
  if (result.pieces?.length !== test.expectedPieces) throw new Error(`${test.id}: expected ${test.expectedPieces} pieces, got ${result.pieces?.length}`)
  if (result.stats?.particles !== input.particles.length) throw new Error(`${test.id}: particle count changed`)
  if (result.stats?.constraints !== input.constraints.length) throw new Error(`${test.id}: constraint count changed`)
  if (result.stats?.anchors !== input.anchors.length) throw new Error(`${test.id}: anchor count changed`)
  if (result.stats?.finite !== true) throw new Error(`${test.id}: non-finite native result`)
  if (!(result.stats.structuralStrainAverage < test.limits.strainAvg)) throw new Error(`${test.id}: average structural strain ${result.stats.structuralStrainAverage}`)
  if (!(result.stats.structuralStrainMax < test.limits.strainMax)) throw new Error(`${test.id}: peak structural strain ${result.stats.structuralStrainMax}`)
  if (!(result.stats.seamAverageDistance < test.limits.seamAvg)) throw new Error(`${test.id}: average seam gap ${result.stats.seamAverageDistance}`)
  if (!(result.stats.seamMaxDistance < test.limits.seamMax)) throw new Error(`${test.id}: peak seam gap ${result.stats.seamMaxDistance}`)

  for (const piece of result.pieces) {
    if (!piece.id || !piece.vertices?.length || !piece.faces?.length) throw new Error(`${test.id}: lost geometry for ${piece.id || '<missing>'}`)
    if (!piece.vertices.flat().every(Number.isFinite)) throw new Error(`${test.id}: non-finite vertices in ${piece.id}`)
  }

  const vertices = result.pieces.flatMap((piece) => piece.vertices)
  const ys = vertices.map((vertex) => vertex[1])
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (!(minY >= test.bounds.minY[0] && minY <= test.bounds.minY[1])) throw new Error(`${test.id}: minY ${minY}`)
  if (!(maxY >= test.bounds.maxY[0] && maxY <= test.bounds.maxY[1])) throw new Error(`${test.id}: maxY ${maxY}`)

  summaries.push({
    ...summary,
    garment: test.id,
    frames: test.frames,
    strain: {
      average: Number(result.stats.structuralStrainAverage.toFixed(4)),
      peak: Number(result.stats.structuralStrainMax.toFixed(4)),
    },
    seamMm: {
      average: Number((result.stats.seamAverageDistance * 1000).toFixed(2)),
      peak: Number((result.stats.seamMaxDistance * 1000).toFixed(2)),
    },
    bodyBoundsM: { minY: Number(minY.toFixed(3)), maxY: Number(maxY.toFixed(3)) },
  })
}

console.log(JSON.stringify(summaries, null, 2))
