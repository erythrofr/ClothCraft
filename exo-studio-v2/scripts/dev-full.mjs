import { spawn } from 'node:child_process'

const children = new Set()
let shuttingDown = false

function run(label, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  children.add(child)
  const pipe = (stream, target) => stream.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/)
    for (const line of lines) if (line) target.write(`[${label}] ${line}\n`)
  })
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (shuttingDown) return
    const reason = signal ? `signal ${signal}` : `exit ${code}`
    console.error(`[dev:full] ${label} stopped unexpectedly (${reason}); shutting down the stack.`)
    shutdown(code || 1)
  })
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.exitCode == null && !child.killed) child.kill('SIGTERM')
  }
  const timer = setTimeout(() => {
    for (const child of children) if (child.exitCode == null) child.kill('SIGKILL')
    process.exit(code)
  }, 1500)
  timer.unref()
  if (!children.size) process.exit(code)
  let remaining = children.size
  for (const child of [...children]) child.once('exit', () => {
    remaining -= 1
    if (remaining <= 0) process.exit(code)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev:full] starting Garment Studio web UI + native XPBD sidecar')
console.log(`[dev:full] native service: http://${process.env.GS_NATIVE_HOST || '127.0.0.1'}:${process.env.GS_NATIVE_PORT || '5194'}`)
console.log(`[dev:full] web UI: http://127.0.0.1:${process.env.GS_WEB_PORT || '5188'}`)
run('native', 'node', ['native_backend/server.mjs'])
run('vite', 'node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', process.env.GS_WEB_PORT || '5188', '--strictPort'])
