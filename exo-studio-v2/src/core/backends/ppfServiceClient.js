export const DEFAULT_PPF_SERVICE_URL = 'http://127.0.0.1:5192'

function normalizeUrl(value) {
  return String(value || globalThis.GARMENT_STUDIO_PPF_URL || DEFAULT_PPF_SERVICE_URL).replace(/\/$/, '')
}

export async function getPpfServiceHealth({ baseUrl, signal } = {}) {
  const response = await fetch(`${normalizeUrl(baseUrl)}/health`, { signal })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `PPF service unavailable (${response.status})`)
  return body
}

export async function submitPpfFinalSolve(project, { baseUrl, frames = 10, minTorsoDepth = 0.16, minArmOffset = 0.51, allowExplodedExperimental = false, signal } = {}) {
  const response = await fetch(`${normalizeUrl(baseUrl)}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, options: { frames, minTorsoDepth, minArmOffset, allowExplodedExperimental } }),
    signal,
  })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `PPF job submission failed (${response.status})`)
  return body.job
}

export async function getPpfJob(jobId, { baseUrl, signal } = {}) {
  const response = await fetch(`${normalizeUrl(baseUrl)}/jobs/${encodeURIComponent(jobId)}`, { signal })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `PPF job query failed (${response.status})`)
  return body.job
}

// This intentionally returns a READ-ONLY WebGL overlay. An experimental PPF
// result must not overwrite the editable 2D pattern or browser cloth solver.
export async function getPpfJobPreview(jobId, { baseUrl, frame, stage = null, validatedOnly = false, signal } = {}) {
  const params = new URLSearchParams()
  if (frame != null) params.set('frame', String(frame))
  if (stage != null) params.set('stage', String(stage))
  if (validatedOnly) params.set('validatedOnly', 'true')
  const search = params.toString()
  const response = await fetch(`${normalizeUrl(baseUrl)}/jobs/${encodeURIComponent(jobId)}/preview${search ? `?${search}` : ''}`, { signal })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `PPF preview unavailable (${response.status})`)
  return body.preview
}

export async function waitForPpfJob(jobId, { baseUrl, signal, pollMs = 1000, timeoutMs = 600000, onProgress } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError')
    const job = await getPpfJob(jobId, { baseUrl, signal })
    onProgress?.(job)
    if (job.status === 'done') return job
    if (job.status === 'error') throw new Error(job.error || 'PPF final solve failed')
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  throw new Error(`PPF final solve timed out after ${timeoutMs} ms`)
}
