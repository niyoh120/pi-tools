import {
  DEFAULT_TIMEOUT_MS,
  isExaToolControlError,
  toErrorMessage,
  withTimeoutAndAbort,
} from '../utils/abort.js';
import type { ResolvedConfig } from '../utils/config.js';
import { requireConfig } from '../utils/config.js';
import { getExaClient } from '../utils/exa-client.js';
import { formatFetchResults, textResult, toMetadata } from '../utils/format.js';

export const DEFAULT_WEB_FETCH_MAX_CHARACTERS = 3000;

export interface WebFetchParams {
  urls: string[];
  maxCharacters?: number;
  highlights?: boolean;
  summaryQuery?: string;
}

export async function performWebFetch(
  config: ResolvedConfig,
  params: WebFetchParams,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const resolved = requireConfig(config);
  const urls = params.urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  if (urls.length === 0) {
    throw new Error('web_fetch requires at least one non-empty URL.');
  }

  const exa = getExaClient(resolved.exaApiKey, resolved.exaBaseUrl);
  const maxCharacters =
    params.maxCharacters ?? DEFAULT_WEB_FETCH_MAX_CHARACTERS;
  if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
    throw new Error(
      `web_fetch maxCharacters must be a positive integer, got ${maxCharacters}.`,
    );
  }

  const contents: {
    text: { maxCharacters: number };
    highlights?: true;
    summary?: { query: string };
  } = {
    text: {
      maxCharacters,
    },
  };

  if (params.highlights) {
    contents.highlights = true;
  }

  const summaryQuery = params.summaryQuery?.trim();
  if (summaryQuery) {
    contents.summary = { query: summaryQuery };
  }

  try {
    const response = await withTimeoutAndAbort(
      (_combinedSignal) => exa.getContents(urls, contents),
      {
        signal,
        timeoutMs,
        toolName: 'web_fetch',
      },
    );

    if (!response.results || response.results.length === 0) {
      return textResult('No content found for the requested URLs.', {
        tool: 'web_fetch',
        ...toMetadata(response),
      });
    }

    return textResult(formatFetchResults(response.results), {
      tool: 'web_fetch',
      ...toMetadata(response),
    });
  } catch (error) {
    if (isExaToolControlError(error)) {
      throw error;
    }

    throw new Error(`Exa web_fetch error: ${toErrorMessage(error)}`, {
      cause: error,
    });
  }
}
