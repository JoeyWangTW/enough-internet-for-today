import type { AnalyzeTextMessage, AnalysisResponse, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

// Minimum text length to analyze (lowered to catch more content)
const MIN_TEXT_LENGTH = 10;

// Set to track analyzed text hashes (prevents re-analysis)
const analyzedTexts = new Set<string>();

// Set to track elements currently being processed
const processingElements = new WeakSet<Element>();

// Set to track elements that have been processed
const processedElements = new WeakSet<Element>();

// CSS class for placeholder styling
const PLACEHOLDER_CLASS = 'toxic-blocker-placeholder';
const BLOCKED_CLASS = 'toxic-blocker-blocked';

const PLACEHOLDER_STYLES = `
  .${PLACEHOLDER_CLASS} {
    color: #999 !important;
    font-style: italic !important;
    background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%) !important;
    background-size: 200% 100% !important;
    animation: toxic-blocker-shimmer 1.5s infinite !important;
    border-radius: 3px !important;
  }
  @keyframes toxic-blocker-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .${BLOCKED_CLASS} {
    color: #999 !important;
    font-style: italic !important;
  }
  .${BLOCKED_CLASS} button {
    margin-left: 6px !important;
    padding: 1px 6px !important;
    background: transparent !important;
    border: 1px solid #ccc !important;
    border-radius: 3px !important;
    cursor: pointer !important;
    font-size: 11px !important;
    color: #999 !important;
    font-style: normal !important;
  }
  .${BLOCKED_CLASS} button:hover {
    border-color: #999 !important;
    color: #666 !important;
  }
`;

// Elements that typically contain user-generated content
const TEXT_SELECTORS = [
  // Generic text elements
  'p', 'span', 'div', 'article', 'section',
  // Twitter/X specific
  '[data-testid="tweetText"]',
  '[data-testid="tweet"]',
  // Facebook specific
  '[data-ad-preview="message"]',
  '[dir="auto"]',
  // Reddit specific
  '[data-click-id="text"]',
  '.md',
  // General social media patterns
  '[role="article"]',
  '[class*="post"]',
  '[class*="comment"]',
  '[class*="tweet"]',
  '[class*="content"]',
  '[class*="message"]',
  '[class*="text"]',
].join(', ');

// Elements to skip
const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg', 'img', 'video', 'audio',
  'input', 'textarea', 'select', 'button', 'nav', 'header', 'footer', 'aside',
  'head', 'meta', 'link', 'title'
]);

// Inject placeholder styles once
function injectStyles(): void {
  if (document.getElementById('toxic-blocker-styles')) return;
  const style = document.createElement('style');
  style.id = 'toxic-blocker-styles';
  style.textContent = PLACEHOLDER_STYLES;
  document.head.appendChild(style);
}

/**
 * Simple hash function for text deduplication
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Get visible text content from an element (direct text only, not children)
 */
function getDirectTextContent(element: Element): string {
  let text = '';
  const childNodes = Array.from(element.childNodes);
  for (const child of childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    }
  }
  return text.trim();
}

/**
 * Get all text content from an element
 */
function getAllTextContent(element: Element): string {
  return (element.textContent || '').trim();
}

/**
 * Check if element is visible
 */
function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetParent !== null;
}

/**
 * Check if element should be skipped
 */
function shouldSkipElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  // Skip certain tags
  if (SKIP_TAGS.has(tagName)) return true;
  
  // Skip elements created by our extension
  if (element.id?.startsWith('toxic-blocker')) return true;
  if (element.classList?.contains(PLACEHOLDER_CLASS)) return true;
  if (element.classList?.contains(BLOCKED_CLASS)) return true;
  
  // Skip if already processed or processing
  if (processedElements.has(element)) return true;
  if (processingElements.has(element)) return true;
  
  return false;
}

/**
 * Find all elements with text content
 */
function findTextElements(root: Element | Document): Element[] {
  const elements: Element[] = [];
  
  // Query for elements that typically contain text
  const candidates = Array.from(root.querySelectorAll(TEXT_SELECTORS));
  
  for (const element of candidates) {
    if (shouldSkipElement(element)) continue;
    if (!isVisible(element)) continue;
    
    // Get text content - either direct or all
    const text = getAllTextContent(element);
    
    if (text.length >= MIN_TEXT_LENGTH) {
      // Make sure this element has "leaf" text (not just text from deeply nested children)
      const directText = getDirectTextContent(element);
      if (directText.length >= MIN_TEXT_LENGTH || element.children.length === 0) {
        elements.push(element);
      }
    }
  }
  
  return elements;
}

/**
 * Show debug indicator on page
 */
