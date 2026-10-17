import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const report = { version: 1, garment: 'Foundation Tee', backend: 'browser-pbd', collisionCertified: false, avatars: [] }
for (const heightCm of [160, 180, 200]) {
  const project = createTeeTemplate()
  project.avatar.heightCm = heightCm
  const simulation = buildSimulation(project)
  const timeline = []
  for (let frame = 1; frame <= 120; frame++) {
    stepSimulation(simulation, project, 1 / 60)
    if ([1, 30, 60, 120].includes(frame)) {
      const q = simulation.quality
      assert.ok(q?.sewing && q?.structural, 'Missing simulation quality telemetry')
      assert.ok(Number.isFinite(q.sewing.p95GapMm) && Number.isFinite(q.structural.p95StrainPercent), 'Nonfinite quality telemetry')
      assert.ok(q.sewing.maxGapMm >= q.sewing.p95GapMm, 'Invalid seam percentiles')
      assert.ok(q.structural.maxStrainPercent >= q.structural.p95StrainPercent, 'Invalid strain percentiles')
      assert.equal(q.collision.triangleCcdVerified, false, 'Do not certify collision without triangle CCD')
      timeline.push({ frame, structural: q.structural, sewing: q.sewing, collision: q.collision })
    }
  }
  report.avatars.push({ heightCm, timeline })
}
const destination = process.env.GARMENT_FIT_REPORT
if (destination) fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
