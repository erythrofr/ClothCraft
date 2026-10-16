#!/usr/bin/env node
// Personal EXO -> ClothCraft interop. No solver success, garment fit or factory approval is implied.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const exe = process.platform === 'win32' ? '.exe' : ''
const sourceDefault = path.join(root, 'native_cpp/examples/sample-tee.json')
const outputDefault = path.join(root, 'integrations/clothcraft/output')

export function paths(env = process.env) {
  const candidates = [
    env.EXO_CLOTHCRAFT_REPO,
    // When EXO Studio V2 lives inside a ClothCraft fork, use the checkout's
    // existing native Rust engine rather than demanding another nested clone.
    path.resolve(root, '..'),
    path.join(root, 'research/oss/clothcraft'),
    path.resolve(root, '../garment-studio/research/oss/clothcraft-contrib-review'),
  ].filter(Boolean)
  const upstream = candidates.find(candidate => fs.existsSync(path.join(candidate, 'Cargo.toml')))
  const cli = env.EXO_NATIVE_CLI || path.join(root, 'native_cpp/build-cmake/garment_cad_cli')
  const rustTemplate = env.EXO_CLOTHCRAFT_TEMPLATE_BIN || (upstream && path.join(upstream, `target/debug/cloth-template${exe}`))
  const rustFit = env.EXO_CLOTHCRAFT_FIT_BIN || (upstream && path.join(upstream, `target/debug/cloth-fit${exe}`))
  const localToolchain = path.join(root, 'research/runtime/clothcraft-rust-toolchain')
  const localCargo = path.join(localToolchain, 'cargo/bin/cargo')
  const installedCargo = path.join(env.HOME || '', '.cargo/bin/cargo')
  const rustEnv = { ...env }
  // The original EXO checkout optionally carries an isolated Rust toolchain.
  // Fork installations should retain the user's installed cargo/rustup.
  if (fs.existsSync(localCargo)) {
    rustEnv.CARGO_HOME = env.CARGO_HOME || path.join(localToolchain, 'cargo')
    rustEnv.RUSTUP_HOME = env.RUSTUP_HOME || path.join(localToolchain, 'rustup')
    rustEnv.PATH = `${path.dirname(localCargo)}${path.delimiter}${env.PATH || ''}`
  }
  return { upstream, cli, rustTemplate, rustFit,
    cargo: env.EXO_CARGO || (fs.existsSync(localCargo) ? localCargo : fs.existsSync(installedCargo) ? installedCargo : 'cargo'), rustEnv }
}

function parse(argv) {
  const [action = 'help', ...rest] = argv
  const result = { action }
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i]
    if (!['--input', '--output', '--steps', '--avatar'].includes(name) || !rest[i + 1]) {
      throw new Error(`Unknown or incomplete argument: ${name}`)
    }
    result[name.slice(2)] = rest[i + 1]
  }
  if (!['help', 'status', 'export', 'validate', 'bake', 'simulate', 'prepare', 'fit', 'open'].includes(action)) {
    throw new Error(`Unsupported ClothCraft action: ${action}`)
  }
  return result
}

export function nativeExport(document, binary) {
  if (!fs.existsSync(binary)) throw new Error(`EXO native CAD CLI missing: ${binary}. Build with python3 -m cmake -S native_cpp -B native_cpp/build-cmake -DGARMENT_BUILD_QT=OFF, then python3 -m cmake --build native_cpp/build-cmake --target garment_cad_cli --parallel 2.`)
  const run = spawnSync(binary, [], {
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', op: 'clothcraft-export', document }) + '\n',
    encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024,
  })
  if (run.error || run.status !== 0) throw new Error(`EXO native export failed: ${run.error?.message || run.stderr || run.status}`)
  const result = JSON.parse(run.stdout.trim())
  if (!result.ok || !result.interchange?.template) throw new Error(`EXO export rejected: ${result.error || 'missing template'}`)
  return result.interchange
}

function runRust(which, args, config) {
  if (!config.upstream) throw new Error('ClothCraft source missing. Set EXO_CLOTHCRAFT_REPO to a checkout of erythrofr/ClothCraft.')
  const binary = which === 'template' ? config.rustTemplate : config.rustFit
  const subcommand = which === 'template' ? 'cloth-template' : 'cloth-fit'
  const useBinary = binary && fs.existsSync(binary)
  const command = useBinary ? binary : config.cargo
  const cpuOnly = which === 'template' || !args.includes('--view')
  const runArgs = useBinary ? args : ['run', '--locked', ...(cpuOnly ? ['--no-default-features'] : []),
    '-j', '2', '--bin', subcommand, '--', ...args]
  const p = spawnSync(command, runArgs, { cwd: config.upstream, env: config.rustEnv,
    stdio: 'inherit', timeout: 600000 })
  if (p.error) throw new Error(`${subcommand}: ${p.error.message}. Install Rust or set EXO_CLOTHCRAFT_${which === 'template' ? 'TEMPLATE' : 'FIT'}_BIN.`)
  if (p.status !== 0) throw new Error(`${subcommand} exited ${p.status || p.signal}; any exported metrics are diagnostic only.`)
}

