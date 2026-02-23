/**
 * Response from plugin command execution
 */
export type CommandResponse<T = unknown> = {
  success: true
  result: T
} | {
  success: false
  error: string
}

/**
 * Handles plugin command execution
 */
export class CommandExecutor {
  constructor(
    private getOrigin: () => string,
    private getToken: () => string | undefined = () => undefined
  ) {}

  /**
   * Execute a command on a specific plugin
   *
   * @param plugin The plugin package name
   * @param command The command to execute
   * @param payload Optional payload for the command
   * @returns Promise resolving to the command result
   *
   * @example
   * // Database plugin: explain a query
   * const result = await client.commands.execute('@cisstech/node-lens-database', 'explain', {
   *   query: 'SELECT * FROM users WHERE id = ?',
   *   parameters: [123]
   * })
   */
  async execute<T = unknown>(plugin: string, command: string, payload?: unknown): Promise<T> {
    const origin = this.getOrigin()
    const url = new URL(`/node-lens/plugins/${encodeURIComponent(plugin)}/commands/${encodeURIComponent(command)}`, origin)

    // Add payload as query parameter if provided
    if (payload !== undefined) {
      url.searchParams.set('payload', JSON.stringify(payload))
    }

    const token = this.getToken()
    if (token) {
      url.searchParams.set('token', token)
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data: CommandResponse<T> = await response.json()

      if (!data.success) {
        throw new Error(data.error)
      }

      return data.result
    } catch (error) {
      console.error(`[NodeLens] Command execution failed:`, { plugin, command, error })
      throw error
    }
  }
}
