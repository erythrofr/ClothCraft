import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveNativeQuality } from '../src/core/backends/nativePayload.js'
import { assessNativeSolverResult } from '../src/core/backends/nativeServiceBackend.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const binary = execFileSync(path.join(root, 'native_backend/scripts/build_garment_xpbd_cli.sh'), [], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim().split(/\r?\n/).at(-1)
if (!binary || !fs.existsSync(binary)) throw new Error('Native garment XPBD binary was not produced')

let blocked = false
try { resolveNativeQuality({ clothModel: 'strain-triangle', bendingModel: 'distance' }) }
catch { blocked = true }
if (!blocked) throw new Error('Unsafe strain-only native configuration is not blocked')

const profiles = ['draft', 'balanced', 'quality']
const garments = ['tee', 'hoodie', 'zip-hoodie']
const rows = []
for (const profile of profiles) {
  for (const garment of garments) {
    const fixture = path.join(root, `native_backend/fixtures/${garment}-${profile}.native-sim.json`)
    const resultPath = path.join(root, `native_backend/output/${garment}-${profile}.native-result.json`)
    execFileSync('node', [path.join(root, 'scripts/export-native-sim-fixture.mjs'), garment, fixture], {
      cwd: root,
      env: { ...process.env, GS_NATIVE_QUALITY: profile },
      stdio: 'pipe',
    })
    const payload = JSON.parse(fs.readFileSync(fixture, 'utf8'))
    const stdout = execFileSync(binary, [fixture, resultPath, '60'], { cwd: root, encoding: 'utf8' })
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
    if (!result.stats?.finite) throw new Error(`${garment}/${profile}: non-finite result`)
    if (payload.settings.quality !== profile) throw new Error(`${garment}/${profile}: payload quality drifted to ${payload.settings.quality}`)
    if (profile === 'draft' && (result.stats.strainTriangles !== 0 || result.stats.isometricBends !== 0)) throw new Error(`${garment}/draft unexpectedly enabled advanced constraints`)
    if (profile === 'balanced' && !(result.stats.isometricBends > 0) ) throw new Error(`${garment}/balanced is missing isometric bends`)
    if (profile === 'balanced' && result.stats.strainTriangles !== 0) throw new Error(`${garment}/balanced unexpectedly enabled strain triangles`)
    if (profile === 'quality' && !(result.stats.strainTriangles > 0 && result.stats.isometricBends > 0)) throw new Error(`${garment}/quality is missing advanced constraints`)
    if (!(result.stats.seamAverageDistance < 0.02 && result.stats.seamMaxDistance < 0.04)) throw new Error(`${garment}/${profile}: seam closure regressed`)
    if (!Number.isFinite(result.stats.fullMeshEdgeStrainMax) || !Number.isFinite(result.stats.fullMeshEdgeStrainAverage)) {
      throw new Error(`${garment}/${profile}: full-mesh strain diagnostics missing or non-finite`)
    }
    if (result.stats.fullMeshFiniteEdgeCount !== result.stats.fullMeshEdgeCount) {
      throw new Error(`${garment}/${profile}: not all cloth edges have valid measured strain`)
    }
    const fitAssessment = assessNativeSolverResult(result)
    if (profile === 'quality') {
      const trajectory = result.fitTrajectory
      if (trajectory?.frames?.length !== 60 || !trajectory.allFramesFinite) {
        throw new Error(`${garment}/quality: missing a complete 60-frame finite fit trajectory`)
      }
      if (!(trajectory.peakFullMeshEdgeStrainPercent >= result.stats.fullMeshEdgeStrainMax*100)) {
        throw new Error(`${garment}/quality: trajectory peak strain cannot be less than final strain`)
      }
      if (!(trajectory.peakSewnGapMm >= result.stats.seamMaxDistance*1000)) {
        throw new Error(`${garment}/quality: trajectory worst seam cannot be less than final worst seam`)
      }
    }
    rows.push({
      garment,
      profile,
      clothModel: payload.settings.clothModel,
      bendingModel: payload.settings.bendingModel,
      strainTriangles: result.stats.strainTriangles,
      isometricBends: result.stats.isometricBends,
      strainAverage: result.stats.structuralStrainAverage,
      strainPeak: result.stats.structuralStrainMax,
      seamAverageMm: result.stats.seamAverageDistance * 1000,
      seamPeakMm: result.stats.seamMaxDistance * 1000,
      fullMeshStrainAveragePercent: result.stats.fullMeshEdgeStrainAverage*100,
      fullMeshStrainMaxPercent: result.stats.fullMeshEdgeStrainMax*100,
      strainTrianglesSkippedForMeshQuality: result.stats.strainTrianglesSkippedForMeshQuality,
      fitStatus: fitAssessment.status,
      factoryApproved: fitAssessment.factoryApproved,
      trajectoryPeakStrainPercent: result.fitTrajectory?.peakFullMeshEdgeStrainPercent ?? null,
      trajectoryMaxSeamGapMm: result.fitTrajectory?.peakSewnGapMm ?? null,
      runtimeSummary: JSON.parse(stdout.trim().split(/\r?\n/).at(-1)),
    })
  }
}

