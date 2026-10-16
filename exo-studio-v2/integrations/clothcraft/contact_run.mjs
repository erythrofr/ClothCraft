// Opt-in Rust VBD+OGC experiment; never replaces accepted EXO simulation state.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nativeExport, paths } from './bridge.mjs'

const SUPPORTED = new Set(['clo-thomas', 'makehuman-base'])

export function assessment(report) {
  const m = report?.last || {}
  const steps = Number(report?.steps || 0)
  const gap = Number(m.max_seam_gap_m)
  const strain = Number(m.extension_p95_percent)
  const separation = Number(m.minimum_distance_m)
  const safeNumbers = Number.isFinite(gap) && Number.isFinite(strain) && Number.isFinite(separation)
  // Numerical diagnostics only. No swept collision, face intersection proof,
  // size grading or independent garment-fit certification is provided.
  const candidate = steps > 0 && safeNumbers && gap <= 0.015 && strain <= 10 && separation > 0
  return {
    fitAccepted: false, contactCertified: false,
    provisionalContactCandidate: candidate,
    completedSteps: steps, maxSeamGapMm: safeNumbers ? gap * 1000 : null,
    p95ExtensionPercent: safeNumbers ? strain : null,
    minimumFeatureDistanceMm: safeNumbers ? separation * 1000 : null,
    activeContacts: Number(m.contacts || 0),
    reason: candidate
      ? 'Screening thresholds passed; full continuous collision and garment-fit acceptance still required.'
      : 'Unverified fit: seam closure, stretch, or contact-distance screening did not pass.',
  }
}

function runBinary(bin, args, cwd, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', finished = false
    const timer = setTimeout(() => { child.kill('SIGKILL') }, timeoutMs)
    const fail = (message) => { if (!finished) { finished = true; clearTimeout(timer); reject(new Error(message)) } }
    child.stdout?.on('data', chunk => { stdout = (stdout + chunk).slice(-256_000) })
    child.stderr?.on('data', chunk => { stderr = (stderr + chunk).slice(-256_000) })
    child.on('error', error => fail(error.message))
    child.on('close', (code, signal) => {
      if (finished) return
      finished = true; clearTimeout(timer)
      resolve({ ok: code === 0, exit: code, signal, stdout, stderr })
    })
  })
}

export function selectedAvatar(model, env = process.env) {
  if (!SUPPORTED.has(model)) throw new Error(`${model} is not yet supported by ClothCraft OGC. Use Thomas or MakeHuman, or keep the EXO browser solver.`)
  const variable = model === 'clo-thomas' ? 'EXO_CLOTHCRAFT_AVATAR_THOMAS_OBJ' : 'EXO_CLOTHCRAFT_AVATAR_MAKEHUMAN_OBJ'
  const resource = env[variable] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'output', `${model === 'clo-thomas' ? 'thomas' : 'makehuman'}-body-normalized.obj`)
  if (!fs.existsSync(resource)) throw new Error(`Selected ${model} body-only collision OBJ is unavailable. Rebuild the personal desktop app with the original licensed avatar assets.`)
  return { model, resource }
}

function scaledCollider(source, target, avatar) {
  const height = Number(avatar?.heightCm)
  if (!Number.isFinite(height) || height < 130 || height > 220) throw new Error('Avatar height must be between 130 and 220 cm for this experimental contact run')
  const ratio = height / 180
  const contents = fs.readFileSync(source, 'utf8')
  // Source body-only references are pre-normalized to the displayed 180 cm
  // world frame. Scale X/Y/Z uniformly with the requested avatar height.
  fs.writeFileSync(target, contents.split('\n').map(line => {
    if (!line.startsWith('v ')) return line
    const numbers = line.slice(2).trim().split(/\s+/).map(Number)
    if (numbers.length !== 3 || numbers.some(v => !Number.isFinite(v))) throw new Error('Invalid collision mesh vertex')
    return `v ${numbers.map(v => (v * ratio).toFixed(9)).join(' ')}`
  }).join('\n'))
  return ratio
}

export async function runContact({ document, avatarModel, steps = 3 }, outputRoot, env = process.env) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Expected EXO garment document')
  if (!Number.isInteger(steps) || steps < 1 || steps > 30) throw new Error('ClothCraft step count must be an integer from 1 to 30')
  const avatar = selectedAvatar(avatarModel, env)
  const config = paths(env)
  if (!config.upstream || !fs.existsSync(config.rustFit)) throw new Error('ClothCraft CPU VBD+OGC executable unavailable')
  const converted = nativeExport(document, config.cli)
  const runId = crypto.randomUUID()
  const dir = path.join(outputRoot, 'runs', runId)
  fs.mkdirSync(dir, { recursive: true })
  const normalized = path.join(dir, 'avatar.obj')
  scaledCollider(avatar.resource, normalized, document.avatar)
  const template = converted.template
  const project = {
    version: 1, template, avatar_path: normalized,
    contact_stiffness: 500000, contact_clearance: 0, prearrange: false,
    quasistatic: true,
    solver: { dt: 1 / 240, gravity: [0, -9.81, 0], damping: 20,
      newton_iterations: 30, pcg_iterations: 500, absolute_tolerance: 1e-6,
      relative_tolerance: 1e-4 },
    state: null, mesh_signature: null,
  }
  const file = path.join(dir, 'project.json')
  fs.writeFileSync(file, JSON.stringify(project, null, 2))
  const output = path.join(dir, 'solution')
  const result = await runBinary(config.rustFit,
    ['--project', file, '--steps', String(steps), '--iterations', '16', '--threads', '2', '--output', output],
    config.upstream)
  const reportFile = path.join(output, 'run.json')
  let report = null
  if (fs.existsSync(reportFile)) {
    try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')) } catch { /* report stays absent */ }
  }
  const completed = result.ok && report?.backend === 'cpu-f64-vbd-ogc' && report?.steps === steps
  const gate = assessment(report)
  const meshFile = path.join(output, 'cloth.obj')
  const meshAvailable = completed && fs.existsSync(meshFile) && fs.statSync(meshFile).size > 0
  return {
    ok: completed, runId, backend: 'ClothCraft Rust CPU VBD + Offset Geometric Contact',
    avatarModel, requestedSteps: steps, ...gate,
    artifacts: meshAvailable ? {
      cloth: `/runs/${runId}/cloth.obj`, avatar: `/runs/${runId}/avatar.obj`,
    } : null,
    error: completed ? null : (report?.error || result.stderr.trim().slice(-2000) || 'Rust OGC did not complete'),
    report: report ? { backend: report.backend, steps: report.steps, last: report.last,
      scope: report.scope, seams: report.seams } : null,
    warnings: converted.warnings || [],
    sourcePreserved: true,
    note: 'Experimental batch simulation only. No CCD, friction, or verified avatar fit; do not overwrite EXO cloth with this result.',
  }
}
