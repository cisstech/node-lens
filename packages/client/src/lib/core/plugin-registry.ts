import type { PluginManifest } from '../types'

export class PluginRegistry extends EventTarget {
  private pluginManifests = new Map<string, PluginManifest>()
  private loadedPlugins = new Set<string>() // url set
  private loadingPromises = new Map<string, Promise<void>>() // url -> loading promise

  get plugins(): PluginManifest[] {
    return Array.from(this.pluginManifests.values())
  }

  clear() {
    this.pluginManifests.clear()
    this.loadedPlugins.clear()
    this.loadingPromises.clear()
  }

  async register(plugins: PluginManifest[]): Promise<void> {
    for (const plugin of plugins) {
      this.pluginManifests.set(plugin.packageName, plugin)
    }

    this.dispatchEvent(new CustomEvent('registry-updated', { detail: { plugins: Array.from(this.pluginManifests.values()) } }))
  }

  async loadPlugin(plugin: PluginManifest): Promise<void> {
    // Check if already loaded
    if (this.loadedPlugins.has(plugin.url)) {
      return
    }

    // Check if currently loading
    const existingPromise = this.loadingPromises.get(plugin.url)
    if (existingPromise) {
      return
    }

    // Start loading
    const loadingPromise = this.loadPluginScript(plugin)
    this.loadingPromises.set(plugin.url, loadingPromise)

    try {
      await loadingPromise
    } finally {
      this.loadingPromises.delete(plugin.url)
    }
  }

  getByName(name: string): PluginManifest | undefined {
    return this.pluginManifests.get(name)
  }

  private async loadPluginScript(plugin: PluginManifest): Promise<void> {
    try {

      // Check if element is already defined
      if (customElements.get(plugin.tagName)) {
        return
      }

      // Load the script
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.type = 'module'
        script.src = plugin.url
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load script: ${plugin.url}`))
        document.head.appendChild(script)
      })
    } catch (error) {
      console.error(`Failed to load plugin from ${plugin.url}:`, error)
      throw error
    }
  }
}
