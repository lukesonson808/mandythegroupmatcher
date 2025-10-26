/**
 * Test script for webhook-helpers.js
 * Verifies that all helper functions work correctly
 */

const webhookHelpers = require('../services/webhook-helpers');

console.log('\n🧪 Testing Webhook Helpers\n');
console.log('=' .repeat(60));

// Test 1: Payload Validation
console.log('\n1️⃣  Testing payload validation...');

const validPayload = {
  chat: { id: 'chat-123' },
  message: { id: 'msg-456', content: 'Hello!' },
  agent: { id: 'agent-789' }
};

const invalidPayload1 = {
  message: { content: 'Hello!' }
};

const invalidPayload2 = {
  chat: { id: 'chat-123' }
};

const result1 = webhookHelpers.validateWebhookPayload(validPayload);
console.log('✓ Valid payload:', result1.valid ? '✅ PASS' : '❌ FAIL');
console.log('  Data:', result1.data);

const result2 = webhookHelpers.validateWebhookPayload(invalidPayload1);
console.log('✓ Invalid payload (missing chat):', !result2.valid ? '✅ PASS' : '❌ FAIL');
console.log('  Error:', result2.error);

const result3 = webhookHelpers.validateWebhookPayload(invalidPayload2);
console.log('✓ Invalid payload (missing message):', !result3.valid ? '✅ PASS' : '❌ FAIL');
console.log('  Error:', result3.error);

// Test 2: Message Deduplication
console.log('\n2️⃣  Testing message deduplication...');

const testMessageId = 'test-msg-' + Date.now();

console.log('✓ First check (should be false):', 
  !webhookHelpers.isDuplicateMessage(testMessageId) ? '✅ PASS' : '❌ FAIL');

webhookHelpers.markMessageProcessed(testMessageId);

console.log('✓ Second check (should be true):', 
  webhookHelpers.isDuplicateMessage(testMessageId) ? '✅ PASS' : '❌ FAIL');

const stats = webhookHelpers.getDeduplicationStats();
console.log('✓ Deduplication stats:', stats);

// Test 3: Test Chat Detection
console.log('\n3️⃣  Testing test chat detection...');

console.log('✓ Regular chat:', 
  !webhookHelpers.isTestChat('chat-123') ? '✅ PASS' : '❌ FAIL');

console.log('✓ Test chat:', 
  webhookHelpers.isTestChat('test-chat-123') ? '✅ PASS' : '❌ FAIL');

// Test 4: Message History Processing
console.log('\n4️⃣  Testing message history processing...');

const mockHistory = [
  {
    content: 'Hello!',
    isAgent: false,
    senderId: 'user-1',
    senderName: 'John'
  },
  {
    content: 'Hi there!',
    isAgent: true,
    senderId: 'agent-1'
  },
  {
    content: 'How are you?',
    isAgent: false,
    senderId: 'user-1',
    senderName: 'John'
  },
  {
    content: { type: 'file', data: {} }, // Should be skipped
    isAgent: false,
    senderId: 'user-1'
  }
];

const conversation = webhookHelpers.processMessageHistory(mockHistory, 'agent-1');
console.log('✓ Processed conversation:', conversation.length === 3 ? '✅ PASS' : '❌ FAIL');
console.log('  Messages processed:', conversation.length);
console.log('  Sample:', JSON.stringify(conversation[0], null, 2));

// Test 5: Rich Content Block Creation
console.log('\n5️⃣  Testing rich content block creation...');

const singleBlock = webhookHelpers.createSocialShareBlock('tiktok', 'https://tiktok.com/video/123', 0);
console.log('✓ Single block created:', 
  singleBlock.type === 'social_share' && singleBlock.data.platform === 'tiktok' ? '✅ PASS' : '❌ FAIL');
console.log('  Block:', JSON.stringify(singleBlock, null, 2));

const links = [
  { platform: 'instagram', url: 'https://instagram.com/1' },
  { platform: 'tiktok', url: 'https://tiktok.com/2' },
  { url: 'https://youtube.com/3' } // No platform specified
];

const blocks = webhookHelpers.createSocialShareBlocks(links, 'youtube');
console.log('✓ Multiple blocks created:', blocks.length === 3 ? '✅ PASS' : '❌ FAIL');
console.log('  Blocks:', blocks.length);
console.log('  Third block platform (should use default):', 
  blocks[2].data.platform === 'youtube' ? '✅ PASS' : '❌ FAIL');

// Test 6: Empty blocks
console.log('\n6️⃣  Testing edge cases...');

const emptyBlocks = webhookHelpers.createSocialShareBlocks([]);
console.log('✓ Empty links array:', emptyBlocks.length === 0 ? '✅ PASS' : '❌ FAIL');

const nullBlocks = webhookHelpers.createSocialShareBlocks(null);
console.log('✓ Null links:', nullBlocks.length === 0 ? '✅ PASS' : '❌ FAIL');

const emptyHistory = webhookHelpers.processMessageHistory([], 'agent-1');
console.log('✓ Empty history:', emptyHistory.length === 0 ? '✅ PASS' : '❌ FAIL');

console.log('\n' + '='.repeat(60));
console.log('✅ All webhook helper tests completed!\n');

// Test 7: Verify deduplication expires
console.log('7️⃣  Bonus: Deduplication expiry info');
console.log('✓ Messages expire after:', stats.expiryMs / 1000 / 60, 'minutes');
console.log('✓ Cleanup runs every: 60 seconds');
console.log('✓ Currently tracking:', stats.totalTracked, 'messages\n');


