import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulationRequest, validateSimulationRequest } from '../src/core/backends/protocol.js'
import { createSimulationSession, listSimulationBackends } from '../src/core/backends/registry.js'

const project = createTeeTemplate()
const request = buildSimulationRequest(project, { requestId: 'qa-backend-request' })
const validation = validateSimulationRequest(request)
if (!validation.ok) throw new Error(validation.errors.join('\n'))
if (request.pieces.length !== project.pieces.length) throw new Error('Protocol request lost pattern pieces')
if (request.seams.length !== project.seams.length) throw new Error('Protocol request lost seams')
if (!request.pieces.every((piece) => piece.pattern.boundaryCm.length >= piece.pattern.pointsCm.length)) throw new Error('Protocol boundary sampling failed')

const { backend, session } = createSimulationSession(project)
for (let frame = 0; frame < 60; frame += 1) backend.step(session, 1 / 60)
const stats = backend.getStats(session)
if (stats.frame !== 60 || stats.pieces !== project.pieces.length) throw new Error('Backend session stats are inconsistent')
if (!Number.isFinite(stats.strain.average) || !Number.isFinite(stats.strain.max)) throw new Error('Backend strain output is non-finite')
const front = backend.getPieceState(session, 'front')
if (!front?.vertices?.length || !front.faces?.length) throw new Error('Backend did not expose piece state')
if (!front.vertices.flat().every(Number.isFinite)) throw new Error('Backend output contains non-finite vertex positions')

console.log(JSON.stringify({
  backends: listSimulationBackends(),
  request: { pieces: request.pieces.length, seams: request.seams.length, fabrics: Object.keys(request.fabrics).length },
  stats,
  front: { vertices: front.vertices.length, faces: front.faces.length },
}, null, 2))
