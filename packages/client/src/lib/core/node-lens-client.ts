import type { SSEEvent } from '@cisstech/node-lens-server'
import type { HandshakeEvent, NodeLensState } from '../types'
import { CommandExecutor } from './commands'
import { HttpEventStore, type EventStore } from './event-store'
import { PluginRegistry } from './plugin-registry'

export class NodeLensClient extends EventTarget {
  private eventSource: EventSource | null = null
  private currentState: NodeLensState = { status: 'disconnected' }
  private reconnectAttempts = 0
  private reconnectDelay = 1_000

  private readonly maxReconnectAttempts = 5
  private readonly eventStore: EventStore
  private readonly pluginRegistry: PluginRegistry
  private readonly commandExecutor: CommandExecutor
  /** Session token carried on the SSE bootstrap URL; reused for command/history calls. */
  private sessionToken?: string

  constructor() {
    super()
    const origin = () => this.state.appInfo?.origin || window.location.origin
    const token = () => this.sessionToken
    this.eventStore = new HttpEventStore(origin, '/node-lens', token)
    this.pluginRegistry = new PluginRegistry()
    this.commandExecutor = new CommandExecutor(origin, token)
    window.nodeLensInstance = this
  }

  get state(): NodeLensState {
    return { ...this.currentState }
  }

  get events(): EventStore {
    return this.eventStore
  }

  get registry(): PluginRegistry {
    return this.pluginRegistry
  }

  /**
   * Plugin command execution API
   * Allows client plugins to execute commands on their server-side counterparts
   */
  get commands(): CommandExecutor {
    return this.commandExecutor
  }

  async connect(endpoint: string): Promise<void> {
    if (this.currentState.status === 'connected') return

    // The server injects the session token into this URL; capture it so the
    // event store and command executor can authenticate their own requests.
    try {
      this.sessionToken = new URL(endpoint, window.location.origin).searchParams.get('token') ?? undefined
    } catch {
      this.sessionToken = undefined
    }

    this.updateConnectionState({ status: 'connecting', appInfo: undefined, plugins: undefined, error: undefined })

    try {
      await this.establishConnection(endpoint)
    } catch (error) {
      this.updateConnectionState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      })
      throw error
    }
  }

  disconnect(): void {
    this.pluginRegistry.clear()
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.reconnectAttempts = 0
    this.updateConnectionState({ status: 'disconnected', appInfo: undefined, plugins: undefined, error: undefined })
  }

  private async establishConnection(endpoint: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(endpoint)

        this.eventSource.onopen = () => {
          this.reconnectAttempts = 0
          this.reconnectDelay = 1000
          this.updateConnectionState({ status: 'connected' })
          resolve()
        }

        this.eventSource.onmessage = (event) => this.handleMessage(endpoint, event)

        this.eventSource.onerror = (err) => {
          console.error('[NodeLens] SSE connection error:', err)
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            this.handleDisconnection(endpoint)
          }
        }

        // Timeout guard
        setTimeout(() => {
          if (this.currentState.status === 'connecting') {
            this.eventSource?.close()
            reject(new Error('Connection timeout'))
          }
        }, 10000)
      } catch (err) {
        reject(err)
      }
    })
  }

  private async handleMessage(endpoint: string, event: MessageEvent): Promise<void> {
    try {
      const data = JSON.parse(event.data) as SSEEvent

      if (data.event === 'handshake') {
        const handshake = data.data as HandshakeEvent
        handshake.plugins?.forEach((p) => (p.url = `${event.origin}${p.url}`))

        this.dispatchEvent(new CustomEvent('handshake', { detail: handshake }))

        const url = new URL(endpoint)
        this.pluginRegistry.register(handshake.plugins)

        this.updateConnectionState({
          status: 'connected',
          appInfo: { ...handshake.appInfo, origin: url.origin },
          plugins: handshake.plugins,
        })
        return
      }

      this.eventStore.dispatch(data)
    } catch (err) {
      console.warn('[NodeLens] Failed to parse SSE message:', err, event.data)
    }
  }

  private handleDisconnection(endpoint: string): void {
    this.updateConnectionState({ status: 'error', error: 'Connection lost' })

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      console.log(`[NodeLens] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      setTimeout(() => {
        if (this.currentState.status === 'error') {
          this.connect(endpoint).catch(console.error)
        }
      }, delay)
    } else {
      console.error('[NodeLens] Max reconnection attempts reached')
      this.updateConnectionState({ status: 'error', error: 'Max reconnection attempts reached' })
    }
  }

  private updateConnectionState(newState: Partial<NodeLensState>): void {
    this.currentState = { ...this.currentState, ...newState }
    this.dispatchEvent(new CustomEvent('connectionStateChange', { detail: this.state }))
  }
}
