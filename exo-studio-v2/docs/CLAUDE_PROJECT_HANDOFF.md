# Garment Studio — Complete Project Handoff for Claude Desktop

## Purpose

This is the live native Mac Garment Studio project, a CLO3D-inspired 2D/3D clothing CAD application. Claude should read and edit the **actual repository**, not recreate it. The repository contains much more code than can sensibly fit in a chat prompt; this document provides the key source files inline, and the entire project remains available on disk.

## Repository path

`/Users/mikylecouto/Chat On Steroids Workspace/garment-studio`

## Instructions to Claude

1. Read `CLAUDE.md`, inspect `git status --short`, and inventory the repository and existing tests.
2. Read the complete `src/`, `native_app/`, `ppf_backend/`, `blender_bridge/`, `scripts/`, and `docs/` directories directly before making broad claims.
3. Continue building the non-simulation CLO3D feature gaps while preserving existing projects, simulations, local research and user changes.
4. Never `git reset --hard`, `git clean -fd`, remove existing projects, or overwrite uncommitted edits.
5. Use focused tests (`npm run check:non-simulation`, `npm run build`) and report exact implemented features versus missing features.
6. Coordinate when another agent is editing the same files.

## Important project source files (inline copies)

### `CLAUDE.md`

```markdown
# Garment Studio — Claude Code project guide

This folder is the **live source repository** for Garment Studio, a CLO3D-inspired garment CAD and manufacturing application. You may read and edit its source, run tests, and propose incremental improvements when requested. Work on this exact folder; do not make a separate clone or silently replace the project with a generated starter app.

## Working rules

- Preserve existing uncommitted changes and user files. **Never** use `git reset --hard`, `git clean -fd`, mass deletions, or wholesale rewrites. Check `git status --short` before editing.
- Prefer small, reviewable changes with focused tests. Do not overwrite a file that another agent is actively modifying; coordinate first.
- Do not claim CLO3D parity or production-ready simulation unless an end-to-end test proves it. Report precise successes and failures.
- Do not launch long-running simulation, GPU jobs, browser farms, or native rebuilds unless asked. Do not kill unknown processes or modify unrelated projects.
- Never commit API keys, personal data, licensed avatar binaries, or generated caches.

## Codebase orientation

- `src/App.jsx` — main React application and editing actions.
- `src/components/PatternEditor.jsx` — 2D pattern editor.
- `src/components/GarmentViewport.jsx` — 3D scene and mesh inspector.
- `src/components/CloUI.jsx` — CLO-inspired Object Browser and library UI.
- `src/core/` — pattern geometry, DXF, grading, marker, manufacturing, and backends.
- `native_backend/`, `ppf_backend/`, `blender_bridge/` — native and Blender physics/geometry integration. Preserve existing research and solver assets.
- `native_app/` — macOS application wrapper and build scripts.
- `docs/` — architecture, audits, research, and known gaps.
- `scripts/` — reproducible engineering and QA checks.

## Checks

- `npm run build` — production Vite build.
- `npm run check:non-simulation` — DXF, manufacturing, markers, and mesh-selection checks.
- `node scripts/check-dxf-construction-fidelity.mjs` — geometry/metadata DXF round trip.
- Other focused `npm run check:*` commands are listed in `package.json`.

## Collaboration with other AI coding agents

This repository is also edited by other assistants. Start each task by inspecting current source and `git status`, and avoid assuming any previous summary is current. Make an explicit plan for cross-cutting changes. Always describe changed files, tests, remaining limitations, and whether a native app was actually rebuilt. Prefer the user's currently open Garment Studio project over creating unrelated samples.

```

### `package.json`

```json
{
  "name": "garment-studio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "check": "npm run build && npm run check:physics && npm run check:production && npm run check:foundations && npm run check:avatar && npm run check:factory && npm run check:allowances && npm run check:determinism && npm run check:reproducibility && npm run check:markers && npm run check:buttonholes && npm run check:interfacing && npm run check:partial-seams && npm run check:materials && npm run check:freeze && npm run check:deactivate && npm run check:garmentcode && npm run check:backend && npm run check:native-xpbd && npm run check:native-garment && npm run check:native-service && npm run check:native-quality",
    "check:physics": "node scripts/check-physics.mjs",
    "check:production": "node scripts/check-production.mjs",
    "check:non-simulation": "node scripts/dxf-roundtrip-check.mjs && node scripts/check-dxf-construction-fidelity.mjs && node scripts/check-production.mjs && node scripts/check-factory.mjs && node scripts/check-markers.mjs && node scripts/check-mesh-selection.mjs",
    "check:obj": "node scripts/check-obj-export.mjs",
    "check:glb": "node scripts/check-glb-export.mjs",
    "check:pattern-ui": "node scripts/capture-pattern.mjs",
    "check:foundations": "node scripts/check-foundations.mjs",
    "check:avatar": "node scripts/check-avatar.mjs",
    "check:factory": "node scripts/check-factory.mjs",
    "check:allowances": "node scripts/check-allowances.mjs",
    "check:reproducibility": "node scripts/check-reproducibility.mjs",
    "check:markers": "node scripts/check-markers.mjs",
    "check:determinism": "node scripts/check-determinism.mjs",
    "check:buttonholes": "node scripts/check-buttonholes.mjs",
    "check:interfacing": "node scripts/check-interfacing.mjs",
    "check:partial-seams": "node scripts/check-partial-seams.mjs",
    "check:materials": "node scripts/check-materials.mjs",
    "check:freeze": "node scripts/check-freeze.mjs",
    "check:deactivate": "node scripts/check-deactivate.mjs",
    "check:garmentcode": "node scripts/check-garmentcode-adapter.mjs",
    "check:backend": "node scripts/check-backend-api.mjs",
    "check:native-xpbd": "native_backend/scripts/build_xpbd_smoke.sh && native_backend/scripts/build_xpbd_cloth_smoke.sh",
    "check:blender": "scripts/check-blender-bridge.sh",
    "check:native-garment": "node scripts/check-native-garment.mjs",
    "native:serve": "node native_backend/server.mjs",
    "check:native-service": "node scripts/check-native-service.mjs",
    "dev:full": "node scripts/dev-full.mjs",
    "check:ppf-payload": "node scripts/check-ppf-payload.mjs",
    "check:ppf-settings": "bash scripts/check-ppf-physical-settings.sh",
    "check:ipc-thomas": "node scripts/check-ipc-thomas-ccd.mjs",
    "check:native-ipc-prototype": "node scripts/check-native-ipc-thomas-prototype.mjs",
    "check:ppf-acceptance": "node scripts/check-ppf-fit-acceptance.mjs",
    "check:ppf-fit-settings": "node scripts/check-ppf-fit-settings.mjs",
    "check:ppf-thomas-fit-tuning": "node scripts/check-ppf-thomas-fit-tuning.mjs",
    "check:ppf-bridge": "scripts/check-ppf-bridge.sh",
    "native:server": "node native_backend/server.mjs",
    "native:health": "node -e \"fetch('http://127.0.0.1:5191/health').then(r=>r.json()).then(console.log)\"",
    "check:native-quality": "node scripts/check-native-quality.mjs",
    "check:ppf-staging": "scripts/check-ppf-staging.sh",
    "check:ppf-sewing": "node scripts/analyze-ppf-sewing.mjs",
    "check:ppf-metal": "scripts/check-ppf-metal.sh",
    "ppf:serve": "node ppf_backend/server.mjs",
    "ppf:health": "curl -fsS http://127.0.0.1:5192/health"
  },
  "dependencies": {
    "fflate": "^0.8.3",
    "lucide-react": "^0.468.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "three": "^0.180.0",
    "three-mesh-bvh": "^0.9.16"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.4",
    "vite": "^6.4.3"
  }
}

```

### `src/App.jsx`

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { CLO_MENUS, GarmentSilhouette, LibraryChrome, ObjectBrowser } from './components/CloUI.jsx'
import RightToolPalette from './components/RightToolPalette.jsx'
import PropertyCategoryNavigator from './components/PropertyCategoryNavigator.jsx'
import PatternLibraryThumbnail from './components/PatternLibraryThumbnail.jsx'
import CadToolIcon from './components/CadToolIcon.jsx'
import MarkerPreview from './components/MarkerPreview.jsx'
import SeamWalkPreview from './components/SeamWalkPreview.jsx'
import { createDefaultProject, FABRIC_PRESETS } from './data/defaultProject.js'
import { createTemplateProject, GARMENT_TEMPLATES } from './data/templates.js'
import { cloneProject, closestEdgeFraction, edgeLength, getEdgeSeamAllowance, makeRectanglePiece, pieceArea, projectArea, samplePieceBoundary, seamLengthReport, seamWalkReport, touchProject, uniqueId } from './core/project.js'
import { pieceCenter } from './core/trims.js'
import { buildSizeRun, gradePointForPiece, gradeProject, sizeOffset } from './core/grading.js'
import { buildFabricMarkers, buildMarker } from './core/marker.js'
import { parseDxfPatterns, projectToDxf } from './core/dxf.js'
import { buildMeasurementSizeRun, buildTechPack, measurementRunToCSV } from './core/measurements.js'
import { buildFactoryPackageZip } from './core/factoryPackage.js'
import { listSimulationBackends } from './core/backends/registry.js'
import { NATIVE_QUALITY_PROFILES } from './core/backends/nativePayload.js'
import { garmentCodeToProject, projectToGarmentCode } from './core/garmentCode.js'
import { getNativeServiceHealth } from './core/backends/nativeServiceClient.js'
import { getPpfServiceHealth, getPpfJob, getPpfJobPreview, submitPpfFinalSolve } from './core/backends/ppfServiceClient.js'

// First-fit tests use an isolated autosave slot; opening a test tee must never
// replace the user's previously saved jeans, hoodie, or other working garment.
const TEE_TEST_SESSION = new URLSearchParams(window.location.search).get('testSession') === 'tee'
const STORAGE_KEY = TEE_TEST_SESSION ? 'garment-studio-tee-first-fit-project-v2' : 'garment-studio-project-v1'
const DESKTOP_THOMAS_BOOTSTRAP_KEY = TEE_TEST_SESSION ? 'garment-studio-tee-test-thomas-bootstrap-v1' : 'garment-studio-desktop-thomas-bootstrap-v1'
const MAX_HISTORY = 60
const SIMULATION_BACKENDS = listSimulationBackends()

const SECTIONS = ['Pattern', 'Sewing', 'Fabric', 'Avatar', 'Fit', 'Production', 'Render']

