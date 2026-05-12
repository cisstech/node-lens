import { program } from 'commander'
//import { createPluginCommand } from './lib/commands/create-plugin'
import { createMonitorCommand } from './lib/commands/monitor'
import { createMcpCommand } from './lib/commands/mcp'
import { getPackageInfo } from './lib/utils/package-info'

async function main() {
  const packageInfo = await getPackageInfo()

  program.name('nls').description('CLI tool for Node Lens').version(packageInfo.version)

  program
  .addCommand(createMonitorCommand())
  .addCommand(createMcpCommand())
  //.addCommand(createPluginCommand)

  // Parse command line arguments
  program.parse()
}

main().catch((error) => {
  console.error('An error occurred:', error.message)
  process.exit(1)
})
