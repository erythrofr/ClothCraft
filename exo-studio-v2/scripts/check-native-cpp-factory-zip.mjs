import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { createDefaultProject } from '../src/data/defaultProject.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const binary = process.env.FACTORY_ZIP_TEST_BIN || '/tmp/garment-factory-zip-test'
const sources = [
  'native_cpp/tests/test_factory_zip.cpp',
  ...['factory_zip', 'garment_document', 'dxf_export', 'construction_dxf', 'cutting_geometry', 'grading',
    'marker_layout', 'marker_svg', 'marker_pdf', 'bom_export', 'fabric_cost',
    'production_preflight', 'measurement_export', 'tech_pack_export']
    .map(name => `native_cpp/core/${name}.cpp`),
]
execFileSync('clang++', ['-std=c++17', '-O0', '-I', 'native_cpp/core', '-I', 'native_cpp/vendor',
  ...sources, '-o', binary], { cwd: root, stdio: 'inherit' })
execFileSync(binary, [], { cwd: root, stdio: 'inherit' })
const small = unzipSync(execFileSync(binary, ['--fixture'], { cwd: root }))
assert.equal(strFromU8(small['one.txt']), '123456789')
assert.equal(strFromU8(small['two/a.xml']), '<a/>')

const project = createDefaultProject()
const bytes = execFileSync(binary, ['--project'], {
  cwd: root, input: JSON.stringify(project), maxBuffer: 64 * 1024 * 1024,
})
const files = unzipSync(bytes)
const manifest = JSON.parse(strFromU8(files['manifest.json']))
const names = Object.keys(files).sort()
assert.equal(manifest.schema, 'garment-studio.native-factory-package.v1')
assert.equal(manifest.certified, false)
assert.equal(manifest.factoryCertified, false)
assert.equal(manifest.zipMethod, 'store')
assert.deepEqual(names, [...manifest.files.map(x => x.path), 'manifest.json'].sort())
for (const { path, bytes: length, crc32 } of manifest.files) {
  assert.ok(files[path], `missing ${path}`)
  assert.equal(files[path].length, length, `size mismatch: ${path}`)
  let c = 0xffffffff
  for (const byte of files[path]) {
    c ^= byte
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0)
  }
  assert.equal((~c) >>> 0, crc32, `CRC mismatch ${path}`)
}
assert.match(strFromU8(files['bom.xml']), /xml/i)
assert.match(strFromU8(files['fabric-costing.csv']), /size/i)
assert.ok(JSON.parse(strFromU8(files['production-preflight.json'])))
assert.ok(JSON.parse(strFromU8(files['tech-pack.json'])))
assert.ok(JSON.parse(strFromU8(files['size-run.json'])))
assert.equal(JSON.parse(strFromU8(files['garment-source.json'])).id,project.id)
assert.ok(strFromU8(files['pom-spec.csv']).length > 20)
const sizes = project.grading.sizes
for (const size of sizes) {
  assert.ok(files[`patterns/${size.toLowerCase()}.dxf`], `missing DXF ${size}`)
  assert.match(strFromU8(files[`patterns/${size.toLowerCase()}.dxf`]), /SECTION/)
  assert.match(strFromU8(files[`patterns/${size.toLowerCase()}.dxf`]), /NOTCH_/)
  const markerFiles = names.filter(n => n.startsWith(`markers/${size.toLowerCase()}/`))
  assert.ok(markerFiles.length > 0)
  const svgs = markerFiles.filter(n => n.endsWith('.svg'))
  const pdfs = markerFiles.filter(n => n.endsWith('.pdf'))
  assert.equal(pdfs.length, svgs.length, `PDF/SVG count mismatch for ${size}`)
  for (const path of markerFiles) {
    if (path.endsWith('.svg')) assert.match(strFromU8(files[path]), /<svg[^>]*width="[\d.]+cm"/)
    if (path.endsWith('.pdf')) assert.match(strFromU8(files[path]), /^%PDF-1.4/)
  }
  for (const svg of svgs) {
    const pdf = svg.replace(/\.svg$/, '.pdf')
    const widthCm = Number(strFromU8(files[svg]).match(/<svg[^>]*width="([\d.]+)cm"/)?.[1])
    const heightCm = Number(strFromU8(files[svg]).match(/<svg[^>]*height="([\d.]+)cm"/)?.[1])
    assert.ok(Number.isFinite(widthCm) && widthCm > 0)
    assert.ok(Number.isFinite(heightCm) && heightCm > 0)
    const report = JSON.parse(execFileSync('python3', ['-c', `
import fitz, json, sys
pdf=fitz.open(stream=sys.stdin.buffer.read(),filetype="pdf")
print(json.dumps({"pages":len(pdf),"dimensions":[[page.rect.width,page.rect.height] for page in pdf]}))
`], { input: files[pdf], encoding: 'utf8', cwd: root }))
    assert.equal(report.pages, Math.max(1, Math.ceil(heightCm / 400)), `PDF pagination ${pdf}`)
    for (let i = 0; i < report.pages; i++) {
      const [wPt, hPt] = report.dimensions[i]
      const remaining = Math.min(400, heightCm - i * 400)
      assert.ok(Math.abs(wPt - widthCm * 72 / 2.54) < 0.02, `PDF page width ${pdf}`)
      assert.ok(Math.abs(hPt - remaining * 72 / 2.54) < 0.02, `PDF page height ${pdf}`)
    }
  }
}
assert.ok(names.some(n => n.endsWith('.pdf')))
console.log(`PASS native factory ZIP: ${names.length} stored entries, ${sizes.length} sizes, CRC32, manifest, DXF/SVG/PDF/BOM/POM/tech-pack extraction`)