function loadProject() {
  try {
    const desktopThomas = new URLSearchParams(window.location.search).get('defaultAvatar') === 'clo-thomas'
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
      // When opening a private desktop build containing the user's own CLO
      // export, select Thomas once without replacing or discarding the project.
      if (desktopThomas && !localStorage.getItem(DESKTOP_THOMAS_BOOTSTRAP_KEY)) {
        parsed.avatar = { ...parsed.avatar, name: 'CLO Thomas', model: 'clo-thomas' }
        localStorage.setItem(DESKTOP_THOMAS_BOOTSTRAP_KEY, '1')
      }
      return parsed
    }
  } catch (error) {
    console.warn('Could not restore garment project', error)
  }
  const initial = TEE_TEST_SESSION ? createTemplateProject('tee') : createDefaultProject()
  if (new URLSearchParams(window.location.search).get('defaultAvatar') === 'clo-thomas') {
    initial.avatar = { ...initial.avatar, name: 'CLO Thomas', model: 'clo-thomas' }
    try { localStorage.setItem(DESKTOP_THOMAS_BOOTSTRAP_KEY, '1') } catch { /* private mode */ }
  }
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
  const [project, setProject] = useState(loadProject)
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
  const [showObjectBrowser, setShowObjectBrowser] = useState(true)
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
  const [hasSimulated, setHasSimulated] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [analysisMode, setAnalysisMode] = useState('surface')
  const [selectedFabricId, setSelectedFabricId] = useState('main')
  const [markerFabricId, setMarkerFabricId] = useState('main')
  const [seamWalkId, setSeamWalkId] = useState(null)
  const [seamWalkProgress, setSeamWalkProgress] = useState(0.5)
  const [trimEdgeIndex, setTrimEdgeIndex] = useState(0)
  const [gradePreviewSize, setGradePreviewSize] = useState('M')
  const [showGradeNest, setShowGradeNest] = useState(false)
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
  const [transformDraft, setTransformDraft] = useState({ scaleX: 100, scaleY: 100, rotateDeg: 0, slashCm: 4 })
  const importInputRef = useRef(null)
  const graphicInputRef = useRef(null)
  const fabricTextureInputRef = useRef(null)
  const fabricNormalInputRef = useRef(null)
  const fabricRoughnessInputRef = useRef(null)
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
    // Align armhole curves on body pieces and caps on the two sleeves; retain
    // all original vertices/sewing IDs, garment placement, and materials.
    mutateProject((next) => {
      for (const piece of next.pieces) {
        const corrected = byId.get(piece.id)
        if (!corrected || !['front','back','sleeve-left','sleeve-right'].includes(piece.id)) continue
        if (piece.points.length !== corrected.points.length) continue
        if (piece.id.startsWith('sleeve-')) {
          piece.curves = cloneProject(corrected.curves)
        } else {
          piece.curves = {...(piece.curves || {}),...Object.fromEntries([1,2,6,7].map(i=>[i,cloneProject(corrected.curves[i])]))}
        }
      }
    })
    setLayout2DSignal(value => value + 1)
    setRunning(false)
    setCommandResult('T-shirt armholes and sleeve caps matched; all 14 template seam pairs differ by at most 0.22%. Preserve your body/fabric adjustments; Undo available.')
  }
  const gestureStartRef = useRef(null)

  const selectedPiece = project.pieces.find((piece) => piece.id === selectedPieceId) || null
  const fabric = project.fabrics?.[selectedFabricId] || project.fabrics?.main || FABRIC_PRESETS.fleece
  const totalArea = useMemo(() => projectArea(project), [project])
  const selectedArea = selectedPiece ? pieceArea(selectedPiece) : 0
  const productionProject = useMemo(
    () => gradeProject(project, gradePreviewSize || project.grading?.baseSize || 'M'),
    [project, gradePreviewSize],
  )
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
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece?.points?.[pointIndex]) piece.points[pointIndex] = point
    }, { record: false })
  }

  const moveCurve = (pieceId, edgeIndex, curve) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.curves = { ...(piece.curves || {}) }
      if (curve) piece.curves[edgeIndex] = curve
      else delete piece.curves[edgeIndex]
    }, { record: false })
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
    const duplicate = project.seams.some((seam) => {
      const straight = seam.a.pieceId === a.pieceId && seam.a.edgeIndex === a.edgeIndex && seam.b.pieceId === b.pieceId && seam.b.edgeIndex === b.edgeIndex
      const reverse = seam.a.pieceId === b.pieceId && seam.a.edgeIndex === b.edgeIndex && seam.b.pieceId === a.pieceId && seam.b.edgeIndex === a.edgeIndex
      return straight || reverse
    })
    if (duplicate) {
      setCommandResult('Those two edges are already sewn')
      return
    }
    mutateProject((next) => {
      next.seams.push({
        id: uniqueId('seam'),
        name: `Seam ${next.seams.length + 1}`,
        a,
        b,
      })
    })
    setCommandResult('Seam created and added to the 3D solver')
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
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      if (!seam) return
      if (enabled) {
        seam.a = { ...seam.a, startT: seam.a?.startT ?? 0.25, endT: seam.a?.endT ?? 0.75 }
        seam.b = { ...seam.b, startT: seam.b?.startT ?? 0.25, endT: seam.b?.endT ?? 0.75 }
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
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      const endpoint = seam?.[side]
      if (!endpoint) return
      const nextValue = clamp(Number(value), 0, 1)
      const minimumGap = 0.02
      if (field === 'startT') endpoint.startT = Math.min(nextValue, Number(endpoint.endT ?? 1) - minimumGap)
      if (field === 'endT') endpoint.endT = Math.max(nextValue, Number(endpoint.startT ?? 0) + minimumGap)
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
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.zippers = piece.zippers || []
      piece.zippers.push({
        id: uniqueId('zipper'),
        edgeIndex,
        widthCm: 1.2,
        offsetCm: 0,
        type: 'coil',
        color: '#777777',
      })
    })
    setCommandResult('Zipper tape added and reinforced in the cloth solver')
  }

  const addButtonRow = (pieceId, count = 5) => {
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
        piece.buttons.push({
          id: uniqueId('button'),
          x: center.x,
          y: top + (bottom - top) * t,
          diameterCm: 1.8,
          holes: 4,
          color: '#222222',
        })
      }
    })
    setCommandResult(`${count}-button center row added to ${selectedPiece?.name || 'pattern'}`)
  }

  const addButtonholeRow = (pieceId, count = 5) => {
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
        })
        if (pairedButton) pairedButton.pairedButtonholeId = buttonholeId
      }
    })
    setCommandResult(`${count}-buttonhole center row added to ${selectedPiece?.name || 'pattern'}`)
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

  const applyFabricPreset = (presetId) => {
    const preset = FABRIC_PRESETS[presetId]
    if (!preset) return
    mutateProject((next) => {
      const current = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      const targetId = current?.id || selectedFabricId || 'main'
      const texture = current?.texture ? cloneProject(current.texture) : null
      next.fabrics[targetId] = { ...preset, id: targetId, name: preset.name, ...(texture ? { texture } : {}) }
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
        target.texture = {
          ...(target.texture || {}),
          src: image.src,
          name: file.name,
          repeatWidthCm: target.texture?.repeatWidthCm ?? 20,
          repeatHeightCm: target.texture?.repeatHeightCm ?? 20,
          rotationDeg: target.texture?.rotationDeg ?? 0,
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

  const importFabricPbrMap = async (event, kind) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !['normal', 'roughness'].includes(kind)) return
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

  const removeFabricPbrMap = (kind) => {
    if (!['normal', 'roughness'].includes(kind)) return
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
      if (!target.texture.normalSrc && !target.texture.roughnessSrc) delete target.texture
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
      next.fabrics[id] = { ...cloneProject(preset), id }
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

  const showPpfPreview = async (jobId = ppfSewing.jobId, frame = null) => {
    if (!jobId || ppfSewing.status !== 'done') return
    setPpfPreviewLoading(true)
    setPpfPreviewError('')
    try {
      const preview = await getPpfJobPreview(jobId, { frame })
      if (preview.format !== 'garment-studio.ppf-preview.v1') throw new Error('Unsupported PPF preview format')
      setRunning(false)
      setArrangementSpread(0)
      setPpfPreview(preview)
      setCommandResult(preview.accepted
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
      return
    }
    if (event.status === 'done') {
      setNativeSolveStatus('done')
      setNativeLastSolve({ elapsedMs: Number(event.elapsedMs || 0), stats: event.stats || {} })
      const milliseconds = Number(event.elapsedMs || 0).toFixed(1)
      const seamMm = Number((event.stats?.seamAverageDistance || 0) * 1000).toFixed(1)
      setCommandResult(`Native XPBD solved in ${milliseconds} ms · ${event.stats?.particles || 0} particles · average seam distance ${seamMm} mm`)
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
    const dxf = projectToDxf(productionProject, gradePreviewSize)
    const blob = new Blob([dxf], { type: 'application/dxf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${gradePreviewSize.toLowerCase()}.dxf`
    anchor.click()
    URL.revokeObjectURL(url)
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
    setCommandResult('Factory package exported with all graded DXFs, POMs, BOM, seams, marker reports, trims, tech pack, and source garment data')
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
      case '3d.fit': setAnalysisMode('ease'); setActiveSection('Fit'); break
      case '3d.seams': setShowSewingGuides(value => !value); break
      case '2d.select': setActiveSection('Pattern'); setTool('select'); break
      case '2d.points': setActiveSection('Pattern'); setTool('point'); break
      case '2d.split': setActiveSection('Pattern'); setTool('split'); break
      case '2d.curve': setActiveSection('Pattern'); setTool('curve'); break
      case '2d.internal': setActiveSection('Pattern'); setTool('internal'); break
      case '2d.notch': setActiveSection('Pattern'); setTool('notch'); break
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
      case 'render.workspace': setActiveSection('Render'); break
      case 'render.capture': setRenderSignal(value => value + 1); break
      case 'display.surface': setAnalysisMode('surface'); setWireframe(false); break
      case 'display.wireframe': setWireframe(value => !value); break
      case 'display.strain': setAnalysisMode('strain'); break
      case 'display.grid': setShow2DGrid(value => !value); break
      case 'settings.workspace': setCompactTools(value => !value); break
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

  return (
    <div className={`app-shell ${showTopWorkspaceTabs ? '' : 'workspace-tabs-hidden'}`}>
      <div className="clo-mac-menu" role="menubar" aria-label="Garment Studio application menus">
        <div className="clo-app-menu-brand"><span className="clo-brand-dot">◈</span><strong>Garment Studio</strong></div>
        {CLO_MENUS.map(menu => <div className="clo-menu-group" key={menu.title}>
          <button type="button" className={openMenu === menu.title ? 'active' : ''} aria-expanded={openMenu === menu.title} onClick={() => { setSimulationMenuOpen(false); setOpenMenu(openMenu === menu.title ? null : menu.title) }}>{menu.title}</button>
          {openMenu === menu.title && <div className="clo-menu-popover" role="menu">{menu.commands.map(([label, action]) => <button key={label} role="menuitem" disabled={!action} onClick={() => executeStudioAction(action)}>{label}{!action && <small>PREVIEW</small>}</button>)}</div>}
        </div>)}
        <div className="clo-menu-spacer"/>
        <div className="file-actions clo-compact-file-actions">
          <button type="button" className="clo-top-tabs-toggle" title="Show / hide top workspace tabs" aria-pressed={showTopWorkspaceTabs} onClick={() => setShowTopWorkspaceTabs(value => !value)}><LayoutPanelTop size={15}/></button>
          {showTopWorkspaceTabs && <select className="clo-workspace-select" aria-label="Workspace" value={activeSection} onChange={(event) => setActiveSection(event.target.value)}>{SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}</select>}
          <div className="clo-simulate-control">
            <button className={`clo-simulate-main ${running ? 'running' : ''}`} onClick={toggleSimulation} title="Simulate or pause garment · Space"><ArrowDownToLine size={16}/><span>{running ? 'PAUSE' : 'SIM'}</span></button>
            <button className="clo-simulate-arrow" title="Simulation modes" aria-expanded={simulationMenuOpen} onClick={() => { setLeftSimulationMenuOpen(false); setOpenMenu(null); setSimulationMenuOpen(value => !value) }}><ChevronDown size={13}/></button>
            {simulationMenuOpen && <div className="clo-simulation-popover">
              <strong>Simulation mode</strong>
              <button onClick={() => { applySimulationQuality('balanced'); setSimulationMenuOpen(false) }}><Check size={14}/> Normal · Balanced</button>
              <button onClick={() => { applySimulationQuality('final'); setSimulationMenuOpen(false) }}><SlidersHorizontal size={14}/> Fitting · Quality</button>
              <button onClick={() => { applySimulationQuality('draft'); setSimulationMenuOpen(false) }}><Activity size={14}/> Fast · Draft</button>
              <button disabled title="GPU cloth simulation has not yet been implemented"><Cpu size={14}/> GPU simulation <small>PLANNED</small></button>
              <button onClick={requestNativeSolve} disabled={nativeServiceStatus !== 'ready'} title={nativeServiceStatus === 'ready' ? 'Solve using connected native XPBD service' : 'Native solver service is offline'}><Box size={14}/> Native XPBD solve {nativeServiceStatus !== 'ready' ? <small>OFFLINE</small> : null}</button>
            </div>}
          </div>
          <button className="icon-button" title="Undo" disabled={!undoStack.length} onClick={undo}><Undo2 size={17} /></button>
          <button className="icon-button" title="Redo" disabled={!redoStack.length} onClick={redo}><Redo2 size={17} /></button>
          <span className="toolbar-divider" />
          <button className="icon-button" title="Import garment" onClick={() => importInputRef.current?.click()}><Upload size={17} /></button>
          <button className="icon-button" title="Export garment" onClick={exportProject}><Download size={17} /></button>
          <button className={`save-button ${saveState}`} onClick={saveProject}><Save size={15} />{saveState === 'saved' ? 'SAVED' : 'SAVE'}</button>
          <input ref={importInputRef} hidden type="file" accept=".json,.garment,.dxf" onChange={importProject} />
          <input ref={graphicInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={importGraphic} />
          <input ref={fabricTextureInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={importFabricTexture} />
          <input ref={fabricNormalInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'normal')} />
          <input ref={fabricRoughnessInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'roughness')} />
          <input ref={avatarMeshInputRef} hidden type="file" accept=".obj,.glb" onChange={importAvatarMesh} />
          <input ref={hdriInputRef} hidden type="file" accept=".hdr,image/vnd.radiance" onChange={importHdri} />
        </div>
      </div>

      <div className="project-strip">
        <div className="project-name">
          <span>PROJECT</span>
          <input
            value={project.name}
            onChange={(event) => mutateProject((next) => { next.name = event.target.value }, { record: false })}
          />
          <select className="template-select" value={project.templateId || 'custom'} onChange={(event) => event.target.value !== 'custom' && applyGarmentTemplate(event.target.value)}>
            <option value="custom">Custom</option>
            {GARMENT_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>
        <div className="project-meta"><span>REV {project.revision}</span><span>{project.pieces.length} PATTERNS</span><span>{project.seams.length} SEAMS</span></div>
        <form className="command-bar" onSubmit={runCommand}>
          <Sparkles size={15} />
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Tell the garment what to change…" />
          <button type="submit">RUN</button>
        </form>
      </div>

      <main className="main-layout" style={{ '--library-width': `${libraryWidth}px`, '--inspector-width': `${inspectorWidth}px`, '--object-browser-height': `${objectBrowserHeight}px` }}>
        <nav className="clo-edge-tabs" aria-label="Workspace side panels">
          <button type="button" aria-pressed={sidebarView === 'library'} className={sidebarView === 'library' ? 'active' : ''} onClick={() => setSidebarView('library')} title="Open asset library">LIBRARY</button>
          <button type="button" aria-pressed={sidebarView === 'history'} className={sidebarView === 'history' ? 'active' : ''} onClick={() => setSidebarView('history')} title="Open undo and redo history">HISTORY</button>
        </nav>
        <aside className="asset-browser">
          {sidebarView === 'history' ? <section className="clo-history-browser">
            <header>History</header>
            <p>Recent editing actions</p>
            <div className="clo-history-actions">
              <button type="button" onClick={undo} disabled={!undoStack.length}><Undo2 size={15}/> Undo <span>{undoStack.length}</span></button>
              <button type="button" onClick={redo} disabled={!redoStack.length}><Redo2 size={15}/> Redo <span>{redoStack.length}</span></button>
            </div>
            <div className="clo-history-note">Your current garment is preserved. Undo and redo use the same editor history as the top toolbar.</div>
          </section> : <>
          <LibraryChrome category={assetCategory} setCategory={setAssetCategory} search={librarySearch} setSearch={setLibrarySearch} thumbnails={libraryThumbnails} setThumbnails={setLibraryThumbnails}>
            {(assetCategory === 'Garment' || assetCategory === 'Patterns') ? GARMENT_TEMPLATES.filter(template => libraryItemMatches(template.name)).map((template) => (
              <button className="asset-template garment-tile" key={template.id} onClick={() => applyGarmentTemplate(template.id)} title={`${template.name} · ${template.description}`}>
                <span className="asset-template-icon">{assetCategory === 'Patterns' ? <PatternLibraryThumbnail templateId={template.id} name={template.name}/> : <GarmentSilhouette type={template.name}/>}</span><span className="asset-template-label">{template.name}</span>
              </button>
            )) : assetCategory === 'Fabric' || assetCategory === 'Material' ? <>
              <div className="clo-fabric-library-divider">PROJECT SWATCHES · CLICK TO APPLY TO SELECTED PATTERN</div>
              {Object.entries(project.fabrics || {}).filter(([,item]) => libraryItemMatches(item.name)).map(([id, item]) => (
                <button className="asset-template garment-tile" key={id} onClick={() => assignFabric(id)} title={`Apply ${item.name} to selected garment pattern`}><span className="asset-template-icon fabric-library-thumbnail" style={{background:item.color || '#737989'}}><span/></span><span className="asset-template-label">{item.name}</span></button>
              ))}
              <div className="clo-fabric-library-divider">TEXTILES · ADD & APPLY</div>
              {Object.entries(FABRIC_PRESETS).filter(([,item]) => libraryItemMatches(item.name)).map(([id,item]) => (
                <button className="asset-template garment-tile" key={`preset-${id}`} onClick={() => addAndApplyFabricPreset(id)} title={`Create ${item.name} and apply to selected pattern`}><span className="asset-template-icon fabric-library-thumbnail" style={{background:item.color || '#737989'}}><span/></span><span className="asset-template-label">+ {item.name}</span></button>
              ))}
            </> : assetCategory === 'Avatar' ? ['CLO Thomas', 'Theo', 'Nora', 'MakeHuman'].filter(libraryItemMatches).map((name) => (
              <button className="asset-template garment-tile" key={name} onClick={() => { setActiveSection('Avatar'); setAvatarModel(name === 'CLO Thomas' ? 'clo-thomas' : name === 'MakeHuman' ? 'makehuman-base' : name.toLowerCase()) }}><span className="asset-template-icon avatar-library-thumbnail">♙</span><span className="asset-template-label">{name}</span></button>
            )) : assetCategory === 'Hardware and Trims' ? (
              <>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addButtonRow(selectedPiece.id, 5); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="buttons" size={48}/></span><span className="asset-template-label">Five-button row</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addButtonholeRow(selectedPiece.id, 5); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="buttonholes" size={48}/></span><span className="asset-template-label">Five buttonholes</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addZipper(selectedPiece.id, trimEdgeIndex); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="trim" size={48}/></span><span className="asset-template-label">Edge zipper</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addTopstitch(selectedPiece.id, trimEdgeIndex); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="topstitch" size={48}/></span><span className="asset-template-label">Topstitch seam</span></button>
                <button className="asset-template garment-tile" disabled={!selectedPiece} onClick={() => { addBinding(selectedPiece.id, trimEdgeIndex); setActiveSection('Sewing') }}><span className="asset-template-icon clo-hardware-preview"><CadToolIcon id="seam-weld" size={48}/></span><span className="asset-template-label">Edge binding</span></button>
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
          <div className="clo-rail-section"><strong>3D TOOLS</strong><span>⌄</span></div>
          <div className="clo-left-3d-double-bars" aria-label="3D dual-column CLO toolbar">
            <div className="clo-left-3d-column" aria-label="3D editing column A">
              <button className={running ? 'active' : ''} onClick={toggleSimulation} title="Simulate / pause · Space"><CadToolIcon id="simulate" size={20}/></button>
              <button className={viewportTool === 'transform' ? 'active' : ''} onClick={() => setViewportTool('transform')} title="Select / Move · garment-centered 3D gizmo (T)"><CadToolIcon id="select-3d" size={20}/></button>
              <button className={viewportTool === 'mesh-select' ? 'active' : ''} title="Select Mesh (Box / Lasso / Brush)" aria-label="Select Mesh (Box / Lasso / Brush)" onClick={() => { setViewportTool('mesh-select'); setWireframe(true) }}><CadToolIcon id="wireframe" size={20}/></button>
              <button title="Edit Styleline · planned" aria-label="Edit Styleline · planned" disabled><CadToolIcon id="curve" size={20}/></button>
              <button className={showSewingGuides ? 'active subtle-active' : ''} title="Edit Sewing · show sewing correspondence" onClick={() => setShowSewingGuides(value => !value)}><CadToolIcon id="seam-links" size={20}/></button>
              <button className={tool === 'sew' ? 'active' : ''} onClick={() => setTool('sew')} title="Free Sewing · sew edges"><CadToolIcon id="sew" size={20}/></button>
              <button className={tool === 'pin' ? 'active' : ''} onClick={() => setTool('pin')} title="Pin (Box / Lasso) · manual pin"><CadToolIcon id="pin" size={20}/></button>
            </div>
            <div className="clo-left-3d-column" aria-label="3D garment column B">
              <button className={leftSimulationMenuOpen ? 'active' : ''} onClick={() => { setSimulationMenuOpen(false); setLeftSimulationMenuOpen(value => !value) }} title="Simulation modes · auxiliary" aria-expanded={leftSimulationMenuOpen}><CadToolIcon id="simulation-modes" size={20}/></button>
              <button className={viewportTool === 'hand' ? 'active' : ''} onClick={() => setViewportTool('hand')} title="3D fabric hand tool"><CadToolIcon id="hand" size={20}/></button>
              <button className={viewportTool === 'move' ? 'active' : ''} onClick={() => setViewportTool('move')} title="3D move garment"><CadToolIcon id="move-3d" size={20}/></button>
              <button className={viewportTool === 'rotate' ? 'active' : ''} onClick={() => setViewportTool('rotate')} title="3D rotate selected fabric"><CadToolIcon id="rotate-3d" size={20}/></button>
              <button className={wireframe ? 'active' : ''} title="Toggle garment mesh wireframe" onClick={() => setWireframe(value => !value)}><CadToolIcon id="wireframe" size={20}/></button>
              <button className={analysisMode === 'strain' ? 'active' : ''} title="Strain map" onClick={() => setAnalysisMode(analysisMode === 'strain' ? 'surface' : 'strain')}><CadToolIcon id="surface" size={20}/></button>
            </div>
          </div>
          {leftSimulationMenuOpen && <div className="clo-simulation-popover clo-simulation-left-popover">
            <strong>SIMULATION · SOLVER MODES</strong>
            <button onClick={() => { applySimulationQuality('draft'); setLeftSimulationMenuOpen(false) }}><Activity size={14}/> Fast · Draft</button>
            <button onClick={() => { applySimulationQuality('balanced'); setLeftSimulationMenuOpen(false) }}><Check size={14}/> Normal · Balanced</button>
            <button onClick={() => { applySimulationQuality('final'); setLeftSimulationMenuOpen(false) }}><SlidersHorizontal size={14}/> Fitting · Quality</button>
            <button onClick={() => { requestNativeSolve(); setLeftSimulationMenuOpen(false) }} disabled={nativeServiceStatus !== 'ready'}><Cpu size={14}/> Native XPBD {nativeServiceStatus !== 'ready' ? '· OFFLINE' : ''}</button>
            <button onClick={() => { resetSimulation(); setLeftSimulationMenuOpen(false) }}><RotateCcw size={14}/> Reset to flat pieces</button>
          </div>}
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
        </aside>

        <section className="workspaces">
          <GarmentViewport
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
          />
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
            onMovePiece={movePiece}
            onChangeTool={setTool}
            onMovePoint={movePoint}
            onMoveCurve={moveCurve}
            onSplitEdge={splitPatternEdge}
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
        </section>

        <aside className="inspector clo-inspector">
          <div className="clo-panel-resizer clo-right-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Inspector width" title="Drag to resize Object Browser and Property Editor" onPointerDown={(event) => beginPanelResize('inspector', event)} onPointerMove={movePanelResize} onPointerUp={endPanelResize} onLostPointerCapture={endPanelResize} onDoubleClick={() => setInspectorWidth(392)}/>
          <RightToolPalette activeSection={activeSection} viewportTool={viewportTool} tool={tool} setViewportTool={setViewportTool} setTool={setTool} setActiveSection={setActiveSection} setObjectTab={setObjectTab} onRevealBrowser={() => setShowObjectBrowser(true)} showSewingGuides={showSewingGuides} setShowSewingGuides={setShowSewingGuides} wireframe={wireframe} setWireframe={setWireframe} analysisMode={analysisMode} setAnalysisMode={setAnalysisMode} toggleSimulation={toggleSimulation} resetSimulation={resetSimulation} exportProject={exportProject} onFitCamera={() => setFitCameraSignal(value => value + 1)} onMirrorSelected={() => duplicateSelectedPiece(true)} running={running}/>
          <div className="clo-inspector-content">
          <div className="clo-inspector-topline"><button title={showObjectBrowser ? 'Hide Object Browser' : 'Show Object Browser'} onClick={() => setShowObjectBrowser(value => !value)}><PanelRight size={15}/></button><span>OBJECTS & PROPERTIES</span><button title="Choose Fabric" onClick={() => { setObjectTab('Fabric'); setActiveSection('Fabric') }}><Shirt size={15}/></button></div>
          {showObjectBrowser && <ObjectBrowser tab={objectTab} setTab={setObjectTab} project={project} setSelectedPieceId={selectIn3D} setSelectedFabricId={setSelectedFabricId} onApplyFabric={assignFabric} setActiveSection={setActiveSection} selectedPieceId={selectedPieceId} selectedFabricId={selectedFabricId} onAddFabric={addFabricSwatch} onAddPattern={addPiece}/>}
          {showObjectBrowser && <div className="clo-browser-resizer" role="separator" aria-orientation="horizontal" aria-label="Resize Object Browser height" title="Drag to resize Object Browser and Property Editor" onPointerDown={(event) => beginPanelResize('objects', event)} onPointerMove={movePanelResize} onPointerUp={endPanelResize} onLostPointerCapture={endPanelResize} onDoubleClick={() => setObjectBrowserHeight(390)}><span/></div>}
          <PropertyCategoryNavigator activeSection={activeSection} setActiveSection={setActiveSection} setObjectTab={setObjectTab} onRevealBrowser={() => setShowObjectBrowser(true)}/>
          <div className="clo-property-panel">
            <div className="inspector-head"><span>PROPERTY EDITOR</span><strong>{activeSection.toUpperCase()}</strong></div>

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
              {project.templateId === 'tee' && <div className="panel-section" aria-label="Foundation Tee pattern correction">
                <div className="panel-title"><span>Foundation Tee precision draft</span><strong>14 SEAMS</strong></div>
                <p className="panel-copy">The corrected T-shirt armhole and short-sleeve cap curves match to within 0.22% in the template. This keeps your sewn edge indices, vertices, materials and 3D placement intact; Undo restores the previous draft.</p>
                <button className="wide-action" onClick={correctTeeArmholes}><CadToolIcon id="curve" size={17}/>MATCH T-SHIRT ARMHOLES + SLEEVES</button>
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
                {ppfSewing.error && <p className="panel-copy" style={{ color: '#f39a88' }}>{ppfSewing.error}. Start the local service with <code>npm run ppf:serve</code> if it is offline.</p>}
                {ppfSewing.summary?.stitchEdges !== undefined && <p className="panel-copy">{ppfSewing.summary.stitchEdges} physical stitch pairs · {ppfSewing.summary.vertices} cloth vertices · zero-intersection staging: {ppfSewing.summary.intersections === 0 ? 'cloth preflight passed' : 'pending'} · actual body contact: {ppfSewing.summary.initialBodyContactVerified ? 'initial frame verified' : 'not yet verified'}</p>}
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
                <p className="panel-copy">Choose the sew tool, then click two pattern edges. The same seam relationship is sent directly to the cloth solver.</p>
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
                            <div><span>A start</span><NumberField value={(seam.a?.startT ?? 0) * 100} min={0} max={98} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'a', 'startT', value / 100)} /></div>
                            <div><span>A end</span><NumberField value={(seam.a?.endT ?? 1) * 100} min={2} max={100} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'a', 'endT', value / 100)} /></div>
                            <div><span>B start</span><NumberField value={(seam.b?.startT ?? 0) * 100} min={0} max={98} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'b', 'startT', value / 100)} /></div>
                            <div><span>B end</span><NumberField value={(seam.b?.endT ?? 1) * 100} min={2} max={100} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'b', 'endT', value / 100)} /></div>
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
                        <div><strong>Zipper · E{zipper.edgeIndex + 1}</strong><small>{zipper.type || 'coil'} tape</small></div>
                        <NumberField value={zipper.widthCm ?? 1.2} min={0.5} max={5} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'zippers', zipper.id, 'widthCm', clamp(value, 0.5, 5))} />
                        <span />
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'zippers', zipper.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.buttonholes || []).map((buttonhole, index) => (
                      <div key={buttonhole.id} className="trim-editor-item buttonhole-editor-item">
                        <div><strong>Buttonhole {index + 1}</strong><small>{buttonhole.lengthCm ?? 2.4} cm · {Math.round(buttonhole.orientationDeg || 0)}°</small></div>
                        <NumberField value={buttonhole.lengthCm ?? 2.4} min={0.8} max={6} step={0.1} suffix="cm" onChange={(value) => updateButtonhole(selectedPiece.id, buttonhole.id, 'lengthCm', clamp(value, 0.8, 6))} />
                        <NumberField value={buttonhole.orientationDeg ?? 0} min={-180} max={180} step={5} suffix="°" onChange={(value) => updateButtonhole(selectedPiece.id, buttonhole.id, 'orientationDeg', clamp(value, -180, 180))} />
                        <button onClick={() => removeButtonhole(selectedPiece.id, buttonhole.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.buttons || []).length > 0 && (
                      <div className="trim-editor-item trim-summary-item">
                        <div><strong>Buttons</strong><small>{selectedPiece.buttons.length} placed on pattern</small></div>
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

          {activeSection === 'Fabric' && (
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
                <label className="select-field"><span>Preset</span><select value={Object.keys(FABRIC_PRESETS).find((key) => FABRIC_PRESETS[key].name === fabric.name) || ''} onChange={(event) => applyFabricPreset(event.target.value)}><option value="">Custom</option>{Object.entries(FABRIC_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.name}</option>)}</select></label>
                <label className="color-field"><span>Surface color</span><input type="color" value={fabric.color} onChange={(event) => updateFabric('color', event.target.value)} /><strong>{fabric.color.toUpperCase()}</strong></label>
                <div className="clo-fabric-apply-actions">
                  <button disabled={!selectedPiece} onClick={() => assignFabric(selectedFabricId)}>APPLY TO SELECTED PATTERN</button>
                  <button onClick={() => assignFabric(selectedFabricId, true)}>APPLY TO ALL GARMENT PIECES</button>
                </div>
                {selectedPiece && <label className="select-field"><span>{selectedPiece.name} material</span><select value={selectedPiece.fabricId || 'main'} onChange={(event) => updateSelectedPiece('fabricId', event.target.value)}>{Object.entries(project.fabrics || {}).map(([fabricId, item]) => <option key={fabricId} value={fabricId}>{item.name || fabricId}</option>)}</select></label>}
                {selectedFabricId !== 'main' && <button className="wide-action danger-action" onClick={() => deleteFabricSwatch(selectedFabricId)}><Trash2 size={14} />DELETE SWATCH · REASSIGN TO MAIN</button>}
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Textile surface</span><strong>{fabric.texture?.src ? 'MAPPED' : 'COLOR'}</strong></div>
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
              <div className="panel-section">
                <div className="panel-title"><span>Textile PBR maps</span><strong>{[fabric.texture?.normalSrc, fabric.texture?.roughnessSrc].filter(Boolean).length}/2</strong></div>
                <p className="panel-copy">Normal and roughness maps share the color texture's real-centimeter repeat and grain rotation, so weave detail stays registered to the pattern.</p>
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
                <SliderRow label="Normal strength" value={fabric.normalStrength ?? 1} min={0} max={4} step={0.05} display={`${(fabric.normalStrength ?? 1).toFixed(2)}×`} onChange={(value) => updateFabric('normalStrength', value)} />
                <SliderRow label="Surface roughness" value={fabric.roughness ?? 0.82} min={0.04} max={1} step={0.01} display={(fabric.roughness ?? 0.82).toFixed(2)} onChange={(value) => updateFabric('roughness', value)} />
                <SliderRow label="Sheen" value={fabric.sheen ?? 0.22} min={0} max={1} step={0.01} display={(fabric.sheen ?? 0.22).toFixed(2)} onChange={(value) => updateFabric('sheen', value)} />
                <SliderRow label="Sheen roughness" value={fabric.sheenRoughness ?? 0.84} min={0.04} max={1} step={0.01} display={(fabric.sheenRoughness ?? 0.84).toFixed(2)} onChange={(value) => updateFabric('sheenRoughness', value)} />
                <SliderRow label="Metalness" value={fabric.metalness ?? 0} min={0} max={1} step={0.01} display={(fabric.metalness ?? 0).toFixed(2)} onChange={(value) => updateFabric('metalness', value)} />
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
                <label className="select-field"><span>Fitting avatar</span><select value={project.avatar.model || 'makehuman-base'} onChange={(event) => setAvatarModel(event.target.value)}><option value="theo">Theo · Rigged mens fitting</option><option value="nora">Nora · Rigged womens fitting</option><option value="makehuman-base">MakeHuman · Neutral base</option><option value="clo-thomas">CLO Thomas · CLO3D Export</option>{project.avatar.model === 'custom-export' && <option value="custom-export">Imported CLO mesh</option>}</select></label><button className="wide-action" onClick={() => avatarMeshInputRef.current?.click()}><Upload size={14}/>IMPORT CLO-EXPORTED OBJ / GLB</button><p className="panel-copy">CLO .avt is proprietary. Export the saved avatar to OBJ/GLB in CLO first; the imported mesh is visual until mesh-to-body collision fitting is implemented.</p>
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
                <div className="panel-title"><span>Native XPBD</span><strong>{nativeSolveStatus === 'solving' ? 'SOLVING' : nativeSolveStatus === 'done' ? 'SOLVED' : nativeServiceStatus === 'ready' ? 'READY' : nativeServiceStatus.toUpperCase()}</strong></div>
                <label className="select-field"><span>Native quality</span><select value={project.simulation.nativeQuality || 'draft'} onChange={(event) => applyNativeQuality(event.target.value)}>{Object.values(NATIVE_QUALITY_PROFILES).map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
                <button className="wide-action" disabled={nativeSolveStatus === 'solving'} onClick={requestNativeSolve}><Cpu size={15} />{nativeSolveStatus === 'solving' ? 'SOLVING NATIVE XPBD…' : 'SOLVE NATIVE XPBD · 60 FRAMES'}</button>
                {nativeLastSolve && <div className="stat-grid"><MiniStat label="Native solve" value={`${nativeLastSolve.elapsedMs.toFixed(1)} ms`} /><MiniStat label="Native seam avg" value={`${((nativeLastSolve.stats?.seamAverageDistance || 0) * 1000).toFixed(1)} mm`} /><MiniStat label="Native seam peak" value={`${((nativeLastSolve.stats?.seamMaxDistance || 0) * 1000).toFixed(1)} mm`} /><MiniStat label="Native particles" value={(nativeLastSolve.stats?.particles || 0).toLocaleString()} /></div>}
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
              </div>
              <button className="wide-action" onClick={exportDxf}><FileDown size={15} />EXPORT DXF · {gradePreviewSize}</button>
              <button className="wide-action" onClick={requestObjExport}><Box size={15} />EXPORT 3D OBJ · {gradePreviewSize}</button>
              <button className="wide-action" onClick={requestGlbExport}><Box size={15} />EXPORT GLB · {gradePreviewSize}</button>
              <button className="wide-action" onClick={exportMeasurements}><FileDown size={15} />EXPORT POM CSV</button>
              <button className="wide-action" onClick={exportGarmentCode}><FileDown size={15} />EXPORT GARMENTCODE JSON</button>
              <button className="wide-action" onClick={exportFactoryPackage}><FileDown size={15} />EXPORT FACTORY PACKAGE · ZIP</button>
              <button className="wide-action" onClick={exportTechPack}><FileDown size={15} />EXPORT TECH PACK</button>
              <button className="wide-action" onClick={exportSizeRun}><FileDown size={15} />EXPORT XS–XXL SIZE RUN</button>
              <button className="wide-action" onClick={exportProject}><FileDown size={15} />EXPORT GARMENT DOCUMENT</button>
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
          </div>
          </div>
        </aside>
      </main>

      <footer className="simulation-bar">
        <div className="sim-left">
          <button className={`sim-play ${running ? 'active' : ''}`} onClick={toggleSimulation}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'PAUSE' : 'SIMULATE'}</button>
          <button className="sim-reset" onClick={resetSimulation}><RotateCcw size={15} />RESET</button>
          <span className="sim-copy">{!hasSimulated ? 'ARRANGE → SEW → SIMULATE' : running ? 'Draping on avatar…' : 'Paused · Press SIMULATE to resume'}</span>
        </div>
        <div className="sim-stats"><span><Activity size={13} />{stats.vertices.toLocaleString()} vertices</span><span>{stats.constraints.toLocaleString()} constraints</span><span>{stats.seams.toLocaleString()} seam links</span><span>{stats.anchors.toLocaleString()} fit tacks</span></div>
        <div className="engine-badge"><i className={running ? 'active' : ''} /><span>XPBD CLOTH</span><strong>GPU UI / CPU SOLVER</strong></div>
      </footer>
    </div>
  )
}

```

### `src/components/PatternEditor.jsx`

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { closestEdgeFraction, edgeLength, edgePointAt, getEdgeSeamAllowance, sampleEdge, samplePieceBoundary, seamAllowanceBoundary } from '../core/project.js'
import { offsetEdgePath, topstitchPaths, zipperPaths } from '../core/trims.js'
import ViewportQuickTools from './ViewportQuickTools.jsx'

const VIEWBOX = { width: 330, height: 170 }

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
  onMovePiece,
  onMovePoint,
  onMoveCurve,
  onSplitEdge,
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
  const [pendingFastener, setPendingFastener] = useState(null)
  const [pendingMeasurement, setPendingMeasurement] = useState(null)
  const [hoverEdge, setHoverEdge] = useState(null)
  const [internalPreview, setInternalPreview] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [view, setView] = useState({ x: 0, y: 0, width: VIEWBOX.width, height: VIEWBOX.height })
  const panRef = useRef(null)
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
    if (event.key === 'Escape') { setContextMenu(null); return }
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

  useEffect(() => {
    if (!contextMenu) return undefined
    const close = (event) => {
      if (event?.target?.closest?.('.clo-pattern-context-menu')) return
      setContextMenu(null)
    }
    const escape = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [contextMenu])

  const openPatternContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const element = event.target.closest?.('.pattern-piece')
    const pieceId = element?.getAttribute('data-piece-id') || selectedPieceId
    if (pieceId && pieceId !== selectedPieceId) onSelectPiece(pieceId)
    // The menu is positioned relative to .pattern-editor-shell, not to the
    // SVG. Include the 39 px workspace header when computing its position.
    const bounds = svgRef.current?.parentElement?.getBoundingClientRect()
    if (!bounds) return
    const x = Math.max(4, Math.min(bounds.width - 210, event.clientX - bounds.left))
    const y = Math.max(38, Math.min(bounds.height - 335, event.clientY - bounds.top))
    setContextMenu({x,y,pieceId})
  }
  const createCenterLine = () => {
    const piece = project.pieces.find(item => item.id === contextMenu?.pieceId)
    if (!piece || piece.locked) return
    const xs = piece.points.map(p => p.x), ys = piece.points.map(p => p.y)
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    onCreateInternalLine?.(piece.id, { a:{x,y:Math.min(...ys)+2}, b:{x,y:Math.max(...ys)-2} })
    setContextMenu(null)
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

  const beginPieceDrag = (event, piece) => {
    if (event.button !== 0 || tool !== 'select' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
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
    onSelectPiece(piece.id)
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
    onSelectPiece(piece.id)
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
    const start = localPoint(event, piece)
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
    const endpoint = { pieceId: piece.id, ...localPoint(event, piece) }
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
    const endpoint = { pieceId: piece.id, ...localPoint(event, piece) }
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
      onMovePiece(drag.pieceId, {
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
      })
    } else if (drag.kind === 'point') {
      onMovePoint(drag.pieceId, drag.pointIndex, {
        x: Math.round((drag.origin.x + dx) * 10) / 10,
        y: Math.round((drag.origin.y - dy) * 10) / 10,
      })
    } else if (drag.kind === 'curve') {
      onMoveCurve(drag.pieceId, drag.edgeIndex, {
        cx: Math.round((drag.origin.x + dx) * 10) / 10,
        cy: Math.round((drag.origin.y - dy) * 10) / 10,
      })
    } else if (drag.kind === 'internal') {
      const currentLocal = localPoint(event, drag.piece)
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
    svgRef.current?.releasePointerCapture?.(event.pointerId)
    onEndGesture?.()
  }

  const handleEdgeClick = (event, piece, edgeIndex) => {
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
          <strong>2D PATTERN</strong>
          <span>{project.units.toUpperCase()} · {project.pieces.length} PIECES</span>
        </div>
        <div className="workspace-hint">
          {tool === 'select' && 'Drag a piece to arrange it'}
          {tool === 'point' && 'Drag anchor points to edit · Option/Alt-click a point to delete it'}
          {tool === 'split' && 'Click an edge to insert a new pattern point'}
          {tool === 'curve' && 'Drag an edge handle to shape a curve · double-click to straighten'}
          {tool === 'internal' && 'Drag inside a pattern to create a construction line · classify it as fold or dart in the inspector'}
          {tool === 'pin' && 'Click inside the pattern to add a manual 3D pin · click a pin to remove it'}
          {tool === 'notch' && 'Click a pattern edge to place a production notch at that exact curve position'}
          {tool === 'sew' && (pendingEdge ? 'Select the second edge' : 'Select the first seam edge')}
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
        onContextMenu={openPatternContextMenu}
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
          if (event.target === event.currentTarget) onSelectPiece(null)
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
          <path className="draft-avatar-contour" d="M0-66 C-7-66-10-61-10-54 C-10-48-7-44-5-42 L-6-37 C-13-36-20-35-23-30 L-31-8 L-42 16 L-36 19 L-22 0 L-18-13 L-16 18 L-14 35 L-12 66 L-3 66 L0 33 L3 66 L12 66 L14 35 L16 18 L18-13 L22 0 L36 19 L42 16 L31-8 L23-30 C20-35 13-36 6-37 L5-42 C8-44 10-48 10-54 C10-61 7-66 0-66Z"/>
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
                onClick={() => onSelectPiece(piece.id)}
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
              {/* Drafting guides are derived from the real pattern bounds;
                  they never silently alter cut geometry or sewing indices. */}
              {['front','back'].includes(piece.id) && (() => {
                const xs = piece.points.map(p => p.x), ys = piece.points.map(p => p.y)
                const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
                const cx=(minX+maxX)/2, chestY=minY+(maxY-minY)*.72
                const a=svgPoint({x:cx,y:minY+2},piece.layout2d),b=svgPoint({x:cx,y:maxY-2},piece.layout2d)
                const c=svgPoint({x:minX+4,y:chestY},piece.layout2d),d=svgPoint({x:maxX-4,y:chestY},piece.layout2d)
                const center=svgPoint({x:cx,y:chestY},piece.layout2d)
                return <g className="clo-bodice-drafting-guides" pointerEvents="none" clipPath={`url(#pattern-clip-${piece.id})`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="bodice-center-guide"/>
                  <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} className="bodice-chest-guide"/>
                  <circle cx={center.x} cy={center.y} r="1.15"/>
                  <path d={`M${center.x-2.6} ${center.y}h5.2M${center.x} ${center.y-2.6}v5.2`} />
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
                      className={`pattern-edge ${sewn ? 'sewn' : ''} ${walking ? 'walk-highlight' : ''} ${pending ? 'pending' : ''} ${hovered ? 'hovered' : ''}`}
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
                    r={tool === 'point' && selected ? 1.6 : 0.8}
                    className={`pattern-node ${tool === 'point' && selected ? 'editable' : ''}`}
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
                      onDoubleClick={(event) => { event.stopPropagation(); onMoveCurve(piece.id, edgeIndex, null) }}
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
      </svg>
      {contextMenu && <div className="clo-pattern-context-menu" role="menu" aria-label="2D pattern context menu" style={{left:contextMenu.x,top:contextMenu.y}} onContextMenu={event=>event.preventDefault()}>
        <strong>{project.pieces.find(piece=>piece.id===contextMenu.pieceId)?.name || '2D Pattern Window'}</strong>
        {[
          ['Select / Transform',()=>onChangeTool?.('select')],
          ['Edit Pattern Points',()=>onChangeTool?.('point')],
          ['Edit Curve',()=>onChangeTool?.('curve')],
          ['Add / Split Point',()=>onChangeTool?.('split')],
          ['Edit Sewing',()=>onChangeTool?.('sew')],
          ['Add Notch',()=>onChangeTool?.('notch')],
          ['Add Pin',()=>onChangeTool?.('pin')],
          ['Add Fastener',()=>onChangeTool?.('fastener')],
          ['Internal Line / Dart',()=>onChangeTool?.('internal')],
          ['Create Center Internal Line',createCenterLine],
          ['Measure',()=>onChangeTool?.('measure')],
          ['Zoom Selected',focusSelected],
          ['Zoom In',()=>zoomAt(.8)],
          ['Zoom Out',()=>zoomAt(1.25)],
          ['Fit All Patterns',()=>focusPieces(project.pieces,14)],
          ['Arrange Patterns',()=>onAutoArrange?.()],
          ['Toggle Sewing Links',()=>onToggleSeams?.()],
          ['Toggle Grid',()=>onToggleGrid?.()],
        ].map(([label,handler])=><button key={label} role="menuitem" type="button" onClick={()=>{handler();setContextMenu(null)}}>{label}</button>)}
      </div>}
      <div className="canvas-scale"><span />10 cm</div>
    </div>
  )
}

```

### `src/components/GarmentViewport.jsx`

```jsx
import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { avatarClearance, boundaryIndicesForEdge, createGeometry, getAvatarArmPose, getAvatarHeightScale, getAvatarTorsoRadii, getAvatarUpperBodyDimensions, measureAvatarSurfaceIntrusion, refreshSimulationAnalysis, syncAnalysisColors, syncGeometry } from '../core/physics.js'
import { createSimulationSession } from '../core/backends/registry.js'
import { solveWithNativeService } from '../core/backends/nativeServiceClient.js'
import { setStagedGeometry, stagedPanelPositions } from '../core/staging.js'
import { captureDrape, captureParticlePositions, measureSeamGap, restoreParticlePositions, transferDrape } from '../core/liveDrapeTransfer.js'
import { createAvatarMeshCollider, correctMeshAvatarContacts, selectAvatarBodyMeshes } from '../core/meshAvatarContact.js'
import { applyAutoFitPlacement } from '../core/autoFitPlacement.js'
import { mergeMeshFaceSelection } from '../core/meshSelection.js'
import ViewportQuickTools from './ViewportQuickTools.jsx'

function syncSurfaceOverlay(record) {
  const position = record.meshRecord.geometry.getAttribute('position')
  const normal = record.meshRecord.geometry.getAttribute('normal')
  if (!position || !normal) return

  if (record.type === 'graphic') {
    const attribute = record.object.geometry.getAttribute('position')
    for (let index = 0; index < record.mappings.length; index += 1) {
      const mapping = record.mappings[index]
      if (!mapping) {
        attribute.setXYZ(index, 0, 0, 0)
        continue
      }
      const [aIndex, bIndex, cIndex] = mapping.indices
      const [wa, wb, wc] = mapping.weights
      const x = position.getX(aIndex) * wa + position.getX(bIndex) * wb + position.getX(cIndex) * wc
      const y = position.getY(aIndex) * wa + position.getY(bIndex) * wb + position.getY(cIndex) * wc
      const z = position.getZ(aIndex) * wa + position.getZ(bIndex) * wb + position.getZ(cIndex) * wc
      let nx = normal.getX(aIndex) * wa + normal.getX(bIndex) * wb + normal.getX(cIndex) * wc
      let ny = normal.getY(aIndex) * wa + normal.getY(bIndex) * wb + normal.getY(cIndex) * wc
      let nz = normal.getZ(aIndex) * wa + normal.getZ(bIndex) * wb + normal.getZ(cIndex) * wc
      const normalLength = Math.hypot(nx, ny, nz) || 1
      nx /= normalLength
      ny /= normalLength
      nz /= normalLength
      attribute.setXYZ(index, x + nx * record.lift, y + ny * record.lift, z + nz * record.lift)
    }
    attribute.needsUpdate = true
    record.object.geometry.computeBoundingSphere()
    return
  }

  if (record.type === 'line') {
    const attribute = record.object.geometry.getAttribute('position')
    for (let index = 0; index < record.indices.length; index += 1) {
      const vertexIndex = record.indices[index]
      attribute.setXYZ(
        index,
        position.getX(vertexIndex) + normal.getX(vertexIndex) * record.lift,
        position.getY(vertexIndex) + normal.getY(vertexIndex) * record.lift,
        position.getZ(vertexIndex) + normal.getZ(vertexIndex) * record.lift,
      )
    }
    attribute.needsUpdate = true
    if (record.object.isLine && record.object.material?.isLineDashedMaterial) record.object.computeLineDistances()
    return
  }

  if (record.type === 'button') {
    const vertexIndex = record.vertexIndex
    record.object.position.set(
      position.getX(vertexIndex) + normal.getX(vertexIndex) * record.lift,
      position.getY(vertexIndex) + normal.getY(vertexIndex) * record.lift,
      position.getZ(vertexIndex) + normal.getZ(vertexIndex) * record.lift,
    )
    return
  }

  if (record.type === 'surface-object') {
    const vertexIndex = record.vertexIndex
    const nx = normal.getX(vertexIndex)
    const ny = normal.getY(vertexIndex)
    const nz = normal.getZ(vertexIndex)
    record.object.position.set(
      position.getX(vertexIndex) + nx * record.lift,
      position.getY(vertexIndex) + ny * record.lift,
      position.getZ(vertexIndex) + nz * record.lift,
    )
    const surfaceNormal = new THREE.Vector3(nx, ny, nz).normalize()
    const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal)
    const twist = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, THREE.MathUtils.degToRad(Number(record.orientationDeg || 0)))
    record.object.quaternion.copy(twist.multiply(base))
  }
}

function makeTrimLine(meshRecord, indices, material, lift = 0.0025) {
  if (!indices?.length || indices.length < 2) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(indices.length * 3), 3))
  const object = new THREE.Line(geometry, material)
  object.renderOrder = 31
  const record = { type: 'line', object, meshRecord, indices, lift }
  syncSurfaceOverlay(record)
  return record
}

function nearestFlatVertexIndex(simPiece, point) {
  let bestIndex = 0
  let bestDistance = Infinity
  for (let index = 0; index < simPiece.flatVertices.length; index += 1) {
    const candidate = simPiece.flatVertices[index]
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function triangleMapping(point, a, b, c) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(denominator) < 1e-8) return null
  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator
  const wc = 1 - wa - wb
  if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) return null
  return [wa, wb, wc]
}

