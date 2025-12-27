const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey
    });
  }

  /**
   * Generate text response using Claude
   * @param {string} prompt - User prompt
   * @param {Object} options - Generation options
   * @param {string} options.systemPrompt - System instruction
   * @param {string|null} options.fileId - File ID to include in context
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    try {
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // File support removed - Mandy doesn't use file references

      // Add timeout (default 10 seconds, can be overridden)
      const timeoutMs = options.timeout || 10000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Claude API call timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const apiCall = this.client.messages.create({
        model: options.model || config.claude.defaultModel,
        max_tokens: options.maxTokens || config.claude.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : config.claude.temperature,
        system: options.systemPrompt || undefined,
        messages: messages
      });

      const response = await Promise.race([apiCall, timeoutPromise]);

      return response.content[0].text;
    } catch (error) {
      console.error('Claude text generation error:', error);
      throw error;
    }
  }

  /**
   * Generate response with conversation history
   * @param {Array} messages - Message history [{role, content}]
   * @param {Object} options - Generation options
   * @param {string} options.systemPrompt - System instruction
   * @param {string|null} options.fileId - File ID to include in context
   * @returns {Promise<string>} Generated response
   */
  async chat(messages, options = {}) {
    try {
      // Convert messages to Claude format
      const claudeMessages = messages.map((msg, index) => {
        const isLastMessage = index === messages.length - 1;
        
        // File support removed - Mandy doesn't use file references

        // Handle messages that might already have complex content structures
        const content = typeof msg.content === 'string' ? msg.content : msg.content;
        
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: content
        };
      });

      // Add timeout (default 10 seconds, can be overridden)
      const timeoutMs = options.timeout || 10000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Claude API call timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const apiCall = this.client.messages.create({
        model: options.model || config.claude.defaultModel,
        max_tokens: options.maxTokens || config.claude.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : config.claude.temperature,
        system: options.systemPrompt || undefined,
        messages: claudeMessages
      });

      const response = await Promise.race([apiCall, timeoutPromise]);

      return response.content[0].text;
    } catch (error) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  /**
   * Chat with base file (for compatibility - Mandy doesn't use files)
   * @param {Array} messages - Message history
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated response
   */
  async chatWithBaseFile(messages, options = {}) {
    // Mandy doesn't use file references, so just call regular chat
    return this.chat(messages, options);
  }
}

module.exports = new ClaudeService();

