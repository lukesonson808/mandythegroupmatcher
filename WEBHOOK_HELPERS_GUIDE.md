# Webhook Helpers Guide

## Overview

The `webhook-helpers.js` module provides reusable utilities for all A1Zap webhook handlers, making it easier to build consistent, reliable agents with common features like message deduplication, history processing, and rich content support.

## Key Features

### 🔄 Message Deduplication

Prevents duplicate message processing across **ALL** webhooks (shared state).

**Benefits:**
- Prevents race conditions when A1Zap sends duplicate webhooks
- Automatically expires old entries (5 minutes)
- Zero configuration required

**Usage:**
```javascript
const webhookHelpers = require('../services/webhook-helpers');

// Check if message is a duplicate
if (webhookHelpers.isDuplicateMessage(messageId)) {
  return res.json({ success: true, skipped: true, reason: 'duplicate_message' });
}

// Mark message as processed
webhookHelpers.markMessageProcessed(messageId);
```

---

### 📋 Request Validation

Validates webhook payload structure in one call.

**Usage:**
```javascript
const validation = webhookHelpers.validateWebhookPayload(req.body);
if (!validation.valid) {
  return res.status(400).json({ success: false, error: validation.error });
}

const { chatId, agentId, messageId, userMessage } = validation.data;
```

---

### 💬 Message History Processing

Fetches and converts A1Zap message history into conversation format for AI models.

**Usage:**
```javascript
// Fetch last 10 messages and process them
const conversation = await webhookHelpers.fetchAndProcessHistory(
  a1zapClient,  // Your A1Zap client
  chatId,
  agentId,
  10  // Number of messages to fetch
);

// Add current message
conversation.push({ role: 'user', content: userMessage });
```

**What it does:**
- Fetches message history from A1Zap
- Converts to `{ role, content }` format for Claude/Gemini
- Handles sender names automatically
- Skips complex content (files, rich media)
- Gracefully handles errors (continues without history)

---

### 📤 Response Sending

Send responses with automatic error handling and test mode detection.

**Usage:**
```javascript
// Simple text response
const result = await webhookHelpers.sendResponse(
  brandonEatsClient,
  chatId,
  "Here's your answer!"
);

// With rich content blocks
const richBlocks = [
  { type: 'social_share', data: { platform: 'tiktok', url: '...' }, order: 0 }
];

await webhookHelpers.sendResponse(
  brandonEatsClient,
  chatId,
  "Check out this video!",
  richBlocks
);
```