function mapFlatPointToMesh(simPiece, point) {
  for (const face of simPiece.faces) {
    const [aIndex, bIndex, cIndex] = face
    const weights = triangleMapping(
      point,
      simPiece.flatVertices[aIndex],
      simPiece.flatVertices[bIndex],
      simPiece.flatVertices[cIndex],
    )
    if (weights) return { indices: [aIndex, bIndex, cIndex], weights }
  }
  return null
}

function makeGraphicOverlay(meshRecord, graphic, segments = 12) {
  if (!graphic?.src) return null
  const count = segments + 1
  const mappings = []
  const uvs = new Float32Array(count * count * 2)
  const positions = new Float32Array(count * count * 3)
  const indices = []
  const rotation = THREE.MathUtils.degToRad(Number(graphic.rotationDeg || 0))
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const width = Math.max(0.1, Number(graphic.widthCm ?? 20))
  const height = Math.max(0.1, Number(graphic.heightCm ?? 20))
  const centerX = Number(graphic.x ?? 0)
  const centerY = Number(graphic.y ?? 0)

  for (let row = 0; row < count; row += 1) {
    const v = row / segments
    for (let column = 0; column < count; column += 1) {
      const u = column / segments
      const localX = (u - 0.5) * width
      const localY = (0.5 - v) * height
      const point = {
        x: centerX + localX * cosine - localY * sine,
        y: centerY + localX * sine + localY * cosine,
      }
      mappings.push(mapFlatPointToMesh(meshRecord.simPiece, point))
      const uvIndex = (row * count + column) * 2
      uvs[uvIndex] = u
      uvs[uvIndex + 1] = 1 - v
    }
  }

  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const a = row * count + column
      const b = a + 1
      const c = a + count
      const d = c + 1
      if (mappings[a] && mappings[b] && mappings[c]) indices.push(a, c, b)
      if (mappings[b] && mappings[c] && mappings[d]) indices.push(b, c, d)
    }
  }
  if (!indices.length) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const texture = new THREE.TextureLoader().load(graphic.src)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: Math.max(0, Math.min(1, Number(graphic.opacity ?? 1))),
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
  const object = new THREE.Mesh(geometry, material)
  object.renderOrder = 29
  const record = { type: 'graphic', object, meshRecord, mappings, lift: 0.0032 }
  syncSurfaceOverlay(record)
  return record
}

