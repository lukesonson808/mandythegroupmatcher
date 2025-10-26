/**
 * Verify that ngrok URL is accessible for serving images
 */

require('dotenv').config();
const axios = require('axios');
const config = require('../config');

async function verifyNgrokAccess() {
  console.log('\n=== Verifying ngrok URL Access ===\n');

  const baseUrl = config.server.baseUrl;
  console.log(`Base URL: ${baseUrl}`);

  // Test 1: Check if server health endpoint is accessible
  console.log('\n1️⃣  Testing health endpoint...');
  try {
    const healthUrl = `${baseUrl}/health`;
    console.log(`   URL: ${healthUrl}`);
    const response = await axios.get(healthUrl, { timeout: 5000 });
    console.log(`   ✅ Health endpoint accessible (${response.status})`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log(`   ❌ Health endpoint NOT accessible`);
    console.log(`   Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log(`   💡 Make sure your server is running!`);
    }
  }

  // Test 2: Check if temp-images directory endpoint is accessible
  console.log('\n2️⃣  Testing temp-images endpoint...');
  
  // List actual images in temp-images directory
  const fs = require('fs');
  const path = require('path');
  const imageStorage = require('../services/image-storage');
  const tempDir = imageStorage.getTempDirPath();
  
  try {
    const files = fs.readdirSync(tempDir);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
    
    if (imageFiles.length === 0) {
      console.log('   ⚠️  No images found in temp-images directory');
      console.log('   Creating a test image...');
      
      // Create a test image
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const filename = await imageStorage.saveBase64Image(testImageBase64, 'image/png', 'verify');
      imageFiles.push(filename);
      console.log(`   ✅ Created test image: ${filename}`);
    } else {
      console.log(`   Found ${imageFiles.length} image(s) in temp-images directory`);
    }
    
    // Test accessing one of the images
    if (imageFiles.length > 0) {
      const testImage = imageFiles[0];
      const imageUrl = `${baseUrl}/temp-images/${testImage}`;
      console.log(`\n   Testing image URL: ${imageUrl}`);
      
      try {
        const imgResponse = await axios.get(imageUrl, { 
          timeout: 5000,
          responseType: 'arraybuffer'
        });
        console.log(`   ✅ Image accessible (${imgResponse.status})`);
        console.log(`   Content-Type: ${imgResponse.headers['content-type']}`);
        console.log(`   Size: ${imgResponse.data.length} bytes`);
      } catch (error) {
        console.log(`   ❌ Image NOT accessible`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Status: ${error.response?.status}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error reading temp-images directory: ${error.message}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log('Next steps:');
  console.log('1. Make sure your server is running (node server.js)');
  console.log('2. Make sure ngrok is running and pointing to your server port');
  console.log('3. Test sending an image through the makeup artist webhook');
  console.log('4. Check server logs for detailed output\n');
}

verifyNgrokAccess().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

