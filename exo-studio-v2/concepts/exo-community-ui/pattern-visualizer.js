/**
 * EXO concept-only pattern viewer. Meshes and flattened panels are procedural
 * illustrations; they are neither imported DXF nor physically simulated cloth.
 */
const PANELS = [
  {id:'front', name:'Front body', path:'M24 27 L73 16 Q89 39 105 25 L126 29 L121 184 L31 184 Z', position:[0,0]},
  {id:'back', name:'Back body', path:'M24 27 L73 17 Q90 35 105 25 L126 29 L121 184 L31 184 Z', position:[1,0]},
  {id:'left', name:'Left sleeve', path:'M39 27 L88 13 L119 45 L132 170 L61 176 L29 77 Z', position:[0,1]},
  {id:'right', name:'Right sleeve', path:'M39 27 L88 13 L119 45 L132 170 L61 176 L29 77 Z', position:[1,1]},
  {id:'hood', name:'Hood / collar', path:'M36 157 Q16 75 47 30 Q86 4 113 32 Q145 72 125 157 Q78 133 36 157 Z', position:[2,0]}
];
const DENIM_PANELS = [
  {id:'front',name:'Front left leg',path:'M32 20 L117 20 L108 80 L100 188 L66 188 L60 82 L31 78 Z'},
  {id:'back',name:'Back left leg',path:'M28 20 L121 20 L112 83 L101 188 L61 188 L56 84 L30 80 Z'},
  {id:'left',name:'Front right leg',path:'M32 20 L117 20 L108 80 L100 188 L66 188 L60 82 L31 78 Z'},
  {id:'right',name:'Back right leg',path:'M28 20 L121 20 L112 83 L101 188 L61 188 L56 84 L30 80 Z'},
  {id:'hood',name:'Waistband / yoke',path:'M18 74 Q79 56 142 74 L139 108 Q78 96 21 108 Z'}
];
const RIB_PANELS = [
  {id:'front',name:'Collar band',path:'M18 86 Q77 41 142 86 L142 112 Q79 76 18 112 Z'},
  {id:'back',name:'Collar facing',path:'M19 79 Q80 40 141 79 L133 121 Q78 89 27 121 Z'},
  {id:'left',name:'Left cuff',path:'M36 56 L122 56 L122 147 L36 147 Z'},
  {id:'right',name:'Right cuff',path:'M36 56 L122 56 L122 147 L36 147 Z'},
  {id:'hood',name:'Rib swatch',path:'M38 35 L122 35 L122 174 L38 174 Z'}
];
const MOTO_PANELS = [
  {id:'front',name:'Armored front',path:'M23 36 L53 22 L69 39 L80 49 L94 39 L109 22 L138 36 L130 164 L30 164 Z',detail:'M30 68 Q76 53 132 69 M29 87 Q79 72 134 88 M31 107 Q79 91 132 108 M33 129 Q79 113 131 130 M79 49V164'},
  {id:'back',name:'Contoured back',path:'M25 36 L55 22 Q80 34 105 22 L136 36 L130 165 L30 165 Z',detail:'M29 70 Q80 47 131 70 M29 96 Q80 74 131 96 M31 120 Q80 103 129 120 M32 142 Q80 126 128 142'},
  {id:'left',name:'Left armor sleeve',path:'M34 25 L100 19 L124 56 L130 179 L68 184 L39 86 Z',detail:'M42 67 Q78 59 125 78 M44 91 Q85 78 127 101 M49 116 Q86 103 128 122 M58 143 Q92 135 130 145'},
  {id:'right',name:'Right armor sleeve',path:'M34 25 L100 19 L124 56 L130 179 L68 184 L39 86 Z',detail:'M42 67 Q78 59 125 78 M44 91 Q85 78 127 101 M49 116 Q86 103 128 122 M58 143 Q92 135 130 145'},
  {id:'hood',name:'Stand collar / hem',path:'M22 87 Q80 36 138 87 L135 118 Q79 75 25 118 Z',detail:'M24 100 Q80 57 136 100 M31 112 Q80 77 130 112'}
];
const PALETTES = {
  'French terry':{base:[181,178,165],weave:0.16,shine:0.1},
  'Washed denim':{base:[83,105,125],weave:0.34,shine:0.07},
  'Technical nylon':{base:[103,119,109],weave:0.09,shine:0.48},
  'Brushed cotton':{base:[148,128,117],weave:0.23,shine:0.08},
  'Black twill':{base:[67,70,72],weave:0.21,shine:0.18}
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rgb=(arr,brightness=1)=>'rgb('+arr.map(v=>Math.round(clamp(v*brightness,0,255))).join(',')+')';

export function mountPatternVisualizer(container, asset={}, options={}) {
  if (!(container instanceof Element)) throw new TypeError('Expected a DOM element for pattern visualizer');
  const initialMode = String(options.mode||'3d').toLowerCase()==='2d'?'2d':'3d';
  const garmentType=asset.id==='denim'?'denim':asset.id==='rib'?'rib':asset.id==='moto'?'moto':'hoodie';
  const panels=garmentType==='denim'?DENIM_PANELS:garmentType==='rib'?RIB_PANELS:garmentType==='moto'?MOTO_PANELS:PANELS;
  let mode=initialMode, material=PALETTES[options.material] ? options.material : garmentType==='denim'?'Washed denim':garmentType==='moto'?'Black twill':'French terry';
  let selected='front', angle=-0.31, tilt=-0.09, wire=false, dragging=null, frame=0, destroyed=false;
  let width=550, height=450;
  const root=document.createElement('section');
  root.className='exo-pv';
  root.setAttribute('aria-label','Interactive illustrative garment and pattern viewer');
  root.innerHTML=`
    <div class="exo-pv-header"><div><span class="exo-pv-kicker">EXO ATELIER <span class="exo-pv-led"></span> / DIGITAL FORM ARCHIVE</span><strong class="exo-pv-heading">${escapeHtml(asset.title || 'Pattern geometry study')}</strong><span class="exo-pv-subheading">CONSTRUCTION / VOLUME / MATERIAL</span></div><span class="exo-pv-counter">OBJECT STUDY <b>01 / 05</b></span></div>
    <div class="exo-pv-toolbar"><div class="exo-pv-switch" role="group" aria-label="View mode"><button type="button" data-mode="3d" aria-pressed="false">3D FORM</button><button type="button" data-mode="2d" aria-pressed="false">2D CUT</button></div><button type="button" data-wire aria-pressed="false" title="Toggle edge mesh">WIREFRAME <span>◇</span></button></div>
    <div class="exo-pv-stage" tabindex="0" role="group" aria-label="Garment visualizer: use left and right arrows to rotate, up and down to tilt; press W for wireframe.">
      <canvas class="exo-pv-canvas" aria-hidden="true"></canvas><div class="exo-pv-flat" hidden role="group" aria-label="Select illustrative pattern panels"></div>
      <div class="exo-pv-axis" aria-hidden="true"><span>Y</span><i></i><span>X</span></div><div class="exo-pv-stage-side" aria-hidden="true">FORM EXPLORATION · ${garmentType.toUpperCase()}<span>01 — CONSTRUCTION VIEW</span></div><div class="exo-pv-focus" aria-hidden="true"><span>✳</span> DRAG OBJECT TO INSPECT</div>
      <div class="exo-pv-stage-index">REF 01 / ${escapeHtml(asset.kind || asset.category || 'GARMENT')}</div>
      <div class="exo-pv-stage-caption" aria-live="polite"></div>
    </div>
    <div class="exo-pv-panelbar"><span>ANATOMY / COMPONENT INDEX <small>05 REFERENCE PIECES</small></span><div class="exo-pv-panels" role="group" aria-label="Highlight garment section">${panels.map((p,i)=>`<button type="button" data-panel="${p.id}" aria-pressed="false"><small>0${i+1} / PART</small>${p.name}<em>↗</em></button>`).join('')}</div></div>
    <div class="exo-pv-footer"><label>MATERIAL APPEARANCE <select aria-label="Illustrative material appearance" data-material>${Object.keys(PALETTES).map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><span class="exo-pv-readout">DRAG TO ROTATE · ← → TO ORBIT</span></div>
    <p class="exo-pv-disclaimer">ILLUSTRATIVE REFERENCE GEOMETRY · NOT A DXF IMPORT, FIT VALIDATION, OR PHYSICAL CLOTH SIMULATION</p>
  `;
  container.append(root);
  const canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d');
  const stage=root.querySelector('.exo-pv-stage'), flat=root.querySelector('.exo-pv-flat');
  const caption=root.querySelector('.exo-pv-stage-caption'), materialSelect=root.querySelector('[data-material]');
  materialSelect.value=material;
  const instanceId='pv-'+Math.random().toString(36).slice(2);
  flat.innerHTML=panels.map((p,i)=>`<button type="button" class="exo-pv-pattern" data-pattern="${p.id}" aria-label="Select ${p.name}" aria-pressed="false"><svg viewBox="0 0 160 208" aria-hidden="true"><defs><pattern id="${instanceId}-stitch-${i}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4H8" stroke="currentColor" opacity=".09" stroke-width=".7"/></pattern></defs><path class="exo-pv-piece" d="${p.path}"/><path d="${p.path}" fill="url(#${instanceId}-stitch-${i})" stroke-dasharray="3 4" stroke-width="1" stroke="#aaa797" transform="translate(-5 -4) scale(1.06 1.035)"/>${p.detail?`<path class="exo-pv-channel" d="${p.detail}"/>`:'<path d="M77 65V151" stroke="currentColor" stroke-width="1" stroke-dasharray="5 5" opacity=".6"/><path d="m72 73 5 -11 5 11" fill="none" stroke="currentColor" stroke-width="1"/>'}</svg><span>0${i+1} / ${p.name}</span></button>`).join('');

  // Closed panels are shallow volumes. Normals and folds are artist-drawn;
  // the result is deliberately visually distinct from a simulation engine.
  const faces=[];
  function addFace(id,verts,shade=1) {faces.push({id,verts,shade});}
  if(garmentType==='denim'){
    // Two distinct tapered legs with visible inseam separation and raised waist.
    const leg=(s,front,id)=>{
      const z=front?.28:-.23, x=s*.39;
      addFace(id,[[x-s*.38,1.12,z],[x+s*.37,1.12,z],[x+s*.35,.44,z+.035],[x+s*.23,-1.48,z-.05],[x-s*.18,-1.48,z-.05],[x-s*.12,.17,z+.06]],front?1:.72);
    };
    leg(-1,true,'front');leg(1,true,'left');
    leg(-1,false,'back');leg(1,false,'right');
    addFace('hood',[[-.78,1.13,.32],[.78,1.13,.32],[.76,1.44,.22],[-.76,1.44,.22]],.93);
    addFace('hood',[[-.76,1.44,-.23],[.76,1.44,-.23],[.78,1.13,-.23],[-.78,1.13,-.23]],.72);
  }else if(garmentType==='rib'){
    // A ring collar and two hanging cuff loops: standalone trim study.
    const ring=(id,y,r,h)=>{
      const n=24,outer=[],inner=[];
      for(let i=0;i<n;i++){const a=i*2*Math.PI/n;outer.push([Math.cos(a)*r,y+Math.sin(a)*r*.19,Math.sin(a)*r*.53]);inner.push([Math.cos(a)*r*.62,y+h+Math.sin(a)*r*.15,Math.sin(a)*r*.36]);}
      for(let i=0;i<n;i++)addFace(id,[outer[i],outer[(i+1)%n],inner[(i+1)%n],inner[i]],.82+i/n*.18);
    };
    ring('front',.55,.86,.32);ring('back',.55,.58,-.20);
    const cuff=(id,x)=>{for(let i=0;i<16;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8;addFace(id,[[x+Math.cos(a)*.30,-.56,Math.sin(a)*.20],[x+Math.cos(b)*.30,-.56,Math.sin(b)*.20],[x+Math.cos(b)*.28,-1.30,Math.sin(b)*.19],[x+Math.cos(a)*.28,-1.30,Math.sin(a)*.19]],.78+i/60);}};
    cuff('left',-.65);cuff('right',.65);
    addFace('hood',[[-.37,-.35,-.06],[.37,-.35,-.06],[.37,.05,-.06],[-.37,.05,-.06]],.96);
  }else if(garmentType==='moto'){
    // Cropped, broad-shouldered jacket shell with raised illustrative trapunto channels.
    const torso=[[-.79,-.56],[.79,-.56],[.80,.69],[.53,1.08],[-.53,1.08],[-.80,.69]];
    addFace('back',torso.map(([x,y])=>[x,y,-.29]).reverse(),.59);
    addFace('front',torso.map(([x,y])=>[x,y,.37]),.92);
    // Split chest armor and angled shoulder overlay sections.
    addFace('front',[[-.77,.30,.40],[-.47,.96,.42],[-.11,.70,.49],[-.10,.14,.51],[-.76,.05,.43]],1.14);
    addFace('front',[[.77,.30,.40],[.47,.96,.42],[.11,.70,.49],[.10,.14,.51],[.76,.05,.43]],1.07);
    addFace('front',[[-.73,-.52,.44],[.73,-.52,.44],[.71,-.36,.47],[-.71,-.36,.47]],.76);
    addFace('back',[[-.72,.60,-.35],[0,.88,-.39],[.72,.60,-.35],[.67,.39,-.4],[-.67,.39,-.4]],.87);
    const armoredSleeve=(s,id)=>{
      const outer=[[s*.61,.94,.06],[s*1.02,.97,.02],[s*1.50,.22,.11],[s*1.43,-.85,.07],[s*1.04,-.84,.14],[s*.82,-.02,.27]];
      addFace(id,outer,.92);addFace(id,outer.map(([x,y,z])=>[x,y,z-.28]).reverse(),.59);
      for(let row=0;row<4;row++){
        const y=.54-row*.29, z=.24+row*.012;
        addFace(id,[[s*(.91+row*.08),y+.09,z],[s*(1.30+row*.035),y+.06,z-.035],[s*(1.34+row*.025),y-.045,z+.005],[s*(.94+row*.07),y-.06,z+.07]],row%2?1.04:1.2);
      }
      addFace(id,[[s*1.02,-.79,.21],[s*1.44,-.80,.15],[s*1.43,-.91,.16],[s*1.04,-.94,.23]],.71);
    };
    armoredSleeve(-1,'left');armoredSleeve(1,'right');
    // Raised collar is an open, structured band and deliberately has no hood.
    addFace('hood',[[-.39,1.02,-.06],[-.44,1.47,-.01],[-.31,1.55,.24],[-.21,1.13,.38]],1.1);
    addFace('hood',[[.39,1.02,-.06],[.44,1.47,-.01],[.31,1.55,.24],[.21,1.13,.38]],.96);
    addFace('hood',[[-.21,1.13,.38],[.21,1.13,.38],[.29,1.30,.28],[-.29,1.30,.28]],.52);
    // Cross-body padded bands: individual shallow volumes create true visual relief.
    for(let row=0;row<5;row++){
      const y=.26-row*.155;
      for(const s of [-1,1]){
        const edge=s*(.70-row*.018), center=s*.065;
        addFace('front',[[center,y+.045,.55],[edge,y+.092,.46],[edge,y-.025,.485],[center,y-.055,.57]],row%2?1.03:1.23);
      }
    }
    // Center closure reads as a zipper placket.
    addFace('front',[[-.035,1.07,.59],[.035,1.07,.59],[.032,-.56,.62],[-.032,-.56,.62]],.67);
  }else{
  const body=[[-0.68,-1.12],[0.68,-1.12],[0.70,0.85],[0.36,1.04],[-0.36,1.04],[-0.70,0.85]];
  for(const [id,z,reverse] of [['front',0.31,false],['back',-0.28,true]]) {
    const seq=reverse?[...body].reverse():body;
    addFace(id,seq.map(([x,y],i)=>[x+(i%2?0.018:-0.015),y,z+(i===0||i===1?-0.035:0)]),reverse?0.68:1.02);
  }
  const sleeve=(side,id)=>{
    const s=side;
    const v=[[s*.62,.81,.05],[s*.89,.79,.04],[s*1.45,-.14,.02],[s*1.54,-.86,.03],[s*1.13,-.95,.10],[s*.75,-.12,.30]];
    addFace(id,v,side>0?.91:1.06);
    addFace(id,v.map(([x,y,z])=>[x,y,z-.24]).reverse(),.65);
  };
  sleeve(-1,'left');sleeve(1,'right');
  addFace('hood',[[-.39,1.01,.08],[-.48,1.45,-.04],[-.33,1.85,-.02],[0,1.97,-.12],[.33,1.85,-.02],[.48,1.45,-.04],[.39,1.01,.08],[0,1.13,.29]],.93);
  addFace('hood',[[-.28,1.09,.31],[0,1.22,.35],[.28,1.09,.31],[.24,1.5,.19],[0,1.7,.16],[-.24,1.5,.19]],.54);
  }

  function project(v) {
    let [x,y,z]=v;
    const c=Math.cos(angle),s=Math.sin(angle);
    const rx=x*c+z*s, rz=z*c-x*s;
    const t=Math.cos(tilt),u=Math.sin(tilt);
    const ry=y*t-rz*u, depth=y*u+rz*t;
    const stageHeightFactor=width>height*1.7?3.35:4.1;
    const scale=Math.min(width/3.95,height/stageHeightFactor) * (3.9/(4.6-depth));
    return [width/2+rx*scale,height*.53-ry*scale,depth,scale];
  }
  function traceFace(pts){
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  }
  function stitchSegment(a,b,opacity=.5){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    if(len<12)return;
    const nx=-dy/len,ny=dx/len;
    ctx.save();ctx.strokeStyle=`rgba(238,229,200,${opacity})`;ctx.lineWidth=.95;ctx.setLineDash([2.4,4.7]);
    ctx.beginPath();ctx.moveTo(a[0]+nx*4,a[1]+ny*4);ctx.lineTo(b[0]+nx*4,b[1]+ny*4);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
  }
  function renderClothFace(f,pts){
    const palette=PALETTES[material], active=selected===f.id;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const brightness=f.shade*(.83+.14*Math.cos(angle))*(active?1.09:.72);
    const fill=ctx.createLinearGradient(minX,minY,maxX+1,maxY+1);
    fill.addColorStop(0,rgb(palette.base,brightness*.61));
    fill.addColorStop(.23,rgb(palette.base,brightness*1.28));
    fill.addColorStop(.43,rgb(palette.base,brightness*1.04));
    fill.addColorStop(.7,rgb(palette.base,brightness*.76));
    fill.addColorStop(1,rgb(palette.base,brightness*.48));
    traceFace(pts);ctx.shadowColor='rgba(0,0,0,.54)';ctx.shadowBlur=20;ctx.shadowOffsetY=12;ctx.fillStyle=fill;ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.save();traceFace(pts);ctx.clip();
    // A broad, curved reflected light reads as cloth volume rather than flat geometry.
    const light=ctx.createRadialGradient(minX+(maxX-minX)*.35,minY+(maxY-minY)*.26,1,minX+(maxX-minX)*.46,minY+(maxY-minY)*.44,Math.max(maxX-minX,maxY-minY)*.8);
    light.addColorStop(0,`rgba(255,250,223,${.12+palette.shine*.18})`);light.addColorStop(.52,'rgba(246,242,221,.025)');light.addColorStop(1,'rgba(0,0,0,.30)');ctx.fillStyle=light;ctx.fillRect(minX-5,minY-5,maxX-minX+10,maxY-minY+10);
    ctx.globalAlpha=palette.weave*.8;ctx.strokeStyle='#111819';ctx.lineWidth=.56;
    for(let j=minX-(maxY-minY);j<maxX+(maxY-minY);j+=3.4){ctx.beginPath();ctx.moveTo(j,minY);ctx.lineTo(j+(maxY-minY),maxY);ctx.stroke();}
    ctx.globalAlpha=.06;ctx.strokeStyle='#f2f0d9';ctx.lineWidth=.55;
    for(let j=minY;j<maxY;j+=3.7){ctx.beginPath();ctx.moveTo(minX,j);ctx.lineTo(maxX,j);ctx.stroke();}
    ctx.restore();
    traceFace(pts);ctx.strokeStyle=active?'rgba(228,222,195,.7)':'rgba(154,169,160,.25)';ctx.lineWidth=active?1.2:.7;ctx.stroke();
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if(i%2===0||garmentType==='denim')stitchSegment(a,b,active?.58:.22);}
    if(wire){ctx.strokeStyle=active?'#f2e8c8a0':'#ebedd765';ctx.lineWidth=.8;for(let i=1;i<pts.length-1;i++){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[i+1][0],pts[i+1][1]);ctx.stroke();}}
    // Fine shaped wrinkle arcs establish drape direction without suggesting simulation.
    if(!wire&&pts.length>=5&&maxY-minY>48){
      ctx.save();traceFace(pts);ctx.clip();
      for(let j=1;j<=3;j++){
        const yy=minY+(maxY-minY)*(.25+j*.16),sx=minX+(maxX-minX)*(.18+j*.045),ex=maxX-(maxX-minX)*(.14+j*.025);
        ctx.beginPath();ctx.moveTo(sx,yy);ctx.bezierCurveTo(sx+(ex-sx)*.24,yy-8-j*2,ex-(ex-sx)*.28,yy+9+j*2,ex,yy-5);
        ctx.strokeStyle=`rgba(14,22,23,${active?.12:.08})`;ctx.lineWidth=2.8;ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,yy-3);ctx.bezierCurveTo(sx+(ex-sx)*.24,yy-11-j*2,ex-(ex-sx)*.28,yy+6+j*2,ex,yy-8);
        ctx.strokeStyle=`rgba(254,249,225,${active?.12:.06})`;ctx.lineWidth=1.25;ctx.stroke();
      }
      ctx.restore();
    }
  }
  function draw() {
    if(destroyed||mode!=='3d'||!ctx)return;
    ctx.clearRect(0,0,width,height);
    const gradient=ctx.createRadialGradient(width*.49,height*.41,4,width*.5,height*.56,width*.76);
    gradient.addColorStop(0,'#353b35');gradient.addColorStop(.5,'#1d2827');gradient.addColorStop(1,'#0c1213');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    ctx.save();ctx.strokeStyle='#b9c8af0d';ctx.lineWidth=1;
    const grid=Math.max(24,width/17);
    for(let x=width/2%grid;x<width;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
    for(let y=height/2%grid;y<height;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    ctx.restore();
    const items=faces.map(f=>({f,pts:f.verts.map(project)}));
    items.sort((a,b)=>a.pts.reduce((t,p)=>t+p[2],0)/a.pts.length-b.pts.reduce((t,p)=>t+p[2],0)/b.pts.length);
    for(const {f,pts} of items)renderClothFace(f,pts);
  }
  function requestDraw(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;draw();});}
  function updateUI(){
    root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    root.querySelector('[data-wire]').setAttribute('aria-pressed',String(wire));
    root.querySelectorAll('[data-panel],[data-pattern]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.panel||b.dataset.pattern)===selected)));
    flat.hidden=mode!=='2d';canvas.hidden=mode!=='3d';
    root.classList.toggle('exo-pv-is-2d',mode==='2d');
    caption.textContent=panels.find(p=>p.id===selected).name.toUpperCase()+' / SELECTED';
    root.querySelector('.exo-pv-readout').textContent=mode==='3d'?'DRAG TO ROTATE · ← → TO ORBIT':'SELECT A PANEL TO HIGHLIGHT ITS 3D REGION';
    requestDraw();
  }
  function selectPanel(id){if(panels.some(p=>p.id===id)){selected=id;updateUI();}}
  function setMode(next){mode=String(next).toLowerCase()==='2d'?'2d':'3d';updateUI();}
  function setWireframe(enabled){wire=Boolean(enabled);updateUI();}
  function setMaterial(next){if(PALETTES[next]){material=next;materialSelect.value=next;requestDraw();}}
  function handleClick(e){
    const b=e.target.closest('button');if(!b||!root.contains(b))return;
    if(b.dataset.mode)setMode(b.dataset.mode);
    if(b.hasAttribute('data-wire')){wire=!wire;updateUI();}
    if(b.dataset.panel||b.dataset.pattern)selectPanel(b.dataset.panel||b.dataset.pattern);
  }
  function onKey(e){
    if(e.target instanceof HTMLSelectElement)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&mode==='3d'){
      e.preventDefault();if(e.key==='ArrowLeft')angle-=.12;if(e.key==='ArrowRight')angle+=.12;
      if(e.key==='ArrowUp')tilt=clamp(tilt+.10,-.6,.6);if(e.key==='ArrowDown')tilt=clamp(tilt-.10,-.6,.6);requestDraw();
    } else if(e.key.toLowerCase()==='w'&&e.target===stage){wire=!wire;updateUI();}
  }
  function down(e){if(mode!=='3d')return;dragging={id:e.pointerId,x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);stage.classList.add('is-dragging');}
  function move(e){if(!dragging||dragging.id!==e.pointerId)return;angle+=(e.clientX-dragging.x)*.011;tilt=clamp(tilt+(e.clientY-dragging.y)*.006,-.6,.6);dragging.x=e.clientX;dragging.y=e.clientY;requestDraw();}
  function up(e){if(dragging?.id===e.pointerId){dragging=null;stage.classList.remove('is-dragging');if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);}}
  function resize(){const r=stage.getBoundingClientRect();width=Math.max(1,Math.round(r.width));height=Math.max(1,Math.round(r.height));const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);requestDraw();}
  root.addEventListener('click',handleClick);stage.addEventListener('keydown',onKey);
  stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  materialSelect.addEventListener('change',onMaterial);
  function onMaterial(e){setMaterial(e.target.value);}
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  observer?.observe(stage);if(!observer)window.addEventListener('resize',resize);
  resize();updateUI();
  function destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();if(!observer)window.removeEventListener('resize',resize);if(frame)cancelAnimationFrame(frame);root.removeEventListener('click',handleClick);stage.removeEventListener('keydown',onKey);stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);materialSelect.removeEventListener('change',onMaterial);root.remove();}
  return {setMode,setWireframe,setMaterial,selectPanel,destroy,get mode(){return mode;},get material(){return material;}};
}
