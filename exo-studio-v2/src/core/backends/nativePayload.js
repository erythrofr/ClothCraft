import { buildSimulation } from '../physics.js'
import { inspectNativeAssemblyPose } from './nativeAssemblyPreflight.js'
import { assembleNativeSeams } from './seamAssembly.js'

export const NATIVE_QUALITY_PROFILES = Object.freeze({
  draft: Object.freeze({
    id: 'draft',
    label: 'Draft · Distance XPBD',
    clothModel: 'distance',
    bendingModel: 'distance',
  }),
  balanced: Object.freeze({
    id: 'balanced',
    label: 'Balanced · Isometric bend',
    clothModel: 'distance',
    bendingModel: 'isometric-xpbd',
  }),
  quality: Object.freeze({
    id: 'quality',
    label: 'Quality · Grain strain + isometric',
    clothModel: 'strain-triangle',
    bendingModel: 'isometric-xpbd',
  }),
})

export function resolveNativeQuality(options = {}) {
  let inferredQuality = options.quality
  if (!inferredQuality && (options.clothModel || options.bendingModel)) {
    if (options.clothModel === 'strain-triangle' && options.bendingModel === 'isometric-xpbd') inferredQuality = 'quality'
    else if ((options.clothModel || 'distance') === 'distance' && options.bendingModel === 'isometric-xpbd') inferredQuality = 'balanced'
    else inferredQuality = 'draft'
  }
  const profile = NATIVE_QUALITY_PROFILES[inferredQuality] || NATIVE_QUALITY_PROFILES.draft
  const clothModel = options.clothModel || profile.clothModel
  const bendingModel = options.bendingModel || profile.bendingModel
  if (clothModel === 'strain-triangle' && bendingModel !== 'isometric-xpbd' && options.allowUnsafeCombination !== true) {
    throw new Error('Native strain-triangle cloth requires isometric-xpbd bending. The strain-only combination is intentionally blocked because hooded garments diverge in regression tests.')
  }
  return {
    quality: inferredQuality || profile.id,
    clothModel,
    bendingModel,
  }
}

function nativeSpringStiffness(stiffness = 0.9) {
  const normalized = Math.max(0.001, Math.min(0.9999, Number(stiffness ?? 0.9)))
  return {
    normalized,
    springK: 12000 + 488000 * Math.pow(normalized, 4),
  }
}

