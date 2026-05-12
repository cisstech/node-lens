/* eslint-disable @typescript-eslint/no-explicit-any */
import { callTool, TOOL_DEFINITIONS } from './tools'

const SERVER_INFO = { name: 'nodelens', version: '0.1.0' }
const DEFAULT_PROTOCOL = '2024-11-05'

interface JsonRpcMessage {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: any
}

/**
 * Minimal MCP server over the stdio transport (newline-delimited JSON-RPC 2.0).
 * Exposes NodeLens's captured runtime data as read-only tools so AI coding
 * agents (Claude Code, Cursor, ...) can inspect what the local app is actually
 * doing: requests, N+1 queries, slow queries, correlated logs.
 *
 * Only JSON-RPC frames may be written to stdout; everything else goes to stderr.
 */
export function startMcpServer(): void {
  const send = (msg: object): void => {
    process.stdout.write(JSON.stringify(msg) + '\n')
  }
  const result = (id: any, res: unknown): void => send({ jsonrpc: '2.0', id, result: res })
  const error = (id: any, code: number, message: string): void => send({ jsonrpc: '2.0', id, error: { code, message } })

  async function handle(msg: JsonRpcMessage): Promise<void> {
    const { id, method, params } = msg
    const isNotification = id === undefined || id === null

    try {
      switch (method) {
        case 'initialize':
          return result(id, {
            protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          })

        case 'tools/list':
          return result(id, { tools: TOOL_DEFINITIONS })

        case 'tools/call': {
          const toolName = params?.name
          try {
            const data = await callTool(toolName, params?.arguments ?? {})
            return result(id, {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            })
          } catch (err) {
            // Tool-level failures are reported as tool results (isError), not
            // protocol errors, so the agent can read the message and adapt.
            return result(id, {
              content: [{ type: 'text', text: (err as Error).message }],
              isError: true,
            })
          }
        }

        case 'ping':
          return result(id, {})

        default:
          if (isNotification) return // ignore notifications we don't handle (e.g. notifications/initialized)
          return error(id, -32601, `Method not found: ${method}`)
      }
    } catch (err) {
      if (!isNotification) error(id, -32603, (err as Error).message)
    }
  }

  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let msg: JsonRpcMessage
      try {
        msg = JSON.parse(line)
      } catch {
        continue // ignore non-JSON lines
      }
      void handle(msg)
    }
  })
  process.stdin.on('end', () => process.exit(0))

  console.error('[NodeLens MCP] server ready (stdio). Exposing tools:', TOOL_DEFINITIONS.map((t) => t.name).join(', '))
}