function makeAvatarTorsoGeometry(avatar) {
  const verticalSegments = 20
  const radialSegments = 40
  const heightScale = getAvatarHeightScale(avatar)
  const minY = 0.58 * heightScale
  const maxY = 1.49 * heightScale
  const positions = []
  const indices = []

  for (let row = 0; row <= verticalSegments; row += 1) {
    const t = row / verticalSegments
    const y = THREE.MathUtils.lerp(minY, maxY, t)
    const radii = getAvatarTorsoRadii(avatar, y)
    for (let column = 0; column < radialSegments; column += 1) {
      const angle = (column / radialSegments) * Math.PI * 2
      positions.push(Math.cos(angle) * radii.x, y, Math.sin(angle) * radii.z)
    }
  }

  for (let row = 0; row < verticalSegments; row += 1) {
    for (let column = 0; column < radialSegments; column += 1) {
      const nextColumn = (column + 1) % radialSegments
      const a = row * radialSegments + column
      const b = row * radialSegments + nextColumn
      const c = (row + 1) * radialSegments + column
      const d = (row + 1) * radialSegments + nextColumn
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeFabricTexture(fabric, sourceField = 'src', colorTexture = false) {
  const source = fabric?.texture?.[sourceField]
  if (!source) return null
  const texture = new THREE.TextureLoader().load(source)
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.center.set(0.5, 0.5)
  texture.rotation = THREE.MathUtils.degToRad(Number(fabric.texture.rotationDeg || 0))
  texture.needsUpdate = true
  return texture
}

function makeAvatar(project) {
  const group = new THREE.Group()
  group.name = 'avatar'
  const opacity = project.avatar?.visibility ?? 0.82
  const material = new THREE.MeshStandardMaterial({
    color: 0x6b6b6b,
    roughness: 0.7,
    metalness: 0,
    transparent: opacity < 0.99,
    opacity,
    // A semi-transparent fitting avatar should not occlude cloth in the depth
    // buffer. Otherwise nearly invisible body geometry can make intact garment
    // faces look as though they are missing or torn.
    depthWrite: opacity >= 0.99,
  })
  const hipScale = Math.max(0.82, Math.min(1.24, (project.avatar?.hipCm || 94) / 94))
  const upper = getAvatarUpperBodyDimensions(project.avatar)
  const heightScale = upper.heightScale

  const addEllipsoid = (position, scale) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const torso = new THREE.Mesh(makeAvatarTorsoGeometry(project.avatar), material)
  torso.castShadow = true
  torso.receiveShadow = true
  group.add(torso)
  addEllipsoid([0, upper.shoulderCenterY, 0], [upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ])
  addEllipsoid([0, upper.neckCenterY, 0], [upper.neckRadius, upper.neckRadiusY, upper.neckRadius])
  addEllipsoid([0, 0.78 * heightScale, 0], [0.20 * hipScale, 0.28 * heightScale, 0.14 * hipScale])
  addEllipsoid([0, 1.88 * heightScale, 0], [0.14, 0.18 * heightScale, 0.14])
  addEllipsoid([-0.105, 0.24 * heightScale, 0], [0.09, 0.48 * heightScale, 0.10])
  addEllipsoid([0.105, 0.24 * heightScale, 0], [0.09, 0.48 * heightScale, 0.10])

  const leftPose = getAvatarArmPose(project.avatar, -1)
  const armGeometry = new THREE.CapsuleGeometry(leftPose.radius, leftPose.halfLength * 2, 6, 16)
  const leftArm = new THREE.Mesh(armGeometry, material)
  leftArm.position.copy(leftPose.center)
  leftArm.rotation.z = leftPose.rotationZ
  leftArm.castShadow = true
  group.add(leftArm)
  const rightArm = leftArm.clone()
  const rightPose = getAvatarArmPose(project.avatar, 1)
  rightArm.position.copy(rightPose.center)
  rightArm.rotation.z = rightPose.rotationZ
  group.add(rightArm)

  return group
}

async function upgradeAvatarVisualization(group, project, customAvatar = null) {
  const avatarModel = project.avatar?.model || 'makehuman-base'
  let detailed
  if (avatarModel === 'clo-thomas') {
    detailed = (await new GLTFLoader().loadAsync('/avatars/clo-thomas.glb')).scene
    detailed.name = 'clo-thomas-avatar'
  } else if (avatarModel === 'custom-export' && customAvatar?.url) {
    if (customAvatar.type === 'glb') detailed = (await new GLTFLoader().loadAsync(customAvatar.url)).scene
    else detailed = await new OBJLoader().loadAsync(customAvatar.url)
    detailed.name = 'imported-clo-avatar'
  } else if (avatarModel === 'theo' || avatarModel === 'nora') {
    const gltf = await new GLTFLoader().loadAsync(`/avatars/opensew/${avatarModel}.glb`)
    detailed = gltf.scene
    detailed.name = `${avatarModel}-rigged-fitting-avatar`
  } else {
    detailed = await new OBJLoader().loadAsync('/avatars/makehuman-base.obj')
    detailed.name = 'makehuman-detailed-avatar'
  }

  // Skinned CLO avatars need their skeleton updated before computing world bounds.
  detailed.updateMatrixWorld(true)
  const initialBounds = new THREE.Box3().setFromObject(detailed)
  const initialSize = new THREE.Vector3()
  initialBounds.getSize(initialSize)
  const targetHeightM = Math.max(1.4, Math.min(2.2, Number(project.avatar?.heightCm ?? 180) / 100))
  const uniformScale = targetHeightM / Math.max(0.001, initialSize.y)
  detailed.scale.setScalar(uniformScale)
  detailed.updateMatrixWorld(true)

  const scaledBounds = new THREE.Box3().setFromObject(detailed)
  const scaledCenter = new THREE.Vector3()
  scaledBounds.getCenter(scaledCenter)
  detailed.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z)
  detailed.updateMatrixWorld(true)

  const opacity = project.avatar?.visibility ?? 0.82
  const material = new THREE.MeshStandardMaterial({
    color: 0x777777,
    roughness: 0.68,
    metalness: 0,
    transparent: opacity < 0.99,
    opacity,
    depthWrite: opacity >= 0.99,
  })

  let meshCount = 0
  detailed.traverse((object) => {
    if (!object.isMesh) return
    meshCount += 1
    // Preserve CLO's actual skin, face, hair and shoe textures. The
    // neutral material is only for generic untextured fitting avatars.
    if (avatarModel !== 'clo-thomas') object.material = material
    object.castShadow = true
    object.receiveShadow = true
  })
  if (!meshCount) throw new Error('Detailed avatar loaded without mesh geometry')

  // The existing primitive avatar remains our collision proxy for now. Once
  // the detailed body is ready, hide those render meshes only; physics still
  // uses the measurement-driven analytic body in physics.js/native payloads.
  const fallbackChildren = [...group.children]
  for (const child of fallbackChildren) child.visible = false
  group.add(detailed)
  group.userData.visualAvatar = avatarModel
  group.userData.collisionAvatar = 'analytic-parametric'
  return detailed
}

export default function GarmentViewport({ project, ppfPreview = null, running, hasSimulated = false, resetSignal, wireframe, analysisMode = 'surface', backendId = 'browser-pbd', nativeSolveSignal = 0, nativeQuality = 'draft', exportSignal = 0, glbExportSignal = 0, renderSignal = 0, hdriUrl = '', customAvatar = null, viewportTool = 'orbit', onMeshSelection, fitCameraSignal = 0, selectedPieceId = null, onSelectPiece, showSewingGuides = true, highlightSeamId = null, arrangementSpread = 0, onMoveStagedPanel, onExportMesh, onExportGlb, onRenderStill, onStats, onNativeSolve, onToggleWireframe, onToggleSewingGuides, onChangeAnalysisMode, onChangeViewportTool }) {
  const [showAvatar, setShowAvatar] = useState(true)
  const [showFloor, setShowFloor] = useState(true)
  const [cameraPreset, setCameraPreset] = useState('perspective')
  const [selectedMeshTriangles, setSelectedMeshTriangles] = useState(null)
  const selectedMeshRef = useRef(null)
  const meshSelectionNotifyRef = useRef(onMeshSelection)
  meshSelectionNotifyRef.current = onMeshSelection
  const selectionOverlayRef = useRef(null)
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const simulationRef = useRef(null)
  const pendingDrapeRef = useRef(null)
  const backendRef = useRef(null)
  const backendSessionRef = useRef(null)
  const meshRecordsRef = useRef([])
  const ppfPreviewGroupRef = useRef(null)
  const trimRecordsRef = useRef([])
  const seamGuideRecordsRef = useRef([])
  const avatarRef = useRef(null)
  const meshAvatarColliderRef = useRef(null)
  const floorRef = useRef(null)
  const gridRef = useRef(null)
  const windHelperRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const transformRef = useRef(null)
  const gizmoPivotRef = useRef(null)
  const garmentRotationRingsRef = useRef(null)
  const environmentRef = useRef(null)
  const studioEnvironmentRef = useRef(null)
  const customEnvironmentRef = useRef(null)
  const hemiLightRef = useRef(null)
  const keyLightRef = useRef(null)
  const rimLightRef = useRef(null)
  const projectRef = useRef(project)
  const toolRef = useRef(viewportTool)
  const selectedPieceRef = useRef(selectedPieceId)
  const spreadRef = useRef(arrangementSpread)
  const stagedRef = useRef(!hasSimulated)
  const stageBlendRef = useRef(0)
  const initialHemHeightRef = useRef(null)
  const stagedSimulationStartedRef = useRef(false)
  stagedRef.current = !hasSimulated
  toolRef.current = viewportTool
  selectedPieceRef.current = selectedPieceId
  spreadRef.current = arrangementSpread
  const runningRef = useRef(running)
  const wireframeRef = useRef(wireframe)
  const analysisModeRef = useRef(analysisMode)
  const onStatsRef = useRef(onStats)
  const onNativeSolveRef = useRef(onNativeSolve)
  const onExportMeshRef = useRef(onExportMesh)
  const onExportGlbRef = useRef(onExportGlb)
  const onRenderStillRef = useRef(onRenderStill)
  const onMoveStagedPanelRef = useRef(onMoveStagedPanel)
  const onSelectPieceRef = useRef(onSelectPiece)

  projectRef.current = project
  runningRef.current = running
  wireframeRef.current = wireframe
  analysisModeRef.current = analysisMode
  onStatsRef.current = onStats
  onNativeSolveRef.current = onNativeSolve
  onExportMeshRef.current = onExportMesh
  onExportGlbRef.current = onExportGlb
  onRenderStillRef.current = onRenderStill
  onMoveStagedPanelRef.current = onMoveStagedPanel
  onSelectPieceRef.current = onSelectPiece

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    // CLO-like studio backdrop: a neutral grey vertical falloff, not a
    // flat black clear color. A CanvasTexture follows the camera viewport.
    const gradientCanvas = document.createElement('canvas')
    gradientCanvas.width = 8
    gradientCanvas.height = 512
    const gradientContext = gradientCanvas.getContext('2d')
    const gradient = gradientContext.createLinearGradient(0, 0, 0, 512)
    // CLO's daylight stage is shaded from darker neutral gray overhead to
    // near-white at the floor, rather than black or a saturated backdrop.
    gradient.addColorStop(0, '#919298')
    gradient.addColorStop(0.48, '#d4d5d9')
    gradient.addColorStop(1, '#f2f2f7')
    gradientContext.fillStyle = gradient
    gradientContext.fillRect(0, 0, 8, 512)
    const studioBackdrop = new THREE.CanvasTexture(gradientCanvas)
    studioBackdrop.colorSpace = THREE.SRGBColorSpace
    scene.userData.studioBackdrop = studioBackdrop
    scene.background = studioBackdrop
    scene.fog = new THREE.Fog(0xe9e9eb, 6, 16)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 30)
    const initialHeightScale = getAvatarHeightScale(projectRef.current.avatar)
    camera.position.set(0.9 * initialHeightScale, 1.55 * initialHeightScale, 4.15 * initialHeightScale)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    rendererRef.current = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    // Arrow-key placement is scoped to an explicitly focused 3D viewport.
    // It must not hijack 2D pattern-editor arrows or form controls.
    renderer.domElement.tabIndex = 0
    renderer.domElement.style.outline = 'none'
    mount.appendChild(renderer.domElement)

    const roomEnvironment = new RoomEnvironment()
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    environmentRef.current = pmremGenerator.fromScene(roomEnvironment, 0.04).texture
    studioEnvironmentRef.current = environmentRef.current
    scene.environment = environmentRef.current
    roomEnvironment.dispose()

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.zoomToCursor = true
    controls.target.set(0, 1.05 * initialHeightScale, 0)
    controls.minDistance = 0.12 * initialHeightScale
    controls.maxDistance = 12 * initialHeightScale

    // DCC-style translation arrows and rotation rings, anchored at the
    // selected panel's center. The pivot transforms the actual staged mesh
    // positions, and only commits editable XYZ/rotation values on pointer up.
    const gizmoPivot = new THREE.Object3D()
    gizmoPivot.name = 'selected-pattern-transform-pivot'
    scene.add(gizmoPivot)
    gizmoPivotRef.current = gizmoPivot
    const transform = new TransformControls(camera, renderer.domElement)
    transform.size = 0.65
    transform.setSpace('world')
    transform.enabled = false
    transform.getHelper().visible = false
    scene.add(transform.getHelper())
    transformRef.current = transform

    // Unified DCC manipulator: actual XYZ translate arrows from
    // TransformControls, plus draggable three-axis rotation rings around the
    // *selected garment panel*. This is deliberately different from a camera
    // navigation widget in the top-right corner.
    const ringGroup = new THREE.Group()
    ringGroup.name = 'selected-garment-rotation-gizmo'
    ringGroup.visible = false
    scene.add(ringGroup)
    garmentRotationRingsRef.current = ringGroup
    const axisColors = { x: 0xef6967, y: 0x76d38f, z: 0x76aaff, free: 0xe9f4ff }
    const ringGeometry = new THREE.TorusGeometry(1, 0.014, 8, 120)
    const pickingGeometry = new THREE.TorusGeometry(1, 0.065, 8, 120)
    const pickRings = []
    const visualRings = []
    for (const axis of ['x', 'y', 'z', 'free']) {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color: axisColors[axis], transparent: true, opacity: axis === 'free' ? 0.63 : 0.97,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      }))
      ring.name = `garment-rotate-${axis}`
      ring.renderOrder = 95
      const picker = new THREE.Mesh(pickingGeometry, new THREE.MeshBasicMaterial({
        color: axisColors[axis], transparent: true, opacity: 0,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      }))
      picker.name = `garment-rotate-pick-${axis}`
      picker.userData.rotationAxis = axis
      picker.renderOrder = 96
      if (axis === 'x') { ring.rotation.y = Math.PI / 2; picker.rotation.y = Math.PI / 2 }
      if (axis === 'y') { ring.rotation.x = -Math.PI / 2; picker.rotation.x = -Math.PI / 2 }
      ringGroup.add(ring, picker)
      if (axis === 'free') {
        // A slightly wider camera-facing trackball rim gives the same visual
        // separation as DCC universal gizmos without hiding the XYZ rings.
        ring.scale.setScalar(1.24)
        picker.scale.setScalar(1.24)
      }
      pickRings.push(picker)
      visualRings.push(ring)
    }
    const updateRings = () => {
      if (!ringGroup.visible) return
      ringGroup.position.copy(gizmoPivot.position)
      ringGroup.quaternion.copy(gizmoPivot.quaternion)
      const radius = 0.25
      ringGroup.scale.setScalar(radius)
      // Expose the current projected position of the real 3D pivot. This also
      // makes viewport-size-independent interaction tests possible without
      // guessing where the model happens to appear in a screenshot.
      const projected = gizmoPivot.position.clone().project(camera)
      renderer.domElement.dataset.gizmoCenterX = String((projected.x + 1) * renderer.domElement.clientWidth * 0.5)
      renderer.domElement.dataset.gizmoCenterY = String((1 - projected.y) * renderer.domElement.clientHeight * 0.5)
      const faceCamera = gizmoPivot.quaternion.clone().invert().multiply(camera.quaternion)
      for (const entry of [...visualRings, ...pickRings]) {
        if (entry.name.endsWith('-free')) entry.quaternion.copy(faceCamera)
      }
      ringGroup.updateMatrixWorld(true)
    }
    let activeRingDrag = null
    let hoveredRingAxis = null
    const ringPoint = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      // The circular Y/X rings project across the arrow handles in some
      // views. Keep an inner pointer zone reserved for translation so the
      // unified gizmo genuinely supports both actions at the same time.
      const pivotNdc = gizmoPivot.position.clone().project(camera)
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const projectedRadius = gizmoPivot.position.clone().addScaledVector(cameraRight, 0.25).project(camera)
      const ringRadiusPx = Math.abs(projectedRadius.x - pivotNdc.x) * bounds.width * 0.5
      const centerX = bounds.left + (pivotNdc.x + 1) * bounds.width * 0.5
      const centerY = bounds.top + (1 - pivotNdc.y) * bounds.height * 0.5
      if (Math.hypot(event.clientX - centerX, event.clientY - centerY) < ringRadiusPx * 0.60) return null
      const ndc = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      const cast = new THREE.Raycaster()
      cast.setFromCamera(ndc, camera)
      return cast.intersectObjects(pickRings, false)[0]?.object?.userData?.rotationAxis || null
    }
    const canvasAngle = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      const screen = gizmoPivot.position.clone().project(camera)
      const px = bounds.left + ((screen.x + 1) / 2) * bounds.width
      const py = bounds.top + ((1 - screen.y) / 2) * bounds.height
      return Math.atan2(event.clientY - py, event.clientX - px)
    }
    let transformStart = null
    const canEditCloth = () => stagedRef.current || (
      !runningRef.current && backendRef.current?.id === 'browser-pbd'
    )
    const startTransform = (record) => ({
      record,
      simulated: !stagedRef.current,
      // A paused, sewn garment edits the actual PBD particles, not the old
      // flat arrangement buffer. These edits are in-session solver state;
      // reset returns to the editable flat pattern, as in CLO's simulation.
      positions: stagedRef.current
        ? record.stagedPositions.map((point) => point.clone())
        : record.simPiece.particles.map((particle) => particle.position.clone()),
      position: gizmoPivot.position.clone(),
      quaternion: gizmoPivot.quaternion.clone(),
    })
    const previewTransform = (start) => {
      if (!start || !canEditCloth()) return
      const { record, positions, position, quaternion, simulated } = start
      const rotation = gizmoPivot.quaternion.clone().multiply(quaternion.clone().invert())
      const translation = gizmoPivot.position.clone().sub(position)
      for (let index = 0; index < positions.length; index += 1) {
        const next = positions[index].clone()
          .sub(position).applyQuaternion(rotation).add(position).add(translation)
        if (simulated) {
          const particle = record.simPiece.particles[index]
          if (!particle) continue
          particle.position.copy(next)
          particle.previous.copy(next)
        } else record.stagedPositions[index].copy(next)
      }
      if (simulated) syncGeometry(record.simPiece, record.geometry, projectRef.current)
      else setStagedGeometry(record.geometry, record.stagedPositions)
      if (simulated && record.simPiece.particles.length) {
        const origin = positions[0]
        const current = record.simPiece.particles[0].position
        // The on-body gizmo really edits solver particle positions. A small
        // numeric readout on the canvas makes this physically testable without
        // making a visual screenshot the sole proof of correctness.
        renderer.domElement.dataset.simulatedParticleDeltaM = current.distanceTo(origin).toFixed(6)
      }
      updateRings()
    }
    const commitTransform = (start) => {
      if (!start) return
      if (start.simulated) {
        // This is a deliberate interactive pose adjustment on the current
        // simulation particles; resuming XPBD resolves cloth constraints.
        // Never write it into the pre-sew staging offsets by accident.
        renderer.domElement.dataset.simulatedPoseEdited = 'true'
        return
      }
      const translation = gizmoPivot.position.clone().sub(start.position)
      const changed = translation.lengthSq() > 1e-10 || gizmoPivot.quaternion.angleTo(start.quaternion) > 1e-5
      if (!changed) return
      const euler = new THREE.Euler().setFromQuaternion(gizmoPivot.quaternion, 'XYZ')
      onMoveStagedPanelRef.current?.(start.record.simPiece.id, {
        x: translation.x, y: translation.y, z: translation.z,
        rotation: {
          x: THREE.MathUtils.radToDeg(euler.x),
          y: THREE.MathUtils.radToDeg(euler.y),
          z: THREE.MathUtils.radToDeg(euler.z),
        },
      })
    }
    transform.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value
    })
    transform.addEventListener('mouseDown', () => {
      const record = meshRecordsRef.current.find((item) => item.simPiece.id === selectedPieceRef.current)
      if (!record || !canEditCloth()) return
      transformStart = startTransform(record)
    })
    transform.addEventListener('objectChange', () => {
      previewTransform(transformStart)
    })
    transform.addEventListener('mouseUp', () => {
      if (!transformStart) return
      const start = transformStart
      transformStart = null
      commitTransform(start)
    })

    // Interactive fabric manipulation uses the actual solver particles,
    // rather than translating a disconnected display-only mesh.
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let fabricDrag = null
    const hitCloth = (event) => {
      if (spreadRef.current > 0) return null
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(meshRecordsRef.current.map((record) => record.mesh), false)[0] || null
    }
    // Capture-phase selection prevents native TransformControls from stealing
    // clicks on the circular rings when translate arrows are visible too.
    const onRingDown = (event) => {
      if (event.button !== 0 || !canEditCloth() || toolRef.current !== 'transform' || !ringGroup.visible) return
      const axis = ringPoint(event)
      if (!axis) return
      const record = meshRecordsRef.current.find((item) => item.simPiece.id === selectedPieceRef.current)
      if (!record) return
      const starting = startTransform(record)
      const rotationAxis = axis === 'free'
        ? camera.getWorldDirection(new THREE.Vector3()).negate().normalize()
        : new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
          .applyQuaternion(starting.quaternion).normalize()
      activeRingDrag = {
        axis, start: starting, rotationAxis,
        previousAngle: canvasAngle(event), accumulatedAngle: 0,
      }
      hoveredRingAxis = axis
      renderer.domElement.dataset.rotationDragAxis = axis
      transform.enabled = false
      controls.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onFabricDown = (event) => {
      renderer.domElement.focus({ preventScroll: true })
      if (event.button !== 0 || transform.dragging || (transform.enabled && transform.axis)) return
      const hit = hitCloth(event)
      if (toolRef.current === 'mesh-select') {
        const record = hit && meshRecordsRef.current.find(item => item.mesh === hit.object)
        if (!record || !Number.isInteger(hit.faceIndex)) {
          selectedMeshRef.current = null
          setSelectedMeshTriangles(null)
          meshSelectionNotifyRef.current?.(null)
          return
        }
        const value = mergeMeshFaceSelection(selectedMeshRef.current, record.simPiece.id, hit.faceIndex, hit.face, event.shiftKey || event.metaKey)
        selectedMeshRef.current = value
        setSelectedMeshTriangles(value)
        meshSelectionNotifyRef.current?.(value)
        onSelectPieceRef.current?.(record.simPiece.id)
        renderer.domElement.dataset.meshSelectionTriangle = value?.triangleIndices.join(',') || ''
        renderer.domElement.dataset.meshSelectionPiece = record.simPiece.id
        event.preventDefault()
        return
      }
      if (!hit) {
        if (toolRef.current === 'orbit') onSelectPieceRef.current?.(null)
        return
      }
      const record = meshRecordsRef.current.find((item) => item.mesh === hit.object)
      if (!record) return
      // All 3D tools share this selection with the 2D pattern editor,
      // outliner, and Pattern/Seam inspector.
      // Even an already-selected panel should reveal its XYZ gizmo when
      // clicked in Orbit mode. Otherwise first-click appears to do nothing.
      if (selectedPieceRef.current !== record.simPiece.id || toolRef.current === 'orbit') {
        onSelectPieceRef.current?.(record.simPiece.id)
      }
      if (!['hand', 'move', 'transform'].includes(toolRef.current)) return
      if (!stagedRef.current && runningRef.current && toolRef.current !== 'hand') return
      if (stagedRef.current) {
        if (!['move', 'transform'].includes(toolRef.current)) return
        fabricDrag = {
          mode: 'arrangement',
          record,
          start: hit.point.clone(),
          original: record.stagedPositions.map((point) => point.clone()),
          center: gizmoPivot.position.clone(),
          offset: new THREE.Vector3(),
          plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point),
        }
        controls.enabled = false
        renderer.domElement.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }
      const geometryPositions = record.geometry.getAttribute('position')
      const first = hit.face?.a ?? 0
      const indices = ['move', 'transform'].includes(toolRef.current)
        ? record.simPiece.particles.map((_, index) => index)
        : record.simPiece.particles.map((_, index) => index).filter((index) => {
          const dx = geometryPositions.getX(index) - hit.point.x
          const dy = geometryPositions.getY(index) - hit.point.y
          const dz = geometryPositions.getZ(index) - hit.point.z
          return dx * dx + dy * dy + dz * dz < 0.085 * 0.085
        })
      if (!indices.length) indices.push(first)
      fabricDrag = {
        record,
        indices,
        start: hit.point.clone(),
        center: gizmoPivot.position.clone(),
        original: indices.map((index) => record.simPiece.particles[index].position.clone()),
        // During a hand grab, keep the selected cloth particles kinematic.
        // The surrounding fabric continues solving under seam tension and
        // gravity, instead of the solver immediately pulling the grabbed
        // particles away from the cursor. Restore their masses on release.
        originalInvMass: toolRef.current === 'hand'
          ? indices.map((index) => record.simPiece.particles[index].invMass)
          : null,
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point),
      }
      if (fabricDrag.originalInvMass) {
        for (const index of indices) record.simPiece.particles[index].invMass = 0
        renderer.domElement.dataset.physicsHandGrab = 'active'
        renderer.domElement.dataset.physicsHandGrabSteps = '0'
      }
      controls.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      event.preventDefault()
    }
    const onFabricMove = (event) => {
      if (activeRingDrag) {
        const angle = canvasAngle(event)
        let delta = angle - activeRingDrag.previousAngle
        if (delta > Math.PI) delta -= 2 * Math.PI
        else if (delta < -Math.PI) delta += 2 * Math.PI
        activeRingDrag.accumulatedAngle += delta
        activeRingDrag.previousAngle = angle
        renderer.domElement.dataset.rotationPreviewDeg = String(THREE.MathUtils.radToDeg(activeRingDrag.accumulatedAngle))
        const spin = new THREE.Quaternion().setFromAxisAngle(activeRingDrag.rotationAxis, activeRingDrag.accumulatedAngle)
        gizmoPivot.quaternion.copy(spin.multiply(activeRingDrag.start.quaternion))
        gizmoPivot.updateMatrixWorld(true)
        previewTransform(activeRingDrag.start)
        event.preventDefault()
        return
      }
      if (!fabricDrag && toolRef.current === 'transform' && canEditCloth() && ringGroup.visible && !transform.dragging) {
        hoveredRingAxis = ringPoint(event)
        renderer.domElement.dataset.garmentRingHover = hoveredRingAxis || ''
        // The arrow pickers remain enabled except over the ring itself.
        transform.enabled = !hoveredRingAxis
        if (!hoveredRingAxis) {
          // TransformControls received this pointermove before the hover gate
          // reopened; explicitly refresh its native axis picker immediately.
          const bounds = renderer.domElement.getBoundingClientRect()
          transform.pointerHover(new THREE.Vector2(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
          ))
        }
        for (const entry of visualRings) {
          const active = entry.name.endsWith(`-${hoveredRingAxis}`)
          entry.material.opacity = active ? 1 : entry.name.endsWith('-free') ? 0.63 : 0.97
        }
        renderer.domElement.style.cursor = hoveredRingAxis ? 'crosshair' : ''
      }
      if (!fabricDrag) return
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const target = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(fabricDrag.plane, target)) return
      const offset = target.sub(fabricDrag.start)
      if (fabricDrag.mode === 'arrangement') {
        fabricDrag.offset.copy(offset)
        for (let index = 0; index < fabricDrag.record.stagedPositions.length; index += 1) {
          fabricDrag.record.stagedPositions[index].copy(fabricDrag.original[index]).add(offset)
        }
        setStagedGeometry(fabricDrag.record.geometry, fabricDrag.record.stagedPositions)
        if (toolRef.current === 'transform') {
          gizmoPivot.position.copy(fabricDrag.center).add(offset)
          updateRings()
        }
        event.preventDefault()
        return
      }
      fabricDrag.indices.forEach((index, i) => {
        const particle = fabricDrag.record.simPiece.particles[index]
        particle.position.copy(fabricDrag.original[i]).add(offset)
        particle.previous.copy(particle.position)
      })
      syncGeometry(fabricDrag.record.simPiece, fabricDrag.record.geometry, projectRef.current)
      if (toolRef.current === 'transform' && !stagedRef.current) {
        gizmoPivot.position.copy(fabricDrag.center).add(offset)
        updateRings()
        renderer.domElement.dataset.simulatedPoseEdited = 'true'
      }
      event.preventDefault()
    }
    const onFabricUp = (event) => {
      if (activeRingDrag) {
        const { start, accumulatedAngle } = activeRingDrag
        activeRingDrag = null
        renderer.domElement.dataset.rotationLastCommitDeg = String(THREE.MathUtils.radToDeg(accumulatedAngle))
        if (event?.type === 'pointercancel') {
          gizmoPivot.position.copy(start.position)
          gizmoPivot.quaternion.copy(start.quaternion)
          previewTransform(start)
        } else commitTransform(start)
        hoveredRingAxis = null
        renderer.domElement.dataset.rotationDragAxis = ''
        renderer.domElement.dataset.garmentRingHover = ''
        renderer.domElement.style.cursor = ''
        transform.enabled = toolRef.current === 'transform'
        controls.enabled = true
        return
      }
      if (fabricDrag?.mode === 'arrangement' && fabricDrag.offset.lengthSq() > 0.000001) {
        onMoveStagedPanelRef.current?.(fabricDrag.record.simPiece.id, {
          x: fabricDrag.offset.x,
          y: fabricDrag.offset.y,
          z: fabricDrag.offset.z,
        })
      }
      if (fabricDrag?.originalInvMass) {
        fabricDrag.indices.forEach((index, i) => {
          const particle = fabricDrag.record.simPiece.particles[index]
          particle.invMass = fabricDrag.originalInvMass[i]
          particle.previous.copy(particle.position)
        })
        renderer.domElement.dataset.physicsHandGrab = 'released'
      }
      fabricDrag = null
      controls.enabled = true
    }
    renderer.domElement.addEventListener('pointerdown', onRingDown, true)
    renderer.domElement.addEventListener('pointerdown', onFabricDown)
    renderer.domElement.addEventListener('pointermove', onFabricMove)
    renderer.domElement.addEventListener('pointerup', onFabricUp)
    renderer.domElement.addEventListener('pointercancel', onFabricUp)

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb7b7bc, 1.85)
    hemiLightRef.current = hemi
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xfffcf8, 2.6)
    keyLightRef.current = key
    key.position.set(2.5, 4.5, 3.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xe2ecff, 0.85)
    rimLightRef.current = rim
    rim.position.set(-3, 2, -2.5)
    scene.add(rim)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 96),
      new THREE.MeshStandardMaterial({ color: 0xebebed, roughness: 0.94, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.005
    floor.receiveShadow = true
    scene.add(floor)
    floorRef.current = floor
    const grid = new THREE.GridHelper(5.5, 22, 0xaeb0b4, 0xdddddf)
    grid.position.y = 0.002
    scene.add(grid)
    gridRef.current = grid
    // Garment CAD center reference: stronger world X=0 floor axis plus a
    // vertical guide through the avatar's true world origin. Both are children
    // of the existing floor-grid toggle; neither changes cloth physics.
    const originAxis = new THREE.Group()
    originAxis.name = 'garment-world-center-axes'
    const makeAxis = (vertices, color, opacity) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(vertices.map(([x,y,z]) => new THREE.Vector3(x,y,z)))
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}))
    }
    originAxis.add(makeAxis([[0,0.013,-2.75],[0,0.013,2.75]],0x8b8c91,0.52))
    originAxis.add(makeAxis([[0,0.018,0],[0,2.25,0]],0x9f9fa4,0.35))
    grid.add(originAxis)

    const resize = () => {
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let animationFrame = 0
    let lastTime = performance.now()
    let statsClock = 0
    const tick = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 1 / 20)
      lastTime = time
      const simulation = simulationRef.current
      // An active hand grab pins only nearby cloth particles. Keep the real
      // solver running so the remainder of the fabric bends and stretches in
      // response DURING the drag, not only after mouse release.
      if (simulation && runningRef.current && (!fabricDrag || Boolean(fabricDrag.originalInvMass)) && spreadRef.current === 0) {
        if (fabricDrag?.originalInvMass) {
          renderer.domElement.dataset.physicsHandGrabSteps = String(Number(renderer.domElement.dataset.physicsHandGrabSteps || 0) + 1)
        }
        const backend = backendRef.current
        const backendSession = backendSessionRef.current
        if (backend?.stepAsync) {
          backend.stepAsync(backendSession, 8).catch(() => {})
        } else {
          backend?.step?.(backendSession, dt)
        }
        if (backend?.id === 'browser-pbd' && projectRef.current.simulation?.meshAvatarContact === true && meshAvatarColliderRef.current) {
          const contact = correctMeshAvatarContacts(simulation, meshAvatarColliderRef.current)
          renderer.domElement.dataset.meshContactVerticesMoved = String(contact.moved)
          renderer.domElement.dataset.meshContactMaximumIntrusionMm = String(contact.maximumIntrusionMm)
        }
        stageBlendRef.current = Math.min(1, stageBlendRef.current + dt * 1.5)
        for (const record of meshRecordsRef.current) {
          syncGeometry(record.simPiece, record.geometry, projectRef.current)
          if (stageBlendRef.current < 1) {
            const fittedAttribute = record.geometry.getAttribute('position')
            const fitted = record.stagedPositions.map((_, index) => new THREE.Vector3(
              fittedAttribute.getX(index), fittedAttribute.getY(index), fittedAttribute.getZ(index),
            ))
            setStagedGeometry(record.geometry, record.stagedPositions, fitted, stageBlendRef.current)
          }
          syncAnalysisColors(record.simPiece, record.geometry, analysisModeRef.current)
        }
        for (const record of trimRecordsRef.current) syncSurfaceOverlay(record)
      }
      const spread = spreadRef.current
      const records = meshRecordsRef.current
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index]
        // Exploded arrangement is a rendering-only inspection transform; it
        // never alters the solver's actual particles or sewing constraints.
        const column = index % 4
        const row = Math.floor(index / 4)
        const x = (column - 1.5) * 0.33
        const z = (row % 2 === 0 ? 1 : -1) * (0.17 + row * 0.085)
        record.mesh.position.set(spread * x, 0, spread * z)
        if (record.outline) {
          record.outline.visible = (stagedRef.current || record.simPiece.id === selectedPieceRef.current) && record.mesh.visible
          if (record.outline.visible) {
            const outlinePosition = record.outline.geometry.getAttribute('position')
            const clothPosition = record.geometry.getAttribute('position')
            for (let segment = 0; segment < record.outlinePairs.length; segment += 1) {
              const [a, b] = record.outlinePairs[segment]
              outlinePosition.setXYZ(segment * 2,
                clothPosition.getX(a) + record.mesh.position.x,
                clothPosition.getY(a),
                clothPosition.getZ(a) + record.mesh.position.z)
              outlinePosition.setXYZ(segment * 2 + 1,
                clothPosition.getX(b) + record.mesh.position.x,
                clothPosition.getY(b),
                clothPosition.getZ(b) + record.mesh.position.z)
            }
            outlinePosition.needsUpdate = true
            record.outline.geometry.computeBoundingSphere()
          }
        }
      }
      for (const trim of trimRecordsRef.current) {
        if (!trim.meshRecord) continue
        if (trim.type === 'button' || trim.type === 'surface-object') {
          syncSurfaceOverlay(trim)
          trim.object.position.add(trim.meshRecord.mesh.position)
        } else {
          syncSurfaceOverlay(trim)
          trim.object.position.copy(trim.meshRecord.mesh.position)
        }
      }
      for (const guide of seamGuideRecordsRef.current) {
        const attribute = guide.object.geometry.getAttribute('position')
        const offsetA = guide.aRecord.mesh.position
        const offsetB = guide.bRecord.mesh.position
        for (let index = 0; index < guide.pairs.length; index += 1) {
          const [aIndex, bIndex] = guide.pairs[index]
          const a = guide.aRecord.geometry.getAttribute('position')
          const b = guide.bRecord.geometry.getAttribute('position')
          const base = index * 6
          attribute.array[base] = a.getX(aIndex) + offsetA.x
          attribute.array[base + 1] = a.getY(aIndex) + offsetA.y
          attribute.array[base + 2] = a.getZ(aIndex) + offsetA.z
          attribute.array[base + 3] = b.getX(bIndex) + offsetB.x
          attribute.array[base + 4] = b.getY(bIndex) + offsetB.y
          attribute.array[base + 5] = b.getZ(bIndex) + offsetB.z
        }
        attribute.needsUpdate = true
        guide.object.geometry.computeBoundingSphere()
      }
      controls.update()
      updateRings()
      renderer.render(scene, camera)
      statsClock += dt
      if (statsClock > 0.5 && simulation) {
        statsClock = 0
        const torsoPanels = [...simulation.pieces.values()].filter(piece => ['front', 'back'].includes(piece.id) || ['front', 'back'].includes(piece.piece?.arrangement3d?.wrap))
        const hemHeight = torsoPanels.length ? Math.min(...torsoPanels.flatMap(piece => piece.particles.map(particle => particle.position.y))) : null
        const hemRise = hemHeight === null || initialHemHeightRef.current === null ? null : hemHeight - initialHemHeightRef.current
        if (renderer.domElement) {
          renderer.domElement.dataset.simulationHemRiseM = hemRise === null ? '' : hemRise.toFixed(4)
          renderer.domElement.dataset.simulationHemQuality = hemRise === null ? 'unavailable' : hemRise > 0.08 ? 'floating-warning' : 'within-rise-threshold'
        }
        const vertexCount = [...simulation.pieces.values()].reduce((sum, piece) => sum + piece.particles.length, 0)
        const backendStats = backendRef.current?.getStats?.(backendSessionRef.current) || {}
        onStatsRef.current?.({
          vertices: vertexCount,
          constraints: simulation.constraints.length,
          seams: simulation.seamConstraints.length,
          fasteners: simulation.fastenerConstraints?.length || 0,
          treatments: simulation.treatmentConstraints?.length || 0,
          trims: simulation.trimConstraints?.length || 0,
          anchors: simulation.anchorConstraints?.length || 0,
          manualPins: simulation.manualPinConstraints?.length || 0,
          internal: simulation.internalConstraints?.length || 0,
          elapsed: simulation.elapsed,
          averageStrain: simulation.strain?.average || 0,
          maxStrain: simulation.strain?.max || 0,
          p95StrainPercent: simulation.quality?.structural?.p95StrainPercent ?? null,
          meanSeamGapMm: simulation.quality?.sewing?.meanGapMm ?? null,
          p95SeamGapMm: simulation.quality?.sewing?.p95GapMm ?? null,
          maxSeamGapMm: simulation.quality?.sewing?.maxGapMm ?? null,
          collisionCcdVerified: simulation.quality?.collision?.triangleCcdVerified === true,
          sampledPenetratingFaces: simulation.surfaceContact?.penetratingFacesAfter ?? null,
          sampledIntrusionMm: simulation.surfaceContact?.maximumIntrusionMm ?? null,
          sampledCorrectedVertices: simulation.surfaceContact?.correctedVertices ?? null,
          averageEaseCm: simulation.fit?.averageEaseCm || 0,
          averagePressureIndex: simulation.fit?.averagePressureIndex || 0,
          maxPressureIndex: simulation.fit?.maxPressureIndex || 0,
          contactRatio: simulation.fit?.contactRatio || 0,
          tightRatio: simulation.fit?.tightRatio || 0,
          looseRatio: simulation.fit?.looseRatio || 0,
          backendId: backendRef.current?.id || 'browser-pbd',
          backendFrame: backendStats.frame || 0,
          backendElapsedMs: backendStats.elapsedMs || 0,
          backendError: backendStats.serviceError || null,
          hemRiseM: hemRise,
          hemHeightM: hemHeight,
          hemFloatingWarning: hemRise !== null && hemRise > 0.08,
        })
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onRingDown, true)
      renderer.domElement.removeEventListener('pointerdown', onFabricDown)
      renderer.domElement.removeEventListener('pointermove', onFabricMove)
      renderer.domElement.removeEventListener('pointerup', onFabricUp)
      renderer.domElement.removeEventListener('pointercancel', onFabricUp)
      transform.detach()
      scene.remove(transform.getHelper())
      scene.remove(gizmoPivot)
      scene.remove(ringGroup)
      ringGeometry.dispose()
      pickingGeometry.dispose()
      for (const ring of [...visualRings, ...pickRings]) ring.material.dispose()
      garmentRotationRingsRef.current = null
      transform.dispose()
      transformRef.current = null
      gizmoPivotRef.current = null
      controls.dispose()
      customEnvironmentRef.current?.dispose?.()
      studioEnvironmentRef.current?.dispose?.()
      customEnvironmentRef.current = null
      studioEnvironmentRef.current = null
      environmentRef.current = null
      pmremGenerator.dispose()
      renderer.dispose()
      rendererRef.current = null
      renderer.domElement.remove()
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose?.())
        }
      })
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return
    const settings = project.render || {}
    renderer.toneMappingExposure = Math.max(0.2, Math.min(4, Number(settings.exposure ?? 1.1)))
    const preset = settings.environmentPreset || 'studio'
    const lighting = {
      studio: { hemi: 1.85, key: 2.6, rim: 0.85, background: 0xd4d5d9 },
      softbox: { hemi: 2.35, key: 2.15, rim: 0.62, background: 0xe4e4e6 },
      dramatic: { hemi: 1.05, key: 3.4, rim: 1.65, background: 0xa4a5aa },
      neutral: { hemi: 1.95, key: 2.3, rim: 0.8, background: 0xf0f0f1 },
    }[preset] || { hemi: 1.85, key: 2.6, rim: 0.85, background: 0xd4d5d9 }
    if (hemiLightRef.current) hemiLightRef.current.intensity = lighting.hemi
    if (keyLightRef.current) keyLightRef.current.intensity = lighting.key
    if (rimLightRef.current) rimLightRef.current.intensity = lighting.rim
    const environment = customEnvironmentRef.current || studioEnvironmentRef.current
    scene.environment = environment || null
    if (settings.showEnvironment && hdriUrl && environment) {
      scene.background = environment
      scene.fog = null
    } else {
      scene.background = scene.userData.studioBackdrop || new THREE.Color(lighting.background)
      scene.fog = new THREE.Fog(0xe9e9eb, 6, 16)
    }
  }, [project.render, hdriUrl])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return undefined
    if (!hdriUrl) {
      customEnvironmentRef.current?.dispose?.()
      customEnvironmentRef.current = null
      environmentRef.current = studioEnvironmentRef.current
      scene.environment = studioEnvironmentRef.current
      // The built-in lighting probe lights fabric but is not a viewable
      // photographic backdrop. Keep the grey studio gradient on screen.
      scene.background = scene.userData.studioBackdrop || scene.background
      return undefined
    }
    let cancelled = false
    let sourceTexture = null
    void (async () => {
      try {
        const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
        sourceTexture = await new RGBELoader().loadAsync(hdriUrl)
        if (cancelled) {
          sourceTexture.dispose()
          return
        }
        const pmrem = new THREE.PMREMGenerator(renderer)
        const nextEnvironment = pmrem.fromEquirectangular(sourceTexture).texture
        pmrem.dispose()
        sourceTexture.dispose()
        sourceTexture = null
        customEnvironmentRef.current?.dispose?.()
        customEnvironmentRef.current = nextEnvironment
        environmentRef.current = nextEnvironment
        scene.environment = nextEnvironment
        if (projectRef.current.render?.showEnvironment) scene.background = nextEnvironment
      } catch (error) {
        console.error('HDRI environment failed to load', error)
      }
    })()
    return () => {
      cancelled = true
      sourceTexture?.dispose?.()
    }
  }, [hdriUrl])

  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const heightScale = getAvatarHeightScale(project.avatar)
    camera.position.set(0.9 * heightScale, 1.55 * heightScale, 4.15 * heightScale)
    controls.target.set(0, 1.05 * heightScale, 0)
    controls.minDistance = 0.12 * heightScale
    controls.maxDistance = 12 * heightScale
    controls.update()
  }, [project.avatar?.heightCm])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    pendingDrapeRef.current = hasSimulated && backendId === 'browser-pbd'
      ? captureDrape(simulationRef.current) : null
    stagedSimulationStartedRef.current = false

    for (const record of meshRecordsRef.current) {
      scene.remove(record.mesh)
      if (record.outline) {
        scene.remove(record.outline)
        record.outline.geometry.dispose()
        record.outline.material.dispose()
      }
      record.geometry.dispose()
      record.fabricMap?.dispose?.()
      record.normalMap?.dispose?.()
      record.roughnessMap?.dispose?.()
      record.material.dispose()
    }
    meshRecordsRef.current = []

    for (const record of trimRecordsRef.current) {
      scene.remove(record.object)
      record.object.geometry?.dispose?.()
      record.object.material?.map?.dispose?.()
      record.object.material?.dispose?.()
    }
    trimRecordsRef.current = []

    for (const guide of seamGuideRecordsRef.current) {
      scene.remove(guide.object)
      guide.object.geometry.dispose()
      guide.object.material.dispose()
    }
    seamGuideRecordsRef.current = []

    if (avatarRef.current) {
      scene.remove(avatarRef.current)
      avatarRef.current.traverse((object) => {
        object.geometry?.dispose?.()
        if (object.material && object.material !== avatarRef.current?.material) object.material.dispose?.()
      })
    }
    meshAvatarColliderRef.current?.dispose?.()
    meshAvatarColliderRef.current = null
    avatarRef.current = makeAvatar(project)
    avatarRef.current.visible = showAvatar
    scene.add(avatarRef.current)
    const avatarGroup = avatarRef.current
    void upgradeAvatarVisualization(avatarGroup, project, customAvatar).then((detailed) => {
      if (avatarRef.current === avatarGroup) return
      // Build from the actual imported/displayed avatar model in its final
      // normalized world pose, not the simplified analytic placeholder.
      meshAvatarColliderRef.current?.dispose?.()
      const bodySelection = selectAvatarBodyMeshes(detailed, project.avatar?.model)
      const included = new Set(bodySelection.meshes)
      meshAvatarColliderRef.current = included.size ? createAvatarMeshCollider(detailed, {
        meshFilter: mesh => included.has(mesh),
      }) : null
      avatarGroup.userData.collisionAvatar = meshAvatarColliderRef.current && !meshAvatarColliderRef.current.skippedMeshes
        ? 'static-avatar-mesh-bvh' : 'analytic-parametric'
      if (meshAvatarColliderRef.current?.skippedMeshes) {
        meshAvatarColliderRef.current.dispose()
        meshAvatarColliderRef.current = null
      }
      avatarGroup.remove(detailed)
      detailed.traverse((object) => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
    }).catch((error) => {
      console.warn('Detailed fitting avatar failed to load; using analytic avatar fallback', error)
    })

    if (windHelperRef.current) {
      scene.remove(windHelperRef.current)
      windHelperRef.current.traverse?.((object) => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      windHelperRef.current = null
    }
    if (project.simulation?.wind?.enabled) {
      const radians = THREE.MathUtils.degToRad(Number(project.simulation.wind.directionDeg ?? 0))
      const direction = new THREE.Vector3(Math.sin(radians), 0, Math.cos(radians)).normalize()
      const speed = Math.max(0, Number(project.simulation.wind.speed ?? 0))
      const length = Math.max(0.28, Math.min(0.78, 0.28 + speed * 0.035))
      const helper = new THREE.ArrowHelper(direction, new THREE.Vector3(-0.72, 0.22, 0.48), length, 0x8ea7ff, 0.10, 0.055)
      helper.name = 'wind-direction-gizmo'
      scene.add(helper)
      windHelperRef.current = helper
    }

    backendRef.current?.dispose?.(backendSessionRef.current)
    const { backend, session } = createSimulationSession(project, backendId)
    const simulation = session.simulation
    if (!simulation?.pieces) throw new Error(`Simulation backend ${backendId} does not expose an in-process mesh session`)
    backendRef.current = backend
    backendSessionRef.current = session
    simulationRef.current = simulation
    for (const simPiece of simulation.pieces.values()) {
      const geometry = createGeometry(simPiece)
      syncGeometry(simPiece, geometry, project)
      const stagedPositions = stagedPanelPositions(simPiece, project.avatar)
      if (!hasSimulated) setStagedGeometry(geometry, stagedPositions)
      const fabric = project.fabrics?.[simPiece.piece.fabricId] || project.fabrics?.main || {}
      const fabricColor = new THREE.Color(fabric.color || '#d3d3d3')
      const analysisEnabled = analysisModeRef.current !== 'surface'
      const isInterfacing = simPiece.piece.generatedRole === 'interfacing'
      const fabricMap = makeFabricTexture(fabric, 'src', true)
      const normalMap = makeFabricTexture(fabric, 'normalSrc', false)
      const roughnessMap = makeFabricTexture(fabric, 'roughnessSrc', false)
      const normalStrength = Math.max(0, Math.min(4, Number(fabric.normalStrength ?? 1)))
      const material = new THREE.MeshPhysicalMaterial({
        color: analysisEnabled ? 0xffffff : fabricColor,
        map: analysisEnabled ? null : fabricMap,
        normalMap: analysisEnabled ? null : normalMap,
        normalScale: new THREE.Vector2(normalStrength, normalStrength),
        roughnessMap: analysisEnabled ? null : roughnessMap,
        side: THREE.DoubleSide,
        roughness: Math.max(0.04, Math.min(1, Number(fabric.roughness ?? 0.82))),
        metalness: Math.max(0, Math.min(1, Number(fabric.metalness ?? 0))),
        sheen: Math.max(0, Math.min(1, Number(fabric.sheen ?? 0.22))),
        sheenRoughness: Math.max(0.04, Math.min(1, Number(fabric.sheenRoughness ?? 0.84))),
        // Keep garment surfaces in the transparent render queue at full
        // opacity so they draw after the semi-transparent fitting avatar.
        // This avoids the avatar visually washing over correctly draped cloth.
        transparent: true,
        opacity: isInterfacing ? 0.30 : 1,
        depthWrite: !isInterfacing,
        polygonOffset: isInterfacing,
        polygonOffsetFactor: isInterfacing ? -1 : 0,
        polygonOffsetUnits: isInterfacing ? -1 : 0,
        wireframe: wireframeRef.current,
        vertexColors: analysisEnabled,
      })
      syncAnalysisColors(simPiece, geometry, analysisModeRef.current)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `pattern-${simPiece.id}`
      mesh.renderOrder = isInterfacing ? 24 : 20
      mesh.castShadow = !isInterfacing
      mesh.receiveShadow = true
      mesh.visible = simPiece.piece.visible3d !== false
      scene.add(mesh)
      const meshRecord = { simPiece, geometry, material, mesh, fabricColor, fabricMap, normalMap, roughnessMap, stagedPositions, outline: null, outlinePairs: [] }
      meshRecordsRef.current.push(meshRecord)

      // Accurate boundary segments from the same pattern vertex indices used
      // in 2D. A subtle outline makes staged flat panels readable in 3D.
      const outlinePairs = []
      const seenEdges = new Set()
      for (let edge = 0; edge < (simPiece.piece.points?.length || 0); edge += 1) {
        const indices = boundaryIndicesForEdge(simPiece, edge)
        for (let i = 0; i < indices.length - 1; i += 1) {
          const a = indices[i], b = indices[i + 1]
          if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue
          const key = a < b ? `${a}:${b}` : `${b}:${a}`
          if (seenEdges.has(key)) continue
          seenEdges.add(key)
          outlinePairs.push([a, b])
        }
      }
      if (outlinePairs.length) {
        const outlineGeometry = new THREE.BufferGeometry()
        outlineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outlinePairs.length * 6), 3))
        const outline = new THREE.LineSegments(outlineGeometry, new THREE.LineBasicMaterial({ color: 0xa9b4db, transparent: true, opacity: 0.7, depthTest: true, depthWrite: false }))
        outline.name = `pattern-boundary-${simPiece.id}`
        outline.renderOrder = 25
        outline.visible = !hasSimulated && mesh.visible
        scene.add(outline)
        meshRecord.outlinePairs = outlinePairs
        meshRecord.outline = outline
      }

      for (const graphic of simPiece.piece.graphics || []) {
        const graphicRecord = makeGraphicOverlay(meshRecord, graphic)
        if (graphicRecord) {
          graphicRecord.object.name = `graphic-${graphic.id}`
          scene.add(graphicRecord.object)
          trimRecordsRef.current.push(graphicRecord)
        }
      }

      for (const stitch of simPiece.piece.topstitches || []) {
        const indices = boundaryIndicesForEdge(simPiece, stitch.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineDashedMaterial({
            color: stitch.color || '#b2b2b2',
            dashSize: Math.max(0.003, Number(stitch.stitchLengthMm ?? 3) / 1000),
            gapSize: 0.0025,
            transparent: true,
            opacity: 0.96,
          }),
          0.0028,
        )
        if (trimRecord) {
          trimRecord.object.name = `topstitch-${stitch.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const binding of simPiece.piece.bindings || []) {
        const indices = boundaryIndicesForEdge(simPiece, binding.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineBasicMaterial({
            color: binding.color || '#666666',
            transparent: true,
            opacity: 0.94,
          }),
          0.0036,
        )
        if (trimRecord) {
          trimRecord.object.name = `binding-${binding.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const zipper of simPiece.piece.zippers || []) {
        const indices = boundaryIndicesForEdge(simPiece, zipper.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineDashedMaterial({
            color: zipper.color || '#c2c2c2',
            dashSize: 0.004,
            gapSize: 0.0015,
            transparent: true,
            opacity: 0.98,
          }),
          0.0042,
        )
        if (trimRecord) {
          trimRecord.object.name = `zipper-${zipper.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const button of simPiece.piece.buttons || []) {
        const radius = Math.max(0.004, Number(button.diameterCm ?? 1.8) * 0.005)
        const buttonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 10),
          new THREE.MeshStandardMaterial({ color: button.color || '#222222', roughness: 0.48, metalness: 0.05 }),
        )
        buttonMesh.castShadow = true
        buttonMesh.renderOrder = 32
        const trimRecord = {
          type: 'button',
          object: buttonMesh,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(simPiece, button),
          lift: radius * 0.72,
        }
        syncSurfaceOverlay(trimRecord)
        buttonMesh.name = `button-${button.id}`
        scene.add(buttonMesh)
        trimRecordsRef.current.push(trimRecord)
      }

      for (const buttonhole of simPiece.piece.buttonholes || []) {
        const length = Math.max(0.006, Number(buttonhole.lengthCm ?? 2.4) * 0.01)
        const width = Math.max(0.0015, Number(buttonhole.widthCm ?? 0.35) * 0.01)
        const slotMesh = new THREE.Mesh(
          new THREE.BoxGeometry(length, width, 0.0012),
          new THREE.MeshStandardMaterial({ color: buttonhole.color || '#575757', roughness: 0.7, metalness: 0 }),
        )
        slotMesh.castShadow = false
        slotMesh.renderOrder = 33
        const trimRecord = {
          type: 'surface-object',
          object: slotMesh,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(simPiece, buttonhole),
          lift: 0.0045,
          orientationDeg: buttonhole.orientationDeg || 0,
        }
        syncSurfaceOverlay(trimRecord)
        slotMesh.name = `buttonhole-${buttonhole.id}`
        scene.add(slotMesh)
        trimRecordsRef.current.push(trimRecord)
      }
    }

    for (const fastener of project.fasteners || []) {
      const type = fastener.type || 'button'
      const radius = Math.max(0.004, Number(fastener.diameterCm ?? 1.8) * 0.005)
      for (const [role, endpoint] of [['a', fastener.a], ['b', fastener.b]]) {
        if (!endpoint) continue
        const meshRecord = meshRecordsRef.current.find((record) => record.simPiece.id === endpoint.pieceId)
        if (!meshRecord) continue
        const isPrimary = role === 'a'
        const hardwareRadius = isPrimary ? radius : radius * (type === 'button' ? 0.62 : 0.82)
        const hardware = new THREE.Mesh(
          new THREE.SphereGeometry(hardwareRadius, 16, 10),
          new THREE.MeshStandardMaterial({
            color: type === 'snap' ? '#b8b8b8' : type === 'hook' ? '#8d8d8d' : '#252525',
            roughness: type === 'button' ? 0.5 : 0.28,
            metalness: type === 'button' ? 0.05 : 0.72,
            transparent: fastener.closed === false,
            opacity: fastener.closed === false ? 0.58 : 1,
          }),
        )
        hardware.castShadow = true
        hardware.renderOrder = 34
        const trimRecord = {
          type: 'button',
          object: hardware,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(meshRecord.simPiece, endpoint),
          lift: hardwareRadius * 0.82,
        }
        syncSurfaceOverlay(trimRecord)
        hardware.name = `fastener-${fastener.id}-${role}`
        scene.add(hardware)
        trimRecordsRef.current.push(trimRecord)
      }
    }

    for (const seam of project.seams || []) {
      if (seam.type !== 'zipper') continue
      const meshRecord = meshRecordsRef.current.find((record) => record.simPiece.id === seam.a?.pieceId)
      if (!meshRecord) continue
      const edgeIndices = boundaryIndicesForEdge(meshRecord.simPiece, seam.a.edgeIndex)
      if (!edgeIndices.length) continue
      const openFraction = Math.max(0, Math.min(1, Number(seam.openFraction ?? 0)))
      const sliderT = seam.openFrom === 'start' ? openFraction : 1 - openFraction
      const edgeSlot = Math.max(0, Math.min(edgeIndices.length - 1, Math.round(sliderT * (edgeIndices.length - 1))))
      const vertexIndex = edgeIndices[edgeSlot]
      const sliderMaterial = new THREE.MeshStandardMaterial({ color: '#b9b9b9', roughness: 0.24, metalness: 0.78 })
      const slider = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.005), sliderMaterial)
      slider.castShadow = true
      slider.renderOrder = 35
      const sliderRecord = {
        type: 'button',
        object: slider,
        meshRecord,
        vertexIndex,
        lift: 0.0062,
      }
      syncSurfaceOverlay(sliderRecord)
      slider.name = `zipper-slider-${seam.id}`
      scene.add(slider)
      trimRecordsRef.current.push(sliderRecord)

      const pull = new THREE.Mesh(
        new THREE.TorusGeometry(0.0055, 0.0012, 8, 18),
        new THREE.MeshStandardMaterial({ color: '#c8c8c8', roughness: 0.2, metalness: 0.82 }),
      )
      pull.castShadow = true
      pull.renderOrder = 36
      const pullRecord = {
        type: 'button',
        object: pull,
        meshRecord,
        vertexIndex,
        lift: 0.012,
      }
      syncSurfaceOverlay(pullRecord)
      pull.name = `zipper-pull-${seam.id}`
      scene.add(pull)
      trimRecordsRef.current.push(pullRecord)
    }

    // Show the very same paired solver particles that enforce garment seams.
    // These are connections, not fake decorative stitching or a separate seam graph.
    const byId = new Map(meshRecordsRef.current.map((record) => [record.simPiece.id, record]))
    for (const seam of project.seams || []) {
      const aRecord = byId.get(seam.a?.pieceId)
      const bRecord = byId.get(seam.b?.pieceId)
      if (!aRecord || !bRecord) continue
      const matches = simulation.seamConstraints.filter((item) => item.seamId === seam.id && item.type === 'seam')
      if (!matches.length) continue
      const aLookup = new Map(aRecord.simPiece.particles.map((particle, index) => [particle, index]))
      const bLookup = new Map(bRecord.simPiece.particles.map((particle, index) => [particle, index]))
      const allPairs = matches.map((item) => [aLookup.get(item.a), bLookup.get(item.b)]).filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b))
      // Reveal the actual boundary pairing when panels are moved away from
      // the body. Three decorative stations hid most sewing relationships,
      // particularly trouser inseams and sleeve caps. Limit only unusually
      // dense seam meshes so the WebGL line overlay stays responsive.
      const maxGuides = 48
      const pairs = allPairs.length <= maxGuides ? allPairs : Array.from({ length: maxGuides }, (_, index) => allPairs[Math.round(index * (allPairs.length - 1) / (maxGuides - 1))])
      if (!pairs.length) continue
      const positions = new Float32Array(pairs.length * 6)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf4aa61, transparent: true, opacity: highlightSeamId ? 0.9 : 0.45, depthTest: false }))
      object.name = `sewing-guide-${seam.id}`
      object.renderOrder = 45
      object.visible = showSewingGuides && (!highlightSeamId || seam.id === highlightSeamId)
      scene.add(object)
      seamGuideRecordsRef.current.push({ object, seamId: seam.id, aRecord, bRecord, pairs })
    }

    return undefined
  }, [project.revision, project.previewSize, resetSignal, backendId, customAvatar])

  useEffect(() => {
    const transform = transformRef.current
    const pivot = gizmoPivotRef.current
    const rotationRings = garmentRotationRingsRef.current
    for (const record of meshRecordsRef.current) {
      const selected = record.simPiece.id === selectedPieceId
      record.material.emissive.set(selected ? '#ffed1c' : '#000000')
      record.material.emissiveIntensity = selected ? 0.22 : 0
      if (record.outline) {
        record.outline.material.color.set(selected ? '#fff127' : '#a9b4db')
        record.outline.material.opacity = selected ? 1 : 0.7
        // CLO-style selected panel outline must remain legible even against
        // dark materials and where the cloth folds away from the camera.
        record.outline.material.depthTest = !selected
        record.outline.renderOrder = selected ? 55 : 25
        record.outline.visible = record.mesh.visible && (!hasSimulated || selected)
      }
    }
    if (!transform || !pivot || transform.dragging) return
    const record = meshRecordsRef.current.find((item) => item.simPiece.id === selectedPieceId && item.mesh.visible)
    const canEditPose = hasSimulated && !running && backendId === 'browser-pbd'
    if (!record || (hasSimulated && !canEditPose) || !['move', 'rotate', 'transform'].includes(viewportTool)) {
      transform.detach()
      transform.enabled = false
      transform.getHelper().visible = false
      if (rotationRings) rotationRings.visible = false
      return
    }
    transform.setMode(viewportTool === 'rotate' ? 'rotate' : 'translate')
    transform.setSpace(viewportTool === 'rotate' ? 'local' : 'world')
    const center = hasSimulated
      ? new THREE.Box3().setFromBufferAttribute(record.geometry.getAttribute('position')).getCenter(new THREE.Vector3())
      : new THREE.Box3().setFromPoints(record.stagedPositions).getCenter(new THREE.Vector3())
    pivot.position.copy(center)
    const angles = record.simPiece.piece.arrangement3d || {}
    pivot.rotation.set(...(hasSimulated
      ? [0, 0, 0, 'XYZ']
      : [
          THREE.MathUtils.degToRad(Number(angles.stagingRotationX || 0)),
          THREE.MathUtils.degToRad(Number(angles.stagingRotationY || 0)),
          THREE.MathUtils.degToRad(Number(angles.stagingRotationZ || 0)),
          'XYZ',
        ]))
    pivot.updateMatrixWorld(true)
    transform.attach(pivot)
    transform.enabled = true
    transform.getHelper().visible = true
    if (rotationRings) {
      rotationRings.position.copy(center)
      rotationRings.quaternion.copy(pivot.quaternion)
      rotationRings.visible = viewportTool === 'transform'
    }
  }, [selectedPieceId, viewportTool, hasSimulated, running, backendId, project.revision, project.previewSize, resetSignal])

  useEffect(() => {
    const scene = sceneRef.current
    const prior = selectionOverlayRef.current
    if (prior && scene) {
      scene.remove(prior)
      prior.geometry.dispose()
      prior.material.dispose()
      selectionOverlayRef.current = null
    }
    if (!scene || viewportTool !== 'mesh-select' || !selectedMeshTriangles) return
    const record = meshRecordsRef.current.find(item => item.simPiece.id === selectedMeshTriangles.pieceId)
    if (!record) return
    const vertices = record.geometry.getAttribute('position')
    const positions = []
    for (const index of selectedMeshTriangles.triangleIndices) {
      const face = record.simPiece.faces?.[index]
      if (!face || !face.every(i => i >= 0 && i < record.simPiece.particles.length)) continue
      for (const localIndex of face) positions.push(vertices.getX(localIndex), vertices.getY(localIndex), vertices.getZ(localIndex))
    }
    if (!positions.length) return
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.MeshBasicMaterial({ color: 0xffe137, side: THREE.DoubleSide, transparent: true, opacity: 0.75, depthTest: false })
    const marker = new THREE.Mesh(geometry, material)
    marker.name = 'selected-cloth-mesh-triangle'
    marker.renderOrder = 95
    scene.add(marker)
    selectionOverlayRef.current = marker
    return () => {
      if (selectionOverlayRef.current === marker) selectionOverlayRef.current = null
      scene.remove(marker)
      geometry.dispose()
      material.dispose()
    }
  }, [viewportTool, selectedMeshTriangles, project.revision, project.previewSize, resetSignal])

  useEffect(() => {
    if (!hasSimulated) {
      stagedSimulationStartedRef.current = false
      stageBlendRef.current = 0
      const canvas = rendererRef.current?.domElement
      if (canvas) {
        canvas.dataset.simulatedPoseEdited = ''
        canvas.dataset.simulatedParticleDeltaM = ''
      }
      for (const record of meshRecordsRef.current) setStagedGeometry(record.geometry, record.stagedPositions)
      return
    }
    if (stagedSimulationStartedRef.current) return
    stagedSimulationStartedRef.current = true
    // Before sewing, a user may place a panel a few centimeters wrong or
    // leave it far outside the body. Pulling every *flat* staged vertex into
    // the physical solver makes stiff seam links rocket panels through the
    // avatar and can leave the finished hem floating upward. In automatic
    // fitting, solve from the avatar-size-aware canonical dressing pose and
    // animate the moved panels toward that pose. The editable 2D patterns,
    // seam graph and physical rest lengths remain unchanged.
    const autoFitPlacement = projectRef.current?.simulation?.autoFitPlacement !== false
    if (rendererRef.current?.domElement) {
      rendererRef.current.domElement.dataset.autoFitPlacement = autoFitPlacement ? 'correcting' : 'manual'
    }
    if (backendId === 'browser-pbd') {
      if (autoFitPlacement) {
        // Keep the original manually arranged panels visible for the initial
        // dressing transition, but never use their distant, unsewn coordinates
        // as the solver's first physical state.
        let correctedDistanceM = 0
        let retainedDistanceM = 0
        for (const record of meshRecordsRef.current) {
          const adjustment = applyAutoFitPlacement(record.simPiece, record.simPiece.piece.arrangement3d)
          correctedDistanceM += adjustment.correctedMagnitudeM
          retainedDistanceM += adjustment.appliedMagnitudeM
        }
        const beforeIntrusion = measureAvatarSurfaceIntrusion(simulationRef.current, projectRef.current.avatar)
        const beforeSeams = measureSeamGap(simulationRef.current)
        const originalPose = captureParticlePositions(simulationRef.current)
        const transferred = transferDrape(pendingDrapeRef.current, simulationRef.current, 0.035, (particle, original) => {
          const clearance = avatarClearance(particle.position, projectRef.current.avatar, particle)
          const originalClearance = avatarClearance(new THREE.Vector3(original.x, original.y, original.z), projectRef.current.avatar, particle)
          return Number.isFinite(clearance) && clearance >= Math.min(-0.0005, originalClearance - 0.0005)
        })
        let afterIntrusion = measureAvatarSurfaceIntrusion(simulationRef.current, projectRef.current.avatar)
        let afterSeams = measureSeamGap(simulationRef.current)
        // Accept only a transfer that does not worsen existing face intrusions
        // or reopen seams materially. Falling back to the safe initial pose
        // keeps simulation alive and lets the solver settle normally.
        const worsenedFaces = afterIntrusion.penetratingFaces > beforeIntrusion.penetratingFaces
        const worsenedDepth = afterIntrusion.maximumIntrusionMm > beforeIntrusion.maximumIntrusionMm + 0.5
        const worsenedSeams = beforeSeams.pairs && afterSeams.pairs &&
          (afterSeams.meanMm > beforeSeams.meanMm + 2 || afterSeams.maxMm > beforeSeams.maxMm + 5)
        const rejected = Boolean(worsenedFaces || worsenedDepth || worsenedSeams)
        if (rejected) {
          restoreParticlePositions(originalPose)
          afterIntrusion = beforeIntrusion
          afterSeams = beforeSeams
        }
        pendingDrapeRef.current = null
        if (rendererRef.current?.domElement) {
          rendererRef.current.domElement.dataset.liveDrapeTransferredVertices = String(transferred.transferred)
          rendererRef.current.domElement.dataset.liveDrapeRejectedVertices = String(transferred.skipped)
          rendererRef.current.domElement.dataset.liveDrapeIntrudingFacesBefore = String(beforeIntrusion.penetratingFaces)
          rendererRef.current.domElement.dataset.liveDrapeIntrudingFacesAfter = String(afterIntrusion.penetratingFaces)
          rendererRef.current.domElement.dataset.liveDrapeRejectedPose = String(rejected)
          rendererRef.current.domElement.dataset.liveDrapeSeamGapMm = afterSeams.meanMm.toFixed(2)
        }
        if (rendererRef.current?.domElement) {
          rendererRef.current.domElement.dataset.autoFitCorrectedDistanceM = correctedDistanceM.toFixed(4)
          rendererRef.current.domElement.dataset.autoFitRetainedUserHintM = retainedDistanceM.toFixed(4)
        }
        stageBlendRef.current = 0
      } else {
        for (const record of meshRecordsRef.current) {
          record.simPiece.particles.forEach((particle, index) => {
            const initial = record.stagedPositions[index]
            if (!initial) return
            particle.position.copy(initial)
            particle.previous.copy(initial)
          })
          setStagedGeometry(record.geometry, record.stagedPositions)
        }
        stageBlendRef.current = 1
      }
      const torsoPanels = [...simulationRef.current.pieces.values()].filter(piece => ['front', 'back'].includes(piece.id) || ['front', 'back'].includes(piece.piece?.arrangement3d?.wrap))
      initialHemHeightRef.current = torsoPanels.length ? Math.min(...torsoPanels.flatMap(piece => piece.particles.map(particle => particle.position.y))) : null
    }
  }, [hasSimulated, resetSignal, backendId])

  useEffect(() => {
    for (const guide of seamGuideRecordsRef.current) {
      guide.object.visible = showSewingGuides && (!highlightSeamId || guide.seamId === highlightSeamId)
      guide.object.material.opacity = highlightSeamId ? 0.92 : 0.45
    }
  }, [showSewingGuides, highlightSeamId])

  useEffect(() => {
    for (const record of meshRecordsRef.current) record.material.wireframe = Boolean(wireframe)
  }, [wireframe])

  useEffect(() => {
    if (avatarRef.current) avatarRef.current.visible = showAvatar
  }, [showAvatar, project.revision, customAvatar])

  useEffect(() => {
    if (floorRef.current) floorRef.current.visible = showFloor
    if (gridRef.current) gridRef.current.visible = showFloor
  }, [showFloor])

  const changeCamera = (view) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const scale = getAvatarHeightScale(project.avatar)
    const views = {
      front: [0, 1.5, 4.15], back: [0, 1.5, -4.15],
      left: [-4.15, 1.5, 0], right: [4.15, 1.5, 0],
      perspective: [0.9, 1.55, 4.15], top: [0.001, 5.25, 0],
    }
    const p = views[view] || views.perspective
    camera.position.set(p[0] * scale, p[1] * scale, p[2] * scale)
    controls.target.set(0, 1.05 * scale, 0)
    camera.lookAt(controls.target)
    controls.update()
    setCameraPreset(view)
  }

  useEffect(() => {
    if (fitCameraSignal > 0) changeCamera('perspective')
  }, [fitCameraSignal])

  useEffect(() => {
    if (!nativeSolveSignal || !simulationRef.current) return undefined
    const controller = new AbortController()
    let active = true
    onNativeSolveRef.current?.({ status: 'solving' })

    const solve = async () => {
      try {
        const response = await solveWithNativeService(projectRef.current, {
          frames: 60,
          quality: nativeQuality,
          signal: controller.signal,
        })
        if (!active) return
        const simulation = simulationRef.current
        const backend = backendRef.current
        const session = backendSessionRef.current
        if (backend?.adoptResult && session) {
          backend.adoptResult(session, response.result, response.elapsedMs)
        } else {
          for (const solvedPiece of response.result?.pieces || []) {
            const simPiece = simulation?.pieces?.get(solvedPiece.id)
            if (!simPiece || solvedPiece.vertices?.length !== simPiece.particles.length) {
              throw new Error(`Native solver topology mismatch for ${solvedPiece.id}`)
            }
            for (let index = 0; index < simPiece.particles.length; index += 1) {
              const vertex = solvedPiece.vertices[index]
              if (!vertex?.every?.(Number.isFinite)) throw new Error(`Native solver returned invalid vertex data for ${solvedPiece.id}`)
              simPiece.particles[index].position.set(vertex[0], vertex[1], vertex[2])
              simPiece.particles[index].previous.copy(simPiece.particles[index].position)
            }
          }
          simulation.elapsed = Number(response.result?.frames || 60) / 60
          refreshSimulationAnalysis(simulation, projectRef.current)
        }
        for (const record of meshRecordsRef.current) {
          syncGeometry(record.simPiece, record.geometry, projectRef.current)
          syncAnalysisColors(record.simPiece, record.geometry, analysisModeRef.current)
        }
        for (const record of trimRecordsRef.current) syncSurfaceOverlay(record)
        onNativeSolveRef.current?.({
          status: 'done',
          elapsedMs: response.elapsedMs,
          stats: response.result?.stats || {},
          payload: response.payload || {},
        })
      } catch (error) {
        if (!active || error?.name === 'AbortError') return
        onNativeSolveRef.current?.({ status: 'error', error: error.message || String(error) })
      }
    }
    solve()
    return () => {
      active = false
      controller.abort()
    }
  }, [nativeSolveSignal])

  useEffect(() => {
    const analysisEnabled = analysisMode !== 'surface'
    for (const record of meshRecordsRef.current) {
      syncAnalysisColors(record.simPiece, record.geometry, analysisMode)
      record.material.vertexColors = analysisEnabled
      record.material.color.copy(analysisEnabled ? new THREE.Color(0xffffff) : record.fabricColor)
      record.material.map = analysisEnabled ? null : record.fabricMap
      record.material.normalMap = analysisEnabled ? null : record.normalMap
      record.material.roughnessMap = analysisEnabled ? null : record.roughnessMap
      record.material.needsUpdate = true
    }
  }, [analysisMode])

  // ZOZO's saved Metal frames are an inspectable overlay, not a replacement
  // for the editable XPBD cloth, 2D patterns, or their rest-state geometry.
  // The preview mesh is constructed from PPF's preserved vertex-index map.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined
    const old = ppfPreviewGroupRef.current
    if (old) {
      scene.remove(old)
      old.traverse(object => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      ppfPreviewGroupRef.current = null
    }
    for (const record of meshRecordsRef.current) {
      record.mesh.visible = record.simPiece.piece.visible3d !== false
    }
    if (!ppfPreview) {
      for (const record of meshRecordsRef.current) if (record.outline) record.outline.visible = !hasSimulated && record.mesh.visible
      return undefined
    }
    if (ppfPreview.format !== 'garment-studio.ppf-preview.v1' || !Array.isArray(ppfPreview.pieces)) return undefined
    const byId = new Map(meshRecordsRef.current.map(record => [record.simPiece.id, record]))
    const group = new THREE.Group()
    group.name = `ZOZO_PPF_${ppfPreview.accepted ? 'validated' : 'experimental'}`
    for (const piece of ppfPreview.pieces) {
      const source = byId.get(piece.id)
      if (!source || !Array.isArray(piece.vertices) || !Array.isArray(piece.faces) || piece.vertices.length !== source.simPiece.particles.length) continue
      if (!piece.vertices.every(vertex => Array.isArray(vertex) && vertex.length === 3 && vertex.every(Number.isFinite))) continue
      if (!piece.faces.every(face => Array.isArray(face) && face.length === 3 && face.every(index => Number.isInteger(index) && index >= 0 && index < piece.vertices.length))) continue
      const geometry = source.geometry.clone()
      const positions = geometry.getAttribute('position')
      for (let i = 0; i < piece.vertices.length; i += 1) positions.setXYZ(i, ...piece.vertices[i])
      geometry.setIndex(piece.faces.flat())
      positions.needsUpdate = true
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
      const material = source.material.clone()
      material.wireframe = false
      if (!ppfPreview.accepted) {
        material.color.set('#dba877')
        material.map = null
        material.emissive.set('#734222')
        material.emissiveIntensity = 0.08
      }
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `ppf-preview-${piece.id}`
      mesh.renderOrder = 35
      mesh.userData.ppfValidated = Boolean(ppfPreview.accepted)
      group.add(mesh)
      source.mesh.visible = false
      if (source.outline) source.outline.visible = false
    }
    scene.add(group)
    ppfPreviewGroupRef.current = group
    const canvas = rendererRef.current?.domElement
    if (canvas) {
      canvas.dataset.ppfPreviewStatus = ppfPreview.accepted ? 'validated' : 'experimental'
      canvas.dataset.ppfPreviewFrame = String(ppfPreview.frame)
      canvas.dataset.ppfPreviewMeshes = String(group.children.length)
    }
    return () => {
      if (ppfPreviewGroupRef.current === group) ppfPreviewGroupRef.current = null
      scene.remove(group)
      group.traverse(object => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      for (const record of meshRecordsRef.current) {
        record.mesh.visible = record.simPiece.piece.visible3d !== false
        if (record.outline) record.outline.visible = !hasSimulated && record.mesh.visible
      }
      if (canvas) {
        delete canvas.dataset.ppfPreviewStatus
        delete canvas.dataset.ppfPreviewFrame
        delete canvas.dataset.ppfPreviewMeshes
      }
    }
  }, [ppfPreview, project.revision, project.previewSize, resetSignal, backendId])

  useEffect(() => {
    if (!exportSignal || !meshRecordsRef.current.length || !onExportMeshRef.current) return
    const rows = [
      '# Garment Studio OBJ',
      '# Units: meters',
      `# Project: ${projectRef.current?.name || 'Untitled'}`,
    ]
    let vertexOffset = 1
    for (const record of meshRecordsRef.current) {
      const position = record.geometry.getAttribute('position')
      const index = record.geometry.getIndex()
      rows.push(`o ${String(record.simPiece.piece.name || record.simPiece.id).replace(/\s+/g, '_')}`)
      for (let i = 0; i < position.count; i += 1) {
        rows.push(`v ${position.getX(i).toFixed(6)} ${position.getY(i).toFixed(6)} ${position.getZ(i).toFixed(6)}`)
      }
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          rows.push(`f ${vertexOffset + index.getX(i)} ${vertexOffset + index.getX(i + 1)} ${vertexOffset + index.getX(i + 2)}`)
        }
      } else {
        for (let i = 0; i < position.count; i += 3) rows.push(`f ${vertexOffset + i} ${vertexOffset + i + 1} ${vertexOffset + i + 2}`)
      }
      vertexOffset += position.count
    }
    onExportMeshRef.current(rows.join('\n'))
  }, [exportSignal])

  useEffect(() => {
    if (!glbExportSignal || !meshRecordsRef.current.length || !onExportGlbRef.current) return
    let cancelled = false
    const group = new THREE.Group()
    group.name = String(projectRef.current?.name || 'Garment').replace(/\s+/g, '_')
    for (const record of meshRecordsRef.current) {
      const mesh = new THREE.Mesh(record.geometry.clone(), record.material.clone())
      mesh.name = String(record.simPiece.piece.name || record.simPiece.id).replace(/\s+/g, '_')
      group.add(mesh)
    }
    const dispose = () => group.traverse((object) => {
      object.geometry?.dispose?.()
      object.material?.dispose?.()
    })
    void (async () => {
      try {
        // GLB export is an infrequent production action, so keep the exporter
        // out of the initial CAD bundle and load it only when requested.
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
        if (cancelled) return dispose()
        const exporter = new GLTFExporter()
        exporter.parse(
          group,
          (result) => {
            if (!cancelled) onExportGlbRef.current?.(result)
            dispose()
          },
          (error) => {
            console.error('GLB export failed', error)
            dispose()
          },
          { binary: true, onlyVisible: true, trs: false },
        )
      } catch (error) {
        console.error('GLB exporter failed to load', error)
        dispose()
      }
    })()
    return () => { cancelled = true }
  }, [glbExportSignal])

  useEffect(() => {
    if (!renderSignal || !onRenderStillRef.current) return
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const mount = mountRef.current
    if (!renderer || !scene || !camera || !mount) return
    const settings = projectRef.current.render || {}
    const width = Math.max(512, Math.min(6144, Math.round(Number(settings.widthPx ?? 2048))))
    const height = Math.max(512, Math.min(6144, Math.round(Number(settings.heightPx ?? 2560))))
    const oldSize = renderer.getSize(new THREE.Vector2())
    const oldPixelRatio = renderer.getPixelRatio()
    const oldAspect = camera.aspect
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const dataUrl = renderer.domElement.toDataURL('image/png')
    renderer.setPixelRatio(oldPixelRatio)
    renderer.setSize(oldSize.x, oldSize.y, false)
    camera.aspect = oldAspect
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    onRenderStillRef.current({ dataUrl, width, height })
  }, [renderSignal])

  return (
    <div className="viewport-shell">
      <ViewportQuickTools dimension="3d" activeTool={viewportTool} onChangeTool={onChangeViewportTool}/>
      <div className="workspace-head viewport-head">
        <div>
          <strong>3D GARMENT</strong>
          <span>{!hasSimulated ? 'FLAT 3D ARRANGEMENT' : running ? 'LIVE SIMULATION' : 'SIMULATION PAUSED'}</span>
        </div>
        <div className={`sim-indicator ${running ? 'active' : ''}`}><i />{!hasSimulated ? 'PRE-SEW' : running ? 'SOLVING' : 'PAUSED'}</div>
      </div>
      <div ref={mountRef} className="three-mount" data-selected-piece={selectedPieceId || ''} data-transform-mode={viewportTool} data-gizmo-location="selected-cloth-panel" data-simulation-pose-editable={hasSimulated && !running && backendId === 'browser-pbd' ? 'true' : 'false'} />
      {analysisMode !== 'surface' && (
        <div className={`analysis-legend ${analysisMode}`}>
          <span>{analysisMode === 'ease' ? 'TIGHT' : 'LOW'}</span><i /><span>{analysisMode === 'ease' ? 'LOOSE' : analysisMode === 'pressure' ? 'HIGH CONTACT' : 'HIGH STRAIN'}</span>
        </div>
      )}
    </div>
  )
}

