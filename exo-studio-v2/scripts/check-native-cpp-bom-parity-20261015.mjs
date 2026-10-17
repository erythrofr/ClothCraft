import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { XMLParser } from 'fast-xml-parser'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { projectToBomXml } from '../src/core/bomXml.js'

const binary = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false })

function execute(document) {
  const process = spawnSync(binary, {
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document, op: 'export-bom' }) + '\n',
    encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024,
  })
  if (process.error) throw process.error
  assert.equal(process.status, 0, process.stderr)
  const result = JSON.parse(process.stdout.trim())
  assert.equal(result.ok, true, result.error)
  assert.equal(result.factoryCertified, false)
  return result.xml
}

function asArray(value) { return value === undefined ? [] : Array.isArray(value) ? value : [value] }

// XML element order is not meaningful to BOM consumers, and C++ JSON objects
// enumerate fabric keys differently from JavaScript insertion-ordered objects.
function normalize(xml) {
  const doc = parser.parse(xml)
  const bom = doc.GarmentStudioBOM
  assert.ok(bom && typeof bom === 'object')
  const fabrics = bom.Fabrics || {}
  const trims = bom.TrimsAndConstruction || {}
  const estimates = bom.FabricCostEstimates || {}
  const stable = (entries, keys) => entries.map(item => ({ ...item }))
    .sort((a, b) => keys.map(k => String(a[k] ?? '').localeCompare(String(b[k] ?? '')))
      .find(n => n !== 0) ?? 0)
  const normalizedFabric = stable(asArray(fabrics.Fabric).map(fabric => ({
    ...fabric,
    Pattern: stable(asArray(fabric.Pattern), ['id']),
  })), ['id'])
  return {
    projectId: bom.projectId,
    projectName: bom.projectName,
    revision: bom.revision,
    schemaVersion: bom.schemaVersion,
    baseSize: bom.baseSize,
    patternUnits: bom.patternUnits,
    usageBasis: bom.usageBasis,
    fabrics: normalizedFabric,
    trims: stable(asArray(trims.Trim), ['patternId', 'type', 'id']),
    costCurrency: estimates.currency,
    costBasis: estimates.basis,
    estimatedCosts: stable(asArray(estimates.EstimatedFabricCost), ['size', 'fabricId']),
  }
}

const plain = createDefaultProject()
const priced = structuredClone(plain)
priced.fabrics.main.pricePerMeter = 22.37
const hoodie = createZipHoodieTemplate()
const narrow = structuredClone(hoodie)
narrow.markerSettings.fabricWidthsCm = { ...(narrow.markerSettings.fabricWidthsCm || {}), rib: 90 }
const special = structuredClone(priced)
special.name = 'Jersey & rib <sample> "fit"'
special.fabrics.main.name = `Cotton's & jersey`
special.fasteners = [{ id: 'brand-label', type: 'label', name: 'Size < M & L >' }]
special.pieces[0].buttons = [{ id: 'button-a', name: 'Corozo & horn', lengthCm: 1.7 }]
const runs = [plain, priced, hoodie, narrow, special]
let matchedElements = 0
for (const project of runs) {
  const before = structuredClone(project)
  const native = normalize(execute(project))
  const js = normalize(projectToBomXml(project))
  assert.deepEqual(native, js, `${project.name}:native XML structure differs`)
  assert.deepEqual(project, before, 'BOM export must not mutate input')
  matchedElements += native.fabrics.length + native.trims.length + native.estimatedCosts.length
}
console.log(JSON.stringify({ pass: true, implementation: 'native C++17',
  projectsCompared: runs.length, bomElementsCompared: matchedElements,
  escapedSpecialXml: true, factoryCertified: false }))
