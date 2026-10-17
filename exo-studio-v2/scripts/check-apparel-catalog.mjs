import assert from 'node:assert/strict'
import {FABRIC_PRESETS,FABRIC_SCAN_COVERAGE,createDefaultProject} from '../src/data/defaultProject.js'
import { FABRIC_CATALOG_400_TREATMENTS } from '../src/data/fabricCatalog400.js'
import {APPAREL_MATERIAL_EXPANSION} from '../src/data/apparelMaterialExpansion.js'
import {CLOTHCRAFT_FABRICS,presetProperties,validFabric} from '../src/core/clothcraftFabrics.js'
import {createFabricSurface} from '../src/core/clothcraftFabricSurface.js'
import {
  estimateTensileStiffness,estimateShearStiffness,
  estimateCantileverBending,frictionFromInclineAngle,fabricAreaMassKg,
} from '../src/core/fabricCalibration.js'
import {getHardwarePreset,hardwareToPatternAnnotation,listHardwarePresets} from '../src/data/hardwarePresets.js'
import {describeTextileSurface,textileRelief} from '../src/core/textileProcedurals.js'
import {physicsInputFingerprint,opticalFabricFingerprint} from '../src/core/visualOnlyChanges.js'
import {buildTechPack} from '../src/core/measurements.js'
import {regradeScannedPixel} from '../src/core/photographicScanToning.js'

const required=['rawDenim','frenchTerryHeavy','lambskin','nappaLeather','nubuck','suedeLambskin','cottonPoplin','cottonCanvas','woolFlannel','silkCharmeuse','polyMesh','waffleKnit','polarFleece']
assert.ok(APPAREL_MATERIAL_EXPANSION.length>=50,'Expanded apparel examples must be substantial')
assert.equal(Object.keys(FABRIC_PRESETS).length,400,'React catalog MUST contain exactly 400 fabrics')
assert.ok(CLOTHCRAFT_FABRICS.length>=400,'Native material selector must expose all 400 + original specimens')
assert.equal(FABRIC_CATALOG_400_TREATMENTS.length,4)
assert.equal(Object.values(FABRIC_PRESETS).filter(p=>p.materialFamilyId).length,320)
assert.equal(new Set(Object.values(FABRIC_PRESETS).map(p=>p.name)).size,400)
assert.equal(new Set(CLOTHCRAFT_FABRICS.map(p=>p.id)).size,CLOTHCRAFT_FABRICS.length)
assert.equal(new Set(Object.values(FABRIC_PRESETS).map(p=>p.id)).size,Object.keys(FABRIC_PRESETS).length)
assert.equal(FABRIC_SCAN_COVERAGE.total,400)
assert.equal(FABRIC_SCAN_COVERAGE.photographicReferences+FABRIC_SCAN_COVERAGE.proceduralFallbacks,400)
assert.ok(FABRIC_SCAN_COVERAGE.uniqueLicensedScans>=30)
assert.ok(FABRIC_SCAN_COVERAGE.photographicReferences>=350)
assert.equal(FABRIC_PRESETS.rawDenim.texture.scanAssetId,'denim_fabric_06')
assert.equal(FABRIC_PRESETS.ripstopUltralight.photoReference.status,'CC0-photographic-reference')
assert.equal(FABRIC_PRESETS.ripstopUltralight.photoReference.provider,'ambientCG')
assert.equal(FABRIC_PRESETS.polyMesh.photoReference.status,'procedural-no-suitable-photo')
assert.equal(describeTextileSurface(FABRIC_PRESETS.quiltedNylon).family,'quilted')
assert.equal(describeTextileSurface(FABRIC_PRESETS.neoprene).family,'foam-laminate')
const dyedScan=regradeScannedPixel([170,177,183],.62,[40,63,89])
assert.ok(dyedScan.every(c=>Number.isInteger(c)&&c>=0&&c<=255))
assert.notDeepEqual(regradeScannedPixel([170,177,183],.62,[210,190,170]),dyedScan)
for(const id of required)assert.ok(FABRIC_PRESETS[id],`Missing ${id}`)

