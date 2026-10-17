import assert from 'node:assert/strict'
import {CLO_DRAFT_FIELDS,resolveCloDraftTarget,validateCloDraftProperty,applyCloDraftProperty} from '../../src/core/cloPropertyCommands.js'

const garment={pieces:[{id:'front',name:'Front',points:[{x:0,y:0},{x:30,y:0},{x:30,y:30},{x:0,y:30}],fabricId:'main',grainAngleDeg:0,seamAllowance:1,buttons:[{id:'b1',x:4,y:5,diameterCm:1.8,holes:4,color:'#eeeeee'}],buttonholes:[{id:'bh1',x:4,y:5,lengthCm:1.9,widthCm:0.2,orientationDeg:0,color:'#dddddd'}],topstitches:[{id:'st1',edgeIndex:1,stitchLengthMm:3,offsetCm:0.5,rows:2,rowGapCm:0.3,color:'#666666'}],graphics:[{id:'g1',name:'Logo',widthCm:10,heightCm:8,x:3,y:4,rotationDeg:0,opacity:1}]}],fabrics:{main:{id:'main',name:'Canvas',gsm:400,thickness:0.002,color:'#ffffff',stretchWarp:.05,stretchWeft:.12,bend:.5,friction:.5,roughness:.9}},seams:[]}
const front={type:'pattern',id:'front',pieceId:'front'}
const material={type:'fabric',id:'main'}
const button={type:'button',id:'front-b1',pieceId:'front',itemId:'b1'}
const buttonhole={type:'buttonhole',id:'front-bh1',pieceId:'front',itemId:'bh1'}
const topstitch={type:'topstitch',id:'front-st1',pieceId:'front',itemId:'st1'}
const graphic={type:'graphic',id:'g1',pieceId:'front',itemId:'g1'}
assert(Object.hasOwn(CLO_DRAFT_FIELDS,'fabric')&&Object.hasOwn(CLO_DRAFT_FIELDS,'topstitch'))
const original=structuredClone(garment)
for(const change of [
 [front,'grainAngleDeg',37],[front,'seamAllowance',2.4],[front,'fabricId','main'],
 [material,'gsm',430],[material,'thickness',0.0032],[material,'color','#334455'],
 [material,'itemNo','FAB-014'],[material,'construction','French Terry'],[material,'supplier','Mill Sample'],[material,'owner','Designer'],
 [button,'diameterCm',2.2],[button,'x',8],[button,'holes',2],
 [buttonhole,'lengthCm',2.5],[buttonhole,'orientationDeg',45],
 [topstitch,'stitchLengthMm',2.5],[topstitch,'rows',3],[graphic,'opacity',0.5],[graphic,'widthCm',13],
]){
 const result=applyCloDraftProperty(garment,...change)
 assert(result.ok,JSON.stringify([change,result]))
 assert.equal(resolveCloDraftTarget(garment,change[0])[change[1]],change[2])
}
const saved=structuredClone(garment)
const negatives=[
 [front,'unknown',5],[front,'grainAngleDeg',Infinity],[front,'seamAllowance',-1],[front,'fabricId','missing'],
 [material,'thickness',0],[material,'color','#nothex'],[material,'gsm',-30],[material,'supplier','x'.repeat(129)],
 [button,'holes',1.5],[buttonhole,'lengthCm',-1],
 [topstitch,'stitchLengthMm',0],[topstitch,'edgeIndex',9999],
 [graphic,'opacity',1.01],[{...button,itemId:'does-not-exist'},'diameterCm',2.1],
]
for(const change of negatives){const result=applyCloDraftProperty(garment,...change);assert.equal(result.ok,false,JSON.stringify(change));assert.deepEqual(garment,saved,'invalid change mutated saved garment')}
assert.deepEqual(original.pieces[0].points,garment.pieces[0].points)
assert.deepEqual(original.seams,garment.seams)
assert.equal(validateCloDraftProperty(garment,topstitch,'stitchLengthMm',2.6).ok,true)
console.log('CLO property typed pattern/fabric/button/buttonhole/topstitch/graphic mutations, bounds and isolation PASS')
