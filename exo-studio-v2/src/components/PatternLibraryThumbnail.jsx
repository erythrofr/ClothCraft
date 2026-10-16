import React, { useMemo } from 'react'
import { createTemplateProject } from '../data/templates.js'
import { samplePieceBoundary } from '../core/project.js'
import './PatternLibraryThumbnail.css'

const cache = new Map()
function previewFor(id) {
  if (cache.has(id)) return cache.get(id)
  const project = createTemplateProject(id)
  // Compact technical flat pattern preview, not a dressed shirt silhouette.
  const pieces = (project.pieces || []).filter(p => !p.fusedToPieceId).slice(0,5)
  const all = pieces.map(piece => ({ id:piece.id, label:piece.name, samples:samplePieceBoundary(piece,10).points }))
  cache.set(id,all)
  return all
}

export default function PatternLibraryThumbnail({ templateId, name }) {
  const pieces = useMemo(() => previewFor(templateId), [templateId])
  const shapes = pieces.map(piece => {
    const xs = piece.samples.map(p => p.x), ys = piece.samples.map(p => p.y)
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
    return { ...piece, minX,minY,maxX,maxY, width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY) }
  })
  return <svg className="clo-pattern-library-preview" role="img" aria-label={`${name} flat 2D pattern pieces`} viewBox="0 0 120 100">
    <rect width="120" height="100" fill="#f4f4f3"/>
    <path d="M0 25H120M0 50H120M0 75H120M30 0V100M60 0V100M90 0V100" stroke="#e1e1df" strokeWidth=".5"/>
    {shapes.map((piece,i) => {
      const col=i%3,row=Math.floor(i/3)
      const cellX=3+col*39,cellY=6+row*48,cellW=34,cellH=39
      const scale=Math.min(cellW/piece.width,cellH/piece.height)
      const originX=cellX+(cellW-piece.width*scale)/2,originY=cellY+(cellH-piece.height*scale)/2
      const points=piece.samples.map(p => `${originX+(p.x-piece.minX)*scale},${originY+(piece.maxY-p.y)*scale}`).join(' ')
      const cx=originX+piece.width*scale*.5,cy=originY+piece.height*scale*.5
      return <g key={piece.id}>
        <polygon points={points} fill="#ecece8" stroke="#454545" strokeWidth="1.05"/>
        <path d={`M${cx} ${cy-12}v24`} fill="none" stroke="#a4a4a1" strokeWidth=".7" strokeDasharray="2 1.5"/>
        <path d={`M${cx-2} ${cy+8}l2 4 2-4`} fill="none" stroke="#858585" strokeWidth=".7"/>
        <circle cx={cx} cy={cy} r=".9" fill="#bd3032"/>
      </g>
    })}
  </svg>
}
