import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ClothCraftWorkspace from './components/ClothCraftWorkspace.jsx'
import './styles.css'
import './clo-interface.css'
// Load the neutral CLO chrome and bright drafting board last so legacy
// dark-theme rules cannot override the new 2D surface during production builds.
import './clo-neutral-theme.css'
import './components/PatternDraftingEnhancements.css'
// Finish with the CLO-style neutral workspaces so older dark drafting styles
// cannot override the new light canvas after Vite's CSS dependency ordering.
import './clo-neutral-theme.css'
import './components/PatternDraftingEnhancements.css'

// The packaged macOS workspace uses a denser desktop-application layout,
// without changing the existing browser workspace or its saved project.
if (new URLSearchParams(window.location.search).get('desktop') === '1') {
  document.documentElement.classList.add('desktop-workspace')
}

if (new URLSearchParams(window.location.search).get('engine') === 'clothcraft') {
  document.title = 'EXO ClothCraft Studio — Native Rust Garment Workspace'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get('engine') === 'clothcraft-lab'
      ? <ClothCraftWorkspace />
      : <>
          <App />
          {window.location.port === '5286' && new URLSearchParams(window.location.search).get('engine') !== 'clothcraft' && (
            <a className="clothcraft-workspace-launch" style={{position:'fixed',bottom:40,right:20,zIndex:1000,padding:'10px 16px',background:'#345867',color:'white',borderRadius:6}} href="?desktop=1&engine=clothcraft">ClothCraft workspace →</a>
          )}
        </>}
  </React.StrictMode>,
)
