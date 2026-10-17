import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { unzipSync, strFromU8 } from 'fflate'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { projectToBomXml } from '../src/core/bomXml.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
function native(project, op, options = {}) {
  const child = spawnSync(cli, { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024,
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1',
      document: project, op, args: options }) + '\n' })
  if (child.error) throw child.error
  assert.equal(child.status, 0, child.stderr)
  return JSON.parse(child.stdout.trim())
}
let filesCompared = 0, printedMarkers = 0
for (const project of [createDefaultProject(), createZipHoodieTemplate()]) {
  const before = structuredClone(project)
  const packaged = native(project, 'export-factory-zip')
  assert.equal(packaged.ok, true, packaged.error)
  assert.equal(packaged.factoryCertified, false)
  const archive = Buffer.from(packaged.zipBase64, 'base64')
  assert.equal(archive.length, packaged.byteCount)
  const files = unzipSync(archive)
  const manifest = JSON.parse(strFromU8(files['manifest.json']))
  assert.equal(manifest.certified, false)
  assert.equal(manifest.schema, 'garment-studio.native-factory-package.v1')
  assert.deepEqual(Object.keys(files).sort(),
    [...manifest.files.map(x => x.path), 'manifest.json'].sort())
  assert.equal(strFromU8(files['bom.xml']), projectToBomXml(project))
  assert.ok(strFromU8(files['fabric-costing.csv']).includes('Fabric ID'))
  assert.equal(JSON.parse(strFromU8(files['garment-source.json'])).id, project.id)
  assert.ok(JSON.parse(strFromU8(files['size-run.json'])))
  assert.ok(JSON.parse(strFromU8(files['tech-pack.json'])))
  assert.ok(strFromU8(files['pom-spec.csv']).length > 20)
  for (const size of project.grading.sizes) {
    const folder = 'markers/' + size.toLowerCase() + '/'
    const dxf = files['patterns/' + size.toLowerCase() + '.dxf']
    assert.ok(dxf)
    assert.match(strFromU8(dxf), /CUT_/)
    assert.match(strFromU8(dxf), /GRAIN_/)
    assert.match(strFromU8(dxf), /NOTCH_/)
    const svg = Object.entries(files).filter(([path]) =>
      path.startsWith(folder) && path.endsWith('.svg'))
    assert.ok(svg.length > 0)
    for (const [path, value] of svg) {
      assert.match(strFromU8(value), /<svg/)
      const pdf = files[path.slice(0, -4) + '.pdf']
      if (pdf) {
        assert.equal(strFromU8(pdf.slice(0, 8)), '%PDF-1.4')
        printedMarkers++
      }
    }
  }
  filesCompared += Object.keys(files).length
  assert.equal(native(project, 'export-factory-zip').zipBase64, packaged.zipBase64,
    'native ZIP output must be deterministic')
  assert.deepEqual(project, before, 'native factory export mutated source')
  const pdfResponse = native(project, 'export-marker-pdf', { size: 'M', fabricId: 'main' })
  assert.equal(pdfResponse.ok, true, pdfResponse.error)
  assert.equal(pdfResponse.mimeType, 'application/pdf')
  assert.equal(pdfResponse.factoryCertified, false)
  const printable = Buffer.from(pdfResponse.pdfBase64, 'base64')
  assert.equal(printable.length, pdfResponse.byteCount)
  assert.equal(printable.toString('ascii', 0, 8), '%PDF-1.4')
}
console.log(JSON.stringify({ pass: true, native: 'C++17', projects: 2,
  filesCompared, printedMarkers, archiveManifest: true, pdf: true,
  sourcePreserved: true, deterministic: true, factoryCertified: false }))
