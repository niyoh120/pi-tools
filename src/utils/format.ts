interface FormattableResult {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  author?: string | null;
  highlights?: string[] | null;
  summary?: string | null;
  text?: string | null;
}

interface ResponseMetadata {
  costDollars?: unknown;
  searchTime?: number;
}

interface AnswerCitation {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  author?: string | null;
}

interface AnswerResponseLike {
  answer: string | Record<string, unknown>;
  citations?: AnswerCitation[];
}

export function formatPublishedDate(
  date: string | null | undefined,
): string | undefined {
  if (!date) {
    return undefined;
  }

  return date.split('T')[0];
}

export function formatSearchResults(results: FormattableResult[]): string {
  if (results.length === 0) {
    return 'No search results found.';
  }

  return results
    .map((result) => {
      const lines = [
        `Title: ${result.title || 'N/A'}`,
        `URL: ${result.url || 'N/A'}`,
        `Published: ${formatPublishedDate(result.publishedDate) || 'N/A'}`,
        `Author: ${result.author || 'N/A'}`,
      ];

      // Search output stays concise: highlights take precedence over fuller summary/text.
      if (Array.isArray(result.highlights) && result.highlights.length > 0) {
        lines.push(
          'Highlights:',
          ...result.highlights.map((highlight) => `- ${highlight}`),
        );
      } else if (result.summary) {
        lines.push('Summary:', result.summary);
      } else if (result.text) {
        lines.push('Text:', result.text);
      }

      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

export function formatFetchResults(results: FormattableResult[]): string {
  if (results.length === 0) {
    return 'No content found.';
  }

  return results
    .map((result) => {
      const lines = [
        `# ${result.title || '(no title)'}`,
        `URL: ${result.url || 'N/A'}`,
      ];
      const published = formatPublishedDate(result.publishedDate);

      if (published) {
        lines.push(`Published: ${published}`);
      }

      if (result.author) {
        lines.push(`Author: ${result.author}`);
      }

      if (Array.isArray(result.highlights) && result.highlights.length > 0) {
        lines.push(
          '',
          'Highlights:',
          ...result.highlights.map((highlight) => `- ${highlight}`),
        );
      }

      if (result.summary) {
        lines.push('', 'Summary:', result.summary);
      }

      if (result.text) {
        lines.push('', result.text);
      }

      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

export function formatAnswerResult(response: AnswerResponseLike): string {
  const answer =
    typeof response.answer === 'string'
      ? response.answer
      : ['```json', JSON.stringify(response.answer, null, 2), '```'].join('\n');

  if (!Array.isArray(response.citations) || response.citations.length === 0) {
    return answer;
  }

  const citations = response.citations.map((citation) => {
    const details = [
      formatPublishedDate(citation.publishedDate),
      citation.author,
    ].filter(Boolean);
    const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
    if (citation.title) {
      return `- ${citation.title} ${citation.url || 'N/A'}${suffix}`;
    }

    return `- ${citation.url || 'Untitled'}${suffix}`;
  });

  return [answer, '', 'Citations:', ...citations].join('\n');
}

export function toMetadata(
  response: ResponseMetadata,
): Record<string, unknown> {
  return {
    ...(response.costDollars !== null && response.costDollars !== undefined
      ? { costDollars: response.costDollars }
      : {}),
    ...(typeof response.searchTime === 'number'
      ? { searchTime: response.searchTime }
      : {}),
  };
}

export function textResult<TDetails extends Record<string, unknown>>(
  text: string,
  details: TDetails,
) {
  return {
    content: [{ type: 'text' as const, text }],
    details,
  };
}
