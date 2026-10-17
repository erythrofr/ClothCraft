import React from 'react'

function pathD(points, offsetX, offsetY) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${(point.x + offsetX).toFixed(3)} ${(offsetY - point.y).toFixed(3)}`).join(' ')
}

export default function SeamWalkPreview({ report, progress = 0.5 }) {
  if (!report?.pathA?.length || !report?.pathB?.length) return <div className="seam-walk-empty">No seam walk data.</div>
  const all = [...report.pathA, ...report.pathB]
  const minX = Math.min(...all.map((point) => point.x), 0)
  const maxX = Math.max(...all.map((point) => point.x), 1)
  const minY = Math.min(...all.map((point) => point.y), 0)
  const maxY = Math.max(...all.map((point) => point.y), 0)
  const padding = Math.max(2, (maxX - minX) * 0.05)
  const width = Math.max(10, maxX - minX + padding * 2)
  const height = Math.max(12, maxY - minY + padding * 2)
  const offsetX = -minX + padding
  const offsetY = maxY + padding
  const safeProgress = Math.max(0, Math.min(1, Number(progress || 0)))
  const index = Math.max(0, Math.min(report.pathA.length - 1, Math.round(safeProgress * (report.pathA.length - 1))))
  const a = report.pathA[index]
  const b = report.pathB[index]
  const ax = a.x + offsetX
  const ay = offsetY - a.y
  const bx = b.x + offsetX
  const by = offsetY - b.y

  return (
    <div className="seam-walk-preview-shell">
      <svg className="seam-walk-preview" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <line x1={padding} y1={offsetY} x2={width - padding} y2={offsetY} className="seam-walk-baseline" />
        <path d={pathD(report.pathA, offsetX, offsetY)} className="seam-walk-path seam-walk-a" />
        <path d={pathD(report.pathB, offsetX, offsetY)} className="seam-walk-path seam-walk-b" />
        <line x1={ax} y1={ay} x2={bx} y2={by} className="seam-walk-gap" />
        <circle cx={ax} cy={ay} r={Math.max(0.8, width * 0.007)} className="seam-walk-cursor seam-walk-cursor-a" />
        <circle cx={bx} cy={by} r={Math.max(0.8, width * 0.007)} className="seam-walk-cursor seam-walk-cursor-b" />
      </svg>
      <div className="seam-walk-legend"><span><i className="a" />A · {report.pieceAId}</span><span><i className="b" />B · {report.pieceBId}</span></div>
    </div>
  )
}
