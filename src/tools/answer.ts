import {
  DEFAULT_TIMEOUT_MS,
  isExaToolControlError,
  toErrorMessage,
  withTimeoutAndAbort,
} from '../utils/abort.js';
import type { ResolvedConfig } from '../utils/config.js';
import { requireConfig } from '../utils/config.js';
import { getExaClient } from '../utils/exa-client.js';
import { formatAnswerResult, textResult } from '../utils/format.js';

export interface AnswerParams {
  query: string;
  systemPrompt?: string;
  text?: boolean;
  outputSchema?: Record<string, unknown>;
  userLocation?: string;
}

export async function performAnswer(
  config: ResolvedConfig,
  params: AnswerParams,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const resolved = requireConfig(config);
  const query = params.query.trim();
  if (query.length === 0) {
    throw new Error('answer query must not be empty.');
  }

  const systemPrompt = params.systemPrompt?.trim();
  const userLocation = params.userLocation?.trim();
  const exa = getExaClient(resolved.exaApiKey, resolved.exaBaseUrl);

  try {
    const response = await withTimeoutAndAbort(
      (_combinedSignal) =>
        exa.answer(query, {
          model: 'exa',
          ...(typeof params.text === 'boolean' ? { text: params.text } : {}),
          ...(systemPrompt ? { systemPrompt } : {}),
          ...(params.outputSchema ? { outputSchema: params.outputSchema } : {}),
          ...(userLocation ? { userLocation } : {}),
        }),
      { signal, timeoutMs, toolName: 'answer' },
    );

    return textResult(formatAnswerResult(response), {
      tool: 'answer',
      ...(response.requestId ? { requestId: response.requestId } : {}),
      ...(response.costDollars !== null && response.costDollars !== undefined
        ? { costDollars: response.costDollars }
        : {}),
    });
  } catch (error) {
    if (isExaToolControlError(error)) {
      throw error;
    }

    throw new Error(`Exa answer error: ${toErrorMessage(error)}`, {
      cause: error,
    });
  }
}
