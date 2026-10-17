// Surface initial sewing defects before expensive PPF simulation. A collision-
// free initial pose with 30 cm side-seam gaps is NOT a preassembled garment.
export function analyzePpfStagingSeams(payload) {
  const vertices = payload?.shell?.vertices || []
  const groups = new Map()
  for (const edge of payload?.shell?.stitchEdges || []) {
    const a = vertices[edge.a], b = vertices[edge.b]
    if (!a || !b) continue
    const distanceCm = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100
    if (!Number.isFinite(distanceCm)) continue
    const id = edge.seamId || 'unnamed'
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(distanceCm)
  }
  const seams = [...groups].map(([id, distances]) => ({
    id, pairs: distances.length,
    meanGapCm: +(distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(3),
    maximumGapCm: +Math.max(...distances).toFixed(3),
  })).sort((a, b) => b.meanGapCm - a.meanGapCm)
  return {
    seamGroups: seams.length,
    maximumInitialSeamGapCm: Math.max(0, ...seams.map(x => x.maximumGapCm)),
    worstSeams: seams.slice(0, 5),
    nearAssembled: seams.length > 0 && seams.every(x => x.maximumGapCm <= 3),
    warning: seams.some(x => x.maximumGapCm > 10)
      ? 'Pattern panels start more than 10 cm apart at sewn edges. A contact-safe initial pose is not a preassembled garment; high sewing forces can still cause clipping or leave gaps.'
      : null,
  }
}
