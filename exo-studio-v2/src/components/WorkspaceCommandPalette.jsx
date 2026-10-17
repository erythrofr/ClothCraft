import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchWorkspaceCommands } from '../core/workspaceCommandIndex.js'

export default function WorkspaceCommandPalette({ open, commands, onExecute, onClose }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const priorFocusRef = useRef(null)
  const results = useMemo(() => searchWorkspaceCommands(commands, query), [commands, query])

  useEffect(() => {
    if (!open) return undefined
    priorFocusRef.current = document.activeElement
    setQuery('')
    setActiveIndex(0)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      if (priorFocusRef.current?.isConnected) priorFocusRef.current.focus()
    }
  }, [open])

  if (!open) return null
  const execute = (command) => { if (command) { onExecute(command.action); onClose() } }
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => (index + 1) % Math.max(1, results.length)); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => (index + results.length - 1) % Math.max(1, results.length)); return }
    if (event.key === 'Enter') { event.preventDefault(); execute(results[activeIndex] || results[0]) }
  }
  return <div className="clo-command-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="clo-command-dialog" role="dialog" aria-modal="true" aria-label="Find Garment Studio commands" onKeyDown={onKeyDown}>
      <div className="clo-command-search"><Search size={19}/><input ref={inputRef} aria-label="Search working tools and workspace commands" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="clo-command-results" placeholder="Find tool, command, or workspace…" value={query} onChange={event => {setQuery(event.target.value);setActiveIndex(0)}}/><button type="button" aria-label="Close command search" onClick={onClose}><X size={18}/></button></div>
      <div id="clo-command-results" className="clo-command-results" role="listbox" aria-label="Matching available commands">
        {results.length ? results.map((command, index) => <button type="button" role="option" aria-selected={index === activeIndex} key={command.action} className={index === activeIndex ? 'active' : ''} onMouseEnter={() => setActiveIndex(index)} onClick={() => execute(command)}>
          <span>{command.label}</span><small>{command.group}</small>
        </button>) : <p>No working command matches that search.</p>}
      </div>
      <div className="clo-command-hint">↑ ↓ Navigate · Enter Run · Esc Close · Only implemented commands are indexed</div>
    </section>
  </div>
}
