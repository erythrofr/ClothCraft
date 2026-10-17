// Deterministic, auditable intent router. Unknown requests stay unknown rather
// than invoking a plausible but unrelated tool. External LLMs can return this
// same action schema for exact execution after capability checks.
export const ASSISTANT_TOOL_SCHEMA_VERSION='1.0.0'
export const ASSISTANT_ACTIONS=Object.freeze([
 {id:'library.open',description:'Open a category in the docked asset library',mutates:false,arguments:{category:'Garment | Avatar | Hanger | Fabric | Hardware and Trims | Material | Stage | Patterns'}},
 {id:'workspace.view',description:'Show 2D, 3D or split viewport',mutates:false,arguments:{layout:'2d | 3d | split'}},
 {id:'pattern.importSvg',description:'Import SVG outlines into 2D without sewing',mutates:true,requiresFile:true},
 {id:'pattern.loadOutline',description:'Load a built-in pattern without sewing',mutates:true,arguments:{templateId:'built-in template ID'}},
 {id:'fabric.apply',description:'Apply an existing fabric preset to the selected piece',mutates:true,arguments:{presetId:'existing fabric preset ID'}},
 {id:'stage.select',description:'Select a local room for rendering',mutates:true,arguments:{stageId:'stage ID'}},
 {id:'hanger.select',description:'Select a garment hanger presentation prop',mutates:true,arguments:{hangerId:'existing hanger ID'}},
 {id:'simulation.start',description:'Simulate the current garment',mutates:true},
 {id:'simulation.reset',description:'Reset simulation',mutates:true},
 {id:'project.save',description:'Save the active project',mutates:true},
 {id:'history.undo',description:'Undo the last edit',mutates:true},
 {id:'history.redo',description:'Redo the last undone edit',mutates:true},
 {id:'render.exportStill',description:'Export a render of the active camera',mutates:false},
])
const LIBRARY_NAMES=[
 ['Hardware and Trims',/\b(buttons?|buttonholes?|zippers?|buckles?|rivets?|snaps?|trims?|hardware)\b/i],
 ['Stage',/\b(stages?|scene|rooms?|backdrops?|environments?)\b/i],
 ['Patterns',/\b(patterns?|2d patterns?|svg|illustrator)\b/i],
 ['Fabric',/\b(fabrics?|swatches?|textiles?)\b/i],
 ['Hanger',/\b(hangers?|rails?)\b/i],
 ['Avatar',/\b(avatars?|mannequins?|models?)\b/i],
 ['Garment',/\b(garments?|clothes|templates?)\b/i],
]
export function interpretAssistantIntent(input,{fabrics={},stages=[],templates=[],hangers=[]}={}){
 const raw=String(input||'').trim()
 if(!raw||raw.length>400)return null
 const text=raw.toLowerCase()
 if(/\b(import|open|add|load|upload)\b/.test(text)&&/\b(svg|illustrator)\b/.test(text))
   return {action:'pattern.importSvg',confidence:'exact'}
 if(/\b(undo|go back one step|revert last change)\b/.test(text))return {action:'history.undo',confidence:'exact'}
 if(/\b(redo|repeat last undone)\b/.test(text))return {action:'history.redo',confidence:'exact'}
 if(/\b(save|save project)\b/.test(text)&&!/\b(image|render|photo)\b/.test(text))return {action:'project.save',confidence:'exact'}
 if(/\b(export|capture|save)\b/.test(text)&&/\b(render|image|photo|screenshot)\b/.test(text))return {action:'render.exportStill',confidence:'exact'}
 if(/\b(reset|restart)\b/.test(text)&&/\b(simulation|sim|drape)\b/.test(text))return {action:'simulation.reset',confidence:'exact'}
 if(/\b(simulate|simulation|start sim|run sim|drape the garment)\b/.test(text))return {action:'simulation.start',confidence:'exact'}
 if(/\b(show|open|switch|focus|maximize)\b/.test(text)&&/\b(2d|3d|both|split)\b/.test(text)){
   const layout=/\b2d\b/.test(text)?'2d':/\b3d\b/.test(text)?'3d':'split'
   return {action:'workspace.view',args:{layout},confidence:'exact'}
 }
 if(/\b(use|load|open)\b/.test(text)&&/\b(pattern|template|draft)\b/.test(text)){
   const template=templates.find(x=>text.includes(x.name.toLowerCase()))
   if(template)return {action:'pattern.loadOutline',args:{templateId:template.id},confidence:'exact'}
 }
 if(/\b(apply|use|change|switch)\b/.test(text)&&/\b(fabric|denim|silk|cotton|nylon|leather|terry|twill)\b/.test(text)){
   const candidates=Object.entries(fabrics).filter(([,item])=>text.includes(item.name.toLowerCase()))
   const match=candidates.sort((a,b)=>b[1].name.length-a[1].name.length)[0]
   if(match)return {action:'fabric.apply',args:{presetId:match[0]},confidence:'exact'}
 }
 if(/\b(use|load|set|select|change)\b/.test(text)&&/\b(stage|room|backdrop|scene)\b/.test(text)){
   const match=stages.find(x=>text.includes(x.name.toLowerCase())||text.includes(x.id.toLowerCase()))
   if(match)return {action:'stage.select',args:{stageId:match.id},confidence:'exact'}
 }
 if(/\b(use|load|set|select|change)\b/.test(text)&&/\bhanger\b/.test(text)){
   const match=hangers.find(x=>text.includes(x.name.toLowerCase())||text.includes(x.id.toLowerCase()))
   if(match)return {action:'hanger.select',args:{hangerId:match.id},confidence:'exact'}
 }
 if(/\b(open|show|browse|find|search|view)\b/.test(text)){
   const category=LIBRARY_NAMES.find(([,pattern])=>pattern.test(text))?.[0]
   if(category)return {action:'library.open',args:{category},confidence:'exact'}
 }
 return null
}
