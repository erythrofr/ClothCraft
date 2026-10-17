import assert from 'node:assert/strict'
import * as THREE from 'three'
import {FABRIC_PRESETS,FABRIC_SCAN_COVERAGE} from '../src/data/defaultProject.js'
import {balanceRoughnessByte,fabricSwatchMapRepeats,shouldBalanceFabricRoughness} from '../src/core/fabricPbrAppearance.js'
import {regradeScannedPixel} from '../src/core/photographicScanToning.js'
import {textileRelief,describeTextileSurface} from '../src/core/textileProcedurals.js'

assert.equal(Object.keys(FABRIC_PRESETS).length,400)
assert.equal(FABRIC_SCAN_COVERAGE.uniqueLicensedScans,67)
assert.equal(FABRIC_SCAN_COVERAGE.photographicReferences,385)
assert.equal(FABRIC_SCAN_COVERAGE.proceduralFallbacks,15)
const tone=regradeScannedPixel([125,130,135],.5,[170,90,50])
assert.ok(tone[0]>tone[1]&&tone[1]>tone[2],'scan should preserve target color hierarchy')
assert.ok(regradeScannedPixel([180,180,180],.5,[100,100,100])[0]>regradeScannedPixel([70,70,70],.5,[100,100,100])[0],'scan should preserve yarn highlights')
const samples=[75,105,135,165,195].map(n=>balanceRoughnessByte(n,135,.57))
assert.ok(samples.every((n,i)=>i===0||n>samples[i-1]),'roughness must preserve light and dark source variation')
assert.ok(samples[0]<230&&samples.at(-1)>230,'roughness must preserve variation around the mean')
assert.equal(shouldBalanceFabricRoughness({texture:{scanAssetId:'x',license:'CC0',roughnessSrc:'/fabric-scans/x/roughness.jpg'}}),true)
assert.equal(shouldBalanceFabricRoughness({texture:{scanAssetId:'x',license:'unknown',roughnessSrc:'/fabric-scans/x/roughness.jpg'}}),false)
assert.deepEqual(fabricSwatchMapRepeats({repeatWidthCm:20,repeatHeightCm:40},240),[12,6])
assert.equal(THREE.SRGBColorSpace,'srgb')
assert.equal(THREE.NoColorSpace,'')
for(const family of ['twill','jersey-knit','rib-knit','terry-knit','ripstop','plain-weave']){
 const a=textileRelief(family,0,.43)
 const b=textileRelief(family,1,.43)
 assert.ok(Math.abs(a-b)<1e-8,`${family}: u texture seam`)
 assert.ok(Number.isFinite(describeTextileSurface({name:family}).normalGain))
}
console.log(JSON.stringify({ok:true,presets:400,uniqueInstalledScans:67,photoReferencedPresets:385,proceduralPresets:15,roughnessSamples:samples}))
