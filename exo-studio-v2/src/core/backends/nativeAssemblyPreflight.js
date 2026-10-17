// Inspect the pose *before* the native XPBD solver begins. A valid flat sewing
// pattern does not guarantee sewable 3D starting placement: 18+ cm apart
// shoulder pairings force enormous discontinuous corrections in frame 1.
// All distances here are meters in payload; reports use millimeters/percent.
const finiteVec3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
const edgeKey = (a,b) => a<b ? `${a}:${b}` : `${b}:${a}`

export function inspectNativeAssemblyPose(payload, {
  maximumInitialSeamGapMm = 30,
  maximumInitialEdgeStrainPercent = 20,
} = {}) {
  if (!payload?.particles || !payload?.pieces || !payload?.constraints) throw new TypeError('Native assembly payload is incomplete')
  for (const particle of payload.particles) {
    if (!finiteVec3(particle.position)) throw new RangeError(`Invalid initial particle ${particle.id}`)
  }
  const groups = new Map()
  let maximumInitialSeamGapMmMeasured = 0
  let totalSeamGap = 0
  let seamSamples = 0
  for (const constraint of payload.constraints) {
    if (constraint.type !== 'seam') continue
    const a = payload.particles[constraint.a], b = payload.particles[constraint.b]
    if (!a || !b) throw new RangeError('Native sewing constraint references unknown particle')
    const gapMm = distance(a.position,b.position) * 1000
    const key = constraint.seamId || 'unnamed-seam'
    if (!groups.has(key)) groups.set(key, {seamId:key,items:0,total:0,maximumGapMm:0,pieceIds:new Set()})
    const group = groups.get(key)
    group.items++
    group.total += gapMm
    group.maximumGapMm=Math.max(group.maximumGapMm,gapMm)
    group.pieceIds.add(a.pieceId)
    group.pieceIds.add(b.pieceId)
    maximumInitialSeamGapMmMeasured=Math.max(maximumInitialSeamGapMmMeasured,gapMm)
    totalSeamGap+=gapMm
    seamSamples++
  }
  // Free Sewing is represented by two weighted cutline anchors, not the
  // nearest mesh vertices. The staging quality report must use those same
  // physical anchors or it will falsely report that no seams exist.
  for (const virtual of payload.virtualSeams || []) {
    const weighted = (indices, weights) => {
      const point = [0, 0, 0]
      for (let i = 0; i < indices.length; i++) {
        const vertex = payload.particles[indices[i]]?.position
        if (!finiteVec3(vertex)) throw new RangeError('Invalid virtual sewing particle position')
        for (let axis = 0; axis < 3; axis++) point[axis] += vertex[axis] * weights[i]
      }
      return point
    }
    const a = weighted(virtual.sourceIndices, virtual.sourceWeights)
    const b = weighted(virtual.targetIndices, virtual.targetWeights)
    const gapMm = distance(a, b) * 1000
    const key = virtual.seamId || 'unnamed-free-seam'
    if (!groups.has(key)) groups.set(key, {seamId:key,items:0,total:0,maximumGapMm:0,pieceIds:new Set()})
    const group = groups.get(key)
    group.items++
    group.total += gapMm
    group.maximumGapMm = Math.max(group.maximumGapMm, gapMm)
    group.pieceIds.add(payload.particles[virtual.sourceIndices[0]]?.pieceId)
    group.pieceIds.add(payload.particles[virtual.targetIndices[0]]?.pieceId)
    maximumInitialSeamGapMmMeasured = Math.max(maximumInitialSeamGapMmMeasured, gapMm)
    totalSeamGap += gapMm
    seamSamples++
  }
  const sewnGroups=[...groups.values()].map(group=>({
    seamId:group.seamId,
    samples:group.items,
    maximumGapMm:+group.maximumGapMm.toFixed(2),
    averageGapMm:+(group.total/group.items).toFixed(2),
    pieceIds:[...group.pieceIds].sort(),
  })).sort((a,b)=>b.maximumGapMm-a.maximumGapMm)
  let highestInitialStrain=0, worstEdge=null, edgeSamples=0
  const seen=new Set()
  for (const piece of payload.pieces) {
    const particles=piece.particleIndices || [], vertices=piece.flatVerticesM || []
    for (const face of piece.faces || []) {
      for(let n=0;n<3;n++) {
        const ia=face[n],ib=face[(n+1)%3]
        const pa=particles[ia],pb=particles[ib],va=vertices[ia],vb=vertices[ib]
        if (!Number.isInteger(pa) || !Number.isInteger(pb) || !finiteVec3(va) || !finiteVec3(vb)) throw new RangeError('Invalid native mesh edge')
        const k=edgeKey(pa,pb)
        if(seen.has(k))continue
        seen.add(k)
        const rest=distance(va,vb)
        if(rest<=1e-8)continue
        const world=distance(payload.particles[pa].position,payload.particles[pb].position)
        const strain=Math.abs(world-rest)/rest*100
        edgeSamples++
        if(strain>highestInitialStrain) {
          highestInitialStrain=strain
          worstEdge={pieceId:piece.id,particleA:payload.particles[pa].id,particleB:payload.particles[pb].id,
            restLengthMm:+(rest*1000).toFixed(2),startLengthMm:+(world*1000).toFixed(2)}
        }
      }
    }
  }
  const reasons=[]
  if(maximumInitialSeamGapMmMeasured>maximumInitialSeamGapMm)reasons.push('sewing-boundaries-too-far-apart')
  if(highestInitialStrain>maximumInitialEdgeStrainPercent)reasons.push('initial-mesh-distorted-relative-to-flat-pattern')
  return {
    status:reasons.length ? 'STAGING_REQUIRES_REPAIR' : 'GEOMETRIC_PRECHECK_PASS',
    simulationFitApproved:false,
    reasons,
    pairCount:seamSamples,
    totalRestEdges:edgeSamples,
    initialSeamGapMaximumMm:+maximumInitialSeamGapMmMeasured.toFixed(2),
    initialSeamGapAverageMm:seamSamples ? +(totalSeamGap/seamSamples).toFixed(2) : 0,
    initialMeshPeakEdgeStrainPercent:+highestInitialStrain.toFixed(2),
    worstEdge,
    worstSewingGroups:sewnGroups.slice(0,10),
    thresholds:{maximumInitialSeamGapMm,maximumInitialEdgeStrainPercent},
  }
}
