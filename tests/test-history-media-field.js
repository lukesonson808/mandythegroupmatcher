/**
 * Test if the A1Zap message history API includes media fields
 * 
 * This will help us understand if the issue is:
 * 1. API doesn't return media in history
 * 2. Media field structure is different
 * 3. URL construction is wrong
 */


const a1zapClient = require('../services/a1zap-client');
const webhookHelpers = require('../services/webhook-helpers');

async function testHistoryMediaField() {
  console.log('\n=== Test: Message History Media Field ===\n');

  // Use a test chat ID - replace with a real one from your makeup artist conversation
  const TEST_CHAT_ID = process.argv[2];
  
  if (!TEST_CHAT_ID) {
    console.error('❌ Please provide a chat ID as an argument');
    console.log('\nUsage: node tests/test-history-media-field.js <chatId>');
    console.log('\nExample: node tests/test-history-media-field.js wc_abcd1234\n');
    process.exit(1);
  }

  console.log(`Chat ID: ${TEST_CHAT_ID}`);
  console.log('');

  try {
    // Step 1: Test raw API call
    console.log('Step 1: Fetching message history (raw)...');
    const messages = await a1zapClient.getMessageHistory(TEST_CHAT_ID, 20);
    
    console.log(`✅ Retrieved ${messages.length} messages`);
    console.log('');

    if (messages.length === 0) {
      console.log('⚠️  No messages found. This could mean:');
      console.log('   - The chat ID is incorrect');
      console.log('   - The API key doesn\'t have access to this chat');
      console.log('   - The chat is empty');
      return;
    }

    // Step 2: Examine message structure
    console.log('Step 2: Examining message structure...');
    console.log('');
    
    const firstMessage = messages[0];
    console.log('First message keys:', Object.keys(firstMessage));
    console.log('First message:', JSON.stringify(firstMessage, null, 2));
    console.log('');

    // Step 3: Look for messages with media
    console.log('Step 3: Searching for messages with media...');
    const messagesWithMedia = messages.filter(msg => msg.media);
    console.log(`Found ${messagesWithMedia.length} messages with media field`);
    console.log('');

    if (messagesWithMedia.length > 0) {
      console.log('✅ Media field EXISTS in message history!');
      console.log('Example media field:', JSON.stringify(messagesWithMedia[0].media, null, 2));
      console.log('');
    } else {
      console.log('❌ No media fields found in message history');
      console.log('This means images are NOT included in the history API response');
      console.log('');
      
      // Check if any message mentions images
      const mentionsImage = messages.filter(msg => 
        msg.content && (msg.content.includes('[Image]') || msg.content.includes('image'))
      );
      console.log(`Found ${mentionsImage.length} messages mentioning images in text`);
    }

    // Step 4: Test processMessageHistory with image tracking
    console.log('Step 4: Testing processMessageHistory with image tracking...');
    const agentId = 'test-agent';
    const processed = webhookHelpers.processMessageHistory(messages, agentId, true);
    
    console.log(`Processed ${processed.length} messages`);
    const processedWithImages = processed.filter(msg => msg.imageUrl);
    console.log(`Messages with imageUrl: ${processedWithImages.length}`);
    console.log('');

    if (processedWithImages.length > 0) {
      console.log('✅ Image URLs are being tracked!');
      processedWithImages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.content.substring(0, 50)}... -> ${msg.imageUrl}`);
      });
    } else {
      console.log('❌ No image URLs found after processing');
    }
    console.log('');

    // Step 5: Test findRecentImage
    console.log('Step 5: Testing findRecentImage helper...');
    const recentImage = webhookHelpers.findRecentImage(processed, 10);
    if (recentImage) {
      console.log('✅ Found recent image:', recentImage);
    } else {
      console.log('❌ No recent image found');
    }
    console.log('');

    // Step 6: Summary
    console.log('=== SUMMARY ===');
    console.log(`Total messages retrieved: ${messages.length}`);
    console.log(`Messages with media field: ${messagesWithMedia.length}`);
    console.log(`Processed messages with imageUrl: ${processedWithImages.length}`);
    console.log(`Recent image found: ${recentImage ? 'YES' : 'NO'}`);
    console.log('');

    if (messagesWithMedia.length === 0) {
      console.log('🔍 DIAGNOSIS:');
      console.log('The A1Zap message history API does NOT include media fields.');
      console.log('This means we CANNOT retrieve previous images from history.');
      console.log('');
      console.log('💡 SOLUTION OPTIONS:');
      console.log('1. Store images separately in our own database');
      console.log('2. Parse image URLs from message content if available');
      console.log('3. Ask A1Zap team if there\'s a way to include media in history');
      console.log('4. Use a different approach (e.g., session-based image tracking)');
    }

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error('Stack:', error.stack);
  }
}

testHistoryMediaField();

