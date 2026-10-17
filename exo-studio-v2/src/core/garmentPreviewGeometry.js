import * as THREE from 'three'
import { samplePieceBoundary } from './project.js'

// Source drafting is the authority for panel contours, curves, edge numbers and topstitches.
// The pose is a deterministic illustration of sewing orientation; it is not a physics solve.
export function garmentPreviewPose(piece, templateId, panelIndex, total) {
  if (templateId === 'tee-exploded') {
    // IMG_6936: unsewn panels arranged around a torso volume, not a flat grid.
    // Preserve source contours; this is a read-only arrangement illustration.
    if (piece.id === 'front' || piece.id === 'back') {
      const front = piece.id === 'front'
      return point => {
        const angle = point.x / 27.5 * 1.02
        return new THREE.Vector3(
          .98 * Math.sin(angle), (point.y - 35.5) * .0355,
          (front ? 1 : -1) * (.21 + .27 * Math.cos(angle))
        )
      }
    }
    if (piece.id.startsWith('sleeve-')) {
      const side = piece.id.endsWith('left') ? -1 : 1
      return point => {
        const run = (25 - point.y) * .030
        const angle = point.x / 17.25 * 2.05
        const radius = .28
        return new THREE.Vector3(
          side * (1.00 + run * .83),
          .64 - run * .48 + radius * Math.cos(angle),
          radius * Math.sin(angle)
        )
      }
    }
  }
  if (templateId === 'tee') {
    if (piece.id === 'front' || piece.id === 'back') {
      const front = piece.id === 'front'
      return point => {
        const x = point.x * .0315
        const profile = Math.sqrt(Math.max(.015, 1 - Math.pow(Math.min(Math.abs(point.x) / 27.5, .993), 2)))
        const tension = .009 * Math.sin(point.y * .20 + point.x * .34) * profile
        const underarmFold = .022 * Math.sin(point.y * .17 + point.x * .06) * Math.exp(-Math.pow((Math.abs(point.x) - 22) / 6, 2))
        return new THREE.Vector3(x, (point.y - 35.5) * .035 + tension, (front ? 1 : -1) * (.36 * profile + underarmFold + .014 * Math.sin(point.y * .095 + point.x * .3)))
      }
    }
    if (piece.id.startsWith('sleeve-')) {
      const left = piece.id.endsWith('left')
      const side = left ? -1 : 1
      return point => {
        const length = Math.max(0, 25 - point.y)
        const cross = point.x / 17.25
        const crown = Math.sqrt(Math.max(.012, 1 - cross * cross * .93))
        return new THREE.Vector3(side * (.695 + length * .032 + Math.abs(cross) * .036), .81 + point.x * .018 - length * .013, .23 * crown + .01 * Math.sin(length * .4 + point.x * .2))
      }
    }
  }
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(total))))
  const rows = Math.ceil(total / columns)
  const column = panelIndex % columns
  const row = Math.floor(panelIndex / columns)
  const bounds = samplePieceBoundary(piece, 7).points
  const minX = Math.min(...bounds.map(p => p.x))
  const maxX = Math.max(...bounds.map(p => p.x))
  const minY = Math.min(...bounds.map(p => p.y))
  const maxY = Math.max(...bounds.map(p => p.y))
  const extent = Math.max(maxX - minX, maxY - minY, 30)
  const scale = 1.28 / extent
  return point => {
    const x = (point.x - (minX + maxX) / 2) * scale
    const y = (point.y - (minY + maxY) / 2) * scale
    const profile = .28 * (1 - Math.pow(Math.min(1, Math.abs(x) / .72), 2))
    return new THREE.Vector3((column - (columns - 1) / 2) * 1.48 + x, ((rows - 1) / 2 - row) * 1.55 + y, profile + Math.sin(y * 3.7 + panelIndex) * .018 + column * -.035)
  }
}

