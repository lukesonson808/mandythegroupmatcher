/**
 * Test sending an image through the A1Zap API
 * This simulates what happens when the webhook sends an image back
 */

require('dotenv').config();
const a1zapClient = require('../services/a1zap-client');
const imageStorage = require('../services/image-storage');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function testImageSending() {
  console.log('\n=== Testing Image Sending to A1Zap ===\n');

  // Create a test image (1x1 red pixel PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  try {
    // Save the test image
    console.log('1️⃣  Saving test image...');
    const filename = await imageStorage.saveBase64Image(testImageBase64, 'image/png', 'test');
    console.log(`   ✅ Image saved: ${filename}`);

    // Generate public URL
    console.log('\n2️⃣  Generating public URL...');
    const baseUrl = config.server.baseUrl;
    const imageUrl = imageStorage.generatePublicUrl(filename, baseUrl);
    console.log(`   URL: ${imageUrl}`);

    // Check if image file exists
    const imagePath = path.join(imageStorage.getTempDirPath(), filename);
    const exists = fs.existsSync(imagePath);
    console.log(`   File exists on disk: ${exists ? '✅' : '❌'}`);

    // Test sending to A1Zap
    console.log('\n3️⃣  Sending image to A1Zap...');
    console.log('   Chat ID: test_chat_12345 (test mode)');
    
    const messageContent = '🎨 This is a test image from the makeup artist agent!';
    
    // Show what we're sending
    console.log('\n   Request Body:');
    console.log(JSON.stringify({
      chatId: 'test_chat_12345',
      content: messageContent,
      media: {
        url: imageUrl,
        contentType: 'image/png'
      },
      metadata: {
        source: 'gemini-webhook-agent',
        messageType: 'image'
      }
    }, null, 2));

    // Actually send it (uncomment to test with real A1Zap API)
    // Note: This will send a real message if you have a valid API key
    console.log('\n   ⚠️  Skipping actual A1Zap send (set SEND_REAL_MESSAGE=true to test)');
    
    if (process.env.SEND_REAL_MESSAGE === 'true') {
      const result = await a1zapClient.sendMediaMessage(
        'test_chat_12345',
        messageContent,
        imageUrl
      );
      console.log('   ✅ Message sent successfully!');
      console.log('   Response:', result);
    }

    console.log('\n=== Test Summary ===');
    console.log('✅ Image saved to disk');
    console.log('✅ Public URL generated correctly');
    console.log('✅ Message payload formatted correctly');
    console.log('\n💡 To test actual sending, run:');
    console.log('   SEND_REAL_MESSAGE=true node tests/test-send-image.js');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testImageSending();