function showDebugIndicator(status: string, isError: boolean = false): void {
  let indicator = document.getElementById('toxic-blocker-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'toxic-blocker-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: opacity 0.3s;
    `;
    document.body.appendChild(indicator);
  }
  indicator.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
  indicator.style.color = isError ? '#c62828' : '#2e7d32';
  indicator.style.border = isError ? '1px solid #ef9a9a' : '1px solid #a5d6a7';
  indicator.textContent = `🛡️ Content Filter: ${status}`;
  indicator.style.opacity = '1';
  
  // Auto-hide after 5 seconds for success messages
  if (!isError) {
    setTimeout(() => {
      if (indicator) indicator.style.opacity = '0.3';
    }, 5000);
  }
}

let analyzedCount = 0;
let blockedCount = 0;
let cachedSettings: Settings | null = null;

/**
 * Analyze element for matching content
 */
async function analyzeElement(element: Element): Promise<void> {
  const text = getAllTextContent(element);
  if (text.length < MIN_TEXT_LENGTH) return;

  const textHash = hashText(text);

  // Skip if already analyzed this exact text
  if (analyzedTexts.has(textHash)) {
    processedElements.add(element);
    return;
  }
  
  analyzedTexts.add(textHash);
  processingElements.add(element);

  // Store original content
  const originalHTML = element.innerHTML;
  const originalText = element.textContent || '';

  console.log('Content Filter: Analyzing:', text.substring(0, 60) + (text.length > 60 ? '...' : ''));

  // Show placeholder while analyzing
  element.classList.add(PLACEHOLDER_CLASS);
  const originalDisplay = (element as HTMLElement).style.display;
  element.textContent = '...';

  try {
    const message: AnalyzeTextMessage = {
      action: 'analyzeText',
      text: originalText,
      textHash,
    };

    const response: AnalysisResponse = await chrome.runtime.sendMessage(message);
    
    console.log('Content Filter: Result:', response);
    analyzedCount++;

    // Remove placeholder class
    element.classList.remove(PLACEHOLDER_CLASS);

    if (response.error) {
      console.error('Content Filter: Error:', response.error);
      showDebugIndicator(`Error: ${response.error}`, true);
      // Restore original content on error
      element.innerHTML = originalHTML;
      (element as HTMLElement).style.display = originalDisplay;
    } else if (response.shouldBlock) {
      // Block matching content
      blockedCount++;
      console.log('Content Filter: BLOCKING matching content');
      showBlockedContent(element, originalHTML, originalDisplay);
      showDebugIndicator(`Blocked ${blockedCount} items`);
    } else {
      // Restore original content - it's safe
      element.innerHTML = originalHTML;
      (element as HTMLElement).style.display = originalDisplay;
      showDebugIndicator(`Analyzed ${analyzedCount} items (${blockedCount} blocked)`);
    }
  } catch (error) {
    console.error('Content Filter: Error:', error);
    showDebugIndicator(`Error: ${String(error)}`, true);
    // Restore on error
    element.classList.remove(PLACEHOLDER_CLASS);
    element.innerHTML = originalHTML;
    (element as HTMLElement).style.display = originalDisplay;
  } finally {
    processingElements.delete(element);
    processedElements.add(element);
  }
}

/**
 * Show blocked content placeholder
 */
function showBlockedContent(element: Element, originalHTML: string, originalDisplay: string): void {
  element.classList.add(BLOCKED_CLASS);

  const allowReveal = cachedSettings?.allowReveal ?? true;

  if (allowReveal) {
    element.innerHTML = `<span>Blocked content</span><button data-content-reveal="true">Show</button>`;

    const revealButton = element.querySelector('[data-content-reveal]');
    if (revealButton) {
      revealButton.addEventListener('click', (e) => {
        e.stopPropagation();
        element.classList.remove(BLOCKED_CLASS);
        element.innerHTML = originalHTML;
        (element as HTMLElement).style.display = originalDisplay;
      });
    }
  } else {
    element.innerHTML = `<span>Blocked content</span>`;
  }
}

/**
 * Process content in batches to avoid blocking the main thread
 */
async function processElements(elements: Element[]): Promise<void> {
  // Process in small batches
  const batchSize = 5;
  for (let i = 0; i < elements.length; i += batchSize) {
    const batch = elements.slice(i, i + batchSize);
    await Promise.all(batch.map(el => analyzeElement(el)));
    // Small delay between batches to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Process new content
 */
function processNewContent(root: Element | Document): void {
  const elements = findTextElements(root);
  
  if (elements.length > 0) {
    console.log(`Content Filter: Found ${elements.length} elements to analyze`);
    showDebugIndicator(`Found ${elements.length} items...`);
    processElements(elements);
  }
}

// Debounce for mutation observer
let debounceTimer: number | null = null;
const pendingNodes: Set<Element | Document> = new Set();

function debouncedProcess(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();
    for (const node of nodes) {
      processNewContent(node);
    }
    debounceTimer = null;
  }, 500);
}

/**
 * Get settings from storage
 */
async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (result) => {
      resolve(result.settings || DEFAULT_SETTINGS);
    });
  });
}

/**
 * Check if current domain is in the enabled list
 */
function isDomainEnabled(enabledDomains: string[]): boolean {
  const currentHost = window.location.hostname.toLowerCase();
  return enabledDomains.some(domain => {
    const normalizedDomain = domain.toLowerCase();
    // Check exact match or subdomain match
    return currentHost === normalizedDomain ||
           currentHost.endsWith('.' + normalizedDomain);
  });
}

/**
 * Initialize content script
 */
async function initialize(): Promise<void> {
  const hostname = window.location.hostname;
  console.log('Content Filter: Checking if enabled on', hostname);

  // Check if this domain is in the enabled list
  const settings = await getSettings();
  cachedSettings = settings;

  if (!isDomainEnabled(settings.enabledDomains)) {
    console.log('Content Filter: Not enabled on this domain, skipping');
    return;
  }

  console.log('Content Filter: Initializing on', hostname);

  // Inject styles
  injectStyles();

  // Show that extension is running
  showDebugIndicator('Scanning page...');

  // Run initial scan for existing content
  console.log('Content Filter: Running initial scan...');
  processNewContent(document);

  // Set up MutationObserver for dynamic content
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingNodes.add(node as Element);
          }
        });
      }
    }
    if (pendingNodes.size > 0) {
      debouncedProcess();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('Content Filter: Now monitoring for new content');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
