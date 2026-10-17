import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildExplodedPpfPayload, ppfSolverFabricPreset } from '../src/core/backends/ppfPayload.js'

const project = createTeeTemplate()
const active = buildExplodedPpfPayload(project, { frameCount: 60 })
const cotton = active.fabrics.main.material
assert.equal(cotton.shellYoungModulus, 5500)
assert.equal(cotton.bend, 4.3)
assert.equal(cotton.contactGap, 0.001)
assert.equal(cotton.contactOffset, 0)
assert.equal(cotton.strainLimitPercent, 5)
assert.deepEqual(active.scene.gravity, [0, 0, -9.81])
const thomas = structuredClone(project)
thomas.avatar.model = 'clo-thomas'
assert.equal(buildExplodedPpfPayload(thomas).scene.avatarRepresentation, 'pinned-shell')
thomas.simulation.ppfAvatarContactGap = .003
thomas.simulation.ppfAvatarContactOffset = .0005
const bodySettings = buildExplodedPpfPayload(thomas).scene
assert.equal(bodySettings.avatarContactGap, .003)
assert.equal(bodySettings.avatarContactOffset, .0005)
thomas.simulation.ppfAvatarRepresentation = 'static'
assert.equal(buildExplodedPpfPayload(thomas).scene.avatarRepresentation, 'static')
thomas.simulation.ppfAvatarRepresentation = 'invalid'
assert.throws(() => buildExplodedPpfPayload(thomas), /representation/)
assert.equal(active.shell.temporaryShoulderSupports, null, 'Untested supports must be opt-in')
const supportedProject = structuredClone(project)
supportedProject.simulation.ppfShoulderSupports = true
const supports = buildExplodedPpfPayload(supportedProject, { frameCount: 60 }).shell.temporaryShoulderSupports
assert.equal(supports?.indices.length, 4)
assert.equal(new Set(supports.indices).size, 4)
assert.equal(supports.mode, 'soft-pull')
assert.ok(supports.releaseAfterFrames < active.scene.frameCount)
const noSupports = structuredClone(project)
noSupports.simulation.ppfShoulderSupports = false
assert.equal(buildExplodedPpfPayload(noSupports, { frameCount: 60 }).shell.temporaryShoulderSupports, null)
const tuned = structuredClone(project)
tuned.simulation.ppfStrainLimitPercent = 12
tuned.simulation.ppfContactGap = 0.002
tuned.simulation.ppfContactOffset = 0.0005
const overrides = buildExplodedPpfPayload(tuned, { frameCount: 60 }).fabrics.main.material
assert.equal(overrides.strainLimitPercent, 12)
assert.equal(overrides.contactGap, 0.002)
assert.equal(overrides.contactOffset, 0.0005)
assert.equal(ppfSolverFabricPreset({id:'silk',name:'Silk Twill'}).bend, 1.42)
assert.equal(ppfSolverFabricPreset({id:'denim',name:'Rigid Denim'}).shellYoungModulus, 10000)
assert.equal(ppfSolverFabricPreset({id:'fleece',name:'French Terry'}).bend, 3.67)
console.log(JSON.stringify({pass:true,cotton,supports,overrides}, null, 2))
