import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildExplodedPpfPayload, ppfPayloadSummary, validatePpfPayload } from '../src/core/backends/ppfPayload.js'
import { evaluatePpfFitAcceptance } from './fitAcceptance.mjs'
import { readPpfPreview, readPpfAssemblyPreview } from './previewFrames.mjs'
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
  const staged = path.join(work, 'staged.ppf.json')
  const sleeveWrapped = path.join(work, 'sleeve-wrapped.ppf.json')
  const torsoBent = path.join(work, 'torso-bent.ppf.json')
  const shoulderBent = path.join(work, 'shoulder-bent.ppf.json')
  const tuned = path.join(work, 'assembled.ppf.json')
  const assemblyReportPath = path.join(work, 'assembly-report.json')
  const torsoBendReportPath = path.join(work, 'torso-bend-report.json')
  const shoulderFoldReportPath = path.join(work, 'shoulder-fold-report.json')
  const postalignmentReportPath = path.join(work, 'post-alignment-report.json')
  const signedContactReportPath = path.join(work, 'signed-skin-contact.json')
  const persistentAssembly = path.join(root, 'blender_bridge/output', `${job.id}-initial-assembly.ppf.json`)
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

    await runCommand(job, 'staging', blender, ['--background', '--factory-startup', '--python', 'blender_bridge/tune_ppf_staging.py', '--', '--input', input, '--output', staged, '--min-torso-depth', String(options.minTorsoDepth ?? 0.16), '--min-arm-offset', String(options.minArmOffset ?? 0.51), '--torso-y', String(options.torsoYOffset ?? project.simulation?.ppfTorsoYOffset ?? 0)])
    // Only the four-piece T-shirt has the verified underarm correspondence
    // needed for developable cone wrapping. Never apply this transform to
    // jeans, hoodies, or arbitrary user-drafted patterns by analogy.
    const teePieces = new Set(payload.shell.pieces.map(piece => piece.id))
    const isSupportedTee = project.templateId === 'tee' &&
      payload.avatar?.mode === 'local-thomas-body-mesh' &&
      teePieces.size === 4 && payload.shell.pieces.length === 4
      && ['front', 'back', 'sleeve-left', 'sleeve-right'].every(id => teePieces.has(id))
      && ['seam-sleeve-l-underarm', 'seam-sleeve-r-underarm'].every(id =>
        payload.shell.stitchEdges.some(edge => edge.seamId === id))
    let deformation = null
    if (isSupportedTee && options.useNonrigidAssembly !== false) {
      await runCommand(job, 'nonrigid-body-assembly', blender, [
        '--background', '--factory-startup', '--python-exit-code', '1',
        '--python', 'blender_bridge/nonrigid_ppf_assembly.py', '--',
        '--input', staged, '--output', sleeveWrapped, '--report', assemblyReportPath,
        '--sleeve-subdivisions', '1', '--torso-subdivisions', '0',
      ])
      const sleeveReport = JSON.parse(fs.readFileSync(assemblyReportPath, 'utf8'))
      // A closed circular/oval torso wraps through Thomas's outstretched
      // arms. First use a shallow developable side bend, then a separate
      // upper-shoulder fold. Both reject real-body intersections and >5%
      // deformation before their output is considered at all.
      await runCommand(job, 'progressive-torso-bend', blender, [
        '--background', '--factory-startup', '--python-exit-code', '1',
        '--python', 'blender_bridge/optimize_ppf_torso_bend.py', '--',
        '--input', sleeveWrapped, '--output', torsoBent, '--report', torsoBendReportPath,
        '--max-tries', '1600',
      ])
      const torsoReport = JSON.parse(fs.readFileSync(torsoBendReportPath, 'utf8'))
      await runCommand(job, 'shoulder-seam-fold', blender, [
        '--background', '--factory-startup', '--python-exit-code', '1',
        '--python', 'blender_bridge/tune_ppf_shoulder_folds.py', '--',
        '--input', torsoBent, '--flat-reference', sleeveWrapped,
        '--output', shoulderBent, '--report', shoulderFoldReportPath,
      ])
      const shoulderReport = JSON.parse(fs.readFileSync(shoulderFoldReportPath, 'utf8'))
      // Once the panels have their intrinsic bends, optimize only the six
      // rigid degrees of freedom of each piece. These steps cannot stretch
      // a pattern and are accepted only with verified Thomas and self-contact.
      await runCommand(job, 'rigid-seam-postalignment', blender, [
        '--background', '--factory-startup', '--python-exit-code', '1',
        '--python', 'blender_bridge/rigid_postalign_ppf_assembly.py', '--',
        '--input', shoulderBent, '--flat-reference', sleeveWrapped,
        '--output', tuned, '--report', postalignmentReportPath, '--rounds', '10',
      ])
      const postalignmentReport = JSON.parse(fs.readFileSync(postalignmentReportPath, 'utf8'))
      deformation = {
        ...sleeveReport,
        afterMeanSeamGapCm: postalignmentReport.outputMeanGapCm,
        afterMaximumSeamGapCm: postalignmentReport.outputMaximumGapCm,
        maximumRelativeIntrinsicEdgeChange: Math.max(
          sleeveReport.maximumRelativeIntrinsicEdgeChange,
          torsoReport.maxRelativeIntrinsicEdgeChange,
          shoulderReport.maximumEdgeChange,
          postalignmentReport.maximumIntrinsicEdgeChange,
        ),
        bodyIntersectionPairs: postalignmentReport.bodyIntersectionPairs,
        selfIntersectionPairs: postalignmentReport.selfIntersectionPairs,
        geometryPreservedOrWithinLimit: sleeveReport.geometryPreservedOrWithinLimit === true &&
          torsoReport.maxRelativeIntrinsicEdgeChange <= 0.05 &&
          shoulderReport.maximumEdgeChange <= 0.05 &&
          postalignmentReport.maximumIntrinsicEdgeChange <= 0.05,
        bodyAndSelfIntersectionFreeAtInitialPose: shoulderReport.bodyHits === 0 &&
          shoulderReport.selfHits === 0 &&
          torsoReport.bodyIntersectionPairs === 0 && torsoReport.selfIntersectionPairs === 0 &&
          postalignmentReport.bodyIntersectionPairs === 0 &&
          postalignmentReport.selfIntersectionPairs === 0 &&
          postalignmentReport.signedSkinClear === true,
      }
      job.summary = { ...job.summary, assembly: {
        algorithm: 'conical-sleeves-progressive-torso-shoulder-fold-and-rigid-contact-sewing-v4',
        initialVertices: deformation.initialMeshVertices,
        refinedVertices: deformation.refinedMeshVertices,
        startingSeamMeanCm: sleeveReport.beforeMeanSeamGapCm,
        assembledSeamMeanCm: deformation.afterMeanSeamGapCm,
        largestGapCm: deformation.afterMaximumSeamGapCm,
        maximumEdgeChange: deformation.maximumRelativeIntrinsicEdgeChange,
        realBodyIntersectionPairs: deformation.bodyIntersectionPairs,
        clothSelfIntersectionPairs: deformation.selfIntersectionPairs,
        seamAlignment: sleeveReport.seamAlignment,
        torsoBend: torsoReport.selected,
        shoulderFold: shoulderReport.selected,
        rigidPostalignment: {
          acceptedMoves: postalignmentReport.acceptedMoves,
          proposals: postalignmentReport.proposals,
          signedSkinClear: postalignmentReport.signedSkinClear,
          originalMeanGapCm: postalignmentReport.inputMeanGapCm,
          finalMeanGapCm: postalignmentReport.outputMeanGapCm,
        },
        intermediateSeamMeanCm: [sleeveReport.afterMeanSeamGapCm, torsoReport.afterMeanSeamGapCm, shoulderReport.afterMeanCm],
        fittingReady: deformation.afterMaximumSeamGapCm <= 3 &&
          deformation.geometryPreservedOrWithinLimit && deformation.bodyAndSelfIntersectionFreeAtInitialPose,
      } }
    } else {
      fs.copyFileSync(staged, tuned)
    }
    const stagedPayload = JSON.parse(fs.readFileSync(tuned, 'utf8'))
    const assembledValidity = validatePpfPayload(stagedPayload)
    if (!assembledValidity.ok) throw new Error(`Assembled PPF mesh is invalid: ${assembledValidity.errors.join('; ')}`)
    if (deformation && stagedPayload.avatar?.mode === 'local-thomas-body-mesh') {
      await runCommand(job, 'initial-skin-normal-check', blender, [
        '--background', '--factory-startup', '--python-exit-code', '1',
        '--python', 'blender_bridge/check_ppf_initial_signed_contact.py', '--',
        '--input', tuned, '--report', signedContactReportPath, '--reject-negative-2mm',
      ])
      const signedSkin = JSON.parse(fs.readFileSync(signedContactReportPath, 'utf8'))
      if (signedSkin.nontriviallyNegativeVertices !== 0) {
        throw new Error('PPF initial assembly has cloth vertices behind Thomas skin')
      }
      job.summary = { ...job.summary, signedSkinContact: {
        checked: true,
        method: signedSkin.method,
        nontriviallyNegativeVertices: signedSkin.nontriviallyNegativeVertices,
        toleranceMm: signedSkin.toleranceMm,
      } }
    }
    const stagingSeams = evaluatePpfAssembly(stagedPayload, { ...options, deformation })
    job.summary = { ...job.summary, stagingSeams }
    if (deformation?.bodyAndSelfIntersectionFreeAtInitialPose &&
        deformation?.geometryPreservedOrWithinLimit) {
      // Keep the geometrically validated starting pose available for
      // diagnosis even if the expensive physical solve must fail closed.
      // This is a starting arrangement, NOT fitted or sewn output.
      fs.copyFileSync(tuned, persistentAssembly)
      job.artifacts = { ...job.artifacts, assemblyPayload: persistentAssembly }
    }
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
    const { accepted, completeTrajectoryEvidence, collisionPass, strainPass, seamPass, ipcCcdPass, shoulderFitPass } = evaluatePpfFitAcceptance({
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
    job.artifacts = { ...job.artifacts, blend: solved, report, sewingReport, contactReport, payload: persistentPayload, ...(needsIpcCcd ? { ipcReport, fitClearanceReport } : {}) }
    job.summary = {
      ...job.summary, pc2: result.pc2, solver: result.solver, backend: result.backend,
      collisionQuality: collisionPass && ipcCcdPass ? 'pass' : 'failed-validation',
      fitQuality: accepted ? 'accepted' : 'experimental-failed-validation',
      fitAcceptance: {
        accepted,
        completeTrajectoryEvidence,
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
    try {
      const query = new URLSearchParams(previewMatch[2] || '')
      if (query.get('stage') === 'initial-assembly') {
        if (!job.artifacts?.assemblyPayload) return send(res, 409, { ok: false, error: 'Collision-checked initial arrangement unavailable' })
        if (query.get('validatedOnly') === 'true') return send(res, 409, { ok: false, error: 'An initial assembly is never a validated final fit' })
        if (query.has('frame') && Number(query.get('frame')) !== 0) return send(res, 422, { ok: false, error: 'Initial arrangement has only frame 0' })
        return send(res, 200, { ok: true, preview: readPpfAssemblyPreview(job.artifacts.assemblyPayload, { jobId: job.id }) })
      }
      if (job.status !== 'done') return send(res, 409, { ok: false, error: 'PPF solver preview requires a completed, audited job' })
      if (!job.artifacts?.payload || !job.summary?.pc2?.path) return send(res, 409, { ok: false, error: 'PPF saved frame mapping unavailable' })
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
