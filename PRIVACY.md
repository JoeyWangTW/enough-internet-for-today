# Privacy Policy

**Enough Internet for Today** is committed to protecting your privacy. This document explains what data the extension collects, how it's used, and your rights.

## Data Collection

### What We Collect
- **Nothing.** This extension does not collect, store, or transmit any personal information to us.

### What Stays on Your Device
All settings and preferences are stored locally on your device using Chrome's `storage.local` API:
- Keyword filter settings
- Simplified Chinese filter toggle
- AI filter settings (including your Groq API key)
- Enabled websites list
- UI preferences (like "Allow Reveal")

This data is **never synced** to the cloud and **never leaves your device** except as described below.

## Third-Party Services

### Groq API (Optional)
If you enable the AI filter and provide a Groq API key:
- Text content from web pages is sent to Groq's API for analysis
- Only the text being analyzed is sent, no other data
- Groq's privacy policy applies: https://groq.com/privacy-policy/

**You control this:** The AI filter is optional. If you don't enter an API key or disable the AI filter, no data is sent to any external service.

### No Other Third Parties
- No analytics or tracking services
- No advertising networks
- No data brokers
- No telemetry

## Data Storage

| Data | Location | Synced? |
|------|----------|---------|
| Settings | Your device only | No |
| API key | Your device only | No |
| Blocked content | Not stored | N/A |
| Browsing history | Not accessed | N/A |

## Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `storage` | Save your settings locally |
| `<all_urls>` | Scan page content on enabled websites |

## Your Rights

- **Access:** View all stored data in Chrome's extension storage
- **Delete:** Uninstall the extension to remove all data
- **Control:** Enable/disable features at any time
- **Transparency:** This extension is open source

## Open Source

The complete source code is available for review:
https://github.com/JoeyWangTW/enough-internet-for-today

## Changes to This Policy

Any changes will be reflected in this document with an updated date.

## Contact

For privacy concerns, open an issue on GitHub:
https://github.com/JoeyWangTW/enough-internet-for-today/issues

---

*Last updated: December 2024*
