import type { Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

/**
 * Get settings from chrome.storage.local
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings || DEFAULT_SETTINGS;
}

/**
 * Save settings to chrome.storage.local
 */
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}