export function buildNativeSimulationPayload(project, options = {}) {
  const nativeMode = resolveNativeQuality(options)
  // Edge flips preserve boundaries but current full-garment tests show worse
  // strain for tee/hoodie. Keep topology optimization opt-in for research;
  // default native production-development meshes retain their original faces.
  const optimizeMesh = options.experimentalOptimizeMesh === true || project.simulation?.experimentalNativeMeshOptimization === true
  const simulation = buildSimulation(project, {optimizeMesh})
  const particles = []
  const particleIndex = new Map()
  const simIndexToNative = new Map()
  const pieces = []

  for (const [pieceId, piece] of simulation.pieces.entries()) {
    const indices = []
    for (const particle of piece.particles) {
      const index = particles.length
      particleIndex.set(particle, index)
      simIndexToNative.set(particle.simIndex, index)
      indices.push(index)
      particles.push({
        id: particle.id,
        pieceId,
        position: [particle.position.x, particle.position.y, particle.position.z],
        previous: [particle.previous.x, particle.previous.y, particle.previous.z],
        invMass: Number(particle.invMass ?? 1),
        wrapMode: particle.wrapMode || '',
        patternU: Number.isFinite(particle.patternU) ? particle.patternU : null,
        collisionSideZ: Number(particle.collisionSideZ || 0),
        constructionSideZ: Number(particle.constructionSideZ || 0),
        seamBoundary: Boolean(particle.seamBoundary),
        seamIds: [...(particle.seamIds || [])],
        thickness: Number(piece.fabric?.thickness ?? 0.002),
        friction: Number(piece.fabric?.friction ?? 0.3),
        layerIndex: Number(piece.layerIndex || 0),
      })
    }
    pieces.push({
      id: pieceId,
      meshQuality: piece.meshQuality,
      name: piece.piece?.name || pieceId,
      wrapMode: piece.piece?.arrangement3d?.wrap || '',
      fabricId: piece.piece?.fabricId || 'main',
      grainAngleDeg: Number(piece.piece?.grainAngleDeg || 0),
      fabric: {
        stretchWarp: Number(piece.fabric?.stretchWarp ?? 0.05),
        stretchWeft: Number(piece.fabric?.stretchWeft ?? 0.05),
        bend: Number(piece.fabric?.bend ?? 0.65),
        shear: Number(piece.fabric?.shear ?? (0.45 + Number(piece.fabric?.bend ?? 0.65) * 0.45)),
      },
      particleIndices: indices,
      flatVerticesM: piece.flatVertices.map((point) => [point.x * 0.01, point.y * 0.01, 0]),
      faces: piece.faces.map((face) => [...face]),
    })
  }

  const nativeConstraintTypes = new Set([
    'structural',
    'bend',
    'seam',
    'surface-stitch',
    'fastener',
    'edge-treatment',
    'topstitch',
    'zipper-tape',
    'fuse',
    'fold',
    'dart',
    'pleat',
  ])
  const constraints = simulation.constraints
    .filter((constraint) => nativeConstraintTypes.has(constraint.type) && constraint.a && constraint.b && Number.isFinite(constraint.rest))
    .map((constraint) => {
      const { normalized, springK } = nativeSpringStiffness(constraint.stiffness)
      return {
        type: constraint.type,
        a: particleIndex.get(constraint.a),
        b: particleIndex.get(constraint.b),
        rest: Number(constraint.rest),
        stiffness: springK,
        sourceStiffness: normalized,
        seamId: constraint.seamId || null,
      }
    })
    .filter((constraint) => Number.isInteger(constraint.a) && Number.isInteger(constraint.b))

  // A CLO seam endpoint can lie between every available simulation vertex.
  // Preserve both virtual cutline anchors and their barycentric weights on
  // native handoff rather than silently downgrading to their nearest node.
  const virtualSeams = (simulation.seamConstraints || [])
    .filter((constraint) => constraint.type === 'seam-virtual')
    .map((constraint) => ({
      seamId: constraint.seamId,
      sourceIndices: constraint.sourceParticles.map((particle) => particleIndex.get(particle)),
      sourceWeights: [...constraint.sourceWeights],
      targetIndices: constraint.targetParticles.map((particle) => particleIndex.get(particle)),
      targetWeights: [...constraint.targetWeights],
      rest: Number(constraint.rest),
      stiffness: Number(constraint.stiffness),
      progress: Number(constraint.progress),
    }))
  if (virtualSeams.some((seam) =>
    [...seam.sourceIndices, ...seam.targetIndices].some((index) => !Number.isInteger(index)))) {
    throw new Error('Virtual sewing references an unmapped simulation particle')
  }

  const anchors = (simulation.anchorConstraints || []).map((anchor) => ({
    particle: particleIndex.get(anchor.particle),
    target: [anchor.target.x, anchor.target.y, anchor.target.z],
    stiffness: Math.max(0, Math.min(1, Number(anchor.stiffness ?? 0.2))),
    axes: anchor.axes || null,
    type: anchor.type || 'anchor',
  })).filter((anchor) => Number.isInteger(anchor.particle))

  const payload = {
    protocol: 'garment-studio.native-xpbd',
    version: 1,
    project: { id: project.id, name: project.name, templateId: project.templateId || 'custom' },
    avatar: project.avatar,
    settings: {
      gravity: Number(project.simulation?.gravity ?? 9.81),
      damping: Number(options.damping ?? 0.994),
      iterations: Math.max(4, Number(project.simulation?.iterations ?? 7)),
      substeps: Math.max(1, Math.min(4, Number(project.simulation?.substeps ?? 2))),
      dt: Number(options.dt ?? 1 / 60),
      collisions: project.simulation?.collisions !== false,
      collisionMargin: Number(project.simulation?.collisionMargin ?? 0.012),
      selfCollision: project.simulation?.selfCollision !== false,
      selfCollisionMargin: Number(project.simulation?.selfCollisionMargin ?? 0.002),
      maxThickness: Number(simulation.maxThickness ?? 0.002),
      structuralStiffness: Number(project.simulation?.stiffness ?? 0.92),
      lowerBodySeamRecovery: Number(options.lowerBodySeamRecovery ?? 0.90),
      lowerBodyJunctionRecovery: Number(options.lowerBodyJunctionRecovery ?? 0.90),
      quality: nativeMode.quality,
      clothModel: nativeMode.clothModel,
      bendingModel: nativeMode.bendingModel,
      // Anisotropic strain uses the inverse of each flat triangle rest matrix.
      // Ear-clipped T-shirt meshes contain 32:1 sleeve slivers and even
      // thinner bodice elements that made the native solver diverge at frame
      // zero. Reject ill-conditioned strain elements while retaining their
      // original distance edges. This is a NUMERICAL safety gate, not a fit
      // acceptance gate; open seams/penetration are still unvalidated.
      strainMeshMaxAspect: nativeMode.clothModel === 'strain-triangle'
        ? Number(options.strainMeshMaxAspect ?? project.simulation?.nativeStrainMeshMaxAspect ?? 25)
        : 1e12,
      strainMeshMinAltitudeM: nativeMode.clothModel === 'strain-triangle'
        ? Number(options.strainMeshMinAltitudeM ?? project.simulation?.nativeStrainMeshMinAltitudeM ?? 0.002)
        : 0,
      strainProjectionCapM: 0, // 2–20 mm clamps masked divergence but left pathological strain.
      captureFitTrajectory: nativeMode.quality === 'quality',
    },
    particles,
    pieces,
    constraints,
    virtualSeams,
    anchors,
    collisionExclusions: [...(simulation.collisionExclusions || [])].map((entry) => {
      const [left, right] = String(entry).split(':').map(Number)
      return [simIndexToNative.get(left), simIndexToNative.get(right)]
    }).filter(([left, right]) => Number.isInteger(left) && Number.isInteger(right)),
    fusedPiecePairs: [...(simulation.fusedPiecePairs || [])],
  }
  payload.initialAssembly = inspectNativeAssemblyPose(payload)
  // Research-only sew-first staging: never silently replace normal draping.
  // Even an excellent initial seam gap does not prove collision-safe fitting.
  const sewFirst = options.experimentalSewFirst === true || project.simulation?.experimentalNativeSewFirst === true
  return sewFirst ? assembleNativeSeams(payload,{iterations:300,seamStiffness:.7,restStiffness:.7}) : payload
}

