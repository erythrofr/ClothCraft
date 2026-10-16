import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildFabricMarkers } from '../src/core/marker.js'
import { markerToPdf } from '../src/core/markerArtifacts.js'

const root=resolve(import.meta.dirname,'..')
const dir=mkdtempSync(join(tmpdir(),'marker-pdf-parity-'))
try {
  const binary=join(dir,'marker-pdf')
  const compile=spawnSync('c++',['-std=c++17','-O2','-I'+join(root,'native_cpp/vendor'),
    '-I'+join(root,'native_cpp/core'),join(root,'native_cpp/core/marker_pdf.cpp'),
    join(root,'native_cpp/core/cutting_geometry.cpp'),
    join(root,'native_cpp/tests/test_marker_pdf.cpp'),'-o',binary],{encoding:'utf8'})
  assert.equal(compile.status,0,compile.stderr)
  const unit=spawnSync(binary,[],{encoding:'utf8'})
  assert.equal(unit.status,0,unit.stderr)
  const project=createZipHoodieTemplate()
  const marker=Object.values(buildFabricMarkers(project))[0]
  assert.ok(marker.placements.length>0,'real marker has placements')
  const inputs=[{marker,size:'L',pageLengthCm:400},{marker:{...marker,length:805},size:'XL',pageLengthCm:400},
    {marker,size:'M',pageLengthCm:400,project}]
  for (const [i,input] of inputs.entries()) {
    const js=Buffer.from(markerToPdf(input.marker,input))
    const c=spawnSync(binary,['--json'],{input:JSON.stringify(input),encoding:null,maxBuffer:12*1024*1024})
    assert.equal(c.status,0,c.stderr?.toString())
    const native=c.stdout
    writeFileSync(join(dir,`js-${i}.pdf`),js)
    writeFileSync(join(dir,`native-${i}.pdf`),native)
    // Both PDFs use only ASCII bytes. Compare content operators, media dimensions
    // and annotation text while tolerating nonsemantic whitespace differences.
    const streams=bytes=>[...bytes.toString('ascii').matchAll(/stream\n([\s\S]*?)endstream/g)].map(m=>m[1].trim().split(/\s+/))
    const actualStreams=streams(native),expectedStreams=streams(js)
    assert.equal(actualStreams.length,expectedStreams.length,`stream count fixture ${i}`)
    for (const [page,tokens] of actualStreams.entries()) {
      assert.equal(tokens.length,expectedStreams[page].length,`stream token count ${i} page ${page}`)
      for (const [position,token] of tokens.entries()) {
        const expected=expectedStreams[page][position]
        if (/^-?\d+(\.\d+)?$/.test(token) && /^-?\d+(\.\d+)?$/.test(expected))
          assert.ok(Math.abs(Number(token)-Number(expected))<0.005,`coordinate mismatch ${i}/${page}/${position}: ${token} vs ${expected}`)
        else assert.equal(token,expected,`PDF operator mismatch ${i}/${page}/${position}`)
      }
    }
    const boxes=bytes=>[...bytes.toString('ascii').matchAll(/\/MediaBox \[([^\]]+)\]/g)].map(m=>m[1])
    assert.deepEqual(boxes(native),boxes(js),`true size MediaBoxes fixture ${i}`)
    const parse=spawnSync('python3',['-c',`
import fitz,sys,math
for filename in sys.argv[1:]:
 d=fitz.open(filename)
 assert not d.is_repaired, "xref unexpectedly repaired"
 assert len(d)==len(fitz.open(sys.argv[1]))
 for page in d:
  assert page.rect.width>0 and page.rect.height>0
  assert len(page.get_drawings())>0
 print(filename,len(d),[(round(p.rect.width,4),round(p.rect.height,4),len(p.get_drawings())) for p in d])
`,join(dir,`js-${i}.pdf`),join(dir,`native-${i}.pdf`)],{encoding:'utf8'})
    assert.equal(parse.status,0,parse.stderr)
    console.log(parse.stdout.trim())
  }
  console.log('Native marker PDF: C++ unit checks, PDF parser, rendered geometry and JS path/page parity passed')
} finally { rmSync(dir,{recursive:true,force:true}) }
