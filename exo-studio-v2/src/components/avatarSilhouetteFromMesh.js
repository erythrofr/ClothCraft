/**
 * Project the *active* 3D fitting avatar into a filled orthographic SVG outline.
 * This is a visual reference drawn from the exact same triangles as the Rust
 * 3D viewport, never a separate fixed avatar, imported proprietary vector, or
 * body measurement. The geometry is unmodified; only the 2D mask is traced.
 *
 * The expensive projection runs only if the avatar mesh actually changes.
 */
const WIDTH = 640
const HEIGHT = 880
const PADDING = 28
const REFERENCE_HEIGHT_METRES = 1.75

const vector = p => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)

function simplify(points, tolerance = 1.35) {
  if (points.length <= 8) return points
  // Break the closed contour at a deterministic extreme; each open half can
  // then use Ramer-Douglas-Peucker without losing the narrow crotch contour.
  let first = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] < points[first][0] ||
      (points[i][0] === points[first][0] && points[i][1] < points[first][1])) first = i
  }
  const shifted = [...points.slice(first), ...points.slice(0, first)]
  let second = Math.floor(shifted.length / 2)
  let maxDistance = -1
  for (let i = 1; i < shifted.length; i++) {
    const dx = shifted[i][0] - shifted[0][0], dy = shifted[i][1] - shifted[0][1]
    const distance = dx * dx + dy * dy
    if (distance > maxDistance) {maxDistance = distance; second = i}
  }
  const openSimplify = seq => {
    const keep = new Uint8Array(seq.length)
    keep[0] = keep[seq.length - 1] = 1
    const stack = [[0, seq.length - 1]]
    while (stack.length) {
      const [a, b] = stack.pop()
      const [ax, ay] = seq[a], [bx, by] = seq[b]
      const dx = bx - ax, dy = by - ay, denom = dx * dx + dy * dy
      let farthest = -1, max = tolerance * tolerance
      for (let i = a + 1; i < b; i++) {
        const [px, py] = seq[i]
        const t = denom ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom)) : 0
        const ex = px - ax - t * dx, ey = py - ay - t * dy
        const d = ex * ex + ey * ey
        if (d > max) {max = d; farthest = i}
      }
      if (farthest >= 0) {keep[farthest] = 1; stack.push([a, farthest], [farthest, b])}
    }
    return seq.filter((_, i) => keep[i])
  }
  return [...openSimplify(shifted.slice(0, second + 1)).slice(0, -1),
    ...openSimplify([...shifted.slice(second), shifted[0]]).slice(0, -1)]
}

function contourLoops(mask, width, height) {
  // A directed pixel-edge boundary is robust to projected concavities and
  // preserves holes such as the opening between legs or a curved arm pose.
  const edges = []
  const starts = new Map()
  const index = (x, y) => y * (width + 1) + x
  const add = (x1, y1, x2, y2) => {
    const edge = {x1, y1, x2, y2, used:false}
    const at = index(x1, y1)
    if (!starts.has(at)) starts.set(at, [])
    starts.get(at).push(edge)
    edges.push(edge)
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!mask[y * width + x]) continue
    if (y === 0 || !mask[(y - 1) * width + x]) add(x, y, x + 1, y)
    if (x === width - 1 || !mask[y * width + x + 1]) add(x + 1, y, x + 1, y + 1)
    if (y === height - 1 || !mask[(y + 1) * width + x]) add(x + 1, y + 1, x, y + 1)
    if (x === 0 || !mask[y * width + x - 1]) add(x, y + 1, x, y)
  }
  const loops = []
  for (const edge of edges) {
    if (edge.used) continue
    const points = [], origin = index(edge.x1, edge.y1)
    let current = edge
    for (let steps = 0; steps < edges.length && current; steps++) {
      current.used = true
      points.push([current.x1, current.y1])
      const end = index(current.x2, current.y2)
      if (end === origin) break
      const next = (starts.get(end) || []).filter(e => !e.used)
      if (!next.length) {current = null; break}
      if (next.length === 1) {current = next[0]; continue}
      const dx = current.x2 - current.x1, dy = current.y2 - current.y1
      const turnScore = candidate => {
        const nx = candidate.x2 - candidate.x1, ny = candidate.y2 - candidate.y1
        const cross = dx * ny - dy * nx, dot = dx * nx + dy * ny
        return cross > 0 ? 0 : dot > 0 ? 1 : cross < 0 ? 2 : 3
      }
      current = next.sort((a, b) => turnScore(a) - turnScore(b))[0]
    }
    if (current && points.length > 8) {
      let signedArea = 0
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length]
        signedArea += a[0] * b[1] - b[0] * a[1]
      }
      if (Math.abs(signedArea) > 70) loops.push({points:simplify(points), area:signedArea / 2})
    }
  }
  return loops.sort((a, b) => Math.abs(b.area) - Math.abs(a.area)).slice(0, 32)
}

