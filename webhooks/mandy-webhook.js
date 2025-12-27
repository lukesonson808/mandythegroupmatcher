const BaseWebhook = require('../core/BaseWebhook');
const BaseA1ZapClient = require('../core/BaseA1ZapClient');
const claudeService = require('../services/claude-service');
const mandyAgent = require('../agents/mandy-agent');
const groupProfileStorage = require('../services/group-profile-storage');
const webhookHelpers = require('../services/webhook-helpers');
const config = require('../config');

/**
 * Mandy the Group Matchmaker Webhook Handler
 * Uses natural conversation with full memory to create profiles
 */
class MandyWebhook extends BaseWebhook {
  constructor() {
    // Create A1Zap client for this agent
    const client = new BaseA1ZapClient(config.agents.mandy);

    // Initialize base webhook
    super(mandyAgent, client);
    
    // Track which chats have received our welcome message
    this.welcomeMessagesSent = new Set();
  }
  
  /**
   * Override handleChatStarted to send our welcome message as the opening message
   * @override
   */
  async handleChatStarted(req, res) {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📥 [Mandy] chat.started WEBHOOK RECEIVED');
      console.log('='.repeat(80));
      console.log('Full payload:', JSON.stringify(req.body, null, 2));
      console.log('='.repeat(80) + '\n');
      
      // Support both payload structures (newer and legacy)
      const { chatMetadata, chatId: rootChatId, user: rootUser } = req.body;
      
      const chatId = rootChatId || chatMetadata?.chatId;
      const userName = rootUser?.userName || chatMetadata?.user?.userName;
      const isAnonymous = rootUser?.isAnonymous || chatMetadata?.user?.isAnonymous;
      
      console.log(`🔍 [Mandy] Extracted values:`);
      console.log(`   chatId: ${chatId}`);
      console.log(`   userName: ${userName || 'Anonymous'}`);
      console.log(`   isAnonymous: ${isAnonymous}\n`);
      
      // Validate chatId
      if (!chatId) {
        console.error('❌ [Mandy] Missing chatId in webhook payload!');
        return res.status(400).json({
          success: false,
          error: 'Missing chatId in webhook payload'
        });
      }

      console.log(`👋 [Mandy] Chat started with user: ${userName || 'Anonymous'} (chatId: ${chatId})`);

      // Get welcome message from agent
      const welcomeMessage = this.agent.getWelcomeMessage(userName, isAnonymous);
      console.log(`💬 [Mandy] Welcome message prepared (${welcomeMessage.length} chars):`);
      console.log(`   "${welcomeMessage.substring(0, 100)}..."\n`);

      // Send welcome message as the opening message (skip if test mode)
      if (!webhookHelpers.isTestChat(chatId)) {
        try {
          console.log(`📤 [Mandy] Attempting to send welcome message to chatId: ${chatId}`);
          console.log(`   API Key configured: ${this.client.apiKey && !this.client.apiKey.includes('your_') ? 'YES (' + this.client.apiKey.substring(0, 10) + '...)' : 'NO'}`);
          console.log(`   Agent ID configured: ${this.client.agentId && !this.client.agentId.includes('your_') ? 'YES (' + this.client.agentId + ')' : 'NO'}`);
          console.log(`   API URL: ${this.client.apiUrl}`);
          console.log(`   Welcome message length: ${welcomeMessage.length} chars\n`);
          
          const sendResult = await this.client.sendMessage(chatId, welcomeMessage);
        console.log('✅ [Mandy] Opening welcome message sent successfully!');
        console.log(`   Message: "${welcomeMessage.substring(0, 80)}..."`);
          console.log(`   API Response:`, sendResult ? JSON.stringify(sendResult, null, 2) : 'No response data');
          console.log('');
        
        // Mark as sent so we don't send it again on first user message
        if (!this.welcomeMessagesSent) {
          this.welcomeMessagesSent = new Set();
        }
        this.welcomeMessagesSent.add(chatId);
        } catch (sendError) {
          console.error('\n' + '='.repeat(80));
          console.error('❌ [Mandy] ERROR sending welcome message after retries!');
          console.error('='.repeat(80));
          console.error('Error message:', sendError.message);
          if (sendError.response) {
            console.error('\n📋 Full API Error Response:');
            console.error('   Status:', sendError.response.status);
            console.error('   Status Text:', sendError.response.statusText);
            if (sendError.response.status >= 500) {
              console.error('   ⚠️  A1Zap API server error (5xx) - this is usually temporary');
              console.error('   💡 The welcome message will not be sent, but the chat can continue');
              console.error('   💡 Mandy will respond when the user sends a message');
            }
          }
          console.error('='.repeat(80) + '\n');
          // Don't fail the webhook - still return success so chat can continue
          // The user can still interact and Mandy will respond
        }
      } else {
        console.log('⚠️  [Mandy] Test mode: Skipping welcome message send');
        console.log(`   Would send: "${welcomeMessage.substring(0, 80)}..."`);
      }

      // Return success with debug info
      const response = {
        success: true,
        event: 'chat.started',
        agent: this.agent.name,
        welcomeMessageSent: !webhookHelpers.isTestChat(chatId), // True if we attempted to send (not test mode)
        userName: userName || 'Anonymous',
        debug: {
          chatId: chatId,
          isTestChat: webhookHelpers.isTestChat(chatId),
          apiKeyConfigured: this.client.apiKey && !this.client.apiKey.includes('your_'),
          agentIdConfigured: this.client.agentId && !this.client.agentId.includes('your_')
        }
      };
      
      return res.json(response);

    } catch (error) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ ERROR handling chat.started event:');
      console.error('='.repeat(80));
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      if (error.response) {
        console.error('API Response status:', error.response.status);
        console.error('API Response data:', JSON.stringify(error.response.data, null, 2));
      }
      console.error('='.repeat(80) + '\n');
      
