import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluatePpfAssembly } from '../ppf_backend/assemblyAcceptance.mjs'

const exploded = JSON.parse(readFileSync('blender_bridge/output/ppf-native-contact-ab/pinned-long.json'))
const strict = evaluatePpfAssembly(exploded)
assert.equal(strict.accepted, false)
assert.equal(strict.mayRun, false)
assert.ok(strict.maximumInitialSeamGapCm >= 30)
const override = evaluatePpfAssembly(exploded, { allowExplodedExperimental: true })
assert.equal(override.accepted, false)
assert.equal(override.experimentalOverride, true)
assert.equal(override.mayRun, true)
const near = evaluatePpfAssembly({shell:{vertices:[[0,0,0],[0.02,0,0]],stitchEdges:[{a:0,b:1,seamId:'test'}]}})
assert.equal(near.accepted, true)
assert.equal(near.mayRun, true)
const beyond = evaluatePpfAssembly({shell:{vertices:[[0,0,0],[0.04,0,0]],stitchEdges:[{a:0,b:1,seamId:'test'}]}})
assert.equal(beyond.accepted, false)
console.log(JSON.stringify({passed:true,strictExplodedRejected:true,experimentalOverrideLabeled:true,nearAssemblyAccepted:true}))
