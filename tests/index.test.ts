import { beforeEach, describe, expect, it, vi } from 'vitest';
import piToolsExtension from '../src/index.js';
import { performAnswer } from '../src/tools/answer.js';
import { performCodeSearch } from '../src/tools/code-search.js';
import { performWebFetch } from '../src/tools/web-fetch.js';
import { performWebSearch } from '../src/tools/web-search.js';
import { loadConfig } from '../src/utils/config.js';

vi.mock('../src/utils/config.js', () => ({
  loadConfig: vi.fn(() => ({
    exaApiKey: 'key',
    exaBaseUrl: 'https://api.exa.ai',
  })),
}));

vi.mock('../src/tools/web-search.js', () => ({
  performWebSearch: vi.fn(() =>
    Promise.resolve({
      content: [{ type: 'text', text: 'web' }],
      details: { tool: 'web_search' },
    }),
  ),
}));

vi.mock('../src/tools/web-fetch.js', () => ({
  performWebFetch: vi.fn(() =>
    Promise.resolve({
      content: [{ type: 'text', text: 'fetch' }],
      details: { tool: 'web_fetch' },
    }),
  ),
}));

vi.mock('../src/tools/answer.js', () => ({
  performAnswer: vi.fn(() =>
    Promise.resolve({
      content: [{ type: 'text', text: 'answer' }],
      details: { tool: 'answer' },
    }),
  ),
}));

vi.mock('../src/tools/code-search.js', () => ({
  performCodeSearch: vi.fn(() =>
    Promise.resolve({
      content: [{ type: 'text', text: 'code' }],
      details: { tool: 'code_search' },
    }),
  ),
}));

interface RegisteredTool {
  name: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<unknown>;
}

describe('piToolsExtension', () => {
  const registeredTools: RegisteredTool[] = [];

  beforeEach(() => {
    registeredTools.length = 0;
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      exaApiKey: 'key',
      exaBaseUrl: 'https://api.exa.ai',
    });
  });

  function registerExtension(): void {
    piToolsExtension({
      registerTool(tool: RegisteredTool) {
        registeredTools.push(tool);
      },
    } as never);
  }

  it('registers the four Exa tools with schemas', () => {
    registerExtension();

    expect(registeredTools.map((tool) => tool.name)).toEqual([
      'web_search',
      'web_fetch',
      'answer',
      'code_search',
    ]);
    for (const tool of registeredTools) {
      expect(tool.parameters).toBeTruthy();
    }
  });

  it('passes config, params, and signal to web_search', async () => {
    registerExtension();
    const signal = new AbortController().signal;
    const tool = registeredTools.find((item) => item.name === 'web_search');

    await tool?.execute('call_1', { query: 'hello' }, signal);

    expect(performWebSearch).toHaveBeenCalledWith(
      { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' },
      { query: 'hello' },
      signal,
    );
  });

  it('passes config, params, and signal to web_fetch', async () => {
    registerExtension();
    const signal = new AbortController().signal;
    const tool = registeredTools.find((item) => item.name === 'web_fetch');

    await tool?.execute('call_1', { urls: ['https://example.com'] }, signal);

    expect(performWebFetch).toHaveBeenCalledWith(
      { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' },
      { urls: ['https://example.com'] },
      signal,
    );
  });

  it('passes config, params, and signal to answer', async () => {
    registerExtension();
    const signal = new AbortController().signal;
    const tool = registeredTools.find((item) => item.name === 'answer');

    await tool?.execute('call_1', { query: 'question' }, signal);

    expect(performAnswer).toHaveBeenCalledWith(
      { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' },
      { query: 'question' },
      signal,
    );
  });

  it('passes config, params, and signal to code_search', async () => {
    registerExtension();
    const signal = new AbortController().signal;
    const tool = registeredTools.find((item) => item.name === 'code_search');

    await tool?.execute('call_1', { query: 'react hooks' }, signal);

    expect(performCodeSearch).toHaveBeenCalledWith(
      { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' },
      { query: 'react hooks' },
      signal,
    );
  });

  it('lets missing key errors propagate from perform functions', async () => {
    vi.mocked(performCodeSearch).mockRejectedValueOnce(
      new Error('Exa API key is not configured'),
    );
    registerExtension();
    const tool = registeredTools.find((item) => item.name === 'code_search');

    await expect(
      tool?.execute('call_1', { query: 'react hooks' }),
    ).rejects.toThrow(/Exa API key is not configured/);
  });
});
