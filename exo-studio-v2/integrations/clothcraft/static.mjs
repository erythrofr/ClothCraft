// Standalone .app: production Vite assets served only to this Mac via loopback.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web')
const port = Number(process.env.EXO_WEB_PORT || 5284)
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.obj': 'text/plain; charset=utf-8', '.mp4': 'video/mp4',
}

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end(); return
  }
  let relative
  try { relative = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname) }
  catch { res.writeHead(400); res.end(); return }
  if (relative.includes('\0') || relative.includes('\\')) {
    res.writeHead(400); res.end(); return
  }
  const target = path.resolve(web, `.${relative === '/' ? '/index.html' : relative}`)
  if (!target.startsWith(web + path.sep)) {
    res.writeHead(403); res.end(); return
  }
  try {
    const actual = fs.realpathSync(target)
    if (!actual.startsWith(web + path.sep)) throw new Error('Invalid static path')
    if (!fs.statSync(actual).isFile()) throw new Error('Not a file')
    res.writeHead(200, { 'Content-Type': mime[path.extname(actual).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' })
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(actual).pipe(res)
  } catch { res.writeHead(404); res.end('Not found') }
}).listen(port, '127.0.0.1', () => {
  console.log(`EXO Sample 3D standalone assets available at http://127.0.0.1:${port}`)
})
