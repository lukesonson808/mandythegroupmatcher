# Rich Content Demo Agent

A non-AI agent that showcases all 18 rich content types available in the A1Zap platform through simple text commands.

## Overview

The Rich Content Demo Agent is a special showcase agent that responds to user commands with filled, realistic examples of each rich content type. Unlike other agents in the system, it doesn't use AI - it simply matches keywords and returns pre-configured examples.

## Features

- ✅ All 18 rich content types supported
- ✅ Realistic, production-ready examples
- ✅ Simple command-based interface
- ✅ No AI overhead - instant responses
- ✅ Great for testing and demonstrations

## Setup

### 1. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Rich Content Demo Agent
RICH_CONTENT_DEMO_API_KEY=your_api_key_here
RICH_CONTENT_DEMO_AGENT_ID=your_agent_id_here
```

Or use the shared A1Zap credentials:
```bash
# The agent will fallback to A1ZAP_API_KEY if not specified
A1ZAP_API_KEY=your_api_key_here
RICH_CONTENT_DEMO_AGENT_ID=your_agent_id_here
```

### 2. Start the Server

```bash
npm start
```

The agent will be available at:
```
POST http://localhost:3000/webhook/rich-content-demo
```

### 3. Configure Webhook in A1Zap

1. Go to your A1Zap dashboard
2. Create a new agent or use existing agent ID
3. Set webhook URL to: `https://your-domain.com/webhook/rich-content-demo`
4. Save and test

## Usage

### Welcome Message

When a chat starts, the agent automatically sends a welcome message listing all available commands.

### Available Commands

#### Visual & Media
- `carousel` - Swipeable image carousel with 5 product examples
- `gallery` - Photo grid with 6 images
- `social_share` - TikTok video embed example
- `social_profile` - Instagram creator profile

#### Interactive Elements
- `button_card` or `buttons` - Card with multiple action buttons
- `quick_replies` or `quick` - Fast-tap response buttons
- `poll` - Voting poll with 5 options
- `form_card` or `form` - Contact form with multiple field types

#### Information Cards
- `profile_card` or `profile` - Person profile card
- `product_card` or `product` - E-commerce product with price
- `event_card` or `event` - Conference event card
- `location_card` or `location` - Business location with map
- `contact_card` or `contact` - Business card with phone/email
- `link_preview` or `link` - Article preview with OG data

#### Workflow & Tasks
- `task_card` or `task` - Task with status and priority
- `project_card` or `project` - Project with progress bar
- `reminder_card` or `reminder` - Scheduled reminder
- `workflow_status` or `workflow` - Pipeline execution status

#### Special Commands
- `help` - Show command list again
- `all` - Send multiple examples in sequence

### Example Interaction

```
User: carousel
Bot: 🎠 Here's a Carousel example - swipe through these featured products:
[Displays carousel with 5 products]

User: poll
Bot: 📊 Here's a Poll example - vote for your favorite:
[Displays poll with 5 options]

User: all
Bot: 🎨 Sending multiple examples! Check them out:
[Sends carousel, then gallery, then buttons, then quick replies, then poll, then product card]
```

## Architecture

### Files Created

1. **`agents/rich-content-demo-agent.js`**
   - Agent configuration extending `BaseAgent`
   - Welcome message with command list
   - Non-AI agent (doesn't use Claude/Gemini)

2. **`webhooks/rich-content-demo-webhook.js`**
   - Webhook handler extending `BaseWebhook`
   - Command matching logic
   - 18 example generation methods
   - Multi-example sending for 'all' command

3. **`config.js`** (modified)
   - Added `richContentDemo` agent configuration

4. **`server.js`** (modified)
   - Registered agent in registry
   - Added webhook route `/webhook/rich-content-demo`
   - Updated endpoint documentation

### Design Decisions

**Why no AI?**
- Instant responses (no API calls)
- Consistent examples for testing
- Lower costs
- Demonstrates rich content without complexity

**Why keyword matching?**
- Simple and reliable
- Easy to maintain
- Perfect for demo/showcase use case
- Users can see exact command → result mapping

**Example data sources:**
- Unsplash for images (public, high-quality)
- Realistic product names and prices
- Diverse industries (tech, food, travel, finance)
- Complete data (all optional fields included)

## Testing

### Manual Testing

1. Start a chat with the agent
2. Try each command individually:
   ```
   carousel
   gallery
   poll
   form
   task
   ```

3. Test special commands:
   ```
   help
   all
   ```

4. Test variations:
   ```
   button card
   quick replies
   social share
   ```

### What to Verify

- ✅ Welcome message displays on chat start
- ✅ All 18 commands work
- ✅ Rich content renders correctly
- ✅ Images load (Unsplash URLs)
- ✅ Buttons are clickable
- ✅ Unknown commands show help message
- ✅ 'all' command sends multiple examples
- ✅ Test mode is respected (no actual sends)

## Customization

### Adding New Examples

Edit `webhooks/rich-content-demo-webhook.js` and modify the example methods:

```javascript
getCarouselExample() {
  return [{
    type: 'carousel',
    data: {
      items: [
        {
          imageUrl: 'your-image-url',
          title: 'Your Title',
          // ... customize fields
        }
      ]
    }
  }];
}
```

### Changing Command Keywords

Modify the `switch` statement in `processRequest()`:

```javascript
case 'your-command':
case 'your-alias':
  richContentBlocks = this.getYourExample();
  response = 'Your response text';
  break;
```

### Adjusting Welcome Message

Edit `agents/rich-content-demo-agent.js` in the `getWelcomeMessage()` method.

## Troubleshooting

### Agent not responding
- Check environment variables are set
- Verify webhook URL is correct in A1Zap
- Check server logs for errors
- Ensure agent is registered in `server.js`

### Rich content not displaying
- Verify image URLs are accessible (Unsplash)
- Check A1Zap platform supports the content type
- Review validation errors in response
- Test with simpler content types first

### Gallery images not showing
- Gallery requires pre-uploaded mediaIds
- Use external imageUrls instead or upload media first
- See `AI_AGENT_RICH_MESSAGING_GUIDE.md` for details

### Commands not working
- Commands are case-insensitive
- Try exact command names from list
- Type `help` to see available commands
- Check for typos in command

## Related Documentation

- [`AI_AGENT_RICH_MESSAGING_GUIDE.md`](./AI_AGENT_RICH_MESSAGING_GUIDE.md) - Complete rich content reference
- [`ARCHITECTURE_REFACTOR_RICH_CONTENT.md`](./ARCHITECTURE_REFACTOR_RICH_CONTENT.md) - Architecture details
- [A1Zap API Documentation](https://api.a1zap.com/docs) - Official API docs

## Future Enhancements

Potential improvements:
- Add more example variations per type
- Support for requesting specific industries (tech, food, etc.)
- Ability to customize examples via query parameters
- Analytics on most-requested content types
- Side-by-side comparison mode
- Export examples as JSON

## Support

For issues or questions:
1. Check server logs for errors
2. Review the rich messaging guide
3. Test with individual commands first
4. Verify environment configuration

---

**Created:** 2025-01-31  
**Version:** 1.0.0  
**Status:** Production Ready ✅

