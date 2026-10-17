import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {createTeeTemplate,createPantsTemplate} from '../src/data/templates.js'
import {physicsInputFingerprint,opticalFabricFingerprint} from '../src/core/visualOnlyChanges.js'
const root=resolve(import.meta.dirname,'..'),bin=resolve(mkdtempSync(resolve(tmpdir(),'gs-visual-fingerprint-')),'check')
const build=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/visual_only_fingerprints.cpp','native_cpp/tests/test_visual_only_fingerprints.cpp','-o',bin],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const cases=[]
for(const template of [createTeeTemplate,createPantsTemplate]){
 const base=template(),fabricId=Object.keys(base.fabrics)[0]
 const optics=structuredClone(base);Object.assign(optics.fabrics[fabricId],{color:'#cc3355',roughness:.32,metalness:.13,sheen:.91,normalStrength:2.5,texture:{repeatWidthCm:8,rotationDeg:33},weaveScaleCm:5,surfaceFamily:'silk'})
 const physical=structuredClone(base);physical.fabrics[fabricId].thickness=(physical.fabrics[fabricId].thickness||.002)+.003
 const revision=structuredClone(base);revision.revision=999;revision.updatedAt='later';revision.render={exposure:5}
 assert.equal(physicsInputFingerprint(base),physicsInputFingerprint(optics),'optics must preserve physics fingerprint')
 assert.notEqual(opticalFabricFingerprint(base),opticalFabricFingerprint(optics),'optical edit must update visual fingerprint')
 assert.notEqual(physicsInputFingerprint(base),physicsInputFingerprint(physical),'physical edit must update physics fingerprint')
 assert.equal(physicsInputFingerprint(base),physicsInputFingerprint(revision),'revision/render must be omitted')
 cases.push(base,optics,physical,revision)
}
cases.push({},null,{fabrics:{a:{name:'A',roughness:null,thickness:.002},b:{color:'#fff',texture:{repeatWidthCm:20}}}}, {fabrics:{z:{opacity:0},a:{opacity:1}}})
const run=spawnSync(bin,[],{cwd:root,input:JSON.stringify(cases),encoding:'utf8',maxBuffer:32*1024*1024})
assert.equal(run.status,0,run.stderr)
const output=JSON.parse(run.stdout)
const mismatches=[]
for(let i=0;i<cases.length;i++)for(const [name,fn] of [['physics',physicsInputFingerprint],['optical',opticalFabricFingerprint]]){
 const expected=fn(cases[i]),actual=output[i][name]
 if(expected!==actual){let offset=0;while(offset<Math.min(expected.length,actual.length)&&expected[offset]===actual[offset])offset++;mismatches.push({case:i,name,offset,expected:expected.slice(offset,offset+100),actual:actual.slice(offset,offset+100)})}
}
console.log(JSON.stringify({cases:cases.length,matched:cases.length*2-mismatches.length,total:cases.length*2,mismatches:mismatches.slice(0,8)},null,2))
assert.equal(mismatches.length,0)
