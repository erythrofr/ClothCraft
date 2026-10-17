import { edgeLength, samplePieceBoundary } from './project.js'
import { gradeProject } from './grading.js'
import { buildFabricMarkers } from './marker.js'

function bounds(piece) {
  const sampled = samplePieceBoundary(piece, 16).points
  const xs = sampled.map((point) => point.x)
  const ys = sampled.map((point) => point.y)
  return {
    points: sampled,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function horizontalSpan(piece, y) {
  if (!piece) return 0
  const points = samplePieceBoundary(piece, 18).points
  const intersections = []
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    if (Math.abs(a.y - b.y) < 1e-6) {
      if (Math.abs(y - a.y) < 0.2) intersections.push(a.x, b.x)
      continue
    }
    const low = Math.min(a.y, b.y)
    const high = Math.max(a.y, b.y)
    if (y < low || y > high) continue
    const t = (y - a.y) / (b.y - a.y)
    intersections.push(a.x + (b.x - a.x) * t)
  }
  if (intersections.length < 2) return 0
  return Math.max(...intersections) - Math.min(...intersections)
}

function value(id, label, cm, tolerance = 0.5) {
  return { id, label, cm: Number(cm.toFixed(2)), toleranceCm: tolerance }
}

export function measureProject(project) {
  const front = project.pieces.find((piece) => piece.id === 'front') || project.pieces[0]
  const leftSleeve = project.pieces.find((piece) => piece.id === 'sleeve-left')
  if (!front) return []
  const frontBounds = bounds(front)
  const height = frontBounds.maxY - frontBounds.minY
  const sleeveBounds = leftSleeve ? bounds(leftSleeve) : null

  const chestY = frontBounds.minY + height * 0.70
  const waistY = frontBounds.minY + height * 0.42
  const hemY = frontBounds.minY + Math.max(0.3, height * 0.01)
  const shoulderY = frontBounds.minY + height * 0.955

  const measurements = [
    value('body-length', 'Body length', height, 0.7),
    value('chest-half', '1/2 chest', horizontalSpan(front, chestY), 0.5),
    value('waist-half', '1/2 waist', horizontalSpan(front, waistY), 0.5),
    value('hem-half', '1/2 hem', horizontalSpan(front, hemY), 0.5),
    value('across-shoulder', 'Across shoulder', horizontalSpan(front, shoulderY), 0.5),
    value('front-armhole', 'Front armhole', edgeLength(front, 1) + edgeLength(front, 2), 0.4),
  ]

  if (leftSleeve && sleeveBounds) {
    const sleeveHeight = sleeveBounds.maxY - sleeveBounds.minY
    measurements.push(
      value('sleeve-length', 'Sleeve length', sleeveHeight, 0.7),
      // A sleeve is ONE unfolded piece with one underarm seam. Its flat cut
      // width is the finished sleeve circumference (minus sewing turnback),
      // not a half-circumference like the separate front/back body pieces.
      value('bicep-half', 'Bicep circumference (sleeve flat)', horizontalSpan(leftSleeve, sleeveBounds.maxY - sleeveHeight * 0.18), 0.5),
      value('cuff-half', 'Cuff circumference (sleeve flat)', horizontalSpan(leftSleeve, sleeveBounds.minY + 0.3), 0.4),
    )
  }
  for (const measurement of project.customMeasurements || []) {
    if (!measurement?.a || !measurement?.b) continue
    const cm = Math.hypot(measurement.b.x - measurement.a.x, measurement.b.y - measurement.a.y)
    measurements.push(value(
      measurement.id,
      measurement.label || 'Custom measurement',
      cm,
      Number(measurement.toleranceCm ?? 0.5),
    ))
  }
  return measurements
}

export function buildMeasurementSizeRun(project) {
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  return Object.fromEntries(sizes.map((size) => [size, measureProject(gradeProject(project, size))]))
}

export function measurementRunToCSV(project) {
  const run = buildMeasurementSizeRun(project)
  const sizes = Object.keys(run)
  const ids = run[sizes[0]]?.map((measurement) => measurement.id) || []
  const lines = [['POM', 'Tolerance cm', ...sizes]]
  for (const id of ids) {
    const first = run[sizes[0]].find((measurement) => measurement.id === id)
    lines.push([
      first?.label || id,
      first?.toleranceCm ?? '',
      ...sizes.map((size) => run[size].find((measurement) => measurement.id === id)?.cm ?? ''),
    ])
  }
  return lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
}

export function buildTechPack(project) {
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const sizeMeasurements = buildMeasurementSizeRun(project)
  const markerWidth = project.markerSettings?.fabricWidthCm ?? 150
  const markerGap = project.markerSettings?.gapCm ?? 1.5
  const markers = Object.fromEntries(sizes.map((size) => {
    const graded = gradeProject(project, size)
    const fabricMarkers = buildFabricMarkers(graded, markerWidth, markerGap)
    const marker = fabricMarkers.main || Object.values(fabricMarkers)[0] || {
      width: markerWidth,
      gap: markerGap,
      length: 0,
      efficiency: 0,
    }
    return [size, {
      fabricWidthCm: marker.width,
      gapCm: marker.gap,
      markerLengthCm: Number(marker.length.toFixed(2)),
      efficiency: Number(marker.efficiency.toFixed(4)),
      byFabric: Object.fromEntries(Object.entries(fabricMarkers).map(([fabricId, item]) => [fabricId, {
        fabricWidthCm: item.width,
        gapCm: item.gap,
        markerLengthCm: Number(item.length.toFixed(2)),
        efficiency: Number(item.efficiency.toFixed(4)),
        requestedPieces: item.requestedPieces,
        placedPieces: item.placements.length,
        unusedPieces: item.unusedPieces,
        unplaced: (item.unplaced || []).map((entry) => ({ ...entry })),
      }])),
    }]
  }))
  return {
    format: 'garment-studio-tech-pack',
    version: 1,
    project: {
      id: project.id,
      name: project.name,
      revision: project.revision,
      units: project.units,
    },
    productionSpec: project.productionSpec ? structuredClone(project.productionSpec) : null,
    grading: project.grading,
    avatar: {
      ...(project.avatar || {}),
      armLengthCm: Number(project.avatar?.armLengthCm ?? (72 * Number(project.avatar?.heightCm ?? 180) / 180)),
    },
    sizeMeasurements,
    materials: Object.values(project.fabrics || {}).map((fabric) => ({
      id: fabric.id,
      name: fabric.name,
      catalogPresetId: fabric.catalogPresetId || null,
      calibration: fabric.calibration ? structuredClone(fabric.calibration) : null,
      calibrationEvidence: fabric.calibrationEvidence ? structuredClone(fabric.calibrationEvidence) : null,
      photoReference: fabric.photoReference ? structuredClone(fabric.photoReference) : null,
      color: fabric.color,
      gsm: fabric.gsm,
      thickness: fabric.thickness,
      stretchWarp: fabric.stretchWarp,
      stretchWeft: fabric.stretchWeft,
      shrinkWarp: fabric.shrinkWarp,
      shrinkWeft: fabric.shrinkWeft,
      bend: fabric.bend,
      friction: fabric.friction,
      damping: fabric.damping,
      roughness: fabric.roughness ?? 0.82,
      opacity: fabric.opacity ?? 1,
      displacementMm: fabric.displacementMm ?? 0,
      metalness: fabric.metalness ?? 0,
      sheen: fabric.sheen ?? 0.22,
      sheenRoughness: fabric.sheenRoughness ?? 0.84,
      normalStrength: fabric.normalStrength ?? 1,
      fiberAnisotropy: fabric.fiberAnisotropy ?? .16,
      fiberAngleDeg: fabric.fiberAngleDeg ?? 0,
      clearcoat: fabric.clearcoat ?? 0,
      clearcoatRoughness: fabric.clearcoatRoughness ?? .45,
      colorVariation: fabric.colorVariation ?? .25,
      weaveScaleCm: fabric.weaveScaleCm ?? 3,
      surfaceFamily: fabric.surfaceFamily || 'auto',
      wash: fabric.wash ? structuredClone(fabric.wash) : null,
      washNote: 'Digitally simulated appearance reference only; validate actual manufacturing treatment and physical fabric behavior with supplier samples.',
      texture: fabric.texture ? {
        colorMap: fabric.texture.name || null,
        normalMap: fabric.texture.normalName || null,
        roughnessMap: fabric.texture.roughnessName || null,
        metalnessMap: fabric.texture.metalnessName || null,
        opacityMap: fabric.texture.opacityName || null,
        displacementMap: fabric.texture.displacementName || null,
        repeatWidthCm: fabric.texture.repeatWidthCm ?? 20,
        repeatHeightCm: fabric.texture.repeatHeightCm ?? 20,
        rotationDeg: fabric.texture.rotationDeg ?? 0,
      } : null,
    })),
    patternPieces: project.pieces.map((piece) => ({
      id: piece.id,
      name: piece.name,
      role: piece.generatedRole || 'shell',
      liningForPieceId: piece.liningForPieceId || null,
      interfacingForPieceId: piece.interfacingForPieceId || null,
      fusedToPieceId: piece.fusedToPieceId || null,
      seamAllowanceCm: piece.seamAllowance,
      edgeSeamAllowancesCm: { ...(piece.edgeSeamAllowances || {}) },
      fabricId: piece.fabricId,
      notches: (piece.notches || []).map((notch) => ({
        id: notch.id,
        edgeIndex: notch.edgeIndex,
        t: notch.t ?? 0.5,
        type: notch.type || 'single',
        depthCm: Number(notch.depthCm ?? 0.45),
        matchGroupId: notch.matchGroupId || null,
        matchedSeamId: notch.matchedSeamId || null,
      })),
      buttonholes: (piece.buttonholes || []).map((buttonhole) => ({
        id: buttonhole.id,
        x: Number(buttonhole.x ?? 0),
        y: Number(buttonhole.y ?? 0),
        lengthCm: Number(buttonhole.lengthCm ?? 2.4),
        widthCm: Number(buttonhole.widthCm ?? 0.35),
        orientationDeg: Number(buttonhole.orientationDeg ?? 0),
        pairedButtonId: buttonhole.pairedButtonId || null,
      })),
      internalLines: piece.internalLines || [],
      gradePoints: (piece.points || []).map((point, pointIndex) => ({
        pointIndex,
        x: point.x,
        y: point.y,
        rule: point.gradeRule?.enabled ? {
          dxPerSize: Number(point.gradeRule.dxPerSize ?? 0),
          dyPerSize: Number(point.gradeRule.dyPerSize ?? 0),
        } : null,
      })),
    })),
    customMeasurements: (project.customMeasurements || []).map((measurement) => ({
      id: measurement.id,
      label: measurement.label || 'Custom measurement',
      pieceId: measurement.pieceId,
      a: measurement.a,
      b: measurement.b,
      toleranceCm: Number(measurement.toleranceCm ?? 0.5),
    })),
    construction: (project.seams || []).map((seam) => ({
      id: seam.id,
      name: seam.name,
      type: seam.type || 'normal',
      from: seam.a,
      to: seam.b,
      reverseB: Boolean(seam.reverseB),
      ratio: seam.ratio ?? null,
      easeSide: seam.easeSide || null,
      gatherSide: seam.gatherSide || null,
      openFraction: seam.openFraction ?? null,
      openFrom: seam.openFrom || null,
    })),
    markers,
  }
}
