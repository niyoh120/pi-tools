export const DEFAULT_TIMEOUT_MS = 60_000;

export interface TimeoutAndAbortOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  toolName: string;
}

export class ExaToolTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly toolName: string;

  constructor(timeoutMs: number, toolName: string) {
    super(`${toolName} timed out after ${timeoutMs}ms.`);
    this.name = 'ExaToolTimeoutError';
    this.timeoutMs = timeoutMs;
    this.toolName = toolName;
  }
}

export class ExaToolCancelledError extends Error {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`${toolName} was cancelled.`);
    this.name = 'ExaToolCancelledError';
    this.toolName = toolName;
  }
}

export function isExaToolControlError(
  error: unknown,
): error is ExaToolCancelledError | ExaToolTimeoutError {
  return (
    error instanceof ExaToolCancelledError ||
    error instanceof ExaToolTimeoutError
  );
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return String(error);
}

export function withTimeoutAndAbort<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  options: TimeoutAndAbortOptions,
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (options.signal?.aborted) {
    return Promise.reject(new ExaToolCancelledError(options.toolName));
  }

  const controller = new AbortController();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let externallyAborted = false;

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onExternalAbort);
      callback();
    };

    const onExternalAbort = (): void => {
      externallyAborted = true;
      controller.abort(options.signal?.reason);
      settle(() => reject(new ExaToolCancelledError(options.toolName)));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new ExaToolTimeoutError(timeoutMs, options.toolName));
      settle(() =>
        reject(new ExaToolTimeoutError(timeoutMs, options.toolName)),
      );
    }, timeoutMs);

    options.signal?.addEventListener('abort', onExternalAbort, { once: true });

    let promise: Promise<T>;
    try {
      promise = factory(controller.signal);
    } catch (error) {
      settle(() => reject(error));
      return;
    }

    promise.then(
      (value) => settle(() => resolve(value)),
      (error) => {
        if (timedOut || externallyAborted) {
          return;
        }

        settle(() => reject(error));
      },
    );
  });
}
