// Versioned, localhost-only facade for the existing ClothCraft workspace.
// Mount handle() after the server's origin check, sharing its workspace instance.
export const AGENT_API_VERSION = '1.1.0'

export const capabilityManifest = Object.freeze({
  api: 'exo.clothcraft.agent', version: AGENT_API_VERSION,
  scope: 'single-local-workspace', transport: 'HTTP JSON on loopback',
  revision: 'Native revision integer. Mutations require expectedRevision; 409 on mismatch.',
  capabilities: [
    { id: 'workspace.status', method: 'GET', path: '/agent/v1/status', mutates: false },
    { id: 'workspace.snapshot', method: 'POST', path: '/agent/v1/actions', mutates: false, args: { action: 'workspace.snapshot' } },
    { id: 'simulation.pause', method: 'POST', path: '/agent/v1/actions', mutates: true, precondition: 'expectedRevision' },
    { id: 'simulation.step', method: 'POST', path: '/agent/v1/actions', mutates: true, precondition: 'expectedRevision', args: { steps: 'integer 1..4' } },
    { id: 'line.inspect', method: 'POST', path: '/agent/v1/actions', mutates: false, args: { panel: 'existing panel ID', edge: 'existing named boundary' }, units: 'cm' },
    { id: 'line.setTargetSpecification', method: 'POST', path: '/agent/v1/actions', mutates: true, precondition: 'expectedRevision', args: { panel: 'existing panel ID', edge: 'existing named boundary', targetCm: 'finite number 0.01..1000' }, effect: 'Drafting annotation only; no physical force or mesh deformation' },
  ],
  unsupported: ['create-garment', 'edit-pattern', 'fabric-grab', 'play', 'recover-off-body', 'fit-certification'],
})

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const ownKeys = (v, allowed) => Object.keys(v).every(k => allowed.includes(k))
const validRevision = n => Number.isSafeInteger(n) && n >= 0
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]))
function inspectLine(data, panel, edge) {
  const authored = data?.template?.panels?.find(p => p.id === panel)
  const meshPanel = data?.panels?.find(p => p.id === panel)
  if (!authored || !meshPanel) return { ok: false, code: 'UNKNOWN_PANEL' }
  if (!Array.isArray(authored.polygon?.edges) || !authored.polygon.edges.includes(edge) || !Array.isArray(meshPanel.boundaries?.[edge])) return { ok: false, code: 'UNKNOWN_EDGE' }
  const indices = meshPanel.boundaries[edge]
  if (indices.length < 2 || !indices.every(n => Number.isSafeInteger(n) && n >= 0 && Array.isArray(data.uv?.[n]) && Array.isArray(data.positions?.[n]) && data.uv[n].length >= 2 && data.positions[n].length >= 3 && data.uv[n].every(Number.isFinite) && data.positions[n].every(Number.isFinite))) return { ok: false, code: 'INVALID_GEOMETRY' }
  const uvCm = indices.map(i => data.uv[i].slice(0, 2).map(n => n * 100))
  const live3dCm = indices.map(i => data.positions[i].slice(0, 3).map(n => n * 100))
  const sumLength = points => points.slice(1).reduce((n, p, i) => n + distance(points[i], p), 0)
  return { ok: true, panel, edge, revision: data.revision, indices, uvCm, live3dCm, length2dCm: sumLength(uvCm), length3dCm: sumLength(live3dCm), targetSpecificationCm: Number.isFinite(authored.polygon?.target_lengths?.[edge]) ? authored.polygon.target_lengths[edge] * 100 : null, physicalEffect: 'none; drafting specification only' }
}

