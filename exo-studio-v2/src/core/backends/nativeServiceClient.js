export const DEFAULT_NATIVE_SERVICE_URL = 'http://127.0.0.1:5191'

function baseUrl() {
  return String(globalThis.GARMENT_STUDIO_NATIVE_URL || DEFAULT_NATIVE_SERVICE_URL).replace(/\/$/, '')
}

function normalizeUrl(value) {
  return String(value || baseUrl()).replace(/\/$/, '')
}

export async function getNativeBackendHealth({ signal, baseUrl: requestedBaseUrl } = {}) {
  const response = await fetch(`${normalizeUrl(requestedBaseUrl)}/health`, { signal })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `Native backend unavailable (${response.status})`)
  return body
}

export const getNativeServiceHealth = getNativeBackendHealth

export async function runNativeBackend(project, { frames = 90, quality = 'quality', signal } = {}) {
  const response = await fetch(`${baseUrl()}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, frames, quality }),
    signal,
  })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `Native simulation failed (${response.status})`)
  return body.result
}

export async function solveWithNativeService(project, {
  frames = 60,
  quality = 'quality',
  clothModel,
  bendingModel,
  baseUrl: requestedBaseUrl,
  signal,
  experimentalSewFirst = false,
} = {}) {
  const response = await fetch(`${normalizeUrl(requestedBaseUrl)}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, frames, quality, clothModel, bendingModel, experimentalSewFirst }),
    signal,
  })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `Native simulation failed (${response.status})`)
  const result = body.result || {}
  return {
    result,
    elapsedMs: Number(result.runtimeMs || 0),
    payload: result.request || {},
  }
}

export async function stepNativePayload(payload, {
  frames = 8,
  baseUrl: requestedBaseUrl,
  signal,
} = {}) {
  const response = await fetch(`${normalizeUrl(requestedBaseUrl)}/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, frames }),
    signal,
  })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error || `Native step failed (${response.status})`)
  const result = body.result || {}
  return {
    result,
    elapsedMs: Number(result.runtimeMs || 0),
    payload: result.request || {},
  }
}
