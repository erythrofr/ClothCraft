import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Hand,
  Move3D,
  Rotate3d,
  FolderOpen,
  ChevronDown,
  Box,
  Cpu,
  Download,
  Eye,
  FileDown,
  Link2,
  Lock,
  MapPin,
  MousePointer2,
  Pause,
  PenTool,
  Play,
  Plus,
  Redo2,
  Ruler,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Spline,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  ArrowDownToLine,
  Check,
  ChevronRight,
  CircleHelp,
  EyeOff,
  Focus,
  Grid3X3,
  LayoutPanelTop,
  Layers3,
  Maximize2,
  PanelLeft,
  PanelRight,
  Search,
  Settings2,
  Shirt,
  SlidersHorizontal,
  Star,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import PatternEditor from './components/PatternEditor.jsx'
import GarmentViewport from './components/GarmentViewport.jsx'
import ClothCraftWorkspace from './components/ClothCraftWorkspace.jsx'
import ClothCraftPreview from './components/ClothCraftPreview.jsx'
import FabricMaterialPreview from './components/FabricMaterialPreview.jsx'
import ZozoReferenceDressViewer from './components/ZozoReferenceDressViewer.jsx'
import WorkspaceCommandPalette from './components/WorkspaceCommandPalette.jsx'
import { loadZozoDressReference } from './core/zozoReferenceDress.js'
import { CLO_MENUS, GarmentSilhouette, LibraryChrome, ObjectBrowser } from './components/CloUI.jsx'
import RightToolPalette from './components/RightToolPalette.jsx'
import CloToolActionPanel from './components/CloToolActionPanel.jsx'
import {getClo7NativeCapability} from './core/clo7NativeToolCapabilities.js'
import CloPropertyEditorAccordion from './components/CloPropertyEditorAccordion.jsx'
import {applyCloDraftProperty,validateCloDraftProperty} from './core/cloPropertyCommands.js'
import PatternLibraryThumbnail from './components/PatternLibraryThumbnail.jsx'
import CadToolIcon from './components/CadToolIcon.jsx'
import MarkerPreview from './components/MarkerPreview.jsx'
import SeamWalkPreview from './components/SeamWalkPreview.jsx'
import { createDefaultProject, FABRIC_PRESETS, FABRIC_SCAN_COVERAGE } from './data/defaultProject.js'
import { WASH_EFFECTS, normalizeWashSpec } from './core/clothWashProcedurals.js'
import { digitalWashSuitability } from './core/fabricWashSuitability.js'
import { clo7FabricReadout } from './core/clo7FabricReadout.js'
import { calibrateFabricEvidence } from './core/fabricEvidenceCalibration.js'
import { fabricSwatchStyle } from './core/fabricSwatchStyle.js'
import { groupApparelPresets } from './data/apparelMaterialExpansion.js'
import { listHardwarePresets, getHardwarePreset, hardwareToPatternAnnotation } from './data/hardwarePresets.js'
import { CLOTHCRAFT_FABRICS } from './core/clothcraftFabrics.js'
import { createTemplateProject, GARMENT_TEMPLATES } from './data/templates.js'
import {CLO7_3D_A,CLO7_3D_B} from './data/clo7ToolbarOrder.js'
import { cloneProject, closestEdgeFraction, edgeLength, getEdgeSeamAllowance, makeRectanglePiece, pieceArea, projectArea, samplePieceBoundary, seamLengthReport, seamWalkReport, touchProject, uniqueId } from './core/project.js'
import { auditSewingConstruction, validateNewSeam } from './core/sewingConstruction.js'
import { draftingSplitFractions, splitParameterAtArcFraction } from './core/draftingSplit.js'
import { isDraftEditValid } from './core/draftingTopology.js'
import { unfoldDraftPiece } from './core/draftingUnfold.js'
import { pieceCenter } from './core/trims.js'
import { buildSizeRun, gradePointForPiece, gradeProject, sizeOffset } from './core/grading.js'
import { buildFabricMarkers, buildMarker } from './core/marker.js'
import { parseDxfPatterns, projectToDxf } from './core/dxf.js'
import { buildMeasurementSizeRun, buildTechPack, measurementRunToCSV } from './core/measurements.js'
import { parseSeamlyMeasurements, applySeamlyMeasurements } from './core/seamlyMeasurements.js'
import { parseSeamlyConstructionReference } from './core/seamlyConstructionReference.js'
import { WORKSPACE_PROFILES, WORKSPACE_PROFILE_KEY, WORKSPACE_VIEW_KEY, VIEWPORT_LAYOUTS, normalizeWorkspaceProfile } from './core/workspaceProfiles.js'
import { indexWorkspaceCommands } from './core/workspaceCommandIndex.js'
import { buildFactoryPackageZip } from './core/factoryPackage.js'
import { projectToBomXml } from './core/bomXml.js'
import { markerToPdf, markerToSvg } from './core/markerArtifacts.js'
import { inspectProduction } from './core/productionPreflight.js'
import { buildFabricCostRun } from './core/productionCost.js'
import { listSimulationBackends } from './core/backends/registry.js'
import { NATIVE_QUALITY_PROFILES } from './core/backends/nativePayload.js'
import { garmentCodeToProject, projectToGarmentCode } from './core/garmentCode.js'
import { getNativeServiceHealth } from './core/backends/nativeServiceClient.js'
import { getPpfServiceHealth, getPpfJob, getPpfJobPreview, submitPpfFinalSolve } from './core/backends/ppfServiceClient.js'
import { generateFabricPbrFromImage } from './core/fabricPbrGenerator.js'
import { classifyFabricPbrFilename } from './core/fabricPbrFileNaming.js'

// First-fit tests use an isolated autosave slot; opening a test tee must never
// replace the user's previously saved jeans, hoodie, or other working garment.
const TEE_TEST_SESSION = new URLSearchParams(window.location.search).get('testSession') === 'tee'
// Public builds must not advertise optional private or unbundled avatar assets.
const PUBLIC_DISTRIBUTION = import.meta.env.VITE_PUBLIC_DISTRIBUTION === '1'
const FABRIC_PRESET_GROUPS = groupApparelPresets(FABRIC_PRESETS)
const AVAILABLE_AVATARS = PUBLIC_DISTRIBUTION ? [{ name: 'MakeHuman', model: 'makehuman-base' }] : [
  { name: 'Theo', model: 'theo' },
  { name: 'Nora', model: 'nora' },
  { name: 'MakeHuman', model: 'makehuman-base' },
]
const OPTIONAL_AVATAR_URLS = {
  theo: '/avatars/opensew/theo.glb',
  nora: '/avatars/opensew/nora.glb',
}
const STORAGE_KEY = TEE_TEST_SESSION ? 'garment-studio-tee-first-fit-project-v2' : 'garment-studio-project-v1'
const MAX_HISTORY = 60
const SIMULATION_BACKENDS = listSimulationBackends()

const SECTIONS = ['Pattern', 'Sewing', 'Fabric', 'Avatar', 'Fit', 'Production', 'Render']
const STUDIO_COMMANDS = indexWorkspaceCommands(CLO_MENUS)

function loadProject() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if ((parsed.version || 1) < 21) {
        parsed.version = 21
        parsed.pieces = (parsed.pieces || []).map((piece) => ({
          ...piece,
          arrangement3d: {
            ...piece.arrangement3d,
            y: (piece.arrangement3d?.y ?? 0) < 0.7 ? 0.98 : piece.arrangement3d.y,
            z: Math.sign(piece.arrangement3d?.z || 1) * Math.min(0.255, Math.abs(piece.arrangement3d?.z || 0.245)),
            flip: piece.id === 'back' ? false : Boolean(piece.arrangement3d?.flip),
            wrap: piece.id === 'front' ? 'front' : piece.id === 'back' ? 'back' : piece.arrangement3d?.wrap,
          },
        }))
        parsed.simulation = {
          ...parsed.simulation,
          backendId: parsed.simulation?.backendId || 'browser-pbd',
          nativeQuality: parsed.simulation?.nativeQuality || (
            parsed.simulation?.nativeClothModel === 'strain-triangle' && parsed.simulation?.nativeBendingModel === 'isometric-xpbd'
              ? 'quality'
              : parsed.simulation?.nativeBendingModel === 'isometric-xpbd'
                ? 'balanced'
                : 'draft'
          ),
          nativeClothModel: parsed.simulation?.nativeClothModel || 'distance',
          nativeBendingModel: parsed.simulation?.nativeBendingModel || 'distance',
          autoFitTacks: parsed.simulation?.autoFitTacks !== false,
          substeps: Math.max(1, Math.min(4, Math.round(parsed.simulation?.substeps ?? 2))),
          resolution: Math.min(1, parsed.simulation?.resolution ?? 1),
          curveSegments: Math.max(2, Math.min(4, parsed.simulation?.curveSegments ?? 2)),
          collisions: parsed.simulation?.collisions !== false,
          selfCollision: parsed.simulation?.selfCollision !== false,
          selfCollisionMargin: parsed.simulation?.selfCollisionMargin ?? 0.002,
        }
        parsed.grading = {
          baseSize: parsed.grading?.baseSize || 'M',
          sizes: parsed.grading?.sizes?.length ? parsed.grading.sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
          widthPerSizeCm: parsed.grading?.widthPerSizeCm ?? 3,
          lengthPerSizeCm: parsed.grading?.lengthPerSizeCm ?? 1.2,
        }
        parsed.avatar = {
          ...parsed.avatar,
          armAngleDeg: parsed.avatar?.armAngleDeg ?? 6,
        }
        parsed.markerSettings = {
          fabricWidthCm: parsed.markerSettings?.fabricWidthCm ?? 150,
          gapCm: parsed.markerSettings?.gapCm ?? 1.5,
        }
        const defaults = createDefaultProject()
        const existingPieceIds = new Set((parsed.pieces || []).map((piece) => piece.id))
        for (const piece of defaults.pieces) {
          if (['sleeve-left', 'sleeve-right'].includes(piece.id) && !existingPieceIds.has(piece.id)) {
            parsed.pieces.push(cloneProject(piece))
          }
        }
        const existingSeamIds = new Set((parsed.seams || []).map((seam) => seam.id))
        for (const seam of defaults.seams) {
          if (seam.id.includes('sleeve-') && !existingSeamIds.has(seam.id)) parsed.seams.push(cloneProject(seam))
        }
        for (const defaultSeam of defaults.seams) {
          const currentSeam = parsed.seams.find((seam) => seam.id === defaultSeam.id)
          if (currentSeam && currentSeam.reverseB === undefined && defaultSeam.reverseB !== undefined) currentSeam.reverseB = defaultSeam.reverseB
        }
        for (const defaultPiece of defaults.pieces) {
          const currentPiece = parsed.pieces.find((piece) => piece.id === defaultPiece.id)
          if (currentPiece && !currentPiece.curves && defaultPiece.curves) currentPiece.curves = cloneProject(defaultPiece.curves)
          if (currentPiece && currentPiece.grainAngleDeg === undefined) currentPiece.grainAngleDeg = defaultPiece.grainAngleDeg ?? 0
          if (currentPiece && !currentPiece.notches?.length && defaultPiece.notches?.length) currentPiece.notches = cloneProject(defaultPiece.notches)
          if (currentPiece && !currentPiece.topstitches?.length && defaultPiece.topstitches?.length) currentPiece.topstitches = cloneProject(defaultPiece.topstitches)
          if (currentPiece && !currentPiece.bindings?.length && defaultPiece.bindings?.length) currentPiece.bindings = cloneProject(defaultPiece.bindings)
          if (currentPiece && currentPiece.simulationResolution === undefined && defaultPiece.simulationResolution !== undefined) currentPiece.simulationResolution = defaultPiece.simulationResolution
        }
        for (const piece of parsed.pieces || []) {
          if (piece.grainAngleDeg === undefined) piece.grainAngleDeg = 0
          piece.layerIndex = Math.max(0, Math.min(8, Math.round(piece.layerIndex || 0)))
          piece.notches = piece.notches || []
          piece.topstitches = piece.topstitches || []
          piece.bindings = piece.bindings || []
          piece.graphics = piece.graphics || []
          piece.zippers = piece.zippers || []
          piece.buttons = piece.buttons || []
          piece.buttonholes = piece.buttonholes || []
          piece.surfaceAttachments = piece.surfaceAttachments || []
          piece.cutQuantity = Math.max(1, Math.round(piece.cutQuantity || 1))
          piece.marker = piece.marker || { allowCrossGrain: false }
          piece.frozen3d = piece.frozen3d === true
          piece.active3d = piece.active3d !== false
        }
        parsed.fabrics = parsed.fabrics || { main: { ...FABRIC_PRESETS.fleece, id: 'main', name: 'Main Fabric' } }
        for (const [fabricId, fabricItem] of Object.entries(parsed.fabrics)) {
          fabricItem.id = fabricItem.id || fabricId
          fabricItem.name = fabricItem.name || (fabricId === 'main' ? 'Main Fabric' : fabricId)
        }
        const leftSleeve = parsed.pieces.find((piece) => piece.id === 'sleeve-left')
        const rightSleeve = parsed.pieces.find((piece) => piece.id === 'sleeve-right')
        if (leftSleeve?.arrangement3d) leftSleeve.arrangement3d.x = -0.285
        if (rightSleeve?.arrangement3d) rightSleeve.arrangement3d.x = 0.285
      }
      parsed.fasteners = parsed.fasteners || []
      parsed.customMeasurements = parsed.customMeasurements || []
      parsed.avatar = {
        ...createDefaultProject().avatar,
        ...(parsed.avatar || {}),
      }
      parsed.simulation = parsed.simulation || createDefaultProject().simulation
      parsed.simulation.wind = {
        enabled: Boolean(parsed.simulation.wind?.enabled),
        speed: parsed.simulation.wind?.speed ?? 4,
        directionDeg: parsed.simulation.wind?.directionDeg ?? 0,
        turbulence: parsed.simulation.wind?.turbulence ?? 0.18,
        response: parsed.simulation.wind?.response ?? 0.025,
      }
      // This distributed fork deliberately excludes the private CLO avatar.
      // Preserve the garment, but load a documented neutral mannequin instead.
      if (parsed.avatar?.model === 'clo-thomas') parsed.avatar = { ...parsed.avatar, name: 'MakeHuman', model: 'makehuman-base' }
      if (PUBLIC_DISTRIBUTION && !['makehuman-base', 'custom-export'].includes(parsed.avatar?.model)) {
        parsed.avatar = { ...parsed.avatar, model: 'makehuman-base', name: 'MakeHuman' }
      }
      return parsed
    }
  } catch (error) {
    console.warn('Could not restore garment project', error)
  }
  const initial = TEE_TEST_SESSION ? createTemplateProject('tee') : createDefaultProject()
  return initial
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)))
}

function splitPieceEdgeInProject(next, pieceId, edgeIndex, t = 0.5) {
  const piece = next.pieces.find((item) => item.id === pieceId)
  if (!piece || piece.points.length < 2) return null
  const count = piece.points.length
  const a = piece.points[edgeIndex]
  const b = piece.points[(edgeIndex + 1) % count]
  if (!a || !b) return null
  const safeT = Math.max(0.05, Math.min(0.95, t))
  const oldCurves = { ...(piece.curves || {}) }
  const oldEdgeAllowances = { ...(piece.edgeSeamAllowances || {}) }
  const curve = oldCurves[edgeIndex]
  let inserted
  let leftControl = null
  let rightControl = null
  if (curve) {
    const q0 = {
      x: a.x + (curve.cx - a.x) * safeT,
      y: a.y + (curve.cy - a.y) * safeT,
    }
    const q1 = {
      x: curve.cx + (b.x - curve.cx) * safeT,
      y: curve.cy + (b.y - curve.cy) * safeT,
    }
    inserted = {
      x: q0.x + (q1.x - q0.x) * safeT,
      y: q0.y + (q1.y - q0.y) * safeT,
    }
    leftControl = { cx: q0.x, cy: q0.y }
    rightControl = { cx: q1.x, cy: q1.y }
  } else {
    inserted = {
      x: a.x + (b.x - a.x) * safeT,
      y: a.y + (b.y - a.y) * safeT,
    }
  }
  if (a.gradeRule?.enabled && b.gradeRule?.enabled) {
    inserted.gradeRule = {
      enabled: true,
      dxPerSize: Number(a.gradeRule.dxPerSize || 0) + (Number(b.gradeRule.dxPerSize || 0) - Number(a.gradeRule.dxPerSize || 0)) * safeT,
      dyPerSize: Number(a.gradeRule.dyPerSize || 0) + (Number(b.gradeRule.dyPerSize || 0) - Number(a.gradeRule.dyPerSize || 0)) * safeT,
    }
  }

  const splitArcFraction = closestEdgeFraction(piece, edgeIndex, inserted, 64)
  piece.points.splice(edgeIndex + 1, 0, inserted)

  const nextCurves = {}
  for (const [rawIndex, value] of Object.entries(oldCurves)) {
    const index = Number(rawIndex)
    if (index === edgeIndex) continue
    nextCurves[index > edgeIndex ? index + 1 : index] = value
  }
  if (leftControl) nextCurves[edgeIndex] = leftControl
  if (rightControl) nextCurves[edgeIndex + 1] = rightControl
  piece.curves = nextCurves
  const nextEdgeAllowances = {}
  for (const [rawIndex, value] of Object.entries(oldEdgeAllowances)) {
    const index = Number(rawIndex)
    if (index < edgeIndex) nextEdgeAllowances[index] = value
    else if (index > edgeIndex) nextEdgeAllowances[index + 1] = value
    else {
      nextEdgeAllowances[edgeIndex] = value
      nextEdgeAllowances[edgeIndex + 1] = value
    }
  }
  piece.edgeSeamAllowances = nextEdgeAllowances

  piece.notches = (piece.notches || []).map((notch) => {
    if (notch.edgeIndex < edgeIndex) return notch
    if (notch.edgeIndex > edgeIndex) return { ...notch, edgeIndex: notch.edgeIndex + 1 }
    const notchT = Math.max(0, Math.min(1, notch.t ?? 0.5))
    if (notchT <= splitArcFraction) return { ...notch, t: splitArcFraction > 0 ? notchT / splitArcFraction : 0 }
    return {
      ...notch,
      edgeIndex: edgeIndex + 1,
      t: (notchT - splitArcFraction) / Math.max(0.001, 1 - splitArcFraction),
    }
  })

  for (const collection of ['topstitches', 'bindings', 'zippers']) {
    const remapped = []
    for (const item of piece[collection] || []) {
      if (item.edgeIndex < edgeIndex) remapped.push(item)
      else if (item.edgeIndex > edgeIndex) remapped.push({ ...item, edgeIndex: item.edgeIndex + 1 })
      else {
        remapped.push({ ...item, edgeIndex })
        remapped.push({ ...item, id: uniqueId(`${collection}-split`), edgeIndex: edgeIndex + 1 })
      }
    }
    piece[collection] = remapped
  }

  const endpointRange = (endpoint) => {
    let start = clamp(Number(endpoint?.startT ?? 0), 0, 1)
    let end = clamp(Number(endpoint?.endT ?? 1), 0, 1)
    if (start > end) [start, end] = [end, start]
    return { start, end }
  }
  const rangedEndpoint = (endpoint, nextEdgeIndex, start, end) => {
    const result = { ...endpoint, edgeIndex: nextEdgeIndex }
    if (start <= 0.0001 && end >= 0.9999) {
      delete result.startT
      delete result.endT
    } else {
      result.startT = clamp(start, 0, 1)
      result.endT = clamp(end, 0, 1)
    }
    return result
  }
  const shiftedEndpoint = (endpoint) => (
    endpoint.pieceId === pieceId && endpoint.edgeIndex > edgeIndex
      ? { ...endpoint, edgeIndex: endpoint.edgeIndex + 1 }
      : { ...endpoint }
  )
  const splitLocalEndpoint = (endpoint) => {
    const { start, end } = endpointRange(endpoint)
    const split = splitArcFraction
    if (end <= split + 1e-6) {
      return { single: rangedEndpoint(endpoint, edgeIndex, start / Math.max(split, 1e-6), end / Math.max(split, 1e-6)) }
    }
    if (start >= split - 1e-6) {
      const denominator = Math.max(1e-6, 1 - split)
      return { single: rangedEndpoint(endpoint, edgeIndex + 1, (start - split) / denominator, (end - split) / denominator) }
    }
    const progress = (split - start) / Math.max(1e-6, end - start)
    return {
      progress: clamp(progress, 0, 1),
      low: rangedEndpoint(endpoint, edgeIndex, start / Math.max(split, 1e-6), 1),
      high: rangedEndpoint(endpoint, edgeIndex + 1, 0, (end - split) / Math.max(1e-6, 1 - split)),
    }
  }

  const remappedSeams = []
  const splitSeamGroups = new Map()
  for (const sourceSeam of next.seams || []) {
    const seam = cloneProject(sourceSeam)
    const aMatches = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === edgeIndex
    const bMatches = seam.b?.pieceId === pieceId && seam.b?.edgeIndex === edgeIndex
    if (!aMatches && !bMatches) {
      seam.a = shiftedEndpoint(seam.a)
      seam.b = shiftedEndpoint(seam.b)
      remappedSeams.push(seam)
      continue
    }
    // Sewing one edge to itself is not a normal garment construction case;
    // keep it deterministic by remapping each endpoint independently rather
    // than multiplying the seam graph combinatorially.
    if (aMatches && bMatches) {
      const aSplit = splitLocalEndpoint(seam.a)
      const bSplit = splitLocalEndpoint(seam.b)
      seam.a = aSplit.single || aSplit.low
      seam.b = bSplit.single || bSplit.low
      remappedSeams.push(seam)
      continue
    }

    const side = aMatches ? 'a' : 'b'
    const otherSide = aMatches ? 'b' : 'a'
    const local = splitLocalEndpoint(seam[side])
    seam[otherSide] = shiftedEndpoint(seam[otherSide])
    if (local.single) {
      seam[side] = local.single
      remappedSeams.push(seam)
      continue
    }

    const other = seam[otherSide]
    const otherRange = endpointRange(other)
    const reverse = Boolean(seam.reverseB)
    const splitProgress = local.progress
    let firstOther
    let secondOther
    if (side === 'a') {
      const splitOther = reverse
        ? otherRange.end - (otherRange.end - otherRange.start) * splitProgress
        : otherRange.start + (otherRange.end - otherRange.start) * splitProgress
      firstOther = reverse
        ? rangedEndpoint(other, other.edgeIndex, splitOther, otherRange.end)
        : rangedEndpoint(other, other.edgeIndex, otherRange.start, splitOther)
      secondOther = reverse
        ? rangedEndpoint(other, other.edgeIndex, otherRange.start, splitOther)
        : rangedEndpoint(other, other.edgeIndex, splitOther, otherRange.end)
      seam.a = local.low
      seam.b = firstOther
      const second = { ...cloneProject(seam), id: uniqueId('seam-split'), name: `${sourceSeam.name || sourceSeam.id} · 2`, a: local.high, b: secondOther }
      remappedSeams.push(seam, second)
      splitSeamGroups.set(sourceSeam.id, [seam.id, second.id])
    } else {
      const progressAlongA = reverse ? 1 - splitProgress : splitProgress
      const safeProgress = clamp(progressAlongA, 0, 1)
      const splitOther = otherRange.start + (otherRange.end - otherRange.start) * safeProgress
      firstOther = rangedEndpoint(other, other.edgeIndex, otherRange.start, splitOther)
      secondOther = rangedEndpoint(other, other.edgeIndex, splitOther, otherRange.end)
      seam.a = firstOther
      seam.b = reverse ? local.high : local.low
      const second = { ...cloneProject(seam), id: uniqueId('seam-split'), name: `${sourceSeam.name || sourceSeam.id} · 2`, a: secondOther, b: reverse ? local.low : local.high }
      remappedSeams.push(seam, second)
      splitSeamGroups.set(sourceSeam.id, [seam.id, second.id])
    }
  }
  next.seams = remappedSeams

  if (splitSeamGroups.size) {
    const endpointContainsNotch = (endpoint, notchPieceId, notchEdgeIndex, notchT) => {
      if (!endpoint || endpoint.pieceId !== notchPieceId || endpoint.edgeIndex !== notchEdgeIndex) return false
      const { start, end } = endpointRange(endpoint)
      const tValue = clamp(Number(notchT ?? 0.5), 0, 1)
      return tValue >= start - 0.002 && tValue <= end + 0.002
    }
    const groups = new Map()
    for (const pattern of next.pieces || []) {
      for (const notch of pattern.notches || []) {
        if (!notch.matchGroupId || !notch.matchedSeamId || !splitSeamGroups.has(notch.matchedSeamId)) continue
        if (!groups.has(notch.matchGroupId)) groups.set(notch.matchGroupId, [])
        groups.get(notch.matchGroupId).push({ pattern, notch })
      }
    }
    for (const entries of groups.values()) {
      const sourceSeamId = entries[0]?.notch?.matchedSeamId
      const candidateIds = splitSeamGroups.get(sourceSeamId) || []
      const candidate = candidateIds
        .map((candidateId) => next.seams.find((item) => item.id === candidateId))
        .find((candidateSeam) => candidateSeam && entries.every(({ pattern, notch }) => (
          endpointContainsNotch(candidateSeam.a, pattern.id, notch.edgeIndex, notch.t) ||
          endpointContainsNotch(candidateSeam.b, pattern.id, notch.edgeIndex, notch.t)
        )))
      if (!candidate) continue
      for (const { notch } of entries) notch.matchedSeamId = candidate.id
    }
  }

  return { inserted, splitArcFraction }
}

function NumberField({ value, onChange, min, max, step = 1, suffix, ariaLabel }) {
  return (
    <label className="number-field">
      <input
        type="number"
        value={Number(value).toFixed(step < 1 ? 2 : 0).replace(/\.00$/, '')}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  )
}

function SliderRow({ label, value, min, max, step, onChange, display }) {
  return (
    <div className="control-row slider-row">
      <div className="control-label"><span>{label}</span><strong>{display ?? value}</strong></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function MiniStat({ label, value }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>
}

function mirroredEdgeIndex(edgeIndex, edgeCount) {
  return (edgeCount - 2 - Number(edgeIndex) + edgeCount) % edgeCount
}

function seamRange(endpoint) {
  let start = clamp(Number(endpoint?.startT ?? 0), 0, 1)
  let end = clamp(Number(endpoint?.endT ?? 1), 0, 1)
  if (start > end) [start, end] = [end, start]
  return { start, end, span: Math.max(1e-6, end - start) }
}

function seamFractionAtProgress(seam, side, progress) {
  const q = clamp(progress, 0, 1)
  const range = seamRange(seam?.[side])
  if (side === 'b' && seam?.reverseB) return range.end - range.span * q
  return range.start + range.span * q
}

function mapFractionAcrossSeam(seam, fromSide, fraction) {
  const sourceRange = seamRange(seam?.[fromSide])
  const naturalProgress = clamp((Number(fraction) - sourceRange.start) / sourceRange.span, 0, 1)
  const seamProgress = fromSide === 'b' && seam?.reverseB ? 1 - naturalProgress : naturalProgress
  const targetSide = fromSide === 'a' ? 'b' : 'a'
  return seamFractionAtProgress(seam, targetSide, seamProgress)
}

function buildLinkedMirror(source, target) {
  if (!source?.points?.length || !target) return target
  const xs = source.points.map((point) => point.x)
  const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5
  const edgeCount = source.points.length
  const mirrorPoint = (point) => ({ ...point, x: centerX - (point.x - centerX) })
  const keep = {
    id: target.id,
    name: target.name,
    layout2d: cloneProject(target.layout2d),
    arrangement3d: cloneProject(target.arrangement3d),
    linkedMirrorSourceId: source.id,
  }
  const next = cloneProject(source)
  Object.assign(next, keep)
  next.points = source.points.map(mirrorPoint).reverse()
  next.curves = source.curves
    ? Object.fromEntries(Object.entries(source.curves).map(([edgeIndex, curve]) => [
      mirroredEdgeIndex(edgeIndex, edgeCount),
      { cx: centerX - (curve.cx - centerX), cy: curve.cy },
    ]))
    : undefined
  next.internalLines = (source.internalLines || []).map((line) => ({
    ...cloneProject(line),
    id: `${target.id}-${line.id}`,
    a: mirrorPoint(line.a),
    b: mirrorPoint(line.b),
  }))
  next.pins = (source.pins || []).map((pin) => ({ ...cloneProject(pin), id: `${target.id}-${pin.id}`, x: centerX - (pin.x - centerX) }))
  next.buttons = (source.buttons || []).map((button) => ({ ...cloneProject(button), id: `${target.id}-${button.id}`, x: centerX - (button.x - centerX) }))
  next.buttonholes = (source.buttonholes || []).map((buttonhole) => ({
    ...cloneProject(buttonhole),
    id: `${target.id}-${buttonhole.id}`,
    x: centerX - (buttonhole.x - centerX),
    orientationDeg: -(buttonhole.orientationDeg || 0),
  }))
  next.graphics = (source.graphics || []).map((graphic) => ({
    ...cloneProject(graphic),
    id: `${target.id}-${graphic.id}`,
    x: centerX - (graphic.x - centerX),
    rotationDeg: -(graphic.rotationDeg || 0),
  }))
  next.notches = (source.notches || []).map((notch) => ({
    ...cloneProject(notch),
    id: `${target.id}-${notch.id}`,
    edgeIndex: mirroredEdgeIndex(notch.edgeIndex, edgeCount),
    t: 1 - (notch.t ?? 0.5),
  }))
  for (const collection of ['topstitches', 'bindings', 'zippers']) {
    next[collection] = (source[collection] || []).map((item) => ({
      ...cloneProject(item),
      id: `${target.id}-${item.id}`,
      edgeIndex: mirroredEdgeIndex(item.edgeIndex, edgeCount),
    }))
  }
  next.grainAngleDeg = -(source.grainAngleDeg || 0)
  return next
}

function syncLinkedMirrors(project) {
  const pieces = project.pieces || []
  const sources = new Map(pieces.map((piece) => [piece.id, piece]))
  project.pieces = pieces.map((piece) => {
    if (!piece.linkedMirrorSourceId) return piece
    const source = sources.get(piece.linkedMirrorSourceId)
    return source ? buildLinkedMirror(source, piece) : { ...piece, linkedMirrorSourceId: undefined }
  })
}

function imageFileToDataUrl(file, maxDimension = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Unsupported image file'))
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const width = Math.max(1, Math.round(image.naturalWidth * scale))
        const height = Math.max(1, Math.round(image.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)
        resolve({
          src: canvas.toDataURL('image/png'),
          sourceWidth: image.naturalWidth,
          sourceHeight: image.naturalHeight,
        })
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function App() {
  // The hybrid reuses the *entire* real EXO chrome, including original menus,
  // asset library, both tool rails, object browser and property editor. Only
  // the dual 3D/2D center is replaced with the native ClothCraft workspace.
  const clothcraftHybrid = new URLSearchParams(window.location.search).get('engine') === 'clothcraft'
  const [project, setProject] = useState(loadProject)
  const sewingConstructionAudit = useMemo(() => auditSewingConstruction(project), [project])
  const [selectedPieceId, setSelectedPieceId] = useState('front')
  const [activeSection, setActiveSection] = useState('Pattern')
  const [tool, setTool] = useState('select')
  // Selected flat fabric starts with an on-garment unified XYZ + rotation
  // gizmo, not a camera-orientation circle floating in the corner.
  const [viewportTool, setViewportTool] = useState('transform')
  // 3D mesh inspection is intentionally a non-destructive selection mode.
  // Unlike physical cloth editing it doesn't alter the pattern or solver.
  const [meshSelection, setMeshSelection] = useState(null)
  const [showSewingGuides, setShowSewingGuides] = useState(true)
  const [arrangementSpread, setArrangementSpread] = useState(0)
  const [assetCategory, setAssetCategory] = useState('Garment')
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryThumbnails, setLibraryThumbnails] = useState(true)
  const [objectTab, setObjectTab] = useState('Scene')
  const [openMenu, setOpenMenu] = useState(null)
  const [simulationMenuOpen, setSimulationMenuOpen] = useState(false)
  const [leftSimulationMenuOpen, setLeftSimulationMenuOpen] = useState(false)
  const [show2DGrid, setShow2DGrid] = useState(true)
  const [show2DSeams, setShow2DSeams] = useState(false)
  const [layout2DSignal, setLayout2DSignal] = useState(0)
  const [compactTools, setCompactTools] = useState(false)
  // Default to actions that actually work. The complete 70-slot CLO
  // reference remains opt-in as an audit map, not the daily editing toolbar.
  // The verified CLO7 A/B physical order is always visible by default.
  // Unsupported actions are disabled, not hidden or attached to wrong tools.
  const [show3DToolMap, setShow3DToolMap] = useState(true)
  const [selectedCloTool, setSelectedCloTool] = useState(null)
  const [showObjectBrowser, setShowObjectBrowser] = useState(true)
  const [libraryVisible, setLibraryVisible] = useState(true)
  const [inspectorVisible, setInspectorVisible] = useState(true)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [viewportLayout, setViewportLayout] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(WORKSPACE_VIEW_KEY) || '{}').layout; return Object.hasOwn(VIEWPORT_LAYOUTS, value) ? value : 'split' } catch { return 'split' }
  })
  const [viewportSplit, setViewportSplit] = useState(() => {
    try { return clamp(JSON.parse(localStorage.getItem(WORKSPACE_VIEW_KEY) || '{}').split ?? 50, 20, 80) } catch { return 50 }
  })
  const viewportResizeRef = useRef(null)
  // Workspace chrome has its own preferences; changing panel dimensions must
  // never alter the stored garment or the physics history.
  const [libraryWidth, setLibraryWidth] = useState(() => {
    try { return clamp(localStorage.getItem('garment-studio-library-width') || 232, 160, 350) } catch { return 232 }
  })
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    try { return clamp(localStorage.getItem('garment-studio-inspector-width') || 392, 295, 540) } catch { return 392 }
  })
  const [objectBrowserHeight, setObjectBrowserHeight] = useState(() => {
    try { return clamp(localStorage.getItem('garment-studio-object-browser-height') || 390, 230, 650) } catch { return 390 }
  })
  const [sidebarView, setSidebarView] = useState('library')
  const panelDragRef = useRef(null)
  const [showTopWorkspaceTabs, setShowTopWorkspaceTabs] = useState(() => {
    try { return localStorage.getItem('garment-studio-show-top-tabs') !== 'false' } catch { return true }
  })
  const [fitCameraSignal, setFitCameraSignal] = useState(0)
  const [running, setRunning] = useState(false)
  const [clothcraftLive, setClothcraftLive] = useState(null)
  const [selectedDraftEdge, setSelectedDraftEdge] = useState(null)
  const [hasSimulated, setHasSimulated] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [analysisMode, setAnalysisMode] = useState('surface')
  const [selectedFabricId, setSelectedFabricId] = useState('main')
  const [selectedObjectForProperties, setSelectedObjectForProperties] = useState(null)
  const onDraftEdgeSelection=useCallback(value=>{
    setSelectedDraftEdge(previous=>previous?.pieceId===value?.pieceId&&previous?.edgeIndex===value?.edgeIndex?previous:value)
    if(value)setSelectedObjectForProperties(null)
  },[])
  const [markerFabricId, setMarkerFabricId] = useState('main')
  const [seamWalkId, setSeamWalkId] = useState(null)
  const [seamWalkProgress, setSeamWalkProgress] = useState(0.5)
  const [trimEdgeIndex, setTrimEdgeIndex] = useState(0)
  const [hardwareChoice, setHardwareChoice] = useState({
    button:'four-hole-shirt-button', buttonhole:'horizontal-buttonhole', zipper:'coil-zipper-5',
  })
  const [gradePreviewSize, setGradePreviewSize] = useState('M')
  const [showGradeNest, setShowGradeNest] = useState(false)
  const [exportSelectedPatternOnly, setExportSelectedPatternOnly] = useState(false)
  const [meshExportSignal, setMeshExportSignal] = useState(0)
  const [glbExportSignal, setGlbExportSignal] = useState(0)
  const [renderSignal, setRenderSignal] = useState(0)
  const [nativeSolveSignal, setNativeSolveSignal] = useState(0)
  const [nativeServiceStatus, setNativeServiceStatus] = useState('checking')
  const [nativeSolveStatus, setNativeSolveStatus] = useState('idle')
  const [nativeLastSolve, setNativeLastSolve] = useState(null)
  // A short solver proof is safe by default on Apple Metal; large frame runs
  // can spend minutes resolving sleeve/body contacts before reaching a drape.
  const [ppfFrames, setPpfFrames] = useState(60)
  const [ppfSewing, setPpfSewing] = useState({ status: 'idle', phase: 'idle', jobId: null, error: null, summary: null, artifacts: null })
  const [ppfPreview, setPpfPreview] = useState(null)
  const [ppfPreviewError, setPpfPreviewError] = useState('')
  const [ppfPreviewLoading, setPpfPreviewLoading] = useState(false)
  const [zozoReference, setZozoReference] = useState(null)
  const [zozoReferenceLoading, setZozoReferenceLoading] = useState(false)
  const [zozoReferenceError, setZozoReferenceError] = useState('')
  const [zozoReferenceFrame, setZozoReferenceFrame] = useState(240)
  const [zozoReferencePlaying, setZozoReferencePlaying] = useState(false)
  const [zozoReferenceBodyVisible, setZozoReferenceBodyVisible] = useState(true)
  const [automaticPpfOnSimulate, setAutomaticPpfOnSimulate] = useState(() => {
    try { return localStorage.getItem('garment-studio-auto-ppf-on-simulate-v1') === 'true' } catch { return false }
  })
  const ppfAutoRunRequestRef = useRef(false)
  const [hdriUrl, setHdriUrl] = useState('')
  const [hdriName, setHdriName] = useState('')
  const [resetSignal, setResetSignal] = useState(0)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [saveState, setSaveState] = useState('saved')
  const [stats, setStats] = useState({ vertices: 0, constraints: 0, seams: 0, fasteners: 0, treatments: 0, trims: 0, anchors: 0, manualPins: 0, internal: 0, elapsed: 0, averageStrain: 0, maxStrain: 0, averageEaseCm: 0, averagePressureIndex: 0, maxPressureIndex: 0, contactRatio: 0, tightRatio: 0, looseRatio: 0, backendId: 'browser-pbd', backendFrame: 0, backendElapsedMs: 0, backendError: null })
  const [command, setCommand] = useState('')
  const [commandResult, setCommandResult] = useState('Ready for garment commands')
  const [avatarAvailability, setAvatarAvailability] = useState({ 'makehuman-base': true })
  const [clothCraftBusy, setClothCraftBusy] = useState(false)
  const [clothCraftMeshPreview, setClothCraftMeshPreview] = useState(null)
  const [clothCraftContactSteps, setClothCraftContactSteps] = useState(3)
  const [clothCraftContactResult, setClothCraftContactResult] = useState(null)
  useEffect(() => {
    let active = true
    // A private desktop build can have different installed avatar assets than
    // the source checkout. Do not offer nonexistent CLO/rigged meshes as usable.
    void Promise.all(Object.entries(OPTIONAL_AVATAR_URLS).map(async ([model, url]) => {
      try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-store' })
        return [model, response.ok]
      } catch { return [model, false] }
    })).then(entries => {
      if (!active) return
      setAvatarAvailability(current => ({ ...current, ...Object.fromEntries(entries) }))
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const selected = project.avatar?.model
    if (avatarAvailability[selected] !== false) return
    mutateProject(next => {
      next.avatar.model = 'makehuman-base'
      next.avatar.name = 'MakeHuman Base'
    })
    setCommandResult(`${selected} model is not installed in this build. Restored MakeHuman without changing the garment or measurements.`)
  }, [avatarAvailability, project.avatar?.model])
  const [transformDraft, setTransformDraft] = useState({ scaleX: 100, scaleY: 100, rotateDeg: 0, slashCm: 4 })
  const importInputRef = useRef(null)
  const seamlyMeasureInputRef = useRef(null)
  const seamlyPatternInputRef = useRef(null)
  const graphicInputRef = useRef(null)
  const fabricTextureInputRef = useRef(null)
  const fabricEvidenceInputRef = useRef(null)
  const fabricNormalInputRef = useRef(null)
  const fabricRoughnessInputRef = useRef(null)
  const fabricMetalnessInputRef = useRef(null)
  const fabricOpacityInputRef = useRef(null)
  const fabricDisplacementInputRef = useRef(null)
  const fabricPbrSetInputRef = useRef(null)
  const [fabricGeneratingPbr, setFabricGeneratingPbr] = useState(false)
  const hdriInputRef = useRef(null)
  const avatarMeshInputRef = useRef(null)
  const [customAvatar, setCustomAvatar] = useState(null)

  useEffect(() => {
    let active = true
    getNativeServiceHealth()
      .then((health) => { if (active) setNativeServiceStatus(health?.ok ? 'ready' : 'offline') })
      .catch(() => { if (active) setNativeServiceStatus('offline') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('garment-studio-show-top-tabs', String(showTopWorkspaceTabs)) } catch { /* browser privacy mode */ }
  }, [showTopWorkspaceTabs])
  useEffect(() => {
    try { localStorage.setItem(WORKSPACE_VIEW_KEY, JSON.stringify({layout: viewportLayout, split: viewportSplit})) } catch { /* browser privacy mode */ }
  }, [viewportLayout, viewportSplit])
  useEffect(() => {
    const onPaletteShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(open => !open)
      } else if (event.key === 'Escape') setCommandPaletteOpen(false)
    }
    window.addEventListener('keydown', onPaletteShortcut, true)
    return () => window.removeEventListener('keydown', onPaletteShortcut, true)
  }, [])
  useEffect(() => {
    try { localStorage.setItem('garment-studio-auto-ppf-on-simulate-v1', String(automaticPpfOnSimulate)) } catch { /* browser privacy mode */ }
  }, [automaticPpfOnSimulate])
  useEffect(() => {
    try {
      localStorage.setItem('garment-studio-library-width', String(libraryWidth))
      localStorage.setItem('garment-studio-inspector-width', String(inspectorWidth))
      localStorage.setItem('garment-studio-object-browser-height', String(objectBrowserHeight))
    } catch { /* browser privacy mode */ }
  }, [libraryWidth, inspectorWidth, objectBrowserHeight])
  const beginPanelResize = (panel, event) => {
    if (event.button !== 0) return
    event.preventDefault()
    panelDragRef.current = { panel, x: event.clientX, y: event.clientY, libraryWidth, inspectorWidth, objectBrowserHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const movePanelResize = (event) => {
    const start = panelDragRef.current
    if (!start) return
    if (start.panel === 'library') setLibraryWidth(clamp(start.libraryWidth + event.clientX - start.x, 160, Math.min(350, window.innerWidth * .25)))
    if (start.panel === 'inspector') setInspectorWidth(clamp(start.inspectorWidth + start.x - event.clientX, 295, Math.min(540, window.innerWidth * .42)))
    if (start.panel === 'objects') setObjectBrowserHeight(clamp(start.objectBrowserHeight + event.clientY - start.y, 230, Math.max(270, window.innerHeight - 300)))
  }
  const endPanelResize = () => { panelDragRef.current = null }

  // Resizable 3D/2D divider is a workspace preference, not garment geometry.
  const beginViewportResize = event => {
    if (event.button !== 0 || !['split','stack'].includes(viewportLayout)) return
    event.preventDefault()
    viewportResizeRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveViewportResize = event => {
    if (viewportResizeRef.current !== event.pointerId) return
    const rect = event.currentTarget.parentElement.getBoundingClientRect()
    const stacked = viewportLayout === 'stack'
    const size = stacked ? rect.height : rect.width
    const position = stacked ? event.clientY - rect.top : event.clientX - rect.left
    if (size > 1) setViewportSplit(Math.round(clamp(position / size * 100, 20, 80)))
  }
  const endViewportResize = () => { viewportResizeRef.current = null }

  const applyWorkspaceProfile = (source, { announce = true } = {}) => {
    const profile = normalizeWorkspaceProfile(source)
    setActiveSection(profile.section)
    setObjectTab(profile.tab)
    setTool(profile.tool)
    setViewportTool(profile.viewportTool)
    setLibraryWidth(profile.libraryWidth)
    setInspectorWidth(profile.inspectorWidth)
    setObjectBrowserHeight(profile.objectBrowserHeight)
    setShowObjectBrowser(profile.objectBrowserVisible)
    setShowTopWorkspaceTabs(profile.topTabsVisible)
    setLibraryVisible(profile.libraryVisible)
    setInspectorVisible(profile.inspectorVisible)
    setViewportLayout(profile.viewportLayout)
    setViewportSplit(profile.viewportSplit)
    if (announce) setCommandResult(`Applied ${profile.name}. Garment geometry, saved physics and editing history remain unchanged.`)
    return profile
  }

  const saveCustomWorkspace = () => {
    const profile = normalizeWorkspaceProfile({
      name: 'My workspace', section: activeSection, tab: objectTab, tool, viewportTool,
      libraryWidth, inspectorWidth, objectBrowserHeight,
      objectBrowserVisible: showObjectBrowser, topTabsVisible: showTopWorkspaceTabs,
      libraryVisible, inspectorVisible,
      viewportLayout, viewportSplit,
    })
    try {
      localStorage.setItem(WORKSPACE_PROFILE_KEY, JSON.stringify(profile))
      setCommandResult('Saved custom workspace layout and tool focus separately from the garment document.')
    } catch {
      setCommandResult('Could not store this workspace layout; check local browser storage permissions.')
    }
  }

  const restoreCustomWorkspace = () => {
    try {
      const source = localStorage.getItem(WORKSPACE_PROFILE_KEY)
      if (!source) throw new Error('No custom layout has been saved')
      applyWorkspaceProfile(JSON.parse(source))
    } catch (error) {
      setCommandResult(`Unable to restore saved workspace: ${error.message}`)
    }
  }

  // Pattern drafting starts without a web of sewing links. Switching into
  // Sewing restores the exact correspondence lines for edge matching.
  // The SEAMS toggle within each workspace remains a manual override.
  useEffect(() => {
    setShow2DSeams(activeSection === 'Sewing')
  }, [activeSection])

  // Preserve drape mode while editing pattern geometry. The viewport builds a
  // fresh physical mesh for changed topology and re-establishes the canonical
  // body dressing pose, rather than returning the garment to flat staging.
  useEffect(() => {
    setArrangementSpread(0)
  }, [project.revision])

  const toggleSimulation = () => {
    if (running) { setRunning(false); return }
    setArrangementSpread(0)
    setHasSimulated(true)
    setRunning(true)
    // Trigger the optional higher-fidelity local Metal contact solve only on
    // the initial garment drape, never when simply resuming paused fabric.
    // It runs in isolation from the interactive PBD solve. A contact-invalid
    // result cannot replace the user’s cloth, patterns or source seams.
    if (!hasSimulated && automaticPpfOnSimulate && project.seams.length) {
      ppfAutoRunRequestRef.current = true
    }
  }

  const applyGarmentTemplate = (templateId) => {
    const next = createTemplateProject(templateId)
    pushUndo(cloneProject(project))
    setProject(next)
    setSelectedPieceId(next.pieces[0]?.id || null)
    setSelectedFabricId(Object.keys(next.fabrics || {})[0] || 'main')
    setMarkerFabricId(Object.keys(next.fabrics || {})[0] || 'main')
    setSeamWalkId(null)
    setSeamWalkProgress(0.5)
    setGradePreviewSize(next.grading?.baseSize || 'M')
    setTool('select')
    setRunning(false)
    setAnalysisMode('surface')
    setResetSignal((signal) => signal + 1)
    setCommandResult(`Loaded ${next.name} foundation with ${next.pieces.length} pattern${next.pieces.length === 1 ? '' : 's'} and ${next.seams.length} sewing relationship${next.seams.length === 1 ? '' : 's'}`)
  }
  const correctTeeArmholes = () => {
    const reference = createTemplateProject('tee')
    const byId = new Map(reference.pieces.map((piece) => [piece.id, piece]))
    // An explicit, undoable engineering update of only the relevant tee
    // cutline coordinates. No silent migration of saved user projects.
    // Keep existing materials, sewing IDs, selected styling and 3D placement.
    mutateProject((next) => {
      for (const piece of next.pieces) {
        const corrected = byId.get(piece.id)
        if (!corrected || !['front','back','sleeve-left','sleeve-right'].includes(piece.id)) continue
        if (piece.points.length !== corrected.points.length) continue
        if (piece.id.startsWith('sleeve-')) {
          for (const index of [1,2,5,6]) piece.points[index] = { ...piece.points[index], ...cloneProject(corrected.points[index]) }
          piece.curves = cloneProject(corrected.curves)
        } else {
          for (const index of [2,7]) piece.points[index] = { ...piece.points[index], ...cloneProject(corrected.points[index]) }
          piece.curves = {...(piece.curves || {}),...Object.fromEntries([1,2,6,7].map(i=>[i,cloneProject(corrected.curves[i])]))}
        }
        piece.edgeSeamAllowances = { ...(piece.edgeSeamAllowances || {}), ...corrected.edgeSeamAllowances }
        if (piece.id === 'front' || piece.id === 'back') piece.bindings = cloneProject(corrected.bindings)
        for (const notch of piece.notches || []) {
          const correction = corrected.notches?.find(item => item.id === notch.id)
          if (correction) { notch.matchGroupId = correction.matchGroupId; notch.matchedSeamId = correction.matchedSeamId }
        }
      }
      next.productionSpec = cloneProject(reference.productionSpec)
    })
    setLayout2DSignal(value => value + 1)
    setRunning(false)
    setCommandResult('Applied the regular-fit M T-shirt development block: recessed armscyes, matching separate sleeve caps, hem/neck allowances and matched seam notches. Confirm fit before factory release; Undo available.')
  }
  const gestureStartRef = useRef(null)

  const selectedPiece = project.pieces.find((piece) => piece.id === selectedPieceId) || null
  const draftLine = selectedDraftEdge&&project.pieces.find(piece=>piece.id===selectedDraftEdge.pieceId)
  const draftLineSelection = draftLine&&selectedDraftEdge.edgeIndex<draftLine.points.length
    ? {kind:'line',source:'exo',panelId:draftLine.id,panelName:draftLine.name,
       edgeId:`Edge ${selectedDraftEdge.edgeIndex+1}`,length2DCm:edgeLength(draftLine,selectedDraftEdge.edgeIndex),
       length3DCm:null,elongationPercent:null,seamIds:project.seams.filter(seam=>
         [seam.a,seam.b].some(side=>side?.pieceId===draftLine.id&&side.edgeIndex===selectedDraftEdge.edgeIndex)).map(seam=>seam.name||seam.id)} : null
  const fabric = project.fabrics?.[selectedFabricId] || project.fabrics?.main || FABRIC_PRESETS.fleece
  const totalArea = useMemo(() => projectArea(project), [project])
  const selectedArea = selectedPiece ? pieceArea(selectedPiece) : 0
  const productionProject = useMemo(
    () => gradeProject(project, gradePreviewSize || project.grading?.baseSize || 'M'),
    [project, gradePreviewSize],
  )
  const productionPreflight = useMemo(() => inspectProduction(project), [project])
  const productionCosts = useMemo(() => buildFabricCostRun(project), [project])
  const displayProject = activeSection === 'Production' ? productionProject : project
  const gradeNestProjects = useMemo(() => {
    if (activeSection !== 'Production' || !showGradeNest) return []
    return (project.grading?.sizes || []).map((size) => gradeProject(project, size))
  }, [activeSection, showGradeNest, project])
  const fabricMarkers = useMemo(() => buildFabricMarkers(
    productionProject,
    productionProject.markerSettings?.fabricWidthCm ?? 150,
    productionProject.markerSettings?.gapCm ?? 1.5,
  ), [productionProject])
  const markerFabricIds = Object.keys(fabricMarkers)
  const marker = fabricMarkers[markerFabricId] || fabricMarkers[markerFabricIds[0]] || buildMarker(
    productionProject,
    productionProject.markerSettings?.fabricWidthCm ?? 150,
    productionProject.markerSettings?.gapCm ?? 1.5,
  )
  const measurementRun = useMemo(() => buildMeasurementSizeRun(project), [project])
  const productionMeasurements = measurementRun[gradePreviewSize] || []
  const seamWalk = useMemo(() => {
    if (!seamWalkId) return null
    const seam = project.seams.find((item) => item.id === seamWalkId)
    return seam ? seamWalkReport(project, seam, 33) : null
  }, [project, seamWalkId])
  const productionFabricArea = useMemo(() => (productionProject.pieces || [])
    .filter((piece) => (piece.fabricId || 'main') === (marker.fabricId || markerFabricId))
    .reduce((sum, piece) => sum + pieceArea(piece) * Math.max(1, Math.round(Number(piece.cutQuantity || 1))), 0), [productionProject, marker.fabricId, markerFabricId])

  useEffect(() => {
    if (!markerFabricIds.length) return
    if (!fabricMarkers[markerFabricId]) setMarkerFabricId(markerFabricIds[0])
  }, [markerFabricId, markerFabricIds.join('|')])

  useEffect(() => {
    const edgeCount = selectedPiece?.points?.length || 0
    setTrimEdgeIndex((value) => edgeCount ? Math.max(0, Math.min(edgeCount - 1, value)) : 0)
  }, [selectedPieceId, selectedPiece?.points?.length])

  const pushUndo = (snapshot) => {
    setUndoStack((stack) => [...stack, snapshot].slice(-MAX_HISTORY))
    setRedoStack([])
  }

  const mutateProject = (mutator, { record = true } = {}) => {
    const before = cloneProject(project)
    const next = cloneProject(project)
    mutator(next)
    syncLinkedMirrors(next)
    touchProject(next)
    if (record) pushUndo(before)
    setProject(next)
    setSaveState('modified')
  }

  // The right Property Editor and future agents share a typed property
  // allowlist. Unknown fields, wrong object IDs and out-of-range inputs
  // are rejected *before* the undoable garment transaction is created.
  const editCloObjectProperty=(selection,field,value)=>{
    if(clothcraftHybrid)return{ok:false,error:'Native garment properties use the separate Rust API'}
    const result=validateCloDraftProperty(project,selection,field,value)
    if(!result.ok){setCommandResult(result.error);return result}
    mutateProject(next=>applyCloDraftProperty(next,selection,field,result.value))
    setCommandResult(`${selection.name||selection.type} · ${field} updated. Undo is available.`)
    return result
  }
  const editNativeProperty=({kind,id,field,value,revision})=>{
    if(!clothcraftHybrid||!['pattern','fabric'].includes(kind)||!id)
      return Promise.resolve({ok:false,error:'Select a native pattern or fabric'})
    return new Promise(resolve=>{
      const requestId='exo-property-'+Date.now()+'-'+Math.random().toString(36).slice(2)
      let timer
      const finish=detail=>{
        window.removeEventListener('exo-clothcraft-property-result',receive)
        window.clearTimeout(timer)
        resolve({ok:Boolean(detail.ok),error:detail.error})
      }
      const receive=event=>{
        if(event.detail?.requestId!==requestId)return
        finish(event.detail)
      }
      window.addEventListener('exo-clothcraft-property-result',receive)
      timer=window.setTimeout(()=>finish({ok:false,error:'Native property update timed out; changes were not confirmed'}),15000)
      window.dispatchEvent(new CustomEvent('exo-clothcraft-edit-property',{
        detail:{requestId,kind,id,field,value,revision}
      }))
    })
  }

  const beginGesture = () => {
    if (!gestureStartRef.current) gestureStartRef.current = cloneProject(project)
  }

  const endGesture = () => {
    if (!gestureStartRef.current) return
    pushUndo(gestureStartRef.current)
    gestureStartRef.current = null
  }

  const undo = () => {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((stack) => [...stack, cloneProject(project)].slice(-MAX_HISTORY))
    setUndoStack((stack) => stack.slice(0, -1))
    setProject(previous)
    setSaveState('modified')
  }

  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((stack) => [...stack, cloneProject(project)].slice(-MAX_HISTORY))
    setRedoStack((stack) => stack.slice(0, -1))
    setProject(next)
    setSaveState('modified')
  }

  // CLO-style History panel: jump to an actual previous document snapshot.
  // Keep every skipped state on the Redo branch in its original order, so a
  // history jump is reversible by the same undo/redo engine as toolbar edits.
  const restoreHistorySnapshot = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= undoStack.length) return
    const target = cloneProject(undoStack[index])
    const forward = undoStack.slice(index + 1).map(cloneProject).reverse()
    setRedoStack(stack => [...stack, cloneProject(project), ...forward].slice(-MAX_HISTORY))
    setUndoStack(undoStack.slice(0, index))
    setProject(target)
    setSelectedPieceId(pieceId => target.pieces?.some(piece => piece.id === pieceId) ? pieceId : (target.pieces?.[0]?.id || null))
    setRunning(false)
    gestureStartRef.current = null
    setSaveState('modified')
    setCommandResult(`Returned to revision ${target.revision ?? 'unknown'} via History. Redo steps remain available.`)
  }

  const saveProject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    setSaveState('saved')
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
        setSaveState('saved')
      } catch (error) {
        console.warn('Autosave failed', error)
      }
    }, 550)
    return () => window.clearTimeout(timer)
  }, [project])

  useEffect(() => {
    const handler = (event) => {
      const editing = Boolean(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))
      // Let native text fields handle their own editing and undo shortcuts.
      if (editing) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveProject()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        toggleSimulation()
        return
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        const in2D = Boolean(event.target?.closest?.('.pattern-canvas'))
        if (in2D) {
          if (event.key.toLowerCase() === 'a') { setTool('select'); setActiveSection('Pattern') }
          if (event.key.toLowerCase() === 'z') { setTool('point'); setActiveSection('Pattern') }
          if (event.key.toLowerCase() === 'p') { setTool('pin'); setActiveSection('Pattern') }
        } else {
          if (event.key.toLowerCase() === 't') setViewportTool('transform')
          if (event.key.toLowerCase() === 'g') setViewportTool('move')
          if (event.key.toLowerCase() === 'r') setViewportTool('rotate')
          if (event.key.toLowerCase() === 'q' || event.key === 'Escape') setViewportTool('orbit')
          // CLO divided-gizmo keys, while retaining existing G/R/T aliases.
          if (event.key.toLowerCase() === 'w') setViewportTool('move')
          if (event.key.toLowerCase() === 'e') setViewportTool('rotate')
          if (event.key.toLowerCase() === 'h') setViewportTool('hand')
          if (event.key.toLowerCase() === 'v') setShowSewingGuides(value => !value)
        }
      }
      // Nudge only the flat 3D arrangement, never a live physical solve.
      if (!event.metaKey && !event.altKey && !hasSimulated && selectedPieceId &&
          event.target?.closest?.('.three-mount') &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const amount = event.shiftKey ? 0.01 : 0.0025
        const depth = event.ctrlKey
        const offset = depth
          ? { x: 0, y: 0, z: event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0 }
          : { x: event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0,
              y: event.key === 'ArrowUp' ? amount : event.key === 'ArrowDown' ? -amount : 0, z: 0 }
        moveStagedPanel(selectedPieceId, offset)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const movePiece = (pieceId, layout2d) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.layout2d = layout2d
    }, { record: false })
  }

  const tidy2DPatterns = () => {
    const pieces = project.pieces || []
    if (!pieces.length) return
    // Pack the drawn boundary boxes, not their pattern origin points. Preserve
    // shape, curve control points, stable IDs, seam graph, and each local
    // pattern coordinate while placing complete pieces in separated cells.
    const dimensions = pieces.map((piece) => {
      const points = samplePieceBoundary(piece, 16).points
      const minX = Math.min(0, ...points.map((point) => point.x))
      const maxX = Math.max(0, ...points.map((point) => point.x))
      const minY = Math.min(0, ...points.map((point) => point.y))
      const maxY = Math.max(0, ...points.map((point) => point.y))
      return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
    })
    const columns = Math.max(1, Math.min(pieces.length <= 4 ? 2 : 3, pieces.length))
    const columnWidths = Array.from({ length: columns }, () => 0)
    const rowHeights = Array.from({ length: Math.ceil(pieces.length / columns) }, () => 0)
    dimensions.forEach((item, i) => {
      const col = i % columns, row = Math.floor(i / columns)
      columnWidths[col] = Math.max(columnWidths[col], item.width)
      rowHeights[row] = Math.max(rowHeights[row], item.height)
    })
    const gap = 23
    const xOffsets = columnWidths.map((_, i) => 20 + columnWidths.slice(0, i).reduce((total, width) => total + width + gap, 0))
    const yOffsets = rowHeights.map((_, i) => 33 + rowHeights.slice(0, i).reduce((total, height) => total + height + gap, 0))
    mutateProject((next) => {
      next.pieces.forEach((piece, i) => {
        const item = dimensions[i]
        piece.layout2d = {
          x: xOffsets[i % columns] - item.minX,
          y: yOffsets[Math.floor(i / columns)] + item.maxY,
        }
      })
    })
    setLayout2DSignal((value) => value + 1)
    setCommandResult('Arranged 2D pattern pieces in separated drafting rows. All pattern shapes, sewing edges, and 3D placements are preserved.')
  }

  const moveStagedPanel = (pieceId, offset) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.arrangement3d = piece.arrangement3d || {}
      for (const [axis, delta] of [['X', offset.x], ['Y', offset.y], ['Z', offset.z]]) {
        const field = `stagingOffset${axis}`
        const previous = Number(piece.arrangement3d[field] || 0)
        const nextValue = clamp(previous + Number(delta || 0), -2, 2)
        piece.arrangement3d[field] = nextValue
        // Record actual user translation separately: shipped garment
        // templates already contain intentional staging corrections and
        // those must not be mistaken for manually mispositioned fabric.
        const manualField = `userPlacementDelta${axis}`
        piece.arrangement3d[manualField] = clamp(Number(piece.arrangement3d[manualField] || 0) + (nextValue - previous), -2, 2)
      }
      if (offset.rotation) {
        for (const axis of ['X', 'Y', 'Z']) {
          const value = Number(offset.rotation[axis.toLowerCase()])
          if (Number.isFinite(value)) piece.arrangement3d[`stagingRotation${axis}`] = value
        }
      }
    })
    setCommandResult('Transformed selected 3D panel. 2D drafting geometry and sewing connections remain linked.')
  }

  const setStagedPlacementField = (pieceId, field, value) => {
    if (hasSimulated) return
    if (!/^staging(Offset|Rotation)[XYZ]$/.test(field)) return
    mutateProject((next) => {
      const piece = next.pieces.find(item => item.id === pieceId)
      if (!piece) return
      piece.arrangement3d = piece.arrangement3d || {}
      const previous = Number(piece.arrangement3d[field] || 0)
      const nextValue = field.startsWith('stagingOffset')
        ? clamp(Number(value) / 100, -2, 2)
        : clamp(Number(value), -360, 360)
      piece.arrangement3d[field] = nextValue
      if (field.startsWith('stagingOffset')) {
        const manualField = `userPlacementDelta${field.at(-1)}`
        piece.arrangement3d[manualField] = clamp(Number(piece.arrangement3d[manualField] || 0) + (nextValue - previous), -2, 2)
      }
    })
  }
  const resetStagedPlacement = (pieceId) => {
    if (hasSimulated) return
    mutateProject((next) => {
      const piece = next.pieces.find(item => item.id === pieceId)
      if (!piece) return
      piece.arrangement3d = piece.arrangement3d || {}
      for (const axis of ['X', 'Y', 'Z']) {
        piece.arrangement3d[`stagingOffset${axis}`] = 0
        piece.arrangement3d[`stagingRotation${axis}`] = 0
        piece.arrangement3d[`userPlacementDelta${axis}`] = 0
      }
    })
  }

  const selectIn3D = (pieceId) => {
    setSelectedPieceId(pieceId)
    // Select inside the 3D model and activate the on-fabric rotation circles
    // plus XYZ movement arrows rather than a camera widget in the corner.
    if (pieceId && viewportTool === 'orbit' && (!hasSimulated || (
      !running && (project.simulation?.backendId || 'browser-pbd') === 'browser-pbd'
    ))) setViewportTool('transform')
    if (pieceId && !['Sewing', 'Production'].includes(activeSection)) setActiveSection('Pattern')
  }

  const movePoint = (pieceId, pointIndex, point) => {
    const original = project.pieces.find(item => item.id === pieceId)
    if (!original || original.locked || !isDraftEditValid(original,{pointIndex,point},{curveSamples:8})) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece?.points?.[pointIndex] && !piece.locked) {
        // Preserve the vertex's grading, source-curve and parametric metadata
        // when only its X/Y coordinates are being dragged.
        piece.points[pointIndex] = { ...piece.points[pointIndex], x:point.x, y:point.y }
      }
    }, { record: false })
  }

  const setPointPrecision = (pieceId, pointIndex, point) => {
    // Numeric CAD edits are discrete history operations. Pointer drags use
    // their own begin/end gesture transaction instead.
    const original = project.pieces.find(item => item.id === pieceId)
    if (!original || original.locked || !isDraftEditValid(original,{pointIndex,point},{curveSamples:24})) {
      setCommandResult('Invalid pattern edit: cutting boundaries must remain closed and non-self-intersecting.')
      return false
    }
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece?.points?.[pointIndex] && !piece.locked) piece.points[pointIndex] = point
    })
    return true
  }

  const moveCurve = (pieceId, edgeIndex, curve) => {
    const original = project.pieces.find(item => item.id === pieceId)
    if (!original || original.locked || !isDraftEditValid(original,{edgeIndex,curve},{curveSamples:8})) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.curves = { ...(piece.curves || {}) }
      if (curve) piece.curves[edgeIndex] = curve
      else delete piece.curves[edgeIndex]
    }, { record: false })
  }

  const setCurvePrecision = (pieceId, edgeIndex, curve) => {
    // A numeric curve edit or straighten is a single undoable CAD transaction.
    // Pointer drags continue to use their existing gesture history.
    if (curve && (!Number.isFinite(curve.cx) || !Number.isFinite(curve.cy)
      || Math.abs(curve.cx) > 100000 || Math.abs(curve.cy) > 100000)) return false
    if (!Number.isInteger(edgeIndex) || edgeIndex < 0) return false
    const source = project.pieces.find(item => item.id === pieceId)
    if (!source || source.locked || edgeIndex >= source.points.length) return false
    if (!isDraftEditValid(source,{edgeIndex,curve},{curveSamples:24})) {
      setCommandResult('Invalid pattern curve: the new cutline overlaps or crosses itself.')
      return false
    }
    mutateProject((next) => {
      const piece = next.pieces.find(item => item.id === pieceId)
      if (!piece || piece.locked || edgeIndex >= piece.points.length) return
      piece.curves = { ...(piece.curves || {}) }
      if (curve) piece.curves[edgeIndex] = { cx: curve.cx, cy: curve.cy }
      else delete piece.curves[edgeIndex]
    })
    return true
  }

  useEffect(() => {
    setTransformDraft({ scaleX: 100, scaleY: 100, rotateDeg: 0, slashCm: 4 })
  }, [selectedPieceId])

  const transformPieceGeometry = (piece, mapPoint) => {
    piece.points = piece.points.map((point) => mapPoint(point))
    if (piece.curves) {
      piece.curves = Object.fromEntries(Object.entries(piece.curves).map(([edgeIndex, curve]) => {
        const transformed = mapPoint({ x: curve.cx, y: curve.cy })
        return [edgeIndex, { cx: transformed.x, cy: transformed.y }]
      }))
    }
    piece.internalLines = (piece.internalLines || []).map((line) => ({
      ...line,
      a: mapPoint(line.a),
      b: mapPoint(line.b),
    }))
    piece.pins = (piece.pins || []).map((pin) => ({ ...pin, ...mapPoint(pin) }))
  }

  const applyPatternTransform = () => {
    if (!selectedPiece) return
    const sx = clamp(transformDraft.scaleX, 10, 300) / 100
    const sy = clamp(transformDraft.scaleY, 10, 300) / 100
    const rotation = clamp(transformDraft.rotateDeg, -180, 180) * Math.PI / 180
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      const center = {
        x: piece.points.reduce((sum, point) => sum + point.x, 0) / piece.points.length,
        y: piece.points.reduce((sum, point) => sum + point.y, 0) / piece.points.length,
      }
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      transformPieceGeometry(piece, (point) => {
        const x = (point.x - center.x) * sx
        const y = (point.y - center.y) * sy
        return {
          x: center.x + x * cos - y * sin,
          y: center.y + x * sin + y * cos,
        }
      })
      piece.grainAngleDeg = (piece.grainAngleDeg || 0) + clamp(transformDraft.rotateDeg, -180, 180)
    })
    setTransformDraft((current) => ({ ...current, scaleX: 100, scaleY: 100, rotateDeg: 0 }))
    setCommandResult('Applied precise scale/rotation to outline, curves, internal geometry, and grain direction.')
  }

  const applySlashSpread = () => {
    if (!selectedPiece) return
    const amount = clamp(transformDraft.slashCm, -20, 30)
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      const xs = piece.points.map((point) => point.x)
      const ys = piece.points.map((point) => point.y)
      const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const height = Math.max(1, maxY - minY)
      transformPieceGeometry(piece, (point) => {
        const hemInfluence = 1 - Math.max(0, Math.min(1, (point.y - minY) / height))
        const side = Math.sign(point.x - centerX)
        return {
          x: point.x + side * amount * 0.5 * hemInfluence,
          y: point.y,
        }
      })
    })
    setCommandResult(`Applied ${amount.toFixed(1)} cm slash/spread change at the hem while holding the top edge.`)
  }

  const edgeIsSewn = (pieceId, edgeIndex) => project.seams.some((seam) => (
    (seam.a.pieceId === pieceId && seam.a.edgeIndex === edgeIndex)
    || (seam.b.pieceId === pieceId && seam.b.edgeIndex === edgeIndex)
  ))

  const splitPatternEdge = (pieceId, edgeIndex, t = 0.5) => {
    mutateProject((next) => {
      splitPieceEdgeInProject(next, pieceId, edgeIndex, t)
    })
    setCommandResult(edgeIsSewn(pieceId, edgeIndex)
      ? 'Sewn pattern edge split; seam ranges were remapped across the new topology.'
      : 'Pattern edge split with a new editable anchor point.')
  }

  const splitPatternEdgePrecise = (pieceId, edgeIndex, options) => {
    const source = project.pieces.find(item => item.id === pieceId)
    if (!source || source.locked) return
    // Validate all requested geometry *before* entering the Undo transaction.
    const fractions = draftingSplitFractions(source, edgeIndex, options)
    mutateProject(next => {
      let currentIndex = edgeIndex
      let previousFraction = 0
      for (const target of fractions) {
        const piece = next.pieces.find(item => item.id === pieceId)
        const remainder = (target - previousFraction) / (1 - previousFraction)
        // For Bézier edges a half-parameter split does NOT mean half-length;
        // use the exact arc-length inverse on the remaining curve section.
        const parameter = splitParameterAtArcFraction(piece, currentIndex, remainder)
        const result = splitPieceEdgeInProject(next, pieceId, currentIndex, parameter)
        if (!result) throw new Error('Unable to split the selected pattern edge')
        currentIndex += 1
        previousFraction = target
      }
    })
    setCommandResult('Split edge into ' + (fractions.length + 1) +
      ' true-length segments. Existing notch and sewing references were remapped in one Undo step.')
  }

  const unfoldPatternEdge = (pieceId, foldEdgeIndex) => {
    const source = project.pieces.find(item => item.id === pieceId)
    if (!source || source.locked) return { ok:false, message:'Select and unlock a pattern' }
    const blockers = ['topstitches','bindings','zippers','buttons','buttonholes','graphics','pins']
      .filter(name => (source[name] || []).length > 0)
    if (blockers.length) {
      const message = 'Unfold this piece before adding ' + blockers.join(', ') +
        ' to avoid dropping manufacturing details'
      setCommandResult(message)
      return { ok:false, message }
    }
    if (source.linkedMirrorSourceId) {
      return { ok:false, message:'Unfold the original half-pattern, not its linked mirror' }
    }
    const linkedFoldSeam = (project.seams || []).some(seam =>
      [seam.a,seam.b].some(end => end?.pieceId === pieceId && end.edgeIndex === foldEdgeIndex))
    if (linkedFoldSeam) {
      return { ok:false, message:'Fold edge is sewn: remove that sewing relation before unfolding' }
    }
    try {
      const result = unfoldDraftPiece(source,foldEdgeIndex)
      mutateProject(next => {
        const index = next.pieces.findIndex(item => item.id === pieceId)
        if (index < 0) return
        next.pieces[index] = result.piece
        for (const seam of next.seams || []) {
          for (const endpoint of [seam.a,seam.b]) {
            if (endpoint?.pieceId !== pieceId) continue
            const mapped = result.edgeMap[endpoint.edgeIndex]
            if (!Number.isInteger(mapped)) throw new Error('Unfold would break a sewn edge')
            endpoint.edgeIndex = mapped
          }
        }
      })
      setCommandResult('Unfolded the half-pattern across the selected straight edge. Curves, notch positions, internal lines and remaining sewing edges were remapped.')
      return { ok:true }
    } catch (error) {
      setCommandResult(error.message)
      return { ok:false, message:error.message }
    }
  }

  const deletePatternPoint = (pieceId, pointIndex) => {
    const piece = project.pieces.find((item) => item.id === pieceId)
    if (!piece || piece.points.length <= 3) {
      setCommandResult('A closed pattern needs at least three points.')
      return
    }
    const count = piece.points.length
    const previousEdge = (pointIndex - 1 + count) % count
    const currentEdge = pointIndex
    if (edgeIsSewn(pieceId, previousEdge) || edgeIsSewn(pieceId, currentEdge)) {
      setCommandResult('Unsew the adjacent edge before deleting this point.')
      return
    }
    if ((piece.notches || []).some((notch) => notch.edgeIndex === previousEdge || notch.edgeIndex === currentEdge)) {
      setCommandResult('Move or remove the notch on an adjacent edge before deleting this point.')
      return
    }

    mutateProject((next) => {
      const target = next.pieces.find((item) => item.id === pieceId)
      if (!target || target.points.length <= 3) return
      const oldCount = target.points.length
      const oldCurves = { ...(target.curves || {}) }
      const oldEdgeAllowances = { ...(target.edgeSeamAllowances || {}) }
      const oldPreviousEdge = (pointIndex - 1 + oldCount) % oldCount
      const oldCurrentEdge = pointIndex
      const mergedAllowance = Math.max(
        getEdgeSeamAllowance(target, oldPreviousEdge),
        getEdgeSeamAllowance(target, oldCurrentEdge),
      )
      target.points.splice(pointIndex, 1)
      const nextCurves = {}
      for (const [rawIndex, value] of Object.entries(oldCurves)) {
        const index = Number(rawIndex)
        if (pointIndex === 0) {
          if (index === 0 || index === oldCount - 1) continue
          nextCurves[index - 1] = value
        } else {
          if (index === pointIndex - 1 || index === pointIndex) continue
          nextCurves[index > pointIndex ? index - 1 : index] = value
        }
      }
      target.curves = nextCurves
      const nextEdgeAllowances = {}
      const mergedEdgeIndex = pointIndex === 0 ? oldCount - 2 : pointIndex - 1
      for (const [rawIndex, value] of Object.entries(oldEdgeAllowances)) {
        const index = Number(rawIndex)
        if (index === oldPreviousEdge || index === oldCurrentEdge) continue
        if (pointIndex === 0) {
          if (index > 0 && index < oldCount - 1) nextEdgeAllowances[index - 1] = value
        } else {
          nextEdgeAllowances[index > pointIndex ? index - 1 : index] = value
        }
      }
      if (Math.abs(mergedAllowance - Number(target.seamAllowance || 0)) > 1e-6) nextEdgeAllowances[mergedEdgeIndex] = mergedAllowance
      target.edgeSeamAllowances = nextEdgeAllowances

      for (const seam of next.seams) {
        for (const endpoint of [seam.a, seam.b]) {
          if (endpoint.pieceId !== pieceId) continue
          if (pointIndex === 0 && endpoint.edgeIndex > 0) endpoint.edgeIndex -= 1
          else if (pointIndex > 0 && endpoint.edgeIndex > pointIndex) endpoint.edgeIndex -= 1
        }
      }
      target.notches = (target.notches || []).map((notch) => {
        if (pointIndex === 0) return { ...notch, edgeIndex: notch.edgeIndex > 0 ? notch.edgeIndex - 1 : notch.edgeIndex }
        return { ...notch, edgeIndex: notch.edgeIndex > pointIndex ? notch.edgeIndex - 1 : notch.edgeIndex }
      })
    })
    setCommandResult('Pattern point removed and edge indices repaired.')
  }

  const createInternalLine = (pieceId, line) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.internalLines = piece.internalLines || []
      piece.internalLines.push({
        id: uniqueId('internal'),
        name: `Internal ${piece.internalLines.length + 1}`,
        type: 'construction',
        widthCm: 2.5,
        ...line,
      })
    }, { record: false })
  }

  const updateInternalLine = (pieceId, lineId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const line = piece?.internalLines?.find((item) => item.id === lineId)
      if (line) line[field] = value
    })
  }

  const removeInternalLine = (pieceId, lineId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.internalLines = (piece.internalLines || []).filter((line) => line.id !== lineId)
    })
  }

  const createPin = (pieceId, point) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.pins = piece.pins || []
      piece.pins.push({ id: uniqueId('pin'), x: point.x, y: point.y, stiffness: 1 })
    })
    setCommandResult('Manual cloth pin added. It will hold this location during simulation.')
  }

  const removePin = (pieceId, pinId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.pins = (piece.pins || []).filter((pin) => pin.id !== pinId)
    })
    setCommandResult('Manual cloth pin removed.')
  }

  const createSeam = (a, b) => {
    const partial = [a, b].some((endpoint) => endpoint.startT !== undefined || endpoint.endT !== undefined)
    const proposal = {
      a, b,
      // All Free Sewing ranges must be mapped to their *exact* cutline
      // fractions; whole-edge sewing preserves the established solver mode.
      ...(partial ? { useExactCorrespondence: true } : {}),
    }
    const verification = validateNewSeam(project, proposal)
    if (!verification.ok) {
      setCommandResult(verification.messages[0] || 'Invalid sewing selection')
      return
    }
    mutateProject((next) => {
      next.seams.push({
        id: uniqueId('seam'),
        name: `${partial ? 'Free sewing' : 'Segment sewing'} ${next.seams.length + 1}`,
        ...proposal,
      })
    })
    setCommandResult(verification.warning || `${partial ? 'Free' : 'Segment'} sewing created and linked to the 3D solver`)
  }

  const createFastener = (a, b) => {
    if (!a || !b) return
    mutateProject((next) => {
      next.fasteners = next.fasteners || []
      next.fasteners.push({
        id: uniqueId('fastener'),
        name: `Fastener ${next.fasteners.length + 1}`,
        type: 'button',
        a,
        b,
        closed: true,
        diameterCm: 1.8,
      })
    })
    setCommandResult('Fastener pair created. Configure button, snap, or hook and its open/closed state in Sewing.')
  }

  const updateFastener = (fastenerId, field, value) => {
    mutateProject((next) => {
      const fastener = (next.fasteners || []).find((item) => item.id === fastenerId)
      if (fastener) fastener[field] = value
    })
  }

  const removeFastener = (fastenerId) => {
    mutateProject((next) => {
      next.fasteners = (next.fasteners || []).filter((item) => item.id !== fastenerId)
    })
  }

  const createCustomMeasurement = (a, b) => {
    if (!a || !b || a.pieceId !== b.pieceId) {
      setCommandResult('Tape measurements must use two points on the same pattern piece')
      return
    }
    const id = uniqueId('measure')
    mutateProject((next) => {
      next.customMeasurements = next.customMeasurements || []
      next.customMeasurements.push({
        id,
        pieceId: a.pieceId,
        label: `Custom measure ${next.customMeasurements.length + 1}`,
        a: { x: a.x, y: a.y },
        b: { x: b.x, y: b.y },
        toleranceCm: 0.5,
      })
    })
    setCommandResult(`Added ${(Math.hypot(b.x - a.x, b.y - a.y)).toFixed(1)} cm tape measurement`)
  }

  const updateCustomMeasurement = (measurementId, field, value) => {
    mutateProject((next) => {
      const measurement = (next.customMeasurements || []).find((item) => item.id === measurementId)
      if (measurement) measurement[field] = value
    })
  }

  const removeCustomMeasurement = (measurementId) => {
    mutateProject((next) => {
      next.customMeasurements = (next.customMeasurements || []).filter((item) => item.id !== measurementId)
    })
  }

  const addPiece = () => {
    const piece = makeRectanglePiece(project.pieces.length)
    mutateProject((next) => next.pieces.push(piece))
    setSelectedPieceId(piece.id)
    setTool('point')
  }

  const addPolygonPiece = () => {
    // A real five-vertex clipped-corner pattern, not merely a polygon-shaped
    // toolbar symbol that still creates an unrelated rectangular draft.
    const piece = makeRectanglePiece(project.pieces.length)
    piece.name = `Polygon ${project.pieces.length + 1}`
    piece.points = [
      { x: -18, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 26 },
      { x: 9, y: 36 }, { x: -18, y: 36 },
    ]
    // Place new draft pieces in the currently empty lower drafting region,
    // with their 3D proxy in front of the avatar rather than beyond the
    // camera's right edge. Their locations remain editable in both views.
    piece.layout2d = { x: 248, y: 193 }
    piece.arrangement3d = { x: 0.08, y: 1.02, z: 0.72, flip: false }
    mutateProject((next) => next.pieces.push(piece))
    setSelectedPieceId(piece.id)
    setTool('point')
    setActiveSection('Pattern')
    setCommandResult('Created a 5-point clipped-corner polygon. Edit its nodes in the 2D window.')
  }

  const deleteSelectedPiece = () => {
    if (clothcraftHybrid) {
      window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'delete-selected'}))
      return
    }
    if (!selectedPiece) return
    mutateProject((next) => {
      const ids = new Set([selectedPiece.id])
      for (const piece of next.pieces) {
        if (piece.liningForPieceId === selectedPiece.id || piece.interfacingForPieceId === selectedPiece.id) ids.add(piece.id)
      }
      next.pieces = next.pieces.filter((piece) => !ids.has(piece.id))
      next.seams = next.seams.filter((seam) => !ids.has(seam.a?.pieceId) && !ids.has(seam.b?.pieceId))
      next.fasteners = (next.fasteners || []).filter((fastener) => !ids.has(fastener.a?.pieceId) && !ids.has(fastener.b?.pieceId))
      next.customMeasurements = (next.customMeasurements || []).filter((measurement) => !ids.has(measurement.pieceId))
      for (const piece of next.pieces) {
        if (ids.has(piece.fusedToPieceId)) {
          delete piece.fusedToPieceId
          delete piece.interfacingForPieceId
        }
        if (ids.has(piece.liningForPieceId)) delete piece.liningForPieceId
      }
    })
    setSelectedPieceId(null)
  }

  const removeSeam = (seamId) => {
    mutateProject((next) => {
      next.seams = next.seams.filter((seam) => seam.id !== seamId)
    })
  }

  const updateSeam = (seamId, field, value) => {
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      if (!seam) return
      seam[field] = value
      if (field === 'type' && value === 'gather' && seam.ratio === undefined) seam.ratio = 0.7
      if (field === 'type' && value === 'elastic' && seam.ratio === undefined) seam.ratio = 0.85
      if (field === 'type' && value === 'ease' && seam.ratio === undefined) seam.ratio = 0.96
    })
  }

  const setSeamPartial = (seamId, enabled) => {
    const current = project.seams.find((item) => item.id === seamId)
    if (!current) return
    const proposed = cloneProject(current)
    if (enabled) {
      proposed.a = { ...proposed.a, startT: proposed.a?.startT ?? 0.25, endT: proposed.a?.endT ?? 0.75 }
      proposed.b = { ...proposed.b, startT: proposed.b?.startT ?? 0.25, endT: proposed.b?.endT ?? 0.75 }
    } else {
      delete proposed.a.startT
      delete proposed.a.endT
      delete proposed.b.startT
      delete proposed.b.endT
    }
    const validation = validateNewSeam(project, proposed, { excludeSeamId: seamId })
    if (!validation.ok) {
      setCommandResult(validation.messages[0])
      return
    }
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      if (!seam) return
      if (enabled) {
        seam.a = { ...seam.a, startT: seam.a?.startT ?? 0.25, endT: seam.a?.endT ?? 0.75 }
        seam.b = { ...seam.b, startT: seam.b?.startT ?? 0.25, endT: seam.b?.endT ?? 0.75 }
        seam.useExactCorrespondence = true
      } else {
        seam.a = { ...seam.a }
        seam.b = { ...seam.b }
        delete seam.a.startT
        delete seam.a.endT
        delete seam.b.startT
        delete seam.b.endT
      }
    })
  }

  const updateSeamRange = (seamId, side, field, value) => {
    const existing = project.seams.find((item) => item.id === seamId)
    if (!existing) return
    const preview = cloneProject(existing)
    const previewEndpoint = preview?.[side]
    if (!previewEndpoint) return
    const nextValue = clamp(Number(value), 0, 1)
    const piece = project.pieces.find((item) => item.id === previewEndpoint.pieceId)
    const minimumGap = Math.min(0.5, 0.01 / Math.max(0.01, edgeLength(piece, previewEndpoint.edgeIndex)))
    if (field === 'startT') previewEndpoint.startT = Math.max(0, Math.min(nextValue, Number(previewEndpoint.endT ?? 1) - minimumGap))
    if (field === 'endT') previewEndpoint.endT = Math.min(1, Math.max(nextValue, Number(previewEndpoint.startT ?? 0) + minimumGap))
    const validation = validateNewSeam(project, preview, { excludeSeamId: seamId })
    if (!validation.ok) {
      setCommandResult(validation.messages[0])
      return
    }
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      if (!seam) return
      seam[side] = previewEndpoint
      seam.useExactCorrespondence = true
    })
  }

  const autoEaseSeam = (seamId) => {
    const seam = project.seams.find((item) => item.id === seamId)
    if (!seam) return
    const report = seamLengthReport(project, seam)
    if (report.mismatchPercent <= 0.25) {
      setCommandResult(`${seam.name} is already length matched`)
      return
    }
    const longerSide = report.lengthA >= report.lengthB ? 'a' : 'b'
    const shorter = Math.min(report.lengthA, report.lengthB)
    const longer = Math.max(report.lengthA, report.lengthB)
    const ratio = longer > 0 ? clamp(shorter / longer, 0.3, 1.2) : 1
    mutateProject((next) => {
      const target = next.seams.find((item) => item.id === seamId)
      if (!target) return
      target.type = 'ease'
      target.easeSide = longerSide
      target.ratio = ratio
    })
    setCommandResult(`${seam.name}: easing ${longerSide.toUpperCase()} to ${(ratio * 100).toFixed(1)}% to match the shorter edge`)
  }

  const addSeamWalkNotches = (seamId) => {
    const seam = project.seams.find((item) => item.id === seamId)
    if (!seam) return
    mutateProject((next) => {
      const targetSeam = next.seams.find((item) => item.id === seamId)
      const pieceA = next.pieces.find((item) => item.id === targetSeam?.a?.pieceId)
      const pieceB = next.pieces.find((item) => item.id === targetSeam?.b?.pieceId)
      if (!targetSeam || !pieceA || !pieceB) return
      pieceA.notches = pieceA.notches || []
      pieceB.notches = pieceB.notches || []
      for (const [fraction, type] of [[0.25, 'single'], [0.5, 'double'], [0.75, 'single']]) {
        const sourceFraction = seamFractionAtProgress(targetSeam, 'a', fraction)
        const targetFraction = seamFractionAtProgress(targetSeam, 'b', fraction)
        const existing = pieceA.notches.find((notch) => notch.edgeIndex === targetSeam.a.edgeIndex && Math.abs(Number(notch.t ?? 0.5) - sourceFraction) < 0.025 && notch.matchedSeamId === seamId)
        if (existing) continue
        const groupId = uniqueId('notch-match')
        pieceA.notches.push({
          id: uniqueId('notch'),
          edgeIndex: targetSeam.a.edgeIndex,
          t: sourceFraction,
          type,
          depthCm: 0.45,
          matchGroupId: groupId,
          matchedSeamId: seamId,
        })
        pieceB.notches.push({
          id: uniqueId('notch'),
          edgeIndex: targetSeam.b.edgeIndex,
          t: targetFraction,
          type,
          depthCm: 0.45,
          matchGroupId: groupId,
          matchedSeamId: seamId,
        })
      }
    })
    setCommandResult(`${seam.name}: added matched quarter, center, and three-quarter seam-walk notches`)
  }

  const createNotch = (pieceId, edgeIndex, t = 0.5) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.notches = piece.notches || []
      piece.notches.push({
        id: uniqueId('notch'),
        edgeIndex,
        t: clamp(t, 0.02, 0.98),
        type: 'single',
        depthCm: 0.45,
      })
    })
    setCommandResult('Pattern notch added and linked to the selected edge')
  }

  const notchSeams = (pieceId, edgeIndex, t = 0.5) => project.seams.filter((seam) => {
    for (const endpoint of [seam.a, seam.b]) {
      if (endpoint?.pieceId !== pieceId || endpoint.edgeIndex !== edgeIndex) continue
      const range = seamRange(endpoint)
      const notchT = clamp(Number(t ?? 0.5), 0, 1)
      if (notchT >= range.start - 1e-6 && notchT <= range.end + 1e-6) return true
    }
    return false
  })

  const matchNotchAcrossSeam = (pieceId, notchId, seamId) => {
    const sourcePieceNow = project.pieces.find((item) => item.id === pieceId)
    const sourceNotchNow = sourcePieceNow?.notches?.find((item) => item.id === notchId)
    const seamNow = project.seams.find((item) => item.id === seamId)
    if (!sourceNotchNow || !seamNow) return
    const sideNow = seamNow.a?.pieceId === pieceId && seamNow.a?.edgeIndex === sourceNotchNow.edgeIndex
      ? 'a'
      : seamNow.b?.pieceId === pieceId && seamNow.b?.edgeIndex === sourceNotchNow.edgeIndex
        ? 'b'
        : null
    if (!sideNow) return
    const rangeNow = seamRange(seamNow[sideNow])
    const sourceTNow = Number(sourceNotchNow.t ?? 0.5)
    if (sourceTNow < rangeNow.start - 1e-6 || sourceTNow > rangeNow.end + 1e-6) {
      setCommandResult('Move the notch into the stitched seam range before matching it across the seam.')
      return
    }
    mutateProject((next) => {
      const sourcePiece = next.pieces.find((item) => item.id === pieceId)
      const sourceNotch = sourcePiece?.notches?.find((item) => item.id === notchId)
      const seam = next.seams.find((item) => item.id === seamId)
      if (!sourcePiece || !sourceNotch || !seam) return
      const sourceIsA = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === sourceNotch.edgeIndex
      const sourceIsB = seam.b?.pieceId === pieceId && seam.b?.edgeIndex === sourceNotch.edgeIndex
      if (!sourceIsA && !sourceIsB) return
      const targetEndpoint = sourceIsA ? seam.b : seam.a
      const targetPiece = next.pieces.find((item) => item.id === targetEndpoint?.pieceId)
      if (!targetPiece) return
      const matchGroupId = sourceNotch.matchGroupId || uniqueId('notch-match')
      const targetT = mapFractionAcrossSeam(seam, sourceIsA ? 'a' : 'b', Number(sourceNotch.t ?? 0.5))
      sourceNotch.matchGroupId = matchGroupId
      sourceNotch.matchedSeamId = seam.id
      targetPiece.notches = targetPiece.notches || []
      let targetNotch = targetPiece.notches.find((item) => item.matchGroupId === matchGroupId)
      if (!targetNotch) {
        targetNotch = {
          id: uniqueId('notch'),
          edgeIndex: targetEndpoint.edgeIndex,
          t: clamp(targetT, 0, 1),
          type: sourceNotch.type || 'single',
          depthCm: Number(sourceNotch.depthCm ?? 0.45),
          matchGroupId,
          matchedSeamId: seam.id,
        }
        targetPiece.notches.push(targetNotch)
      } else {
        targetNotch.edgeIndex = targetEndpoint.edgeIndex
        targetNotch.t = clamp(targetT, 0, 1)
        targetNotch.type = sourceNotch.type || 'single'
        targetNotch.depthCm = Number(sourceNotch.depthCm ?? 0.45)
        targetNotch.matchedSeamId = seam.id
      }
    })
    const seam = project.seams.find((item) => item.id === seamId)
    setCommandResult(`Matched notch across ${seam?.name || 'the sewn seam'}`)
  }

  const updateNotch = (pieceId, notchId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const notch = piece?.notches?.find((item) => item.id === notchId)
      if (!notch) return
      const seam = notch.matchedSeamId ? next.seams.find((item) => item.id === notch.matchedSeamId) : null
      let nextValue = value
      if (field === 't' && seam) {
        const sourceSide = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === notch.edgeIndex
          ? 'a'
          : seam.b?.pieceId === pieceId && seam.b?.edgeIndex === notch.edgeIndex
            ? 'b'
            : null
        if (sourceSide) {
          const range = seamRange(seam[sourceSide])
          nextValue = clamp(Number(value), range.start, range.end)
        }
      }
      notch[field] = nextValue
      if (!notch.matchGroupId || !seam) return
      if (!seam) return
      for (const targetPiece of next.pieces) {
        for (const targetNotch of targetPiece.notches || []) {
          if (targetNotch.id === notch.id || targetNotch.matchGroupId !== notch.matchGroupId) continue
          if (field === 'type' || field === 'depthCm') targetNotch[field] = value
          if (field === 't') {
            const sourceIsA = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === notch.edgeIndex
            const sourceIsB = seam.b?.pieceId === pieceId && seam.b?.edgeIndex === notch.edgeIndex
            if (sourceIsA || sourceIsB) targetNotch.t = clamp(mapFractionAcrossSeam(seam, sourceIsA ? 'a' : 'b', Number(nextValue)), 0, 1)
          }
        }
      }
    })
  }

  const removeNotch = (pieceId, notchId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const notch = piece?.notches?.find((item) => item.id === notchId)
      if (!piece || !notch) return
      const matchGroupId = notch.matchGroupId
      if (matchGroupId) {
        for (const item of next.pieces) item.notches = (item.notches || []).filter((candidate) => candidate.matchGroupId !== matchGroupId)
      } else {
        piece.notches = (piece.notches || []).filter((candidate) => candidate.id !== notchId)
      }
    })
  }

  const addTopstitch = (pieceId, edgeIndex) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.topstitches = piece.topstitches || []
      piece.topstitches.push({
        id: uniqueId('topstitch'),
        edgeIndex,
        offsetCm: 0.7,
        rows: 1,
        rowGapCm: 0.45,
        stitchLengthMm: 3,
        color: '#8d8d8d',
      })
    })
    setCommandResult('Topstitch added; the edge is now visually and physically reinforced')
  }

  const addBinding = (pieceId, edgeIndex) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.bindings = piece.bindings || []
      piece.bindings.push({
        id: uniqueId('binding'),
        edgeIndex,
        ratio: 0.96,
        stiffness: 0.72,
        widthCm: 1.8,
        color: '#3b3b3b',
      })
    })
    setCommandResult('Edge binding added with a 96% stay ratio')
  }

  const addZipper = (pieceId, edgeIndex) => {
    const preset = getHardwarePreset(hardwareChoice.zipper)
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.zippers = piece.zippers || []
      piece.zippers.push({
        id: uniqueId('zipper'),
        edgeIndex,
        widthCm: (preset?.dimensionsMm.tapeWidthEachSide ?? 12) / 10,
        offsetCm: 0,
        type: preset?.zipperType || 'coil',
        color: preset?.pbr.baseColor || '#777777',
        hardwarePresetId: preset?.id,
      })
    })
    setCommandResult(`${preset?.name || 'Zipper'} annotation added; fastener mechanics require separate validation`)
  }

  const addButtonRow = (pieceId, count = 5) => {
    const preset = getHardwarePreset(hardwareChoice.button)
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece?.points?.length) return
      piece.buttons = piece.buttons || []
      const center = pieceCenter(piece)
      const ys = piece.points.map((point) => point.y)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const top = maxY - (maxY - minY) * 0.25
      const bottom = minY + (maxY - minY) * 0.22
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0.5 : index / (count - 1)
        const id = uniqueId('button')
        piece.buttons.push({
          id, x:center.x, y:top+(bottom-top)*t,
          diameterCm:1.8, color:'#222222',
          ...(preset ? hardwareToPatternAnnotation(preset.id,{
            x:center.x,y:top+(bottom-top)*t,annotationId:id,
          }) : {}),
          holes:preset?.holes ?? 4,
        })
      }
    })
    setCommandResult(`${count} × ${preset?.name || 'buttons'} added to ${selectedPiece?.name || 'pattern'}`)
  }

  const addButtonholeRow = (pieceId, count = 5) => {
    const preset = getHardwarePreset(hardwareChoice.buttonhole)
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece?.points?.length) return
      piece.buttonholes = piece.buttonholes || []
      const center = pieceCenter(piece)
      const ys = piece.points.map((point) => point.y)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const top = maxY - (maxY - minY) * 0.25
      const bottom = minY + (maxY - minY) * 0.22
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0.5 : index / (count - 1)
        const buttonholeId = uniqueId('buttonhole')
        const pairedButton = piece.buttons?.length === count ? piece.buttons[index] : null
        piece.buttonholes.push({
          id: buttonholeId,
          x: center.x,
          y: top + (bottom - top) * t,
          lengthCm: 2.4,
          widthCm: 0.35,
          orientationDeg: 0,
          color: '#575757',
          pairedButtonId: pairedButton?.id || null,
          ...(preset ? hardwareToPatternAnnotation(preset.id,{
            x:center.x,y:top+(bottom-top)*t,annotationId:buttonholeId,
          }) : {}),
        })
        if (pairedButton) pairedButton.pairedButtonholeId = buttonholeId
      }
    })
    setCommandResult(`${count} × ${preset?.name || 'buttonholes'} added to ${selectedPiece?.name || 'pattern'}`)
  }

  const updateButtonhole = (pieceId, buttonholeId, field, value) => {
    mutateProject((next) => {
      const buttonhole = next.pieces.find((item) => item.id === pieceId)?.buttonholes?.find((item) => item.id === buttonholeId)
      if (buttonhole) buttonhole[field] = value
    })
  }

  const removeButtonhole = (pieceId, buttonholeId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      const buttonhole = (piece.buttonholes || []).find((item) => item.id === buttonholeId)
      if (buttonhole?.pairedButtonId) {
        const button = (piece.buttons || []).find((item) => item.id === buttonhole.pairedButtonId)
        if (button?.pairedButtonholeId === buttonholeId) button.pairedButtonholeId = null
      }
      piece.buttonholes = (piece.buttonholes || []).filter((item) => item.id !== buttonholeId)
    })
  }

  const addRibNeckband = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front' && piece.points?.length >= 12)
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back' && piece.points?.length >= 12)
    if (!front || !back) {
      setCommandResult('Neckband generator needs a front and back upper-body pattern with a segmented neckline')
      return
    }
    if (project.pieces.some((piece) => piece.generatedRole === 'neckband')) {
      setCommandResult('This garment already has a generated neckband')
      return
    }

    const ratio = 0.88
    const widthCm = 4
    const attachments = [
      { pieceId: front.id, edgeIndex: 11 },
      { pieceId: front.id, edgeIndex: 10 },
      { pieceId: front.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 10 },
      { pieceId: back.id, edgeIndex: 11 },
    ]
    const segmentLengths = attachments.map(({ pieceId, edgeIndex }) => {
      const piece = project.pieces.find((item) => item.id === pieceId)
      return edgeLength(piece, edgeIndex) * ratio
    })
    const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0)
    const neckRadiusM = Math.max(0.048, Math.min(0.09, (totalLength / 100) / (Math.PI * 2)))
    let cursor = -totalLength * 0.5
    const bottom = [{ x: cursor, y: 0 }]
    for (const length of segmentLengths) {
      cursor += length
      bottom.push({ x: cursor, y: 0 })
    }
    const neckbandId = uniqueId('neckband')
    const points = [
      ...bottom,
      { x: cursor, y: widthCm },
      { x: -totalLength * 0.5, y: widthCm },
    ]

    mutateProject((next) => {
      const mainFabric = next.fabrics?.main || FABRIC_PRESETS.jersey
      if (!next.fabrics.rib) {
        next.fabrics.rib = {
          ...cloneProject(mainFabric),
          id: 'rib',
          name: '1×1 Rib Knit',
          gsm: Math.max(180, Math.round((mainFabric.gsm || 220) * 0.9)),
          stretchWarp: Math.max(0.20, mainFabric.stretchWarp || 0),
          stretchWeft: Math.max(0.38, mainFabric.stretchWeft || 0),
          bend: Math.min(0.64, mainFabric.bend ?? 0.65),
          damping: 0.987,
        }
      }
      next.pieces.push({
        id: neckbandId,
        name: 'Rib Neckband',
        generatedRole: 'neckband',
        points,
        layout2d: { x: 145, y: 42 },
        arrangement3d: { x: 0, y: 1.595, z: 0, radius: neckRadiusM, wrap: 'neck', phaseDeg: 180, direction: -1 },
        simulationResolution: 2,
        grainAngleDeg: 90,
        layerIndex: 1,
        notches: [],
        topstitches: [{ id: `${neckbandId}-topstitch`, edgeIndex: 7, offsetCm: 0.55, rows: 1, rowGapCm: 0.4, stitchLengthMm: 2.8, color: '#737373' }],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [],
        pins: [],
        seamAllowance: 0.7,
        fabricId: 'rib',
        cutQuantity: 1,
        locked: false,
      })
      attachments.forEach((attachment, index) => {
        next.seams.push({
          id: uniqueId('neck-seam'),
          name: `Neckband segment ${index + 1}`,
          type: 'normal',
          a: { pieceId: neckbandId, edgeIndex: index },
          b: attachment,
          reverseB: index < 3,
        })
      })
      next.seams.push({
        id: uniqueId('neckband-loop'),
        name: 'Neckband center-back closure',
        a: { pieceId: neckbandId, edgeIndex: 6 },
        b: { pieceId: neckbandId, edgeIndex: 8 },
      })
    })
    setSelectedPieceId(neckbandId)
    setSelectedFabricId('rib')
    setCommandResult(`Generated ${totalLength.toFixed(1)} cm rib neckband at ${Math.round(ratio * 100)}% of neckline length`)
  }

  const addStandCollar = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front' && piece.points?.length >= 12)
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back' && piece.points?.length >= 12)
    if (!front || !back) {
      setCommandResult('Stand collar generator needs a front and back upper-body pattern with a segmented neckline')
      return
    }
    if (project.pieces.some((piece) => piece.generatedRole === 'stand-collar')) {
      setCommandResult('This garment already has a generated stand collar')
      return
    }

    const ratio = 1.015
    const widthCm = 8
    const attachments = [
      { pieceId: front.id, edgeIndex: 11 },
      { pieceId: front.id, edgeIndex: 10 },
      { pieceId: front.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 10 },
      { pieceId: back.id, edgeIndex: 11 },
    ]
    const segmentLengths = attachments.map(({ pieceId, edgeIndex }) => {
      const piece = project.pieces.find((item) => item.id === pieceId)
      return edgeLength(piece, edgeIndex) * ratio
    })
    const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0)
    const neckRadiusM = Math.max(0.055, Math.min(0.11, (totalLength / 100) / (Math.PI * 2)))
    let cursor = -totalLength * 0.5
    const bottom = [{ x: cursor, y: 0 }]
    for (const length of segmentLengths) {
      cursor += length
      bottom.push({ x: cursor, y: 0 })
    }
    const collarId = uniqueId('stand-collar')
    const points = [
      ...bottom,
      { x: cursor, y: widthCm },
      { x: -totalLength * 0.5, y: widthCm },
    ]

    mutateProject((next) => {
      next.pieces.push({
        id: collarId,
        name: 'Stand Collar',
        generatedRole: 'stand-collar',
        points,
        layout2d: { x: 145, y: 52 },
        arrangement3d: { x: 0, y: 1.59, z: 0, radius: neckRadiusM, wrap: 'neck', phaseDeg: 180, direction: -1 },
        simulationResolution: 2,
        grainAngleDeg: 90,
        layerIndex: 1,
        notches: [],
        topstitches: [
          { id: `${collarId}-top`, edgeIndex: 7, offsetCm: 0.6, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
        ],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [
          { id: `${collarId}-roll`, type: 'fold', a: { x: -totalLength * 0.48, y: widthCm * 0.52 }, b: { x: totalLength * 0.48, y: widthCm * 0.52 }, foldAngleDeg: 155 },
        ],
        pins: [],
        seamAllowance: 1,
        fabricId: 'main',
        cutQuantity: 1,
        locked: false,
      })
      attachments.forEach((attachment, index) => {
        next.seams.push({
          id: uniqueId('collar-seam'),
          name: `Collar neckline segment ${index + 1}`,
          type: 'normal',
          a: { pieceId: collarId, edgeIndex: index },
          b: attachment,
          reverseB: index < 3,
        })
      })
      next.seams.push({
        id: uniqueId('collar-loop'),
        name: 'Collar center-back closure',
        a: { pieceId: collarId, edgeIndex: 6 },
        b: { pieceId: collarId, edgeIndex: 8 },
      })
    })
    setSelectedPieceId(collarId)
    setCommandResult(`Generated ${widthCm.toFixed(1)} cm stand collar from the measured neckline`)
  }

  const addTwoPanelHood = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front' && piece.points?.length >= 12)
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back' && piece.points?.length >= 12)
    if (!front || !back) {
      setCommandResult('Hood generator needs a front and back upper-body pattern with a segmented neckline')
      return
    }
    if (project.pieces.some((piece) => ['neckband', 'stand-collar', 'hood-left', 'hood-right'].includes(piece.generatedRole))) {
      setCommandResult('Remove the existing generated neckline construction before adding a hood')
      return
    }
    if (edgeIsSewn(front.id, 10) || edgeIsSewn(back.id, 10)) {
      setCommandResult('The center neckline edges must be unsewn before generating a two-panel hood')
      return
    }

    const leftId = uniqueId('hood-left')
    const rightId = uniqueId('hood-right')

    mutateProject((next) => {
      splitPieceEdgeInProject(next, front.id, 10, 0.5)
      splitPieceEdgeInProject(next, back.id, 10, 0.5)
      const nextFront = next.pieces.find((piece) => piece.id === front.id)
      const nextBack = next.pieces.find((piece) => piece.id === back.id)
      if (!nextFront || !nextBack) return

      // The tee neckline finish is replaced by the hood-to-neck seam.
      for (const bodyPiece of [nextFront, nextBack]) {
        bodyPiece.bindings = (bodyPiece.bindings || []).filter((item) => item.edgeIndex < 9 || item.edgeIndex > 12)
        bodyPiece.topstitches = (bodyPiece.topstitches || []).filter((item) => item.edgeIndex < 9 || item.edgeIndex > 12)
      }

      const rightAttachments = [
        { endpoint: { pieceId: nextFront.id, edgeIndex: 10 }, reverseB: true },
        { endpoint: { pieceId: nextFront.id, edgeIndex: 9 }, reverseB: true },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 9 }, reverseB: false },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 10 }, reverseB: false },
      ]
      const leftAttachments = [
        { endpoint: { pieceId: nextFront.id, edgeIndex: 11 }, reverseB: false },
        { endpoint: { pieceId: nextFront.id, edgeIndex: 12 }, reverseB: false },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 12 }, reverseB: true },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 11 }, reverseB: true },
      ]

      const buildHoodPiece = (id, name, attachments, wrap, layoutX) => {
        const lengths = attachments.map(({ endpoint }) => {
          const piece = next.pieces.find((item) => item.id === endpoint.pieceId)
          return edgeLength(piece, endpoint.edgeIndex)
        })
        const bottom = [{ x: 0, y: 0 }]
        let cursor = 0
        for (const length of lengths) {
          cursor += length
          bottom.push({ x: cursor, y: 0 })
        }
        const total = Math.max(24, cursor)
        return {
          id,
          name,
          generatedRole: wrap,
          hoodState: 'up',
          points: [
            ...bottom,
            { x: total, y: 31 },
            { x: total * 0.62, y: 49 },
            { x: total * 0.08, y: 41 },
          ],
          curves: {
            4: { cx: total + 3.5, cy: 16 },
            5: { cx: total * 0.93, cy: 48 },
            6: { cx: total * 0.34, cy: 55 },
            7: { cx: -2.5, cy: 21 },
          },
          layout2d: { x: layoutX, y: 52 },
          arrangement3d: { x: 0, y: 1.59, z: 0, wrap },
          simulationResolution: 1,
          grainAngleDeg: 0,
          layerIndex: 1,
          notches: [{ id: `${id}-neck-notch`, edgeIndex: 1, t: 0.5, type: 'single', depthCm: 0.45 }],
          topstitches: [{ id: `${id}-opening-stitch`, edgeIndex: 7, offsetCm: 2.1, rows: 2, rowGapCm: 0.5, stitchLengthMm: 3, color: '#777777' }],
          bindings: [],
          graphics: [],
          zippers: [],
          buttons: [],
          internalLines: [],
          pins: [],
          seamAllowance: 1,
          fabricId: 'main',
          cutQuantity: 1,
          marker: { allowCrossGrain: false },
          locked: false,
        }
      }

      const leftHood = buildHoodPiece(leftId, 'Hood Left', leftAttachments, 'hood-left', 62)
      const rightHood = buildHoodPiece(rightId, 'Hood Right', rightAttachments, 'hood-right', 248)
      next.pieces.push(leftHood, rightHood)

      const attachHood = (hood, attachments, sideName) => {
        attachments.forEach(({ endpoint, reverseB }, index) => {
          next.seams.push({
            id: uniqueId('hood-neck'),
            name: `${sideName} hood neckline ${index + 1}`,
            type: 'normal',
            a: { pieceId: hood.id, edgeIndex: index },
            b: endpoint,
            reverseB,
          })
        })
      }
      attachHood(leftHood, leftAttachments, 'Left')
      attachHood(rightHood, rightAttachments, 'Right')

      for (const edgeIndex of [4, 5, 6]) {
        next.seams.push({
          id: uniqueId('hood-center'),
          name: `Hood center seam ${edgeIndex - 3}`,
          type: 'normal',
          a: { pieceId: leftId, edgeIndex },
          b: { pieceId: rightId, edgeIndex },
          reverseB: false,
        })
      }
    })

    setSelectedPieceId(leftId)
    setCommandResult('Generated two-panel hood with measured neckline attachment and center crown seam')
  }

  const setGeneratedHoodState = (state) => {
    mutateProject((next) => {
      for (const piece of next.pieces || []) {
        if (['hood-left', 'hood-right'].includes(piece.generatedRole)) piece.hoodState = state
      }
    })
    setRunning(false)
    setResetSignal((signal) => signal + 1)
    setCommandResult(`Hood set ${state}`)
  }

  const addRibFinishSet = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front')
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back')
    const leftSleeve = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'left-arm')
    const rightSleeve = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'right-arm')
    if (!front || !back || !leftSleeve || !rightSleeve) {
      setCommandResult('Rib finish generator needs front, back, left sleeve, and right sleeve patterns')
      return
    }
    if (project.pieces.some((piece) => ['rib-waistband', 'rib-cuff-left', 'rib-cuff-right'].includes(piece.generatedRole))) {
      setCommandResult('This garment already has generated rib cuffs or waistband')
      return
    }

    const cuffRatio = 0.92
    const waistbandRatio = 0.94
    const cuffHeightCm = 9
    const waistbandHeightCm = 10
    const leftCuffId = uniqueId('rib-cuff-left')
    const rightCuffId = uniqueId('rib-cuff-right')
    const waistbandId = uniqueId('rib-waistband')

    mutateProject((next) => {
      const mainFabric = next.fabrics?.main || FABRIC_PRESETS.fleece
      if (!next.fabrics.rib) {
        next.fabrics.rib = {
          ...cloneProject(mainFabric),
          id: 'rib',
          name: '1×1 Rib Knit',
          gsm: Math.max(260, Math.round((mainFabric.gsm || 350) * 0.78)),
          stretchWarp: Math.max(0.22, mainFabric.stretchWarp || 0),
          stretchWeft: Math.max(0.42, mainFabric.stretchWeft || 0),
          bend: Math.min(0.68, mainFabric.bend ?? 0.7),
          damping: 0.987,
        }
      }

      const makeCuff = (id, name, sleeve, wrap, layoutX) => {
        const sleeveLength = edgeLength(sleeve, 3)
        const circumference = sleeveLength * cuffRatio
        const half = circumference * 0.5
        const radius = Math.max(0.055, Math.min(0.082, (circumference / 100) / (Math.PI * 2)))
        const cuff = {
          id,
          name,
          generatedRole: id.includes('left') ? 'rib-cuff-left' : 'rib-cuff-right',
          points: [
            { x: -half, y: 0 },
            { x: half, y: 0 },
            { x: half, y: cuffHeightCm },
            { x: -half, y: cuffHeightCm },
          ],
          layout2d: { x: layoutX, y: 206 },
          arrangement3d: { x: 0, y: 0, z: 0, wrap, radius, alongOffsetM: 0.075 },
          simulationResolution: 2,
          grainAngleDeg: 90,
          layerIndex: 1,
          notches: [],
          topstitches: [{ id: `${id}-finish`, edgeIndex: 0, offsetCm: 1.2, rows: 2, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' }],
          bindings: [],
          graphics: [],
          zippers: [],
          buttons: [],
          internalLines: [{ id: `${id}-fold`, type: 'fold', a: { x: -half * 0.95, y: cuffHeightCm * 0.5 }, b: { x: half * 0.95, y: cuffHeightCm * 0.5 }, foldAngleDeg: 175 }],
          pins: [],
          seamAllowance: 0.8,
          fabricId: 'rib',
          cutQuantity: 1,
          marker: { allowCrossGrain: false },
          locked: false,
        }
        next.pieces.push(cuff)
        next.seams.push(
          {
            id: uniqueId('cuff-attach'),
            name: `${name} attachment`,
            type: 'normal',
            a: { pieceId: id, edgeIndex: 2 },
            b: { pieceId: sleeve.id, edgeIndex: 3 },
            reverseB: true,
          },
          {
            id: uniqueId('cuff-loop'),
            name: `${name} loop closure`,
            type: 'normal',
            a: { pieceId: id, edgeIndex: 1 },
            b: { pieceId: id, edgeIndex: 3 },
            reverseB: true,
          },
        )
      }

      const nextLeftSleeve = next.pieces.find((piece) => piece.id === leftSleeve.id)
      const nextRightSleeve = next.pieces.find((piece) => piece.id === rightSleeve.id)
      makeCuff(leftCuffId, 'Left Rib Cuff', nextLeftSleeve, 'left-wrist', 52)
      makeCuff(rightCuffId, 'Right Rib Cuff', nextRightSleeve, 'right-wrist', 268)

      const nextFront = next.pieces.find((piece) => piece.id === front.id)
      const nextBack = next.pieces.find((piece) => piece.id === back.id)
      const frontLength = edgeLength(nextFront, 4) * waistbandRatio
      const backLength = edgeLength(nextBack, 4) * waistbandRatio
      const total = frontLength + backLength
      const half = total * 0.5
      const waist = {
        id: waistbandId,
        name: 'Rib Waistband',
        generatedRole: 'rib-waistband',
        points: [
          { x: -half, y: waistbandHeightCm },
          { x: -half + frontLength, y: waistbandHeightCm },
          { x: half, y: waistbandHeightCm },
          { x: half, y: 0 },
          { x: -half + frontLength, y: 0 },
          { x: -half, y: 0 },
        ],
        layout2d: { x: 145, y: 238 },
        arrangement3d: { x: 0, y: 0.89, z: 0, wrap: 'waist-band', phaseDeg: 180, direction: -1, easeM: 0.018 },
        simulationResolution: 2,
        grainAngleDeg: 90,
        layerIndex: 1,
        notches: [{ id: `${waistbandId}-side-notch`, edgeIndex: 0, t: 1, type: 'single', depthCm: 0.45 }],
        topstitches: [{ id: `${waistbandId}-finish`, edgeIndex: 3, offsetCm: 1.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' }],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [{ id: `${waistbandId}-fold`, type: 'fold', a: { x: -half * 0.96, y: waistbandHeightCm * 0.5 }, b: { x: half * 0.96, y: waistbandHeightCm * 0.5 }, foldAngleDeg: 175 }],
        pins: [],
        seamAllowance: 0.8,
        fabricId: 'rib',
        cutQuantity: 1,
        marker: { allowCrossGrain: false },
        locked: false,
      }
      next.pieces.push(waist)
      next.seams.push(
        {
          id: uniqueId('waistband-front'),
          name: 'Waistband to front hem',
          type: 'normal',
          a: { pieceId: waistbandId, edgeIndex: 0 },
          b: { pieceId: nextFront.id, edgeIndex: 4 },
          reverseB: false,
        },
        {
          id: uniqueId('waistband-back'),
          name: 'Waistband to back hem',
          type: 'normal',
          a: { pieceId: waistbandId, edgeIndex: 1 },
          b: { pieceId: nextBack.id, edgeIndex: 4 },
          reverseB: true,
        },
        {
          id: uniqueId('waistband-loop'),
          name: 'Waistband loop closure',
          type: 'normal',
          a: { pieceId: waistbandId, edgeIndex: 2 },
          b: { pieceId: waistbandId, edgeIndex: 5 },
          reverseB: true,
        },
      )
    })

    setSelectedPieceId(waistbandId)
    setSelectedFabricId('rib')
    setCommandResult('Generated separate rib cuffs and waistband from measured sleeve/body hems')
  }

  const addKangarooPocket = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front')
    if (!front) {
      setCommandResult('Kangaroo pocket generator needs a front upper-body pattern')
      return
    }
    if (project.pieces.some((piece) => piece.generatedRole === 'kangaroo-pocket')) {
      setCommandResult('This garment already has a generated kangaroo pocket')
      return
    }

    const pocketId = uniqueId('kangaroo-pocket')
    const targetYOffset = 10
    const points = [
      { x: -21, y: 0 },
      { x: 21, y: 0 },
      { x: 24, y: 14 },
      { x: 16, y: 24 },
      { x: -16, y: 24 },
      { x: -24, y: 14 },
    ]

    mutateProject((next) => {
      const nextFront = next.pieces.find((piece) => piece.id === front.id)
      if (!nextFront) return
      next.pieces.push({
        id: pocketId,
        name: 'Kangaroo Pocket',
        generatedRole: 'kangaroo-pocket',
        points,
        curves: {
          1: { cx: 23, cy: 6 },
          2: { cx: 23, cy: 19 },
          4: { cx: -23, cy: 19 },
          5: { cx: -23, cy: 6 },
        },
        layout2d: { x: 158, y: 166 },
        arrangement3d: { x: 0, y: 0.98 + targetYOffset / 100, z: 0, wrap: 'front' },
        simulationResolution: 2,
        grainAngleDeg: 0,
        layerIndex: 2,
        notches: [],
        topstitches: [
          { id: `${pocketId}-bottom`, edgeIndex: 0, offsetCm: 0.7, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
          { id: `${pocketId}-right-opening`, edgeIndex: 2, offsetCm: 1.4, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
          { id: `${pocketId}-top`, edgeIndex: 3, offsetCm: 0.7, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
          { id: `${pocketId}-left-opening`, edgeIndex: 4, offsetCm: 1.4, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
        ],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [],
        pins: [],
        surfaceAttachments: [
          { id: `${pocketId}-bottom-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 0, targetA: { x: -21, y: targetYOffset }, targetB: { x: 21, y: targetYOffset }, stiffness: 0.96 },
          { id: `${pocketId}-right-lower-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 1, targetA: { x: 21, y: targetYOffset }, targetB: { x: 24, y: targetYOffset + 14 }, stiffness: 0.95 },
          { id: `${pocketId}-top-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 3, targetA: { x: 16, y: targetYOffset + 24 }, targetB: { x: -16, y: targetYOffset + 24 }, stiffness: 0.96 },
          { id: `${pocketId}-left-lower-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 5, targetA: { x: -24, y: targetYOffset + 14 }, targetB: { x: -21, y: targetYOffset }, stiffness: 0.95 },
        ],
        seamAllowance: 1,
        fabricId: 'main',
        cutQuantity: 1,
        marker: { allowCrossGrain: false },
        locked: false,
      })
    })
    setSelectedPieceId(pocketId)
    setCommandResult('Generated kangaroo pocket with real interior surface-stitch constraints and open hand entries')
  }

  const updatePieceTrim = (pieceId, collection, trimId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const trim = piece?.[collection]?.find((item) => item.id === trimId)
      if (trim) trim[field] = value
    })
  }

  const removePieceTrim = (pieceId, collection, trimId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece[collection] = (piece[collection] || []).filter((item) => item.id !== trimId)
    })
  }

  const importGraphic = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedPiece) return
    try {
      const image = await imageFileToDataUrl(file)
      const aspect = image.sourceWidth / Math.max(1, image.sourceHeight)
      const widthCm = 20
      const heightCm = clamp(widthCm / Math.max(0.1, aspect), 4, 32)
      const center = pieceCenter(selectedPiece)
      mutateProject((next) => {
        const piece = next.pieces.find((item) => item.id === selectedPiece.id)
        if (!piece) return
        piece.graphics = piece.graphics || []
        piece.graphics.push({
          id: uniqueId('graphic'),
          name: file.name,
          src: image.src,
          x: center.x,
          y: center.y,
          widthCm,
          heightCm,
          rotationDeg: 0,
          opacity: 1,
        })
      })
      setCommandResult(`Placed ${file.name} on ${selectedPiece.name}`)
    } catch (error) {
      setCommandResult(`Artwork import failed: ${error.message}`)
    }
  }

  const updateGraphic = (pieceId, graphicId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const graphic = piece?.graphics?.find((item) => item.id === graphicId)
      if (graphic) graphic[field] = value
    })
  }

  const removeGraphic = (pieceId, graphicId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.graphics = (piece.graphics || []).filter((item) => item.id !== graphicId)
    })
  }

  const updateSelectedPiece = (field, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (piece) piece[field] = value
    })
  }

  const updateSelectedEdgeAllowance = (edgeIndex, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      piece.edgeSeamAllowances = { ...(piece.edgeSeamAllowances || {}) }
      const clamped = clamp(value, 0, 8)
      if (Math.abs(clamped - Number(piece.seamAllowance || 0)) < 1e-6) delete piece.edgeSeamAllowances[edgeIndex]
      else piece.edgeSeamAllowances[edgeIndex] = clamped
    })
  }

  // Numeric edits in the 2D canvas go through the same undoable document
  // transaction as the Property Editor; never mutate a rendered copy.
  const updatePatternEdgeAllowance = (pieceId, edgeIndex, value) => {
    if (!Number.isInteger(edgeIndex) || !Number.isFinite(value) || value < 0 || value > 8) return
    mutateProject((next) => {
      const piece = next.pieces.find(item => item.id === pieceId)
      if (!piece || piece.locked || edgeIndex >= piece.points.length) return
      piece.edgeSeamAllowances = { ...(piece.edgeSeamAllowances || {}) }
      if (Math.abs(value - Number(piece.seamAllowance || 0)) < 1e-6) delete piece.edgeSeamAllowances[edgeIndex]
      else piece.edgeSeamAllowances[edgeIndex] = value
    })
  }

  const resetSelectedEdgeAllowances = () => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (piece) piece.edgeSeamAllowances = {}
    })
    setCommandResult(`Reset ${selectedPiece.name} edge seam allowances to the pattern default`)
  }

  const updateSelectedArrangement = (field, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      piece.arrangement3d = piece.arrangement3d || { x: 0, y: 0.9, z: 0.2, flip: false }
      piece.arrangement3d[field] = value
      if (field === 'wrap' && value === 'front') piece.arrangement3d.z = Math.abs(piece.arrangement3d.z || 0.245)
      if (field === 'wrap' && value === 'back') piece.arrangement3d.z = -Math.abs(piece.arrangement3d.z || 0.245)
    })
  }

  const updateSelectedMarker = (field, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      piece.marker = piece.marker || { allowCrossGrain: false }
      piece.marker[field] = value
    })
  }

  const duplicateSelectedPiece = (mirrored = false, linked = false) => {
    if (clothcraftHybrid) {
      window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:mirrored?'mirror-selected':'duplicate-selected'}))
      return
    }
    if (!selectedPiece) return
    const source = cloneProject(selectedPiece)
    const xs = source.points.map((point) => point.x)
    const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5
    source.id = uniqueId('piece')
    source.name = `${selectedPiece.name}${linked ? ' Linked Mirror' : mirrored ? ' Mirror' : ' Copy'}`
    source.layout2d = { x: selectedPiece.layout2d.x + 72, y: selectedPiece.layout2d.y }
    source.arrangement3d = {
      ...(selectedPiece.arrangement3d || {}),
      x: (selectedPiece.arrangement3d?.x || 0) + (mirrored ? -0.65 : 0.65),
      wrap: undefined,
    }
    source.pins = (source.pins || []).map((pin) => ({ ...pin, id: uniqueId('pin') }))
    if (mirrored) {
      const edgeCount = source.points.length
      source.points = source.points
        .map((point) => ({ x: centerX - (point.x - centerX), y: point.y }))
        .reverse()
      if (source.curves) {
        source.curves = Object.fromEntries(Object.entries(source.curves).map(([edgeIndex, curve]) => {
          const oldIndex = Number(edgeIndex)
          const newIndex = (edgeCount - 2 - oldIndex + edgeCount) % edgeCount
          return [newIndex, { cx: centerX - (curve.cx - centerX), cy: curve.cy }]
        }))
      }
      source.internalLines = (source.internalLines || []).map((line) => ({
        ...line,
        a: { x: centerX - (line.a.x - centerX), y: line.a.y },
        b: { x: centerX - (line.b.x - centerX), y: line.b.y },
      }))
      source.pins = (source.pins || []).map((pin) => ({ ...pin, x: centerX - (pin.x - centerX) }))
      source.buttons = (source.buttons || []).map((button) => ({ ...button, id: uniqueId('button'), x: centerX - (button.x - centerX) }))
      source.buttonholes = (source.buttonholes || []).map((buttonhole) => ({
        ...buttonhole,
        id: uniqueId('buttonhole'),
        x: centerX - (buttonhole.x - centerX),
        orientationDeg: -(buttonhole.orientationDeg || 0),
      }))
      source.notches = (source.notches || []).map((notch) => ({
        ...notch,
        id: uniqueId('notch'),
        edgeIndex: (edgeCount - 2 - notch.edgeIndex + edgeCount) % edgeCount,
        t: 1 - (notch.t ?? 0.5),
      }))
      source.grainAngleDeg = -(source.grainAngleDeg || 0)
    }
    if (linked) source.linkedMirrorSourceId = selectedPiece.id
    mutateProject((next) => next.pieces.push(source))
    setSelectedPieceId(source.id)
  }

  const createLiningCopy = () => {
    if (!selectedPiece) return
    if (selectedPiece.generatedRole === 'lining') {
      setCommandResult('This pattern is already a lining piece')
      return
    }
    const liningId = uniqueId('lining')
    mutateProject((next) => {
      const shell = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!shell) return
      if (next.pieces.some((piece) => piece.liningForPieceId === shell.id)) {
        setCommandResult(`${shell.name} already has a lining copy`)
        return
      }

      if (!next.fabrics.lining) {
        next.fabrics.lining = {
          ...cloneProject(FABRIC_PRESETS.silk),
          id: 'lining',
          name: 'Lightweight Lining',
          gsm: 82,
          friction: 0.16,
          bend: 0.36,
          damping: 0.991,
          thickness: 0.001,
          color: '#7b7b80',
        }
      }

      const lining = cloneProject(shell)
      lining.id = liningId
      lining.name = `${shell.name} Lining`
      lining.generatedRole = 'lining'
      lining.liningForPieceId = shell.id
      lining.layerIndex = Math.max(0, (shell.layerIndex || 0))
      shell.layerIndex = Math.max(1, (shell.layerIndex || 0) + 1)
      lining.fabricId = 'lining'
      lining.layout2d = {
        x: (shell.layout2d?.x || 0) + 66,
        y: (shell.layout2d?.y || 0) + 12,
      }
      lining.arrangement3d = {
        ...(shell.arrangement3d || {}),
        surfaceOffsetM: Number(shell.arrangement3d?.surfaceOffsetM || 0) - 0.004,
      }
      lining.graphics = []
      lining.topstitches = []
      lining.bindings = []
      lining.zippers = []
      lining.buttons = []
      lining.buttonholes = []
      lining.surfaceAttachments = shell.points.map((_, edgeIndex) => ({
        id: `${liningId}-edge-${edgeIndex}`,
        targetPieceId: shell.id,
        sourceEdgeIndex: edgeIndex,
        targetEdgeIndex: edgeIndex,
        restM: 0.0025,
        stiffness: 0.84,
      }))
      lining.marker = { allowCrossGrain: false }
      lining.linkedMirrorSourceId = undefined
      next.pieces.push(lining)
    })
    setSelectedPieceId(liningId)
    setSelectedFabricId('lining')
    setCommandResult(`Created separate lining layer for ${selectedPiece.name}`)
  }

  const createInterfacingCopy = () => {
    if (!selectedPiece) return
    if (selectedPiece.generatedRole === 'interfacing') {
      setCommandResult('This pattern is already an interfacing piece')
      return
    }
    const interfacingId = uniqueId('interfacing')
    mutateProject((next) => {
      const shell = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!shell) return
      if (next.pieces.some((piece) => piece.interfacingForPieceId === shell.id)) {
        setCommandResult(`${shell.name} already has a fused interfacing copy`)
        return
      }
      next.fabrics = next.fabrics || {}
      if (!next.fabrics.interfacing) next.fabrics.interfacing = { ...cloneProject(FABRIC_PRESETS.interfacing), id: 'interfacing', name: 'Fusible Interfacing' }

      const interfacing = cloneProject(shell)
      interfacing.id = interfacingId
      interfacing.name = `${shell.name} Interfacing`
      interfacing.generatedRole = 'interfacing'
      interfacing.interfacingForPieceId = shell.id
      interfacing.fusedToPieceId = shell.id
      interfacing.fuseStiffness = 0.985
      interfacing.fuseGapM = 0.001
      interfacing.fabricId = 'interfacing'
      interfacing.layerIndex = shell.layerIndex || 0
      interfacing.layout2d = {
        x: (shell.layout2d?.x || 0) + 76,
        y: (shell.layout2d?.y || 0) + 18,
      }
      interfacing.arrangement3d = {
        ...(shell.arrangement3d || {}),
        surfaceOffsetM: Number(shell.arrangement3d?.surfaceOffsetM || 0) - 0.002,
      }
      interfacing.graphics = []
      interfacing.topstitches = []
      interfacing.bindings = []
      interfacing.zippers = []
      interfacing.buttons = []
      interfacing.buttonholes = []
      interfacing.surfaceAttachments = []
      interfacing.pins = []
      interfacing.linkedMirrorSourceId = undefined
      interfacing.marker = { allowCrossGrain: false }
      interfacing.strengthened = false
      interfacing.visible3d = false
      next.pieces.push(interfacing)
    })
    setSelectedPieceId(interfacingId)
    setSelectedFabricId('interfacing')
    setCommandResult(`Created fused interfacing layer for ${selectedPiece.name}`)
  }

  const unlinkSelectedMirror = () => {
    if (!selectedPiece?.linkedMirrorSourceId) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (piece) delete piece.linkedMirrorSourceId
    })
    setCommandResult(`${selectedPiece.name} is now an independent pattern`)
  }

  const updateFabric = (field, value) => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (target) target[field] = value
    })
  }
  const importFabricLabMeasurements = async (event) => {
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    try{
      if(file.size>4*1024*1024)throw new Error('Measurement JSON exceeds the 4 MB safety limit')
      const record=JSON.parse(await file.text())
      const presetId=fabric.catalogPresetId||
        Object.keys(FABRIC_PRESETS).find(key=>FABRIC_PRESETS[key].name===fabric.name)
      if(!presetId)throw new Error('Choose a fabric catalog preset before importing a lab specimen')
      if(record.fabricId!==presetId)throw new Error(`Lab record is for ${record.fabricId}; selected preset is ${presetId}`)
      const checked=calibrateFabricEvidence(record,FABRIC_PRESETS)
      mutateProject(next=>{
        const target=next.fabrics?.[selectedFabricId]||next.fabrics?.main
        if(!target)return
        // Only units that map *directly* to this cloth solver are applied.
        // Tensile, bending, and shear observations remain recorded pending
        // an independently validated constitutive model fitting process.
        if(checked.physical.arealMassKgM2)target.gsm=checked.physical.arealMassKgM2.value*1000
        if(checked.physical.thicknessM)target.thickness=checked.physical.thicknessM.value
        target.calibration={
          status:'imported-unverified',grade:checked.grade,
          specimenId:record.provenance.sampleId,
          evidenceUri:record.provenance.evidenceUri,
          source:record.provenance.sourceReference,
          note:'User-supplied measurement document; instrument traceability has not been independently verified.',
        }
        target.calibrationEvidence=record
        target.calibrationSuggestions=checked.solverSuggestions
      })
      setCommandResult(`Imported ${checked.grade}-coverage specimen evidence for ${presetId}; directly measured areal mass and thickness updated where provided. Solver stretch/shear/bend calibration requires separate validation.`)
    }catch(error){
      setCommandResult(`Laboratory evidence import rejected: ${error.message}`)
    }
  }
  const updateFabricWash = (updates) => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target) return
      target.wash = normalizeWashSpec({ ...target.wash, ...updates })
    })
  }

  const applyFabricPreset = (presetId) => {
    const preset = FABRIC_PRESETS[presetId]
    if (!preset) return
    mutateProject((next) => {
      const current = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      const targetId = current?.id || selectedFabricId || 'main'
      // A newly chosen scan-backed preset must install its OWN CC0 source;
      // otherwise the editor silently retained the previous fabric's photo.
      // Manually uploaded textures remain deliberate user overrides.
      const texture = current?.texture?.src && !current.texture.scanAssetId
        ? cloneProject(current.texture) : null
      next.fabrics[targetId] = { ...preset, id: targetId, catalogPresetId:presetId, name: preset.name, ...(current?.pricePerMeter != null ? { pricePerMeter: current.pricePerMeter } : {}), ...(texture ? { texture } : {}) }
    })
  }

  const importFabricTexture = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const image = await imageFileToDataUrl(file, 1536)
      mutateProject((next) => {
        const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
        if (!target) return
        const usedScan=Boolean(target.texture?.scanAssetId)
        target.texture = {
          ...(target.texture || {}),
          src: image.src,
          name: file.name,
          repeatWidthCm: target.texture?.repeatWidthCm ?? 20,
          repeatHeightCm: target.texture?.repeatHeightCm ?? 20,
          rotationDeg: target.texture?.rotationDeg ?? 0,
        }
        if (usedScan) {
          // Do not associate hand-uploaded color with the previous stock scan
          // or its unmatched normal/roughness maps.
          for(const field of ['scanAssetId','scanSource','license','originalSourceUrl','scanMatch','originalPhotoColor','photoReferenceIsShared','normalSrc','roughnessSrc'])
            delete target.texture[field]
          target.photoReference={status:'user-uploaded-texture',license:'user-responsibility',sourceFile:file.name}
        }
        // Photo-derived maps belong to the previous image; authored imported
        // PBR maps are kept intact when a user changes the color texture.
        for (const key of ['normal', 'roughness']) {
          if (target.texture[`${key}Name`] === 'Auto from textile image') {
            delete target.texture[`${key}Src`]
            delete target.texture[`${key}Name`]
          }
        }
      })
      setCommandResult(`Applied ${file.name} as the ${fabric.name || 'fabric'} surface texture`)
    } catch (error) {
      setCommandResult(`Fabric texture import failed: ${error.message}`)
    }
  }

  const updateFabricTexture = (field, value) => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target) return
      target.texture = target.texture || { src: '', name: 'Texture', repeatWidthCm: 20, repeatHeightCm: 20, rotationDeg: 0 }
      target.texture[field] = value
    })
  }

  const autoGenerateFabricPbr = async () => {
    if (fabricGeneratingPbr || !fabric.texture?.src) return
    const fabricId = selectedFabricId
    const source = fabric.texture.src
    setFabricGeneratingPbr(true)
    try {
      const result = await generateFabricPbrFromImage(source,{maxSize:512})
      let added=0
      mutateProject((next) => {
        const target=next.fabrics?.[fabricId]
        if (!target?.texture || target.texture.src!==source) return
        for (const key of ['normal','roughness']) {
          if (target.texture[`${key}Src`]) continue
          target.texture[`${key}Src`]=result[`${key}Src`]
          target.texture[`${key}Name`]='Auto from textile image'
          added++
        }
      })
      setCommandResult(added
        ? `Created ${added} estimated PBR map(s) from ${result.width}×${result.height} textile pixels. Fine-tune for physical accuracy.`
        : 'Normal and roughness maps already assigned; preserved existing user-authored maps.')
    } catch (error) {
      setCommandResult(`Photo-to-PBR generation failed: ${error.message}`)
    } finally {
      setFabricGeneratingPbr(false)
    }
  }

  const importFabricPbrMap = async (event, kind) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !['normal', 'roughness', 'metalness', 'opacity', 'displacement'].includes(kind)) return
    try {
      const image = await imageFileToDataUrl(file, 1536)
      mutateProject((next) => {
        const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
        if (!target) return
        target.texture = target.texture || { src: '', name: 'Texture', repeatWidthCm: 20, repeatHeightCm: 20, rotationDeg: 0 }
        target.texture[`${kind}Src`] = image.src
        target.texture[`${kind}Name`] = file.name
      })
      setCommandResult(`Applied ${file.name} as the ${fabric.name || 'fabric'} ${kind} map`)
    } catch (error) {
      setCommandResult(`${kind} map import failed: ${error.message}`)
    }
  }

  const importFabricPbrSet = async (event) => {
    const files=Array.from(event.target.files || [])
    event.target.value=''
    if (!files.length) return
    const recognized=files.map(file=>({file,kind:classifyFabricPbrFilename(file.name)}))
      .filter(item=>item.kind)
    if (!recognized.length) {
      setCommandResult('No supported maps found. Use filenames with _diff, _nor_gl, _rough, _metal, _opacity or _height. DirectX/packed maps require conversion.')
      return
    }
    try {
      const imported=await Promise.all(recognized.map(async item=>({
        ...item,image:await imageFileToDataUrl(item.file,1536),
      })))
      const targetFabricId=selectedFabricId
      mutateProject((next)=>{
        const target=next.fabrics?.[targetFabricId]
        if (!target) return
        target.texture=target.texture || {repeatWidthCm:20,repeatHeightCm:20,rotationDeg:0}
        for (const {file,kind,image} of imported) {
          const prefix=kind==='color' ? '' : kind
          target.texture[prefix ? `${prefix}Src` : 'src']=image.src
          target.texture[prefix ? `${prefix}Name` : 'name']=file.name
        }
      })
      setCommandResult(`Imported ${imported.length} fabric PBR channel(s). ${files.length-imported.length} unmatched or unsupported file(s) ignored.`)
    } catch (error) {
      setCommandResult(`PBR set import failed: ${error.message}`)
    }
  }

  const removeFabricPbrMap = (kind) => {
    if (!['normal', 'roughness', 'metalness', 'opacity', 'displacement'].includes(kind)) return
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target?.texture) return
      delete target.texture[`${kind}Src`]
      delete target.texture[`${kind}Name`]
    })
    setCommandResult(`${kind[0].toUpperCase()}${kind.slice(1)} map removed`)
  }

  const removeFabricTexture = () => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target?.texture) return
      delete target.texture.src
      delete target.texture.name
      if (!['normalSrc','roughnessSrc','metalnessSrc','opacitySrc','displacementSrc'].some(key => target.texture[key])) delete target.texture
    })
    setCommandResult('Fabric color texture removed; PBR detail maps were preserved')
  }

  const addFabricSwatch = () => {
    const id = uniqueId('fabric')
    mutateProject((next) => {
      const source = next.fabrics?.[selectedFabricId] || next.fabrics?.main || FABRIC_PRESETS.fleece
      next.fabrics = next.fabrics || {}
      next.fabrics[id] = {
        ...cloneProject(source),
        id,
        name: `Fabric ${Object.keys(next.fabrics).length + 1}`,
      }
    })
    setSelectedFabricId(id)
  }

  const addFabricPresetSwatch = (presetId) => {
    const preset = FABRIC_PRESETS[presetId]
    if (!preset) return
    const id = uniqueId('fabric')
    mutateProject((next) => {
      next.fabrics = next.fabrics || {}
      next.fabrics[id] = {...cloneProject(preset), id}
    })
    setSelectedFabricId(id)
    setActiveSection('Fabric')
    setObjectTab('Fabric')
    setShowObjectBrowser(true)
    setCommandResult(`Added ${preset.name} as a new swatch. Assign it to a pattern in Fabric properties.`)
  }

  // A library swatch click must affect the visible garment, not merely open
  // an inspector. Assign it to the active pattern without changing any
  // underlying draft shape, sewing topology, or the other fabric swatches.
  const assignFabric = (fabricId, allPieces = false) => {
    if (!project.fabrics?.[fabricId]) return
    mutateProject((next) => {
      for (const piece of next.pieces || []) {
        if (allPieces || piece.id === selectedPieceId) piece.fabricId = fabricId
      }
    })
    setSelectedFabricId(fabricId)
    setActiveSection('Fabric')
    setObjectTab('Fabric')
    setCommandResult(`Applied ${project.fabrics[fabricId].name || fabricId} to ${allPieces ? 'all pattern pieces' : (selectedPiece?.name || 'the selected pattern')}. The 3D cloth material updates with the project.`)
  }
  const addAndApplyFabricPreset = (presetId) => {
    const preset = FABRIC_PRESETS[presetId]
    if (!preset) return
    const id = uniqueId('fabric')
    mutateProject((next) => {
      next.fabrics = next.fabrics || {}
      next.fabrics[id] = { ...cloneProject(preset), id, catalogPresetId:presetId }
      if (selectedPieceId) {
        const piece = next.pieces.find(item => item.id === selectedPieceId)
        if (piece) piece.fabricId = id
      }
    })
    setSelectedFabricId(id)
    setActiveSection('Fabric')
    setObjectTab('Fabric')
    setShowObjectBrowser(true)
    setCommandResult(`Added ${preset.name} and applied it to ${selectedPiece?.name || 'the garment library'}.`)
  }

  const deleteFabricSwatch = (fabricId) => {
    if (fabricId === 'main') return
    mutateProject((next) => {
      if (!next.fabrics?.[fabricId]) return
      delete next.fabrics[fabricId]
      for (const piece of next.pieces || []) {
        if (piece.fabricId === fabricId) piece.fabricId = 'main'
      }
    })
    setSelectedFabricId('main')
  }

  const updateAvatar = (field, value) => {
    mutateProject((next) => {
      next.avatar[field] = value
    })
  }

  const importAvatarMesh = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['glb', 'obj'].includes(extension)) {
      setCommandResult('Export the CLO avatar to OBJ or GLB first. Native .avt files are not supported by the 3D viewport.')
      return
    }
    if (file.size > 80 * 1024 * 1024) {
      setCommandResult('Avatar file exceeds the 80 MB interactive import limit. Optimize the mesh before import.')
      return
    }
    const url = URL.createObjectURL(file)
    setCustomAvatar((previous) => { if (previous?.url) URL.revokeObjectURL(previous.url); return { url, type: extension, name: file.name } })
    setAvatarModel('custom-export')
    setCommandResult(`Loaded ${file.name} as the visual avatar. Physics remains on the measurement-based collision body.`)
  }

  const setAvatarModel = (model) => {
    if (model === 'clo-thomas') model = 'makehuman-base'
    if (avatarAvailability[model] === false) {
      setCommandResult(`${model} model is not installed. Select an available avatar or import an OBJ / GLB file.`)
      return
    }
    mutateProject((next) => {
      next.avatar.model = model
      if (model === 'clo-thomas') {
        next.avatar.name = 'CLO Thomas'
        next.avatar.armAngleDeg = Math.min(25, Number(next.avatar.armAngleDeg ?? 6))
      } else if (model === 'custom-export') {
        next.avatar.name = 'Imported CLO avatar mesh'
      } else if (model === 'theo') {
        next.avatar.name = 'Theo Fitting'
        next.avatar.armAngleDeg = 60
      } else if (model === 'nora') {
        next.avatar.name = 'Nora Fitting'
        next.avatar.armAngleDeg = 60
      } else {
        next.avatar.name = 'MakeHuman Base'
        next.avatar.armAngleDeg = Math.min(25, Number(next.avatar.armAngleDeg ?? 6))
      }
    })
  }

  const updateSimulation = (field, value) => {
    mutateProject((next) => {
      next.simulation[field] = value
    })
  }

  const startPpfSewing = async (options = {}) => {
    // onClick passes a browser event. Do not destructure arbitrary event
    // objects as fit configuration or preserve flags.
    const preserveInteractiveSimulation = options?.preserveInteractiveSimulation === true
    if (!project.seams.length || ['queued', 'running', 'connecting'].includes(ppfSewing.status)) return
    setPpfPreview(null)
    setPpfPreviewError('')
    setPpfSewing({ status: 'connecting', phase: 'health', jobId: null, error: null, summary: null, artifacts: null })
    try {
      const health = await getPpfServiceHealth()
      if (!health.ready) throw new Error(health.busy
        ? 'Another PPF solve is in progress. Wait for it to finish.'
        : 'PPF Metal is not ready (check solver runtime and available disk space).')
      if (!preserveInteractiveSimulation) setRunning(false)
      const job = await submitPpfFinalSolve(cloneProject(project), { frames: ppfFrames })
      setPpfSewing({ status: job.status, phase: job.phase, jobId: job.id, error: null, summary: job.summary, artifacts: null })
      setCommandResult(`PPF physical sewing started: ${job.id}`)
    } catch (error) {
      setPpfSewing({ status: 'error', phase: 'connection', jobId: null, error: error.message || String(error), summary: null, artifacts: null })
    }
  }

  const openZozoReference = async () => {
    if (zozoReference) { setZozoReference(null); setZozoReferencePlaying(false); return }
    setZozoReferenceLoading(true)
    setZozoReferenceError('')
    try {
      const reference = await loadZozoDressReference()
      setZozoReference(reference)
      setZozoReferenceFrame(reference.manifest.frames - 1)
      setZozoReferencePlaying(false)
      setRunning(false)
      setActiveSection('Fit')
      setCommandResult('Opened original ZOZO/Codim-IPC dress and pinned body with real saved Metal simulation. Experimental contact failures remain; your editable project is unchanged.')
    } catch (error) {
      setZozoReferenceError(error.message || String(error))
    } finally {
      setZozoReferenceLoading(false)
    }
  }

  useEffect(() => {
    if (!zozoReference || !zozoReferencePlaying) return undefined
    const timer = window.setInterval(() => setZozoReferenceFrame(frame => (frame + 1) % zozoReference.manifest.frames), 1000 / zozoReference.manifest.frameRate)
    return () => window.clearInterval(timer)
  }, [zozoReference, zozoReferencePlaying])

  const showPpfPreview = async (jobId = ppfSewing.jobId, frame = null, stage = null) => {
    if (!jobId || (ppfSewing.status !== 'done' && stage !== 'initial-assembly')) return
    setPpfPreviewLoading(true)
    setPpfPreviewError('')
    try {
      const preview = await getPpfJobPreview(jobId, { frame, stage })
      if (preview.format !== 'garment-studio.ppf-preview.v1') throw new Error('Unsupported PPF preview format')
      setRunning(false)
      setArrangementSpread(0)
      setPpfPreview(preview)
      setCommandResult(preview.stage === 'initial-assembly'
        ? 'Showing verified starting arrangement only. Sewing and continuous body-contact simulation are unfinished.'
        : preview.accepted
          ? `Showing accepted ZOZO PPF frame ${preview.frame + 1}/${preview.frames}`
          : `Showing experimental ZOZO PPF frame ${preview.frame + 1}/${preview.frames}. This result failed full fit validation.`)
    } catch (error) {
      setPpfPreviewError(error?.message || String(error))
    } finally {
      setPpfPreviewLoading(false)
    }
  }

  useEffect(() => {
    if (!ppfAutoRunRequestRef.current || !hasSimulated) return
    ppfAutoRunRequestRef.current = false
    if (['queued', 'running', 'connecting'].includes(ppfSewing.status)) return
    // Do not stop the interactive drape while its optional final quality
    // check runs in Blender. The asynchronous job checks actual body contact.
    void startPpfSewing({ preserveInteractiveSimulation: true })
  }, [hasSimulated, ppfSewing.status])

  useEffect(() => {
    if (!ppfSewing.jobId || !['queued', 'running'].includes(ppfSewing.status)) return undefined
    let active = true
    const poll = async () => {
      try {
        const job = await getPpfJob(ppfSewing.jobId)
        if (!active) return
        setPpfSewing({ status: job.status, phase: job.phase, jobId: job.id,
          error: job.error || null, summary: job.summary || null, artifacts: job.artifacts || null })
        if (job.status === 'done') {
          const acceptance = job.summary?.fitAcceptance
          setCommandResult(acceptance?.accepted
            ? `Validated PPF fit saved in Blender: ${job.artifacts?.blend || 'completed'}`
            : `PPF experimental solve is NOT approved as a fitted garment: ${job.summary?.contact?.maxAvatarIntersectionPairs || 0} body crossings, ${job.summary?.contact?.maxSelfIntersectionPairs || 0} self crossings. Source pattern and live cloth preserved.`)
        }
      } catch (error) {
        if (active) setPpfSewing((state) => ({ ...state, status: 'error', error: error.message || String(error) }))
      }
    }
    poll()
    const timer = setInterval(poll, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [ppfSewing.jobId, ppfSewing.status])

  const updateRenderSetting = (field, value) => {
    mutateProject((next) => {
      next.render = next.render || { environmentPreset: 'studio', exposure: 1.1, showEnvironment: false, widthPx: 2048, heightPx: 2560 }
      next.render[field] = value
    })
  }

  const updateRenderResolution = (widthPx, heightPx) => {
    mutateProject((next) => {
      next.render = next.render || { environmentPreset: 'studio', exposure: 1.1, showEnvironment: false, widthPx: 2048, heightPx: 2560 }
      next.render.widthPx = Math.round(clamp(widthPx, 512, 6144))
      next.render.heightPx = Math.round(clamp(heightPx, 512, 6144))
    })
  }

  const importHdri = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (hdriUrl) URL.revokeObjectURL(hdriUrl)
    const url = URL.createObjectURL(file)
    setHdriUrl(url)
    setHdriName(file.name)
    updateRenderSetting('environmentPreset', 'studio')
    setCommandResult(`Loaded HDRI environment ${file.name}`)
  }

  const clearHdri = () => {
    if (hdriUrl) URL.revokeObjectURL(hdriUrl)
    setHdriUrl('')
    setHdriName('')
    setCommandResult('Restored built-in studio environment')
  }

  const updateWind = (field, value) => {
    mutateProject((next) => {
      next.simulation.wind = next.simulation.wind || { enabled: false, speed: 4, directionDeg: 0, turbulence: 0.18, response: 0.025 }
      next.simulation.wind[field] = value
    })
  }

  const applySimulationQuality = (quality) => {
    const presets = {
      draft: { substeps: 1, iterations: 7 },
      balanced: { substeps: 2, iterations: 7 },
      final: { substeps: 4, iterations: 7 },
    }
    const preset = presets[quality]
    if (!preset) return
    mutateProject((next) => {
      next.simulation = { ...next.simulation, ...preset }
    })
    setCommandResult(`Simulation quality set to ${quality}`)
  }

  const updateGrading = (field, value) => {
    mutateProject((next) => {
      next.grading = next.grading || { baseSize: 'M', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }
      next.grading[field] = value
    })
  }

  const automaticGradeDelta = (piece, point) => {
    const sizes = project.grading?.sizes || ['M']
    const baseSize = project.grading?.baseSize || sizes[0]
    const baseIndex = Math.max(0, sizes.indexOf(baseSize))
    const previewSize = sizes[baseIndex + 1] || sizes[baseIndex - 1] || baseSize
    const offset = sizeOffset(project.grading, previewSize)
    if (!offset) return { dxPerSize: 0, dyPerSize: 0 }
    const automaticPoint = gradePointForPiece(piece, project.grading, previewSize, { ...point, gradeRule: undefined })
    return {
      dxPerSize: (automaticPoint.x - point.x) / offset,
      dyPerSize: (automaticPoint.y - point.y) / offset,
    }
  }

  const setPointGradeRuleEnabled = (pieceId, pointIndex, enabled) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const point = piece?.points?.[pointIndex]
      if (!piece || !point) return
      if (!enabled) {
        point.gradeRule = undefined
        return
      }
      const sizes = next.grading?.sizes || ['M']
      const baseSize = next.grading?.baseSize || sizes[0]
      const baseIndex = Math.max(0, sizes.indexOf(baseSize))
      const previewSize = sizes[baseIndex + 1] || sizes[baseIndex - 1] || baseSize
      const offset = sizeOffset(next.grading, previewSize)
      const automaticPoint = gradePointForPiece(piece, next.grading, previewSize, { ...point, gradeRule: undefined })
      point.gradeRule = {
        enabled: true,
        dxPerSize: offset ? (automaticPoint.x - point.x) / offset : 0,
        dyPerSize: offset ? (automaticPoint.y - point.y) / offset : 0,
      }
    })
  }

  const updatePointGradeRule = (pieceId, pointIndex, field, value) => {
    mutateProject((next) => {
      const point = next.pieces.find((item) => item.id === pieceId)?.points?.[pointIndex]
      if (!point) return
      point.gradeRule = point.gradeRule || { enabled: true, dxPerSize: 0, dyPerSize: 0 }
      point.gradeRule.enabled = true
      point.gradeRule[field] = value
    })
  }

  const updateMarkerSetting = (field, value) => {
    mutateProject((next) => {
      next.markerSettings = next.markerSettings || { fabricWidthCm: 150, gapCm: 1.5 }
      next.markerSettings[field] = value
    })
  }

  const updateMarkerFabricWidth = (fabricId, value) => {
    mutateProject((next) => {
      next.markerSettings = next.markerSettings || { fabricWidthCm: 150, gapCm: 1.5 }
      next.markerSettings.fabricWidthsCm = { ...(next.markerSettings.fabricWidthsCm || {}) }
      next.markerSettings.fabricWidthsCm[fabricId] = value
    })
  }

  const updateMarkerFabricPrice = (fabricId, value) => {
    mutateProject((next) => {
      if (!next.fabrics?.[fabricId]) return
      next.fabrics[fabricId].pricePerMeter = value === '' ? null : Math.max(0, Number(value))
    })
  }

  const resetSimulation = () => {
    setRunning(false)
    setHasSimulated(false)
    setArrangementSpread(0)
    setShowSewingGuides(true)
    setResetSignal((value) => value + 1)
    setCommandResult('Flat 3D pattern pieces restored around the avatar; press SIMULATE to drape')
  }

  const requestNativeSolve = async () => {
    setRunning(false)
    setHasSimulated(true)
    setAnalysisMode('surface')
    setNativeSolveStatus('checking')
    try {
      const health = await getNativeServiceHealth()
      if (!health?.ok) throw new Error('Native solver service is unavailable')
      setNativeServiceStatus('ready')
      setNativeSolveStatus('solving')
      setCommandResult('Native XPBD is solving the current garment…')
      setNativeSolveSignal((signal) => signal + 1)
    } catch (error) {
      setNativeServiceStatus('offline')
      setNativeSolveStatus('error')
      setCommandResult(`Native solver unavailable: ${error.message}`)
    }
  }

  const applyNativeQuality = (quality) => {
    const profile = NATIVE_QUALITY_PROFILES[quality] || NATIVE_QUALITY_PROFILES.draft
    mutateProject((next) => {
      next.simulation.nativeQuality = profile.id
      next.simulation.nativeClothModel = profile.clothModel
      next.simulation.nativeBendingModel = profile.bendingModel
    })
    setNativeSolveStatus('idle')
    setCommandResult(`Native XPBD quality set to ${profile.label}`)
  }

  const handleNativeSolve = (event) => {
    if (event.status === 'solving') {
      setNativeSolveStatus('solving')
      setNativeLastSolve(null)
      return
    }
    if (event.status === 'done') {
      const fitStatus = event.fitAssessment?.status || 'UNVERIFIED'
      setNativeSolveStatus(fitStatus === 'FAILED' ? 'unfit' : 'done')
      setNativeLastSolve({ elapsedMs: Number(event.elapsedMs || 0), stats: event.stats || {}, fitAssessment:event.fitAssessment || null, fitTrajectory:event.fitTrajectory || null, payload:event.payload || {} })
      const milliseconds = Number(event.elapsedMs || 0).toFixed(1)
      const seamMm = Number((event.stats?.seamAverageDistance || 0) * 1000).toFixed(1)
      setCommandResult(`Native XPBD numerical solve completed in ${milliseconds} ms · fit ${fitStatus}. Average seam distance ${seamMm} mm; this is not factory or collision-CCD approved.`)
      return
    }
    if (event.status === 'error') {
      setNativeSolveStatus('error')
      setCommandResult(`Native XPBD solve failed: ${event.error}`)
    }
  }

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}.garment.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const sendToClothCraft = async (bake = false) => {
    setClothCraftBusy(true)
    setCommandResult('Sending current garment to local ClothCraft Rust tools…')
    try {
      const operation = bake ? 'bake' : 'validate'
      const bridgeUrl = import.meta.env.VITE_CLOTHCRAFT_BRIDGE_URL || 'http://127.0.0.1:5193'
      const response = await fetch(`${bridgeUrl}/${operation}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: project }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'ClothCraft rejected this document')
      const download = (data, name, type) => {
        const href = URL.createObjectURL(new Blob([data], { type }))
        const anchor = document.createElement('a')
        anchor.href = href
        anchor.download = name
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(href), 1000)
      }
      download(JSON.stringify(result.template, null, 2), `${project.name.replace(/[^\w-]+/g, '-').toLowerCase()}-clothcraft-template.json`, 'application/json')
      if (bake && result.baking?.artifacts?.includes('cloth.obj')) {
        const meshResponse = await fetch(`${bridgeUrl}/artifacts/cloth.obj`)
        if (!meshResponse.ok) throw new Error('ClothCraft baking passed, but the generated OBJ could not be downloaded')
        const obj = await meshResponse.text()
        download(obj, 'clothcraft-baked-geometry.obj', 'text/plain')
        setClothCraftMeshPreview({ obj, garmentName: project.name })
      }
      setCommandResult(`ClothCraft Rust ${bake ? 'bake' : 'validation'} passed: ${result.rustValidation?.panels || result.template.panels.length} panels, ${result.rustValidation?.seams || result.template.seams.length} seams. ${result.warnings.length} export warnings. This is flat garment geometry; body fit is unverified.`)
    } catch (error) {
      setCommandResult(`ClothCraft integration unavailable or rejected project: ${error.message}. Start the local bridge with npm run clothcraft:serve.`)
    } finally {
      setClothCraftBusy(false)
    }
  }

  const runClothCraftOgc = async () => {
    setClothCraftBusy(true)
    setClothCraftContactResult(null)
    setCommandResult('ClothCraft Rust VBD + OGC is testing your garment against the selected body mesh…')
    try {
      const bridgeUrl = import.meta.env.VITE_CLOTHCRAFT_BRIDGE_URL || 'http://127.0.0.1:5193'
      const response = await fetch(`${bridgeUrl}/contact-simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: project, avatarModel: project.avatar?.model,
          steps: clothCraftContactSteps }),
      })
      const result = await response.json()
      setClothCraftContactResult(result)
      if (!response.ok || !result.ok) throw new Error(result.error || 'Rust OGC run failed')
      if (!result.artifacts?.cloth || !result.artifacts?.avatar) {
        throw new Error('Rust OGC did not produce the mesh and avatar diagnostic pair')
      }
      const [clothResponse, avatarResponse] = await Promise.all([
        fetch(`${bridgeUrl}${result.artifacts.cloth}`),
        fetch(`${bridgeUrl}${result.artifacts.avatar}`),
      ])
      if (!clothResponse.ok || !avatarResponse.ok) throw new Error('Generated contact mesh could not be fetched')
      const [obj, avatarObj] = await Promise.all([clothResponse.text(), avatarResponse.text()])
      setClothCraftMeshPreview({ obj, avatarObj, diagnostics: result,
        garmentName: project.name, kind: 'ogc' })
      setCommandResult(`ClothCraft Rust OGC: ${result.completedSteps} steps on ${project.avatar.name}. Worst seam gap ${result.maxSeamGapMm.toFixed(1)} mm, contacts ${result.activeContacts}. ${result.reason} Original EXO simulation is unchanged.`)
    } catch (error) {
      setCommandResult(`ClothCraft VBD + OGC unavailable or failed: ${error.message}. EXO simulation remains unchanged.`)
    } finally {
      setClothCraftBusy(false)
    }
  }

  const exportGarmentCode = () => {
    const payload = projectToGarmentCode(project)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-garmentcode.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`GarmentCode JSON exported with ${Object.keys(payload.pattern.panels).length} panels and ${payload.pattern.stitches.length} stitches`)
  }

  const exportSizeRun = () => {
    const payload = {
      format: 'garment-studio-size-run',
      version: 1,
      sourceProject: project.id,
      sourceRevision: project.revision,
      baseSize: project.grading?.baseSize || 'M',
      rules: project.grading,
      sizes: buildSizeRun(project),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-size-run.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportDxf = () => {
    if (exportSelectedPatternOnly && !selectedPiece) {
      setCommandResult('Choose a pattern piece in the 2D workspace before exporting selected-pattern DXF.')
      return
    }
    const exportedProject = exportSelectedPatternOnly
      ? { ...productionProject, pieces: productionProject.pieces.filter((piece) => piece.id === selectedPiece.id) }
      : productionProject
    const dxf = projectToDxf(exportedProject, gradePreviewSize)
    const blob = new Blob([dxf], { type: 'application/dxf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${gradePreviewSize.toLowerCase()}${exportSelectedPatternOnly ? `-${selectedPiece.id}` : ''}.dxf`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`${exportSelectedPatternOnly ? `Selected pattern '${selectedPiece.name}'` : 'All garment patterns'} exported as standard layered DXF in millimeters. AAMA/ASTM conformity has not been independently verified.`)
  }

  const exportBomXml = () => {
    const blob = new Blob([projectToBomXml(project)], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-bom.xml`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('BOM XML exported in the open EXO Sample 3D schema (not a proprietary CLO BOM format).')
  }

  const exportMarker = (format) => {
    if (!marker.placements.length) {
      setCommandResult('No marker was exported: no cut patterns fit this fabric width. Adjust the width or pattern geometry.')
      return
    }
    const data = format === 'pdf'
      ? markerToPdf(marker, { size: gradePreviewSize, project: productionProject })
      : markerToSvg(marker, { size: gradePreviewSize, fabricName: project.fabrics?.[marker.fabricId]?.name || marker.fabricId, project: productionProject })
    const blob = new Blob([data], { type: format === 'pdf' ? 'application/pdf' : 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${gradePreviewSize.toLowerCase()}-${marker.fabricId || 'main'}-marker.${format}`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`${format.toUpperCase()} marker exported at physical 1:1 scale. ${marker.unusedPieces ? `WARNING: ${marker.unusedPieces} requested cut pieces were NOT placed.` : 'Review scale and cutter compatibility with your factory.'} Print at 100%.`)
  }

  const exportMeasurements = () => {
    const csv = measurementRunToCSV(project)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-pom-spec.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('POM measurement spec exported for the full size run')
  }

  const exportTechPack = () => {
    const payload = buildTechPack(project)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-tech-pack.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('Structured tech pack exported with POMs, materials, construction, grading, and marker data')
  }

  const exportFactoryPackage = () => {
    const zip = buildFactoryPackageZip(project)
    const blob = new Blob([zip], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-factory-package.zip`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`Factory package exported with graded DXFs, XML/CSV BOM, POMs, printable PDF/SVG markers, structural preflight, trims, construction and editable source. ${productionPreflight.blockers ? `IMPORTANT: ${productionPreflight.blockers} production blockers are documented in production-preflight.json.` : 'Not independently factory-certified.'}`)
  }

  const downloadObj = (obj) => {
    const blob = new Blob([obj], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const size = activeSection === 'Production' ? gradePreviewSize : (project.grading?.baseSize || 'M')
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${String(size).toLowerCase()}-3d.obj`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`3D garment OBJ exported from the current ${running ? 'draped' : 'arranged'} mesh`)
  }

  const requestObjExport = () => setMeshExportSignal((signal) => signal + 1)

  const downloadGlb = (payload) => {
    const contents = payload instanceof ArrayBuffer ? payload : JSON.stringify(payload)
    const blob = new Blob([contents], { type: payload instanceof ArrayBuffer ? 'model/gltf-binary' : 'model/gltf+json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const size = activeSection === 'Production' ? gradePreviewSize : (project.grading?.baseSize || 'M')
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${String(size).toLowerCase()}-3d.${payload instanceof ArrayBuffer ? 'glb' : 'gltf'}`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('3D garment GLB exported with mesh and material data')
  }

  const requestGlbExport = () => setGlbExportSignal((signal) => signal + 1)

  const downloadRenderStill = ({ dataUrl, width, height }) => {
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${width}x${height}-render.png`
    anchor.click()
    setCommandResult(`Rendered ${width}×${height} PNG from the current camera and drape`)
  }

  const requestRenderStill = () => setRenderSignal((signal) => signal + 1)

  const importProject = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const source = await file.text()
      if (/\.dxf$/i.test(file.name)) {
        const imported = parseDxfPatterns(source)
        const next = cloneProject(project)
        next.id = uniqueId('project')
        next.name = file.name.replace(/\.dxf$/i, '') || 'Imported DXF'
        next.pieces = imported.pieces
        next.seams = []
        touchProject(next)
        pushUndo(cloneProject(project))
        setProject(next)
        setSelectedPieceId(next.pieces[0]?.id || null)
        setTool('select')
        setRunning(false)
        setCommandResult(`Imported ${next.pieces.length} closed DXF pattern${next.pieces.length === 1 ? '' : 's'} at ${(imported.scaleToCm * 10).toFixed(2)} mm/unit. Sewing is intentionally left unassigned for review.`)
      } else {
        const parsed = JSON.parse(source)
        if (parsed?.pattern?.panels && Array.isArray(parsed?.pattern?.stitches)) {
          const imported = garmentCodeToProject(parsed, createDefaultProject())
          pushUndo(cloneProject(project))
          touchProject(imported)
          setProject(imported)
          setSelectedPieceId(imported.pieces[0]?.id || null)
          setSelectedFabricId(Object.keys(imported.fabrics || {})[0] || 'main')
          setMarkerFabricId(Object.keys(imported.fabrics || {})[0] || 'main')
          setRunning(false)
          setResetSignal((signal) => signal + 1)
          setCommandResult(`Imported GarmentCode pattern with ${imported.pieces.length} panels and ${imported.seams.length} stitches`)
        } else {
          if (!Array.isArray(parsed.pieces) || !parsed.fabrics || !parsed.simulation) throw new Error('Invalid garment document')
          pushUndo(cloneProject(project))
          touchProject(parsed)
          setProject(parsed)
          setSelectedPieceId(parsed.pieces[0]?.id || null)
          setCommandResult(`Loaded ${file.name}`)
        }
      }
    } catch (error) {
      setCommandResult(`Import failed: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const importSeamlyMeasurements = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (!/\.(smis|smms)$/i.test(file.name)) throw new Error('Choose a SeamlyMe .smis or .smms measurement file')
      if (file.size > 2 * 1024 * 1024) throw new Error('Seamly measurement file exceeds the 2 MB safety limit')
      const parsed = parseSeamlyMeasurements(await file.text(), { filename: file.name })
      mutateProject(next => {
        const updated = applySeamlyMeasurements(next, parsed)
        next.measurementLibrary = updated.measurementLibrary
      })
      setCommandResult(`Imported ${parsed.measurementCount} SeamlyMe measurements from ${file.name}. Saved as an editable-project measurement library; no drafting geometry or avatar measurements were changed.`)
    } catch (error) {
      setCommandResult(`SeamlyMe import refused: ${error.message}`)
    }
  }

  const applySeamlyToAvatar = () => {
    const library = project.measurementLibrary?.seamly
    if (!library) return
    mutateProject(next => {
      const updated = applySeamlyMeasurements(next, library, { applyToAvatar: true })
      next.avatar = updated.avatar
    })
    setCommandResult('Applied directly comparable SeamlyMe body circumferences and height to the avatar. Original 2D pattern and sewing remain unchanged; Seamly parametric .sm2d formulas are not yet evaluated.')
  }

  const importSeamlyConstructionGraph = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (!/\.sm2d$/i.test(file.name)) throw new Error('Choose a Seamly2D .sm2d drafting construction')
      if (file.size > 4 * 1024 * 1024) throw new Error('Seamly construction graph exceeds the 4 MB safety limit')
      const graph = parseSeamlyConstructionReference(await file.text(), {filename:file.name})
      mutateProject(next => { next.seamlyConstructionReference=graph })
      setCommandResult(`Saved Seamly2D reference ${file.name}: ${graph.toolCount} construction tools in ${graph.blocks.length} blocks, with ${graph.incrementCount} original increment formulas. Current garment pattern and sewing were not changed.`)
    } catch (error) {
      setCommandResult(`Seamly2D construction import refused: ${error.message}`)
    }
  }

  const runCommand = (event) => {
    event?.preventDefault?.()
    const raw = command.trim()
    if (!raw) return
    const lower = raw.toLowerCase()
    const percent = Number(lower.match(/(-?\d+(?:\.\d+)?)\s*%/)?.[1])
    const centimeters = Number(lower.match(/(-?\d+(?:\.\d+)?)\s*(?:cm|centimeter)/)?.[1])

    if ((lower.includes('widen') || lower.includes('wider')) && selectedPiece && Number.isFinite(percent)) {
      mutateProject((next) => {
        const piece = next.pieces.find((item) => item.id === selectedPiece.id)
        const center = piece.points.reduce((sum, point) => sum + point.x, 0) / piece.points.length
        const scale = 1 + percent / 100
        piece.points = piece.points.map((point) => ({ ...point, x: center + (point.x - center) * scale }))
      })
      setCommandResult(`${selectedPiece.name} widened ${percent}%`)
    } else if (lower.includes('crop') && selectedPiece && Number.isFinite(centimeters)) {
      mutateProject((next) => {
        const piece = next.pieces.find((item) => item.id === selectedPiece.id)
        const maxY = Math.max(...piece.points.map((point) => point.y))
        piece.points = piece.points.map((point) => {
          const influence = Math.max(0, 1 - point.y / Math.max(1, maxY * 0.36))
          return { ...point, y: point.y + centimeters * influence }
        })
      })
      setCommandResult(`${selectedPiece.name} cropped approximately ${centimeters} cm from the hem`)
    } else if (lower.includes('seam allowance') && selectedPiece && Number.isFinite(centimeters)) {
      updateSelectedPiece('seamAllowance', clamp(centimeters, 0, 8))
      setCommandResult(`Seam allowance set to ${centimeters} cm`)
    } else if (lower.includes('heavier')) {
      updateFabric('gsm', clamp(fabric.gsm + 40, 40, 900))
      setCommandResult('Fabric weight increased by 40 gsm')
    } else if (lower.includes('lighter')) {
      updateFabric('gsm', clamp(fabric.gsm - 40, 40, 900))
      setCommandResult('Fabric weight reduced by 40 gsm')
    } else if (lower.includes('reset') && lower.includes('sim')) {
      resetSimulation()
    } else if (lower.includes('simulate') || lower.includes('drape')) {
      setHasSimulated(true)
      setArrangementSpread(0)
      setRunning(true)
      setCommandResult('Simulation started')
    } else {
      setCommandResult('Command understood as a future AI action. Current local verbs: widen %, crop cm, seam allowance cm, heavier/lighter fabric, simulate, reset simulation.')
    }
    setCommand('')
  }

  const estimatedLength = marker.length / 100

  // Menu commands all route through existing editor actions. Unimplemented CLO
  // functionality appears disabled in the menu inventory instead of pretending
  // to modify the garment or running a no-op.
  const executeStudioAction = (action) => {
    setOpenMenu(null)
    setSimulationMenuOpen(false)
    switch (action) {
      case 'file.new': applyGarmentTemplate(GARMENT_TEMPLATES[0]?.id); break
      case 'file.open': importInputRef.current?.click(); break
      case 'file.save': saveProject(); break
      case 'file.export': exportProject(); break
      case 'edit.undo': undo(); break
      case 'edit.redo': redo(); break
      case 'edit.delete': deleteSelectedPiece(); break
      case '3d.simulate': toggleSimulation(); break
      case '3d.reset': resetSimulation(); break
      case '3d.orbit': setViewportTool('orbit'); break
      case '3d.transform': setViewportTool('transform'); break
      case '3d.move': setViewportTool('move'); break
      case '3d.rotate': setViewportTool('rotate'); break
      case '3d.hand': setViewportTool('hand'); break
      case '3d.camera': setFitCameraSignal(value => value + 1); break
      case '3d.fit': setAnalysisMode('ease'); setActiveSection('Fit'); break
      case '3d.seams': setShowSewingGuides(value => !value); break
      case '2d.select': setActiveSection('Pattern'); setTool('select'); break
      case '2d.points': setActiveSection('Pattern'); setTool('point'); break
      case '2d.split': setActiveSection('Pattern'); setTool('split'); break
      case '2d.curve': setActiveSection('Pattern'); setTool('curve'); break
      case '2d.internal': setActiveSection('Pattern'); setTool('internal'); break
      case '2d.notch': setActiveSection('Pattern'); setTool('notch'); break
      case '2d.pin': setActiveSection('Pattern'); setTool('pin'); break
      case '2d.measure': setActiveSection('Pattern'); setTool('measure'); break
      case '2d.mirror': duplicateSelectedPiece(true); setActiveSection('Pattern'); break
      case '2d.add': addPiece(); setActiveSection('Pattern'); break
      case 'sewing.sew': setActiveSection('Sewing'); setTool('sew'); break
      case 'sewing.inspect': setActiveSection('Sewing'); break
      case 'sewing.fastener': setActiveSection('Sewing'); setTool('fastener'); break
      case 'materials.fabric': setObjectTab('Fabric'); setActiveSection('Fabric'); break
      case 'materials.edit': setActiveSection('Fabric'); break
      case 'materials.add': addFabricSwatch(); setObjectTab('Fabric'); setActiveSection('Fabric'); break
      case 'materials.graphic': graphicInputRef.current?.click(); break
      case 'avatar.library': setAssetCategory('Avatar'); setActiveSection('Avatar'); break
      case 'avatar.properties': setActiveSection('Avatar'); break
      case 'avatar.import': avatarMeshInputRef.current?.click(); break
      case 'workspace.production': setActiveSection('Production'); break
      case 'object.scene': setObjectTab('Scene'); setShowObjectBrowser(true); setActiveSection('Pattern'); break
      case 'object.buttons': setObjectTab('Button'); setShowObjectBrowser(true); setActiveSection('Sewing'); break
      case 'object.buttonholes': setObjectTab('Buttonhole'); setShowObjectBrowser(true); setActiveSection('Sewing'); break
      case 'object.topstitch': setObjectTab('Topstitch'); setShowObjectBrowser(true); setActiveSection('Sewing'); break
      case 'object.trim': setObjectTab('Trim'); setShowObjectBrowser(true); setActiveSection('Sewing'); break
      case 'object.grading': setObjectTab('Grading'); setShowObjectBrowser(true); setActiveSection('Production'); break
      case 'object.pom': setObjectTab('POM'); setShowObjectBrowser(true); setActiveSection('Production'); break
      case 'render.workspace': setActiveSection('Render'); break
      case 'render.capture': setRenderSignal(value => value + 1); break
      case 'display.surface': setAnalysisMode('surface'); setWireframe(false); break
      case 'display.wireframe': setWireframe(value => !value); break
      case 'display.strain': setAnalysisMode('strain'); break
      case 'display.grid': setShow2DGrid(value => !value); break
      case 'settings.workspace': setCompactTools(value => !value); break
      case 'workspace.profile.drafting': applyWorkspaceProfile(WORKSPACE_PROFILES.drafting); break
      case 'workspace.profile.sewing': applyWorkspaceProfile(WORKSPACE_PROFILES.sewing); break
      case 'workspace.profile.materials': applyWorkspaceProfile(WORKSPACE_PROFILES.materials); break
      case 'workspace.profile.render': applyWorkspaceProfile(WORKSPACE_PROFILES.render); break
      case 'workspace.profile.save': saveCustomWorkspace(); break
      case 'workspace.profile.restore': restoreCustomWorkspace(); break
      case 'workspace.view.split': setViewportLayout('split'); break
      case 'workspace.view.stack': setViewportLayout('stack'); break
      case 'workspace.view.2d': setViewportLayout('2d'); break
      case 'workspace.view.3d': setViewportLayout('3d'); break
      case 'workspace.view.reset': setViewportLayout('split'); setViewportSplit(50); break
      case 'workspace.panel.objects': setShowObjectBrowser(value => !value); break
      case 'workspace.panel.toggle-library': setLibraryVisible(value => !value); break
      case 'workspace.panel.toggle-inspector': setInspectorVisible(value => !value); break
      case 'workspace.panel.library': setSidebarView('library'); break
      case 'workspace.panel.history': setSidebarView('history'); break
      case 'settings.top-tabs': setShowTopWorkspaceTabs(value => !value); break
      case 'settings.simulation': setActiveSection('Fit'); break
      case 'help.reference': setCommandResult('CLO-style controls: use the icon tooltips; unfinished tools are labeled planned. The editor remains an independent garment simulator.'); break
      case 'help.shortcuts': setCommandResult('SPACE simulate/pause · ⌘S save · ⌘Z undo · 3D: Q select/orbit, W move, E rotate, H fabric hand, V sewing guides, T combined gizmo, G/R aliases; arrows nudge panels (Ctrl+↑/↓ depth). 2D: A select/transform, Z edit points, P pin, arrows move selected pattern 1 cm, F fit, Shift+F focus. Some CLO commands remain unimplemented.'); break
      default: break
    }
  }

  // The macOS native shell sends the same actions from its actual menu bar.
  const actionRef = useRef(executeStudioAction)
  actionRef.current = executeStudioAction
  useEffect(() => {
    const onNativeMenu = (event) => actionRef.current?.(event.detail)
    window.addEventListener('garment-studio-native-action', onNativeMenu)
    return () => window.removeEventListener('garment-studio-native-action', onNativeMenu)
  }, [])

  const libraryItemMatches = (name) => name.toLowerCase().includes(librarySearch.trim().toLowerCase())
  const rustCommand = (command) => window.dispatchEvent(new CustomEvent('exo-clothcraft-command', {detail: command}))
  const simForVisibleEngine = () => clothcraftHybrid ? rustCommand('toggle-sim') : toggleSimulation()
  const resetForVisibleEngine = () => clothcraftHybrid ? rustCommand('reset') : resetSimulation()
  const saveForVisibleEngine = () => clothcraftHybrid ? rustCommand('save') : saveProject()
  const exportForVisibleEngine = () => clothcraftHybrid ? rustCommand('export') : exportProject()
  const undoForVisibleEngine = () => clothcraftHybrid ? rustCommand('undo') : undo()
  const redoForVisibleEngine = () => clothcraftHybrid ? rustCommand('redo') : redo()
  const visibleRunning = clothcraftHybrid ? Boolean(clothcraftLive?.running) : running
  const clo7ThreeDHandlers={
    simulate:simForVisibleEngine,
    transform:()=>setViewportTool('transform'),
    'mesh-select':()=>{setViewportTool('mesh-select');setWireframe(true)},
    pin:()=>setTool('pin'),
    seams:()=>setShowSewingGuides(value=>!value),
    'avatar-panel':()=>setActiveSection('Avatar'),
    'fabric-panel':()=>{setActiveSection('Fabric');setObjectTab('Fabric');setShowObjectBrowser(true)},
    'material-panel':()=>{setActiveSection('Fabric');setObjectTab('Fabric');setShowObjectBrowser(true)},
    'buttons-panel':()=>{setActiveSection('Sewing');setObjectTab('Button');setShowObjectBrowser(true)},
    'trim-panel':()=>{setActiveSection('Sewing');setObjectTab('Trim');setShowObjectBrowser(true)},
    fastener:()=>setTool('fastener'),
  }
  const enabledClo3D = slot => Boolean(slot.action && clo7ThreeDHandlers[slot.action] &&
    (!clothcraftHybrid || !['mesh-select','pin','fastener'].includes(slot.action)))
  const activateCloTool = (slot,dimension,runOnly=false) => {
    const capability=getClo7NativeCapability(dimension,slot.id)
    // Native tools should immediately hand control to the drawing viewport:
    // an explanatory overlay would obscure Save/Close Pattern and edit nodes.
    // For missing or inspection-only tools retain the explicit help panel.
    if(!runOnly)setSelectedCloTool(capability?.mode==='native'?null:
      {slot,dimension,status:capability?.mode||'unavailable',reason:capability?.reason})
    if(!clothcraftHybrid){
      if(dimension==='3d'&&enabledClo3D(slot))clo7ThreeDHandlers[slot.action]?.()
      else if(dimension==='2d'){
        const action={select:'select',point:'point',internal:'internal',sew:'sew'}[slot.action]
        if(action){setTool(action);setActiveSection(action==='sew'?'Sewing':'Pattern')}
        else if(slot.action==='create-polygon')addPolygonPiece()
      }
      return
    }
    // Trigger real native V2 actions only; a CLO reference slot is never
    // silently redirected to a cosmetically similar unrelated tool.
    switch(capability?.nativeAction){
      case 'simulation.toggle':simForVisibleEngine();break
      case 'viewport3d.selectMove':
        setViewportTool('transform');rustCommand('mode:move3d');setActiveSection('Pattern');break
      case 'arrangement.reset3d':
        resetForVisibleEngine();break
      case 'pattern2d.selectTransform':
        setTool('select');setActiveSection('Pattern');rustCommand('mode:edit');
        window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:'select'}}));break
      case 'pattern2d.editPoints':
        setTool('point');setActiveSection('Pattern');rustCommand('mode:edit');
        window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:'point'}}));break
      case 'pattern2d.drawPolygon':
        setTool('polygon');setActiveSection('Pattern');rustCommand('mode:pen');break
      case 'pattern2d.drawInternalLine':
        setTool('internal');setActiveSection('Sewing');rustCommand('mode:line');
        window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:'internal'}}));break
      case 'sewing.freeSew':
        setTool('sew');setActiveSection('Sewing');rustCommand('mode:sew');
        window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:'sew'}}));break
      default:
        // A read-only inspector remains useful without claiming that the
        // original CLO authoring command or solver has been implemented.
        if(capability?.inspectionAction==='sewing.inspectSeams')setActiveSection('Sewing')
        if(capability?.inspectionAction==='fabric.inspectProperties'){
          setActiveSection('Fabric');setObjectTab('Fabric');setShowObjectBrowser(true)
        }
        if(capability?.inspectionAction==='dimensions.show')setActiveSection('Production')
        if(capability?.inspectionAction==='dimensions.measureTemporary'){
          setActiveSection('Production');rustCommand('mode:edit');
          window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:'measure'}}))
        }
    }
  }
  const renderClo7ThreeDSlot = slot => {
    const capability=getClo7NativeCapability('3d',slot.id)
    const handler=clothcraftHybrid?capability?.mode==='native':enabledClo3D(slot)
    const pressed=slot.action==='simulate'?visibleRunning
      :slot.action==='transform'?viewportTool==='transform'
      :slot.action==='mesh-select'?viewportTool==='mesh-select'
      :slot.action==='pin'?tool==='pin'
      :slot.action==='fastener'?tool==='fastener'
      :slot.action==='seams'?showSewingGuides:false
    return <button key={slot.id} type="button" data-clo-slot={`3d:${slot.id}`}
      title={`${slot.label} · ${handler?'Run native EXO action':'Click for tool details and implementation status'}`}
      aria-label={slot.label} aria-pressed={Boolean(pressed||selectedCloTool?.dimension==='3d'&&selectedCloTool?.slot?.id===slot.id)}
      data-clo-implementation={capability?.mode||'unavailable'}
      className={`${pressed?'active':''} ${handler?'clo-supported-tool':'clo-tool-inquire'}`}
      disabled={false}
      style={slot.after?{marginBottom:9}:undefined}
      onClick={()=>activateCloTool(slot,'3d')}><CadToolIcon id={slot.icon} size={20}/></button>
  }
  useEffect(() => {
    if (!clothcraftHybrid) return undefined
    const onStatus = event => {setClothcraftLive(event.detail);const mode={edit:'orbit',move3d:'move',rotate3d:'rotate',stretch3d:'hand'}[event.detail?.mode];if(mode)setViewportTool(mode)}
    window.addEventListener('exo-clothcraft-status', onStatus)
    return () => window.removeEventListener('exo-clothcraft-status', onStatus)
  }, [clothcraftHybrid])
  useEffect(()=>{
    if(!clothcraftHybrid)return undefined
    // Viewport selection supersedes any older Fabric/Trim/Object Browser
    // context, even when the user reselects the same physical edge.
    const onNativePick=()=>{setSelectedObjectForProperties(null);setObjectTab('Scene');setActiveSection('Pattern')}
    window.addEventListener('exo-clothcraft-native-pick',onNativePick)
    return()=>window.removeEventListener('exo-clothcraft-native-pick',onNativePick)
  },[clothcraftHybrid])
  useEffect(() => {
    if (!clothcraftHybrid) return
    rustCommand(`set-wireframe:${wireframe}`)
  }, [clothcraftHybrid,wireframe])
  useEffect(() => {
    if (!clothcraftHybrid) return
    rustCommand(`set-seams:${showSewingGuides}`)
  }, [clothcraftHybrid,showSewingGuides])
  useEffect(() => {
    if (!clothcraftHybrid) return
    const modes={select:'edit',point:'edit',curve:'edit',sew:'sew',internal:'line'}
    if (modes[tool]) rustCommand(`mode:${modes[tool]}`)
  }, [clothcraftHybrid,tool])
  useEffect(() => {
    if (!clothcraftHybrid) return
    const modes={orbit:'edit',transform:'move3d',move:'move3d',rotate:'rotate3d',hand:'stretch3d'}
    if (modes[viewportTool]) rustCommand(`mode:${modes[viewportTool]}`)
  }, [clothcraftHybrid,viewportTool])
  useEffect(() => {
    if (!clothcraftHybrid||!selectedPieceId) return
    rustCommand(`select:${selectedPieceId}`)
  }, [clothcraftHybrid,selectedPieceId,clothcraftLive?.name])

  return (
    <div className={`app-shell ${showTopWorkspaceTabs ? '' : 'workspace-tabs-hidden'} ${clothcraftHybrid ? 'exo-v2-shell' : ''}`}>
      <div className="clo-mac-menu" role="menubar" aria-label="EXO Sample 3D application menus">
        <div className="clo-app-menu-brand"><span className="clo-brand-dot">◈</span><strong>EXO Sample 3D</strong></div>
        {CLO_MENUS.map(menu => <div className="clo-menu-group" key={menu.title}>
          <button type="button" className={openMenu === menu.title ? 'active' : ''} aria-expanded={openMenu === menu.title} onClick={() => { setSimulationMenuOpen(false); setOpenMenu(openMenu === menu.title ? null : menu.title) }}>{menu.title}</button>
          {openMenu === menu.title && <div className="clo-menu-popover" role="menu">{menu.commands.map(([label, action]) => <button key={label} role="menuitem" disabled={!action} onClick={() => executeStudioAction(action)}>{label}{!action && <small>PREVIEW</small>}</button>)}</div>}
        </div>)}
        <div className="clo-menu-spacer"/>
        <div className="file-actions clo-compact-file-actions">
          <button type="button" className="clo-top-tabs-toggle" title="Show / hide top workspace tabs" aria-pressed={showTopWorkspaceTabs} onClick={() => setShowTopWorkspaceTabs(value => !value)}><LayoutPanelTop size={15}/></button>
          {showTopWorkspaceTabs && <select className="clo-workspace-select" aria-label="Workspace" value={activeSection} onChange={(event) => setActiveSection(event.target.value)}>{SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}</select>}
          <select className="clo-workspace-select clo-layout-preset-select" aria-label="CLO-style workspace layout presets" value="" onChange={(event) => {
            const key = event.target.value
            if (key === 'save') saveCustomWorkspace()
            else if (key === 'restore') restoreCustomWorkspace()
            else if (WORKSPACE_PROFILES[key]) applyWorkspaceProfile(WORKSPACE_PROFILES[key])
          }}>
            <option value="">LAYOUT</option>
            {Object.entries(WORKSPACE_PROFILES).map(([key, profile]) => <option key={key} value={key}>{profile.name}</option>)}
            <option value="save">Save my layout</option>
            <option value="restore">Restore my layout</option>
          </select>
          <select className="clo-workspace-select clo-window-mode-select" aria-label="3D and 2D window arrangement" value={viewportLayout} onChange={event => setViewportLayout(event.target.value)}>
            {Object.entries(VIEWPORT_LAYOUTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button type="button" className="clo-command-launch" aria-label="Search commands" title="Find working commands · ⌘K" onClick={() => setCommandPaletteOpen(true)}><Search size={15}/><span>⌘K</span></button>
          <button type="button" className="clo-command-launch clo-panel-toggle" aria-label="Toggle asset browser panel" aria-pressed={libraryVisible} title="Show / hide Library" onClick={() => setLibraryVisible(value => !value)}><PanelLeft size={15}/></button>
          <button type="button" className="clo-command-launch clo-panel-toggle" aria-label="Show or hide Property Editor" aria-pressed={inspectorVisible} title="Show / hide Property Editor" onClick={() => setInspectorVisible(value => !value)}><PanelRight size={15}/></button>
          {clothcraftHybrid && <div className="exo-v2-rust-engine" role="status" title="Actual ClothCraft Rust VBD + OGC engine · experimental fit">
            <span className="exo-v2-rust-dot"/><span>ClothCraft <strong>RUST</strong></span>
          </div>}
          <div className="clo-simulate-control">
            <button className={`clo-simulate-main ${visibleRunning ? 'running' : ''}`} onClick={simForVisibleEngine} title="Simulate or pause visible garment · Space"><ArrowDownToLine size={16}/><span>{visibleRunning ? 'PAUSE' : 'SIM'}</span></button>
            {!clothcraftHybrid && <button className="clo-simulate-arrow" title="Simulation modes" aria-expanded={simulationMenuOpen} onClick={() => { setLeftSimulationMenuOpen(false); setOpenMenu(null); setSimulationMenuOpen(value => !value) }}><ChevronDown size={13}/></button>}
            {simulationMenuOpen && <div className="clo-simulation-popover">
              <strong>Simulation mode</strong>
              <button onClick={() => { applySimulationQuality('balanced'); setSimulationMenuOpen(false) }}><Check size={14}/> Normal · Balanced</button>
              <button onClick={() => { applySimulationQuality('final'); setSimulationMenuOpen(false) }}><SlidersHorizontal size={14}/> Fitting · Quality</button>
              <button onClick={() => { applySimulationQuality('draft'); setSimulationMenuOpen(false) }}><Activity size={14}/> Fast · Draft</button>
              <button disabled title="GPU cloth simulation has not yet been implemented"><Cpu size={14}/> GPU simulation <small>PLANNED</small></button>
              <button onClick={requestNativeSolve} disabled={nativeServiceStatus !== 'ready'} title={nativeServiceStatus === 'ready' ? 'Solve using connected native XPBD service' : 'Native solver service is offline'}><Box size={14}/> Native XPBD solve {nativeServiceStatus !== 'ready' ? <small>OFFLINE</small> : null}</button>
            </div>}
          </div>
          {clothcraftHybrid && <button className="exo-v2-top-action" aria-label="Step ClothCraft Rust simulation" title="Advance ClothCraft Rust simulation one step" disabled={clothcraftLive?.busy||visibleRunning} onClick={() => rustCommand('step')}><Activity size={13}/> STEP</button>}
          {clothcraftHybrid && <button className="exo-v2-top-action" aria-label="Reset pattern position outside avatar" title="Restore the garment's original off-body arrangement without deleting patterns, seams or materials; recover an invalid saved drape if needed" onClick={() => rustCommand('reset-position')}><RotateCcw size={13}/> RESET PANELS</button>}
          <button className="icon-button" title="Undo" disabled={clothcraftHybrid ? clothcraftLive?.busy||!clothcraftLive?.canUndo : !undoStack.length} onClick={undoForVisibleEngine}><Undo2 size={17} /></button>
          <button className="icon-button" title="Redo" disabled={clothcraftHybrid ? clothcraftLive?.busy||!clothcraftLive?.canRedo : !redoStack.length} onClick={redoForVisibleEngine}><Redo2 size={17} /></button>
          <span className="toolbar-divider" />
          <button className="icon-button" title="Import garment" onClick={() => importInputRef.current?.click()}><Upload size={17} /></button>
          <button className="icon-button" title="Export visible garment" disabled={clothcraftHybrid&&clothcraftLive?.busy} onClick={exportForVisibleEngine}><Download size={17} /></button>
          <button className={`save-button ${saveState}`} disabled={clothcraftHybrid&&clothcraftLive?.busy} onClick={saveForVisibleEngine}><Save size={15} />{clothcraftHybrid ? 'SAVE RUST' : saveState === 'saved' ? 'SAVED' : 'SAVE'}</button>
          <input ref={importInputRef} hidden type="file" accept=".json,.garment,.dxf" onChange={importProject} />
          <input ref={seamlyMeasureInputRef} hidden type="file" accept=".smis,.smms" onChange={importSeamlyMeasurements} />
          <input ref={seamlyPatternInputRef} hidden type="file" accept=".sm2d" onChange={importSeamlyConstructionGraph} />
          <input ref={graphicInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={importGraphic} />
          <input ref={fabricTextureInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={importFabricTexture} />
          <input ref={fabricEvidenceInputRef} hidden type="file" accept="application/json,.json" onChange={importFabricLabMeasurements} />
          <input ref={fabricNormalInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'normal')} />
          <input ref={fabricRoughnessInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'roughness')} />
          <input ref={fabricMetalnessInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'metalness')} />
          <input ref={fabricOpacityInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'opacity')} />
          <input ref={fabricDisplacementInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'displacement')} />
          <input ref={fabricPbrSetInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={importFabricPbrSet} />
          <input ref={avatarMeshInputRef} hidden type="file" accept=".obj,.glb" onChange={importAvatarMesh} />
          <input ref={hdriInputRef} hidden type="file" accept=".hdr,image/vnd.radiance" onChange={importHdri} />
        </div>
      </div>

      <div className="project-strip">
        <div className="project-name">
          <span>PROJECT</span>
          {clothcraftHybrid ? <input aria-label="Visible ClothCraft project name" title="Rust project name is managed by the native garment session" value={clothcraftLive?.name || 'ClothCraft native garment'} readOnly/> : <input value={project.name} onChange={(event) => mutateProject((next) => { next.name = event.target.value }, { record: false })}/>}
          <select className="template-select" value={project.templateId || 'custom'} onChange={(event) => event.target.value !== 'custom' && applyGarmentTemplate(event.target.value)}>
            <option value="custom">Custom</option>
            {GARMENT_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>
        <div className="project-meta"><span>REV {clothcraftHybrid ? clothcraftLive?.revision ?? '—' : project.revision}</span><span>{clothcraftHybrid ? clothcraftLive?.panels ?? '—' : project.pieces.length} PATTERNS</span><span>{clothcraftHybrid ? clothcraftLive?.seams ?? '—' : project.seams.length} SEAMS</span></div>
        <form className="command-bar" onSubmit={runCommand}>
          <Sparkles size={15} />
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={clothcraftHybrid ? 'EXO draft commands (separate from the ClothCraft garment)…' : 'Tell the garment what to change…'} />
          <button type="submit">RUN</button>
        </form>
      </div>

      <main className="main-layout clo-adjustable-panels" data-library-visible={libraryVisible} data-inspector-visible={inspectorVisible} style={{ '--library-width': `${libraryWidth}px`, '--inspector-width': `${inspectorWidth}px`, '--object-browser-height': `${objectBrowserHeight}px`, '--effective-library-width': libraryVisible ? `${libraryWidth}px` : '0px', '--effective-inspector-width': inspectorVisible ? `${inspectorWidth}px` : '0px' }}>
        <nav className="clo-edge-tabs" aria-label="Workspace side panels">
          <button type="button" aria-pressed={sidebarView === 'library' && libraryVisible} className={sidebarView === 'library' && libraryVisible ? 'active' : ''} onClick={() => { setLibraryVisible(true); setSidebarView('library') }} title="Open asset library">LIBRARY</button>
          <button type="button" aria-pressed={sidebarView === 'history' && libraryVisible} className={sidebarView === 'history' && libraryVisible ? 'active' : ''} onClick={() => { setLibraryVisible(true); setSidebarView('history') }} title="Open undo and redo history">HISTORY</button>
        </nav>
        <aside className="asset-browser" hidden={!libraryVisible}>
          {sidebarView === 'history' ? <section className="clo-history-browser">
            <header>History</header>
            <p>Recorded garment snapshots · current session</p>
            <div className="clo-history-actions">
              <button type="button" onClick={undoForVisibleEngine} disabled={clothcraftHybrid ? !clothcraftLive?.canUndo : !undoStack.length}><Undo2 size={15}/> Undo <span>{clothcraftHybrid ? clothcraftLive?.canUndo ? '1+' : '0' : undoStack.length}</span></button>
              <button type="button" onClick={redoForVisibleEngine} disabled={clothcraftHybrid ? !clothcraftLive?.canRedo : !redoStack.length}><Redo2 size={15}/> Redo <span>{clothcraftHybrid ? clothcraftLive?.canRedo ? '1+' : '0' : redoStack.length}</span></button>
            </div>
            <div className="clo-history-timeline" role="list" aria-label="Recent garment history">
              <div className="clo-history-current" role="listitem"><strong>Current · revision {project.revision ?? '—'}</strong><span>{project.pieces.length} patterns · {project.seams.length} seams</span></div>
              {undoStack.map((snapshot, index) => ({snapshot,index})).reverse().slice(0, 20).map(({snapshot,index}) => <button role="listitem" type="button" key={`${index}-${snapshot.id || ''}-${snapshot.revision || ''}`} data-undo-index={index} title={`Restore garment revision ${snapshot.revision ?? index}`} onClick={() => restoreHistorySnapshot(index)}>
                <span>Revision {snapshot.revision ?? '—'}</span><small>{snapshot.pieces?.length ?? 0} patterns · {snapshot.seams?.length ?? 0} seams</small>
              </button>)}
              {!undoStack.length && <div className="clo-history-empty">Edit a pattern to create an undo checkpoint.</div>}
            </div>
            <div className="clo-history-note">Select a revision to restore it. Skipped edits remain accessible through Redo. Session history is not a replacement for saving your project.</div>
          </section> : <>
          <LibraryChrome category={assetCategory} setCategory={setAssetCategory} search={librarySearch} setSearch={setLibrarySearch} thumbnails={libraryThumbnails} setThumbnails={setLibraryThumbnails}>
            {clothcraftHybrid && (assetCategory === 'Fabric' || assetCategory === 'Material') ? <div className="asset-placeholder"><Shirt size={26}/><strong>Native fabric library</strong><span>{CLOTHCRAFT_FABRICS.length} selectable textile examples, including uncalibrated apparel starting points.</span><button onClick={() => setActiveSection('Fabric')}>Open fabric library</button></div> : (assetCategory === 'Garment' || assetCategory === 'Patterns') ? GARMENT_TEMPLATES.filter(template => libraryItemMatches(template.name)).map((template) => (
              <button className="asset-template garment-tile" key={template.id} onClick={() => applyGarmentTemplate(template.id)} title={`${template.name} · ${template.description}`}>
                <span className="asset-template-icon">{assetCategory === 'Patterns' ? <PatternLibraryThumbnail templateId={template.id} name={template.name}/> : <GarmentSilhouette type={template.name}/>}</span><span className="asset-template-label">{template.name}</span>
              </button>
            )) : assetCategory === 'Fabric' || assetCategory === 'Material' ? <>
              <div className="clo-fabric-library-divider">PROJECT SWATCHES · CLICK TO APPLY TO SELECTED PATTERN</div>
              {Object.entries(project.fabrics || {}).filter(([,item]) => libraryItemMatches(item.name)).map(([id, item]) => (
                <button className="asset-template garment-tile" key={id} onClick={() => assignFabric(id)} title={`Apply ${item.name} to selected garment pattern`}><span className="asset-template-icon fabric-library-thumbnail" style={fabricSwatchStyle(item)}><span/></span><span className="asset-template-label">{item.name}</span></button>
              ))}
              <div className="clo-fabric-library-divider">TEXTILES · {FABRIC_SCAN_COVERAGE.total} PRESETS · ADD & APPLY</div>
              <p className="panel-copy">{FABRIC_SCAN_COVERAGE.photographicReferences} presets inherit one of {FABRIC_SCAN_COVERAGE.uniqueLicensedScans} genuine CC0 photo scans. {FABRIC_SCAN_COVERAGE.proceduralFallbacks} use purpose-built procedural yarn appearances. Shared references are not 400 unique measured textiles. All mechanics require specimen calibration.</p>
              {FABRIC_PRESET_GROUPS.map(([group,entries])=>{
                const matching=entries.filter(([,item])=>libraryItemMatches(item.name))
                if(!matching.length)return null
                return <React.Fragment key={group}>
                  <div className="clo-fabric-library-divider">{group.toUpperCase()} · {matching.length}</div>
                  {matching.map(([id,item])=><button className="asset-template garment-tile" key={`preset-${id}`} onClick={() => addAndApplyFabricPreset(id)} title={`Create ${item.name} and apply to selected pattern · estimated physical values`}><span className="asset-template-icon fabric-library-thumbnail" style={fabricSwatchStyle(item)}><span/></span><span className="asset-template-label">+ {item.name}</span></button>)}
                </React.Fragment>
              })}
            </> : assetCategory === 'Avatar' ? AVAILABLE_AVATARS.filter(({ name }) => libraryItemMatches(name)).map(({ name, model }) => (
              <button className="asset-template garment-tile" key={name} disabled={avatarAvailability[model] !== true} onClick={() => { setActiveSection('Avatar'); setAvatarModel(model) }}><span className="asset-template-icon avatar-library-thumbnail">♙</span><span className="asset-template-label">{name}{avatarAvailability[model] === false ? ' · Not installed' : ''}</span></button>
            )) : assetCategory === 'Hardware and Trims' ? (
              <>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addButtonRow(selectedPiece.id, 5); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="buttons" size={48}/></span><span className="asset-template-label">Five-button row</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addButtonholeRow(selectedPiece.id, 5); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="buttonholes" size={48}/></span><span className="asset-template-label">Five buttonholes</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addZipper(selectedPiece.id, trimEdgeIndex); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="trim" size={48}/></span><span className="asset-template-label">Edge zipper</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addTopstitch(selectedPiece.id, trimEdgeIndex); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="topstitch" size={48}/></span><span className="asset-template-label">Topstitch seam</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addBinding(selectedPiece.id, trimEdgeIndex); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="seam-weld" size={48}/></span><span className="asset-template-label">Edge binding</span></button>
                <div className="clo-fabric-library-divider">HARDWARE REFERENCE PRESETS · {listHardwarePresets().length}</div>
                {listHardwarePresets().filter(preset=>libraryItemMatches(`${preset.name} ${preset.kind} ${preset.material}`)).map(preset=>(
                  <button className="asset-template garment-tile" key={preset.id}
                    title={`${preset.material} · ${preset.finish}. ${preset.construction}`}
                    onClick={()=>{
                      if(['button','buttonhole','zipper'].includes(preset.kind))
                        setHardwareChoice(current=>({...current,[preset.kind]:preset.id}))
                      setActiveSection('Sewing')
                      setCommandResult(['button','buttonhole','zipper'].includes(preset.kind)
                        ? `${preset.name} selected. Add it to the garment using Edge construction.`
                        : `${preset.name} is cataloged with dimensions and finish; placement and rigid contact are in development.`)
                    }}>
                    <span className="asset-template-icon clo-hardware-preview" style={{background:preset.pbr.baseColor}}>
                      <CadToolIcon id={preset.kind==='button'?'buttons':preset.kind==='buttonhole'?'buttonholes':'trim'} size={36}/>
                    </span>
                    <span className="asset-template-label">{preset.name}</span>
                  </button>
                ))}
              </>
            ) : assetCategory === 'Stage' ? (
              <>
                <div className="clo-fabric-library-divider">STUDIO ENVIRONMENTS · LIVE LIGHTING</div>
                {[
                  ['studio','Classic Studio'],
                  ['softbox','Softbox'],
                  ['neutral','Neutral White'],
                  ['dramatic','Dramatic Contrast'],
                ].filter(([,name]) => libraryItemMatches(name)).map(([id,name]) => <button key={id} className={`asset-template garment-tile clo-stage-option ${(project.render?.environmentPreset || 'studio') === id ? 'selected' : ''}`} onClick={() => { updateRenderSetting('environmentPreset', id); setActiveSection('Render') }} title={`Use ${name} lighting on the 3D garment`}><span className={`asset-template-icon clo-stage-preview stage-${id}`}><span className="clo-stage-floor"/><Shirt size={36}/></span><span className="asset-template-label">{name}</span></button>)}
              </>
            ) : <div className="asset-placeholder"><FolderOpen size={26}/><strong>{assetCategory}</strong><span>The collection is reserved for future assets.</span></div>}
          </LibraryChrome>
          </>}
          <div className="clo-panel-resizer clo-left-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Library width" title="Drag to resize Library" onPointerDown={(event) => beginPanelResize('library', event)} onPointerMove={movePanelResize} onPointerUp={endPanelResize} onLostPointerCapture={endPanelResize} onDoubleClick={() => setLibraryWidth(232)}/>
        </aside>
        <aside className={`tool-rail ${compactTools ? 'compact' : ''}`} aria-label="3D and sewing toolbar">
          <div className="clo-rail-section"><strong>3D TOOLS</strong></div>
          <button type="button" className="clo-reference-mode-toggle"
            aria-label={show3DToolMap?'Hide unavailable CLO 3D reference positions':'Show complete CLO 3D reference map'}
            aria-pressed={show3DToolMap}
            title={show3DToolMap?'Show working 3D tools only':'Show all CLO reference positions, including tools EXO does not support yet'}
            onClick={()=>setShow3DToolMap(value=>!value)}>
            {show3DToolMap?'HIDE MAP':'FULL MAP'}
          </button>
          <div className="clo-left-3d-double-bars" aria-label="CLO 7 reference 3D two-column toolbar">
            <div className="clo-left-3d-column" aria-label="3D editing column A">
              {(show3DToolMap?CLO7_3D_A:CLO7_3D_A.filter(enabledClo3D)).map(renderClo7ThreeDSlot)}
            </div>
            <div className="clo-left-3d-column" aria-label="3D garment column B">
              {(show3DToolMap?CLO7_3D_B:CLO7_3D_B.filter(enabledClo3D)).map(renderClo7ThreeDSlot)}
            </div>
          </div>
          <div className="clo-rail-section"><strong>EXO · 3D EXTRAS</strong></div>
          <div className="clo-left-3d-double-bars" aria-label="EXO additional 3D controls not present in photographed reference positions">
            <div className="clo-left-3d-column" aria-label="Additional 3D actions column A">
              {!clothcraftHybrid && <button className={leftSimulationMenuOpen ? 'active' : ''} onClick={() => { setSimulationMenuOpen(false); setLeftSimulationMenuOpen(value => !value) }} title="EXO simulation quality modes" aria-expanded={leftSimulationMenuOpen}><CadToolIcon id="simulation-modes" size={20}/></button>}
              <button className={viewportTool === 'hand' ? 'active' : ''} onClick={() => setViewportTool('hand')} title="EXO 3D fabric hand tool"><CadToolIcon id="hand" size={20}/></button>
              <button className={viewportTool === 'move' ? 'active' : ''} onClick={() => setViewportTool('move')} title="EXO 3D move garment"><CadToolIcon id="move-3d" size={20}/></button>
            </div>
            <div className="clo-left-3d-column" aria-label="Additional 3D actions column B">
              <button className={viewportTool === 'rotate' ? 'active' : ''} onClick={() => setViewportTool('rotate')} title="EXO 3D rotate selected fabric"><CadToolIcon id="rotate-3d" size={20}/></button>
              <button className={wireframe ? 'active' : ''} title="EXO toggle garment mesh wireframe" onClick={() => setWireframe(value => !value)}><CadToolIcon id="wireframe" size={20}/></button>
              {!clothcraftHybrid && <button className={analysisMode === 'strain' ? 'active' : ''} title="EXO strain map" onClick={() => setAnalysisMode(analysisMode === 'strain' ? 'surface' : 'strain')}><CadToolIcon id="surface" size={20}/></button>}
            </div>
          </div>
          {leftSimulationMenuOpen && !clothcraftHybrid && <div className="clo-simulation-popover clo-simulation-left-popover">
            <strong>SIMULATION · SOLVER MODES</strong>
            <button onClick={() => { applySimulationQuality('draft'); setLeftSimulationMenuOpen(false) }}><Activity size={14}/> Fast · Draft</button>
            <button onClick={() => { applySimulationQuality('balanced'); setLeftSimulationMenuOpen(false) }}><Check size={14}/> Normal · Balanced</button>
            <button onClick={() => { applySimulationQuality('final'); setLeftSimulationMenuOpen(false) }}><SlidersHorizontal size={14}/> Fitting · Quality</button>
            <button onClick={() => { requestNativeSolve(); setLeftSimulationMenuOpen(false) }} disabled={nativeServiceStatus !== 'ready'}><Cpu size={14}/> Native XPBD {nativeServiceStatus !== 'ready' ? '· OFFLINE' : ''}</button>
            <button onClick={() => { resetSimulation(); setLeftSimulationMenuOpen(false) }}><RotateCcw size={14}/> Reset to flat pieces</button>
          </div>}
          {!clothcraftHybrid && <>
          <span className="rail-divider" /><div className="clo-rail-section"><strong>2D PATTERN</strong></div>
          <div className="clo-left-3d-double-bars clo-left-secondary-bars" aria-label="Pattern shortcuts in two columns">
            <div className="clo-left-3d-column">
              <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} title="Select / move"><CadToolIcon id="select-2d" size={20}/></button>
              <button className={tool === 'point' ? 'active' : ''} onClick={() => setTool('point')} title="Edit points"><CadToolIcon id="points" size={20}/></button>
              <button className={tool === 'split' ? 'active' : ''} onClick={() => setTool('split')} title="Split edge / add point"><CadToolIcon id="split" size={20}/></button>
              <button className={tool === 'curve' ? 'active' : ''} onClick={() => setTool('curve')} title="Curve edges"><CadToolIcon id="curve" size={20}/></button>
              <button className={tool === 'internal' ? 'active' : ''} onClick={() => setTool('internal')} title="Internal line / dart"><CadToolIcon id="internal" size={20}/></button>
            </div>
            <div className="clo-left-3d-column">
              <button onClick={addPolygonPiece} title="Add pattern" aria-label="Add clipped-corner polygon pattern"><CadToolIcon id="polygon-tool" size={20}/></button>
              <button className={tool === 'notch' ? 'active' : ''} onClick={() => setTool('notch')} title="Add notch"><CadToolIcon id="notch" size={20}/></button>
              <button className={tool === 'fastener' ? 'active' : ''} onClick={() => setTool('fastener')} title="Button / snap / hook fastener"><CadToolIcon id="fastener" size={20}/></button>
              <button className={tool === 'measure' ? 'active' : ''} onClick={() => setTool('measure')} title="Tape measure"><CadToolIcon id="measure" size={20}/></button>
            </div>
          </div>
          <span className="rail-divider" />
          <button onClick={deleteSelectedPiece} disabled={!selectedPiece} title="Delete selected"><CadToolIcon id="delete-piece" size={20}/></button>
          <button onClick={() => setCompactTools(value => !value)} title="Compact / expanded toolbar"><CadToolIcon id="settings" size={20}/></button>
          <span className="rail-divider"/><div className="clo-rail-section"><strong>VIEW & EDIT</strong></div>
          <button onClick={() => setShow2DGrid(value => !value)} className={show2DGrid ? 'active' : ''} title="Show or hide 2D drafting grid"><CadToolIcon id="grid-2d" size={20}/></button>
          <button onClick={() => setShow2DSeams(value => !value)} className={show2DSeams ? 'active' : ''} title="Show or hide 2D sewing links"><CadToolIcon id="seam-links" size={20}/></button>
          <button onClick={() => setActiveSection('Fabric')} title="Open fabric properties"><CadToolIcon id="fabric" size={20}/></button>
          <button onClick={() => setActiveSection('Avatar')} title="Open avatar properties"><CadToolIcon id="avatar" size={20}/></button>
          <button onClick={() => setActiveSection('Sewing')} title="Open sewing inspector"><CadToolIcon id="sewing-inspector" size={20}/></button>
          <button onClick={() => setActiveSection('Pattern')} title="Open selected pattern properties"><CadToolIcon id="pattern-properties" size={20}/></button>
          <button onClick={() => setActiveSection('Fit')} title="Open fitting and simulation controls"><CadToolIcon id="fit" size={20}/></button>
          <button onClick={() => setActiveSection('Production')} title="Open production and grading"><CadToolIcon id="grading" size={20}/></button>
          <button onClick={() => setActiveSection('Render')} title="Open renderer settings"><CadToolIcon id="render" size={20}/></button>
          <button onClick={() => setFitCameraSignal(value => value + 1)} title="Frame avatar in 3D"><CadToolIcon id="camera" size={20}/></button>
          <button onClick={() => duplicateSelectedPiece(false)} disabled={!selectedPiece} title="Duplicate selected pattern"><CadToolIcon id="duplicate-piece" size={20}/></button>
          <button onClick={() => duplicateSelectedPiece(true)} disabled={!selectedPiece} title="Create mirrored pattern copy"><CadToolIcon id="mirror" size={20}/></button>
          <button onClick={() => setShowObjectBrowser(value => !value)} title="Show or hide object browser"><CadToolIcon id="panel" size={20}/></button>
          <button onClick={() => setAssetCategory('Fabric')} title="Browse fabric assets"><CadToolIcon id="fabric-roll" size={20}/></button>
          <button onClick={() => { setObjectTab('Topstitch'); setActiveSection('Sewing') }} title="Open topstitch object browser"><CadToolIcon id="topstitch" size={20}/></button>
          <button onClick={() => { setObjectTab('Button'); setActiveSection('Sewing') }} title="Open button object browser"><CadToolIcon id="buttons" size={20}/></button>
          <button onClick={() => { setObjectTab('Trim'); setActiveSection('Sewing') }} title="Open trims and zipper browser"><CadToolIcon id="trim" size={20}/></button>
          <button onClick={() => { setObjectTab('Grading'); setActiveSection('Production') }} title="Open size grading browser"><CadToolIcon id="grading" size={20}/></button>
          <button onClick={() => { setObjectTab('POM'); setActiveSection('Production') }} title="Open points-of-measure browser"><CadToolIcon id="pom" size={20}/></button>
          <button onClick={() => { setAnalysisMode('pressure'); setActiveSection('Fit') }} title="Inspect garment pressure distribution"><CadToolIcon id="pressure" size={20}/></button>
          </>}
        </aside>

        <section className={`workspaces workspace-layout-${viewportLayout} ${clothcraftHybrid ? 'cc-rust-embedded' : ''}`} aria-label="3D and 2D windows" data-viewport-layout={viewportLayout} style={{ '--viewport-left-percent': `${viewportSplit}%` }}>
          {clothcraftHybrid ? <ClothCraftWorkspace embedded exoSection={activeSection} exoLayout={viewportLayout} exoSplit={viewportSplit} environmentPreset={project.render?.environmentPreset || 'studio'} /> : <>
          {zozoReference ? <div className="viewport-shell zozo-reference-shell" data-testid="zozo-reference-workspace">
            <div className="workspace-head viewport-head">
              <div><strong>ZOZO GITHUB DRESS · RUST/METAL REFERENCE</strong><span>14 original panels · 851 sewing constraints · read-only cached simulation</span></div>
              <div className="sim-indicator"><i/>EXPERIMENTAL · NOT VERIFIED FIT</div>
            </div>
            <ZozoReferenceDressViewer reference={zozoReference} frame={zozoReferenceFrame} showBody={zozoReferenceBodyVisible}/>
          </div> : <GarmentViewport
            project={displayProject}
            ppfPreview={ppfPreview}
            running={running}
            hasSimulated={hasSimulated}
            resetSignal={resetSignal}
            wireframe={wireframe}
            analysisMode={analysisMode}
            backendId={displayProject.simulation?.backendId || 'browser-pbd'}
            nativeSolveSignal={nativeSolveSignal}
            nativeQuality={displayProject.simulation?.nativeQuality || 'draft'}
            exportSignal={meshExportSignal}
            glbExportSignal={glbExportSignal}
            renderSignal={renderSignal}
            hdriUrl={hdriUrl}
            customAvatar={customAvatar}
            viewportTool={viewportTool}
            onMeshSelection={setMeshSelection}
            fitCameraSignal={fitCameraSignal}
            selectedPieceId={selectedPieceId}
            onSelectPiece={selectIn3D}
            onChangeViewportTool={setViewportTool}
            onToggleWireframe={() => setWireframe(value => !value)}
            onToggleSewingGuides={() => setShowSewingGuides(value => !value)}
            onChangeAnalysisMode={setAnalysisMode}
            showSewingGuides={showSewingGuides}
            highlightSeamId={activeSection === 'Sewing' ? seamWalkId : null}
            arrangementSpread={arrangementSpread}
            onMoveStagedPanel={moveStagedPanel}
            onExportMesh={downloadObj}
            onExportGlb={downloadGlb}
            onRenderStill={downloadRenderStill}
            onStats={setStats}
            onNativeSolve={handleNativeSolve}
          />}
          <PatternEditor
            project={displayProject}
            showGrid={show2DGrid}
            showSeamLinks={show2DSeams}
            layout2DSignal={layout2DSignal}
            onToggleGrid={() => setShow2DGrid(value => !value)}
            onToggleSeams={() => setShow2DSeams(value => !value)}
            onAutoArrange={tidy2DPatterns}
            gradeNestProjects={gradeNestProjects}
            highlightSeamId={activeSection === 'Sewing' ? seamWalkId : null}
            selectedPieceId={selectedPieceId}
            tool={activeSection === 'Production' && gradePreviewSize !== project.grading?.baseSize ? 'inspect' : tool}
            onSelectPiece={selectIn3D}
            onSelectedEdgeChange={onDraftEdgeSelection}
            onMovePiece={movePiece}
            onChangeTool={setTool}
            onMovePoint={movePoint}
            onSetPoint={setPointPrecision}
            onMoveCurve={moveCurve}
            onSetCurve={setCurvePrecision}
            onSetEdgeAllowance={updatePatternEdgeAllowance}
            onSplitEdge={splitPatternEdge}
            onSplitEdgePrecise={splitPatternEdgePrecise}
            onUnfoldEdge={unfoldPatternEdge}
            onDeletePoint={deletePatternPoint}
            onCreatePin={createPin}
            onRemovePin={removePin}
            onCreateInternalLine={createInternalLine}
            onCreateNotch={createNotch}
            onCreateSeam={createSeam}
            onCreateFastener={createFastener}
            onCreateMeasurement={createCustomMeasurement}
            onBeginGesture={beginGesture}
            onEndGesture={endGesture}
          />
          {['split','stack'].includes(viewportLayout) && <div className="clo-viewport-resizer" role="separator" tabIndex={0} aria-orientation={viewportLayout === 'stack' ? 'horizontal' : 'vertical'} aria-label="Resize 3D and 2D windows" aria-valuemin={20} aria-valuemax={80} aria-valuenow={viewportSplit} aria-valuetext={`${viewportSplit}% 3D window, ${100-viewportSplit}% 2D window`} title="Drag to resize 3D / 2D · double-click for equal windows" onPointerDown={beginViewportResize} onPointerMove={moveViewportResize} onPointerUp={endViewportResize} onLostPointerCapture={endViewportResize} onDoubleClick={() => setViewportSplit(50)} onKeyDown={event => {
            const increment = viewportLayout === 'stack' ? 'ArrowDown' : 'ArrowRight'
            const decrement = viewportLayout === 'stack' ? 'ArrowUp' : 'ArrowLeft'
            if (event.key === increment || event.key === decrement) { event.preventDefault(); setViewportSplit(value => clamp(value + (event.key === increment ? 5 : -5), 20, 80)) }
            if (event.key === 'Home') { event.preventDefault(); setViewportSplit(20) }
            if (event.key === 'End') { event.preventDefault(); setViewportSplit(80) }
          }}><span/></div>}
          </>}
        </section>

        <CloToolActionPanel selected={selectedCloTool}
          onClose={()=>setSelectedCloTool(null)}
          onRun={()=>selectedCloTool&&activateCloTool(selectedCloTool.slot,selectedCloTool.dimension,true)}
          onNavigate={section=>{setActiveSection(section);setShowObjectBrowser(true);setSelectedCloTool(null)}}/>
        <aside className="inspector clo-inspector" hidden={!inspectorVisible}>
          <div className="clo-panel-resizer clo-right-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Inspector width" title="Drag to resize Object Browser and Property Editor" onPointerDown={(event) => beginPanelResize('inspector', event)} onPointerMove={movePanelResize} onPointerUp={endPanelResize} onLostPointerCapture={endPanelResize} onDoubleClick={() => setInspectorWidth(392)}/>
          <RightToolPalette activeSection={activeSection} viewportTool={viewportTool} tool={tool} setViewportTool={value=>{setViewportTool(value);if(clothcraftHybrid){const modes={orbit:'edit',transform:'move3d',move:'move3d',rotate:'rotate3d',hand:'stretch3d'};if(modes[value])rustCommand(`mode:${modes[value]}`)}}} setTool={setTool} setActiveSection={setActiveSection} setObjectTab={setObjectTab} onRevealBrowser={() => setShowObjectBrowser(true)} showSewingGuides={showSewingGuides} setShowSewingGuides={setShowSewingGuides} wireframe={wireframe} setWireframe={setWireframe} analysisMode={analysisMode} setAnalysisMode={setAnalysisMode} toggleSimulation={simForVisibleEngine} resetSimulation={resetForVisibleEngine} exportProject={exportForVisibleEngine} onFitCamera={() => setFitCameraSignal(value => value + 1)} onMirrorSelected={() => duplicateSelectedPiece(true)} onCreatePolygon={addPolygonPiece} onCloTool={activateCloTool} nativeClothcraft={clothcraftHybrid} running={visibleRunning}/>
          <div className="clo-inspector-content">
          <div className="clo-inspector-topline"><button title={showObjectBrowser ? 'Hide Object Browser' : 'Show Object Browser'} onClick={() => setShowObjectBrowser(value => !value)}><PanelRight size={15}/></button><span>OBJECTS & PROPERTIES</span><button title="Choose Fabric" onClick={() => { setObjectTab('Fabric'); setActiveSection('Fabric');setSelectedObjectForProperties(null) }}><Shirt size={15}/></button></div>
          {showObjectBrowser && <ObjectBrowser tab={objectTab} setTab={setObjectTab} project={project} setSelectedPieceId={selectIn3D} setSelectedFabricId={setSelectedFabricId}
            nativeMode={clothcraftHybrid} nativePanelRefs={clothcraftLive?.panelRefs||[]} nativeFabricRefs={clothcraftLive?.fabricRefs||[]}
            nativeSelectedObject={selectedObjectForProperties||((clothcraftHybrid&&clothcraftLive?.selection?.kind==='pattern')?{id:clothcraftLive.selection.panelId}:null)}
            onNativePanelSelect={id=>rustCommand('select:'+id)}
            onNativeFabricSelect={id=>window.dispatchEvent(new CustomEvent('exo-clothcraft-select-fabric',{detail:{id}}))}
            onSelectedObjectChange={value=>{setSelectedObjectForProperties(value);if(value)setSelectedDraftEdge(null)}}
            onApplyFabric={assignFabric} setActiveSection={setActiveSection} selectedPieceId={selectedPieceId} selectedFabricId={selectedFabricId} onAddFabric={addFabricSwatch} onAddPattern={addPiece} onTogglePieceProperty={(pieceId, field) => mutateProject(next => { const piece = next.pieces.find(item => item.id === pieceId); if (piece && (field === 'visible3d' || field === 'locked')) piece[field] = field === 'visible3d' ? piece.visible3d === false : !piece.locked })}/>}
          {showObjectBrowser && <div className="clo-browser-resizer" role="separator" aria-orientation="horizontal" aria-label="Resize Object Browser height" title="Drag to resize Object Browser and Property Editor" onPointerDown={(event) => beginPanelResize('objects', event)} onPointerMove={movePanelResize} onPointerUp={endPanelResize} onLostPointerCapture={endPanelResize} onDoubleClick={() => setObjectBrowserHeight(390)}><span/></div>}
          <div className="clo-property-panel">
            <CloPropertyEditorAccordion activeSection={activeSection} selectedPiece={selectedPiece}
              project={project} fabric={fabric} selectedArea={selectedArea}
              clothcraftHybrid={clothcraftHybrid} clothcraftLive={clothcraftLive}
              draftLineSelection={draftLineSelection}
              objectSelection={selectedObjectForProperties}
              onSwitchSection={setActiveSection}
              onShowFabric={()=>{
                setActiveSection('Fabric');setObjectTab('Fabric');setShowObjectBrowser(true)
                if(clothcraftHybrid){
                  const id=clothcraftLive?.selection?.fabricId
                  const found=clothcraftLive?.fabricRefs?.find(f=>f.id===id)
                  setSelectedObjectForProperties(found?{...found,source:'native',type:'fabric'}:null)
                  if(id)window.dispatchEvent(new CustomEvent('exo-clothcraft-select-fabric',{detail:{id}}))
                }
              }}
              onPropertyEdit={editCloObjectProperty}
              onNativePropertyEdit={editNativeProperty}
              onSelectNativeSeam={seamId=>window.dispatchEvent(new CustomEvent('exo-clothcraft-select-seam',{detail:{seamId}}))}
              objectTab={objectTab}
              onSetLineTarget={(panel,edge,cm)=>window.dispatchEvent(new CustomEvent('exo-clothcraft-property-command',{detail:{type:'target-length',panel,edge,cm}}))}
              onSimulate={simForVisibleEngine} onReset={resetForVisibleEngine}>
          {selectedPiece && activeSection === 'Pattern' && <section className="clo-selected-summary" aria-label="Selected pattern properties">
            <div className="clo-selected-summary-title"><strong>{selectedPiece.name}</strong><span>{selectedPiece.id}</span></div>
            <div className="clo-selected-stats">
              <div><span>Area</span><strong>{selectedArea.toFixed(1)} cm²</strong></div>
              <div><span>Perimeter</span><strong>{selectedPiece.points.reduce((sum, _, i) => sum + edgeLength(selectedPiece, i), 0).toFixed(1)} cm</strong></div>
              <div><span>Vertices</span><strong>{selectedPiece.points.length}</strong></div>
              <div><span>Seam links</span><strong>{project.seams.filter(seam => seam.a?.pieceId === selectedPiece.id || seam.b?.pieceId === selectedPiece.id).length}</strong></div>
            </div>
            <div className="clo-selected-material-row"><span className="clo-fabric-thumb-small" style={{ background: project.fabrics?.[selectedPiece.fabricId || 'main']?.color || '#818a96' }}/><span>{project.fabrics?.[selectedPiece.fabricId || 'main']?.name || 'Unassigned fabric'}</span><button onClick={() => { setObjectTab('Fabric'); setActiveSection('Fabric'); setSelectedFabricId(selectedPiece.fabricId || 'main') }}>EDIT FABRIC</button></div>
          </section>}

          {activeSection === 'Pattern' && (
            <>
              <div className="panel-section" aria-label="Seamly2D measurement interoperability">
                <div className="panel-title"><span>Seamly2D / SeamlyMe</span><strong>MEASUREMENT BRIDGE</strong></div>
                <p className="panel-copy">Import real SeamlyMe individual (.smis) or multisize (.smms) measurements with centimeter conversion and original size increments retained. No proprietary pattern data is modified.</p>
                <button className="wide-action" onClick={() => seamlyMeasureInputRef.current?.click()}><Upload size={15}/>IMPORT SEAMLY MEASUREMENTS</button>
                {project.measurementLibrary?.seamly && <>
                  <p className="panel-copy">{project.measurementLibrary.seamly.sourceName || 'SeamlyMe measurements'} · {project.measurementLibrary.seamly.measurementCount} values · base {project.measurementLibrary.seamly.kind === 'smms' ? 'multisize' : 'individual'}.</p>
                  <button className="wide-action compact-action" onClick={applySeamlyToAvatar}><Ruler size={15}/>APPLY MEASURED BODY VALUES TO AVATAR</button>
                  <p className="panel-copy">{project.measurementLibrary.seamly.assumptions}</p>
                </>}
                <div className="panel-title"><span>Parametric drafting reference</span><strong>.SM2D</strong></div>
                <p className="panel-copy">Inspect a real Seamly2D source construction graph, tool IDs, pattern blocks and original increment formulas. Imported references are read-only and will not overwrite the editable garment.</p>
                <button className="wide-action compact-action" onClick={() => seamlyPatternInputRef.current?.click()}><Upload size={14}/>LOAD .SM2D CONSTRUCTION REFERENCE</button>
                {project.seamlyConstructionReference && <div className="seamly-construction-reference" aria-label="Imported Seamly2D construction reference">
                  <p className="panel-copy"><strong>{project.seamlyConstructionReference.sourceName || 'Seamly reference'}</strong> · version {project.seamlyConstructionReference.version} · {project.seamlyConstructionReference.toolCount} construction operations · {project.seamlyConstructionReference.incrementCount} formulas</p>
                  {project.seamlyConstructionReference.blocks.map(block=><details key={block.id} className="seamly-reference-block">
                    <summary>{block.name} · {block.toolCount} tools</summary>
                    <ol>{block.nodes.slice(0,14).map(node=><li key={node.id}><strong>{node.name || node.id}</strong> · {node.family}/{node.type}{node.attributes.length ? ` · length ${node.attributes.length}` : ''}</li>)}</ol>
                    {block.toolCount>14 && <small>Showing first 14 operations of {block.toolCount}. Original references and formulas are preserved in the saved project.</small>}
                  </details>)}
                  <p className="panel-copy">{project.seamlyConstructionReference.note}</p>
                </div>}
                <p className="panel-copy">The .sm2d tool graph is a different parametric model from a cut-and-sewn garment. Seamly2D is still required to execute construction formulas and resolve details until an equivalent tested graph evaluator exists.</p>
              </div>
              {project.templateId === 'tee' && <div className="panel-section" aria-label="Foundation Tee pattern correction">
                <div className="panel-title"><span>T-shirt pattern engineering</span><strong>SIZE M · SAMPLE</strong></div>
                <p className="panel-copy">The updated regular-fit T-shirt block uses recessed armscyes, independently cut short sleeves, true measured stitch-line dimensions and graded DXF seam allowances. The base pattern matches 14 seam relationships to within 0.11%. Saved garments are only updated by the button below, with Undo available.</p>
                <button className="wide-action" onClick={correctTeeArmholes}><CadToolIcon id="curve" size={17}/>APPLY CORRECTED T-SHIRT BLOCK</button>
                <div className="clo-tee-manufacturing-status"><strong>Production status</strong><span>{project.productionSpec?.approvalStatus === 'FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED' ? 'ENGINEERING SAMPLE · NOT FACTORY APPROVED' : 'LEGACY DRAFT · APPLY BLOCK ABOVE'}</span></div>
                <div className="clo-tee-measurement-grid" aria-label="T-shirt point of measure values">
                  {(measurementRun[project.grading?.baseSize || 'M'] || []).filter(item => ['body-length','chest-half','waist-half','hem-half','front-armhole','sleeve-length','bicep-half','cuff-half'].includes(item.id)).map(item => <div key={item.id}><span>{item.label}</span><strong>{item.cm.toFixed(1)} cm</strong><small>±{item.toleranceCm.toFixed(1)} cm</small></div>)}
                </div>
                <p className="panel-copy">Neck rib is specified by measured neckline length but still requires its own final cut pattern, physical sample and wash-shrink adjustment. Do not release directly for bulk production.</p>
                <button className="wide-action compact-action" onClick={exportMeasurements}><FileDown size={14}/>EXPORT MEASUREMENTS · XS–XXL</button>
              </div>}
              <div className="panel-section">
                <div className="panel-title"><span>Pattern pieces</span><button onClick={addPiece}><Plus size={14} /></button></div>
                <div className="piece-list">
                  {project.pieces.map((piece, index) => (
                    <button key={piece.id} className={piece.id === selectedPieceId ? 'active' : ''} onClick={() => setSelectedPieceId(piece.id)}>
                      <span>{String(index + 1).padStart(2, '0')}</span><strong>{piece.name}</strong><em>{pieceArea(piece).toFixed(0)} cm²</em>
                    </button>
                  ))}
                </div>
                {project.pieces.some((piece) => piece.arrangement3d?.wrap === 'front') && project.pieces.some((piece) => piece.arrangement3d?.wrap === 'back') && (
                  <div className="pattern-generator-grid">
                    <button className="wide-action compact-action" onClick={addRibNeckband}><Plus size={14} />RIB NECKBAND</button>
                    <button className="wide-action compact-action" onClick={addStandCollar}><Plus size={14} />STAND COLLAR</button>
                    <button className="wide-action compact-action" onClick={addTwoPanelHood}><Plus size={14} />2-PANEL HOOD</button>
                    <button className="wide-action compact-action" onClick={addRibFinishSet}><Plus size={14} />CUFFS + WAIST RIB</button>
                    <button className="wide-action compact-action" onClick={addKangarooPocket}><Plus size={14} />KANGAROO POCKET</button>
                  </div>
                )}
              </div>
              {selectedPiece && (
                <>
                  <div className="panel-section">
                    <div className="panel-title"><span>Selected pattern</span><button title={selectedPiece.locked ? 'Unlock 2D pattern editing' : 'Lock 2D pattern editing'} onClick={() => updateSelectedPiece('locked', !selectedPiece.locked)}>{selectedPiece.locked ? <Lock size={14} /> : <Unlock size={14} />}</button></div>
                    <label className="text-field"><span>Name</span><input value={selectedPiece.name} onChange={(event) => updateSelectedPiece('name', event.target.value)} /></label>
                    <div className="field-grid two">
                      <label><span>Points</span><strong>{selectedPiece.points.length}</strong></label>
                      <label><span>Area</span><strong>{selectedArea.toFixed(0)} cm²</strong></label>
                    </div>
                    {viewportTool === 'mesh-select' && <div className="panel-section" aria-label="3D cloth mesh inspector">
                      <div className="panel-title"><span>Mesh selection</span><strong>INSPECT</strong></div>
                      <p className="panel-copy">Click a garment triangle to inspect it. Shift-click or Command-click to add/remove triangles without changing the pattern.</p>
                      <p className="panel-copy">{meshSelection?.pieceId === selectedPiece.id ? `${meshSelection.triangleIndices.length} triangle(s) · ${meshSelection.vertices.length} unique vertices · faces ${meshSelection.triangleIndices.map(index => index + 1).join(', ')}` : 'No triangles selected'}</p>
                      <button className="wide-action compact-action" onClick={() => { setViewportTool('transform'); setMeshSelection(null) }}>RETURN TO 3D TRANSFORM</button>
                    </div>}
                    <div className="control-row split-control"><span>Seam allowance</span><NumberField value={selectedPiece.seamAllowance} min={0} max={8} step={0.1} suffix="cm" onChange={(value) => updateSelectedPiece('seamAllowance', clamp(value, 0, 8))} /></div>
                    <div className="control-row split-control"><span>Grain angle</span><NumberField value={selectedPiece.grainAngleDeg ?? 0} min={-90} max={90} step={1} suffix="°" onChange={(value) => updateSelectedPiece('grainAngleDeg', clamp(value, -90, 90))} /></div>
                    <div className="control-row split-control"><span>Cut quantity</span><NumberField value={selectedPiece.cutQuantity ?? 1} min={1} max={99} step={1} suffix="×" onChange={(value) => updateSelectedPiece('cutQuantity', Math.max(1, Math.round(value)))} /></div>
                    <div className="control-row split-control"><span>Collision layer</span><NumberField value={selectedPiece.layerIndex ?? 0} min={0} max={8} step={1} suffix="L" onChange={(value) => updateSelectedPiece('layerIndex', Math.max(0, Math.min(8, Math.round(value))))} /></div>
                    <div className="clo-placement-panel" aria-label="Exact 3D pattern placement">
                      <div className="clo-placement-header"><strong>3D PATTERN PLACEMENT</strong><span>POSITION · cm / ROTATE · °</span></div>
                      <fieldset className="clo-placement-fields" disabled={hasSimulated}>
                        <div className="clo-placement-inputs">
                          {['X', 'Y', 'Z'].map(axis => <div key={`position-${axis}`}><span>MOVE {axis}</span><NumberField ariaLabel={`3D move ${axis} (cm)`} value={Number(selectedPiece.arrangement3d?.[`stagingOffset${axis}`] || 0) * 100} min={-200} max={200} step={0.1} suffix="cm" onChange={value => setStagedPlacementField(selectedPiece.id, `stagingOffset${axis}`, value)}/></div>)}
                        </div>
                        <div className="clo-placement-inputs">
                          {['X', 'Y', 'Z'].map(axis => <div key={`rotation-${axis}`}><span>ROTATE {axis}</span><NumberField ariaLabel={`3D rotate ${axis} (degrees)`} value={Number(selectedPiece.arrangement3d?.[`stagingRotation${axis}`] || 0)} min={-360} max={360} step={0.1} suffix="°" onChange={value => setStagedPlacementField(selectedPiece.id, `stagingRotation${axis}`, value)}/></div>)}
                        </div>
                        <button type="button" className="clo-placement-reset" onClick={() => resetStagedPlacement(selectedPiece.id)}><RotateCcw size={12}/> RESET PANEL PLACEMENT</button>
                      </fieldset>
                      {hasSimulated && <p>Pause and use the 3D gizmo to adjust simulated cloth. Reset simulation to edit pre-sew arrangement numbers.</p>}
                    </div>
                    <button className={`toggle-row ${selectedPiece.locked ? 'active' : ''}`} onClick={() => updateSelectedPiece('locked', !selectedPiece.locked)}><span><Lock size={15} />Lock 2D editing</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.frozen3d ? 'active' : ''}`} onClick={() => updateSelectedPiece('frozen3d', !selectedPiece.frozen3d)}><span><Pause size={15} />Freeze 3D cloth</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.active3d !== false ? 'active' : ''}`} onClick={() => updateSelectedPiece('active3d', selectedPiece.active3d === false)}><span><Cpu size={15} />Active in 3D solver</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.strengthened ? 'active' : ''}`} onClick={() => updateSelectedPiece('strengthened', !selectedPiece.strengthened)}><span><Activity size={15} />Strengthen pattern</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.visible3d !== false ? 'active' : ''}`} onClick={() => updateSelectedPiece('visible3d', selectedPiece.visible3d === false)}><span><Eye size={15} />Show pattern in 3D</span><i /></button>
                    {['hood-left', 'hood-right'].includes(selectedPiece.generatedRole) && (
                      <div className="hood-state-switch">
                        <span>Hood state</span>
                        <button className={(selectedPiece.hoodState || 'up') === 'up' ? 'active' : ''} onClick={() => setGeneratedHoodState('up')}>UP</button>
                        <button className={selectedPiece.hoodState === 'down' ? 'active' : ''} onClick={() => setGeneratedHoodState('down')}>DOWN</button>
                      </div>
                    )}
                    <button className={`toggle-row ${selectedPiece.marker?.allowCrossGrain ? 'active' : ''}`} onClick={() => updateSelectedMarker('allowCrossGrain', !selectedPiece.marker?.allowCrossGrain)}><span><RotateCcw size={15} />Allow 90° cross-grain marker rotation</span><i /></button>
                    <label className="select-field"><span>Simulation detail</span><select value={selectedPiece.simulationResolution ?? project.simulation.resolution ?? 1} onChange={(event) => updateSelectedPiece('simulationResolution', Number(event.target.value))}><option value={0}>Draft · coarse</option><option value={1}>Normal</option><option value={2}>Fine</option><option value={3}>Ultra</option></select></label>
                    <div className="clo-simulation-property-group"><strong>Simulation mesh</strong><p>Mesh density is controlled by subdivision levels. Exact millimeter-based particle distance requires a remeshing kernel.</p><div className="control-row split-control"><span>Subdivision level</span><NumberField value={selectedPiece.simulationResolution ?? project.simulation.resolution ?? 1} min={0} max={3} step={1} suffix="level" onChange={(value) => updateSelectedPiece('simulationResolution', Math.round(clamp(value, 0, 3)))} /></div></div>
                    <div className="clo-simulation-property-group"><strong>Fabric shrinkage / thickness</strong><div className="control-row split-control"><span>Warp shrinkage</span><NumberField value={(project.fabrics?.[selectedPiece.fabricId || 'main']?.shrinkWarp ?? 0) * 100} min={-15} max={25} step={0.5} suffix="%" onChange={value => mutateProject(next => { const f = next.fabrics?.[selectedPiece.fabricId || 'main']; if (f) f.shrinkWarp = clamp(value / 100, -.15, .25) })}/></div><div className="control-row split-control"><span>Weft shrinkage</span><NumberField value={(project.fabrics?.[selectedPiece.fabricId || 'main']?.shrinkWeft ?? 0) * 100} min={-15} max={25} step={0.5} suffix="%" onChange={value => mutateProject(next => { const f = next.fabrics?.[selectedPiece.fabricId || 'main']; if (f) f.shrinkWeft = clamp(value / 100, -.15, .25) })}/></div><div className="control-row split-control"><span>Cloth thickness</span><NumberField value={(project.fabrics?.[selectedPiece.fabricId || 'main']?.thickness ?? .002) * 1000} min={0.2} max={12} step={0.1} suffix="mm" onChange={value => mutateProject(next => { const f = next.fabrics?.[selectedPiece.fabricId || 'main']; if (f) f.thickness = clamp(value, .2, 12) / 1000 })}/></div></div>
                    {selectedPiece.linkedMirrorSourceId && (
                      <div className="linked-pattern-notice">
                        <div><Link2 size={13} /><span>Linked mirror</span></div>
                        <small>Geometry and construction follow {project.pieces.find((piece) => piece.id === selectedPiece.linkedMirrorSourceId)?.name || 'source pattern'}.</small>
                        <button onClick={unlinkSelectedMirror}>UNLINK</button>
                      </div>
                    )}
                    <div className="pattern-copy-actions">
                      <button onClick={() => duplicateSelectedPiece(false)}>DUPLICATE</button>
                      <button onClick={() => duplicateSelectedPiece(true)}>MIRROR COPY</button>
                      {!selectedPiece.linkedMirrorSourceId && <button onClick={() => duplicateSelectedPiece(true, true)}>LINKED MIRROR</button>}
                      {!['lining', 'interfacing'].includes(selectedPiece.generatedRole) && <button onClick={createLiningCopy}>CREATE LINING</button>}
                      {!['lining', 'interfacing'].includes(selectedPiece.generatedRole) && <button onClick={createInterfacingCopy}>CREATE INTERFACING</button>}
                    </div>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Edge seam allowances</span><strong>{Object.keys(selectedPiece.edgeSeamAllowances || {}).length} CUSTOM</strong></div>
                    <p className="panel-copy">Each edge inherits the pattern default above until overridden. Use wider allowances for hems, zipper fronts, facings, or special construction without changing the rest of the pattern.</p>
                    <div className="edge-allowance-list">
                      {selectedPiece.points.map((_, edgeIndex) => {
                        const custom = selectedPiece.edgeSeamAllowances?.[edgeIndex] !== undefined
                        return (
                          <div className={`edge-allowance-row ${custom ? 'custom' : ''}`} key={`${selectedPiece.id}-allowance-${edgeIndex}`}>
                            <span>E{String(edgeIndex + 1).padStart(2, '0')}</span>
                            <em>{edgeLength(selectedPiece, edgeIndex).toFixed(1)} cm</em>
                            <NumberField value={getEdgeSeamAllowance(selectedPiece, edgeIndex)} min={0} max={8} step={0.1} suffix="cm" onChange={(value) => updateSelectedEdgeAllowance(edgeIndex, value)} />
                          </div>
                        )
                      })}
                    </div>
                    {Object.keys(selectedPiece.edgeSeamAllowances || {}).length > 0 && <button className="wide-action compact-action" onClick={resetSelectedEdgeAllowances}><RotateCcw size={14} />RESET EDGE OVERRIDES</button>}
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Pattern transform</span><strong>PRECISE</strong></div>
                    <div className="transform-grid">
                      <div><span>Scale X</span><NumberField value={transformDraft.scaleX} min={10} max={300} step={1} suffix="%" onChange={(value) => setTransformDraft((current) => ({ ...current, scaleX: value }))} /></div>
                      <div><span>Scale Y</span><NumberField value={transformDraft.scaleY} min={10} max={300} step={1} suffix="%" onChange={(value) => setTransformDraft((current) => ({ ...current, scaleY: value }))} /></div>
                      <div><span>Rotate</span><NumberField value={transformDraft.rotateDeg} min={-180} max={180} step={1} suffix="°" onChange={(value) => setTransformDraft((current) => ({ ...current, rotateDeg: value }))} /></div>
                    </div>
                    <button className="wide-action" onClick={applyPatternTransform}><RotateCcw size={15} />APPLY SCALE / ROTATION</button>
                    <div className="control-row split-control"><span>Slash / spread hem</span><NumberField value={transformDraft.slashCm} min={-20} max={30} step={0.5} suffix="cm" onChange={(value) => setTransformDraft((current) => ({ ...current, slashCm: value }))} /></div>
                    <button className="wide-action compact-action" onClick={applySlashSpread}><Spline size={15} />APPLY SLASH / SPREAD</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Tape measurements</span><strong>{(project.customMeasurements || []).filter((measurement) => measurement.pieceId === selectedPiece.id).length}</strong></div>
                    <p className="panel-copy">Use the ruler tool and click two points on this pattern. Measurements stay attached to pattern coordinates and feed the graded POM/tech-pack export.</p>
                    <div className="custom-measure-list">
                      {(project.customMeasurements || []).filter((measurement) => measurement.pieceId === selectedPiece.id).map((measurement) => {
                        const cm = Math.hypot(measurement.b.x - measurement.a.x, measurement.b.y - measurement.a.y)
                        return (
                          <div className="custom-measure-row" key={measurement.id}>
                            <div className="custom-measure-head">
                              <input value={measurement.label || ''} onChange={(event) => updateCustomMeasurement(measurement.id, 'label', event.target.value)} />
                              <strong>{cm.toFixed(1)} cm</strong>
                              <button onClick={() => removeCustomMeasurement(measurement.id)}><Trash2 size={12} /></button>
                            </div>
                            <div className="control-row split-control"><span>Tolerance</span><NumberField value={measurement.toleranceCm ?? 0.5} min={0} max={5} step={0.1} suffix="cm" onChange={(value) => updateCustomMeasurement(measurement.id, 'toleranceCm', clamp(value, 0, 5))} /></div>
                          </div>
                        )
                      })}
                    </div>
                    <button className="wide-action" onClick={() => setTool('measure')}><Ruler size={14} />PLACE TAPE MEASUREMENT</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Artwork / graphics</span><strong>{selectedPiece.graphics?.length || 0}</strong></div>
                    <p className="panel-copy">Placed artwork is clipped to the 2D pattern and projected onto the live simulated cloth in 3D.</p>
                    <button className="wide-action" onClick={() => graphicInputRef.current?.click()}><Upload size={14} />PLACE IMAGE</button>
                    <div className="graphic-editor-list">
                      {(selectedPiece.graphics || []).map((graphic) => (
                        <div className="graphic-editor-item" key={graphic.id}>
                          <div className="graphic-editor-head">
                            <img src={graphic.src} alt="" />
                            <div><strong>{graphic.name || 'Artwork'}</strong><small>{graphic.widthCm?.toFixed?.(1) || graphic.widthCm} × {graphic.heightCm?.toFixed?.(1) || graphic.heightCm} cm</small></div>
                            <button onClick={() => removeGraphic(selectedPiece.id, graphic.id)}><Trash2 size={12} /></button>
                          </div>
                          <div className="graphic-field-grid">
                            <div><span>X</span><NumberField value={graphic.x ?? 0} min={-100} max={100} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'x', value)} /></div>
                            <div><span>Y</span><NumberField value={graphic.y ?? 0} min={-100} max={150} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'y', value)} /></div>
                            <div><span>W</span><NumberField value={graphic.widthCm ?? 20} min={1} max={120} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'widthCm', clamp(value, 1, 120))} /></div>
                            <div><span>H</span><NumberField value={graphic.heightCm ?? 20} min={1} max={120} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'heightCm', clamp(value, 1, 120))} /></div>
                            <div><span>ROT</span><NumberField value={graphic.rotationDeg ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'rotationDeg', value)} /></div>
                            <div><span>OP</span><NumberField value={(graphic.opacity ?? 1) * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'opacity', clamp(value, 0, 100) / 100)} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Internal geometry</span><strong>{selectedPiece.internalLines?.length || 0}</strong></div>
                    <p className="panel-copy">Use the internal-line tool and drag inside the pattern. Construction, fold, and dart lines stay attached to the pattern and export to production DXF.</p>
                    <div className="internal-line-list">
                      {(selectedPiece.internalLines || []).map((line, index) => (
                        <div className="internal-line-row" key={line.id}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <select value={line.type || 'construction'} onChange={(event) => updateInternalLine(selectedPiece.id, line.id, 'type', event.target.value)}>
                            <option value="construction">Construction</option>
                            <option value="fold">Fold</option>
                            <option value="dart">Dart</option>
                            <option value="pleat">Pleat set</option>
                          </select>
                          {line.type === 'fold' && <NumberField value={line.foldAngleDeg ?? 135} min={0} max={180} step={5} suffix="°" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'foldAngleDeg', clamp(value, 0, 180))} />}
                          {line.type === 'dart' && <NumberField value={line.widthCm ?? 2.5} min={0.5} max={8} step={0.1} suffix="cm" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'widthCm', clamp(value, 0.5, 8))} />}
                          {line.type === 'pleat' && <div className="pleat-inline-controls"><NumberField value={line.count ?? 5} min={1} max={16} step={1} suffix="×" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'count', Math.max(1, Math.round(value)))} /><NumberField value={line.spacingCm ?? 4} min={1} max={20} step={0.5} suffix="sp" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'spacingCm', clamp(value, 1, 20))} /><NumberField value={line.depthCm ?? 3} min={0.5} max={12} step={0.5} suffix="dp" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'depthCm', clamp(value, 0.5, 12))} /></div>}
                          <button onClick={() => removeInternalLine(selectedPiece.id, line.id)}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <button className="wide-action" onClick={() => setTool('internal')}><Scissors size={15} />DRAW INTERNAL LINE</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Manual cloth pins</span><strong>{selectedPiece.pins?.length || 0}</strong></div>
                    <p className="panel-copy">Manual pins hold the nearest cloth particle at the pattern's current 3D arrangement point while the rest of the garment drapes.</p>
                    <div className="pin-list">
                      {(selectedPiece.pins || []).map((pin, index) => (
                        <div className="pin-row" key={pin.id}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <em>{pin.x.toFixed(1)}, {pin.y.toFixed(1)} cm</em>
                          <button onClick={() => removePin(selectedPiece.id, pin.id)}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <button className="wide-action" onClick={() => setTool('pin')}><MapPin size={15} />ADD MANUAL PIN</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Production notches</span><strong>{selectedPiece.notches?.length || 0}</strong></div>
                    <p className="panel-copy">Notches stay attached by arc-length position, so they follow the edge when you reshape a curve. Single and double notches export into DXF.</p>
                    <div className="notch-list">
                      {(selectedPiece.notches || []).map((notch, index) => {
                        const seams = notchSeams(selectedPiece.id, notch.edgeIndex, notch.t)
                        const matchedSeam = notch.matchedSeamId ? project.seams.find((seam) => seam.id === notch.matchedSeamId) : null
                        const matchableSeam = matchedSeam || seams[0]
                        return (
                          <div className={`notch-row ${matchedSeam ? 'matched' : ''}`} key={notch.id}>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <em>E{notch.edgeIndex + 1}</em>
                            <select value={notch.type || 'single'} onChange={(event) => updateNotch(selectedPiece.id, notch.id, 'type', event.target.value)}>
                              <option value="single">Single</option>
                              <option value="double">Double</option>
                            </select>
                            <NumberField value={(notch.t ?? 0.5) * 100} min={1} max={99} step={1} suffix="%" onChange={(value) => updateNotch(selectedPiece.id, notch.id, 't', clamp(value / 100, 0.01, 0.99))} />
                            <button
                              className={matchedSeam ? 'notch-match active' : 'notch-match'}
                              disabled={!matchableSeam || Boolean(matchedSeam)}
                              title={matchedSeam ? `Matched across ${matchedSeam.name}` : matchableSeam ? `Match across ${matchableSeam.name}` : 'This edge is not sewn'}
                              onClick={() => matchableSeam && matchNotchAcrossSeam(selectedPiece.id, notch.id, matchableSeam.id)}
                            ><Link2 size={12} /></button>
                            <button onClick={() => removeNotch(selectedPiece.id, notch.id)}><Trash2 size={13} /></button>
                          </div>
                        )
                      })}
                    </div>
                    <button className="wide-action" onClick={() => setTool('notch')}><span className="notch-action-symbol">N</span>ADD EDGE NOTCH</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>3D arrangement</span><Box size={15} /></div>
                    <label className="select-field"><span>Placement mode</span><select value={selectedPiece.arrangement3d?.wrap || 'flat'} onChange={(event) => updateSelectedArrangement('wrap', event.target.value === 'flat' ? undefined : event.target.value)}><option value="flat">Flat plane</option><option value="front">Wrap front torso</option><option value="back">Wrap back torso</option><option value="left-arm">Wrap left arm</option><option value="right-arm">Wrap right arm</option></select></label>
                    <div className="arrangement-grid">
                      <div><span>X</span><NumberField value={(selectedPiece.arrangement3d?.x || 0) * 100} min={-200} max={200} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('x', value / 100)} /></div>
                      <div><span>Y</span><NumberField value={(selectedPiece.arrangement3d?.y || 0) * 100} min={0} max={250} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('y', value / 100)} /></div>
                      <div><span>Z</span><NumberField value={(selectedPiece.arrangement3d?.z || 0) * 100} min={-150} max={150} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('z', value / 100)} /></div>
                    </div>
                    <p className="panel-copy">Before simulation, the 3D Move tool drags an individual flat panel. These offsets are kept separate from its sewn fitting pose.</p>
                    <div className="arrangement-grid">
                      <div><span>Flat X</span><NumberField value={(selectedPiece.arrangement3d?.stagingOffsetX || 0) * 100} min={-200} max={200} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('stagingOffsetX', value / 100)} /></div>
                      <div><span>Flat Y</span><NumberField value={(selectedPiece.arrangement3d?.stagingOffsetY || 0) * 100} min={-200} max={200} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('stagingOffsetY', value / 100)} /></div>
                      <div><span>Flat Z</span><NumberField value={(selectedPiece.arrangement3d?.stagingOffsetZ || 0) * 100} min={-200} max={200} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('stagingOffsetZ', value / 100)} /></div>
                    </div>
                    <div className="panel-title"><span>Flat 3D rotation</span><Rotate3d size={14}/></div>
                    <div className="arrangement-grid">
                      <div><span>Rotate X</span><NumberField value={selectedPiece.arrangement3d?.stagingRotationX || 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateSelectedArrangement('stagingRotationX', value)} /></div>
                      <div><span>Rotate Y</span><NumberField value={selectedPiece.arrangement3d?.stagingRotationY || 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateSelectedArrangement('stagingRotationY', value)} /></div>
                      <div><span>Rotate Z</span><NumberField value={selectedPiece.arrangement3d?.stagingRotationZ || 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateSelectedArrangement('stagingRotationZ', value)} /></div>
                    </div>
                    <button className={`toggle-row ${selectedPiece.arrangement3d?.flip ? 'active' : ''}`} onClick={() => updateSelectedArrangement('flip', !selectedPiece.arrangement3d?.flip)}><span><RotateCcw size={15} />Flip pattern orientation</span><i /></button>
                  </div>
                </>
              )}
            </>
          )}

          {activeSection === 'Sewing' && (
            <>
              <div className="panel-section stage-overview">
                <div className="panel-title"><span>Construction workflow</span><strong>{!hasSimulated ? 'PRE-SIMULATION' : running ? 'SIMULATING' : 'DRAPED / PAUSED'}</strong></div>
                <div className="workflow-stages"><span className="active">1 · ARRANGE</span><span className={project.seams.length ? 'active' : ''}>2 · SEW EDGES</span><span className={hasSimulated ? 'active' : ''}>3 · SIMULATE</span></div>
                <p className="panel-copy">Patterns remain flat in 3D until simulation. Assign stitches using the Sew tool in 2D; orange links show exactly which edges will join in the 3D view.</p>
                <button className="wide-action" onClick={toggleSimulation}>{running ? 'PAUSE PHYSICAL SIMULATION' : 'SIMULATE SEWN GARMENT'}</button>
                <button className="wide-action compact-action" onClick={resetSimulation}>RESET TO FLAT ARRANGEMENT</button>
              </div>
              <div className="panel-section" aria-label="PPF physical sewing simulation">
                <div className="panel-title"><span>PPF contact + sewing</span><strong>METAL · FEM</strong></div>
                <div className="panel-section" aria-label="Original ZOZO GitHub dress reference">
                  <div className="panel-title"><span>First official test · ZOZO GitHub dress</span><strong>ORIGINAL SOURCE</strong></div>
                  <p className="panel-copy">Load the exact 14-panel Codim-IPC dress, all 851 native sewing constraints, its original dancing body, and the 241 saved Rust/Metal frames. Playback is read-only and never overwrites this project's patterns or physics.</p>
                  <button className="wide-action" disabled={zozoReferenceLoading} onClick={openZozoReference}>
                    <Shirt size={15}/>{zozoReferenceLoading ? 'LOADING ORIGINAL DRESS…' : zozoReference ? 'RETURN TO EDITABLE GARMENT' : 'OPEN ORIGINAL GITHUB DRESS TEST'}
                  </button>
                  {zozoReferenceError && <p className="panel-copy" role="alert" style={{color:'#f39a88'}}>{zozoReferenceError}</p>}
                  {zozoReference && <div className="zozo-reference-controls" data-testid="zozo-reference-controls">
                    <div className="panel-title"><span>Rust/Metal recorded frame</span><strong>{zozoReferenceFrame + 1}/{zozoReference.manifest.frames}</strong></div>
                    <div className="zozo-reference-actions">
                      <button type="button" onClick={() => setZozoReferenceFrame(0)}>START</button>
                      <button type="button" onClick={() => setZozoReferencePlaying(value => !value)}>{zozoReferencePlaying ? 'PAUSE' : 'PLAY'}</button>
                      <button type="button" onClick={() => setZozoReferenceFrame(240)}>FINAL FRAME</button>
                      <button type="button" onClick={() => setZozoReferenceBodyVisible(value => !value)}>{zozoReferenceBodyVisible ? 'HIDE BODY' : 'SHOW BODY'}</button>
                    </div>
                    <input aria-label="ZOZO GitHub dress simulation frame" type="range" min="0" max={zozoReference.manifest.frames - 1} step="1" value={zozoReferenceFrame} onChange={event => {setZozoReferencePlaying(false);setZozoReferenceFrame(Number(event.target.value))}} />
                    <p className="panel-copy" role="status" data-testid="zozo-reference-metrics">Frame {zozoReferenceFrame}: {zozoReference.manifest.audits[zozoReferenceFrame].bodyCrossings} cloth/body crossing pairs · mean seam gap {zozoReference.manifest.audits[zozoReferenceFrame].meanSeamGapCm.toFixed(3)} cm · worst gap {zozoReference.manifest.audits[zozoReferenceFrame].maxSeamGapCm.toFixed(3)} cm.</p>
                    <p className="panel-copy" style={{color:'#f39a88'}}>Original solver run completed but FAILED collision certification: 492 body triangle crossings at frame 90 and additional crossings at frames 87 and 174. This is an experimental reference, not an accepted fitted garment or editable CLO pattern.</p>
                  </div>}
                </div>
                <p className="panel-copy">ZOZO's contact solver treats 2D seam matches as physical stitch springs. It joins fabric while resolving contact with the body. Start with 10 frames on Apple Metal; longer runs can take minutes or stall around tightly closed armholes. Interactive XPBD remains available above.</p>
                <div className="control-row split-control"><span>Stitch spring strength</span><NumberField value={project.simulation?.ppfStitchStiffness ?? 1} min={0.1} max={10000} step={0.5} onChange={(value) => updateSimulation('ppfStitchStiffness', clamp(value, 0.1, 10000))} /></div>
                <div className="control-row split-control"><span>PPF maximum stretch</span><NumberField value={project.simulation?.ppfStrainLimitPercent ?? 5} min={1} max={40} step={0.5} suffix="%" onChange={(value) => updateSimulation('ppfStrainLimitPercent', clamp(value, 1, 40))} /></div>
                <div className="control-row split-control"><span>PPF contact gap</span><NumberField value={(project.simulation?.ppfContactGap ?? .001)*1000} min={0.1} max={10} step={0.1} suffix="mm" onChange={(value) => updateSimulation('ppfContactGap', clamp(value, 0.1, 10)/1000)} /></div>
                <div className="control-row split-control"><span>PPF contact offset</span><NumberField value={(project.simulation?.ppfContactOffset ?? 0)*1000} min={0} max={5} step={0.1} suffix="mm" onChange={(value) => updateSimulation('ppfContactOffset', clamp(value, 0, 5)/1000)} /></div>
                <div className="control-row split-control"><span>Avatar contact gap</span><NumberField value={(project.simulation?.ppfAvatarContactGap ?? .001)*1000} min={0.1} max={10} step={0.1} suffix="mm" onChange={(value) => updateSimulation('ppfAvatarContactGap', clamp(value, 0.1, 10)/1000)} /></div>
                <div className="control-row split-control"><span>Avatar contact offset</span><NumberField value={(project.simulation?.ppfAvatarContactOffset ?? 0)*1000} min={0} max={5} step={0.1} suffix="mm" onChange={(value) => updateSimulation('ppfAvatarContactOffset', clamp(value, 0, 5)/1000)} /></div>
                <p className="panel-copy">Both PPF contact groups now use explicit millimeter gaps (default 1 mm each) rather than scaling the avatar gap with body size. PPF strain limiting is explicitly enabled for new jobs; the default is 5% maximum stretch, not 2%. These settings do not alter browser PBD collision margins or certify a collision-free drape.</p>
                <button className={`toggle-row ${project.simulation?.ppfShoulderSupports === true ? 'active' : ''}`} onClick={() => updateSimulation('ppfShoulderSupports', project.simulation?.ppfShoulderSupports !== true)}><span><MapPin size={15} />Experimental soft shoulder supports</span><i /></button>
                <div className="control-row split-control"><span>PPF torso staging height</span><NumberField value={(project.simulation?.ppfTorsoYOffset ?? 0)*100} min={-15} max={15} step={1} suffix="cm" onChange={(value) => updateSimulation('ppfTorsoYOffset', clamp(value, -15, 15)/100)} /></div>
                <p className="panel-copy">Experimental shoulder supports pull four top-panel landmarks for the first 20% of the solve, then release. The latest Thomas test still intersected the body and left large seam gaps, so these supports and the staging-height adjustment are off by default. A failed PPF result is never accepted as a fitted garment.</p>
                <p className="panel-copy">PPF uses the installed calibrated Cotton/Silk/Wool/Denim material presets as starting values for membrane and bend stiffness. Gravity remains 9.81 m/s². Longer solves allow settling; they cannot correct excessive pattern ease or unsafe stitching. These are PPF-specific settings, not the interactive Browser PBD controls.</p>
                <div className="control-row split-control"><span>PPF sewing frames</span><NumberField value={ppfFrames} min={10} max={180} step={5} onChange={(value) => setPpfFrames(Math.round(clamp(value, 10, 180)))} /></div>
                <button className="wide-action" disabled={!project.seams.length || ['queued', 'running', 'connecting'].includes(ppfSewing.status)} onClick={() => startPpfSewing()}>
                  <Link2 size={15}/>{['queued', 'running', 'connecting'].includes(ppfSewing.status) ? 'PPF SEWING IN PROGRESS' : 'RUN PHYSICAL SEWING · PPF METAL'}
                </button>
                <p className="panel-copy" role="status">PPF: {ppfSewing.status === 'idle' ? 'Ready to submit to the local solver service' : `${ppfSewing.status.toUpperCase()} · ${ppfSewing.phase}`}</p>
                {ppfSewing.error && <p className="panel-copy" style={{ color: '#f39a88' }}>{ppfSewing.error}{ppfSewing.phase === 'connection' && <>. Start the local service with <code>npm run ppf:serve</code> if it is offline.</>}</p>}
                {ppfSewing.summary?.stitchEdges !== undefined && <p className="panel-copy">{ppfSewing.summary.stitchEdges} physical stitch pairs · {ppfSewing.summary.vertices} cloth vertices · zero-intersection staging: {ppfSewing.summary.intersections === 0 ? 'cloth preflight passed' : 'pending'} · actual body contact: {ppfSewing.summary.initialBodyContactVerified ? 'initial frame verified' : 'not yet verified'}</p>}
                {ppfSewing.summary?.assembly && <p className="panel-copy" style={ppfSewing.summary.assembly.fittingReady ? undefined : {color:'#f39a88'}}>NONRIGID ASSEMBLY: {ppfSewing.summary.assembly.startingSeamMeanCm.toFixed(2)} → {ppfSewing.summary.assembly.assembledSeamMeanCm.toFixed(2)} cm mean stitch gap · worst {ppfSewing.summary.assembly.largestGapCm.toFixed(2)} cm · maximum geometric edge change {(100*ppfSewing.summary.assembly.maximumEdgeChange).toFixed(2)}% · Thomas crossings {ppfSewing.summary.assembly.realBodyIntersectionPairs} · {ppfSewing.summary.assembly.fittingReady ? 'initial assembly eligible for PPF' : 'still requires full shoulder/side seam assembly; not a certified fit'}.</p>}
                {ppfSewing.artifacts?.assemblyPayload && <>
                  <button className="wide-action compact-action" disabled={ppfPreviewLoading} onClick={() => showPpfPreview(ppfSewing.jobId, 0, 'initial-assembly')}>
                    {ppfPreviewLoading ? 'LOADING INITIAL GARMENT…' : 'VIEW COLLISION-CHECKED INITIAL ASSEMBLY'}
                  </button>
                  <p className="panel-copy">This is the staged cloth geometry, not a solved or fully sewn garment. Stored locally at <code style={{overflowWrap:'anywhere'}}>{ppfSewing.artifacts.assemblyPayload}</code>.</p>
                  {ppfPreview?.stage === 'initial-assembly' && <p className="panel-copy" style={{color:'#f39a88'}}>{ppfPreview.warning}</p>}
                  {ppfPreview?.stage === 'initial-assembly' && <button className="wide-action compact-action" onClick={() => setPpfPreview(null)}>RETURN TO EDITABLE GARMENT</button>}
                  {ppfPreviewError && <p className="panel-copy" role="alert" style={{color:'#f39a88'}}>{ppfPreviewError}</p>}
                </>}
                {ppfSewing.summary?.stagingSeams?.warning && <p className="panel-copy" style={{color:'#f39a88'}}>PATTERN ASSEMBLY: {ppfSewing.summary.stagingSeams.warning} Worst: {ppfSewing.summary.stagingSeams.worstSeams?.[0]?.id || 'unknown'} ({ppfSewing.summary.stagingSeams.worstSeams?.[0]?.meanGapCm?.toFixed(1)} cm mean).</p>}
                {ppfSewing.summary?.sewing && <p className="panel-copy">Measured seam closure: {ppfSewing.summary.sewing.initialMeanGapCm.toFixed(1)} → {ppfSewing.summary.sewing.finalMeanGapCm.toFixed(1)} cm ({ppfSewing.summary.sewing.closurePercent}% closed). Largest remaining seam: {ppfSewing.summary.sewing.worstSeams?.[0]?.id || 'none'}.</p>}
                {ppfSewing.summary?.contact && <p className="panel-copy" style={ppfSewing.summary.collisionQuality === 'pass' ? undefined : { color: '#f39a88' }}>Collision quality: {ppfSewing.summary.collisionQuality === 'pass' ? 'PASS' : 'FAILED — experimental result, not a finished garment'}. Frame-by-frame: {ppfSewing.summary.contact.allFramesAvatarIntersectionFree ? 'no detected avatar crossings' : `up to ${ppfSewing.summary.contact.maxAvatarIntersectionPairs} avatar triangle crossings`}; {ppfSewing.summary.contact.allFramesSelfIntersectionFree ? 'no fabric crossings' : `up to ${ppfSewing.summary.contact.maxSelfIntersectionPairs} fabric crossings`}. Final-frame shell overlaps: {ppfSewing.summary.contact.finalFrame?.clothSelfIntersectionPairs ?? 'unknown'}.</p>}
                {ppfSewing.summary?.contact?.allFramesWithinStrainLimit !== undefined && <p className="panel-copy" style={ppfSewing.summary.contact.allFramesWithinStrainLimit ? undefined : { color: '#f39a88' }}>Exported-frame strain: {ppfSewing.summary.contact.allFramesWithinStrainLimit ? 'PASS' : 'FAILED'} · maximum principal stretch {Number(ppfSewing.summary.contact.maxPrincipalStretch || 0).toFixed(3)}×. Raw cloth positions are evaluated without post-simulation seam snapping.</p>}
                {ppfSewing.summary?.fitClearance?.final && <p className="panel-copy" style={ppfSewing.summary.fitClearance.shoulderFitPass ? undefined : {color:'#f39a88'}}>Thomas proximity: shoulder mean {ppfSewing.summary.fitClearance.final.shoulder.meanCm.toFixed(1)} cm, shoulder p90 {ppfSewing.summary.fitClearance.final.shoulder.p90Cm.toFixed(1)} cm, torso mean {ppfSewing.summary.fitClearance.final.torso.meanCm.toFixed(1)} cm. {ppfSewing.summary.fitClearance.shoulderFitPass ? 'Provisional shoulder-fit thresholds passed.' : 'FLOATING / BALLOONING RISK — not an accepted fit.'}</p>}
                {ppfSewing.summary?.contact?.firstAvatarCrossingFrame != null && <p className="panel-copy">First body penetration: frame {ppfSewing.summary.contact.firstAvatarCrossingFrame}. Main affected collider: {ppfSewing.summary.contact.avatarPartsRankedByTotalCrossings?.[0]?.name?.replace('PPF_Avatar_', '') || 'unknown'}. This result requires collision repair before production use.</p>}
                {ppfSewing.artifacts?.blend && <p className="panel-copy">Solver completed. Blender scene saved at <code style={{ overflowWrap: 'anywhere' }}>{ppfSewing.artifacts.blend}</code>. Preview frames can be inspected without modifying the live XPBD garment or the pattern.</p>}
                {ppfSewing.status === 'done' && <div className="panel-section" aria-label="ZOZO PPF read-only simulation preview">
                  <div className="panel-title"><span>ZOZO simulation playback</span><strong>{ppfSewing.summary?.fitAcceptance?.accepted ? 'VERIFIED FIT' : 'EXPERIMENTAL · UNSAFE'}</strong></div>
                  <button className="wide-action" disabled={ppfPreviewLoading} onClick={() => showPpfPreview()}>{ppfPreviewLoading ? 'READING PPF CACHE…' : 'SHOW LAST ZOZO FRAME ON AVATAR'}</button>
                  {ppfPreview?.frames > 1 && <label className="select-field"><span>Solver frame {ppfPreview.frame + 1}/{ppfPreview.frames}</span><input type="range" min="0" max={ppfPreview.frames - 1} step="1" value={ppfPreview.frame} disabled={ppfPreviewLoading} onChange={(event) => showPpfPreview(ppfPreview.jobId, Number(event.target.value))}/></label>}
                  {ppfPreview && <button className="wide-action compact-action" onClick={() => setPpfPreview(null)}>RETURN TO EDITABLE GARMENT</button>}
                  {ppfPreview && !ppfPreview.accepted && <p className="panel-copy" style={{color:'#f39a88'}}>This playback shows raw, experimental solver geometry. Contact, strain or seam checks failed; it is not a completed wearable fit.</p>}
                  {ppfPreviewError && <p className="panel-copy" role="alert" style={{color:'#f39a88'}}>{ppfPreviewError}</p>}
                </div>}
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Sewing visualization</span><Link2 size={15} /></div>
                <p className="panel-copy">The 2D editor and 3D flat arrangement show the same seam constraint pairs before simulation. Sew first; simulate afterward.</p>
                <button className={`toggle-row ${showSewingGuides ? 'active' : ''}`} onClick={() => setShowSewingGuides((value) => !value)}><span><Link2 size={14} />Show 3D sewing lines</span><i /></button>
                <label className="select-field"><span>Exploded arrangement: {Math.round(arrangementSpread * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={arrangementSpread} onChange={(event) => { setArrangementSpread(Number(event.target.value)); setShowSewingGuides(true); setRunning(false) }} /></label>
                <button className="wide-action compact-action" onClick={() => setArrangementSpread(0)}>RETURN TO CURRENT ARRANGEMENT</button>
              </div>
              <div className="panel-section grow-section">
                <div className="panel-title"><span>Seam graph</span><strong>{project.seams.length}</strong></div>
                <p className="panel-copy">Segment Sewing: click two edges. Free Sewing: Shift-click a start and end on each edge; this creates an exact, editable range that follows the source cutline rather than the nearest mesh vertex.</p>
                <p className="panel-copy" role="status">Construction audit: {sewingConstructionAudit.validSewingLinks}/{sewingConstructionAudit.sourceSeams} sewing links valid · {sewingConstructionAudit.categories.invalidEndpoints} invalid cutlines · {sewingConstructionAudit.categories.overlappingRanges} conflicting overlaps · {sewingConstructionAudit.categories.inactive3d} links to 2D-only patterns · {sewingConstructionAudit.categories.lengthMismatch} length mismatches above 6%.</p>
                {sewingConstructionAudit.issues.length > 0 && <details className="sewing-audit-detail"><summary>Inspect construction warnings</summary>{sewingConstructionAudit.issues.map((issue, index) => <p key={`${issue.seamId}-${index}`} className="panel-copy">{issue.seamId}: {issue.detail}</p>)}</details>}
                <div className="seam-health-strip">
                  <span><i className="good" />{project.seams.filter((seam) => seamLengthReport(project, seam).status === 'good').length} matched</span>
                  <span><i className="warning" />{project.seams.filter((seam) => seamLengthReport(project, seam).status === 'warning').length} warning</span>
                  <span><i className="error" />{project.seams.filter((seam) => seamLengthReport(project, seam).status === 'error').length} mismatch</span>
                </div>
                <div className="seam-list">
                  {project.seams.map((seam, index) => (
                    <div key={seam.id} className={`seam-item seam-${seamLengthReport(project, seam).status}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{seam.name}</strong>
                        <em>{seam.a.pieceId}:{seam.a.edgeIndex} ↔ {seam.b.pieceId}:{seam.b.edgeIndex}</em>
                        <small>{seamLengthReport(project, seam).lengthA.toFixed(1)} / {seamLengthReport(project, seam).lengthB.toFixed(1)} cm · {seamLengthReport(project, seam).mismatchPercent.toFixed(1)}% mismatch</small>
                        <div className="seam-range-mode">
                          <button className={seam.a?.startT === undefined && seam.a?.endT === undefined && seam.b?.startT === undefined && seam.b?.endT === undefined ? 'active' : ''} onClick={() => setSeamPartial(seam.id, false)}>FULL</button>
                          <button className={seam.a?.startT !== undefined || seam.a?.endT !== undefined || seam.b?.startT !== undefined || seam.b?.endT !== undefined ? 'active' : ''} onClick={() => setSeamPartial(seam.id, true)}>PARTIAL</button>
                        </div>
                        {(seam.a?.startT !== undefined || seam.a?.endT !== undefined || seam.b?.startT !== undefined || seam.b?.endT !== undefined) && (
                          <div className="seam-range-controls">
                            <div><span>A start</span><NumberField value={(seam.a?.startT ?? 0) * 100} min={0} max={99.99} step={0.01} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'a', 'startT', value / 100)} /></div>
                            <div><span>A end</span><NumberField value={(seam.a?.endT ?? 1) * 100} min={0.01} max={100} step={0.01} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'a', 'endT', value / 100)} /></div>
                            <div><span>B start</span><NumberField value={(seam.b?.startT ?? 0) * 100} min={0} max={99.99} step={0.01} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'b', 'startT', value / 100)} /></div>
                            <div><span>B end</span><NumberField value={(seam.b?.endT ?? 1) * 100} min={0.01} max={100} step={0.01} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'b', 'endT', value / 100)} /></div>
                          </div>
                        )}
                        <div className="seam-treatment-controls">
                          <select value={seam.type || 'normal'} onChange={(event) => updateSeam(seam.id, 'type', event.target.value)}>
                            <option value="normal">Normal sew</option>
                            <option value="zipper">Zipper</option>
                            <option value="ease">Ease</option>
                            <option value="elastic">Elastic</option>
                            <option value="gather">Gather</option>
                            <option value="binding">Binding</option>
                          </select>
                          {seam.type === 'zipper' && <NumberField value={(seam.openFraction ?? 0) * 100} min={0} max={100} step={5} suffix="% open" onChange={(value) => updateSeam(seam.id, 'openFraction', clamp(value, 0, 100) / 100)} />}
                          {seam.type === 'zipper' && <select value={seam.openFrom || 'end'} onChange={(event) => updateSeam(seam.id, 'openFrom', event.target.value)}><option value="end">Open from end</option><option value="start">Open from start</option></select>}
                          {['elastic', 'gather', 'ease'].includes(seam.type) && <NumberField value={(seam.ratio ?? (seam.type === 'gather' ? 0.7 : seam.type === 'elastic' ? 0.85 : 0.96)) * 100} min={30} max={120} step={1} suffix="%" onChange={(value) => updateSeam(seam.id, 'ratio', clamp(value, 30, 120) / 100)} />}
                          {seam.type === 'gather' && <select value={seam.gatherSide || 'a'} onChange={(event) => updateSeam(seam.id, 'gatherSide', event.target.value)}><option value="a">Gather A</option><option value="b">Gather B</option></select>}
                          {seam.type === 'ease' && <select value={seam.easeSide || 'a'} onChange={(event) => updateSeam(seam.id, 'easeSide', event.target.value)}><option value="a">Ease A</option><option value="b">Ease B</option></select>}
                        </div>
                        <div className="seam-quick-actions">
                          <button className={seam.reverseB ? 'active' : ''} onClick={() => updateSeam(seam.id, 'reverseB', !seam.reverseB)}>REVERSE B</button>
                          <button className={seamWalkId === seam.id ? 'active' : ''} onClick={() => { setSeamWalkId((current) => current === seam.id ? null : seam.id); setSeamWalkProgress(0.5) }}>WALK</button>
                          {seamLengthReport(project, seam).mismatchPercent > 2 && <button onClick={() => autoEaseSeam(seam.id)}>AUTO MATCH</button>}
                        </div>
                      </div>
                      <button onClick={() => removeSeam(seam.id)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                {seamWalk && (
                  <div className="seam-walk-card">
                    <div className="seam-walk-head">
                      <div><span>SEAM WALK</span><strong>{seamWalk.name}</strong></div>
                      <button onClick={() => setSeamWalkId(null)}>CLOSE</button>
                    </div>
                    <SeamWalkPreview report={seamWalk} progress={seamWalkProgress} />
                    <div className="seam-walk-metrics">
                      <div><span>Edge A</span><strong>{seamWalk.lengthA.toFixed(2)} cm</strong></div>
                      <div><span>Edge B</span><strong>{seamWalk.lengthB.toFixed(2)} cm</strong></div>
                      <div><span>Length delta</span><strong>{seamWalk.difference.toFixed(2)} cm</strong></div>
                      <div><span>Shape deviation</span><strong>{seamWalk.maxShapeDeviationCm.toFixed(2)} cm max</strong></div>
                    </div>
                    <SliderRow label="Walk position" value={seamWalkProgress * 100} min={0} max={100} step={1} display={`${Math.round(seamWalkProgress * 100)}%`} onChange={(value) => setSeamWalkProgress(clamp(value / 100, 0, 1))} />
                    {(() => {
                      const index = Math.max(0, Math.min(seamWalk.samples.length - 1, Math.round(seamWalkProgress * (seamWalk.samples.length - 1))))
                      const sample = seamWalk.samples[index]
                      return sample ? (
                        <div className="seam-walk-position">
                          <span>A {sample.distanceA.toFixed(1)} cm</span>
                          <span>B {sample.distanceB.toFixed(1)} cm</span>
                          <strong>{sample.cumulativeDeltaCm >= 0 ? '+' : ''}{sample.cumulativeDeltaCm.toFixed(2)} cm cumulative</strong>
                        </div>
                      ) : null
                    })()}
                    <div className="seam-walk-actions">
                      <button onClick={() => addSeamWalkNotches(seamWalk.seamId)}>ADD ¼ · ½ · ¾ MATCH NOTCHES</button>
                      {seamWalk.mismatchPercent > 2 && <button onClick={() => autoEaseSeam(seamWalk.seamId)}>AUTO EASE TO MATCH</button>}
                    </div>
                  </div>
                )}
                <button className="wide-action" onClick={() => { setTool('sew'); setActiveSection('Sewing') }}><Link2 size={15} />SEW NEW EDGES</button>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Point fasteners</span><strong>{project.fasteners?.length || 0}</strong></div>
                <p className="panel-copy">Place a mating pair directly on two patterns. Closed buttons, snaps, and hooks become physical point constraints in the cloth solver.</p>
                <div className="fastener-list">
                  {(project.fasteners || []).map((fastener, index) => (
                    <div className={`fastener-row ${fastener.closed === false ? 'open' : 'closed'}`} key={fastener.id}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{fastener.name}</strong>
                        <small>{fastener.a?.pieceId} ↔ {fastener.b?.pieceId}</small>
                      </div>
                      <select value={fastener.type || 'button'} onChange={(event) => updateFastener(fastener.id, 'type', event.target.value)}>
                        <option value="button">Button</option>
                        <option value="snap">Snap</option>
                        <option value="hook">Hook</option>
                      </select>
                      <button className={`fastener-state ${fastener.closed === false ? '' : 'active'}`} onClick={() => updateFastener(fastener.id, 'closed', fastener.closed === false)}>{fastener.closed === false ? 'OPEN' : 'CLOSED'}</button>
                      <button className="fastener-delete" onClick={() => removeFastener(fastener.id)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <button className="wide-action" onClick={() => { setTool('fastener'); setActiveSection('Sewing') }}><Plus size={14} />PLACE FASTENER PAIR</button>
              </div>
              {selectedPiece && (
                <div className="panel-section trim-editor">
                  <div className="panel-title"><span>Edge construction · {selectedPiece.name}</span><strong>{stats.trims} LIVE</strong></div>
                  <label className="select-field"><span>Target edge</span><select value={trimEdgeIndex} onChange={(event) => setTrimEdgeIndex(Number(event.target.value))}>{selectedPiece.points.map((_, edgeIndex) => <option key={edgeIndex} value={edgeIndex}>Edge {edgeIndex + 1} · {edgeLength(selectedPiece, edgeIndex).toFixed(1)} cm</option>)}</select></label>
                  {['button','buttonhole','zipper'].map(kind => <label className="select-field" key={kind}>
                    <span>{kind.charAt(0).toUpperCase()+kind.slice(1)} hardware</span>
                    <select aria-label={`Select ${kind} hardware preset`} value={hardwareChoice[kind]} onChange={event=>setHardwareChoice(current=>({...current,[kind]:event.target.value}))}>
                      {listHardwarePresets(kind).map(preset=><option key={preset.id} value={preset.id}>{preset.name}</option>)}
                    </select>
                  </label>)}
                  <p className="panel-copy">Hardware presets supply illustrative sizes, finishes and component references. Visual placement is approximate; supplier part specifications and rigid fastener physics require validation.</p>
                  <div className="trim-add-grid">
                    <button onClick={() => addTopstitch(selectedPiece.id, trimEdgeIndex)}>+ TOPSTITCH</button>
                    <button onClick={() => addBinding(selectedPiece.id, trimEdgeIndex)}>+ BINDING</button>
                    <button onClick={() => addZipper(selectedPiece.id, trimEdgeIndex)}>+ ZIPPER</button>
                    <button onClick={() => addButtonRow(selectedPiece.id, 5)}>+ 5 BUTTONS</button>
                    <button onClick={() => addButtonholeRow(selectedPiece.id, 5)}>+ 5 BUTTONHOLES</button>
                  </div>

                  <div className="trim-editor-list">
                    {(selectedPiece.topstitches || []).map((stitch) => (
                      <div key={stitch.id} className="trim-editor-item">
                        <div><strong>Topstitch · E{stitch.edgeIndex + 1}</strong><small>{stitch.rows || 1} row · {stitch.stitchLengthMm || 3} mm stitch</small></div>
                        <NumberField value={stitch.offsetCm ?? 0.7} min={0} max={5} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'topstitches', stitch.id, 'offsetCm', clamp(value, 0, 5))} />
                        <select value={stitch.rows || 1} onChange={(event) => updatePieceTrim(selectedPiece.id, 'topstitches', stitch.id, 'rows', Number(event.target.value))}><option value={1}>1 row</option><option value={2}>2 rows</option><option value={3}>3 rows</option></select>
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'topstitches', stitch.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.bindings || []).map((binding) => (
                      <div key={binding.id} className="trim-editor-item">
                        <div><strong>Binding · E{binding.edgeIndex + 1}</strong><small>{Math.round((binding.ratio ?? 0.96) * 100)}% edge ratio</small></div>
                        <NumberField value={(binding.ratio ?? 0.96) * 100} min={60} max={110} step={1} suffix="%" onChange={(value) => updatePieceTrim(selectedPiece.id, 'bindings', binding.id, 'ratio', clamp(value, 60, 110) / 100)} />
                        <NumberField value={binding.widthCm ?? 1.8} min={0.5} max={8} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'bindings', binding.id, 'widthCm', clamp(value, 0.5, 8))} />
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'bindings', binding.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.zippers || []).map((zipper) => (
                      <div key={zipper.id} className="trim-editor-item">
                        <div><strong>{getHardwarePreset(zipper.hardwarePresetId)?.name || 'Zipper'} · E{zipper.edgeIndex + 1}</strong><small>{zipper.type || 'coil'} tape</small></div>
                        <NumberField value={zipper.widthCm ?? 1.2} min={0.5} max={5} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'zippers', zipper.id, 'widthCm', clamp(value, 0.5, 5))} />
                        <span />
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'zippers', zipper.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.buttonholes || []).map((buttonhole, index) => (
                      <div key={buttonhole.id} className="trim-editor-item buttonhole-editor-item">
                        <div><strong>{getHardwarePreset(buttonhole.hardwarePresetId)?.name || 'Buttonhole'} {index + 1}</strong><small>{buttonhole.lengthCm ?? 2.4} cm · {Math.round(buttonhole.orientationDeg || 0)}°</small></div>
                        <NumberField value={buttonhole.lengthCm ?? 2.4} min={0.8} max={6} step={0.1} suffix="cm" onChange={(value) => updateButtonhole(selectedPiece.id, buttonhole.id, 'lengthCm', clamp(value, 0.8, 6))} />
                        <NumberField value={buttonhole.orientationDeg ?? 0} min={-180} max={180} step={5} suffix="°" onChange={(value) => updateButtonhole(selectedPiece.id, buttonhole.id, 'orientationDeg', clamp(value, -180, 180))} />
                        <button onClick={() => removeButtonhole(selectedPiece.id, buttonhole.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.buttons || []).length > 0 && (
                      <div className="trim-editor-item trim-summary-item">
                        <div><strong>Buttons</strong><small>{selectedPiece.buttons.length} placed on pattern · {getHardwarePreset(selectedPiece.buttons[0]?.hardwarePresetId)?.name || 'Custom'}</small></div>
                        <button className="trim-clear" onClick={() => mutateProject((next) => {
                          const piece = next.pieces.find((item) => item.id === selectedPiece.id)
                          if (!piece) return
                          piece.buttons = []
                          piece.buttonholes = (piece.buttonholes || []).map((buttonhole) => ({ ...buttonhole, pairedButtonId: null }))
                        })}>CLEAR ALL</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === 'Fabric' && clothcraftHybrid && <div id="cc-native-fabric-inspector"/>}
          {activeSection === 'Fabric' && !clothcraftHybrid && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Fabric library</span><button onClick={addFabricSwatch}><Plus size={14} /></button></div>
                <div className="fabric-library">
                  {Object.entries(project.fabrics || {}).map(([fabricId, item]) => {
                    const usage = project.pieces.filter((piece) => (piece.fabricId || 'main') === fabricId).length
                    return (
                      <button key={fabricId} className={selectedFabricId === fabricId ? 'active' : ''} onClick={() => setSelectedFabricId(fabricId)}>
                        <i style={{ background: item.color || '#777777' }} />
                        <div><strong>{item.name || fabricId}</strong><small>{item.gsm || 0} gsm · {usage} pattern{usage === 1 ? '' : 's'}</small></div>
                        <span>{fabricId === 'main' ? 'MAIN' : 'SWATCH'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Physical fabric</span><strong>{selectedFabricId.toUpperCase().slice(0, 10)}</strong></div>
                <label className="text-field"><span>Name</span><input value={fabric.name || ''} onChange={(event) => updateFabric('name', event.target.value)} /></label>
                <label className="select-field"><span>Preset</span><select value={Object.keys(FABRIC_PRESETS).find((key) => FABRIC_PRESETS[key].name === fabric.name) || ''} onChange={(event) => applyFabricPreset(event.target.value)}><option value="">Custom</option>{FABRIC_PRESET_GROUPS.map(([group,entries])=><optgroup key={group} label={group}>{entries.map(([key,preset])=><option key={key} value={key}>{preset.name}</option>)}</optgroup>)}</select></label>
                <label className="color-field"><span>Surface color</span><input type="color" value={fabric.color} onChange={(event) => updateFabric('color', event.target.value)} /><strong>{fabric.color.toUpperCase()}</strong></label>
                <div className="control-row split-control"><span>Physical evidence</span><strong>{fabric.calibration?.status==='imported-unverified' ? `IMPORTED · ${fabric.calibration.grade}` : 'ESTIMATED'}</strong></div>
                <button className="wide-action" onClick={()=>fabricEvidenceInputRef.current?.click()}><Upload size={14}/>IMPORT LAB SPECIMEN DATA (JSON)</button>
                <p className="panel-copy">Requires traceable GSM, compressed-thickness and optional warp/weft test curves for this exact specimen. Mass and thickness can be assigned directly. Curve-derived tensile, shear and bending coefficients remain advisory until calibrated against the cloth solver. Imported data is not independently certified.</p>
                <div className="clo-fabric-apply-actions">
                  <button disabled={!selectedPiece} onClick={() => assignFabric(selectedFabricId)}>APPLY TO SELECTED PATTERN</button>
                  <button onClick={() => assignFabric(selectedFabricId, true)}>APPLY TO ALL GARMENT PIECES</button>
                </div>
                {selectedPiece && <label className="select-field"><span>{selectedPiece.name} material</span><select value={selectedPiece.fabricId || 'main'} onChange={(event) => updateSelectedPiece('fabricId', event.target.value)}>{Object.entries(project.fabrics || {}).map(([fabricId, item]) => <option key={fabricId} value={fabricId}>{item.name || fabricId}</option>)}</select></label>}
                {selectedFabricId !== 'main' && <button className="wide-action danger-action" onClick={() => deleteFabricSwatch(selectedFabricId)}><Trash2 size={14} />DELETE SWATCH · REASSIGN TO MAIN</button>}
              </div>
              <div className="panel-section">
                <details aria-label="CLO7 style fabric detailed property comparison">
                  <summary className="panel-title" style={{cursor:'pointer'}}>
                    <span>CLO-style fabric property detail</span><strong>WARP · WEFT · BIAS</strong>
                  </summary>
                  <p className="panel-copy">Read-only, source-linked property comparison for this EXO fabric. Values shown are existing EXO inputs, not extracted CLO preset strengths. Blank directional/buckling values are real model gaps, not zeros. Select any of the 400 presets to inspect its full physical, surface and measurement breakdown.</p>
                  {clo7FabricReadout(fabric).sections.map(group=>(
                    <div key={group.id}>
                      <div className="panel-title"><span>{group.label}</span><strong>{group.rows.length} FIELDS</strong></div>
                      {group.rows.map(item=>(
                        <div key={item.id} className="control-row split-control" title={item.note}>
                          <span>{item.label}</span>
                          <strong style={{textAlign:'right',fontSize:11}}>
                            {item.value==null?'NOT AVAILABLE':String(item.value)+(item.unit?' '+item.unit:'')}
                            <small style={{display:'block',fontSize:9,opacity:.65}}>
                              {item.status==='solver-input'?'EXO SOLVER':item.status==='optical-only'?'VISUAL ONLY':item.status==='not-implemented'?'MISSING MODEL':'EVIDENCE'}
                            </small>
                          </strong>
                        </div>
                      ))}
                    </div>
                  ))}
                  <p className="panel-copy">CLO 7.x documentation reference: <a href={clo7FabricReadout(fabric).referenceUrls.physical} target="_blank" rel="noreferrer">Physical Property Details</a> · <a href={clo7FabricReadout(fabric).referenceUrls.measurement} target="_blank" rel="noreferrer">Fabric Kit measurements</a>. Live CLO7 selected-material field order has not been captured by the current automation permissions.</p>
                </details>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Textile surface</span><strong>{fabric.texture?.src ? 'MAPPED' : 'COLOR'}</strong></div>
                <FabricMaterialPreview fabric={fabric} />
                {fabric.texture?.scanAssetId ? <p className="panel-copy">
                  Photographic PBR reference: <a href={fabric.texture.originalSourceUrl} target="_blank" rel="noreferrer">{fabric.texture.scanSource} · {fabric.texture.scanAssetId}</a> · CC0 · {fabric.texture.scanMatch==='family-proxy'?'similar fabric family, NOT an exact specimen':'construction reference'}. Physical parameters are still estimated and must be measured for production.
                </p> : <p className="panel-copy">Procedurally generated surface or user-uploaded image. Material mechanics have not been certified by a fabric laboratory.</p>}
                {fabric.photoReference?.visualReviewFlags?.length>0 && (
                  <p className="panel-copy" aria-label="Scan optical review notes">
                    Source image needs visual review: {fabric.photoReference.visualReviewFlags.map(flag=>{
                      const [channel,reason]=flag.split(':')
                      return `${channel} ${reason.replaceAll('_',' ')}`
                    }).join('; ')}. These image-statistics flags are not a finding that the scan is incorrect. Compare actual grazing-light PBR shading before approving a production visual.
                  </p>
                )}
                {fabric.texture?.physicalScaleStatus==='unknown-illustrative-20cm' && (
                  <p className="panel-copy" aria-label="Scan repeat scale not measured">
                    This stock photo has no published physical textile repeat size. The displayed 20 cm repeat is an illustrative starting point: adjust using a photographed ruler or physical fabric sample.
                  </p>
                )}
                <label className="select-field"><span>Fabric structure</span><select value={fabric.surfaceFamily || 'auto'} onChange={(event) => updateFabric('surfaceFamily', event.target.value)}>
                  <option value="auto">Auto-detect from fabric name</option>
                  <option value="plain-weave">Plain woven cotton / linen</option>
                  <option value="twill">Twill / denim diagonal weave</option>
                  <option value="jersey-knit">Jersey single knit</option>
                  <option value="rib-knit">Rib knit</option>
                  <option value="waffle-knit">Waffle thermal knit</option>
                  <option value="corduroy">Corduroy raised wales</option>
                  <option value="terry-knit">French terry / fleece</option>
                  <option value="fleece-pile">Sherpa / fleece pile</option>
                  <option value="basket-weave">Basket weave / Oxford</option>
                  <option value="crepe">Crêpe / pebbled yarn</option>
                  <option value="boucle">Bouclé / looped yarn</option>
                  <option value="mesh">Sports mesh / open knit approximation</option>
                  <option value="silk">Silk / satin weave</option>
                  <option value="synthetic">Technical nylon / polyester</option>
                  <option value="ripstop">Ripstop woven reinforcement</option>
                  <option value="suede">Suede / brushed nap</option>
                  <option value="leather">Grained leather</option>
                </select></label>
                <p className="panel-copy">Changes the 3D yarn structure, surface normals and micro-roughness without disturbing the garment's drape. Fabric appearance is separate from mechanical calibration.</p>
                {fabric.texture?.src ? (
                  <>
                    <div className="fabric-texture-card">
                      <img src={fabric.texture.src} alt="" />
                      <div><strong>{fabric.texture.name || 'Surface texture'}</strong><small>Pattern-centimeter UV · follows grainline</small></div>
                      <button onClick={removeFabricTexture}><Trash2 size={12} /></button>
                    </div>
                    <div className="field-grid two">
                      <div><span>Repeat W</span><NumberField value={fabric.texture.repeatWidthCm ?? 20} min={0.5} max={200} step={0.5} suffix="cm" onChange={(value) => updateFabricTexture('repeatWidthCm', clamp(value, 0.5, 200))} /></div>
                      <div><span>Repeat H</span><NumberField value={fabric.texture.repeatHeightCm ?? 20} min={0.5} max={200} step={0.5} suffix="cm" onChange={(value) => updateFabricTexture('repeatHeightCm', clamp(value, 0.5, 200))} /></div>
                    </div>
                    <div className="control-row split-control"><span>Texture rotation</span><NumberField value={fabric.texture.rotationDeg ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateFabricTexture('rotationDeg', value)} /></div>
                    <button className="wide-action" onClick={() => fabricTextureInputRef.current?.click()}><Upload size={14} />REPLACE TEXTURE</button>
                  </>
                ) : (
                  <>
                    <p className="panel-copy">Upload a weave, knit, print, wash, or photographed textile. Repeat dimensions are interpreted in real garment centimeters.</p>
                    <button className="wide-action" onClick={() => fabricTextureInputRef.current?.click()}><Upload size={14} />UPLOAD TEXTILE IMAGE</button>
                  </>
                )}
              </div>
              <div className="panel-section" aria-label="Non destructive digital fabric wash editor">
                <div className="panel-title"><span>Digital wash and dye</span><strong>{normalizeWashSpec(fabric.wash).type.toUpperCase()}</strong></div>
                <label className="select-field"><span>Finish / wash effect</span><select aria-label="Fabric wash effect" value={normalizeWashSpec(fabric.wash).type}
                  onChange={(event)=>updateFabricWash({type:event.target.value,strength:event.target.value==='raw'?0:.65})}>
                  {Object.entries(WASH_EFFECTS).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}
                </select></label>
                <SliderRow label="Wash intensity" value={normalizeWashSpec(fabric.wash).strength} min={0} max={1} step={.02} display={`${Math.round(normalizeWashSpec(fabric.wash).strength*100)}%`} onChange={value=>updateFabricWash({strength:value})}/>
                <SliderRow label="Effect scale" value={normalizeWashSpec(fabric.wash).scale} min={.1} max={12} step={.1} display={`${normalizeWashSpec(fabric.wash).scale.toFixed(1)}×`} onChange={value=>updateFabricWash({scale:value})}/>
                <label className="select-field"><span>Color blend</span><select aria-label="Fabric wash blend" value={normalizeWashSpec(fabric.wash).blend} onChange={event=>updateFabricWash({blend:event.target.value})}>
                  <option value="overlay">Overlay-style</option><option value="soft-light">Soft light</option>
                  <option value="screen">Screen-style fade</option><option value="multiply">Multiply-style dye</option>
                </select></label>
                <SliderRow label="Absorbency look" value={normalizeWashSpec(fabric.wash).absorbency} min={0} max={1} step={.02} display={`${Math.round(normalizeWashSpec(fabric.wash).absorbency*100)}%`} onChange={value=>updateFabricWash({absorbency:value})}/>
                <SliderRow label="Cycle / wear amount" value={normalizeWashSpec(fabric.wash).cycleDuration} min={0} max={1} step={.02} display={`${Math.round(normalizeWashSpec(fabric.wash).cycleDuration*100)}%`} onChange={value=>updateFabricWash({cycleDuration:value})}/>
                <SliderRow label="UV edge fade" value={normalizeWashSpec(fabric.wash).seamAbrasion} min={0} max={1} step={.02} display={`${Math.round(normalizeWashSpec(fabric.wash).seamAbrasion*100)}%`} onChange={value=>updateFabricWash({seamAbrasion:value})}/>
                <div className="field-grid two">
                  <div><span>Position X</span><NumberField value={normalizeWashSpec(fabric.wash).placement.x*100} min={0} max={100} step={1} suffix="%" onChange={value=>updateFabricWash({placement:{...normalizeWashSpec(fabric.wash).placement,x:value/100}})}/></div>
                  <div><span>Position Y</span><NumberField value={normalizeWashSpec(fabric.wash).placement.y*100} min={0} max={100} step={1} suffix="%" onChange={value=>updateFabricWash({placement:{...normalizeWashSpec(fabric.wash).placement,y:value/100}})}/></div>
                </div>
                <div className="field-grid two">
                  <div><span>Direction</span><NumberField value={normalizeWashSpec(fabric.wash).rotation} min={-180} max={180} step={5} suffix="°" onChange={value=>updateFabricWash({rotation:value})}/></div>
                  <div><span>Random seed</span><NumberField value={normalizeWashSpec(fabric.wash).seed} min={0} max={9999} step={1} onChange={value=>updateFabricWash({seed:Math.round(value)})}/></div>
                </div>
                <button className="wide-action" onClick={()=>updateFabricWash({type:'raw',strength:0,scale:1,seed:0,placement:{x:.5,y:.5},rotation:0,absorbency:0,cycleDuration:0,seamAbrasion:0,blend:'overlay'})}>RESET VISUAL WASH</button>
                <p className="panel-copy" aria-label="Fabric-specific wash guidance">
                  {digitalWashSuitability(fabric,fabric.wash).caution || digitalWashSuitability(fabric,fabric.wash).recommendation}
                </p>
                <p className="panel-copy">Non-destructive visual simulation, not an industrial treatment recipe. Stone, acid, enzyme, ozone, garment dye, localized PP-inspired fading, abrasion and whiskers use editable digital maps. The UV-edge fade is not yet aware of true sewn seam geometry. Actual fabric chemistry, tensile weakening, shrinkage and garment-shaped wear require measured samples and solver integration.</p>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Textile PBR maps</span><strong>{[fabric.texture?.normalSrc, fabric.texture?.roughnessSrc, fabric.texture?.metalnessSrc, fabric.texture?.opacitySrc, fabric.texture?.displacementSrc].filter(Boolean).length}/5</strong></div>
                <button className="wide-action" onClick={() => fabricPbrSetInputRef.current?.click()}><Upload size={14} />IMPORT MATCHING PBR MAP SET</button>
                <p className="panel-copy">Select multiple image files named e.g. fabric_diff, fabric_nor_gl, fabric_rough, fabric_metal, fabric_opacity and fabric_height. DirectX normal and packed ARM maps are not auto-converted.</p>
                <p className="panel-copy">Normal, roughness, metalness, opacity and displacement maps share the fabric's centimeter-based pattern UVs and grain rotation. Grayscale opacity maps control sheer and perforated regions.</p>
                {fabric.texture?.src && (
                  <>
                    <button className="wide-action" disabled={fabricGeneratingPbr || Boolean(fabric.texture.normalSrc && fabric.texture.roughnessSrc)} onClick={autoGenerateFabricPbr}>
                      <Sparkles size={14} />{fabricGeneratingPbr ? 'GENERATING MAPS...' : 'GENERATE NORMAL + ROUGHNESS FROM PHOTO'}
                    </button>
                    <p className="panel-copy">Image-derived PBR maps estimate surface detail from brightness; they are not scanned or physically calibrated. Existing manual maps are preserved.</p>
                  </>
                )}
                {fabric.texture?.normalSrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.normalSrc} alt="" />
                    <div><strong>{fabric.texture.normalName || 'Normal map'}</strong><small>Linear normal detail · shared textile UV</small></div>
                    <button onClick={() => removeFabricPbrMap('normal')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricNormalInputRef.current?.click()}><Upload size={14} />LOAD NORMAL MAP</button>}
                {fabric.texture?.roughnessSrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.roughnessSrc} alt="" />
                    <div><strong>{fabric.texture.roughnessName || 'Roughness map'}</strong><small>Linear roughness · green channel</small></div>
                    <button onClick={() => removeFabricPbrMap('roughness')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricRoughnessInputRef.current?.click()}><Upload size={14} />LOAD ROUGHNESS MAP</button>}
                {fabric.texture?.normalSrc && <button className="wide-action compact-action" onClick={() => fabricNormalInputRef.current?.click()}><Upload size={13} />REPLACE NORMAL</button>}
                {fabric.texture?.roughnessSrc && <button className="wide-action compact-action" onClick={() => fabricRoughnessInputRef.current?.click()}><Upload size={13} />REPLACE ROUGHNESS</button>}
                {fabric.texture?.metalnessSrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.metalnessSrc} alt="" />
                    <div><strong>{fabric.texture.metalnessName || 'Metalness map'}</strong><small>Linear grayscale · metallic finish mask</small></div>
                    <button onClick={() => removeFabricPbrMap('metalness')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricMetalnessInputRef.current?.click()}><Upload size={14} />LOAD METALNESS MAP</button>}
                {fabric.texture?.opacitySrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.opacitySrc} alt="" />
                    <div><strong>{fabric.texture.opacityName || 'Opacity map'}</strong><small>White = opaque · black = transparent</small></div>
                    <button onClick={() => removeFabricPbrMap('opacity')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricOpacityInputRef.current?.click()}><Upload size={14} />LOAD OPACITY MAP</button>}
                {fabric.texture?.displacementSrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.displacementSrc} alt="" />
                    <div><strong>{fabric.texture.displacementName || 'Height / displacement map'}</strong><small>Linear grayscale · visual surface height</small></div>
                    <button onClick={() => removeFabricPbrMap('displacement')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricDisplacementInputRef.current?.click()}><Upload size={14} />LOAD HEIGHT / DISPLACEMENT MAP</button>}
                <SliderRow label="Normal strength" value={fabric.normalStrength ?? 1} min={0} max={4} step={0.05} display={`${(fabric.normalStrength ?? 1).toFixed(2)}×`} onChange={(value) => updateFabric('normalStrength', value)} />
                <SliderRow label="Surface roughness" value={fabric.roughness ?? 0.82} min={0.04} max={1} step={0.01} display={(fabric.roughness ?? 0.82).toFixed(2)} onChange={(value) => updateFabric('roughness', value)} />
                <SliderRow label="Fabric opacity" value={fabric.opacity ?? 1} min={0.05} max={1} step={0.01} display={`${Math.round((fabric.opacity ?? 1) * 100)}%`} onChange={(value) => updateFabric('opacity', value)} />
                <SliderRow label="Visual displacement" value={fabric.displacementMm ?? 0} min={0} max={2} step={0.05} display={`${(fabric.displacementMm ?? 0).toFixed(2)} mm`} onChange={(value) => updateFabric('displacementMm', value)} />
                <SliderRow label="Sheen" value={fabric.sheen ?? 0.22} min={0} max={1} step={0.01} display={(fabric.sheen ?? 0.22).toFixed(2)} onChange={(value) => updateFabric('sheen', value)} />
                <SliderRow label="Sheen roughness" value={fabric.sheenRoughness ?? 0.84} min={0.04} max={1} step={0.01} display={(fabric.sheenRoughness ?? 0.84).toFixed(2)} onChange={(value) => updateFabric('sheenRoughness', value)} />
                <SliderRow label="Metalness" value={fabric.metalness ?? 0} min={0} max={1} step={0.01} display={(fabric.metalness ?? 0).toFixed(2)} onChange={(value) => updateFabric('metalness', value)} />
                <div className="panel-title"><span>Yarn-direction highlights</span><strong>ANISOTROPIC</strong></div>
                <SliderRow label="Fiber anisotropy" value={fabric.fiberAnisotropy ?? .16} min={0} max={1} step={0.01} display={(fabric.fiberAnisotropy ?? .16).toFixed(2)} onChange={(value) => updateFabric('fiberAnisotropy', value)} />
                <SliderRow label="Yarn highlight angle" value={fabric.fiberAngleDeg ?? 0} min={-180} max={180} step={1} display={`${Math.round(fabric.fiberAngleDeg ?? 0)}°`} onChange={(value) => updateFabric('fiberAngleDeg', value)} />
                <SliderRow label="Coating / finish" value={fabric.clearcoat ?? 0} min={0} max={1} step={0.01} display={(fabric.clearcoat ?? 0).toFixed(2)} onChange={(value) => updateFabric('clearcoat', value)} />
                <SliderRow label="Coating roughness" value={fabric.clearcoatRoughness ?? .45} min={.04} max={1} step={.01} display={(fabric.clearcoatRoughness ?? .45).toFixed(2)} onChange={(value) => updateFabric('clearcoatRoughness', value)} />
                <div className="panel-title"><span>Procedural yarn surface</span><strong>CM-SCALED</strong></div>
                <SliderRow label="Yarn tile scale" value={fabric.weaveScaleCm ?? 3} min={.3} max={10} step={.1} display={`${(fabric.weaveScaleCm ?? 3).toFixed(1)} cm`} onChange={(value) => updateFabric('weaveScaleCm', value)} />
                <SliderRow label="Subtle dye variation" value={fabric.colorVariation ?? .25} min={0} max={1} step={.05} display={`${Math.round((fabric.colorVariation ?? .25) * 100)}%`} onChange={(value) => updateFabric('colorVariation', value)} />
                <p className="panel-copy">Directional highlights, coating and yarn microdetail are optical material controls, not physical fabric calibration. Uploaded color, normal and roughness maps take priority over generated yarn maps.</p>
              </div>
              <div className="panel-section">
                <SliderRow label="Weight" value={fabric.gsm} min={40} max={900} step={5} display={`${fabric.gsm} gsm`} onChange={(value) => updateFabric('gsm', value)} />
                <SliderRow label="Warp stretch" value={fabric.stretchWarp} min={0} max={0.5} step={0.005} display={`${Math.round(fabric.stretchWarp * 100)}%`} onChange={(value) => updateFabric('stretchWarp', value)} />
                <SliderRow label="Weft stretch" value={fabric.stretchWeft} min={0} max={0.5} step={0.005} display={`${Math.round(fabric.stretchWeft * 100)}%`} onChange={(value) => updateFabric('stretchWeft', value)} />
                <SliderRow label="Warp shrink" value={fabric.shrinkWarp ?? 0} min={-0.15} max={0.25} step={0.005} display={`${Math.round((fabric.shrinkWarp ?? 0) * 100)}%`} onChange={(value) => updateFabric('shrinkWarp', value)} />
                <SliderRow label="Weft shrink" value={fabric.shrinkWeft ?? 0} min={-0.15} max={0.25} step={0.005} display={`${Math.round((fabric.shrinkWeft ?? 0) * 100)}%`} onChange={(value) => updateFabric('shrinkWeft', value)} />
                <SliderRow label="Thickness" value={(fabric.thickness ?? 0.002) * 1000} min={0.2} max={12} step={0.1} display={`${((fabric.thickness ?? 0.002) * 1000).toFixed(1)} mm`} onChange={(value) => updateFabric('thickness', value / 1000)} />
                <SliderRow label="Bending" value={fabric.bend} min={0.1} max={0.99} step={0.01} display={fabric.bend.toFixed(2)} onChange={(value) => updateFabric('bend', value)} />
                <SliderRow label="Friction" value={fabric.friction} min={0.05} max={0.9} step={0.01} display={fabric.friction.toFixed(2)} onChange={(value) => updateFabric('friction', value)} />
                <SliderRow label="Motion damping" value={fabric.damping ?? 0.985} min={0.90} max={0.999} step={0.001} display={(fabric.damping ?? 0.985).toFixed(3)} onChange={(value) => updateFabric('damping', value)} />
              </div>
            </>
          )}

          {activeSection === 'Avatar' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Avatar</span><strong>{project.avatar.name}</strong></div>
                <div className="avatar-card"><div className="avatar-silhouette"><i /><i /><i /></div><div><span>BODY PROFILE</span><strong>{project.avatar.heightCm} cm</strong><em>{project.avatar.model === 'theo' || project.avatar.model === 'nora' ? 'Rigged CC0 fitting body' : 'CC0 MakeHuman fitting body'}</em></div></div>
                <label className="select-field"><span>Fitting avatar</span><select value={project.avatar.model || 'makehuman-base'} onChange={(event) => setAvatarModel(event.target.value)}>{AVAILABLE_AVATARS.map(({ name, model }) => <option key={model} value={model} disabled={avatarAvailability[model] !== true}>{name}{model === 'makehuman-base' ? ' · Neutral base' : model === 'clo-thomas' ? ' · CLO3D Export' : ' · Rigged fitting'}{avatarAvailability[model] === false ? ' · Not installed' : ''}</option>)}{project.avatar.model === 'custom-export' && <option value="custom-export">Imported OBJ / GLB mesh</option>}</select></label><button className="wide-action" onClick={() => avatarMeshInputRef.current?.click()}><Upload size={14}/>IMPORT AVATAR OBJ / GLB</button><p className="panel-copy">Imported meshes are visual until mesh-to-body collision fitting is implemented. Use assets you have permission to import.</p>
                {(project.avatar.model === 'theo' || project.avatar.model === 'nora') && <p className="panel-copy">Rigged OpenSew/MPFB fitting body · CC0. Selecting it also moves the analytic collision arms to the matching 60° apparel fitting pose.</p>}
              </div>
              <div className="panel-section measure-list">
                {[
                  ['heightCm', 'Height', 150, 205],
                  ['chestCm', 'Chest', 70, 145],
                  ['waistCm', 'Waist', 55, 145],
                  ['hipCm', 'Hip', 70, 150],
                  ['shoulderWidthCm', 'Shoulder width', 34, 62],
                  ['neckCm', 'Neck', 28, 58],
                  ['bicepCm', 'Bicep', 20, 60],
                ].map(([field, label, min, max]) => (
                  <div className="control-row split-control" key={field}><span>{label}</span><NumberField value={project.avatar[field]} min={min} max={max} suffix="cm" onChange={(value) => updateAvatar(field, clamp(value, min, max))} /></div>
                ))}
                <div className="control-row split-control"><span>Arm length</span><NumberField value={project.avatar.armLengthCm ?? Number((72 * (project.avatar.heightCm ?? 180) / 180).toFixed(1))} min={42} max={86} step={0.5} suffix="cm" onChange={(value) => updateAvatar('armLengthCm', clamp(value, 42, 86))} /></div>
                <SliderRow label="Arm pose" value={project.avatar.armAngleDeg ?? 6} min={0} max={70} step={1} display={`${Math.round(project.avatar.armAngleDeg ?? 6)}°`} onChange={(value) => updateAvatar('armAngleDeg', value)} />
                <SliderRow label="Avatar visibility" value={project.avatar.visibility} min={0.05} max={1} step={0.05} display={`${Math.round(project.avatar.visibility * 100)}%`} onChange={(value) => updateAvatar('visibility', value)} />
              </div>
            </>
          )}

          {activeSection === 'Fit' && (
            <>
              <div className="panel-section" aria-label="ClothCraft OGC contact solver">
                <div className="panel-title"><span>ClothCraft Rust · VBD + OGC</span><strong>OPT-IN</strong></div>
                <p className="panel-copy">Run ClothCraft's actual CPU solver with the current EXO garment and {project.avatar.name}. The Thomas and MakeHuman body-only collision meshes are supported. The result opens as a 3D comparison with both cloth and avatar. Your editable pattern and existing live solver stay unchanged.</p>
                <label className="select-field"><span>Rust OGC steps</span><select value={clothCraftContactSteps} onChange={(event) => setClothCraftContactSteps(Number(event.target.value))}><option value={1}>1 · Contact diagnostic</option><option value={3}>3 · Short trial</option><option value={10}>10 · Relaxation trial</option><option value={30}>30 · Extended trial</option></select></label>
                <button className="wide-action" disabled={clothCraftBusy} onClick={runClothCraftOgc}><Cpu size={15} />{clothCraftBusy ? 'RUNNING CLOTHCRAFT VBD + OGC…' : 'RUN CLOTHCRAFT VBD + OGC CONTACT'}</button>
                {clothCraftContactResult?.ok && <div className="stat-grid" role="status"><MiniStat label="OGC seam peak" value={`${clothCraftContactResult.maxSeamGapMm.toFixed(1)} mm`} /><MiniStat label="OGC contacts" value={String(clothCraftContactResult.activeContacts)} /><MiniStat label="OGC stretch p95" value={`${clothCraftContactResult.p95ExtensionPercent.toFixed(1)}%`} /><MiniStat label="OGC fit accepted" value="NO" /></div>}
                {clothCraftContactResult?.ok && <p className="panel-copy" style={{color:'#f39a88'}} role="status">{clothCraftContactResult.reason} Experimental normal contact only: no swept CCD, friction or certified sewn-body fit. View the diagnostic mesh before comparing solvers.</p>}
                {clothCraftContactResult?.error && <p className="panel-copy" style={{color:'#f39a88'}} role="alert">OGC could not complete: {clothCraftContactResult.error}</p>}
              </div>
              <div className="panel-section" aria-label="ZOZO GitHub original dress simulation test">
                <div className="panel-title"><span>Original GitHub dress · first fabric test</span><strong>RUST/METAL</strong></div>
                <p className="panel-copy">The source dress is the original 14-panel upstream example, not a reconstructed pattern. Inspect its real 241-frame body and fabric simulation in the 3D viewport while preserving this editable garment project.</p>
                <button className="wide-action" disabled={zozoReferenceLoading} onClick={openZozoReference}><Shirt size={15}/>{zozoReferenceLoading ? 'LOADING ORIGINAL DRESS…' : zozoReference ? 'RETURN TO EDITABLE GARMENT' : 'OPEN GITHUB DRESS · ORIGINAL PPF TEST'}</button>
                {zozoReferenceError && <p className="panel-copy" role="alert" style={{color:'#f39a88'}}>{zozoReferenceError}</p>}
                {zozoReference && <div className="zozo-reference-controls" data-testid="zozo-reference-controls">
                  <div className="panel-title"><span>Original solver frame</span><strong>{zozoReferenceFrame + 1}/{zozoReference.manifest.frames}</strong></div>
                  <div className="zozo-reference-actions">
                    <button type="button" onClick={() => setZozoReferenceFrame(0)}>START</button>
                    <button type="button" onClick={() => setZozoReferencePlaying(value => !value)}>{zozoReferencePlaying ? 'PAUSE' : 'PLAY'}</button>
                    <button type="button" onClick={() => setZozoReferenceFrame(240)}>FINAL FRAME</button>
                    <button type="button" onClick={() => setZozoReferenceBodyVisible(value => !value)}>{zozoReferenceBodyVisible ? 'HIDE BODY' : 'SHOW BODY'}</button>
                  </div>
                  <input aria-label="ZOZO GitHub dress simulation frame" type="range" min="0" max="240" step="1" value={zozoReferenceFrame} onChange={event => {setZozoReferencePlaying(false);setZozoReferenceFrame(Number(event.target.value))}} />
                  <p className="panel-copy" role="status" data-testid="zozo-reference-metrics">Frame {zozoReferenceFrame}: {zozoReference.manifest.audits[zozoReferenceFrame].bodyCrossings} body intersections · mean seam gap {zozoReference.manifest.audits[zozoReferenceFrame].meanSeamGapCm.toFixed(3)} cm · worst gap {zozoReference.manifest.audits[zozoReferenceFrame].maxSeamGapCm.toFixed(3)} cm.</p>
                  <p className="panel-copy" style={{color:'#f39a88'}}>Real Rust/Metal simulation, but NOT a fully validated fit. Known collisions at frames 87, 90 and 174. The editable project and 2D pattern remain untouched.</p>
                </div>}
              </div>
              <div className="panel-section" aria-label="PPF body drape validation">
                <div className="panel-title"><span>PPF body-contact fitting</span><strong>OFFLINE · METAL</strong></div>
                <p className="panel-copy">Run the installed ST-Tech/ZOZO PPF Metal contact solver against the local Thomas skin mesh when CLO Thomas is selected, or the measurement proxy otherwise. It automatically tests multiple safe starting placements before sewing. A final fit is accepted only after physical seam closure and every-frame collision validation; unfinished attempts remain available for diagnosis without overwriting your patterns.</p>
                <button className={`toggle-row ${automaticPpfOnSimulate ? 'active' : ''}`} aria-label="Automatically run high-fidelity contact validation when Simulate starts" onClick={() => setAutomaticPpfOnSimulate(value => !value)}><span><Link2 size={15}/>Auto-run PPF contact validation after pressing Simulate</span><i/></button>
                <p className="panel-copy">Optional and off by default: starts a separate local Metal fit job on first simulation while keeping interactive cloth usable. Unvalidated output is never applied to the visible garment.</p>
                <button className="wide-action" disabled={!project.seams.length || ['queued','running','connecting'].includes(ppfSewing.status)} onClick={() => startPpfSewing()}>
                  <CadToolIcon id="fit" size={17}/>
                  {['queued','running','connecting'].includes(ppfSewing.status) ? 'PPF BODY DRAPE RUNNING…' : 'RUN PPF BODY + SEAM FIT'}
                </button>
                <p className="panel-copy" role="status">PPF Metal: {ppfSewing.status === 'idle' ? 'READY TO CHECK LOCAL SERVICE' : `${ppfSewing.status.toUpperCase()} · ${ppfSewing.phase}`}</p>
                {ppfSewing.error && <p className="panel-copy" style={{color:'#efad9a'}}>{ppfSewing.error}</p>}
                {ppfSewing.summary?.ipcCcd?.tested && <p className="panel-copy" style={ppfSewing.summary.ipcCcd.allTestedStepsCollisionFree ? undefined : {color:'#f39a88'}}>IPC SWEPT COLLISION: {ppfSewing.summary.ipcCcd.allTestedStepsCollisionFree ? 'PASSED' : 'FAILED'} across {ppfSewing.summary.ipcCcd.framesAudited} Thomas-body frames{ppfSewing.summary.ipcCcd.firstBlockedFrame !== null ? `; first unsafe movement enters frame ${ppfSewing.summary.ipcCcd.firstBlockedFrame}` : ''}. This checks between-frame crossings against Thomas's actual collision triangles; a failed trajectory cannot be accepted as a valid final fit.</p>}
                {ppfSewing.summary?.contact && <p className="panel-copy">Measured contact across {ppfSewing.summary.contact.framesChecked} frames: avatar {ppfSewing.summary.contact.allFramesAvatarIntersectionFree ? 'PASS' : 'INTERSECTIONS DETECTED'}; cloth self-contact {ppfSewing.summary.contact.allFramesSelfIntersectionFree ? 'PASS' : 'INTERSECTIONS DETECTED'}. These checks use exported solver frames.</p>}
                {ppfSewing.summary?.sewing && <p className="panel-copy">Seam gap: {ppfSewing.summary.sewing.initialMeanGapCm.toFixed(1)} → {ppfSewing.summary.sewing.finalMeanGapCm.toFixed(1)} cm. Not a certified closed garment until all gaps and contact checks pass.</p>}
                {ppfSewing.artifacts?.blend && <p className="panel-copy">Blender output: <code style={{overflowWrap:'anywhere'}}>{ppfSewing.artifacts.blend}</code></p>}
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Fit analysis</span><Activity size={15} /></div>
                <div className="analysis-switch">
                  <button className={analysisMode === 'surface' ? 'active' : ''} onClick={() => setAnalysisMode('surface')}>SURFACE</button>
                  <button className={analysisMode === 'strain' ? 'active' : ''} onClick={() => setAnalysisMode('strain')}>STRAIN MAP</button>
                  <button className={analysisMode === 'pressure' ? 'active' : ''} onClick={() => setAnalysisMode('pressure')}>PRESSURE</button>
                  <button className={analysisMode === 'ease' ? 'active' : ''} onClick={() => setAnalysisMode('ease')}>EASE</button>
                </div>
                <div className="stat-grid">
                  <MiniStat label="Solver backend" value={stats.backendId === 'native-xpbd' ? 'Native XPBD' : 'Browser PBD'} />
                  {stats.backendId === 'native-xpbd' && <MiniStat label="Native batch" value={stats.backendError ? 'OFFLINE' : `${stats.backendElapsedMs.toFixed(0)} ms`} />}
                  {stats.backendId === 'native-xpbd' && <MiniStat label="Native frames" value={stats.backendFrame.toLocaleString()} />}
                  {stats.backendId === 'native-xpbd' && stats.backendInitialAssembly?.status === 'STAGING_REQUIRES_REPAIR' && <p className="panel-copy" style={{color:'#f39a88'}}>Native preflight: assembly starts {stats.backendInitialAssembly.initialSeamGapMaximumMm.toFixed(1)} mm apart at its worst sewn pair ({stats.backendInitialAssembly.worstSewingGroups?.[0]?.seamId || 'unknown'}). This pose needs correction before physical fitting can pass.</p>}
                  {stats.backendId === 'native-xpbd' && stats.backendFitAssessment?.status === 'FAILED' && <p className="panel-copy" style={{color:'#f39a88'}}>Native solver status: FIT FAILED. Numerical output is retained for diagnosis but is not a validated drape.</p>}
                  <MiniStat label="Vertices" value={stats.vertices.toLocaleString()} />
                  {Number.isFinite(stats.hemRiseM) && <MiniStat label="Hem displacement" value={`${stats.hemRiseM >= 0 ? '+' : ''}${(stats.hemRiseM * 100).toFixed(1)} cm`} />}
                  {stats.hemFloatingWarning && <p className="panel-copy" style={{ color: '#f39a88' }}>FLOATING FIT WARNING: the lowest torso point rose more than 8 cm after simulation began. This is a detected physics problem, not a validated garment fit. Check the shoulder contact, sewing forces and body intersections before exporting.</p>}
                  <MiniStat label="Constraints" value={stats.constraints.toLocaleString()} />
                  <MiniStat label="Internal constraints" value={stats.internal.toLocaleString()} />
                  <MiniStat label="Seam treatments" value={stats.treatments.toLocaleString()} />
                  <MiniStat label="Average strain" value={`${(stats.averageStrain * 100).toFixed(1)}%`} />
                  <MiniStat label="Peak strain" value={`${(stats.maxStrain * 100).toFixed(1)}%`} />
                  {Number.isFinite(stats.p95StrainPercent) && <MiniStat label="95th %ile strain" value={`${stats.p95StrainPercent.toFixed(1)}%`} />}
                  {Number.isFinite(stats.meanSeamGapMm) && <MiniStat label="Seam gap · mean" value={`${stats.meanSeamGapMm.toFixed(1)} mm`} />}
                  {Number.isFinite(stats.p95SeamGapMm) && <MiniStat label="Seam gap · p95" value={`${stats.p95SeamGapMm.toFixed(1)} mm`} />}
                  {Number.isFinite(stats.maxSeamGapMm) && <MiniStat label="Seam gap · worst" value={`${stats.maxSeamGapMm.toFixed(1)} mm`} />}
                  <MiniStat label="Average ease" value={`${stats.averageEaseCm.toFixed(1)} cm`} />
                  <MiniStat label="Body contact" value={`${Math.round(stats.contactRatio * 100)}%`} />
                  <MiniStat label="Tight area" value={`${Math.round(stats.tightRatio * 100)}%`} />
                  <MiniStat label="Pressure peak" value={`${Math.round(stats.maxPressureIndex * 100)}%`} />
                  {Number.isFinite(stats.sampledPenetratingFaces) && <MiniStat label="Sampled penetrating faces" value={stats.sampledPenetratingFaces.toLocaleString()} />}
                  {Number.isFinite(stats.sampledIntrusionMm) && <MiniStat label="Sampled intrusion" value={`${stats.sampledIntrusionMm.toFixed(1)} mm`} />}
                  {Number.isFinite(stats.sampledCorrectedVertices) && <MiniStat label="Contact-adjusted vertices" value={stats.sampledCorrectedVertices.toLocaleString()} />}
                </div>
                <p className="panel-copy" style={{ color: '#f39a88' }}>Interactive fit is not collision-certified: body/cloth triangle CCD and all-frame penetration validation are not yet implemented in this solver. Low seam gaps alone do not mean the garment fits.</p>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Native XPBD</span><strong>{nativeSolveStatus === 'solving' ? 'SOLVING' : nativeSolveStatus === 'unfit' ? 'FIT FAILED' : nativeSolveStatus === 'done' ? 'MEASURED' : nativeServiceStatus === 'ready' ? 'READY' : nativeServiceStatus.toUpperCase()}</strong></div>
                <label className="select-field"><span>Native quality</span><select value={project.simulation.nativeQuality || 'draft'} onChange={(event) => applyNativeQuality(event.target.value)}>{Object.values(NATIVE_QUALITY_PROFILES).map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
                <button className={`toggle-row ${project.simulation.experimentalNativeSewFirst === true ? 'active' : ''}`} aria-label="Experimental sew-first preassembly" onClick={() => updateSimulation('experimentalNativeSewFirst', project.simulation.experimentalNativeSewFirst !== true)}><span><Link2 size={15} />Experimental sew-first preassembly</span><i /></button>
                <p className="panel-copy">Research mode, off by default. It joins corresponding sewing samples while preserving cloth rest lengths before native simulation. It does not establish collision-safe fit and can make the subsequent solve worse. The 2D pattern remains unchanged.</p>
                <button className="wide-action" disabled={nativeSolveStatus === 'solving'} onClick={requestNativeSolve}><Cpu size={15} />{nativeSolveStatus === 'solving' ? 'SOLVING NATIVE XPBD…' : 'SOLVE NATIVE XPBD · 60 FRAMES'}</button>
                {nativeLastSolve && <div className="stat-grid"><MiniStat label="Native solve" value={`${nativeLastSolve.elapsedMs.toFixed(1)} ms`} /><MiniStat label="Native seam avg" value={`${((nativeLastSolve.stats?.seamAverageDistance || 0) * 1000).toFixed(1)} mm`} /><MiniStat label="Native seam peak" value={`${((nativeLastSolve.stats?.seamMaxDistance || 0) * 1000).toFixed(1)} mm`} /><MiniStat label="Native particles" value={(nativeLastSolve.stats?.particles || 0).toLocaleString()} /></div>}
                {nativeLastSolve?.payload?.initialAssembly === 'STAGING_REQUIRES_REPAIR' && <p className="panel-copy" style={{color:'#f39a88'}} role="status">INITIAL ASSEMBLY REQUIRES REPAIR: sewing pieces begin as much as {Number(nativeLastSolve.payload.initialSeamGapMaximumMm || 0).toFixed(1)} mm apart; the initial mapped mesh has {Number(nativeLastSolve.payload.initialMeshPeakEdgeStrainPercent || 0).toFixed(1)}% peak edge strain. Worst sewing group: {nativeLastSolve.payload.worstInitialSeam || 'unknown'}. The solver is being asked to close incompatible starting geometry.</p>}
                {nativeLastSolve?.payload?.sewFirstResearch && <p className="panel-copy" style={{color:'#efad9a'}} role="status">EXPERIMENTAL SEW-FIRST: initial worst seam gap {nativeLastSolve.payload.sewFirstResearch.originalMaximumSeamGapMm.toFixed(1)} → {nativeLastSolve.payload.sewFirstResearch.assembledMaximumSeamGapMm.toFixed(1)} mm. Rest-edge strain {nativeLastSolve.payload.sewFirstResearch.originalPeakEdgeStrainPercent.toFixed(1)}% → {nativeLastSolve.payload.sewFirstResearch.assembledPeakEdgeStrainPercent.toFixed(1)}%. Sampled body intrusion up to {nativeLastSolve.payload.sewFirstResearch.sampledMaximumIntrusionMm.toFixed(1)} mm. Not a validated fit.</p>}
                {nativeLastSolve?.fitAssessment && <p className="panel-copy" style={nativeLastSolve.fitAssessment.status==='FAILED'?{color:'#f39a88'}:undefined} role="status">NATIVE PHYSICAL FIT: {nativeLastSolve.fitAssessment.status}. {nativeLastSolve.fitAssessment.failures?.join(', ') || nativeLastSolve.fitAssessment.unknown?.join(', ') || 'Measured checks completed'}. Full cloth/body triangle CCD is not validated, regardless of numerical finiteness.</p>}
                {nativeLastSolve?.fitTrajectory?.frames?.length>0 && <div className="stat-grid"><MiniStat label="Trajectory peak strain" value={`${Number(nativeLastSolve.fitTrajectory.peakFullMeshEdgeStrainPercent||0).toFixed(1)}%`}/><MiniStat label="Trajectory worst seam" value={`${Number(nativeLastSolve.fitTrajectory.peakSewnGapMm||0).toFixed(1)} mm`}/></div>}
                <p className="panel-copy">Draft uses distance constraints. Balanced keeps distance cloth but upgrades bending to XPBD isometric. Quality uses grain-aware strain triangles plus isometric bending; the unstable strain-only combination is intentionally blocked.</p>
              </div>
              <div className="panel-section">
                <label className="select-field"><span>Simulation backend</span><select value={project.simulation.backendId || 'browser-pbd'} onChange={(event) => updateSimulation('backendId', event.target.value)}>{SIMULATION_BACKENDS.map((backend) => <option key={backend.id} value={backend.id}>{backend.label}</option>)}</select></label>
                <label className="select-field"><span>Simulation quality</span><select value={(project.simulation.substeps ?? 2) === 1 ? 'draft' : (project.simulation.substeps ?? 2) === 4 ? 'final' : 'balanced'} onChange={(event) => applySimulationQuality(event.target.value)}><option value="draft">Draft · 1× substep</option><option value="balanced">Balanced · 2× substeps</option><option value="final">Final · 4× substeps</option></select></label>
                <button className={`toggle-row ${project.simulation.autoFitTacks !== false ? 'active' : ''}`} onClick={() => updateSimulation('autoFitTacks', project.simulation.autoFitTacks === false)}><span><Link2 size={15} />Auto-fit shoulder tacks</span><i /></button>
                <button className={`toggle-row ${project.simulation.autoFitPlacement !== false ? 'active' : ''}`} onClick={() => updateSimulation('autoFitPlacement', project.simulation.autoFitPlacement === false)}><span><Link2 size={15} />Auto-correct panel placement</span><i /></button>
                <p className="panel-copy">Recommended: the simulated garment starts from a fitted arrangement scaled to the avatar rather than the manually staged flat panels. The panels transition into place on screen; original pattern measurements and sewn edges remain unchanged. Turn this off to simulate directly from the manual staging pose.</p>
                <p className="panel-copy">Fit tacks behave like temporary garment placement pins: they keep the shoulder construction seated on the avatar while the sewn panels drape and settle.</p>
                <button className={`toggle-row ${project.simulation.collisions !== false ? 'active' : ''}`} onClick={() => updateSimulation('collisions', project.simulation.collisions === false)}><span><Box size={15} />Avatar collision</span><i /></button>
                <button className={`toggle-row ${project.simulation.bodyTriangleContactAssist === true ? 'active' : ''}`} onClick={() => updateSimulation('bodyTriangleContactAssist', project.simulation.bodyTriangleContactAssist !== true)}><span><Box size={15} />Triangle centroid contact assist</span><i /></button>
                <button className={`toggle-row ${project.simulation.adaptiveCutlineMeshing === true ? 'active' : ''}`} aria-label="Experimental adaptive simulation cutline mesh" onClick={() => updateSimulation('adaptiveCutlineMeshing', project.simulation.adaptiveCutlineMeshing !== true)}><span><Spline size={15} />Adaptive simulation-only cutline mesh</span><i /></button>
                {project.simulation.adaptiveCutlineMeshing === true && <div className="control-row split-control"><span>Physics contour tolerance</span><NumberField value={project.simulation.cutlineToleranceCm ?? 0.08} min={0.02} max={0.18} step={0.01} suffix="cm" ariaLabel="Simulation contour tolerance in centimeters" onChange={(value) => updateSimulation('cutlineToleranceCm', clamp(value, 0.02, 0.18))}/></div>}
                {project.simulation.adaptiveCutlineMeshing === true && <p className="panel-copy" style={{color:'#f3b970'}}>Experimental for dense imported CLO/DXF contours. Only the simulation mesh is simplified; editable cutlines and exact sewing remain unchanged. Not certified for every trim, dart, or physical material and does not replace collision validation.</p>}
                <button className={`toggle-row ${project.simulation.continuousSurfaceContact === true ? 'active' : ''}`} onClick={() => updateSimulation('continuousSurfaceContact', project.simulation.continuousSurfaceContact !== true)}><span><Box size={15} />Continuous sampled body contact</span><i /></button>
                <button className={`toggle-row ${project.simulation.meshAvatarContact === true ? 'active' : ''}`} onClick={() => updateSimulation('meshAvatarContact', project.simulation.meshAvatarContact !== true)}><span><Box size={15} />Actual avatar mesh contact (experimental)</span><i /></button>
                <p className="panel-copy">Uses a static triangle BVH of the loaded avatar, with bounded per-frame particle surface corrections. Analytic avatar collisions still run. This is not swept cloth/mesh collision detection; open, layered, and skinned avatar surfaces may produce unreliable inside/outside results.</p>
                <p className="panel-copy">Experimental: after each browser PBD frame, check sampled cloth triangles against the analytic avatar and accept bounded corrections only when sampled penetration improves. This costs extra CPU and does not provide swept collision detection or actual avatar-mesh contact.</p>
                <p className="panel-copy">Experimental triangle-interior projection can reduce extreme stretching when a face penetrates between its vertices. It is not swept triangle collision detection and does not certify the garment as intersection-free.</p>
                <button className={`toggle-row ${project.simulation.selfCollision !== false ? 'active' : ''}`} onClick={() => updateSimulation('selfCollision', project.simulation.selfCollision === false)}><span><Spline size={15} />Cloth self-collision</span><i /></button>
                <div className="control-row split-control"><span>Interactive avatar clearance</span><NumberField value={(project.simulation?.collisionMargin ?? .012) * 1000} min={1} max={20} step={0.5} suffix="mm" onChange={(value) => updateSimulation('collisionMargin', clamp(value, 1, 20) / 1000)} /></div>
                <p className="panel-copy">Browser PBD starts with a 12 mm avatar collision cushion, distinct from PPF's 1 mm contact gap. Smaller values may cause more body penetration; contact diagnostics must be checked after changing this.</p>
                <div className="control-row split-control"><span>Self-collision gap</span><NumberField value={(project.simulation.selfCollisionMargin ?? 0.002) * 1000} min={0} max={12} step={0.5} suffix="mm" onChange={(value) => updateSimulation('selfCollisionMargin', clamp(value, 0, 12) / 1000)} /></div>
                <SliderRow label="Solver stiffness" value={project.simulation.stiffness} min={0.5} max={0.995} step={0.005} display={project.simulation.stiffness.toFixed(3)} onChange={(value) => updateSimulation('stiffness', value)} />
                <SliderRow label="Seam stiffness" value={project.simulation.seamStiffness} min={0.5} max={0.999} step={0.005} display={project.simulation.seamStiffness.toFixed(3)} onChange={(value) => updateSimulation('seamStiffness', value)} />
                <SliderRow label="Solver substeps" value={project.simulation.substeps ?? 1} min={1} max={4} step={1} display={`${project.simulation.substeps ?? 1}×`} onChange={(value) => updateSimulation('substeps', Math.round(value))} />
                <SliderRow label="Iterations" value={project.simulation.iterations} min={2} max={14} step={1} display={project.simulation.iterations} onChange={(value) => updateSimulation('iterations', value)} />
                <SliderRow label="Gravity" value={project.simulation.gravity} min={0} max={18} step={0.1} display={`${project.simulation.gravity.toFixed(1)} m/s²`} onChange={(value) => updateSimulation('gravity', value)} />
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Wind / motion test</span><strong>{project.simulation.wind?.enabled ? 'LIVE' : 'OFF'}</strong></div>
                <button className={`toggle-row ${project.simulation.wind?.enabled ? 'active' : ''}`} onClick={() => updateWind('enabled', !project.simulation.wind?.enabled)}><span><Activity size={15} />Aerodynamic wind</span><i /></button>
                <SliderRow label="Wind speed" value={project.simulation.wind?.speed ?? 4} min={0} max={20} step={0.25} display={`${(project.simulation.wind?.speed ?? 4).toFixed(1)} m/s`} onChange={(value) => updateWind('speed', value)} />
                <SliderRow label="Direction" value={project.simulation.wind?.directionDeg ?? 0} min={-180} max={180} step={1} display={`${Math.round(project.simulation.wind?.directionDeg ?? 0)}°`} onChange={(value) => updateWind('directionDeg', value)} />
                <SliderRow label="Turbulence" value={project.simulation.wind?.turbulence ?? 0.18} min={0} max={1} step={0.01} display={`${Math.round((project.simulation.wind?.turbulence ?? 0.18) * 100)}%`} onChange={(value) => updateWind('turbulence', value)} />
                <SliderRow label="Cloth response" value={project.simulation.wind?.response ?? 0.025} min={0.005} max={0.08} step={0.005} display={(project.simulation.wind?.response ?? 0.025).toFixed(3)} onChange={(value) => updateWind('response', value)} />
                <p className="panel-copy">Wind response is calculated from the live triangle normals and fabric mass per square meter, so lightweight cloth reacts more strongly than heavy denim or fleece.</p>
              </div>
            </>
          )}

          {activeSection === 'Production' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Size grading</span><strong>BASE {project.grading?.baseSize || 'M'}</strong></div>
                <div className="grade-size-row">
                  {(project.grading?.sizes || []).map((size) => (
                    <button key={size} className={gradePreviewSize === size ? 'active' : ''} onClick={() => setGradePreviewSize(size)}>{size}</button>
                  ))}
                </div>
                <p className="panel-copy">Grade preview is non-destructive. The base pattern stays unchanged while the 2D and 3D workspaces show the selected production size.</p>
                <div className="control-row split-control"><span>Width / size</span><NumberField value={project.grading?.widthPerSizeCm ?? 3} min={0} max={12} step={0.1} suffix="cm" onChange={(value) => updateGrading('widthPerSizeCm', clamp(value, 0, 12))} /></div>
                <div className="control-row split-control"><span>Length / size</span><NumberField value={project.grading?.lengthPerSizeCm ?? 1.2} min={0} max={8} step={0.1} suffix="cm" onChange={(value) => updateGrading('lengthPerSizeCm', clamp(value, 0, 8))} /></div>
                <button className={`toggle-row ${showGradeNest ? 'active' : ''}`} onClick={() => setShowGradeNest((value) => !value)}><span><Eye size={15} />Grade nest · XS–XXL</span><i /></button>
              </div>
              {selectedPiece && (
                <div className="panel-section">
                  <div className="panel-title"><span>Grade points · {selectedPiece.name}</span><strong>{selectedPiece.points.filter((point) => point.gradeRule?.enabled).length} CUSTOM</strong></div>
                  <p className="panel-copy">AUTO points follow the garment-wide width/length rule. CUSTOM points move by their own X/Y centimeters for each size step away from the base size.</p>
                  <div className="grade-point-table">
                    <div className="grade-point-header"><span>Point</span><span>X / size</span><span>Y / size</span><span>Rule</span></div>
                    {selectedPiece.points.map((point, pointIndex) => {
                      const automatic = automaticGradeDelta(selectedPiece, point)
                      const custom = point.gradeRule?.enabled
                      return (
                        <div className={`grade-point-row ${custom ? 'custom' : ''}`} key={`${selectedPiece.id}-grade-${pointIndex}`}>
                          <span>P{String(pointIndex + 1).padStart(2, '0')}</span>
                          {custom
                            ? <NumberField value={point.gradeRule.dxPerSize ?? 0} min={-12} max={12} step={0.1} suffix="cm" onChange={(value) => updatePointGradeRule(selectedPiece.id, pointIndex, 'dxPerSize', clamp(value, -12, 12))} />
                            : <em>{automatic.dxPerSize >= 0 ? '+' : ''}{automatic.dxPerSize.toFixed(2)}</em>}
                          {custom
                            ? <NumberField value={point.gradeRule.dyPerSize ?? 0} min={-12} max={12} step={0.1} suffix="cm" onChange={(value) => updatePointGradeRule(selectedPiece.id, pointIndex, 'dyPerSize', clamp(value, -12, 12))} />
                            : <em>{automatic.dyPerSize >= 0 ? '+' : ''}{automatic.dyPerSize.toFixed(2)}</em>}
                          <button className={custom ? 'active' : ''} onClick={() => setPointGradeRuleEnabled(selectedPiece.id, pointIndex, !custom)}>{custom ? 'CUSTOM' : 'AUTO'}</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="panel-section">
                <div className="panel-title"><span>Automatic marker · {gradePreviewSize}</span><strong>{marker.unusedPieces ? 'INCOMPLETE' : `${Math.round(marker.efficiency * 100)}% EFF.`}</strong></div>
                {markerFabricIds.length > 1 && (
                  <div className="marker-fabric-tabs">
                    {markerFabricIds.map((fabricId) => (
                      <button key={fabricId} className={`${marker.fabricId === fabricId ? 'active' : ''} ${fabricMarkers[fabricId].unusedPieces ? 'incomplete' : ''}`} onClick={() => setMarkerFabricId(fabricId)}>
                        <span>{project.fabrics?.[fabricId]?.name || fabricId}</span>
                        <em>{fabricMarkers[fabricId].unusedPieces ? `${fabricMarkers[fabricId].unusedPieces} MISS` : `${fabricMarkers[fabricId].length.toFixed(1)} cm`}</em>
                      </button>
                    ))}
                  </div>
                )}
                <div className="control-row split-control"><span>{markerFabricIds.length > 1 ? 'Selected fabric width' : 'Fabric width'}</span><NumberField value={marker.width ?? project.markerSettings?.fabricWidthCm ?? 150} min={30} max={300} step={0.5} suffix="cm" onChange={(value) => updateMarkerFabricWidth(marker.fabricId || markerFabricId || 'main', clamp(value, 30, 300))} /></div>
                <div className="control-row split-control"><span>Piece spacing</span><NumberField value={project.markerSettings?.gapCm ?? 1.5} min={0} max={10} step={0.1} suffix="cm" onChange={(value) => updateMarkerSetting('gapCm', clamp(value, 0, 10))} /></div>
                <label className="select-field"><span>Supplier price per fabric meter · {productionCosts.currency}</span><input type="number" min="0" step="0.01" placeholder="Price not set" aria-label="Supplier price per fabric meter" value={project.fabrics?.[marker.fabricId || markerFabricId]?.pricePerMeter ?? ''} onChange={(event) => updateMarkerFabricPrice(marker.fabricId || markerFabricId || 'main', event.target.value)} /></label>
                <MarkerPreview marker={marker} />
                <div className="production-number"><strong>{estimatedLength.toFixed(2)}</strong><span>m {marker.unusedPieces ? 'PLACED ONLY · ' : ''}{project.fabrics?.[marker.fabricId]?.name || marker.fabricId || 'FABRIC'} / {marker.width.toFixed(0)} cm width</span></div>
                <div className="field-grid two">
                  <label><span>Selected fabric area</span><strong>{(productionFabricArea / 10000).toFixed(3)} m²</strong></label>
                  <label><span>Marker efficiency</span><strong>{Math.round(marker.efficiency * 100)}%</strong></label>
                </div>
                {markerFabricIds.length > 1 && (
                  <div className="marker-material-summary">
                    {markerFabricIds.map((fabricId) => {
                      const item = fabricMarkers[fabricId]
                      return <div key={`${fabricId}-marker-summary`}><span>{project.fabrics?.[fabricId]?.name || fabricId}</span><strong>{(item.length / 100).toFixed(2)} m</strong><em>{item.unusedPieces ? `${item.unusedPieces} MISS` : `${Math.round(item.efficiency * 100)}%`}</em></div>
                    })}
                  </div>
                )}
                <div className="field-grid two">
                  <label><span>Estimated material cost · {gradePreviewSize}</span><strong>{productionCosts.totals.find((item) => item.size === gradePreviewSize)?.ready ? `${productionCosts.currency} ${productionCosts.totals.find((item) => item.size === gradePreviewSize).materialCost.toFixed(2)}` : 'INCOMPLETE'}</strong></label>
                  <label><span>Costing basis</span><strong>FABRIC ONLY</strong></label>
                </div>
                <p className="panel-copy">Costs reflect one garment's marker consumption; missing supplier prices or cut pieces prevent a total. Labor, trims, freight, shrinkage and taxes are excluded.</p>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>POM spec · {gradePreviewSize}</span><strong>{productionMeasurements.length} POM</strong></div>
                <div className="pom-table">
                  {productionMeasurements.map((measurement) => (
                    <div className="pom-row" key={measurement.id}>
                      <span>{measurement.label}</span>
                      <strong>{measurement.cm.toFixed(1)} cm</strong>
                      <em>±{measurement.toleranceCm.toFixed(1)}</em>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Production data</span><strong>LIVE</strong></div>
                <div className="production-list"><span><i />Pattern geometry</span><span><i />Seam graph</span><span><i />Fabric physicals</span><span><i />Avatar measurements</span><span><i />XS–XXL graded size run</span><span><i />Grain-safe configurable marker</span><span><i />POM measurement size run</span><span><i />DXF cut + allowance + notches</span><span><i />DXF grainlines + piece labels</span><span><i />GarmentCode / PyGarment JSON</span><span><i />3D OBJ garment mesh</span><span><i />Binary GLB / glTF garment</span><span><i />Structured tech-pack data</span></div>
                <button className={`toggle-row ${exportSelectedPatternOnly ? 'active' : ''}`} onClick={() => setExportSelectedPatternOnly((value) => !value)}><span><Scissors size={15} />DXF export selected pattern only{exportSelectedPatternOnly ? ` · ${selectedPiece?.name || 'Select pattern'}` : ''}</span><i /></button>
                <p className="panel-copy">Standard DXF uses millimeters and separate cut, seam allowance, notch, grain, and annotation layers. Industrial AAMA/ASTM imports still require validation in the target CAD system.</p>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Manufacturing preflight · all sizes</span><strong>{productionPreflight.status.replaceAll('_', ' ')}</strong></div>
                <p className="panel-copy">{productionPreflight.blockers} blocking issue(s) · {productionPreflight.warnings} construction warning(s). These are document checks, not factory certification or a physical sample approval.</p>
                {productionPreflight.issues.length > 0 && <div className="marker-overflow-warning">{productionPreflight.issues.slice(0, 8).map((issue, index) => <span key={`${issue.code}-${issue.scope}-${index}`}><strong>{issue.severity.toUpperCase()} · {issue.scope}</strong> — {issue.message}</span>)}{productionPreflight.issues.length > 8 && <span>+{productionPreflight.issues.length - 8} additional issues. Export the factory ZIP for the complete report.</span>}</div>}
                {!productionPreflight.issues.length && <p className="panel-copy">Structural and marker checks passed for the size run. Factory system import, print scaling, fit and sample approval remain to be verified.</p>}
              </div>
              <button className="wide-action" onClick={exportDxf}><FileDown size={15} />EXPORT DXF · {gradePreviewSize}</button>
              <button className="wide-action" onClick={() => exportMarker('pdf')}><FileDown size={15} />EXPORT TRUE-SCALE MARKER PDF · {gradePreviewSize}</button>
              <button className="wide-action" onClick={() => exportMarker('svg')}><FileDown size={15} />EXPORT TRUE-SCALE MARKER SVG · {gradePreviewSize}</button>
              <button className="wide-action" onClick={exportBomXml}><FileDown size={15} />EXPORT BOM · XML</button>
              <button className="wide-action" onClick={requestObjExport}><Box size={15} />EXPORT 3D OBJ · {gradePreviewSize}</button>
              <button className="wide-action" onClick={requestGlbExport}><Box size={15} />EXPORT GLB · {gradePreviewSize}</button>
              <button className="wide-action" onClick={exportMeasurements}><FileDown size={15} />EXPORT POM CSV</button>
              <button className="wide-action" onClick={exportGarmentCode}><FileDown size={15} />EXPORT GARMENTCODE JSON</button>
              <button className="wide-action" onClick={exportFactoryPackage}><FileDown size={15} />EXPORT FACTORY PACKAGE · ZIP</button>
              <button className="wide-action" onClick={exportTechPack}><FileDown size={15} />EXPORT TECH PACK</button>
              <button className="wide-action" onClick={exportSizeRun}><FileDown size={15} />EXPORT XS–XXL SIZE RUN</button>
              <button className="wide-action" onClick={exportProject}><FileDown size={15} />EXPORT GARMENT DOCUMENT</button>
              <div className="panel-section">
                <div className="panel-title"><span>ClothCraft · personal Rust integration</span><strong>EXPERIMENTAL</strong></div>
                <p className="panel-copy">Send this EXO project to your local ClothCraft Rust toolchain. Pattern, named seams, curves and basic fabrics are transferred. Factory data and physical fit are not certified. Start the separate localhost service with npm run clothcraft:serve.</p>
              </div>
              <button className="wide-action" disabled={clothCraftBusy} onClick={() => sendToClothCraft(false)}><FileDown size={15} />{clothCraftBusy ? 'CLOTHCRAFT RUNNING…' : 'VALIDATE IN CLOTHCRAFT RUST'}</button>
              <button className="wide-action" disabled={clothCraftBusy} onClick={() => sendToClothCraft(true)}><Box size={15} />BAKE CLOTHCRAFT OBJ + TEMPLATE</button>
              <button className="wide-action" disabled={clothCraftBusy} onClick={() => { setActiveSection('Fit'); void runClothCraftOgc() }}><Cpu size={15} />RUN CLOTHCRAFT VBD + OGC CONTACT · FIT</button>
            </>
          )}

          {activeSection === 'Render' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Viewport</span><Eye size={15} /></div>
                <button className={`toggle-row ${wireframe ? 'active' : ''}`} onClick={() => setWireframe((value) => !value)}><span><Box size={15} />Wireframe topology</span><i /></button>
                <p className="panel-copy">The viewport is rendered directly from the same particle positions used by the cloth solver. Editing the 2D pattern rebuilds the 3D mesh.</p>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Environment lighting</span><strong>{hdriName ? 'HDRI' : 'PMREM'}</strong></div>
                <label className="select-field"><span>Lighting preset</span><select value={project.render?.environmentPreset || 'studio'} onChange={(event) => updateRenderSetting('environmentPreset', event.target.value)}><option value="studio">Studio</option><option value="softbox">Softbox</option><option value="dramatic">Dramatic</option><option value="neutral">Neutral</option></select></label>
                <SliderRow label="Exposure" value={project.render?.exposure ?? 1.1} min={0.2} max={3} step={0.05} display={`${(project.render?.exposure ?? 1.1).toFixed(2)}×`} onChange={(value) => updateRenderSetting('exposure', value)} />
                <button className={`toggle-row ${project.render?.showEnvironment ? 'active' : ''}`} onClick={() => updateRenderSetting('showEnvironment', !project.render?.showEnvironment)}><span><Eye size={15} />Show environment background</span><i /></button>
                {hdriName ? (
                  <div className="fabric-texture-card">
                    <div><strong>{hdriName}</strong><small>Radiance HDR · PMREM filtered</small></div>
                    <button onClick={clearHdri}><Trash2 size={12} /></button>
                  </div>
                ) : <p className="panel-copy">The built-in PMREM studio environment lights PBR fabrics without an external file. Load a Radiance .HDR to use your own environment.</p>}
                <button className="wide-action" onClick={() => hdriInputRef.current?.click()}><Upload size={14} />{hdriName ? 'REPLACE HDRI' : 'LOAD HDRI ENVIRONMENT'}</button>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Final still</span><strong>PNG</strong></div>
                <label className="select-field"><span>Output preset</span><select value={`${project.render?.widthPx ?? 2048}x${project.render?.heightPx ?? 2560}`} onChange={(event) => {
                  const [width, height] = event.target.value.split('x').map(Number)
                  updateRenderResolution(width, height)
                }}><option value="1080x1350">1080 × 1350 · 4:5</option><option value="2048x2560">2048 × 2560 · 4:5</option><option value="4096x5120">4096 × 5120 · 4:5</option><option value="2048x2048">2048 × 2048 · Square</option></select></label>
                <div className="field-grid two">
                  <div><span>Width</span><NumberField value={project.render?.widthPx ?? 2048} min={512} max={6144} step={64} suffix="px" onChange={(value) => updateRenderSetting('widthPx', Math.round(clamp(value, 512, 6144)))} /></div>
                  <div><span>Height</span><NumberField value={project.render?.heightPx ?? 2560} min={512} max={6144} step={64} suffix="px" onChange={(value) => updateRenderSetting('heightPx', Math.round(clamp(value, 512, 6144)))} /></div>
                </div>
                <p className="panel-copy">Uses the current orbit camera, settled cloth state, PBR fabrics, trims, environment lighting, ACES tone mapping, and soft shadows. The live viewport size is restored immediately after capture.</p>
                <button className="wide-action" onClick={requestRenderStill}><Download size={14} />RENDER PNG STILL</button>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Renderer capabilities</span><strong>LIVE</strong></div>
                <div className="production-list"><span><i />PBR fabric surface</span><span><i />PMREM environment lighting</span><span><i />Custom HDRI environments</span><span><i />Studio lighting presets</span><span><i />Soft shadows</span><span><i />High-resolution PNG stills</span><span className="future"><i />Path-traced final · next</span></div>
              </div>
            </>
          )}

          <div className="inspector-footer">
            <Cpu size={14} /><span>{commandResult}</span>
          </div>
          </CloPropertyEditorAccordion>
          </div>
          </div>
        </aside>
      </main>

      <footer className="simulation-bar">
        <div className="sim-left">
          <button className={`sim-play ${visibleRunning ? 'active' : ''}`} onClick={simForVisibleEngine}>{visibleRunning ? <Pause size={16} /> : <Play size={16} />}{visibleRunning ? 'PAUSE' : 'SIMULATE'}</button>
          <button className="sim-reset" onClick={resetForVisibleEngine}><RotateCcw size={15} />RESET</button>
          <span className="sim-copy">{clothcraftHybrid ? 'CLOTHCRAFT RUST VBD + OGC · NOT CERTIFIED FIT' : !hasSimulated ? 'ARRANGE → SEW → SIMULATE' : running ? 'Draping on avatar…' : 'Paused · Press SIMULATE to resume'}</span>
        </div>
        <div className="sim-stats"><span><Activity size={13} />{clothcraftHybrid ? (clothcraftLive?.vertices ?? 0).toLocaleString() : stats.vertices.toLocaleString()} vertices</span><span>{clothcraftHybrid ? 'RUST SIMULATION' : `${stats.constraints.toLocaleString()} constraints`}</span><span>{clothcraftHybrid ? (clothcraftLive?.seams ?? 0).toLocaleString() : stats.seams.toLocaleString()} seam links</span><span>{clothcraftHybrid ? `${(clothcraftLive?.time ?? 0).toFixed(2)} s` : `${stats.anchors.toLocaleString()} fit tacks`}</span></div>
        <div className="engine-badge"><i className={visibleRunning ? 'active' : ''} /><span>{clothcraftHybrid ? 'RUST VBD + OGC' : 'XPBD CLOTH'}</span><strong>{clothcraftHybrid ? 'GPU VBD / CPU CONTACT' : 'GPU UI / CPU SOLVER'}</strong></div>
      </footer>
      <WorkspaceCommandPalette open={commandPaletteOpen} commands={STUDIO_COMMANDS} onExecute={executeStudioAction} onClose={() => setCommandPaletteOpen(false)} />
      {clothCraftMeshPreview && (
        <ClothCraftPreview obj={clothCraftMeshPreview.obj} garmentName={clothCraftMeshPreview.garmentName}
          avatarObj={clothCraftMeshPreview.avatarObj} diagnostics={clothCraftMeshPreview.diagnostics}
          onClose={() => setClothCraftMeshPreview(null)} />
      )}
    </div>
  )
}
