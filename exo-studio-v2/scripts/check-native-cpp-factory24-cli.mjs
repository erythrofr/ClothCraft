import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {unzipSync} from 'fflate'
import {createTeeTemplate,createPantsTemplate} from '../src/data/templates.js'
import {buildFactoryPackageFiles} from '../src/core/factoryPackage.js'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const jsonCodec=new TextDecoder()
function cli(project,op,args={}){
  const request={protocol:'garment-studio.native-cad.v1',
    document:project,op,args}
  const run=spawnSync(binary,[],{input:JSON.stringify(request)+'\n',
    encoding:'utf8',maxBuffer:128*1024*1024})
  if(run.error)throw run.error
  assert.equal(run.status,0,run.stderr)
  return JSON.parse(run.stdout.trim())
}

for(const [name,create] of [['tee',createTeeTemplate],['pants',createPantsTemplate]]){
  const project=create()
  project.grading.sizes=['S','M','L']
  const original=JSON.stringify(project)
  const options={projectJson:original}
  const summary=cli(project,'factory-full-development-summary',options)
  assert.equal(summary.ok,true,summary.error)
  assert.equal(summary.factoryCertified,false)
  assert.equal(summary.exactContentParity,false)
  assert.equal(summary.fileCount,24)
  assert.deepEqual(summary.missing,[])
  assert.equal(summary.files.length,24)
  assert.ok(!summary.zipBase64,'summary should not transmit full factory ZIP')

  const bundle=cli(project,'export-factory-full-development-zip',options)
  assert.equal(bundle.ok,true,bundle.error)
  assert.equal(bundle.factoryCertified,false)
  assert.equal(bundle.exactContentParity,false)
  assert.equal(bundle.fileCount,24)
  const archive=Buffer.from(bundle.zipBase64,'base64')
  assert.equal(archive.byteLength,bundle.byteCount)
  const extracted=unzipSync(new Uint8Array(archive))
  const expected=buildFactoryPackageFiles(project)
  const paths=Object.keys(extracted).sort()
  assert.deepEqual(paths,Object.keys(expected).sort(),'factory ZIP file inventory must match JS')
  assert.deepEqual(bundle.files.map(x=>x.path).sort(),paths)
  const exact=paths.filter(p=>Buffer.from(extracted[p]).equals(Buffer.from(expected[p])))
  for(const entry of bundle.files)
    assert.equal(extracted[entry.path].byteLength,entry.bytes,
      entry.path+' reported size mismatch')
  for(const file of paths.filter(p=>p.endsWith('.pdf')))
    assert.equal(jsonCodec.decode(extracted[file].subarray(0,5)),'%PDF-')
  for(const file of paths.filter(p=>p.endsWith('.svg')))
    assert.match(jsonCodec.decode(extracted[file]),/<svg/)
  assert.ok(exact.length>=16,'regression: prior tee/pants byte-parity floor')
  assert.equal(JSON.stringify(project),original,'authored project mutated')
  console.log(JSON.stringify({template:name,files:paths.length,
    exactJsByteFiles:exact.length,unmatched:paths.length-exact.length,
    zipBytes:archive.length,factoryCertified:false,exactContentParity:false}))
}
console.log('Native C++ CLI ZIP packaging produces all 24 requested factory artifacts with verified extraction and conservative certification flags')
