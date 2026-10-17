#!/usr/bin/env node
// Queue native jobs for CLO 7.0.242's manually invoked MIKRISTIAN plug-in.
// This CLI never claims success until CLO has written a response file.
import { mkdir, readFile, rename, readdir, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import path from 'node:path'

const base = path.join(homedir(), 'Documents', 'CLO_Automation')
const bridge = path.join(base, 'CLO_Operator')
const commands = new Set(['inspect', 'arrangements', 'arrange', 'simulate', 'export', 'import_dxf'])

function usage() {
  console.log(`Usage:
  node integrations/clo_sdk/cli.mjs inspect --execute
  node integrations/clo_sdk/cli.mjs arrangements --execute
  node integrations/clo_sdk/cli.mjs arrange --expected <active-zprj> --piece <pattern-index> --name <exact-pattern-name> --point <arrangement-index> --execute
  node integrations/clo_sdk/cli.mjs status
  node integrations/clo_sdk/cli.mjs result <job-id>
  node integrations/clo_sdk/cli.mjs recover-stale --id <job-id> --confirm-restarted
  node integrations/clo_sdk/cli.mjs recover-stale --id <job-id> --confirm-closed
  node integrations/clo_sdk/cli.mjs simulate --expected <full-current-zprj-path> --experimental-sim [--steps 2]
  node integrations/clo_sdk/cli.mjs export --expected <full-current-zprj-path> --path <NEW-zprj-output-path>
  node integrations/clo_sdk/cli.mjs import_dxf --expected <full-current-zprj-path> --path <existing-dxf-path>

Add --execute to run the menu entry automatically on the local Mac, with CLO open.
Omit --execute if you want to invoke the registered menu entry manually.
Native export works like Save As and changes the active CLO project path.
Native CLO 7 simulation is disabled by default following a stalled SDK call.
Never queue a mutation before getting the full current project path from an inspect response.`)
}

function parseArgs(argv) {
  const [action, ...rest] = argv
  const options = {}
  if (action === 'result') return { action, options: { id: rest[0] } }
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) throw Error('Expected --option value')
    const key = rest[i].slice(2)
    if (['execute', 'experimental-sim', 'confirm-restarted', 'confirm-closed'].includes(key)) options[key] = true
    else {
      if (rest[i + 1] === undefined) throw Error(`Missing value for --${key}`)
      options[key] = rest[++i]
    }
  }
  return { action, options }
}

function permittedPath(p, extension, mustExist) {
  if (!p || typeof p !== 'string' || p.includes('\n') || p.includes('\r')) throw Error('Absolute file path required')
  const resolved = path.resolve(p)
  if (!path.isAbsolute(p) || !resolved.startsWith(base + path.sep) || path.extname(resolved).toLowerCase() !== extension)
    throw Error(`File must be a ${extension} in ${base}`)
  return resolved
}

