import { copyFile, ensureDir } from 'fs-extra'
import { readdir } from 'fs/promises'
import { join } from 'path'

const loadersDir = join(process.cwd(), '.node-lens/loaders')


export async function setupLoaders() {
  await ensureDir(loadersDir)

  // Recursively copy all .js files from the source directory
  const copyJSFiles = async (sourceDir: string, targetDir: string) => {
    const files = await readdir(sourceDir, { withFileTypes: true })

    for (const file of files) {
      const sourcePath = join(sourceDir, file.name)
      const targetPath = join(targetDir, file.name)

      if (file.isDirectory()) {
        await ensureDir(targetPath)
        await copyJSFiles(sourcePath, targetPath)
      } else if (file.isFile() && file.name.endsWith('.js')) {
        await copyFile(sourcePath, targetPath)
      }
    }
  }

  await copyJSFiles(__dirname, loadersDir)
}

export async function setupBackendLoader(): Promise<string[]> {
  const nodeArgs: string[] = []

  // CommonJS require hook only for now
  nodeArgs.push('-r', join(loadersDir, 'backend', 'commonjs.loader.js'))

  return nodeArgs
}

export async function setupFrontendLoader(): Promise<string[]> {
  const nodeArgs: string[] = []

  nodeArgs.push('-r', join(loadersDir, 'frontend', 'commonjs.loader.js'))

  return nodeArgs
}
