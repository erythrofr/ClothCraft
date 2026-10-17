import { edgeLength, edgePointAt, getEdgeSeamAllowance, samplePieceBoundary, seamAllowanceBoundary } from './project.js'

function entityLine(layer, a, b) {
  return [
    '0', 'LINE',
    '8', layer,
    '10', String(a.x * 10),
    '20', String(a.y * 10),
    '30', '0',
    '11', String(b.x * 10),
    '21', String(b.y * 10),
    '31', '0',
  ]
}

function entityPolyline(layer, points) {
  const rows = ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1']
  for (const point of points) {
    rows.push(
      '0', 'VERTEX',
      '8', layer,
      '10', String(point.x * 10),
      '20', String(point.y * 10),
      '30', '0',
    )
  }
  rows.push('0', 'SEQEND', '8', layer)
  return rows
}

function entityText(layer, point, text, heightMm = 5) {
  return [
    '0', 'TEXT',
    '8', layer,
    '10', String(point.x * 10),
    '20', String(point.y * 10),
    '30', '0',
    '40', String(heightMm),
    '1', text,
  ]
}

function safeLayer(value) {
  return String(value || 'PATTERN').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48)
}

function centroid(points) {
  if (!points.length) return { x: 0, y: 0 }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

function notchForEdge(piece, edgeIndex, depthCm = 0.45, fraction = 0.5) {
  const located = edgePointAt(piece, edgeIndex, fraction, 48)
  if (!located) return null
  return {
    a: { x: located.point.x - located.normal.x * depthCm * 0.15, y: located.point.y - located.normal.y * depthCm * 0.15 },
    b: { x: located.point.x + located.normal.x * depthCm, y: located.point.y + located.normal.y * depthCm },
  }
}

function dartLegs(line) {
  const dx = line.b.x - line.a.x
  const dy = line.b.y - line.a.y
  const length = Math.hypot(dx, dy) || 1
  const halfWidth = Number(line.widthCm ?? 2.5) * 0.5
  const nx = -dy / length * halfWidth
  const ny = dx / length * halfWidth
  return {
    left: { x: line.a.x + nx, y: line.a.y + ny },
    right: { x: line.a.x - nx, y: line.a.y - ny },
    apex: { ...line.b },
  }
}

export function projectToDxf(project, size = project.previewSize || project.grading?.baseSize || 'BASE') {
  const entities = []
  const notchTokens = new Set()
  for (const seam of project.seams || []) {
    notchTokens.add(`${seam.a.pieceId}:${seam.a.edgeIndex}`)
    notchTokens.add(`${seam.b.pieceId}:${seam.b.edgeIndex}`)
  }

  let xOffset = 0
  const spacingCm = 10
  for (const piece of project.pieces || []) {
    const sampled = samplePieceBoundary(piece, 12).points
    const xs = sampled.map((point) => point.x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const translated = sampled.map((point) => ({ x: point.x - minX + xOffset, y: point.y }))
    const pieceToken = safeLayer(piece.name).toUpperCase()
    const sizeToken = safeLayer(size).toUpperCase()
    const layerBase = `CUT_${pieceToken}_${sizeToken}`
    entities.push(...entityPolyline(layerBase, translated))

    if (piece.points.some((_, edgeIndex) => getEdgeSeamAllowance(piece, edgeIndex) > 0)) {
      const allowance = seamAllowanceBoundary(piece, 12)
        .map((point) => ({ x: point.x - minX + xOffset, y: point.y }))
      entities.push(...entityPolyline(`SA_${pieceToken}`, allowance))
    }

    const explicitNotchEdges = new Set()
    for (const notch of piece.notches || []) {
      const edgeIndex = Number(notch.edgeIndex)
      if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= piece.points.length) continue
      explicitNotchEdges.add(edgeIndex)
      const length = edgeLength(piece, edgeIndex)
      const gap = length > 0 ? Math.min(0.045, 0.38 / length) : 0.02
      const fractions = notch.type === 'double'
        ? [Math.max(0.01, (notch.t ?? 0.5) - gap), Math.min(0.99, (notch.t ?? 0.5) + gap)]
        : [notch.t ?? 0.5]
      for (const fraction of fractions) {
        const cut = notchForEdge(piece, edgeIndex, Number(notch.depthCm ?? 0.45), fraction)
        if (!cut) continue
        entities.push(...entityLine(`NOTCH_${pieceToken}`,
          { x: cut.a.x - minX + xOffset, y: cut.a.y },
          { x: cut.b.x - minX + xOffset, y: cut.b.y },
        ))
      }
    }

    piece.points.forEach((_, edgeIndex) => {
      if (explicitNotchEdges.has(edgeIndex)) return
      if (!notchTokens.has(`${piece.id}:${edgeIndex}`)) return
      const notch = notchForEdge(piece, edgeIndex)
      if (!notch) return
      entities.push(...entityLine(`NOTCH_${pieceToken}`,
        { x: notch.a.x - minX + xOffset, y: notch.a.y },
        { x: notch.b.x - minX + xOffset, y: notch.b.y },
      ))
    })

    for (const buttonhole of piece.buttonholes || []) {
      const angle = Number(buttonhole.orientationDeg || 0) * Math.PI / 180
      const halfLength = Math.max(0.4, Number(buttonhole.lengthCm ?? 2.4) * 0.5)
      const dx = Math.cos(angle) * halfLength
      const dy = Math.sin(angle) * halfLength
      entities.push(...entityLine(`BUTTONHOLE_${pieceToken}`,
        { x: Number(buttonhole.x || 0) - dx - minX + xOffset, y: Number(buttonhole.y || 0) - dy },
        { x: Number(buttonhole.x || 0) + dx - minX + xOffset, y: Number(buttonhole.y || 0) + dy },
      ))
    }

    const center = centroid(translated)
    const ys = translated.map((point) => point.y)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const grainHalfLength = Math.max(3, (maxY - minY - 12) * 0.5)
    const grainAngle = (Number(piece.grainAngleDeg || 0) * Math.PI) / 180
    const grainDx = Math.sin(grainAngle) * grainHalfLength
    const grainDy = Math.cos(grainAngle) * grainHalfLength
    entities.push(...entityLine(`GRAIN_${pieceToken}`,
      { x: center.x - grainDx, y: center.y - grainDy },
      { x: center.x + grainDx, y: center.y + grainDy },
    ))
    entities.push(...entityText(`LABEL_${pieceToken}`, center, `${piece.name} / ${size}`, 5))

    for (const line of piece.internalLines || []) {
      const translate = (point) => ({ x: point.x - minX + xOffset, y: point.y })
      const type = safeLayer(line.type || 'construction').toUpperCase()
      if (line.type === 'dart') {
        const legs = dartLegs(line)
        entities.push(...entityLine(`INTERNAL_DART_${pieceToken}`, translate(legs.left), translate(legs.apex)))
        entities.push(...entityLine(`INTERNAL_DART_${pieceToken}`, translate(legs.right), translate(legs.apex)))
        entities.push(...entityLine(`DART_CENTER_${pieceToken}`, translate(line.a), translate(line.b)))
      } else if (line.type === 'pleat') {
        const dx = line.b.x - line.a.x
        const dy = line.b.y - line.a.y
        const length = Math.hypot(dx, dy) || 1
        const nx = -dy / length
        const ny = dx / length
        const count = Math.max(1, Math.min(16, Math.round(Number(line.count ?? 5))))
        const spacing = Math.max(1, Number(line.spacingCm ?? 4))
        for (let index = 0; index < count; index += 1) {
          const offset = (index - (count - 1) * 0.5) * spacing
          entities.push(...entityLine(
            `INTERNAL_PLEAT_${pieceToken}`,
            translate({ x: line.a.x + nx * offset, y: line.a.y + ny * offset }),
            translate({ x: line.b.x + nx * offset, y: line.b.y + ny * offset }),
          ))
        }
      } else {
        entities.push(...entityLine(`INTERNAL_${type}_${pieceToken}`, translate(line.a), translate(line.b)))
      }
    }
    xOffset += (maxX - minX) + spacingCm
  }

  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER',
    '1', 'AC1009',
    '9', '$MEASUREMENT',
    '70', '1',
    // This export emits geometry in millimetres. Many CAD importers prioritize
    // $INSUNITS over $MEASUREMENT, so state the units explicitly.
    '9', '$INSUNITS',
    '70', '4',
    '0', 'ENDSEC',
    '999', `GARMENT_STUDIO_PROJECT ${project.id || 'untitled'}`,
    '999', `GARMENT_STUDIO_SIZE ${size}`,
    '999', 'COORDINATES_MM',
    '0', 'SECTION',
    '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n')
}

