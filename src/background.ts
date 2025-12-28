import type { Settings, AnalyzeTextMessage, AnalysisResponse, AIAnalysisResult } from './types';
import { DEFAULT_SETTINGS } from './types';
import { getSettings } from './utils';
import * as OpenCC from 'opencc-js';

// Create converters for Chinese variant detection
const converterS2T = OpenCC.Converter({ from: 'cn', to: 'tw' });
const converterT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });

// Content filter prompt - uses user's filter description
const FILTER_PROMPT = (text: string, filterDescription: string) => `Analyze this text and determine if it should be blocked based on the following filter criteria: "${filterDescription}"

Text to analyze: """${text}"""

Respond with JSON only: {"shouldBlock": true} or {"shouldBlock": false}`;

/**
 * Parse keywords from comma-separated string
 */
function parseKeywords(keywordsString: string): string[] {
  if (!keywordsString.trim()) return [];
  return keywordsString
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);
}

/**
 * Layer 1: Check if text contains any keywords
 */
function checkKeywordMatch(text: string, keywords: string[]): string | null {
  if (keywords.length === 0) return null;

  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    if (lowerText.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Layer 1: Detect if text is primarily Simplified Chinese
 * Compares character differences when converting to/from Traditional Chinese
 */
function isSimplifiedChinese(text: string): boolean {
  // Only check if text contains Chinese characters
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  if (!chineseChars || chineseChars.length < 3) {
    return false; // Not enough Chinese characters to determine
  }

  const s2t = converterS2T(text);
  const t2s = converterT2S(text);

  // Count character differences
  const s2tDiff = [...text].filter((c, i) => c !== s2t[i]).length;
  const t2sDiff = [...text].filter((c, i) => c !== t2s[i]).length;

  // If converting from Simplified to Traditional changes more characters,
  // the text is likely Simplified Chinese
  return s2tDiff > t2sDiff && s2tDiff > 0;
}

/**
 * Layer 2: Analyze text with Groq API (ultra-low latency)
 */
async function analyzeWithGroq(
  text: string,
  apiKey: string,
  model: string,
  filterDescription: string
): Promise<AIAnalysisResult> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: FILTER_PROMPT(text, filterDescription) }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in Groq response');
  }

  // Parse JSON response from LLM
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        shouldBlock: Boolean(parsed.shouldBlock),
      };
    }
    throw new Error('No JSON found in response');
  } catch (parseError) {
    console.error('Content Filter: Failed to parse LLM response:', content);
    throw new Error(`Failed to parse LLM response: ${parseError}`);
  }
}

/**
 * Two-layer filtering: Keywords first, then AI
 */
async function analyzeText(text: string): Promise<AnalysisResponse> {
  try {
    const settings = await getSettings();

    // Layer 1: Keyword Filter (if enabled)
    if (settings.keywordFilterEnabled) {
      const keywords = parseKeywords(settings.keywords);
      if (keywords.length > 0) {
        const matchedKeyword = checkKeywordMatch(text, keywords);
        if (matchedKeyword) {
          console.log(`Content Filter: Keyword match found: "${matchedKeyword}"`);
          return {
            shouldBlock: true,
            matched_by: 'keyword',
            matched_keyword: matchedKeyword,
          };
        }
      }
    } else {
      console.log('Content Filter: Keyword filter disabled, skipping');
    }

    // Layer 1b: Simplified Chinese Filter (if enabled)
    if (settings.simplifiedChineseFilterEnabled) {
      if (isSimplifiedChinese(text)) {
        console.log('Content Filter: Simplified Chinese detected');
        return {
          shouldBlock: true,
          matched_by: 'simplified-chinese',
        };
      }
    } else {
      console.log('Content Filter: Simplified Chinese filter disabled, skipping');
    }

    // Layer 2: AI Filter (if enabled and keyword filter passed)
    if (!settings.aiFilterEnabled) {
      console.log('Content Filter: AI filter disabled, passing content through');
      return {
        shouldBlock: false,
        matched_by: 'none',
      };
    }

    if (!settings.groqApiKey) {
      console.log('Content Filter: No Groq API key configured, passing content through');
      return {
        shouldBlock: false,
        matched_by: 'none',
      };
    }

    // Call Groq API
    const filterDescription = settings.filterDescription || DEFAULT_SETTINGS.filterDescription;
    console.log('Content Filter: Analyzing with Groq AI for:', filterDescription);
    const aiResult = await analyzeWithGroq(
      text,
      settings.groqApiKey,
      settings.selectedModel,
      filterDescription
    );

    return {
      shouldBlock: aiResult.shouldBlock,
      matched_by: 'ai',
    };
  } catch (error) {
    console.error('Content Filter: Error analyzing text:', error);
    // Fail open - if there's an error, don't block content
    return {
      shouldBlock: false,
      matched_by: 'none',
      error: String(error),
    };
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message: AnalyzeTextMessage, sender, sendResponse) => {
  if (message.action === 'analyzeText') {
    // Handle async analysis
    analyzeText(message.text)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error('Content Filter: Error in message handler:', error);
        sendResponse({ shouldBlock: false, matched_by: 'none', error: String(error) });
      });

    // Return true to indicate we'll send response asynchronously
    return true;
  }
});

// Open options page on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// Open options page when clicking extension icon
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

console.log('Content Filter: Background service worker initialized (Two-Layer Filtering with Groq)');
