import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_EXA_BASE_URL = 'https://api.exa.ai';
export const SETTINGS_KEY = 'pi-tools';

export interface RawPiToolsConfig {
  exa_api_key?: string;
  exa_base_url?: string;
}

export interface ResolvedConfig {
  exaApiKey?: string;
  exaBaseUrl: string;
}

interface LoadConfigOptions {
  cwd?: string;
  home?: string;
  env?: NodeJS.ProcessEnv;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function expandEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_match, name: string) => env[name] ?? '',
  );
}

function normalizeExpandedString(
  value: unknown,
  env: NodeJS.ProcessEnv,
): string | undefined {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  return normalizeString(expandEnvVars(normalized, env));
}

function parseRawConfig(value: unknown): RawPiToolsConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    exa_api_key: normalizeString(record.exa_api_key),
    exa_base_url: normalizeString(record.exa_base_url),
  };
}

function readSettingsConfig(path: string): RawPiToolsConfig | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseRawConfig(parsed[SETTINGS_KEY]);
  } catch (error) {
    const detail =
      error instanceof SyntaxError
        ? 'Invalid JSON format'
        : error instanceof Error
          ? error.message
          : String(error);
    console.warn(`[pi-tools] Failed to read settings ${path}: ${detail}`);
    return undefined;
  }
}

function mergeConfig(
  globalConfig?: RawPiToolsConfig,
  projectConfig?: RawPiToolsConfig,
): RawPiToolsConfig {
  return {
    exa_api_key: projectConfig?.exa_api_key ?? globalConfig?.exa_api_key,
    exa_base_url: projectConfig?.exa_base_url ?? globalConfig?.exa_base_url,
  };
}

export function getSettingsPaths(options: LoadConfigOptions = {}): {
  globalPath: string;
  projectPath: string;
} {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? process.env.HOME ?? homedir();

  return {
    globalPath: join(home, '.pi', 'agent', 'settings.json'),
    projectPath: join(cwd, '.pi', 'settings.json'),
  };
}

export function loadConfig(options: LoadConfigOptions = {}): ResolvedConfig {
  const env = options.env ?? process.env;
  const { globalPath, projectPath } = getSettingsPaths(options);
  const globalConfig = readSettingsConfig(globalPath);
  const projectConfig = readSettingsConfig(projectPath);
  const merged = mergeConfig(globalConfig, projectConfig);

  return {
    exaApiKey: normalizeExpandedString(merged.exa_api_key, env),
    exaBaseUrl:
      normalizeExpandedString(merged.exa_base_url, env) ?? DEFAULT_EXA_BASE_URL,
  };
}

export function requireConfig(
  config: ResolvedConfig,
): Required<ResolvedConfig> {
  if (!config.exaApiKey) {
    throw new Error(
      'Exa API key is not configured. Set pi-tools.exa_api_key in .pi/settings.json or ~/.pi/agent/settings.json, for example "' +
        '$' +
        '{EXA_API_KEY}' +
        '".',
    );
  }

  return {
    exaApiKey: config.exaApiKey,
    exaBaseUrl: config.exaBaseUrl,
  };
}
