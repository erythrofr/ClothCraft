import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { closestEdgeFraction, edgeLength, edgePointAt, getEdgeSeamAllowance, sampleEdge, samplePieceBoundary, seamAllowanceBoundary, seamLengthReport, pieceArea } from '../core/project.js'
import { offsetEdgePath, topstitchPaths, zipperPaths } from '../core/trims.js'
import ViewportQuickTools from './ViewportQuickTools.jsx'
import FlatAvatarSilhouette from './FlatAvatarSilhouette.jsx'
import { polarFromPoints, precisePointEdit, preciseCurveEdit, curveChordCoordinates } from '../core/draftingPrecision.js'
import { DRAFT_CONSTRUCTION_MODES, preciseConstructionEdit } from '../core/draftingConstructions.js'
import { constrainDraftAxis, snapDraftGrid, snapDraftPattern } from '../core/draftingSnapping.js'
import { draftingSplitFractions, SPLIT_MODES } from '../core/draftingSplit.js'

const VIEWBOX = { width: 330, height: 170 }
const snapStorageKey = () => {
  const session = new URLSearchParams(window.location.search).get('testSession')
  return 'garment-studio-2d-snapping-v1' + (session ? '-' + session : '')
}
const initialSnapSettings = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(snapStorageKey()) || 'null')
    if (value && typeof value === 'object') {
      return {
        grid: value.grid === true,
        pattern: value.pattern !== false,
        spacingCm: [0.25, 0.5, 1, 2, 5].includes(value.spacingCm) ? value.spacingCm : 1,
      }
    }
  } catch { /* Initial preferences are optional in private browser sessions. */ }
  return { grid: false, pattern: true, spacingCm: 1 }
}

function edgeToken(pieceId, edgeIndex) {
  return `${pieceId}:${edgeIndex}`
}

function svgPoint(point, layout) {
  return {
    x: layout.x + point.x,
    y: layout.y - point.y,
  }
}

function polygonPath(piece) {
  if (!piece.points.length) return ''
  const first = svgPoint(piece.points[0], piece.layout2d)
  const commands = [`M ${first.x} ${first.y}`]
  for (let edgeIndex = 0; edgeIndex < piece.points.length; edgeIndex += 1) {
    const next = piece.points[(edgeIndex + 1) % piece.points.length]
    const end = svgPoint(next, piece.layout2d)
    const curve = piece.curves?.[edgeIndex]
    if (curve) {
      const control = svgPoint({ x: curve.cx, y: curve.cy }, piece.layout2d)
      commands.push(`Q ${control.x} ${control.y} ${end.x} ${end.y}`)
    } else {
      commands.push(`L ${end.x} ${end.y}`)
    }
  }
  return `${commands.join(' ')} Z`
}

function pointsPath(points, layout) {
  if (!points.length) return ''
  const coords = points.map((point) => svgPoint(point, layout))
  return `${coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} Z`
}

// Read POM directly from the actual stitched curve, not from the control
// polygon. This also follows subsequent point/curve edits in real time.
function horizontalSpanAt(piece, y) {
  const outline = samplePieceBoundary(piece, 24).points
  const xs = []
  for (let index=0; index<outline.length; index++) {
    const a=outline[index], b=outline[(index+1)%outline.length]
    if (!a || !b) continue
    if (Math.abs(a.y-b.y)<1e-6) {
      if (Math.abs(y-a.y)<.01) xs.push(a.x,b.x)
      continue
    }
    if (y>=Math.min(a.y,b.y) && y<=Math.max(a.y,b.y)) xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y))
  }
  return xs.length>=2 ? { left:Math.min(...xs), right:Math.max(...xs), width:Math.max(...xs)-Math.min(...xs) } : null
}

