import { cloneProject, uniqueId } from './project.js'

function relControl(a, b, control) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const px = control.cx - a.x
  const py = control.cy - a.y
  return [
    (px * dx + py * dy) / len2,
    (dx * py - dy * px) / len2,
  ]
}

function absControl(a, b, relative) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return {
    cx: a.x + Number(relative?.[0] || 0) * dx - Number(relative?.[1] || 0) * dy,
    cy: a.y + Number(relative?.[0] || 0) * dy + Number(relative?.[1] || 0) * dx,
  }
}

function reverseRelativeControl(control) {
  return [1 - Number(control?.[0] || 0), -Number(control?.[1] || 0)]
}

function panelName(piece, used) {
  const base = String(piece.name || piece.id || 'Panel').trim() || 'Panel'
  let name = base
  let index = 2
  while (used.has(name)) name = `${base} ${index++}`
  used.add(name)
  return name
}

function garmentCodeEdge(piece, edgeIndex) {
  const a = piece.points[edgeIndex]
  const b = piece.points[(edgeIndex + 1) % piece.points.length]
  const edge = { endpoints: [edgeIndex, (edgeIndex + 1) % piece.points.length] }
  const curve = piece.curves?.[edgeIndex]
  if (curve) {
    edge.curvature = {
      type: 'quadratic',
      params: [relControl(a, b, curve)],
    }
  }
  return edge
}

function pieceExtension(piece) {
  const copy = cloneProject(piece)
  delete copy.points
  delete copy.curves
  delete copy.name
  delete copy.id
  return copy
}

export function projectToGarmentCode(project) {
  const preserved = project?.interchange?.garmentCode || {}
  const usedNames = new Set()
  const pieceToPanel = new Map()
  const panels = {}

  for (const piece of project.pieces || []) {
    if (!piece?.points?.length) continue
    const name = panelName(piece, usedNames)
    pieceToPanel.set(piece.id, name)
    panels[name] = {
      translation: [
        Number(piece.arrangement3d?.x || 0) * 100,
        Number(piece.arrangement3d?.y || 0) * 100,
        Number(piece.arrangement3d?.z || 0) * 100,
      ],
      rotation: cloneProject(piece.garmentCode?.rotation || [0, 0, 0]),
      vertices: piece.points.map((point) => [Number(point.x), Number(point.y)]),
      edges: piece.points.map((_, edgeIndex) => garmentCodeEdge(piece, edgeIndex)),
      label: piece.garmentCode?.label || piece.generatedRole || undefined,
    }
  }

  const stitches = []
  const seamExtensions = []
  for (const seam of project.seams || []) {
    const aPanel = pieceToPanel.get(seam.a?.pieceId)
    const bPanel = pieceToPanel.get(seam.b?.pieceId)
    if (!aPanel || !bPanel) continue
    stitches.push([
      { panel: aPanel, edge: Number(seam.a.edgeIndex) },
      { panel: bPanel, edge: Number(seam.b.edgeIndex) },
    ])
    seamExtensions.push(cloneProject(seam))
  }

  const pieceExtensions = {}
  for (const piece of project.pieces || []) {
    const panel = pieceToPanel.get(piece.id)
    if (!panel) continue
    pieceExtensions[panel] = {
      id: piece.id,
      meta: pieceExtension(piece),
    }
  }

  return {
    pattern: {
      panels,
      stitches,
      panel_order: Object.keys(panels),
    },
    parameters: cloneProject(preserved.parameters || {}),
    parameter_order: cloneProject(preserved.parameterOrder || preserved.parameter_order || []),
    properties: {
      ...cloneProject(preserved.properties || {}),
      curvature_coords: 'relative',
      normalize_panel_translation: false,
      normalized_edge_loops: true,
      units_in_meter: Number(preserved.properties?.units_in_meter ?? 100),
    },
    garment_studio: {
      format: 'garment-studio-extension',
      version: 1,
      project: {
        id: project.id,
        name: project.name,
        version: project.version,
        revision: project.revision,
        units: project.units || 'cm',
        avatar: cloneProject(project.avatar || {}),
        fabrics: cloneProject(project.fabrics || {}),
        simulation: cloneProject(project.simulation || {}),
        grading: cloneProject(project.grading || {}),
        markerSettings: cloneProject(project.markerSettings || {}),
        fasteners: cloneProject(project.fasteners || []),
        customMeasurements: cloneProject(project.customMeasurements || []),
      },
      pieces: pieceExtensions,
      seams: seamExtensions,
    },
  }
}

