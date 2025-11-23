# Gemini AI Setup Guide

## 🚨 API Key Required

The ScribeAI application uses Google's **Gemini 2.0 Flash** AI model for advanced transcription and summarization. You need to set up your own API key.

## 📋 Setup Steps

### 1. Get Your Gemini API Key
1. Visit: https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your new API key

### 2. Configure ScribeAI
1. Open `.env.local` in the project root
2. Replace `your_gemini_api_key_here` with your actual API key:
   ```
   GEMINI_API_KEY="AIzaSyYourActualAPIKeyHere"
   ```
3. Save the file

### 3. Restart the Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd server
node index.js
```

## 🆓 Free Tier Limits

Gemini 2.0 Flash offers a generous free tier:
- **1,500 requests per day**
- **1 million tokens per month**  
- **15 requests per minute**
- **⚡ 2x faster than previous models**
- **🎯 Better accuracy for transcription tasks**

## 🛠️ Without API Key

The app works without an API key using:
- ✅ High-quality mock responses
- ✅ Professional transcription formatting
- ✅ All core functionality
- 🤖 Smart fallback summaries

## 🔧 Troubleshooting

**Common Issues:**
- **403 Forbidden**: API key issue - generate a new one
- **429 Too Many Requests**: Rate limit - wait 1-15 minutes
- **404 Not Found**: Model unavailable - app auto-switches to fallbacks

**Rate Limit Solutions:**
1. Wait for quota reset (usually hourly)
2. Use fewer requests per minute
3. Upgrade to paid plan if needed

## 💡 Pro Tips

1. **Keep API key secure** - never commit to Git
2. **Monitor usage** at: https://ai.dev/usage
3. **Start with free tier** - upgrade only if needed
4. **Mock responses** are high-quality for development

## 📞 Support

- Gemini API Docs: https://ai.google.dev/gemini-api/docs
- Rate Limits: https://ai.google.dev/gemini-api/docs/rate-limits
- ScribeAI works great with or without the API key!