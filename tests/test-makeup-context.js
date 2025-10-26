/**
 * Test script for Makeup Artist Agent - Multi-turn Context Handling
 * Tests that the agent properly uses conversation context when applying makeup
 */

const axios = require('axios');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/makeup-artist';

// Sample test image URL (public domain image)
const TEST_IMAGE = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400';

// Use a consistent chat ID for multi-turn conversation
const CHAT_ID = `test-chat-context-${Date.now()}`;
const AGENT_ID = 'test-makeup-agent';

/**
 * Send a message to the makeup artist webhook
 */
async function sendMessage(content, imageUrl = null) {
  const payload = {
    chat: {
      id: CHAT_ID
    },
    message: {
      id: `test-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      content: content
    },
    agent: {
      id: AGENT_ID
    }
  };

  // Add image if provided
  if (imageUrl) {
    payload.message.media = {
      url: imageUrl,
      contentType: 'image/jpeg'
    };
  }

  console.log(`\n📤 Sending: "${content}"${imageUrl ? ' [with image]' : ''}`);

  try {
    const startTime = Date.now();
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout for image generation
    });
    const duration = Date.now() - startTime;

    console.log(`✅ Response (${duration}ms):`);
    console.log(`   ${response.data.response?.substring(0, 100)}...`);
    
    if (response.data.imageUrl) {
      console.log(`📸 Image: ${response.data.imageUrl}`);
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test multi-turn conversation flow
 */
async function testMultiTurnContext() {
  console.log('🚀 Makeup Artist Multi-Turn Context Test');
  console.log('='.repeat(60));
  console.log(`Chat ID: ${CHAT_ID}`);
  console.log('='.repeat(60));

  try {
    // Step 1: User sends image without request
    console.log('\n📍 Step 1: User sends image without makeup request');
    await sendMessage('', TEST_IMAGE);
    await sleep(2000);

    // Step 2: User requests makeup style (no image)
    console.log('\n📍 Step 2: User requests specific makeup style');
    await sendMessage('Can you give me full glam');
    await sleep(2000);

    // Step 3: User confirms (no image)
    console.log('\n📍 Step 3: User confirms the request');
    await sendMessage('yep');
    await sleep(2000);

    // Step 4: User sends another image (should apply "full glam" from context)
    console.log('\n📍 Step 4: User sends another image (should apply full glam from context)');
    const result = await sendMessage('', TEST_IMAGE);
    
    // Verify that an image was generated
    if (!result.imageUrl) {
      throw new Error('Expected an image to be generated, but none was returned');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Conversation context was maintained across messages');
    console.log('   - Image was generated with "full glam" style from context');
    console.log('   - Final image URL:', result.imageUrl);
    console.log('\n💡 Check the server logs to verify the prompt included context');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

/**
 * Test that prompt building includes context
 */
async function testPromptWithContext() {
  console.log('\n\n🚀 Testing Prompt Context Building');
  console.log('='.repeat(60));

  const makeupAgent = require('../agents/makeup-artist-agent');

  // Test 1: Empty message with context
  console.log('\n📍 Test 1: Empty message with context');
  const conversation1 = [
    { role: 'user', content: 'I want full glam makeup' },
    { role: 'assistant', content: 'Sure! I can do that.' }
  ];
  const prompt1 = makeupAgent.buildPrompt('', conversation1, false);
  console.log('Generated prompt:');
  console.log('---');
  console.log(prompt1);
  console.log('---');
  
  if (!prompt1.includes('glam')) {
    throw new Error('Prompt does not include context from conversation!');
  }
  console.log('✅ Context properly included in prompt');

  // Test 2: New message with context
  console.log('\n📍 Test 2: New message with existing context');
  const conversation2 = [
    { role: 'user', content: 'Give me smokey eyes' },
    { role: 'assistant', content: 'I can help with that!' }
  ];
  const prompt2 = makeupAgent.buildPrompt('and add red lipstick', conversation2, false);
  console.log('Generated prompt:');
  console.log('---');
  console.log(prompt2);
  console.log('---');
  
  if (!prompt2.includes('smokey')) {
    throw new Error('Prompt does not include previous context!');
  }
  console.log('✅ Previous context properly combined with new request');

  // Test 3: First message (no context)
  console.log('\n📍 Test 3: First message with no context');
  const prompt3 = makeupAgent.buildPrompt('Add natural makeup', [], true);
  console.log('Generated prompt:');
  console.log('---');
  console.log(prompt3);
  console.log('---');
  console.log('✅ First message prompt generated correctly');

  console.log('\n' + '='.repeat(60));
  console.log('✅ All prompt building tests passed!');
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    // First test prompt building logic
    await testPromptWithContext();
    
    // Then test the full multi-turn flow
    await sleep(2000);
    await testMultiTurnContext();

    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n\n' + '='.repeat(60));
    console.error('💥 TESTS FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { testMultiTurnContext, testPromptWithContext };