function ensureValidProject(interchange, config, opts, output) {
  const avatar = path.resolve(opts.avatar || path.join(config.upstream || '', 'assets/makehuman/mannequin.obj'))
  if (!fs.existsSync(avatar)) {
    throw new Error(`ClothCraft avatar OBJ missing: ${avatar}. Set --avatar to a licensed OBJ path.`)
  }
  // Mirror the public ClothCraft FittingProject v1 serialized field contract.
  const project = {
    version: 1, template: interchange.template, avatar_path: avatar,
    contact_stiffness: 500000, contact_clearance: 0, prearrange: false,
    quasistatic: true, solver: { dt: 1 / 240, gravity: [0, -9.81, 0], damping: 20,
      newton_iterations: 30, pcg_iterations: 500, absolute_tolerance: 1e-6, relative_tolerance: 1e-4 },
    state: null, mesh_signature: null,
  }
  const filename = path.join(output, 'fitting-project.json')
  fs.writeFileSync(filename, JSON.stringify(project, null, 2) + '\n')
  return filename
}

export function execute(args, env = process.env) {
  const opts = parse(args)
  const config = paths(env)
  if (opts.action === 'help') return {
    usage: 'node integrations/clothcraft/bridge.mjs status|export|validate|bake|simulate|prepare|fit|open [--input EXO.json] [--output directory] [--steps N] [--avatar mannequin.obj]',
    note: 'EXO remains the authoritative editable project; ClothCraft runs as a separate Rust process.' }
  if (opts.action === 'status') return {
    nativeCliPresent: fs.existsSync(config.cli), clothcraftRepoPresent: Boolean(config.upstream),
    clothcraftTemplateBinaryPresent: Boolean(config.rustTemplate && fs.existsSync(config.rustTemplate)),
    clothcraftFitBinaryPresent: Boolean(config.rustFit && fs.existsSync(config.rustFit)),
    cargoPresent: fs.existsSync(config.cargo), rustFitCertified: false,
  }
  const input = path.resolve(opts.input || sourceDefault)
  const output = path.resolve(opts.output || outputDefault)
  const documentBytes = fs.readFileSync(input)
  const document = JSON.parse(documentBytes.toString('utf8'))
  const interchange = nativeExport(document, config.cli)
  if (interchange.fitAccepted || interchange.verifiedByRust) {
    throw new Error('Unexpectedly certified C++ preview export; review the provenance before proceeding.')
  }
  fs.mkdirSync(output, { recursive: true })
  const template = path.join(output, 'template.json')
  fs.writeFileSync(template, JSON.stringify(interchange.template, null, 2) + '\n')
  const manifest = { sourceFile: input, sha256: createHash('sha256').update(documentBytes).digest('hex'),
    clothcraftCheckout: config.upstream || null, outputTemplate: template,
    warnings: interchange.warnings, rustValidated: false, fitAccepted: false,
    sourcePreserved: true, status: 'unvalidated-export' }
  if (opts.action === 'export') {
    fs.writeFileSync(path.join(output, 'bridge-report.json'), JSON.stringify(manifest, null, 2) + '\n')
    return manifest
  }
  // Fitting project creation and all physical solving remain in ClothCraft's own processes.
  if (['prepare','fit','open'].includes(opts.action)) {
    const project = ensureValidProject(interchange, config, opts, output)
    if (opts.action === 'prepare') return { ...manifest, status: 'clothcraft-project-prepared', project }
    const runArgs = ['--project', project, '--steps', opts.action === 'open' ? '0' : String(Math.max(1, Number(opts.steps || 1))),
      ...(opts.action === 'open' ? ['--view'] : []), '--output', path.join(output, 'fitting')]
    runRust('fit', runArgs, config)
    return { ...manifest, status: opts.action === 'open' ? 'clothcraft-window-exited' : 'clothcraft-fit-executed', project }
  }
  runRust('template', [opts.action, template, ...(opts.action === 'bake' || opts.action === 'simulate'
    ? ['--output', path.join(output, opts.action), ...(opts.action === 'simulate'
      ? ['--steps', String(Math.max(1, Number(opts.steps || 30))), '--threads', '2'] : [])] : [])], config)
  const response = { ...manifest, rustValidated: true, status: `clothcraft-${opts.action}-completed`,
    fitAccepted: false, resultDirectory: output }
  fs.writeFileSync(path.join(output, 'bridge-report.json'), JSON.stringify(response, null, 2) + '\n')
  return response
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(execute(process.argv.slice(2)), null, 2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
