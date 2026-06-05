import {
  DEFAULT_TIMEOUT_MS,
  isExaToolControlError,
  toErrorMessage,
  withTimeoutAndAbort,
} from '../utils/abort.js';
import type { ResolvedConfig } from '../utils/config.js';
import { requireConfig } from '../utils/config.js';
import { getExaClient } from '../utils/exa-client.js';
import {
  formatSearchResults,
  textResult,
  toMetadata,
} from '../utils/format.js';

export const DEFAULT_WEB_SEARCH_NUM_RESULTS = 5;
export const WEB_SEARCH_TEXT_MAX_CHARS = 500;
export const WEB_SEARCH_HIGHLIGHTS_MAX_CHARS = 600;

export interface WebSearchParams {
  query: string;
  numResults?: number;
}

export async function performWebSearch(
  config: ResolvedConfig,
  params: WebSearchParams,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const resolved = requireConfig(config);
  const query = params.query.trim();
  if (query.length === 0) {
    throw new Error('web_search query must not be empty.');
  }

  const exa = getExaClient(resolved.exaApiKey, resolved.exaBaseUrl);
  const numResults = params.numResults ?? DEFAULT_WEB_SEARCH_NUM_RESULTS;
  if (!Number.isInteger(numResults) || numResults <= 0) {
    throw new Error(
      `web_search numResults must be a positive integer, got ${numResults}.`,
    );
  }

  try {
    const response = await withTimeoutAndAbort(
      (_combinedSignal) =>
        exa.search(query, {
          type: 'auto',
          numResults,
          contents: {
            text: { maxCharacters: WEB_SEARCH_TEXT_MAX_CHARS },
            highlights: {
              query,
              maxCharacters: WEB_SEARCH_HIGHLIGHTS_MAX_CHARS,
            },
          },
        }),
      { signal, timeoutMs, toolName: 'web_search' },
    );

    if (!response.results || response.results.length === 0) {
      return textResult(
        'No search results found. Please try a different query.',
        {
          tool: 'web_search',
          ...toMetadata(response),
        },
      );
    }

    return textResult(formatSearchResults(response.results), {
      tool: 'web_search',
      ...toMetadata(response),
    });
  } catch (error) {
    if (isExaToolControlError(error)) {
      throw error;
    }

    throw new Error(`Exa web_search error: ${toErrorMessage(error)}`, {
      cause: error,
    });
  }
}
