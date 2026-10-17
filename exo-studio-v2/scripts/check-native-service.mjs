import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'
import { getNativeBackendHealth, solveWithNativeService, stepNativePayload } from '../src/core/backends/nativeServiceClient.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = 5197
const url = `http://127.0.0.1:${port}`
const server = spawn('node', ['native_backend/server.mjs'], {
  cwd: root,
  env: { ...process.env, GS_NATIVE_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
server.stderr.on('data', (chunk) => { stderr += chunk.toString() })

async function waitForHealth() {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      return await getNativeBackendHealth({ baseUrl: url })
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  throw new Error(`Native service did not become healthy: ${stderr}`)
}

try {
  const health = await waitForHealth()
  if (!health.ok || health.backendId !== 'native-pbd-xpbd') throw new Error('Native service health response is invalid')

  const project = createTeeTemplate()
  const solved = await solveWithNativeService(project, {
    frames: 12,
    clothModel: 'strain-triangle',
    bendingModel: 'isometric-xpbd',
    baseUrl: url,
  })
  if (solved.result?.frames !== 12 || solved.result?.pieces?.length !== 4 || solved.result?.stats?.finite !== true) {
    throw new Error('One-shot native service result is invalid')
  }
  if (!(solved.elapsedMs > 0)) throw new Error('Native service did not report runtime')

  const payload = buildNativeSimulationPayload(project)
  const stepped = await stepNativePayload(payload, { frames: 8, baseUrl: url })
  if (stepped.result?.frames !== 8 || stepped.result?.state?.particles?.length !== payload.particles.length) {
    throw new Error('Incremental native service step is invalid')
  }
  if (!stepped.result.state.particles.every((particle) => particle.position?.every(Number.isFinite))) {
    throw new Error('Incremental native service returned non-finite particles')
  }

  console.log(JSON.stringify({
    health: { backendId: health.backendId, transport: health.transport },
    oneShot: {
      frames: solved.result.frames,
      particles: solved.result.stats.particles,
      runtimeMs: solved.elapsedMs,
      clothModel: solved.result.stats.clothModel,
      bendingModel: solved.result.stats.bendingModel,
    },
    incremental: {
      frames: stepped.result.frames,
      particles: stepped.result.state.particles.length,
      runtimeMs: stepped.elapsedMs,
    },
  }, null, 2))
} finally {
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500)
    server.once('exit', () => { clearTimeout(timer); resolve() })
  })
}
