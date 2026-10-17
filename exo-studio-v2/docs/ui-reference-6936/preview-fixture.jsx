import React from 'react'
import { createRoot } from 'react-dom/client'
import GarmentLibraryPreview from '../../src/components/GarmentLibraryPreview.jsx'
import PremiumHardware3DPreview from '../../src/components/PremiumHardware3DPreview.jsx'
import LibraryAssetHover from '../../src/components/LibraryAssetHover.jsx'
import { listHardwarePresets } from '../../src/data/hardwarePresets.js'

const products = ['d-ring','prong-buckle','slide-adjuster']
const presets = listHardwarePresets()
function Fixture() {
  return <main data-fixture="ready">
    <h1>Garment reference 6936 · Hover QA</h1>
    <p>Real EXO garment preview and hardware components, mounted only on hover.</p>
    {['Garment','Patterns'].map(category => <LibraryAssetHover category={category} id="tee" key={category} title="Foundation Tee" description="Editable 3D pattern presentation" source="Illustrative curved template-based construction study." preview={<div className="exo-library-template-preview exo-library-template-preview--curved"><GarmentLibraryPreview name="Foundation Tee" templateId="tee" /></div>}>
      <button className="fixture-tile" data-fixture-category={category}>Hover to preview · {category}</button>
    </LibraryAssetHover>)}
    {products.map(id => {
      const preset = presets.find(p => p.id === id)
      return preset && <LibraryAssetHover key={id} category="hardware" id={id} title={preset.name} source="Original EXO model" preview={<PremiumHardware3DPreview preset={preset}/>}>
        <button className="fixture-tile" data-fixture-category={id}>Hover to preview · {preset.name}</button>
      </LibraryAssetHover>
    })}
  </main>
}
createRoot(document.getElementById('root')).render(<Fixture/>)
