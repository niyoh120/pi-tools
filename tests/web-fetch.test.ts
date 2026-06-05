import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performWebFetch } from '../src/tools/web-fetch.js';
import { getExaClient } from '../src/utils/exa-client.js';

vi.mock('../src/utils/exa-client.js', () => ({
  getExaClient: vi.fn(),
}));

const mockedGetExaClient = vi.mocked(getExaClient);

describe('performWebFetch', () => {
  const config = { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' };
  let getContents: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getContents = vi.fn();
    mockedGetExaClient.mockReturnValue({ getContents } as never);
  });

  it('calls exa.getContents with content options', async () => {
    getContents.mockResolvedValue({
      results: [
        {
          title: 'Page',
          url: 'https://example.com',
          text: 'Full text',
          summary: 'Summary',
          highlights: ['Highlight'],
        },
      ],
      costDollars: { total: 0.001 },
    });

    const result = await performWebFetch(config, {
      urls: [' https://example.com '],
      maxCharacters: 123,
      highlights: true,
      summaryQuery: ' summarize ',
    });

    expect(getContents).toHaveBeenCalledWith(['https://example.com'], {
      text: { maxCharacters: 123 },
      highlights: true,
      summary: { query: 'summarize' },
    });
    expect(result.content[0].text).toContain('# Page');
    expect(result.details).toEqual({
      tool: 'web_fetch',
      costDollars: { total: 0.001 },
    });
  });

  it('uses the default maxCharacters', async () => {
    getContents.mockResolvedValue({ results: [] });

    await performWebFetch(config, { urls: ['https://example.com'] });

    expect(getContents).toHaveBeenCalledWith(['https://example.com'], {
      text: { maxCharacters: 3000 },
    });
  });

  it('throws when the api key is missing', async () => {
    await expect(
      performWebFetch(
        { exaBaseUrl: 'https://api.exa.ai' },
        { urls: ['https://example.com'] },
      ),
    ).rejects.toThrow(/Exa API key is not configured/);
  });

  it('wraps sdk errors', async () => {
    getContents.mockRejectedValue(new Error('network failed'));

    await expect(
      performWebFetch(config, { urls: ['https://example.com'] }),
    ).rejects.toThrow(/Exa web_fetch error: network failed/);
  });

  it('rejects empty URL arrays before calling Exa', async () => {
    await expect(performWebFetch(config, { urls: [] })).rejects.toThrow(
      /requires at least one non-empty URL/,
    );
    expect(getContents).not.toHaveBeenCalled();
  });

  it('rejects blank URLs before calling Exa', async () => {
    await expect(performWebFetch(config, { urls: ['   '] })).rejects.toThrow(
      /requires at least one non-empty URL/,
    );
    expect(getContents).not.toHaveBeenCalled();
  });

  it('rejects invalid maxCharacters before calling Exa', async () => {
    await expect(
      performWebFetch(config, {
        urls: ['https://example.com'],
        maxCharacters: 0,
      }),
    ).rejects.toThrow(/maxCharacters must be a positive integer/);
    expect(getContents).not.toHaveBeenCalled();
  });

  it('does not call getContents when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      performWebFetch(
        config,
        { urls: ['https://example.com'] },
        controller.signal,
      ),
    ).rejects.toThrow(/was cancelled/);
    expect(getContents).not.toHaveBeenCalled();
  });
});
