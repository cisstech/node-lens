/**
 * Base class for all event store related errors
 */
export abstract class EventStoreError extends Error {
  abstract readonly code: string;
}

/**
 * Thrown when there's contention for file locks or other concurrency issues
 */
export class LockContentionError extends EventStoreError {
  readonly code = 'LOCK_CONTENTION';

  constructor(scope: string, operation: string) {
    super(`Lock contention for scope '${scope}' during ${operation}`);
    this.name = 'LockContentionError';
  }
}

/**
 * Thrown when an operation times out
 */
export class OperationTimeoutError extends EventStoreError {
  readonly code = 'OPERATION_TIMEOUT';

  constructor(scope: string, operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms for scope '${scope}'`);
    this.name = 'OperationTimeoutError';
  }
}
