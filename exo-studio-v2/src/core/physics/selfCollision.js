import * as THREE from 'three'

const EPSILON = 1e-6

// Symmetric spatial-hash particle contacts. Standalone from sewing, body
// collision, rendering, and backend transport; all behavior is preserved.
export function resolveSelfCollisions(simulation, minimumDistance) {
  if (minimumDistance <= EPSILON) return
  const cellSize = minimumDistance
  const grid = new Map()
  const particles = []
  const keyFor = (particle) => {
    const x = Math.floor(particle.position.x / cellSize)
    const y = Math.floor(particle.position.y / cellSize)
    const z = Math.floor(particle.position.z / cellSize)
    return { x, y, z, key: `${x}:${y}:${z}` }
  }

  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) {
      const cell = keyFor(particle)
      if (!grid.has(cell.key)) grid.set(cell.key, [])
      grid.get(cell.key).push(particle)
      particles.push(particle)
    }
  }

  const minSq = minimumDistance * minimumDistance
  const corrections = new Map()
  const addCorrection = (particle, direction, scale) => {
    let correction = corrections.get(particle.simIndex)
    if (!correction) {
      correction = new THREE.Vector3()
      corrections.set(particle.simIndex, correction)
    }
    correction.addScaledVector(direction, scale)
  }
  const outwardDirection = (particle) => {
    const mode = particle.wrapMode || ''
    let centerX = 0
    if (mode === 'left-arm') centerX = -0.285
    else if (mode === 'right-arm') centerX = 0.285
    else if (mode.startsWith('left-leg')) centerX = -0.105
    else if (mode.startsWith('right-leg')) centerX = 0.105
    const direction = new THREE.Vector3(particle.position.x - centerX, 0, particle.position.z)
    if (direction.lengthSq() <= EPSILON) direction.set(0, 0, particle.collisionSideZ || 1)
    else direction.normalize()
    return direction
  }
  for (const particle of particles) {
    if (particle.invMass <= 0) continue
    const cell = keyFor(particle)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const candidates = grid.get(`${cell.x + dx}:${cell.y + dy}:${cell.z + dz}`)
          if (!candidates) continue
          for (const other of candidates) {
            if (other.simIndex <= particle.simIndex) continue
            if (particle.pieceId !== other.pieceId && simulation.fusedPiecePairs?.has([particle.pieceId, other.pieceId].sort().join('|'))) continue
            const left = particle.simIndex
            const right = other.simIndex
            if (simulation.collisionExclusions?.has(`${left}:${right}`)) continue
            const delta = other.position.clone().sub(particle.position)
            const distanceSq = delta.lengthSq()
            if (distanceSq >= minSq) continue
            const distance = Math.sqrt(Math.max(distanceSq, EPSILON))
            const layerA = particle.layerIndex || 0
            const layerB = other.layerIndex || 0
            if (layerA !== layerB) {
              const higher = layerA > layerB ? particle : other
              const outward = outwardDirection(higher)
              // delta is A -> B. Orient the preferred vector so separation
              // always places the higher layer farther from the body.
              const preferred = layerB > layerA ? outward : outward.multiplyScalar(-1)
              if (distanceSq <= EPSILON) delta.copy(preferred)
              else {
                delta.multiplyScalar(1 / distance)
                if (delta.dot(preferred) < 0.65) delta.lerp(preferred, 0.82).normalize()
              }
            } else if (distanceSq <= EPSILON) delta.set(1, 0, 0)
            else delta.multiplyScalar(1 / distance)
            const penetration = minimumDistance - distance
            let wa = particle.invMass
            let wb = other.invMass
            const total = wa + wb
            if (total <= EPSILON) continue
            if (layerA !== layerB && wa > 0 && wb > 0) {
              // Collision layers are directional: higher layers are intended
              // to stay outside lower layers. Preserve a small reaction on the
              // lower cloth for stability, but send most correction outward.
              if (layerA > layerB) {
                wa = 0.9
                wb = 0.1
              } else {
                wa = 0.1
                wb = 0.9
              }
            }
            const weightedTotal = wa + wb
            if (wa > 0) addCorrection(particle, delta, -penetration * (wa / weightedTotal))
            if (wb > 0) addCorrection(other, delta, penetration * (wb / weightedTotal))
          }
        }
      }
    }
  }

  // Apply all pair corrections together. This avoids left/right bias from the
  // iteration order of the piece map and keeps mirrored garments much closer
  // to physically symmetric behavior.
  for (const particle of particles) {
    const correction = corrections.get(particle.simIndex)
    if (correction && particle.invMass > 0) particle.position.add(correction)
  }
}

