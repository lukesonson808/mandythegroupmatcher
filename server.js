/**
 * Mandy the Group Matchmaker Server
 * 
 * Server for Mandy the Group Matchmaker agent only.
 */

// Load environment variables from .env file
try {
  require('@dotenvx/dotenvx').config();
} catch (error) {
  // Fallback to dotenv if @dotenvx/dotenvx not available
  try {
    require('dotenv').config();
  } catch (e) {
    // If neither is available, environment variables must be set manually
    console.warn('⚠️  No dotenv package found - using system environment variables only');
  }
}

// Load configuration
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');

// Core architecture
const AgentRegistry = require('./core/AgentRegistry');

// Mandy agent and webhook
const mandyAgent = require('./agents/mandy-agent');
const mandyWebhookHandler = require('./webhooks/mandy-webhook');

// Initialize agent registry
const agentRegistry = new AgentRegistry();
agentRegistry.register('mandy', mandyAgent, mandyWebhookHandler);

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
      hasClaudeApiKey: !!config.claude.apiKey && !config.claude.apiKey.includes('your_'),
      hasA1ZapApiKey: !!config.a1zap.apiKey && !config.a1zap.apiKey.includes('your_')
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Mandy the Group Matchmaker',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      mandy: 'POST /webhook/mandy'
    }
  });
});

// Mandy the Group Matchmaker webhook endpoint
app.post('/webhook/mandy', mandyWebhookHandler);

// Matching endpoint - run matching algorithm and save results (POST or GET)
const handleMatchRequest = async (req, res) => {
  try {
    console.log('💕 Matching endpoint called');
    
    const groupMatching = require('./services/group-matching');
    const groupProfileStorage = require('./services/group-profile-storage');
    const fs = require('fs');
    const path = require('path');
    
    const allProfiles = groupProfileStorage.getAllProfiles();
    
    if (allProfiles.length < 2) {
      return res.status(400).json({
        error: 'Not enough groups',
        message: 'Need at least 2 groups to perform matching',
        groupsCount: allProfiles.length
      });
    }
    
    // Clear existing matches for fresh matching event
    const matchesData = { matches: [] };
    fs.writeFileSync(path.join(__dirname, 'data', 'matches.json'), JSON.stringify(matchesData, null, 2));
    
    // Find best overall match
    const bestMatch = await groupMatching.findBestMatch();
    
    if (bestMatch) {
      groupProfileStorage.saveMatch({
        group1Name: bestMatch.group1.groupName,
        group2Name: bestMatch.group2.groupName,
        group1Id: bestMatch.group1.id,
        group2Id: bestMatch.group2.id,
        compatibility: bestMatch.compatibility,
        matchedAt: new Date().toISOString(),
        isBestMatch: true
      });
    }
    
    // Find top matches for each group
    const matchesByGroup = {};
    let totalMatchesSaved = 0;
    
    for (const group of allProfiles) {
      const matches = await groupMatching.findMatchesForGroup(group.groupName, 3);
      matchesByGroup[group.groupName] = matches.map(m => ({
        groupName: m.group.groupName,
        compatibility: m.compatibility.percentage,
        breakdown: m.compatibility
      }));
      
      // Save top 3 matches for this group (avoid duplicates with best match)
      for (const match of matches) {
        const isBestMatchPair = bestMatch && (
          (match.group.groupName === bestMatch.group1.groupName && group.groupName === bestMatch.group2.groupName) ||
          (match.group.groupName === bestMatch.group2.groupName && group.groupName === bestMatch.group1.groupName)
        );
        
        if (!isBestMatchPair) {
          groupProfileStorage.saveMatch({
            group1Name: group.groupName,
            group2Name: match.group.groupName,
            group1Id: group.id,
            group2Id: match.group.id,
            compatibility: match.compatibility,
            matchedAt: new Date().toISOString()
          });
          totalMatchesSaved++;
        }
      }
    }
    
    const allMatches = groupProfileStorage.getAllMatches();
    
    res.json({
      success: true,
      message: 'Matching completed successfully',
      summary: {
        totalGroups: allProfiles.length,
        totalMatches: allMatches.length,
        bestMatch: bestMatch ? {
          group1: bestMatch.group1.groupName,
          group2: bestMatch.group2.groupName,
          compatibility: bestMatch.compatibility.percentage,
          breakdown: bestMatch.compatibility
        } : null
      },
      matchesByGroup,
      allMatches: allMatches.map(m => ({
        group1: m.group1Name,
        group2: m.group2Name,
        compatibility: m.compatibility?.percentage || 0,
        matchedAt: m.matchedAt,
        isBestMatch: m.isBestMatch || false
      }))
    });
    
  } catch (error) {
    console.error('❌ Matching error:', error);
    res.status(500).json({
      error: 'Matching failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Support both GET and POST for easy access (just click the URL in Railway!)
app.get('/api/match', handleMatchRequest);
app.post('/api/match', handleMatchRequest);

// Get matches endpoint - retrieve saved matches
app.get('/api/matches', (req, res) => {
  try {
    const groupProfileStorage = require('./services/group-profile-storage');
    const allMatches = groupProfileStorage.getAllMatches();
    const allProfiles = groupProfileStorage.getAllProfiles();
    
    res.json({
      success: true,
      totalGroups: allProfiles.length,
      totalMatches: allMatches.length,
      matches: allMatches.map(m => ({
        group1: m.group1Name,
        group2: m.group2Name,
        compatibility: m.compatibility?.percentage || 0,
        breakdown: m.compatibility,
        matchedAt: m.matchedAt,
        isBestMatch: m.isBestMatch || false
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching matches:', error);
    res.status(500).json({
      error: 'Failed to fetch matches',
      message: error.message
    });
  }
});

// Get groups endpoint - retrieve all group profiles
app.get('/api/groups', (req, res) => {
  try {
    const groupProfileStorage = require('./services/group-profile-storage');
    const allProfiles = groupProfileStorage.getAllProfiles();
    
    res.json({
      success: true,
      totalGroups: allProfiles.length,
      groups: allProfiles.map(g => ({
        groupName: g.groupName,
        id: g.id,
        size: g.answers?.question2 || g.q2 || 'N/A',
        createdAt: g.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching groups:', error);
    res.status(500).json({
      error: 'Failed to fetch groups',
      message: error.message
    });
  }
});

// Start server
// Railway sets PORT automatically, default to 3000 for local dev
const PORT = process.env.PORT || config.server.port || 3000;
// Listen on all interfaces for Railway/production, localhost for dev
const HOST = process.env.PORT ? '0.0.0.0' : 'localhost';

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Mandy the Group Matchmaker running on http://${HOST}:${PORT}`);
  console.log(`   Version: 1.0.0`);
  
  // Print agent registry summary
  agentRegistry.printSummary();
  
  console.log(`\nWebhook Endpoints:`);
  console.log(`  POST /webhook/mandy               - Mandy the Group Matchmaker`);
  console.log(`  GET  /health                      - Health check`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  GET/POST /api/match               - Run matching algorithm (clickable!)`);
  console.log(`  GET  /api/matches                 - Get all saved matches`);
  console.log(`  GET  /api/groups                  - Get all group profiles`);
  console.log(`\nConfiguration:`);
  console.log(`  Claude API: ${config.claude.apiKey && !config.claude.apiKey.includes('your_') ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  A1Zap API: ${config.a1zap.apiKey && !config.a1zap.apiKey.includes('your_') ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Mandy Agent ID: ${config.agents.mandy && config.agents.mandy.agentId ? '✅ Configured' : '❌ Not configured'}\n`);
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
