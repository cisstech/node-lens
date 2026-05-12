// Turnkey local test for the NodeLens MCP server; no agent required.
// Spawns `nls mcp`, runs the JSON-RPC handshake, and calls every tool against
// the currently-running session, printing a readable report.
//
//   1. docker compose up -d postgres
//   2. node packages/cli/bin/nls.js monitor --mode backend node samples/blog/index.js
//   3. node samples/blog/traffic.mjs
//   4. node samples/blog/mcp-smoke.mjs
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliBin = resolve(repoRoot, 'packages', 'cli', 'bin', 'nls.js')

const child = spawn('node', [cliBin, 'mcp', '--cwd', repoRoot], { stdio: ['pipe', 'pipe', 'inherit'] })

let buf = ''
const pending = new Map()
child.stdout.on('data', (d) => {
  buf += d.toString()
  let nl
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    const msg = JSON.parse(line)
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
})

let idc = 0
const rpc = (method, params) =>
  new Promise((res) => {
    const id = ++idc
    pending.set(id, res)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })

const call = async (name, args = {}) => {
  const r = await rpc('tools/call', { name, arguments: args })
  const text = r.result?.content?.[0]?.text ?? JSON.stringify(r.result)
  console.log(`\n─── ${name}(${JSON.stringify(args)}) ${r.result?.isError ? '[error]' : ''}`)
  console.log(text)
}

const main = async () => {
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } })
  console.log(`Connected to ${init.result.serverInfo.name} (protocol ${init.result.protocolVersion})`)
  const tools = await rpc('tools/list', {})
  console.log('Tools:', tools.result.tools.map((t) => t.name).join(', '))

  await call('nodelens_status')
  await call('find_n1_queries')
  await call('list_slow_queries', { thresholdMs: 100 })
  await call('list_requests', { limit: 5 })
  await call('get_recent_logs', { level: 'ERROR', limit: 5 })

  child.stdin.end()
  setTimeout(() => process.exit(0), 200)
}
main()