function orderedPanel(panel) {
  const vertices = panel?.vertices || []
  const edges = panel?.edges || []
  if (!vertices.length) return { points: [], curves: {}, oldToNewEdge: new Map() }
  if (!edges.length) return {
    points: vertices.map(([x, y]) => ({ x: Number(x), y: Number(y) })),
    curves: {},
    oldToNewEdge: new Map(),
  }

  const remaining = new Set(edges.map((_, index) => index))
  const firstIndex = 0
  const first = edges[firstIndex]
  let currentVertex = Number(first.endpoints?.[0] ?? 0)
  const startVertex = currentVertex
  const points = []
  const curves = {}
  const oldToNewEdge = new Map()

  while (remaining.size) {
    let selected = null
    let reversed = false
    for (const edgeIndex of remaining) {
      const endpoints = edges[edgeIndex]?.endpoints || []
      if (Number(endpoints[0]) === currentVertex) {
        selected = edgeIndex
        reversed = false
        break
      }
      if (Number(endpoints[1]) === currentVertex) {
        selected = edgeIndex
        reversed = true
        break
      }
    }
    if (selected === null) break
    const edge = edges[selected]
    const endpoints = edge.endpoints || [0, 0]
    const nextVertex = Number(endpoints[reversed ? 0 : 1])
    const vertex = vertices[currentVertex] || [0, 0]
    points.push({ x: Number(vertex[0]), y: Number(vertex[1]) })
    const newEdgeIndex = points.length - 1
    oldToNewEdge.set(selected, newEdgeIndex)

    if (edge.curvature?.type === 'quadratic' && edge.curvature.params?.[0]) {
      const a = { x: Number(vertex[0]), y: Number(vertex[1]) }
      const end = vertices[nextVertex] || [0, 0]
      const b = { x: Number(end[0]), y: Number(end[1]) }
      const relative = reversed ? reverseRelativeControl(edge.curvature.params[0]) : edge.curvature.params[0]
      curves[newEdgeIndex] = absControl(a, b, relative)
    }

    remaining.delete(selected)
    currentVertex = nextVertex
    if (currentVertex === startVertex && !remaining.size) break
  }

  if (points.length < 3) {
    return {
      points: vertices.map(([x, y]) => ({ x: Number(x), y: Number(y) })),
      curves: {},
      oldToNewEdge: new Map(edges.map((_, index) => [index, index])),
    }
  }
  return { points, curves, oldToNewEdge }
}

function defaultLayout(index) {
  const column = index % 3
  const row = Math.floor(index / 3)
  return { x: 60 + column * 95, y: 110 + row * 105 }
}

