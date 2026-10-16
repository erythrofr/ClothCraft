import fs from 'node:fs/promises'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const output = 'qa-export.glb'
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Production', exact: true }).click()
const downloadPromise = page.waitForEvent('download')
await page.getByRole('button', { name: /EXPORT GLB/ }).click()
const download = await downloadPromise
await download.saveAs(output)
await browser.close()

if (errors.length) throw new Error(`Browser errors during GLB export: ${errors.join(' | ')}`)
const glb = await fs.readFile(output)
await fs.unlink(output)

if (glb.toString('ascii', 0, 4) !== 'glTF') throw new Error('Invalid GLB magic header')
const version = glb.readUInt32LE(4)
const declaredLength = glb.readUInt32LE(8)
if (version !== 2) throw new Error(`Unexpected GLB version ${version}`)
if (declaredLength !== glb.length) throw new Error(`GLB length mismatch ${declaredLength} != ${glb.length}`)
const jsonChunkLength = glb.readUInt32LE(12)
const jsonChunkType = glb.readUInt32LE(16)
if (jsonChunkType !== 0x4E4F534A) throw new Error('First GLB chunk is not JSON')
const jsonText = glb.toString('utf8', 20, 20 + jsonChunkLength).replace(/\u0000/g, '').trim()
const manifest = JSON.parse(jsonText)
const nodeNames = (manifest.nodes || []).map((node) => node.name).filter(Boolean)
if (!nodeNames.some((name) => /Front/i.test(name)) || !nodeNames.some((name) => /Sleeve/i.test(name))) {
  throw new Error(`GLB manifest missing garment nodes: ${nodeNames.join(', ')}`)
}
if ((manifest.meshes || []).length < 4) throw new Error(`Expected at least four GLB meshes, found ${(manifest.meshes || []).length}`)

console.log(JSON.stringify({ bytes: glb.length, version, meshes: manifest.meshes.length, nodeNames }, null, 2))
