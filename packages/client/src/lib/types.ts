export interface NodeLensConfig {
  endpoint?: string
  autoConnect?: boolean
}

export interface NodeLensAppInfo {
  port: number
  origin: string
  platform: 'express' | 'fastify'
  framework: 'nestjs' | 'express' | 'fastify'
  frameworkVersion: string
}

export interface PluginManifest {
  url: string
  icon: string
  tagName: string
  packageName: string
  displayName: string
  description: string
}

export interface HandshakeEvent {
  timestamp: number
  plugins: PluginManifest[]
  appInfo: NodeLensAppInfo
}


export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export interface NodeLensState {
  status: ConnectionStatus
  plugins?: PluginManifest[]
  appInfo?: NodeLensAppInfo
  error?: string
}
