import { buildSimulation, stepSimulation } from '../physics.js'
import { SIMULATION_PROTOCOL_VERSION, buildSimulationRequest, validateSimulationRequest } from './protocol.js'

export const browserPbdBackend = {
  id: 'browser-pbd',
  label: 'Browser PBD',
  kind: 'in-process',
  maturity: 'preview',
  capabilities: {
    platform: ['web', 'macos', 'windows', 'linux'],
    gpu: false,
    anisotropy: true,
    selfCollision: true,
    avatarCollision: true,
    layeredGarments: true,
    attachments: true,
    fusedLayers: true,
    dynamicAnimation: true,
    contactAnalysis: true,
    strainAnalysis: true,
  },

  create(project) {
    const request = buildSimulationRequest(project)
    const validation = validateSimulationRequest(request)
    if (!validation.ok) throw new Error(`Browser PBD request invalid: ${validation.errors.join('; ')}`)
    const simulation = buildSimulation(project)
    return {
      backendId: this.id,
      protocolVersion: SIMULATION_PROTOCOL_VERSION,
      project,
      request,
      simulation,
      frame: 0,
    }
  },

  step(session, dt = 1 / 60) {
    stepSimulation(session.simulation, session.project, dt)
    session.frame += 1
    return session
  },

  reset(session, project = session.project) {
    return this.create(project)
  },

  getStats(session) {
    const simulation = session.simulation
    return {
      frame: session.frame,
      pieces: simulation.pieces?.size || 0,
      constraints: simulation.constraints?.length || 0,
      seamConstraints: simulation.seamConstraints?.length || 0,
      anchors: simulation.anchorConstraints?.length || 0,
      fuseConstraints: simulation.fuseConstraints?.length || 0,
      strain: { ...(simulation.strain || {}) },
    }
  },

  getPieceState(session, pieceId) {
    const piece = session.simulation.pieces?.get(pieceId)
    if (!piece) return null
    return {
      id: pieceId,
      vertices: piece.particles.map((particle) => [particle.position.x, particle.position.y, particle.position.z]),
      faces: piece.faces.map((face) => [...face]),
      contact: piece.particles.map((particle) => Number(particle.contactDepth || 0)),
    }
  },

  dispose() {},
}
