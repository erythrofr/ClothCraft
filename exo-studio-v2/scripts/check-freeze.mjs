import { createTemplateProject } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const locked = createTemplateProject('blank')
locked.simulation.collisions = false
locked.simulation.selfCollision = false
locked.pieces[0].locked = true
locked.pieces[0].frozen3d = false
let simulation = buildSimulation(locked)
const lockedPiece = simulation.pieces.get(locked.pieces[0].id)
if (lockedPiece.particles.some((particle) => particle.invMass <= 0)) throw new Error('2D lock still freezes 3D particles')
const lockedStart = lockedPiece.particles.map((particle) => particle.position.clone())
for (let frame = 0; frame < 20; frame += 1) stepSimulation(simulation, locked, 1 / 60)
const lockedMotion = Math.max(...lockedPiece.particles.map((particle, index) => particle.position.distanceTo(lockedStart[index])))
if (lockedMotion < 0.001) throw new Error('2D-locked cloth did not simulate')

const frozen = createTemplateProject('blank')
frozen.simulation.collisions = false
frozen.simulation.selfCollision = false
frozen.pieces[0].locked = false
frozen.pieces[0].frozen3d = true
simulation = buildSimulation(frozen)
const frozenPiece = simulation.pieces.get(frozen.pieces[0].id)
if (frozenPiece.particles.some((particle) => particle.invMass !== 0)) throw new Error('Frozen 3D piece contains movable particles')
const frozenStart = frozenPiece.particles.map((particle) => particle.position.clone())
for (let frame = 0; frame < 60; frame += 1) stepSimulation(simulation, frozen, 1 / 60)
const frozenMotion = Math.max(...frozenPiece.particles.map((particle, index) => particle.position.distanceTo(frozenStart[index])))
if (frozenMotion > 1e-10) throw new Error(`Frozen cloth moved ${frozenMotion} m`)

const sewn = createTemplateProject('tee')
sewn.pieces.find((piece) => piece.id === 'front').frozen3d = true
simulation = buildSimulation(sewn)
const front = simulation.pieces.get('front')
const back = simulation.pieces.get('back')
if (!front.particles.every((particle) => particle.invMass === 0)) throw new Error('Frozen sewn front is not kinematic')
if (!back.particles.some((particle) => particle.invMass > 0)) throw new Error('Unfrozen sewn back became kinematic')
if (!simulation.seamConstraints.some((constraint) => constraint.a.pieceId === 'front' || constraint.b.pieceId === 'front')) throw new Error('Frozen pattern lost sewing constraints')

console.log(JSON.stringify({
  locked2dMotionCm: Number((lockedMotion * 100).toFixed(3)),
  frozen3dMotionM: frozenMotion,
  frozenFrontParticles: front.particles.length,
  movableBackParticles: back.particles.filter((particle) => particle.invMass > 0).length,
}, null, 2))
