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
const apiKeyStatus = document.getElementById('api-key-status') as HTMLSpanElement;
const getApiKeyLink = document.getElementById('get-api-key-link') as HTMLAnchorElement;
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
 * Update API key status display
 */
function updateApiKeyStatus(): void {
  const hasApiKey = groqKeyInput.value.trim().length > 0;

  if (hasApiKey) {
    apiKeyStatus.textContent = 'API key configured';
    apiKeyStatus.classList.add('configured');
    getApiKeyLink.style.display = 'none';
  } else {
    apiKeyStatus.textContent = 'No API key configured.';
    apiKeyStatus.classList.remove('configured');
    getApiKeyLink.style.display = 'inline';
  }
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
  updateApiKeyStatus();

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
 * Show API test result message
 */
function showApiTestResult(message: string, type: 'success' | 'error' | 'testing'): void {
  apiStatus.textContent = message;
  apiStatus.className = `api-test-result ${type}`;
}

/**
 * Parse error message from API response
 */
function parseApiError(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('401') || lowerError.includes('unauthorized') || lowerError.includes('invalid api key')) {
    return 'Invalid API key';
  }
  if (lowerError.includes('429') || lowerError.includes('rate limit')) {
    return 'Rate limit exceeded - try again later';
  }
  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return 'Access forbidden - check API key permissions';
  }
  if (lowerError.includes('404') || lowerError.includes('not found')) {
    return 'Model not found - check model name';
  }
  if (lowerError.includes('500') || lowerError.includes('internal server')) {
    return 'Groq server error - try again later';
  }
  if (lowerError.includes('network') || lowerError.includes('fetch')) {
    return 'Network error - check your connection';
  }
  if (lowerError.includes('timeout')) {
    return 'Request timed out - try again';
  }

  // Return original error if no match, but truncate if too long
  return error.length > 50 ? error.substring(0, 47) + '...' : error;
}

/**
 * Test the Groq API connection
 */
async function testApi(): Promise<void> {
  const apiKey = groqKeyInput.value.trim();

  if (!apiKey) {
    showApiTestResult('Enter an API key first', 'error');
    return;
  }

  testApiButton.disabled = true;
  testApiButton.textContent = 'Testing...';
  showApiTestResult('Testing connection...', 'testing');

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
      showApiTestResult(parseApiError(response.error), 'error');
    } else {
      showApiTestResult('API connected successfully', 'success');
    }
  } catch (error) {
    showApiTestResult(parseApiError(String(error)), 'error');
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
groqKeyInput.addEventListener('input', () => {
  updateApiKeyStatus();
  autoSave();
});
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

// Handle hash navigation (e.g., #ai-filter)
function handleHashNavigation(): void {
  const hash = window.location.hash;
  if (!hash) return;

  const targetId = hash.slice(1); // Remove #
  const targetElement = document.getElementById(targetId);

  if (targetElement) {
    // Wait for page to load, then scroll and highlight
    setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add highlight effect
      targetElement.style.transition = 'box-shadow 0.3s ease';
      targetElement.style.boxShadow = '0 0 0 3px #3498db';

      // Remove highlight after 2 seconds
      setTimeout(() => {
        targetElement.style.boxShadow = '';
      }, 2000);

      // Focus the API key input if navigating to AI filter section
      if (targetId === 'ai-filter') {
        groqKeyInput.focus();
      }
    }, 100);
  }
}

// Initialize
loadSettings();
handleHashNavigation();