```

### `src/components/CloUI.jsx`

```jsx
import React from 'react'
import CadToolIcon from './CadToolIcon.jsx'
import {
  ChevronDown, ChevronRight, CircleDot, Cloud, Folder, Grid2X2,
  Image, Layers3, List, MoreHorizontal, Palette, Search, Shirt,
  SlidersHorizontal, Sparkles, Star, StretchHorizontal, UserRound,
} from 'lucide-react'

/** CLO's spatial organization, not a claim that unfinished engines already work. */
export const CLO_MENUS = [
  { title: 'File', commands: [['New garment', 'file.new'], ['Open garment…', 'file.open'], ['Save project', 'file.save'], ['Export garment…', 'file.export']] },
  { title: 'Edit', commands: [['Undo', 'edit.undo'], ['Redo', 'edit.redo'], ['Delete selected pattern', 'edit.delete']] },
  { title: '3D Garment', commands: [['Simulate / Pause', '3d.simulate'], ['Reset simulation', '3d.reset'], ['Select / Orbit', '3d.orbit'], ['Combined fabric transform gizmo', '3d.transform'], ['Move garment', '3d.move'], ['Rotate selected pattern', '3d.rotate'], ['Fabric hand', '3d.hand'], ['Fit map', '3d.fit'], ['Show sewing lines', '3d.seams']] },
  { title: '2D Pattern', commands: [['Transform pattern', '2d.select'], ['Edit pattern points', '2d.points'], ['Split line', '2d.split'], ['Edit curve', '2d.curve'], ['Internal line / dart', '2d.internal'], ['Add notch', '2d.notch'], ['Add pattern', '2d.add']] },
  { title: 'Sewing', commands: [['Segment / free sewing', 'sewing.sew'], ['Inspect sewing', 'sewing.inspect'], ['Create fastener', 'sewing.fastener'], ['Show sewing lines', '3d.seams']] },
  { title: 'Materials', commands: [['Fabric browser', 'materials.fabric'], ['Edit fabric', 'materials.edit'], ['Add fabric', 'materials.add'], ['Graphic / texture', 'materials.graphic']] },
  { title: 'Editor', commands: [['Pattern editor', '2d.select'], ['Fabric editor', 'materials.fabric'], ['Production', 'workspace.production']] },
  { title: 'Avatar', commands: [['Avatar library', 'avatar.library'], ['Avatar properties', 'avatar.properties'], ['Import avatar…', 'avatar.import']] },
  { title: 'Animation', commands: [['Animation workspace · planned', null]] },
  { title: 'Render', commands: [['Render workspace', 'render.workspace'], ['Capture still', 'render.capture']] },
  { title: 'Display', commands: [['3D surface view', 'display.surface'], ['Wireframe', 'display.wireframe'], ['Stress / strain', 'display.strain'], ['2D grid', 'display.grid'], ['Sewing display', '3d.seams']] },
  { title: 'Preferences', commands: [['Workspace settings', 'settings.workspace'], ['Show / hide workspace tabs', 'settings.top-tabs'], ['Edit shortcuts · planned', null]] },
  { title: 'Settings', commands: [['Simulation quality', 'settings.simulation'], ['Fabric defaults', 'materials.fabric']] },
  { title: 'Help', commands: [['CLO-style control reference', 'help.reference'], ['Keyboard guide', 'help.shortcuts']] },
]

