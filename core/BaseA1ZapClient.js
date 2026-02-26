/**
 * BaseA1ZapClient - Unified A1Zap API client
 * 
 * Replaces the duplicate clients (a1zap-client, brandoneats-client, makeup-artist-client)
 * with a single, configurable implementation.
 * 
 * Features:
 * - Send text messages
 * - Send media messages (images, videos)
 * - Retrieve message history
 * - Consistent error handling and logging
 * 
 * Usage:
 *   const client = new BaseA1ZapClient({
 *     apiKey: 'your-api-key',
 *     agentId: 'your-agent-id',
 *     apiUrl: 'https://api.a1zap.com/v1/messages/individual'
 *   });
 *   
 *   await client.sendMessage(chatId, 'Hello!');
 */

const axios = require('axios');

class BaseA1ZapClient {
  /**
   * @param {Object} config - Client configuration
   * @param {string} config.apiKey - A1Zap API key
   * @param {string} config.agentId - A1Zap agent ID
   * @param {string} config.apiUrl - A1Zap API base URL
   * @param {string} config.agentName - Optional agent name for logging
   */
  constructor(config) {
    if (!config.apiKey) {
      throw new Error('A1Zap API key is required');
    }
    if (!config.agentId) {
      throw new Error('A1Zap agent ID is required');
    }
    if (!config.apiUrl) {
      throw new Error('A1Zap API URL is required');
    }

    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
    this.apiUrl = config.apiUrl;
    this.agentName = config.agentName || 'unknown';
  }

