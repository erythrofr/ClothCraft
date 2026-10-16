// Prepare the exact upstream Codim-IPC dress/stitch reference for an isolated,
// READ-ONLY viewer in the current Garment Studio 3D workspace. Never edits
// source OBJ, the PPF session, user's 2D project, or solver coefficients.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const report = JSON.parse(fs.readFileSync(path.join(root, 'logs/ppf-upstream-fitting-full-20261014.json'), 'utf8'))
const audit = JSON.parse(fs.readFileSync(path.join(root, 'logs/ppf-upstream-full-audit-20261014.json'), 'utf8'))
const session = path.resolve(report.sessionPath)
const source = path.join(root, 'research/oss/Codim-IPC/Projects/FEMShell/input/dress_knife/stage.obj')
const output = path.join(root, 'public/references/zozo-dress')
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

if (!report.ok || !audit.completeNativeTrajectory || audit.framesAudited !== 241 || audit.encodedStitches !== 851) {
  throw Error('The original upstream PPF reference and independent audit must both be complete')
}
if (!fs.existsSync(source) || !fs.existsSync(path.join(session, 'bin/tri.bin'))) throw Error('Original dress assets are missing')
const raw = fs.readFileSync(source, 'utf8').split(/\r?\n/)
const panelNames = []
const objCounts = { vertices: 0, faces: 0, stitches: 0 }
for (const line of raw) {
  if (line.startsWith('v ')) objCounts.vertices++
  if (line.startsWith('g ')) { panelNames.push(line.slice(2).trim()) }
  if (line.startsWith('f ')) objCounts.faces++
  if (line.startsWith('stitch ')) objCounts.stitches++
}
if (panelNames.length !== 14 || objCounts.vertices !== 15656 || objCounts.faces !== 29456 || objCounts.stitches !== 851) {
  throw Error(`Unexpected original upstream dress topology: ${JSON.stringify({ panelNames, objCounts })}`)
}

const verticesBin = fs.readFileSync(path.join(session,'bin/vert.bin'))
const indicesBin = fs.readFileSync(path.join(session,'bin/tri.bin'))
const pinnedBin = fs.readFileSync(path.join(session,'bin/pin-ind-0.bin'))
if (verticesBin.length % 24 || indicesBin.length % 24 || pinnedBin.length % 8) throw Error('Native binary topology invalid')
const vertexCount = verticesBin.length / 24
const faceCount = indicesBin.length / 24
const bodyVertices = new Set()
for (let i = 0; i < pinnedBin.length; i+=8) bodyVertices.add(Number(pinnedBin.readBigUInt64LE(i)))
if (vertexCount !== 28467 || pinnedBin.length / 8 !== 12811 || faceCount !== 54928) throw Error('Unexpected native solver mesh sizes')
const faceGroups = Array.from({length:14},()=>[])
const clothTriangles = []
const bodyTriangles = []
for (let i=0; i<faceCount; i++) {
  const triplet=[0,1,2].map(j=>Number(indicesBin.readBigUInt64LE(i*24+j*8)))
  const isBody=triplet.every(id=>bodyVertices.has(id))
  const mixed=triplet.some(id=>bodyVertices.has(id))
  if (mixed&&!isBody) throw Error('Unexpected body/cloth mixed face')
  if (isBody) bodyTriangles.push(...triplet)
  else clothTriangles.push(...triplet)
}
if (clothTriangles.length !== audit.clothTriangles*3 || bodyTriangles.length !== audit.bodyTriangles*3) throw Error('Solver scene does not match independent mesh audit')

