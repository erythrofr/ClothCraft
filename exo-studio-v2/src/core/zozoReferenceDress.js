// Read-only playback of the original upstream ZOZO/Codim-IPC dress example.
// This is intentionally distinct from the editable 2D garment project and
// the live PPF final-solve acceptance pipeline.

const ROOT = `${import.meta.env.BASE_URL || '/'}references/zozo-dress/`
const EXPECTED = 'garment-studio.zozo-reference-dress.v1'

async function fetchFile(filename, signal) {
  const response = await fetch(`${ROOT}${filename}`, { signal })
  if (!response.ok) throw new Error(`Original ZOZO dress reference unavailable (${filename}: HTTP ${response.status})`)
  return response
}

export async function loadZozoDressReference({ signal } = {}) {
  const [manifestResponse, meshResponse] = await Promise.all([
    fetchFile('manifest.json', signal), fetchFile('meshes.json', signal),
  ])
  const [manifest, meshes] = await Promise.all([manifestResponse.json(), meshResponse.json()])
  if (manifest.format !== EXPECTED || manifest.accepted !== false || manifest.fullPhysicalFitVerified !== false ||
      manifest.frames !== 241 || manifest.vertexCount !== 28467 || manifest.bodyVertices !== 12811 ||
      manifest.clothVertices !== 15656 || manifest.stitchConstraints !== 851 ||
      !Array.isArray(manifest.audits) || manifest.audits.length !== manifest.frames) {
    throw new Error('Original ZOZO dress provenance or unsafe-fit labels failed validation')
  }
  if (!Array.isArray(meshes.clothPanels) || meshes.clothPanels.length !== 14 || !Array.isArray(meshes.bodyIndices)) {
    throw new Error('Original ZOZO dress panel mesh metadata is incomplete')
  }
  for (const panel of meshes.clothPanels) {
    if (!/^panel\d+$/.test(panel.id) || !Array.isArray(panel.indices) || panel.indices.length % 3 ||
      panel.indices.some(i => !Number.isInteger(i) || i < 0 || i >= manifest.clothVertices)) {
      throw new Error('Invalid original ZOZO dress triangle index')
    }
  }
  if (meshes.bodyIndices.length !== manifest.bodyTriangles * 3 ||
      meshes.bodyIndices.some(i => !Number.isInteger(i) || i < manifest.clothVertices || i >= manifest.vertexCount)) {
    throw new Error('Invalid original pinned-body triangle index')
  }
  const response = await fetchFile('frames.bin', signal)
  const bytes = await response.arrayBuffer()
  const header = new DataView(bytes)
  const magic = String.fromCharCode(...new Uint8Array(bytes, 0, 8))
  if (magic !== 'GSDRESS1' || header.getUint32(8, true) !== 1 ||
      header.getUint32(12, true) !== manifest.vertexCount ||
      header.getUint32(16, true) !== manifest.frames || header.getUint32(20, true) !== 60 ||
      header.getUint32(24, true) !== manifest.bodyVertices ||
      bytes.byteLength !== 28 + manifest.frames * manifest.vertexCount * 12) {
    throw new Error('Original ZOZO dress native trajectory binary is corrupt or incomplete')
  }
  function frameVertices(frame) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= manifest.frames) throw new RangeError('ZOZO dress frame outside recorded trajectory')
    const offset = 28 + frame * manifest.vertexCount * 12
    // The native solver already stores x/right, y/up, z/depth in metres.
    // A copy keeps each frame independent of the read-only stored cache.
    const xyz = new Float32Array(bytes.slice(offset, offset + manifest.vertexCount * 12))
    if (!xyz.every(Number.isFinite)) throw new Error(`Non-finite ZOZO dress frame ${frame}`)
    return xyz
  }
  return Object.freeze({ manifest, meshes, frameVertices })
}
