import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {CLO_MENUS} from '../src/core/cloMenus.js'
import {EXTRA_WORKSPACE_COMMANDS,indexWorkspaceCommands,searchWorkspaceCommands} from '../src/core/workspaceCommandIndex.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-command-index-')),'runner')
const compile=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/workspace_command_index.cpp','native_cpp/tests/test_workspace_command_index.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
const menus=[CLO_MENUS,[{title:'2D Pattern',commands:[['Pick','2d.pick'],['duplicate','2d.pick'],['ignored',null],['empty',''],['strange',false]]},{title:'Sewing',commands:[['Sew','sew'],['Search','workspace.view.split']]}],[]]
const indexed=menus.map(indexWorkspaceCommands)
const cases=[{op:'extra'},...menus.map(menus=>({op:'index',menus}))]
const queries=['',' ', '2d','3d','sew','fabric','workspace','view','split','3d 2d','object browser','side by side','asset','sidebar','history','camera','PATTERN','panel','xyz-none','undo redo','max 3d','free sewing','render','point','sewing inspect']
for(const commands of indexed)for(const query of queries)for(const maxResults of [0,1,3,10,30,-1,500])cases.push({op:'search',commands,query,maxResults})
const before=JSON.stringify({cases,menus,indexed})
const expected=cases.map(c=>{try{return {ok:true,result:c.op==='extra'?EXTRA_WORKSPACE_COMMANDS:c.op==='index'?indexWorkspaceCommands(c.menus):searchWorkspaceCommands(c.commands,c.query,c.maxResults)}}catch(e){return {ok:false,error:e.message}}})
assert.equal(JSON.stringify({cases,menus,indexed}),before,'JS mutated inputs')
const run=spawnSync(binary,[],{cwd:root,input:JSON.stringify({cases}),encoding:'utf8'})
assert.equal(run.status,0,run.stderr)
const actual=JSON.parse(run.stdout)
assert.equal(actual.length,cases.length)
for(let i=0;i<cases.length;i++)assert.deepEqual(actual[i],expected[i],'parity '+i+' '+JSON.stringify(cases[i]).slice(0,160))
console.log('Workspace command index JS/C++ parity passed: '+cases.length+' cases; '+indexed[0].length+' CLO commands')
