import React from 'react'
import { createRoot } from 'react-dom/client'
import Library3DAssetPreview from '../../src/components/Library3DAssetPreview.jsx'
import LibraryAssetHover from '../../src/components/LibraryAssetHover.jsx'

const hangers=['wood','chrome','velvet','padded','trouser-clip']
const avatars=['clo-thomas','theo','nora']
function App() {
  return <main id="fixture-ready">
    <h1>EXO Library Preview QA</h1>
    <p>The library tiles use static images; hover each tile for real draggable 3D.</p>
    <section className="fixture-grid">
      {hangers.map(id=><LibraryAssetHover key={id} category="Hanger" id={id} title={id}
        preview={<Library3DAssetPreview kind="hanger" variant={id} height={230}/>}>
        <button type="button" className="fixture-tile" data-fixture-hanger={id}>
          <span className="exo-hanger-library-tile"><Library3DAssetPreview kind="hanger" variant={id} interactive={false} height={70}/></span>
          <small>{id}</small>
        </button>
      </LibraryAssetHover>)}
      {avatars.map(id=><LibraryAssetHover key={id} category="Avatar" id={id} title={id}
        preview={<Library3DAssetPreview kind="avatar" variant={id} height={230}/>}>
        <button type="button" className="fixture-tile" data-fixture-avatar={id}>
          <span className="library-3d-preview" style={{height:70}}>3D fitting avatar</span>
          <small>{id}</small>
        </button>
      </LibraryAssetHover>)}
    </section>
  </main>
}
createRoot(document.getElementById('root')).render(<App/>)