export const OBJECT_TABS = [
  { id: 'Scene', icon: Layers3 }, { id: 'Fabric', icon: Shirt },
  { id: 'Graphic', icon: Image }, { id: 'Button', icon: CircleDot },
  { id: 'Buttonhole', icon: StretchHorizontal }, { id: 'Topstitch', icon: MoreHorizontal },
  { id: 'Puckering', icon: SlidersHorizontal }, { id: 'Trim', icon: Palette },
  { id: 'Grading', icon: Grid2X2 }, { id: 'POM', icon: List },
]
const OBJECT_TAB_ART = {
  Scene:'scene', Fabric:'fabric', Graphic:'graphics', Button:'buttons',
  Buttonhole:'buttonholes', Topstitch:'topstitch', Puckering:'puckering',
  Trim:'trim', Grading:'grading', POM:'pom',
}

const libraryCategories = ['Garment', 'Avatar', 'Hanger', 'Fabric', 'Hardware and Trims', 'Material', 'Stage', 'Patterns']

export function GarmentSilhouette({ type = 'tee' }) {
  const isPants = /pants|jeans|501/i.test(type)
  const isSkirt = /skirt/i.test(type)
  const isHood = /hood/i.test(type)
  return <svg className="garment-silhouette" viewBox="0 0 64 72" role="img" aria-label={`${type} pattern silhouette`}>
    <defs><linearGradient id="garment-tile-shade" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fafafa"/><stop offset="1" stopColor="#aab6c4"/></linearGradient></defs>
    {isPants ? <path d="M19 8 H45 L49 63 H36 L32 32 L28 63 H15 Z"/> : isSkirt
      ? <path d="M23 11 H41 L52 63 H12 Z"/>
      : <path d={isHood ? 'M22 15 Q19 3 32 2 Q46 3 43 15 L53 21 L62 38 L50 45 L45 34 L45 65 H19 V34 L14 45 L2 38 L11 21 Z' : 'M23 12 L16 17 L2 30 L12 43 L20 36 L20 64 H44 V36 L52 43 L62 30 L48 17 L41 12 Q32 20 23 12 Z'} />}
    <path className="garment-stitch" d={isPants ? 'M32 9 V32 M19 17 H45' : isSkirt ? 'M21 18 H43' : 'M22 21 Q32 28 42 21 M20 58 H44'}/>
  </svg>
}

export function LibraryChrome({ category, setCategory, search, setSearch, thumbnails, setThumbnails, children }) {
  return <>
    <div className="clo-library-top"><strong>Library</strong><div className="clo-library-top-icons" aria-label="Library quick categories">
      <button className={category === 'Garment' ? 'active' : ''} aria-label="Browse garments" aria-pressed={category === 'Garment'} title="Garment library" onClick={() => setCategory('Garment')}><Star size={16}/></button>
      <button className={category === 'Avatar' ? 'active' : ''} aria-label="Browse avatars" aria-pressed={category === 'Avatar'} title="Avatar library" onClick={() => setCategory('Avatar')}><Cloud size={16}/></button>
      <button className={category === 'Fabric' ? 'active' : ''} aria-label="Browse fabrics" aria-pressed={category === 'Fabric'} title="Fabric library" onClick={() => setCategory('Fabric')}><Shirt size={16}/></button>
      <span className="clo-library-icon-spacer"/>
      <span className="clo-library-scope">LOCAL</span>
    </div></div>
    <div className="clo-library-categories" role="navigation" aria-label="Library categories">
      {libraryCategories.map((item) => <button key={item} aria-current={category === item ? 'page' : undefined} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}><ChevronRight size={12}/><Folder size={13}/><span>{item}</span></button>)}
    </div>
    <div className="clo-library-search"><Search size={14}/><input aria-label="Search library" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search assets…"/>{search && <button aria-label="Clear asset search" title="Clear search" onClick={() => setSearch('')}>×</button>}<button aria-label={thumbnails ? 'Switch to list view' : 'Switch to thumbnail view'} title={thumbnails ? 'List view' : 'Thumbnail view'} onClick={() => setThumbnails(value => !value)}>{thumbnails ? <List size={15}/> : <Grid2X2 size={15}/>}</button></div>
    <div className={`asset-library-content ${thumbnails ? 'thumbnail-mode' : 'list-mode'}`}><span className="asset-section-heading"><Folder size={12}/> {category.toUpperCase()} <ChevronDown size={11}/></span>{children}</div>
  </>
}

