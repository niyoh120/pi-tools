import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { joinUrl, performCodeSearch } from '../src/tools/code-search.js';

describe('performCodeSearch', () => {
  const config = { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai/' };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('joins URLs safely', () => {
    expect(joinUrl('https://api.exa.ai/', '/context')).toBe(
      'https://api.exa.ai/context',
    );
  });

  it('posts to /context with headers and body', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: 'req_1',
          response: 'code context',
          resultsCount: 12,
          outputTokens: 345,
          costDollars: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await performCodeSearch(config, {
      query: ' react hooks ',
      tokensNum: 5000,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.exa.ai/context', {
      method: 'POST',
      signal: expect.any(AbortSignal),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': 'key',
      },
      body: JSON.stringify({ query: 'react hooks', tokensNum: 5000 }),
    });
    expect(result.content[0].text).toBe('code context');
    expect(result.details).toEqual({
      tool: 'code_search',
      requestId: 'req_1',
      resultsCount: 12,
      outputTokens: 345,
      costDollars: 0,
    });
  });

  it('defaults tokensNum to dynamic', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: 'context' }), { status: 200 }),
    );

    await performCodeSearch(config, { query: 'react hooks' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ query: 'react hooks', tokensNum: 'dynamic' }),
      }),
    );
  });

  it('throws on non-2xx responses with server error body', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Bad request', message: 'Invalid query' }),
        {
          status: 400,
          statusText: 'Bad Request',
        },
      ),
    );

    await expect(
      performCodeSearch(config, { query: 'react hooks' }),
    ).rejects.toThrow(/HTTP 400: Bad request\. Invalid query/);
  });

  it('throws on invalid JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));

    await expect(
      performCodeSearch(config, { query: 'react hooks' }),
    ).rejects.toThrow(/returned invalid JSON/);
  });

  it('throws when response field is missing', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ requestId: 'req_1' }), { status: 200 }),
    );

    await expect(
      performCodeSearch(config, { query: 'react hooks' }),
    ).rejects.toThrow(/without a response field/);
  });

  it('rejects empty queries before calling fetch', async () => {
    await expect(performCodeSearch(config, { query: '   ' })).rejects.toThrow(
      /query must not be empty/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid token counts before calling fetch', async () => {
    await expect(
      performCodeSearch(config, { query: 'react hooks', tokensNum: 0 }),
    ).rejects.toThrow(/tokensNum must be a positive integer/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the api key is missing', async () => {
    await expect(
      performCodeSearch(
        { exaBaseUrl: 'https://api.exa.ai' },
        { query: 'react hooks' },
      ),
    ).rejects.toThrow(/Exa API key is not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts the fetch signal on timeout', async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      receivedSignal = init.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    });

    const promise = performCodeSearch(
      config,
      { query: 'react hooks' },
      undefined,
      100,
    );
    const assertion = expect(promise).rejects.toThrow(/timed out/);

    await vi.advanceTimersByTimeAsync(100);

    await assertion;
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('does not call fetch when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      performCodeSearch(config, { query: 'react hooks' }, controller.signal),
    ).rejects.toThrow(/was cancelled/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