**Benefits:**
- Automatically skips sending for test chats (chatId starts with `test-`)
- Error handling built-in (doesn't throw, returns null on failure)
- Cleaner code, fewer try-catch blocks

---

### 🎬 Rich Content Creation

Helper functions for creating rich content blocks (social shares, videos, etc.).

**Single block:**
```javascript
const block = webhookHelpers.createSocialShareBlock(
  'tiktok',
  'https://tiktok.com/@user/video/123',
  0  // order
);
```

**Multiple blocks:**
```javascript
const links = [
  { platform: 'instagram', url: 'https://instagram.com/...' },
  { platform: 'tiktok', url: 'https://tiktok.com/...' },
  { platform: 'youtube', url: 'https://youtube.com/...' }
];

const blocks = webhookHelpers.createSocialShareBlocks(links);

// Or with default platform
const tiktokLinks = [
  { url: 'https://tiktok.com/video/1', name: 'Restaurant 1' },
  { url: 'https://tiktok.com/video/2', name: 'Restaurant 2' }
];

const blocks = webhookHelpers.createSocialShareBlocks(tiktokLinks, 'tiktok');
```

---

### 🧪 Test Mode Detection

Check if a chat is a test chat (won't send actual messages).

**Usage:**
```javascript
if (webhookHelpers.isTestChat(chatId)) {
  console.log('Test mode - not sending to A1Zap');
}

// Or use it in conditions
if (!webhookHelpers.isTestChat(chatId)) {
  await sendSocialLinks();
}
```

---

## Complete Example: Basic Webhook

```javascript
const claudeService = require('../services/claude-service');
const a1zapClient = require('../services/a1zap-client');
const myAgent = require('../agents/my-agent');
const webhookHelpers = require('../services/webhook-helpers');

async function myWebhookHandler(req, res) {
  try {
    console.log('\\n=== My Webhook Received ===');
    
    // 1. Validate payload
    const validation = webhookHelpers.validateWebhookPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    const { chatId, agentId, messageId, userMessage } = validation.data;
    
    // 2. Check for duplicates
    if (webhookHelpers.isDuplicateMessage(messageId)) {
      return res.json({ success: true, skipped: true });
    }
    webhookHelpers.markMessageProcessed(messageId);
    
    // 3. Get conversation history
    const conversation = await webhookHelpers.fetchAndProcessHistory(
      a1zapClient,
      chatId,
      agentId,
      10
    );
    conversation.push({ role: 'user', content: userMessage });
    
    // 4. Generate response
    const response = await claudeService.chat(conversation, {
      systemPrompt: myAgent.systemPrompt
    });
    
    // 5. Send response
    await webhookHelpers.sendResponse(a1zapClient, chatId, response);
    
    // 6. Return success
    res.json({ success: true, response });
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = myWebhookHandler;
```

---

## Advanced Example: With Rich Content

```javascript
// After generating main response...
const response = await claudeService.generateText(userMessage);

// Send main response
await webhookHelpers.sendResponse(client, chatId, response);

// Check if we should send social links
if (!webhookHelpers.isTestChat(chatId)) {
  const links = await extractSocialLinks(response);
  
  if (links.length > 0) {
    const richBlocks = webhookHelpers.createSocialShareBlocks(links, 'tiktok');
    
    await webhookHelpers.sendResponse(
      client,
      chatId,
      `🎥 Here are ${links.length} videos!`,
      richBlocks
    );
  }
}
```

---

## Migration Guide

### Before (without helpers):
```javascript
// Lots of boilerplate...
if (!chat?.id) {
  return res.status(400).json({ success: false, error: 'Missing chat.id' });
}
if (!message?.content) {
  return res.status(400).json({ success: false, error: 'Missing message.content' });
}

const chatId = chat.id;
const userMessage = message.content;

// Fetch history manually
try {
  const history = await client.getMessageHistory(chatId, 10);
  history.forEach(msg => {
    // Process each message...
  });
} catch (error) {
  // Handle error...
}

// Send response
if (!chatId.startsWith('test-')) {
  try {
    await client.sendMessage(chatId, response);
  } catch (error) {
    console.error('Send failed:', error);
  }
}
```

### After (with helpers):
```javascript
// Clean and simple
const validation = webhookHelpers.validateWebhookPayload(req.body);
if (!validation.valid) {
  return res.status(400).json({ success: false, error: validation.error });
}

const { chatId, agentId, userMessage } = validation.data;

const conversation = await webhookHelpers.fetchAndProcessHistory(
  client, chatId, agentId, 10
);

await webhookHelpers.sendResponse(client, chatId, response);
```

---

## Benefits

✅ **Consistency** - All webhooks use the same patterns  
✅ **Less Code** - Reduce boilerplate by 50-70%  
✅ **Shared State** - Deduplication works across all agents  
✅ **Error Handling** - Built-in, tested error handling  
✅ **Test Mode** - Automatic detection, no manual checks  
✅ **Maintainability** - Fix bugs in one place, all agents benefit  
✅ **Extensibility** - Easy to add new common features  

---

## Architecture

```
┌─────────────────────────────────────────┐
│     webhook-helpers.js (Shared)         │
│  ┌─────────────────────────────────┐   │
│  │ Message Deduplication (Global)  │   │
│  │ - processedMessages Map         │   │
│  │ - Auto-expiry (5 min)           │   │
│  └─────────────────────────────────┘   │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │ Common Functions                │   │
│  │ - validateWebhookPayload()      │   │
│  │ - fetchAndProcessHistory()      │   │
│  │ - sendResponse()                │   │
│  │ - createSocialShareBlocks()     │   │
│  │ - isTestChat()                  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ▲         ▲
              │         │
      ┌───────┘         └───────┐
      │                         │
┌─────┴──────┐          ┌───────┴────────┐
│ brandoneats│          │ claude-docubot │
│ webhook.js │          │  webhook.js    │
└────────────┘          └────────────────┘
```

---

## Deduplication Stats

Get insights about message deduplication:

```javascript
const stats = webhookHelpers.getDeduplicationStats();
// { totalTracked: 42, expiryMs: 300000 }
```

---

## Future Enhancements

Potential additions to `webhook-helpers.js`:

- Rate limiting
- Response caching
- Typing indicators
- Read receipts
- Conversation state management
- Analytics/logging helpers
- Error reporting utilities

---

## See Also

- `services/webhook-helpers.js` - Source code
- `webhooks/brandoneats-webhook.js` - Full implementation example
- `webhooks/claude-webhook.js` - Simple implementation example
- `AGENT_PERSONALITY_GUIDE.md` - Agent configuration guide


