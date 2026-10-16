import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {normalizeFabricOptics,textileAlbedoMultiplier} from '../src/core/fabricSurfaceModel.js'
import {classifyFabricPbrFilename} from '../src/core/fabricPbrFileNaming.js'
const cases=[]
const keys=['opacity','displacementMm','roughness','metalness','sheen','sheenRoughness','normalStrength','fiberAnisotropy','fiberAngleDeg','clearcoat','clearcoatRoughness','colorVariation','weaveScaleCm']
cases.push({op:'optics',fabric:{}})
for(const key of keys)for(const value of [-100,-1,0,.15,.5,1,15,300,null,false,true,'0.6','invalid'])
 cases.push({op:'optics',fabric:{[key]:value}})
for(const family of ['plain','twill','rib-knit','leather','suede','denim'])
 for(const variation of [0,.25,1,-2,4])
  for(const [u,v] of [[0,0],[.13,.65],[1,1]])
   cases.push({op:'albedo',family,u,v,variation})
for(const filename of ['cotton_normalGL.png','cotton_nor_gl.jpg','wool_NRM.webp','velvet_roughness.jpg','cloth_rgh.png','metallic_mtl.png','alpha_translucency.webp','fabric_height.png','fabric_DISP.jpg','cotton_basecolor.png','linen_col.jpg','sample_normal_dx.png','sample_nor-dx.png','cloth_DirectX.jpg','fabric_ARM.jpg','fabric_rough_ao.png','FABRIC_ROUGH-AO.png','fabric_roughao.jpg','fabric_occlusion.png','cotton_normalGL.jpeg','unknown.bin','ALBEDO_DIFF.PNG'])
 cases.push({op:'filename',filename})
const runner=process.env.GARMENT_FABRIC_SURFACE_TEST||'/tmp/garment-native-fabric-surface-test'
const run=spawnSync(runner,['--json-lines'],{input:cases.map(v=>JSON.stringify(v)).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024})
if(run.error)throw run.error
assert.equal(run.status,0,run.stderr)
const outputs=run.stdout.trim().split('\n')
assert.equal(outputs.length,cases.length)
function equal(a,b,label){
 if(typeof b==='number'){assert.ok(typeof a==='number'&&Math.abs(a-b)<1e-9,label+': '+a+' vs '+b);return}
 if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label);for(const key of Object.keys(b))equal(a[key],b[key],label+'.'+key);return}
 assert.deepEqual(a,b,label)
}
for(let i=0;i<cases.length;i++){
 const c=cases[i]
 const expected=c.op==='optics'?normalizeFabricOptics(c.fabric):c.op==='albedo'?textileAlbedoMultiplier(c.family,c.u,c.v,c.variation):classifyFabricPbrFilename(c.filename)
 equal(JSON.parse(outputs[i]),expected,c.op+' case '+i)
}
console.log('native fabric surface JS/C++ parity passed: '+cases.length+' cases')
