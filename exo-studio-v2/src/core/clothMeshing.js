// A production drafting curve and an XPBD triangle mesh are different data.
// Dense imported CLO ASTM cutlines may contain sub-millimeter polygon edges,
// which generate badly conditioned PBD structural constraints if triangulated
// directly. Simplify only a COPY used by the physics tessellator; preserve
// every original source pattern point and fractional sewing relationship.

function squaredDistanceToSegment(point, start, end) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = dx * dx + dy * dy
  const t = len > 1e-15 ? Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / len)) : 0
  const rx = point.x - (start.x + dx * t)
  const ry = point.y - (start.y + dy * t)
  return rx * rx + ry * ry
}

function reduceChain(points, minIndex, maxIndex, toleranceSquared, selected) {
  if (maxIndex - minIndex <= 1) return
  let maxError = -1, splitIndex = -1
  const start = points[minIndex], end = points[maxIndex]
  for (let index = minIndex + 1; index < maxIndex; index++) {
    const error = squaredDistanceToSegment(points[index], start, end)
    if (error > maxError) { maxError = error; splitIndex = index }
  }
  if (maxError <= toleranceSquared || splitIndex < 0) return
  selected.add(splitIndex)
  reduceChain(points, minIndex, splitIndex, toleranceSquared, selected)
  reduceChain(points, splitIndex, maxIndex, toleranceSquared, selected)
}

function areaOfPolygon(points) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    sum += a.x * b.y - a.y * b.x
  }
  return Math.abs(sum) * 0.5
}

export function simplifiedClothBoundary(source = [], toleranceCm = 0.08) {
  if (source.length < 32 || !Number.isFinite(toleranceCm) || toleranceCm <= 0) return [...source]
  const n = source.length
  // Split a closed contour at two distant source vertices. This avoids
  // treating the closure as a degenerate start=end Ramer–Douglas–Peucker path.
  let first = 0
  for (let i = 1; i < n; i++) {
    if (source[i].x < source[first].x ||
      (source[i].x === source[first].x && source[i].y < source[first].y)) first = i
  }
  let second = first, farthest = -1
  for (let i = 0; i < n; i++) {
    const delta = (source[i].x - source[first].x) ** 2 + (source[i].y - source[first].y) ** 2
    if (delta > farthest) { second = i; farthest = delta }
  }
  const rotated = Array.from({ length: n + 1 }, (_, index) => source[(first + index) % n])
  const split = (second - first + n) % n
  if (split === 0) return [...source]
  const selected = new Set([0, split, n])
  const toleranceSquared = toleranceCm * toleranceCm
  reduceChain(rotated, 0, split, toleranceSquared, selected)
  reduceChain(rotated, split, n, toleranceSquared, selected)
  const simplified = [...selected].sort((a, b) => a - b).filter((i) => i !== n).map((i) => rotated[i])
  if (simplified.length < 3) return [...source]
  const beforeArea = areaOfPolygon(source)
  const afterArea = areaOfPolygon(simplified)
  // Never silently change manufacturing geometry by producing a drastically
  // different physical rest area. Complex cutline geometry gets the original
  // mesh instead if simplification violates this conservative bound.
  if (beforeArea > 1e-6 && Math.abs(beforeArea - afterArea) / beforeArea > 0.005) return [...source]
  return simplified
}

export function measureClothBoundaryDeviation(source, simplified) {
  let peak = 0
  for (const point of source) {
    let best = Infinity
    for (let j = 0; j < simplified.length; j++) {
      const error = squaredDistanceToSegment(point, simplified[j], simplified[(j + 1) % simplified.length])
      best = Math.min(best, error)
    }
    peak = Math.max(peak, Math.sqrt(best))
  }
  return peak
}
