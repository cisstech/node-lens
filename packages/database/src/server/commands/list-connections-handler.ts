import { BaseCommandHandler } from '@cisstech/node-lens-server'
import { DatabaseConnection, ListConnectionsResult } from '../types'

/**
 * Command handler for listing available database connections
 */
export class ListConnectionsCommandHandler extends BaseCommandHandler {
  constructor(private connections: DatabaseConnection[] = []) {
    super()
  }

  protected canHandle(command: string): boolean {
    return command === 'list-connections'
  }

  protected async execute(): Promise<ListConnectionsResult> {
    return { connections: this.connections }
  }
}
