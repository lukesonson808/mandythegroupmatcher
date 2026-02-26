const BaseWebhook = require('../core/BaseWebhook');
const BaseA1ZapClient = require('../core/BaseA1ZapClient');
const claudeService = require('../services/claude-service');
const mandyAgent = require('../agents/mandy-agent');
const groupProfileStorage = require('../services/group-profile-storage');
const webhookHelpers = require('../services/webhook-helpers');
const MiniAppService = require('../services/mini-app-service');
const activityPlanningService = require('../services/activity-planning-service');
const config = require('../config');

/**
 * Mandy the Icebreaker Webhook Handler
 * Helps pre-matched groups break the ice, get comfortable, and familiarize themselves with the app
 */
class MandyWebhook extends BaseWebhook {
  constructor() {
    // Create A1Zap client for this agent
    const client = new BaseA1ZapClient(config.agents.mandy);

    // Initialize base webhook
    super(mandyAgent, client);
    
    // Track which chats have received our welcome message
    this.welcomeMessagesSent = new Set();
    
    // Initialize Mini App Service
    this.miniAppService = new MiniAppService(
      config.agents.mandy.apiKey,
      'https://api.a1zap.com'
    );
  }
  
  /**
   * Override handle to check if Mandy will respond before showing typing indicator
   * @override
   */
  async handle(req, res) {
    try {
      // Check for chat.started event first
      const { event } = req.body;
      if (event === 'chat.started') {
        return this.handleChatStarted(req, res);
      }

      // Extract webhook data
      const data = this.extractWebhookData(req.body);
      if (!data.valid) {
        return res.status(400).json({
          success: false,
          error: data.error
        });
      }

      // Check for duplicate message
      if (webhookHelpers.isDuplicateMessage(data.messageId)) {
        console.log(`⚠️  [Mandy] Duplicate message detected: ${data.messageId} - skipping processing`);
        return res.json({
          success: true,
          skipped: true,
          reason: 'duplicate_message',
          messageId: data.messageId
        });
      }

      // Quick check: Does the message mention Mandy?
      // This prevents showing typing indicator when Mandy won't respond
      const userMessage = data.userMessage || '';
      const userMsgLower = userMessage.toLowerCase();
      const mentionsMandy = userMsgLower.includes('mandy');
      
      // Also check if it's the first message (needs mini app sharing)
      const interviewState = groupProfileStorage.getInterviewState(data.chatId);
      const miniAppsShared = interviewState?.miniAppsShared || false;
      const isFirstMessage = !miniAppsShared;

      // If Mandy won't respond, return early without processing flag
      // This prevents A1Zap from showing typing indicator
      if (!mentionsMandy && !isFirstMessage) {
        console.log(`✅ [Mandy] Message doesn't mention Mandy and no action needed - skipping (no typing indicator)`);
        // Mark as processed to prevent duplicate processing
        webhookHelpers.markMessageProcessed(data.messageId);
        return res.json({
          success: true,
          agent: this.agent.name,
          processing: false,  // This tells A1Zap not to show typing
          skipped: true,
          reason: 'name_not_mentioned',
          messageId: data.messageId
        });
      }

      // Mandy will respond - proceed with normal handling
      return super.handle(req, res);
    } catch (error) {
      console.error(`❌ [Mandy] Error in handle override:`, error);
      // Fall back to parent handle method
      return super.handle(req, res);
    }
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

      // Generate unique ID for this chat session
      const sessionId = `mandy-${chatId}-${Date.now()}`;
      console.log(`🆔 [Mandy] Generated session ID: ${sessionId}`);

      // Initialize interview state with session ID (no group name needed)
      groupProfileStorage.setInterviewState(chatId, {
        sessionId,
        createdAt: new Date().toISOString()
      });

      // Get welcome message from agent
      const welcomeMessage = this.agent.getWelcomeMessage(userName, isAnonymous);
      console.log(`💬 [Mandy] Welcome message prepared (${welcomeMessage.length} chars):`);
      console.log(`   "${welcomeMessage.substring(0, 100)}..."\n`);

      // Send welcome message only (mini apps shared after first user message)
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

          // Mini apps will be shared when user sends their first message (in processRequest)
          // This creates a more natural conversation flow instead of bombarding with everything upfront
          console.log(`📝 [Mandy] Mini apps will be shared after user's first message`);
        
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
   * Extract group name from conversation or interview state
   * @param {Array} conversation - Conversation history
   * @param {string} chatId - Chat ID to check interview state
   * @returns {string|null} Group name or null
   */
  extractGroupName(conversation, chatId = null) {
    // First check interview state (most reliable)
    if (chatId) {
      const interviewState = groupProfileStorage.getInterviewState(chatId);
      if (interviewState && interviewState.groupName) {
        console.log(`✅ [Mandy] Found group name in interview state: ${interviewState.groupName}`);
        return interviewState.groupName;
      }
    }
    
    if (!conversation || !Array.isArray(conversation)) {
      return null;
    }
    
    // Look for patterns like "we're called X", "our name is X", "call us X", "call me X", etc.
    // Also handle "Just X" or "X and Friends" patterns
    for (const msg of conversation) {
      if (msg.role === 'user' && msg.content) {
        const content = msg.content.trim();
        const patterns = [
          /(?:can\s+you\s+)?call\s+(?:me|us)\s+([A-Za-z0-9\s&]+?)(?:\.|!|\?|$)/i, // "call me Luke", "can you call me Luke"
          /(?:we'?re|we are|our name is|we're called|we go by)\s+([A-Za-z0-9\s&]+?)(?:\.|!|\?|$)/i, // "we're X", "our name is X"
          /(?:name|call us|we're|we are)\s+(?:is|are|:)?\s*([A-Za-z0-9\s&]+?)(?:\.|!|\?|$)/i,
          /^([A-Za-z0-9\s&]{2,50})\s+and\s+friends$/i, // "Luke and Friends"
          /^just\s+([A-Za-z0-9\s&]+?)(?:\s+and|\s+i'?m|\.|!|\?|$)/i, // "Just Luke and I'm flying solo"
          /^([A-Za-z0-9\s&]{2,50})(?:\s+and|\s+i'?m|\.|!|\?|$)/i, // "Luke and I'm flying solo"
          /^([A-Za-z0-9\s&]{2,50})$/ // Just a name by itself
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            let name = match[1].trim();
            // Clean up common suffixes
            name = name.replace(/\s+(and|i'?m|flying|solo).*$/i, '').trim();
            // Remove "and friends" if it's part of the name (we want to keep it)
            // Actually, let's keep "and Friends" if it's there
            if (name.length > 1 && name.length < 50) {
              console.log(`✅ [Mandy] Extracted group name from message: "${name}"`);
              // Store it in interview state for future reference
              if (chatId) {
                const currentState = groupProfileStorage.getInterviewState(chatId) || {};
                groupProfileStorage.setInterviewState(chatId, {
                  ...currentState,
                  groupName: name
                });
              }
              return name;
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Process Mandy request - NEW MINI APP-DRIVEN FLOW
   * @param {Object} data - Request data with conversation history
   * @returns {Promise<Object>} Result with response text
   */
  async processRequest(data) {
    try {
      const { userMessage, conversation, chatId, messageId } = data;
      const requestStartTime = Date.now();
      
      // Log for debugging
      console.log(`\n[Mandy] Processing request (Mini App Flow):`);
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
      
      // NEW FLOW: Check if mini apps have been shared
      const interviewState = groupProfileStorage.getInterviewState(chatId);
      const miniAppsShared = interviewState?.miniAppsShared || false;
      let currentSessionId = interviewState?.sessionId;
      
      // If no interview state exists, create it with session ID
      if (!interviewState || !currentSessionId) {
        currentSessionId = `mandy-${chatId}-${Date.now()}`;
        groupProfileStorage.setInterviewState(chatId, {
          sessionId: currentSessionId,
          createdAt: new Date().toISOString()
        });
      }
      
      // Check if user is asking for another game (only if Mandy's name is mentioned)
      const userMsgLower = userMessage.toLowerCase();
      const mentionsMandy = userMsgLower.includes('mandy');
      const askingForGame = userMsgLower.includes('another') || 
                           userMsgLower.includes('more') ||
                           userMsgLower.includes('next') ||
                           userMsgLower.includes('game') ||
                           userMsgLower.includes('send') ||
                           (userMsgLower.includes('one') && userMsgLower.includes('more'));
      
      // Get list of sent games from interview state
      const sentGameIds = interviewState?.sentGameIds || [];
      
      // If user is asking for a game AND mentioned Mandy, send one
      if (askingForGame && mentionsMandy && miniAppsShared) {
        const result = await this.shareOneRandomMiniApp(chatId, currentSessionId, sentGameIds);
        if (result) {
        return {
            response: null,
            sent: true  // Game already sent by shareOneRandomMiniApp
          };
        } else {
          // All games have been sent
          return {
            response: `You've played all my games! 🎮 That's awesome - you're basically a pro now! 😂 If you want to discover more games, scroll through the Public Zaps feed! Hope you're all having fun and getting comfortable! 💕`,
          sent: false
        };
      }
      }
      
      if (!miniAppsShared) {
        // Share FIRST mini app (randomly chosen)
        console.log(`🎮 [Mandy] Sharing first mini app`);
        console.log(`  Chat ID: ${chatId}`);
        console.log(`  Session ID: ${currentSessionId}`);
        
        // Check if mini apps are configured
        const miniApps = config.agents.mandy.miniApps || {};
        const availableApps = Object.entries(miniApps).filter(([_, appConfig]) => {
          const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
          return appId && !appId.includes('your_');
        });
        console.log(`  Available mini apps: ${availableApps.length}`);
        
        if (availableApps.length === 0) {
          console.error(`❌ [Mandy] No mini apps configured!`);
          return {
            response: `Oops! I don't have any games set up yet. Let me fix that! 🎮`,
            sent: false
          };
        }
        
        // Mark as shared FIRST to prevent duplicate calls
        const currentState = groupProfileStorage.getInterviewState(chatId) || {};
        groupProfileStorage.setInterviewState(chatId, {
          ...currentState,
          sessionId: currentSessionId,
          miniAppsShared: true,
          sharedAt: new Date().toISOString(),
          sentGameIds: []  // Initialize empty array to track sent games
        });
        
        // Share one random mini app
        try {
          console.log(`  Attempting to share first random mini app...`);
          const shared = await this.shareOneRandomMiniApp(chatId, currentSessionId, []);
          if (shared) {
            console.log(`  ✅ First mini app shared successfully`);
            return {
              response: null,
              sent: true  // Game already sent
            };
          } else {
            return {
              response: `Having trouble setting up the game right now. Can you check with A1Zap support? 🎮`,
              sent: false
            };
          }
        } catch (err) {
          console.error(`❌ [Mandy] Error sharing mini app:`, err);
          console.error(`  Error message: ${err.message}`);
          if (err.response) {
            console.error(`  Status: ${err.response.status}`);
            console.error(`  Data:`, JSON.stringify(err.response.data, null, 2));
          }
          
          // Reset the flag so we can try again
          const state = groupProfileStorage.getInterviewState(chatId);
          if (state) {
            state.miniAppsShared = false;
            groupProfileStorage.setInterviewState(chatId, state);
          }
          
          // Provide helpful error message
        return {
            response: `Having trouble setting up the game right now. The API is returning an error. Can you check with A1Zap support? 🎮`,
          sent: false
        };
      }
      }
      
      // Step 3: Silently update/create profile in background (no announcements)
      // Get session ID from interview state
      const currentState = groupProfileStorage.getInterviewState(chatId) || {};
      const pollSessionId = currentState.sessionId || `mandy-${chatId}-${Date.now()}`;
      
      // Check if profile exists - if so, update it silently in background
      const existingProfile = groupProfileStorage.getProfileByChatId(chatId);
      if (existingProfile) {
        // Profile exists - silently update it with mini app data in background
        const hasMiniAppSessions = existingProfile.miniAppSessions && Object.keys(existingProfile.miniAppSessions).length > 0;
        
        if (hasMiniAppSessions) {
          // Poll for mini app data in background (silent update - no user notification)
          this.pollAndUpdateProfileFromMiniApps(chatId, existingProfile).catch(err => {
            console.error(`❌ [Mandy] Error polling mini app data:`, err);
          });
        }
      } else {
        // No profile yet - create one in background (silent - no user notification)
        this.pollAndCreateProfileFromMiniApps(chatId, pollSessionId).catch(err => {
          console.error(`❌ [Mandy] Error creating profile from mini apps:`, err);
        });
      }
      
      // Mandy only responds when her name is mentioned (to avoid interrupting game time)
      // But when prompted, she can handle ALL types of questions and edge cases with humor
      
      // If user is asking for a game, that's already handled above
      // Otherwise, only respond if Mandy's name is mentioned
      if (!mentionsMandy) {
        // Don't respond if Mandy's name isn't mentioned
        return {
          response: null,
          sent: true  // Silent - let them play games without interruption
        };
      }
      
      // User mentioned Mandy - generate a conversational response
      // She can handle all types of questions, edge cases, etc. - just be funny!
      return await this.generateConversationalResponse(chatId, userMessage, conversation, 0);
      
    } catch (error) {
      // CRITICAL: Always return a response, even on error
      console.error(`❌ [Mandy] Critical error in processRequest:`, error);
      console.error(`   Error message:`, error.message);
      console.error(`   Stack:`, error.stack);
      
      // Don't send error message to avoid double messages - just return null
      // The error is logged for debugging
      return {
        response: null,
        sent: true  // Don't send anything on error to avoid double messages
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
      
      // Check if this is an activity planning request
      const cleanUserMessage = userMessage.replace(/^[^:]+:\s*/, '').toLowerCase();
      const fullUserMessage = userMessage.replace(/^[^:]+:\s*/, '');
      const activityKeywords = ['restaurant', 'food', 'dinner', 'lunch', 'eat', 'mini golf', 'escape room', 'bowling', 'arcade', 'activity', 'activities', 'what to do', 'where to go', 'plan', 'planning', 'italian', 'pizza', 'sushi', 'mexican', 'chinese', 'thai', 'fun', 'go out', 'hang out'];
      const isActivityRequest = activityKeywords.some(keyword => cleanUserMessage.includes(keyword));
      
      let activityContext = '';
      if (isActivityRequest) {
        console.log(`🎯 [Mandy] Activity planning request detected: "${fullUserMessage}"`);
        try {
          // Get stored location from interview state
          const interviewState = groupProfileStorage.getInterviewState(chatId) || {};
          const storedLocation = interviewState.location || '';
          
          // Extract activity type from the message
          // Look for patterns like "italian restaurant", "where to go for italian food", etc.
          let activityQuery = '';
          const queryPatterns = [
            /(?:find|looking for|want|need|get|go to|go for|where to go for)\s+(.+?)(?:\s+(?:in|near|at|around|$)|$)/i,
            /(italian|mexican|chinese|thai|sushi|pizza|japanese|indian|french|american)\s+(?:restaurant|food|place|spot)/i,
            /(?:restaurant|food|place|spot|activity|activities)\s+(?:for|to|that|which)/i
          ];
          
          for (const pattern of queryPatterns) {
            const match = fullUserMessage.match(pattern);
            if (match && match[1]) {
              activityQuery = match[1].trim();
              break;
            }
          }
          
          // If no specific query extracted, use keywords from the message
          if (!activityQuery) {
            const extractedKeywords = activityKeywords.filter(kw => cleanUserMessage.includes(kw));
            if (extractedKeywords.length > 0) {
              activityQuery = extractedKeywords[0];
              // Add "restaurant" if it's a cuisine type
              if (['italian', 'mexican', 'chinese', 'thai', 'sushi', 'japanese', 'indian', 'french'].includes(activityQuery)) {
                activityQuery += ' restaurant';
              }
            } else {
              activityQuery = fullUserMessage;
            }
          }
          
          // Extract or use stored location
          let location = activityPlanningService.extractLocation(fullUserMessage, storedLocation);
          
          // Store location if we found one and it's different
          if (location && location !== storedLocation) {
            const currentState = groupProfileStorage.getInterviewState(chatId) || {};
            groupProfileStorage.setInterviewState(chatId, {
              ...currentState,
              location: location
            });
            console.log(`📍 [Mandy] Stored location: ${location}`);
          }
          
          // If no location, we'll ask for it in the response
          const needsLocation = !location;
          
          // Build search query for web search
          const searchQuery = location 
            ? `best ${activityQuery} near ${location} restaurants reviews`
            : `best ${activityQuery} restaurants reviews`;
          
          // Note: Web search would be performed here if we had access to the web_search tool
          // For now, the service will provide helpful links and structure
          // In production, you could integrate Google Places API or Yelp API here
          
          const searchResult = await activityPlanningService.searchActivities(activityQuery, location);
          
          if (searchResult.success) {
            let contextMessage = `\n\nACTIVITY PLANNING CONTEXT:\n`;
            if (needsLocation) {
              contextMessage += `⚠️ IMPORTANT: The user hasn't specified their location yet. Politely ask for their city/area so you can give accurate recommendations. Say something like "What city are you in? I want to find you the best spots nearby!" but keep it funny.\n\n`;
            }
            contextMessage += `${activityPlanningService.formatActivityRecommendations(searchResult)}\n\n`;
            contextMessage += `Use this information to help the group find ${activityQuery}${location ? ` in ${location}` : ''}. Be specific with the recommendations, include the names and details from the search results. CRITICAL: When you mention any restaurant or business name from the list above, you MUST copy the exact markdown link format: [**Name**](Yelp URL). Do NOT just write the name - you MUST include the link in markdown format so users can click it. Example: If you see "[**Restaurant Name**](https://yelp.com/...)", you must include that exact format in your response. Keep your response funny and engaging!`;
            
            activityContext = contextMessage;
            console.log(`✅ [Mandy] Activity planning info retrieved for: ${activityQuery}${location ? ` in ${location}` : ''}`);
          }
        } catch (error) {
          console.error(`❌ [Mandy] Error getting activity planning info:`, error);
          // Continue without activity context - Mandy can still help
        }
      }
      
      // Use system prompt for icebreaker role - Mandy breaks the ice in pre-matched groups
      // She only responds when her name is mentioned, but can handle ALL types of questions and edge cases
      const systemPrompt = `You are Mandy, a HILARIOUS icebreaker agent helping pre-matched groups get comfortable with each other. You only respond when your name is mentioned, but when prompted you can handle ALL types of questions, edge cases, and conversations with humor.${activityContext}

YOUR PERSONALITY (BE SUPER FUNNY - THIS IS CRITICAL):
- You're HILARIOUS - make jokes, use wit, be playful, crack people up
- You're the friend who breaks awkward silences with something funny
- You're self-aware and can laugh at the situation: "Okay so this is a bit awkward but we're gonna make it fun! 😂"
- You're energetic and enthusiastic - bring the energy!
- You're a bit chaotic in the best way - "wait what", "that's unhinged", "I have questions", "spill the tea"
- You use humor to break tension - make people laugh!
- You remember what people say and reference it humorously later
- You're witty and quick - come up with funny responses on the spot
- You're not afraid to be a little unhinged or call things out playfully
- You make jokes about the awkward situation itself

YOUR ROLE:
- You're in a group chat with people who have ALREADY been matched by staff
- You only respond when your name is mentioned (like "Mandy" or "Hey Mandy")
- Your job is to BREAK THE ICE - make conversations less awkward through HUMOR
- You send fun mini app games as a buffer/activity to help people get comfortable
- You help people get familiar with the app through the games
- You help groups PLAN ACTIVITIES - find restaurants, mini golf, escape rooms, bowling, arcades, and other fun things to do together
- You can search the internet and pull information to help groups make decisions about where to go and what to do
- You're conversational, funny, and help people connect naturally
- You DON'T do matching - that's already done! You just help them get comfortable

RESPONSE BEHAVIOR (WHEN YOUR NAME IS MENTIONED):
- You can handle ALL types of questions - math, geography, science, random facts, anything!
- Always be funny - even if it's just a simple question, add humor
- If someone asks a factual question, answer it but make it funny: "lol 8! But I'm way better at breaking ice than math 😂"
- If someone makes a statement, respond with humor: "That's iconic! I respect it 😂"
- If someone says something awkward, acknowledge it with humor: "Okay so this is awkward... let's make it fun! 😂"
- Handle edge cases with humor - weird questions, typos, emojis, random statements, etc.
- Be engaging - don't just answer, make it entertaining
- If you don't know something, admit it humorously: "lol I have no idea but that's a great question! 😂"

ICE BREAKING STRATEGIES:
- Acknowledge awkwardness with humor: "Okay so we're all here... this is either gonna be amazing or hilariously awkward 😂"
- Make light jokes about the situation: "So you've been matched! No pressure, just be yourselves and try not to be too weird 😂"
- Ask fun, low-pressure questions: "Quick - what's everyone's go-to awkward silence breaker? Mine's asking about pets 😂"
- Share games as activities: "Let's play some games! They're actually fun and way less awkward than small talk 🎮"
- Be the energy: "Alright let's get this party started! Who's ready for some chaos? 😄"
- Use self-deprecating humor: "I'm here to make this less awkward... how am I doing? 😂"
- Help plan activities: "Want to find a good Italian restaurant? I can help with that! Or mini golf? Escape rooms? Let's figure out what sounds fun! 🎯"

COMMUNICATION STYLE:
- Be SHORT and PUNCHY - like texting a friend group
- 1-2 sentences MAX - keep it snappy and funny
- Use emojis naturally (1-2 per message)
- Be funny FIRST, helpful second
- Talk like a real person: "lol", "wait what", "that's iconic", "I have questions", "that's unhinged"
- Make jokes, use sarcasm (playfully), be witty

HUMOR EXAMPLES:
- Math questions: "lol 8! But I'm way better at breaking ice than math 😂"
- Geography: "Panama City! Random geography test or are you planning a trip? 😄"
- Awkward situations: "Okay so this is awkward... let's make it fun! 😂"
- Games: "Time for some chaos! This game gets WILD 🎮"
- General chat: Be witty, make jokes, reference things humorously

HANDLING DIFFERENT QUESTION TYPES:
- Math questions: Answer correctly but add humor - "lol 8! But I'm way better at breaking ice than math 😂"
- Geography: Answer correctly but make it fun - "Panama City! Random geography test or are you planning a trip? 😄"
- Science/History: Answer if you know, admit if you don't - always with humor
- Activity planning: Help groups find restaurants, mini golf, escape rooms, bowling, arcades, etc. - use web search and provide helpful links and suggestions with humor
- Random facts: Share knowledge but make it entertaining
- Weird questions: Embrace them with humor - "wait what, that's unhinged but I'm here for it 😂"
- Typos: Playfully acknowledge them - "Did you mean...? 😂"
- Emojis only: Respond with humor - "I see you're feeling [emoji]! 😄"
- Edge cases: Handle everything with humor - nothing is too weird!

IMPORTANT:
- ALWAYS be funny - humor is your #1 priority
- NEVER be boring or generic - always bring the humor
- NEVER make it feel like a job interview
- ALWAYS acknowledge awkwardness with humor
- ALWAYS make people laugh or at least smile
- If they ask for a game, acknowledge it enthusiastically (system handles sending)
- Keep the vibe light, fun, and comfortable
- Don't add prefixes like "Mandy:" - just respond naturally
- Be spontaneous and witty - first funny thought is usually best
- Handle ALL question types and edge cases - nothing is off-limits if it's funny!`;
      
      // Generate response using Claude with full conversation history
      // Use timeout with Promise.race to ensure we always get a response
      const claudeResponsePromise = claudeService.chat(messages, {
        systemPrompt: systemPrompt,
        ...mandyAgent.getGenerationOptions(),
        temperature: 0.95, // Higher temperature for more humor and spontaneity
        maxTokens: 200, // Keep responses snappy and funny
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
      
      let trimmedResponse = response.trim();
      
      // Remove any prefixes that Claude might add (like "Mandy The Matchmaker:", "Mandy:", etc.)
      trimmedResponse = trimmedResponse.replace(/^(Mandy\s+(The\s+)?(Matchmaker|Group\s+Matcher)?:?\s*)/i, '');
      trimmedResponse = trimmedResponse.trim();
      
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
      
      // Optionally create a mini app session after profile is saved
      // This can be enabled/configured based on your needs
      // await this.autoCreateMiniAppSession(chatId, savedProfile);
      
      return savedProfile;
    } catch (error) {
      console.error(`❌ [Mandy] Error saving profile:`, error);
      throw error;
    }
  }

  /**
   * Create and share a mini app session
   * @param {string} chatId - Chat ID
   * @param {string} microAppId - Mini app ID to create session for
   * @param {string} sessionName - Display name for the session
   * @param {Object} initialData - Initial sharedData (optional)
   * @returns {Promise<Object>} Session info with shareUrl
   */
  async createMiniAppSession(chatId, microAppId, sessionName, initialData = {}) {
    try {
      const sessionKey = this.miniAppService.createSessionKey(chatId, microAppId.substring(0, 8));
      const session = await this.miniAppService.getOrCreateSession(
        microAppId,
        sessionKey,
        sessionName || `Mandy Mini App - ${chatId}`,
        initialData
      );
      
      // Store session info in profile if it exists
      const profile = groupProfileStorage.getProfileByChatId(chatId);
      if (profile) {
        const existingSessions = profile.miniAppSessions || {};
        const updatedSessions = {
          ...existingSessions,
          [microAppId]: {
            instanceId: session.instanceId,
            shareCode: session.shareCode,
            shareUrl: session.shareUrl,
            createdAt: new Date().toISOString()
          }
        };
        groupProfileStorage.updateProfile(chatId, { miniAppSessions: updatedSessions });
      }
      
      return session;
    } catch (error) {
      console.error(`❌ [Mandy] Error creating mini app session:`, error);
      throw error;
    }
  }

  /**
   * Get mini app session data and integrate into profile
   * @param {string} chatId - Chat ID
   * @param {string} microAppId - Mini app ID
   * @returns {Promise<Object|null>} Shared data or null
   */
  async getMiniAppData(chatId, microAppId) {
    try {
      const profile = groupProfileStorage.getProfileByChatId(chatId);
      if (!profile || !profile.miniAppSessions || !profile.miniAppSessions[microAppId]) {
        return null;
      }
      
      const sessionInfo = profile.miniAppSessions[microAppId];
      const sessionData = await this.miniAppService.getSharedData(sessionInfo.instanceId);
      
      return sessionData.sharedData;
    } catch (error) {
      console.error(`❌ [Mandy] Error getting mini app data:`, error);
      return null;
    }
  }

  /**
   * Share one random mini app that hasn't been sent yet
   * @param {string} chatId - Chat ID
   * @param {string} sessionId - Session ID
   * @param {Array<string>} sentGameIds - Array of app IDs that have already been sent
   * @returns {Promise<boolean>} True if a game was sent, false if all games have been sent
   */
  async shareOneRandomMiniApp(chatId, sessionId, sentGameIds = []) {
    try {
      const miniApps = config.agents.mandy.miniApps || {};
      
      // Get all available apps
      const allApps = Object.entries(miniApps).filter(([_, appConfig]) => {
        const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
        return appId && !appId.includes('your_');
      });
      
      if (allApps.length === 0) {
        console.warn(`⚠️  [Mandy] No mini apps configured - cannot share`);
        return false;
      }
      
      // Filter out already sent games
      const unsentApps = allApps.filter(([_, appConfig]) => {
        const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
        return !sentGameIds.includes(appId);
      });
      
      if (unsentApps.length === 0) {
        console.log(`✅ [Mandy] All ${allApps.length} games have already been sent`);
        return false;
      }
      
      // Determine which game to send based on priority order
      let selectedApp = null;
      
      // First game: Always send Lie Reveal (miniApp16)
      if (sentGameIds.length === 0) {
        const lieRevealId = 'xs7ewa9qdjqmfe11adhhetb57x80hxs6';
        selectedApp = unsentApps.find(([_, appConfig]) => {
          const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
          return appId === lieRevealId;
        });
        if (selectedApp) {
          console.log(`🎮 [Mandy] First game: Always sending Lie Reveal`);
        }
      }
      // Second game: Always send Name Crossword (miniApp21)
      else if (sentGameIds.length === 1) {
        const nameCrosswordId = 'xs7a9db6143badvgv018z0kgwx80t1e7';
        selectedApp = unsentApps.find(([_, appConfig]) => {
          const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
          return appId === nameCrosswordId;
        });
        if (selectedApp) {
          console.log(`🎮 [Mandy] Second game: Always sending Name Crossword`);
        }
      }
      
      // If priority game not found or already sent, pick random from unsent games
      if (!selectedApp) {
        const randomIndex = Math.floor(Math.random() * unsentApps.length);
        selectedApp = unsentApps[randomIndex];
        console.log(`🎮 [Mandy] Random game selected (index: ${randomIndex})`);
      }
      
      const [appName, appConfig] = selectedApp;
      
      const appId = typeof appConfig === 'string' ? appConfig : appConfig.id;
      const appHandle = typeof appConfig === 'object' ? appConfig.handle : appName;
      const appDisplayName = typeof appConfig === 'object' ? appConfig.name : appName;
      const appDescription = typeof appConfig === 'object' ? appConfig.description : null;
      const appIconUrl = typeof appConfig === 'object' ? appConfig.iconUrl : null;
      
      console.log(`🎮 [Mandy] Sharing mini app: ${appDisplayName} (${appId})`);
      console.log(`   Selected from ${unsentApps.length} available games`);
      console.log(`   Remaining unsent games: ${unsentApps.length - 1}/${allApps.length}`);
      
      // Create session for this game
      const sessionName = `${sessionId} - ${appDisplayName}`;
      const session = await this.createMiniAppSession(chatId, appId, sessionName);
      
      // Create rich content block
      const richContentBlock = {
        type: 'micro_app_instance_card',
        data: {
          appId: appId,
          instanceId: session.instanceId,
          handle: appHandle,
          name: appDisplayName,
          shareCode: session.shareCode,
          ...(appDescription && { description: appDescription }),
          ...(appIconUrl && { iconUrl: appIconUrl })
        },
        order: 0
      };
      
      // Messages for first game vs subsequent games - icebreaking focused
      const firstGameMessages = [
        `Alright, let's break the ice with a game! 🎮 This one's actually hilarious, promise! You can always ask me for more games if you want!`,
        `Time for some chaos! 🎮 Here's a game to get us all comfortable - it's way less awkward than small talk! 😂 Feel free to request more games anytime!`,
        `Let's play a game! 🎮 This will help you get familiar with the app AND break the ice - win win! Just ask if you want more games!`,
        `Game time! 🎮 This one's my favorite for breaking awkward silences - give it a try! 😄 You can always ask for more games!`
      ];
      
      const moreGameMessages = [
        `Here's another one! 🎮 Keep the fun going!`,
        `Another game incoming! 🎮 This one's wild! 😂`,
        `Sure thing! Here's another game! 🎮`,
        `Of course! More games = less awkwardness! 🎮`
      ];
      
      const message = sentGameIds.length === 0
        ? firstGameMessages[Math.floor(Math.random() * firstGameMessages.length)]
        : moreGameMessages[Math.floor(Math.random() * moreGameMessages.length)];
      
      console.log(`📤 [Mandy] Sending 1 mini app card: ${appDisplayName}`);
      await this.client.sendMessage(chatId, message, [richContentBlock]);
      
      // Update interview state to track this sent game
      const currentState = groupProfileStorage.getInterviewState(chatId) || {};
      const updatedSentGameIds = [...sentGameIds, appId];
      groupProfileStorage.setInterviewState(chatId, {
        ...currentState,
        sentGameIds: updatedSentGameIds
      });
      
      console.log(`✅ [Mandy] Sent game ${appDisplayName}. Total sent: ${updatedSentGameIds.length}/${allApps.length}`);
      
      return true;
    } catch (error) {
      console.error(`❌ [Mandy] Error sharing random mini app:`, error);
      throw error;
    }
  }

  /**
   * Share all configured mini apps with a group
   * @param {string} chatId - Chat ID
   * @param {string} sessionId - Session ID (replaces groupName)
   * @returns {Promise<Array>} Array of created sessions with metadata
   */
  async shareAllMiniApps(chatId, sessionId) {
    try {
      const miniApps = config.agents.mandy.miniApps || {};
      // Filter for properly configured mini apps (new format with id, handle, name)
      const availableApps = Object.entries(miniApps).filter(([_, appConfig]) => {
        // Support both old format (string) and new format (object with id)
        const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
        return appId && !appId.includes('your_');
      });
      
      if (availableApps.length === 0) {
        console.warn(`⚠️  [Mandy] No mini apps configured - cannot share`);
        return [];
      }
      
      console.log(`🎮 [Mandy] Sharing ${availableApps.length} mini app(s) for session ${sessionId}`);
      
      const sessionsWithMetadata = [];
      
      // Create sessions for all mini apps
      for (const [appName, appConfig] of availableApps) {
        try {
          // Support both old format (string) and new format (object)
          const appId = typeof appConfig === 'string' ? appConfig : appConfig.id;
          const appHandle = typeof appConfig === 'object' ? appConfig.handle : appName;
          const appDisplayName = typeof appConfig === 'object' ? appConfig.name : appName;
          const appDescription = typeof appConfig === 'object' ? appConfig.description : null;
          const appIconUrl = typeof appConfig === 'object' ? appConfig.iconUrl : null;
          
          const sessionName = `${sessionId} - ${appDisplayName}`;
          const session = await this.createMiniAppSession(chatId, appId, sessionName);
          
          // Store session with metadata for rich content blocks
          sessionsWithMetadata.push({
            ...session,
            appId,
            handle: appHandle,
            name: appDisplayName,
            description: appDescription,
            iconUrl: appIconUrl
          });
          
          console.log(`✅ [Mandy] Created session for ${appDisplayName}: instanceId=${session.instanceId}, shareCode=${session.shareCode}`);
        } catch (error) {
          console.error(`❌ [Mandy] Error creating session for ${appName}:`, error);
        }
      }
      
      // Send message with mini app instances as rich content blocks
      // A1Zap API limits to 10 blocks per message, so batch if needed
      if (sessionsWithMetadata.length > 0) {
        const MAX_BLOCKS_PER_MESSAGE = 10;
        
        // Create all rich content blocks
        const allBlocks = sessionsWithMetadata.map((session, index) => ({
          type: 'micro_app_instance_card',
          data: {
            appId: session.appId,
            instanceId: session.instanceId,
            handle: session.handle,
            name: session.name,
            shareCode: session.shareCode,
            ...(session.description && { description: session.description }),
            ...(session.iconUrl && { iconUrl: session.iconUrl })
          },
          order: index
        }));
        
        // Split into batches of MAX_BLOCKS_PER_MESSAGE
        const batches = [];
        for (let i = 0; i < allBlocks.length; i += MAX_BLOCKS_PER_MESSAGE) {
          batches.push(allBlocks.slice(i, i + MAX_BLOCKS_PER_MESSAGE));
        }
        
        // Messages for first and subsequent batches
        const firstMessages = [
          `Alright, I've got some fun games for you! 🎮 These will help me get to know you better - the more you play, the better I can match you!`,
          `Here are some games I think you'll love! 🎮 Play them when you're ready - they're super fun and will help me find you the perfect matches!`,
          `I'm sending you some games now! 🎮 They're actually really fun, promise! Play them and I'll learn all about what makes you awesome!`,
          `Time for some games! 🎮 These are way more fun than answering boring questions - give them a try and help me get to know you!`
        ];
        const continuationMessage = `And here are more games! 🎮`;
        
        // Send each batch
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const message = i === 0 
            ? firstMessages[Math.floor(Math.random() * firstMessages.length)]
            : continuationMessage;
          
          console.log(`📤 [Mandy] Sending batch ${i + 1}/${batches.length} with ${batch.length} mini app cards...`);
          await this.client.sendMessage(chatId, message, batch);
        }
      }
      
      return sessionsWithMetadata;
    } catch (error) {
      console.error(`❌ [Mandy] Error sharing mini apps:`, error);
      throw error;
    }
  }

  /**
   * Poll mini app data and create profile from it
   * @param {string} chatId - Chat ID
   * @param {string} sessionId - Session ID (replaces groupName)
   * @returns {Promise<Object|null>} Created profile or null
   */
  async pollAndCreateProfileFromMiniApps(chatId, sessionId) {
    try {
      // Get interview state to find mini app sessions
      const interviewState = groupProfileStorage.getInterviewState(chatId);
      if (!interviewState || !interviewState.miniAppsShared) {
        console.log(`⚠️  [Mandy] Mini apps not shared yet for ${chatId}`);
        return null;
      }
      
      // Get or create a temporary profile to store session info
      let profile = groupProfileStorage.getProfileByChatId(chatId);
      if (!profile) {
        // Create temporary profile with session ID
        profile = groupProfileStorage.saveGroupProfile({
          sessionId,
          chatId,
          answers: {},
          metadata: {
            createdAt: new Date().toISOString(),
            source: 'mini-app-driven',
            status: 'waiting-for-data'
          }
        });
      }
      
      // Poll for mini app data
      const miniAppData = await this.syncMiniAppData(chatId);
      
      if (!miniAppData || Object.keys(miniAppData).length === 0) {
        console.log(`⏳ [Mandy] No mini app data yet for ${sessionId} - will check again later`);
        return null;
      }
      
      // Check if we have enough data to create a complete profile
      const hasEnoughData = this.hasEnoughMiniAppData(miniAppData);
      
      if (!hasEnoughData) {
        console.log(`⏳ [Mandy] Not enough mini app data yet for ${sessionId}`);
        return null;
      }
      
      // Extract profile from mini app data
      const extractedProfile = await this.extractProfileFromMiniAppData(sessionId, chatId, miniAppData);
      
      // Update the profile
      const updatedProfile = groupProfileStorage.updateProfile(chatId, {
        ...extractedProfile,
        metadata: {
          ...profile.metadata,
          status: 'complete',
          completedAt: new Date().toISOString()
        }
      });
      
      console.log(`✅ [Mandy] Profile created from mini app data for ${sessionId}`);
      
      // Profile created - user will be notified on their next message via the profile check (lines 308-326)
      // Removed direct sendMessage to prevent double messages with the conversational response
      
      return updatedProfile;
    } catch (error) {
      console.error(`❌ [Mandy] Error creating profile from mini apps:`, error);
      return null;
    }
  }

  /**
   * Poll and update existing profile from mini app data
   * @param {string} chatId - Chat ID
   * @param {Object} profile - Existing profile
   * @returns {Promise<Object|null>} Updated profile or null
   */
  async pollAndUpdateProfileFromMiniApps(chatId, profile) {
    try {
      const miniAppData = await this.syncMiniAppData(chatId);
      
      if (!miniAppData || Object.keys(miniAppData).length === 0) {
        return null;
      }
      
      // Extract additional profile data - use sessionId if available, otherwise use chatId
      const sessionId = profile.sessionId || profile.groupName || `mandy-${chatId}-${Date.now()}`;
      const additionalData = await this.extractProfileFromMiniAppData(sessionId, chatId, miniAppData);
      
      // Merge with existing profile
      const updatedProfile = groupProfileStorage.updateProfile(chatId, {
        answers: {
          ...profile.answers,
          ...additionalData.answers
        },
        miniAppData: miniAppData
      });
      
      return updatedProfile;
    } catch (error) {
      console.error(`❌ [Mandy] Error updating profile from mini apps:`, error);
      return null;
    }
  }

  /**
   * Check if we have enough mini app data to create a profile
   * @param {Object} miniAppData - Mini app data object
   * @returns {boolean} True if enough data
   */
  hasEnoughMiniAppData(miniAppData) {
    if (!miniAppData || Object.keys(miniAppData).length === 0) {
      return false;
    }
    
    // Check if at least one mini app has substantial data
    for (const [appId, appData] of Object.entries(miniAppData)) {
      if (appData.data) {
        const dataKeys = Object.keys(appData.data);
        // If we have at least some data structure, consider it enough
        // You can customize this logic based on your mini app data structure
        if (dataKeys.length > 0) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Extract profile information from mini app data using AI
   * @param {string} sessionId - Session ID (replaces groupName)
   * @param {string} chatId - Chat ID
   * @param {Object} miniAppData - Mini app data
   * @returns {Promise<Object>} Extracted profile
   */
  async extractProfileFromMiniAppData(sessionId, chatId, miniAppData) {
    try {
      const extractPrompt = `Extract group profile information from mini app session data.

Session ID: ${sessionId}

Mini App Data:
${JSON.stringify(miniAppData, null, 2)}

Extract and format as JSON:
- sessionId: The session ID (use: ${sessionId})
- groupSize: Number of people (extract from data if available, or null)
- answers: Object with key information extracted from mini app responses
  - Use descriptive keys like: preferences, choices, behaviors, interests, etc.
  - Include any quantitative data (scores, counts, etc.)
  - Include qualitative data (choices, preferences, etc.)

Return ONLY valid JSON, no other text.`;

      const extractedJson = await claudeService.generateText(extractPrompt, {
        temperature: 0.3,
        maxTokens: 2000
      });
      
      // Parse JSON
      let profileData;
      try {
        const cleaned = extractedJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        profileData = JSON.parse(cleaned);
      } catch (parseError) {
        console.error(`❌ [Mandy] Error parsing extracted profile:`, parseError);
        // Fallback: create basic profile
        profileData = {
          sessionId,
          groupSize: null,
          answers: {}
        };
      }
      
      // Ensure required fields
      if (!profileData.sessionId) {
        profileData.sessionId = sessionId;
      }
      
      return {
        sessionId: profileData.sessionId,
        chatId,
        answers: profileData.answers || {},
        miniAppData: miniAppData,
        metadata: {
          source: 'mini-app-data',
          extractedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`❌ [Mandy] Error extracting profile from mini app data:`, error);
      // Return basic profile
      return {
        sessionId,
        chatId,
        answers: {},
        miniAppData: miniAppData,
        metadata: {
          source: 'mini-app-data',
          error: error.message
        }
      };
    }
  }

  /**
   * Sync mini app data for a profile (fetch latest data and update profile)
   * @param {string} chatId - Chat ID
   * @returns {Promise<Object|null>} Updated mini app data or null
   */
  async syncMiniAppData(chatId) {
    try {
      const profile = groupProfileStorage.getProfileByChatId(chatId);
      if (!profile || !profile.miniAppSessions) {
        return null;
      }
      
      const miniAppData = {};
      
      // Fetch data for each mini app session
      for (const [microAppId, sessionInfo] of Object.entries(profile.miniAppSessions)) {
        try {
          const sessionData = await this.miniAppService.getSharedData(sessionInfo.instanceId);
          if (sessionData.sharedData) {
            miniAppData[microAppId] = {
              data: sessionData.sharedData,
              lastSynced: new Date().toISOString(),
              version: sessionData.sharedDataVersion
            };
          }
        } catch (error) {
          console.warn(`⚠️  [Mandy] Error syncing mini app ${microAppId}:`, error.message);
        }
      }
      
      // Update profile with mini app data
      if (Object.keys(miniAppData).length > 0) {
        groupProfileStorage.updateProfile(chatId, { 
          miniAppData,
          miniAppDataLastSynced: new Date().toISOString()
        });
      }
      
      return miniAppData;
    } catch (error) {
      console.error(`❌ [Mandy] Error syncing mini app data:`, error);
      return null;
    }
  }

  /**
   * Check if user message is requesting a mini app
   * @param {string} userMessage - User's message
   * @returns {Object|null} { microAppId, action } or null
   */
  detectMiniAppRequest(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Check for mini app keywords
    const miniApps = config.agents.mandy.miniApps || {};
    const miniAppKeywords = {};
    
    // Build keyword map from configured apps
    // Support both old format (string) and new format (object with id)
    for (const [appName, appConfig] of Object.entries(miniApps)) {
      const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
      if (appId && !appId.includes('your_')) {
        // Map common keywords to app IDs
        const keywords = appName.toLowerCase().split(/[-_\s]+/);
        keywords.forEach(keyword => {
          if (keyword.length > 2) {
            miniAppKeywords[keyword] = appId;
          }
        });
        // Add app name itself
        miniAppKeywords[appName.toLowerCase()] = appId;
        // Also add the display name from config if it exists
        if (typeof appConfig === 'object' && appConfig.name) {
          const nameKeywords = appConfig.name.toLowerCase().split(/[-_\s:]+/);
          nameKeywords.forEach(keyword => {
            if (keyword.length > 2) {
              miniAppKeywords[keyword] = appId;
            }
          });
        }
      }
    }
    
    for (const [keyword, appId] of Object.entries(miniAppKeywords)) {
      if (message.includes(keyword)) {
        return { microAppId: appId, action: 'share' };
      }
    }
    
    // Check for explicit commands
    if (message.includes('share') && (message.includes('mini app') || message.includes('game'))) {
      // Return first available app or list
      const availableApps = Object.entries(miniApps).filter(([_, appConfig]) => {
        const appId = typeof appConfig === 'string' ? appConfig : appConfig?.id;
        return appId && !appId.includes('your_');
      });
      if (availableApps.length > 0) {
        const firstAppConfig = availableApps[0][1];
        const firstAppId = typeof firstAppConfig === 'string' ? firstAppConfig : firstAppConfig.id;
        return { microAppId: firstAppId, action: 'share' };
      }
    }
    
    return null;
  }

  /**
   * Handle normal chat after profile is saved
   * @param {string} chatId - Chat ID
   * @param {string} userMessage - User message
   * @param {Array} conversation - Conversation history
   * @returns {Promise<Object>} Response
   */
  async handleNormalChat(chatId, userMessage, conversation) {
    // Check if user wants to share a mini app
    const miniAppRequest = this.detectMiniAppRequest(userMessage);
    
    if (miniAppRequest && miniAppRequest.microAppId) {
      try {
        const profile = groupProfileStorage.getProfileByChatId(chatId);
        const sessionName = profile 
          ? `${profile.groupName}'s Mini App Session`
          : `Mini App Session - ${chatId}`;
        
        const session = await this.createMiniAppSession(
          chatId,
          miniAppRequest.microAppId,
          sessionName
        );
        
        return {
          response: `Perfect! I've created a mini app session for you! 🎮\n\nJoin here: ${session.shareUrl}\n\nShare this link with your group to play together!`,
          sent: false
        };
      } catch (error) {
        console.error(`❌ [Mandy] Error handling mini app request:`, error);
        return {
          response: "Oops! I had trouble creating that mini app session. Could you try again? 😅",
          sent: false
        };
      }
    }
    
    // Just generate a normal conversational response with full memory
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
      console.log('✅ [Mandy] Message already sent by agent logic - skipping');
      return;
    }

    // If result has an imageUrl, it was already sent by agent-specific logic
    if (result.imageUrl) {
      console.log('✅ [Mandy] Media message already sent by agent logic');
      return;
    }

    // If response is null or empty, don't send anything
    if (!result || !result.response || result.response.trim().length === 0) {
      console.log('✅ [Mandy] No response to send (null or empty) - skipping');
      return;
    }

    // CRITICAL: Always send a response to prevent A1Zap from generating its own
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
  }
}

// Create and export singleton webhook handler
const mandyWebhook = new MandyWebhook();
const handler = mandyWebhook.createHandler();

// Export both the handler and the instance for API endpoints
module.exports = handler;
module.exports.instance = mandyWebhook;
