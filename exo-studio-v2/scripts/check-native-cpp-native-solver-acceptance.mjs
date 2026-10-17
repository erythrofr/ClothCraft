import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,mkdtempSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {assessNativeSolverResult} from '../src/core/backends/nativeServiceBackend.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-native-acceptance-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/simulation_quality.cpp','native_cpp/core/native_solver_acceptance.cpp','native_cpp/tests/test_native_solver_acceptance.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const results=[null,{}, {stats:{}},{stats:{finite:true}},{stats:{finite:false}},{stats:{finite:true,fullMeshEdgeStrainMax:.03,seamMaxDistance:.001}},{stats:{finite:true,fullMeshEdgeStrainMax:.3,seamMaxDistance:.021}},{stats:{fullMeshEdgeStrainMax:null,seamMaxDistance:0}},{stats:{fullMeshEdgeStrainMax:'0.15',seamMaxDistance:'0.005'}},{stats:{fullMeshEdgeStrainMax:'bad',seamMaxDistance:false}},{stats:{fullMeshEdgeStrainMax:0,seamMaxDistance:0},fitTrajectory:{peakFullMeshEdgeStrainPercent:15,peakSewnGapMm:5}},{stats:{fullMeshEdgeStrainMax:.01,seamMaxDistance:.001},fitTrajectory:{peakFullMeshEdgeStrainPercent:120,peakSewnGapMm:13,allFramesFinite:false}},{stats:{finite:false,fullMeshEdgeStrainMax:.5,seamMaxDistance:.1},fitTrajectory:{allFramesFinite:false}},{fitTrajectory:{peakFullMeshEdgeStrainPercent:100,peakSewnGapMm:100}},{stats:{fullMeshEdgeStrainMax:0,seamMaxDistance:0},fitTrajectory:{peakFullMeshEdgeStrainPercent:null,peakSewnGapMm:null}}]
const fixturePath=resolve(root,'native_backend/output/tee.native-result.json')
let tee=0
if(existsSync(fixturePath)){const file=JSON.parse(readFileSync(fixturePath,'utf8'));results.push(file);tee++}
const before=JSON.stringify(results)
const expected=results.map(assessNativeSolverResult)
assert.equal(JSON.stringify(results),before,'JS mutated solver results')
const run=spawnSync(binary,[],{input:JSON.stringify({results}),cwd:root,encoding:'utf8'})
assert.equal(run.status,0,run.stderr)
const actual=JSON.parse(run.stdout)
assert.deepEqual(actual,expected)
console.log('Native solver acceptance parity passed: '+results.length+' cases; real tee solver result fixtures: '+tee)
