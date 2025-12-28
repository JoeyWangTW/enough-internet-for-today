# Content Filter - Chrome Extension

## Overview

Build a Chrome extension that uses a two-layer filtering system to detect and block user-defined content on any website. The first layer uses fast keyword matching, and the second layer uses AI-powered analysis via Groq for content that passes keyword filtering. Users define exactly what they want to filter—whether it's spoilers, political content, negativity, or anything else.

**Key Features:**
- 🔤 **Layer 1: Keyword Filter** - Fast, local keyword matching (comma-separated list)
- 🤖 **Layer 2: AI Filter** - LLM-powered content detection via Groq (only if keyword filter passes)
- 🛡️ Block matching content with "Show anyway" option
- ⚙️ Domain whitelist for website enablement (default: Instagram, X/Twitter, Facebook, Reddit)
- 🔑 User-provided Groq API key for AI filtering
- 🎯 Platform-agnostic content detection works on any website
- ✏️ **User-defined filter criteria** - Block whatever content YOU decide (toxic, spoilers, politics, etc.)

**Target Users:** Individuals who want control over their browsing experience and are comfortable with technical setup (providing API keys, running local extension).

## Filtering Flow

```
Content Detected
       │
       ▼
┌─────────────────────┐
│ Keywords configured?│
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │ Yes       │ No
    ▼           ▼
┌────────────┐  ┌────────────────┐
│ Keyword    │  │ AI configured? │
│ Match?     │  └───────┬────────┘
└─────┬──────┘          │
      │           ┌─────┴─────┐
 ┌────┴────┐      │ Yes       │ No
 │ Yes     │ No   ▼           ▼
 ▼         ▼     ┌──────┐   ┌──────┐
┌──────┐  ┌────────────┐│ AI   │   │ Show │
│BLOCK │  │AI configured?Filter│   │Content│
└──────┘  └─────┬──────┘└──┬───┘   └──────┘
                │          │
          ┌─────┴─────┐    ▼
          │ Yes       │ No ┌──────────┐
          ▼           ▼    │Match?    │
        ┌──────┐   ┌──────┐└────┬─────┘
        │ AI   │   │ Show │  ┌──┴──┐
        │Filter│   │Content│  Yes  No
        └──┬───┘   └──────┘  │     │
           │                 ▼     ▼
           ▼              ┌────┐ ┌────┐
      ┌──────────┐        │BLOCK│ │SHOW│
      │ Toxic?   │        └────┘ └────┘
      └────┬─────┘
        ┌──┴──┐
        Yes  No
        │     │
        ▼     ▼
     ┌────┐ ┌────┐
     │BLOCK│ │SHOW│
     └────┘ └────┘
```

**Summary:**
1. If keywords are configured AND any keyword matches → **BLOCK immediately**
2. If keywords are configured but NO match → proceed to AI filter (if configured)
3. If NO keywords configured → proceed to AI filter (if configured)
4. If AI is configured → analyze with Groq → block if matches user's filter criteria
5. If neither layer is configured → show content (no filtering)

## Problem Statement / Motivation

Users encounter unwanted content online that they'd prefer not to see:
- Spoilers for shows, movies, or games they haven't finished
- Political arguments and divisive content
- Negative or depressing news
- Toxic comments and harassment
- Content that triggers anxiety or stress
- Any other content specific to their preferences

While platform-level moderation exists, it's often:
- Too slow (reactive rather than proactive)
- Inconsistent across platforms
- Lacks user control and customization
- Doesn't account for individual preferences and sensitivities

**Why This Matters:**
- Users spend hours daily online and encounter unwanted content regularly
- Everyone has different content they'd prefer to avoid
- Users lack tools to proactively filter their experience based on personal criteria
- Open-source, locally-run solution gives users complete control over their data and filtering preferences

