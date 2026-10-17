import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  createZipperToothGeometry,createZipperSliderHousingGeometry,createZipperPullTabGeometry,
  createZipperHardware3D,
} from '../src/components/ZipperHardware3D.js'

const close=(value,expected,tolerance=.001)=>assert.ok(Math.abs(value-expected)<=tolerance,`${value} outside ${expected} ±${tolerance}`)
const material=new THREE.MeshStandardMaterial({color:'#a9afb8'})
const geometryCases=[]
for(const family of ['metal','molded','coil','invisible-coil']){
  const geo=createZipperToothGeometry(.008,.0022,.00065,family)
  const pos=geo.getAttribute('position')
  assert.ok(pos.count>24,`${family}: profiled tooth contains actual bevel surfaces`)
  assert.equal(geo.getAttribute('normal').count,pos.count)
  const b=new THREE.Box3().setFromBufferAttribute(pos)
  assert.ok(b.getSize(new THREE.Vector3()).z>.0004)
  const uniqueEdges=new Set()
  for(let i=0;i<pos.count;i++)uniqueEdges.add(`${pos.getX(i).toFixed(4)}:${pos.getY(i).toFixed(4)}`)
  assert.ok(uniqueEdges.size>=9,`${family}: not an old six-face box`)
  geometryCases.push({family,vertices:pos.count,shapePoints:uniqueEdges.size})
  geo.dispose()
}
const shell=createZipperSliderHousingGeometry(.008,.00065)
assert.ok(shell.getAttribute('position').count>50,'Slider must have shaped walls and bevel geometry')
shell.dispose()
const pullGeo=createZipperPullTabGeometry(.008,.00065)
const tab=new THREE.Mesh(pullGeo,material)
const raycaster=new THREE.Raycaster()
const tabWidth=.008*.84, tabHeight=.008*2.7
const castAt=(x,y)=>{
  raycaster.set(new THREE.Vector3(x,y,.01),new THREE.Vector3(0,0,-1))
  return raycaster.intersectObject(tab,false).length
}
assert.equal(castAt(0,tabHeight*.1),0,'Real pull tab must have a through-cut aperture')
assert.ok(castAt(tabWidth*.34,-tabHeight*.18)>0,'Metal surrounding cutout must remain visible')
pullGeo.dispose()
material.dispose()

const positions=new Float32Array([0,0,0,0,.05,0,0,.10,0,0,.15,0,0,.20,0])
const normals=new Float32Array(positions.length)
for(let n=2;n<normals.length;n+=3)normals[n]=1
const sourceGeometry=new THREE.BufferGeometry()
sourceGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
sourceGeometry.setAttribute('normal',new THREE.BufferAttribute(normals,3))
const sourceMesh=new THREE.Mesh(sourceGeometry,new THREE.MeshBasicMaterial())
const record={geometry:sourceGeometry,mesh:sourceMesh}
const zipper=createZipperHardware3D({
  id:'manufacturing-geometry-qa',type:'metal',twoWay:true,
  sliderFraction:.74,bottomSliderFraction:.14,startExtensionMm:7,endExtensionMm:12,
  chainWidthMm:8,tapeWidthMm:16,toothPitchMm:2,tapeThicknessMm:.65,
  metalness:.82,roughness:.33,fastened:true,openFrom:'end',
},[{record,indices:[0,1,2,3,4]}])
assert.ok(zipper,'Scene zipper group created')
assert.equal(zipper.sliderCount,2)
assert.ok(zipper.toothInstanceCount>10)
assert.ok(zipper.openToothCount>0)
close(zipper.startExtensionM,.007,.00001)
close(zipper.endExtensionM,.012,.00001)
const sceneTeeth=zipper.object.getObjectByName('zipper-teeth-0')
assert.ok(sceneTeeth?.isInstancedMesh,'Individual profiled teeth stay batched by instancing')
assert.ok(sceneTeeth.geometry.getAttribute('position').count>24,'Live teeth use profiled geometry')
for(const sliderName of ['zipper-slider-assembly','zipper-bottom-slider-assembly']){
  const slider=zipper.object.getObjectByName(sliderName)
  assert.ok(slider,'Both real slider groups exist')
  const pull=slider.getObjectByName('zipper-puller-tab')
  assert.ok(pull?.isMesh&&pull.geometry.getAttribute('position').count>50,'3D cut-out puller exists')
}
zipper.object.traverse(item=>{
  item.geometry?.dispose?.()
  const materials=Array.isArray(item.material)?item.material:[item.material]
  materials.forEach(m=>m?.dispose?.())
})
sourceGeometry.dispose();sourceMesh.material.dispose()
console.log(JSON.stringify({pass:true,geometries:geometryCases,sliderCount:2,toothInstances:zipper.toothInstanceCount,
  openTeeth:zipper.openToothCount,engagedTeeth:zipper.engagedToothCount,pullerCutout:'raycast verified'},null,2))
