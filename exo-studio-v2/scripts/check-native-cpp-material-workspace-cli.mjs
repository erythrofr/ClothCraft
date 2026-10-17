import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {describeTextileSurface,textileRelief} from '../src/core/textileProcedurals.js'
import {CLO_MENUS} from '../src/core/cloMenus.js'
import {EXTRA_WORKSPACE_COMMANDS,indexWorkspaceCommands,searchWorkspaceCommands} from '../src/core/workspaceCommandIndex.js'
import {normalizeWorkspaceProfile,WORKSPACE_PROFILES} from '../src/core/workspaceProfiles.js'
import {physicsInputFingerprint,opticalFabricFingerprint} from '../src/core/visualOnlyChanges.js'

const binary=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const project=createTemplateProject('tee')
const commands=indexWorkspaceCommands(CLO_MENUS)
const cases=[
  ['textile-surface-describe',{fabric:project.fabrics.main}],
  ['textile-surface-relief',{family:'jersey-knit',u:.4,v:.7}],
  ['textile-map-pixels',{fabric:project.fabrics.main,resolution:4}],
  ['workspace-extra-commands',{}],
  ['workspace-index-commands',{menus:CLO_MENUS}],
  ['workspace-search-commands',{commands,query:'sew',maxResults:12}],
  ['workspace-normalize',{profile:WORKSPACE_PROFILES.sewing}],
  ['cloth-refresh-analysis',{simulation:{particles:[],constraints:[],seamConstraints:[]}}],
  ['visual-only-fingerprints',{projectJson:JSON.stringify(project)}],
]
const requests=cases.map(([op,args])=>({protocol:'garment-studio.native-cad.v1',op,args,document:project}))
const immutable=JSON.stringify(requests)
const run=spawnSync(binary,[],{input:requests.map(JSON.stringify).join('\n')+'\n',
  encoding:'utf8',maxBuffer:24*1024*1024})
if(run.error)throw run.error
assert.equal(run.status,0,run.stderr)
const results=run.stdout.trim().split('\n').map(JSON.parse)
assert.equal(results.length,cases.length)
for(let i=0;i<results.length;i++){
  assert.equal(results[i].ok,true,JSON.stringify(results[i]))
  assert.equal(results[i].op,cases[i][0])
}
assert.deepEqual(results[0].surface,describeTextileSurface(project.fabrics.main))
assert.ok(Math.abs(results[1].height-textileRelief('jersey-knit',.4,.7))<1e-12)
for(const k of ['colorPixels','normalPixels','roughnessPixels']){
  assert.equal(results[2].maps[k].length,4*4*4)
  assert.ok(results[2].maps[k].every(v=>Number.isInteger(v)&&v>=0&&v<=255))
}
assert.equal(results[2].maps.resolution,4)
assert.equal(results[2].fabricCertified,false)
assert.deepEqual(results[3].commands,EXTRA_WORKSPACE_COMMANDS)
assert.deepEqual(results[4].commands,commands)
assert.deepEqual(results[5].matches,searchWorkspaceCommands(commands,'sew',12))
assert.deepEqual(results[6].profile,normalizeWorkspaceProfile(WORKSPACE_PROFILES.sewing))
assert.equal(results[7].fitCertified,false)
assert.equal(results[7].analysis.quality.sewing.pairs,0)
assert.equal(results[8].physicsFingerprint,physicsInputFingerprint(project))
assert.equal(results[8].opticalFingerprint,opticalFabricFingerprint(project))
assert.equal(JSON.stringify(requests),immutable,'requests mutated')
console.log('Native material/workspace CLI: nine operations passed, including pixel-map bounds, JS workspace commands and optics-only physics fingerprint parity')
