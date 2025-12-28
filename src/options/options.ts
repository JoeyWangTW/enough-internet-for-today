import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../utils';

// Get DOM elements
const keywordFilterEnabled = document.getElementById('keyword-filter-enabled') as HTMLInputElement;
const keywordSettings = document.getElementById('keyword-settings') as HTMLDivElement;
const keywordsTextarea = document.getElementById('keywords') as HTMLTextAreaElement;
const keywordCount = document.getElementById('keyword-count') as HTMLDivElement;
const simplifiedChineseFilterEnabled = document.getElementById('simplified-chinese-filter-enabled') as HTMLInputElement;
const aiFilterEnabled = document.getElementById('ai-filter-enabled') as HTMLInputElement;
const aiSettings = document.getElementById('ai-settings') as HTMLDivElement;
const filterDescriptionInput = document.getElementById('filter-description') as HTMLInputElement;
const groqKeyInput = document.getElementById('groq-key') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const testApiButton = document.getElementById('test-api') as HTMLButtonElement;
const apiStatus = document.getElementById('api-status') as HTMLSpanElement;
const allowRevealInput = document.getElementById('allow-reveal') as HTMLInputElement;
const domainsList = document.getElementById('domains-list') as HTMLDivElement;
const newDomainInput = document.getElementById('new-domain') as HTMLInputElement;
const addDomainButton = document.getElementById('add-domain') as HTMLButtonElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLDivElement;

// Current settings
let currentSettings: Settings = DEFAULT_SETTINGS;

// Debounce timer for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Update filter settings visibility based on enabled state
 */
function updateFilterStates(): void {
  keywordSettings.classList.toggle('filter-disabled', !keywordFilterEnabled.checked);
  aiSettings.classList.toggle('filter-disabled', !aiFilterEnabled.checked);
}

/**
 * Parse and count keywords
 */
function parseKeywords(keywordsString: string): string[] {
  if (!keywordsString.trim()) return [];
  return keywordsString
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);
}

/**
 * Update keyword count display
 */
function updateKeywordCount(): void {
  const keywords = parseKeywords(keywordsTextarea.value);
  const count = keywords.length;
  keywordCount.textContent = count === 0
    ? 'No keywords configured (keyword filter disabled)'
    : count === 1
      ? '1 keyword configured'
      : `${count} keywords configured`;
}

/**
 * Load settings from storage and populate UI
 */
async function loadSettings(): Promise<void> {
  currentSettings = await getSettings();

  // Filter enabled states
  keywordFilterEnabled.checked = currentSettings.keywordFilterEnabled ?? DEFAULT_SETTINGS.keywordFilterEnabled;
  aiFilterEnabled.checked = currentSettings.aiFilterEnabled ?? DEFAULT_SETTINGS.aiFilterEnabled;
  updateFilterStates();

  // Keywords
  keywordsTextarea.value = currentSettings.keywords;
  updateKeywordCount();

  // Simplified Chinese filter
  simplifiedChineseFilterEnabled.checked = currentSettings.simplifiedChineseFilterEnabled ?? DEFAULT_SETTINGS.simplifiedChineseFilterEnabled;

  // Filter description
  filterDescriptionInput.value = currentSettings.filterDescription || DEFAULT_SETTINGS.filterDescription;

  // Groq API key
  groqKeyInput.value = currentSettings.groqApiKey || '';

  // Model (free-form text input)
  modelInput.value = currentSettings.selectedModel || DEFAULT_SETTINGS.selectedModel;

  // Allow reveal
  allowRevealInput.checked = currentSettings.allowReveal ?? DEFAULT_SETTINGS.allowReveal;

  // Domains
  renderDomains();
}

/**
 * Render domain tags
 */
function renderDomains(): void {
  domainsList.innerHTML = '';

  currentSettings.enabledDomains.forEach((domain) => {
    const tag = document.createElement('div');
    tag.className = 'domain-tag';
    tag.innerHTML = `
      <span>${domain}</span>
      <button class="remove" data-domain="${domain}">×</button>
    `;

    tag.querySelector('.remove')?.addEventListener('click', () => removeDomain(domain));
    domainsList.appendChild(tag);
  });
}

/**
 * Add a new domain to the whitelist
 */
function addDomain(): void {
  const domain = newDomainInput.value.trim().toLowerCase();
  if (!domain) return;

  // Basic validation
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    showSaveStatus('Invalid domain format', 'error');
    return;
  }

  if (currentSettings.enabledDomains.includes(domain)) {
    showSaveStatus('Domain already added', 'error');
    return;
  }

  currentSettings.enabledDomains.push(domain);
  newDomainInput.value = '';
  renderDomains();
  autoSave(true);
}

