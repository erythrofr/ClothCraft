import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildNativeSimulationPayload, nativePayloadSummary } from '../src/core/backends/nativePayload.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.GS_NATIVE_PORT || 5191)
const host = process.env.GS_NATIVE_HOST || '127.0.0.1'
const binary = path.join(root, 'native_backend/bin/garment_xpbd_cli')
const buildScript = path.join(root, 'native_backend/scripts/build_garment_xpbd_cli.sh')
const MAX_BODY = 12 * 1024 * 1024

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extra,
  }
}

function send(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, headers({ 'Content-Length': Buffer.byteLength(text) }))
  res.end(text)
}

function ensureBinary() {
  if (fs.existsSync(binary)) return
  const build = spawnSync(buildScript, [], { cwd: root, encoding: 'utf8', timeout: 120000 })
  if (build.status !== 0 || !fs.existsSync(binary)) {
    throw new Error(`Native backend build failed: ${build.stderr || build.stdout || 'unknown error'}`)
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch (error) { reject(new Error(`Invalid JSON: ${error.message}`)) }
    })
    req.on('error', reject)
  })
}

function qualityOptions(quality) {
  switch (quality) {
    case 'quality':
    case 'ultra':
      return { clothModel: 'strain-triangle', bendingModel: 'isometric-xpbd' }
    case 'balanced':
      return { clothModel: 'distance', bendingModel: 'isometric-xpbd' }
    case 'draft':
    case 'preview':
    default:
      return { clothModel: 'distance', bendingModel: 'distance' }
  }
}

function runPayload(payload, frames = 90) {
  ensureBinary()
  const safeFrames = Math.max(1, Math.min(600, Math.round(Number(frames) || 90)))
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'garment-studio-native-'))
  const inputPath = path.join(workdir, 'input.json')
  const outputPath = path.join(workdir, 'output.json')
  try {
    fs.writeFileSync(inputPath, JSON.stringify(payload))
    const started = performance.now()
    const run = spawnSync(binary, [inputPath, outputPath, String(safeFrames)], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    })
    const elapsedMs = performance.now() - started
    if (run.status !== 0 || !fs.existsSync(outputPath)) {
      throw new Error(`Native simulation failed: ${run.stderr || run.stdout || `exit ${run.status}`}`)
    }
    const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    return {
      ...result,
      request: { ...nativePayloadSummary(payload), frames: safeFrames },
      runtimeMs: Number(elapsedMs.toFixed(1)),
    }
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true })
  }
}

function runSimulation(project, { frames = 90, quality = 'quality', clothModel, bendingModel, experimentalSewFirst = false } = {}) {
  const preset = qualityOptions(quality)
  const options = {
    clothModel: clothModel || preset.clothModel,
    bendingModel: bendingModel || preset.bendingModel,
    experimentalSewFirst:experimentalSewFirst === true,
  }
  const payload = buildNativeSimulationPayload(project, options)
  const result = runPayload(payload, frames)
  result.request = { ...result.request, quality, ...options }
  return result
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers())
    return res.end()
  }
  if (req.method === 'GET' && req.url === '/health') {
    try {
      ensureBinary()
      return send(res, 200, {
        ok: true,
        backendId: 'native-pbd-xpbd',
        transport: 'local-http',
        binary,
        pid: process.pid,
      })
    } catch (error) {
      return send(res, 503, { ok: false, error: error.message })
    }
  }
  if (req.method === 'POST' && req.url === '/simulate') {
    try {
      const body = await readBody(req)
      if (!body?.project?.pieces?.length) return send(res, 400, { ok: false, error: 'project.pieces is required' })
      const result = runSimulation(body.project, {
        frames: body.frames,
        quality: body.quality,
        clothModel: body.clothModel,
        bendingModel: body.bendingModel,
      })
      return send(res, 200, { ok: true, result })
    } catch (error) {
      return send(res, 500, { ok: false, error: error.message })
    }
  }
  if (req.method === 'POST' && req.url === '/step') {
    try {
      const body = await readBody(req)
      if (!body?.payload?.particles?.length || !body?.payload?.constraints) {
        return send(res, 400, { ok: false, error: 'payload.particles and payload.constraints are required' })
      }
      const result = runPayload(body.payload, body.frames)
      return send(res, 200, { ok: true, result })
    } catch (error) {
      return send(res, 500, { ok: false, error: error.message })
    }
  }
  return send(res, 404, { ok: false, error: 'Not found' })
})

server.listen(port, host, () => {
  console.log(JSON.stringify({ service: 'garment-studio-native-xpbd', host, port, pid: process.pid }))
})
