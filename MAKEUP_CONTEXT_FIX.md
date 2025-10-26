# Makeup Artist Agent - Context Handling Fix

## Problem

The makeup artist agent was not properly considering conversation history when generating images. This led to scenarios where:

1. User would request a makeup style in text (e.g., "Can you give me full glam")
2. Agent would respond conversationally but not generate an image
3. User would upload an image (expecting the "full glam" to be applied)
4. Agent would generate an image without any makeup because it didn't consider the previous request

**Example conversation flow with the bug:**

```
User: [sends image]
Agent: I've applied your requested makeup changes! ✨ [but no request was made]

User: Can you give me full glam
Agent: [responds with text describing what they'll do]

User: yep
Agent: [still just text response]

User: [sends another image]
Agent: I've applied your requested makeup changes! ✨ [but still ignoring the "full glam" request]
```

## Root Cause

The `buildPrompt` function in `agents/makeup-artist-agent.js` was only using the current message text and not considering the conversation history. When a user uploaded an image without accompanying text (or with minimal text like "yep"), the prompt sent to Gemini was essentially empty or didn't include the makeup style they had requested in previous messages.

## Solution

### 1. Updated `buildPrompt` Function

Modified the `buildPrompt` function to accept and analyze conversation history:

```javascript
buildPrompt: (userMessage, conversation = [], isFirstMessage = false) => {
  // Extract makeup-related context from conversation history
  let context = '';
  
  if (!isFirstMessage && conversation.length > 0) {
    // Look for recent makeup requests in the last few messages
    const recentMessages = conversation.slice(-6); // Last 6 messages
    const makeupRequests = recentMessages
      .filter(msg => msg.role === 'user' && msg.content.trim())
      .map(msg => msg.content.trim())
      .filter(content => {
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
               content.length > 10; // Include substantial messages
      });
    
    if (makeupRequests.length > 0) {
      context = `Previous request context: ${makeupRequests.join(' → ')}\n\n`;
    }
  }
  
  // If user message is empty or very short, but we have context
  const hasSubstantialMessage = userMessage && userMessage.trim().length > 3;
  
  if (!hasSubstantialMessage && context) {
    return `${context}Apply the makeup changes described in the previous conversation to this new image. Keep your text response brief and friendly - describe what you've done in 1-2 sentences.`;
  }
  
  // ... rest of prompt building logic
}
```

**Key improvements:**

- Analyzes the last 6 messages in the conversation
- Filters for makeup-related keywords (glam, smokey, lipstick, etc.)
- Includes substantial messages (>10 characters) even without keywords
- Builds a context string with the chain of requests
- Uses context when the current message is empty or minimal

### 2. Updated Webhook Handler

Modified `webhooks/makeup-artist-webhook.js` to pass conversation history to `buildPrompt`:

```javascript
const prompt = makeupArtistAgent.buildPrompt(userMessage, conversation, isFirstMessage);
```

### 3. Added Logging

Added console logging to see the generated prompt for debugging:

```javascript
console.log('Generated prompt for image editing:');
console.log('---');
console.log(prompt);
console.log('---');
```

## Testing

Created a comprehensive test suite in `tests/test-makeup-context.js` that:

1. Tests prompt building with various conversation contexts
2. Simulates the exact multi-turn scenario that was failing:
   - User sends image without request
   - User requests "full glam"
   - User confirms with "yep"
   - User sends another image (should apply full glam)
3. Verifies that images are generated with proper context

### Running the Tests

```bash
# Test prompt building logic
node tests/test-makeup-context.js

# Test with actual webhook (requires server running)
npm start &
sleep 5
node tests/test-makeup-context.js
```

## Example Fixed Conversation Flow

```
User: [sends image]
Agent: I've applied your requested makeup changes! ✨
[generates image with basic enhancement since no specific request]

User: Can you give me full glam
Agent: Absolutely! I'm thinking a bold, glamorous look would be stunning on you...
[describes what they'll do]

User: yep
Agent: [confirms and describes the look]

User: [sends another image]
Agent: Here's your full glam makeover! ✨
[generates image WITH "full glam" applied because context is preserved]
```

## Technical Details

### Context Extraction Keywords

The system looks for these makeup-related terms:
- makeup, lipstick, eye, glam, natural, dramatic
- contour, highlight, blush, foundation
- Any message longer than 10 characters (to catch specific requests)

### Context Window

- Analyzes the last 6 messages (3 back-and-forth exchanges)
- Includes only user messages for context building
- Chains multiple requests with " → " separator

### Fallback Behavior

If no context is found and no message is provided, the agent will still generate a response, but may ask for clarification or apply basic enhancements.

## Benefits

1. **Better User Experience**: Users can discuss what they want before uploading
2. **Natural Conversation Flow**: Supports iterative refinement
3. **Flexible Interaction**: Works with images + text, text then images, or mixed approaches
4. **Context Preservation**: Remembers requests across multiple messages

## Future Enhancements

Potential improvements for even better context handling:

1. **Assistant Message Analysis**: Include AI's own responses in context to understand what was previously applied
2. **Image Reference Memory**: Track which images had which styles applied
3. **Style Preferences**: Learn user's preferred styles over time
4. **Conflict Resolution**: Handle contradictory requests intelligently
5. **Multi-Image Context**: Apply consistent style across multiple images in one conversation

