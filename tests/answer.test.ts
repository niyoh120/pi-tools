import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performAnswer } from '../src/tools/answer.js';
import { getExaClient } from '../src/utils/exa-client.js';

vi.mock('../src/utils/exa-client.js', () => ({
  getExaClient: vi.fn(),
}));

const mockedGetExaClient = vi.mocked(getExaClient);

describe('performAnswer', () => {
  const config = { exaApiKey: 'key', exaBaseUrl: 'https://api.exa.ai' };
  let answer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    answer = vi.fn();
    mockedGetExaClient.mockReturnValue({ answer } as never);
  });

  it('calls exa.answer with options and formats citations', async () => {
    answer.mockResolvedValue({
      answer: 'Grounded answer',
      requestId: 'req_1',
      costDollars: 0,
      citations: [
        {
          title: 'Source',
          url: 'https://example.com',
          publishedDate: '2026-01-01T00:00:00Z',
          author: 'Author',
        },
      ],
    });

    const result = await performAnswer(config, {
      query: ' what happened? ',
      systemPrompt: ' be concise ',
      text: true,
      outputSchema: { type: 'object' },
      userLocation: ' US ',
    });

    expect(answer).toHaveBeenCalledWith('what happened?', {
      model: 'exa',
      text: true,
      systemPrompt: 'be concise',
      outputSchema: { type: 'object' },
      userLocation: 'US',
    });
    expect(result.content[0].text).toContain('Grounded answer');
    expect(result.content[0].text).toContain('Citations:');
    expect(result.details).toEqual({
      tool: 'answer',
      requestId: 'req_1',
      costDollars: 0,
    });
  });

  it('formats structured answers as JSON', async () => {
    answer.mockResolvedValue({
      answer: { value: 42 },
      citations: [],
    });

    const result = await performAnswer(config, { query: 'return json' });

    expect(result.content[0].text).toContain('```json');
    expect(result.content[0].text).toContain('"value": 42');
  });

  it('does not duplicate citation URLs when titles are missing', async () => {
    answer.mockResolvedValue({
      answer: 'Answer',
      citations: [{ url: 'https://example.com' }],
    });

    const result = await performAnswer(config, { query: 'cite url' });

    expect(result.content[0].text).toContain('- https://example.com');
    expect(result.content[0].text).not.toContain(
      'https://example.com https://example.com',
    );
  });

  it('rejects empty queries before calling Exa', async () => {
    await expect(performAnswer(config, { query: '   ' })).rejects.toThrow(
      /query must not be empty/,
    );
    expect(answer).not.toHaveBeenCalled();
  });

  it('throws when the api key is missing', async () => {
    await expect(
      performAnswer({ exaBaseUrl: 'https://api.exa.ai' }, { query: 'hello' }),
    ).rejects.toThrow(/Exa API key is not configured/);
  });

  it('wraps sdk errors', async () => {
    answer.mockRejectedValue(new Error('network failed'));

    await expect(performAnswer(config, { query: 'hello' })).rejects.toThrow(
      /Exa answer error: network failed/,
    );
  });

  it('does not call answer when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      performAnswer(config, { query: 'hello' }, controller.signal),
    ).rejects.toThrow(/was cancelled/);
    expect(answer).not.toHaveBeenCalled();
  });
});
