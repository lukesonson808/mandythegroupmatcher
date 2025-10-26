const claudeService = require('../services/claude-service');
const brandonEatsClient = require('../services/brandoneats-client');
const brandonEatsAgent = require('../agents/brandoneats-agent');
const fileRegistry = require('../services/file-registry');
const socialLinkExtractor = require('../services/social-link-extractor');
const webhookHelpers = require('../services/webhook-helpers');

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

    // Validate webhook payload
    const validation = webhookHelpers.validateWebhookPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { chatId, agentId, messageId, userMessage, message } = validation.data;
    
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
      
      const socialLinks = [
        { platform: 'instagram', url: 'https://www.instagram.com/reel/DQI4QE8jHiL/' },
        { platform: 'tiktok', url: 'https://www.tiktok.com/@brandneweats/video/7546112444503035144' },
        { platform: 'youtube', url: 'https://www.youtube.com/shorts/ToobPQS6_ZI' }
      ];
      
      const richContentBlocks = webhookHelpers.createSocialShareBlocks(socialLinks);

      // Send rich content message
      const sendResult = await webhookHelpers.sendResponse(
        brandonEatsClient,
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

    // Fetch and process message history (last 10 messages for context)
    const conversation = await webhookHelpers.fetchAndProcessHistory(
      brandonEatsClient,
      chatId,
      agentId,
      10
    );

    // Add the current message to conversation
    conversation.push({ role: 'user', content: String(userMessage) });

    // ============================================================================
    // STEP 1: OFF-TOPIC QUESTION TRIAGE (TEMPORARILY DISABLED)
    // ============================================================================
    // Triage has been temporarily disabled - always respond with CSV data
    // ============================================================================
    console.log('ℹ️  Triage disabled - proceeding with full response for all questions');

    // Generate response using Claude with Brandon Eats agent configuration
    console.log('Generating response with Claude using Brandon Eats agent...');
    let response;
    
    if (conversation.length > 1) {
      // Use chat with history
      response = await claudeService.chatWithBaseFile(conversation, {
        ...brandonEatsAgent.generationOptions,
        systemPrompt: brandonEatsAgent.systemPrompt,
        agentName: 'brandoneats'
      });
    } else {
      // First message - use generateWithBaseFile
      response = await claudeService.generateWithBaseFile(
        userMessage,
        {
          ...brandonEatsAgent.generationOptions,
          systemPrompt: brandonEatsAgent.systemPrompt,
          agentName: 'brandoneats'
        }
      );
    }

    console.log('Generated response:', response.substring(0, 200) + '...');

    // Send response back to A1Zap (skip for test chats)
    const sendResult = await webhookHelpers.sendResponse(brandonEatsClient, chatId, response);

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
    if (!webhookHelpers.isTestChat(chatId)) {
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
            
            // Check if this is an alternative suggestion (has contextMessage)
            const isAlternativeSuggestion = relevantLinks[0]?.contextMessage;
            
            // Create rich content blocks for TikTok links
            const richContentBlocks = webhookHelpers.createSocialShareBlocks(relevantLinks, 'tiktok');

            // Send follow-up message with social embeds
            let socialMessage;
            if (isAlternativeSuggestion) {
              // Use the context message to explain why we're showing alternatives
              const contextMsg = relevantLinks[0].contextMessage;
              socialMessage = relevantLinks.length === 1
                ? `💡 ${contextMsg}\n\n🎥 Check out ${relevantLinks[0].name}:`
                : `💡 ${contextMsg}\n\n🎥 Here are ${relevantLinks.length} videos:`;
            } else {
              // Standard message for direct matches
              socialMessage = relevantLinks.length === 1
                ? `🎥 Here's a video about ${relevantLinks[0].name}!`
                : `🎥 Here are ${relevantLinks.length} videos about these places!`;
            }

            await webhookHelpers.sendResponse(
              brandonEatsClient,
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
      testMode: webhookHelpers.isTestChat(chatId),
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