const by = (garment, profile) => rows.find((row) => row.garment === garment && row.profile === profile)
const zipDraft = by('zip-hoodie', 'draft')
const zipBalanced = by('zip-hoodie', 'balanced')
const zipQuality = by('zip-hoodie', 'quality')
if (!(zipBalanced.strainPeak < zipDraft.strainPeak * 0.8)) throw new Error(`zip-hoodie balanced peak strain did not materially improve: ${zipBalanced.strainPeak} vs ${zipDraft.strainPeak}`)
if (!(zipQuality.strainPeak < zipDraft.strainPeak * 0.7)) throw new Error(`zip-hoodie quality peak strain did not materially improve: ${zipQuality.strainPeak} vs ${zipDraft.strainPeak}`)

const hoodieDraft = by('hoodie', 'draft')
const hoodieQuality = by('hoodie', 'quality')
if (!(hoodieQuality.strainPeak < hoodieDraft.strainPeak)) throw new Error(`hoodie quality peak strain did not improve: ${hoodieQuality.strainPeak} vs ${hoodieDraft.strainPeak}`)

console.log(JSON.stringify({
  unsafeStrainOnlyBlocked: blocked,
  profiles: rows.map(({ runtimeSummary, ...row }) => ({
    ...row,
    strainAverage: Number(row.strainAverage.toFixed(4)),
    strainPeak: Number(row.strainPeak.toFixed(4)),
    seamAverageMm: Number(row.seamAverageMm.toFixed(2)),
    seamPeakMm: Number(row.seamPeakMm.toFixed(2)),
    fullMeshStrainAveragePercent: Number(row.fullMeshStrainAveragePercent.toFixed(2)),
    fullMeshStrainMaxPercent: Number(row.fullMeshStrainMaxPercent.toFixed(2)),
    trajectoryPeakStrainPercent: row.trajectoryPeakStrainPercent == null ? null : Number(row.trajectoryPeakStrainPercent.toFixed(2)),
    trajectoryMaxSeamGapMm: row.trajectoryMaxSeamGapMm == null ? null : Number(row.trajectoryMaxSeamGapMm.toFixed(2)),
  })),
  improvements: {
    zipBalancedPeakReductionPercent: Number(((1 - zipBalanced.strainPeak / zipDraft.strainPeak) * 100).toFixed(1)),
    zipQualityPeakReductionPercent: Number(((1 - zipQuality.strainPeak / zipDraft.strainPeak) * 100).toFixed(1)),
    hoodieQualityPeakReductionPercent: Number(((1 - hoodieQuality.strainPeak / hoodieDraft.strainPeak) * 100).toFixed(1)),
  },
}, null, 2))