function dxfPairs(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const pairs = []
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number(lines[index].trim())
    if (!Number.isFinite(code)) continue
    pairs.push({ code, value: lines[index + 1].trim() })
  }
  return pairs
}

function unitScaleToCm(pairs) {
  let insUnits = null
  let metric = null
  for (let index = 0; index < pairs.length; index += 1) {
    if (pairs[index].code !== 9) continue
    if (pairs[index].value === '$INSUNITS') {
      const next = pairs.slice(index + 1, index + 5).find((pair) => pair.code === 70)
      if (next) insUnits = Number(next.value)
    }
    if (pairs[index].value === '$MEASUREMENT') {
      const next = pairs.slice(index + 1, index + 5).find((pair) => pair.code === 70)
      if (next) metric = Number(next.value)
    }
  }
  const map = {
    1: 2.54, // inches
    2: 30.48, // feet
    4: 0.1, // millimeters
    5: 1, // centimeters
    6: 100, // meters
  }
  if (map[insUnits]) return map[insUnits]
  return metric === 0 ? 2.54 : 0.1
}

function collectEntities(pairs) {
  const entities = []
  let index = 0
  while (index < pairs.length) {
    if (pairs[index].code !== 0) {
      index += 1
      continue
    }
    const type = pairs[index].value.toUpperCase()
    if (type === 'POLYLINE') {
      const header = []
      index += 1
      while (index < pairs.length && pairs[index].code !== 0) header.push(pairs[index++])
      const vertices = []
      while (index < pairs.length) {
        if (pairs[index].code !== 0) { index += 1; continue }
        const child = pairs[index].value.toUpperCase()
        if (child === 'SEQEND') {
          index += 1
          while (index < pairs.length && pairs[index].code !== 0) index += 1
          break
        }
        if (child !== 'VERTEX') break
        index += 1
        const data = []
        while (index < pairs.length && pairs[index].code !== 0) data.push(pairs[index++])
        const x = Number(data.find((pair) => pair.code === 10)?.value)
        const y = Number(data.find((pair) => pair.code === 20)?.value)
        if (Number.isFinite(x) && Number.isFinite(y)) vertices.push({ x, y })
      }
      entities.push({
        type,
        layer: header.find((pair) => pair.code === 8)?.value || '0',
        closed: (Number(header.find((pair) => pair.code === 70)?.value || 0) & 1) === 1,
        points: vertices,
      })
      continue
    }

    index += 1
    const data = []
    while (index < pairs.length && pairs[index].code !== 0) data.push(pairs[index++])
    if (type === 'LWPOLYLINE') {
      const points = []
      let pendingX = null
      for (const pair of data) {
        if (pair.code === 10) pendingX = Number(pair.value)
        if (pair.code === 20 && Number.isFinite(pendingX)) {
          const y = Number(pair.value)
          if (Number.isFinite(y)) points.push({ x: pendingX, y })
          pendingX = null
        }
      }
      entities.push({
        type,
        layer: data.find((pair) => pair.code === 8)?.value || '0',
        closed: (Number(data.find((pair) => pair.code === 70)?.value || 0) & 1) === 1,
        points,
      })
    } else if (type === 'LINE') {
      const read = (code) => Number(data.find((pair) => pair.code === code)?.value)
      const x1 = read(10); const y1 = read(20); const x2 = read(11); const y2 = read(21)
      if ([x1, y1, x2, y2].every(Number.isFinite)) {
        entities.push({ type, layer: data.find((pair) => pair.code === 8)?.value || '0', a: { x: x1, y: y1 }, b: { x: x2, y: y2 } })
      }
    } else if (type === 'TEXT' || type === 'MTEXT') {
      const x = Number(data.find((pair) => pair.code === 10)?.value)
      const y = Number(data.find((pair) => pair.code === 20)?.value)
      entities.push({
        type,
        layer: data.find((pair) => pair.code === 8)?.value || '0',
        point: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null,
        text: data.find((pair) => pair.code === 1)?.value || '',
      })
    }
  }
  return entities
}

