import { browserPbdBackend } from './browserPbdBackend.js'
import { nativeServiceBackend } from './nativeServiceBackend.js'

const backends = new Map([
  [browserPbdBackend.id, browserPbdBackend],
  [nativeServiceBackend.id, nativeServiceBackend],
])

function validateBackendContract(backend) {
  if (!backend?.id) throw new Error('Simulation backend requires an id')
  if (typeof backend.create !== 'function' || typeof backend.step !== 'function') {
    throw new Error(`Simulation backend ${backend.id} must implement create() and step()`)
  }
  if (backend.async === true && typeof backend.stepAsync !== 'function') {
    throw new Error(`Asynchronous simulation backend ${backend.id} requires stepAsync()`)
  }
  return backend
}

export function registerSimulationBackend(backend) {
  validateBackendContract(backend)
  if (backends.has(backend.id)) throw new Error(`Simulation backend already registered: ${backend.id}`)
  backends.set(backend.id, backend)
  return backend
}

export function replaceSimulationBackend(backend) {
  validateBackendContract(backend)
  backends.set(backend.id, backend)
  return backend
}

export function getSimulationBackend(id = 'browser-pbd') {
  return backends.get(id) || null
}

export function listSimulationBackends() {
  return [...backends.values()].map((backend) => ({
    id: backend.id,
    label: backend.label || backend.id,
    kind: backend.kind || 'unknown',
    maturity: backend.maturity || 'experimental',
    capabilities: { ...(backend.capabilities || {}) },
  }))
}

export function createSimulationSession(project, backendId = 'browser-pbd') {
  const backend = getSimulationBackend(backendId)
  if (!backend) throw new Error(`Unknown simulation backend: ${backendId}`)
  const session = backend.create(project)
  return { backend, session }
}