for(const fabric of Object.values(FABRIC_PRESETS)){
  for(const key of ['gsm','thickness','stretchWarp','stretchWeft','bend','friction','roughness','sheen'])
    assert.ok(Number.isFinite(fabric[key]),`${fabric.id} invalid ${key}`)
  for(const key of ['normalStrength','fiberAnisotropy','sheenRoughness','colorVariation'])
    assert.ok(Number.isFinite(fabric[key]),`${fabric.id} missing optical parameter ${key}`)
  for(const key of ['fiberAnisotropy','sheenRoughness','colorVariation'])
    assert.ok(fabric[key]>=0&&fabric[key]<=1,`${fabric.id} optical parameter out of bounds: ${key}`)
  assert.ok(fabric.gsm>0 && fabric.thickness>0 && fabric.bend>0)
  if(fabric.materialFamilyId){
    assert.ok(FABRIC_PRESETS[fabric.materialFamilyId],`Unknown base material ${fabric.id}`)
    assert.equal(fabric.calibration.status,'estimated')
    assert.ok(fabric.gsm!==FABRIC_PRESETS[fabric.materialFamilyId].gsm)
    assert.ok(fabric.bend!==FABRIC_PRESETS[fabric.materialFamilyId].bend)
    assert.notEqual(fabric.fiberAnisotropy,FABRIC_PRESETS[fabric.materialFamilyId].fiberAnisotropy,
      `${fabric.id} should modify yarn directional reflectance`)
    assert.notEqual(fabric.sheenRoughness,FABRIC_PRESETS[fabric.materialFamilyId].sheenRoughness,
      `${fabric.id} should modify fiber sheen broadness`)
  }
  if(fabric.texture?.scanAssetId){
    assert.equal(fabric.texture.license,'CC0')
    assert.match(fabric.texture.src,/^\/fabric-scans(?:-ambientcg)?\//)
    assert.match(fabric.texture.normalSrc,/^\/fabric-scans(?:-ambientcg)?\//)
    assert.match(fabric.texture.roughnessSrc,/^\/fabric-scans(?:-ambientcg)?\//)
    assert.ok(fabric.texture.repeatWidthCm>0&&fabric.texture.repeatHeightCm>0)
    assert.equal(fabric.calibration.status,'estimated','Scanned appearance must not imply measured physics')
  }
  const surface=describeTextileSurface(fabric)
  for(const xy of [[.1,.2],[.325,.72],[.71,.4]]){
    assert.ok(Number.isFinite(textileRelief(surface.family,...xy)),`${fabric.id} procedural shape is invalid`)
  }
}
for(const fabric of CLOTHCRAFT_FABRICS){
  const current={compression_transition:.05,compression_ratio:.5}
  const params=presetProperties(fabric,current)
  assert.ok(validFabric(params),`Invalid native solver material ${fabric.id}`)
  assert.ok(Math.abs(params.density*1000-fabric.gsm)<1e-6)
  assert.ok(Math.abs(params.thickness*1000-fabric.thicknessMm)<1e-6)
}

for(const id of ['frenchTerryHeavy','heavyDenim','lambskin','suedeLambskin','polyMesh']){
  const model=createFabricSurface({name:FABRIC_PRESETS[id].name})
  assert.ok(model.isMeshPhysicalMaterial && model.map && model.bumpMap,`Missing native yarn surface: ${id}`)
  assert.equal(model.userData.fabricPreset,id)
  model.userData.ownedTexture.dispose()
  model.dispose()
}

const stiffness=estimateTensileStiffness({
  widthMm:30,gaugeLengthMm:200,
  observations:[{extensionMm:2,forceN:.12},{extensionMm:4,forceN:.24}],
})
assert.ok(Math.abs(stiffness.stiffnessNPerM-400)<1e-8)
assert.ok(Math.abs(fabricAreaMassKg(2,450)-.9)<1e-9)
assert.ok(estimateShearStiffness({widthMm:30,forceN:.09,shearAngleDeg:10})>0)
assert.ok(estimateCantileverBending({gsm:220,overhangMm:100,tipDeflectionMm:5})>0)
assert.ok(Math.abs(frictionFromInclineAngle(45)-1)<1e-10)
assert.throws(()=>estimateTensileStiffness({widthMm:0,gaugeLengthMm:200,observations:[{extensionMm:2,forceN:1}]}),RangeError)
assert.throws(()=>estimateCantileverBending({gsm:300,overhangMm:60,tipDeflectionMm:50}),RangeError)
assert.ok(listHardwarePresets('button').length>=4)
assert.ok(getHardwarePreset('denim-tack-button'))
assert.equal(hardwareToPatternAnnotation('denim-tack-button',{x:2,y:3}).diameterCm,1.7)
assert.equal(hardwareToPatternAnnotation('denim-copper-rivet',{x:2,y:3}),null)
const project=createDefaultProject()
const simulationBefore=physicsInputFingerprint(project)
const opticalBefore=opticalFabricFingerprint(project)
project.fabrics.main.wash={type:'pp',strength:.71,placement:{x:.42,y:.61},scale:1.5,rotation:13,seed:9,blend:'overlay',seamAbrasion:.25}
assert.equal(physicsInputFingerprint(project),simulationBefore,'Visual wash must not reset physical simulation')
assert.notEqual(opticalFabricFingerprint(project),opticalBefore,'Wash must update live material')
assert.equal(buildTechPack(project).materials.find(f=>f.id==='main').wash.type,'pp','Wash reference survives tech-pack export')
console.log(JSON.stringify({
  ok:true,browserPresets:Object.keys(FABRIC_PRESETS).length,
  rustPresets:CLOTHCRAFT_FABRICS.length,extraPresets:APPAREL_MATERIAL_EXPANSION.length,
  distinctConstructedVariants:320,
  hardwarePresets:listHardwarePresets().length,
  tensileCheckNPerM:stiffness.stiffnessNPerM,
}))
