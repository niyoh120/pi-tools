import { Exa } from 'exa-js';

const clients = new Map<string, Exa>();

export function getExaClient(apiKey: string, baseUrl: string): Exa {
  const cacheKey = `${baseUrl}\u0000${apiKey}`;
  const existing = clients.get(cacheKey);
  if (existing) {
    return existing;
  }

  const client = new Exa(apiKey, baseUrl);
  clients.set(cacheKey, client);
  return client;
}

export function resetExaClientCache(): void {
  clients.clear();
}
