import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { XMLParser } from 'fast-xml-parser'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { projectToBomXml } from '../src/core/bomXml.js'

// Byte-exact comparison against the current JavaScript BOM exporter, including
// marker costs, area units, ordering, XML escaping and construction trims.
const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const protocol = 'garment-studio.native-cad.v1'
const parser = new XMLParser({ ignoreAttributes: false })
const cases = []
const push = (name, project) => cases.push({ name, project })
const tee = createDefaultProject()
const hoodie = createZipHoodieTemplate()
push('unpriced-default-tee', tee)
push('unpriced-hoodie-multifabric', hoodie)

const priced = structuredClone(hoodie)
priced.fabrics.main.pricePerMeter = 19.75
priced.fabrics.rib.pricePerMeter = 8.2
priced.productionSpec = { currency: 'EUR' }
push('priced-eur-hoodie', priced)

const escaped = structuredClone(priced)
escaped.name = `Studio & Test <Garment> ' "`
escaped.fabrics.main.name = 'Heavy & Soft <Terry>'
escaped.pieces[0].name = 'Front & Back <Test>'
escaped.pieces[0].cutQuantity = 3
escaped.pieces[0].buttons = [{ id: 'btn-&-<1>', name: 'Metal & Glass', lengthCm: 0.9 }]
escaped.fasteners = [{ id: 'zip-1', type: 'coil', name: 'YKK & Test' }]
push('xml-escaping-and-cut-quantities', escaped)

const incomplete = structuredClone(priced)
incomplete.markerSettings = { fabricWidthCm: 4, gapCm: 1.5 }
push('incomplete-overflow-marker', incomplete)

const missing = structuredClone(tee)
missing.fabrics.main.pricePerMeter = ''
missing.pieces[0].cutQuantity = 2
missing.grading = { baseSize: 'M', sizes: ['S', 'M', 'L'], widthPerSizeCm: 2, lengthPerSizeCm: 1 }
push('missing-price-with-grading', missing)

const numericString = structuredClone(tee)
numericString.fabrics.main.pricePerMeter = '12.30'
push('numeric-string-price', numericString)

let fabricsCompared = 0, costsCompared = 0, trimsCompared = 0
for (const { name, project } of cases) {
  const before = structuredClone(project)
  const call = { protocol, document: project, op: 'export-bom' }
  const child = spawnSync(cli, { input: JSON.stringify(call) + '\n', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (child.error) throw child.error
  assert.equal(child.status, 0, `${name}: native CLI exited abnormally: ${child.stderr}`)
  const response = JSON.parse(child.stdout.trim())
  assert.equal(response.ok, true, `${name}: ${response.error}`)
  assert.equal(response.factoryCertified, false, `${name}: factory certification must not be implied`)
  assert.equal(response.xml, projectToBomXml(project), `${name}: native BOM differs from JavaScript exporter`)
  const parsed = parser.parse(response.xml).GarmentStudioBOM
  assert.equal(parsed['@_schemaVersion'], '1.0')
  assert.equal(parsed['@_patternUnits'], 'cm')
  assert.equal(parsed['@_projectName'], project.name)
  const entries = parsed.Fabrics.Fabric
  fabricsCompared += Array.isArray(entries) ? entries.length : 1
  const costs = parsed.FabricCostEstimates.EstimatedFabricCost
  costsCompared += Array.isArray(costs) ? costs.length : 1
  const trims = parsed.TrimsAndConstruction.Trim
  trimsCompared += Array.isArray(trims) ? trims.length : trims ? 1 : 0
  assert.deepEqual(project, before, `${name}: project modified during export`)
  const again = spawnSync(cli, { input: JSON.stringify(call) + '\n', encoding: 'utf8' })
  assert.equal(JSON.parse(again.stdout.trim()).xml, response.xml, `${name}: nondeterministic BOM`)
}

console.log(JSON.stringify({ pass: true, implementation: 'native C++17 BOM', cases: cases.length,
  fabricsCompared, costsCompared, trimsCompared, exactXmlParity: true,
  sourcePreserved: true, repeatable: true, factoryCertified: false }))
