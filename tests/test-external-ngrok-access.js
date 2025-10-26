/**
 * Test if ngrok URL is accessible from external servers
 * This simulates what A1Zap does when trying to fetch your image
 */

require('dotenv').config();
const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function testExternalAccess() {
  console.log('\n=== Testing External Access to ngrok URL ===\n');

  const baseUrl = config.server.baseUrl;
  console.log(`Base URL: ${baseUrl}`);

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

  console.log(`\nTesting most recent image: ${testImage}`);
  console.log(`Full URL: ${imageUrl}\n`);

  // Test 1: Can we access it?
  console.log('1️⃣  Testing HTTP access...');
  try {
    const response = await axios.get(imageUrl, {
      timeout: 10000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'A1Zap-Image-Fetcher/1.0' // Simulate A1Zap
      }
    });

    console.log(`   ✅ Image accessible!`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Content-Length: ${response.headers['content-length']} bytes`);
    console.log(`   Actual Size: ${response.data.length} bytes`);
    
    // Verify it's actually a valid PNG
    if (response.data.length > 8) {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const fileHeader = response.data.slice(0, 8);
      const isPNG = pngSignature.equals(fileHeader);
      console.log(`   Valid PNG: ${isPNG ? '✅' : '❌'}`);
      
      if (!isPNG) {
        console.log('   ⚠️  File doesn\'t appear to be a valid PNG!');
        console.log('   First 16 bytes:', fileHeader.toString('hex'));
      }
    }

  } catch (error) {
    console.log(`   ❌ Cannot access image`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Status Text: ${error.response.statusText}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n   💡 Connection refused - ngrok might not be running or configured correctly');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n   💡 Connection timeout - ngrok might be blocking external requests');
    }
    
    return;
  }

  // Test 2: Check ngrok config
  console.log('\n2️⃣  Checking ngrok configuration...');
  
  if (baseUrl.includes('ngrok.io') || baseUrl.includes('ngrok.app')) {
    console.log('   ✅ Using ngrok domain');
    
    // Check if ngrok has any authentication/restrictions
    console.log('\n   💡 Make sure your ngrok tunnel:');
    console.log('      - Is not using basic auth');
    console.log('      - Allows external access');
    console.log('      - Is not rate-limited');
    console.log('      - Has a valid SSL certificate');
  } else {
    console.log('   ⚠️  Not using ngrok - using:', baseUrl);
  }

  // Test 3: Check response time
  console.log('\n3️⃣  Testing response time...');
  const start = Date.now();
  try {
    await axios.head(imageUrl, { timeout: 5000 });
    const duration = Date.now() - start;
    console.log(`   Response time: ${duration}ms`);
    
    if (duration > 3000) {
      console.log('   ⚠️  Slow response (>3s) - A1Zap might timeout');
    } else {
      console.log('   ✅ Response time looks good');
    }
  } catch (error) {
    console.log(`   ❌ HEAD request failed: ${error.message}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log('If the image is accessible externally, the issue might be:');
  console.log('1. A1Zap needs time to process and deliver the image (check WhatsApp)');
  console.log('2. A1Zap has specific IP restrictions or firewall rules');
  console.log('3. The image URL expires before A1Zap fetches it');
  console.log('4. WhatsApp/platform-specific media delivery issues');
  console.log('\n💡 Try checking:');
  console.log('   - WhatsApp web/app for the message');
  console.log('   - A1Zap dashboard for delivery status');
  console.log('   - Wait a few seconds and refresh\n');
}

testExternalAccess().catch(err => {
  console.error('Test failed:', err);
});

