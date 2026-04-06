# Gemini API Setup Guide

ScribeAI uses Google Gemini 2.0 Flash for AI-powered transcription summaries.
The app runs in simulation mode without a key — real AI requires one.

## Get your API key (free)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the key

## Add the key to ScribeAI

Create a `.env.local` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Then open `.env.local` and set:

```env
GEMINI_API_KEY=your_key_here
```

Restart the server — you should see:

```
✅ Gemini 2.0 Flash ready (Speed Mode)
```

## Quota limits (free tier)

| Limit | Value |
|---|---|
| Requests per day | 1,500 |
| Requests per minute | 15 |
| Tokens per minute | 1,000,000 |

For higher limits, upgrade at https://ai.google.dev/pricing

## Troubleshooting

**`429 Too Many Requests`** — You've hit the rate limit. Wait 1–2 minutes or upgrade your plan.

**`API_KEY_INVALID`** — Double-check the key in `.env.local`. No extra spaces.

**`Model not found`** — ScribeAI auto-falls back through `gemini-2.5-flash` → `gemini-1.5-flash` if 2.0 Flash is unavailable in your region.

**No key at all** — App works fine with simulated transcription and basic summaries.
