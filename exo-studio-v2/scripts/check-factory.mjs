import { unzipSync, strFromU8 } from 'fflate'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildFactoryPackageZip } from '../src/core/factoryPackage.js'

const project = createZipHoodieTemplate()
project.markerSettings = { fabricWidthCm: 165, gapCm: 2, fabricWidthsCm: { main: 165, rib: 90 } }
const archive = unzipSync(buildFactoryPackageZip(project))
const names = Object.keys(archive).sort()
const required = [
  'README.txt',
  'manifest.json',
  'factory-spec.html',
  'tech-pack.json',
  'pom-spec.csv',
  'materials-bom.csv',
  'pattern-pieces.csv',
  'construction-seams.csv',
  'marker-summary.csv',
  'trims-hardware.json',
  'size-run.json',
  'garment-source.json',
]
for (const name of required) if (!archive[name]) throw new Error(`Factory package missing ${name}`)
for (const size of project.grading.sizes) {
  const name = `patterns/foundation-zip-hoodie-${size.toLowerCase()}.dxf`
  const bytes = archive[name]
  if (!bytes) throw new Error(`Factory package missing ${size} DXF`)
  const dxf = strFromU8(bytes)
  if (/NaN|Infinity/.test(dxf) || !dxf.trim().endsWith('EOF')) throw new Error(`Invalid ${size} DXF in factory package`)
}
const techPack = JSON.parse(strFromU8(archive['tech-pack.json']))
if (techPack.markers.M.fabricWidthCm !== 165 || techPack.markers.M.gapCm !== 2) throw new Error('Factory package ignored configured marker settings')
if (techPack.markers.M.byFabric?.rib?.fabricWidthCm !== 90) throw new Error('Factory package ignored rib marker width override')
if (techPack.markers.M.byFabric?.rib?.unusedPieces !== 1 || techPack.markers.M.byFabric?.rib?.unplaced?.[0]?.pieceId !== 'rib-waistband') throw new Error('Factory package did not report the too-wide rib waistband')
const markerCsv = strFromU8(archive['marker-summary.csv'])
if (!markerCsv.includes('Rib Waistband needs >=95.6 cm')) throw new Error('Marker CSV is missing overflow detail')
const html = strFromU8(archive['factory-spec.html'])
if (!html.includes('Point of Measurement') || !html.includes('Construction / Seam Diagnostics') || !html.includes(project.name)) throw new Error('Factory spec HTML is incomplete')
const manifest = JSON.parse(strFromU8(archive['manifest.json']))
if (manifest.files.length !== names.length) throw new Error(`Factory package manifest mismatch: ${manifest.files.length}/${names.length}`)
console.log(JSON.stringify({ files: names.length, sizes: project.grading.sizes, marker: techPack.markers.M }, null, 2))
