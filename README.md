# Toxic Content Blocker

A Chrome extension that blocks toxic content using a two-layer filtering system: fast keyword matching and AI-powered analysis via OpenRouter.

## Features

- **Two-Layer Filtering:**
  - **Layer 1 (Keywords):** Instant, local filtering with no API calls. Free to use.
  - **Layer 2 (AI):** OpenRouter-powered toxicity detection for nuanced content.
- **Works on Any Website:** Enable filtering on any site you choose.
- **"Show Anyway" Button:** Reveal blocked content with one click.
- **Multiple AI Models:** Choose from GPT-4, Claude, Gemini, Llama, and more via OpenRouter.
- **Privacy-Focused:** API keys stored locally on your device only.

## Quick Start

### 1. Build the Extension

```bash
# Clone the repository
git clone https://github.com/yourusername/toxic-blocker.git
cd toxic-blocker

# Install dependencies
npm install

# Build the extension
npm run build
```

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist` folder from the project directory

### 3. Configure the Extension

After loading, the options page will open automatically. You can also access it by:
- Right-clicking the extension icon → **Options**
- Or navigating to `chrome://extensions/` → **Toxic Content Blocker** → **Details** → **Extension options**

## Configuration

### Layer 1: Keyword Filter (Free)

Enter comma-separated keywords that will instantly block content:

```
hate, toxic, kill, die, stupid, idiot, loser
```

- Keywords are case-insensitive
- Content containing any keyword is blocked immediately
- No API calls = no cost
- Leave empty to disable keyword filtering

### Layer 2: AI Filter (Optional)

For nuanced toxicity detection, configure the AI filter:

1. **Get an OpenRouter API Key:**
   - Go to [openrouter.ai/keys](https://openrouter.ai/keys)
   - Create an account and generate an API key
   - Copy the key (starts with `sk-or-...`)

2. **Enter the API Key** in the extension options

3. **Enter a Model ID:**
   - Browse models at [openrouter.ai/models](https://openrouter.ai/models)
   - Copy any model ID and paste it (e.g., `google/gemini-flash-1.5`)
   - Popular options:
     - `google/gemini-flash-1.5` - Cheapest, good for high volume
     - `openai/gpt-4o-mini` - Good balance of cost and accuracy
     - `anthropic/claude-3.5-haiku` - Fast and accurate
     - `meta-llama/llama-3.1-8b-instruct` - Very fast

4. **Click "Test API Connection"** to verify it works

### Enabled Websites

The extension only runs on websites in this list. By default, it includes:
- twitter.com / x.com
- reddit.com
- instagram.com
- facebook.com

**To add a website:** Enter the domain (e.g., `youtube.com`) and click **Add Website**

**To remove a website:** Click the **×** button next to the domain

## How It Works

```
Content Detected on Page
         │
         ▼
┌─────────────────────────┐
│ Is domain in Enabled    │
│ Websites list?          │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │ No        │ Yes
      ▼           ▼
   [Skip]    ┌────────────────┐
             │ Layer 1:       │
             │ Keyword Match? │
             └───────┬────────┘
                     │
               ┌─────┴─────┐
               │ Yes       │ No
               ▼           ▼
            [BLOCK]   ┌────────────────┐
                      │ Layer 2:       │
                      │ AI Configured? │
                      └───────┬────────┘
                              │
                        ┌─────┴─────┐
                        │ Yes       │ No
                        ▼           ▼
                   ┌─────────┐   [SHOW]
                   │ AI says │
                   │ toxic?  │
                   └────┬────┘
                        │
                  ┌─────┴─────┐
                  │ Yes       │ No
                  ▼           ▼
               [BLOCK]     [SHOW]
```

## Cost Estimates

### Keyword Filter (Layer 1)
- **Cost:** $0.00 (runs locally)

### AI Filter (Layer 2) via OpenRouter

| Model ID | Cost per 1K requests | Monthly (500/day) |
|----------|---------------------|-------------------|
| `google/gemini-flash-1.5` | ~$0.08 | ~$1.20 |
| `openai/gpt-4o-mini` | ~$0.15 | ~$2.25 |
| `anthropic/claude-3.5-haiku` | ~$0.25 | ~$3.75 |
| `meta-llama/llama-3.1-8b-instruct` | ~$0.05 | ~$0.75 |

**Tip:** Use keywords to catch obvious toxic content for free, and let AI handle the rest.

## Development

```bash
# Install dependencies
npm install

# Build with watch mode (auto-rebuild on changes)
npm run dev

# Production build
npm run build

# Type check
npm run type-check
```

### Project Structure

```
toxic-blocker/
├── src/
│   ├── background.ts      # Service worker: two-layer filtering logic
│   ├── content.ts         # Content script: DOM scanning and blocking
│   ├── types.ts           # TypeScript type definitions
│   ├── utils.ts           # Shared utilities
│   └── options/
│       ├── options.html   # Settings page UI
│       ├── options.ts     # Settings page logic
│       └── options.css    # Settings page styles
├── public/
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
├── dist/                  # Built extension (load this in Chrome)
└── package.json
```

## Privacy & Security

- **API Key Storage:** Stored in `chrome.storage.local` (device-only, never synced)
- **Data Sent:** Only text content is sent to OpenRouter when AI filter is used
- **No Logging:** The extension does not log or store any content
- **Open Source:** Review the code yourself

## Troubleshooting

### Extension not working on a site?
- Check if the domain is in the **Enabled Websites** list
- Refresh the page after adding a new domain
- Check the browser console for error messages

### AI filter not working?
1. Verify your API key is correct
2. Click **Test API Connection** in settings
3. Check that you have credits in your OpenRouter account
4. Try a different model

### Content not being blocked?
- Keywords are case-insensitive but must be exact matches
- AI detection requires the OpenRouter API key to be configured
- The extension fails open (shows content) on errors

## License

MIT License - see [LICENSE](LICENSE) for details.
