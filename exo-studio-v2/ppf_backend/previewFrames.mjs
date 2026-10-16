// Parse the PPF Blender point cache into an immutable, labelled preview.
// The PC2 stores Blender X/right, Y/depth, Z/up; Garment Studio uses
// X/right, Y/up, Z/depth. Do NOT feed these preview coordinates back into the
// simulation's constraint rest lengths or user-authored 2D patterns.
import fs from 'node:fs'

const MAX_PREVIEW_VERTICES = 200000
const MAX_PREVIEW_FRAMES = 500

export function decodePpfPreview(payload, pc2, { frame = null, accepted = false, jobId = null } = {}) {
  if (payload?.protocol !== 'garment-studio.ppf-shell') throw new Error('Invalid PPF preview payload')
  if (!Buffer.isBuffer(pc2) || pc2.length < 32 || pc2.toString('ascii', 0, 11) !== 'POINTCACHE2') {
    throw new Error('Invalid PPF Blender PC2 cache')
  }
  const version = pc2.readInt32LE(12)
  const count = pc2.readInt32LE(16)
  const samples = pc2.readInt32LE(28)
  if (version !== 1 || count !== payload.shell?.vertices?.length || count > MAX_PREVIEW_VERTICES || count <= 0 || samples < 1 || samples > MAX_PREVIEW_FRAMES) {
    throw new Error('PPF preview cache topology, version, or sample count mismatch')
  }
  if (pc2.length !== 32 + samples * count * 12) throw new Error('Incomplete or overlong PPF preview cache')
  const requested = frame == null ? samples - 1 : Number(frame)
  if (!Number.isInteger(requested) || requested < 0 || requested >= samples) throw new Error('PPF preview frame out of range')
  const vertices = []
  for (let i = 0; i < count; i += 1) {
    const offset = 32 + (requested * count + i) * 12
    const x = pc2.readFloatLE(offset), depth = pc2.readFloatLE(offset + 4), up = pc2.readFloatLE(offset + 8)
    if (![x, depth, up].every(Number.isFinite)) throw new Error(`Non-finite PPF preview vertex ${i}`)
    vertices.push([x, up, -depth])
  }
  const pieces = (payload.shell?.pieces || []).map(piece => {
    const ids = piece.particleIndices || []
    if (!ids.every(index => Number.isInteger(index) && index >= 0 && index < vertices.length)) throw new Error(`Invalid PPF piece indices: ${piece.id}`)
    const localByGlobal = new Map(ids.map((index, localIndex) => [index, localIndex]))
    const faces = (payload.shell.faces || []).slice(piece.faceStart, piece.faceStart + piece.faceCount).map(face => {
      const local = face.map(index => localByGlobal.get(index))
      if (local.some(index => !Number.isInteger(index))) throw new Error(`Invalid face for ${piece.id}`)
      return local
    })
    return { id: piece.id, vertices: ids.map(index => vertices[index]), faces }
  })
  return { format: 'garment-studio.ppf-preview.v1', jobId, accepted, frame: requested, frames: samples,
    experimental: !accepted, pieces }
}

export function readPpfPreview(payloadFile, pc2File, options = {}) {
  const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'))
  const bytes = fs.readFileSync(pc2File)
  return decodePpfPreview(payload, bytes, options)
}

// Read-only INITIAL ASSEMBLY preview, deliberately independent of the PPF
// solver's PC2 frames. Even a collision-free arrangement with open seams is
// not a fitted garment and must never be reported as validated simulation.
export function decodePpfAssemblyPreview(payload, { jobId = null } = {}) {
  if (payload?.protocol !== 'garment-studio.ppf-shell') throw new Error('Invalid PPF initial assembly payload')
  const vertices = payload.shell?.vertices
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > MAX_PREVIEW_VERTICES) {
    throw new Error('Invalid PPF initial assembly vertex count')
  }
  if (vertices.some(v => !Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite))) {
    throw new Error('Invalid initial assembly vertex positions')
  }
  const pieces = (payload.shell?.pieces || []).map(piece => {
    const ids = piece.particleIndices || []
    if (!ids.length || ids.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length)) {
      throw new Error(`Invalid initial assembly vertex mapping: ${piece.id}`)
    }
    const map = new Map(ids.map((id, local) => [id, local]))
    const triangles = (payload.shell.faces || []).slice(piece.faceStart, piece.faceStart + piece.faceCount)
    if (triangles.length !== piece.faceCount) throw new Error(`Missing initial assembly faces: ${piece.id}`)
    const faces = triangles.map(face => {
      const local = face.map(i => map.get(i))
      if (local.length !== 3 || local.some(index => !Number.isInteger(index))) {
        throw new Error(`Invalid initial assembly face: ${piece.id}`)
      }
      return local
    })
    return { id: piece.id, vertices: ids.map(i => vertices[i]), faces }
  })
  if (!pieces.length) throw new Error('Initial assembly has no pieces')
  return {
    format: 'garment-studio.ppf-preview.v1', jobId, accepted: false,
    experimental: true, stage: 'initial-assembly', frame: 0, frames: 1,
    warning: 'Starting pose only. Open seams and unvalidated PPF trajectory; do not manufacture or export as fitted.',
    pieces,
  }
}

export function readPpfAssemblyPreview(payloadFile, options = {}) {
  return decodePpfAssemblyPreview(JSON.parse(fs.readFileSync(payloadFile, 'utf8')), options)
}
