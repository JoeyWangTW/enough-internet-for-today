import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../utils';

// Get DOM elements
const keywordFilterEnabled = document.getElementById('keyword-filter-enabled') as HTMLInputElement;
const keywordSettings = document.getElementById('keyword-settings') as HTMLDivElement;
const keywordsTextarea = document.getElementById('keywords') as HTMLTextAreaElement;
const keywordCount = document.getElementById('keyword-count') as HTMLDivElement;
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
  showSaveStatus('Domain added (remember to save)', 'success');
}

/**
 * Remove a domain from the whitelist
 */
function removeDomain(domain: string): void {
  currentSettings.enabledDomains = currentSettings.enabledDomains.filter((d) => d !== domain);
  renderDomains();
  showSaveStatus('Domain removed (remember to save)', 'success');
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
 * Save settings to storage
 */
async function handleSave(): Promise<void> {
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    // Update settings with current form values
    currentSettings.keywordFilterEnabled = keywordFilterEnabled.checked;
    currentSettings.keywords = keywordsTextarea.value.trim();
    currentSettings.aiFilterEnabled = aiFilterEnabled.checked;
    currentSettings.filterDescription = filterDescriptionInput.value.trim() || DEFAULT_SETTINGS.filterDescription;
    currentSettings.groqApiKey = groqKeyInput.value.trim();
    currentSettings.selectedModel = modelInput.value.trim() || DEFAULT_SETTINGS.selectedModel;
    currentSettings.allowReveal = allowRevealInput.checked;

    await saveSettings(currentSettings);
    showSaveStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showSaveStatus(`Save failed: ${String(error)}`, 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
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
  }, 3000);
}

// Event listeners
keywordFilterEnabled.addEventListener('change', updateFilterStates);
aiFilterEnabled.addEventListener('change', updateFilterStates);
keywordsTextarea.addEventListener('input', updateKeywordCount);
addDomainButton.addEventListener('click', addDomain);
newDomainInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addDomain();
});
testApiButton.addEventListener('click', testApi);
saveButton.addEventListener('click', handleSave);

// Initialize
loadSettings();
