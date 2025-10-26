/**
 * Test the complete webhook flow for makeup artist
 * This simulates what happens when A1Zap sends a webhook with an image
 */

require('dotenv').config();
const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function testFullWebhookFlow() {
  console.log('\n=== Testing Full Webhook Flow ===\n');

  const serverUrl = config.server.baseUrl;
  const webhookEndpoint = `${serverUrl}/webhook/makeup-artist`;

  console.log(`Webhook URL: ${webhookEndpoint}`);

  // Check if we have an existing image to use
  const tempImagesDir = path.join(__dirname, '..', 'temp-images');
  const imageFiles = fs.readdirSync(tempImagesDir)
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

  if (imageFiles.length === 0) {
    console.log('❌ No images found in temp-images directory');
    console.log('Please add an image to test with first.');
    return;
  }

  const testImage = imageFiles[0];
  const testImageUrl = `${serverUrl}/temp-images/${testImage}`;
  console.log(`Using test image: ${testImageUrl}`);

  // Simulate a webhook payload from A1Zap
  const webhookPayload = {
    chat: {
      id: 'test-full-flow-123', // Using 'test-' prefix so it doesn't send to real A1Zap
      platform: 'whatsapp'
    },
    message: {
      id: 'msg_test_' + Date.now(),
      content: 'Apply glamorous makeup with red lipstick',
      media: {
        url: testImageUrl,
        contentType: 'image/png'
      },
      timestamp: new Date().toISOString()
    },
    agent: {
      id: config.a1zap.agentId,
      name: 'Makeup Artist'
    }
  };

  console.log('\n📤 Sending webhook request...');
  console.log('Payload:', JSON.stringify(webhookPayload, null, 2));

  try {
    const response = await axios.post(webhookEndpoint, webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout for image generation
    });

    console.log('\n✅ Webhook processed successfully!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.imageUrl) {
      console.log('\n📸 Generated image URL:', response.data.imageUrl);
      
      // Verify the generated image is accessible
      console.log('Verifying generated image is accessible...');
      try {
        const imgResponse = await axios.get(response.data.imageUrl, {
          responseType: 'arraybuffer',
          timeout: 5000
        });
        console.log('✅ Generated image is accessible!');
        console.log(`   Size: ${imgResponse.data.length} bytes`);
        console.log(`   Content-Type: ${imgResponse.headers['content-type']}`);
      } catch (imgError) {
        console.log('❌ Generated image NOT accessible');
        console.log('   Error:', imgError.message);
      }
    }

    console.log('\n=== Test Complete ===');
    console.log('The webhook flow is working correctly!');
    console.log('Check your server logs for detailed output.');
    console.log('\n💡 Note: This used test mode (chat ID starts with "test-")');
    console.log('   so no message was sent to A1Zap API.');
    console.log('   In production, remove the "test-" prefix to send real messages.\n');

  } catch (error) {
    console.error('\n❌ Webhook request failed!');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Server not running! Start it with: node server.js');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Request timed out. Image generation may take longer.');
    }
    
    process.exit(1);
  }
}

// Run the test
testFullWebhookFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

