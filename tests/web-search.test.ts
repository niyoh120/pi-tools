import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performWebSearch } from '../src/tools/web-search.js';
import { getExaClient } from '../src/utils/exa-client.js';

vi.mock('../src/utils/exa-client.js', () => ({
  getExaClient: vi.fn(),
}));

const mockedGetExaClient = vi.mocked(getExaClient);

describe('performWebSearch', () => {
  const config = { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' };
  let search: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    search = vi.fn();
    mockedGetExaClient.mockReturnValue({ search } as never);
  });

  it('calls exa.search with auto search and fixed content options', async () => {
    search.mockResolvedValue({
      results: [
        {
          title: 'Result',
          url: 'https://example.com',
          publishedDate: '2026-01-02T00:00:00Z',
          author: 'Author',
          highlights: ['Relevant highlight'],
        },
      ],
      searchTime: 1.23,
      costDollars: 0,
    });

    const result = await performWebSearch(config, {
      query: ' hello ',
      numResults: 2,
    });

    expect(search).toHaveBeenCalledWith('hello', {
      type: 'auto',
      numResults: 2,
      contents: {
        text: { maxCharacters: 500 },
        highlights: {
          query: 'hello',
          maxCharacters: 600,
        },
      },
    });
    expect(result.content[0].text).toContain('Title: Result');
    expect(result.details).toEqual({
      tool: 'web_search',
      searchTime: 1.23,
      costDollars: 0,
    });
  });

  it('uses the default number of results', async () => {
    search.mockResolvedValue({ results: [] });

    await performWebSearch(config, { query: 'hello' });

    expect(search).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ numResults: 5 }),
    );
  });

  it('throws when the api key is missing', async () => {
    await expect(
      performWebSearch(
        { exaBaseUrl: 'https://api.exa.ai' },
        { query: 'hello' },
      ),
    ).rejects.toThrow(/Exa API key is not configured/);
  });

  it('wraps sdk errors', async () => {
    search.mockRejectedValue(new Error('network failed'));

    await expect(performWebSearch(config, { query: 'hello' })).rejects.toThrow(
      /Exa web_search error: network failed/,
    );
  });

  it('rejects empty queries before calling Exa', async () => {
    await expect(performWebSearch(config, { query: '   ' })).rejects.toThrow(
      /query must not be empty/,
    );
    expect(search).not.toHaveBeenCalled();
  });

  it('rejects invalid numResults before calling Exa', async () => {
    await expect(
      performWebSearch(config, { query: 'hello', numResults: 0 }),
    ).rejects.toThrow(/numResults must be a positive integer/);
    expect(search).not.toHaveBeenCalled();
  });

  it('does not call exa.search when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      performWebSearch(config, { query: 'hello' }, controller.signal),
    ).rejects.toThrow(/was cancelled/);
    expect(search).not.toHaveBeenCalled();
  });
});
