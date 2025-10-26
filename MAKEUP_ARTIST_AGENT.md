# Makeup Artist Agent 💄

A multi-turn conversational AI agent that applies cosmetic changes to images using Gemini's image generation capabilities (Nano Banana).

## Overview

The Makeup Artist Agent allows users to upload images and request makeup changes through natural conversation. The agent supports iterative refinement, meaning users can progressively adjust and perfect their look over multiple turns.

## Features

- **Image Editing with Gemini**: Uses Gemini 2.5 Flash Image (`gemini-2.5-flash-image`) for high-quality makeup application
- **Multi-turn Conversations**: Refine your look iteratively ("now make it darker", "add more blush")
- **Natural Language Requests**: Describe changes naturally ("add red lipstick", "give me a smokey eye")
- **Professional Guidance**: Agent provides examples and helpful suggestions
- **Automatic Image Storage**: Generated images are saved and served automatically

## Supported Makeup Changes

The agent can apply various cosmetic changes:

### Face
- Foundation and skin tone adjustments
- Contouring and highlighting
- Blush and bronzer
- Skin brightening and evening

### Eyes
- Eyeshadow (various colors and styles)
- Eyeliner (subtle, winged, dramatic)
- Mascara
- Smokey eye looks
- Natural or dramatic styles

### Lips
- Lipstick in any color (red, pink, nude, berry, coral, mauve, etc.)
- Lip liner
- Gloss or matte finishes

### Eyebrows
- Shaping
- Filling
- Defining
- Color adjustments

### Complete Looks
- Natural everyday makeup
- Glamorous evening looks
- Dramatic editorial styles
- Stage makeup

## How to Use

### 1. Setup

Ensure you have the Gemini API key configured:

```bash
export GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Configure Webhook in A1Zap

Set up a webhook in your A1Zap agent configuration:

```
Webhook URL: https://your-server.com/webhook/makeup-artist
Method: POST
```

### 3. Start a Conversation

Upload an image and send a message describing the makeup changes you want:

**Example Requests:**
- "Add red lipstick"
- "Give me a natural everyday makeup look"
- "Create a smokey eye with nude lips"
- "Make my skin look more radiant with some highlighter"
- "Add some blush and make my lips a soft pink"

### 4. Refine Your Look

Continue the conversation to make adjustments:

- "Make the lipstick darker"
- "Add some eyeliner"
- "Can you make the blush more subtle?"
- "Now add some mascara"

## Multi-turn Conversation Example

```
User: [uploads image] "Give me a natural makeup look"
Agent: "I've applied a natural makeup look with neutral eyeshadow, 
        subtle blush, and nude lipstick! ✨" [returns edited image]

User: "Make the lips a bit more pink"
Agent: "I've enhanced the lip color to a soft pink! ✨" [returns edited image]

User: "Can you add some mascara and a bit of eyeliner?"
Agent: "Added mascara and subtle eyeliner for definition! ✨" [returns edited image]
```

## Technical Details

### Webhook Endpoint
```
POST /webhook/makeup-artist
```

### Request Format
```json
{
  "chat": {
    "id": "chat_id_here"
  },
  "message": {
    "id": "message_id_here",
    "content": "Add red lipstick",
    "media": {
      "url": "https://example.com/image.jpg"
    }
  },
  "agent": {
    "id": "agent_id_here"
  }
}
```

### Response Format
```json
{
  "success": true,
  "agent": "Makeup Artist",
  "response": "I've applied red lipstick to your photo! ✨",
  "imageUrl": "https://your-server.com/temp-images/makeup_1234567890_abc123.png",
  "testMode": false
}
```

### Image Storage

Generated images are:
- Saved to `/temp-images` directory
- Served via static endpoint: `GET /temp-images/:filename`
- Automatically cleaned up after 24 hours (configurable)

### Configuration

**Agent Configuration**: `agents/makeup-artist-agent.js`
- System prompt
- Generation options
- Temperature: 0.7 (balanced creativity)
- Max tokens: 300 (concise responses)

**Gemini Model**: `gemini-2.5-flash-image`

## Files Structure

```
├── agents/
│   └── makeup-artist-agent.js     # Agent configuration
├── webhooks/
│   └── makeup-artist-webhook.js   # Webhook handler
├── services/
│   ├── gemini-service.js          # Enhanced with image generation
│   └── image-storage.js           # Image storage utilities
├── temp-images/                    # Generated images storage
└── server.js                       # Registered webhook endpoint
```

## Conversation History

The agent maintains conversation history for multi-turn interactions:
- Fetches last 10 messages from chat history
- Processes both user and agent messages
- Uses context for better understanding of iterative requests

## Error Handling

The agent handles various error scenarios:
- Missing image URL (prompts user to upload)
- Image generation failures (sends text-only response)
- Storage errors (graceful fallback)
- Duplicate message detection (prevents double processing)

## Testing

You can test the agent locally:

1. Start the server:
```bash
npm start
```

2. Send a test webhook:
```bash
curl -X POST http://localhost:3000/webhook/makeup-artist \
  -H "Content-Type: application/json" \
  -d '{
    "chat": {"id": "test-chat-123"},
    "message": {
      "id": "test-msg-123",
      "content": "Add red lipstick",
      "media": {"url": "https://example.com/image.jpg"}
    },
    "agent": {"id": "test-agent"}
  }'
```

## Tips for Best Results

1. **Be Specific**: Instead of "make me pretty", try "add pink lipstick and subtle eyeshadow"
2. **Use Clear Images**: Upload well-lit photos facing forward
3. **Iterate Gradually**: Make small changes and refine progressively
4. **Ask for Examples**: The agent can suggest makeup styles if you're unsure

## Troubleshooting

**No image generated?**
- Ensure you uploaded an image with your request
- Check that the image URL is accessible
- Verify Gemini API key is configured

**Image generation slow?**
- Image generation takes 5-15 seconds
- Larger/complex requests may take longer

**Error messages?**
- Check server logs for detailed error information
- Verify all environment variables are set
- Ensure temp-images directory exists and is writable

## Future Enhancements

Potential improvements:
- Style presets (natural, glamorous, dramatic)
- Before/after comparison view
- Makeup product recommendations
- Color palette extraction from images
- Virtual try-on for specific brands

## Related Documentation

- [Agent Personality Guide](AGENT_PERSONALITY_GUIDE.md) - Customize agent behavior
- [Rich Content Guide](RICH_CONTENT_GUIDE.md) - Add rich media
- [Setup Guide](SETUP.md) - Initial configuration

## API Reference

For Gemini image generation documentation:
https://ai.google.dev/gemini-api/docs/image-generation

---

**Note**: This agent uses Gemini's "Nano Banana" image generation feature, which is optimized for conversational, multi-turn image editing with natural language prompts.