export function projectAvatarSilhouette(avatar) {
  const positions = avatar?.positions, triangles = avatar?.triangles
  if (!Array.isArray(positions) || positions.length < 3 || !Array.isArray(triangles) || !triangles.length || typeof document === 'undefined') return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of positions) {
    if (!vector(p)) continue
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
  }
  const height = maxY - minY, width = maxX - minX
  if (!(height > .1 && height < 10 && width > .02 && width < 10)) return null
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH; canvas.height = HEIGHT
  const ctx = canvas.getContext('2d', {willReadFrequently:true})
  if (!ctx) return null
  const pixelsPerMetre = Math.min((HEIGHT - PADDING * 2) / height, (WIDTH - PADDING * 2) / width)
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2
  const xy = i => {
    const p = positions[i]
    return [(p[0] - centerX) * pixelsPerMetre + WIDTH / 2,
      (centerY - p[1]) * pixelsPerMetre + HEIGHT / 2]
  }
  ctx.fillStyle = '#000'
  ctx.beginPath()
  let used = 0
  // Force all faces to the same 2D winding. A single nonzero fill then
  // produces the geometric union, not alternate cancellation of front/back.
  for (const face of triangles) {
    if (!Array.isArray(face) || face.length < 3 || face.some(i => !Number.isInteger(i) || i < 0 || i >= positions.length || !vector(positions[i]))) continue
    const a = xy(face[0]), b = xy(face[1]), c = xy(face[2])
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if (Math.abs(cross) < 1e-6) continue
    ctx.moveTo(...a)
    if (cross > 0) {ctx.lineTo(...b);ctx.lineTo(...c)}
    else {ctx.lineTo(...c);ctx.lineTo(...b)}
    ctx.closePath()
    used++
  }
  if (!used) return null
  ctx.fill('nonzero')
  const rgba = ctx.getImageData(0, 0, WIDTH, HEIGHT).data
  const mask = new Uint8Array(WIDTH * HEIGHT)
  for (let i = 0; i < mask.length; i++) mask[i] = +(rgba[i * 4 + 3] > 90)
  const loops = contourLoops(mask, WIDTH, HEIGHT)
  if (!loops.length) return null
  // Normalise the display height only. The x:y proportion comes from the 3D
  // avatar itself, so switching to a larger/thinner/posed mesh changes shape.
  const normalizedScale = REFERENCE_HEIGHT_METRES / height / pixelsPerMetre
  const map = value => (Math.round(value * 10000) / 10000).toString()
  const contours = loops.map(({points}) => points.map(([x, y], i) =>
    `${i ? 'L' : 'M'}${map((x - WIDTH / 2) * normalizedScale)} ${map((y - HEIGHT / 2) * normalizedScale)}`).join(' ') + ' Z')
  return {d:contours.join(' '), heightMetres:REFERENCE_HEIGHT_METRES,
    sourceVertices:positions.length, sourceFaces:triangles.length, contourCount:contours.length}
}