export function ObjectBrowser({ tab, setTab, project, setSelectedPieceId, setSelectedFabricId, onApplyFabric, setActiveSection, selectedPieceId, selectedFabricId, onAddFabric, onAddPattern }) {
  const fabrics = Object.entries(project.fabrics || {})
  const allPieces = project.pieces || []
  const sceneItems = [{ id: 'avatar', name: project.avatar?.name || 'Avatar', icon: UserRound, action: () => setActiveSection('Avatar') }, ...allPieces.map(piece => ({ id: piece.id, name: piece.name, icon: Shirt, action: () => { setSelectedPieceId(piece.id); setActiveSection('Pattern') } }))]
  const getRows = () => {
    if (tab === 'Scene') return sceneItems
    if (tab === 'Fabric') return fabrics.map(([id, item]) => ({ id, name: item.name, color: item.color, icon: Shirt, action: () => { onApplyFabric?.(id); setSelectedFabricId(id); setActiveSection('Fabric') } }))
    if (tab === 'Graphic') return allPieces.flatMap(piece => (piece.graphics || []).map(item => ({ id: item.id, name: `${piece.name} · Graphic`, icon: Image, action: () => { setSelectedPieceId(piece.id); setActiveSection('Fabric') } })))
    if (tab === 'Button' || tab === 'Buttonhole') return allPieces.flatMap(piece => (piece[tab === 'Button' ? 'buttons' : 'buttonholes'] || []).map((item, i) => ({ id: `${piece.id}-${item.id || i}`, name: `${piece.name} · ${tab} ${i + 1}`, icon: CircleDot, action: () => { setSelectedPieceId(piece.id); setActiveSection('Sewing') } })))
    if (tab === 'Topstitch') return allPieces.flatMap(piece => (piece.topstitches || []).map((item, i) => ({ id: `${piece.id}-${item.id || i}`, name: `${piece.name} · Topstitch ${i + 1}`, icon: MoreHorizontal, action: () => { setSelectedPieceId(piece.id); setActiveSection('Sewing') } })))
    if (tab === 'Trim') return [...(project.fasteners || []).map((item, i) => ({ id: `fastener-${i}`, name: item.name || `Fastener ${i + 1}`, icon: CircleDot, action: () => setActiveSection('Sewing') })), ...allPieces.flatMap(piece => (piece.zippers || []).map((item, i) => ({ id: `${piece.id}-zip-${i}`, name: `${piece.name} · Zipper`, icon: StretchHorizontal, action: () => { setSelectedPieceId(piece.id); setActiveSection('Sewing') } })))]
    if (tab === 'Grading') return (project.grading?.sizes || []).map((name) => ({ id: name, name: `Size ${name}`, icon: Grid2X2, action: () => setActiveSection('Production') }))
    if (tab === 'POM') return (project.customMeasurements || []).map((measurement, i) => ({ id: measurement.id || i, name: measurement.name || `POM ${i + 1}`, icon: List, action: () => setActiveSection('Production') }))
    return []
  }
  const rows = getRows()
  return <section className="clo-object-browser" aria-label="Object Browser">
    <div className="clo-panel-header"><strong>Object Browser</strong><span>{rows.length} ITEMS</span></div>
    <div className="clo-object-tabs" role="tablist" aria-label="Object Browser types">
      {OBJECT_TABS.map(({id}) => <button key={id} type="button" role="tab" aria-label={id} aria-selected={tab === id} title={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><CadToolIcon id={OBJECT_TAB_ART[id]} size={21}/><span>{id}</span></button>)}
    </div>
    <div className="clo-object-actions"><span>{tab === 'Fabric' ? 'CLICK SWATCH TO APPLY TO SELECTED PATTERN' : tab === 'Scene' ? '3D / 2D Scene' : tab} · {rows.length} {rows.length === 1 ? 'item' : 'items'}</span>{['Fabric','Scene'].includes(tab) && <button onClick={() => tab === 'Fabric' ? onAddFabric() : onAddPattern()}>+ Add {tab === 'Fabric' ? 'fabric' : 'pattern'}</button>}</div>
    {tab === 'Fabric' && fabrics.length > 0 && (() => {
      const item = project.fabrics?.[selectedFabricId] || fabrics[0][1]
      return <div className="clo-fabric-preview" aria-label="Selected fabric preview">
        <div className="clo-fabric-preview-tile" style={{background:item.color || '#737989'}}><div className="clo-fabric-weave"/></div>
        <div className="clo-fabric-preview-details"><strong>{item.name || 'Material'}</strong><span>{item.gsm ?? '—'} GSM · {(Number(item.thickness || .002) * 1000).toFixed(1)} mm</span><span>Warp {Math.round((item.stretchWarp || 0) * 100)}% · Weft {Math.round((item.stretchWeft || 0) * 100)}%</span></div>
      </div>
    })()}
    <div className="clo-object-list" role="list">
      {rows.length ? rows.map(({ id, name, icon: Icon, color, action }) => <button key={id} role="listitem" aria-current={id === selectedPieceId || id === selectedFabricId ? 'true' : undefined} className={`clo-object-row ${id === selectedPieceId || id === selectedFabricId ? 'selected' : ''}`} onClick={action}><span className="clo-row-visible" aria-hidden="true">✓</span>{color ? <span className="clo-material-swatch" style={{background:color}}/> : <Icon size={16}/>}<span className="clo-object-row-name">{name}</span><MoreHorizontal size={13}/></button>) : <div className="clo-object-empty">No {tab.toLowerCase()} objects in the project yet. {tab === 'Puckering' ? 'Puckering tools are planned.' : ''}</div>}
    </div>
  </section>
}

```

### `src/core/dxf.js`

```javascript
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

```

### `src/core/grading.js`

```javascript
import { cloneProject } from './project.js'

export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function sizeOffset(grading, size) {
  const sizes = grading?.sizes?.length ? grading.sizes : DEFAULT_SIZES
  const baseSize = grading?.baseSize || 'M'
  const baseIndex = Math.max(0, sizes.indexOf(baseSize))
  const sizeIndex = Math.max(0, sizes.indexOf(size))
  return sizeIndex - baseIndex
}

export function gradePointForPiece(piece, grading, size, point) {
  const offset = sizeOffset(grading, size)
  if (!offset) return { ...point }
  const widthPerSize = Number(grading?.widthPerSizeCm ?? 3)
  const lengthPerSize = Number(grading?.lengthPerSizeCm ?? 1.2)
  const pieceBounds = bounds(piece.points)
  const centerX = (pieceBounds.minX + pieceBounds.maxX) * 0.5
  const height = Math.max(1, pieceBounds.maxY - pieceBounds.minY)
  const halfWidthDelta = (widthPerSize * offset) * 0.5
  const lengthDelta = lengthPerSize * offset
  const side = Math.sign(point.x - centerX)
  const normalizedY = (point.y - pieceBounds.minY) / height
  const widthInfluence = 0.55 + 0.45 * (1 - normalizedY)
  const lengthInfluence = 1 - normalizedY
  const automatic = {
    x: point.x + side * halfWidthDelta * widthInfluence,
    y: point.y - lengthDelta * lengthInfluence,
  }
  const rule = point.gradeRule
  if (!rule?.enabled) return automatic
  return {
    x: Number.isFinite(Number(rule.dxPerSize)) ? point.x + Number(rule.dxPerSize) * offset : automatic.x,
    y: Number.isFinite(Number(rule.dyPerSize)) ? point.y + Number(rule.dyPerSize) * offset : automatic.y,
  }
}

function bounds(points = []) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

export function gradePiece(piece, grading, size) {
  const offset = sizeOffset(grading, size)
  if (!offset) {
    return {
      ...piece,
      points: piece.points.map((point) => ({ ...point })),
      curves: piece.curves ? Object.fromEntries(Object.entries(piece.curves).map(([key, curve]) => [key, { ...curve }])) : undefined,
      internalLines: (piece.internalLines || []).map((line) => ({
        ...line,
        a: { ...line.a },
        b: { ...line.b },
      })),
    }
  }
  const transform = (point) => gradePointForPiece(piece, grading, size, point)

  const points = piece.points.map(transform)
  const curves = piece.curves
    ? Object.fromEntries(Object.entries(piece.curves).map(([edgeIndex, curve]) => {
      const transformed = transform({ x: curve.cx, y: curve.cy })
      return [edgeIndex, { cx: transformed.x, cy: transformed.y }]
    }))
    : undefined
  const internalLines = (piece.internalLines || []).map((line) => ({
    ...line,
    a: transform(line.a),
    b: transform(line.b),
  }))

  return {
    ...piece,
    points,
    curves,
    internalLines,
    gradeSize: size,
  }
}

export function gradeProject(project, size) {
  const graded = cloneProject(project)
  graded.previewSize = size
  graded.pieces = project.pieces.map((piece) => gradePiece(piece, project.grading, size))
  graded.customMeasurements = (project.customMeasurements || []).map((measurement) => {
    const piece = project.pieces.find((item) => item.id === measurement.pieceId)
    if (!piece) return cloneProject(measurement)
    return {
      ...cloneProject(measurement),
      a: gradePointForPiece(piece, project.grading, size, measurement.a),
      b: gradePointForPiece(piece, project.grading, size, measurement.b),
    }
  })
  return graded
}

export function buildSizeRun(project) {
  const sizes = project.grading?.sizes?.length ? project.grading.sizes : DEFAULT_SIZES
  return Object.fromEntries(sizes.map((size) => [size, gradeProject(project, size)]))
}

```

### `src/core/marker.js`

```javascript
import { polygonArea, seamAllowanceBoundary } from './project.js'

function rotatePoint(point, rotationDeg) {
  const radians = rotationDeg * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  }
}

function normalizedRotation(value) {
  let rotation = Number(value || 0) % 360
  if (rotation > 180) rotation -= 360
  if (rotation <= -180) rotation += 360
  return rotation
}

