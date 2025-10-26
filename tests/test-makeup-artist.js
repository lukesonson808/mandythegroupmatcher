/**
 * Test script for Makeup Artist Agent
 * Tests the webhook endpoint with sample requests
 */

const axios = require('axios');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/makeup-artist';

// Sample test image URLs (public domain images)
const TEST_IMAGES = {
  portrait1: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  portrait2: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
};

/**
 * Test makeup artist webhook with a sample request
 */
async function testMakeupArtist(testName, message, imageUrl = null) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log('─'.repeat(60));

  const payload = {
    chat: {
      id: `test-chat-${Date.now()}`
    },
    message: {
      id: `test-msg-${Date.now()}`,
      content: message
    },
    agent: {
      id: 'test-makeup-agent'
    }
  };

  // Add image if provided
  if (imageUrl) {
    payload.message.media = {
      url: imageUrl,
      contentType: 'image/jpeg'
    };
  }

  try {
    console.log('Request:', JSON.stringify(payload, null, 2));
    
    const startTime = Date.now();
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout for image generation
    });
    const duration = Date.now() - startTime;

    console.log('\n✅ Success!');
    console.log(`Duration: ${duration}ms`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.imageUrl) {
      console.log(`\n📸 Generated image available at:`);
      console.log(`   ${response.data.imageUrl}`);
    }

    return response.data;
  } catch (error) {
    console.error('\n❌ Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Makeup Artist Agent Test Suite');
  console.log('='.repeat(60));

  try {
    // Test 1: No image (should prompt user to upload)
    await testMakeupArtist(
      'No Image Provided',
      'Can you help me with makeup?'
    );

    await sleep(2000); // Wait between tests

    // Test 2: Simple lipstick request
    await testMakeupArtist(
      'Add Red Lipstick',
      'Add red lipstick',
      TEST_IMAGES.portrait1
    );

    await sleep(2000);

    // Test 3: Complete makeup look
    await testMakeupArtist(
      'Natural Makeup Look',
      'Give me a natural everyday makeup look',
      TEST_IMAGES.portrait2
    );

    await sleep(2000);

    // Test 4: Specific combination
    await testMakeupArtist(
      'Smokey Eye with Nude Lips',
      'Create a smokey eye with nude lips',
      TEST_IMAGES.portrait1
    );

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('\nNote: Check the generated images at the URLs shown above.');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Tests failed. See errors above.');
    process.exit(1);
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { testMakeupArtist };

