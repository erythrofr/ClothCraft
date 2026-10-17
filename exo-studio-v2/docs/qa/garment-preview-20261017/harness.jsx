import React from 'react'
import { createRoot } from 'react-dom/client'
import GarmentLibraryPreview from '../../../src/components/GarmentLibraryPreview.jsx'

const params = new URLSearchParams(location.search)
const templateId = params.get('templateId') || 'tee'
const container = document.getElementById('preview-harness')
container.style.cssText = 'height:100vh;width:100vw;box-sizing:border-box;padding:20px;display:flex;justify-content:center;align-items:center;'
const stage = document.createElement('div')
stage.style.cssText = 'width:min(100%,760px);height:min(90vh,590px);box-shadow:0 10px 50px #0009;border:1px solid #555;border-radius:10px;overflow:hidden;'
container.appendChild(stage)
createRoot(stage).render(<GarmentLibraryPreview templateId={templateId} name={templateId === 'tee' ? 'Foundation Tee' : templateId}/>)
