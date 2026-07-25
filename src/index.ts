import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { performAnswer } from './tools/answer.js';
import { performCodeSearch } from './tools/code-search.js';
import { performWebFetch } from './tools/web-fetch.js';
import { performWebSearch } from './tools/web-search.js';
import { loadConfig } from './utils/config.js';

const WebSearchParams = Type.Object({
  query: Type.String({
    description: 'Natural language web search query',
    minLength: 1,
  }),
  numResults: Type.Optional(
    Type.Integer({
      description: 'Number of search results to return. Default 5.',
      minimum: 1,
      maximum: 20,
      default: 5,
    }),
  ),
});

const WebFetchParams = Type.Object({
  urls: Type.Array(Type.String(), {
    description: 'URLs to fetch via Exa contents extraction',
    minItems: 1,
    maxItems: 20,
  }),
  maxCharacters: Type.Optional(
    Type.Integer({
      description: 'Maximum text characters per fetched page. Default 3000.',
      minimum: 1,
      default: 3000,
    }),
  ),
  highlights: Type.Optional(
    Type.Boolean({ description: 'Whether to request Exa highlights.' }),
  ),
  summaryQuery: Type.Optional(
    Type.String({
      description: 'Optional query guiding Exa summary generation.',
    }),
  ),
});

const CodeSearchParams = Type.Object({
  query: Type.String({
    description: 'Coding question or API/library usage query',
    minLength: 1,
    maxLength: 2000,
  }),
  tokensNum: Type.Optional(
    Type.Union([
      Type.Literal('dynamic', {
        description:
          'Let Exa dynamically allocate tokens based on query complexity.',
      }),
      Type.Integer({
        description: 'Specific token budget for Exa Code response.',
        minimum: 50,
        maximum: 100000,
      }),
    ]),
  ),
});

const AnswerParams = Type.Object({
  query: Type.String({
    description: 'Question to answer with Exa grounded citations',
    minLength: 1,
  }),
  systemPrompt: Type.Optional(
    Type.String({ description: 'Optional system prompt guiding the answer.' }),
  ),
  text: Type.Optional(
    Type.Boolean({
      description: 'Whether to include source text in citations.',
    }),
  ),
  outputSchema: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: 'Optional JSON schema for structured answer output.',
    }),
  ),
  userLocation: Type.Optional(
    Type.String({ description: 'Optional user location, such as US.' }),
  ),
});

export default function piToolsExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'web_search',
    label: 'Web Search',
    description:
      'Search the web with Exa auto search and return concise results with highlights.',
    promptSnippet: 'Search the web with Exa auto mode.',
    promptGuidelines: [
      'Use web_search to discover pages, then web_fetch to read selected URLs.',
    ],
    parameters: WebSearchParams,
    async execute(_toolCallId, params, signal) {
      return performWebSearch(loadConfig(), params, signal);
    },
  });

  pi.registerTool({
    name: 'web_fetch',
    label: 'Web Fetch',
    description:
      'Fetch clean text content from known URLs using Exa contents extraction.',
    promptSnippet: 'Read known URLs as clean page text via Exa.',
    parameters: WebFetchParams,
    async execute(_toolCallId, params, signal) {
      return performWebFetch(loadConfig(), params, signal);
    },
  });

  pi.registerTool({
    name: 'answer',
    label: 'Answer',
    description: 'Generate a grounded answer with Exa citations.',
    promptSnippet: 'Answer questions with Exa grounded citations.',
    parameters: AnswerParams,
    async execute(_toolCallId, params, signal) {
      return performAnswer(loadConfig(), params, signal);
    },
  });

  pi.registerTool({
    name: 'code_search',
    label: 'Code Search',
    description:
      'Get token-efficient coding context and examples from Exa Code.',
    promptSnippet: 'Find current code examples and library APIs via Exa Code.',
    promptGuidelines: [
      'Use code_search for current third-party library and SDK APIs.',
    ],
    parameters: CodeSearchParams,
    async execute(_toolCallId, params, signal) {
      return performCodeSearch(loadConfig(), params, signal);
    },
  });
}
