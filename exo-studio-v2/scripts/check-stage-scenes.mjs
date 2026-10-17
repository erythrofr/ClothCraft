import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/stage-scenes/manifest.json'), 'utf8'))
const ids = [...Array.from({length:5},(_,i)=>`R${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:15},(_,i)=>`S${String(i+1).padStart(2,'0')}`)]
const failed = []
for (const id of ids) {
  const asset = manifest.stages.find(stage => stage.id === id)
  if (!asset) { failed.push(`${id}: missing manifest entry`); continue }
  if (asset.status !== 'ready') continue
  const file = path.join(root, 'public', asset.file.replace(/^\//,''))
  if (!fs.existsSync(file)) { failed.push(`${id}: GLB missing`); continue }
  const contents = fs.readFileSync(file)
  if (contents.toString('ascii',0,4) !== 'glTF' || contents.readUInt32LE(8) !== contents.length)
    failed.push(`${id}: malformed GLB header or declared length`)
  if (asset.meshes < 5 || asset.polygons < 50 || contents.length !== asset.bytes)
    failed.push(`${id}: source geometry or bytes mismatch`)
}
if (manifest.stages.length !== ids.length) failed.push('Unexpected manifest entry count')
console.log(`${manifest.stages.filter(a=>a.status==='ready').length} ready GLBs, ${manifest.stages.filter(a=>a.status!=='ready').length} unfinished source scenes`)
if (failed.length) { console.error(failed.join('\n')); process.exitCode = 1 }
