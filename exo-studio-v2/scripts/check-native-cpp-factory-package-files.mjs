import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {createTeeTemplate,createPantsTemplate} from '../src/data/templates.js'
import {buildFactoryPackageFiles} from '../src/core/factoryPackage.js'
import {zipSync,unzipSync} from 'fflate'
const deepSemanticEqual=(a,b)=>{
 if(a===b)return true
 if(a===null||b===null||typeof a!==typeof b)return false
 if(typeof a!=='object')return false
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((item,i)=>deepSemanticEqual(item,b[i]))
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort()
 return ak.length===bk.length&&ak.every((key,i)=>key===bk[i]&&deepSemanticEqual(a[key],b[key]))
}
const firstSemanticDifference=(a,b,path='$')=>{
 if(deepSemanticEqual(a,b))return null
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return {path,native:a,js:b}
 const keys=[...new Set([...Object.keys(a),...Object.keys(b)])]
 for(const key of keys){const difference=firstSemanticDifference(a[key],b[key],`${path}.${key}`);if(difference)return difference}
 return {path,native:a,js:b}
}
const root=resolve(import.meta.dirname,'..'),binary=resolve(mkdtempSync(resolve(tmpdir(),'factory-files-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O2','-ffp-contract=off','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/factory_package_files.cpp','native_cpp/core/graded_geometry_parity_bridge.cpp','native_cpp/core/project_geometry.cpp','native_cpp/tests/test_factory_package_files.cpp','native_cpp/build-cmake/libgarment_cad_core.a','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const encoder=new TextDecoder(),cases=[],expected=[]
const testedSizes=(process.env.GARMENT_FACTORY_TEST_SIZES||'S,M,L').split(',').map(s=>s.trim()).filter(Boolean)
assert.equal(testedSizes.length,3,'Use three sizes to retain the 24-file coverage check')
for(const create of [createTeeTemplate,createPantsTemplate]){
 const project=create();project.grading.sizes=testedSizes
 const original=structuredClone(project)
 const files=buildFactoryPackageFiles(project)
 assert.deepEqual(project,original,'JS factory exporter must preserve source project')
 cases.push({project});expected.push(files)
}
const run=spawnSync(binary,[],{cwd:root,input:JSON.stringify({cases}),encoding:'utf8',maxBuffer:40*1024*1024})
assert.equal(run.status,0,run.stderr)
const actual=JSON.parse(run.stdout)
for(let i=0;i<cases.length;i++){
 const js=expected[i],native=actual[i],fileNames=Object.keys(native.files)
 assert.equal(native.factoryCertified,false)
 assert.equal(native.exactContentParity,false)
 const decoded=Object.fromEntries(Object.entries(native.files).map(([name,hex])=>[name,Buffer.from(hex,'hex')]))
 assert.equal(decoded['README.txt'].toString(),encoder.decode(js['README.txt']))
 const names=Object.keys(js),common=names.filter(name=>name in decoded),nativeOnly=fileNames.filter(name=>!js[name])
 const exact=common.filter(name=>decoded[name].equals(Buffer.from(js[name])))
 const differences=common.filter(name=>!exact.includes(name))
 const missing=names.filter(name=>!decoded[name])
 const diagnostics=differences.map(name=>{const a=decoded[name],b=Buffer.from(js[name]);let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;let semanticEqual=null,semanticDifference=null;if(name.endsWith('.json')){try{const na=JSON.parse(a.toString()),jb=JSON.parse(b.toString());semanticEqual=deepSemanticEqual(na,jb);semanticDifference=firstSemanticDifference(na,jb)}catch{}}let mismatchBytes=0;for(let j=0;j<Math.max(a.length,b.length);j++)if(a[j]!==b[j])mismatchBytes++;let dxfLineDifferences=null;if(name.endsWith('.dxf')){const linesA=a.toString().split('\n'),linesB=b.toString().split('\n'),first=[];let count=0,numericUlps=0;for(let j=0;j<Math.max(linesA.length,linesB.length);j++){if(linesA[j]===linesB[j])continue;count++;const x=Number(linesA[j]),y=Number(linesB[j]);if(linesA[j]!==''&&linesB[j]!==''&&Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=Math.max(1e-12,Math.abs(y)*1e-12))numericUlps++;if(first.length<8)first.push({line:j+1,groupCode:linesB[j-1],native:linesA[j],js:linesB[j]})}dxfLineDifferences={count,linesNative:linesA.length,linesJs:linesB.length,numericNearEqual:numericUlps,first}}return {name,offset:i,nativeLength:a.length,jsLength:b.length,mismatchBytes,semanticEqual,semanticDifference,dxfLineDifferences,nativeExcerpt:a.subarray(i,i+85).toString('utf8'),jsExcerpt:b.subarray(i,i+85).toString('utf8')}})
 assert.equal(names.length,24,'fixture must exercise full S/M/L factory package')
 assert.deepEqual(missing,[],'native package must generate every file')
 assert.deepEqual(nativeOnly,[],'native package must not invent file names')
 assert.deepEqual(native.missing,[],'native missing-file metadata must be empty')
 assert.equal(native.exactContentParity,exact.length===names.length,'parity flag must reflect complete byte equality')
 const pdf=fileNames.filter(name=>name.endsWith('.pdf'))
 const svg=fileNames.filter(name=>name.endsWith('.svg'))
 assert.ok(pdf.length>=3&&svg.length>=3,'native PDF/SVG missing')
 for(const name of pdf)assert.ok(decoded[name].subarray(0,5).equals(Buffer.from('%PDF-')),name)
 for(const name of svg)assert.ok(decoded[name].toString().includes('<svg'),name)
 const zipped=zipSync(Object.fromEntries(Object.entries(decoded).map(([name,bytes])=>[name,new Uint8Array(bytes)])),{level:0})
 const unpacked=unzipSync(zipped)
 assert.deepEqual(Object.keys(unpacked).sort(),fileNames.slice().sort())
 for(const name of fileNames)assert.ok(Buffer.from(unpacked[name]).equals(decoded[name]),`ZIP round-trip: ${name}`)
 assert.deepEqual(JSON.parse(decoded['manifest.json'].toString()).files,fileNames.slice().sort())
 console.log(JSON.stringify({fixture:i?'pants':'tee',sizes:testedSizes,exactCount:exact.length,jsCount:names.length,nativeCount:fileNames.length,exactFiles:exact,differentFiles:differences,diagnostics,missingFiles:missing,nativeOnly,pdfCount:pdf.length,svgCount:svg.length,zipStoredRoundTrip:true,reportedMissing:native.missing},null,2))
}
console.log('Partial native artifact generation; full byte parity not claimed.')