// Differential of the authored presentation pose. A world-Z offset opens
// visible gaps on rolled sleeves and in oblique triptych views; derive both
// surface lighting and the illustrative edge ribbon from the same normal.
export function posedPanelNormal(point, transform) {
  const step = .04
  const world = transform(point)
  const dx = transform({ x: point.x + step, y: point.y }).sub(world)
  const dy = transform({ x: point.x, y: point.y + step }).sub(world)
  const normal = dx.cross(dy)
  return normal.lengthSq() > 1e-16 ? normal.normalize() : new THREE.Vector3(0, 0, 1)
}

function pushTriangle(arrays, a, b, c, transform, facing) {
  for (const point of [a, b, c]) {
    const world = transform(point)
    const normal = posedPanelNormal(point, transform)
    // Keep the differential normal continuous around rolled sleeves.
    // DoubleSide handles back faces; flipping by world-Z creates a lighting seam.
    arrays.positions.push(world.x, world.y, world.z)
    arrays.normals.push(normal.x, normal.y, normal.z)
    arrays.uvs.push(point.x * .071, point.y * .071)
  }
}

export function makePanelGeometry(piece, transform, resources) {
  const boundary = samplePieceBoundary(piece, 9)
  if (boundary.points.length < 3) return null
  const contour = boundary.points.map(p => new THREE.Vector2(p.x, p.y))
  const triangles = THREE.ShapeUtils.triangulateShape(contour, [])
  const arrays = { positions: [], normals: [], uvs: [] }
  const facing = piece.id === 'back' || piece.id.endsWith('-back') ? -1 : 1
  for (const tri of triangles) {
    const [a, b, c] = tri.map(index => boundary.points[index])
    const longest = Math.max(Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(b.x - c.x, b.y - c.y), Math.hypot(c.x - a.x, c.y - a.y))
    // Hover previews run alongside the full garment viewport. Six levels keep
    // curved panel shading while avoiding quadratic triangle growth in the
    // lightweight library viewer.
    const steps = Math.max(3, Math.min(6, Math.ceil(longest / 4)))
    const rows = []
    for (let j = 0; j <= steps; j += 1) {
      const row = []
      for (let i = 0; i <= steps - j; i += 1) {
        const wa = i / steps, wb = j / steps
        row.push({ x: a.x + (b.x - a.x) * wa + (c.x - a.x) * wb, y: a.y + (b.y - a.y) * wa + (c.y - a.y) * wb })
      }
      rows.push(row)
    }
    for (let j = 0; j < steps; j += 1) {
      for (let i = 0; i < steps - j; i += 1) {
        pushTriangle(arrays, rows[j][i], rows[j][i + 1], rows[j + 1][i], transform, facing)
        if (i < steps - j - 1) pushTriangle(arrays, rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i], transform, facing)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arrays.positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uvs, 2))
  geometry.computeBoundingSphere()
  resources.push(geometry)
  // Presentation-only thickness follows the curved surface normal at each
  // authored boundary point. This .012m-looking offset is not a solver value
  // or a certified physical textile thickness.
  const sidePositions = []
  for (let i = 0; i < boundary.points.length; i += 1) {
    const firstPoint = boundary.points[i], secondPoint = boundary.points[(i + 1) % boundary.points.length]
    const first = transform(firstPoint), second = transform(secondPoint)
    const a = first.clone().addScaledVector(posedPanelNormal(firstPoint, transform), -.012)
    const b = second.clone().addScaledVector(posedPanelNormal(secondPoint, transform), -.012)
    for (const v of [first, second, a, second, b, a]) sidePositions.push(v.x, v.y, v.z)
  }
  const edgeGeometry = new THREE.BufferGeometry()
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3))
  edgeGeometry.computeVertexNormals()
  resources.push(edgeGeometry)
  return { geometry, edgeGeometry, boundary, triangles: arrays.positions.length / 9 }
}

