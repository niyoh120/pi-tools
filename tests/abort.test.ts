import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExaToolCancelledError,
  ExaToolTimeoutError,
  withTimeoutAndAbort,
} from '../src/utils/abort.js';

describe('withTimeoutAndAbort', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves successful factory results', async () => {
    const result = await withTimeoutAndAbort(() => Promise.resolve('ok'), {
      toolName: 'test_tool',
      timeoutMs: 100,
    });

    expect(result).toBe('ok');
  });

  it('rejects on timeout and aborts the combined signal', async () => {
    let receivedSignal: AbortSignal | undefined;
    const promise = withTimeoutAndAbort(
      (signal) => {
        receivedSignal = signal;
        return new Promise<string>(() => undefined);
      },
      { toolName: 'test_tool', timeoutMs: 100 },
    );

    const assertion =
      expect(promise).rejects.toBeInstanceOf(ExaToolTimeoutError);
    await vi.advanceTimersByTimeAsync(100);

    await assertion;
    expect(receivedSignal?.aborted).toBe(true);
    expect(receivedSignal?.reason).toBeInstanceOf(ExaToolTimeoutError);
  });

  it('rejects on external abort and aborts the combined signal', async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const promise = withTimeoutAndAbort(
      (signal) => {
        receivedSignal = signal;
        return new Promise<string>(() => undefined);
      },
      { toolName: 'test_tool', timeoutMs: 1000, signal: controller.signal },
    );

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(ExaToolCancelledError);
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('does not call the factory when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const factory = vi.fn(() => Promise.resolve('ok'));

    await expect(
      withTimeoutAndAbort(factory, {
        toolName: 'test_tool',
        timeoutMs: 100,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ExaToolCancelledError);
    expect(factory).not.toHaveBeenCalled();
  });

  it('handles late rejection after timeout', async () => {
    const promise = withTimeoutAndAbort(
      () =>
        new Promise<string>((_resolve, reject) => {
          setTimeout(() => reject(new Error('late failure')), 200);
        }),
      { toolName: 'test_tool', timeoutMs: 100 },
    );

    const assertion =
      expect(promise).rejects.toBeInstanceOf(ExaToolTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;

    await vi.advanceTimersByTimeAsync(100);
  });
});
