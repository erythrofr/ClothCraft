import assert from 'node:assert/strict'
import { readSavedProject, writeSavedProject } from '../src/core/projectRestore.js'

const document = { pieces: [{ id: 'front', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }] }], seams: [], fabrics: { main: {} }, simulation: {} }
function storage(failKey) {
  const entries = new Map()
  return {
    entries,
    getItem: key => entries.get(key) ?? null,
    setItem(key, value) {
      if (key === failKey) throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
      entries.set(key, value)
    },
  }
}

const first = storage()
writeSavedProject(first, 'project', 'backup', document)
assert.equal(first.getItem('backup'), first.getItem('project'), 'First save must seed recovery')
first.entries.delete('project')
assert.equal(readSavedProject(first, 'project', 'backup').status, 'backup', 'Missing primary should recover')
writeSavedProject(first, 'project', 'backup', { ...document, name: 'recovered' })
assert.equal(JSON.parse(first.getItem('backup')).name, undefined, 'Existing backup must remain untouched')

const corrupt = storage()
corrupt.setItem('project', '{broken')
corrupt.setItem('backup', JSON.stringify(document))
writeSavedProject(corrupt, 'project', 'backup', { ...document, name: 'fixed' })
assert.equal(JSON.parse(corrupt.getItem('backup')).name, undefined, 'Corrupt primary must not overwrite good backup')

const primaryQuota = storage('project')
assert.throws(() => writeSavedProject(primaryQuota, 'project', 'backup', document), { name: 'QuotaExceededError' })
assert.equal(primaryQuota.getItem('backup'), null, 'Failed primary write must not seed backup')

const backupQuota = storage('backup')
assert.doesNotThrow(() => writeSavedProject(backupQuota, 'project', 'backup', document))
assert.ok(backupQuota.getItem('project'), 'Backup quota failure must preserve successful primary write')
assert.equal(backupQuota.getItem('backup'), null)

console.log('PASS first save, missing-primary recovery, existing backup protection, primary and backup quota behavior')
