const claudeService = require('../services/claude-service');
const brandonEatsClient = require('../services/brandoneats-client');
const brandonEatsAgent = require('../agents/brandoneats-agent');
const fileRegistry = require('../services/file-registry');
const socialLinkExtractor = require('../services/social-link-extractor');

// Message deduplication - store recently processed message IDs
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
 * Brandon Eats Webhook Handler
 * Specialized for food/restaurant data analysis with intelligent filtering
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * INTELLIGENT RESPONSE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This webhook implements a smart, two-step filtering system to ensure users
 * only receive relevant responses and social media links:
 * 
 * 1️⃣  OFF-TOPIC TRIAGE (Lines 173-243)
 *     • Checks if the question is food/restaurant-related before processing
 *     • Permissive by design - assumes user intent for travel/dining questions
 *     • Blocks only clearly irrelevant topics (weather, sports, tech, etc.)
 *     • Sends friendly boundary message for off-topic questions
 *     • Saves API costs by avoiding full response generation
 * 
 *     Examples:
 *     ✓ "Where should I visit in Hanoi?" → Passes (implies food context)
 *     ✓ "Best pho spots?" → Passes
 *     ✗ "What's the weather?" → Blocked
 *     ✗ "Who won the game?" → Blocked
 * 
 * 2️⃣  SOCIAL LINK FILTERING (Lines 282-348)
 *     Two-stage process to ensure social links are only sent when relevant:
 * 
 *     Stage 2A (Webhook): Quick check if response discusses specific places
 *       • Prevents links for generic responses or clarifications
 *       • Only proceeds if specific restaurant names are mentioned
 * 
 *     Stage 2B (social-link-extractor.js): Match restaurants to CSV data
 *       • Uses AI to detect which restaurants are actually discussed
 *       • Strict matching - only includes restaurants that are key subjects
 *       • Returns empty if response is generic or doesn't discuss places
 * 
 *     Examples:
 *     ✓ "Try Pho 24 in District 1" → Sends Pho 24 TikTok link
 *     ✓ "Brandon loved Banh Mi 25" → Sends Banh Mi 25 link
 *     ✗ "I can help with that!" → No links (generic response)
 *     ✗ "What would you like to know?" → No links (clarification)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function brandonEatsWebhookHandler(req, res) {
  try {
    console.log('\n=== Brandon Eats Webhook Received ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Extract webhook data
    const { chat, message, agent } = req.body;
    
    // Check for duplicate message
    if (message?.id && processedMessages.has(message.id)) {
      console.log(`⚠️  Duplicate message detected: ${message.id} - skipping processing`);
      return res.json({
        success: true,
        skipped: true,
        reason: 'duplicate_message',
        messageId: message.id
      });
    }

    // Mark message as processed IMMEDIATELY to prevent race conditions
    if (message?.id) {
      processedMessages.set(message.id, Date.now());
      console.log(`✅ Message ${message.id} marked as processed`);
    }

    if (!chat?.id) {
      return res.status(400).json({
        success: false,
        error: 'Missing chat.id in webhook payload'
      });
    }

    if (!message?.content) {
      return res.status(400).json({
        success: false,
        error: 'Missing message.content in webhook payload'
      });
    }

    const chatId = chat.id;
    const agentId = agent?.id;
    const userMessage = message.content;

    console.log(`Processing Brandon Eats query from chat ${chatId}: "${userMessage}"`);

    // Check if base file is set for brandoneats agent
    const baseFileId = fileRegistry.getBaseFile('brandoneats');
    if (baseFileId) {
      const fileInfo = fileRegistry.getFileById(baseFileId);
      console.log(`📊 Using data file for Brandon Eats: ${fileInfo?.filename || baseFileId}`);
    } else {
      console.warn('⚠️  No base file set for Brandon Eats - responses will not have data context');
    }

    // Easter egg: Check if user sent "a1" - respond with social share rich content
    if (userMessage.toLowerCase().trim() === 'a1') {
      console.log('🎉 A1 Easter egg triggered! Sending social share rich content...');
      
      const richContentBlocks = [
        {
          type: 'social_share',
          data: {
            platform: 'instagram',
            url: 'https://www.instagram.com/reel/DQI4QE8jHiL/'
          },
          order: 0
        },
        {
          type: 'social_share',
          data: {
            platform: 'tiktok',
            url: 'https://www.tiktok.com/@brandneweats/video/7546112444503035144'
          },
          order: 1
        },
        {
          type: 'social_share',
          data: {
            platform: 'youtube',
            url: 'https://www.youtube.com/shorts/ToobPQS6_ZI'
          },
          order: 2
        }
      ];

      // Send rich content message
      const sendResult = await brandonEatsClient.sendMessage(
        chatId,
        '🔥 Check out our viral content across all platforms!',
        richContentBlocks
      );

      console.log('✅ A1 Easter egg: Social shares sent successfully!');

      // IMPORTANT: Return immediately to prevent duplicate responses
      return res.json({
        success: true,
        agent: brandonEatsAgent.name,
        response: '🔥 Check out our viral content across all platforms!',
        richContent: true,
        easterEgg: 'a1',
        messageId: sendResult?.messageId
      });
    }

    // Build conversation array
    const conversation = [];

    // Fetch message history (last 10 messages for context)
    let messageHistory = [];
    if (chatId && agentId) {
      try {
        console.log('Fetching message history for chatId:', chatId);
        const history = await brandonEatsClient.getMessageHistory(chatId, 10);

        if (history && history.length > 0) {
          messageHistory = history;
          console.log(`Retrieved ${messageHistory.length} messages from history`);

          // Convert message history to conversation format
          messageHistory.forEach(msg => {
            // Only process messages with text content
            if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
              const role = msg.isAgent || msg.senderId === agentId ? 'assistant' : 'user';
              const content = msg.senderName && !msg.isAgent
                ? `${msg.senderName}: ${msg.content}`
                : msg.content;

              conversation.push({
                role: role,
                content: String(content)
              });
            } else if (msg.content && typeof msg.content === 'object') {
              // Skip messages with complex content structures (e.g., file references, rich media)
              // These can cause API errors when passed through
              console.log(`⚠️  Skipping message with complex content structure`);
            }
          });
        }
      } catch (error) {
        console.warn('Failed to fetch message history:', error.message);
        // Continue without history - don't fail the entire request
      }
    }

    // Add the current message to conversation
    conversation.push({ role: 'user', content: String(userMessage) });

    // ============================================================================
    // STEP 1: OFF-TOPIC QUESTION TRIAGE
    // ============================================================================
    // Before generating an expensive full response, we check if the question is
    // even relevant to food/restaurants. This prevents the bot from answering
    // completely unrelated questions (e.g., "What's the weather?", "Who won the game?")
    // 
    // The triage is intentionally permissive and assumes user intent - it treats
    // travel questions and "where to visit" as food-related since users typically
    // want dining recommendations. Only clearly off-topic questions are blocked.
    //
    // Benefits:
    // - Saves API costs by avoiding full Claude generation for irrelevant questions
    // - Sets clear boundaries about the bot's purpose
    // - Prevents social link searches for off-topic queries
    // ============================================================================
    console.log('🔍 Checking if question is food/restaurant related...');
    const topicCheckPrompt = `You are a topic classifier for a food/restaurant recommendation assistant.

Question: "${userMessage}"

Determine if this question could reasonably be answered by someone who reviews restaurants and food.

ANSWER "YES" if the question is about:
- Food, restaurants, cafes, dining experiences
- Travel recommendations (where to visit/eat)
- Menu items, dishes, cuisines
- Restaurant recommendations or reviews
- Places to visit (implies food/dining context)
- Food-related activities or experiences

ANSWER "NO" ONLY if the question is clearly about:
- Weather, sports, politics, general trivia
- Non-food topics with no connection to dining
- Technical support, math problems, coding
- Topics completely unrelated to food/travel/dining

Context: Assume the user is asking with the intent to learn about food and places to eat.

Answer with ONLY "YES" or "NO":`;

    const topicCheck = await claudeService.generateText(topicCheckPrompt, {
      temperature: 0.1,
      maxTokens: 10
    });

    const isOnTopic = topicCheck.trim().toUpperCase().includes('YES');
    
    if (!isOnTopic) {
      console.log('⚠️  Off-topic question detected - sending boundary response');
      const boundaryResponse = "Hey! I'm here to help with Brandon's food reviews and restaurant recommendations. What would you like to know about places Brandon has tried? 🍕";
      
      // Send boundary response
      if (!chatId.startsWith('test-')) {
        try {
          await brandonEatsClient.sendMessage(chatId, boundaryResponse);
        } catch (sendError) {
          console.error('Failed to send boundary message:', sendError.message);
        }
      }
      
      // Return early - no social links needed
      return res.json({
        success: true,
        agent: brandonEatsAgent.name,
        response: boundaryResponse,
        offTopic: true,
        testMode: chatId.startsWith('test-')
      });
    }
    
    console.log('✅ Question is on-topic - proceeding with full response');

    // Generate response using Claude with Brandon Eats agent configuration
    console.log('Generating response with Claude using Brandon Eats agent...');
    let response;
    
    if (conversation.length > 1) {
      // Use chat with history
      response = await claudeService.chatWithBaseFile(conversation, {
        ...brandonEatsAgent.generationOptions,
        systemPrompt: brandonEatsAgent.systemPrompt
      });
    } else {
      // First message - use generateWithBaseFile
      response = await claudeService.generateWithBaseFile(
        userMessage,
        {
          ...brandonEatsAgent.generationOptions,
          systemPrompt: brandonEatsAgent.systemPrompt
        }
      );
    }

    console.log('Generated response:', response.substring(0, 200) + '...');

    // Send response back to A1Zap (skip for test chats)
    let sendResult = null;
    if (!chatId.startsWith('test-')) {
      try {
        sendResult = await brandonEatsClient.sendMessage(chatId, response);
      } catch (sendError) {
        console.error('Failed to send message to A1Zap:', sendError.message);
        // Don't fail the request if sending fails
      }
    } else {
      console.log('⚠️  Test mode: Skipping A1Zap send');
    }

    // ============================================================================
    // STEP 2: SMART SOCIAL MEDIA LINK FILTERING
    // ============================================================================
    // After generating a response, we intelligently determine if social media links
    // should be sent as a follow-up message. This is a two-stage process:
    //
    // Stage 2A (here): Check if the response discusses specific restaurants/places
    //   - Prevents sending links for generic responses like "I can help with that!"
    //   - Prevents links for clarification questions or greetings
    //   - Only proceeds if specific places are actually mentioned
    //
    // Stage 2B (in social-link-extractor.js): Match mentioned restaurants to CSV data
    //   - Uses AI to detect which restaurants from the CSV are discussed
    //   - Only includes restaurants that are key subjects of the response
    //   - Ignores passing mentions or generic statements
    //
    // Benefits:
    // - Users only get relevant social links when specific places are recommended
    // - Reduces noise and improves user experience
    // - Saves API costs on social link extraction for generic responses
    // ============================================================================
    
    // Extract and send relevant social media links as a follow-up message
    if (!chatId.startsWith('test-')) {
      try {
        console.log('🔍 Checking if response discusses specific restaurants...');
        
        // Stage 2A: Pre-check - Does this response actually discuss specific restaurants/places?
        const restaurantCheckPrompt = `Analyze this response and determine if it discusses specific restaurant names or place names.

Response: "${response}"

Does this response mention or discuss specific restaurants, cafes, or food places by name?
Answer ONLY "YES" or "NO".

YES = response talks about specific named restaurants/places
NO = response is generic, just a greeting, clarification, or doesn't mention specific places

Answer:`;

        const restaurantCheck = await claudeService.generateText(restaurantCheckPrompt, {
          temperature: 0.1,
          maxTokens: 10
        });

        const hasSpecificRestaurants = restaurantCheck.trim().toUpperCase().includes('YES');
        
        if (!hasSpecificRestaurants) {
          console.log('ℹ️  Response does not discuss specific restaurants - skipping social links');
        } else {
          console.log('✅ Response discusses specific restaurants - checking for social links...');
          const relevantLinks = await socialLinkExtractor.extractRelevantSocialLinks(response);

          if (relevantLinks && relevantLinks.length > 0) {
          console.log(`📹 Found ${relevantLinks.length} relevant TikTok links, sending follow-up message...`);
          
          // Create rich content blocks for each link
          const richContentBlocks = relevantLinks.map((link, index) => ({
            type: 'social_share',
            data: {
              platform: 'tiktok',
              url: link.url
            },
            order: index
          }));

          // Send follow-up message with social embeds
          const socialMessage = relevantLinks.length === 1
            ? `🎥 Here's a video about ${relevantLinks[0].name}!`
            : `🎥 Here are ${relevantLinks.length} videos about these places!`;

          await brandonEatsClient.sendMessage(
            chatId,
            socialMessage,
            richContentBlocks
          );

          console.log('✅ Social media links sent successfully');
          } else {
            console.log('ℹ️  No relevant social media links found for this response');
          }
        }
      } catch (socialError) {
        console.error('❌ Error sending social media links:', socialError.message);
        // Don't fail the main request if social links fail
      }
    }

    // Return success
    res.json({
      success: true,
      agent: brandonEatsAgent.name,
      response: response,
      baseFile: baseFileId ? fileRegistry.getFileById(baseFileId)?.filename : null,
      testMode: chatId.startsWith('test-'),
      metadata: brandonEatsAgent.metadata
    });

  } catch (error) {
    console.error('\n=== Brandon Eats Webhook Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      agent: brandonEatsAgent.name
    });
  }
}

module.exports = brandonEatsWebhookHandler;

