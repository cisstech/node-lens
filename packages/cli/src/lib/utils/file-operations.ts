import chalk from 'chalk'
import { copy, mkdir, pathExists, readFile, writeFile } from 'fs-extra'
import { join } from 'path'

const TEMPLATE_DIR = join(__dirname, '../../template')

export async function copyTemplate(pluginName: string, targetDir: string, force = false): Promise<void> {
  try {
    // Ensure template directory exists
    if (!(await pathExists(TEMPLATE_DIR))) {
      throw new Error(`Template directory not found: ${TEMPLATE_DIR}`)
    }

    // Ensure target directory exists
    await ensureDir(targetDir)

    // Copy template files
    await copy(TEMPLATE_DIR, targetDir, {
      overwrite: force,
      errorOnExist: !force,
      filter: (src) => {
        // Skip node_modules and build artifacts
        const relativePath = src.replace(TEMPLATE_DIR, '')
        return !/(node_modules|dist|build|\\.git)/.test(relativePath)
      },
    })

    // Derive naming forms
    const raw = pluginName.trim()
    const kebab = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()

    const pascal =
      kebab
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('') + 'Plugin'

    const constName = kebab.toUpperCase().replace(/-/g, '_') + '_PLUGIN'

    // Update package.json
    const packageJsonPath = join(targetDir, 'package.json')
    if (await pathExists(packageJsonPath)) {
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
      packageJson.name = raw.startsWith('@') ? raw : `@${kebab}`
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }

    const filesToUpdate = [
      join(targetDir, 'vite.config.js'),
      join(targetDir, 'src', 'Plugin.svelte'),
      join(targetDir, 'src', 'server', 'index.ts'),
    ]

    await Promise.all(
      filesToUpdate.map(async (filePath) => {
        if (await pathExists(filePath)) {
          let content = await readFile(filePath, 'utf-8')
          content = content
            .replace(/__PLUGIN_CLASS__/g, pascal)
            .replace(/__PLUGIN_CONST__/g, constName)
            .replace(/__PLUGIN_NAME__/g, kebab)
            .replace(/__PLUGIN_TAG__/g, `${kebab}-plugin`)
          await writeFile(filePath, content)
        }
      })
    )

    console.log(chalk.gray(`✅ Template copied to ${targetDir}`))
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      throw new Error(`Target directory already exists and force option is not set`)
    }
    throw error
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch {
    // Directory might already exist
  }
}
