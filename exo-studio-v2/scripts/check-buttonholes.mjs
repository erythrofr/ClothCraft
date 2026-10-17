import { strFromU8 } from 'fflate'
import { createTemplateProject } from '../src/data/templates.js'
import { parseDxfPatterns, projectToDxf } from '../src/core/dxf.js'
import { buildFactoryPackageFiles } from '../src/core/factoryPackage.js'
import { buildTechPack } from '../src/core/measurements.js'

const project = createTemplateProject('blank')
const piece = project.pieces[0]
piece.buttons = [{ id: 'qa-button', x: 1.5, y: 19, diameterCm: 1.8, pairedButtonholeId: 'qa-buttonhole' }]
piece.buttonholes = [{
  id: 'qa-buttonhole', x: 1.5, y: 19, lengthCm: 2.8, widthCm: 0.4,
  orientationDeg: 30, color: '#555555', pairedButtonId: 'qa-button',
}]

const dxf = projectToDxf(project, 'M')
if (!dxf.includes('BUTTONHOLE_') || /NaN|Infinity/.test(dxf)) throw new Error('Buttonhole DXF export is invalid')
const imported = parseDxfPatterns(dxf, { units: 'mm' })
const importedButtonhole = imported.pieces.flatMap((item) => item.buttonholes || [])[0]
if (!importedButtonhole) throw new Error('Buttonhole DXF import did not restore the slot')
if (Math.abs(importedButtonhole.x - 1.5) > 0.03 || Math.abs(importedButtonhole.y - 19) > 0.03) throw new Error('Buttonhole center changed during DXF round trip')
if (Math.abs(importedButtonhole.lengthCm - 2.8) > 0.03 || Math.abs(importedButtonhole.orientationDeg - 30) > 0.5) throw new Error('Buttonhole dimensions changed during DXF round trip')

const techPack = buildTechPack(project)
const exported = techPack.patternPieces[0]?.buttonholes?.[0]
if (!exported || exported.widthCm !== 0.4 || exported.pairedButtonId !== 'qa-button') throw new Error('Tech pack lost buttonhole metadata')
const files = buildFactoryPackageFiles(project)
const trims = JSON.parse(strFromU8(files['trims-hardware.json']))
if (trims.buttonholes?.length !== 1 || trims.buttonholes[0].pairedButtonId !== 'qa-button') throw new Error('Factory package lost buttonhole metadata')

console.log(JSON.stringify({ importedButtonhole, techPackButtonhole: exported, factoryCount: trims.buttonholes.length }, null, 2))
