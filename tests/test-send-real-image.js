/**
 * Test sending a REAL IMAGE MESSAGE to A1Zap
 * This sends an actual media message with image URL
 */

require('dotenv').config();
const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function testSendRealImage() {
  console.log('\n=== Testing Real Image Message Send ===\n');

  const agentId = config.a1zap.agentId;
  const apiKey = config.a1zap.apiKey;
  const chatId = 'm97b9r4wc0bsth1artk5dm05h17t7cra'; // Your actual chat ID
  const baseUrl = config.server.baseUrl;

  console.log('Configuration:');
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Chat ID: ${chatId}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log('');

  // Find the most recent makeup image
  const tempDir = path.join(__dirname, '..', 'temp-images');
  const files = fs.readdirSync(tempDir)
    .filter(f => f.startsWith('makeup_') && f.endsWith('.png'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('❌ No makeup images found to test with');
    return;
  }

  const testImage = files[0];
  const imageUrl = `${baseUrl}/temp-images/${testImage}`;

  console.log('1️⃣  Using existing image:');
  console.log(`   Filename: ${testImage}`);
  console.log(`   URL: ${imageUrl}`);
  console.log('');

  // Verify image is accessible
  console.log('2️⃣  Verifying image is accessible...');
  try {
    const imgCheck = await axios.head(imageUrl, { timeout: 5000 });
    console.log(`   ✅ Image accessible (${imgCheck.status})`);
    console.log(`   Content-Type: ${imgCheck.headers['content-type']}`);
    console.log(`   Content-Length: ${imgCheck.headers['content-length']} bytes`);
  } catch (error) {
    console.log(`   ❌ Image NOT accessible: ${error.message}`);
    console.log('   Cannot proceed with test');
    return;
  }

  // Send image message to A1Zap
  console.log('\n3️⃣  Sending IMAGE MESSAGE to A1Zap...');
  
  const endpoint = `https://api.a1zap.com/v1/messages/individual/${agentId}/send`;
  
  const payload = {
    chatId: chatId,
    content: '✨ Test image from diagnostic script! This is a real makeup transformation image.',
    media: {
      url: imageUrl,
      contentType: 'image/png'
    },
    metadata: {
      source: 'diagnostic-test',
      messageType: 'image',
      testMessage: true
    }
  };

  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Payload:`);
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  console.log('   Sending request...');

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 seconds for media messages
    });

    console.log('\n🎉 ✅ IMAGE MESSAGE SENT SUCCESSFULLY!');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.messageId) {
      console.log(`\n   📨 Message ID: ${response.data.messageId}`);
      console.log(`   ⏰ Timestamp: ${response.data.timestamp}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎯 SUCCESS! A1Zap accepted the image message!');
    console.log('='.repeat(70));
    console.log('\n📱 CHECK YOUR WHATSAPP NOW!');
    console.log('   Look for a message from "AI Makeup Salon"');
    console.log('   It should show the makeup transformation image');
    console.log('   Message: "✨ Test image from diagnostic script!..."');
    console.log('\n⏱️  Note: Media messages may take 10-30 seconds to appear');
    console.log('');

  } catch (error) {
    console.error('\n❌ FAILED to send image message');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.error('\n   💡 Bad request - check payload format');
      } else if (error.response.status === 401) {
        console.error('\n   💡 Authentication failed - check API key');
      } else if (error.response.status === 403) {
        console.error('\n   💡 Forbidden - agent may not have permission');
      } else if (error.response.status === 404) {
        console.error('\n   💡 Not found - check agent ID or endpoint');
      } else if (error.response.status === 500) {
        console.error('\n   💡 Server error - A1Zap API issue');
      }
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n   💡 Request timeout - A1Zap might be slow');
    }
  }

  console.log('\n=== Test Complete ===\n');
}

testSendRealImage().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

