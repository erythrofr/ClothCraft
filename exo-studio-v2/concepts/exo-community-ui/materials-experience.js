// Self-contained offline material study. Values describe illustrative samples, not tested fabrics.
const FABRICS = [
  {id:'terry',name:'French terry',family:'Knitted loopback',weave:'Loopback knit',gsm:460,stretch:'18–30%',roughness:.86,drape:3,provenance:'Illustrative heavyweight cotton blend',colors:[['Coal','#2c3135'],['Bone','#c5c0b3'],['Moss','#555c4c'],['Clay','#897266']]},
  {id:'denim',name:'Rigid denim',family:'Woven cotton',weave:'3/1 twill',gsm:390,stretch:'0–2%',roughness:.81,drape:2,provenance:'Illustrative indigo cotton twill',colors:[['Washed indigo','#415b78'],['Raw indigo','#232f4b'],['Ecru','#b9b09b'],['Pitch','#34393d']]},
  {id:'twill',name:'Cotton twill',family:'Structured woven',weave:'2/1 twill',gsm:275,stretch:'1–4%',roughness:.72,drape:3,provenance:'Illustrative combed cotton',colors:[['Oat','#b7aa8e'],['Black','#383a39'],['Olive','#64684d'],['Stone','#858783']]},
  {id:'nylon',name:'Nylon ripstop',family:'Technical woven',weave:'Reinforced grid',gsm:95,stretch:'1–5%',roughness:.35,drape:4,provenance:'Illustrative nylon shell reference',colors:[['Graphite','#505a62'],['Silver','#a2adb1'],['Cobalt','#486f9b'],['Forest','#374d42']]},
  {id:'leather',name:'Full-grain leather',family:'Natural hide',weave:'Irregular grain',gsm:750,stretch:'2–8%',roughness:.58,drape:1,provenance:'Illustrative bovine leather reference',colors:[['Espresso','#4e3229'],['Oxide','#82533c'],['Onyx','#25282a'],['Tan','#a8774d']]},
  {id:'canvas',name:'Cotton canvas',family:'Woven utility',weave:'Plain weave',gsm:340,stretch:'0–3%',roughness:.83,drape:2,provenance:'Illustrative cotton duck canvas',colors:[['Natural','#bbac90'],['Ink','#333a3e'],['Rust','#8d5745'],['Sage','#717c6c']]}
];

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function colorRGB(hex){const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
function materialTexture(canvas,fabric,color,zoom=1){
  const {width:w,height:h}=canvas;const ctx=canvas.getContext('2d');if(!ctx)return;
  const [r,g,b]=colorRGB(color);ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
  // Deterministic microstructure: all samples remain stable when switching controls.
  let seed=123457+FABRICS.indexOf(fabric)*971;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const tile=(fabric.id==='nylon'?20:fabric.id==='leather'?13:8)/zoom;
  const line=(alpha,width)=>{ctx.strokeStyle=`rgba(245,242,225,${alpha})`;ctx.lineWidth=width;};
  if(['denim','twill'].includes(fabric.id)){
    ctx.save();ctx.translate(-h/2,0);ctx.rotate(-Math.PI/4);
    for(let y=-h;y<w+h*2;y+=tile){line(fabric.id==='denim'?.21:.18,Math.max(1,tile*.36));ctx.beginPath();ctx.moveTo(-h,y);ctx.lineTo(w+h*2,y);ctx.stroke();}
    for(let x=-h;x<w+h*2;x+=tile*.8){ctx.strokeStyle='rgba(7,17,28,.19)';ctx.lineWidth=Math.max(.8,tile*.2);ctx.beginPath();ctx.moveTo(x,-h);ctx.lineTo(x,h*3);ctx.stroke();}
    ctx.restore();
  } else if(fabric.id==='terry'){
    for(let y=0;y<h+tile;y+=tile){for(let x=0;x<w+tile;x+=tile){const shift=Math.floor(y/tile)%2?tile/2:0;ctx.beginPath();ctx.ellipse(x+shift,y,tile*.3,tile*.42,Math.PI/7,0,Math.PI*2);ctx.strokeStyle='rgba(244,240,224,.23)';ctx.lineWidth=Math.max(.8,tile*.21);ctx.stroke();ctx.beginPath();ctx.arc(x+shift,y+tile*.1,tile*.13,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,.09)';ctx.fill();}}
  } else if(fabric.id==='nylon'||fabric.id==='canvas'){
    for(let x=0;x<w;x+=tile){ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=Math.max(.6,tile*.09);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=tile){ctx.strokeStyle='rgba(0,0,0,.17)';ctx.lineWidth=Math.max(.7,tile*.1);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    if(fabric.id==='nylon'){for(let x=0;x<w;x+=tile*4){ctx.fillStyle='rgba(235,242,255,.12)';ctx.fillRect(x,0,1.5,h);}for(let y=0;y<h;y+=tile*4){ctx.fillStyle='rgba(235,242,255,.15)';ctx.fillRect(0,y,w,1.5);}}
  }else if(fabric.id==='leather'){
    for(let i=0;i<9000;i++){const x=rand()*w,y=rand()*h,rad=.2+rand()*tile*.26;ctx.beginPath();ctx.ellipse(x,y,rad,rad*(.5+rand()),rand()*Math.PI,0,Math.PI*2);ctx.fillStyle=rand()>.55?'rgba(240,219,195,.09)':'rgba(13,7,4,.11)';ctx.fill();}
  }
  const grains=Math.floor(w*h/36);for(let i=0;i<grains;i++){const x=rand()*w,y=rand()*h;ctx.fillStyle=rand()>.5?'rgba(255,255,255,.075)':'rgba(0,0,0,.06)';ctx.fillRect(x,y,rand()*1.7+.3,rand()*2+.3);}
  // Raking studio light across soft irregular folds, kept explicitly optical.
  const shade=ctx.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h;
    const folds=Math.sin(u*15.3+Math.sin(v*3.1)*1.6)+.43*Math.sin(u*32.5-v*1.8)+.17*Math.sin(u*63+v*5);
    const diagonal=(1-u)*.19+(1-v)*.09;
    const illumination=clamp(.77+folds*.135+diagonal,.43,1.27);
    const index=(y*w+x)*4;
    shade.data[index]=r*illumination;shade.data[index+1]=g*illumination;shade.data[index+2]=b*illumination;shade.data[index+3]=Math.round((fabric.id==='nylon'?.45:.28)*255);
  }
  const buffer=document.createElement('canvas');buffer.width=w;buffer.height=h;buffer.getContext('2d').putImageData(shade,0,0);ctx.drawImage(buffer,0,0);
  const shine=ctx.createLinearGradient(0,0,w,h);shine.addColorStop(0,'rgba(255,255,255,.24)');shine.addColorStop(.4,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(0,0,0,.34)');ctx.fillStyle=shine;ctx.fillRect(0,0,w,h);
}

/** Mount the offline material experience; returns {destroy, selectMaterial, getSelection}.
 * opts.onMaterialChange({id,name,color,colorName,gsm,roughness,stretch,weave,visualDrape,previewOnly:true})
 * opts.onApply receives the same descriptor after user chooses "Use visual reference".
 */
export function mountMaterialExperience(container,asset={},opts={}){
  if(!(container instanceof Element))throw new TypeError('A DOM container is required');
  const inferred=String(asset?.materialId||asset?.material||asset?.title||'').toLowerCase();
  let active=FABRICS.find(f=>inferred.includes(f.id)||inferred.includes(f.name.toLowerCase()))||FABRICS[0];
  let colorIndex=0,zoom=1,tab='appearance';
  const uid=`exomat-${Math.random().toString(36).slice(2,9)}`;
  container.classList.add('exo-material-mount');
  container.innerHTML=`<section class="exo-material" aria-label="Material explorer">
    <div class="exo-material-head"><div><span class="exo-m-kicker">EXO / MATERIAL ATLAS</span><h2>Material studies<span>.</span></h2><p>Explore the surface, composition and visual character of a fabric.</p></div><span class="exo-m-sample">CONCEPT DATA · VISUAL REFERENCE</span></div>
    <div class="exo-m-shell"><aside class="exo-m-library"><div class="exo-m-section-title">01 / FABRIC INDEX <small>${String(FABRICS.length).padStart(2,'0')} ENTRIES</small></div><div class="exo-m-library-intro">THE MATERIAL LIBRARY <span>VOL. 001</span></div><div class="exo-m-picker" role="group" aria-label="Select material"></div><p class="exo-m-note">Original algorithmic surfaces. Created to explore visual direction. Supplier specifications and laboratory tests are required for production.</p></aside>
    <div class="exo-m-stage"><div class="exo-m-canvas-wrap"><div class="exo-m-topline"><span>02 / SURFACE OBSERVATORY</span><span>STUDIO LIGHTING · DIGITAL SPECIMEN</span></div><canvas class="exo-m-main-canvas" width="560" height="450" role="img" aria-label="Procedural closeup of selected fabric surface"></canvas><div class="exo-m-specimen-tag"><span>SPECIMEN / <strong class="exo-m-specimen-number">01</strong></span><strong class="exo-m-specimen-name">FRENCH TERRY</strong><small>RENDERED CONSTRUCTION STUDY</small></div><div class="exo-m-scale"><span>TEXTURE / NON-METRIC VIEW</span><label for="${uid}-zoom">MAGNIFY <input id="${uid}-zoom" type="range" min="1" max="3" step=".5" value="1" aria-label="Texture magnification"></label></div></div><div class="exo-m-observations"><div><span>CONSTRUCTION</span><strong class="exo-m-ob-weave"></strong></div><div><span>HAND / VISUAL IMPRESSION</span><strong class="exo-m-ob-hand"></strong></div><div><span>USE CASE</span><strong class="exo-m-ob-use"></strong></div></div><div class="exo-m-color-heading"><span>COLOR STUDIES <small>04 PALETTES</small></span><strong class="exo-m-current-color"></strong></div><div class="exo-m-colorways" role="group" aria-label="Select material color"></div></div>
    <aside class="exo-m-inspector"><div class="exo-m-section-title">03 / SPECIMEN RECORD <span>↗</span></div><div class="exo-m-heading"><span class="exo-m-family"></span><h3 class="exo-m-name"></h3><p class="exo-m-source"></p></div><div class="exo-m-record-label">MATERIAL CHARACTER / DESIGN INTENT</div><div class="exo-m-tabs" role="tablist" aria-label="Material information"><button role="tab" aria-selected="true" data-tab="appearance">Optical study</button><button role="tab" aria-selected="false" data-tab="properties">Reference data</button></div><div class="exo-m-tab-content"></div><div class="exo-m-provenance"><span>DATA STATUS / CONCEPT ONLY</span><p>Color, lighting and folds are procedural visual studies. Numeric figures are illustrative category references, never certified material measurements.</p></div><button class="exo-m-apply" type="button">Apply visual direction <span>↗</span></button></aside></div></section>`;
  const q=sel=>container.querySelector(sel);
  const canvas=q('.exo-m-main-canvas');
  function selected(){const [colorName,color]=active.colors[colorIndex];return {id:active.id,name:active.name,color,colorName,gsm:active.gsm,roughness:active.roughness,stretch:active.stretch,weave:active.weave,visualDrape:active.drape,previewOnly:true};}
  function emit(){opts.onMaterialChange?.(selected());opts.onChange?.(selected());}
  function render(){
    q('.exo-m-picker').innerHTML=FABRICS.map((f,i)=>`<button type="button" class="exo-m-fabric ${active===f?'active':''}" data-fabric="${f.id}" aria-pressed="${active===f}"><span class="exo-m-fabric-chip" style="--chip:${f.colors[0][1]}"><canvas width="90" height="108" aria-hidden="true"></canvas></span><span class="exo-m-fabric-copy"><small>EXO—${String(i+1).padStart(2,'0')}</small><strong>${escapeHTML(f.name)}</strong><em>${escapeHTML(f.family)}</em></span><span class="exo-m-fabric-arrow" aria-hidden="true">↗</span></button>`).join('');
    q('.exo-m-picker').querySelectorAll('.exo-m-fabric').forEach((button,i)=>materialTexture(button.querySelector('canvas'),FABRICS[i],FABRICS[i].colors[0][1],1.5));
    q('.exo-m-colorways').innerHTML=active.colors.map(([name,color],i)=>`<button type="button" class="exo-m-color ${i===colorIndex?'active':''}" data-color="${i}" aria-label="${escapeHTML(name)}" aria-pressed="${i===colorIndex}" title="${escapeHTML(name)}"><span style="--swatch:${color}"></span></button>`).join('');
    q('.exo-m-current-color').textContent=active.colors[colorIndex][0];
    q('.exo-m-family').textContent=active.family.toUpperCase();q('.exo-m-name').textContent=active.name;q('.exo-m-source').textContent=active.provenance;
    const impressions={terry:['Plush / dimensional','Sweatshirts & lounge'],denim:['Dry / rigid','Denim jackets & jeans'],twill:['Dense / tailored','Trousers & uniforms'],nylon:['Crisp / luminous','Shells & outerwear'],leather:['Supple / grained','Leather goods & trims'],canvas:['Sturdy / tactile','Bags & workwear']};
    q('.exo-m-specimen-number').textContent=String(FABRICS.indexOf(active)+1).padStart(2,'0');q('.exo-m-specimen-name').textContent=active.name.toUpperCase();
    q('.exo-m-ob-weave').textContent=active.weave;q('.exo-m-ob-hand').textContent=impressions[active.id][0];q('.exo-m-ob-use').textContent=impressions[active.id][1];
    q('.exo-m-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
    q('.exo-m-tab-content').innerHTML=tab==='appearance'?`<div class="exo-m-preview-heading">SHADER / DESIGN PARAMETERS</div><div class="exo-m-metric"><span>Structure</span><strong>${escapeHTML(active.weave)}</strong></div><div class="exo-m-metric"><span>Art-directed matte level</span><strong>${active.roughness>=.7?'Matte':active.roughness>=.5?'Satin':'Technical sheen'}</strong></div><div class="exo-m-track"><span style="width:${Math.round(active.roughness*100)}%"></span></div><div class="exo-m-metric"><span>Indicative hanging silhouette</span><strong>${['','Firm','Structured','Balanced','Fluid','Very fluid'][active.drape]}</strong></div><div class="exo-m-drape" aria-label="Stylized hanging silhouette"><svg viewBox="0 0 240 105" aria-hidden="true"><defs><linearGradient id="${uid}-drape" x1="0" x2="1"><stop stop-color="${active.colors[colorIndex][1]}"/><stop offset=".45" stop-color="#9a9c98"/><stop offset="1" stop-color="${active.colors[colorIndex][1]}"/></linearGradient></defs><path d="M12 18 Q54 ${14+active.drape*3} 84 18 Q122 ${14+active.drape*5} 160 18 Q196 ${14+active.drape*4} 228 18 L228 81 Q184 ${90-active.drape*4} 146 83 Q97 ${91-active.drape*7} 61 84 Q35 ${85-active.drape*3} 12 81Z" fill="url(#${uid}-drape)"/><path d="M84 18 Q69 51 65 82 M160 18 Q151 56 147 82 M120 18 Q115 54 114 83" stroke="#fff" stroke-opacity=".23" fill="none"/><path d="M12 18H228" stroke="#c3c3bd" stroke-width="3"/></svg><small>Digital fold sketch / not a simulation</small></div>`:`<div class="exo-m-preview-heading">CATEGORY REFERENCE / NOT TESTED</div><div class="exo-m-metric"><span>Indicative surface mass</span><strong>~ ${active.gsm} g/m²</strong></div><div class="exo-m-metric"><span>Example elongation</span><strong>${escapeHTML(active.stretch)}</strong></div><div class="exo-m-metric"><span>Construction family</span><strong>${escapeHTML(active.weave)}</strong></div><div class="exo-m-property-note">Supplier data needed: fiber composition, measured mass, thickness, shrinkage, air permeability, bending, shear and tensile response. This specimen contains no validated physical model.</div>`;
    materialTexture(canvas,active,active.colors[colorIndex][1],zoom);
  }
  function onClick(e){const button=e.target.closest('button');if(!button||!container.contains(button))return;
    if(button.dataset.fabric){active=FABRICS.find(f=>f.id===button.dataset.fabric)||active;colorIndex=0;render();emit();}
    else if(button.dataset.color!==undefined){colorIndex=clamp(Number(button.dataset.color),0,active.colors.length-1);render();emit();}
    else if(button.dataset.tab){tab=button.dataset.tab;render();}
    else if(button.classList.contains('exo-m-apply'))opts.onApply?.(selected());
  }
  function onInput(e){if(e.target.id===`${uid}-zoom`){zoom=Number(e.target.value);materialTexture(canvas,active,active.colors[colorIndex][1],zoom);}}
  container.addEventListener('click',onClick);container.addEventListener('input',onInput);render();emit();
  return {getSelection:selected,selectMaterial(id){const next=FABRICS.find(f=>f.id===id);if(!next)return false;active=next;colorIndex=0;render();emit();return true;},destroy(){container.removeEventListener('click',onClick);container.removeEventListener('input',onInput);container.classList.remove('exo-material-mount');container.replaceChildren();}};
}

export const materialStudies=FABRICS.map(({id,name,family,gsm,weave})=>({id,name,family,gsm,weave}));
