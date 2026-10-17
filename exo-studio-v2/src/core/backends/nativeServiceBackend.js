import { buildSimulation, refreshSimulationAnalysis } from '../physics.js'
import { buildNativeSimulationPayload } from './nativePayload.js'
import { DEFAULT_NATIVE_SERVICE_URL, stepNativePayload } from './nativeServiceClient.js'
import { assessSimulationFit } from '../physics/qualityGate.js'

export function assessNativeSolverResult(result) {
  const stats = result?.stats || {}
  const trajectory = result?.fitTrajectory || {}
  const peakStrain = Math.max(
    stats.fullMeshEdgeStrainMax == null ? NaN : Number(stats.fullMeshEdgeStrainMax)*100,
    trajectory.peakFullMeshEdgeStrainPercent == null ? 0 : Number(trajectory.peakFullMeshEdgeStrainPercent),
  )
  const worstSeam = Math.max(
    stats.seamMaxDistance == null ? NaN : Number(stats.seamMaxDistance)*1000,
    trajectory.peakSewnGapMm == null ? 0 : Number(trajectory.peakSewnGapMm),
  )
  const assessment = assessSimulationFit({
    structural:{maxStrainPercent:peakStrain},
    sewing:{maxGapMm:worstSeam},
    collision:{triangleCcdVerified:false,allFrameIntersectionFree:null},
  })
  if (stats.finite === false || trajectory.allFramesFinite === false) {
    return {...assessment,status:'FAILED',failures:[...new Set([...assessment.failures,'native-solver-nonfinite'])]}
  }
  return assessment
}

function flattenSimulationParticles(simulation) {
  return [...simulation.pieces.values()].flatMap((piece) => piece.particles)
}

function validateNativeParticleState(state, expectedCount) {
  if (!Array.isArray(state) || state.length !== expectedCount) {
    throw new Error(`Native state particle count mismatch: expected ${expectedCount}, got ${state?.length || 0}`)
  }
  for (let index = 0; index < state.length; index += 1) {
    const particle = state[index]
    for (const coordinate of ['position', 'previous']) {
      if (!Array.isArray(particle?.[coordinate]) || particle[coordinate].length !== 3 ||
        !particle[coordinate].every(Number.isFinite)) {
        throw new Error(`Native state ${coordinate}[${index}] must contain three finite coordinates`)
      }
    }
  }
}

function updateNativePayloadState(payload, result) {
  const state = result?.state?.particles
  validateNativeParticleState(state, payload.particles.length)
  for (let index = 0; index < state.length; index += 1) {
    const next = state[index]
    payload.particles[index].position = [...next.position]
    payload.particles[index].previous = [...next.previous]
  }
}

function applyNativeStateToSimulation(session, result) {
  const state = result?.state?.particles
  validateNativeParticleState(state, session.particleRefs.length)
  for (let index = 0; index < state.length; index += 1) {
    const particle = session.particleRefs[index]
    const next = state[index]
    particle.position.set(next.position[0], next.position[1], next.position[2])
    particle.previous.set(next.previous[0], next.previous[1], next.previous[2])
    particle.contactDepth = Math.max(0, Number(next.contactDepth || 0))
  }
  session.simulation.elapsed = session.frame / 60
}

export const nativeServiceBackend = {
  id: 'native-xpbd',
  label: 'Native XPBD · Local',
  kind: 'external-batch',
  maturity: 'experimental',
  async: true,
  capabilities: {
    platform: ['macos'],
    gpu: false,
    native: true,
    anisotropy: true,
    selfCollision: true,
    avatarCollision: true,
    layeredGarments: true,
    attachments: true,
    fusedLayers: true,
    dynamicAnimation: true,
    contactAnalysis: true,
    strainAnalysis: true,
  },

  create(project) {
    const simulation = buildSimulation(project, {optimizeMesh:project.simulation?.experimentalNativeMeshOptimization === true})
    const payload = buildNativeSimulationPayload(project, {
      quality: project.simulation?.nativeQuality || 'draft',
    })
    const particleRefs = flattenSimulationParticles(simulation)
    if (particleRefs.length !== payload.particles.length) {
      throw new Error(`Native topology mismatch: browser ${particleRefs.length}, payload ${payload.particles.length}`)
    }
    return {
      backendId: this.id,
      project,
      simulation,
      payload,
      initialAssembly:payload.initialAssembly,
      particleRefs,
      frame: 0,
      pending: null,
      failedUntil: 0,
      lastError: null,
      lastResult: null,
      lastElapsedMs: 0,
      serviceUrl: project.simulation?.nativeServiceUrl || DEFAULT_NATIVE_SERVICE_URL,
      disposed: false,
      abortController: new AbortController(),
    }
  },

  step() {
    throw new Error('Native XPBD requires asynchronous stepAsync(); a synchronous step would silently skip cloth physics')
  },

  adoptResult(session, result, elapsedMs = 0) {
    if (session.disposed) return session
    if (result?.stats?.finite === false) throw new Error('Native XPBD result is nonfinite; garment pose was not applied')
    // Validate the entire reply before mutating either the persistent native
    // payload or the displayed browser-side particle references.
    validateNativeParticleState(result?.state?.particles, session.payload.particles.length)
    validateNativeParticleState(result?.state?.particles, session.particleRefs.length)
    updateNativePayloadState(session.payload, result)
    session.frame += Number(result?.frames || 0)
    applyNativeStateToSimulation(session, result)
    refreshSimulationAnalysis(session.simulation, session.project)
    session.lastResult = result
    session.lastElapsedMs = Number(elapsedMs || result?.runtimeMs || 0)
    session.lastError = null
    return session
  },

  stepAsync(session, frames = 8) {
    if (session.disposed) return Promise.resolve(session)
    if (session.pending) return session.pending
    if (Date.now() < session.failedUntil) return Promise.resolve(session)
    session.pending = stepNativePayload(session.payload, {
      frames,
      baseUrl: session.serviceUrl,
      signal: session.abortController.signal,
    }).then((response) => {
      if (session.disposed) return session
      this.adoptResult(session, response.result, response.elapsedMs)
      return session
    }).catch((error) => {
      if (session.disposed && error?.name === 'AbortError') return session
      session.lastError = error
      session.failedUntil = Date.now() + 2000
      throw error
    }).finally(() => {
      session.pending = null
    })
    return session.pending
  },

  reset(session, project = session.project) {
    this.dispose(session)
    return this.create(project)
  },

  getStats(session) {
    return {
      frame: session.frame,
      elapsedMs: session.lastElapsedMs,
      serviceError: session.lastError?.message || null,
      native: session.lastResult?.stats || null,
      initialAssembly: session.initialAssembly || null,
      fitAssessment: session.lastResult ? assessNativeSolverResult(session.lastResult) : null,
    }
  },

  dispose(session) {
    if (!session || session.disposed) return
    session.disposed = true
    session.abortController?.abort()
    session.pending = null
  },
}