function ignoredOutlineLayer(layer) {
  return /^(SA_|NOTCH_|GRAIN_|LABEL_|INTERNAL_|DART_|DART_CENTER)/i.test(layer || '')
}

function closeEnough(a, b, tolerance = 0.75) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance
}

function lineLoops(lines, tolerance = 0.75) {
  const remaining = lines.map((line) => ({ ...line, a: { ...line.a }, b: { ...line.b } }))
  const loops = []
  while (remaining.length) {
    const seed = remaining.shift()
    const points = [seed.a, seed.b]
    let guard = 0
    while (remaining.length && guard++ < 10000) {
      const end = points[points.length - 1]
      const matchIndex = remaining.findIndex((line) => closeEnough(line.a, end, tolerance) || closeEnough(line.b, end, tolerance))
      if (matchIndex < 0) break
      const match = remaining.splice(matchIndex, 1)[0]
      points.push(closeEnough(match.a, end, tolerance) ? match.b : match.a)
      if (points.length >= 4 && closeEnough(points[0], points[points.length - 1], tolerance)) break
    }
    if (points.length >= 4 && closeEnough(points[0], points[points.length - 1], tolerance)) {
      points.pop()
      loops.push(points)
    }
  }
  return loops
}

function titleFromLayer(layer, index) {
  const cleaned = String(layer || '')
    .replace(/^CUT_/i, '')
    .replace(/_(XS|S|M|L|XL|XXL|BASE)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!cleaned || cleaned === '0') return `Imported Pattern ${index + 1}`
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function token(value) {
  return safeLayer(value).toUpperCase()
}

function nearestStraightEdge(points, target) {
  let best = null
  let bestDistance = Infinity
  points.forEach((a, edgeIndex) => {
    const b = points[(edgeIndex + 1) % points.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / lengthSq))
    const x = a.x + dx * t
    const y = a.y + dy * t
    const distance = Math.hypot(target.x - x, target.y - y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { edgeIndex, t, distance }
    }
  })
  return best
}

