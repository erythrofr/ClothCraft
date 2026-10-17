// Read-only garment Library presentation: never silently omit authored pieces.
// The bounded page size limits WebGL allocations across the triptych views.
export const GARMENT_HOVER_PAGE_SIZE = 14

export function garmentPreviewPage(sourcePieces, requestedPage = 0, pageSize = GARMENT_HOVER_PAGE_SIZE) {
  const original = Array.isArray(sourcePieces) ? sourcePieces : []
  const valid = original.filter(piece => Array.isArray(piece?.points) && piece.points.length >= 3)
  const limit = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 24) : GARMENT_HOVER_PAGE_SIZE
  const total = valid.length
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const page = Number.isFinite(requestedPage)
    ? Math.max(0, Math.min(pageCount - 1, Math.trunc(requestedPage))) : 0
  const start = page * limit
  return {
    pieces: valid.slice(start, start + limit),
    page,
    pageCount,
    total,
    invalidCount: original.length - total,
    start,
    end: Math.min(total, start + limit),
  }
}
