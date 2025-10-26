/**
 * Makeup Artist Agent Configuration
 * Uses Gemini's image generation (Nano Banana) to apply cosmetic changes to uploaded images
 * Supports multi-turn conversations for iterative refinement
 */

module.exports = {
  name: 'Makeup Artist',
  role: 'Professional Makeup Artist & Beauty Consultant',
  description: 'AI makeup artist that applies cosmetic changes to images using advanced image editing',

  // System prompt for makeup artistry
  systemPrompt: `You are a Professional Makeup Artist and Beauty Consultant with expertise in cosmetic application and enhancement.

Your Purpose:
- Help users enhance their photos with makeup and cosmetic changes
- Provide expert guidance on makeup styles, colors, and techniques
- Apply makeup edits to uploaded images with precision and artistry
- Support iterative refinement through conversation

Your Capabilities:
You can apply various makeup changes including:
- Lipstick (red, pink, nude, berry, coral, mauve, bold colors)
- Eye makeup (eyeshadow, eyeliner, mascara, smokey eyes, natural looks)
- Foundation and skin tone adjustments (evening skin tone, brightening, contouring)
- Blush and highlighter (subtle glow, dramatic contour)
- Eyebrows (shaping, filling, defining)
- Complete makeup looks (natural, glamorous, dramatic, editorial)

Communication Style:
- Friendly, professional, and encouraging
- Provide helpful suggestions when users are unsure
- Explain what changes you're making and why
- Ask clarifying questions if the request is unclear
- Offer complementary suggestions (e.g., "That lipstick would look great with some subtle eyeliner!")

Guidelines:
- Always be respectful and body-positive
- When you receive an image, analyze the current look and suggest enhancements
- For vague requests, suggest 2-3 specific options
- For multi-turn conversations, reference previous edits naturally
- Keep text responses concise - let the image do most of the talking!

Examples of requests you might receive:
- "Add red lipstick"
- "Give me a natural everyday makeup look"
- "Make the eye makeup more dramatic"
- "Can you add some highlighter and make my skin glow?"
- "Try a smokey eye with nude lips"

Remember: You're creating beautiful, confidence-boosting looks!`,

  // Generation options optimized for image editing
  generationOptions: {
    temperature: 0.7,    // Balanced creativity for makeup artistry
    maxOutputTokens: 300, // Concise responses
    topP: 0.95,
    model: 'gemini-2.5-flash-image' // Gemini's image generation model
  },

  // Helper function to build prompts with conversation context
  buildPrompt: (userMessage, conversation = [], isFirstMessage = false) => {
    // Normalize the user message - treat "[Image]" as empty since it's just a placeholder
    const normalizedMessage = userMessage && userMessage.trim() === '[Image]' ? '' : userMessage;
    
    // Extract makeup-related context from conversation history
    let context = '';
    let previousMakeupStyle = null;
    
    if (!isFirstMessage && conversation.length > 0) {
      // Look for recent makeup requests in the last few messages
      const recentMessages = conversation.slice(-10); // Last 10 messages
      const makeupRequests = recentMessages
        .filter(msg => msg.role === 'user' && msg.content.trim())
        .map(msg => msg.content.trim())
        .filter(content => {
          // Skip "[Image]" placeholder messages
          if (content === '[Image]') return false;
          
          // Filter for makeup-related requests
          const lowerContent = content.toLowerCase();
          return lowerContent.includes('makeup') || 
                 lowerContent.includes('lipstick') || 
                 lowerContent.includes('eye') || 
                 lowerContent.includes('glam') || 
                 lowerContent.includes('natural') || 
                 lowerContent.includes('dramatic') ||
                 lowerContent.includes('contour') ||
                 lowerContent.includes('highlight') ||
                 lowerContent.includes('blush') ||
                 lowerContent.includes('foundation') ||
                 lowerContent.includes('casino') ||
                 lowerContent.includes('royale') ||
                 lowerContent.includes('pink') ||
                 lowerContent.includes('blue') ||
                 lowerContent.includes('red') ||
                 lowerContent.includes('slim') ||
                 content.length > 15; // Include substantial messages
        });
      
      // Get the most recent substantive makeup request for reference
      if (makeupRequests.length > 0) {
        previousMakeupStyle = makeupRequests[makeupRequests.length - 1];
        context = `Previous request context: ${makeupRequests.join(' → ')}\n\n`;
      }
    }
    
    // Check if user is clearly referring to a previous style
    const lowerMessage = normalizedMessage ? normalizedMessage.toLowerCase() : '';
    const isReferencingPrevious = 
      lowerMessage.includes('apply it') ||
      lowerMessage.includes('same') ||
      lowerMessage.includes('this image too') ||
      lowerMessage.includes('do the same') ||
      lowerMessage.includes('like before') ||
      (lowerMessage === 'yes' && previousMakeupStyle);
    
    // If user message is empty or referencing previous, use context
    const hasSubstantialMessage = normalizedMessage && normalizedMessage.trim().length > 5;
    
    if ((!hasSubstantialMessage || isReferencingPrevious) && previousMakeupStyle) {
      return `Apply this makeup style: ${previousMakeupStyle}

Keep your text response brief and friendly - describe what you've done in 1-2 sentences.`;
    }
    
    if (isFirstMessage) {
      return `${normalizedMessage}

Please analyze the image and apply the requested makeup changes. Keep your text response brief and friendly - describe what you've done in 1-2 sentences.`;
    }
    
    return `${context}${normalizedMessage}

Apply this change to the image. Keep your response brief.`;
  }
};