  /**
   * Send a text message to A1Zap
   * @param {string} chatId - Chat ID to send message to
   * @param {string} content - Message content
   * @param {Array} richContentBlocks - Optional rich content blocks
   * @returns {Promise<Object>} API response
   */
  async sendMessage(chatId, content, richContentBlocks = null) {
    try {
      // Local testing mode: don't call A1Zap, just log payload and return a mock response.
      // Usage: A1ZAP_DRY_RUN=true node server.js
      const isDryRun = String(process.env.A1ZAP_DRY_RUN || '').toLowerCase() === 'true';
      if (!isDryRun) {
        this._validateApiKey();
      }

      const url = `${this.apiUrl}/${this.agentId}/send`;

      const payload = {
        chatId,
        content,
        metadata: {
          source: `${this.agentName}-agent`
        }
      };

      // Add rich content blocks if provided
      if (richContentBlocks && richContentBlocks.length > 0) {
        payload.richContentBlocks = richContentBlocks;
      }

      const blockCount = richContentBlocks?.length || 0;
      console.log(`📤 [${this.agentName}] Sending message with ${blockCount} rich content blocks...`);

      if (isDryRun) {
        console.log(`🧪 [${this.agentName}] A1ZAP_DRY_RUN=true → not sending to A1Zap. Returning mock success.\n`);
        return {
          ok: true,
          dryRun: true,
          chatId,
          sentAt: new Date().toISOString(),
          payload
        };
      }

      // Retry logic for transient errors (5xx, network errors)
      let lastError;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.post(url, payload, {
            headers: {
              'X-API-Key': this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
          });

          console.log(`✅ [${this.agentName}] Message sent to A1Zap:`, response.data);
          return response.data;
        } catch (error) {
          lastError = error;
          
          // Check if it's a retryable error
          const isRetryable = 
            (error.response && error.response.status >= 500) || // 5xx errors
            (error.response && error.response.status === 429) || // Rate limit
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND';
          
          if (isRetryable && attempt < maxRetries) {
            const delay = retryDelay * attempt; // Exponential backoff
            console.warn(`⚠️  [${this.agentName}] Attempt ${attempt}/${maxRetries} failed (${error.response?.status || error.code}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // Not retryable or out of retries - throw the error
          throw error;
        }
      }
      
      // Should never reach here, but just in case
      throw lastError;
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [${this.agentName}] Error sending message to A1Zap`);
      console.error(`${'='.repeat(80)}`);
      console.error('Error:', error.response?.data || error.message);
      
      if (error.response) {
        console.error('\n📋 Full Response Details:');
        console.error('   Status Code:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      console.error(`${'='.repeat(80)}\n`);
      
      throw error;
    }
  }

  /**
   * Send a message with media (image, video, etc.) to A1Zap
   * @param {string} chatId - Chat ID to send message to
   * @param {string} content - Message content
   * @param {string} mediaUrl - URL of the media to send
   * @param {Object} options - Optional parameters
   * @param {number} options.width - Media width in pixels
   * @param {number} options.height - Media height in pixels
   * @param {string} options.contentType - MIME type (default: 'image/png')
   * @returns {Promise<Object>} API response
   */
  async sendMediaMessage(chatId, content, mediaUrl, options = {}) {
    try {
      this._validateApiKey();

      const url = `${this.apiUrl}/${this.agentId}/send`;

      // Build media object according to A1Zap API spec
      const media = {
        url: mediaUrl,
        contentType: options.contentType || 'image/png'
      };

      // Add dimensions if provided (recommended by A1Zap for proper media display)
      if (options.width && options.height) {
        media.width = options.width;
        media.height = options.height;
      }

      const payload = {
        chatId,
        content,
        media,
        metadata: {
          source: `${this.agentName}-agent`,
          messageType: 'media'
        }
      };

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📤 [${this.agentName}] Sending media message`);
      console.log(`${'='.repeat(80)}`);
      console.log(`URL: ${url}`);
      console.log(`Method: POST`);
      console.log(`Chat ID: ${chatId}`);
      console.log(`Media URL: ${mediaUrl}`);
      console.log(`Content length: ${content.length} chars`);
      if (media.width && media.height) {
        console.log(`Dimensions: ${media.width}x${media.height}`);
      }
      console.log(`\nPayload:`, JSON.stringify(payload, null, 2));
      
      const maskedKey = this.apiKey.length > 12 
        ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
        : '***masked***';
      
      console.log(`\n🔧 Curl equivalent:`);
      console.log(`curl -X POST '${url}' \\`);
      console.log(`  -H 'X-API-Key: YOUR_API_KEY_HERE' \\`);
      console.log(`  -H 'Content-Type: application/json' \\`);
      console.log(`  -d '${JSON.stringify(payload)}'`);
      console.log(`${'='.repeat(80)}\n`);

      const response = await axios.post(url, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ [${this.agentName}] Media message sent to A1Zap:`, response.data);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      return response.data;
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [${this.agentName}] Error sending media message to A1Zap`);
      console.error(`${'='.repeat(80)}`);
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Error Message:', error.message);
      
      if (error.response) {
        console.error('\n📋 Full Response Details:');
        console.error('   Status Code:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      console.error(`${'='.repeat(80)}\n`);
      
      throw error;
    }
  }

  /**
   * Get message history for a chat
   * @param {string} chatId - Chat ID
   * @param {number} limit - Number of messages to retrieve (default: 20)
   * @param {string} agentId - Agent ID (accepted for compatibility but uses configured agentId)
   * @returns {Promise<Array>} Array of messages
   */
  async getMessageHistory(chatId, limit = 20, agentId = null) {
    const url = `${this.apiUrl}/${this.agentId}/chat/${chatId}?limit=${limit}`;

    try {
      this._validateApiKey();

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📡 [${this.agentName}] Fetching message history`);
      console.log(`${'='.repeat(80)}`);
      console.log(`URL: ${url}`);
      console.log(`Method: GET`);
      console.log(`Agent ID: ${this.agentId}`);
      console.log(`Chat ID: ${chatId}`);
      console.log(`Limit: ${limit}`);
      
      if (agentId && agentId !== this.agentId) {
        console.log(`⚠️  Webhook provided different agentId (${agentId}) - using configured one instead`);
      }

      // Mask API key for security (show first 8 and last 4 chars)
      const maskedKey = this.apiKey.length > 12 
        ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
        : '***masked***';
      
      // console.log(`\n📋 Headers:`);
      // console.log(`   X-API-Key: ${maskedKey}`);
      
      // console.log(`\n🔧 Curl equivalent:`);
      // console.log(`curl -X GET '${url}' \\`);
      // console.log(`  -H 'X-API-Key: YOUR_API_KEY_HERE'`);
      // console.log(`\n💡 To test manually, replace YOUR_API_KEY_HERE with your actual API key`);
      // console.log(`${'='.repeat(80)}\n`);

      const response = await axios.get(url, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      console.log(`✅ [${this.agentName}] Message history retrieved: ${response.data.messages?.length || 0} messages`);
      return response.data.messages || [];
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [${this.agentName}] Error fetching message history`);
      console.error(`${'='.repeat(80)}`);
      console.error('URL:', url);
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Response Headers:', error.response?.headers);
      console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error Message:', error.message);
      
      // Log the full error for debugging
      if (error.response) {
        console.error('\n📋 Full Response Details:');
        console.error('   Status Code:', error.response.status);
        console.error('   Status Text:', error.response.statusText);
        console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      console.error(`\n🔧 Curl to reproduce error:`);
      console.error(`curl -v -X GET '${url}' \\`);
      console.error(`  -H 'X-API-Key: YOUR_API_KEY_HERE'`);
      console.error(`${'='.repeat(80)}\n`);
      
      return [];
    }
  }

  /**
   * Validate that the API key and agent ID are configured
   * @private
   * @throws {Error} If credentials are not configured properly
   */
  _validateApiKey() {
    // Check if API key is a placeholder value
    const isPlaceholderKey = !this.apiKey || 
      this.apiKey.startsWith('your_') || 
      this.apiKey.startsWith('YOUR_') ||
      this.apiKey === 'undefined' ||
      this.apiKey === 'null';
    
    if (isPlaceholderKey) {
      const error = new Error(
        `\n❌ ${this.agentName.toUpperCase()} API KEY NOT CONFIGURED!\n` +
        `\n   The API key is set to a placeholder value: "${this.apiKey}"\n` +
        `\n   To fix this:\n` +
        `   1. Get your API key from A1Zap (Make → Agent API)\n` +
        `   2. Add it to your .env file:\n` +
        `      ${this.agentName.toUpperCase().replace(/-/g, '_')}_API_KEY=your_actual_api_key\n` +
        `   3. Restart the server\n`
      );
      console.error(error.message);
      throw error;
    }

    // Check if agent ID is a placeholder value
    const isPlaceholderAgentId = !this.agentId || 
      this.agentId.startsWith('your_') || 
      this.agentId.startsWith('YOUR_') ||
      this.agentId === 'undefined' ||
      this.agentId === 'null';
    
    if (isPlaceholderAgentId) {
      const error = new Error(
        `\n❌ ${this.agentName.toUpperCase()} AGENT ID NOT CONFIGURED!\n` +
        `\n   The agent ID is set to a placeholder value: "${this.agentId}"\n` +
        `\n   To fix this:\n` +
        `   1. Get your agent ID from A1Zap (Make → Agent API → Create Agent)\n` +
        `   2. Add it to your .env file:\n` +
        `      ${this.agentName.toUpperCase().replace(/-/g, '_')}_AGENT_ID=your_actual_agent_id\n` +
        `   3. Restart the server\n`
      );
      console.error(error.message);
      throw error;
    }
  }

  /**
   * Get client info as a string
   * @returns {string}
   */
  toString() {
    return `BaseA1ZapClient(agent=${this.agentName}, agentId=${this.agentId.substring(0, 8)}...)`;
  }
}

module.exports = BaseA1ZapClient;

