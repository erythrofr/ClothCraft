// EXO Fabric Store: original, offline-capable collection UI inspired by category
// workflows visible on CLO-SET CONNECT. All records are EXO-derived *estimates*.
// No CONNECT account, store API, payment, scans, or third-party textures are used.
import {mountFabricShowcase} from './fabric-showcase.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const options = (items,value) => items.map(item => {
  const [v,label] = Array.isArray(item) ? item : [item,item];
  return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`;
}).join('');
const paintColor = c => /^#[0-9a-f]{6}$/i.test(c||'') ? c : '#717b73';
const toRgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
const tone = (hex,delta) => '#' + toRgb(paintColor(hex)).map(x => Math.min(255,Math.max(0,x+delta)).toString(16).padStart(2,'0')).join('');
const swatchCss = record => {
  const base = paintColor(record.color);
  const weight=Number.isFinite(record.gsm)?record.gsm:250;
  const rough=Number.isFinite(record.roughness)?record.roughness:.65;
  const scale=Math.max(4,Math.min(17,Math.round(16-weight/55)));
  return `--fabric-color:${base};--fabric-light:${tone(base,30)};--fabric-dark:${tone(base,-35)};--fabric-thread:${scale}px;--fabric-grain:${(.28+rough*.52).toFixed(2)};--fabric-sheen:${(.12+(1-rough)*.35).toFixed(2)}`;
};
const groupOf = r => {
  const s = [r.family,r.name,r.id].join(' ').toLowerCase();
  if (/leather|suede|hide|fur\b/.test(s)) return 'Leather & Suede';
  if (/rib|knit|jersey|fleece|terry|interlock|scuba|tricot/.test(s)) return 'Knits';
  if (/nylon|ripstop|polyester|shell|laminat|technical|mesh/.test(s)) return 'Technical';
  if (/denim|chambray/.test(s)) return 'Denim';
  if (/linen|poplin|twill|canvas|wool|cotton|silk|satin|velvet|corduroy|organza|chiffon|woven/.test(s)) return 'Wovens';
  return 'Other';
};
const compositionOf = r => {
  const s = [r.name,r.id,r.family].join(' ').toLowerCase();
  if (/wool|cashmere|merino/.test(s)) return 'Wool';
  if (/silk|satin|chiffon|organza/.test(s)) return 'Silk';
  if (/nylon/.test(s)) return 'Nylon';
  if (/polyester|poly\b/.test(s)) return 'Polyester';
  if (/linen/.test(s)) return 'Linen';
  if (/leather|suede/.test(s)) return 'Leather';
  if (/cotton|denim|terry|poplin|canvas|twill/.test(s)) return 'Cotton';
  return 'Unspecified';
};
const useOf = r => {
  const g=groupOf(r), s=r.name.toLowerCase();
  if (/suiting|wool|melton/.test(s)) return 'Tailoring';
  if (/denim|canvas|twill/.test(s)) return 'Bottoms';
  if (/rib|jersey|terry|knit/.test(s)) return 'Tops';
  if (g==='Technical'||/leather|fleece/.test(s)) return 'Outerwear';
  return 'General';
};
const patternOf = r => /jacquard|print|plaid|stripe|check|houndstooth|camouflage/i.test(r.name) ? 'Patterned' : 'Solid / Texture';
const status = () => 'ESTIMATED'; // A catalog entry is never evidence of lab certification.
const NUM_PER_PAGE = 24;
const FAVORITES_KEY='exo-community-fabric-reference-ids-v1';
function readFavorites(){
  try {
    const values=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');
    return new Set(Array.isArray(values)?values.filter(v=>typeof v==='string').slice(0,500):[]);
  }catch{return new Set();}
}
function persistFavorites(values){
  try {localStorage.setItem(FAVORITES_KEY,JSON.stringify([...values]));}catch{/* Private browsing may restrict storage; session state remains available. */}
}
const fallback = [
 {id:'terry-demo',name:'French Terry · Loopback',family:'French Terry',color:'#444f48',gsm:460,roughness:.86,stretchWarp:.18,stretchWeft:.24,finish:'reference',construction:'Loopback knit · illustrative sample',calibration:{status:'estimated'}},
 {id:'denim-demo',name:'Rigid Denim · Indigo',family:'Rigid Denim',color:'#3c5570',gsm:390,roughness:.8,stretchWarp:.02,stretchWeft:.02,finish:'reference',construction:'3/1 twill · illustrative sample',calibration:{status:'estimated'}},
 {id:'twill-demo',name:'Cotton Twill · Structured',family:'Cotton Twill',color:'#aca18c',gsm:275,roughness:.7,stretchWarp:.03,stretchWeft:.03,finish:'reference',construction:'2/1 twill · illustrative sample',calibration:{status:'estimated'}},
 {id:'nylon-demo',name:'Nylon Ripstop',family:'Nylon Ripstop',color:'#65727a',gsm:95,roughness:.35,stretchWarp:.03,stretchWeft:.04,finish:'reference',construction:'Reinforced grid · illustrative sample',calibration:{status:'estimated'}},
 {id:'leather-demo',name:'Garment Leather',family:'Garment Leather',color:'#51372c',gsm:null,roughness:.55,stretchWarp:.07,stretchWeft:.05,finish:'reference',construction:'Natural hide · illustrative sample',calibration:{status:'estimated'}},
 {id:'canvas-demo',name:'Cotton Canvas',family:'Cotton Canvas',color:'#b8ac93',gsm:340,roughness:.8,stretchWarp:.02,stretchWeft:.02,finish:'reference',construction:'Plain weave · illustrative sample',calibration:{status:'estimated'}}
];
const normalized = v => v.map(record=>({
  ...record,
  name:record.name||record.id,
  id:String(record.id||record.name),
  family:record.family||record.familyId||record.name||'Unclassified',
  color:paintColor(record.color),
  group:groupOf(record),
  composition:record.composition||compositionOf(record),
  usage:record.usage||useOf(record),
  season:record.season||'Unspecified',
  pattern:record.pattern||patternOf(record),
  supplier:'EXO Source Library',
  official:'EXO Reference',
  price:'Reference',
  gsm:Number.isFinite(record.gsm)?record.gsm:null
}));

export function mountFabricStore(container, config={}) {
  if (!(container instanceof Element)) throw new TypeError('Expected a fabric store container');
  const state = {items:[],search:'',category:'All',filters:{type:'',composition:'',usage:'',season:'',color:'',pattern:'',physical:'',supplier:'',official:'',price:''},sort:'featured',page:1,view:'grid',favorite:readFavorites(),savedOnly:false,selected:null,showStudy:false,study:null,loading:true,openMobileFilters:false};
  let alive=true,focusRestore=null;
  const external='https://connect.clo-set.com/store/fabric';
  container.innerHTML=`<section class="exo-store" aria-label="EXO Fabric Store">
   <div class="exfs-banner"><span><i></i> EXO MATERIALS / ARCHIVE SYSTEM</span><span>FABRIC SPECIFICATIONS · REFERENCE COLLECTION</span></div>
   <header class="exfs-hero"><div class="exfs-hero-copy"><div class="exfs-kicker">THE MATERIAL INDEX <b>VOL. 001</b></div><h1>Fabric, down<br>to the <em>detail.</em></h1><p>Discover the construction, texture and material character behind every design. A focused fabric library for exploring form and finish.</p><div class="exfs-hero-bottom"><span><strong id="exfs-total">—</strong> DESIGN SPECIFICATIONS</span><span>80 ARCHETYPES · 320 TREATMENTS</span></div></div><div class="exfs-hero-art" aria-hidden="true"><div class="exfs-sample exfs-back"></div><div class="exfs-sample exfs-mid"></div><div class="exfs-sample exfs-front"><span>EXO<br>TEXTILES</span><small>VOLUME / 01<br>PROCEDURAL STUDIES</small></div><div class="exfs-spec-label">CONSTRUCTION & FINISH<br>COLOR & SURFACE<br>DRAPE & STRUCTURE</div></div></header>
   <div id="exfs-scanned-showcase"></div>
   <div class="exfs-category-bar"><div class="exfs-tabs" role="group" aria-label="Fabric category">${['All','Wovens','Knits','Denim','Technical','Leather & Suede','Other'].map(x=>`<button data-category="${esc(x)}" aria-pressed="${x==='All'}" class="${x==='All'?'active':''}">${esc(x)} <small data-category-count="${esc(x)}"></small></button>`).join('')}</div><a href="${external}" target="_blank" rel="noopener noreferrer" class="exfs-external" title="Opens the CLO-SET Connect marketplace in a new tab">CLO-SET CONNECT <span>↗</span></a></div>
   <div class="exfs-body"><aside class="exfs-filters" id="exfs-filter-panel"><div class="exfs-filter-heading"><strong>FILTER FABRICS</strong><button data-reset type="button">RESET ALL ↗</button><button type="button" class="exfs-filter-close" data-close-filters aria-label="Close fabric filters">✕</button></div>
   <div id="exfs-filter-groups"></div><p class="exfs-filter-note">Estimated EXO design specifications. No third-party marketplace inventory or CLO-SET seller records are connected.</p></aside>
   <main class="exfs-results"><div class="exfs-section-heading"><span>EXO / TEXTILE INDEX</span><h2>Explore the collection.</h2><p>Filter by construction, surface and estimated weight. Open a material to compare its reference properties.</p></div><div class="exfs-controls"><label class="exfs-search"><span aria-hidden="true">⌕</span><input id="exfs-search" type="search" placeholder="Search fabrics, construction or finish…" autocomplete="off" aria-label="Search fabric specifications"/><kbd>⌘ K</kbd></label><select id="exfs-sort" aria-label="Sort fabric collection">${options([['featured','Curated first'],['name','Name A–Z'],['gsm-asc','Lightest first'],['gsm-desc','Heaviest first'],['new','Finish variants first']],'featured')}</select><button id="exfs-mobile-filters" aria-expanded="false" aria-controls="exfs-filter-panel">FILTERS <span>☷</span></button></div><div class="exfs-quick-facets" role="group" aria-label="Quick weight filters"><span>WEIGHT / GSM</span>${[['','All weights'],['Under 150 GSM','Lightweight'],['150–299 GSM','Midweight'],['300–499 GSM','Heavyweight'],['500+ GSM','Extra heavy']].map(([v,label])=>`<button type="button" data-weight="${esc(v)}" aria-pressed="${!v}">${esc(label)}</button>`).join('')}</div><div class="exfs-results-meta"><div id="exfs-active-chips" class="exfs-chips"></div><div><span id="exfs-count">Loading…</span><div class="exfs-view-switch" role="group" aria-label="Fabric view"><button type="button" data-view="grid" aria-pressed="true" aria-label="Grid view">▦</button><button type="button" data-view="list" aria-pressed="false" aria-label="List view">☷</button></div></div></div><div class="exfs-grid" id="exfs-grid" aria-live="polite"></div><div class="exfs-pagination" id="exfs-pagination"></div></main></div>
   <div class="exfs-disclosure"><span>PROVENANCE</span><p>EXO fabric records are original digital design presets and derived treatments. Reported mass, elasticity, reflectance and construction need real swatch and laboratory verification. Nothing here is an actual CLO-SET Connect listing, authenticated account, certified fabric or purchased license.</p></div>
   <div id="exfs-modal-host"></div></section>`;
  const resultActions=container.querySelector('.exfs-results-meta>div:last-child');
  resultActions.classList.add('exfs-result-actions');
  resultActions.insertAdjacentHTML('afterbegin','<button type="button" id="exfs-saved-only" aria-pressed="false">♡ SAVED <span id="exfs-saved-count">0</span></button>');
  const q = sel=>container.querySelector(sel);
  const showcase=mountFabricShowcase(q('#exfs-scanned-showcase'));
  const all = sel=>[...container.querySelectorAll(sel)];
  const selectGroups = {
    type:['Wovens','Knits','Denim','Technical','Leather & Suede','Other'],
    composition:['Cotton','Wool','Silk','Linen','Nylon','Polyester','Leather','Unspecified'],
    usage:['Tops','Bottoms','Outerwear','Tailoring','General'],
    season:[],color:['Black / Grey','White / Neutral','Blue','Green','Earth','Other'],
    pattern:['Solid / Texture','Patterned'],physical:['Under 150 GSM','150–299 GSM','300–499 GSM','500+ GSM','Weight unknown'],
    supplier:[],official:[],price:[]
  };
  const labels = {type:'Fabric Type',composition:'Composition',usage:'Usage Type',season:'Season',color:'Color',pattern:'Pattern',physical:'Physical Property',supplier:'Supplier',official:'Official',price:'Price'};
  function colorGroup(r){
    const [red,green,blue]=toRgb(r.color),max=Math.max(red,green,blue),min=Math.min(red,green,blue);
    if(max<90||max-min<17 && max<155)return 'Black / Grey';
    if(min>177 && max-min<26)return 'White / Neutral';
    if(blue>red*1.17&&blue>green*1.12)return 'Blue';
    if(green>red*1.1&&green>blue*.92)return 'Green';
    if(red>green*.98&&green>blue*1.15)return 'Earth';
    return 'Other';
  }
  function matchPhysical(r, v){
    if(v==='Weight unknown')return r.gsm===null;
    if(r.gsm===null)return false;
    if(v==='Under 150 GSM')return r.gsm<150;
    if(v==='150–299 GSM')return r.gsm>=150&&r.gsm<300;
    if(v==='300–499 GSM')return r.gsm>=300&&r.gsm<500;
    return r.gsm>=500;
  }
  function filtered(){
    const arr=state.items.filter(r=>{
      if(state.savedOnly&&!state.favorite.has(r.id))return false;
      if(state.category!=='All'&&r.group!==state.category)return false;
      if(state.search&&!([r.id,r.name,r.family,r.construction,r.finish,r.group,r.composition].join(' ').toLowerCase().includes(state.search.toLowerCase())))return false;
      for(const [key,value] of Object.entries(state.filters)){
        if(!value)continue;
        if(key==='physical'){if(!matchPhysical(r,value))return false;}
        else if(key==='color'){if(colorGroup(r)!==value)return false;}
        else if(key==='type'){if(r.group!==value)return false;}
        else if(String(r[key]??'')!==value)return false;
      }
      return true;
    });
    if(state.sort==='name')arr.sort((a,b)=>a.name.localeCompare(b.name));
    if(state.sort==='gsm-asc')arr.sort((a,b)=>(a.gsm??1e6)-(b.gsm??1e6));
    if(state.sort==='gsm-desc')arr.sort((a,b)=>(b.gsm??-1)-(a.gsm??-1));
    if(state.sort==='new')arr.sort((a,b)=>Number(b.id.includes('__'))-Number(a.id.includes('__')));
    return arr;
  }
  const specimen = (r,extra='')=>`<div class="exfs-swatch ${esc(r.group.toLowerCase().replace(/[^a-z]+/g,'-'))}" style="${swatchCss(r)}"><span class="exfs-fabric-plane"></span><span class="exfs-fabric-weave"></span><span class="exfs-fabric-light"></span><span class="exfs-fabric-fold"></span>${extra}</div>`;
  const materialCharacter = r => {
    if(r.group==='Denim')return 'DIAGONAL TWILL / SURFACE STUDY';
    if(r.group==='Knits')return 'LOOPED YARN / SURFACE STUDY';
    if(r.group==='Technical')return 'ENGINEERED GRID / SURFACE STUDY';
    if(r.group==='Leather & Suede')return 'GRAIN & NAP / SURFACE STUDY';
    return 'WOVEN STRUCTURE / SURFACE STUDY';
  };
  function renderFilters(){
    q('#exfs-filter-groups').innerHTML=Object.entries(selectGroups).filter(([,values])=>values.length>0).map(([key,values])=>`<div class="exfs-filter-group"><label for="exfs-filter-${key}"><span>${esc(labels[key])}</span><small>${state.filters[key]?'ACTIVE':'ALL'}</small></label><select id="exfs-filter-${key}" data-filter="${key}" aria-label="${esc(labels[key])}"><option value="">All ${esc(labels[key].toLowerCase())}</option>${options(values,state.filters[key])}</select></div>`).join('');
  }
  function card(r,index){
    const saved=state.favorite.has(r.id);
    return `<article class="exfs-card" data-record="${esc(r.id)}"><div class="exfs-card-media">${specimen(r,`<span class="exfs-media-code">EXO / ${String(index+1).padStart(3,'0')}</span><span class="exfs-specimen-label">${esc(r.family)}</span><span class="exfs-surface-index">${esc(materialCharacter(r))}</span>`)}<button type="button" class="exfs-open" data-open="${esc(r.id)}" aria-label="Inspect ${esc(r.name)}"></button><button class="exfs-save ${saved?'saved':''}" data-save="${esc(r.id)}" aria-pressed="${saved}" aria-label="${saved?'Remove saved':'Save'} ${esc(r.name)}">${saved?'♥':'♡'}</button></div><button type="button" class="exfs-card-title" data-open="${esc(r.id)}">${esc(r.name)} <span aria-hidden="true">↗</span></button><div class="exfs-card-meta"><span>${esc(r.group)} · ${esc(r.finish||'Base reference')}</span><span>${r.gsm!==null?`${r.gsm} GSM`:'Weight unknown'}</span></div><div class="exfs-card-footer"><span>${status()} SPECIFICATION</span><span>${esc(r.color.toUpperCase())}</span></div></article>`;
  }
  function renderList(){
    const data=filtered();
    q('#exfs-count').textContent=`${data.length} of ${state.items.length} FABRICS`;
    const chips=[...(state.savedOnly?[['saved','Saved references']]:[]),...(state.category!=='All'?[['category',state.category]]:[]),...(state.search?[['search',`Search: ${state.search}`]]:[]),...Object.entries(state.filters).filter(([,v])=>v)];
    q('#exfs-active-chips').innerHTML=chips.length?chips.map(([key,value])=>`<button data-chip="${key}">${esc(value)} <span>×</span></button>`).join(''):'<span>EXPLORE ALL FABRIC SPECIFICATIONS</span>';
    all('[data-category]').forEach(b=>{const active=b.dataset.category===state.category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    all('[data-category-count]').forEach(el=>{const category=el.dataset.categoryCount;el.textContent=String(category==='All'?state.items.length:state.items.filter(r=>r.group===category).length);});
    all('[data-weight]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weight===state.filters.physical)));
    all('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    q('#exfs-grid').classList.toggle('exfs-grid-list',state.view==='list');
    q('#exfs-saved-count').textContent=String(state.items.reduce((sum,r)=>sum+Number(state.favorite.has(r.id)),0));
    q('#exfs-saved-only').setAttribute('aria-pressed',String(state.savedOnly));
    const visible=data.slice(0,state.page*NUM_PER_PAGE);
    q('#exfs-grid').innerHTML=visible.length?visible.map(card).join(''):`<div class="exfs-empty"><strong>No matching fabric records.</strong><p>Adjust your filters or search a different finish.</p><button type="button" data-reset>Reset the fabric collection ↗</button></div>`;
    q('#exfs-pagination').innerHTML=visible.length<data.length?`<button data-more>LOAD MORE FABRICS <span>${visible.length} / ${data.length} ↗</span></button>`:`<span>SHOWING ${visible.length} OF ${data.length} DESIGN SPECIFICATIONS</span>`;
  }
  function reset(){state.search='';state.category='All';state.savedOnly=false;state.page=1;state.sort='featured';q('#exfs-sort').value='featured';Object.keys(state.filters).forEach(k=>state.filters[k]='');q('#exfs-search').value='';renderFilters();renderList();}
  function save(id){
    state.favorite.has(id)?state.favorite.delete(id):state.favorite.add(id);
    persistFavorites(state.favorite);
    if(state.selected===id){
      const button=q('.exfs-detail .exfs-fav-action');
      if(button){button.setAttribute('aria-pressed',String(state.favorite.has(id)));button.textContent=state.favorite.has(id)?'♥ SAVED':'♡ SAVE TO REFERENCES';}
    }
    renderList();
  }
  function detail(id){
    const r=state.items.find(item=>item.id===id);if(!r)return;
    state.selected=id;state.showStudy=false;state.study?.destroy?.();state.study=null;
    const modal=q('#exfs-modal-host');
    modal.innerHTML=`<div class="exfs-modal-scrim" data-close></div><section class="exfs-detail" role="dialog" aria-modal="true" aria-label="Fabric specification ${esc(r.name)}"><div class="exfs-detail-visual">${specimen(r,`<div class="exfs-detail-cover-label"><span>EXO · FABRIC RECORD</span><strong>${esc(r.group.toUpperCase())}</strong><small>ESTIMATED MATERIAL SPECIFICATION</small></div>`)}<div class="exfs-visual-footer"><span>SURFACE / NOT A LAB SCAN</span><span>${esc(r.color)} · ILLUSTRATIVE</span></div></div><div class="exfs-detail-info"><div class="exfs-detail-header"><span>MATERIAL RECORD / ${esc(r.id)}</span><button type="button" data-close aria-label="Close fabric details">✕</button></div><span class="exfs-detail-category">${esc(r.group)} / ${esc(r.family)}</span><h2>${esc(r.name)}</h2><p class="exfs-detail-description">${esc(r.construction||'Digital fabric construction reference.')} Appearance is generated from EXO source metadata and is not a validated physical swatch.</p><div class="exfs-detail-badges"><span>◉ ${status()} DATA</span><span>EXO SOURCE</span><span>NO MARKETPLACE PURCHASE</span></div><div class="exfs-detail-specs"><h3>FABRIC INFORMATION</h3>${[['Category',r.group],['Composition',r.composition==='Unspecified'?'Not recorded':r.composition+' family (inferred)'],['Construction',r.construction||r.family],['Reference mass',r.gsm===null?'Not measured':r.gsm+' GSM · estimate'],['Stretch warp',Number.isFinite(r.stretchWarp)?Math.round(r.stretchWarp*100)+'% · estimate':'Not recorded'],['Stretch weft',Number.isFinite(r.stretchWeft)?Math.round(r.stretchWeft*100)+'% · estimate':'Not recorded'],['Surface roughness',Number.isFinite(r.roughness)?r.roughness.toFixed(2)+' · illustrative':'Not recorded'],['Finish',r.finish||'Base reference'],['Supplier',r.supplier],['Calibration','Unverified / requires physical testing']].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</div><div class="exfs-detail-actions"><button type="button" class="exfs-study-action" data-study>EXPLORE SURFACE STUDY ↗</button><button type="button" class="exfs-fav-action" data-save="${esc(r.id)}" aria-pressed="${state.favorite.has(id)}">${state.favorite.has(id)?'♥ SAVED':'♡ SAVE TO REFERENCES'}</button></div><div id="exfs-study-slot"></div><p class="exfs-detail-note">This local catalog is derived from EXO's 400 design presets. CLO-SET Connect is an external marketplace and is not linked through account, API or inventory sync.</p></div></section>`;
    document.body.classList.add('exfs-modal-open');
    // The fabric inspector may be entered from the mixed marketplace rather
    // than the fabric-card grid. Handle its dismissal on the actual dialog
    // controls so a delegated catalog click never leaves an overlay behind.
    modal.querySelectorAll('[data-close]').forEach(control=>{
      control.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();close();
      });
    });
    modal.querySelector('[data-close][aria-label]')?.focus();
  }
  function close(){state.study?.destroy?.();state.study=null;state.selected=null;q('#exfs-modal-host').replaceChildren();document.body.classList.remove('exfs-modal-open');focusRestore?.focus?.();focusRestore=null;}
  function handleClick(event){
    if(event.target.classList?.contains('exfs-modal-scrim')){close();return;}
    const button=event.target.closest('button');
    if(!button||!container.contains(button))return;
    if(button.hasAttribute('data-close')){close();return;}
    if(button.hasAttribute('data-close-filters')){state.openMobileFilters=false;q('#exfs-filter-panel').classList.remove('open');q('#exfs-mobile-filters').setAttribute('aria-expanded','false');q('#exfs-mobile-filters').focus();return;}
    if(button.hasAttribute('data-more')){state.page++;renderList();return;}
    if(button.hasAttribute('data-weight')){state.filters.physical=button.dataset.weight;state.page=1;renderFilters();renderList();return;}
    if(button.hasAttribute('data-view')){state.view=button.dataset.view;renderList();return;}
    if(button.hasAttribute('data-reset')){reset();return;}
    if(button.hasAttribute('data-category')){state.category=button.dataset.category;state.page=1;renderList();return;}
    if(button.hasAttribute('data-chip')){const key=button.dataset.chip;if(key==='category')state.category='All';else if(key==='saved')state.savedOnly=false;else if(key==='search'){state.search='';q('#exfs-search').value='';}else state.filters[key]='';state.page=1;renderFilters();renderList();return;}
    if(button.id==='exfs-saved-only'){state.savedOnly=!state.savedOnly;state.page=1;renderList();return;}
    if(button.hasAttribute('data-save')){save(button.dataset.save);return;}
    if(button.hasAttribute('data-open')){focusRestore=button;detail(button.dataset.open);return;}
    if(button.hasAttribute('data-study')){const r=state.items.find(x=>x.id===state.selected);if(!r)return;const slot=q('#exfs-study-slot');state.study?.destroy?.();slot.innerHTML='<div class="exfs-study-intro">REFERENCE SURFACE STUDY · FAMILY EXAMPLE</div><div id="exfs-study-inner"></div>';state.study=config.mountStudy?.(slot.querySelector('#exfs-study-inner'),{title:r.name,materialId:/denim/.test(r.group.toLowerCase())?'denim':/knit|terry/.test(r.name.toLowerCase())?'terry':/nylon|technical/.test(r.name.toLowerCase())?'nylon':/leather/.test(r.group.toLowerCase())?'leather':/canvas/.test(r.name.toLowerCase())?'canvas':'twill'})||null;slot.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    if(button.id==='exfs-mobile-filters'){state.openMobileFilters=!state.openMobileFilters;q('#exfs-filter-panel').classList.toggle('open',state.openMobileFilters);button.setAttribute('aria-expanded',String(state.openMobileFilters));}
  }
  function handleChange(event){
    const el=event.target;if(el.hasAttribute('data-filter')){state.filters[el.dataset.filter]=el.value;state.page=1;renderList();}
    if(el.id==='exfs-sort'){state.sort=el.value;state.page=1;renderList();}
  }
  function handleInput(event){if(event.target.id==='exfs-search'){state.search=event.target.value.trim();state.page=1;renderList();}}
  function inspectSurface(event){
    if(event.pointerType==='touch')return;
    const media=event.target.closest?.('.exfs-card-media,.exfs-detail-visual');
    if(!media||!container.contains(media))return;
    const bounds=media.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    media.style.setProperty('--inspect-x',`${Math.max(0,Math.min(100,(event.clientX-bounds.left)/bounds.width*100)).toFixed(1)}%`);
    media.style.setProperty('--inspect-y',`${Math.max(0,Math.min(100,(event.clientY-bounds.top)/bounds.height*100)).toFixed(1)}%`);
  }
  function onKey(event){
    if(event.key==='Escape'&&state.openMobileFilters){state.openMobileFilters=false;q('#exfs-filter-panel').classList.remove('open');q('#exfs-mobile-filters').setAttribute('aria-expanded','false');q('#exfs-mobile-filters').focus();if(!state.selected)return;}
    if(!state.selected)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      const focusable=[...q('#exfs-modal-host').querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')].filter(el=>el.getClientRects().length>0);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  }
  container.addEventListener('click',handleClick);container.addEventListener('change',handleChange);container.addEventListener('input',handleInput);container.addEventListener('pointermove',inspectSurface,{passive:true});document.addEventListener('keydown',onKey);
  renderFilters();
  state.items=normalized(fallback);renderList();
  fetch('./fabric-index.json',{cache:'no-store'}).then(async res=>{if(!res.ok)throw Error('Local library unavailable');return res.json();}).then(data=>{
    if(!alive)return;
    const fabrics=Array.isArray(data)?data:Array.isArray(data.fabrics)?data.fabrics:Array.isArray(data.records)?data.records:[];
    if(fabrics.length){state.items=normalized(fabrics);q('#exfs-total').textContent=String(fabrics.length);state.page=1;renderFilters();renderList();if(pendingSelection){detail(pendingSelection);pendingSelection=null;}}
  }).catch(()=>{if(alive){q('#exfs-total').textContent='06';q('.exfs-hero-bottom span:last-child').textContent='FALLBACK MATERIAL STUDIES';}});
  let pendingSelection=null;
  return {select(id){if(state.items.some(item=>item.id===id)){detail(id);}else{pendingSelection=id;const check=()=>{if(!alive)return;if(state.items.some(item=>item.id===id))detail(id);};setTimeout(check,240);}},destroy(){alive=false;showcase.destroy();state.study?.destroy?.();document.removeEventListener('keydown',onKey);container.removeEventListener('click',handleClick);container.removeEventListener('change',handleChange);container.removeEventListener('input',handleInput);container.removeEventListener('pointermove',inspectSurface);document.body.classList.remove('exfs-modal-open');container.replaceChildren();},refresh(){renderList();},close};
}
