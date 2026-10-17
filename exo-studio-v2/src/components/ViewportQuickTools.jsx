import React from 'react'
import CadToolIcon from './CadToolIcon.jsx'

// Original Garment Studio CAD SVGs, arranged as compact CLO-inspired tool
// families. Each icon runs the real editor command; hovering or focusing its
// flyout reveals alternative actions from the same family.
const TOOLS = {
  '2d': [
    { name: 'select', label: 'Select / Transform', icon: 'select-2d', options: ['select', 'point', 'split'] },
    { name: 'point', label: 'Edit Pattern Points', icon: 'points', options: ['point', 'curve', 'split'] },
    { name: 'curve', label: 'Edit Curves', icon: 'curve', options: ['curve', 'point', 'split'] },
    { name: 'polygon', label: 'Draw New Polygon Pattern', icon: 'polygon-tool', options: ['polygon', 'internal'] },
    { name: 'sew', label: 'Edit Sewing', icon: 'sew', options: ['sew', 'notch', 'allowance', 'fastener'] },
    { name: 'notch', label: 'Notches / Seam Allowance', icon: 'notch', options: ['notch', 'allowance'] },
    { name: 'internal', label: 'Internal Line / Dart', icon: 'internal', options: ['internal', 'pin', 'measure'] },
    { name: 'measure', label: 'Measure', icon: 'measure', options: ['measure', 'notch', 'allowance', 'pin'] },
  ],
  '3d': [
    { name: 'orbit', label: 'Orbit Camera', icon: 'camera', options: ['orbit', 'hand'] },
    { name: 'transform', label: 'Select / Move', icon: 'select-3d', options: ['transform', 'move', 'rotate'] },
    { name: 'move', label: 'Move Garment', icon: 'move-3d', options: ['move', 'transform'] },
    { name: 'rotate', label: 'Rotate Garment', icon: 'rotate-3d', options: ['rotate', 'transform'] },
    { name: 'hand', label: 'Fabric Hand', icon: 'hand', options: ['hand', 'orbit'] },
  ],
}

const LABELS = {
  select: 'Select / Transform', point: 'Edit Points', split: 'Add / Split Point', polygon: 'Draw Polygon',
  curve: 'Edit Curve', sew: 'Free Sewing', notch: 'Add Notch', allowance: 'Seam Allowance',
  fastener: 'Fastener', internal: 'Internal Line / Dart', pin: 'Pin',
  measure: 'Measure', orbit: 'Orbit', transform: 'Select / Move',
  move: 'Move', rotate: 'Rotate', hand: 'Fabric Hand',
}
const ICONS = {
  select: 'select-2d', point: 'points', split: 'split', curve: 'curve', polygon: 'polygon-tool',
  sew: 'sew', notch: 'notch', allowance: 'seam-links', fastener: 'fastener', internal: 'internal',
  pin: 'pin', measure: 'measure', orbit: 'camera', transform: 'select-3d',
  move: 'move-3d', rotate: 'rotate-3d', hand: 'hand',
}

export default function ViewportQuickTools({ dimension, activeTool, onChangeTool, availableTools, disabled = false }) {
  const usable = name => !disabled && (!availableTools || availableTools.includes(name))
  return (
    <div className={`canvas-tool-flyouts clo-corner-toolkit clo-corner-toolkit-${dimension}`} aria-label={`${dimension.toUpperCase()} viewport quick tools`} role="toolbar">
      {(TOOLS[dimension] || []).filter(group => !availableTools || availableTools.includes(group.name)).map((group) => (
        <div className="canvas-tool-group clo-corner-tool-group" key={group.name}>
          <button
            type="button"
            aria-label={group.label}
            title={group.label}
            aria-pressed={activeTool === group.name}
            className={activeTool === group.name ? 'active' : ''}
            disabled={!usable(group.name)}
            onClick={() => usable(group.name) && onChangeTool?.(group.name)}
          >
            <CadToolIcon id={group.icon} size={21}/>
            <span className="clo-corner-flyout-caret" aria-hidden="true" />
          </button>
          <div className="canvas-tool-options clo-corner-tool-options" role="group" aria-label={`${group.label} alternatives`}>
            {group.options.map((name) => (
              <button key={name} type="button" disabled={!usable(name)} className={activeTool === name ? 'active' : ''} aria-label={LABELS[name]} title={usable(name) ? LABELS[name] : `${LABELS[name]} (available in full Garment Studio)`} onClick={() => usable(name) && onChangeTool?.(name)}>
                <CadToolIcon id={ICONS[name]} size={19}/><span>{LABELS[name]}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
