#!/usr/bin/env node
/**
 * Quick test function to send image messages
 * Run with: node tests/send-test-image.js
 * 
 * This will send a test image message and show detailed diagnostics
 */

require('dotenv').config();
const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');

// Configuration
const AGENT_ID = config.a1zap.agentId;
const API_KEY = config.a1zap.apiKey;
const CHAT_ID = 'm97b9r4wc0bsth1artk5dm05h17t7cra'; // Your test chat
const BASE_URL = config.server.baseUrl;

async function sendTestImage() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 IMAGE MESSAGE TEST - QUICK DIAGNOSTIC');
  console.log('='.repeat(80) + '\n');

  // Find an image to send (prefer makeup images)
  const tempDir = path.join(__dirname, '..', 'temp-images');
  const images = fs.readdirSync(tempDir)
    .filter(f => f.startsWith('makeup_') && (f.endsWith('.png') || f.endsWith('.jpg')))
    .sort()
    .reverse();

  if (images.length === 0) {
    console.log('❌ No images found in temp-images directory');
    return;
  }

  const imageFile = images[0];
  const imageUrl = `${BASE_URL}/temp-images/${imageFile}`;
  const imageSize = fs.statSync(path.join(tempDir, imageFile)).size;

  // Get image dimensions
  const imageStorage = require('../services/image-storage');
  const dimensions = imageStorage.getImageDimensions(imageFile);

  console.log('📸 Image Details:');
  console.log(`   File: ${imageFile}`);
  console.log(`   Size: ${(imageSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   URL: ${imageUrl}`);
  if (dimensions) {
    console.log(`   Dimensions: ${dimensions.width}x${dimensions.height}`);
  }
  console.log('');

  // Test 1: Verify image is accessible
  console.log('1️⃣  Verifying image accessibility...');
  try {
    const imgTest = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 5000
    });
    console.log(`   ✅ Image accessible (${imgTest.status})`);
    console.log(`   Content-Type: ${imgTest.headers['content-type']}`);
    console.log(`   Actual Size: ${imgTest.data.length} bytes`);
    
    // Check if it's a valid image
    const isPNG = imgTest.data[0] === 0x89 && imgTest.data[1] === 0x50;
    const isJPG = imgTest.data[0] === 0xFF && imgTest.data[1] === 0xD8;
    console.log(`   Valid Format: ${isPNG ? 'PNG ✅' : isJPG ? 'JPEG ✅' : '❌ Unknown'}`);
  } catch (error) {
    console.log(`   ❌ Image NOT accessible: ${error.message}`);
    return;
  }

  // Test 2: Try different payload formats
  console.log('\n2️⃣  Testing different payload formats...\n');

  // Use actual dimensions if available, otherwise defaults
  const width = dimensions?.width || 1920;
  const height = dimensions?.height || 1080;

  // Format 1: Your current format (without dimensions)
  const format1 = {
    chatId: CHAT_ID,
    content: '🧪 Test Format 1: Standard media format (no dimensions)',
    media: {
      url: imageUrl,
      contentType: 'image/png'
    },
    metadata: {
      source: 'test-diagnostic',
      messageType: 'image'
    }
  };

  // Format 2: A1Zap recommended format WITH dimensions (this should work!)
  const format2 = {
    chatId: CHAT_ID,
    content: '🧪 Test Format 2: With dimensions (RECOMMENDED)',
    media: {
      url: imageUrl,
      contentType: 'image/png',
      width: width,
      height: height
    },
    metadata: {
      source: 'test-diagnostic',
      messageType: 'image'
    }
  };

  // Format 3: Try minimal format
  const format3 = {
    chatId: CHAT_ID,
    content: '🧪 Test Format 3: Minimal format',
    media: {
      url: imageUrl
    }
  };

  // Format 4: Try with messageType at top level
  const format4 = {
    chatId: CHAT_ID,
    content: '🧪 Test Format 4: messageType at root',
    messageType: 'image',
    media: {
      url: imageUrl,
      contentType: 'image/png'
    },
    metadata: {
      source: 'test-diagnostic'
    }
  };

  const formats = [
    { name: 'Format 1 (Current)', payload: format1 },
    { name: 'Format 2 (With Dimensions)', payload: format2 },
    { name: 'Format 3 (Minimal)', payload: format3 },
    { name: 'Format 4 (messageType Root)', payload: format4 }
  ];

  const endpoint = `https://api.a1zap.com/v1/messages/individual/${AGENT_ID}/send`;

  // Let user choose or test all
  const testFormat = process.argv[2] ? parseInt(process.argv[2]) - 1 : null;

  if (testFormat !== null && testFormat >= 0 && testFormat < formats.length) {
    // Test specific format
    await testSingleFormat(formats[testFormat], endpoint);
  } else {
    // Test all formats with delays
    console.log('Testing all formats with 2-second delays...\n');
    for (let i = 0; i < formats.length; i++) {
      await testSingleFormat(formats[i], endpoint);
      if (i < formats.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📱 CHECK WHATSAPP NOW!');
  console.log('='.repeat(80));
  console.log('Look for messages from "AI Makeup Salon"');
  console.log('Check which format (if any) shows the actual IMAGE\n');
  console.log('💡 To test a specific format, run:');
  console.log('   node tests/send-test-image.js 1  (for Format 1)');
  console.log('   node tests/send-test-image.js 2  (for Format 2)');
  console.log('   etc.\n');
}

async function testSingleFormat(format, endpoint) {
  console.log('─'.repeat(80));
  console.log(`📤 Testing: ${format.name}`);
  console.log('─'.repeat(80));
  console.log('Payload:');
  console.log(JSON.stringify(format.payload, null, 2));
  console.log('');
  console.log('Sending...');

  try {
    const response = await axios.post(endpoint, format.payload, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log(`\n✅ SUCCESS!`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Message ID: ${response.data.messageId}`);
    console.log(`   Timestamp: ${response.data.timestamp}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);

  } catch (error) {
    console.log(`\n❌ FAILED`);
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the test
if (require.main === module) {
  sendTestImage().catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { sendTestImage };