// Reuse source OBJ vertex IDs to map *exact* 14 panel boundaries onto native
// cloth topology. The two sources use the same 15,656 cloth vertex positions,
// but the solver may reorder triangles, so mapping by the OBJ ordered source
// face sequence is unsafe. For the viewer, keep the solver's native triangles
// and the original panel membership keyed by their vertex triplet.
// PPF rotates the dress -90° about X and reindexes vertices in its mesh
// loader. Reconstruct a one-to-one mapping by the actual transformed source
// 3D positions (quantized 1e-6 m); do not assume the source order is retained.
const sourceVertices=[]
for (const line of raw) {
  if (!line.startsWith('v ')) continue
  const [x,y,z]=line.slice(2).trim().split(/\s+/).map(Number)
  sourceVertices.push([x,z,-y])
}
// Build an exact near-neighbor bucket index. Decimal source positions and
// double-precision native rotations can straddle quantization boundaries;
// search the 27 adjacent micrometre buckets and confirm Euclidean distance.
const keyPosition = p => p.map(x=>Math.floor(x*1e6)).join(':')
const nativePositions=[]
const nativeByPosition=new Map()
for (let i=0;i<objCounts.vertices;i++) {
  const nativePosition=[0,1,2].map(j=>verticesBin.readDoubleLE((i*3+j)*8))
  nativePositions.push(nativePosition)
  const key=keyPosition(nativePosition)
  if (!nativeByPosition.has(key)) nativeByPosition.set(key,[])
  nativeByPosition.get(key).push(i)
}
const sourceToNative=new Map()
const alreadyAssigned=new Set()
for (let i=0;i<sourceVertices.length;i++) {
  const original=sourceVertices[i]
  const bins=original.map(x=>Math.floor(x*1e6))
  let found=null, smallest=Infinity
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
    const key=`${bins[0]+x}:${bins[1]+y}:${bins[2]+z}`
    for(const index of nativeByPosition.get(key)||[]) {
      if(alreadyAssigned.has(index))continue
      const distance=Math.hypot(...original.map((q,j)=>q-nativePositions[index][j]))
      if(distance<1e-8 && distance<smallest) {found=index;smallest=distance}
    }
  }
  if (found===null) throw Error(`Source/PPF rotated cloth vertex mapping missing at ${i}`)
  sourceToNative.set(i,found)
  alreadyAssigned.add(found)
}
if (sourceToNative.size!==objCounts.vertices) throw Error('Incomplete source-to-native vertex mapping')
const facePanelByKey=new Map()
let groupIndex=-1
let sourceFaces=0
for (const line of raw) {
  if (line.startsWith('g ')) groupIndex++
  if (!line.startsWith('f ')) continue
  const ids=line.slice(2).trim().split(/\s+/).map(s=>sourceToNative.get(Number(s.split('/')[0])-1))
  if (ids.length!==3 || ids.some(id=>id<0||id>=objCounts.vertices)) throw Error('Bad OBJ face')
  facePanelByKey.set([...ids].sort((a,b)=>a-b).join(':'), groupIndex)
  sourceFaces++
}
if (sourceFaces !== objCounts.faces) throw Error('OBJ source face count mismatch')
for (let i=0;i<clothTriangles.length;i+=3) {
  const t=clothTriangles.slice(i,i+3)
  const key=[...t].sort((a,b)=>a-b).join(':')
  const group=facePanelByKey.get(key)
  if (!Number.isInteger(group)||group<0||group>=14) throw Error(`Native/source panel correspondence mismatch at face ${i/3}`)
  faceGroups[group].push(...t)
}

const frames = audit.framesAudited
const outputFrames=Buffer.allocUnsafe(frames*vertexCount*3*4)
for (let frame=0;frame<frames;frame++) {
  const input=path.join(session,'output',`vert_${frame}.bin`)
  const bytes=fs.readFileSync(input)
  if (bytes.length !== vertexCount*3*4) throw Error(`Invalid saved solver frame ${frame}`)
  bytes.copy(outputFrames,frame*bytes.length)
}
const header=Buffer.alloc(28)
header.write('GSDRESS1',0,'ascii')
header.writeUInt32LE(1,8)
header.writeUInt32LE(vertexCount,12)
header.writeUInt32LE(frames,16)
header.writeUInt32LE(60,20)
header.writeUInt32LE(bodyVertices.size,24)
fs.mkdirSync(output,{recursive:true})
fs.writeFileSync(path.join(output,'frames.bin'), Buffer.concat([header,outputFrames]))
const meshes={clothPanels:faceGroups.map((triangles,i)=>({id:panelNames[i],indices:triangles})),bodyIndices:bodyTriangles}
fs.writeFileSync(path.join(output,'meshes.json'), JSON.stringify(meshes))

// We intentionally do not mark this simulation accepted. The native audit
// includes real body intersections at three frames and is not swept-CCD safe.
const metadata={format:'garment-studio.zozo-reference-dress.v1',
  name:'ZOZO PPF GitHub · Original Dress',
  sourceRepository:'https://github.com/st-tech/ppf-contact-solver',
  notebook:'examples/fitting.ipynb',
  sourceDress:'ipc-sim/Codim-IPC Projects/FEMShell/input/dress_knife/stage.obj',
  originalObjSha256:sha256(source),
  originalSession:report.sessionName,
  frames,frameRate:60,vertexCount,clothVertices:objCounts.vertices,bodyVertices:bodyVertices.size,
  clothTriangles:audit.clothTriangles,bodyTriangles:audit.bodyTriangles,
  panelNames,stitchConstraints:audit.encodedStitches,
  sourceUnits:'meters',sourceAxes:'x/y-up/z',
  accepted:false,experimental:true,
  fullPhysicalFitVerified:false,sweptCCDVerified:false,
  maxBodyIntersectionPairs:audit.maxBodyCrossings,
  failedFrames:audit.perFrame.filter(f=>f.bodyCrossings>0).map(f=>({frame:f.frame,pairs:f.bodyCrossings})),
  finalMeanSeamGapCm:audit.finalMeanSeamGapCm,
  finalMaxSeamGapCm:audit.finalMaxSeamGapCm,
  maxPrincipalStretch:audit.maxPrincipalStretch,
  audits:audit.perFrame.map(({frame,bodyCrossings,clothSelfCrossings,maxPrincipalStretch,meanSeamGapCm,maxSeamGapCm})=>({frame,bodyCrossings,clothSelfCrossings,maxPrincipalStretch,meanSeamGapCm,maxSeamGapCm})),
  warning:'Original Rust/Metal example: real simulated cloth with known body intersections. Read-only reference, NOT a certified CLO-level fitted garment.'}
fs.writeFileSync(path.join(output,'manifest.json'), JSON.stringify(metadata,null,2)+'\n')
console.log(JSON.stringify({output,frames,vertexCount,panels:faceGroups.length,stitchConstraints:metadata.stitchConstraints,failedFrames:metadata.failedFrames,assetMegabytes:Math.round((header.length+outputFrames.length)/1e6)},null,2))
