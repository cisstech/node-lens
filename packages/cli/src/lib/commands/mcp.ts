import { Command } from 'commander'
import { startMcpServer } from '../mcp/server'

/**
 * `nls mcp` runs a Model Context Protocol server (stdio) that exposes the
 * current NodeLens session's runtime data to AI coding agents. Point your
 * agent's MCP config at `nls mcp` with the project directory as its cwd.
 */
export function createMcpCommand(): Command {
  return new Command('mcp')
    .description('Run an MCP server exposing NodeLens runtime data to AI coding agents (stdio transport)')
    .option(
      '--cwd <path>',
      'Directory to resolve the NodeLens session from (searches upward for .node-lens/.info.json). Defaults to $NODE_LENS_CWD or the current directory.'
    )
    .action((options: { cwd?: string }) => {
      if (options.cwd) process.env.NODE_LENS_CWD = options.cwd
      startMcpServer()
    })
}
