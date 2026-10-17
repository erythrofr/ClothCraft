import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const request=(document,op,args={})=>({protocol:'garment-studio.native-cad.v1',document,op,args})
function native(document,op,args={}){
 const proc=spawnSync(binary,[],{input:JSON.stringify(request(document,op,args))+'\n',
   encoding:'utf8',maxBuffer:64*1024*1024})
 if(proc.error)throw proc.error
 assert.equal(proc.status,0,proc.stderr)
 const out=JSON.parse(proc.stdout.trim())
 assert.equal(out.ok,true,out.error||JSON.stringify(out).slice(0,200))
 assert.equal(out.op,op)
 return out
}
for(const kind of ['tee','pants']){
 const document=createTemplateProject(kind)
 const before=JSON.stringify(document)
 const js=buildSimulation(document)
 const assembled=native(document,'cloth-assembled-snapshot').snapshot
 assert.equal(assembled.fullSolverParity,false)
 const jsPieces=[...js.pieces.values()]
 const faces=jsPieces.reduce((n,p)=>n+p.faces.length,0)
 const particles=jsPieces.reduce((n,p)=>n+p.particles.length,0)
 assert.equal(assembled.faceCount,faces)
 assert.equal(assembled.particleCount,particles)
 const physical=js.clothConstraints.filter(c=>c.type!=='seam-virtual')
 assert.equal(assembled.clothConstraints.length,physical.length)
 const sewn=js.seamConstraints.filter(c=>c.type==='seam'||c.type==='seam-virtual')
 assert.equal(assembled.seamConstraints.length,sewn.length)
 assert.equal(assembled.anchorConstraints.length,js.anchorConstraints.length)
 let i=0,maxError=0
 for(const piece of jsPieces){
  for(const particle of piece.particles){
   const actual=assembled.particles[i++].position
   maxError=Math.max(maxError,Math.hypot(actual[0]-particle.position.x,
     actual[1]-particle.position.y,actual[2]-particle.position.z))
  }
 }
 assert.ok(maxError<1e-9,`bad initial garment placement: ${maxError}`)
 assert.ok(assembled.unported.length>0,'remaining solver limitations must be explicit')

 const first=jsPieces[0]
 const piece={flatVertices:first.flatVertices.map(p=>({x:p.x,y:p.y})),
   faces:first.faces,particles:first.particles.map(p=>({
     position:{x:p.position.x,y:p.position.y,z:p.position.z},
     strain:p.strain||0,easeCm:p.easeCm||0,pressureIndex:p.pressureIndex||0,
   }))}
 const geometry=native(document,'geometry-buffer-create',{piece}).geometry
 assert.equal(geometry.index.length,first.faces.length*3)
 assert.equal(geometry.attributes.position.count,first.particles.length)
 assert.equal(native(document,'geometry-buffer-sync',{piece,geometry}).update.updated,true)
 assert.equal(native(document,'geometry-buffer-uv',
   {piece,geometry,fabric:document.fabrics.main}).update.updated,true)
 assert.equal(native(document,'geometry-buffer-analysis-colors',
   {piece,geometry,mode:'strain'}).update.updated,true)
 assert.equal(JSON.stringify(document),before,'project mutated')
 console.log(`Native CLI ${kind} assembled ${faces} faces / ${physical.length} physical / ${sewn.length} sewn / ${particles} particles; worst initial delta ${maxError}m`)
}