## Proposed Solution

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Page (Any Enabled Domain)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Content Script (content.ts)                              │  │
│  │  - Generic TreeWalker finds all text nodes               │  │
│  │  - Platform-agnostic detection (works everywhere)        │  │
│  │  - MutationObserver monitors for new content             │  │
│  │  - Applies blocking based on filter results              │  │
│  └────────────────┬─────────────────────────────────────────┘  │
└───────────────────┼─────────────────────────────────────────────┘
                    │ chrome.runtime.sendMessage()
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Service Worker (background.ts)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Two-Layer Filtering System                               │  │
│  │                                                           │  │
│  │  Layer 1: Keyword Filter (Local, Fast)                   │  │
│  │  - User-defined comma-separated keywords                  │  │
│  │  - Instant text matching, no API call                     │  │
│  │  - If match found → BLOCK immediately                     │  │
│  │                                                           │  │
│  │  Layer 2: AI Filter (Groq)                          │  │
│  │  - Only runs if keyword filter passes (no match)          │  │
│  │  - Calls Groq API with user's API key               │  │
│  │  - Returns content analysis                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │ fetch() to Groq (Layer 2 only)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Groq API                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Access to 100+ models via single API:                    │  │
│  │  - OpenAI (GPT-4o, GPT-4o-mini)                          │  │
│  │  - Anthropic (Claude Sonnet, Haiku)                       │  │
│  │  - Google (Gemini Flash, Pro)                             │  │
│  │  - Meta (Llama 3)                                         │  │
│  │  - And many more...                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                 │ Structured Response
                 ▼
              {"is_toxic": true, "confidence": 0.85}
