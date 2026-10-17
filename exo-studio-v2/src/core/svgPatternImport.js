// Imports Illustrator/Inkscape SVG outline paths as editable, UNSEWN EXO
// pattern pieces. No external script/style/image is ever mounted into the DOM.
// Convert complex effects or clipping masks to plain outlined paths first.
const SVG_NS='http://www.w3.org/2000/svg'
const toCm=unit=>{
  const found=String(unit||'').trim().match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/i)
  if(!found)return null
  const value=Number(found[1])
  const factor={mm:.1,cm:1,in:2.54,pt:2.54/72,px:2.54/96}
  return Number.isFinite(value)&&value>0?value*factor[(found[2]||'px').toLowerCase()]:null
}
const matrixTransform=(value)=>{
  if(!value)return [1,0,0,1,0,0]
  const tokens=[...value.matchAll(/(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi)]
  let result=[1,0,0,1,0,0]
  const mul=(x,y)=>[x[0]*y[0]+x[2]*y[1],x[1]*y[0]+x[3]*y[1],x[0]*y[2]+x[2]*y[3],x[1]*y[2]+x[3]*y[3],x[0]*y[4]+x[2]*y[5]+x[4],x[1]*y[4]+x[3]*y[5]+x[5]]
  for(const token of tokens){
    const v=token[2].split(/[\s,]+/).filter(Boolean).map(Number)
    if(v.some(n=>!Number.isFinite(n)))throw new Error('Invalid SVG transformation')
    let next
    switch(token[1].toLowerCase()){
      case 'matrix':if(v.length!==6)throw new Error('Invalid SVG matrix');next=v;break
      case 'translate':next=[1,0,0,1,v[0]||0,v[1]||0];break
      case 'scale':next=[v[0],0,0,v[1]??v[0],0,0];break
      case 'rotate':{
        if(v.length>1)throw new Error('Rotate around pivot: expand transforms in Illustrator before importing')
        const a=(v[0]||0)*Math.PI/180;next=[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];break
      }
      default:throw new Error('Unsupported SVG transform')
    }
    result=mul(result,next)
  }
  if(tokens.map(t=>t[0]).join('').replace(/\s+/g,'')!==value.replace(/\s+/g,''))throw new Error('Unsupported SVG transform; expand appearances first')
  return result
}
function boundaryFor(element){
  const tag=element.localName.toLowerCase()
  if(tag==='path'){
    const d=element.getAttribute('d')||''
    if(!/[zZ]\s*$/.test(d))return null
    // SVGGeometryElement supports flattening curves without losing their
    // visible shape. We intentionally do not import internal paths as seams.
    const geometry=document.createElementNS(SVG_NS,'path')
    geometry.setAttribute('d',d)
    const length=geometry.getTotalLength()
    if(!Number.isFinite(length)||length<=0)return null
    const steps=Math.min(128,Math.max(16,Math.ceil(length/9)))
    return Array.from({length:steps},(_,i)=>geometry.getPointAtLength(length*i/steps))
  }
  if(tag==='polygon'||tag==='polyline'){
    if(tag==='polyline'&&!String(element.getAttribute('points')||'').trim().match(/(?:\d[\d.]*)\s*,?\s*(?:\d[\d.]*)\s*$/))return null
    const numbers=(element.getAttribute('points')||'').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number)||[]
    if(numbers.length<6||numbers.length%2)return null
    return Array.from({length:numbers.length/2},(_,i)=>({x:numbers[i*2],y:numbers[i*2+1]}))
  }
  if(tag==='rect'){
    const x=Number(element.getAttribute('x')||0),y=Number(element.getAttribute('y')||0),
      w=Number(element.getAttribute('width')),h=Number(element.getAttribute('height'))
    if(!(w>0&&h>0))return null
    return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]
  }
  if(tag==='circle'||tag==='ellipse'){
    const cx=Number(element.getAttribute('cx')||0),cy=Number(element.getAttribute('cy')||0),
      rx=Number(element.getAttribute(tag==='circle'?'r':'rx')),ry=tag==='circle'?rx:Number(element.getAttribute('ry'))
    if(!(rx>0&&ry>0))return null
    return Array.from({length:48},(_,i)=>({x:cx+rx*Math.cos(i*Math.PI/24),y:cy+ry*Math.sin(i*Math.PI/24)}))
  }
  return null
}
export function parseSvgPattern(source,{fileName='Illustrator SVG',maxPieces=64}={}){
  if(typeof DOMParser==='undefined')throw new Error('SVG pattern import needs the browser editor')
  if(typeof source!=='string'||source.length>3*1024*1024)throw new Error('SVG exceeds the 3MB import limit')
  const doc=new DOMParser().parseFromString(source,'image/svg+xml')
  if(doc.querySelector('parsererror')||doc.documentElement?.localName!=='svg')throw new Error('Invalid SVG document')
  if(doc.querySelector('script,foreignObject,iframe,use,image,style,filter,clipPath,mask'))throw new Error('Expand linked graphics, effects and embedded elements to closed paths in Illustrator')
  const root=doc.documentElement
  const viewBox=String(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number)
  const scale=viewBox.length===4 && viewBox[2]>0 && toCm(root.getAttribute('width'))
    ?toCm(root.getAttribute('width'))/viewBox[2]:2.54/96
  const elements=[...root.querySelectorAll('path,polygon,polyline,rect,ellipse,circle')].filter(el=>{
    const style=el.getAttribute('style')||''
    return !el.closest('defs,symbol') && el.getAttribute('display')!=='none' && !/display\s*:\s*none/.test(style)
  })
  const pieces=[]
  for(const el of elements){
    let coords=boundaryFor(el)
    if(!coords||coords.length<3)continue
    let chain=[1,0,0,1,0,0]
    for(const ancestor of [el,...(function*(node){for(let x=node.parentElement;x&&x!==root;x=x.parentElement)yield x})(el)].reverse()){
      const matrix=matrixTransform(ancestor.getAttribute('transform'))
      const [a,b,c,d,e,f]=matrix,[A,B,C,D,E,F]=chain
      chain=[A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F]
    }
    coords=coords.map(p=>({x:(chain[0]*p.x+chain[2]*p.y+chain[4])*scale,y:(chain[1]*p.x+chain[3]*p.y+chain[5])*scale}))
    if(coords.length>1&&Math.hypot(coords[0].x-coords.at(-1).x,coords[0].y-coords.at(-1).y)<.02)coords.pop()
    if(coords.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e5||Math.abs(p.y)>1e5))throw new Error('Invalid or oversized SVG coordinates')
    const minX=Math.min(...coords.map(p=>p.x)),maxX=Math.max(...coords.map(p=>p.x))
    const minY=Math.min(...coords.map(p=>p.y)),maxY=Math.max(...coords.map(p=>p.y))
    if(maxX-minX<.2||maxY-minY<.2)continue
    if(pieces.length>=maxPieces)throw new Error(`Too many pattern outlines (limit ${maxPieces})`)
    const id=`svg-pattern-${pieces.length+1}`,width=maxX-minX,height=maxY-minY
    pieces.push({id,name:el.getAttribute('data-name')||el.getAttribute('id')||`Illustrator panel ${pieces.length+1}`,
      points:coords.map(({x,y})=>({x:x-(minX+maxX)/2,y:maxY-y})),curves:{},
      layout2d:{x:95+(pieces.length%3)*95,y:110+Math.floor(pieces.length/3)*95},
      arrangement3d:{x:(pieces.length%3-1)*.7,y:1,z:-.65,flip:false},
      notches:[],internalLines:[],seamAllowance:0,fabricId:'main',locked:false,
      sourceSvg:{fileName,element:el.localName,referenceScaleCmPerUnit:scale,originalWidthCm:width,originalHeightCm:height}})
  }
  if(!pieces.length)throw new Error('SVG contains no closed, valid pattern outlines. Outline paths and try again.')
  return {pieces,scaleToCm:scale,sourceFile:fileName,seams:[]}
}
