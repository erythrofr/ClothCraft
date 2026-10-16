import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation, measureAvatarSurfaceIntrusion } from '../src/core/physics.js'

function run(enabled) {
  const project = createTeeTemplate()
  project.simulation.continuousSurfaceContact = enabled
  const simulation = buildSimulation(project)
  let accepted = 0
  for (let frame = 0; frame < 30; frame++) {
    stepSimulation(simulation, project, 1 / 60)
    if (simulation.surfaceContact?.correctionAccepted) accepted++
    if (enabled && !simulation.surfaceContact) throw new Error('Missing continuous-contact telemetry')
  }
  const intrusion = measureAvatarSurfaceIntrusion(simulation, project.avatar)
  const meanSeamMm = simulation.quality?.sewing?.meanGapMm
  if (![intrusion.maximumIntrusionMm, meanSeamMm, simulation.strain?.average].every(Number.isFinite)) {
    throw new Error('Non-finite contact or seam result')
  }
  return { penetratingFaces: intrusion.penetratingFaces, maximumIntrusionMm: intrusion.maximumIntrusionMm,
    meanSeamMm, meanStrain: simulation.strain.average, accepted }
}

const baseline = run(false)
const assisted = run(true)
if (assisted.penetratingFaces > baseline.penetratingFaces) throw new Error('Contact assist increased penetrating faces')
if (assisted.maximumIntrusionMm > baseline.maximumIntrusionMm + 0.5) throw new Error('Contact assist increased penetration depth')
if (assisted.meanSeamMm > baseline.meanSeamMm + 5) throw new Error('Contact assist materially opened seams')
if (assisted.meanStrain > baseline.meanStrain + 0.05) throw new Error('Contact assist materially increased fabric strain')
console.log(JSON.stringify({ baseline, assisted }, null, 2))
