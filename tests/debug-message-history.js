/**
 * Debug script to see what the A1Zap message history API actually returns
 */


const axios = require('axios');
const config = require('../config');

async function debugMessageHistory() {
  console.log('\n=== Debug A1Zap Message History API ===\n');

  // You can override these with a real chatId from your conversation
  const chatId = process.argv[2] || 'test-chat-id';
  const agentId = config.a1zap.agentId;
  const apiKey = config.a1zap.apiKey;
  const apiUrl = config.a1zap.apiUrl;

  console.log('Configuration:');
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Chat ID: ${chatId}`);
  console.log(`  API Key: ${apiKey.substring(0, 8)}...`);
  console.log('');

  // Test the exact URL construction from a1zap-client.js
  const url = `${apiUrl}/${agentId}/chat/${chatId}?limit=20`;
  console.log('Full URL:', url);
  console.log('');

  try {
    console.log('📡 Making GET request...');
    const response = await axios.get(url, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    console.log('✅ Success! Response status:', response.status);
    console.log('');
    console.log('Response structure:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // Check if messages exist
    if (response.data.messages) {
      console.log(`Found ${response.data.messages.length} messages`);
      console.log('');

      // Examine first few messages
      const firstMessages = response.data.messages.slice(0, 3);
      console.log('First 3 messages (detailed):');
      firstMessages.forEach((msg, i) => {
        console.log(`\n--- Message ${i + 1} ---`);
        console.log('Keys:', Object.keys(msg));
        console.log('Full message:', JSON.stringify(msg, null, 2));
        
        // Check for media field
        if (msg.media) {
          console.log('📸 HAS MEDIA:', msg.media);
        }
      });
    } else {
      console.log('⚠️  No "messages" field in response');
    }

  } catch (error) {
    console.error('❌ Error fetching message history:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Error Message:', error.message);
  }
}

console.log('Usage: node tests/debug-message-history.js [chatId]');
console.log('If no chatId provided, will use "test-chat-id"\n');

debugMessageHistory().catch(console.error);

