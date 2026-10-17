import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {WORKSPACE_PROFILE_KEY,WORKSPACE_VIEW_KEY,VIEWPORT_LAYOUTS,WORKSPACE_PROFILES,normalizeWorkspaceProfile} from '../src/core/workspaceProfiles.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-workspace-profile-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/workspace_profiles.cpp','native_cpp/tests/test_workspace_profiles.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const cases=[{},null,false,true,[],42,'drafting',...Object.values(WORKSPACE_PROFILES)]
for(const key of ['section','tab','tool','viewportTool','viewportLayout']){
 const values={
  section:['Pattern','Sewing','Fabric','Avatar','Fit','Production','Render','wrong','pattern',null,42],
  tab:['Scene','Fabric','Graphic','Button','Buttonhole','Topstitch','Puckering','Trim','Grading','POM','wrong',null],
  tool:['select','point','split','curve','internal','pin','notch','sew','fastener','measure','wrong',null],
  viewportTool:['transform','orbit','move','rotate','hand','wrong',null],
  viewportLayout:['split','stack','3d','2d','wrong',null,42]
 }[key]
 for(const value of values)cases.push({[key]:value})
}
for(const key of ['libraryWidth','inspectorWidth','objectBrowserHeight','viewportSplit']){
 for(const value of [-900,0,15,20,80,150,170,240,350,500,900,null,'','  ','245','oops',false,true,[],[42],{}])cases.push({[key]:value})
}
for(const key of ['objectBrowserVisible','topTabsVisible','libraryVisible','inspectorVisible']){
 for(const value of [false,true,0,1,null,'false','',[],{}])cases.push({[key]:value})
}
for(const value of ['short','x'.repeat(90),99,null,''])cases.push({name:value})
for(const [profile,settings] of Object.entries(WORKSPACE_PROFILES))for(const layout of Object.keys(VIEWPORT_LAYOUTS))cases.push({...settings,name:profile,viewportLayout:layout})
const before=JSON.stringify(cases)
const js=cases.map(value=>{try{return {ok:true,result:normalizeWorkspaceProfile(value)}}catch(error){return {ok:false,error:error.message}}})
assert.equal(JSON.stringify(cases),before,'JS mutated fixtures')
const native=spawnSync(binary,[],{input:JSON.stringify({cases}),cwd:root,encoding:'utf8'})
assert.equal(native.status,0,native.stderr)
const cpp=JSON.parse(native.stdout)
assert.deepEqual(cpp.constants,{WORKSPACE_PROFILE_KEY,WORKSPACE_VIEW_KEY,VIEWPORT_LAYOUTS,WORKSPACE_PROFILES})
assert.equal(cpp.results.length,cases.length)
for(let i=0;i<cases.length;i++)assert.deepEqual(cpp.results[i],js[i],'workspace profile case '+i)
console.log('Workspace profiles JS/C++ parity passed: '+cases.length+' normalization cases plus 4 exact export constants')
