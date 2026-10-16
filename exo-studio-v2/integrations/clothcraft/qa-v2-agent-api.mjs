import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { createAgentApi, capabilityManifest } from './agent-api.mjs'

let revision = 7
let running = false
let busy = false
let targetSpecification = null
const geometry = () => ({ revision, running, busy, time: 0.25, uv: [[0, 0], [0.2, 0], [0.2, 0.2]], positions: [[0, 0, 0], [0.2, 0, 0], [0.2, 0.2, 0]], panels: [{ id: 'front', boundaries: { hem: [0, 1, 2] } }], template: { panels: [{ id: 'front', polygon: { edges: ['hem'], target_lengths: targetSpecification == null ? {} : { hem: targetSpecification } } }] } })
const commands = []
const workspace = {
  status: () => ({ loaded: true, busy }),
  async request(command) {
    commands.push(command)
    if (command.op === 'snapshot') return { ok: true, data: geometry() }
    if (command.revision !== undefined && command.revision !== revision) return { ok: false, error: 'Stale revision' }
    if (command.op === 'step') revision++
    if (command.op === 'line-spec') { targetSpecification = command.target_m; revision++ }
    return { ok: true, data: geometry() }
  },
}
const audit = []
const api = createAgentApi(workspace, { audit: event => audit.push(event) })
assert.equal(capabilityManifest.version, '1.1.0')

async function call(action) {
  const req = new PassThrough()
  req.method = 'POST'
  req.url = '/agent/v1/actions'
  const res = { status: null, json: null, writeHead(status) { this.status = status }, end(body) { this.json = JSON.parse(body) } }
  req.end(JSON.stringify(action))
  assert.equal(await api.handle(req, res), true)
  return { status: res.status, ...res.json }
}

assert.equal((await call({ action: 'workspace.snapshot' })).data.revision, 7)
assert.equal((await call({ action: 'simulation.step', steps: 1 })).code, 'REVISION_REQUIRED')
assert.equal((await call({ action: 'simulation.step', steps: 0, expectedRevision: 7 })).code, 'INVALID_ARGUMENTS')
assert.equal((await call({ action: 'simulation.step', steps: 1, expectedRevision: 6 })).code, 'STALE_REVISION')
assert.equal((await call({ action: 'simulation.step', steps: 1, expectedRevision: 7, op: 'reset' })).code, 'INVALID_ACTION')
assert.equal((await call({ action: 'simulation.step', steps: 1, expectedRevision: 7 })).revision, 8)
assert.equal((await call({ action: 'simulation.pause', expectedRevision: 7 })).code, 'STALE_REVISION')
assert.equal((await call({ action: 'simulation.pause', expectedRevision: 8 })).ok, true)
assert.equal((await call({ action: 'simulation.play', expectedRevision: 8 })).code, 'UNSUPPORTED_ACTION')
assert.equal(commands.filter(c => c.op === 'step').length, 1)
assert.equal(commands.filter(c => c.op === 'pause').length, 1)
assert.equal(audit.length, 9)
const inspected = await call({ action: 'line.inspect', panel: 'front', edge: 'hem' })
assert.equal(inspected.status, 200)
assert.equal(inspected.length2dCm, 40)
assert.equal(inspected.length3dCm, 40)
assert.deepEqual(inspected.uvCm, [[0, 0], [20, 0], [20, 20]])
assert.deepEqual(inspected.live3dCm, [[0, 0, 0], [20, 0, 0], [20, 20, 0]])
assert.match(inspected.physicalEffect, /none/)
assert.equal((await call({ action: 'line.inspect', panel: 'missing', edge: 'hem' })).code, 'UNKNOWN_PANEL')
assert.equal((await call({ action: 'line.inspect', panel: 'front', edge: 'missing' })).code, 'UNKNOWN_EDGE')
assert.equal((await call({ action: 'line.inspect', panel: 'front', edge: 'hem', steps: 1 })).code, 'INVALID_ARGUMENTS')
for (const targetCm of [-2, 0, 0.001, 1000.01, '12', null]) assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'hem', expectedRevision: 8, targetCm })).code, 'INVALID_ARGUMENTS')
assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'hem', targetCm: 12 })).code, 'REVISION_REQUIRED')
assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'hem', expectedRevision: 7, targetCm: 12 })).code, 'STALE_REVISION')
assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'missing', edge: 'hem', expectedRevision: 8, targetCm: 12 })).code, 'UNKNOWN_PANEL')
assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'missing', expectedRevision: 8, targetCm: 12 })).code, 'UNKNOWN_EDGE')
running = true
assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'hem', expectedRevision: 8, targetCm: 12 })).code, 'WORKSPACE_BUSY')
running = false
busy = true
assert.equal((await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'hem', expectedRevision: 8, targetCm: 12 })).code, 'WORKSPACE_BUSY')
busy = false
const updated = await call({ action: 'line.setTargetSpecification', panel: 'front', edge: 'hem', expectedRevision: 8, targetCm: 12 })
assert.equal(updated.status, 200)
assert.equal(updated.revision, 9)
assert.equal(updated.physicalEffect, 'none; drafting specification only')
assert.equal(commands.filter(c => c.op === 'line-spec').length, 1)
assert.deepEqual(commands.find(c => c.op === 'line-spec'), { op: 'line-spec', panel: 'front', edge: 'hem', target_m: 0.12, revision: 8 })
assert.equal((await call({ action: 'line.inspect', panel: 'front', edge: 'hem' })).targetSpecificationCm, 12)
workspace.status = () => ({ loaded: false, busy: false })
assert.equal((await call({ action: 'workspace.snapshot' })).code, 'NOT_LOADED')
console.log('Agent API and named-line inspection/specification validation, revision, audit, and no-implicit-open smoke tests passed')