export default function PatternEditor({
  project,
  showGrid = true,
  showSeamLinks = true,
  layout2DSignal = 0,
  onToggleGrid,
  onToggleSeams,
  onAutoArrange,
  gradeNestProjects = [],
  highlightSeamId = null,
  selectedPieceId,
  tool,
  onChangeTool,
  onSelectPiece,
  onSelectedEdgeChange,
  onMovePiece,
  onMovePoint,
  onSetPoint,
  onMoveCurve,
  onSetCurve,
  onSetEdgeAllowance,
  onSplitEdge,
  onSplitEdgePrecise,
  onUnfoldEdge,
  onDeletePoint,
  onCreatePin,
  onRemovePin,
  onCreateInternalLine,
  onCreateNotch,
  onCreateSeam,
  onCreateFastener,
  onCreateMeasurement,
  onBeginGesture,
  onEndGesture,
}) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [pendingEdge, setPendingEdge] = useState(null)
  const [pendingSewStart, setPendingSewStart] = useState(null)
  const [pendingFastener, setPendingFastener] = useState(null)
  const [pendingMeasurement, setPendingMeasurement] = useState(null)
  const [snapSettings, setSnapSettings] = useState(initialSnapSettings)
  const [snapGuide, setSnapGuide] = useState(null)
  const [hoverEdge, setHoverEdge] = useState(null)
  const [internalPreview, setInternalPreview] = useState(null)
  const [auditExpanded, setAuditExpanded] = useState(false)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [splitMode, setSplitMode] = useState('click')
  const [splitMethod, setSplitMethod] = useState('uniform')
  const [splitCount, setSplitCount] = useState('3')
  const [splitLengthCm, setSplitLengthCm] = useState('5')
  const [splitRatioPercent, setSplitRatioPercent] = useState('50')
  const [splitError, setSplitError] = useState('')
  const [unfoldError, setUnfoldError] = useState('')
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [selectedCurve, setSelectedCurve] = useState(null)
  const [curveEditMode, setCurveEditMode] = useState('chord')
  const [curveDraft, setCurveDraft] = useState({cx:'',cy:'',alongCm:'',depthCm:''})
  const [curveError, setCurveError] = useState('')
  const [pointDraft, setPointDraft] = useState({ x: '', y: '', lengthCm: '', angleDeg: '' })
  const [pointEditMode, setPointEditMode] = useState('absolute')
  const [constructionDraft, setConstructionDraft] = useState({
    construction: 'line', a: 1, b: 2, c: 3, d: 4, distanceCm: 2,
  })
  const [pointError, setPointError] = useState('')
  const [edgeAllowanceDraft, setEdgeAllowanceDraft] = useState('')
  const [view, setView] = useState({ x: 0, y: 0, width: VIEWBOX.width, height: VIEWBOX.height })
  const panRef = useRef(null)
  useEffect(() => {
    try { window.localStorage.setItem(snapStorageKey(), JSON.stringify(snapSettings)) }
    catch { /* Saving UI preferences must never block drafting. */ }
  }, [snapSettings])
  useEffect(() => {
    // Incomplete seam, tape and fastener endpoints are mode-local, not
    // persistent draft data. Never let a later workflow connect against a
    // stale first click after switching tools or loading a new template.
    setPendingEdge(null)
    setPendingSewStart(null)
    setPendingFastener(null)
    setPendingMeasurement(null)
    setInternalPreview(null)
    setSnapGuide(null)
  }, [tool, project.templateId])
  const selectedEdgePiece = project.pieces.find(piece => piece.id === selectedEdge?.pieceId)
  const activeEdge = selectedEdgePiece && Number.isInteger(selectedEdge?.edgeIndex) && selectedEdge.edgeIndex >= 0 && selectedEdge.edgeIndex < selectedEdgePiece.points.length
    ? selectedEdge : null
  useEffect(()=>{
    onSelectedEdgeChange?.(activeEdge ? {pieceId:activeEdge.pieceId,edgeIndex:activeEdge.edgeIndex}:null)
  },[activeEdge?.pieceId,activeEdge?.edgeIndex,onSelectedEdgeChange])
  const activeEdgeStart = activeEdge ? selectedEdgePiece.points[activeEdge.edgeIndex] : null
  const activeEdgeEnd = activeEdge ? selectedEdgePiece.points[(activeEdge.edgeIndex + 1) % selectedEdgePiece.points.length] : null
  const activeEdgeAllowance = activeEdge ? getEdgeSeamAllowance(selectedEdgePiece, activeEdge.edgeIndex) : 0
  const selectedPointPiece = project.pieces.find(piece => piece.id === selectedPoint?.pieceId)
  const activePoint = selectedPointPiece?.points?.[selectedPoint?.pointIndex] || null
  const pointAnchor = activePoint ? selectedPointPiece.points[(selectedPoint.pointIndex - 1 + selectedPointPiece.points.length) % selectedPointPiece.points.length] : null
  const selectedCurvePiece = project.pieces.find(piece => piece.id === selectedCurve?.pieceId)
  const activeCurve = selectedCurvePiece && Number.isInteger(selectedCurve?.edgeIndex) && selectedCurve.edgeIndex >= 0 && selectedCurve.edgeIndex < selectedCurvePiece.points.length
    ? selectedCurve : null
  const activeCurveHandle = activeCurve ? (selectedCurvePiece.curves?.[activeCurve.edgeIndex] || null) : null
  const revealDockedPrecision = () => {
    // When selecting a vertex in the drawing, the appropriate fields should
    // be immediately available even if the Property Editor was scrolled down
    // to fabric/manufacturing settings. Only the right panel is scrolled.
    requestAnimationFrame(() => {
      const host = document.getElementById('clo-pattern-properties-host')
      if (host && !host.hidden) {
        const scroller = host.closest('.clo-property-panel')
        if (scroller) scroller.scrollTop = 0
      }
    })
  }
  const selectDraftCurve = (piece, edgeIndex) => {
    const a = piece.points[edgeIndex]
    const b = piece.points[(edgeIndex + 1) % piece.points.length]
    const existing = piece.curves?.[edgeIndex]
    const control = existing ? {x:existing.cx,y:existing.cy} : {x:(a.x+b.x)/2,y:(a.y+b.y)/2}
    const relative = curveChordCoordinates(a,control,b)
    setSelectedCurve({pieceId:piece.id,edgeIndex})
    setSelectedPoint(null)
    setSelectedEdge(null)
    setCurveDraft({cx:control.x.toFixed(4),cy:control.y.toFixed(4),alongCm:relative.alongCm.toFixed(4),depthCm:relative.depthCm.toFixed(4)})
    setCurveError('')
    onSelectPiece(piece.id)
    revealDockedPrecision()
  }
  const commitDraftCurve = () => {
    if (!activeCurve || selectedCurvePiece.locked || !onSetCurve) return
    try {
      const control = preciseCurveEdit(selectedCurvePiece,activeCurve.edgeIndex,{...curveDraft,mode:curveEditMode})
      if (onSetCurve(selectedCurve.pieceId,selectedCurve.edgeIndex,control) === false) {
        throw new Error('Curve would make the pattern overlap or self-intersect')
      }
      const a = selectedCurvePiece.points[activeCurve.edgeIndex]
      const b = selectedCurvePiece.points[(activeCurve.edgeIndex + 1) % selectedCurvePiece.points.length]
      const relative = curveChordCoordinates(a,{x:control.cx,y:control.cy},b)
      setCurveDraft({cx:control.cx.toFixed(4),cy:control.cy.toFixed(4),alongCm:relative.alongCm.toFixed(4),depthCm:relative.depthCm.toFixed(4)})
      setCurveError('')
    } catch (error) { setCurveError(error.message) }
  }
  const selectDraftPoint = (piece, pointIndex) => {
    const point = piece.points[pointIndex]
    const anchor = piece.points[(pointIndex - 1 + piece.points.length) % piece.points.length]
    const polar = polarFromPoints(anchor, point)
    setSelectedPoint({ pieceId: piece.id, pointIndex })
    setSelectedEdge(null)
    setSelectedCurve(null)
    setPointDraft({
      x: point.x.toFixed(4), y: point.y.toFixed(4),
      lengthCm: polar.lengthCm.toFixed(4), angleDeg: polar.angleDeg.toFixed(4),
    })
    setPointError('')
    onSelectPiece(piece.id)
    revealDockedPrecision()
  }
  const commitDraftPoint = () => {
    if (!activePoint || !onSetPoint || selectedPointPiece.locked) return
    try {
      const updated = pointEditMode === 'construction'
        ? preciseConstructionEdit(selectedPointPiece,selectedPoint.pointIndex,constructionDraft)
        : precisePointEdit(selectedPointPiece, selectedPoint.pointIndex, {
          ...pointDraft, mode: pointEditMode,
        })
      if (onSetPoint(selectedPoint.pieceId, selectedPoint.pointIndex, updated) === false) {
        throw new Error('Point would produce an invalid or self-intersecting pattern outline')
      }
      const polar = polarFromPoints(pointAnchor, updated)
      setPointDraft({ x: updated.x.toFixed(4), y: updated.y.toFixed(4),
        lengthCm: polar.lengthCm.toFixed(4), angleDeg: polar.angleDeg.toFixed(4) })
      setPointError('')
    } catch (error) {
      setPointError(error.message)
    }
  }
  const selectDraftEdge = (piece, edgeIndex) => {
    setSelectedEdge({pieceId:piece.id,edgeIndex})
    setSelectedPoint(null)
    setSelectedCurve(null)
    setEdgeAllowanceDraft(String(getEdgeSeamAllowance(piece,edgeIndex)))
    setUnfoldError('')
    onSelectPiece(piece.id)
    revealDockedPrecision()
  }
  const applyEdgeAllowance = () => {
    const value = Number(edgeAllowanceDraft)
    if (!activeEdge || !Number.isFinite(value) || value < 0 || value > 8 || selectedEdgePiece.locked) return
    onSetEdgeAllowance?.(activeEdge.pieceId,activeEdge.edgeIndex,value)
  }
  const commitPreciseSplit = () => {
    if (!activeEdge || !onSplitEdgePrecise || selectedEdgePiece?.locked) return
    try {
      const options = {
        method: splitMethod,
        count: Number(splitCount),
        lengthCm: splitLengthCm,
        ratioPercent: splitRatioPercent,
      }
      draftingSplitFractions(selectedEdgePiece, activeEdge.edgeIndex, options)
      onSplitEdgePrecise(activeEdge.pieceId, activeEdge.edgeIndex, options)
      setSelectedEdge(null)
      setSplitError('')
    } catch (error) { setSplitError(error.message) }
  }
  const commitUnfold = () => {
    if (!activeEdge || !onUnfoldEdge || selectedEdgePiece?.locked) return
    const outcome = onUnfoldEdge(activeEdge.pieceId, activeEdge.edgeIndex)
    if (outcome?.ok) {
      setSelectedEdge(null)
      setUnfoldError('')
    } else setUnfoldError(outcome?.message || 'Unable to unfold this pattern edge')
  }
  const draftAudit = useMemo(() => {
    // An industrial pattern may have thousands of curves. Do not sample each
    // piece and evaluate every seam on every editing frame while its audit
    // section is collapsed; this QA is intentionally opt-in.
    if (!auditExpanded) return { pieces:[], seams:[], issues:[] }
    const pieces = project.pieces.map(piece => {
      const outline = samplePieceBoundary(piece, 20).points
      const xs = outline.map(point => point.x), ys = outline.map(point => point.y)
      return { id:piece.id, name:piece.name, points:piece.points.length,
        widthCm:xs.length?Math.max(...xs)-Math.min(...xs):0,
        heightCm:ys.length?Math.max(...ys)-Math.min(...ys):0,
        areaCm2:pieceArea(piece),
        perimeterCm:piece.points.reduce((total,_,i)=>total+edgeLength(piece,i),0) }
    })
    const seams = (project.seams||[]).map(seam => ({...seamLengthReport(project,seam),id:seam.id,name:seam.name||seam.id,pieceId:seam.a?.pieceId}))
    return {pieces,seams,issues:seams.filter(seam=>seam.status!=='good')}
  },[project,auditExpanded])
  // Precision and measurement controls are docked in the Property Editor:
  // interacting with the 2D canvas never opens a floating dimension panel.
  const [propertyDockHost, setPropertyDockHost] = useState(null)
  useEffect(() => {
    // React can render the 2D pane before its sibling Property Editor has
    // committed to the DOM. Resolve once after mount, not opportunistically
    // on a later user click, so QA is accessible immediately at startup.
    setPropertyDockHost(document.getElementById('clo-pattern-properties-host'))
  }, [])
  const resetView = () => setView({ x: 0, y: 0, width: VIEWBOX.width, height: VIEWBOX.height })
  const focusPieces = (pieces, padding = 14) => {
    const locations = pieces.flatMap((piece) => samplePieceBoundary(piece, 14).points
      .map((point) => svgPoint(point, piece.layout2d)))
    if (!locations.length) return resetView()
    const xs = locations.map((point) => point.x)
    const ys = locations.map((point) => point.y)
    const minimumX = Math.min(...xs) - padding
    const maximumX = Math.max(...xs) + padding
    const minimumY = Math.min(...ys) - padding
    const maximumY = Math.max(...ys) + padding
    const rect = svgRef.current?.getBoundingClientRect()
    const canvasWidth = Math.max(200, rect?.width || 500)
    const canvasHeight = Math.max(200, rect?.height || 700)
    // Floating navigation was removed: the drafting surface is now fully
    // available for patterns and focus-to-fit may use its entire footprint.
    const reserved = { left: 14, right: 14, top: 23, bottom: 23 }
    const scale = Math.max(0.05, Math.min(
      (canvasWidth - reserved.left - reserved.right) / Math.max(1, maximumX - minimumX),
      (canvasHeight - reserved.top - reserved.bottom) / Math.max(1, maximumY - minimumY),
    ))
    const width = canvasWidth / scale
    const height = canvasHeight / scale
    setView({
      x: (minimumX + maximumX) * 0.5 + (reserved.right - reserved.left) / (2 * scale) - width * 0.5,
      y: (minimumY + maximumY) * 0.5 + (reserved.bottom - reserved.top) / (2 * scale) - height * 0.5,
      width,
      height,
    })
  }
  const focusSelected = () => {
    const piece = project.pieces.find((item) => item.id === selectedPieceId)
    if (piece) focusPieces([piece], 12)
    else focusPieces(project.pieces)
  }
  // Opening a new garment frames its pieces instead of preserving the old
  // zoom and leaving the 2D editor looking empty or illegibly small.
  useEffect(() => {
    const id = requestAnimationFrame(() => focusPieces(project.pieces, 14))
    return () => cancelAnimationFrame(id)
  }, [project.templateId])
  useEffect(() => {
    if (!layout2DSignal) return undefined
    const id = requestAnimationFrame(() => focusPieces(project.pieces, 14))
    return () => cancelAnimationFrame(id)
  }, [layout2DSignal])
  const zoomAt = (factor, x = 0.5, y = 0.5) => setView((old) => {
    // Large detail zoom is essential for inspecting 1 mm seam, notch and
    // control-point geometry, not just whole-garment compositions.
    const width = Math.max(1.5, Math.min(2000, old.width * factor))
    const height = width * VIEWBOX.height / VIEWBOX.width
    return { x: old.x + old.width * x - width * x, y: old.y + old.height * y - height * y, width, height }
  })
  const onCanvasWheel = (event) => {
    event.preventDefault()
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return
    zoomAt(event.deltaY > 0 ? 1.12 : 1 / 1.12, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height)
  }
  const onCanvasKeyDown = (event) => {
    if (event.key === 'Escape') {
      setPendingMeasurement(null)
      setPendingEdge(null)
      setPendingSewStart(null)
      setPendingFastener(null)
      setInternalPreview(null)
      return
    }
    if (event.target instanceof HTMLElement && ['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const key = event.key.toLowerCase()
    // CLO-style 2D arrow nudging changes the *layout* in centimeters; it
    // never edits the actual pattern outline or its sewing edge lengths.
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      const piece = project.pieces.find((item) => item.id === selectedPieceId)
      if (!piece || piece.locked) return
      const stepCm = event.shiftKey ? 10 : 1
      onMovePiece(piece.id, {
        x: Number(piece.layout2d?.x || 0) + (key === 'arrowright' ? stepCm : key === 'arrowleft' ? -stepCm : 0),
        y: Number(piece.layout2d?.y || 0) + (key === 'arrowdown' ? stepCm : key === 'arrowup' ? -stepCm : 0),
      })
      event.preventDefault()
      return
    }
    if (key === 'f') { event.preventDefault(); event.shiftKey ? focusSelected() : focusPieces(project.pieces, 14) }
    if (key === '+' || key === '=') { event.preventDefault(); zoomAt(0.8) }
    if (key === '-') { event.preventDefault(); zoomAt(1.25) }
    if (key === 'a' && event.shiftKey) { event.preventDefault(); onAutoArrange?.() }
  }

  const seamEdges = useMemo(() => {
    const set = new Set()
    for (const seam of project.seams || []) {
      for (const endpoint of [seam.a, seam.b]) {
        const start = Number(endpoint?.startT ?? 0)
        const end = Number(endpoint?.endT ?? 1)
        if (start <= 0.0001 && end >= 0.9999) set.add(edgeToken(endpoint.pieceId, endpoint.edgeIndex))
      }
    }
    return set
  }, [project.seams])
  const partialSeamRanges = useMemo(() => {
    const map = new Map()
    for (const seam of project.seams || []) {
      for (const endpoint of [seam.a, seam.b]) {
        let start = Math.max(0, Math.min(1, Number(endpoint?.startT ?? 0)))
        let end = Math.max(0, Math.min(1, Number(endpoint?.endT ?? 1)))
        if (start > end) [start, end] = [end, start]
        if (start <= 0.0001 && end >= 0.9999) continue
        const token = edgeToken(endpoint.pieceId, endpoint.edgeIndex)
        if (!map.has(token)) map.set(token, [])
        map.get(token).push({ seamId: seam.id, start, end, walking: seam.id === highlightSeamId })
      }
    }
    return map
  }, [project.seams, highlightSeamId])
  const walkEdges = useMemo(() => {
    const set = new Set()
    const seam = (project.seams || []).find((item) => item.id === highlightSeamId)
    for (const endpoint of [seam?.a, seam?.b]) {
      if (!endpoint) continue
      const start = Number(endpoint.startT ?? 0)
      const end = Number(endpoint.endT ?? 1)
      if (start <= 0.0001 && end >= 0.9999) set.add(edgeToken(endpoint.pieceId, endpoint.edgeIndex))
    }
    return set
  }, [project.seams, highlightSeamId])

  const clientToSvg = (event) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const matrix = svg.getScreenCTM()?.inverse()
    if (!matrix) return { x: 0, y: 0 }
    const transformed = point.matrixTransform(matrix)
    return { x: transformed.x, y: transformed.y }
  }

  // The snapping solver works on the same centimeter coordinate frame as the
  // SVG canvas. Precision tolerance is defined in visible screen pixels so
  // its behavior is consistent across zoom/pan. Alt temporarily bypasses it.
  const snapGlobal = (point, event, {
    allowPattern = true, excludedPieceId = null, excludedPoint = null,
    allowEdges = true,
  } = {}) => {
    if (event.altKey) return { point, guide: null }
    const bounds = svgRef.current?.getBoundingClientRect()
    const toleranceCm = Math.min(6, Math.max(0.05, 9 * view.width / Math.max(1, bounds?.width || 600)))
    if (allowPattern && snapSettings.pattern) {
      const target = snapDraftPattern(point, project.pieces, {
        toleranceCm, excludedPieceId, excludedPoint, allowEdges,
      })
      if (target) return { point: { x: target.x, y: target.y }, guide: target }
    }
    if (snapSettings.grid) {
      const snapped = snapDraftGrid(point, snapSettings.spacingCm)
      return { point: snapped, guide: { ...snapped, kind: 'grid' } }
    }
    return { point, guide: null }
  }
  const snapLocal = (local, piece, event, options = {}) => {
    const global = svgPoint(local, piece.layout2d)
    const snapped = snapGlobal(global, event, options)
    return {
      point: { x: snapped.point.x - piece.layout2d.x, y: piece.layout2d.y - snapped.point.y },
      guide: snapped.guide,
    }
  }

  const beginPieceDrag = (event, piece) => {
    if (event.button !== 0 || tool !== 'select' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    // A move gesture is not a geometry-edit gesture. Close any previously
    // selected precision controls rather than displaying measurements while
    // the user is simply arranging a pattern.
    setSelectedEdge(null)
    setSelectedPoint(null)
    setSelectedCurve(null)
    onSelectPiece(piece.id)
    onBeginGesture?.()
    const start = clientToSvg(event)
    dragRef.current = {
      kind: 'piece',
      pointerId: event.pointerId,
      pieceId: piece.id,
      start,
      origin: { ...piece.layout2d },
    }
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const beginPointDrag = (event, piece, pointIndex) => {
    if (tool !== 'point' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    selectDraftPoint(piece, pointIndex)
    onBeginGesture?.()
    const start = clientToSvg(event)
    dragRef.current = {
      kind: 'point',
      pointerId: event.pointerId,
      pieceId: piece.id,
      pointIndex,
      start,
      origin: { ...piece.points[pointIndex] },
    }
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const beginCurveDrag = (event, piece, edgeIndex) => {
    if (tool !== 'curve' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    selectDraftCurve(piece,edgeIndex)
    onBeginGesture?.()
    const a = piece.points[edgeIndex]
    const b = piece.points[(edgeIndex + 1) % piece.points.length]
    const existing = piece.curves?.[edgeIndex]
    const origin = existing
      ? { x: existing.cx, y: existing.cy }
      : { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }
    dragRef.current = {
      kind: 'curve',
      pointerId: event.pointerId,
      pieceId: piece.id,
      edgeIndex,
      start: clientToSvg(event),
      origin,
    }
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const localPoint = (event, piece) => {
    const point = clientToSvg(event)
    return { x: point.x - piece.layout2d.x, y: piece.layout2d.y - point.y }
  }

  const beginInternalDrag = (event, piece) => {
    if (tool !== 'internal' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onBeginGesture?.()
    const snapped = snapLocal(localPoint(event, piece), piece, event)
    const start = snapped.point
    setSnapGuide(snapped.guide)
    dragRef.current = {
      kind: 'internal',
      pointerId: event.pointerId,
      pieceId: piece.id,
      piece,
      startLocal: start,
      currentLocal: start,
    }
    setInternalPreview({ pieceId: piece.id, a: start, b: start })
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const createPinAtEvent = (event, piece) => {
    if (tool !== 'pin' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onCreatePin?.(piece.id, localPoint(event, piece))
  }

  const createFastenerAtEvent = (event, piece) => {
    if (tool !== 'fastener' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    const snapped = snapLocal(localPoint(event, piece), piece, event)
    const endpoint = { pieceId: piece.id, ...snapped.point }
    setSnapGuide(snapped.guide)
    if (!pendingFastener) {
      setPendingFastener(endpoint)
      return
    }
    if (pendingFastener.pieceId === endpoint.pieceId && Math.hypot(pendingFastener.x - endpoint.x, pendingFastener.y - endpoint.y) < 0.5) {
      setPendingFastener(null)
      return
    }
    onCreateFastener?.(pendingFastener, endpoint)
    setPendingFastener(null)
  }

  const createMeasurementAtEvent = (event, piece) => {
    if (tool !== 'measure' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    const snapped = snapLocal(localPoint(event, piece), piece, event)
    const endpoint = { pieceId: piece.id, ...snapped.point }
    setSnapGuide(snapped.guide)
    if (!pendingMeasurement || pendingMeasurement.pieceId !== piece.id) {
      setPendingMeasurement(endpoint)
      return
    }
    if (Math.hypot(pendingMeasurement.x - endpoint.x, pendingMeasurement.y - endpoint.y) < 0.2) {
      setPendingMeasurement(null)
      return
    }
    onCreateMeasurement?.(pendingMeasurement, endpoint)
    setPendingMeasurement(null)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const current = clientToSvg(event)
    const dx = current.x - drag.start.x
    const dy = current.y - drag.start.y
    if (drag.kind === 'piece') {
      let destination = { x: drag.origin.x + dx, y: drag.origin.y + dy }
      if (event.shiftKey) destination = constrainDraftAxis(drag.origin, destination)
      // Snap the pattern's global layout anchor, not every outline point.
      // Therefore moving a pattern never alters its shape or sewing lengths.
      const snapped = snapGlobal(destination, event, { allowPattern: false })
      setSnapGuide(snapped.guide)
      onMovePiece(drag.pieceId, snapped.point)
    } else if (drag.kind === 'point') {
      const piece = project.pieces.find(item => item.id === drag.pieceId)
      if (!piece) return
      const start = svgPoint(drag.origin, piece.layout2d)
      let destination = { x: start.x + dx, y: start.y + dy }
      if (event.shiftKey) destination = constrainDraftAxis(start, destination)
      const snapped = snapGlobal(destination, event, {
        excludedPoint: { pieceId: piece.id, pointIndex: drag.pointIndex },
        allowEdges: false,
      })
      setSnapGuide(snapped.guide)
      onMovePoint(drag.pieceId, drag.pointIndex, {
        x: Math.round((snapped.point.x - piece.layout2d.x) * 10000) / 10000,
        y: Math.round((piece.layout2d.y - snapped.point.y) * 10000) / 10000,
      })
    } else if (drag.kind === 'curve') {
      let destination = { x: drag.origin.x + dx, y: drag.origin.y - dy }
      if (event.shiftKey) destination = constrainDraftAxis(drag.origin, destination)
      const curvePiece = project.pieces.find(item => item.id === drag.pieceId)
      const global = svgPoint(destination, curvePiece.layout2d)
      const grid = snapGlobal(global, event, { allowPattern: false })
      const snapped = { x: grid.point.x - curvePiece.layout2d.x,
        y: curvePiece.layout2d.y - grid.point.y }
      setSnapGuide(grid.guide)
      onMoveCurve(drag.pieceId, drag.edgeIndex, {
        cx: Math.round(snapped.x * 10000) / 10000,
        cy: Math.round(snapped.y * 10000) / 10000,
      })
    } else if (drag.kind === 'internal') {
      const cursorLocal = localPoint(event, drag.piece)
      const projected = event.shiftKey ? constrainDraftAxis(
        svgPoint(drag.startLocal, drag.piece.layout2d),
        svgPoint(cursorLocal, drag.piece.layout2d),
      ) : null
      const candidate = projected ? {
        x: projected.x - drag.piece.layout2d.x,
        y: drag.piece.layout2d.y - projected.y,
      } : cursorLocal
      const result = snapLocal(candidate, drag.piece, event)
      const currentLocal = result.point
      setSnapGuide(result.guide)
      drag.currentLocal = currentLocal
      setInternalPreview({ pieceId: drag.pieceId, a: drag.startLocal, b: currentLocal })
    }
  }

  const endDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.kind === 'internal') {
      const distance = Math.hypot(drag.currentLocal.x - drag.startLocal.x, drag.currentLocal.y - drag.startLocal.y)
      if (distance >= 1.5) onCreateInternalLine?.(drag.pieceId, { a: drag.startLocal, b: drag.currentLocal })
      setInternalPreview(null)
    }
    dragRef.current = null
    setSnapGuide(null)
    svgRef.current?.releasePointerCapture?.(event.pointerId)
    onEndGesture?.()
  }

  const handleEdgeClick = (event, piece, edgeIndex) => {
    if (tool === 'select') {
      // The edge hit target overlays the piece fill. In transform mode,
      // dragging an edge must move the pattern, not select an edge and reveal
      // an inspector as if the user had asked to edit its measurements.
      beginPieceDrag(event, piece)
      return
    }
    if (tool === 'point' || tool === 'curve') {
      event.preventDefault()
      event.stopPropagation()
      selectDraftEdge(piece,edgeIndex)
      return
    }
    if (tool === 'notch') {
      event.preventDefault()
      event.stopPropagation()
      onSelectPiece(piece.id)
      const cursor = localPoint(event, piece)
      const fraction = closestEdgeFraction(piece, edgeIndex, cursor, 48)
      onCreateNotch?.(piece.id, edgeIndex, Math.max(0.02, Math.min(0.98, fraction)))
      return
    }
    if (tool === 'split') {
      event.preventDefault()
      event.stopPropagation()
      onSelectPiece(piece.id)
      if (splitMode === 'numeric') {
        selectDraftEdge(piece, edgeIndex)
        setSplitError('')
        return
      }
      const cursor = localPoint(event, piece)
      const path = sampleEdge(piece, edgeIndex, 24)
      let bestT = 0.5
      let bestDistance = Infinity
      for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
        const a = path[segmentIndex]
        const b = path[segmentIndex + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lengthSq = dx * dx + dy * dy || 1
        const localT = Math.max(0, Math.min(1, ((cursor.x - a.x) * dx + (cursor.y - a.y) * dy) / lengthSq))
        const px = a.x + dx * localT
        const py = a.y + dy * localT
        const distance = Math.hypot(cursor.x - px, cursor.y - py)
        if (distance < bestDistance) {
          bestDistance = distance
          bestT = (segmentIndex + localT) / (path.length - 1)
        }
      }
      onSplitEdge?.(piece.id, edgeIndex, Math.max(0.05, Math.min(0.95, bestT)))
      return
    }
    if (tool !== 'sew') return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    // CLO-style Free Sewing: Shift-click two positions along an edge to mark
    // an arbitrary, exact partial cutline interval. Ordinary clicks keep the
    // familiar whole-segment sewing interaction. This never splits/changes
    // the original cut pattern or requires a matching mesh vertex.
    if (event.shiftKey) {
      const clickedT = closestEdgeFraction(piece, edgeIndex, localPoint(event, piece))
      if (!pendingSewStart || pendingSewStart.pieceId !== piece.id || pendingSewStart.edgeIndex !== edgeIndex) {
        setPendingSewStart({ pieceId: piece.id, edgeIndex, startT: clickedT })
        return
      }
      const first = Math.min(pendingSewStart.startT, clickedT)
      const last = Math.max(pendingSewStart.startT, clickedT)
      if (last - first < 0.001) return
      const next = { pieceId: piece.id, edgeIndex, startT: first, endT: last }
      setPendingSewStart(null)
      if (!pendingEdge) {
        setPendingEdge(next)
      } else {
        onCreateSeam(pendingEdge, next)
        setPendingEdge(null)
      }
      return
    }
    setPendingSewStart(null)
    const next = { pieceId: piece.id, edgeIndex }
    if (!pendingEdge) {
      setPendingEdge(next)
      return
    }
    if (pendingEdge.pieceId === next.pieceId && pendingEdge.edgeIndex === next.edgeIndex) {
      setPendingEdge(null)
      return
    }
    onCreateSeam(pendingEdge, next)
    setPendingEdge(null)
  }

  return (
    <div className="pattern-editor-shell">
      <ViewportQuickTools dimension="2d" activeTool={tool} onChangeTool={onChangeTool}/>
      <div className="workspace-head">
        <div>
          <strong>2D Pattern Window</strong>
          <span>{project.units.toUpperCase()} · {project.pieces.length} PIECES</span>
        </div>
        <div className="workspace-hint">
          {tool === 'select' && 'Drag a piece to arrange it'}
          {tool === 'point' && 'Drag anchor points to edit · Option/Alt-click a point to delete it'}
          {tool === 'split' && (splitMode === 'numeric'
            ? 'Select an edge, then enter precise split divisions in Properties'
            : 'Click an edge to insert a new pattern point')}
          {tool === 'curve' && 'Drag an edge handle to shape a curve · double-click to straighten'}
          {tool === 'internal' && 'Drag inside a pattern to create a construction line · classify it as fold or dart in the inspector'}
          {tool === 'pin' && 'Click inside the pattern to add a manual 3D pin · click a pin to remove it'}
          {tool === 'notch' && 'Click a pattern edge to place a production notch at that exact curve position'}
          {tool === 'sew' && (pendingSewStart
            ? 'Shift-click the END of this partial seam range · Esc cancels'
            : pendingEdge
              ? 'Select second edge · Shift-click twice to mark an exact partial range'
              : 'Click two edges for segment sewing · Shift-click START and END on each edge for free sewing')}
          {tool === 'fastener' && (pendingFastener ? 'Click the mating buttonhole / snap point' : 'Click the first fastener point')}
          {tool === 'measure' && (pendingMeasurement ? 'Click the second measurement point on this pattern' : 'Click the first measurement point')}
        </div>
      </div>
      <svg
        ref={svgRef}
        className={`pattern-canvas tool-${tool}`}
        role="application"
        tabIndex={0}
        aria-label="2D pattern canvas: wheel to zoom; F fit all; Shift F focus selected; plus or minus zoom; Shift A tidy"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        onWheel={onCanvasWheel}
        onKeyDown={onCanvasKeyDown}
        // macOS trackpads can synthesize a secondary-click/contextmenu while
        // moving a pattern. Never open a menu above the 2D drafting surface.
        onContextMenu={(event) => event.preventDefault()}
        onPointerMove={(event) => {
          if (panRef.current?.pointerId === event.pointerId) {
            const bounds = svgRef.current.getBoundingClientRect()
            const dx = (event.clientX - panRef.current.x) * view.width / bounds.width
            const dy = (event.clientY - panRef.current.y) * view.height / bounds.height
            setView((old) => ({ ...old, x: old.x - dx, y: old.y - dy }))
            panRef.current.x = event.clientX
            panRef.current.y = event.clientY
          } else handlePointerMove(event)
        }}
        onPointerUp={(event) => { if (panRef.current?.pointerId === event.pointerId) panRef.current = null; else endDrag(event) }}
        onPointerCancel={(event) => { panRef.current = null; endDrag(event) }}
        onPointerDown={(event) => {
          if (event.button === 1 || (event.button === 0 && event.altKey && event.target === event.currentTarget)) {
            panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
            event.preventDefault()
            return
          }
          if (event.target === event.currentTarget) { onSelectPiece(null); setSelectedEdge(null); setSelectedPoint(null) }
        }}
      >
        <defs>
          <pattern id="minor-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(77,78,82,.16)" strokeWidth=".28" />
          </pattern>
          <pattern id="major-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <rect width="25" height="25" fill="url(#minor-grid)" />
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(75,76,79,.27)" strokeWidth=".38" />
          </pattern>
          <marker id="grain-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M 0 0 L 5 2.5 L 0 5 z" fill="currentColor" />
          </marker>
          {project.pieces.map((piece) => (
            <clipPath id={`pattern-clip-${piece.id}`} key={`clip-${piece.id}`}>
              <path d={polygonPath(piece)} />
            </clipPath>
          ))}
          {project.pieces.map((piece) => {
            const fabric = project.fabrics?.[piece.fabricId] || project.fabrics?.main
            if (!fabric?.texture?.src) return null
            const repeatWidth = Math.max(0.5, Number(fabric.texture.repeatWidthCm ?? 20))
            const repeatHeight = Math.max(0.5, Number(fabric.texture.repeatHeightCm ?? 20))
            const rotation = -(Number(piece.grainAngleDeg || 0) + Number(fabric.texture.rotationDeg || 0))
            return (
              <pattern
                id={`fabric-texture-${piece.id}`}
                key={`fabric-texture-${piece.id}`}
                width={repeatWidth}
                height={repeatHeight}
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(${rotation})`}
              >
                <rect width={repeatWidth} height={repeatHeight} fill={fabric.color || '#d3d3d3'} />
                <image href={fabric.texture.src} width={repeatWidth} height={repeatHeight} preserveAspectRatio="none" />
              </pattern>
            )
          })}
        </defs>
        {/* Overscan the SVG camera's visible rectangle. Grid coverage is
            continuous even during rapid cursor-centric zoom and panning. */}
        {showGrid && <rect x={view.x-view.width} y={view.y-view.height} width={view.width*3} height={view.height*3} fill="url(#major-grid)" pointerEvents="none" data-grid-coverage="overscanned"/>}
        {/* World-space drafting origin is aligned with the center of the guide
            figure. Unlike an HTML overlay, it pans and zooms with the patterns.
            The reference figure never intercepts pattern selection or sewing. */}
        <g className="draft-avatar-guide" aria-label={`Centered 2D drafting avatar: ${project.avatar?.name || 'Fitting body'}`} pointerEvents="none" transform={`translate(165 85) scale(${Math.max(.82, Math.min(1.22, Number(project.avatar?.heightCm || 180) / 180))})`}>
          <FlatAvatarSilhouette avatar={project.avatar}/>
        </g>
        {showGrid && <g className="draft-center-axes" pointerEvents="none" aria-label="2D drafting center axes">
          <path className="draft-center-horizontal" d="M-900 85H1230"/>
          <path className="draft-center-vertical" d="M165-900V1100"/>
          <circle className="draft-origin-dot" cx="165" cy="85" r="1.5"/>
        </g>}

        {gradeNestProjects.map((gradedProject, index) => {
          const piece = gradedProject.pieces?.find((item) => item.id === selectedPieceId)
          if (!piece) return null
          return (
            <g key={`grade-nest-${gradedProject.previewSize || index}`} className="grade-nest-group">
              <path d={polygonPath(piece)} className="grade-nest-path" />
              <text x={piece.layout2d.x} y={piece.layout2d.y - Math.max(...piece.points.map((point) => point.y)) - 3 - index * 3.2} className="grade-nest-label">{gradedProject.previewSize || ''}</text>
            </g>
          )
        })}

        {project.pieces.map((piece) => {
          const selected = piece.id === selectedPieceId
          const pieceFabric = project.fabrics?.[piece.fabricId] || project.fabrics?.main
          const patternFill = pieceFabric?.texture?.src ? `url(#fabric-texture-${piece.id})` : undefined
          const hasSeamAllowance = piece.points.some((_, edgeIndex) => getEdgeSeamAllowance(piece, edgeIndex) > 0)
          return (
            <g key={piece.id} data-piece-id={piece.id} className={`pattern-piece ${selected ? 'selected' : ''}`}>
              {selected && (() => {
                const samples = samplePieceBoundary(piece, 12).points.map((p) => svgPoint(p, piece.layout2d))
                const xs = samples.map(p => p.x), ys = samples.map(p => p.y)
                const x = Math.min(...xs) - 3, y = Math.min(...ys) - 3
                const width = Math.max(...xs) - Math.min(...xs) + 6
                const height = Math.max(...ys) - Math.min(...ys) + 6
                return <rect className="pattern-selection-box" x={x} y={y} width={width} height={height} fill="none" pointerEvents="none" />
              })()}
              {hasSeamAllowance && (
                <path
                  d={pointsPath(seamAllowanceBoundary(piece, 8), piece.layout2d)}
                  className={`seam-allowance ${selected ? 'selected' : ''}`}
                />
              )}
              <path
                d={polygonPath(piece)}
                className="pattern-fill"
                style={patternFill ? { fill: patternFill } : undefined}
                onPointerDown={(event) => tool === 'internal'
                  ? beginInternalDrag(event, piece)
                  : tool === 'pin'
                    ? createPinAtEvent(event, piece)
                    : tool === 'fastener'
                      ? createFastenerAtEvent(event, piece)
                      : tool === 'measure'
                        ? createMeasurementAtEvent(event, piece)
                      : beginPieceDrag(event, piece)}
                onClick={() => {
                  // Selecting on pointerdown is sufficient for moving a
                  // pattern; a trailing click must not trigger edit widgets.
                  if (tool === 'select' && !dragRef.current) onSelectPiece(piece.id)
                }}
              />
              {(piece.graphics || []).map((graphic) => {
                const center = svgPoint({ x: graphic.x ?? 0, y: graphic.y ?? 0 }, piece.layout2d)
                const width = Math.max(0.1, Number(graphic.widthCm ?? 20))
                const height = Math.max(0.1, Number(graphic.heightCm ?? 20))
                return (
                  <image
                    key={graphic.id}
                    className="pattern-graphic"
                    href={graphic.src}
                    x={center.x - width * 0.5}
                    y={center.y - height * 0.5}
                    width={width}
                    height={height}
                    opacity={graphic.opacity ?? 1}
                    preserveAspectRatio="none"
                    clipPath={`url(#pattern-clip-${piece.id})`}
                    transform={`rotate(${-(graphic.rotationDeg || 0)} ${center.x} ${center.y})`}
                  />
                )
              })}
              {(piece.pins || []).map((pin) => {
                const rendered = svgPoint(pin, piece.layout2d)
                return (
                  <g
                    key={pin.id}
                    className="pattern-pin"
                    transform={`translate(${rendered.x} ${rendered.y})`}
                    onPointerDown={(event) => {
                      if (tool !== 'pin') return
                      event.preventDefault()
                      event.stopPropagation()
                      onRemovePin?.(piece.id, pin.id)
                    }}
                  >
                    <circle r="2.15" />
                    <line x1="-1.1" y1="0" x2="1.1" y2="0" />
                    <line x1="0" y1="-1.1" x2="0" y2="1.1" />
                  </g>
                )
              })}
              {(project.fasteners || []).flatMap((fastener) => {
                const markers = []
                for (const [role, endpoint] of [['a', fastener.a], ['b', fastener.b]]) {
                  if (endpoint?.pieceId !== piece.id) continue
                  const rendered = svgPoint(endpoint, piece.layout2d)
                  markers.push(
                    <g key={`${fastener.id}-${role}`} className={`pattern-fastener ${fastener.closed === false ? 'open' : 'closed'} role-${role}`} transform={`translate(${rendered.x} ${rendered.y})`}>
                      {role === 'a' ? <circle r={2.3} /> : <><line x1={-3.2} y1="0" x2={3.2} y2="0" /><line x1={-2.3} y1="-.7" x2={-2.3} y2=".7" /><line x1={2.3} y1="-.7" x2={2.3} y2=".7" /></>}
                    </g>,
                  )
                }
                return markers
              })}
              {(project.customMeasurements || []).filter((measurement) => measurement.pieceId === piece.id).map((measurement) => {
                const a = svgPoint(measurement.a, piece.layout2d)
                const b = svgPoint(measurement.b, piece.layout2d)
                const cm = Math.hypot(measurement.b.x - measurement.a.x, measurement.b.y - measurement.a.y)
                return (
                  <g key={measurement.id} className="pattern-measurement">
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    <circle cx={a.x} cy={a.y} r="1.35" />
                    <circle cx={b.x} cy={b.y} r="1.35" />
                    <text x={(a.x + b.x) * 0.5} y={(a.y + b.y) * 0.5 - 2}>{cm.toFixed(1)} cm</text>
                  </g>
                )
              })}
              {pendingMeasurement?.pieceId === piece.id && (() => {
                const point = svgPoint(pendingMeasurement, piece.layout2d)
                return <circle className="measurement-pending" cx={point.x} cy={point.y} r="2.2" />
              })()}
              {(piece.internalLines || []).map((line) => {
                const a = svgPoint(line.a, piece.layout2d)
                const b = svgPoint(line.b, piece.layout2d)
                if (line.type === 'dart') {
                  const dx = b.x - a.x
                  const dy = b.y - a.y
                  const length = Math.hypot(dx, dy) || 1
                  const width = (line.widthCm ?? 2.5) * 0.5
                  const nx = -dy / length * width
                  const ny = dx / length * width
                  return (
                    <g key={line.id} className="internal-line dart-line">
                      <line x1={a.x + nx} y1={a.y + ny} x2={b.x} y2={b.y} />
                      <line x1={a.x - nx} y1={a.y - ny} x2={b.x} y2={b.y} />
                      <line className="dart-center" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    </g>
                  )
                }
                if (line.type === 'pleat') {
                  const dx = b.x - a.x
                  const dy = b.y - a.y
                  const length = Math.hypot(dx, dy) || 1
                  const nx = -dy / length
                  const ny = dx / length
                  const count = Math.max(1, Math.min(16, Math.round(Number(line.count ?? 5))))
                  const spacing = Math.max(1, Number(line.spacingCm ?? 4))
                  return (
                    <g key={line.id} className="internal-line pleat-line-set">
                      {Array.from({ length: count }, (_, index) => {
                        const offset = (index - (count - 1) * 0.5) * spacing
                        return <line key={`${line.id}-${index}`} x1={a.x + nx * offset} y1={a.y + ny * offset} x2={b.x + nx * offset} y2={b.y + ny * offset} />
                      })}
                    </g>
                  )
                }
                return <line key={line.id} className={`internal-line internal-${line.type || 'construction'}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              })}
              {internalPreview?.pieceId === piece.id && (() => {
                const a = svgPoint(internalPreview.a, piece.layout2d)
                const b = svgPoint(internalPreview.b, piece.layout2d)
                return <line className="internal-line-preview" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              })()}
              {(() => {
                const sampled = samplePieceBoundary(piece, 10).points
                if (!sampled.length) return null
                const xs = sampled.map((sample) => sample.x)
                const ys = sampled.map((sample) => sample.y)
                const center = { x: (Math.min(...xs) + Math.max(...xs)) * 0.5, y: (Math.min(...ys) + Math.max(...ys)) * 0.5 }
                const length = Math.max(10, (Math.max(...ys) - Math.min(...ys)) * 0.52)
                const angle = (Number(piece.grainAngleDeg || 0) * Math.PI) / 180
                const direction = { x: Math.sin(angle), y: Math.cos(angle) }
                const a = svgPoint({ x: center.x - direction.x * length * 0.5, y: center.y - direction.y * length * 0.5 }, piece.layout2d)
                const b = svgPoint({ x: center.x + direction.x * length * 0.5, y: center.y + direction.y * length * 0.5 }, piece.layout2d)
                return <line className="grainline" x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerStart="url(#grain-arrow)" markerEnd="url(#grain-arrow)" />
              })()}
              {/* True curve-intersection POM stations remain aligned when the
                  manufacturer or designer edits the armscye and side seams.
                  CF/CB, chest and stomach/waist lines are drafting annotations
                  only: never convert these into unintended cut boundaries. */}
              {['front','back'].includes(piece.id) && (() => {
                const xs = piece.points.map(p => p.x), ys = piece.points.map(p => p.y)
                const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
                const cx=(minX+maxX)/2, chestY=minY+(maxY-minY)*.70, stomachY=minY+(maxY-minY)*.42
                const a=svgPoint({x:cx,y:minY+2},piece.layout2d),b=svgPoint({x:cx,y:maxY-2},piece.layout2d)
                const chest=horizontalSpanAt(piece,chestY), stomach=horizontalSpanAt(piece,stomachY)
                const center=svgPoint({x:cx,y:chestY},piece.layout2d)
                return <g className="clo-bodice-drafting-guides" pointerEvents="none" clipPath={`url(#pattern-clip-${piece.id})`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="bodice-center-guide"/>
                  {[[chest,chestY,'bodice-chest-guide','CHEST'],[stomach,stomachY,'bodice-stomach-guide','STOMACH']].map(([span,y,klass,label])=> span && (()=>{
                    const left=svgPoint({x:span.left+.6,y},piece.layout2d)
                    const right=svgPoint({x:span.right-.6,y},piece.layout2d)
                    const mid=svgPoint({x:cx,y},piece.layout2d)
                    return <g key={label} className={`clo-pom-station ${klass}`} data-pom={label.toLowerCase()}>
                      <line x1={left.x} x2={right.x} y1={left.y} y2={right.y}/>
                      <circle cx={left.x} cy={left.y} r=".95"/><circle cx={right.x} cy={right.y} r=".95"/>
                      <circle cx={mid.x} cy={mid.y} r="1.35"/>
                      <path d={`M${mid.x-2.8} ${mid.y}h5.6M${mid.x} ${mid.y-2.8}v5.6`} />
                      {selected && <text x={mid.x+3.9} y={mid.y-1.8} className="clo-pom-measurement-label">{label} {span.width.toFixed(1)} CM</text>}
                    </g>
                  })())}
                  <circle cx={center.x} cy={center.y} r=".85"/>
                </g>
              })()}
              {(piece.notches || []).map((notch) => {
                const length = edgeLength(piece, notch.edgeIndex)
                const gap = length > 0 ? Math.min(0.045, 0.38 / length) : 0.02
                const fractions = notch.type === 'double'
                  ? [Math.max(0.01, (notch.t ?? 0.5) - gap), Math.min(0.99, (notch.t ?? 0.5) + gap)]
                  : [notch.t ?? 0.5]
                return (
                  <g key={notch.id} className={`pattern-notch ${notch.matchGroupId ? 'matched' : ''}`}>
                    {fractions.map((fraction, notchIndex) => {
                      const located = edgePointAt(piece, notch.edgeIndex, fraction, 48)
                      if (!located) return null
                      const depth = Number(notch.depthCm ?? 0.45)
                      const a = svgPoint({ x: located.point.x - located.normal.x * depth * 0.15, y: located.point.y - located.normal.y * depth * 0.15 }, piece.layout2d)
                      const b = svgPoint({ x: located.point.x + located.normal.x * depth, y: located.point.y + located.normal.y * depth }, piece.layout2d)
                      return <line key={`${notch.id}-${notchIndex}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    })}
                  </g>
                )
              })}
              {(piece.topstitches || []).map((stitch) => (
                <g key={stitch.id} className="pattern-topstitch">
                  {topstitchPaths(piece, stitch).map((path, rowIndex) => (
                    <polyline
                      key={`${stitch.id}-${rowIndex}`}
                      points={path.map((point) => {
                        const rendered = svgPoint(point, piece.layout2d)
                        return `${rendered.x},${rendered.y}`
                      }).join(' ')}
                      style={{ stroke: stitch.color || '#8d8d8d' }}
                    />
                  ))}
                </g>
              ))}
              {(piece.bindings || []).map((binding) => {
                const path = offsetEdgePath(piece, binding.edgeIndex, Number(binding.widthCm ?? 1.8) * 0.45, 32)
                return (
                  <polyline
                    key={binding.id}
                    className="pattern-binding"
                    points={path.map((point) => {
                      const rendered = svgPoint(point, piece.layout2d)
                      return `${rendered.x},${rendered.y}`
                    }).join(' ')}
                    style={{ stroke: binding.color || '#656565', strokeWidth: Math.max(0.65, Number(binding.widthCm ?? 1.8) * 0.32) }}
                  />
                )
              })}
              {(piece.zippers || []).map((zipper) => {
                const rails = zipperPaths(piece, zipper)
                const centerPath = sampleEdge(piece, zipper.edgeIndex, 32)
                return (
                  <g key={zipper.id} className="pattern-zipper">
                    {rails.map((path, railIndex) => (
                      <polyline key={`${zipper.id}-rail-${railIndex}`} points={path.map((point) => {
                        const rendered = svgPoint(point, piece.layout2d)
                        return `${rendered.x},${rendered.y}`
                      }).join(' ')} />
                    ))}
                    <polyline className="zipper-teeth" points={centerPath.map((point) => {
                      const rendered = svgPoint(point, piece.layout2d)
                      return `${rendered.x},${rendered.y}`
                    }).join(' ')} />
                  </g>
                )
              })}
              {(piece.buttons || []).map((button) => {
                const center = svgPoint(button, piece.layout2d)
                const radius = Math.max(0.35, Number(button.diameterCm ?? 1.8) * 0.5)
                return (
                  <g key={button.id} className="pattern-button">
                    <circle cx={center.x} cy={center.y} r={radius} />
                    <circle className="button-hole" cx={center.x - radius * 0.24} cy={center.y} r={Math.max(0.12, radius * 0.11)} />
                    <circle className="button-hole" cx={center.x + radius * 0.24} cy={center.y} r={Math.max(0.12, radius * 0.11)} />
                  </g>
                )
              })}
              {(piece.buttonholes || []).map((buttonhole) => {
                const center = svgPoint(buttonhole, piece.layout2d)
                const halfLength = Math.max(0.3, Number(buttonhole.lengthCm ?? 2.4) * 0.5)
                const angle = (Number(buttonhole.orientationDeg || 0) * Math.PI) / 180
                const dx = Math.cos(angle) * halfLength
                const dy = Math.sin(angle) * halfLength
                return (
                  <g key={buttonhole.id} className="pattern-buttonhole">
                    <line x1={center.x - dx} y1={center.y - dy} x2={center.x + dx} y2={center.y + dy} />
                    <circle cx={center.x - dx} cy={center.y - dy} r={0.18} />
                    <circle cx={center.x + dx} cy={center.y + dy} r={0.18} />
                  </g>
                )
              })}
              {piece.points.map((point, edgeIndex) => {
                const next = piece.points[(edgeIndex + 1) % piece.points.length]
                const a = svgPoint(point, piece.layout2d)
                const b = svgPoint(next, piece.layout2d)
                const edgePath = sampleEdge(piece, edgeIndex, 18).map((sample) => svgPoint(sample, piece.layout2d))
                const edgePathD = edgePath.map((sample, index) => `${index ? 'L' : 'M'} ${sample.x} ${sample.y}`).join(' ')
                const token = edgeToken(piece.id, edgeIndex)
                const sewn = seamEdges.has(token)
                const walking = walkEdges.has(token)
                const pending = pendingEdge && edgeToken(pendingEdge.pieceId, pendingEdge.edgeIndex) === token
                const hovered = hoverEdge === token
                const partialRanges = partialSeamRanges.get(token) || []
                return (
                  <g key={`${piece.id}-edge-${edgeIndex}`}>
                    <path
                      d={edgePathD}
                      fill="none"
                      className={`pattern-edge ${sewn ? 'sewn' : ''} ${walking ? 'walk-highlight' : ''} ${pending ? 'pending' : ''} ${hovered ? 'hovered' : ''} ${activeEdge?.pieceId===piece.id && activeEdge.edgeIndex===edgeIndex ? 'draft-selected-edge' : ''}`}
                    />
                    {partialRanges.map((range, rangeIndex) => {
                      const samples = []
                      for (let sampleIndex = 0; sampleIndex <= 18; sampleIndex += 1) {
                        const fraction = range.start + (range.end - range.start) * (sampleIndex / 18)
                        const located = edgePointAt(piece, edgeIndex, fraction, 64)
                        if (located?.point) samples.push(svgPoint(located.point, piece.layout2d))
                      }
                      if (samples.length < 2) return null
                      const partialPath = samples.map((sample, sampleIndex) => `${sampleIndex ? 'L' : 'M'} ${sample.x} ${sample.y}`).join(' ')
                      const first = samples[0]
                      const last = samples[samples.length - 1]
                      return (
                        <g key={`${range.seamId}-${rangeIndex}`} className={`partial-seam-range ${range.walking ? 'walk-highlight' : ''}`}>
                          <path d={partialPath} fill="none" className={`pattern-edge sewn partial-sewn ${range.walking ? 'walk-highlight' : ''}`} />
                          <circle className="partial-seam-cap" cx={first.x} cy={first.y} r={0.7} />
                          <circle className="partial-seam-cap" cx={last.x} cy={last.y} r={0.7} />
                        </g>
                      )
                    })}
                    <path
                      d={edgePathD}
                      fill="none"
                      className="edge-hit"
                      onPointerEnter={() => setHoverEdge(token)}
                      onPointerLeave={() => setHoverEdge(null)}
                      onPointerDown={(event) => handleEdgeClick(event, piece, edgeIndex)}
                    />
                    {pendingSewStart?.pieceId === piece.id && pendingSewStart.edgeIndex === edgeIndex && (() => {
                      const located = edgePointAt(piece, edgeIndex, pendingSewStart.startT)
                      if (!located) return null
                      const position = svgPoint(located.point, piece.layout2d)
                      return <g pointerEvents="none" aria-hidden="true" className="free-sewing-start-marker">
                        <circle cx={position.x} cy={position.y} r="2.2" fill="#f3b970" stroke="#302318" strokeWidth="0.7" />
                        <circle cx={position.x} cy={position.y} r="4" fill="none" stroke="#f3b970" strokeWidth="0.5" strokeDasharray="1 1" />
                      </g>
                    })()}
                    {selected && !['sew', 'notch'].includes(tool) && edgeIndex % 2 === 0 && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 1.5} className="edge-measure">
                        {edgeLength(piece, edgeIndex).toFixed(1)}
                      </text>
                    )}
                  </g>
                )
              })}
              {selected && <path
                d={polygonPath(piece)}
                className="pattern-selection-outline"
                fill="none"
                pointerEvents="none"
                aria-hidden="true"
              />}
              {piece.points.map((point, pointIndex) => {
                const rendered = svgPoint(point, piece.layout2d)
                return (
                  <circle
                    key={`${piece.id}-point-${pointIndex}`}
                    cx={rendered.x}
                    cy={rendered.y}
                    r={tool === 'point' && selected ? 2.25 : selected ? 1.8 : 1.25}
                    className={`pattern-node ${selected ? 'selected-point' : ''} ${tool === 'point' && selected ? 'editable' : ''} ${selectedPoint?.pieceId === piece.id && selectedPoint?.pointIndex === pointIndex ? 'precision-active-point' : ''}`}
                    onPointerDown={(event) => {
                      if (tool === 'point' && (event.altKey || event.metaKey)) {
                        event.preventDefault()
                        event.stopPropagation()
                        onDeletePoint?.(piece.id, pointIndex)
                        return
                      }
                      beginPointDrag(event, piece, pointIndex)
                    }}
                    onDoubleClick={(event) => {
                      if (tool !== 'point') return
                      event.preventDefault()
                      event.stopPropagation()
                      onDeletePoint?.(piece.id, pointIndex)
                    }}
                  />
                )
              })}
              {selected && tool === 'curve' && piece.points.map((point, edgeIndex) => {
                const next = piece.points[(edgeIndex + 1) % piece.points.length]
                const curve = piece.curves?.[edgeIndex]
                const controlLocal = curve
                  ? { x: curve.cx, y: curve.cy }
                  : { x: (point.x + next.x) * 0.5, y: (point.y + next.y) * 0.5 }
                const control = svgPoint(controlLocal, piece.layout2d)
                const a = svgPoint(point, piece.layout2d)
                const b = svgPoint(next, piece.layout2d)
                return (
                  <g key={`${piece.id}-curve-${edgeIndex}`} className={`curve-control ${curve ? 'active' : ''}`}>
                    {curve && <><line x1={a.x} y1={a.y} x2={control.x} y2={control.y} /><line x1={b.x} y1={b.y} x2={control.x} y2={control.y} /></>}
                    <circle
                      cx={control.x}
                      cy={control.y}
                      r={1.55}
                      onPointerDown={(event) => beginCurveDrag(event, piece, edgeIndex)}
                      onDoubleClick={(event) => { event.stopPropagation(); if (!piece.locked) onSetCurve?.(piece.id, edgeIndex, null) }}
                    />
                  </g>
                )
              })}
              <g transform={`translate(${piece.layout2d.x}, ${piece.layout2d.y + 11})`} className="piece-label">
                <rect x="-20" y="-5" width="40" height="9" rx="4.5" />
                <text textAnchor="middle" y="1.5">{piece.name.toUpperCase()}</text>
              </g>
            </g>
          )
        })}
        {showSeamLinks && (project.seams || []).map((seam) => {
          const pieceA = project.pieces.find((piece) => piece.id === seam.a?.pieceId)
          const pieceB = project.pieces.find((piece) => piece.id === seam.b?.pieceId)
          if (!pieceA || !pieceB) return null
          const links = []
          // Show a legible sparse correspondence at rest; a chosen sewing
          // relationship expands to nine exact matching stations.
          const segments = highlightSeamId === seam.id ? 8 : 2
          for (let index = 0; index <= segments; index += 1) {
            const t = index / segments
            const aStart = Number(seam.a?.startT ?? 0)
            const aEnd = Number(seam.a?.endT ?? 1)
            const bStart = Number(seam.b?.startT ?? 0)
            const bEnd = Number(seam.b?.endT ?? 1)
            const aPoint = edgePointAt(pieceA, seam.a.edgeIndex, aStart + t * (aEnd - aStart), 48)?.point
            const bFraction = seam.reverseB ? 1 - t : t
            const bPoint = edgePointAt(pieceB, seam.b.edgeIndex, bStart + bFraction * (bEnd - bStart), 48)?.point
            if (!aPoint || !bPoint) continue
            const a = svgPoint(aPoint, pieceA.layout2d)
            const b = svgPoint(bPoint, pieceB.layout2d)
            links.push(<line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)
          }
          return <g className={`pattern-seam-correspondence ${highlightSeamId === seam.id ? 'active' : ''}`} key={`link-${seam.id}`} aria-label={`${seam.name || seam.id} sewing correspondence`}>{links}</g>
        })}
        {snapGuide && <g className="draft-snap-guide" data-snap-kind={snapGuide.kind} pointerEvents="none" aria-hidden="true">
          <circle cx={snapGuide.x} cy={snapGuide.y} r={2.3}/>
          <path d={`M ${snapGuide.x - 4.5} ${snapGuide.y} h 9 M ${snapGuide.x} ${snapGuide.y - 4.5} v 9`}/>
        </g>}
      </svg>
      {propertyDockHost && createPortal(
        <div className="clo-2d-docked-tools" aria-label="2D drafting property tools">
          <section className="clo-draft-snap-settings" aria-label="2D drafting snap preferences">
            <div className="clo-docked-precision-heading">2D DRAFTING GUIDES</div>
            <div className="clo-draft-snap-row">
              <label><input type="checkbox" checked={snapSettings.grid} onChange={event => setSnapSettings(old => ({ ...old, grid: event.target.checked }))}/> Snap to Grid</label>
              <label><input type="checkbox" checked={snapSettings.pattern} onChange={event => setSnapSettings(old => ({ ...old, pattern: event.target.checked }))}/> Snap to Pattern</label>
            </div>
            <label className="clo-draft-grid-size">Grid distance
              <select aria-label="Drafting grid distance in centimeters" value={snapSettings.spacingCm}
                disabled={!snapSettings.grid}
                onChange={event => setSnapSettings(old => ({ ...old, spacingCm: Number(event.target.value) }))}>
                {[0.25, 0.5, 1, 2, 5].map(cm => <option value={cm} key={cm}>{cm} cm</option>)}
              </select>
            </label>
            <small>Shift: 45° guidelines · Alt: temporarily bypass snapping. Grid moves whole patterns without changing the cutline.</small>
          </section>
          {tool === 'split' && <section className="clo-draft-split-settings" aria-label="Precise split line drafting">
            <div className="clo-docked-precision-heading">ADD POINT / SPLIT LINE</div>
            <div className="precision-mode-select" role="group" aria-label="Split edge interaction">
              <button type="button" className={splitMode === 'click' ? 'active' : ''}
                aria-pressed={splitMode === 'click'} onClick={() => { setSplitMode('click'); setSplitError('') }}>Click to add</button>
              <button type="button" className={splitMode === 'numeric' ? 'active' : ''}
                aria-pressed={splitMode === 'numeric'} onClick={() => { setSplitMode('numeric'); setSplitError('') }}>Precise split</button>
            </div>
            {splitMode === 'numeric' && <form className="clo-draft-split-form"
              onSubmit={event => { event.preventDefault(); commitPreciseSplit() }}>
              <label>Method
                <select aria-label="Numeric edge split method" value={splitMethod}
                  onChange={event => { setSplitMethod(event.target.value); setSplitError('') }}>
                  {Object.entries(SPLIT_MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              {splitMethod === 'uniform' && <label>Segments (2–12)
                <input type="number" aria-label="Number of equal edge segments" min="2" max="12"
                  step="1" value={splitCount} onChange={event => setSplitCount(event.target.value)}/>
              </label>}
              {splitMethod === 'length' && <label>From start (cm)
                <input type="number" aria-label="Split distance from edge start in centimeters"
                  min="0" step="any" value={splitLengthCm}
                  onChange={event => setSplitLengthCm(event.target.value)}/>
              </label>}
              {splitMethod === 'ratio' && <label>Along edge (%)
                <input type="number" aria-label="Split percentage along edge" min="5" max="95"
                  step="any" value={splitRatioPercent}
                  onChange={event => setSplitRatioPercent(event.target.value)}/>
              </label>}
              <div className="clo-draft-split-length">Selected edge: {activeEdge
                ? edgeLength(selectedEdgePiece, activeEdge.edgeIndex).toFixed(4) + ' cm'
                : 'Click an edge in the 2D drawing'}</div>
              <button type="submit" disabled={!activeEdge || selectedEdgePiece?.locked || !onSplitEdgePrecise}>Split selected edge</button>
              {splitError && <p role="alert" className="precision-point-error">{splitError}</p>}
              <small>Equal lengths follow Bézier arc length, not control-point distance. All divisions share one Undo step, preserving existing seam references.</small>
            </form>}
          </section>}
          {(activePoint || activeCurve || activeEdge) && <div className="clo-docked-precision-heading">SELECTED 2D GEOMETRY</div>}
      {activeCurve && <section className="draft-edge-inspector precision-curve-inspector" aria-label="Precision curve editor">
        <div className="draft-edge-title"><strong>{selectedCurvePiece.name} · Curve {activeCurve.edgeIndex + 1}</strong><button type="button" aria-label="Close precision curve editor" onClick={()=>setSelectedCurve(null)}>×</button></div>
        <p className="precision-point-hint">Quadratic Bézier control handle. Depth is perpendicular to the straight edge, positive to its left.</p>
        <div className="draft-edge-metrics"><span>True arc length</span><strong>{edgeLength(selectedCurvePiece,activeCurve.edgeIndex).toFixed(4)} cm</strong><span>Curve state</span><strong>{activeCurveHandle?'Curved':'Straight'}</strong></div>
        <div className="precision-mode-select" role="group" aria-label="Curve coordinate system">
          <button type="button" className={curveEditMode==='chord'?'active':''} aria-pressed={curveEditMode==='chord'} onClick={()=>setCurveEditMode('chord')}>Along + depth</button>
          <button type="button" className={curveEditMode==='absolute'?'active':''} aria-pressed={curveEditMode==='absolute'} onClick={()=>setCurveEditMode('absolute')}>Control X/Y</button>
        </div>
        <form onSubmit={event=>{event.preventDefault();commitDraftCurve()}} className="precision-point-form">
          {curveEditMode==='chord' ? <>
            <label>Along chord (cm)<input type="number" aria-label="Curve handle along chord in centimeters" step="0.0001" value={curveDraft.alongCm} onChange={event=>setCurveDraft(old=>({...old,alongCm:event.target.value}))}/></label>
            <label>Depth (cm)<input type="number" aria-label="Curve perpendicular depth in centimeters" step="0.0001" value={curveDraft.depthCm} onChange={event=>setCurveDraft(old=>({...old,depthCm:event.target.value}))}/></label>
          </> : <>
            <label>Control X (cm)<input type="number" aria-label="Curve control X in centimeters" step="0.0001" value={curveDraft.cx} onChange={event=>setCurveDraft(old=>({...old,cx:event.target.value}))}/></label>
            <label>Control Y (cm)<input type="number" aria-label="Curve control Y in centimeters" step="0.0001" value={curveDraft.cy} onChange={event=>setCurveDraft(old=>({...old,cy:event.target.value}))}/></label>
          </>}
          <button type="submit" disabled={selectedCurvePiece.locked || !onSetCurve}>Apply curve edit</button>
        </form>
        <button type="button" className="precision-curve-straighten" disabled={selectedCurvePiece.locked || !onSetCurve || !activeCurveHandle} onClick={()=>{onSetCurve?.(selectedCurve.pieceId,selectedCurve.edgeIndex,null); setCurveError('')}}>Convert to straight edge</button>
        {curveError && <p role="alert" className="precision-point-error">{curveError}</p>}
        <small>Changes preserve sewing edge references and support undo/redo. Double-click a curve handle to straighten.</small>
      </section>}
      {activePoint && <section className="draft-edge-inspector precision-point-inspector" aria-label="Precision point editor">
        <div className="draft-edge-title"><strong>{selectedPointPiece.name} · Point {selectedPoint.pointIndex + 1}</strong><button type="button" aria-label="Close precision point editor" onClick={() => setSelectedPoint(null)}>×</button></div>
        <p className="precision-point-hint">Exact dimensions in centimeters. Changes update the editable manufacturing outline and can be undone.</p>
        <div className="precision-mode-select" role="group" aria-label="Point coordinate system">
          <button type="button" className={pointEditMode === 'absolute' ? 'active' : ''} aria-pressed={pointEditMode === 'absolute'} onClick={() => setPointEditMode('absolute')}>Absolute XY</button>
          <button type="button" className={pointEditMode === 'polar' ? 'active' : ''} aria-pressed={pointEditMode === 'polar'} onClick={() => setPointEditMode('polar')}>Length + angle</button>
          <button type="button" className={pointEditMode === 'construction' ? 'active' : ''} aria-pressed={pointEditMode === 'construction'} onClick={() => setPointEditMode('construction')}>Construction</button>
        </div>
        <form onSubmit={event => { event.preventDefault(); commitDraftPoint() }} className="precision-point-form">
          {pointEditMode === 'absolute' ? <>
            <label>X (cm)<input aria-label="Point X coordinate in centimeters" type="number" step=".0001" value={pointDraft.x} onChange={event => setPointDraft(old => ({ ...old, x: event.target.value }))}/></label>
            <label>Y (cm)<input aria-label="Point Y coordinate in centimeters" type="number" step=".0001" value={pointDraft.y} onChange={event => setPointDraft(old => ({ ...old, y: event.target.value }))}/></label>
          </> : pointEditMode === 'polar' ? <>
            <label>Length (cm)<input aria-label="Length from previous point in centimeters" type="number" min="0" step=".0001" value={pointDraft.lengthCm} onChange={event => setPointDraft(old => ({ ...old, lengthCm: event.target.value }))}/></label>
            <label>Angle (°)<input aria-label="Angle from previous point in degrees" type="number" step=".0001" value={pointDraft.angleDeg} onChange={event => setPointDraft(old => ({ ...old, angleDeg: event.target.value }))}/></label>
          </> : <>
            <label className="precision-construction-operation">Construction<select aria-label="Construction geometry operation" value={constructionDraft.construction} onChange={event=>setConstructionDraft(old=>({...old,construction:event.target.value}))}>{Object.entries(DRAFT_CONSTRUCTION_MODES).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
            {(['a','b',...(constructionDraft.construction === 'intersection' ? ['c','d'] : [])]).map(key=><label key={key}>Point {key.toUpperCase()}<input aria-label={`Reference point ${key.toUpperCase()} index`} type="number" min="1" max={selectedPointPiece.points.length} step="1" value={constructionDraft[key]} onChange={event=>setConstructionDraft(old=>({...old,[key]:event.target.value}))}/></label>)}
            {['line','normal'].includes(constructionDraft.construction) && <label>Offset (cm)<input aria-label="Construction offset in centimeters" type="number" step=".0001" value={constructionDraft.distanceCm} onChange={event=>setConstructionDraft(old=>({...old,distanceCm:event.target.value}))}/></label>}
            <small className="precision-construction-tip">Reference points use 1-based indices in this pattern. Intersections extend infinite reference lines. Positive perpendicular offsets point to the left of A→B.</small>
          </>}
          <button type="submit" disabled={selectedPointPiece.locked || !onSetPoint}>Apply precision edit</button>
        </form>
        {pointEditMode === 'polar' && <small>Anchor: previous pattern point ({pointAnchor.x.toFixed(3)}, {pointAnchor.y.toFixed(3)} cm)</small>}
        {pointError && <p role="alert" className="precision-point-error">{pointError}</p>}
        <small>Current: {activePoint.x.toFixed(4)}, {activePoint.y.toFixed(4)} cm. Drag point handles for freeform editing.</small>
      </section>}
      {activeEdge && <section className="draft-edge-inspector" aria-label="Selected 2D pattern edge inspector">
        <div className="draft-edge-title"><strong>{selectedEdgePiece.name} · Edge {activeEdge.edgeIndex + 1}</strong><button type="button" onClick={()=>setSelectedEdge(null)} aria-label="Close edge inspector">×</button></div>
        <div className="draft-edge-metrics"><span>Curve length</span><strong>{edgeLength(selectedEdgePiece,activeEdge.edgeIndex).toFixed(3)} cm</strong><span>Start (X, Y)</span><strong>{activeEdgeStart.x.toFixed(2)}, {activeEdgeStart.y.toFixed(2)} cm</strong><span>End (X, Y)</span><strong>{activeEdgeEnd.x.toFixed(2)}, {activeEdgeEnd.y.toFixed(2)} cm</strong><span>Geometry</span><strong>{selectedEdgePiece.curves?.[activeEdge.edgeIndex]?'Quadratic Bézier':'Straight edge'}</strong></div>
        <form onSubmit={event=>{event.preventDefault();applyEdgeAllowance()}} className="draft-edge-edit"><label htmlFor="selected-edge-seam-allowance">Seam allowance (cm)</label><input id="selected-edge-seam-allowance" aria-label="Selected edge seam allowance in cm" type="number" min="0" max="8" step="0.01" value={edgeAllowanceDraft} disabled={selectedEdgePiece.locked || !onSetEdgeAllowance} onChange={event=>setEdgeAllowanceDraft(event.target.value)}/><button type="submit" disabled={selectedEdgePiece.locked || !onSetEdgeAllowance || !Number.isFinite(Number(edgeAllowanceDraft)) || Number(edgeAllowanceDraft)<0 || Number(edgeAllowanceDraft)>8}>Apply</button></form>
        <button type="button" className="clo-draft-unfold-button"
          disabled={selectedEdgePiece.locked || !onUnfoldEdge || Boolean(selectedEdgePiece.curves?.[activeEdge.edgeIndex])}
          onClick={commitUnfold}>Unfold half-pattern across this straight edge</button>
        {unfoldError && <p role="alert" className="precision-point-error">{unfoldError}</p>}
        <small>Active allowance {activeEdgeAllowance.toFixed(2)} cm · Changes go through project history. Select another edge to inspect it.</small>
      </section>}
          <details className="clo-2d-docked-audit" aria-label="2D pattern drafting quality audit" onToggle={event => setAuditExpanded(event.currentTarget.open)}>
            <summary>2D QA · Pattern measurements &amp; sewing {auditExpanded && draftAudit.issues.length > 0 ? `· ${draftAudit.issues.length} alerts` : ''}</summary>
            <div className="draft-audit-scroll">

          <strong>Pieces · cm / cm²</strong>
          {draftAudit.pieces.map(piece=><button type="button" key={piece.id} onClick={()=>{onSelectPiece(piece.id);focusPieces(project.pieces.filter(p=>p.id===piece.id),12)}} className={selectedPieceId===piece.id?'selected':''}><span>{piece.name}</span><span>{piece.widthCm.toFixed(1)} × {piece.heightCm.toFixed(1)} · {piece.areaCm2.toFixed(1)} cm² · P {piece.perimeterCm.toFixed(1)}</span></button>)}
          <strong>Sewing length mismatch · cm</strong>
          {draftAudit.seams.length===0 && <p>No sewing relationships yet.</p>}
          {draftAudit.seams.map(seam=><button type="button" key={seam.id} className={`draft-seam-${seam.status}`} onClick={()=>{onSelectPiece(seam.pieceId);onChangeTool?.('sew')}}><span>{seam.name}</span><span>{seam.lengthA.toFixed(2)} / {seam.lengthB.toFixed(2)} · Δ {seam.difference.toFixed(2)} ({seam.mismatchPercent.toFixed(1)}%)</span></button>)}
          <p>Live 2D geometry audit only. Sewing mismatch does not certify 3D draping or manufacturing fit.</p>
            </div>
          </details>
        </div>,
        propertyDockHost
      )}
      <div className="canvas-scale"><span />10 cm</div>
    </div>
  )
}
