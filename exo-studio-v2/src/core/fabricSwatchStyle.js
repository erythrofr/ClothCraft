// Small, low-cost 2D directory thumbnails. These are texture-aware pattern
// hints, not substitute PBR scans or calibrated fabric color photography.
// The selected fabric uses actual MeshPhysicalMaterial and cm UV maps in 3D.
const GRADIENTS={
  twill:'repeating-linear-gradient(133deg, #fff5 0px, #ffffff00 1.5px, #0004 2.5px, #0000 4px)',
  'plain-weave':'repeating-linear-gradient(0deg, #ffffff20 0 1px, transparent 1px 4px),repeating-linear-gradient(90deg, #00000028 0 1px, transparent 1px 4px)',
  'basket-weave':'repeating-linear-gradient(0deg, #ffffff35 0 2px, transparent 2px 8px),repeating-linear-gradient(90deg, #00000029 0 2px, transparent 2px 8px)',
  'rib-knit':'repeating-linear-gradient(90deg, #ffffff60 0 2px, #00000025 3px 5px, transparent 6px 9px)',
  'jersey-knit':'repeating-linear-gradient(120deg, #ffffff2c 0 1px, transparent 2px 5px),repeating-linear-gradient(60deg, #00000020 0 1px, transparent 2px 6px)',
  'terry-knit':'radial-gradient(circle at 20% 40%, #ffffff40 0 1px, transparent 3px),radial-gradient(circle at 67% 23%, #00000035 0 2px, transparent 4px)',
  'waffle-knit':'repeating-linear-gradient(0deg, #00000035 0 2px, transparent 3px 12px),repeating-linear-gradient(90deg, #ffffff30 0 2px, transparent 3px 12px)',
  'fleece-pile':'radial-gradient(circle at 32% 24%, #ffffff65 0 1px, transparent 3px),radial-gradient(circle at 70% 83%, #00000050 0 2px, transparent 5px)',
  leather:'radial-gradient(ellipse at 22% 48%, #00000035 0 2px, transparent 8px),radial-gradient(ellipse at 70% 72%, #ffffff48 0 2px, transparent 10px)',
  suede:'radial-gradient(circle at 37% 25%, #ffffff35 0 1px, transparent 4px),radial-gradient(circle at 82% 74%, #0000002c 0 1px, transparent 4px)',
  silk:'repeating-linear-gradient(112deg, #ffffff65 0 1px, transparent 2px 5px)',
  velvet:'repeating-linear-gradient(90deg, #ffffff2c 0 1px, #0000002e 2px 3px, transparent 4px 6px)',
  corduroy:'repeating-linear-gradient(90deg, #ffffff73 0 2px, #00000034 3px 6px, transparent 7px 11px)',
  synthetic:'repeating-linear-gradient(145deg, #ffffff3a 0 1px, transparent 2px 6px)',
  ripstop:'repeating-linear-gradient(90deg, #ffffff4d 0 1px, transparent 2px 18px),repeating-linear-gradient(0deg, #ffffff3f 0 1px, transparent 2px 18px)',
  mesh:'radial-gradient(circle, transparent 38%, #00000047 42%, #ffffff1a 55%, transparent 60%)',
  boucle:'radial-gradient(circle at 35% 55%, #ffffff5b 0 2px, transparent 4px),radial-gradient(circle at 72% 20%, #0000004d 0 2px, transparent 5px)',
  crepe:'radial-gradient(circle at 15% 40%, #ffffff33 0 1px, transparent 3px),radial-gradient(circle at 68% 70%, #0000003d 0 1px, transparent 3px)',
}
const SIZES={
 'terry-knit':'11px 11px, 14px 14px', 'fleece-pile':'7px 7px, 13px 13px',
 leather:'13px 11px, 16px 14px',suede:'9px 9px, 12px 12px',
 mesh:'9px 9px',boucle:'12px 12px, 10px 10px',crepe:'6px 6px,8px 8px',
}
export function fabricSwatchStyle(fabric={}) {
 if(fabric.texture?.scanAssetId&&(/^\/fabric-scans(?:-ambientcg)?\//).test(fabric.texture.src||'')){
  return {
   backgroundColor:fabric.color||'#777777',
   backgroundImage:`url("${fabric.texture.src}")`,
   backgroundBlendMode:'luminosity',
   backgroundSize:'cover',
   backgroundPosition:'center',
  }
 }
 const family=fabric.surfaceFamily&&fabric.surfaceFamily!=='auto'?fabric.surfaceFamily:
  /denim|twill/i.test(fabric.name||'')?'twill':
  /leather|nappa/i.test(fabric.name||'')?'leather':
  /suede|nubuck/i.test(fabric.name||'')?'suede':
  /rib/i.test(fabric.name||'')?'rib-knit':
  /fleece|terry/i.test(fabric.name||'')?'terry-knit':'plain-weave'
 return {
  backgroundColor:fabric.color||'#777777',
  backgroundImage:GRADIENTS[family]||GRADIENTS['plain-weave'],
  backgroundSize:SIZES[family]||'auto',
 }
}
