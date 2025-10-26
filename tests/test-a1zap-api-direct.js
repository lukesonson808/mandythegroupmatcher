/**
 * Test A1Zap API directly using the correct curl format
 * This will help diagnose if the message history API is working
 */

require('dotenv').config();
const axios = require('axios');
const config = require('../config');

async function testA1ZapAPI() {
  console.log('\n=== Testing A1Zap API Directly ===\n');

  const agentId = config.a1zap.agentId;
  const apiKey = config.a1zap.apiKey;
  
  // Use the actual chat ID from the logs
  const chatId = 'm97b9r4wc0bsth1artk5dm05h17t7cra';

  console.log('Configuration:');
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`  Chat ID: ${chatId}`);
  console.log('');

  // Test 1: Get message history using the exact format from curl
  const endpoint = `https://api.a1zap.com/v1/messages/individual/${agentId}/chat/${chatId}?limit=25`;
  
  console.log('1️⃣  Testing GET /chat endpoint (message history)...');
  console.log(`   URL: ${endpoint}`);
  console.log('');

  try {
    const response = await axios.get(endpoint, {
      headers: {
        'X-API-Key': apiKey
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS! Message history retrieved');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.messages) {
      console.log(`\n   📨 Found ${response.data.messages.length} messages`);
      
      // Look for agent messages
      const agentMessages = response.data.messages.filter(msg => msg.isAgent);
      console.log(`   🤖 Agent messages: ${agentMessages.length}`);
      
      // Look for the specific message we sent
      const ourMessageId = 'js7780xdyqxrsw6syc1g76tnah7t6z1e';
      const ourMessage = response.data.messages.find(msg => msg.id === ourMessageId);
      
      if (ourMessage) {
        console.log(`\n   🎯 FOUND our sent message!`);
        console.log(`   Message:`, JSON.stringify(ourMessage, null, 2));
        console.log(`\n   ✨ The message WAS delivered to A1Zap!`);
        
        if (ourMessage.media) {
          console.log(`   📸 Media URL:`, ourMessage.media.url);
        }
      } else {
        console.log(`\n   ⚠️  Our message (${ourMessageId}) not found in history`);
        console.log(`   This could mean:`);
        console.log(`   - Message is still being processed`);
        console.log(`   - Message failed to save to history`);
        console.log(`   - Need to wait longer`);
      }
      
      // Show recent messages
      console.log(`\n   📋 Recent messages (last 5):`);
      response.data.messages.slice(0, 5).forEach((msg, idx) => {
        console.log(`\n   ${idx + 1}. [${msg.isAgent ? 'AGENT' : 'USER'}] ${msg.messageType || 'text'}`);
        console.log(`      ID: ${msg.id}`);
        console.log(`      Time: ${msg.timestamp}`);
        console.log(`      Content: ${(msg.content || '[no content]').substring(0, 60)}...`);
        if (msg.media) {
          console.log(`      Media: ✅ ${msg.media.contentType || 'unknown type'}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ FAILED to retrieve message history');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.error('\n   💡 Authentication failed - check API key');
      } else if (error.response.status === 403) {
        console.error('\n   💡 Forbidden - agent may not have access to this chat');
      } else if (error.response.status === 404) {
        console.error('\n   💡 Not found - check agent ID or chat ID');
      } else if (error.response.status === 500) {
        console.error('\n   💡 Server error - A1Zap API issue (not your fault!)');
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n   💡 Connection refused - check internet connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n   💡 Request timeout - A1Zap API might be slow/down');
    }
  }

  // Test 2: Try to send a simple test message to verify send API works
  console.log('\n\n2️⃣  Testing POST /send endpoint...');
  
  const sendEndpoint = `https://api.a1zap.com/v1/messages/individual/${agentId}/send`;
  console.log(`   URL: ${sendEndpoint}`);
  
  const testPayload = {
    chatId: chatId,
    content: '🧪 Test message - API verification',
    metadata: {
      source: 'diagnostic-test',
      testMessage: true
    }
  };
  
  console.log(`   Payload:`, JSON.stringify(testPayload, null, 2));
  console.log('');

  try {
    const response = await axios.post(sendEndpoint, testPayload, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS! Test message sent');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.messageId) {
      console.log(`\n   📨 Message ID: ${response.data.messageId}`);
      console.log(`   ✨ Send API is working correctly!`);
    }

  } catch (error) {
    console.error('❌ FAILED to send test message');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n=== Test Complete ===\n');
}

testA1ZapAPI().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

