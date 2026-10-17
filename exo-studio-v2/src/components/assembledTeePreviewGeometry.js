import * as THREE from 'three'
import { samplePieceBoundary } from '../core/project.js'
import { addPatternThread, garmentPreviewPose, inwardOffsetEdge, makePanelGeometry } from '../core/garmentPreviewGeometry.js'

// Art-directed assembly preview: torso surfaces follow the source pattern's
// exact curved boundaries and sewing metadata. Folded sleeve tubes are a
// dimensional illustration derived from the source sleeve length/cuff edge.
// Neither placement nor tension is a cloth-simulation result.
export function buildAssembledTee(project, fabric, resources) {
  const group = new THREE.Group()
  const sourcePieces = project.pieces || []
  const seamEdges = new Map()
  for (const seam of project.seams || []) {
    for (const endpoint of [seam.a, seam.b]) {
      if (!endpoint?.pieceId || !Number.isInteger(endpoint.edgeIndex)) continue
      if (!seamEdges.has(endpoint.pieceId)) seamEdges.set(endpoint.pieceId, new Set())
      seamEdges.get(endpoint.pieceId).add(endpoint.edgeIndex)
    }
  }

  for (const id of ['back', 'front']) {
    const piece = sourcePieces.find(entry => entry.id === id)
    if (!piece) continue
    const pose = garmentPreviewPose(piece, 'tee', id === 'front' ? 0 : 1, sourcePieces.length)
    const panel = makePanelGeometry(piece, pose, resources)
    if (!panel) continue
    const surface = new THREE.Mesh(panel.geometry, fabric)
    surface.name = id + '-true-source-panel'
    surface.userData.sourcePieceId = piece.id
    group.add(surface)

    const hemEdge = new THREE.MeshStandardMaterial({ color: '#a0a3a1', roughness: 1, side: THREE.DoubleSide })
    resources.push(hemEdge)
    const thickness = new THREE.Mesh(panel.edgeGeometry, hemEdge)
    thickness.name = id + '-fabric-thickness'
    group.add(thickness)

    addPatternThread(group, [...panel.boundary.points, panel.boundary.points[0]], pose, resources, {
      layer: 'edges', color: '#777a75', radius: .0029, lift: .018,
    })
    for (const edgeIndex of seamEdges.get(piece.id) || []) {
      addPatternThread(group, inwardOffsetEdge(piece, edgeIndex, .65), pose, resources, {
        layer: 'sewing', color: '#a5a7a2', radius: .0032, dashed: true, lift: .025,
      })
    }
    for (const stitch of piece.topstitches || []) {
      const count = Math.max(1, Math.min(3, stitch.rows || 1))
      for (let row = 0; row < count; row += 1) {
        addPatternThread(group, inwardOffsetEdge(piece, stitch.edgeIndex, Number(stitch.offsetCm || .7) + row * Number(stitch.rowGapCm || .45)), pose, resources, {
          layer: 'sewing', color: '#a8a9a5', radius: .0037, lift: .029,
        })
      }
    }
    for (const edge of [9, 10, 11]) {
      addPatternThread(group, inwardOffsetEdge(piece, edge, .35), pose, resources, {
        layer: 'style', color: '#afb4af', radius: .010, lift: .02,
      })
    }
  }

  const cuffThread = new THREE.MeshStandardMaterial({ color: '#9fa29e', roughness: .92, metalness: 0 })
  resources.push(cuffThread)
  // Lay the binding directly along the sampled source neck edges. It bends
  // naturally through the shoulder joins and preserves the different front
  // and back neck depths; it is a sewn-shape illustration, not cloth dynamics.
  const front = sourcePieces.find(piece => piece.id === 'front')
  const back = sourcePieces.find(piece => piece.id === 'back')
  if (front && back) {
    const path = []
    for (const piece of [front, back]) {
      const pose = garmentPreviewPose(piece, 'tee', piece.id === 'front' ? 0 : 1, sourcePieces.length)
      const sampled = samplePieceBoundary(piece, 12)
      const neck = [9, 10, 11].flatMap(index => sampled.edgePaths[index] || [])
      for (const point of neck) {
        const p = pose(point)
        // Put the binding just above the painted source edge, without closing
        // the neck hole with a flat or circular disc.
        p.z += piece.id === 'front' ? .017 : -.017
        if (!path.some(q => q.distanceToSquared(p) < .00002)) path.push(p)
      }
    }
    // The recorded edge order on front/back is not guaranteed to be a single
    // winding. Sort around the neck aperture to avoid crossing binding loops.
    const center = path.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(path.length, 1))
    path.sort((a, b) => Math.atan2(a.z - center.z, a.x - center.x) - Math.atan2(b.z - center.z, b.x - center.x))
    const collarGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path, true, 'centripetal'), 120, .028, 10, true)
    resources.push(collarGeometry)
    const collar = new THREE.Mesh(collarGeometry, fabric)
    collar.name = 'rounded-rib-collar'
    group.add(collar)
  }
  for (const side of [-1, 1]) {
    const piece = sourcePieces.find(entry => entry.id === (side < 0 ? 'sleeve-left' : 'sleeve-right'))
    if (!piece) continue
    const boundary = samplePieceBoundary(piece, 10)
    const cuffEdge = piece.topstitches?.find(item => /cuff/i.test(item.id || ''))?.edgeIndex ?? 3
    const cuffPoints = boundary.edgePaths[cuffEdge] || []
    const cuffLengthCm = cuffPoints.slice(1).reduce((sum, point, i) => {
      const prev = cuffPoints[i]
      return sum + Math.hypot(point.x - prev.x, point.y - prev.y)
    }, 0)
    const lengthCm = Math.max(...piece.points.map(p => p.y)) - Math.min(...piece.points.map(p => p.y))
    const cuffRadius = Math.max(.13, cuffLengthCm * .035 / (2 * Math.PI))
    const length = Math.max(.57, lengthCm * .030)
    const radialSegments = 48, axialSegments = 26
    const positions = [], indices = [], uvs = []
    // Both front and back shell edges lie near x=0.7 at the shoulder. A tall,
    // shallow proximal armhole opening runs from shoulder to underarm; it
    // contracts into the drafted cuff circumference over the sleeve length.
    // This single loft replaces the detached cylinder and overlapping tube.
    const startX = .695, startY = .86
    for (let row = 0; row <= axialSegments; row++) {
      const t = row / axialSegments
      const smooth = t * t * (3 - 2 * t)
      const centerX = startX + length * t * .92
      const centerY = startY - .30 * smooth
      const verticalRadius = THREE.MathUtils.lerp(.405, cuffRadius * .84, smooth)
      const depthRadius = THREE.MathUtils.lerp(.255, cuffRadius * 1.06, smooth)
      for (let k = 0; k <= radialSegments; k++) {
        const phi = k / radialSegments * Math.PI * 2
        const c = Math.cos(phi), s = Math.sin(phi)
        const wrinkle = .008 * Math.sin(phi * 5 + t * 11) * Math.sin(Math.PI * t)
        const x = side * (centerX + (1 - t) * .055 * c)
        const y = centerY + (verticalRadius + wrinkle) * c
        const z = (depthRadius + wrinkle) * s
        positions.push(x, y, z)
        uvs.push(k / radialSegments, t)
        if (row < axialSegments && k < radialSegments) {
          const a = row * (radialSegments + 1) + k
          indices.push(a, a + radialSegments + 1, a + 1, a + 1, a + radialSegments + 1, a + radialSegments + 2)
        }
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const sleeve = new THREE.Mesh(geometry, fabric)
    sleeve.name = (side < 0 ? 'left' : 'right') + '-folded-source-dimension-sleeve'
    sleeve.userData.sourcePieceId = piece.id
    group.add(sleeve)
    resources.push(geometry)

    // Cuff topstitch rows sit inside the open cylindrical hem, measured from
    // the drafted cuff stitch offsets and row gap; no disconnected torus.
    const stitch = piece.topstitches?.find(item => item.edgeIndex === cuffEdge)
    for (let row = 0; row < Math.max(1, stitch?.rows || 1); row += 1) {
      const inwardCm = Number(stitch?.offsetCm || 1.8) + row * Number(stitch?.rowGapCm || .45)
      const x = startX + length * .92 - inwardCm * .030
      const y = startY - .30
      const ringGeometry = new THREE.TorusGeometry(cuffRadius * .95, .004, 5, 64)
      resources.push(ringGeometry)
      const ring = new THREE.Mesh(ringGeometry, cuffThread)
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(side, 0, 0))
      ring.position.set(side * x, y, 0)
      ring.userData.previewLayer = 'sewing'
      group.add(ring)
    }
  }
  return group
}
