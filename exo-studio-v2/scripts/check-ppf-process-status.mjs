import assert from 'node:assert/strict'
import { hasActivePpfWork } from '../ppf_backend/processStatus.mjs'
assert.equal(hasActivePpfWork('/User/Workspace/research/ppf-contact-solver-2026/target/release/ppf-cts-server --port 19381'), false)
assert.equal(hasActivePpfWork('/User/Workspace/research/ppf-contact-solver-2026/target/cpu/release/ppf-contact-solver --path /job'), true)
assert.equal(hasActivePpfWork('/Applications/Blender.app/Contents/MacOS/Blender -b scene.blend --python blender_bridge/ppf_run_configured.py -- --device GPU'), true)
assert.equal(hasActivePpfWork('/Applications/Blender.app/Contents/MacOS/Blender -b scene.blend --python blender_bridge/render_ppf_review.py'), false)
assert.equal(hasActivePpfWork('node ppf_backend/server.mjs'), false)
console.log('PPF active work detection passed; idle listeners do not block new jobs')
