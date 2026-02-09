import { ChildProcess, spawn } from 'child_process'
import { Command } from 'commander'
import { setupBackendLoader, setupFrontendLoader, setupLoaders } from '../monitoring/loaders'

type CommandOptions = {
  cwd: string
  mode: 'frontend' | 'backend'
}

export function createMonitorCommand(): Command {
  const command = new Command('monitor')
    .description('Monitor your application with NodeLens instrumentation')
    .argument(
      '<command...>',
      'Command to run your application (e.g., "node app.js", "npm start", "yarn dev", "nx serve api")'
    )
    .requiredOption('-m, --mode <mode>', 'Application mode: frontend or backend', (value) => {
      if (value !== 'frontend' && value !== 'backend') {
        throw new Error('Mode must be either "frontend" or "backend"')
      }
      return value
    })
    .option('--cwd <path>', 'Working directory for your application', process.cwd())
    .action(async (commandArgs: string[], options: CommandOptions) => {
      console.log('NodeLens - Zero-config Node.js monitoring')
      console.log('Embeds monitoring directly into your application')
      console.log()

      try {
        // Validate that command was provided
        if (commandArgs.length === 0) {
          console.log('❌ Error: Command is required')
          console.log()
          console.log('Examples:')
          console.log('Backend applications:')
          console.log(`  node-lens monitor --mode backend node app.js`)
          console.log(`  node-lens monitor --mode backend npm start`)
          console.log(`  node-lens monitor --mode backend yarn nx serve api`)
          console.log()
          console.log('Frontend applications:')
          console.log(`  node-lens monitor --mode frontend yarn nx serve app`)
          console.log(`  node-lens monitor --mode frontend npm run dev`)
          console.log(`  node-lens monitor --mode frontend yarn vite`)
          console.log(`  node-lens monitor --mode frontend ng serve`)
          console.log()
          process.exit(1)
        }

        console.log(`Mode: ${options.mode}`)
        console.log()

        await setupLoaders()
        if (options.mode === 'frontend') {
          await handleFrontendMode(commandArgs, options)
        } else {
          await handleBackendMode(commandArgs, options)
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : String(error))
        console.error(error instanceof Error ? error.stack : error)
        process.exit(1)
      }
    })

  return command
}

async function handleFrontendMode(finalCommand: string[], options: CommandOptions): Promise<void> {
  console.log('🎨 Frontend mode')
  console.log('Setting up frontend build tool instrumentation...')

  const nodeArgs = await setupFrontendLoader()

  console.log('✓ Frontend build tool hooks ready')
  console.log('Build tools will be automatically instrumented to inject monitoring scripts')
  console.log()

  // Launch application with frontend build tool instrumentation
  const [command, ...args] = finalCommand
  console.log('command', command, 'args', args)
  console.log(
    `🚀 Starting frontend with NodeLens: NODE_OPTIONS=${nodeArgs.join(' ')} ${finalCommand.join(' ')}`
  )
  console.log(`Working directory: ${options.cwd}`)
  console.log()

  const childProcess = spawn(command, args, {
    stdio: 'inherit',
    cwd: options.cwd,
    env: {
      ...process.env,
      // Add Node.js options for frontend build tool instrumentation
      NODE_OPTIONS: `${process.env['NODE_OPTIONS'] || ''} ${nodeArgs.join(' ')}`.trim(),
    },
  })

  handleProcessCleanup(childProcess)
}

async function handleBackendMode(finalCommand: string[], options: CommandOptions): Promise<void> {
  console.log('⚙️  Backend mode')
  console.log('Setting up backend monitoring...')

  const nodeArgs = await setupBackendLoader()

  console.log('✓ Backend monitoring ready')
  console.log()

  // Launch application with NodeLens embedded
  const [command, ...args] = finalCommand
  console.log(
    `🚀 Starting backend with NodeLens: NODE_OPTIONS=${nodeArgs.join(' ')} ${finalCommand.join(' ')}`
  )
  console.log(`Working directory: ${options.cwd}`)
  console.log()

  const childProcess = spawn(command, args, {
    stdio: 'inherit',
    cwd: options.cwd,
    env: {
      ...process.env,
      // Add Node.js options for instrumentation
      NODE_OPTIONS: `${process.env['NODE_OPTIONS'] || ''} ${nodeArgs.join(' ')}`.trim(),
    },
  })

  handleProcessCleanup(childProcess)
}

function handleProcessCleanup(childProcess: ChildProcess): void {
  // Handle process cleanup
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down NodeLens...')
    childProcess.kill('SIGINT')
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down NodeLens...')
    childProcess.kill('SIGTERM')
    process.exit(0)
  })

  // Handle child process exit
  childProcess.on('exit', async (code: number | null) => {
    console.log('\n🛑 Application exited')
    process.exit(code || 0)
  })
}