```

### Component Breakdown

**1. Manifest V3 Configuration (manifest.json)**
- Declare permissions: `storage`
- Host permissions for user-configured domains (domain whitelist)
- Register content scripts and service worker
- Define options page UI

**2. Content Script (src/content/content.ts)**
- **Generic TreeWalker** finds all text nodes on any page (platform-agnostic)
- MutationObserver monitors for dynamically added content
- Minimum text length filter (20 characters) to skip trivial content
- Simple Set-based deduplication to prevent re-analysis
- DOM manipulation to block unwanted content with "Show anyway" button

**3. Service Worker (src/background/background.ts)**
- Message handler for content script analysis requests
- **Layer 1: Keyword Filter** - local text matching against user keywords
- **Layer 2: Groq API** - AI content analysis (only if keyword filter passes)
- Settings management via chrome.storage.local
- Basic error handling (fail open on errors)

**4. Options Page (src/options/)**
- **Keyword Settings Section:**
  - Text field for comma-separated keywords (e.g., "hate, toxic, kill")
  - Keywords are case-insensitive
  - Empty field = keyword filter disabled
- **AI Settings Section:**
  - Groq API key input
  - Model selection dropdown (from Groq's available models)
  - Empty API key = AI filter disabled
  - API key validation with test button
- Domain whitelist management (add/remove enabled websites)

## Technical Considerations

### Architecture Decisions

**Manifest V3 Compliance**
- Service workers (non-persistent background scripts)
- No remote code execution
- Declarative permissions model
- **Impact**: Must design for ephemeral service worker lifecycle, use chrome.storage for persistence

**Two-Layer Filtering Architecture**
- **Layer 1: Keyword Filter** - Zero latency, no API calls, instant blocking
- **Layer 2: Groq** - Single API for 100+ LLM models
- Groq handles provider-specific differences automatically
- User only needs one API key for access to all models
- **Impact**: Simpler setup (one API key), cost-effective (pay per use), flexible model choice
- **Dependencies**: None for keyword filter; simple fetch() for Groq API

**Platform-Agnostic Detection**
- Generic TreeWalker works on ANY website
- No platform-specific selectors or adapters needed
- Domain whitelist controls where extension runs
- **Impact**: Works everywhere, zero maintenance when sites update UI, simpler architecture

**Simple State Management**
- chrome.storage.local for settings and API keys only
- In-memory Set for tracking analyzed text (by content hash)
- No caching layer (keep it simple)
- **Impact**: Minimal state complexity, easy to reason about

### Performance Implications

**API Call Strategy**
- Individual requests (simple, reliable error handling)
- No artificial concurrency limits (let provider handle rate limiting)
- No caching in MVP (add later if needed based on real usage data)
- **Cost estimate**: ~$1-2/month for moderate use (1000 API calls/day with Gemini Flash)

**DOM Manipulation**
- TreeWalker efficiently traverses text nodes
- Simple MutationObserver monitors for new content
- Content hash-based deduplication prevents re-analysis
- **Target**: Minimal impact, extension should feel invisible

**Memory Management**
- Set-based tracking of analyzed content (bounded by page content)
- Clear state when tab closes
- Service worker terminates after 30s inactivity (Manifest V3 lifecycle)

### Security Considerations

**API Key Storage**
- Store in chrome.storage.local (device-only, not synced)
- **CRITICAL DECISION NEEDED**: Encrypt keys or store plaintext?
- **Recommendation**: Plaintext with clear warning in UI about security
- User controls their own keys (no proxy server)

**Content Privacy**
- Full text content sent to third-party LLM APIs
- No local logging of analyzed content
- Privacy disclosure required in options page
- **Consideration**: Users must trust their chosen LLM provider

**Content Security Policy**
- No inline scripts (Manifest V3 enforces this)
- No eval() or new Function()
- All code bundled with extension

**Permission Scope**
- Request minimal permissions
- Host permissions only for enabled websites
- Consider dynamic permission requests when user adds new sites

### Scalability Considerations

**Platform Independence = Zero Maintenance**
- Generic TreeWalker works on ANY website
- No platform-specific code means no breakage when sites update
- **Maintenance**: Virtually zero maintenance for content detection

**LLM Provider Flexibility via Groq**
- Groq provides access to 100+ models from all major providers
- Single API key for all models (user can switch models anytime)
- New models automatically available as Groq adds support
- **Future**: Could add auto-fallback to different model on errors

**Rate Limiting**
- Let LLM providers handle their own rate limiting
- Fail open if rate limited (show content, try again on next item)
- Users can test different providers to find best speed/cost balance

## Acceptance Criteria

### Functional Requirements

**Extension Installation & Setup**
- [ ] User can install extension from local build
- [ ] Options page opens on first install
- [ ] **Keyword Filter Settings:**
  - [ ] User can enter comma-separated keywords in text field
  - [ ] Keywords are trimmed and case-insensitive
  - [ ] Empty field disables keyword filtering
- [ ] **AI Filter Settings:**
  - [ ] User can enter Groq API key
  - [ ] User can select model from Groq's available models
  - [ ] User can test API key with validation button
  - [ ] Empty API key disables AI filtering
- [ ] Default domain whitelist includes: twitter.com, x.com, reddit.com, instagram.com, facebook.com
- [ ] User can add/remove domains from whitelist
- [ ] Settings persist across browser sessions

**Content Detection & Filtering**
- [ ] Extension detects text content on whitelisted domains only
- [ ] Generic TreeWalker finds all text nodes (platform-agnostic)
- [ ] Only text >20 characters is analyzed (skip trivial content)
- [ ] New dynamic content is detected via MutationObserver
- [ ] Each unique text is analyzed once (content hash deduplication)
- [ ] **Two-Layer Filtering:**
  - [ ] Layer 1: Keyword filter runs first (if keywords configured)
  - [ ] Layer 1: If keyword match found → block immediately, skip AI
  - [ ] Layer 2: AI filter runs only if keyword filter passes (no match)
  - [ ] Layer 2: Groq API called for content analysis
  - [ ] If neither layer configured → content shown without filtering

**Block Mode (MVP)**
- [ ] Matching content is hidden from view
- [ ] Grey placeholder shows "Content blocked • Show anyway" button
- [ ] Clicking "Show anyway" reveals original content
- [ ] Layout remains intact (no jarring gaps)

**Error Handling**
- [ ] Invalid API key shows error in options page
- [ ] Network failures fail open (show content, log error to console)
- [ ] Rate limit errors fail open (show content)
- [ ] API errors don't break page functionality
- [ ] Clear error messages with actionable next steps

**Settings Management**
- [ ] Options page accessible via extension menu
- [ ] **Keyword Filter:**
  - [ ] Text field for comma-separated keywords
  - [ ] Visual feedback showing parsed keyword count
- [ ] **AI Filter:**
  - [ ] Groq API key input with validation button
  - [ ] Model selection dropdown
  - [ ] API key validation with visual feedback (checkmark/X icon)
- [ ] Domain whitelist with add/remove functionality
- [ ] Settings changes saved immediately to chrome.storage.local
- [ ] Settings changes apply to active tabs on next content load

### Non-Functional Requirements

**Performance**
- [ ] Extension feels invisible (no noticeable slowdown)
- [ ] Content analysis: <2 seconds per item under normal conditions
- [ ] No visible jank or blocking during analysis
- [ ] Works smoothly with infinite scroll (Twitter, Reddit)

**Reliability**
- [ ] Graceful degradation during API failures (fail open)
- [ ] No crashes or extension errors that break websites
- [ ] Console errors are informative and actionable

**Usability**
- [ ] First-time setup completable in <5 minutes
- [ ] Clear feedback for all user actions
- [ ] Simple, intuitive options page
- [ ] Helpful error messages with next steps

**Security**
- [ ] No data sent to servers other than chosen LLM provider(s)
- [ ] API keys stored in chrome.storage.local (device-only)
- [ ] No content logging or persistence
- [ ] Clear privacy disclosure in README

### Quality Gates

**Code Quality**
- [ ] TypeScript for type safety
- [ ] Consistent code formatting
- [ ] Clear function and variable names
- [ ] Commented where logic is complex

**Testing**
- [ ] Manual testing on default platforms (Twitter, Reddit, Instagram, Facebook)
- [ ] Test with at least 2 LLM providers (Gemini + one other)
- [ ] Test block mode thoroughly
- [ ] Test error scenarios (invalid key, network failure)
- [ ] Test dynamic content (infinite scroll, real-time updates)
- [ ] Test on different websites beyond defaults

**Documentation**
- [ ] README with installation instructions
- [ ] Setup guide with screenshots
- [ ] API key acquisition guide for each provider
- [ ] Architecture documentation
- [ ] Privacy policy disclosure

## Success Metrics

**Core Validation (MVP)**
- Does LLM-based content filtering work well enough to be useful?
- What's the false positive rate? (measure via "Show anyway" clicks)
- Which providers work best? (speed vs accuracy vs cost)
- Do users find value and continue using it?

**Quality Indicators**
- Extension doesn't break websites
- No performance complaints from users
- Setup process is straightforward
- Users understand what the extension does

**Post-MVP Metrics (Future)**
- User retention (7-day, 30-day)
- Average cost per user per day
- Most commonly enabled domains
- Feature requests and bug reports

## Dependencies & Risks

### External Dependencies

**Groq API**
- **Dependency**: Groq API (https://groq.com)
- **Risk**: API changes, pricing changes, service outages
- **Mitigation**: Simple REST API (less likely to break), fail open on errors, user can choose from 100+ models
- **Benefit**: Single API key for all providers, no SDK dependencies

**Chrome Extension Platform**
- **Dependency**: Chrome Manifest V3 APIs
- **Risk**: API changes, policy updates
- **Mitigation**: Follow official guidelines, Manifest V3 is stable

**Platform Independence**
- **No Dependency**: Generic TreeWalker works on any website
- **Zero Risk**: No platform-specific code means no breakage risk
- **Benefit**: Works everywhere without maintenance

### Technical Risks

**✅ ELIMINATED: Platform DOM Changes**
- **Previous Risk**: High likelihood of breakage when sites update
- **Solution**: Generic TreeWalker works on any website
- **Impact**: Zero maintenance burden, works everywhere

**⚠️ Medium Risk: False Positives**
- **Likelihood**: Medium (LLM accuracy varies by provider ~80-95%)
- **Impact**: Low (annoying but user can reveal content)
- **Mitigation**:
  - "Show anyway" button for easy override
  - Users can test different providers to find best accuracy
  - Future: user feedback to improve prompts

**⚠️ Medium Risk: API Cost (User-Controlled)**
- **Likelihood**: Medium (users may not monitor usage)
- **Impact**: Medium (unexpected costs for users)
- **Mitigation**:
  - Clear documentation about costs per provider
  - Recommend Gemini Flash (cheapest: ~$1-2/month moderate use)
  - Users control their own API keys and spending
  - Future: optional usage tracking

**✓ Low Risk: LLM Performance**
- **Likelihood**: Low (most providers are fast enough)
- **Impact**: Medium (slow filtering is annoying)
- **Mitigation**:
  - Users can test Groq for fastest responses
  - Async processing doesn't block UI
  - Fail open if too slow (content still visible)

**✓ Low Risk: API Key Security**
- **Likelihood**: Low (local storage is reasonably secure)
- **Impact**: High (if compromised, user's API key exposed)
- **Mitigation**:
  - Clear security warning in README
  - Store in chrome.storage.local (device-only, not synced)
  - Recommend users rotate keys periodically

### Project Risks

**✅ ELIMINATED: Maintenance Burden**
- **Previous Risk**: Platform-specific code breaks when sites update
- **Solution**: Generic detection = zero platform maintenance
- **Impact**: Extension "just works" without constant updates

**⚠️ Low Risk: User Onboarding Complexity**
- **Likelihood**: Low (target users are technical)
- **Impact**: Medium (API key setup is a barrier)
- **Mitigation**:
  - Clear setup guide with screenshots
  - Recommend Gemini (easiest to get API key)
  - Open-source project = users expect some technical setup

## MVP Scope & Phased Approach

### Phase 1: Simplified MVP (Core Functionality)

**Scope:**
- ✅ **Two-layer filtering system**:
  - Layer 1: Keyword filter (fast, local, no API calls)
  - Layer 2: AI filter via Groq (only if keyword filter passes)
- ✅ **Platform-agnostic**: Works on ANY website (no platform-specific code)
- ✅ **Single API provider**: Groq for access to all LLM models
- ✅ **Block mode only**: Hide unwanted content with "Show anyway" button
- ✅ **Domain whitelist**: User configures which sites to monitor
- ✅ **Options page**: Keywords, Groq API key, model selection, domain management
- ✅ **Error handling**: Fail open (show content on errors)
- ❌ No caching (keep it simple)
- ❌ No statistics/tracking
- ❌ No popup UI (options page only)
- ❌ No rewrite mode (future enhancement)

**Deliverables:**
- Working extension that blocks unwanted content on user-configured domains
- Options page with keyword filter + AI filter configuration
- README with setup instructions
- Tested on Twitter, Reddit, Instagram, Facebook (but works anywhere)

**Key Simplifications:**
- Keyword filter provides instant blocking without API calls
- Groq eliminates need for multiple API keys/providers
- Generic TreeWalker eliminates platform-specific maintenance
- No caching means simpler architecture
- Fail-open error handling means simple error paths

### Future Enhancements (Post-MVP)

**Phase 2: Enhanced UX** (if MVP validates the concept)
- Rewrite mode implementation
- Visual improvements to blocked content styling
- Better onboarding experience

**Phase 3: Optimization** (if users request it)
- Content caching for performance
- Usage tracking and cost estimation
- Configurable sensitivity thresholds

**Phase 4: Advanced Features** (based on user feedback)
- User feedback mechanism ("Not toxic" button)
- Whitelist specific users or accounts
- Export/import settings
- Chrome Web Store publication

## Design Decisions (Resolved)

### ✅ DECIDED: Platform-Agnostic Detection
- **Decision**: Generic TreeWalker analyzes ALL text nodes on ANY page
- **Rationale**: Works everywhere, zero maintenance, no platform-specific code
- **Impact**: Extension works on any website, not just social media

### ✅ DECIDED: Two-Layer Filtering System
- **Decision**: Layer 1 = Keyword filter (local), Layer 2 = AI filter (Groq)
- **Rationale**: Keywords provide instant, free filtering; AI handles nuanced cases
- **Impact**: Fast blocking for known bad words, AI only called when needed

### ✅ DECIDED: Groq for AI Layer
- **Decision**: Use Groq instead of direct provider APIs
- **Rationale**: Single API key for 100+ models, simpler setup, flexible model switching
- **Impact**: No SDK dependencies, simple fetch() calls, user picks any model

### ✅ DECIDED: Domain Whitelist
- **Decision**: Users configure which domains to monitor
- **Rationale**: Generic detection works everywhere, users choose where to filter
- **Impact**: Works on social media, news sites, forums, anywhere

### ✅ DECIDED: Blocked Content Appearance
- **Decision**: Grey placeholder with "Content blocked • Show anyway" button
- **Rationale**: Clear, reversible, maintains layout, user always in control
- **Impact**: Simple UX, no ambiguity

### ✅ DECIDED: Error Handling
- **Decision**: Fail open (show content on any error)
- **Rationale**: Better UX than blocking, no false negatives blocking legitimate content
- **Impact**: Extension never breaks user experience

### ✅ DECIDED: API Key Storage
- **Decision**: Plaintext in chrome.storage.local with README warning
- **Rationale**: Simple for MVP, device-only storage, users control own keys
- **Impact**: Clear security posture, document the trade-offs

### ✅ DECIDED: No Caching, No Stats, No Popup
- **Decision**: Simplify to absolute minimum for MVP
- **Rationale**: Validate core concept first, add features based on real usage
- **Impact**: Faster development, simpler architecture

### 🤔 OPEN: Implementation Details

These can be decided during implementation:
1. **Minimum text length**: 20 characters (tentative, can adjust)
2. **MutationObserver debounce**: Start without debounce, add if needed
3. **Content hash algorithm**: Simple hash for deduplication
4. **Model selection UI**: Dropdown with provider-specific models

## Technical Implementation Plan

### Project Structure (Simplified)
```
toxic-blocker/
├── src/
│   ├── background.ts              # Service worker: Vercel AI SDK integration
│   ├── content.ts                 # Content script: TreeWalker + MutationObserver
│   ├── options/
│   │   ├── options.html           # Settings UI
│   │   ├── options.ts             # Settings logic
│   │   └── options.css            # Styling
│   ├── types.ts                   # Shared TypeScript types
│   └── utils.ts                   # Simple helpers (hash, etc.)
├── public/
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── manifest.json              # Manifest V3 configuration
├── package.json                   # Vercel AI SDK + dependencies
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # Setup instructions, provider comparison
```

**File Count Comparison:**
- **Original Plan**: ~28 files across many directories
- **Simplified**: ~12 files total
- **Reduction**: ~60% fewer files

### Technology Stack

**Core**
- TypeScript 5.x
- Chrome Manifest V3
- Vanilla JavaScript (no framework)

**Key Dependencies**
- None for production! (Groq uses simple fetch())
- @types/chrome (Chrome API types for development)

**Development Tools**
- Vite (bundler)
- TypeScript compiler

**Testing**
- Manual testing on real websites
- Console logging for debugging
- Test keyword filter and AI filter separately

### LLM Prompt Template

**Toxicity Detection Prompt (MVP)**
```typescript
const TOXICITY_PROMPT = `Analyze this text for content. Consider toxic if it contains:
- Personal attacks, insults, or harassment
- Hate speech or discriminatory language
- Encouragement of arguments or conflict
- Threats or violent language
- Deliberately upsetting or triggering content
- Aggressive or inflammatory tone

Text: """${text}"""

Respond with JSON only: {"is_toxic": boolean, "confidence": 0.0-1.0}`;

