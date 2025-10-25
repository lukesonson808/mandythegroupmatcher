// Load configuration
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const claudeWebhookHandler = require('./webhooks/claude-webhook');
const brandonEatsWebhookHandler = require('./webhooks/brandoneats-webhook');
const { getBaseFileInfo, getAllAgentFiles, listUploadedFiles } = require('./services/file-upload');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
      filesBaseAll: 'GET /files/base',
      filesBaseAgent: 'GET /files/base/:agent',
      filesList: 'GET /files/list'
    }
  });
});

// Claude webhook endpoint (with file reference support)
app.post('/webhook/claude', claudeWebhookHandler);

// Brandon Eats specialized webhook endpoint
app.post('/webhook/brandoneats', brandonEatsWebhookHandler);

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

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 File-Based AI Agent running on http://${HOST}:${PORT}`);
  console.log(`\nWebhook Endpoints:`);
  console.log(`  POST /webhook/claude        - Claude DocuBot (generic file reference agent)`);
  console.log(`  POST /webhook/brandoneats   - Brandon Eats data analyst (specialized)`);
  console.log(`  GET  /health                - Health check`);
  console.log(`  GET  /files/base            - Get base files for all agents`);
  console.log(`  GET  /files/base/:agent     - Get base file for specific agent`);
  console.log(`  GET  /files/list            - List all uploaded files\n`);
  console.log(`Configuration:`);
  console.log(`  Gemini API: ${config.gemini.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}`);
  console.log(`  Claude API: ${config.claude.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}`);
  console.log(`  A1Zap API: ${config.a1zap.apiKey.includes('your_') ? '❌ Not configured' : '✅ Configured'}\n`);
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
