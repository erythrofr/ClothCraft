import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseSeamlyMeasurements, applySeamlyMeasurements } from '../src/core/seamlyMeasurements.js'
import { parseSeamlyConstructionReference } from '../src/core/seamlyConstructionReference.js'
import { WORKSPACE_PROFILES, normalizeWorkspaceProfile } from '../src/core/workspaceProfiles.js'
import { normalizeFabricOptics, textileAlbedoMultiplier } from '../src/core/fabricSurfaceModel.js'
import { describeTextileSurface } from '../src/core/textileProcedurals.js'
import { physicsInputFingerprint, opticalFabricFingerprint } from '../src/core/visualOnlyChanges.js'
import { createTemplateProject } from '../src/data/templates.js'
import { buildTechPack } from '../src/core/measurements.js'

const samples='research/oss/Seamly2D/src/app/share/samples/measurements/'
const complexDraft=parseSeamlyConstructionReference(fs.readFileSync('research/oss/Seamly2D/src/app/share/samples/patterns/male_shirt.sm2d','utf8'),{filename:'male_shirt.sm2d'})
const emptyDraft=parseSeamlyConstructionReference(fs.readFileSync('research/oss/Seamly2D/src/test/CollectionTest/tst_seamly2d/empty.sm2d','utf8'))
assert.equal(complexDraft.kind,'sm2d')
assert.equal(complexDraft.version,'0.6.8')
assert.equal(complexDraft.toolCount,188)
assert.equal(complexDraft.incrementCount,53)
assert.equal(complexDraft.blocks.length,5)
assert.equal(complexDraft.unresolvedIncrements.length,0)
assert.equal(emptyDraft.toolCount,1)
assert.ok(Object.keys(complexDraft.toolTypes).length>=10)
assert.throws(()=>parseSeamlyConstructionReference('<!DOCTYPE pattern><pattern/>'),/DOCTYPE/)
assert.throws(()=>parseSeamlyConstructionReference('<smis><unit>cm</unit></smis>'),/not a Seamly2D/)
const single=parseSeamlyMeasurements(fs.readFileSync(samples+'individual/male_shirt.smis','utf8'))
const graded=parseSeamlyMeasurements(fs.readFileSync(samples+'multisize/gost_man_ru.smms','utf8'))
assert.equal(single.measurementCount,9)
assert.equal(single.measurements.height.baseCm,173)
assert.equal(single.measurements.bust_circ.baseCm,102)
assert.equal(graded.measurementCount,76)
assert.equal(graded.measurements.height.baseCm,176)
assert.equal(graded.measurements.bust_circ.baseCm,104.4)
assert.equal(graded.measurements.head_length.sizeIncrementCm,-.2)
assert.equal(graded.measurements.height.heightIncrementCm,6)
assert.throws(()=>parseSeamlyMeasurements('<?xml version="1.0"?><!DOCTYPE smis><smis/>'),/entities/)
assert.throws(()=>parseSeamlyMeasurements('<pattern><draw/></pattern>'),/smis or .smms/)
assert.throws(()=>parseSeamlyMeasurements('<smis><unit>cm</unit>'),/Invalid Seamly/)
const source=createTemplateProject('tee')
const original=JSON.stringify(source)
const initialPhysicsKey=physicsInputFingerprint(source)
const opticalEdit=structuredClone(source)
opticalEdit.revision+=1
opticalEdit.updatedAt='2030-01-01T00:00:00.000Z'
opticalEdit.fabrics.main.color='#914e45'
opticalEdit.fabrics.main.roughness=.32
opticalEdit.fabrics.main.fiberAnisotropy=.91
opticalEdit.fabrics.main.weaveScaleCm=1.25
opticalEdit.render={environmentPreset:'dramatic',exposure:2}
assert.equal(physicsInputFingerprint(opticalEdit),initialPhysicsKey,
  'Optical-only changes must not rebuild the physical cloth session')
assert.notEqual(opticalFabricFingerprint(opticalEdit),opticalFabricFingerprint(source))
const mechanicsEdit=structuredClone(source)
mechanicsEdit.fabrics.main.gsm+=60
assert.notEqual(physicsInputFingerprint(mechanicsEdit),initialPhysicsKey,
  'Mechanical material changes must still rebuild the solver')
