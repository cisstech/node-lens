/* eslint-disable @typescript-eslint/no-explicit-any */

export const PLUGIN_NAME = '@cisstech/node-lens-request'
export const PLUGIN_EVENTS = {
  REQUEST: 'request',
  COLLECTIONS: 'collections',
  VARIABLES: 'variables',
} as const

export interface PluginOptions {
  includeHeaders?: boolean
  captureBody?: boolean
  maxBodySize?: number
  variablesFile?: string
  collectionsDir?: string
}

export interface RequestOperation {
  name: string
  endTimeMs: number
  startTimeMs: number
  durationMs: number
  attributes: Record<string, any>
  isError: boolean
  events?: {
    name: string
    time: number
    attributes?: Record<string, any>
  }[]
  children?: RequestOperation[]
}

export interface RequestEvent {
  id: string
  traceId: string
  timestamp: number
  request: {
    headers: Record<string, any>
    size: number
    body?: any
    url: string
    path: string
    query: Record<string, string>
    method: string
  }
  response: {
    headers: Record<string, any>
    size: number
    body?: any
    duration: number
    statusCode: number
  }
  operations?: RequestOperation[]
}

export interface CollectionRequest {
  id: string
  name: string
  method: string
  url: string
  headers?: { key: string; value: string }[]
  query?: { key: string; value: string }[]
  bodyMode?: 'json' | 'urlencoded' | 'graphql'
  jsonText?: string
  urlParams?: { key: string; value: string }[]
  gqlQuery?: string
  gqlVariablesText?: string

}

export interface CollectionGroup {
  name: string
  requests: CollectionRequest[]
}

export interface Variable {
  key: string
  type: 'text' | 'function'
  value: string
}

export interface VariablesEvent {
  variables: Variable[]
}

export interface CollectionsEvent {
  collections: CollectionGroup[]
}

