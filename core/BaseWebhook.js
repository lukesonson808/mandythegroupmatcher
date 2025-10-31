/**
 * BaseWebhook - Abstract base class for webhook handlers
 * 
 * Implements the Template Method pattern to provide common webhook handling logic
 * while allowing subclasses to customize agent-specific behavior.
 * 
 * Common functionality handled by base class:
 * - Request validation
 * - Duplicate message detection
 * - Conversation history fetching
 * - Error handling and user notifications
 * - Test mode detection
 * - Response sending
 * 
 * Subclasses implement:
 * - processRequest() - Agent-specific logic
 * 
 * Usage:
 *   class MyWebhook extends BaseWebhook {
 *     constructor(agent, client) {
 *       super(agent, client);
 *     }
 *     
 *     async processRequest(data) {
 *       // Your agent-specific logic here
 *       return { response: 'Hello!' };
 *     }
 *   }
 */

const webhookHelpers = require('../services/webhook-helpers');

class BaseWebhook {
  /**
   * @param {BaseAgent} agent - The agent configuration
   * @param {BaseA1ZapClient} client - The A1Zap client
   */
  constructor(agent, client) {
    if (new.target === BaseWebhook) {
      throw new Error('BaseWebhook is abstract and cannot be instantiated directly');
    }

    this.agent = agent;
    this.client = client;
  }

  /**
   * Main webhook handler - handles the Express request/response
   * This is the template method that orchestrates the webhook flow
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async handle(req, res) {
    try {
      console.log(`\n=== ${this.agent.name} Webhook Received ===`);
      console.log('Request body:', JSON.stringify(req.body, null, 2));

      // Check for chat.started event and route accordingly
      const { event } = req.body;
      
      if (event === 'chat.started') {
        console.log('🎉 Chat started event detected - sending welcome message');
        return this.handleChatStarted(req, res);
      }

      // Step 1: Extract and validate webhook data
      const data = this.extractWebhookData(req.body);
      if (!data.valid) {
        return res.status(400).json({
          success: false,
          error: data.error
        });
      }

      // Step 2: Check for duplicate message
      if (webhookHelpers.isDuplicateMessage(data.messageId)) {
        console.log(`⚠️  Duplicate message detected: ${data.messageId} - skipping processing`);
        return res.json({
          success: true,
          skipped: true,
          reason: 'duplicate_message',
          messageId: data.messageId
        });
      }

      // Step 3: Mark message as processed IMMEDIATELY to prevent race conditions
      webhookHelpers.markMessageProcessed(data.messageId);

      console.log(`Processing request for ${this.agent.name} from chat ${data.chatId}`);
      console.log(`User message: "${data.userMessage}"`);

      // Step 4: Fetch conversation history if needed
      const conversation = await this.fetchConversationHistory(data);

      // Step 5: Process the request (agent-specific logic)
      const result = await this.processRequest({
        ...data,
        conversation
      });

      // Step 6: Send response
      await this.sendResponse(data.chatId, result);

      // Step 7: Return success
      return res.json({
        success: true,
        agent: this.agent.name,
        ...result,
        testMode: webhookHelpers.isTestChat(data.chatId)
      });

    } catch (error) {
      return this.handleError(error, req, res);
    }
  }

  /**
   * Extract and validate webhook data
   * Can be overridden by subclasses for custom validation
   * @param {Object} body - Request body
   * @returns {Object} Extracted data with validation status
   */
  extractWebhookData(body) {
    const { chat, message, agent } = body;

    // Basic validation
    if (!chat?.id) {
      return {
        valid: false,
        error: 'Missing chat.id in webhook payload'
      };
    }

    return {
      valid: true,
      chatId: chat.id,
      agentId: agent?.id,
      messageId: message?.id,
      userMessage: message?.content || '',
      imageUrl: message?.media?.url || null,
      chat,
      message,
      agent
    };
  }

