/**
 * Multi-Agent AI System Server
 * 
 * Clean architecture with base classes for extensibility:
 * - BaseAgent: Abstract agent class
 * - BaseWebhook: Abstract webhook handler
 * - BaseA1ZapClient: Unified messaging client
 * - AgentRegistry: Central agent management
 */

// Load configuration
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');

// Core architecture
const AgentRegistry = require('./core/AgentRegistry');

// Agent configurations
const claudeDocubotAgent = require('./agents/claude-docubot-agent');
const brandonEatsAgent = require('./agents/brandoneats-agent');
const willWanderForFoodAgent = require('./agents/willwanderforfood-agent');
const makeupArtistAgent = require('./agents/makeup-artist-agent');
const ycPhotographerAgent = require('./agents/yc-photographer-agent');
const zapbankRepAgent = require('./agents/zapbank-rep-agent');
const richContentDemoAgent = require('./agents/rich-content-demo-agent');

// Webhook handlers
const claudeWebhookHandler = require('./webhooks/claude-webhook');
const brandonEatsWebhookHandler = require('./webhooks/brandoneats-webhook');
const willWanderForFoodWebhookHandler = require('./webhooks/willwanderforfood-webhook');
const makeupArtistWebhookHandler = require('./webhooks/makeup-artist-webhook');
const ycPhotographerWebhookHandler = require('./webhooks/yc-photographer-webhook');
const zapbankRepWebhookHandler = require('./webhooks/zapbank-rep-webhook');
const richContentDemoWebhookHandler = require('./webhooks/rich-content-demo-webhook');

// Services
const { getBaseFileInfo, getAllAgentFiles, listUploadedFiles } = require('./services/file-upload');
const imageStorage = require('./services/image-storage');

// Initialize agent registry
const agentRegistry = new AgentRegistry();
agentRegistry.register('claude-docubot', claudeDocubotAgent, claudeWebhookHandler);
agentRegistry.register('brandoneats', brandonEatsAgent, brandonEatsWebhookHandler);
agentRegistry.register('willwanderforfood', willWanderForFoodAgent, willWanderForFoodWebhookHandler);
agentRegistry.register('makeup-artist', makeupArtistAgent, makeupArtistWebhookHandler);
agentRegistry.register('yc-photographer', ycPhotographerAgent, ycPhotographerWebhookHandler);
agentRegistry.register('zapbank-rep', zapbankRepAgent, zapbankRepWebhookHandler);
agentRegistry.register('rich-content-demo', richContentDemoAgent, richContentDemoWebhookHandler);

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static file serving for generated images
app.use('/temp-images', express.static(imageStorage.getTempDirPath()));

// Static file serving for reference images (YC settings, etc.)
app.use('/reference-images', express.static('./reference-images'));

// Static file serving for marketing/product images
app.use('/static-images', express.static('./static-images'));

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      hasGeminiApiKey: !!config.gemini.apiKey && !config.gemini.apiKey.includes('your_'),
      hasClaudeApiKey: !!config.claude.apiKey && !config.claude.apiKey.includes('your_'),
      hasA1ZapApiKey: !!config.a1zap.apiKey && !config.a1zap.apiKey.includes('your_')
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Multi-Agent AI System',
    version: '3.0.0',
    architecture: 'Clean Architecture with Base Classes',
    agents: agentRegistry.listAgents(),
    endpoints: {
      health: 'GET /health',
      claudeDocubot: 'POST /webhook/claude',
      brandonEats: 'POST /webhook/brandoneats',
      willWanderForFood: 'POST /webhook/willwanderforfood',
      makeupArtist: 'POST /webhook/makeup-artist',
      ycPhotographer: 'POST /webhook/yc-photographer',
      zapbankRep: 'POST /webhook/zapbank-rep',
      richContentDemo: 'POST /webhook/rich-content-demo',
      filesBaseAll: 'GET /files/base',
      filesBaseAgent: 'GET /files/base/:agent',
      filesList: 'GET /files/list',
      tempImages: 'GET /temp-images/:filename'
    }
  });
});

// Claude webhook endpoint (with file reference support)
app.post('/webhook/claude', claudeWebhookHandler);

// Brandon Eats specialized webhook endpoint
app.post('/webhook/brandoneats', brandonEatsWebhookHandler);

// Will Wander for Food specialized webhook endpoint
app.post('/webhook/willwanderforfood', willWanderForFoodWebhookHandler);

// Makeup Artist webhook endpoint (with Gemini image generation)
app.post('/webhook/makeup-artist', makeupArtistWebhookHandler);

