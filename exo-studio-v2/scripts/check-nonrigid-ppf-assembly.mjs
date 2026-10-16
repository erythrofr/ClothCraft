import assert from 'node:assert/strict'
import fs from 'node:fs'
import { evaluatePpfAssembly } from '../ppf_backend/assemblyAcceptance.mjs'

const prefix='blender_bridge/output/nonrigid-assembly-20261013/'
const report=JSON.parse(fs.readFileSync(`${prefix}report-final.json`))
const payload=JSON.parse(fs.readFileSync(`${prefix}pose-final.json`))
assert.equal(report.realBodyCollisionMesh,true)
assert.equal(report.bodyAndSelfIntersectionFreeAtInitialPose,true)
assert.equal(report.bodyIntersectionPairs,0)
assert.equal(report.selfIntersectionPairs,0)
assert.equal(report.geometryPreservedOrWithinLimit,true)
assert.ok(report.maximumRelativeIntrinsicEdgeChange<=.05)
assert.ok(report.afterMeanSeamGapCm<=report.beforeMeanSeamGapCm)
assert.equal(report.fullTrajectoryCertified,false)
assert.equal(report.initialAssemblyAccepted,false)
const verdict=evaluatePpfAssembly(payload,{deformation:report})
assert.equal(verdict.accepted,false)
assert.equal(verdict.mayRun,false)
const invalid=evaluatePpfAssembly({shell:{vertices:[[0,0,0],[.01,0,0]],stitchEdges:[{a:0,b:1,seamId:'test'}]}},{deformation:{geometryPreservedOrWithinLimit:false,bodyAndSelfIntersectionFreeAtInitialPose:true}})
assert.equal(invalid.accepted,false,'Nonrigid strain gate must reject a near-sewn but distorted garment')
console.log(JSON.stringify({pass:true,realThomasBody:true,candidatesTested:report.candidatesTested,safeCandidates:report.safeCandidates,afterMeanSeamGapCm:report.afterMeanSeamGapCm,afterMaximumSeamGapCm:report.afterMaximumSeamGapCm,accepted:verdict.accepted}))
