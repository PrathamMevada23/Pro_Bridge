import { browser } from 'wxt/browser';
import { normalizeApiBaseUrl } from './url.js';

export interface ExtensionSettings {
  apiBaseUrl: string;
  token: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: 'http://127.0.0.1:4317',
  token: '',
};

const SETTINGS_KEY = 'proBridgeSettings';

function readStoredSettings(value: unknown): ExtensionSettings {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS;
  }

  const record = value as Record<string, unknown>;
  const storedUrl = typeof record.apiBaseUrl === 'string' ? record.apiBaseUrl : '';
  const token = typeof record.token === 'string' ? record.token : '';
  let apiBaseUrl = DEFAULT_SETTINGS.apiBaseUrl;

  try {
    apiBaseUrl = normalizeApiBaseUrl(storedUrl);
  } catch {
    apiBaseUrl = DEFAULT_SETTINGS.apiBaseUrl;
  }

  return { apiBaseUrl, token };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);

  return readStoredSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
  const token = settings.token.trim();

  if (token.length === 0) {
    throw new Error('Enter the local API token from apps/core/.env.');
  }

  const normalized: ExtensionSettings = { apiBaseUrl, token };
  await browser.storage.local.set({ [SETTINGS_KEY]: normalized });

  return normalized;
}
