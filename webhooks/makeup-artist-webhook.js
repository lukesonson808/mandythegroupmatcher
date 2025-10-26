const geminiService = require('../services/gemini-service');
const a1zapClient = require('../services/a1zap-client');
const imageStorage = require('../services/image-storage');
const makeupArtistAgent = require('../agents/makeup-artist-agent');
const webhookHelpers = require('../services/webhook-helpers');
const config = require('../config');

/**
 * Makeup Artist webhook handler with multi-turn image editing support
 * Uses Gemini's image generation (Nano Banana) to apply cosmetic changes
 */
async function makeupArtistWebhookHandler(req, res) {
  try {
    console.log('\n=== Makeup Artist Webhook Received ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Extract webhook data
    const { chat, message, agent } = req.body;

    // Basic validation
    if (!chat?.id) {
      return res.status(400).json({
        success: false,
        error: 'Missing chat.id in webhook payload'
      });
    }

    const chatId = chat.id;
    const agentId = agent?.id;
    const messageId = message?.id;
    const userMessage = message?.content || '';
    const imageUrl = message?.media?.url || null;

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

    console.log(`Processing makeup request from chat ${chatId}`);
    console.log(`User message: "${userMessage}"`);
    console.log(`Image URL: ${imageUrl || 'No image provided'}`);

    // Fetch conversation history with image tracking enabled
    const conversation = await webhookHelpers.fetchAndProcessHistory(
      a1zapClient,
      chatId,
      agentId,
      20,  // Last 20 messages for context
      true // Include image URLs in history
    );

    console.log(`Conversation history: ${conversation.length} messages`);

    // If no image in current message, look for recent images in history
    let effectiveImageUrl = imageUrl;
    if (!effectiveImageUrl) {
      effectiveImageUrl = webhookHelpers.findRecentImage(conversation, 5);
      if (effectiveImageUrl) {
        console.log(`📸 No image in current message - using recent image from history`);
      }
    }

    // Extract previous makeup request for context
    const previousRequest = webhookHelpers.extractPreviousMakeupRequest(conversation, 10);
    if (previousRequest) {
      console.log(`💄 Previous makeup request found: "${previousRequest}"`);
    }

    // Check if we have an image to work with (current or from history)
    if (effectiveImageUrl) {
      // IMAGE MODE: Generate edited image using Gemini
      console.log('Image available - generating edited image with Gemini...');
      
      const isFirstMessage = conversation.length === 0;
      
      // Build prompt with context awareness
      let prompt;
      if (!imageUrl && effectiveImageUrl && previousRequest) {
        // User is referring to a previous image and previous makeup style
        prompt = `${previousRequest}\n\nApply this makeup style to the image. Keep your response brief.`;
        console.log('📝 Using previous makeup request as context (no new image)');
      } else {
        prompt = makeupArtistAgent.buildPrompt(userMessage, conversation, isFirstMessage);
      }
      
      console.log('Generated prompt for image editing:');
      console.log('---');
      console.log(prompt);
      console.log('---');

      const result = await geminiService.generateEditedImage(
        effectiveImageUrl,
        prompt,
        makeupArtistAgent.generationOptions
      );

      console.log('Generated response:', {
        hasText: !!result.text,
        hasImage: !!result.imageData,
        imageSize: result.imageData ? `${result.imageData.length} chars` : 'N/A'
      });

      // Prepare response text
      let responseText = result.text || "I've applied your requested makeup changes! ✨";

      // If image was generated, save it and send as media message
      if (result.imageData) {
      try {
        // Save base64 image to disk
        const filename = await imageStorage.saveBase64Image(
          result.imageData,
          result.mimeType,
          'makeup'
        );

        // Generate public URL
        const baseUrl = config.server.baseUrl || `http://localhost:${config.server.port}`;
        const imagePublicUrl = imageStorage.generatePublicUrl(filename, baseUrl);

        console.log(`📸 Image saved and available at: ${imagePublicUrl}`);

        // Get image dimensions for proper display in WhatsApp
        const dimensions = imageStorage.getImageDimensions(filename);
        if (dimensions) {
          console.log(`📐 Image dimensions: ${dimensions.width}x${dimensions.height}`);
        }

        // Send text + image to A1Zap
        console.log(`Preparing to send image message...`);
        console.log(`  Chat ID: ${chatId}`);
        console.log(`  Test mode: ${webhookHelpers.isTestChat(chatId)}`);
        console.log(`  Image URL: ${imagePublicUrl}`);
        console.log(`  Message text: ${responseText.substring(0, 100)}...`);
        
        if (!webhookHelpers.isTestChat(chatId)) {
          console.log('🚀 Sending media message to A1Zap API...');
          
          // Build options with dimensions for proper A1Zap image handling
          const mediaOptions = {
            contentType: result.mimeType || 'image/png'
          };
          
          if (dimensions) {
            mediaOptions.width = dimensions.width;
            mediaOptions.height = dimensions.height;
          }
          
          const sendResult = await a1zapClient.sendMediaMessage(
            chatId, 
            responseText, 
            imagePublicUrl,
            mediaOptions
          );
          console.log('✅ Media message sent successfully');
          console.log('API Response:', JSON.stringify(sendResult, null, 2));
        } else {
          console.log('⚠️  Test mode: Skipping A1Zap send');
        }

        // Return success with image info
        return res.json({
          success: true,
          agent: makeupArtistAgent.name,
          response: responseText,
          imageUrl: imagePublicUrl,
          testMode: webhookHelpers.isTestChat(chatId)
        });

      } catch (imageError) {
        console.error('❌ Error saving/sending image:', imageError);
        
        // Fall back to text-only response
        responseText += '\n\n(Note: There was an issue processing the generated image)';
        await webhookHelpers.sendResponse(a1zapClient, chatId, responseText);
        
        return res.json({
          success: true,
          agent: makeupArtistAgent.name,
          response: responseText,
          warning: 'Image generation succeeded but image delivery failed',
          testMode: webhookHelpers.isTestChat(chatId)
        });
      }
    } else {
      // No image generated in result - send text-only response
      console.log('⚠️  No image generated in API response');
      
      await webhookHelpers.sendResponse(a1zapClient, chatId, responseText);

      return res.json({
        success: true,
        agent: makeupArtistAgent.name,
        response: responseText,
        testMode: webhookHelpers.isTestChat(chatId)
      });
    }
    
    } else {
      // TEXT MODE: No image available (current or history) - use AI to respond conversationally
      console.log('No image detected - using conversational AI response...');
      
      // Build message history for Gemini chat
      const messages = conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      // Check if there are ANY images in recent history
      const hasRecentImages = conversation.some(msg => 
        msg.role === 'user' && msg.imageUrl
      );

      // Enhanced system instruction if images were in history
      let systemInstruction = makeupArtistAgent.systemPrompt;
      if (hasRecentImages) {
        systemInstruction += `\n\nIMPORTANT: The user has shared images in this conversation, but the current message doesn't have an image. If they're asking you to apply makeup or make changes, politely let them know you need them to share the specific image they want you to work on.`;
      }

      // Generate conversational response using Gemini
      const responseText = await geminiService.chat(messages, {
        systemInstruction: systemInstruction,
        temperature: makeupArtistAgent.generationOptions.temperature,
        maxOutputTokens: makeupArtistAgent.generationOptions.maxOutputTokens,
        model: 'gemini-2.0-flash-exp' // Use flash model for text conversations
      });

      console.log('AI response generated:', responseText.substring(0, 100) + '...');

      // Send text response
      await webhookHelpers.sendResponse(a1zapClient, chatId, responseText);

      return res.json({
        success: true,
        agent: makeupArtistAgent.name,
        response: responseText,
        mode: 'text-conversation',
        testMode: webhookHelpers.isTestChat(chatId)
      });
    }

  } catch (error) {
    console.error('\n=== Makeup Artist Webhook Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Try to send error message to user
    try {
      const chatId = req.body?.chat?.id;
      if (chatId && !webhookHelpers.isTestChat(chatId)) {
        await a1zapClient.sendMessage(
          chatId,
          "I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists."
        );
      }
    } catch (sendError) {
      console.error('Failed to send error message to user:', sendError.message);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = makeupArtistWebhookHandler;

