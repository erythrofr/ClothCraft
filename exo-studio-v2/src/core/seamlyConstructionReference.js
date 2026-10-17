// Seamly2D .sm2d *source graph* reader. Preserves commands, formula text and
// point references without inventing evaluated 2D outlines. The source
// engine's entire geometry/formula execution contract is still separate.
import { XMLParser, XMLValidator } from 'fast-xml-parser'

const MAX_XML=4*1024*1024
const MAX_NODES=6000
const asList=value=>value==null?[]:Array.isArray(value)?value:[value]
const ATTR_PREFIX='@_'

export function parseSeamlyConstructionReference(xml,{filename=''}={}) {
  if(typeof xml!=='string' || xml.length>MAX_XML) throw new Error('Seamly .sm2d source must be XML smaller than 4 MB')
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('DOCTYPE/ENTITY are forbidden in garment-construction imports')
  const valid=XMLValidator.validate(xml)
  if(valid!==true) throw new Error(`Invalid .sm2d source XML: ${valid?.err?.msg||'not well formed'}`)
  const root=new XMLParser({
    ignoreAttributes:false,attributeNamePrefix:ATTR_PREFIX,
    parseTagValue:false,parseAttributeValue:false,trimValues:true,
    processEntities:true,
  }).parse(xml).pattern
  if(!root || !('version' in root) || !('unit' in root)) throw new Error('The file is not a Seamly2D pattern construction')
  const unit=String(root.unit).toLowerCase()
  if(!['cm','mm','inch','in'].includes(unit)) throw new Error(`Unsupported Seamly2D unit: ${unit}`)
  const blocks=asList(root.draftBlock).concat(asList(root.draw))
  if(!blocks.length || blocks.length>100) throw new Error('Expected 1–100 Seamly2D draft blocks')
  const grouped=[]
  let total=0
  const toolTypes={}
  const usedIncrements=new Set()
  const increments=asList(root.increments?.increment).map(item=>({
    name:String(item['@_name']||'').slice(0,128),
    formula:String(item['@_formula']||'').slice(0,4096),
    description:String(item['@_description']||'').slice(0,2048),
  }))
  const seenNames=new Set()
  for(const item of increments) {
    if(!item.name || seenNames.has(item.name)) throw new Error(`Duplicate or invalid Seamly increment: ${item.name}`)
    seenNames.add(item.name)
  }
  for(const [index,block] of blocks.entries()) {
    const calculation=block.calculation || {}
    const nodes=[]
    const usedIds=new Set()
    for(const [family,value] of Object.entries(calculation)) {
      if(family.startsWith('@_')) continue
      for(const item of asList(value)) {
        if(!item || typeof item!=='object') continue
        const id=String(item['@_id']||'')
        const type=String(item['@_type']||family)
        if(!id || usedIds.has(id)) throw new Error(`Seamly draft block has duplicate or missing construction ID: ${id}`)
        usedIds.add(id)
        const attributes=Object.fromEntries(Object.entries(item).filter(([key])=>key.startsWith(ATTR_PREFIX)).map(([key,value])=>[key.slice(2),String(value).slice(0,4096)]))
        const references=Object.fromEntries(
          ['firstPoint','secondPoint','basePoint','point1','point4','curve','idObject'].filter(key=>attributes[key]!=null).map(key=>[key,attributes[key]]))
        for(const value of Object.values(attributes)) {
          for(const found of value.matchAll(/#[A-Za-z][A-Za-z_0-9]*/g)) usedIncrements.add(found[0])
        }
        nodes.push({id,family,type,name:attributes.name||null,attributes,references})
        toolTypes[`${family}:${type}`]=(toolTypes[`${family}:${type}`]||0)+1
        if(++total>MAX_NODES) throw new Error('Seamly construction contains too many tools')
      }
    }
    grouped.push({
      id:`block-${index+1}`,
      name:String(block['@_name']||`Draft block ${index+1}`).slice(0,160),
      toolCount:nodes.length,
      nodes,
      detailCount:asList(block.details?.detail).length,
    })
  }
  const unresolvedIncrements=[...usedIncrements].filter(name=>!seenNames.has(name)).sort()
  return {
    format:'garment-studio-seamly-construction-reference.v1',
    kind:'sm2d',version:String(root.version).slice(0,80),unit,
    sourceName:String(filename).slice(0,255)||null,
    description:String(root.description||'').slice(0,2048),
    measurementPath:String(root.measurements||'').slice(0,512),
    note:'Read-only source graph. Geometry tools/formulas, cutting details and measurement dependencies require the original Seamly2D solver. Garment Studio will not pretend this is a manufacturing-ready flattened outline.',
    blocks:grouped,toolCount:total,incrementCount:increments.length,
    increments,toolTypes,unresolvedIncrements,
  }
}
