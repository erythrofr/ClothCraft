export function validateSavedProject(project, { legacy = false } = {}) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('Project must be an object')
  if (!Array.isArray(project.pieces) || !Array.isArray(project.seams)) throw new Error('Project patterns or seams are missing')
  if ((!legacy || project.fabrics != null) && (!project.fabrics || typeof project.fabrics !== 'object' || Array.isArray(project.fabrics))) throw new Error('Project fabrics are invalid')
  if ((!legacy || project.simulation != null) && (!project.simulation || typeof project.simulation !== 'object' || Array.isArray(project.simulation))) throw new Error('Project simulation settings are invalid')
  if (project.pieces.some(piece => !piece || typeof piece.id !== 'string' || !Array.isArray(piece.points) || piece.points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y)))) {
    throw new Error('Project contains invalid pattern geometry')
  }
  return project
}

export function readSavedProject(storage, primaryKey, backupKey) {
  const primary = storage.getItem(primaryKey)
  if (!primary) {
    const backup = storage.getItem(backupKey)
    if (!backup) return { project: null, status: 'empty' }
    try {
      return { project: validateSavedProject(JSON.parse(backup), { legacy: true }), status: 'backup', error: 'Primary saved project is missing' }
    } catch (error) {
      return { project: null, status: 'failed', error: `Primary saved project is missing and backup is invalid: ${error.message}` }
    }
  }
  try {
    return { project: validateSavedProject(JSON.parse(primary), { legacy: true }), status: 'primary' }
  } catch (primaryError) {
    const backup = storage.getItem(backupKey)
    if (backup) {
      try {
        return { project: validateSavedProject(JSON.parse(backup), { legacy: true }), status: 'backup', error: primaryError.message }
      } catch { /* keep broken originals available for manual recovery */ }
    }
    return { project: null, status: 'failed', error: primaryError.message }
  }
}

export function writeSavedProject(storage, primaryKey, backupKey, project) {
  validateSavedProject(project)
  const serialized = JSON.stringify(project)
  const previous = storage.getItem(primaryKey)
  if (previous) {
    try {
      validateSavedProject(JSON.parse(previous), { legacy: true })
      storage.setItem(backupKey, previous)
    } catch { /* never overwrite a good backup with corrupted data */ }
  }
  storage.setItem(primaryKey, serialized)
  // Seed recovery on the first successful save. Never replace an existing
  // backup when the primary was missing or corrupt (including after recovery).
  if (!previous && !storage.getItem(backupKey)) {
    try {
      storage.setItem(backupKey, serialized)
    } catch { /* primary save succeeded; quota pressure must not invalidate it */ }
  }
}