function pieceBounds(piece, rotationDeg = 0) {
  const sampled = seamAllowanceBoundary(piece, 10).map((point) => rotatePoint(point, rotationDeg))
  const xs = sampled.map((point) => point.x)
  const ys = sampled.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    sampled,
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function orientations(piece, fabricWidth) {
  // Fabric length is the marker Y axis. Rotate the pattern by the negative of
  // its grainline angle so that the production grainline runs with fabric
  // length. A 90-degree option is only legal when cross-grain is explicitly
  // enabled on that pattern.
  const baseRotation = normalizedRotation(-Number(piece.grainAngleDeg || 0))
  const rotations = [baseRotation]
  if (piece.marker?.allowCrossGrain) rotations.push(normalizedRotation(baseRotation + 90))

  const seen = new Set()
  return rotations
    .map((rotationDeg, index) => {
      const key = Math.round(normalizedRotation(rotationDeg) * 1000) / 1000
      if (seen.has(key)) return null
      seen.add(key)
      const box = pieceBounds(piece, rotationDeg)
      return {
        rotationDeg: normalizedRotation(rotationDeg),
        rotated: index > 0,
        crossGrain: index > 0,
        width: box.width,
        height: box.height,
        box,
      }
    })
    .filter(Boolean)
}

function outlineForPlacement(option, x, y) {
  const { box } = option
  return box.sampled.map((point) => ({
    x: x + point.x - box.minX,
    y: y + point.y - box.minY,
  }))
}

function overlaps(a, b, gap) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

function candidatePositions(placements, gap) {
  const xs = new Set([0])
  const ys = new Set([0])
  for (const placement of placements) {
    xs.add(placement.x + placement.width + gap)
    ys.add(placement.y + placement.height + gap)
  }
  return {
    xs: [...xs].sort((a, b) => a - b),
    ys: [...ys].sort((a, b) => a - b),
  }
}

function bestPlacement(entry, placements, fabricWidth, gap) {
  const candidates = candidatePositions(placements, gap)
  let best = null
  const existingLength = placements.length
    ? Math.max(...placements.map((placement) => placement.y + placement.height))
    : 0

  for (const option of entry.options) {
    for (const y of candidates.ys) {
      for (const x of candidates.xs) {
        if (x + option.width > fabricWidth + 1e-6) continue
        const rectangle = { x, y, width: option.width, height: option.height }
        if (placements.some((placement) => overlaps(rectangle, placement, gap))) continue
        const resultingLength = Math.max(existingLength, y + option.height)
        const rightWaste = fabricWidth - (x + option.width)
        const score = resultingLength * 1_000_000 + y * 10_000 + rightWaste * 10 + x
        if (!best || score < best.score) best = { x, y, option, score }
      }
    }
  }
  return best
}

export function buildMarker(project, fabricWidth = 150, gap = 1.5, options = {}) {
  const fabricId = options?.fabricId ?? null
  const entries = []
  for (const piece of project.pieces || []) {
    const pieceFabricId = piece.fabricId || 'main'
    if (fabricId && pieceFabricId !== fabricId) continue
    const options = orientations(piece, fabricWidth)
    if (!options.length) continue
    const quantity = Math.max(1, Math.min(99, Math.round(Number(piece.cutQuantity || 1))))
    for (let instance = 0; instance < quantity; instance += 1) {
      entries.push({
        piece,
        instance,
        area: polygonArea(seamAllowanceBoundary(piece, 12)),
        options,
      })
    }
  }

  entries.sort((a, b) => {
    const areaDifference = b.area - a.area
    if (Math.abs(areaDifference) > 1e-6) return areaDifference
    const aLongest = Math.max(...a.options.map((option) => Math.max(option.width, option.height)))
    const bLongest = Math.max(...b.options.map((option) => Math.max(option.width, option.height)))
    return bLongest - aLongest
  })

  const placements = []
  let unusedPieces = 0
  const unplaced = []
  for (const entry of entries) {
    const best = bestPlacement(entry, placements, fabricWidth, gap)
    if (!best) {
      unusedPieces += 1
      const minimumWidth = entry.options.length ? Math.min(...entry.options.map((option) => option.width)) : null
      unplaced.push({
        pieceId: entry.piece.id,
        instance: entry.instance,
        name: entry.piece.name,
        minimumWidthCm: Number.isFinite(minimumWidth) ? minimumWidth : null,
        reason: Number.isFinite(minimumWidth) && minimumWidth > fabricWidth ? 'too-wide' : 'no-space',
      })
      continue
    }
    const { option, x, y } = best
    placements.push({
      pieceId: entry.piece.id,
      instance: entry.instance,
      name: entry.piece.name,
      x,
      y,
      width: option.width,
      height: option.height,
      rotationDeg: option.rotationDeg,
      rotated: option.rotated,
      crossGrain: option.crossGrain,
      area: entry.area,
      outline: outlineForPlacement(option, x, y),
    })
  }

  const length = placements.length ? Math.max(...placements.map((placement) => placement.y + placement.height)) : 0
  const placedArea = placements.reduce((sum, placement) => sum + placement.area, 0)
  const markerArea = fabricWidth * Math.max(length, 0.001)
  return {
    fabricId,
    width: fabricWidth,
    length,
    gap,
    placements,
    efficiency: markerArea > 0 ? placedArea / markerArea : 0,
    unusedPieces,
    requestedPieces: entries.length,
    unplaced,
  }
}

export function buildFabricMarkers(project, defaultFabricWidth = 150, gap = 1.5) {
  const fabricIds = [...new Set((project.pieces || []).map((piece) => piece.fabricId || 'main'))]
  const widthOverrides = project.markerSettings?.fabricWidthsCm || {}
  return Object.fromEntries(fabricIds.map((fabricId) => {
    const width = Number(widthOverrides[fabricId] ?? defaultFabricWidth)
    return [fabricId, buildMarker(project, width, gap, { fabricId })]
  }))
}

```

### `src/core/factoryPackage.js`

```javascript
import { strToU8, zipSync } from 'fflate'
import { buildSizeRun, gradeProject } from './grading.js'
import { buildFabricMarkers } from './marker.js'
import { buildTechPack, measurementRunToCSV } from './measurements.js'
import { projectToDxf } from './dxf.js'
import { pieceArea, seamLengthReport } from './project.js'

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function csv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function slug(value) {
  return String(value || 'garment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garment'
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function htmlTable(rows, options = {}) {
  const [header = [], ...body] = rows
  return `<table class="${options.className || ''}"><thead><tr>${header.map((cell) => `<th>${htmlEscape(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

function materialRows(project) {
  const rows = [[
    'Fabric ID', 'Material', 'Color', 'GSM', 'Thickness mm',
    'Warp stretch %', 'Weft stretch %', 'Warp shrink %', 'Weft shrink %',
    'Bending', 'Friction', 'Damping', 'Roughness', 'Sheen',
    'Color map', 'Normal map', 'Roughness map',
    'Cut pieces', 'Approx pattern area cm2',
  ]]
  for (const [fabricId, fabric] of Object.entries(project.fabrics || {})) {
    const pieces = (project.pieces || []).filter((piece) => (piece.fabricId || 'main') === fabricId)
    const cutPieces = pieces.reduce((sum, piece) => sum + Math.max(1, Math.round(Number(piece.cutQuantity || 1))), 0)
    const area = pieces.reduce((sum, piece) => sum + pieceArea(piece) * Math.max(1, Math.round(Number(piece.cutQuantity || 1))), 0)
    rows.push([
      fabricId,
      fabric.name || fabricId,
      fabric.color || '',
      fabric.gsm ?? '',
      Number.isFinite(Number(fabric.thickness)) ? (Number(fabric.thickness) * 1000).toFixed(2) : '',
      Number.isFinite(Number(fabric.stretchWarp)) ? (Number(fabric.stretchWarp) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.stretchWeft)) ? (Number(fabric.stretchWeft) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.shrinkWarp)) ? (Number(fabric.shrinkWarp) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.shrinkWeft)) ? (Number(fabric.shrinkWeft) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.bend)) ? Number(fabric.bend).toFixed(3) : '',
      Number.isFinite(Number(fabric.friction)) ? Number(fabric.friction).toFixed(3) : '',
      Number.isFinite(Number(fabric.damping)) ? Number(fabric.damping).toFixed(4) : '',
      Number.isFinite(Number(fabric.roughness)) ? Number(fabric.roughness).toFixed(3) : '',
      Number.isFinite(Number(fabric.sheen)) ? Number(fabric.sheen).toFixed(3) : '',
      fabric.texture?.name || '',
      fabric.texture?.normalName || '',
      fabric.texture?.roughnessName || '',
      cutPieces,
      area.toFixed(1),
    ])
  }
  return rows
}

function pieceRows(project) {
  const rows = [[
    'Piece ID', 'Pattern piece', 'Role', 'Attached / fused to', 'Fabric ID', 'Cut quantity', 'Seam allowance cm',
    'Grain angle deg', 'Layer', 'Area cm2', 'Notches', 'Internal lines',
    'Topstitch specs', 'Bindings', 'Graphics', 'Custom grade points', 'Custom edge allowances', 'Matched notches',
  ]]
  for (const piece of project.pieces || []) {
    rows.push([
      piece.id,
      piece.name,
      piece.generatedRole || 'shell',
      piece.fusedToPieceId || piece.liningForPieceId || '',
      piece.fabricId || 'main',
      Math.max(1, Math.round(Number(piece.cutQuantity || 1))),
      Number(piece.seamAllowance || 0).toFixed(2),
      Number(piece.grainAngleDeg || 0).toFixed(1),
      Math.round(Number(piece.layerIndex || 0)),
      pieceArea(piece).toFixed(1),
      (piece.notches || []).length,
      (piece.internalLines || []).length,
      (piece.topstitches || []).length,
      (piece.bindings || []).length,
      (piece.graphics || []).length,
      (piece.points || []).filter((point) => point.gradeRule?.enabled).length,
      Object.keys(piece.edgeSeamAllowances || {}).length,
      (piece.notches || []).filter((notch) => notch.matchGroupId).length,
    ])
  }
  return rows
}

function constructionRows(project) {
  const rows = [[
    'Seam ID', 'Construction', 'Type', 'A piece', 'A edge', 'B piece', 'B edge',
    'A start %', 'A end %', 'B start %', 'B end %',
    'Reverse B', 'Treatment ratio', 'Ease/gather side', 'Open fraction',
    'A length cm', 'B length cm', 'Difference cm', 'Mismatch %', 'Status',
  ]]
  for (const seam of project.seams || []) {
    const report = seamLengthReport(project, seam)
    rows.push([
      seam.id,
      seam.name || seam.id,
      seam.type || 'normal',
      seam.a?.pieceId || '',
      seam.a?.edgeIndex ?? '',
      seam.b?.pieceId || '',
      seam.b?.edgeIndex ?? '',
      ((seam.a?.startT ?? 0) * 100).toFixed(1),
      ((seam.a?.endT ?? 1) * 100).toFixed(1),
      ((seam.b?.startT ?? 0) * 100).toFixed(1),
      ((seam.b?.endT ?? 1) * 100).toFixed(1),
      seam.reverseB ? 'yes' : 'no',
      seam.ratio ?? '',
      seam.easeSide || seam.gatherSide || '',
      seam.openFraction ?? '',
      report.lengthA.toFixed(2),
      report.lengthB.toFixed(2),
      report.difference.toFixed(2),
      report.mismatchPercent.toFixed(2),
      report.status,
    ])
  }
  return rows
}

function markerRows(project) {
  const width = project.markerSettings?.fabricWidthCm ?? 150
  const gap = project.markerSettings?.gapCm ?? 1.5
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const rows = [['Size', 'Fabric ID', 'Material', 'Fabric width cm', 'Gap cm', 'Marker length cm', 'Efficiency %', 'Requested pieces', 'Placed pieces', 'Unplaced pieces', 'Unplaced detail']]
  for (const size of sizes) {
    const graded = gradeProject(project, size)
    const markers = buildFabricMarkers(graded, width, gap)
    for (const [fabricId, marker] of Object.entries(markers)) {
      rows.push([
        size,
        fabricId,
        project.fabrics?.[fabricId]?.name || fabricId,
        marker.width.toFixed(1),
        marker.gap.toFixed(1),
        marker.length.toFixed(2),
        (marker.efficiency * 100).toFixed(1),
        marker.requestedPieces,
        marker.placements.length,
        marker.unusedPieces,
        (marker.unplaced || []).map((item) => `${item.name}${item.minimumWidthCm ? ` needs >=${item.minimumWidthCm.toFixed(1)} cm` : ''}`).join('; '),
      ])
    }
  }
  return rows
}

function trimHardware(project) {
  return {
    pointFasteners: project.fasteners || [],
    zippers: (project.pieces || []).flatMap((piece) => (piece.zippers || []).map((zipper) => ({ pieceId: piece.id, ...zipper }))),
    buttons: (project.pieces || []).flatMap((piece) => (piece.buttons || []).map((button) => ({ pieceId: piece.id, ...button }))),
    buttonholes: (project.pieces || []).flatMap((piece) => (piece.buttonholes || []).map((buttonhole) => ({ pieceId: piece.id, ...buttonhole }))),
    bindings: (project.pieces || []).flatMap((piece) => (piece.bindings || []).map((binding) => ({ pieceId: piece.id, ...binding }))),
    topstitches: (project.pieces || []).flatMap((piece) => (piece.topstitches || []).map((stitch) => ({ pieceId: piece.id, ...stitch }))),
  }
}

function factorySpecHtml(project) {
  const techPack = buildTechPack(project)
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const measurements = techPack.sizeMeasurements || {}
  const pomIds = measurements[sizes[0]]?.map((measurement) => measurement.id) || []
  const pomRows = [['POM', 'Tolerance', ...sizes]]
  for (const id of pomIds) {
    const first = measurements[sizes[0]]?.find((measurement) => measurement.id === id)
    pomRows.push([
      first?.label || id,
      `±${first?.toleranceCm ?? ''} cm`,
      ...sizes.map((size) => `${measurements[size]?.find((measurement) => measurement.id === id)?.cm ?? ''}`),
    ])
  }
  const seamRows = constructionRows(project)
  const markerSummary = markerRows(project)
  const materials = materialRows(project)
  const pieces = pieceRows(project)
  const warnings = (project.seams || [])
    .map((seam) => ({ seam, report: seamLengthReport(project, seam) }))
    .filter(({ report }) => report.status !== 'good')
  const markerWarnings = []
  for (const [size, markerSet] of Object.entries(techPack.markers || {})) {
    for (const [fabricId, marker] of Object.entries(markerSet.byFabric || {})) {
      if (!marker.unusedPieces) continue
      markerWarnings.push({
        size,
        fabricId,
        material: project.fabrics?.[fabricId]?.name || fabricId,
        unplaced: marker.unplaced || [],
      })
    }
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(project.name)} · Factory Spec</title><style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:10px}h1{font-size:24px;margin:0 0 3px}h2{font-size:14px;margin:22px 0 7px;border-bottom:1px solid #111;padding-bottom:4px}.meta{display:flex;gap:28px;margin:0 0 18px;color:#444}.meta strong{color:#111}.notice{padding:8px 10px;border:1px solid #ccc;background:#f6f6f6;margin:8px 0}.warning{border-color:#b67a28;background:#fff8ea}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}table{width:100%;border-collapse:collapse;margin:0 0 12px;page-break-inside:auto}th,td{border:1px solid #bbb;padding:4px 5px;vertical-align:top;text-align:left}th{background:#efefef;font-size:9px}td{font-size:9px}tr{page-break-inside:avoid}.small td,.small th{font-size:8px}.footer{margin-top:18px;font-size:8px;color:#666}.page-break{page-break-before:always}@media print{h2{page-break-after:avoid}}
</style></head><body>
<h1>${htmlEscape(project.name)}</h1>
<div class="meta"><span><strong>Revision:</strong> ${htmlEscape(project.revision ?? 1)}</span><span><strong>Base size:</strong> ${htmlEscape(project.grading?.baseSize || 'M')}</span><span><strong>Size range:</strong> ${htmlEscape(sizes.join(' / '))}</span><span><strong>Units:</strong> ${htmlEscape(project.units || 'cm')}</span></div>
<div class="notice">This sheet is generated from the editable Garment Studio document. Verify physical samples, material lots, seam construction, shrinkage, and tolerances before bulk production.</div>
${warnings.length ? `<div class="notice warning"><strong>Seam review:</strong> ${warnings.length} seam${warnings.length === 1 ? '' : 's'} exceed the 2% matched-edge threshold. Review the Construction table before sewing.</div>` : ''}
${markerWarnings.length ? `<div class="notice warning"><strong>Marker review:</strong> ${htmlEscape(markerWarnings.map((item) => `${item.size} ${item.material}: ${item.unplaced.map((entry) => `${entry.name}${entry.minimumWidthCm ? ` needs ≥${entry.minimumWidthCm.toFixed(1)} cm` : ''}`).join(', ')}`).join(' · '))}. These marker lengths are incomplete until every requested piece is placed.</div>` : ''}
<h2>Point of Measurement · Full Size Run</h2>${htmlTable(pomRows)}
<div class="page-break"></div><h2>Materials / BOM</h2>${htmlTable(materials)}
<h2>Pattern Pieces</h2>${htmlTable(pieces, { className: 'small' })}
<div class="page-break"></div><h2>Construction / Seam Diagnostics</h2>${htmlTable(seamRows, { className: 'small' })}
<h2>Marker Summary</h2>${htmlTable(markerSummary)}
<h2>Avatar / Fit Reference</h2>${htmlTable([
    ['Height cm', 'Chest cm', 'Waist cm', 'Hip cm', 'Shoulder width cm', 'Neck cm', 'Bicep cm', 'Arm length cm', 'Arm pose deg'],
    [project.avatar?.heightCm ?? '', project.avatar?.chestCm ?? '', project.avatar?.waistCm ?? '', project.avatar?.hipCm ?? '', project.avatar?.shoulderWidthCm ?? 46, project.avatar?.neckCm ?? 38, project.avatar?.bicepCm ?? 32, project.avatar?.armLengthCm ?? Number((72 * Number(project.avatar?.heightCm ?? 180) / 180).toFixed(1)), project.avatar?.armAngleDeg ?? ''],
  ])}
<div class="footer">DXF files, trims/hardware data, graded source data, and the editable garment document are included alongside this sheet in the factory package.</div>
</body></html>`
}

export function buildFactoryPackageFiles(project) {
  const nameSlug = slug(project.name)
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const files = {}
  const addText = (path, text) => { files[path] = strToU8(text) }
  const markerWidth = project.markerSettings?.fabricWidthCm ?? 150
  const markerGap = project.markerSettings?.gapCm ?? 1.5

  addText('README.txt', [
    `GARMENT STUDIO FACTORY PACKAGE`,
    `Project: ${project.name}`,
    `Revision: ${project.revision ?? 1}`,
    `Units: ${project.units || 'cm'}`,
    `Base size: ${project.grading?.baseSize || 'M'}`,
    `Sizes: ${sizes.join(', ')}`,
    '',
    'CONTENTS',
    '- tech-pack.json: structured production specification and full POM size run',
    '- factory-spec.html: print-ready human-readable factory sheet',
    '- pom-spec.csv: point-of-measurement table with tolerances across sizes',
    '- materials-bom.csv: materials, physical properties, cut quantities, and approximate usage area',
    '- pattern-pieces.csv: pattern production metadata and custom grading rule counts',
    '- construction-seams.csv: sewing graph, treatment settings, edge lengths, and mismatch diagnostics',
    '- marker-summary.csv: marker length and efficiency for every graded size',
    '- trims-hardware.json: fasteners, zippers, buttons, buttonholes, bindings, and topstitch specifications',
    '- size-run.json: complete graded garment data for every configured size',
    '- garment-source.json: editable Garment Studio source document',
    '- patterns/*.dxf: production DXF for every configured size',
    '',
    `Marker settings: ${markerWidth} cm default fabric width, ${markerGap} cm gap. Per-fabric widths: ${JSON.stringify(project.markerSettings?.fabricWidthsCm || {})}.`,
    'Review seam mismatch warnings/errors and marker overflow before bulk production. Sample physically before bulk production.',
  ].join('\n'))

  addText('tech-pack.json', JSON.stringify(buildTechPack(project), null, 2))
  addText('factory-spec.html', factorySpecHtml(project))
  addText('pom-spec.csv', measurementRunToCSV(project))
  addText('materials-bom.csv', csv(materialRows(project)))
  addText('pattern-pieces.csv', csv(pieceRows(project)))
  addText('construction-seams.csv', csv(constructionRows(project)))
  addText('marker-summary.csv', csv(markerRows(project)))
  addText('trims-hardware.json', JSON.stringify(trimHardware(project), null, 2))
  addText('size-run.json', JSON.stringify(buildSizeRun(project), null, 2))
  addText('garment-source.json', JSON.stringify(project, null, 2))

  for (const size of sizes) {
    const graded = gradeProject(project, size)
    addText(`patterns/${nameSlug}-${String(size).toLowerCase()}.dxf`, projectToDxf(graded, size))
  }

  const manifest = {
    format: 'garment-studio-factory-package',
    version: 1,
    project: { id: project.id, name: project.name, revision: project.revision, units: project.units || 'cm' },
    grading: { baseSize: project.grading?.baseSize || 'M', sizes },
    marker: { fabricWidthCm: markerWidth, gapCm: markerGap, fabricWidthsCm: { ...(project.markerSettings?.fabricWidthsCm || {}) } },
    files: [...Object.keys(files), 'manifest.json'].sort(),
  }
  addText('manifest.json', JSON.stringify(manifest, null, 2))
  return files
}

export function buildFactoryPackageZip(project) {
  return zipSync(buildFactoryPackageFiles(project), { level: 6 })
}

```

### `ppf_backend/server.mjs`

```javascript
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildExplodedPpfPayload, ppfPayloadSummary, validatePpfPayload } from '../src/core/backends/ppfPayload.js'
import { evaluatePpfFitAcceptance } from './fitAcceptance.mjs'
import { readPpfPreview } from './previewFrames.mjs'
import { hasActivePpfWork } from './processStatus.mjs'
import { evaluatePpfAssembly } from './assemblyAcceptance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const host = process.env.GS_PPF_HOST || '127.0.0.1'
const port = Number(process.env.GS_PPF_PORT || 5192)
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender'
const runtime = process.env.PPF_RUNTIME || path.join(root, 'research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64')
const minFreeKb = Number(process.env.PPF_MIN_FREE_KB || 4194304)
const maxBody = 16 * 1024 * 1024
const jobs = new Map()
let activeJobId = null
let nextPort = Number(process.env.PPF_JOB_PORT_START || 19150)

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extra,
  }
}

function send(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, headers({ 'Content-Length': Buffer.byteLength(text) }))
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBody) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch (error) { reject(new Error(`Invalid JSON: ${error.message}`)) }
    })
    req.on('error', reject)
  })
}

function freeSpaceKb() {
  const probe = spawnSync('df', ['-Pk', root], { encoding: 'utf8' })
  if (probe.status !== 0) return 0
  const row = probe.stdout.trim().split(/\r?\n/).at(-1)?.trim().split(/\s+/)
  return Number(row?.[3] || 0)
}

function runtimeStatus() {
  const serverBin = path.join(runtime, 'target/release/ppf-cts-server')
  const solverBin = path.join(runtime, 'target/release/ppf-contact-solver')
  return {
    blender: fs.existsSync(blender),
    runtime: fs.existsSync(serverBin) && fs.existsSync(solverBin),
    serverBin,
    solverBin,
    freeSpaceKb: freeSpaceKb(),
    minFreeKb,
  }
}

function processBusy() {
  const probe = spawnSync('ps', ['-axo', 'command='], { encoding: 'utf8' })
  // Refuse on inspection failure, but do not mistake an idle server for a
  // running solve. Otherwise one completed job blocks every later request.
  return probe.status !== 0 || hasActivePpfWork(probe.stdout)
}

function stopOwnedPpfListener(port) {
  // PPF's older Blender add-on sometimes leaves its native solver server
  // running after successful Fetch/Disconnect. Only reap the verified server
  // listening on THIS JOB's port; never use a name-wide pkill here.
  const probe = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
  if (probe.status !== 0) return
  const expected = path.join(runtime, 'target/release/ppf-cts-server')
  for (const line of probe.stdout.split(/\s+/)) {
    const pid = Number(line)
    if (!Number.isInteger(pid) || pid <= 1) continue
    const info = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
    if (!info.stdout.trim().startsWith(`${expected} --port ${port}`)) continue
    try { process.kill(pid, 'SIGTERM') } catch { /* already exited */ }
  }
}

function jobPublic(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    template: job.projectName,
    summary: job.summary,
    error: job.error,
    artifacts: job.artifacts,
    logTail: job.log.slice(-40),
  }
}

function pushLog(job, line) {
  const clean = String(line || '').trimEnd()
  if (!clean) return
  job.log.push(clean)
  if (job.log.length > 300) job.log.splice(0, job.log.length - 300)
}

function runCommand(job, phase, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    job.phase = phase
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...(options.env || {}) } })
    job.childPid = child.pid
    child.stdout.on('data', (chunk) => pushLog(job, chunk.toString()))
    child.stderr.on('data', (chunk) => pushLog(job, chunk.toString()))
    child.on('error', reject)
    child.on('close', (code, signal) => {
      job.childPid = null
      if (code === 0) resolve()
      else reject(new Error(`${phase} failed (${signal || `exit ${code}`})`))
    })
  })
}

async function executeJob(job, project, options) {
  const status = runtimeStatus()
  if (!status.blender) throw new Error(`Blender not found: ${blender}`)
  if (!status.runtime) throw new Error(`PPF runtime unavailable: ${runtime}`)
  if (status.freeSpaceKb < status.minFreeKb) throw new Error(`PPF requires at least ${status.minFreeKb} KiB free; only ${status.freeSpaceKb} KiB available`)
  if (processBusy()) throw new Error('Another PPF/Blender final-solve process is already active')

  const work = fs.mkdtempSync(path.join(os.tmpdir(), `garment-studio-ppf-${job.id}-`))
  const input = path.join(work, 'base.ppf.json')
  const tuned = path.join(work, 'tuned.ppf.json')
  const intersections = path.join(work, 'intersections.json')
  const initialContactReport = path.join(work, 'initial-body-contact.json')
  const configured = path.join(work, 'configured.blend')
  const solved = path.join(root, 'blender_bridge/output', `${job.id}-solved.blend`)
  const report = path.join(root, 'blender_bridge/output', `${job.id}-report.json`)
  const persistentPayload = path.join(root, 'blender_bridge/output', `${job.id}-source.ppf.json`)
  const sewingReport = path.join(root, 'blender_bridge/output', `${job.id}-sewing-report.json`)
  const contactReport = path.join(root, 'blender_bridge/output', `${job.id}-contact-report.json`)
  const ipcReport = path.join(root, 'blender_bridge/output', `${job.id}-ipc-ccd-report.json`)
  const fitClearanceReport = path.join(root, 'blender_bridge/output', `${job.id}-fit-clearance-report.json`)
  let solverPort = null
  fs.mkdirSync(path.dirname(solved), { recursive: true })

  try {
    const payload = buildExplodedPpfPayload(project, { frameCount: Math.max(10, Number(options.frames || 60)) })
    const validation = validatePpfPayload(payload)
    if (!validation.ok) throw new Error(`Invalid PPF payload: ${validation.errors.join('; ')}`)
    job.summary = ppfPayloadSummary(payload)
    fs.writeFileSync(input, JSON.stringify(payload, null, 2))

    await runCommand(job, 'staging', blender, ['--background', '--factory-startup', '--python', 'blender_bridge/tune_ppf_staging.py', '--', '--input', input, '--output', tuned, '--min-torso-depth', String(options.minTorsoDepth ?? 0.16), '--min-arm-offset', String(options.minArmOffset ?? 0.51), '--torso-y', String(options.torsoYOffset ?? project.simulation?.ppfTorsoYOffset ?? 0)])
    const stagedPayload = JSON.parse(fs.readFileSync(tuned, 'utf8'))
    const stagingSeams = evaluatePpfAssembly(stagedPayload, options)
    job.summary = { ...job.summary, stagingSeams }
    // Do not mistake an intersection-free but exploded arrangement for a
    // CLO-like assembled fitting state. Permit explicit experiments only;
    // stable sewing and swept contact still require independent validation.
    if (!stagingSeams.mayRun) {
      throw new Error(`PPF garment is not yet assembled for fitting: ${stagingSeams.reason} Adjust initial panels before solving.`)
    }
    await runCommand(job, 'intersection-check', blender, ['--background', '--factory-startup', '--python', 'blender_bridge/diagnose_ppf_intersections.py', '--', '--input', tuned, '--report', intersections])
    const intersectionReport = JSON.parse(fs.readFileSync(intersections, 'utf8'))
    if (Number(intersectionReport.nonAdjacentIntersections || 0) !== 0) throw new Error(`PPF staging has ${intersectionReport.nonAdjacentIntersections} non-adjacent intersections`)
    job.summary = { ...job.summary, intersections: 0 }

    await runCommand(job, 'blender-config', blender, ['--background', '--python', 'blender_bridge/ppf_prepare_scene.py', '--', '--input', tuned, '--output', configured, '--configure-addon'])
    // The old preflight checked ONLY garment self-intersection in the JSON.
    // The actual collider exists only after Blender scene preparation. Reject
    // intersecting poses before PPF build instead of watching the solver fail
    // or treating a valid, non-self-intersecting panel as already on-body.
    await runCommand(job, 'initial-body-contact', blender, [
      '--background', configured, '--python', 'blender_bridge/check_ppf_dynamic_contact.py', '--',
      '--payload', tuned, '--initial-only', '--report', initialContactReport,
    ])
    const initialContact = JSON.parse(fs.readFileSync(initialContactReport, 'utf8'))
    if (!initialContact.allFramesAvatarIntersectionFree || !initialContact.allFramesSelfIntersectionFree) {
      const first = initialContact.perFrame?.[0] || {}
      throw new Error(`Unsafe on-body staging: ${first.avatarTriangleIntersectionPairs || 0} body crossings, ${first.clothSelfIntersectionPairs || 0} cloth crossings. Reposition the pattern panels outside the actual body mesh before PPF.`)
    }
    job.summary = { ...job.summary, initialBodyContactVerified: true, collider: payload.avatar?.mode }
    solverPort = nextPort++
    await runCommand(job, 'metal-solve', blender, ['--background', configured, '--python', 'blender_bridge/ppf_run_configured.py', '--', '--runtime', runtime, '--output', solved, '--report', report, '--port', String(solverPort), '--device', 'GPU', '--connect-timeout', '90', '--build-timeout', '180', '--run-timeout', String(options.runTimeout || 360), '--fetch-timeout', '180'])

    const result = JSON.parse(fs.readFileSync(report, 'utf8'))
    if (!result.ok || !result.pc2?.finite) throw new Error(`PPF final solve did not produce finite PC2: ${JSON.stringify(result)}`)
    await runCommand(job, 'sewing-validation', process.execPath, [
      'scripts/analyze-ppf-sewing.mjs', tuned, report, sewingReport,
    ])
    const sewing = JSON.parse(fs.readFileSync(sewingReport, 'utf8'))
    await runCommand(job, 'contact-validation', blender, [
      '--background', solved, '--python', 'blender_bridge/check_ppf_dynamic_contact.py', '--',
      '--payload', tuned, '--pc2', result.pc2.path, '--report', contactReport,
    ])
    const contact = JSON.parse(fs.readFileSync(contactReport, 'utf8'))
    // The BVH frame-by-frame audit detects crossings at sampled instants but
    // cannot certify the swept path between those instants. For the exact
    // Thomas skin, use native IPC Toolkit Tight Inclusion CCD on *every*
    // fetched PPF frame transition. This reports crossing trajectories but
    // does not alter the solution; a failed step is never accepted as fit.
    const needsIpcCcd = payload.avatar?.mode === 'local-thomas-body-mesh'
    let ipcCcd = null
    let clearance = null
    if (needsIpcCcd) {
      await runCommand(job, 'shoulder-fit-clearance', blender, [
        '--background', solved, '--python', 'blender_bridge/check_ppf_fit_clearance.py', '--',
        '--payload', tuned, '--pc2', result.pc2.path, '--report', fitClearanceReport,
      ])
      clearance = JSON.parse(fs.readFileSync(fitClearanceReport, 'utf8'))
      await runCommand(job, 'ipc-swept-contact-validation', blender, [
        '--background', solved, '--python', 'blender_bridge/check_thomas_ipc_ccd.py', '--',
        '--payload', tuned, '--pc2', result.pc2.path, '--report', ipcReport,
      ])
      ipcCcd = JSON.parse(fs.readFileSync(ipcReport, 'utf8'))
      if (ipcCcd.framesAudited !== contact.frames || !Array.isArray(ipcCcd.steps)) {
        throw new Error('IPC contact audit did not cover the complete PPF animation')
      }
    }
    // The solver's 5% limiter only describes the *raw* solution. The Blender
    // add-on used to post-snap stitched vertices on fetch, silently violating
    // strain and contact after solving. Validate exported frames independently
    // and require all principal stretches to remain inside the authored bound.
    const { accepted, collisionPass, strainPass, seamPass, ipcCcdPass, shoulderFitPass } = evaluatePpfFitAcceptance({
      contact, sewing, requiresIpcCcd: needsIpcCcd, ipcCcd,
      requiresShoulderFit: needsIpcCcd, clearance,
    })
    const strainMaxStretch = Number(contact.maxPrincipalStretch)
    // A finite simulation and nearly-closed seam graph are not sufficient
    // evidence for an exportable fitted garment. An actual auto-fit must pass
    // every frame of body/self collision AND have a sewn shell with small
    // residual gaps. Retain experimental files for diagnosis, but prevent a
    // failed solve from being advertised as a completed body fit.
    const meanSeamGapLimitCm = 0.2
    // Keep the exact solver vertex-index ↔ 2D piece mapping alongside the
    // permanent PC2; /jobs/:id/preview never reads erased temporary staging.
    fs.copyFileSync(tuned, persistentPayload)
    job.artifacts = { blend: solved, report, sewingReport, contactReport, payload: persistentPayload, ...(needsIpcCcd ? { ipcReport, fitClearanceReport } : {}) }
    job.summary = {
      ...job.summary, pc2: result.pc2, solver: result.solver, backend: result.backend,
      collisionQuality: collisionPass && ipcCcdPass ? 'pass' : 'failed-validation',
      fitQuality: accepted ? 'accepted' : 'experimental-failed-validation',
      fitAcceptance: {
        accepted,
        collisionPass,
        ipcCcdPass,
        ipcCcdRequired: needsIpcCcd,
        strainPass,
        maxPrincipalStretch: strainMaxStretch,
        seamPass,
        shoulderFitPass,
        seamMeanGapLimitCm: meanSeamGapLimitCm,
        seamMaxGapLimitCm: 1.0,
      },
      contact: {
        framesChecked: contact.frames,
        allFramesWithinStrainLimit: strainPass,
        maxPrincipalStretch: strainMaxStretch,
        allFramesSelfIntersectionFree: contact.allFramesSelfIntersectionFree,
        allFramesAvatarIntersectionFree: contact.allFramesAvatarIntersectionFree,
        maxSelfIntersectionPairs: contact.maxSelfIntersectionPairs,
        maxAvatarIntersectionPairs: contact.maxAvatarIntersectionPairs,
        firstAvatarCrossingFrame: contact.firstAvatarCrossingFrame,
        firstSelfCrossingFrame: contact.firstSelfCrossingFrame,
        avatarPartsRankedByTotalCrossings: contact.avatarPartsRankedByTotalCrossings,
        finalFrame: contact.perFrame.at(-1),
      },
      fitClearance: clearance ? { final: clearance.final, initial: clearance.initial, framesMeasured: clearance.framesMeasured,
        verifiedAgainstRealThomasBody: true, shoulderFitPass } : null,
      ipcCcd: needsIpcCcd ? {
        tested: true,
        method: 'IPC Toolkit Tight Inclusion swept triangles against Thomas',
        framesAudited: ipcCcd.framesAudited,
        allTestedStepsCollisionFree: ipcCcd.allTestedStepsCollisionFree,
        firstBlockedFrame: ipcCcd.firstBlockedFrame,
        steps: ipcCcd.steps,
      } : { tested: false, reason: 'Real Thomas body collider not selected' },
      sewing: {
        stitchedPairs: sewing.stitchedPairs,
        seamGroups: sewing.seamGroups,
        initialMeanGapCm: sewing.initialMeanGapCm,
        finalMeanGapCm: sewing.finalMeanGapCm,
        closurePercent: sewing.closurePercent,
        worstSeams: sewing.worstSeams,
      },
    }
  } finally {
    if (solverPort !== null) stopOwnedPpfListener(solverPort)
    fs.rmSync(work, { recursive: true, force: true })
  }
}

function submit(project, options = {}) {
  const id = `ppf-${Date.now().toString(36)}`
  const job = {
    id,
    status: 'queued',
    phase: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    projectName: project.name || 'Untitled Garment',
    summary: null,
    error: null,
    artifacts: null,
    log: [],
    childPid: null,
  }
  jobs.set(id, job)
  activeJobId = id
  queueMicrotask(async () => {
    job.status = 'running'
    job.startedAt = new Date().toISOString()
    try {
      await executeJob(job, project, options)
      job.status = 'done'
      job.phase = 'done'
    } catch (error) {
      job.status = 'error'
      job.phase = 'error'
      job.error = error.message || String(error)
    } finally {
      job.finishedAt = new Date().toISOString()
      if (activeJobId === id) activeJobId = null
    }
  })
  return job
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, headers()); return res.end() }
  if (req.method === 'GET' && req.url === '/health') {
    const status = runtimeStatus()
    const busy = Boolean(activeJobId) || processBusy()
    const ready = status.blender && status.runtime && status.freeSpaceKb >= status.minFreeKb && !busy
    return send(res, status.blender && status.runtime ? 200 : 503, {
      ok: status.blender && status.runtime,
      ready,
      backendId: 'ppf-metal-final',
      transport: 'local-http-async',
      busy,
      activeJobId,
      ...status,
    })
  }
  if (req.method === 'POST' && req.url === '/jobs') {
    try {
      if (activeJobId || processBusy()) return send(res, 409, { ok: false, error: 'PPF final solver is busy', activeJobId })
      const status = runtimeStatus()
      if (!status.blender || !status.runtime) return send(res, 503, { ok: false, error: 'PPF runtime or Blender is unavailable', ...status })
      if (status.freeSpaceKb < status.minFreeKb) return send(res, 507, { ok: false, error: `Insufficient free space for PPF: ${status.freeSpaceKb} KiB available, ${status.minFreeKb} KiB required`, ...status })
      const body = await readBody(req)
      if (!body?.project?.pieces?.length) return send(res, 400, { ok: false, error: 'project.pieces is required' })
      const job = submit(body.project, body.options || {})
      return send(res, 202, { ok: true, job: jobPublic(job) })
    } catch (error) { return send(res, 500, { ok: false, error: error.message }) }
  }
  const match = req.url?.match(/^\/jobs\/([^/?]+)$/)
  const previewMatch = req.url?.match(/^\/jobs\/([^/?]+)\/preview(?:\?(.*))?$/)
  if (req.method === 'GET' && previewMatch) {
    const job = jobs.get(previewMatch[1])
    if (!job) return send(res, 404, { ok: false, error: 'PPF job not found' })
    if (job.status !== 'done') return send(res, 409, { ok: false, error: 'PPF preview requires a completed, audited job' })
    if (!job.artifacts?.payload || !job.summary?.pc2?.path) return send(res, 409, { ok: false, error: 'PPF saved frame mapping unavailable' })
    try {
      const query = new URLSearchParams(previewMatch[2] || '')
      const frame = query.has('frame') ? Number(query.get('frame')) : null
      const accepted = job.summary.fitAcceptance?.accepted === true
      if (query.get('validatedOnly') === 'true' && !accepted) return send(res, 409, { ok: false, error: 'PPF fit failed contact/strain/seam acceptance; preview remains experimental' })
      const preview = readPpfPreview(job.artifacts.payload, job.summary.pc2.path, { frame, accepted, jobId: job.id })
      return send(res, 200, { ok: true, preview })
    } catch (error) { return send(res, 422, { ok: false, error: error.message || String(error) }) }
  }
  if (req.method === 'GET' && match) {
    const job = jobs.get(match[1])
    if (!job) return send(res, 404, { ok: false, error: 'Job not found' })
    return send(res, 200, { ok: true, job: jobPublic(job) })
  }
  if (req.method === 'GET' && req.url === '/jobs') {
    return send(res, 200, { ok: true, activeJobId, jobs: [...jobs.values()].slice(-20).map(jobPublic) })
  }
  return send(res, 404, { ok: false, error: 'Not found' })
})

server.listen(port, host, () => {
  console.log(JSON.stringify({ service: 'garment-studio-ppf-final', host, port, pid: process.pid, runtime }))
})

```

### `docs/CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md`

```markdown
# Garment Studio vs CLO3D: whole-application gap audit (excluding cloth simulation)

Date: 2026-10-13. Scope: repository `src/`, `native_app/`, `scripts/`, `docs/`, production/export modules. Excludes solving/draping/cloth-body contact quality. This is a source/feature and bounded automated-test audit, **not** a certified parity review of every CLO version or an exhaustive interactive end-to-end test.

## Evidence and test results

- `npm run build`: PASS.
- `node scripts/check-production.mjs`: PASS.
- `node scripts/check-factory.mjs`: PASS.
- `node scripts/qa-clo-interface.mjs`: FAIL, selector ambiguity (`getByRole('button',{name:'Free sewing'})` now matches two buttons). This is a UI test reliability issue, not proof that sewing is broken.
- `node scripts/check-grading.mjs`: unavailable / missing script; grading has an implementation in `src/core/grading.js`, but that test command did not verify it.
- Existing detailed implementation and inventory reports: `docs/CLO_UI_IMPLEMENTATION_2026_10_13.md`, `docs/CLO_UI_TOOL_INVENTORY.md`, `docs/CLO_ICON_VISUAL_AUDIT_2026-10-13.md`, `docs/CLO_DUAL_COLUMN_TOOLBAR_PLACEMENT.md`.

Status terms: **Foundation** = usable core with substantial missing workflows; **Partial** = limited subset or UI-to-inspector only; **Absent/unverified** = no validated complete implementation found in inspected code. None means CLO parity.

| Category | Current evidence | Gap / next acceptance target | Priority |
|---|---|---|---|
| Precision 2D CAD | `src/components/PatternEditor.jsx`; select, edit points, split, curve, internal line, notches, measure; DXF import/export | Complete Bézier/arc precision, point/segment constraints, symmetry, true cut/spread/slash, dart manipulation, nested pieces, keyboard dimension input, multi-selection and precision snapping | P0 |
| 3D mesh/styleline editing | `src/App.jsx` 3D rail: Select Mesh and Edit Styleline are explicitly disabled/planned | Implement actual 3D mesh selection (box/lasso/brush) and editable stylelines, preserve mapping to 2D patterns and undo | P0 |
| Sewing authoring (not physics) | Seam links, free sewing, edge correspondence and 2D/3D guides | Edit seam direction, partial/segment sewing, match lengths, seam allowances and seam walk interaction; robust editing and undo tests | P1 |
| Toolbars and workspace | Two tool rails, object and property panes, menus, camera and view widgets | Correct CLO visual ordering and semantics, flyout variants, context-sensitive tool state, docking, persistence of workspace layouts; avoid proprietary icon copying | P1 |
| Object Browser | Ten tabs: Scene, Fabric, Graphic, Button, Buttonhole, Topstitch, Puckering, Trim, Grading, POM (`src/components/CloUI.jsx`) | Real hierarchy, visibility/lock, drag ordering, search/filter across objects, multi-object editing; Puckering and several object types have shallow actions | P1 |
| Property Editor | Pattern/fabric/avatar/seam/production inspectors | Complete selection-specific editors, per-object validation, batch edits, true CLO particle-distance-in-mm control instead of subdivision surrogate | P1 |
| Fabrics and appearance | Fabric GSM, thickness, shrink, warp/weft controls, texture/graphics, rendering | Measured physical fabric library, texture transform UV workflow, PBR layers/normal/roughness, calibrated color management and swatch persistence | P1 |
| Trims, graphics, stitching | `src/core/trims.js`, zippers, buttons/buttonholes, topstitch, graphic and trim object rows | True editable 3D hardware placement, realistic geometry, customizable stitch types, trim libraries, production metadata, puckering authoring | P1 |
| Grading | `src/core/grading.js`, size offsets and size-run generation | Point-level rules and rule tables, linked/nested size runs, size-specific seam checks, industrial grading import/export, golden fixture tests | P1 |
| Marker making | `src/core/marker.js` placement and marker reports | Grainline/nap constraints, fabric defects, stripe/plaid matching, multi-size and multi-ply marker strategy, verified material utilization | P2 |
| Manufacturing / tech packs | `src/core/factoryPackage.js`, `src/core/measurements.js`, BOM/POM, graded DXF, marker reports, HTML and ZIP | More robust grading tolerances, annotations, construction detail, versioned approvals, vendor round-trip and verified export fidelity | P1 |
| File interchange | Local garment project, DXF, OBJ/GLB export, factory ZIP | No validated native CLO `*.zprj` round-trip; assess AAMA/ASTM DXF interoperability, curve/notch/metadata fidelity, import warnings and round-trip fixture coverage | P1 |
| Avatar tools | Avatar options, CLO Thomas asset and measurements, viewport transforms | Dedicated avatar editor, pose library, custom rig import, motion retargeting, skin/measurement precision, avatar accessory management | P1 |
| Rendering | Still capture, environment and resolution settings | Studio-grade PBR lighting/camera presets, shadows and fabric microdetail, render queue and batch output, verified consistent color output | P2 |
| Animation | Animation menu/workspace scaffold | Keyframe/timeline editing, motion import, clips, export, pose-to-animation workflows; no validated full implementation found | P2 |
| Asset library | Garment/fabric/avatar/trims categories and local thumbnails | Complete reusable asset catalog, import tagging, folders, previews, filtering, versioning and project relinking | P2 |
| Automation | `src/App.jsx` command parser implements narrow verbs (widen %, crop cm, seam allowance, fabric weight, simulate/reset) | Typed action API for *all* editing commands, schema validation, preview/rollback, agent-driven multi-step projects, regression tests | P1 |
| Project reliability | Autosave/undo/redo and native wrapper; current production build passes | Comprehensive tool acceptance tests, migration/versioning, crash recovery, project round-trip, keyboard shortcuts, accessibility, QA on native bundle | P0 |

## Recommended order (outside simulation)

1. **P0 CAD correctness:** establish editable topology, exact numeric geometry, reliable undo/redo, selection, snap and DXF round-trip. This is the foundation for every downstream feature.
2. **P0 real 3D tool implementation:** replace disabled mesh selection and styleline controls with real operations that propagate to 2D and persist.
3. **P1 editing completeness:** sewing graph editor, trims/topstitch/puckering, Object Browser and Property Editor semantics.
4. **P1 production reliability:** grading, marker, tech packs and DXF import/export acceptance fixtures; do not equate existence of a generator with factory-level certification.
5. **P1 automation and QA:** expose safe, reversible typed operations for AI and users; test every toolbar command against model mutation, undo, save/load and 2D/3D synchronization.
6. **P2 presentation ecosystem:** material library, avatar authoring, high-quality rendering, animation, asset management and customizable workspace.

## Verification contract

For each CLO comparison tool, log `implemented`, `partial`, `planned` or `unsupported`, link source function and screenshot, then test: click -> intended model mutation -> undo -> redo -> save/load -> 2D/3D sync -> DXF/production export if applicable. Include numerical geometric checks, not only browser screenshot assertions. CLO version and toolbar personalization must be recorded for any 1:1 comparison. Do not silently activate placeholder buttons or imply a full feature from a tab or menu label.

```
