/**
 * Webhook Helper Functions for A1Zap Agents
 * 
 * This module provides reusable utilities for all A1Zap webhook handlers:
 * - Message deduplication
 * - Message history processing
 * - Response sending with error handling
 * - Rich content block creation
 * - Test mode detection
 */

// ============================================================================
// MESSAGE DEDUPLICATION
// ============================================================================
// Shared across ALL webhooks to prevent duplicate processing
const processedMessages = new Map();
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [messageId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_EXPIRY_MS) {
      processedMessages.delete(messageId);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Check if a message has already been processed (prevents duplicates)
 * @param {string} messageId - The message ID to check
 * @returns {boolean} - True if message was already processed
 */
function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  return processedMessages.has(messageId);
}

/**
 * Mark a message as processed
 * @param {string} messageId - The message ID to mark
 */
function markMessageProcessed(messageId) {
  if (messageId) {
    processedMessages.set(messageId, Date.now());
    console.log(`✅ Message ${messageId} marked as processed`);
  }
}

/**
 * Get stats about processed messages
 * @returns {object} - Stats about message deduplication
 */
function getDeduplicationStats() {
  return {
    totalTracked: processedMessages.size,
    expiryMs: MESSAGE_EXPIRY_MS
  };
}

// ============================================================================
// MESSAGE HISTORY PROCESSING
// ============================================================================

/**
 * Process message history into conversation format for AI models
 * @param {Array} messageHistory - Raw message history from A1Zap
 * @param {string} agentId - The agent's ID to identify agent messages
 * @param {boolean} includeImages - Whether to track image URLs (default: false)
 * @returns {Array} - Conversation array with role, content, and optionally imageUrl
 */
function processMessageHistory(messageHistory, agentId, includeImages = false) {
  const conversation = [];

  if (!messageHistory || messageHistory.length === 0) {
    return conversation;
  }

  messageHistory.forEach(msg => {
    // Process messages with text content
    if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
      const role = msg.isAgent || msg.senderId === agentId ? 'assistant' : 'user';
      const content = msg.senderName && !msg.isAgent
        ? `${msg.senderName}: ${msg.content}`
        : msg.content;

      const messageObj = {
        role: role,
        content: String(content)
      };

      // Track image URL if requested and available
      if (includeImages && msg.media?.url) {
        messageObj.imageUrl = msg.media.url;
      }

      conversation.push(messageObj);
    } else if (includeImages && msg.media?.url) {
      // Include messages that only have images (no text)
      const role = msg.isAgent || msg.senderId === agentId ? 'assistant' : 'user';
      conversation.push({
        role: role,
        content: '[Image]',
        imageUrl: msg.media.url
      });
    } else if (msg.content && typeof msg.content === 'object') {
      // Skip messages with complex content structures (e.g., file references, rich media)
      console.log(`⚠️  Skipping message with complex content structure`);
    }
  });

  return conversation;
}

/**
 * Fetch and process message history from A1Zap
 * @param {object} client - A1Zap client (a1zapClient or brandonEatsClient)
 * @param {string} chatId - The chat ID
 * @param {string} agentId - The agent's ID
 * @param {number} limit - Number of messages to fetch (default: 10)
 * @param {boolean} includeImages - Whether to track image URLs (default: false)
 * @returns {Promise<Array>} - Processed conversation array
 */
async function fetchAndProcessHistory(client, chatId, agentId, limit = 10, includeImages = false) {
  const conversation = [];

  if (!chatId || !agentId) {
    console.warn('Missing chatId or agentId - cannot fetch history');
    return conversation;
  }

  try {
    console.log(`Fetching message history for chatId: ${chatId} (limit: ${limit})`);
    // Pass agentId to getMessageHistory so it uses the correct agent for fetching
    const history = await client.getMessageHistory(chatId, limit, agentId);

    if (history && history.length > 0) {
      console.log(`Retrieved ${history.length} messages from history`);
      return processMessageHistory(history, agentId, includeImages);
    } else {
      console.log('No message history available (may be first message or API returned empty)');
    }
  } catch (error) {
    console.warn('⚠️  Failed to fetch message history:', error.message);
    // Continue without history - don't fail the entire request
  }

  return conversation;
}

/**
 * Find the most recent user-uploaded image in conversation history
 * @param {Array} conversation - Processed conversation array with imageUrl fields
 * @param {number} lookbackLimit - How many messages to look back (default: 5)
 * @returns {string|null} - Image URL or null if none found
 */
function findRecentImage(conversation, lookbackLimit = 5) {
  if (!conversation || conversation.length === 0) {
    return null;
  }

  // Look backwards through recent messages for user images
  const recentMessages = conversation.slice(-lookbackLimit);
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.role === 'user' && msg.imageUrl) {
      console.log(`📸 Found recent image from ${lookbackLimit - i} messages ago: ${msg.imageUrl}`);
      return msg.imageUrl;
    }
  }

  return null;
}

