import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EXA_BASE_URL,
  expandEnvVars,
  loadConfig,
  requireConfig,
} from '../src/utils/config.js';

function makeTempDir(): string {
  return join(tmpdir(), `pi-tools-${crypto.randomUUID()}`);
}

function writeSettings(path: string, config: unknown): void {
  mkdirSync(join(path, '.pi'), { recursive: true });
  writeFileSync(
    join(path, '.pi', 'settings.json'),
    JSON.stringify(config),
    'utf-8',
  );
}

function writeGlobalSettings(home: string, config: unknown): void {
  mkdirSync(join(home, '.pi', 'agent'), { recursive: true });
  writeFileSync(
    join(home, '.pi', 'agent', 'settings.json'),
    JSON.stringify(config),
    'utf-8',
  );
}

describe('config', () => {
  let cwd: string;
  let home: string;

  beforeEach(() => {
    cwd = makeTempDir();
    home = makeTempDir();
    mkdirSync(cwd, { recursive: true });
    mkdirSync(home, { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('expands environment variable placeholders', () => {
    expect(
      expandEnvVars('key-' + '$' + '{EXA_API_KEY}' + '-' + '$' + '{MISSING}', {
        EXA_API_KEY: 'abc',
      }),
    ).toBe('key-abc-');
  });

  it('loads default base url when settings files are missing', () => {
    expect(loadConfig({ cwd, home, env: {} })).toEqual({
      exaApiKey: undefined,
      exaBaseUrl: DEFAULT_EXA_BASE_URL,
    });
  });

  it('merges global and project settings with project field precedence', () => {
    writeGlobalSettings(home, {
      'pi-tools': {
        exa_api_key: '${' + 'GLOBAL_KEY}',
        exa_base_url: 'https://global.example',
      },
    });
    writeSettings(cwd, {
      'pi-tools': {
        exa_base_url: 'https://project.example/',
      },
    });

    expect(
      loadConfig({ cwd, home, env: { GLOBAL_KEY: 'global-key' } }),
    ).toEqual({
      exaApiKey: 'global-key',
      exaBaseUrl: 'https://project.example/',
    });
  });

  it('treats undefined environment variables as missing values', () => {
    writeSettings(cwd, {
      'pi-tools': {
        exa_api_key: '${' + 'MISSING_KEY}',
        exa_base_url: '${' + 'MISSING_BASE_URL}',
      },
    });

    expect(loadConfig({ cwd, home, env: {} })).toEqual({
      exaApiKey: undefined,
      exaBaseUrl: DEFAULT_EXA_BASE_URL,
    });
  });

  it('ignores invalid JSON settings and continues with defaults', () => {
    mkdirSync(join(cwd, '.pi'), { recursive: true });
    writeFileSync(join(cwd, '.pi', 'settings.json'), '{ invalid json', 'utf-8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(loadConfig({ cwd, home, env: {} })).toEqual({
      exaApiKey: undefined,
      exaBaseUrl: DEFAULT_EXA_BASE_URL,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('throws a clear error when the api key is missing', () => {
    expect(() => requireConfig({ exaBaseUrl: DEFAULT_EXA_BASE_URL })).toThrow(
      /Exa API key is not configured/,
    );
  });
});
