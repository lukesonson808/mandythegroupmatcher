# AI Agent System with File Context 🤖📁

Multi-model AI agent system with file-aware capabilities, powered by **Claude** and **Gemini**. Create intelligent agents that analyze documents, CSV data, and provide context-aware responses through A1Zap webhooks.

## 🚀 Quick Start

### 1. Get Your API Keys

**Claude API Key** (Required):
- Visit [Anthropic Console](https://console.anthropic.com/)
- Create an account and get your API key
- Required for file operations and document analysis

**A1Zap Credentials** (Required):
- Go to A1Zap app → Make → Agent API
- Create your agent → Copy your API Key and Agent ID

**Gemini API Key** (Required for Makeup Artist):
- Visit [Google AI Studio](https://aistudio.google.com/apikey)
- Required for makeup artist image generation
- Provides additional model flexibility

### 2. Deploy

#### Option A: Replit (Recommended)

1. Import this project to Replit
2. Add to Secrets (🔒 in sidebar):
```
CLAUDE_API_KEY=your_claude_key
A1ZAP_API_KEY=your_a1zap_key
A1ZAP_AGENT_ID=your_agent_id
BASE_URL=https://your-repl.repl.co
```
3. Click **Run**

#### Option B: Local Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
CLAUDE_API_KEY=your_claude_key
A1ZAP_API_KEY=your_a1zap_key
A1ZAP_AGENT_ID=your_agent_id
BASE_URL=http://localhost:3000
```

4. Start the server:
```bash
npm start
```

### 3. Upload a File

Upload a document for your agent to reference:

```bash
# Upload a file
npm run upload /path/to/your/file.csv

# Or use the sample
npm run upload files/brandoneats.csv
```

### 4. Configure A1Zap Webhook

In A1Zap app → Select your agent → Set webhook URL:
- For generic file operations: `https://your-server.com/webhook/claude`
- For Brandon Eats data: `https://your-server.com/webhook/brandoneats`
- For makeup artist (image generation): `https://your-server.com/webhook/makeup-artist`

### 5. Test It! 🎉

Start chatting with your agent - it will use uploaded files as context!

---

## 🎭 Customize Agent Personality

Edit the system prompt in your agent configuration file to change how your agent behaves:

```javascript
// agents/brandoneats-agent.js or agents/claude-docubot-agent.js
module.exports = {
  name: 'Your Agent Name',
  
  // 👇 EDIT THIS to customize personality, tone, and behavior
  systemPrompt: `You are a helpful assistant...
  
  Your capabilities:
  - Analyze data and provide insights
  - Answer questions based on uploaded files
  - Be friendly and professional
  
  Communication style:
  - Clear and concise
  - Use examples when helpful`,
  
  generationOptions: {
    temperature: 0.7,  // 0.0 = factual, 1.0 = creative
    maxTokens: 4096    // Response length
  }
};
```

**📖 See `AGENT_PERSONALITY_GUIDE.md` for detailed examples and instructions.**

---

## 📁 File Management

### Upload Files

```bash
# Upload and set as base file (used for all responses)
npm run upload /path/to/document.pdf
```

Or use the API:
```javascript
const { uploadFileToClaude } = require('./services/file-upload');

const result = await uploadFileToClaude('./document.pdf', {
  setAsBase: true
});
```

### Check Files

```bash
# Check current base file
curl http://localhost:3000/files/base

# List all uploaded files
curl http://localhost:3000/files/list
```

### Supported File Types
- PDF (`.pdf`)
- Text files (`.txt`)
- CSV (`.csv`)
- JSON (`.json`)
- Markdown (`.md`)
- HTML (`.html`)
- XML (`.xml`)

---

## 🎯 Three Specialized Agents

### 1. Generic File Agent (`/webhook/claude`)
General-purpose document-aware agent:
- Answer questions about uploaded documents
- Analyze PDFs, text files, CSV data
- Context-aware responses based on file content

**Agent Config:** `agents/claude-docubot-agent.js`

### 2. Brandon Eats Data Analyst (`/webhook/brandoneats`)
Specialized for restaurant/food data:
- CSV data parsing and analysis
- **Intelligent filtering system** - only sends relevant responses and social links
- **Alternative suggestions** - suggests related content when exact matches aren't available
- Social media link extraction (Instagram, TikTok, YouTube)
- Rich content responses with embedded media
- Custom prompts for food industry queries

**Agent Config:** `agents/brandoneats-agent.js`  
**📖 See `INTELLIGENT_FILTERING.md` for details on the smart triage and filtering system.**  
**📖 See `ALTERNATIVE_SUGGESTIONS.md` for details on contextual alternative suggestions.**

### 3. Makeup Artist 💄 (`/webhook/makeup-artist`)
AI makeup artist with image generation capabilities:
- Apply cosmetic changes to uploaded images using Gemini's image generation
- **Multi-turn conversations** - iteratively refine makeup looks ("make it darker", "add more blush")
- Natural language requests (e.g., "add red lipstick", "give me a smokey eye")
- Professional guidance with helpful examples and suggestions
- Automatic image storage and delivery

**Agent Config:** `agents/makeup-artist-agent.js`  
**📖 See `MAKEUP_ARTIST_AGENT.md` for complete documentation and usage examples.**

---

## 🛠️ Project Structure

```
agents/
  ├── claude-docubot-agent.js      # Generic file agent config
  ├── brandoneats-agent.js         # Brandon Eats agent config
  └── makeup-artist-agent.js       # Makeup Artist agent config

webhooks/
  ├── claude-webhook.js            # Generic file handler
  ├── brandoneats-webhook.js       # Brandon Eats handler
  └── makeup-artist-webhook.js     # Makeup Artist handler

services/
  ├── claude-service.js            # Claude API integration
  ├── gemini-service.js            # Gemini API integration (+ image generation)
  ├── a1zap-client.js              # A1Zap messaging client
  ├── brandoneats-client.js        # Brandon Eats specialized client
  ├── file-upload.js               # File upload utility
  ├── file-registry.js             # File storage manager
  ├── image-storage.js             # Image storage utilities
  ├── webhook-helpers.js           # Shared webhook utilities
  └── social-link-extractor.js     # Social media detection

examples/                          # Example scripts
  ├── upload.js                    # File upload example
  └── social-shares.js             # Rich content example

tests/                             # Test scripts
  ├── test-social-links.js         # Social link extraction tests
  ├── test-rich-content.js         # Rich content tests
  ├── test-social-shares-quick.js  # Quick social share test
  └── test-makeup-artist.js        # Makeup Artist tests

files/                             # Uploaded files directory
temp-images/                       # Generated images storage
config.js                          # Environment configuration
server.js                          # Main Express server
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
CLAUDE_API_KEY=sk-ant-...           # Claude API key
A1ZAP_API_KEY=your-key              # A1Zap API key
A1ZAP_AGENT_ID=your-agent-id        # A1Zap agent ID

# Optional
GEMINI_API_KEY=your-key             # Google Gemini API key
PORT=3000                           # Server port
BASE_URL=http://localhost:3000      # Public URL
```

### Check Configuration

```bash
npm run check
```

Shows status of all API keys and configurations.

---

## 🎨 Rich Content Support

The Brandon Eats agent supports rich content:

### Social Media Embeds
Send social media posts with automatic embedding:

```javascript
const richContentBlocks = [
  {
    type: 'social_share',
    data: {
      platform: 'instagram',
      url: 'https://www.instagram.com/reel/...'
    },
    order: 0
  },
  {
    type: 'social_share',
    data: {
      platform: 'tiktok',
      url: 'https://www.tiktok.com/@user/video/...'
    },
    order: 1
  }
];

await brandonEatsClient.sendMessage(chatId, 'Check out these videos!', richContentBlocks);
```

**📖 See `RICH_CONTENT_GUIDE.md` for more rich content types.**

---

## 🚀 Advanced Features

### Intelligent Filtering & Social Link Extraction

The Brandon Eats agent uses a sophisticated multi-stage filtering system:

1. **Off-Topic Triage**: Filters out irrelevant questions (weather, sports, etc.) before processing
2. **Smart Social Links**: Only sends TikTok videos when specific restaurants are discussed
3. **Alternative Suggestions**: When exact matches aren't available, suggests relevant alternatives with context

```javascript
// User: "I want restaurants over $100"
// Bot: "Brandon doesn't cover high-end dining, he focuses on street food..."
// Follow-up: "💡 These are Brandon's most elevated dining experiences..."
//            [Sends 2-3 TikTok links with context]
```

**Benefits:**
- Saves API costs by avoiding unnecessary processing
- Users only get relevant social media links
- **Even "not found" responses now provide helpful alternatives**
- Clear boundaries about bot's purpose
- Assumes user intent for food/travel questions

### Conversation History

Both agents maintain conversation context:
- Last 10 messages are retrieved automatically
- User names are included for multi-user chats
- History is passed to Claude for contextual responses

### Message Deduplication

Built-in duplicate message detection prevents double-processing:
- 5-minute deduplication window
- Automatic cleanup of old entries
- Race condition protection

---

## 📝 API Endpoints

### Webhooks
- `POST /webhook/claude` - Generic file-aware agent
- `POST /webhook/brandoneats` - Brandon Eats specialized agent

### File Management
- `GET /files/base` - Get current base file info
- `GET /files/list` - List all uploaded files

### Health Check
- `GET /health` - Server health status

---

## 🎯 Use Cases

### Generic File Agent
- **Company Knowledge Base**: Upload employee handbooks
- **Product Support**: Upload user manuals
- **Research Assistant**: Upload research papers
- **Legal Q&A**: Upload contracts and policies
- **Course Materials**: Upload textbooks and study guides
- **API Documentation**: Upload technical docs

### Brandon Eats Agent
- **Restaurant Discovery**: Find restaurants by cuisine/location
- **Data Analysis**: Analyze ratings, prices, menu items
- **Social Media Tracking**: Monitor restaurant social presence
- **Menu Insights**: Answer questions about dishes
- **Data Enrichment**: Add information to restaurant databases

---

## 🐛 Troubleshooting

**Agent not responding?**
- Check server logs for errors
- Verify environment variables: `npm run check`
- Test health endpoint: `https://your-server.com/health`

**Claude errors?**
- Verify API key at [Anthropic Console](https://console.anthropic.com/)
- Ensure you have Files API access

**File upload not working?**
- Check file type is supported
- Verify Claude API key is set
- Check file size limits

**Agent not using document context?**
- Verify base file is set: `GET /files/base`
- Ensure you uploaded with `setAsBase: true`
- Check you're using the correct webhook endpoint

---

## 📚 Documentation

- `AGENT_PERSONALITY_GUIDE.md` - Customize agent personality and behavior
- `INTELLIGENT_FILTERING.md` - Smart triage and social link filtering system
- `ALTERNATIVE_SUGGESTIONS.md` - Contextual alternative suggestions when exact matches aren't found
- `RICH_CONTENT_GUIDE.md` - Rich content formatting and social embeds
- `SETUP.md` - Complete setup and deployment guide

---

## 🔗 Useful Commands

```bash
# Check configuration
npm run check

# Upload a file
npm run upload /path/to/file.csv

# Start server
npm start

# Development mode (auto-restart)
npm run dev
```

---

## 📖 Learn More

- [Claude API Documentation](https://docs.anthropic.com/)
- [Claude Files API](https://docs.anthropic.com/en/api/files-create)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [A1Zap Documentation](https://a1zap.com/docs)

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Ready to build intelligent file-aware agents? Get started in 5 minutes!** 🚀