export function createAgentApi(workspace, { audit = () => {} } = {}) {
  if (!workspace || typeof workspace.request !== 'function' || typeof workspace.status !== 'function') throw new TypeError('Workspace API required')
  let inFlight = false
  const respond = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(JSON.stringify(data))
  }
  const snapshot = async () => {
    if (!workspace.status().loaded) return { ok: false, error: 'No garment open', code: 'NOT_LOADED' }
    return workspace.request({ op: 'snapshot', avatar: false })
  }
  const dispatch = async command => {
    if (!isObject(command) || typeof command.action !== 'string' || !ownKeys(command, ['action', 'expectedRevision', 'steps', 'panel', 'edge', 'targetCm'])) return { status: 400, body: { ok: false, code: 'INVALID_ACTION', error: 'Unknown fields or malformed action' } }
    const { action, expectedRevision, steps, panel, edge, targetCm } = command
    if (!['workspace.snapshot', 'simulation.pause', 'simulation.step', 'line.inspect', 'line.setTargetSpecification'].includes(action)) return { status: 400, body: { ok: false, code: 'UNSUPPORTED_ACTION', error: 'Action is not in capability manifest' } }
    if (action === 'workspace.snapshot') {
      if (!ownKeys(command, ['action'])) return { status: 400, body: { ok: false, code: 'INVALID_ARGUMENTS' } }
      const result = await snapshot()
      return { status: result.ok ? 200 : 409, body: result }
    }
    const lineAction = action === 'line.inspect' || action === 'line.setTargetSpecification'
    if (lineAction) {
      const allowed = action === 'line.inspect' ? ['action', 'panel', 'edge'] : ['action', 'panel', 'edge', 'expectedRevision', 'targetCm']
      if (!ownKeys(command, allowed) || typeof panel !== 'string' || !panel.trim() || typeof edge !== 'string' || !edge.trim()) return { status: 400, body: { ok: false, code: 'INVALID_ARGUMENTS' } }
      if (action === 'line.setTargetSpecification' && (typeof targetCm !== 'number' || !Number.isFinite(targetCm) || targetCm < 0.01 || targetCm > 1000)) return { status: 400, body: { ok: false, code: 'INVALID_ARGUMENTS', error: 'targetCm must be 0.01–1000 cm' } }
    }
    if (action === 'line.inspect') {
      const result = await snapshot()
      if (!result.ok) return { status: 409, body: result }
      const line = inspectLine(result.data, panel, edge)
      return { status: line.ok ? 200 : 404, body: line }
    }
    if (!validRevision(expectedRevision)) return { status: 400, body: { ok: false, code: 'REVISION_REQUIRED', error: 'expectedRevision must be a nonnegative safe integer' } }
    if (action === 'simulation.pause' && !ownKeys(command, ['action', 'expectedRevision'])) return { status: 400, body: { ok: false, code: 'INVALID_ARGUMENTS' } }
    if (action === 'simulation.step' && (!ownKeys(command, ['action', 'expectedRevision', 'steps']) || !Number.isInteger(steps) || steps < 1 || steps > 4)) return { status: 400, body: { ok: false, code: 'INVALID_ARGUMENTS', error: 'steps must be integer 1..4' } }
    const current = await snapshot()
    if (!current.ok) return { status: 409, body: current }
    if (current.data?.revision !== expectedRevision) return { status: 409, body: { ok: false, code: 'STALE_REVISION', error: 'Snapshot revision differs', currentRevision: current.data?.revision } }
    if (action === 'line.setTargetSpecification') {
      if (workspace.status().busy || current.data?.running || current.data?.busy) return { status: 409, body: { ok: false, code: 'WORKSPACE_BUSY' } }
      const line = inspectLine(current.data, panel, edge)
      if (!line.ok) return { status: line.code === 'INVALID_GEOMETRY' ? 422 : 404, body: line }
      const result = await workspace.request({ op: 'line-spec', panel, edge, target_m: targetCm / 100, revision: expectedRevision })
      if (!result.ok) return { status: 409, body: { ...result, code: 'WORKSPACE_REJECTED' } }
      return { status: 200, body: { ok: true, action, panel, edge, targetSpecificationCm: targetCm, expectedRevision, revision: result.data?.revision, physicalEffect: 'none; drafting specification only' } }
    }
    if (action === 'simulation.step' && (current.data?.running || current.data?.busy)) return { status: 409, body: { ok: false, code: 'WORKSPACE_BUSY', error: 'Pause simulation before stepping' } }
    const result = await workspace.request(action === 'simulation.pause' ? { op: 'pause' } : { op: 'step', steps, revision: expectedRevision })
    if (!result.ok) return { status: 409, body: { ...result, code: 'WORKSPACE_REJECTED' } }
    return { status: 200, body: { ok: true, action, expectedRevision, revision: result.data?.revision, running: Boolean(result.data?.running), time: result.data?.time } }
  }
  async function handle(req, res) {
    const url = req.url?.split('?')[0]
    if (!url?.startsWith('/agent/v1/')) return false
    // Outer HTTP bridge must still enforce its explicit Origin allowlist.
    if (req.method === 'GET' && url === '/agent/v1/capabilities') { respond(res, 200, capabilityManifest); return true }
    if (req.method === 'GET' && url === '/agent/v1/status') { respond(res, 200, { ok: true, apiVersion: AGENT_API_VERSION, ...workspace.status() }); return true }
    if (req.method !== 'POST' || url !== '/agent/v1/actions') { respond(res, 404, { ok: false, code: 'NOT_FOUND' }); return true }
    if (inFlight) { respond(res, 409, { ok: false, code: 'AGENT_BUSY' }); return true }
    inFlight = true
    let action = 'invalid'
    let result
    try {
      const chunks = []
      let length = 0
      for await (const chunk of req) {
        length += chunk.length
        if (length > 16384) throw new Error('Agent request exceeds 16 KB')
        chunks.push(chunk)
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      action = typeof data?.action === 'string' ? data.action : 'invalid'
      result = await dispatch(data)
    } catch (error) { result = { status: 400, body: { ok: false, code: 'INVALID_REQUEST', error: String(error.message || error) } } }
    finally { inFlight = false }
    try { audit({ at: new Date().toISOString(), action, status: result.status, ok: result.body.ok, revision: result.body.revision ?? null }) } catch { /* telemetry must never alter operations */ }
    respond(res, result.status, result.body)
    return true
  }
  return { handle, dispatch }
}
