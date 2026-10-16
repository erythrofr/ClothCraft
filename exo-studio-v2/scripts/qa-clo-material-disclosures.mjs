import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createServer} from 'vite'

const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'})
try {
  const {default:PropertyEditor}=await server.ssrLoadModule('/src/components/CloPropertyEditorAccordion.jsx')
  const {default:ObjectFields}=await server.ssrLoadModule('/src/components/CloObjectPropertyFields.jsx')
  const selected={type:'fabric',id:'test-fabric'}
  const project={fabrics:{'test-fabric':{id:'test-fabric',name:'Test Fabric',color:'#aabbcc',roughness:0.5,metalness:0.1,sheen:0.2}}}
  const markup=renderToStaticMarkup(React.createElement(PropertyEditor,{
    activeSection:'Fabric',objectTab:'Fabric',objectSelection:selected,project,
  }))
  assert.match(markup,/aria-controls="clo-pe-material-basic"/)
  assert.match(markup,/aria-controls="clo-pe-material-reflection"/)
  assert.match(markup,/aria-label="Basic Parameters"/)
  assert.match(markup,/aria-label="Reflection"/)
  const basic=renderToStaticMarkup(React.createElement(ObjectFields,{group:'material',selection:selected,project,includeFields:['color']}))
  const reflection=renderToStaticMarkup(React.createElement(ObjectFields,{group:'material',selection:selected,project,includeFields:['roughness','metalness','sheen']}))
  assert.match(basic,/data-property-field="color"/)
  assert.doesNotMatch(basic,/data-property-field="roughness"/)
  for(const field of ['roughness','metalness','sheen'])assert.match(reflection,new RegExp(`data-property-field="${field}"`))
  assert.doesNotMatch(reflection,/data-property-field="color"/)
  console.log('PASS: Material disclosure regions and Basic/Reflection field grouping')
} finally {
  await server.close()
}
