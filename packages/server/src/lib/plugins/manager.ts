import { access } from 'fs/promises'
import { join } from 'path'
import type { AppInfo, NodeLensPlugin } from './types'
import { hashFile } from '../utils'

/**
 * Manages plugin registration, asset resolution, and client-side URLs.
 * Handles plugin lifecycle and ensures unique plugin instances.
 */
export class PluginManager {
  private plugins = new Map<string, NodeLensPlugin>()

  constructor(private baseUrl: string) {}

  registerPlugin(plugin: NodeLensPlugin): void {
    if (this.plugins.has(plugin.packageName)) {
      throw new Error(`Plugin "${plugin.packageName}" is already registered`)
    }

    this.plugins.set(plugin.packageName, plugin)
  }

  getPlugins(): Map<string, NodeLensPlugin> {
    return this.plugins
  }

  getPluginsArray(): NodeLensPlugin[] {
    return Array.from(this.plugins.values())
  }

  async setupPluginAssets(): Promise<void> {
    const plugins = Array.from(this.plugins.values())
    await Promise.all(plugins.map(async (plugin) => {
      const root = join('node_modules', plugin.packageName)
      const clientDir = join(root, 'dist', 'src', 'client')

      try {
        await access(clientDir)
      } catch {
        console.warn(`[NodeLens] client dir missing for ${plugin.packageName}: ${clientDir}`)
        return
      }

      const finalEntry = 'index.js'
      const entryAbs = join(clientDir, finalEntry)

      try {
        await access(entryAbs)
      } catch {
        console.warn(`[NodeLens] entry not found for ${plugin.packageName} in ${clientDir}`)
        return
      }

      const baseUrl = join(this.baseUrl, 'plugins', plugin.packageName)
      plugin.distPath = clientDir
      plugin.entryUrl = `${baseUrl}/${finalEntry}?hash=${encodeURIComponent(await hashFile(entryAbs))}`
    }))
  }

  getHandshakePlugins(appInfo?: AppInfo | null) {
    return Array.from(this.plugins.values())
      .filter((plugin) => !appInfo || plugin.isAvailable?.(appInfo) !== false)
      .map((plugin) => ({
        icon: plugin.icon,
        tagName: plugin.tagName,
        displayName: plugin.displayName,
        packageName: plugin.packageName,
        description: plugin.description,
        url: plugin.entryUrl,
      }))
  }
}
