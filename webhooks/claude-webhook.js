const claudeService = require('../services/claude-service');
const a1zapClient = require('../services/a1zap-client');
const claudeDocubotAgent = require('../agents/claude-docubot-agent');
const fileRegistry = require('../services/file-registry');
const webhookHelpers = require('../services/webhook-helpers');

/**
 * Claude DocuBot webhook handler with file reference support
 * Uses the claude-docubot-agent configuration
 */
async function claudeWebhookHandler(req, res) {
  try {
    console.log('\n=== Claude Webhook Received ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Validate webhook payload
    const validation = webhookHelpers.validateWebhookPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { chatId, agentId, messageId, userMessage } = validation.data;
    
    // Check for duplicate message
    if (webhookHelpers.isDuplicateMessage(messageId)) {
      console.log(`⚠️  Duplicate message detected: ${messageId} - skipping processing`);
      return res.json({
        success: true,
        skipped: true,
        reason: 'duplicate_message',
        messageId: messageId
      });
    }

    // Mark message as processed IMMEDIATELY to prevent race conditions
    webhookHelpers.markMessageProcessed(messageId);

    console.log(`Processing message from chat ${chatId}: "${userMessage}"`);

    // Check if base file is set for claude-docubot agent
    const baseFileId = fileRegistry.getBaseFile('claude-docubot');
    if (baseFileId) {
      const fileInfo = fileRegistry.getFileById(baseFileId);
      console.log(`📄 Using base file for Claude DocuBot: ${fileInfo?.filename || baseFileId}`);
    } else {
      console.warn('⚠️  No base file set for Claude DocuBot - responses will not have document context');
    }

    // Fetch and process message history (last 10 messages)
    const conversation = await webhookHelpers.fetchAndProcessHistory(
      a1zapClient,
      chatId,
      agentId,
      10
    );

    // Add the current message to conversation
    conversation.push({ role: 'user', content: String(userMessage) });

    // Generate response using Claude with file context
    console.log('Generating response with Claude...');
    let response;
    
    if (conversation.length > 1) {
      // Use chat with history
      response = await claudeService.chatWithBaseFile(conversation, {
        ...claudeDocubotAgent.generationOptions,
        systemPrompt: claudeDocubotAgent.systemPrompt,
        agentName: 'claude-docubot'
      });
    } else {
      // First message - use generateWithBaseFile
      response = await claudeService.generateWithBaseFile(
        `${claudeDocubotAgent.systemPrompt}\n\nUser: ${userMessage}\n\nAssistant:`,
        {
          ...claudeDocubotAgent.generationOptions,
          agentName: 'claude-docubot'
        }
      );
    }

    console.log('Generated response:', response);

    // Send response back to A1Zap (skip for test chats)
    const sendResult = await webhookHelpers.sendResponse(a1zapClient, chatId, response);

    // Return success
    res.json({
      success: true,
      agent: claudeDocubotAgent.name,
      response: response,
      baseFile: baseFileId ? fileRegistry.getFileById(baseFileId)?.filename : null,
      testMode: webhookHelpers.isTestChat(chatId)
    });

  } catch (error) {
    console.error('\n=== Claude Webhook Error ===');
    console.error('Error:', error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = claudeWebhookHandler;

