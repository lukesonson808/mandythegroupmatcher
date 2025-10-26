/**
 * Test to verify BASE_URL is correctly configured and image URLs are generated properly
 */

require('dotenv').config();
const config = require('../config');
const imageStorage = require('../services/image-storage');

console.log('\n=== BASE_URL Configuration Test ===\n');

// Check environment variable
console.log('Environment Variable (BASE_URL):', process.env.BASE_URL || 'NOT SET');
console.log('Config Server BaseURL:', config.server.baseUrl);
console.log('Config Server Port:', config.server.port);

// Generate a test URL
const testFilename = 'test_1234567890_abcdef123456.png';
const testUrl = imageStorage.generatePublicUrl(testFilename, config.server.baseUrl);

console.log('\n=== Generated Test Image URL ===');
console.log(testUrl);

// Validate URL format
console.log('\n=== URL Validation ===');
if (testUrl.includes('localhost')) {
  console.log('⚠️  WARNING: URL contains localhost - images will not be accessible from A1Zap');
  console.log('   Make sure BASE_URL is set in your .env file');
} else if (testUrl.includes('ngrok') || testUrl.includes('https://')) {
  console.log('✅ URL looks good - uses public domain');
} else {
  console.log('⚠️  WARNING: URL format unexpected');
}

// Check A1Zap configuration
console.log('\n=== A1Zap Configuration ===');
console.log('A1Zap API Key:', config.a1zap.apiKey.includes('your_') ? '❌ NOT SET' : '✅ Set');
console.log('A1Zap Agent ID:', config.a1zap.agentId.includes('your_') ? '❌ NOT SET' : '✅ Set');
console.log('A1Zap API URL:', config.a1zap.apiUrl);

console.log('\n=== Expected Media Message Format ===');
console.log(JSON.stringify({
  chatId: "example_chat_id",
  content: "Here's your edited image!",
  media: {
    url: testUrl,
    contentType: "image/png"
  },
  metadata: {
    source: "gemini-webhook-agent",
    messageType: "image"
  }
}, null, 2));

console.log('\n');

