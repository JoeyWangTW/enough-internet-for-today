import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../utils';

// Get DOM elements
const siteStatus = document.getElementById('site-status') as HTMLDivElement;
const statusText = siteStatus.querySelector('.status-text') as HTMLSpanElement;
const keywordFilterEnabled = document.getElementById('keyword-filter-enabled') as HTMLInputElement;
const keywordCountEl = document.getElementById('keyword-count') as HTMLSpanElement;
const keywordSettings = document.getElementById('keyword-settings') as HTMLDivElement;
const keywordsTextarea = document.getElementById('keywords') as HTMLTextAreaElement;
const simplifiedChineseFilterEnabled = document.getElementById('simplified-chinese-filter-enabled') as HTMLInputElement;
const aiFilterEnabled = document.getElementById('ai-filter-enabled') as HTMLInputElement;
const aiStatusEl = document.getElementById('ai-status') as HTMLSpanElement;
const aiSettings = document.getElementById('ai-settings') as HTMLDivElement;
const filterDescriptionInput = document.getElementById('filter-description') as HTMLInputElement;
const apiKeyNotice = document.getElementById('api-key-notice') as HTMLDivElement;
const setupApiKeyBtn = document.getElementById('setup-api-key') as HTMLButtonElement;
const allowRevealInput = document.getElementById('allow-reveal') as HTMLInputElement;
const siteToggleSection = document.getElementById('site-toggle-section') as HTMLElement;
const currentDomainEl = document.getElementById('current-domain') as HTMLSpanElement;
const toggleSiteBtn = document.getElementById('toggle-site') as HTMLButtonElement;
const openSettingsBtn = document.getElementById('open-settings') as HTMLButtonElement;

// Current settings and domain
let currentSettings: Settings = DEFAULT_SETTINGS;
let currentDomain: string | null = null;

// Debounce timer for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check if current domain is enabled
 */
function isDomainEnabled(domain: string): boolean {
  return currentSettings.enabledDomains.some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  );
}

/**
 * Count keywords from string
 */
function countKeywords(keywordsString: string): number {
  if (!keywordsString.trim()) return 0;
  return keywordsString
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0).length;
}

/**
 * Update visibility of filter settings panels
 */
function updateFilterPanels(): void {
  // Keyword settings visibility
  keywordSettings.classList.toggle('visible', keywordFilterEnabled.checked);

  // AI settings visibility
  aiSettings.classList.toggle('visible', aiFilterEnabled.checked);

  // API key notice visibility (only show if AI enabled but no API key)
  const needsApiKey = aiFilterEnabled.checked && !currentSettings.groqApiKey;
  apiKeyNotice.classList.toggle('visible', needsApiKey);
}

/**
 * Update UI based on current settings
 */
function updateUI(): void {
  // Update toggles
  keywordFilterEnabled.checked = currentSettings.keywordFilterEnabled;
  simplifiedChineseFilterEnabled.checked = currentSettings.simplifiedChineseFilterEnabled;
  aiFilterEnabled.checked = currentSettings.aiFilterEnabled;
  allowRevealInput.checked = currentSettings.allowReveal;

  // Update keyword count and textarea
  const count = countKeywords(currentSettings.keywords);
  keywordCountEl.textContent = count === 0 ? 'No keywords' : `${count} keywords`;
  keywordsTextarea.value = currentSettings.keywords;

  // Update AI status and filter description
  if (currentSettings.groqApiKey) {
    aiStatusEl.textContent = 'Configured';
  } else {
    aiStatusEl.textContent = 'No API key';
  }
  filterDescriptionInput.value = currentSettings.filterDescription || '';

  // Update filter panels visibility
  updateFilterPanels();

  // Update site status
  if (currentDomain) {
    const enabled = isDomainEnabled(currentDomain);
    siteStatus.className = `site-status ${enabled ? 'active' : 'inactive'}`;
    statusText.textContent = enabled ? 'Active on this site' : 'Not active on this site';

    currentDomainEl.textContent = currentDomain;
    toggleSiteBtn.textContent = enabled ? 'Disable' : 'Enable';
    toggleSiteBtn.className = `site-btn ${enabled ? 'enabled' : ''}`;
    siteToggleSection.style.display = 'block';
  } else {
    siteStatus.className = 'site-status';
    statusText.textContent = 'No active tab';
    siteToggleSection.style.display = 'none';
  }
}

/**
 * Save settings immediately
 */
async function saveImmediate(): Promise<void> {
  await saveSettings(currentSettings);
  updateUI();
}

/**
 * Save settings with debounce (for text inputs)
 */
function saveDebounced(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(async () => {
    await saveSettings(currentSettings);
    // Update keyword count after save
    const count = countKeywords(currentSettings.keywords);
    keywordCountEl.textContent = count === 0 ? 'No keywords' : `${count} keywords`;
  }, 300);
}

/**
 * Toggle current site in enabled domains
 */
async function toggleCurrentSite(): Promise<void> {
  if (!currentDomain) return;

  const enabled = isDomainEnabled(currentDomain);

  if (enabled) {
    // Remove domain
    currentSettings.enabledDomains = currentSettings.enabledDomains.filter(
      (d) => d !== currentDomain && !currentDomain!.endsWith(`.${d}`)
    );
  } else {
    // Add domain
    currentSettings.enabledDomains.push(currentDomain);
  }

  await saveImmediate();
}

/**
 * Open settings page with optional hash for section navigation
 */
function openSettingsPage(hash?: string): void {
  const optionsUrl = chrome.runtime.getURL('src/options/options.html');
  const url = hash ? `${optionsUrl}#${hash}` : optionsUrl;
  chrome.tabs.create({ url });
}

/**
 * Load settings and current tab info
 */
async function init(): Promise<void> {
  // Load settings
  currentSettings = await getSettings();

  // Get current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentDomain = extractDomain(tab.url);
    }
  } catch {
    currentDomain = null;
  }

  updateUI();
}

// Event listeners for toggles (immediate save)
keywordFilterEnabled.addEventListener('change', async () => {
  currentSettings.keywordFilterEnabled = keywordFilterEnabled.checked;
  updateFilterPanels();
  await saveImmediate();
});

simplifiedChineseFilterEnabled.addEventListener('change', async () => {
  currentSettings.simplifiedChineseFilterEnabled = simplifiedChineseFilterEnabled.checked;
  await saveImmediate();
});

aiFilterEnabled.addEventListener('change', async () => {
  currentSettings.aiFilterEnabled = aiFilterEnabled.checked;
  updateFilterPanels();

  // If enabling AI but no API key, open settings page
  if (aiFilterEnabled.checked && !currentSettings.groqApiKey) {
    await saveImmediate();
    openSettingsPage('ai-filter');
    return;
  }

  await saveImmediate();
});

allowRevealInput.addEventListener('change', async () => {
  currentSettings.allowReveal = allowRevealInput.checked;
  await saveImmediate();
});

// Event listeners for text inputs (debounced save)
keywordsTextarea.addEventListener('input', () => {
  currentSettings.keywords = keywordsTextarea.value;
  saveDebounced();
});

filterDescriptionInput.addEventListener('input', () => {
  currentSettings.filterDescription = filterDescriptionInput.value;
  saveDebounced();
});

// Site toggle
toggleSiteBtn.addEventListener('click', toggleCurrentSite);

// Settings page buttons
openSettingsBtn.addEventListener('click', () => openSettingsPage());
setupApiKeyBtn.addEventListener('click', () => openSettingsPage('ai-filter'));

// Initialize
init();
