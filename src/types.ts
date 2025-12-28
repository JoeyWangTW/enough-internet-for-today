// Settings stored in chrome.storage.local
export interface Settings {
  // Layer 1: Keyword Filter
  keywordFilterEnabled: boolean; // Enable/disable keyword filter
  keywords: string; // Comma-separated keywords (e.g., "hate, toxic, kill")

  // Layer 2: AI Filter (Groq)
  aiFilterEnabled: boolean; // Enable/disable AI filter
  groqApiKey: string; // Groq API key
  selectedModel: string; // e.g., 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'
  filterDescription: string; // What content to filter (e.g., "toxic or hate speech content")

  // Block behavior
  allowReveal: boolean; // Show "Show" button on blocked content

  // Domain whitelist
  enabledDomains: string[]; // e.g., ['twitter.com', 'reddit.com']
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  keywordFilterEnabled: true,
  keywords: '',
  aiFilterEnabled: true,
  groqApiKey: '',
  selectedModel: 'llama-3.3-70b-versatile',
  filterDescription: 'content I want to avoid',
  allowReveal: true,
  enabledDomains: [
    'twitter.com',
    'x.com',
    'reddit.com',
    'www.reddit.com',
    'instagram.com',
    'www.instagram.com',
    'facebook.com',
    'www.facebook.com',
  ],
};

// Parsed keywords (computed from settings.keywords)
export type ParsedKeywords = string[]; // Trimmed, lowercased keywords

// Filter result
export interface FilterResult {
  shouldBlock: boolean;
  matched_by: 'keyword' | 'ai' | 'none';
  matched_keyword?: string; // If matched by keyword
}

// LLM Analysis Result (from Groq)
export interface AIAnalysisResult {
  shouldBlock: boolean;
}

// Message passing between content script and background
export interface AnalyzeTextMessage {
  action: 'analyzeText';
  text: string;
  textHash: string; // For deduplication
}

export interface AnalysisResponse {
  shouldBlock: boolean;
  matched_by: 'keyword' | 'ai' | 'none';
  matched_keyword?: string;
  error?: string; // If analysis failed
}
