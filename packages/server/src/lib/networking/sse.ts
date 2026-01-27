import { ServerResponse } from 'http';
import { EventBus, EventDisposable, EventInfo } from '../events/types';
import { SseClient } from './types';
import { EventStore } from '../events/store';
import { LockContentionError } from '../events/errors';

interface BufferedEvent {
  event: string;
  data: unknown;
  timestamp: number;
  scope?: string;
}

/**
 * Configuration options for SSE connection management
 */
export interface SseManagerOptions {
  /** Maximum events to buffer for new connections */
  bufferSize?: number;
  /** Maximum age in milliseconds for buffered events */
  bufferMaxAge?: number;
}

export const BUFFER_SIZE_DEFAULT = 100;
export const BUFFER_MAX_AGE_DEFAULT = 300_000;

/**
 * Manages Server-Sent Event connections for real-time client communication.
 * Handles client lifecycle, event broadcasting, and buffering for late-joining clients.
 */
export class SseManager {
  private clientCounter = 0;
  private clients = new Map<number, SseClient>();
  private unsubscribe?: EventDisposable;
  private eventBuffer: BufferedEvent[] = [];
  private getHandshakeData?: () => unknown;

  constructor(
    private readonly eventBus: EventBus,
    private readonly store?: EventStore,
    private readonly opts: SseManagerOptions = {}
  ) {
    this.setupEventForwarding();
  }

  addClient(res: ServerResponse): number {
    const id = ++this.clientCounter;
    const client: SseClient = { id, res };

    this.clients.set(id, client);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Handshake
    const handshakeData = this.getHandshakeData ? this.getHandshakeData() : { timestamp: Date.now() };
    this.sendToClient(client, { event: 'handshake', data: handshakeData });

    // Replay buffered
    this.replayBufferedEvents(client);

    res.on('close', () => this.removeClient(id));
    res.on('error', () => this.removeClient(id));

    return id;
  }

  removeClient(id: number): void {
    this.clients.delete(id);
  }

  broadcast(eventInfo: EventInfo): void {
    const ts = Date.now();
    const buffered: BufferedEvent = {
      event: eventInfo.event,
      data: eventInfo.data,
      timestamp: ts,
      ...(eventInfo.scope ? { scope: eventInfo.scope } : {}),
    };
    this.addToBuffer(buffered);

    // persister (best-effort, async)
    if (eventInfo.scope !== 'opentelemetry') {
      this.persistIfPossible(buffered).catch((err) => {
        console.error('[NodeLens] Persist event failed:', err);
      });
    }

    // broadcast
    for (const client of this.clients.values()) {
      this.sendToClient(client, eventInfo);
    }
  }

  destroy(): void {
    if (this.unsubscribe) this.unsubscribe();
    this.eventBuffer = [];
  }

  setHandshakeDataProvider(provider: () => unknown): void {
    this.getHandshakeData = provider;
  }

  private async persistIfPossible(ev: BufferedEvent): Promise<void> {
    if (!this.store) return;

    try {
      await this.store.append(ev.scope ?? 'default', ev.event, ev.data);
    } catch (error: unknown) {
      // Handle lock contention gracefully - don't spam the logs
      if (error instanceof LockContentionError) {
        // Silently skip this persistence attempt during high contention
        return;
      }

      // Log other errors but don't throw to avoid disrupting the SSE flow
      const err = error as Error;
      console.warn('[NodeLens] Persist event skipped due to error:', err.message);
    }
  }  private addToBuffer(eventInfo: BufferedEvent): void {
    this.eventBuffer.push(eventInfo);
    this.cleanupBuffer();
  }

  private cleanupBuffer(): void {
    const now = Date.now();
    const maxAge = this.opts.bufferMaxAge ?? BUFFER_MAX_AGE_DEFAULT;
    const maxSize = this.opts.bufferSize ?? BUFFER_SIZE_DEFAULT;

    this.eventBuffer = this.eventBuffer.filter((e) => now - e.timestamp <= maxAge);
    if (this.eventBuffer.length > maxSize) {
      this.eventBuffer = this.eventBuffer.slice(-maxSize);
    }
  }

  private replayBufferedEvents(client: SseClient): void {
    this.cleanupBuffer();
    for (const event of this.eventBuffer) {
      this.sendToClient(client, {
        event: event.event,
        data: event.data,
        scope: event.scope,
      });
    }
  }

  private sendToClient(client: SseClient, eventInfo: EventInfo): void {
    if (eventInfo.scope === 'opentelemetry') return; // Skip OTEL if wanted
    try {
      const message = `data: ${JSON.stringify(eventInfo)}\n\n`;
      client.res.write(message);
    } catch (error) {
      console.error(`[NodeLens] Error sending SSE to client ${client.id}:`, error);
      this.removeClient(client.id);
    }
  }

  private setupEventForwarding(): void {
    this.unsubscribe = this.eventBus.on('*', this.broadcast.bind(this));
  }
}