export function garmentCodeToProject(spec, baseProject = {}) {
  const extension = spec?.garment_studio
  const projectMeta = extension?.project || {}
  const project = {
    ...cloneProject(baseProject || {}),
    ...cloneProject(projectMeta),
    id: projectMeta.id || baseProject.id || uniqueId('project'),
    name: projectMeta.name || baseProject.name || 'Imported GarmentCode Pattern',
    version: Math.max(Number(projectMeta.version || 1), 1),
    revision: Number(projectMeta.revision || 1),
    updatedAt: new Date().toISOString(),
    units: 'cm',
    pieces: [],
    seams: [],
    fasteners: cloneProject(projectMeta.fasteners || baseProject.fasteners || []),
    customMeasurements: cloneProject(projectMeta.customMeasurements || baseProject.customMeasurements || []),
    avatar: cloneProject(projectMeta.avatar || baseProject.avatar || {}),
    fabrics: cloneProject(projectMeta.fabrics || baseProject.fabrics || {}),
    simulation: cloneProject(projectMeta.simulation || baseProject.simulation || {}),
    grading: cloneProject(projectMeta.grading || baseProject.grading || {}),
    markerSettings: cloneProject(projectMeta.markerSettings || baseProject.markerSettings || {}),
    interchange: {
      ...cloneProject(baseProject.interchange || {}),
      garmentCode: {
        source: extension ? 'garment-studio' : 'external',
        parameters: cloneProject(spec?.parameters || {}),
        parameterOrder: cloneProject(spec?.parameter_order || []),
        properties: cloneProject(spec?.properties || {}),
        panelOrder: cloneProject(spec?.pattern?.panel_order || []),
      },
    },
  }

  const panelToPiece = new Map()
  const edgeMaps = new Map()
  const panels = spec?.pattern?.panels || {}
  Object.entries(panels).forEach(([panelName, panel], index) => {
    const ordered = orderedPanel(panel)
    const ext = extension?.pieces?.[panelName]
    const id = ext?.id || uniqueId('piece')
    const meta = cloneProject(ext?.meta || {})
    const translation = panel.translation || [0, 0, 0]
    const piece = {
      id,
      name: panelName,
      points: ordered.points,
      curves: ordered.curves,
      layout2d: meta.layout2d || defaultLayout(index),
      arrangement3d: meta.arrangement3d || {
        x: Number(translation[0] || 0) / 100,
        y: Number(translation[1] || 0) / 100,
        z: Number(translation[2] || 0) / 100,
        flip: false,
        wrap: null,
      },
      seamAllowance: Number(meta.seamAllowance ?? 1),
      fabricId: meta.fabricId || 'main',
      locked: Boolean(meta.locked),
      garmentCode: {
        ...cloneProject(meta.garmentCode || {}),
        label: panel.label ?? meta.garmentCode?.label ?? null,
        rotation: cloneProject(panel.rotation || meta.garmentCode?.rotation || [0, 0, 0]),
      },
      ...meta,
    }
    project.pieces.push(piece)
    panelToPiece.set(panelName, id)
    edgeMaps.set(panelName, ordered.oldToNewEdge)
  })

  if (extension?.seams?.length === (spec?.pattern?.stitches || []).length) {
    project.seams = cloneProject(extension.seams)
  } else {
    for (const [index, stitch] of (spec?.pattern?.stitches || []).entries()) {
      const a = stitch?.[0]
      const b = stitch?.[1]
      if (!a || !b) continue
      const aPieceId = panelToPiece.get(a.panel)
      const bPieceId = panelToPiece.get(b.panel)
      if (!aPieceId || !bPieceId) continue
      const aEdge = edgeMaps.get(a.panel)?.get(Number(a.edge)) ?? Number(a.edge)
      const bEdge = edgeMaps.get(b.panel)?.get(Number(b.edge)) ?? Number(b.edge)
      project.seams.push({
        id: uniqueId('seam'),
        name: `Imported seam ${index + 1}`,
        type: 'normal',
        a: { pieceId: aPieceId, edgeIndex: aEdge },
        b: { pieceId: bPieceId, edgeIndex: bEdge },
      })
    }
  }

  return project
}

export function garmentCodeRoundTripSummary(project) {
  const spec = projectToGarmentCode(project)
  const imported = garmentCodeToProject(spec, project)
  return {
    panels: Object.keys(spec.pattern.panels).length,
    stitches: spec.pattern.stitches.length,
    originalPieces: project.pieces?.length || 0,
    importedPieces: imported.pieces.length,
    originalSeams: project.seams?.length || 0,
    importedSeams: imported.seams.length,
  }
}