// Example usage with Groq API
async function analyzeWithAI(text: string, apiKey: string, model: string): Promise<ToxicityAnalysis> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model, // e.g., 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'
      messages: [{ role: 'user', content: TOXICITY_PROMPT.replace('${text}', text) }],
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

### Type Definitions

```typescript
// types.ts

// Settings stored in chrome.storage.local
interface Settings {
  // Layer 1: Keyword Filter
  keywords: string; // Comma-separated keywords (e.g., "hate, toxic, kill")

  // Layer 2: AI Filter (Groq)
  groqApiKey: string; // Groq API key
  selectedModel: string; // e.g., 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'

  // Domain whitelist
  enabledDomains: string[]; // e.g., ['twitter.com', 'reddit.com']
}

// Parsed keywords (computed from settings.keywords)
type ParsedKeywords = string[]; // Trimmed, lowercased keywords

// Filter result
interface FilterResult {
  is_toxic: boolean;
  matched_by: 'keyword' | 'ai' | 'none';
  matched_keyword?: string; // If matched by keyword
  confidence?: number; // If matched by AI (0-1)
}

// LLM Analysis Result (from Groq)
interface ToxicityAnalysis {
  is_toxic: boolean;
  confidence: number; // 0-1
}

// Message passing between content script and background
interface AnalyzeTextMessage {
  action: 'analyzeText';
  text: string;
  textHash: string; // For deduplication
}

interface AnalysisResponse {
  is_toxic: boolean;
  matched_by: 'keyword' | 'ai' | 'none';
  error?: string; // If analysis failed
}
```

