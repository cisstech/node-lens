/**
 * Base interface for command handlers in the chain of responsibility pattern
 */
export interface CommandHandler<TPayload = unknown> {
  /**
   * Set the next handler in the chain
   */
  setNext(handler: CommandHandler): CommandHandler

  /**
   * Handle the command if possible, otherwise pass to next handler
   */
  handle(command: string, payload?: TPayload): Promise<unknown>
}

/**
 * Abstract base class for command handlers
 */
export abstract class BaseCommandHandler<TPayload = unknown> implements CommandHandler<TPayload> {
  private nextHandler?: CommandHandler<TPayload>

  setNext(handler: CommandHandler<TPayload>): CommandHandler<TPayload> {
    this.nextHandler = handler
    return handler
  }

  async handle(command: string, payload?: TPayload): Promise<unknown> {
    if (this.canHandle(command, payload)) {
      return this.execute(payload)
    }

    if (this.nextHandler) {
      return this.nextHandler.handle(command, payload)
    }

    throw new Error(`Unknown command: ${command}`)
  }

  /**
   * Check if this handler can process the command
   */
  protected abstract canHandle(command: string, payload?: TPayload): boolean

  /**
   * Execute the command - only called if canHandle returns true
   */
  protected abstract execute(payload?: TPayload): Promise<unknown>
}

/**
 * Command chain that manages a sequence of command handlers
 */
export class CommandChain {
  private firstHandler?: CommandHandler

  /**
   * Add a handler to the chain
   */
  addHandler(handler: CommandHandler): CommandChain {
    if (!this.firstHandler) {
      this.firstHandler = handler
    } else {
      // Find the last handler in the chain
      let current = this.firstHandler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      while ((current as any).nextHandler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current = (current as any).nextHandler
      }
      current.setNext(handler)
    }
    return this
  }

  /**
   * Execute a command through the chain
   */
  async execute(command: string, payload?: unknown): Promise<unknown> {
    if (!this.firstHandler) {
      throw new Error('No command handlers configured')
    }

    return this.firstHandler.handle(command, payload)
  }
}
