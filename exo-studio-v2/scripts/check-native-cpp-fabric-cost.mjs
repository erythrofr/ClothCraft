import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildFabricCostRun, fabricCostRunToCsv } from '../src/core/productionCost.js'

const bin = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
let rowsCompared = 0
let totalComparisons = 0

function run(project, op) {
  const process = spawnSync(bin, {
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document: project, op }) + '\n',
    encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024,
  })
  if (process.error) throw process.error
  assert.equal(process.status, 0, process.stderr)
  const result = JSON.parse(process.stdout.trim())
  assert.equal(result.ok, true, result.error)
  return result
}

function near(actual, expected, label, tolerance = .0001) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: nonfinite`)
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: native=${actual}, JS=${expected}`)
}

function verify(project) {
  const before = structuredClone(project)
  const js = buildFabricCostRun(project)
  const native = run(project, 'fabric-cost-run').report
  assert.equal(native.factoryCertified, false)
  assert.equal(native.currency, js.currency)
  assert.equal(native.basis, js.basis)
  assert.equal(native.rows.length, js.rows.length)
  assert.equal(native.totals.length, js.totals.length)
  for (const expected of js.rows) {
    const actual = native.rows.find(row => row.size === expected.size && row.fabricId === expected.fabricId)
    assert.ok(actual, `${expected.size}:${expected.fabricId}: missing material row`)
    for (const key of ['size', 'fabricId', 'material', 'currency', 'pricePerMeter',
      'cutPiecesRequested', 'cutPiecesPlaced', 'complete', 'extendedCost', 'status']) {
      if (typeof expected[key] === 'number') near(actual[key], expected[key], `${key}:${expected.size}:${expected.fabricId}`)
      else assert.equal(actual[key], expected[key], `${key}:${expected.size}:${expected.fabricId}`)
    }
    for (const key of ['widthCm', 'lengthMeters', 'efficiency'])
      near(actual[key], expected[key], `${key}:${expected.size}:${expected.fabricId}`)
    rowsCompared += 1
  }
  for (const expected of js.totals) {
    const actual = native.totals.find(total => total.size === expected.size)
    assert.ok(actual)
    assert.equal(actual.ready, expected.ready)
    assert.equal(actual.currency, expected.currency)
    if (expected.materialCost === null) assert.equal(actual.materialCost, null)
    else near(actual.materialCost, expected.materialCost, `cost total ${expected.size}`)
    totalComparisons += 1
  }
  const csv = run(project, 'fabric-cost-csv').csv
  assert.equal(csv, fabricCostRunToCsv(js), 'native estimated costing CSV must match browser CSV exactly')
  assert.deepEqual(project, before, 'costing must not mutate source')
}

const base = createDefaultProject()
const hoodie = createZipHoodieTemplate()
const pricedBase = structuredClone(base)
pricedBase.fabrics.main.pricePerMeter = 19.75
const pricedHoodie = structuredClone(hoodie)
for (const fabric of Object.values(pricedHoodie.fabrics)) fabric.pricePerMeter = 24.5
const narrowHoodie = structuredClone(pricedHoodie)
narrowHoodie.markerSettings.fabricWidthsCm = { ...(narrowHoodie.markerSettings.fabricWidthsCm || {}), rib: 90 }
const zeroPrice = structuredClone(base)
zeroPrice.fabrics.main.pricePerMeter = 0
for (const project of [base, hoodie, pricedBase, pricedHoodie, narrowHoodie, zeroPrice]) verify(project)

// Missing prices must be reported as null rather than conflated with zero;
// overflow must prevent apparently complete fabric costs for that material.
assert.ok(buildFabricCostRun(narrowHoodie).rows.some(row => row.status === 'INCOMPLETE_MARKER'))
assert.ok(buildFabricCostRun(zeroPrice).rows.some(row => row.extendedCost === 0))
assert.ok(buildFabricCostRun(base).rows.every(row => row.extendedCost === null))
console.log(JSON.stringify({ pass: true, implementation: 'native C++17',
  projectsCompared: 6, materialRowsCompared: rowsCompared, sizeTotalsCompared: totalComparisons,
  csvIdentical: true, missingPriceAndOverflowHandled: true, factoryCertified: false }))
