// Real local service regression. Requires the personal macOS app or localhost bridge.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { assessment } from './contact_run.mjs'

const origin = process.env.EXO_OGC_TEST_ORIGIN || 'http://127.0.0.1:5284'
const bridge = process.env.EXO_OGC_TEST_BRIDGE || 'http://127.0.0.1:5283'
const document = JSON.parse(fs.readFileSync('native_cpp/examples/sample-tee.json', 'utf8'))
const unchanged = JSON.stringify(document)
const request = async (avatarModel, steps) => {
  const result = await fetch(`${bridge}/contact-simulate`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, avatarModel, steps }),
  })
  return { status: result.status, value: await result.json() }
}

const empty = assessment(null)
assert.equal(empty.fitAccepted, false)
assert.equal(empty.contactCertified, false)
assert.equal(empty.provisionalContactCandidate, false)
for (const avatarModel of ['clo-thomas', 'makehuman-base']) {
  const { status, value } = await request(avatarModel, 1)
  assert.equal(status, 200, JSON.stringify(value))
  assert.equal(value.ok, true)
  assert.equal(value.completedSteps, 1)
  assert.equal(value.backend, 'ClothCraft Rust CPU VBD + Offset Geometric Contact')
  assert.equal(value.avatarModel, avatarModel)
  assert.equal(value.fitAccepted, false)
  assert.equal(value.contactCertified, false)
  assert.ok(value.maxSeamGapMm > 0)
  assert.ok(value.artifacts.cloth && value.artifacts.avatar)
  for (const url of Object.values(value.artifacts)) {
    const file = await fetch(`${bridge}${url}`, { headers: { Origin: origin } })
    assert.equal(file.status, 200)
    assert.match(await file.text(), /\nv /)
  }
  console.log(`PASS ${avatarModel}: seam ${value.maxSeamGapMm.toFixed(1)} mm, ${value.activeContacts} active contacts, fit not accepted`)
}
for (const steps of [0, 31, 1.25]) {
  const bad = await request('clo-thomas', steps)
  assert.equal(bad.status, 422)
}
const unsupported = await request('theo', 1)
assert.equal(unsupported.status, 422)
assert.match(unsupported.value.error, /not yet supported/)
assert.equal(JSON.stringify(document), unchanged, 'Source EXO garment was modified')
console.log('PASS OGC safe rejection / project immutability')
