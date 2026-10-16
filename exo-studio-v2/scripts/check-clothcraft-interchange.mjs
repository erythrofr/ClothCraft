// Independent JS acceptance checks for the C++ -> ClothCraft v2 serializer.
// No Rust simulation is launched. This is a *schema/geometry candidate* test.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const source = JSON.parse(readFileSync('native_cpp/examples/sample-tee.json', 'utf8'))
const protocol = 'garment-studio.native-cad.v1'
function exportTemplate(document) {
  const result = spawnSync(cli, [], {
    encoding: 'utf8',
    input: JSON.stringify({ protocol, op: 'clothcraft-export', document }) + '\n',
    timeout: 15000,
  })
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr)
  return JSON.parse(result.stdout.trim())
}

const originalBytes = JSON.stringify(source)
const first = exportTemplate(source)
assert.equal(first.ok, true, first.error)
assert.equal(JSON.stringify(source), originalBytes, 'native export must not mutate its input')
const { template, warnings, sourcePreserved, verifiedByRust, fitAccepted } = first.interchange
assert.equal(sourcePreserved, true)
assert.equal(verifiedByRust, false)
assert.equal(fitAccepted, false)
assert.equal(template.format, 'marvelous-cloth-template')
assert.equal(template.version, 2)
assert.equal(template.panels.length, source.pieces.length)
assert.equal(template.seams.length, source.seams.length)
assert.equal(template.fabrics.length, Object.keys(source.fabrics).length)
assert.ok(warnings.some(s => s.includes('Uncalibrated')))
assert.ok(warnings.some(s => s.includes('PREVIEW ONLY')))

const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`)
const quadratic = (a, c, b, t) => (1-t)*(1-t)*a + 2*(1-t)*t*c + t*t*b
const cubic = (a, c1, c2, b, t) => (1-t)**3*a + 3*(1-t)**2*t*c1 + 3*(1-t)*t*t*c2 + t**3*b

for (const piece of source.pieces) {
  const panel = template.panels.find(p => p.id === piece.id)
  assert.ok(panel, `missing converted panel ${piece.id}`)
  const minX = Math.min(...piece.points.map(p => p.x))
  const minY = Math.min(...piece.points.map(p => p.y))
  const expectedWidth = (Math.max(...piece.points.map(p => p.x)) - minX)/100
  const expectedHeight = (Math.max(...piece.points.map(p => p.y)) - minY)/100
  close(panel.pattern.width, expectedWidth)
  close(panel.pattern.height, expectedHeight)
  assert.equal(panel.polygon.edges.length, piece.points.length)
  assert.equal(panel.polygon.points.length, piece.points.length)
  for (let i=0;i<piece.points.length;i++) {
    const point=panel.polygon.points[i]
    close(point[0], (piece.points[i].x-minX)/100)
    close(point[1], (piece.points[i].y-minY)/100)
    assert.equal(panel.polygon.edges[i], `edge_${i}`)
  }
  for (const [key, control] of Object.entries(piece.curves ?? {})) {
    const i=Number(key), next=(i+1)%piece.points.length
    const a=piece.points[i],b=piece.points[next]
    const [c1,c2]=panel.polygon.curves[`edge_${i}`]
    for (const t of [0,0.125,0.25,0.5,0.75,0.9,1]) {
      close(cubic((a.x-minX)/100,c1[0],c2[0],(b.x-minX)/100,t), (quadratic(a.x,control.cx,b.x,t)-minX)/100)
      close(cubic((a.y-minY)/100,c1[1],c2[1],(b.y-minY)/100,t), (quadratic(a.y,control.cy,b.y,t)-minY)/100)
    }
  }
}
for (const seam of source.seams) {
  const transferred=template.seams.find(s => s.id === seam.id)
  assert.ok(transferred)
  assert.equal(transferred.a.panel,seam.a.pieceId)
  assert.equal(transferred.a.edge,`edge_${seam.a.edgeIndex}`)
  assert.equal(transferred.b.edge,`edge_${seam.b.edgeIndex}`)
  assert.equal(transferred.reverse_b,seam.reverseB)
}

const second=exportTemplate(source)
assert.deepEqual(second,first,'export should be deterministic')
const negative=structuredClone(source)
negative.units='mm'
assert.equal(exportTemplate(negative).ok,false,'wrong source units must be rejected')
negative.units='cm'
negative.pieces[0].points.reverse()
assert.equal(exportTemplate(negative).ok,false,'winding mismatch must be rejected rather than reversing seam identities')
const missingFabric=structuredClone(source)
missingFabric.pieces[0].fabricId='not-present'
assert.equal(exportTemplate(missingFabric).ok,false,'missing material must be rejected')
const zeroSeam=structuredClone(source)
zeroSeam.seams[0].a.startT=0.4
zeroSeam.seams[0].a.endT=0.4
assert.equal(exportTemplate(zeroSeam).ok,false,'degenerate seam span must be rejected')

console.log(JSON.stringify({pass:true, native:'C++17', target:'ClothCraft v2 JSON',
  panels:template.panels.length,seams:template.seams.length,
  curves:source.pieces.reduce((n,p)=>n+Object.keys(p.curves||{}).length,0),
  warnings:warnings.length, rustValidated:false, fitAccepted:false}))
