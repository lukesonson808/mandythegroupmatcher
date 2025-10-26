// Load configuration
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const claudeWebhookHandler = require('./webhooks/claude-webhook');
const brandonEatsWebhookHandler = require('./webhooks/brandoneats-webhook');
const makeupArtistWebhookHandler = require('./webhooks/makeup-artist-webhook');
const { getBaseFileInfo, getAllAgentFiles, listUploadedFiles } = require('./services/file-upload');
const imageStorage = require('./services/image-storage');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static file serving for generated images
app.use('/temp-images', express.static(imageStorage.getTempDirPath()));

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
    service: 'File-Based AI Agent (Multi-Model)',
    version: '2.0.0',
    endpoints: {
      health: 'GET /health',
      claudeDocubot: 'POST /webhook/claude',
      brandonEatsWebhook: 'POST /webhook/brandoneats',
      makeupArtist: 'POST /webhook/makeup-artist',
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

// Makeup Artist webhook endpoint (with Gemini image generation)
app.post('/webhook/makeup-artist', makeupArtistWebhookHandler);

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

// Start server
const PORT = config.server.port;
// Bind to 0.0.0.0 in production/Railway, localhost for local dev
const HOST = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Initialize files on startup
async function initializeFiles() {
  const { uploadFileToClaude, getBaseFileInfo } = require('./services/file-upload');
  const path = require('path');
  const fileRegistry = require('./services/file-registry');
  
  console.log('\n📂 Initializing files...');
  
  try {
    // Check if file is already uploaded and assigned
    const existingFile = getBaseFileInfo('brandoneats');
    
    if (existingFile && existingFile.id) {
      console.log(`✅ File already initialized: ${existingFile.id}`);
      console.log(`   - File: ${existingFile.filename}`);
      console.log(`   - Uploaded: ${existingFile.uploadedAt}\n`);
      return;
    }
    
    // Upload brandoneats.csv for both agents
    const brandonEatsFile = path.join(__dirname, 'files', 'brandoneats.csv');
    
    console.log('📤 Uploading brandoneats.csv to Claude...');
    const result = await uploadFileToClaude(brandonEatsFile, {
      setAsBase: true,
      agent: 'brandoneats'
    });
    
    // Also set it for claude-docubot
    fileRegistry.setBaseFile(result.fileId, 'claude-docubot');
    
    console.log(`✅ File uploaded successfully: ${result.fileId}`);
    console.log(`   - Assigned to: brandoneats, claude-docubot\n`);
  } catch (error) {
    console.error('⚠️  File initialization failed:', error.message);
    console.log('   Continuing with server startup...\n');
  }
}

const server = app.listen(PORT, HOST, async () => {
  console.log(`\n🚀 File-Based AI Agent running on http://${HOST}:${PORT}`);
  console.log(`\nWebhook Endpoints:`);
  console.log(`  POST /webhook/claude        - Claude DocuBot (generic file reference agent)`);
  console.log(`  POST /webhook/brandoneats   - Brandon Eats data analyst (specialized)`);
  console.log(`  POST /webhook/makeup-artist - Makeup Artist with Gemini image generation`);
  console.log(`  GET  /health                - Health check`);
  console.log(`  GET  /files/base            - Get base files for all agents`);
  console.log(`  GET  /files/base/:agent     - Get base file for specific agent`);
  console.log(`  GET  /files/list            - List all uploaded files`);
  console.log(`  GET  /temp-images/:filename - Generated images\n`);
  console.log(`Configuration:`);
  console.log(`  Gemini API: ${config.gemini.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}`);
  console.log(`  Claude API: ${config.claude.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}`);
  console.log(`  A1Zap API: ${config.a1zap.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}\n`);
  
  // Initialize files after server starts
  await initializeFiles();
  
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
