import { OTEL_TRACE_EVENT, type EventBus } from '@cisstech/node-lens-server'
import { describe, expect, it } from '@jest/globals'
import { DatabasePlugin } from './index'

describe('DatabasePlugin Integration', () => {
  it('should create plugin with default options', () => {
    const plugin = new DatabasePlugin()

    expect(plugin.packageName).toBe('@cisstech/node-lens-database')
    expect(plugin.displayName).toBe('Database')
    expect(plugin.icon).toBe('database')
    expect(plugin.tagName).toBe('nl-database')
  })

  it('should create plugin with custom options', () => {
    const plugin = new DatabasePlugin({
      redactParams: true,
      slowQueryMs: 100,
      duplicateBurstThreshold: 3,
    })

    expect(plugin.packageName).toBe('@cisstech/node-lens-database')
    // Options are private, but we can verify the plugin was created successfully
  })

  it('should provide instrumentation array', () => {
    const plugin = new DatabasePlugin()
    const instrumentations = plugin.instrumentations()

    expect(Array.isArray(instrumentations)).toBe(true)
    expect(instrumentations.length).toBeGreaterThan(0)

    // Check that we have all the expected instrumentations
    const instrumentationNames = instrumentations.map((i: { constructor: { name: string } }) => i.constructor.name)
    expect(instrumentationNames).toContain('PgInstrumentation')
    expect(instrumentationNames).toContain('MySQLInstrumentation')
    expect(instrumentationNames).toContain('MySQL2Instrumentation')
    expect(instrumentationNames).toContain('MongoDBInstrumentation')
    expect(instrumentationNames).toContain('MongooseInstrumentation')
    expect(instrumentationNames).toContain('RedisInstrumentation')
    expect(instrumentationNames).toContain('IORedisInstrumentation')
    expect(instrumentationNames).toContain('MemcachedInstrumentation')
    expect(instrumentationNames).toContain('OracleInstrumentation')
    expect(instrumentationNames).toContain('KnexInstrumentation')
  })

  it('should bind to event bus without errors', () => {
    const plugin = new DatabasePlugin()

    const mockEventBus: Partial<EventBus> = {
      on: jest.fn(),
      emit: jest.fn(),
    }

    expect(() => plugin.bindToEventBus(mockEventBus as EventBus)).not.toThrow()
    expect(mockEventBus.on).toHaveBeenCalledWith(OTEL_TRACE_EVENT, expect.any(Function))
  })
})