export function inwardOffsetEdge(piece, edgeIndex, offsetCm = .75) {
  const { points, edgePaths } = samplePieceBoundary(piece, 9)
  const edge = edgePaths[edgeIndex] || []
  if (edge.length < 2) return []
  const signedArea = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]
    return sum + p.x * next.y - p.y * next.x
  }, 0)
  const sign = signedArea >= 0 ? 1 : -1
  return edge.map((point, i) => {
    const a = edge[Math.max(0, i - 1)]
    const b = edge[Math.min(edge.length - 1, i + 1)]
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: point.x - sign * (b.y - a.y) / length * offsetCm, y: point.y + sign * (b.x - a.x) / length * offsetCm }
  })
}

export function addPatternThread(parent, points, pose, resources, { radius = .0035, color = '#838a8b', layer = 'sewing', dashed = false, lift = .008 } = {}) {
  if (points?.length < 2) return
  const dense = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y) / 1.2))
    for (let j = 0; j < steps; j++) dense.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps})
  }
  dense.push(points[points.length-1])
  const source = dense.map(point => {
    const p = pose(point)
    p.z += p.z >= 0 ? lift : -lift
    return p
  })
  if (dashed) {
    const vertices = []
    for (let i = 1; i < source.length; i += 1) {
      if (i % 3 === 0) continue
      vertices.push(...source[i - 1].toArray(), ...source[i].toArray())
    }
    if (!vertices.length) return
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    const material = new THREE.LineBasicMaterial({ color })
    resources.push(geometry, material)
    const line = new THREE.LineSegments(geometry, material)
    line.userData.previewLayer = layer
    parent.add(line)
    return
  }
  // A single continuous tubular stitch per source edge avoids hundreds of WebGL
  // draw calls in the hover, while keeping the line conformed to the panel.
  const curve = new THREE.CurvePath()
  for (let i = 1; i < source.length; i++) curve.add(new THREE.LineCurve3(source[i-1], source[i]))
  const geometry = new THREE.TubeGeometry(curve, Math.min(96, Math.max(8, source.length * 2)), radius, 3, false)
  const material = new THREE.MeshStandardMaterial({ color, roughness: .97, metalness: 0 })
  resources.push(geometry, material)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.previewLayer = layer
  parent.add(mesh)
}

export function createKnitTextures(resources) {
  const albedo = document.createElement('canvas')
  const relief = document.createElement('canvas')
  albedo.width = relief.width = albedo.height = relief.height = 384
  const colorContext = albedo.getContext('2d')
  const reliefContext = relief.getContext('2d')
  colorContext.fillStyle = '#e0dfdc'
  colorContext.fillRect(0, 0, 384, 384)
  reliefContext.fillStyle = '#777777'
  reliefContext.fillRect(0, 0, 384, 384)
  // Interlocking jersey courses: tonal yarn shadow plus shallow knit relief.
  for (let y = -6; y <= 390; y += 6) {
    for (let x = -6; x <= 390; x += 7) {
      const stagger = Math.floor(y / 6) % 2 ? 3.5 : 0
      const noise = (Math.sin(x * 15.219 + y * 31.127) * 42345.123) % 1
      const luminance = 214 + Math.round(noise * 5)
      colorContext.strokeStyle = 'rgb(' + luminance + ',' + (luminance - 1) + ',' + (luminance - 3) + ')'
      colorContext.lineWidth = 1.2
      colorContext.beginPath()
      colorContext.moveTo(x + stagger - 2, y)
      colorContext.quadraticCurveTo(x + stagger, y + 6.3, x + stagger + 2, y)
      colorContext.stroke()
      reliefContext.strokeStyle = '#a9a9a9'
      reliefContext.lineWidth = 2.2
      reliefContext.beginPath()
      reliefContext.moveTo(x + stagger - 2, y)
      reliefContext.quadraticCurveTo(x + stagger, y + 5.8, x + stagger + 2, y)
      reliefContext.stroke()
    }
  }
  const map = new THREE.CanvasTexture(albedo)
  const bumpMap = new THREE.CanvasTexture(relief)
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 8
    resources.push(texture)
  }
  map.colorSpace = THREE.SRGBColorSpace
  return { map, bumpMap }
}
