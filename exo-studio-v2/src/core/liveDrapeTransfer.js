// Transfer the previous simulated drape to a remeshed pattern by nearest
// pattern-space vertex. Limit movement to avoid injecting unstable contact
// impulses when a user makes a large 2D edit.
export function captureDrape(simulation) {
  if (!simulation?.pieces) return null
  const result = new Map()
  for (const [id, piece] of simulation.pieces) {
    if (!piece.flatVertices?.length || !piece.particles?.length) continue
    const vertices = piece.flatVertices.map((flat, index) => ({
      x: flat.x, y: flat.y,
      position: { ...piece.particles[index].position },
    }))
    result.set(id, { vertices, faces: (piece.faces || []).map(face => [...face]) })
  }
  return result
}

export function transferDrape(snapshot, simulation, maxOffsetM = 0.035, validate = null) {
  if (!snapshot || !simulation?.pieces) return { transferred: 0, skipped: 0 }
  let transferred = 0, skipped = 0, interpolated = 0, nearest = 0
  for (const [id, piece] of simulation.pieces) {
    const previous = snapshot.get(id)
    const old = previous?.vertices
    if (!old?.length || !piece.flatVertices?.length) { skipped++; continue }
    const triangles = (previous.faces || []).map(([a,b,c]) => [old[a],old[b],old[c]]).filter(tri => tri.every(Boolean))
    for (let i = 0; i < piece.flatVertices.length; i++) {
      const point = piece.flatVertices[i]
      let best = null, bestD = Infinity
      // Interpolate inside the original pattern-space triangle so new mesh
      // vertices inherit a smooth 3D drape instead of snapping to a neighbor.
      for (const [a,b,c] of triangles) {
        const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y)
        if (Math.abs(denominator)<1e-9) continue
        const u=((b.y-c.y)*(point.x-c.x)+(c.x-b.x)*(point.y-c.y))/denominator
        const v=((c.y-a.y)*(point.x-c.x)+(a.x-c.x)*(point.y-c.y))/denominator
        const w=1-u-v
        if (Math.min(u,v,w)<-1e-5) continue
        best={position:{x:u*a.position.x+v*b.position.x+w*c.position.x,
          y:u*a.position.y+v*b.position.y+w*c.position.y,
          z:u*a.position.z+v*b.position.z+w*c.position.z}}
        interpolated++
        break
      }
      if (!best) {
      for (const candidate of old) {
        const d = (candidate.x-point.x)**2 + (candidate.y-point.y)**2
        if (d < bestD) { bestD = d; best = candidate }
      }
      nearest++
      }
      const particle = piece.particles[i]
      if (!best || !particle) continue
      const dx = best.position.x-particle.position.x
      const dy = best.position.y-particle.position.y
      const dz = best.position.z-particle.position.z
      const distance = Math.hypot(dx,dy,dz)
      const factor = distance > maxOffsetM ? maxOffsetM/distance : 1
      const original = { x: particle.position.x, y: particle.position.y, z: particle.position.z }
      particle.position.x += dx*factor
      particle.position.y += dy*factor
      particle.position.z += dz*factor
      if (validate && !validate(particle, original)) {
        particle.position.x = original.x
        particle.position.y = original.y
        particle.position.z = original.z
        skipped++
        continue
      }
      if (typeof particle.previous?.copy === 'function') particle.previous.copy(particle.position)
      else particle.previous = { ...particle.position }
      transferred++
    }
  }
  return { transferred, skipped, interpolated, nearest }
}

// Assess paired seam vertices before/after a tentative transfer. Callers can
// roll back the transfer if the new pose separates an already sewn seam.
export function measureSeamGap(simulation) {
  let maximumMm = 0
  let sumMm = 0
  let count = 0
  for (const seam of simulation?.seamConstraints || []) {
    const a=seam?.a?.position, b=seam?.b?.position
    if (!a || !b) continue
    const gap = Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)*1000
    if (!Number.isFinite(gap)) continue
    maximumMm = Math.max(maximumMm,gap)
    sumMm += gap
    count++
  }
  return { pairs: count, maxMm: maximumMm, meanMm: count ? sumMm/count : 0 }
}

export function captureParticlePositions(simulation) {
  return [...(simulation?.pieces?.values() || [])].map(piece => ({
    piece, points: piece.particles.map(particle => ({ ...particle.position })),
  }))
}

export function restoreParticlePositions(snapshot) {
  for (const { piece, points } of snapshot) {
    piece.particles.forEach((particle,index) => {
      const previous = points[index]
      if (!previous) return
      particle.position.set?.(previous.x,previous.y,previous.z)
      if (typeof particle.position.set !== 'function') Object.assign(particle.position,previous)
      if (typeof particle.previous?.copy === 'function') particle.previous.copy(particle.position)
      else particle.previous = { ...previous }
    })
  }
}