/**
 * Extract previous makeup request context from conversation
 * Looks for the most recent substantive makeup request
 * @param {Array} conversation - Processed conversation array
 * @param {number} lookbackLimit - How many messages to look back (default: 10)
 * @returns {string|null} - Previous makeup request or null
 */
function extractPreviousMakeupRequest(conversation, lookbackLimit = 10) {
  if (!conversation || conversation.length === 0) {
    return null;
  }

  // Look backwards through recent user messages
  const recentMessages = conversation.slice(-lookbackLimit);
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.role === 'user' && msg.content && msg.content !== '[Image]') {
      const content = msg.content.toLowerCase();
      
      // Check if it's a substantive makeup request (not just "yes", "ok", etc.)
      const isSubstantive = content.length > 10 || 
                           content.includes('makeup') ||
                           content.includes('lipstick') ||
                           content.includes('eye') ||
                           content.includes('glam') ||
                           content.includes('natural') ||
                           content.includes('dramatic') ||
                           content.includes('blue') ||
                           content.includes('red') ||
                           content.includes('pink') ||
                           content.includes('slim');
      
      if (isSubstantive) {
        console.log(`💄 Found previous makeup request: "${msg.content}"`);
        return msg.content;
      }
    }
  }

  return null;
}

// ============================================================================
// RESPONSE SENDING
// ============================================================================

/**
 * Send a response message to A1Zap with error handling
 * @param {object} client - A1Zap client (a1zapClient or brandonEatsClient)
 * @param {string} chatId - The chat ID
 * @param {string} message - The message text
 * @param {Array} richContentBlocks - Optional rich content blocks
 * @returns {Promise<object|null>} - Send result or null if failed
 */
async function sendResponse(client, chatId, message, richContentBlocks = null) {
  // Skip sending for test chats
  if (isTestChat(chatId)) {
    console.log('⚠️  Test mode: Skipping A1Zap send');
    return null;
  }

  try {
    const result = await client.sendMessage(chatId, message, richContentBlocks);
    console.log('✅ Message sent successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to send message to A1Zap:', error.message);
    // Don't throw - let the webhook continue
    return null;
  }
}

// ============================================================================
// TEST MODE DETECTION
// ============================================================================

/**
 * Check if this is a test chat (shouldn't send actual messages)
 * @param {string} chatId - The chat ID
 * @returns {boolean} - True if test chat
 */
function isTestChat(chatId) {
  return chatId && chatId.startsWith('test-');
}

// ============================================================================
// RICH CONTENT HELPERS
// ============================================================================

/**
 * Create a social share rich content block
 * @param {string} platform - Platform name (tiktok, instagram, youtube, etc.)
 * @param {string} url - The URL to share
 * @param {number} order - Display order (default: 0)
 * @returns {object} - Rich content block
 */
function createSocialShareBlock(platform, url, order = 0) {
  return {
    type: 'social_share',
    data: {
      platform: platform.toLowerCase(),
      url: url
    },
    order: order
  };
}

/**
 * Create multiple social share blocks from an array of links
 * @param {Array} links - Array of {platform, url} objects or {url, name} objects
 * @param {string} defaultPlatform - Default platform if not specified (default: 'tiktok')
 * @returns {Array} - Array of rich content blocks
 */
function createSocialShareBlocks(links, defaultPlatform = 'tiktok') {
  if (!links || links.length === 0) {
    return [];
  }

  return links.map((link, index) => {
    const platform = link.platform || defaultPlatform;
    return createSocialShareBlock(platform, link.url, index);
  });
}

// ============================================================================
// WEBHOOK REQUEST VALIDATION
// ============================================================================

/**
 * Validate webhook request payload
 * @param {object} body - Request body
 * @returns {object} - { valid: boolean, error: string|null, data: object }
 */
function validateWebhookPayload(body) {
  const { chat, message, agent } = body;

  if (!chat?.id) {
    return {
      valid: false,
      error: 'Missing chat.id in webhook payload',
      data: null
    };
  }

  if (!message?.content) {
    return {
      valid: false,
      error: 'Missing message.content in webhook payload',
      data: null
    };
  }

  return {
    valid: true,
    error: null,
    data: {
      chatId: chat.id,
      agentId: agent?.id,
      messageId: message?.id,
      userMessage: message.content,
      chat,
      message,
      agent
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Deduplication
  isDuplicateMessage,
  markMessageProcessed,
  getDeduplicationStats,
  
  // Message history
  processMessageHistory,
  fetchAndProcessHistory,
  findRecentImage,
  extractPreviousMakeupRequest,
  
  // Response sending
  sendResponse,
  isTestChat,
  
  // Rich content
  createSocialShareBlock,
  createSocialShareBlocks,
  
  // Validation
  validateWebhookPayload
};

