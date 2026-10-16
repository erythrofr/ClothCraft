import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {parseSeamlyMeasurements,applySeamlyMeasurements,SEAMLY_AVATAR_FIELDS} from '../src/core/seamlyMeasurements.js'
import {parseSeamlyConstructionReference} from '../src/core/seamlyConstructionReference.js'
const cases=[{op:'fields'}]
for(const unit of ['cm','mm','inch','in'])for(const kind of ['smis','smms']){
 const size=kind==='smms'?'<size base="40"/><height base="170"/>':''
 const value=kind==='smms'?'base="85" size_increase="-1.5" height_increase="2"':'value="85"'
 cases.push({op:'measure',filename:'échantillon.'+kind,xml:`<${kind}><unit>${unit}</unit><notes>Été &amp; été</notes>${size}<body-measurements><m name="bust_circ" ${value} description="Poitrine"/><m name="height" ${kind==='smms'?'base':'value'}="175"/></body-measurements></${kind}>`})
}
for(const xml of ['<smis><unit>cm</unit><body-measurements><m name="height" value="170"/><m name="height" value="180"/></body-measurements></smis>',
'<smis><unit>unknown</unit><body-measurements><m name="height" value="170"/></body-measurements></smis>',
'<smis><unit>cm</unit><body-measurements><m name="bad name" value="170"/></body-measurements></smis>',
'<smis><unit>cm</unit><body-measurements><m name="height" value="x+5"/></body-measurements></smis>',
'<!DOCTYPE smis><smis/>','<pattern/>'])
 cases.push({op:'measure',xml})
const construction=`<pattern><version>1.0</version><unit>cm</unit><description>Épure</description><measurements>tee.smis</measurements><increments><increment name="#waist" formula="80" description="Tour"/></increments><draftBlock name="Front"><calculation><point id="1" type="single" name="A" x="0" y="0"/><point id="2" type="alongLine" firstPoint="1" formula="#waist+2"/></calculation><details><detail id="x"/></details></draftBlock><draw name="Back"><calculation><point id="3" type="single"/><spline id="4" type="spline" firstPoint="3" formula="#unknown"/></calculation></draw></pattern>`
cases.push({op:'construction',xml:construction,filename:'Modèle.sm2d'})
cases.push({op:'construction',xml:'<pattern><version>1</version><unit>cm</unit><draftBlock><calculation><point id="1"/><point id="1"/></calculation></draftBlock></pattern>'})
cases.push({op:'construction',xml:'<pattern><version>1</version><unit>cm</unit><draftBlock/><draw/></pattern>'})
cases.push({op:'construction',xml:'<pattern><version>1</version><unit>m</unit><draftBlock/></pattern>'})
cases.push({op:'apply',project:{id:'p',avatar:{chestCm:80},pieces:[{id:'f'}]},library:parseSeamlyMeasurements('<smis><unit>cm</unit><body-measurements><m name="height" value="173"/><m name="bust_circ" value="95"/></body-measurements></smis>'),applyToAvatar:true})
cases.push({op:'apply',project:{id:'p'},library:{format:'invalid'}})
const exe=spawnSync(process.env.GARMENT_SEAMLY_TEST||'/tmp/garment-native-seamly-test',['--json-lines'],{input:cases.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024})
if(exe.error)throw exe.error
assert.equal(exe.status,0,exe.stderr)
const outputs=exe.stdout.trim().split('\n')
assert.equal(outputs.length,cases.length)
let match=0,errors=0
for(let i=0;i<cases.length;i++){
 const c=cases[i],native=JSON.parse(outputs[i]);let expected,failed=false
 try{expected=c.op==='fields'?SEAMLY_AVATAR_FIELDS:c.op==='measure'?parseSeamlyMeasurements(c.xml,{filename:c.filename||''}):c.op==='construction'?parseSeamlyConstructionReference(c.xml,{filename:c.filename||''}):applySeamlyMeasurements(c.project,c.library,{applyToAvatar:c.applyToAvatar})}
 catch{failed=true}
 assert.equal(native.ok,!failed,`case ${i}: ${native.error||''}`)
 if(failed){errors++;continue}
 assert.deepEqual(native.result,expected,`case ${i}`);match++
}
console.log(`Seamly JS/C++ parity passed: ${match} successful outputs, ${errors} matching rejections`)
