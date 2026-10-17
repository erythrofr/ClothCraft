import {spawnSync} from 'node:child_process'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const audit=spawnSync(process.execPath,
  ['scripts/check-native-cpp-conversion-coverage.mjs','--json'],
  {cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})
if(audit.error)throw audit.error
if(audit.status!==0)throw new Error(audit.stderr||'C++ export inventory failed')
const report=JSON.parse(audit.stdout)
const {jsNamedExports,mappedOperations,
  parityScriptsAvailable,unmappedJsExports}=report.counts
const inventoryComplete=mappedOperations===jsNamedExports &&
  parityScriptsAvailable===jsNamedExports && unmappedJsExports===0
// These gates require separate empirical acceptance evidence. Never infer
// them from a high mapped-export count or a successful CTest pass.
const fullSolverParityVerified=false
const continuousTriangleCcdVerified=false
const factoryContentParityVerified=false
const qtLiveSimulationIntegrated=false
const fullApplicationVerified=inventoryComplete&&fullSolverParityVerified&&
  continuousTriangleCcdVerified&&factoryContentParityVerified&&qtLiveSimulationIntegrated
const result={
  coreJsNamedExports:jsNamedExports,
  mappedNativeExports:mappedOperations,
  parityScriptMappedExports:parityScriptsAvailable,
  unmappedJsExports,
  mappedExportCoveragePercent:+(100*mappedOperations/jsNamedExports).toFixed(2),
  inventoryComplete,
  fullApplicationVerified,
  overallApplicationCompletionPercent:null,
  fullSolverParityVerified,
  continuousTriangleCcdVerified,
  factoryContentParityVerified,
  qtLiveSimulationIntegrated,
  unsupported:report.unmappedJsExports.map(x=>x.file+'#'+x.name),
}
console.log(JSON.stringify(result,null,2))
// Export coverage does not certify the app, solver trajectory, or factory files.
if(process.argv.includes('--require-export-coverage')&&!inventoryComplete)process.exitCode=1
if(process.argv.includes('--require-complete')&&!fullApplicationVerified)process.exitCode=1
