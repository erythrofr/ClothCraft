// EXO Community round-two visual flows. Client-only example data; no real upload, payment, or native actions.
export function createPremiumScreens({getAlt,art,assets,escape,showLab,backToCatalog,notify,closeModal,mountVisualizer,mountMaterials}) {
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 let currentViewer=null,currentMaterials=null,closeFullScreen=null;
 const publish={step:0,title:'Arc Shoulder Hoodie',kind:'Garments',visibility:'visual',files:new Set(['Still images','Optimized GLB preview'])};
 const steps=['Describe your asset','Choose who can see it','Choose included files','Review exactly what becomes public'];
 const files=['Still images','Optimized GLB preview','Editable DXF pattern','Graded measurement rules','Factory Tech Pack','Original Blender scene'];
 const types={private:'Private draft',visual:'Public visual showcase',free:'Free licensed asset',paid:'Paid licensed asset'};
 const ownerOnly=['Editable DXF pattern','Graded measurement rules','Factory Tech Pack','Original Blender scene'];
 function enter(css){
  closeFullScreen?.();closeFullScreen=null;
  currentViewer?.destroy?.();currentMaterials?.destroy?.();currentViewer=null;currentMaterials=null;
  const node=getAlt();node.hidden=false;node.className=css;$('#project-home')?.setAttribute('hidden','');$('#hero').hidden=true;$('.intro-strip').hidden=true;$('.edition-feature').hidden=true;$('#fabric-store')?.setAttribute('hidden','');$('#catalog-section').hidden=true;closeModal();window.scrollTo(0,0);return node;
 }
 function assetDetail(id){
  const a=assets.find(x=>x.id===id);if(!a)return;
  const shell=enter('premium-asset-page');
  const access=a.price==='View only'?'VISUAL-ONLY PORTFOLIO':a.price==='Free'?'FREE / ILLUSTRATIVE':'PAID / ILLUSTRATIVE';
  const rows=[['Discipline',a.category],['Included formats (illustrative)',a.formats.join(' / ')],...Object.entries(a.spec)];
  const technical = a.category==='Patterns'||a.category==='Garments';
  const optical = a.category==='Materials';
  const previewAsset = technical?'<div id="p2-pattern-preview" class="p2-pattern-preview"></div>':optical?'<div class="p2-material-showcase p2-material-'+escape(a.id)+'"><div class="p2-material-sheet p2-sheet-rear"></div><div class="p2-material-sheet p2-sheet-front"></div><span class="p2-material-folio-label">MATERIAL SPECIMEN / 0'+(assets.indexOf(a)+1)+'<strong>'+escape(a.title)+'</strong></span></div>':art(a);
  shell.innerHTML='<div class="p2-backbar"><button id="p2-asset-back">← RETURN TO ARCHIVE</button><span>EXO / MATERIAL CULTURE · '+escape(a.id.toUpperCase())+'</span></div>'+
  '<div class="p2-product"><div class="p2-product-media"><div class="p2-hero-art '+(technical||optical?'p2-technical-stage':'')+'"><div class="p2-media-top">FIG 01 / STUDIO REFERENCE <span>INTERACTIVE DESIGN STUDY</span></div>'+previewAsset+'<div id="p2-image-status" class="p2-media-caption">'+(technical?'PROCEDURAL 3D REFERENCE · NOT AN EXPORTED GARMENT':optical?'OPTICAL TEXTILE STUDY · PHYSICS NOT VERIFIED':'STUDIO ILLUSTRATION ONLY')+'</div></div><div class="p2-preview-nav" role="group" aria-label="Choose technical preview"><div class="p2-thumbs"><button data-preview="Front" class="active" aria-pressed="true"><span class="p2-thumb-number">01</span><strong>'+(technical?'3D Form':'Front')+'</strong><small>'+(technical?'Rotate object':'Illustration')+'</small></button><button data-preview="Detail" aria-pressed="false"><span class="p2-thumb-number">02</span><strong>'+(technical?'2D Pattern':'Detail')+'</strong><small>'+(technical?'Piece layout':'Close-up')+'</small></button><button data-preview="Rights" aria-pressed="false"><span class="p2-thumb-number">03</span><strong>'+(technical?'Wireframe':'Source status')+'</strong><small>'+(technical?'Surface topology':'Illustrative')+'</small></button></div>'+(technical?'<button type="button" id="p2-expand" class="p2-expand" aria-expanded="false">⛶ EXPAND VIEW <span>↗</span></button>':'')+'</div></div>'+
  '<div class="p2-product-info"><div class="p2-kicker">'+escape(a.category.toUpperCase())+' / COMMUNITY ASSET 00'+(assets.indexOf(a)+1)+'</div><h1>'+escape(a.title)+'</h1><div class="p2-byline">BY <strong>'+escape(a.creator)+'</strong> · CREATOR CONCEPT</div><p class="p2-prose">'+escape(a.desc)+'</p>'+
  '<div class="p2-license-box"><div><small>ACCESS RIGHTS</small><strong>'+access+'</strong></div><div><small>LISTING</small><strong>'+escape(a.price)+'</strong></div></div><div class="p2-product-actions"><button id="p2-asset-lab" class="p2-primary">Inspect in Pattern Lab ↗</button><button id="p2-asset-save">＋ Save to concept library</button></div><div class="p2-rights-note"><b>✳ Creator source is protected.</b><p>Public visibility does not grant access to original 2D patterns, grading rules, editable meshes, material measurements or factory notes.</p></div>'+
  '<div class="p2-spec-head">ASSET SPECIFICATION / SOURCE STATUS</div><dl class="p2-spec-table">'+rows.map(([key,val])=>'<dt>'+escape(key)+'</dt><dd>'+escape(val)+'</dd>').join('')+'</dl><div class="p2-spec-head">LICENSING / DELIVERY</div><dl class="p2-spec-table"><dt>Remix permission</dt><dd>'+(a.remix?'Conceptually allowed; real grant required':'Not offered')+'</dd><dt>Editable source</dt><dd>'+(a.price==='View only'?'Not offered':'Requires reviewed file package')+'</dd><dt>Downloadable files</dt><dd>None in prototype</dd><dt>Asset status</dt><dd>Illustrative only</dd></dl></div></div>'+
  (technical||optical?'<section class="asset-materials-deck"><div class="asset-materials-heading"><div><span class="p2-kicker">SURFACE STUDIES / MATERIAL PALETTE</span><h2>Material is part of the pattern.</h2><p>Inspect the construction and optical response separately. Changing this demonstration swatch updates the preview, not any real physics simulation.</p></div><span>VISUAL STUDIES · UNCALIBRATED</span></div><div id="p2-material-deck"></div></section>':'');
  if(technical && mountVisualizer) currentViewer=mountVisualizer($('#p2-pattern-preview'),a,{mode:'3d'});
  if((technical||optical) && mountMaterials) currentMaterials=mountMaterials($('#p2-material-deck'),a,{onMaterialChange:material=>currentViewer?.setMaterial?.(typeof material==='string'?material:material.id||material.key||material.name),onApply:()=>notify('Visual material reference selected for this illustration. No actual EXO project or physics changed.')});
  if(a.id==='moto')currentMaterials?.selectMaterial?.('twill');
  else if(a.id==='denim')currentMaterials?.selectMaterial?.('denim');
  $('#p2-asset-back').addEventListener('click',()=>{closeFullScreen?.();backToCatalog()});
  $('#p2-asset-lab').addEventListener('click',()=>{closeFullScreen?.();showLab(a.id)});
  $('#p2-asset-save').addEventListener('click',()=>{$('#p2-asset-save').textContent='✓ Saved for this session';notify('Concept collection updated locally; no account was changed.')});
  $$('[data-preview]').forEach(button=>button.addEventListener('click',()=>{ $$('[data-preview]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});const selection=button.dataset.preview;$('#p2-image-status').textContent=selection==='Rights'?'REFERENCE SURFACE TOPOLOGY · NO VALIDATED PATTERN DATA':selection==='Detail'?'FLAT PATTERN REFERENCE · UNMEASURED':'PROCEDURAL 3D VISUAL STUDY';if(technical){currentViewer?.setMode?.(selection==='Detail'?'2d':'3d');currentViewer?.setWireframe?.(selection==='Rights')}else {$('.p2-hero-art svg')?.classList.toggle('p2-zoom',selection==='Detail')}}));
  if (technical) {
    const media=shell.querySelector('.p2-product-media'), expand=shell.querySelector('#p2-expand');
    const collapse=()=>{media.classList.remove('p2-expanded');media.removeAttribute('role');media.removeAttribute('aria-modal');media.removeAttribute('aria-label');document.body.classList.remove('p2-viewer-open');expand.setAttribute('aria-expanded','false');expand.innerHTML='⛶ EXPAND VIEW <span>↗</span>';};
    const onKey=e=>{
      if(!media.classList.contains('p2-expanded'))return;
      if(e.key==='Escape'){e.preventDefault();collapse();expand.focus();return;}
      if(e.key!=='Tab')return;
      const focusable=[...media.querySelectorAll('button:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&(document.activeElement===first||!media.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!media.contains(document.activeElement))){e.preventDefault();first.focus();}
    };
    const onNavigation=e=>{if(e.target.closest('[data-nav],[data-view],#p2-asset-back,#p2-asset-lab'))collapse();};
    document.addEventListener('keydown',onKey);
    document.addEventListener('click',onNavigation);
    closeFullScreen=()=>{collapse();document.removeEventListener('keydown',onKey);document.removeEventListener('click',onNavigation);};
    expand.addEventListener('click',()=>{const opening=!media.classList.contains('p2-expanded');media.classList.toggle('p2-expanded',opening);document.body.classList.toggle('p2-viewer-open',opening);expand.setAttribute('aria-expanded',String(opening));expand.innerHTML=opening?'✕ CLOSE VIEW <span>↙</span>':'⛶ EXPAND VIEW <span>↗</span>';if(opening){media.setAttribute('role','dialog');media.setAttribute('aria-modal','true');media.setAttribute('aria-label','Expanded pattern and garment reference viewer');}else{media.removeAttribute('role');media.removeAttribute('aria-modal');media.removeAttribute('aria-label');}expand.focus();});
  }
 }
 function publishWizard(reset=true){
  if(reset){publish.step=0;publish.title='Arc Shoulder Hoodie';publish.kind='Garments';publish.visibility='visual';publish.files=new Set(['Still images','Optimized GLB preview'])}
  drawPublish();
 }
 function drawPublish(){
  const step=publish.step,v=publish.visibility,p=publish.files;
  if(v==='private')p.clear();
  if(v==='visual')ownerOnly.forEach(n=>p.delete(n));
  const shell=enter('premium-publish-page');
  let center='';
  if(step===0){
   center='<div class="p2-field"><label for="p2-pub-title">PROJECT TITLE</label><input id="p2-pub-title" value="'+escape(publish.title)+'" maxlength="90"/><small>What your audience would see on the asset card.</small></div>'+
   '<div class="p2-field"><label for="p2-pub-kind">ASSET CATEGORY</label><select id="p2-pub-kind">'+['Garments','Patterns','Materials','Studios'].map(x=>'<option '+(x===publish.kind?'selected':'')+'>'+x+'</option>').join('')+'</select><small>Each category has a different future compatibility and license check.</small></div>'+
   '<div class="p2-pub-sample">'+art('hoodie')+'<p><b>This is a demonstration asset.</b> The wizard has no file picker and never reads clothing projects from the computer.</p></div>';
  }else if(step===1){
   center='<div class="p2-visibility">'+Object.entries(types).map(([key,val])=>'<label class="p2-vis-choice '+(v===key?'selected':'')+'"><input type="radio" name="p2-vis" value="'+key+'" '+(v===key?'checked':'')+'/>'+
   '<span><strong>'+val+'</strong><small>'+({private:'Owner-only project. No one else can see it.',visual:'Public presentation without editable source.',free:'Files explicitly selected for a free license.',paid:'Seller onboarding, rights and payments required.'}[key])+'</small></span><em>'+(v===key?'●':'○')+'</em></label>').join('')+'</div><div class="p2-warning">Publishing a visual garment must never expose its editable pattern or technical package. Every file grant must be separately confirmed.</div>';
  }else if(step===2){
   center='<p class="p2-prose">This page illustrates exactly which artifact files would be included in a selected package. An actual platform must scan and validate each chosen file before any upload.</p><div class="p2-pub-files">'+files.map(name=>{
    const locked=v==='private'||(v==='visual'&&ownerOnly.includes(name));
    return '<label class="'+(locked?'locked':'')+'"><input type="checkbox" data-p2-file="'+escape(name)+'" '+(p.has(name)?'checked':'')+' '+(locked?'disabled':'')+'/><span><strong>'+escape(name)+'</strong><small>'+(ownerOnly.includes(name)?'Requires explicit rights review and approval':'Public derivative candidate')+'</small></span><em>'+(locked?'LOCKED':p.has(name)?'SELECTED':'EXCLUDED')+'</em></label>';
   }).join('')+'</div><div class="p2-warning">Private tech packs, confidential costings, and unpublished 2D rules must never be included by default.</div>';
  }else{
   center='<div class="p2-review-facts"><div><small>ASSET</small><strong>'+escape(publish.title)+'</strong></div><div><small>CATEGORY</small><strong>'+escape(publish.kind)+'</strong></div><div><small>VISIBILITY</small><strong>'+escape(types[v])+'</strong></div><div><small>SELECTED FILES</small><strong>'+(v==='private'?0:p.size)+'</strong></div></div>'+
    '<div class="p2-public-digest"><div class="p2-public-heading">WHAT A PUBLIC VISITOR WOULD RECEIVE</div><div class="p2-public-item">'+art('hoodie')+'<div><small>'+escape(publish.kind.toUpperCase())+'</small><strong>'+escape(publish.title)+'</strong><span>'+escape(types[v])+'</span></div></div><ul>'+(v==='private'?'<li>Nothing — the project is private</li>':p.size?[...p].map(x=>'<li>'+escape(x)+'</li>').join(''):'<li>No public files selected</li>')+'</ul><div class="p2-private-foot"><b>NOT SHARED BY THIS DEMO</b><p>Original projects, factory annotations, private design calculations and confidential sources are not transferred. This is a preview, not a published listing.</p></div></div>';
  }
  shell.innerHTML='<div class="p2-backbar"><button id="p2-pub-return">← RETURN TO COMMUNITY</button><span>EXO / CREATOR PUBLISHER · LOCAL CONCEPT</span></div><div class="p2-publish-wrap"><header><span class="p2-kicker">CREATOR CONTROL / EXO</span><h1>Share the work.<br><em>Keep the source.</em></h1><p>Visibility, licensing and deliverables belong to the creator. Preview each choice before publishing.</p></header><div class="p2-wizard"><aside class="p2-wizard-steps">'+steps.map((name,i)=>'<button data-p2-step="'+i+'" class="'+(i===step?'active':i<step?'done':'')+'" '+(i>step?'disabled':'')+'><span>0'+(i+1)+'</span><strong>'+name+'</strong></button>').join('')+'<p>SIMULATED WORKFLOW<br>NO REAL UPLOAD OR TRANSACTION</p></aside><section class="p2-wizard-content"><div class="p2-wizard-meta"><span>STEP 0'+(step+1)+' / 04</span><span>'+escape(types[v].toUpperCase())+'</span></div><h2>'+escape(steps[step])+'</h2>'+center+'<div class="p2-wizard-actions"><button id="p2-prev" '+(step===0?'disabled':'')+'>← Back</button><button id="p2-next">'+(step===3?'Finish preview (no publish)':'Continue →')+'</button></div><div role="status" id="p2-wizard-status"></div></section></div></div>';
  $('#p2-pub-return').addEventListener('click',backToCatalog);
  $('#p2-prev').addEventListener('click',()=>{if(step>0){publish.step--;drawPublish()}});
  $('#p2-next').addEventListener('click',()=>{if(step===3){$('#p2-wizard-status').textContent='Review complete. No file, account or public asset was created.';notify('Private demo review complete — nothing was uploaded.');return;}publish.step++;drawPublish()});
  $$('[data-p2-step]').forEach(b=>b.addEventListener('click',()=>{publish.step=Number(b.dataset.p2Step);drawPublish()}));
  if(step===0){$('#p2-pub-title').addEventListener('input',event=>publish.title=event.target.value);$('#p2-pub-kind').addEventListener('change',event=>publish.kind=event.target.value);}
  if(step===1)$$('[name=p2-vis]').forEach(b=>b.addEventListener('change',event=>{publish.visibility=event.target.value;drawPublish()}));
  if(step===2)$$('[data-p2-file]').forEach(b=>b.addEventListener('change',event=>{event.target.checked?p.add(event.target.dataset.p2File):p.delete(event.target.dataset.p2File);drawPublish()}));
 }
 function enhanceTechPack(){
  const pane=$('.tp-main'),selector=$('#tp-role');if(!pane||!selector)return;
  const section=document.createElement('section');section.className='p2-tp-role-section';section.id='p2-tp-role';pane.append(section);
  const banner=document.createElement('div');banner.className='p2-role-banner';banner.id='p2-role-banner';$('.tp-comments')?.prepend(banner);
  const update=()=>{
   const designer=selector.value==='Designer';
   section.innerHTML=designer?'<h3>Designer internal planning <small>DRAFT CONTROL VIEW</small></h3><p>Sample internal supplier/costing plan and change-approval controls would be available to authorized designers only.</p><div class="p2-spec-mini"><span>Change a working revision</span><strong>Owner review needed</strong></div>':
    '<h3>Manufacturer delivery <small>SCOPED RELEASE VIEW</small></h3><p>Approved specification and pinned change requests only. Internal supplier costs and unpublished designer drafts are excluded.</p><div class="p2-spec-mini"><span>Allowed actions</span><strong>Read / comment / request revision</strong></div>';
   banner.innerHTML=designer?'<strong>DESIGNER VIEW</strong><p>Authoring and review are distinct from an approved manufacturer release.</p>':'<strong>MANUFACTURER VIEW</strong><p>Changes are proposals. Factories cannot silently modify the designer master.</p>';
  };
  selector.addEventListener('change',update);
  update();
 }
 return {assetDetail,publishWizard,enhanceTechPack};
}
