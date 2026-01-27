import { describe, it, expect } from '@jest/globals'
import { BaseCommandHandler, CommandChain } from './commands'

// Mock command handlers for testing
class MockHandler1 extends BaseCommandHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected canHandle(command: string, _payload?: unknown): boolean {
    return command === 'test1'
  }

  protected async execute(payload?: unknown): Promise<string> {
    return `Handler1 executed test1 with ${JSON.stringify(payload)}`
  }
}

class MockHandler2 extends BaseCommandHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected canHandle(command: string, _payload?: unknown): boolean {
    return command === 'test2'
  }

  protected async execute(payload?: unknown): Promise<string> {
    return `Handler2 executed test2 with ${JSON.stringify(payload)}`
  }
}

class MockHandler3 extends BaseCommandHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected canHandle(command: string, _payload?: unknown): boolean {
    return command === 'test3'
  }

  protected async execute(payload?: unknown): Promise<string> {
    return `Handler3 executed test3 with ${JSON.stringify(payload)}`
  }
}

describe('CommandChain', () => {
  it('should execute command with first matching handler', async () => {
    const chain = new CommandChain()
      .addHandler(new MockHandler1())
      .addHandler(new MockHandler2())
      .addHandler(new MockHandler3())

    const result = await chain.execute('test2', { data: 'test' })
    expect(result).toBe('Handler2 executed test2 with {"data":"test"}')
  })

  it('should pass command through chain until matching handler found', async () => {
    const chain = new CommandChain()
      .addHandler(new MockHandler1())
      .addHandler(new MockHandler2())
      .addHandler(new MockHandler3())

    const result = await chain.execute('test3', { data: 'test' })
    expect(result).toBe('Handler3 executed test3 with {"data":"test"}')
  })

  it('should throw error for unknown command', async () => {
    const chain = new CommandChain()
      .addHandler(new MockHandler1())
      .addHandler(new MockHandler2())

    await expect(chain.execute('unknown', {})).rejects.toThrow('Unknown command: unknown')
  })

  it('should throw error when no handlers configured', async () => {
    const chain = new CommandChain()

    await expect(chain.execute('test1', {})).rejects.toThrow('No command handlers configured')
  })

  it('should handle chain with single handler', async () => {
    const chain = new CommandChain()
      .addHandler(new MockHandler1())

    const result = await chain.execute('test1', { single: true })
    expect(result).toBe('Handler1 executed test1 with {"single":true}')
  })

  it('should execute first handler when multiple handlers can handle same command', async () => {
    class DuplicateHandler extends BaseCommandHandler {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      protected canHandle(command: string, _payload?: unknown): boolean {
        return command === 'test1' // Same as MockHandler1
      }

      protected async execute(command: string): Promise<string> {
        return `Duplicate handler executed ${command}`
      }
    }

    const chain = new CommandChain()
      .addHandler(new MockHandler1())
      .addHandler(new DuplicateHandler())

    const result = await chain.execute('test1', {})
    expect(result).toBe('Handler1 executed test1 with {}')
  })
})

describe('BaseCommandHandler', () => {
  it('should set next handler and create chain', () => {
    const handler1 = new MockHandler1()
    const handler2 = new MockHandler2()

    const nextHandler = handler1.setNext(handler2)
    expect(nextHandler).toBe(handler2)
  })

  it('should delegate to next handler when cannot handle command', async () => {
    const handler1 = new MockHandler1()
    const handler2 = new MockHandler2()

    handler1.setNext(handler2)

    const result = await handler1.handle('test2', { delegated: true })
    expect(result).toBe('Handler2 executed test2 with {"delegated":true}')
  })

  it('should throw error when no handler in chain can handle command', async () => {
    const handler1 = new MockHandler1()
    const handler2 = new MockHandler2()

    handler1.setNext(handler2)

    await expect(handler1.handle('unknown', {})).rejects.toThrow('Unknown command: unknown')
  })
})
