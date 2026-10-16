import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, getAvatarArmPose, getAvatarHeightScale, getAvatarUpperBodyDimensions, stepSimulation } from '../src/core/physics.js'

for (const heightCm of [160, 200]) {
  const project = createTeeTemplate()
  project.avatar.heightCm = heightCm
  const expectedScale = heightCm / 180
  const actualScale = getAvatarHeightScale(project.avatar)
  if (Math.abs(actualScale - expectedScale) > 1e-9) throw new Error(`${heightCm}: avatar height scale mismatch`)
  const armPose = getAvatarArmPose(project.avatar, 1)
  const upper = getAvatarUpperBodyDimensions(project.avatar)
  if (Math.abs(armPose.shoulderJoint.y - 1.54 * expectedScale) > 1e-9) throw new Error(`${heightCm}: shoulder landmark did not scale with height`)
  if (Math.abs(armPose.halfLength - 0.36 * expectedScale) > 1e-9) throw new Error(`${heightCm}: derived arm length did not scale with height`)

  const simulation = buildSimulation(project)
  for (let frame = 0; frame < 120; frame += 1) stepSimulation(simulation, project, 1 / 60)
  const particles = [...simulation.pieces.values()].flatMap((piece) => piece.particles)
  const finite = particles.every((particle) => (
    Number.isFinite(particle.position.x) &&
    Number.isFinite(particle.position.y) &&
    Number.isFinite(particle.position.z)
  ))
  if (!finite) throw new Error(`${heightCm}: non-finite avatar-fit state`)
  const seamDistances = simulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
  const averageSeamGap = seamDistances.reduce((sum, value) => sum + value, 0) / Math.max(1, seamDistances.length)
  if (averageSeamGap > 0.04) throw new Error(`${heightCm}: average seam gap ${(averageSeamGap * 100).toFixed(2)} cm`)
  if (simulation.strain.average > 0.45) throw new Error(`${heightCm}: average strain ${(simulation.strain.average * 100).toFixed(1)}%`)
  // A much tighter guard than the previous 1000% tolerance. This should catch
  // the stiff neckline-tack / body-collider conflict before it regresses.
  // Passing this threshold still does NOT imply physically calibrated fabric.
  if (simulation.strain.max > 2.5) throw new Error(`${heightCm}: local strain ${(simulation.strain.max * 100).toFixed(1)}% exceeds 250% regression guard`)
  console.log(JSON.stringify({
    heightCm,
    scale: Number(actualScale.toFixed(3)),
    armCenterY: Number(armPose.center.y.toFixed(3)),
    shoulderJointY: Number(armPose.shoulderJoint.y.toFixed(3)),
    armLengthCm: Number(upper.armLengthCm.toFixed(1)),
    averageStrainPercent: Number((simulation.strain.average * 100).toFixed(1)),
    peakStrainPercent: Number((simulation.strain.max * 100).toFixed(1)),
    averageSeamGapCm: Number((averageSeamGap * 100).toFixed(2)),
    minY: Number(Math.min(...particles.map((particle) => particle.position.y)).toFixed(3)),
    maxY: Number(Math.max(...particles.map((particle) => particle.position.y)).toFixed(3)),
  }))
}

const baseAvatar = createTeeTemplate().avatar
const baseUpper = getAvatarUpperBodyDimensions(baseAvatar)
const widerUpper = getAvatarUpperBodyDimensions({ ...baseAvatar, shoulderWidthCm: 54 })
const largerNeck = getAvatarUpperBodyDimensions({ ...baseAvatar, neckCm: 46 })
const largerBicep = getAvatarUpperBodyDimensions({ ...baseAvatar, bicepCm: 42 })
const longerArm = getAvatarArmPose({ ...baseAvatar, armLengthCm: 80 }, 1)

if (widerUpper.shoulderHalfWidth <= baseUpper.shoulderHalfWidth) throw new Error('Shoulder width did not widen the upper body')
if (getAvatarArmPose({ ...baseAvatar, shoulderWidthCm: 54 }, 1).shoulderJoint.x <= getAvatarArmPose(baseAvatar, 1).shoulderJoint.x) throw new Error('Shoulder width did not move the arm joint outward')
if (largerNeck.neckRadius <= baseUpper.neckRadius) throw new Error('Neck circumference did not enlarge the neck collider')
if (largerBicep.armRadius <= baseUpper.armRadius) throw new Error('Bicep circumference did not enlarge the arm collider')
if (longerArm.halfLength <= getAvatarArmPose(baseAvatar, 1).halfLength) throw new Error('Arm length did not extend the arm collider')

const fitProject = createTeeTemplate()
Object.assign(fitProject.avatar, {
  shoulderWidthCm: 54,
  neckCm: 44,
  bicepCm: 40,
  armLengthCm: 78,
})
const fitSimulation = buildSimulation(fitProject)
for (let frame = 0; frame < 120; frame += 1) stepSimulation(fitSimulation, fitProject, 1 / 60)
const fitSeams = fitSimulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
const fitAverageSeam = fitSeams.reduce((sum, value) => sum + value, 0) / Math.max(1, fitSeams.length)
if (!Number.isFinite(fitSimulation.strain.average) || !Number.isFinite(fitSimulation.strain.max)) throw new Error('Upper-body measurement fit produced non-finite strain')
if (fitAverageSeam > 0.05) throw new Error(`Upper-body measurement fit opened seams ${(fitAverageSeam * 100).toFixed(2)} cm on average`)
console.log(JSON.stringify({
  upperBodyVariant: {
    shoulderWidthCm: fitProject.avatar.shoulderWidthCm,
    neckCm: fitProject.avatar.neckCm,
    bicepCm: fitProject.avatar.bicepCm,
    armLengthCm: fitProject.avatar.armLengthCm,
    averageStrainPercent: Number((fitSimulation.strain.average * 100).toFixed(1)),
    peakStrainPercent: Number((fitSimulation.strain.max * 100).toFixed(1)),
    averageSeamGapCm: Number((fitAverageSeam * 100).toFixed(2)),
  },
}))