export function parseDxfPatterns(text, options = {}) {
  const pairs = dxfPairs(text)
  const entities = collectEntities(pairs)
  const scale = options.scaleToCm || unitScaleToCm(pairs)
  const closed = entities.filter((entity) => (
    ['POLYLINE', 'LWPOLYLINE'].includes(entity.type)
    && entity.closed
    && entity.points?.length >= 3
    && !ignoredOutlineLayer(entity.layer)
  ))

  const linesByLayer = new Map()
  for (const entity of entities.filter((item) => item.type === 'LINE')) {
    if (!linesByLayer.has(entity.layer)) linesByLayer.set(entity.layer, [])
    linesByLayer.get(entity.layer).push(entity)
  }
  for (const [layer, lines] of linesByLayer) {
    if (ignoredOutlineLayer(layer)) continue
    for (const points of lineLoops(lines)) closed.push({ type: 'LINE_LOOP', layer, closed: true, points })
  }

  if (!closed.length) throw new Error('No closed pattern outlines were found in the DXF.')

  const pieces = []
  let cursorX = 58
  let cursorY = 120
  let rowHeight = 0
  for (const [index, entity] of closed.entries()) {
    const scaled = entity.points.map((point) => ({ x: point.x * scale, y: point.y * scale }))
    const xs = scaled.map((point) => point.x)
    const ys = scaled.map((point) => point.y)
    const minX = Math.min(...xs); const maxX = Math.max(...xs)
    const minY = Math.min(...ys); const maxY = Math.max(...ys)
    const centerX = (minX + maxX) * 0.5
    const points = scaled.map((point) => ({ x: point.x - centerX, y: point.y - minY }))
    const width = maxX - minX
    const height = maxY - minY
    if (cursorX + width * 0.5 > 310) {
      cursorX = 58
      cursorY += rowHeight + 32
      rowHeight = 0
    }
    const name = titleFromLayer(entity.layer, index)
    // Keep a stable source token for matching associated NOTCH/GRAIN/etc.
    // Layers contain the original pattern token, not the human-readable name.
    const sourceToken = String(entity.layer || '').replace(/^CUT_/i, '').replace(/_[A-Za-z0-9]+$/, '')
    pieces.push({
      id: `imported-${index + 1}`,
      name,
      sourceLayer: entity.layer,
      sourceToken,
      points,
      curves: {},
      internalLines: [],
      notches: [],
      buttonholes: [],
      layout2d: { x: cursorX + width * 0.5, y: cursorY },
      arrangement3d: { x: (index % 3 - 1) * 0.7, y: 0.75 + Math.floor(index / 3) * 0.12, z: -0.65, flip: false },
      grainAngleDeg: 0,
      seamAllowance: 1,
      fabricId: 'main',
      locked: false,
      _import: { minX, minY, scale, layer: entity.layer },
    })
    cursorX += width + 24
    rowHeight = Math.max(rowHeight, height)
  }

  const findPieceForLayer = (prefix, layer) => {
    const wanted = token(String(layer || '').replace(new RegExp(`^${prefix}`, 'i'), ''))
    return pieces.find((piece) => token(piece.sourceToken) === wanted || token(piece.name) === wanted || token(piece.sourceLayer).includes(wanted) || wanted.includes(token(piece.name)))
  }

  for (const entity of entities.filter((item) => item.type === 'LINE')) {
    let piece = null
    if (/^NOTCH_/i.test(entity.layer)) piece = findPieceForLayer('NOTCH_', entity.layer)
    if (/^BUTTONHOLE_/i.test(entity.layer)) piece = findPieceForLayer('BUTTONHOLE_', entity.layer)
    if (/^GRAIN_/i.test(entity.layer)) piece = findPieceForLayer('GRAIN_', entity.layer)
    if (/^INTERNAL_/i.test(entity.layer) || /^DART_/i.test(entity.layer)) piece = pieces.find((candidate) => token(entity.layer).includes(token(candidate.name)))
    if (!piece) continue
    const toLocal = (point) => ({
      x: point.x * scale - (piece._import.minX + (Math.max(...piece.points.map((p) => p.x)) - Math.min(...piece.points.map((p) => p.x))) * 0.5),
      y: point.y * scale - piece._import.minY,
    })

    if (/^BUTTONHOLE_/i.test(entity.layer)) {
      const a = toLocal(entity.a)
      const b = toLocal(entity.b)
      const dx = b.x - a.x
      const dy = b.y - a.y
      piece.buttonholes.push({
        id: `import-buttonhole-${piece.buttonholes.length + 1}`,
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5,
        lengthCm: Math.hypot(dx, dy),
        widthCm: 0.35,
        orientationDeg: Math.atan2(dy, dx) * 180 / Math.PI,
        color: '#575757',
      })
    } else if (/^NOTCH_/i.test(entity.layer)) {
      const midpoint = toLocal({ x: (entity.a.x + entity.b.x) * 0.5, y: (entity.a.y + entity.b.y) * 0.5 })
      const nearest = nearestStraightEdge(piece.points, midpoint)
      if (nearest && nearest.distance < 1.5) {
        const existing = piece.notches.find((notch) => notch.edgeIndex === nearest.edgeIndex && Math.abs(notch.t - nearest.t) < 0.08)
        if (existing) existing.type = 'double'
        else piece.notches.push({ id: `import-notch-${piece.notches.length + 1}`, edgeIndex: nearest.edgeIndex, t: nearest.t, type: 'single', depthCm: 0.45 })
      }
    } else if (/^GRAIN_/i.test(entity.layer)) {
      const dx = entity.b.x - entity.a.x
      const dy = entity.b.y - entity.a.y
      piece.grainAngleDeg = Math.atan2(dx, dy) * 180 / Math.PI
    } else if (/^INTERNAL_/i.test(entity.layer) || /^DART_/i.test(entity.layer)) {
      const type = /DART/i.test(entity.layer) ? 'dart' : /FOLD/i.test(entity.layer) ? 'fold' : 'construction'
      piece.internalLines.push({
        id: `import-internal-${piece.internalLines.length + 1}`,
        name: `Imported ${type}`,
        type,
        widthCm: type === 'dart' ? 2.5 : undefined,
        foldAngleDeg: type === 'fold' ? 135 : undefined,
        a: toLocal(entity.a),
        b: toLocal(entity.b),
      })
    }
  }

  for (const piece of pieces) { delete piece._import; delete piece.sourceToken }
  return { pieces, scaleToCm: scale, entityCount: entities.length }
}