// YC Photographer webhook endpoint (with Gemini image generation)
app.post('/webhook/yc-photographer', ycPhotographerWebhookHandler);

// Zap Bank Rep webhook endpoint
app.post('/webhook/zapbank-rep', zapbankRepWebhookHandler);

// Rich Content Demo webhook endpoint
app.post('/webhook/rich-content-demo', richContentDemoWebhookHandler);

// File management endpoints
app.get('/files/base', (req, res) => {
  try {
    const agentFiles = getAllAgentFiles();
    res.json({
      success: true,
      agentFiles: agentFiles,
      message: 'Base files for all agents'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get base file for specific agent
app.get('/files/base/:agent', (req, res) => {
  try {
    const agentName = req.params.agent;
    if (!['brandoneats', 'claude-docubot'].includes(agentName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent name. Use "brandoneats" or "claude-docubot"'
      });
    }
    
    const baseFile = getBaseFileInfo(agentName);
    res.json({
      success: true,
      agent: agentName,
      baseFile: baseFile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/files/list', (req, res) => {
  try {
    const files = listUploadedFiles();
    res.json({
      success: true,
      files: files,
      count: files.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Validate configuration before starting server
console.log('\n🔍 Validating configuration...\n');

// Validate AI services
const geminiValidation = config.validation.validateAIService('Gemini', config.gemini);
const claudeValidation = config.validation.validateAIService('Claude', config.claude);

// Validate agents
const agentValidations = {};
for (const [agentName, agentConfig] of Object.entries(config.agents)) {
  agentValidations[agentName] = config.validation.validateAgent(agentName, agentConfig);
}

// Collect all errors and warnings
let allErrors = [...geminiValidation.errors, ...claudeValidation.errors];
let allWarnings = [...geminiValidation.warnings, ...claudeValidation.warnings];

for (const [agentName, validation] of Object.entries(agentValidations)) {
  allErrors.push(...validation.errors);
  allWarnings.push(...validation.warnings);
}

// Display warnings
if (allWarnings.length > 0) {
  console.log('⚠️  Configuration Warnings:');
  allWarnings.forEach(w => console.log(`  ${w}`));
  console.log('');
}


// Display errors
if (allErrors.length > 0) {
  console.log('❌ Configuration Errors:');
  allErrors.forEach(e => console.log(`  ${e}`));
  console.log('');
  console.log('💡 To fix these errors:');
  console.log('  1. Create a .env file in the project root');
  console.log('  2. Add the required API keys and agent IDs');
  console.log('  3. See .env.example for a template\n');
  console.log('⚠️  The server will start, but agents with errors may not work!\n');
}

// Start server
const PORT = config.server.port;
// Bind to 0.0.0.0 in production/Railway, localhost for local dev
const HOST = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Multi-Agent AI System running on http://${HOST}:${PORT}`);
  console.log(`   Version: 3.0.0 (Clean Architecture)`);
  
  // Print agent registry summary
  agentRegistry.printSummary();
  
  console.log(`Webhook Endpoints:`);
  console.log(`  POST /webhook/claude              - Claude DocuBot (file-aware agent)`);
  console.log(`  POST /webhook/brandoneats         - Brandon Eats (data analyst)`);
  console.log(`  POST /webhook/makeup-artist       - Makeup Artist (image generation)`);
  console.log(`  POST /webhook/yc-photographer     - YC Photographer (image generation)`);
  console.log(`  POST /webhook/zapbank-rep         - Zap Bank Rep (sales advisor)`);
  console.log(`  POST /webhook/rich-content-demo   - Rich Content Demo (showcase)`);
  console.log(`  GET  /health                      - Health check`);
  console.log(`  GET  /files/base              - Get base files for all agents`);
  console.log(`  GET  /files/base/:agent       - Get base file for specific agent`);
  console.log(`  GET  /files/list              - List all uploaded files`);
  console.log(`  GET  /temp-images/:filename   - Generated images\n`);
  console.log(`Configuration:`);
  console.log(`  Gemini API: ${config.gemini.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}`);
  console.log(`  Claude API: ${config.claude.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}`);
  console.log(`  A1Zap API: ${config.a1zap.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}\n`);
  
  // Optional: Schedule cleanup of old images (run daily at 3 AM)
  const schedule = require('node:timers');
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      console.log('🧹 Running scheduled image cleanup...');
      imageStorage.cleanupOldImages(24); // Delete images older than 24 hours
    }
  }, 60000); // Check every minute
});

// Error handling
server.on('error', (error) => {
  console.error(`❌ Server error:`, error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📴 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📴 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