export function nativePayloadSummary(payload) {
  return {
    project: payload.project?.name || 'Untitled',
    pieces: payload.pieces?.length || 0,
    particles: payload.particles?.length || 0,
    constraints: payload.constraints?.length || 0,
    virtualSeams: payload.virtualSeams?.length || 0,
    anchors: payload.anchors?.length || 0,
    clothModel: payload.settings?.clothModel || 'distance',
    bendingModel: payload.settings?.bendingModel || 'distance',
    quality: payload.settings?.quality || 'draft',
    initialAssembly:payload.initialAssembly?.status || 'NOT_MEASURED',
    initialSeamGapMaximumMm:payload.initialAssembly?.initialSeamGapMaximumMm ?? null,
    initialSeamGapAverageMm:payload.initialAssembly?.initialSeamGapAverageMm ?? null,
    initialMeshPeakEdgeStrainPercent:payload.initialAssembly?.initialMeshPeakEdgeStrainPercent ?? null,
    worstInitialSeam:payload.initialAssembly?.worstSewingGroups?.[0]?.seamId ?? null,
    sewFirstResearch:payload.assemblyExperiment ? {
      originalMaximumSeamGapMm:payload.assemblyExperiment.input.initialSeamGapMaximumMm,
      assembledMaximumSeamGapMm:payload.assemblyExperiment.output.initialSeamGapMaximumMm,
      originalPeakEdgeStrainPercent:payload.assemblyExperiment.input.initialMeshPeakEdgeStrainPercent,
      assembledPeakEdgeStrainPercent:payload.assemblyExperiment.output.initialMeshPeakEdgeStrainPercent,
      sampledPenetratingPoints:payload.assemblyExperiment.collision.penetrating,
      sampledMaximumIntrusionMm:payload.assemblyExperiment.collision.maximumIntrusionMm,
      safeToAutoApply:false,
    } : null,
  }
}