const geometryEdit=structuredClone(source)
geometryEdit.pieces[0].points[0].x+=.25
assert.notEqual(physicsInputFingerprint(geometryEdit),initialPhysicsKey)
const library=applySeamlyMeasurements(source,single)
assert.deepEqual(library.pieces,source.pieces)
assert.deepEqual(library.seams,source.seams)
assert.deepEqual(library.avatar,source.avatar)
const avatar=applySeamlyMeasurements(source,single,{applyToAvatar:true})
assert.equal(avatar.avatar.heightCm,173)
assert.equal(avatar.avatar.chestCm,102)
assert.deepEqual(avatar.pieces,source.pieces)
assert.deepEqual(avatar.seams,source.seams)
assert.equal(JSON.stringify(source),original)
const profiles=Object.entries(WORKSPACE_PROFILES)
assert.equal(profiles.length,4)
for(const [name, profile] of profiles) {
  const normalized=normalizeWorkspaceProfile(profile)
  assert.equal(normalized.name,profile.name,name)
  assert.equal(normalized.section,profile.section)
  assert.equal(normalized.libraryWidth,profile.libraryWidth)
  assert.equal(normalized.inspectorWidth,profile.inspectorWidth)
}
const hostile=normalizeWorkspaceProfile({
  name:'X'.repeat(200),section:'bad',tab:'bad',tool:'bad',viewportTool:'bad',
  libraryWidth:-3,inspectorWidth:99999,objectBrowserHeight:'NaN',
  objectBrowserVisible:false,topTabsVisible:false,
})
assert.equal(hostile.name.length,80)
assert.equal(hostile.section,'Pattern')
assert.equal(hostile.tab,'Scene')
assert.equal(hostile.libraryWidth,160)
assert.equal(hostile.inspectorWidth,540)
assert.equal(hostile.objectBrowserHeight,390)
assert.equal(hostile.objectBrowserVisible,false)
assert.throws(()=>normalizeWorkspaceProfile(null),/Invalid/)
const optics=normalizeFabricOptics({
  roughness:9,metalness:-2,sheen:99,normalStrength:-1,
  fiberAnisotropy:1.3,fiberAngleDeg:90,clearcoat:2,
  clearcoatRoughness:-1,colorVariation:100,weaveScaleCm:0,
})
assert.equal(optics.roughness,1)
assert.equal(optics.metalness,0)
assert.equal(optics.sheen,1)
assert.equal(optics.normalStrength,0)
assert.equal(optics.anisotropy,1)
assert.equal(optics.anisotropyRotation,Math.PI/2)
assert.equal(optics.clearcoat,1)
assert.equal(optics.clearcoatRoughness,.04)
assert.equal(optics.colorVariation,1)
assert.equal(optics.weaveScaleCm,.3)
assert.equal(describeTextileSurface({name:'Rigid Denim',weaveScaleCm:2}).family,'twill')
assert.equal(describeTextileSurface({name:'Rigid Denim',weaveScaleCm:2}).tileCm,2)
for(const family of ['jersey-knit','rib-knit','twill','silk','synthetic','leather','suede','plain-weave']) {
  const value=textileAlbedoMultiplier(family,.13,.31,.65)
  assert.ok(value>=.82 && value<=1)
  assert.equal(textileAlbedoMultiplier(family,.13,.31,0),1)
}
const pack=buildTechPack(source)
assert.ok(pack.materials.length>0)
assert.ok(pack.materials.every(f=>Number.isFinite(f.weaveScaleCm)))
assert.ok(pack.materials.every(f=>Number.isFinite(f.fiberAnisotropy)))
console.log(JSON.stringify({
  pass:true,actualSeamlySamples:['smis','smms','sm2d'],measurements:[single.measurementCount,graded.measurementCount],
  seamlyConstructionTools:complexDraft.toolCount,readOnlyFormulaIncrements:complexDraft.incrementCount,
  projectPatternUnchanged:true,workspaceProfiles:profiles.map(([key])=>key),
  fabricOpticalBounds:true,techPackOptics:true,
  opticalHotpatchPreservesCloth:true,physicsChangesTriggerNewSolve:true,
  fullSeamlyConstructionSupport:false,certifiedPathTracing:false,
}))
