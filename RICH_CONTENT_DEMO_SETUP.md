# Rich Content Demo Agent - Quick Setup Guide

## What Was Built

A **non-AI showcase agent** that demonstrates all 18 rich content types available in the A1Zap platform through simple text commands.

## Quick Start

### 1. Add Environment Variables

Add to your `.env` file:

```bash
RICH_CONTENT_DEMO_API_KEY=your_api_key_here
RICH_CONTENT_DEMO_AGENT_ID=your_agent_id_here
```

### 2. Start Server

```bash
npm start
```

### 3. Test It

Send a message to the agent:
- `carousel` → See a product carousel
- `poll` → See a voting poll
- `form` → See a contact form
- `help` → See all commands
- `all` → See multiple examples

## What It Does

✅ **First message**: Lists all 18 available commands  
✅ **User types command**: Gets a filled example of that content type  
✅ **No AI**: Instant responses with hardcoded examples  
✅ **All 18 types**: Carousel, gallery, buttons, polls, forms, cards, etc.

## Example Commands

```
User: carousel
Bot: 🎠 Here's a Carousel example - swipe through these featured products:
[Shows 5 product carousel]

User: poll  
Bot: 📊 Here's a Poll example - vote for your favorite:
[Shows voting poll with 5 options]

User: all
Bot: 🎨 Sending multiple examples! Check them out:
[Sends 5 different examples in sequence]
```

## Files Created/Modified

**New Files:**
- `agents/rich-content-demo-agent.js` - Agent configuration
- `webhooks/rich-content-demo-webhook.js` - Webhook with all 18 examples
- `docs/RICH_CONTENT_DEMO_AGENT.md` - Full documentation

**Modified Files:**
- `config.js` - Added richContentDemo configuration
- `server.js` - Registered agent and webhook route

## Webhook Endpoint

```
POST http://localhost:3000/webhook/rich-content-demo
```

## All 18 Content Types

**Visual & Media:**
- carousel, gallery, social_share, social_profile

**Interactive:**
- button_card, quick_replies, poll, form_card

**Information:**
- profile_card, product_card, event_card, location_card, contact_card, link_preview

**Workflow:**
- task_card, project_card, reminder_card, workflow_status

## Next Steps

1. Configure your A1Zap webhook URL to point to `/webhook/rich-content-demo`
2. Start a chat and try different commands
3. Use this agent to test rich content rendering
4. Reference the examples when building your own agents

## Full Documentation

See [`docs/RICH_CONTENT_DEMO_AGENT.md`](./docs/RICH_CONTENT_DEMO_AGENT.md) for complete details.

---

**Ready to use!** 🚀 Just add your API credentials and start testing rich content types.

