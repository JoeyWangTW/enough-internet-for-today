# Enough Internet for Today

A Chrome extension for web content filtering using keywords, Simplified Chinese detection, and AI-powered analysis via Groq.

## Features

- **Two-Layer Filtering:**
  - **Layer 1 (Keywords):** Instant, local filtering with comma-separated keywords. Free to use.
  - **Layer 1 (Simplified Chinese):** Detect and block Simplified Chinese content while allowing Traditional Chinese.
  - **Layer 2 (AI):** Groq-powered content detection for nuanced filtering with ultra-low latency.
- **Works on Any Website:** Enable filtering on any site you choose.
- **"Show" Button:** Optionally reveal blocked content with one click.
- **Auto-Save:** Settings save automatically as you make changes.
- **Privacy-Focused:** API keys stored locally on your device only.

## Quick Start

### 1. Build the Extension

```bash
# Clone the repository
git clone https://github.com/JoeyWangTW/internet-filter.git
cd internet-filter

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

After loading, the options page will open automatically. You can also access it by clicking the extension icon in the toolbar.

## Configuration

### Layer 1: Keyword Filter (Free)

Enter comma-separated keywords that will instantly block content:

```
hate, toxic, kill, die, stupid, idiot, loser
```

- Keywords are case-insensitive
- Content containing any keyword is blocked immediately
- No API calls = no cost

### Layer 1: Simplified Chinese Filter (Free)

Toggle to detect and block content written in Simplified Chinese. Traditional Chinese content passes through.

- Uses character variant detection (opencc-js)
- Requires at least 3 Chinese characters to trigger
- No API calls = no cost

### Layer 2: AI Filter (Optional)

For nuanced content detection, configure the AI filter:

1. **Get a Groq API Key:**
   - Go to [console.groq.com/keys](https://console.groq.com/keys)
   - Create an account and generate an API key
   - Copy the key (starts with `gsk_...`)

2. **Enter the API Key** in the extension options

3. **Describe What to Filter:**
   - Enter a description like "toxic or hate speech content"
   - Or "political arguments", "spoilers", "negative content"

4. **Select a Model:**
   - `llama-3.3-70b-versatile` - Best accuracy (default)
   - `llama-3.1-8b-instant` - Fastest
   - `mixtral-8x7b-32768` - Good balance

5. **Click "Test API Connection"** to verify it works

### Enabled Websites

The extension only runs on websites in this list. By default:
- twitter.com / x.com
- reddit.com
- instagram.com
- facebook.com
- threads.com

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
             │ Layer 1a:      │
             │ Keyword Match? │
             └───────┬────────┘
                     │
               ┌─────┴─────┐
               │ Yes       │ No
               ▼           ▼
            [BLOCK]   ┌─────────────────────┐
                      │ Layer 1b:           │
                      │ Simplified Chinese? │
                      └───────┬─────────────┘
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
                            │ block?  │
                            └────┬────┘
                                 │
                           ┌─────┴─────┐
                           │ Yes       │ No
                           ▼           ▼
                        [BLOCK]     [SHOW]
```

## Cost Estimates

### Layer 1 Filters
- **Keywords:** $0.00 (runs locally)
- **Simplified Chinese:** $0.00 (runs locally)

### Layer 2: AI Filter via Groq

Groq offers generous free tier with rate limits. For heavy usage:

| Model | Speed | Quality |
|-------|-------|---------|
| `llama-3.3-70b-versatile` | Fast | Best |
| `llama-3.1-8b-instant` | Fastest | Good |
| `mixtral-8x7b-32768` | Fast | Good |

**Tip:** Use keywords and Simplified Chinese filter to catch obvious content for free, and let AI handle the nuanced cases.

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
enough-internet-for-today/
├── src/
│   ├── background.ts      # Service worker: filtering logic
│   ├── content.ts         # Content script: DOM scanning and blocking
│   ├── types.ts           # TypeScript type definitions
│   ├── utils.ts           # Shared utilities
│   └── options/
│       ├── options.html   # Settings page UI
│       ├── options.ts     # Settings page logic (auto-save)
│       └── options.css    # Settings page styles
├── public/
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
├── dist/                  # Built extension (load this in Chrome)
└── package.json
```

## Privacy & Security

- **API Key Storage:** Stored in `chrome.storage.local` (device-only, never synced)
- **Data Sent:** Only text content is sent to Groq when AI filter is enabled
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
3. Check that you have credits/quota in your Groq account
4. Try a different model

### Content not being blocked?
- Keywords are case-insensitive but must match as substrings
- Simplified Chinese filter requires at least 3 Chinese characters
- AI detection requires the Groq API key to be configured
- Minimum text length is 10 characters
- The extension fails open (shows content) on errors

## License

MIT License - see [LICENSE](LICENSE) for details.