      return res.status(500).json({
        success: false,
        error: error.message,
        event: 'chat.started',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Count questions asked by assistant in conversation
   * @param {Array} conversation - Conversation history
   * @returns {number} Number of questions asked
   */
  countQuestionsAsked(conversation) {
    try {
      if (!conversation || !Array.isArray(conversation)) {
        return 0;
      }
      
      let questionCount = 0;
      for (const msg of conversation) {
        if (msg && msg.role === 'assistant' && msg.content && typeof msg.content === 'string') {
          const content = msg.content.replace(/^Mandy the Group Matcher:\s*/g, '').trim();
          // Check if message ends with ? (more reliable than keyword matching)
          if (content.includes('?') && content.length > 3) {
            questionCount++;
          }
        }
      }
      return questionCount;
    } catch (error) {
      console.error(`⚠️  [Mandy] Error counting questions:`, error.message);
      return 0; // Safe fallback
    }
  }

  /**
   * Process Mandy request - handles conversational flow with memory
   * @param {Object} data - Request data with conversation history
   * @returns {Promise<Object>} Result with response text
   */
  async processRequest(data) {
    try {
      const { userMessage, conversation, chatId, messageId } = data;
      const requestStartTime = Date.now();
      
      // Log for debugging
      console.log(`\n[Mandy] Processing request:`);
      console.log(`  Chat ID: ${chatId}`);
      console.log(`  Message ID: ${messageId || 'MISSING'}`);
      console.log(`  User Message: "${userMessage?.substring(0, 100)}..."`);
      console.log(`  Conversation length: ${conversation?.length || 0}`);
    
      // Validate user message
      if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
        console.warn(`⚠️  [Mandy] Empty or invalid user message`);
        return {
          response: "I didn't catch that! Could you try again? 😊",
          sent: false
        };
      }
      
      // Check if profile already exists for this chat
      const existingProfile = groupProfileStorage.getProfileByChatId(chatId);
      
      if (existingProfile) {
        // Profile already exists - just tell them to wait for a match
        console.log(`✅ [Mandy] Profile already exists for chat ${chatId} - telling them to wait`);
        return {
          response: "Sit tight and wait for a match! 🎉",
          sent: false
        };
      }
      
      // Clean conversation for counting (with error handling)
      let cleanedConversation = [];
      let questionsAsked = 0;
      try {
        cleanedConversation = this.cleanConversationHistory(conversation || []);
        // Count questions asked (not just messages)
        questionsAsked = this.countQuestionsAsked(cleanedConversation);
        console.log(`📊 [Mandy] Questions asked so far: ${questionsAsked}/8`);
      } catch (error) {
        console.error(`⚠️  [Mandy] Error processing conversation for question count:`, error.message);
        // Continue with default values
        questionsAsked = 0;
      }
      
      // Generate response immediately (most important)
      const responsePromise = this.generateConversationalResponse(chatId, userMessage, conversation, questionsAsked);
    
    // Only check profile if we have asked 8 or more questions
    if (questionsAsked >= 8) {
      // Start profile check but don't wait for it - response is priority
      const profileCheckPromise = this.checkProfileComplete(chatId, conversation);
      
      // Get response first (always prioritize this)
      const response = await responsePromise;
      
      // Check if profile check completed quickly (don't wait if slow)
      try {
        const profileComplete = await Promise.race([
          profileCheckPromise,
          new Promise(resolve => setTimeout(() => resolve({ shouldSave: false }), 3000))
        ]);
        
        if (profileComplete && profileComplete.shouldSave) {
          // Save profile asynchronously - don't block the response
          console.log(`🎉 [Mandy] Profile complete - saving profile for chat ${chatId}`);
          this.saveProfileFromConversation(chatId, conversation).catch(err => {
            console.error(`❌ [Mandy] Error saving profile:`, err);
          });
          
          const elapsed = Date.now() - requestStartTime;
          console.log(`⏱️  [Mandy] Total request processing time: ${elapsed}ms`);
          
        return {
            response: profileComplete.confirmationMessage || "Perfect! I've got a great sense of who you are! I've saved your profile. Sit tight and wait for a match! 🎉",
          sent: false
        };
      }
      } catch (error) {
        console.warn(`⚠️  [Mandy] Profile check error: ${error.message} - using normal response`);
      }
      
      const elapsed = Date.now() - requestStartTime;
      console.log(`⏱️  [Mandy] Total request processing time: ${elapsed}ms`);
      return response;
    }
    
      // Not enough messages yet - just generate response (fast path)
      const response = await responsePromise;
      const elapsed = Date.now() - requestStartTime;
      console.log(`⏱️  [Mandy] Total request processing time: ${elapsed}ms`);
      return response;
    } catch (error) {
      // CRITICAL: Always return a response, even on error
      console.error(`❌ [Mandy] Critical error in processRequest:`, error);
      console.error(`   Stack:`, error.stack);
      return {
        response: "Oops! I had a moment there. Let's try again - what were you saying? 😊",
        sent: false
      };
    }
  }

  /**
   * Clean conversation history - remove agent name prefixes from assistant messages
   * @param {Array} conversation - Raw conversation history
   * @returns {Array} Cleaned conversation
   */
  cleanConversationHistory(conversation) {
    if (!conversation || !Array.isArray(conversation)) {
      return [];
    }
    
    return conversation.map(msg => {
      if (msg.role === 'assistant' && msg.content) {
        // Remove "Mandy the Group Matcher:" or "Mandy the Group Matcher: " prefixes
        let cleaned = msg.content.replace(/^Mandy the Group Matcher:\s*/g, '');
        // Remove multiple instances of the prefix (in case it's duplicated)
        cleaned = cleaned.replace(/Mandy the Group Matcher:\s*/g, '');
        return {
          ...msg,
          content: cleaned.trim()
        };
      }
      return msg;
    });
  }

  /**
   * Generate conversational response with full memory
   * @param {string} chatId - Chat ID
   * @param {string} userMessage - User's message
   * @param {Array} conversation - Full conversation history
   * @param {number} questionsAsked - Number of questions already asked
   * @returns {Promise<Object>} Response
   */
  async generateConversationalResponse(chatId, userMessage, conversation, questionsAsked = 0) {
    const startTime = Date.now();
    try {
      // Clean conversation history to remove agent name prefixes
      const cleanedHistory = this.cleanConversationHistory(conversation || []);
      
      // Prepare messages for Claude
      const messages = [...cleanedHistory];
      
      // Check if the last message is already this user message (don't duplicate)
      const lastMsg = messages[messages.length - 1];
      const userMessageAlreadyIncluded = lastMsg && 
        lastMsg.role === 'user' && 
        (lastMsg.content === userMessage || lastMsg.content === `Luke Sonson: ${userMessage}`);
      
      if (!userMessageAlreadyIncluded) {
        // Extract just the content if it has a sender name prefix
        const cleanUserMessage = userMessage.replace(/^[^:]+:\s*/, '');
        messages.push({ role: 'user', content: cleanUserMessage });
      }
      
      console.log(`💬 [Mandy] Generating response with ${messages.length} messages in history`);
      
      // Build enhanced system prompt with question count context
      const baseSystemPrompt = mandyAgent.getSystemPrompt();
      const questionContext = questionsAsked < 8 
        ? `\n\nIMPORTANT CONTEXT: You have asked ${questionsAsked} questions so far. You need to ask exactly 8 questions total (including follow-ups) before the profile can be saved. You have ${8 - questionsAsked} questions remaining. Make sure you ask ONE question in your response (not zero, not multiple).`
        : `\n\nIMPORTANT CONTEXT: You have asked ${questionsAsked} questions. You have reached 8 questions, so if you have enough information (especially group name and group size), you should indicate that the profile is complete. Otherwise, you may ask 1-2 more clarifying questions if absolutely necessary.`;
      
      const enhancedSystemPrompt = baseSystemPrompt + questionContext;
      
      // Generate response using Claude with full conversation history
      // Use timeout with Promise.race to ensure we always get a response
      const claudeResponsePromise = claudeService.chat(messages, {
        systemPrompt: enhancedSystemPrompt,
        ...mandyAgent.getGenerationOptions(),
        temperature: 0.9, // Higher temperature for more personality
        maxTokens: 250, // Reduced tokens for faster responses (still enough for personality)
        timeout: 12000 // 12 second timeout (increased slightly for reliability)
      });
      
      // Add an additional safety timeout to ensure we never hang
      const safetyTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Claude API call exceeded safety timeout')), 15000)
      );
      
      const response = await Promise.race([claudeResponsePromise, safetyTimeout]);
      
      const elapsed = Date.now() - startTime;
      console.log(`⏱️  [Mandy] Response generated in ${elapsed}ms`);
      
      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from Claude');
      }
      
      const trimmedResponse = response.trim();
      console.log(`✅ [Mandy] Generated response: "${trimmedResponse.substring(0, 100)}..."`);

      return {
        response: trimmedResponse,
        sent: false
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ [Mandy] Error generating response (took ${elapsed}ms):`, error.message);
      
      // Provide context-aware fallback based on error type
      if (error.message && error.message.includes('timeout')) {
        console.error(`⏱️  [Mandy] Response timed out after ${elapsed}ms`);
      }
      
      // Quick, snappy fallback response
        return {
        response: "Hmm, I'm having a moment! Could you say that again? 😅",
          sent: false
        };
      }
  }

  /**
   * Check if profile is complete based on conversation
   * @param {string} chatId - Chat ID
   * @param {Array} conversation - Conversation history
   * @returns {Promise<Object>} { shouldSave: boolean, confirmationMessage?: string }
   */
  async checkProfileComplete(chatId, conversation) {
    try {
      // Count substantial exchanges (user messages with real content)
      const userMessages = (conversation || []).filter(msg => 
        msg.role === 'user' && 
        msg.content && 
        msg.content.trim().length > 5
      );
      
      // Need at least 8-10 substantial exchanges - fast path for early messages
      if (userMessages.length < 8) {
        return { shouldSave: false };
      }
      
      // Clean conversation before checking
      const cleanedConv = this.cleanConversationHistory(conversation || []);
      
      // Quick timeout check - don't block on this
      const checkPrompt = `Review this conversation and determine if we have enough information to create a good matchmaking profile.

CRITICAL REQUIREMENTS (ALL must be present):
1. Group name (or individual name) - REQUIRED
2. Group size (number of people) - REQUIRED if it's a group
3. At least 6-8 substantial answers about their personality, interests, and preferences

We need to know:
- Name/group name (MUST HAVE)
- Group size/number of people (MUST HAVE if group)
- Their vibe/personality (from multiple questions)
- Their interests and what they like to do
- Their sense of humor and communication style
- At least 6-8 substantial answers

Conversation:
${cleanedConv.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}

Respond with ONLY "YES" if we have ALL required info (especially name and group size), or "NO" if we're missing required information.`;
      
      // Use short timeout (5 seconds) for profile check - don't block response
      const aiCheck = await Promise.race([
        claudeService.generateText(checkPrompt, {
        temperature: 0.3,
          maxTokens: 10,
          timeout: 5000
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile check timeout')), 5000)
        )
      ]).catch(err => {
        console.warn(`⚠️  [Mandy] Profile check timed out or failed: ${err.message}`);
        return 'NO'; // Default to continuing conversation if check fails
      });
      
      const shouldSave = typeof aiCheck === 'string' && aiCheck.trim().toUpperCase().includes('YES');
      
      if (shouldSave) {
        return {
          shouldSave: true,
          confirmationMessage: "Perfect! I've got a great sense of who you are! I've saved your profile. Sit tight and wait for a match! 🎉"
        };
      }
      
      return { shouldSave: false };
    } catch (error) {
      console.error(`❌ [Mandy] Error checking profile completeness:`, error);
      // Default to not saving if check fails - don't block the response
      return { shouldSave: false };
    }
  }

  /**
   * Save profile from conversation
   * @param {string} chatId - Chat ID
   * @param {Array} conversation - Conversation history
   * @returns {Promise<Object>} Saved profile
   */
  async saveProfileFromConversation(chatId, conversation) {
    try {
      // Extract profile info from conversation using AI
      const extractPrompt = `Extract profile information from this conversation and format it as JSON.

Extract:
- groupName (or name if individual)
- groupSize (number, or null if individual)
- answers object with key information from the conversation (use question1, question2, etc. format for different topics discussed)

Conversation:
${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}

Return ONLY valid JSON, no other text.`;
      
      const extractedJson = await claudeService.generateText(extractPrompt, {
        temperature: 0.3,
        maxTokens: 1000
      });
      
      // Parse JSON (handle if wrapped in markdown code blocks)
      let profileData;
      try {
        const cleaned = extractedJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        profileData = JSON.parse(cleaned);
      } catch (parseError) {
        console.error(`❌ [Mandy] Error parsing extracted profile:`, parseError);
        // Fallback: create basic profile from conversation
        profileData = {
          groupName: 'Unknown',
          groupSize: null,
          answers: {}
        };
      }
      
      // Ensure required fields
      if (!profileData.groupName) {
        profileData.groupName = 'Unknown';
      }
      
      // Check if group name already exists
      if (groupProfileStorage.groupNameExists(profileData.groupName)) {
        profileData.groupName = `${profileData.groupName}_${Date.now()}`;
      }
      
    const profile = {
        groupName: profileData.groupName,
      chatId: chatId,
        answers: profileData.answers || {},
      metadata: {
          createdAt: new Date().toISOString(),
          source: 'conversational'
      }
    };

    const savedProfile = groupProfileStorage.saveGroupProfile(profile);
      console.log(`✅ [Mandy] Saved profile: ${savedProfile.groupName} (ID: ${savedProfile.id})`);
      
      return savedProfile;
    } catch (error) {
      console.error(`❌ [Mandy] Error saving profile:`, error);
      throw error;
    }
  }

  /**
   * Handle normal chat after profile is saved
   * @param {string} chatId - Chat ID
   * @param {string} userMessage - User message
   * @param {Array} conversation - Conversation history
   * @returns {Promise<Object>} Response
   */
  async handleNormalChat(chatId, userMessage, conversation) {
    // Just generate a normal conversational response with full memory
    // This method is no longer needed but kept for compatibility
    return await this.generateConversationalResponse(chatId, userMessage, conversation, 0);
  }

  /**
   * Override sendResponse to ensure we ALWAYS send a response quickly
   * This prevents A1Zap from generating its own AI responses
   * @override
   */
  async sendResponse(chatId, result) {
    // Skip sending for test chats
    if (webhookHelpers.isTestChat(chatId)) {
      console.log('⚠️  Test mode: Skipping A1Zap send');
      return;
    }

    // If message was already sent by agent-specific logic, skip sending
    if (result.sent) {
      console.log('✅ [Mandy] Message already sent by agent logic');
      return;
    }

    // If result has an imageUrl, it was already sent by agent-specific logic
    if (result.imageUrl) {
      console.log('✅ [Mandy] Media message already sent by agent logic');
      return;
    }

    // CRITICAL: Always send a response to prevent A1Zap from generating its own
    if (result && result.response) {
      console.log(`✅ [Mandy] Sending response immediately to prevent A1Zap fallback`);
      try {
      await webhookHelpers.sendResponse(
        this.client,
        chatId,
        result.response,
        result.richContentBlocks || null
      );
      } catch (sendError) {
        console.error(`❌ [Mandy] Error sending response to A1Zap:`, sendError.message);
        // Try one more time with a simpler message
        try {
          await webhookHelpers.sendResponse(
            this.client,
            chatId,
            "I'm having trouble right now, but I'm here! Could you repeat that? 😊",
            null
          );
        } catch (retryError) {
          console.error(`❌ [Mandy] Even fallback send failed:`, retryError.message);
        }
      }
    } else {
      // If no response, send a default to prevent A1Zap fallback
      console.error(`❌ [Mandy] ERROR: No response in result! Sending fallback.`);
      console.error(`   Result:`, JSON.stringify(result, null, 2));
      try {
        await webhookHelpers.sendResponse(
          this.client,
          chatId,
          "Hmm, I'm having a moment! Could you say that again? 😅",
          null
        );
      } catch (fallbackError) {
        console.error(`❌ [Mandy] Fallback send also failed:`, fallbackError.message);
      }
    }
  }
}

// Create and export singleton webhook handler
const mandyWebhook = new MandyWebhook();
module.exports = mandyWebhook.createHandler();
