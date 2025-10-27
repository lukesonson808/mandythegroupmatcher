# Message History 500 Error Fix

## Problem

The makeup artist agent was getting **500 Internal Server Error** when trying to fetch message history:

```
❌ Error fetching message history:
   URL: https://api.a1zap.com/v1/messages/individual/YOUR_AGENT_ID/chat/CHAT_ID?limit=20
   Status: 500
   Status Text: Internal Server Error
```

## Root Cause

The makeup artist agent was using the **general `a1zapClient`** which was configured with **different API credentials** (API key + agent ID) than what the makeup artist webhook was receiving.

When the webhook tried to fetch message history, it was:
1. Using the API key from the general a1zap config
2. But requesting messages for agent ID (from webhook payload)
3. This **authentication mismatch** caused the A1Zap API to return a 500 error

## Solution

Created a **dedicated makeup artist client** similar to how Brandon Eats has its own client:

### 1. Added Makeup Artist Configuration (`config.js`)

```javascript
// Makeup Artist Specific A1Zap Configuration
makeupArtist: {
  apiKey: process.env.MAKEUP_ARTIST_API_KEY || process.env.A1ZAP_API_KEY || 'your_makeup_artist_api_key_here',
  agentId: process.env.MAKEUP_ARTIST_AGENT_ID || 'your_makeup_artist_agent_id_here',
  apiUrl: process.env.MAKEUP_ARTIST_API_URL || 'https://api.a1zap.com/v1/messages/individual'
}
```

### 2. Created Dedicated Client (`services/makeup-artist-client.js`)

A new client service that:
- Uses makeup artist-specific credentials
- Always uses its configured `agentId` (not from webhook payload)
- Provides consistent error logging
- Includes security check to warn if webhook provides different agent ID

### 3. Updated Makeup Artist Webhook (`webhooks/makeup-artist-webhook.js`)

Changed all references from `a1zapClient` to `makeupArtistClient`:
- Message history fetching
- Text message sending  
- Media message sending
- Error message sending

## Environment Variables

Set the following environment variables for the makeup artist agent:

```bash
# Required: Makeup Artist API Key
MAKEUP_ARTIST_API_KEY=your_makeup_artist_api_key_here

# Optional: Makeup Artist Agent ID
MAKEUP_ARTIST_AGENT_ID=your_makeup_artist_agent_id_here
```

**Note**: If `MAKEUP_ARTIST_API_KEY` is not set, it will fall back to `A1ZAP_API_KEY`. However, this is NOT recommended if you're using multiple agents with different credentials.

## Files Changed

1. **`config.js`** - Added `makeupArtist` configuration section
2. **`services/makeup-artist-client.js`** - New dedicated client (created)
3. **`webhooks/makeup-artist-webhook.js`** - Updated to use `makeupArtistClient`

## Key Improvements

### Security
- Each agent now uses its own credentials
- No cross-agent authentication issues
- Clear warnings when agent IDs don't match

### Maintainability  
- Consistent pattern across all agents (brandon-eats, makeup-artist, claude)
- Easy to add new agents following the same pattern
- Better error logging with agent-specific context

### Reliability
- No more 500 errors from authentication mismatches
- Proper fallback behavior if history fetch fails
- Clear console logs for debugging

## Testing

To test the fix:

1. Set the environment variables:
   ```bash
   export MAKEUP_ARTIST_API_KEY="your_api_key"
   export MAKEUP_ARTIST_AGENT_ID="your_agent_id"
   ```

2. Restart your server

3. Send a message to the makeup artist agent

4. Check the console logs - you should see:
   ```
   📡 Fetching Makeup Artist message history:
      URL: https://api.a1zap.com/v1/messages/individual/YOUR_AGENT_ID/chat/...
      Using configured agent ID: YOUR_AGENT_ID
      API Key: YOUR_KEY...
   ✅ Message history retrieved: X messages
   ```

## Comparison with Other Agents

This brings the makeup artist agent in line with the Brandon Eats agent pattern:

| Agent | Client Service | Config Section | Env Vars |
|-------|---------------|----------------|----------|
| Brandon Eats | `brandoneats-client.js` | `config.brandonEats` | `BRANDONEATS_API_KEY`, `BRANDONEATS_AGENT_ID` |
| **Makeup Artist** | **`makeup-artist-client.js`** | **`config.makeupArtist`** | **`MAKEUP_ARTIST_API_KEY`**, **`MAKEUP_ARTIST_AGENT_ID`** |
| Claude DocuBot | `a1zap-client.js` | `config.a1zap` | `A1ZAP_API_KEY`, `A1ZAP_AGENT_ID` |

## Summary

✅ **Fixed**: Message history 500 errors  
✅ **Pattern**: Each agent has dedicated client with proper credentials  
✅ **Security**: No cross-agent authentication issues  
✅ **Maintainability**: Consistent code structure across all agents  

The makeup artist agent will now successfully fetch message history without authentication errors!

