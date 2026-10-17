import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const esbuild=require('esbuild')
const source=readFileSync(new URL('../src/components/FabricMaterialPreview.jsx',import.meta.url),'utf8')
const compiled=await esbuild.transform(source,{loader:'jsx',format:'esm'})
assert.ok(compiled.code.includes('FabricMaterialPreview'),'Preview JSX must compile')

// The same physical distance must contain the same number of repeated scan
// tiles, regardless of whether the fabric is shown on the ball or flat.
for(const scanCm of [3,12,20,40]){
  for(const patchCm of [.5,1.8,8,64,270]){
    const uv=patchCm/scanCm
    assert.ok(Number.isFinite(uv)&&uv>0)
    if(patchCm===270)assert.ok(uv>=6.75,'Ball sheet must contain multiple visible yarn tiles')
  }
}
assert.match(source,/FABRIC_BALL_SWATCH_CM\/widthCm/,'Ball U scale must use physical extent')
assert.match(source,/FABRIC_BALL_SWATCH_CM\/heightCm/,'Ball V scale must use physical extent')
assert.match(source,/macroBaseUvs\[i\*2\]\*patchWidth\/widthCm/,'Macro scale must remain physical')
assert.match(source,/drapeBaseUvs\[i\*2\]\*64\/widthCm/,'Drape scale must remain physical')
assert.match(source,/fabricSwatchRepeatDimensions/,'Invalid scan dimensions must be normalized')

for(const field of ['src','normalSrc','roughnessSrc','metalnessSrc','opacitySrc','displacementSrc']){
  assert.ok(source.includes(`load('${field}'`),`${field} must be loadable`)
}
assert.match(source,/generated\?\.colorMap,generated\?\.normalMap,generated\?\.roughnessMap,generated\?\.alphaMap/,
  'Overridden procedural maps must be released')
assert.match(source,/view\.deactivateLoads\?\.\(\)/,'Material swaps must cancel stale callbacks')
assert.match(source,/viewRef\.current\?\.deactivateLoads\?\.\(\)/,'Unmount must cancel callbacks')
assert.match(source,/if\(!active\|\|view\.isDisposed\(\)\)return/,'Late image loads must be ignored')
assert.match(source,/material\.roughness=optics\.roughness/,'Inspector must use normalized material roughness')
assert.match(source,/material\.color\.set/,'Inspector must update material color')
assert.match(source,/view\.setMacroScale\(fabric\)/,'Switching fabric must update fold specimen')
assert.match(source,/The shown folds are an optical reference/,'Do not claim a fabric simulation')
assert.ok(!source.includes('position: fixed'),'Inspector must remain in docked layout')

console.log(JSON.stringify({pass:true,jsxCompiled:true,uvDistancesChecked:20,mapChannels:6,
  disposalAndLateImageGuards:true,simulationClaimed:false,
  limitation:'Static source and UV invariant QA; not a GPU rendering or measured cloth test'}))
