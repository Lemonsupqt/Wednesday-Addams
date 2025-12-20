# Wednesday AI Chatbot Setup Guide

## Overview

The Wednesday AI chatbot adds an AI-powered Wednesday Addams character to your game chat rooms. Wednesday responds with her signature dark humor and sardonic wit when mentioned in chat messages.

## Requirements

- Node.js 16+
- OpenAI API key (get one at https://platform.openai.com/api-keys)
- Active internet connection

## Setup Instructions

### 1. Get an OpenAI API Key

1. Visit https://platform.openai.com/api-keys
2. Sign up or log in to your OpenAI account
3. Create a new API key
4. Copy the key (it starts with `sk-`)

### 2. Configure the Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   WEDNESDAY_AI_ENABLED=true
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

You should see:
```
✅ Wednesday AI: ENABLED (OpenAI)
```

If you see "Wednesday AI: DISABLED", check your API key configuration.

## How to Use

### Triggering Wednesday AI

Wednesday will respond when your chat message includes:
- The word "wednesday" (case-insensitive)
- "@ai"
- "hey ai"

### Examples

```
Player: "Hey Wednesday, what do you think about this game?"
Wednesday AI: "I find your competitive spirit as delightful as a funeral procession. Though I suspect the real game is watching you struggle."

Player: "@ai should we play trivia?"
Wednesday AI: "Knowledge is power, and power is the ability to make your enemies suffer intellectually. I approve."
```

### AI Status Indicator

In the chat section, you'll see:
- **"Wednesday AI: ENABLED (OpenAI)"** - AI is active and ready to respond
- **"Wednesday AI: DISABLED"** - No API key configured or API unavailable

### AI Message Styling

Wednesday's messages appear with:
- Purple highlighted background
- 🖤 Wednesday AI sender name
- Special border to distinguish from player messages

## Troubleshooting

### "Wednesday AI: DISABLED (No API key)"

**Solution**: Add your OpenAI API key to the `.env` file.

### API Key Not Working

1. Verify the API key is correct (starts with `sk-`)
2. Check that you have credits in your OpenAI account
3. Ensure the key hasn't been revoked

### No Response from AI

1. Check that your message includes trigger words (wednesday, @ai, hey ai)
2. Verify the server console for error messages
3. Check your internet connection

### "My connection to the spirit world seems... interrupted"

This is Wednesday's way of saying the OpenAI API is unavailable. Common causes:
- Network connectivity issues
- OpenAI API is down
- Rate limiting (too many requests)
- Invalid API key

## Cost Considerations

The Wednesday AI uses OpenAI's GPT-3.5-turbo model, which costs approximately:
- $0.0015 per 1K input tokens
- $0.002 per 1K output tokens

Typical conversation costs are very low (less than $0.01 per 100 messages).

Monitor your usage at: https://platform.openai.com/usage

## Privacy & Security

- **Never commit your `.env` file to git** - it's already in `.gitignore`
- **Don't share your API key** - it can be used to charge your OpenAI account
- **Rotate keys regularly** - create new keys periodically for security
- Chat history is kept in memory only (last 5 messages for context)
- No data is sent to OpenAI except the current and recent chat messages

## Advanced Configuration

### Adjust Response Parameters

In `server.js`, modify the `generateWednesdayResponse()` function:

```javascript
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',        // Model to use
  max_tokens: 150,                // Maximum response length
  temperature: 0.8,               // Creativity (0-2, higher = more creative)
  presence_penalty: 0.6,          // Avoid repetition
  frequency_penalty: 0.3          // Reduce repeated phrases
});
```

### Customize Wednesday's Personality

Edit `WEDNESDAY_SYSTEM_PROMPT` in `server.js` to adjust her personality traits and response style.

## Disabling the AI

To disable Wednesday AI without removing code:

1. Remove or comment out the `OPENAI_API_KEY` in `.env`
2. Restart the server

The app works perfectly fine without AI - it's an optional enhancement.

## Support

For issues with:
- **OpenAI API**: https://help.openai.com/
- **Game functionality**: Create an issue in this repository