## Example User Flows (With File References)

### Flow 1: First-Time Setup
```
1. User installs extension
   → Chrome calls chrome.runtime.onInstalled in src/background.ts
   → Redirect to src/options/options.html

2. User sees options page with two sections:
   → Keyword Filter section (text field)
   → AI Filter section (API key, model dropdown)

3. User enters keywords: "hate, toxic, kill, die"
   → options.ts parses and displays: "4 keywords configured"
   → Keywords stored as comma-separated string

4. User enters Groq API key and clicks "Test Connection"
   → options.ts:testApiKey() sends message to background
   → background.ts makes test API call to Groq
   → Returns success/failure to options page
   → Shows checkmark or error message

5. User selects model: "llama-3.3-70b-versatile" and clicks "Save"
   → options.ts:saveSettings() writes to chrome.storage.local
   → Settings: {keywords: 'hate, toxic, kill, die', groqApiKey: '...', selectedModel: '...', enabledDomains: [...]}
   → Shows "Settings saved!" notification

6. User navigates to twitter.com
   → content.ts loads on page
   → Reads settings from chrome.storage.local
   → Initializes MutationObserver
```

### Flow 2: Blocking Toxic Content (Two-Layer Filtering)
```
1. User scrolls Twitter feed
   → New tweets appear in DOM
   → MutationObserver in content.ts fires

2. Detector finds new tweet text
   → TreeWalker finds text nodes
   → Filters: text.length > 20, not already processed
   → Marks element with data attribute

3. Content script sends text to background
   → content.ts calls chrome.runtime.sendMessage()
   → Message: {action: 'analyzeText', text: '...', textHash: '...'}

4. Background receives message - LAYER 1: KEYWORD FILTER
   → background.ts:onMessage() handler
   → Parses keywords from settings: ['hate', 'toxic', 'kill', 'die']
   → Checks if text contains any keyword (case-insensitive)

   4a. IF KEYWORD MATCH FOUND:
       → Return immediately: {is_toxic: true, matched_by: 'keyword', matched_keyword: 'hate'}
       → Skip AI filter entirely (saves API call)

   4b. IF NO KEYWORD MATCH:
       → Proceed to Layer 2

5. LAYER 2: AI FILTER (only if keyword filter passed)
   → Check if Groq API key is configured
   → If no API key: Return {is_toxic: false, matched_by: 'none'}
   → If API key exists: Call Groq API
   → Response: {is_toxic: true, confidence: 0.87}
   → Return: {is_toxic: true, matched_by: 'ai', confidence: 0.87}

6. Content script applies block filter
   → element.style.display = 'none'
   → Inserts placeholder: <div class="toxic-blocked">Content blocked • <button>Show anyway</button></div>

7. User sees blocked content placeholder
   → User can click "Show anyway" to reveal original content
```

