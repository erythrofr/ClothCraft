import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {CLO_MENUS} from '../src/core/cloMenus.js'
import {indexWorkspaceCommands,searchWorkspaceCommands} from '../src/core/workspaceCommandIndex.js'

const bin=resolve(mkdtempSync(resolve(tmpdir(),'gs-clo-menu-parity-')),'runner')
const build=spawnSync('c++',['-std=c++17','-O1','-I','native_cpp/vendor',
  '-I','native_cpp/core','native_cpp/core/clo_menus.cpp',
  'native_cpp/core/workspace_command_index.cpp',
  'native_cpp/tests/test_clo_menus.cpp','-o',bin],{encoding:'utf8'})
assert.equal(build.status,0,build.stderr)
const exec=spawnSync(bin,['--json'],{encoding:'utf8'})
assert.equal(exec.status,0,exec.stderr)
const actual=JSON.parse(exec.stdout)
assert.deepEqual(actual,CLO_MENUS)
const nativeCommands=indexWorkspaceCommands(actual)
const sourceCommands=indexWorkspaceCommands(CLO_MENUS)
assert.deepEqual(nativeCommands,sourceCommands)
for(const q of ['sew','3D','fabric','workspace','pattern','render']) {
  assert.deepEqual(searchWorkspaceCommands(nativeCommands,q,10),
    searchWorkspaceCommands(sourceCommands,q,10))
}
console.log('Native CLO menu constant matches JS: 14 menus, 72 indexed commands, six search fixtures')