async function run(argv) {
  const { action, options } = parseArgs(argv)
  if (!action || action === 'help' || action === '--help') return usage()
  if (action === 'status') {
    const pending = await readFile(path.join(bridge, 'pending.job'), 'utf8').catch(() => null)
    const replies = await readdir(path.join(bridge, 'responses')).catch(() => [])
    const last = replies.filter(v => v.endsWith('.json')).sort().at(-1)
    console.log(JSON.stringify({ pending: pending ? Object.fromEntries(pending.trim().split('\n').map(v => v.split(/=(.*)/s).slice(0,2))) : null, lastResponse: last ? JSON.parse(await readFile(path.join(bridge, 'responses', last), 'utf8')) : null }, null, 2))
    return
  }
  if (action === 'result') {
    if (!/^[a-zA-Z0-9_-]+$/.test(options.id || '')) throw Error('Provide a valid job ID')
    console.log(await readFile(path.join(bridge, 'responses', options.id + '.json'), 'utf8'))
    return
  }
  if (action === 'recover-stale') {
    if (!options['confirm-restarted'] && !options['confirm-closed'])
      throw Error('Only recover after independently verifying CLO restarted after the job or has fully exited; use --confirm-restarted or --confirm-closed')
    if (options['confirm-closed']) {
      if (process.platform !== 'darwin') throw Error('Closed-process verification is only supported on the connected macOS host')
      const processes = execFileSync('/bin/ps', ['-axo', 'command='], { encoding: 'utf8', timeout: 5000 }).split('\n')
      const exe = '/Applications/CLO_Standalone_OnlineAuth.app/Contents/MacOS/CLO_Standalone_OnlineAuth'
      if (processes.some(line => line === exe || line.startsWith(exe + ' ')))
        throw Error('CLO is still running. Do not recover a potentially active SDK job.')
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(options.id || '')) throw Error('Provide exact stale --id')
    const jobPath = path.join(bridge, 'pending.job')
    const input = await readFile(jobPath, 'utf8')
    const old = Object.fromEntries(input.trim().split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)))
    if (old.id !== options.id) throw Error(`Pending ID ${old.id} does not match ${options.id}`)
    const resultFile = path.join(bridge, 'responses', old.id + '.json')
    if (await stat(resultFile).catch(() => null)) throw Error('CLO already responded, so recovery is inappropriate')
    const archived = path.join(bridge, `orphaned-${old.id}.job`)
    await rename(jobPath, archived)
    const recovered = { id: old.id, action: old.action, ok: false,
      source: 'local-recovery-not-CLO',
      error: 'CLO stopped or restarted before any native SDK response; result unverified and never retried automatically',
      orphanedJob: archived }
    await writeFile(resultFile, JSON.stringify(recovered, null, 2), { flag: 'wx' })
    console.log(JSON.stringify(recovered, null, 2))
    return
  }
  if (!commands.has(action)) return usage()
  await mkdir(path.join(bridge, 'responses'), { recursive: true })
  const existing = await stat(path.join(bridge, 'pending.job')).catch(() => null)
  if (existing) throw Error('A job is already pending. Run status; do not overwrite it.')
  const job = { id: new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + process.pid, action }
  if (!['inspect', 'arrangements'].includes(action)) {
    if (!options.expected || !path.isAbsolute(options.expected) || /[\r\n]/.test(options.expected)) throw Error('Provide --expected using the exact path from CLO inspect result')
    job.expected_project = options.expected
  }
  if (action === 'simulate') {
    if (!options['experimental-sim']) throw Error('Native CLO 7 Simulate stalled and the app restarted during testing. This operation is disabled unless --experimental-sim is explicitly supplied.')
    const steps = Number(options.steps || 2)
    if (!Number.isSafeInteger(steps) || steps < 1 || steps > 300) throw Error('Steps must be an integer 1..300')
    job.steps = String(steps)
  }
  if (action === 'arrange') {
    const piece = Number(options.piece)
    const point = Number(options.point)
    if (!Number.isSafeInteger(piece) || piece < 0 || piece > 499 || !Number.isSafeInteger(point) || point < 0 || point > 199)
      throw Error('Provide bounded non-negative --piece and --point indices from arrangements inspection')
    if (!options.name || /[\r\n=]/.test(options.name)) throw Error('Provide exact --name from pattern inspection')
    job.piece = String(piece)
    job.point = String(point)
    job.expected_name = options.name
  }
  if (action === 'export' || action === 'import_dxf') {
    job.path = permittedPath(options.path, action === 'export' ? '.zprj' : '.dxf')
    const exists = await stat(job.path).catch(() => null)
    if (action === 'export' && exists) throw Error('Output file exists; will not overwrite an original project')
    if (action === 'import_dxf' && !exists) throw Error('DXF does not exist')
  }
  const tmp = path.join(bridge, `.${job.id}.tmp`)
  await writeFile(tmp, Object.entries(job).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 })
  await rename(tmp, path.join(bridge, 'pending.job'))
  console.log(JSON.stringify({ queued: true, job, next: 'Invoke MIKRISTIAN CLO Operator from the CLO plug-in menu, then run status.' }, null, 2))
  if (options.execute) {
    if (process.platform !== 'darwin') throw Error('Automatic invocation is only supported on the local macOS CLO machine; job remains safely queued')
    execFileSync('/usr/bin/osascript', [
      '-e', 'tell application "System Events" to tell process "CLO_Standalone_OnlineAuth" to click menu item "MIKRISTIAN CLO Operator (run queued job)" of menu 1 of menu item "Plug-in" of menu 1 of menu bar item "Settings" of menu bar 1',
    ], { timeout: 45000, encoding: 'utf8', stdio: 'pipe' })
    const resultFile = path.join(bridge, 'responses', job.id + '.json')
    const timeout = action === 'export' ? 180000 : action === 'simulate' ? 120000 : 30000
    let resultText
    const started = Date.now()
    while (Date.now() - started < timeout) {
      resultText = await readFile(resultFile, 'utf8').catch(() => null)
      if (resultText) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (!resultText) throw Error(`CLO has not responded after ${timeout / 1000}s. The job may still be running; inspect status before retrying.`)
    const response = JSON.parse(resultText)
    console.log(JSON.stringify({ nativeExecution: true, response }, null, 2))
    if (!response.ok) process.exitCode = 2
  }
}

run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
