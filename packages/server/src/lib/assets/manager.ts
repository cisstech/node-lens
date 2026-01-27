import { readFile } from 'fs/promises'
import { join } from 'path'
import { joinUrlSegments } from '../utils'

/**
 * Configuration for static asset URL generation
 */
export interface StaticAssetManagerOptions {
  baseUrl: string
  hostname: string
  port?: number
}

/**
 * URL configuration for asset rewriting in client-side code
 */
export interface AssetRewriteOptions {
  assetsUrl: string
  sseUrl: string
}

/**
 * Manages static asset URLs and client-side script generation.
 * Handles hostname resolution and asset URL rewriting for different deployment scenarios.
 */
export class StaticAssetManager {
  constructor(private options: StaticAssetManagerOptions) {}

  private buildUrl(path: string): string {
    const host = this.options.hostname || `http://localhost:${this.options.port}`
    return joinUrlSegments(host, path)
  }

  getAssetsPath(): string {
    return joinUrlSegments(this.options.baseUrl, 'assets')
  }

  getAssetsUrl(): string {
    return this.buildUrl(this.getAssetsPath())
  }

  getSsePath(): string {
    return join(this.options.baseUrl, 'events')
  }

  getSseUrl(): string {
    return this.buildUrl(this.getSsePath())
  }

  async processIndexHtml(clientDir: string, rewriteOptions: AssetRewriteOptions): Promise<string> {
    let html = await readFile(join(clientDir, 'index.html'), 'utf8')

    // Rewrite asset URLs to be relative to the base URL
    html = html.replace(/src="\/([^"]+)"/g, `src="${rewriteOptions.assetsUrl}/$1"`)
      .replace(/href="\/([^"]+)"/g, `href="${rewriteOptions.assetsUrl}/$1"`)

    // Rewrite the SSE connection URL to use the correct server URL
    return html.replace(
      /client\.connect\(["']http:\/\/localhost:\d+\/[^"']*["']\)/g,
      `client.connect("${rewriteOptions.sseUrl}")`
    )
  }

  getPluginBasePath(pluginName: string): string {
    return join(this.options.baseUrl, 'plugins', pluginName)
  }

  getPluginUrl(pluginName: string): string {
    return this.buildUrl(this.getPluginBasePath(pluginName))
  }
}
