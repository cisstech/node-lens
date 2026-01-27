import type { ServerResponse } from 'http'

/**
 * Server-Sent Events client connection
 */
export interface SseClient {
  /** Unique client identifier */
  id: number
  /** HTTP response object for the SSE connection */
  res: ServerResponse
}
