import {
  DEFAULT_TIMEOUT_MS,
  isExaToolControlError,
  toErrorMessage,
  withTimeoutAndAbort,
} from '../utils/abort.js';
import type { ResolvedConfig } from '../utils/config.js';
import { requireConfig } from '../utils/config.js';
import { textResult } from '../utils/format.js';

export type CodeSearchTokens = 'dynamic' | number;

export interface CodeSearchParams {
  query: string;
  tokensNum?: CodeSearchTokens;
}

interface CodeSearchResponse {
  requestId?: string;
  query?: string;
  response?: string;
  resultsCount?: number;
  costDollars?: unknown;
  searchTime?: number;
  outputTokens?: number;
}

type CodeSearchSuccessResponse = CodeSearchResponse & { response: string };

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const error = typeof body.error === 'string' ? body.error : undefined;
    const message = typeof body.message === 'string' ? body.message : undefined;
    return (
      [error, message].filter(Boolean).join('. ') ||
      response.statusText ||
      'Unknown error'
    );
  } catch {
    return response.statusText || 'Unknown error';
  }
}

function toDetails(result: CodeSearchSuccessResponse): Record<string, unknown> {
  return {
    tool: 'code_search',
    ...(result.requestId ? { requestId: result.requestId } : {}),
    ...(typeof result.resultsCount === 'number'
      ? { resultsCount: result.resultsCount }
      : {}),
    ...(result.costDollars !== null && result.costDollars !== undefined
      ? { costDollars: result.costDollars }
      : {}),
    ...(typeof result.searchTime === 'number'
      ? { searchTime: result.searchTime }
      : {}),
    ...(typeof result.outputTokens === 'number'
      ? { outputTokens: result.outputTokens }
      : {}),
  };
}

export async function performCodeSearch(
  config: ResolvedConfig,
  params: CodeSearchParams,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const resolved = requireConfig(config);
  const query = params.query.trim();
  if (query.length === 0) {
    throw new Error('code_search query must not be empty.');
  }

  const tokensNum = params.tokensNum ?? 'dynamic';
  if (
    typeof tokensNum === 'number' &&
    (!Number.isInteger(tokensNum) || tokensNum <= 0)
  ) {
    throw new Error(
      `code_search tokensNum must be a positive integer or 'dynamic', got ${tokensNum}.`,
    );
  }

  const url = joinUrl(resolved.exaBaseUrl, '/context');

  try {
    const result = await withTimeoutAndAbort(
      async (combinedSignal) => {
        const response = await fetch(url, {
          method: 'POST',
          signal: combinedSignal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': resolved.exaApiKey,
          },
          body: JSON.stringify({ query, tokensNum }),
        });

        if (!response.ok) {
          const errorBody = await readErrorBody(response);
          throw new Error(
            `Exa code_search returned HTTP ${response.status}: ${errorBody}`,
          );
        }

        let body: CodeSearchResponse;
        try {
          body = (await response.json()) as CodeSearchResponse;
        } catch (error) {
          throw new Error(
            `Exa code_search returned invalid JSON: ${toErrorMessage(error)}`,
          );
        }

        if (typeof body.response !== 'string') {
          throw new Error(
            'Exa code_search returned an unexpected response without a response field.',
          );
        }

        return body as CodeSearchSuccessResponse;
      },
      { signal, timeoutMs, toolName: 'code_search' },
    );

    return textResult(result.response, toDetails(result));
  } catch (error) {
    if (isExaToolControlError(error)) {
      throw error;
    }

    throw new Error(`Exa code_search error: ${toErrorMessage(error)}`, {
      cause: error,
    });
  }
}