  /**
   * Handle chat.started event - send welcome message
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async handleChatStarted(req, res) {
    try {
      // Support both payload structures (newer and legacy)
      const { chatMetadata, chatId: rootChatId, user: rootUser } = req.body;
      
      const chatId = rootChatId || chatMetadata?.chatId;
      const userName = rootUser?.userName || chatMetadata?.user?.userName;
      const isAnonymous = rootUser?.isAnonymous || chatMetadata?.user?.isAnonymous;
      
      // Validate chatId
      if (!chatId) {
        return res.status(400).json({
          success: false,
          error: 'Missing chatId in webhook payload'
        });
      }

      console.log(`👋 Chat started with user: ${userName || 'Anonymous'} (chatId: ${chatId})`);

      // Get welcome message from agent
      const welcomeMessage = this.agent.getWelcomeMessage(userName, isAnonymous);

      // Send welcome message (skip if test mode)
      if (!webhookHelpers.isTestChat(chatId)) {
        await this.client.sendMessage(chatId, welcomeMessage);
        console.log('✅ Welcome message sent successfully!');
      } else {
        console.log('⚠️  Test mode: Skipping welcome message send');
      }

      // Return success
      return res.json({
        success: true,
        event: 'chat.started',
        agent: this.agent.name,
        welcomeMessageSent: true,
        userName: userName || 'Anonymous'
      });

    } catch (error) {
      console.error('❌ Error handling chat.started event:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
        event: 'chat.started'
      });
    }
  }

  /**
   * Fetch conversation history
   * Can be overridden by subclasses for custom history handling
   * @param {Object} data - Webhook data
   * @returns {Promise<Array>} Conversation history
   */
  async fetchConversationHistory(data) {
    const includeImages = this.shouldIncludeImagesInHistory();
    const limit = this.getHistoryLimit();

    return await webhookHelpers.fetchAndProcessHistory(
      this.client,
      data.chatId,
      data.agentId,
      limit,
      includeImages
    );
  }

  /**
   * Determine if images should be included in history
   * Override in subclasses that need image tracking
   * @returns {boolean}
   */
  shouldIncludeImagesInHistory() {
    return false;
  }

  /**
   * Get the message history limit
   * Override in subclasses that need different limits
   * @returns {number}
   */
  getHistoryLimit() {
    return 10;
  }

  /**
   * Process the webhook request - MUST be implemented by subclasses
   * @param {Object} data - Request data including conversation history
   * @returns {Promise<Object>} Result object with response text, images, etc.
   */
  async processRequest(data) {
    throw new Error('processRequest() must be implemented by subclass');
  }

  /**
   * Send response to user
   * Can be overridden for custom response handling
   * @param {string} chatId - Chat ID
   * @param {Object} result - Result from processRequest()
   */
  async sendResponse(chatId, result) {
    // Skip sending for test chats
    if (webhookHelpers.isTestChat(chatId)) {
      console.log('⚠️  Test mode: Skipping A1Zap send');
      return;
    }

    // If message was already sent by agent-specific logic, skip sending
    if (result.sent) {
      console.log('✅ Message already sent by agent logic');
      return;
    }

    // If result has an imageUrl, it was already sent by agent-specific logic
    if (result.imageUrl) {
      console.log('✅ Media message already sent by agent logic');
      return;
    }

    // Send text response
    if (result.response) {
      await webhookHelpers.sendResponse(
        this.client,
        chatId,
        result.response,
        result.richContentBlocks || null
      );
    }
  }

  /**
   * Handle errors
   * @param {Error} error - The error
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async handleError(error, req, res) {
    console.error(`\n=== ${this.agent.name} Webhook Error ===`);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Try to send error message to user
    try {
      const chatId = req.body?.chat?.id;
      if (chatId && !webhookHelpers.isTestChat(chatId)) {
        await this.client.sendMessage(
          chatId,
          this.getErrorMessage()
        );
      }
    } catch (sendError) {
      console.error('Failed to send error message to user:', sendError.message);
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }

  /**
   * Get error message to send to user
   * Can be overridden by subclasses
   * @returns {string}
   */
  getErrorMessage() {
    return "I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.";
  }

  /**
   * Create webhook handler function for Express
   * @returns {Function} Express middleware function
   */
  createHandler() {
    return (req, res) => this.handle(req, res);
  }
}

module.exports = BaseWebhook;

