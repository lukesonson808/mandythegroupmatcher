const axios = require('axios');
const config = require('../config');

class A1ZapClient {
  constructor() {
    this.apiKey = config.a1zap.apiKey;
    this.agentId = config.a1zap.agentId;
    this.apiUrl = config.a1zap.apiUrl;
  }

  /**
   * Send a text message to A1Zap
   * @param {string} chatId - Chat ID to send message to
   * @param {string} content - Message content
   * @returns {Promise<Object>} API response
   */
  async sendMessage(chatId, content) {
    try {
      const url = `${this.apiUrl}/${this.agentId}/send`;

      const response = await axios.post(
        url,
        {
          chatId,
          content,
          metadata: {
            source: 'gemini-webhook-agent'
          }
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Message sent to A1Zap:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending message to A1Zap:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message with media (image) to A1Zap
   * @param {string} chatId - Chat ID to send message to
   * @param {string} content - Message content
   * @param {string} mediaUrl - URL of the media to send
   * @param {Object} options - Optional parameters
   * @param {number} options.width - Image width in pixels
   * @param {number} options.height - Image height in pixels
   * @param {string} options.contentType - MIME type (default: 'image/png')
   * @returns {Promise<Object>} API response
   */
  async sendMediaMessage(chatId, content, mediaUrl, options = {}) {
    try {
      const url = `${this.apiUrl}/${this.agentId}/send`;

      console.log('📤 A1Zap API Request Details:');
      console.log(`   URL: ${url}`);
      console.log(`   Chat ID: ${chatId}`);
      console.log(`   Media URL: ${mediaUrl}`);
      console.log(`   Content length: ${content.length} chars`);

      // Build media object according to A1Zap API spec
      const media = {
        url: mediaUrl,
        contentType: options.contentType || 'image/png'
      };

      // Add dimensions if provided (recommended by A1Zap for proper image display)
      if (options.width && options.height) {
        media.width = options.width;
        media.height = options.height;
        console.log(`   Dimensions: ${media.width}x${media.height}`);
      }

      const payload = {
        chatId,
        content,
        media,
        metadata: {
          source: 'gemini-webhook-agent',
          messageType: 'image'
        }
      };

      console.log('   Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(url, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Media message sent to A1Zap:', response.data);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending media message to A1Zap:');
      console.error('   Status:', error.response?.status);
      console.error('   Status Text:', error.response?.statusText);
      console.error('   Error Data:', error.response?.data);
      console.error('   Error Message:', error.message);
      if (error.response?.data) {
        console.error('   Full Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Get message history for a chat
   * @param {string} chatId - Chat ID
   * @param {number} limit - Number of messages to retrieve (default: 20)
   * @param {string} agentId - Optional agent ID (uses default if not provided)
   * @returns {Promise<Array>} Array of messages
   */
  async getMessageHistory(chatId, limit = 20, agentId = null) {
    try {
      // Use provided agentId or fall back to instance's agentId
      const effectiveAgentId = agentId || this.agentId;
      const url = `${this.apiUrl}/${effectiveAgentId}/chat/${chatId}?limit=${limit}`;

      const response = await axios.get(url, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('❌ Error fetching message history:', error.response?.data || error.message);
      return [];
    }
  }
}

module.exports = new A1ZapClient();
