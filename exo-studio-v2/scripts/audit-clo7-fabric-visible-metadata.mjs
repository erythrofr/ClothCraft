/**
 * Read-only audit of human-readable CLO .zfab metadata fields from files
 * ALREADY installed on this Mac. Does not decode the proprietary simulation
 * data payload, export bitmaps, modify CLO, or populate EXO fabric coefficients.
 *
 * Run: node scripts/audit-clo7-fabric-visible-metadata.mjs
 * Local source metadata is an inspection reference, NOT a redistribution
 * license, independent proof of laboratory testing, or CLO SDK export.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'

const ROOTS=[
 {kind:'user-local',root:path.join(os.homedir(),'Documents/clo/Assets/Materials/Fabric')},
 {kind:'app-bundled',root:'/Applications/CLO_Standalone_OnlineAuth.app/Contents/Resources/Preset'},
]
function walk(dir,list=[]){
 if(!fs.existsSync(dir))return list
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const item=path.join(dir,ent.name)
  if(ent.isDirectory())walk(item,list)
  else if(ent.isFile()&&ent.name.toLowerCase().endsWith('.zfab'))list.push(item)
 }
 return list
}
function metadata(pathname){
 const fd=fs.openSync(pathname,'r')
 let buffer
 try{
  buffer=Buffer.allocUnsafe(16384)
  const bytes=fs.readSync(fd,buffer,0,buffer.length,0)
  buffer=buffer.subarray(0,bytes)
 }finally{fs.closeSync(fd)}
 const text=buffer.toString('latin1')
 const pieces=text.match(/[ -~]{3,}/g)||[]
 const keyIndex=(label)=>pieces.findIndex(v=>v.trim().replace(/[^a-z]/ig,'').toLowerCase()===label.toLowerCase())
 const next=(label)=>{
  const index=keyIndex(label)
  return index>=0&&index+1<pieces.length?pieces[index+1].trim():null
 }
 const mass=next('Weight')
 const thickness=next('Thickness')
 const hasHeader=text.slice(0,22).includes('FAB')&&text.slice(0,22).includes('CLO')
 const extract=(value,unit)=>value&&new RegExp('^([0-9]+(?:\\.[0-9]+)?)\\s*'+unit+'(?:$|\\s)','i').test(value)
  ?Number(value.match(/[0-9]+(?:\.[0-9]+)?/)[0]):null
 return {
  containerSignature:hasHeader?'CLO FAB':'unrecognized',
  classification:next('Classification'),
  colorCode:next('ColorCode'),
  fiberContent:next('Content'),
  thicknessMm:extract(thickness,'mm'),
  massGsm:extract(mass,'g\\/m2'),
  hasTextureReference:next('Texture')!=null&&next('Texture')!=='None',
  observedKeys:['Classification','Color','ColorCode','Content','Texture','Thickness','Weight'].filter(k=>keyIndex(k)!==-1),
  rawThicknessString:thickness,
  rawMassString:mass,
 }
}
if(process.argv[2]==='--sample'){
 const info=metadata(process.argv[3])
 console.log(JSON.stringify(info))
 process.exit(0)
}
const fabrics=[]
const inaccessible=[]
for(const {kind,root} of ROOTS){
 for(const location of walk(root)){
  const stat=fs.statSync(location)
  // User-local CLO files can be iCloud placeholders. Read each sample in
  // a bounded subprocess so an unavailable file cannot block the catalog.
  const child=spawnSync(process.execPath,[process.argv[1],'--sample',location],
    {encoding:'utf8',timeout:850,maxBuffer:32768})
  let entry
  if(child.status===0){
   try{entry=JSON.parse(child.stdout.trim())}catch{}
  }
  if(!entry){
   inaccessible.push({source:kind,filename:path.basename(location),
     reason:child.error?.code==='ETIMEDOUT'?'timed out reading local file':'not parseable'})
   entry={containerSignature:'unavailable',classification:null,
     colorCode:null,fiberContent:null,thicknessMm:null,massGsm:null,
     hasTextureReference:false,observedKeys:[],rawThicknessString:null,rawMassString:null}
  }
  fabrics.push({source:kind,filename:path.basename(location),relativeRootPath:path.relative(root,location),
    sizeBytes:stat.size,...entry})
 }
}
assert.ok(fabrics.length>0,'No readable CLO fabric references present')
const summaries={}
for(const entry of fabrics) {
 summaries[entry.source]??={files:0,readableHeader:0,weightAndThickness:0}
 summaries[entry.source].files++
 if(entry.containerSignature==='CLO FAB')summaries[entry.source].readableHeader++
 if(entry.massGsm!=null&&entry.thicknessMm!=null)summaries[entry.source].weightAndThickness++
}
const report={
  schemaVersion:1,
  auditDate:'2026-10-16',
  sourceScope:'local installed CLO 7.0.242 native .zfab file metadata, not full in-app library',
  excludes:'proprietary maps, binary constitutive coefficients, encrypted data, live Property Editor, CLO cloud content',
  licenseCaution:'Reference-only local inspection. Do not copy the proprietary CLO source files or its curves into EXO.',
  summary:summaries,
  unavailableFiles:inaccessible,
  fabrics:fabrics.sort((a,b)=>a.source.localeCompare(b.source)||a.filename.localeCompare(b.filename)),
}
fs.mkdirSync('docs/reports',{recursive:true})
fs.writeFileSync('docs/reports/EXO_CLO7_INSTALLED_FABRIC_METADATA.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({pass:true,localZfabFiles:fabrics.length,source:summaries,
  contentPresent:fabrics.filter(f=>f.fiberContent).length,
  numericWeightAndThickness:fabrics.filter(f=>f.massGsm!=null&&f.thicknessMm!=null).length,
  unavailableFiles:inaccessible.length,sourceFilesUnchanged:true,proprietaryMapsNotExported:true},null,2))