/**
 * Remove a domain from the whitelist
 */
function removeDomain(domain: string): void {
  currentSettings.enabledDomains = currentSettings.enabledDomains.filter((d) => d !== domain);
  renderDomains();
  autoSave(true);
}

/**
 * Test the Groq API connection
 */
async function testApi(): Promise<void> {
  const apiKey = groqKeyInput.value.trim();

  if (!apiKey) {
    showSaveStatus('Please enter a Groq API key', 'error');
    return;
  }

  testApiButton.disabled = true;
  testApiButton.textContent = 'Testing...';
  apiStatus.className = 'status-icon';

  try {
    // Temporarily save settings to test
    const tempSettings: Settings = {
      ...currentSettings,
      filterDescription: filterDescriptionInput.value.trim() || DEFAULT_SETTINGS.filterDescription,
      groqApiKey: apiKey,
      selectedModel: modelInput.value.trim() || DEFAULT_SETTINGS.selectedModel,
    };

    await saveSettings(tempSettings);

    // Test by sending a simple message through the background script
    const message = {
      action: 'analyzeText',
      text: 'This is a friendly test message to verify the API connection is working correctly.',
      textHash: 'test',
    };

    const response = await chrome.runtime.sendMessage(message);

    if (response.error) {
      showSaveStatus(`API test failed: ${response.error}`, 'error');
      apiStatus.className = 'status-icon invalid';
    } else {
      showSaveStatus('API test successful!', 'success');
      apiStatus.className = 'status-icon valid';
    }
  } catch (error) {
    showSaveStatus(`API test error: ${String(error)}`, 'error');
    apiStatus.className = 'status-icon invalid';
  } finally {
    testApiButton.disabled = false;
    testApiButton.textContent = 'Test API Connection';
  }
}

/**
 * Collect current form values into settings object
 */
function collectFormValues(): void {
  currentSettings.keywordFilterEnabled = keywordFilterEnabled.checked;
  currentSettings.keywords = keywordsTextarea.value.trim();
  currentSettings.simplifiedChineseFilterEnabled = simplifiedChineseFilterEnabled.checked;
  currentSettings.aiFilterEnabled = aiFilterEnabled.checked;
  currentSettings.filterDescription = filterDescriptionInput.value.trim() || DEFAULT_SETTINGS.filterDescription;
  currentSettings.groqApiKey = groqKeyInput.value.trim();
  currentSettings.selectedModel = modelInput.value.trim() || DEFAULT_SETTINGS.selectedModel;
  currentSettings.allowReveal = allowRevealInput.checked;
}

/**
 * Auto-save settings with debounce
 */
function autoSave(immediate = false): void {
  // Clear any pending save
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  const doSave = async () => {
    try {
      collectFormValues();
      await saveSettings(currentSettings);
      showSaveStatus('Saved', 'success');
    } catch (error) {
      showSaveStatus(`Save failed: ${String(error)}`, 'error');
    }
  };

  if (immediate) {
    doSave();
  } else {
    // Debounce text inputs by 500ms
    saveTimeout = setTimeout(doSave, 500);
  }
}

/**
 * Show save status message
 */
function showSaveStatus(message: string, type: 'success' | 'error'): void {
  saveStatus.textContent = message;
  saveStatus.className = `save-status ${type}`;

  setTimeout(() => {
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
  }, type === 'success' ? 1500 : 3000);
}

// Event listeners - toggles save immediately
keywordFilterEnabled.addEventListener('change', () => {
  updateFilterStates();
  autoSave(true);
});
aiFilterEnabled.addEventListener('change', () => {
  updateFilterStates();
  autoSave(true);
});
simplifiedChineseFilterEnabled.addEventListener('change', () => autoSave(true));
allowRevealInput.addEventListener('change', () => autoSave(true));

// Text inputs - debounced save
keywordsTextarea.addEventListener('input', () => {
  updateKeywordCount();
  autoSave();
});
filterDescriptionInput.addEventListener('input', () => autoSave());
groqKeyInput.addEventListener('input', () => autoSave());
modelInput.addEventListener('input', () => autoSave());

// Domain management
addDomainButton.addEventListener('click', addDomain);
newDomainInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addDomain();
});

// API test
testApiButton.addEventListener('click', testApi);

// Hide save button since we auto-save
saveButton.style.display = 'none';

// Initialize
loadSettings();
