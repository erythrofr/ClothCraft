import fs from 'node:fs/promises'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const output = 'qa-export.obj'
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Production', exact: true }).click()
const downloadPromise = page.waitForEvent('download')
await page.getByRole('button', { name: /EXPORT 3D OBJ/ }).click()
const download = await downloadPromise
await download.saveAs(output)
await browser.close()

const obj = await fs.readFile(output, 'utf8')
await fs.unlink(output)

const vertexCount = obj.split('\n').filter((line) => line.startsWith('v ')).length
const faceCount = obj.split('\n').filter((line) => line.startsWith('f ')).length
const objects = obj.split('\n').filter((line) => line.startsWith('o ')).map((line) => line.slice(2))
if (!obj.includes('# Units: meters')) throw new Error('OBJ export did not declare meter units')
if (vertexCount < 20 || faceCount < 10) throw new Error(`OBJ export too small: ${vertexCount} vertices / ${faceCount} faces`)
if (!objects.some((name) => /Front/i.test(name)) || !objects.some((name) => /Sleeve/i.test(name))) throw new Error(`OBJ missing named garment objects: ${objects.join(', ')}`)
if (/(?:NaN|Infinity)/.test(obj)) throw new Error('OBJ contains invalid numeric data')

console.log(JSON.stringify({ vertexCount, faceCount, objects }, null, 2))
