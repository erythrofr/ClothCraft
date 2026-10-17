import React from 'react'
import { getStagePreset } from '../data/stagePresets.js'
import LibraryAssetHover from './LibraryAssetHover.jsx'
import Library3DAssetPreview from './Library3DAssetPreview.jsx'
import './StageCatalog.css'

const FEATURED_IDS = ['R02', 'R03', 'S01', 'S10']
const FEATURED_DETAIL = {
  R02: '6,344 polygons · mountain runway',
  R03: '5,288 polygons · mirrored runway',
  S01: '3,486 polygons · botanical studio',
  S10: '3,468 polygons · garden entrance',
}

function StagePoster({ id, name }) {
  const [failed, setFailed] = React.useState(false)
  return failed
    ? <span className="exo-stage-poster-fallback" role="img" aria-label={`${name} poster unavailable`}>{name}</span>
    : <img className="exo-stage-poster" src={`/stage-posters/${id}.png`} alt={`Rendered 3D scene: ${name}`} loading="lazy" draggable={false} onError={() => setFailed(true)} />
}

export default function StageCatalog({ selectedStageId = 'none', onSelectStage, search = '', compact = false }) {
  // A single GLB canvas is temporarily mounted for offline poster capture.
  // Even the poster generator never opens five card WebGL contexts together.
  const captureStageId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('stagePosterCapture')
  const stageVisual = (id, name) => captureStageId === id
    ? <Library3DAssetPreview kind="stage" variant={id} label={name} interactive={false} />
    : <StagePoster id={id} name={name} />
  const presets = FEATURED_IDS.map(getStagePreset).filter(Boolean)
  const selected = selectedStageId==='cathedral'
    ? {id:'cathedral',name:'MIKRISTIAN Cathedral House',description:'Imported from the user-owned Blender house scene; geometry loaded as a GLB in EXO.',sceneHints:['Local 3D model','Actual room mesh'],referenceUrl:null}
    : presets.find(item => item.id === selectedStageId)
  const term = search.trim().toLowerCase()
  const matches = preset => `${preset.name} ${preset.id} ${preset.description || ''} ${preset.sceneHints || ''}`.toLowerCase().includes(term)
  return <div className={`exo-stage-catalog ${compact ? 'exo-stage-catalog-compact' : ''}`}>
    <div className="exo-stage-library-heading"><span>STAGE LIBRARY</span><small>5 curated 3D stages</small></div>
    <LibraryAssetHover category="stage" id="none" title="Empty studio" description="Return the garment to the neutral studio with no staged props or room geometry." source="Built-in EXO neutral studio environment" preview={<Library3DAssetPreview kind="stage" variant="studio" label="Empty studio" height={270}/>}>
      <button type="button" className={`exo-stage-empty ${!selected ? 'is-selected' : ''}`} aria-pressed={!selected} onClick={() => onSelectStage('none')}>
        <span className="exo-stage-empty-symbol">○</span><span>Empty studio <small>Clear scene geometry</small></span>
      </button>
    </LibraryAssetHover>
    {selected && <div className="exo-stage-selected-detail"><strong>{selected.id} · {selected.name}</strong><p>{selected.description}</p>{selected.sceneHints && <small>{Array.isArray(selected.sceneHints) ? selected.sceneHints.join(' · ') : selected.sceneHints}</small>}{selected.referenceUrl && <a href={selected.referenceUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>View CLO CONNECT reference ↗</a>}</div>}
    {(!term || 'cathedral mikristian blender imported house room'.includes(term)) && <LibraryAssetHover category="stage" id="cathedral" title="MIKRISTIAN Cathedral House" description="Imported from the existing user Blender room scene." source="Verified local Blender GLB" preview={<Library3DAssetPreview kind="stage" variant="cathedral" height={270}/>}>
      <button type="button" className={`exo-stage-card ${selectedStageId==='cathedral'?'is-selected':''}`} aria-pressed={selectedStageId==='cathedral'} onClick={()=>onSelectStage('cathedral')}><span className="exo-stage-illustration studio" data-stage-id="cathedral">{stageVisual('cathedral','MIKRISTIAN Cathedral House')}</span><span className="exo-stage-card-name"><small>226 meshes · Blender scene</small>MIKRISTIAN Cathedral House</span></button>
    </LibraryAssetHover>}
    {['runway', 'studio'].map(kind => {
      const items = presets.filter(preset => preset.kind === kind && matches(preset))
      if (!items.length) return null
      return <section key={kind} className="exo-stage-category" aria-label={kind === 'runway' ? 'Runway stages' : 'Editorial studio stages'}><h4>{kind === 'runway' ? 'RUNWAY · CATWALK' : 'EDITORIAL · STUDIO'} <span>{items.length}</span></h4><div className="exo-stage-grid">{items.map(preset => <LibraryAssetHover key={preset.id} category="stage" id={preset.id} title={preset.name} description={preset.description} details={[["Asset",preset.id],["Type",kind === 'runway' ? 'Catwalk / Runway' : 'Editorial / Studio'],["Geometry","EXO Blender GLB scene"]]} source="EXO-owned Blender geometry; inspired by a public CONNECT listing." preview={<Library3DAssetPreview kind="stage" variant={preset.id} label={preset.name} height={270} />}><button type="button" className={`exo-stage-card ${selectedStageId === preset.id ? 'is-selected' : ''}`} aria-pressed={selectedStageId === preset.id} title={preset.description || preset.name} onClick={() => onSelectStage(preset.id)}><span className={`exo-stage-illustration ${kind}`} data-stage-id={preset.id}>{stageVisual(preset.id,preset.name)}</span><span className="exo-stage-card-name"><small>{preset.id} · {FEATURED_DETAIL[preset.id]}</small>{preset.name}</span></button></LibraryAssetHover>)}</div></section>
    })}
    {!presets.some(matches) && term && <p className="exo-stage-no-results">No stages match “{search}”.</p>}
    <p className="exo-stage-library-footnote">Five curated, working 3D scenes. Visual quality is work in progress; these are not photorealistic environments. Other prototypes remain archived.</p>
  </div>
}
