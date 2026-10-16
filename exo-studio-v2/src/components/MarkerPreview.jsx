import React from 'react'

export default function MarkerPreview({ marker }) {
  if (!marker?.placements?.length) {
    const names = (marker?.unplaced || []).map((item) => item.name).join(', ')
    return <div className="marker-empty">No pieces fit the current fabric width.{names ? ` Review: ${names}.` : ''}</div>
  }
  const viewHeight = Math.max(60, marker.length)
  return (
    <div className="marker-preview-shell">
      <svg className="marker-preview" viewBox={`0 0 ${marker.width} ${viewHeight}`} preserveAspectRatio="xMidYMin meet">
        <rect x="0" y="0" width={marker.width} height={viewHeight} className="marker-fabric" />
        {marker.placements.map((placement, index) => (
          <g key={`${placement.pieceId}-${index}`}>
            <polygon
              points={(placement.outline || []).map((point) => `${point.x},${point.y}`).join(' ')}
              className="marker-piece"
            />
            <text x={placement.x + 3} y={placement.y + 7} className="marker-label">{placement.name.toUpperCase()}</text>
            <text x={placement.x + 3} y={placement.y + 13} className="marker-rotation">{Number(placement.rotationDeg || 0).toFixed(0)}°{placement.crossGrain ? ' · X-GRAIN' : ''}</text>
          </g>
        ))}
      </svg>
      <div className="marker-scale"><span>{marker.width.toFixed(0)} cm fabric width</span><strong>{marker.length.toFixed(1)} cm marker</strong></div>
      {!!marker.unusedPieces && (
        <div className="marker-overflow-warning">
          <strong>{marker.unusedPieces} PIECE{marker.unusedPieces === 1 ? '' : 'S'} NOT PLACED</strong>
          {(marker.unplaced || []).map((item) => (
            <span key={`${item.pieceId}-${item.instance}`}>{item.name}{item.minimumWidthCm ? ` · needs ≥${item.minimumWidthCm.toFixed(1)} cm width` : ''}</span>
          ))}
        </div>
      )}
    </div>
  )
}