## References & Research

### Internal References
- Repository: `/Users/joeywang/Documents/side_projects/toxic-blocker/` (empty, greenfield project)
- Target platforms: Instagram, X/Twitter, Facebook, Reddit

### External References

**Chrome Extension Documentation**
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate) - Manifest V3 requirements and changes
- [Content Scripts API](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) - DOM access and messaging
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Settings persistence
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Background script patterns

**Groq API Documentation**
- [Groq API Docs](https://groq.com/docs) - API reference and usage
- [Groq Models](https://groq.com/models) - Available models and pricing
- [Groq Quickstart](https://groq.com/docs/quickstart) - Getting started guide

**LLM API Documentation (via Groq)**
- [OpenAI Models](https://groq.com/models?q=openai) - GPT-4o, GPT-4o-mini via Groq
- [Anthropic Models](https://groq.com/models?q=anthropic) - Claude models via Groq
- [Google Models](https://groq.com/models?q=google) - Gemini models via Groq

**Best Practices**
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/develop/concepts/content-filtering) - Content filtering patterns
- [MutationObserver Performance](https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers) - Efficient DOM monitoring
- [Extension Security](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html) - OWASP security guidelines

**Community Resources**
- [chrome-extension-boilerplate-react-vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite) - Modern boilerplate with TypeScript
- [Build AI Moderation System](https://dev.to/pezzo/build-an-ai-powered-moderation-system-in-under-10-minutes-using-javascript-a6d) - LLM moderation patterns

### Related Work
- Google Jigsaw Perspective API - Free content scoring API (alternative to LLM)
- Detoxify - Open-source BERT-based content classifier
- Content moderation extensions: "Block the Worst", "Twitter Toxicity Filter"

### Cost Estimates

**Keyword Filter (Layer 1):**
- Cost: **$0.00** (runs locally, no API calls)
- If keywords catch 50% of unwanted content, AI costs are cut in half!

**AI Filter via Groq (Layer 2):**
Using Gemini Flash (recommended):
- Input: ~600 tokens/request (tweet + prompt)
- Output: ~50 tokens/request (JSON response)
- Cost via Groq: ~$0.000075/request
- **1000 AI requests/day = $2.25/month**
- **With keyword filter catching 50% → $1.12/month**

**Recommendation**:
- Set up keywords for known bad words (free filtering!)
- Use `llama-3.3-70b-versatile` via Groq for AI layer (cheapest)

---

## Next Steps

### Immediate Actions
1. **Set Up Development Environment**
   - Initialize npm project
   - Configure TypeScript + Vite
   - Create manifest.json
   - Set up project structure

2. **Implement Two-Layer Filtering**
   - Layer 1: Keyword filter (local matching)
   - Layer 2: AI filter (Groq API)

3. **Build Options Page**
   - Keyword input field
   - Groq API key input
   - Model selection dropdown
   - Domain whitelist management

### Definition of Done (Simplified MVP)

**Core Functionality:**
- [ ] Extension loads without errors on any website
- [ ] Generic TreeWalker detects text content (>20 chars)
- [ ] MutationObserver finds dynamically added content
- [ ] Two-layer filtering works correctly:
  - [ ] Layer 1: Keyword filter blocks matching content instantly
  - [ ] Layer 2: AI filter (Groq) analyzes remaining content
- [ ] Matching content blocked with grey placeholder
- [ ] "Show anyway" button reveals original content
- [ ] Content hash deduplication prevents re-analysis

**Settings & Configuration:**
- [ ] Options page accessible from extension menu
- [ ] **Keyword Filter:**
  - [ ] Text field for comma-separated keywords
  - [ ] Keywords parsed correctly (trimmed, case-insensitive)
  - [ ] Empty field = keyword filter disabled
- [ ] **AI Filter:**
  - [ ] Groq API key input
  - [ ] Model selection dropdown
  - [ ] API key validation with test button works
  - [ ] Empty API key = AI filter disabled
- [ ] User can add/remove domains from whitelist
- [ ] Default domains pre-configured (twitter.com, reddit.com, etc.)
- [ ] Settings persist in chrome.storage.local

**Error Handling:**
- [ ] Invalid Groq API key shows clear error message
- [ ] Network failures fail open (content visible)
- [ ] API errors logged to console with helpful messages
- [ ] Extension never breaks website functionality

**Documentation:**
- [ ] README with installation instructions
- [ ] Groq setup guide
- [ ] Security disclosure (API keys stored locally)

**Testing:**
- [ ] Tested keyword filter with various keywords
- [ ] Tested AI filter with Groq
- [ ] Tested on Twitter, Reddit, Instagram, Facebook
- [ ] Tested with dynamic content (infinite scroll)
- [ ] Tested error scenarios (no API key, bad key, network offline)
- [ ] Tested with only keywords (no AI)
- [ ] Tested with only AI (no keywords)
- [ ] Tested with both layers configured

---

**Last Updated**: 2025-12-27
**Status**: Planning Phase - Ready for Implementation
**Next Milestone**: Implement two-layer filtering (Keyword + Groq AI)
