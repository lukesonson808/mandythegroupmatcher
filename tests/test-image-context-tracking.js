/**
 * Test Image Context Tracking in Makeup Artist Agent
 * 
 * This test verifies that the makeup artist properly tracks:
 * 1. Previous images in conversation history
 * 2. Previous makeup requests/styles
 * 3. References to "this image" or "same style"
 * 4. Confirmations like "Yes" that refer to previous context
 */

const webhookHelpers = require('../services/webhook-helpers');
const makeupArtistAgent = require('../agents/makeup-artist-agent');

// Mock conversation history simulating the user's reported issue
const mockConversationHistory = [
  {
    role: 'user',
    content: '[Image]',
    imageUrl: 'https://example.com/image1.jpg'
  },
  {
    role: 'assistant',
    content: "I've applied a natural makeup look with a subtle pink lipstick, and added some eyeliner to enhance the eyes."
  },
  {
    role: 'user',
    content: 'Apply it to this image too',
    imageUrl: 'https://example.com/image2.jpg'
  }
];

const mockConversationWithMultipleImages = [
  {
    role: 'user',
    content: '[Image]',
    imageUrl: 'https://example.com/image1.jpg'
  },
  {
    role: 'assistant',
    content: "I've applied a natural makeup look with a subtle pink lipstick."
  },
  {
    role: 'user',
    content: '[Image]',
    imageUrl: 'https://example.com/image2.jpg'
  },
  {
    role: 'user',
    content: '[Image]',
    imageUrl: 'https://example.com/image3.jpg'
  },
  {
    role: 'user',
    content: 'Can you make them slimmer and the lips blue'
  },
  {
    role: 'assistant',
    content: 'Would you like me to proceed with these changes?'
  },
  {
    role: 'user',
    content: 'Yes'
  }
];

console.log('\n=== Test: Image Context Tracking ===\n');

// Test 1: Find Recent Image
console.log('Test 1: Find Recent Image');
console.log('---');
const recentImage = webhookHelpers.findRecentImage(mockConversationWithMultipleImages, 5);
console.log('Recent image found:', recentImage);
console.log('✅ Expected: https://example.com/image3.jpg');
console.log('✅ Actual:', recentImage);
console.log('Result:', recentImage === 'https://example.com/image3.jpg' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 2: Extract Previous Makeup Request
console.log('Test 2: Extract Previous Makeup Request');
console.log('---');
const previousRequest = webhookHelpers.extractPreviousMakeupRequest(mockConversationWithMultipleImages, 10);
console.log('Previous makeup request:', previousRequest);
console.log('✅ Expected: "Can you make them slimmer and the lips blue"');
console.log('✅ Actual:', previousRequest);
console.log('Result:', previousRequest === 'Can you make them slimmer and the lips blue' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 3: Build Prompt with "Apply it to this image too"
console.log('Test 3: Build Prompt - "Apply it to this image too"');
console.log('---');
const prompt1 = makeupArtistAgent.buildPrompt(
  'Apply it to this image too',
  mockConversationHistory.slice(0, 2), // Just the first exchange
  false
);
console.log('Generated prompt:');
console.log(prompt1);
console.log('');
console.log('Should reference previous style:', 
  prompt1.includes('natural makeup') || prompt1.includes('pink lipstick') ? '✅ PASS' : '❌ FAIL'
);
console.log('');

// Test 4: Build Prompt with "Yes" after substantive request
console.log('Test 4: Build Prompt - "Yes" with context');
console.log('---');
const prompt2 = makeupArtistAgent.buildPrompt(
  'Yes',
  mockConversationWithMultipleImages.slice(0, 5), // Up to the makeup request
  false
);
console.log('Generated prompt:');
console.log(prompt2);
console.log('');
console.log('Should reference "slimmer and blue lips":', 
  prompt2.includes('slimmer') || prompt2.includes('blue') ? '✅ PASS' : '❌ FAIL'
);
console.log('');

// Test 5: Process Message History with Image Tracking
console.log('Test 5: Process Message History with Image Tracking');
console.log('---');
const mockRawHistory = [
  {
    senderId: 'user123',
    content: 'First message with image',
    media: { url: 'https://example.com/img1.jpg' }
  },
  {
    senderId: 'agent456',
    isAgent: true,
    content: 'Applied makeup'
  },
  {
    senderId: 'user123',
    content: 'Apply it here too',
    media: { url: 'https://example.com/img2.jpg' }
  },
  {
    senderId: 'user123',
    media: { url: 'https://example.com/img3.jpg' }
    // No content - just an image
  }
];

const processedWithImages = webhookHelpers.processMessageHistory(mockRawHistory, 'agent456', true);
console.log('Processed conversation with images:');
processedWithImages.forEach((msg, i) => {
  console.log(`${i + 1}. ${msg.role}: ${msg.content}${msg.imageUrl ? ` [Image: ${msg.imageUrl}]` : ''}`);
});
console.log('');
console.log('Should have 4 messages:', processedWithImages.length === 4 ? '✅ PASS' : '❌ FAIL');
console.log('Should include image URLs:', 
  processedWithImages.filter(m => m.imageUrl).length === 3 ? '✅ PASS' : '❌ FAIL'
);
console.log('Should include image-only message:', 
  processedWithImages.some(m => m.content === '[Image]' && m.imageUrl) ? '✅ PASS' : '❌ FAIL'
);
console.log('');

// Test 6: Process History without Image Tracking (backward compatibility)
console.log('Test 6: Process History without Image Tracking (backward compatibility)');
console.log('---');
const processedWithoutImages = webhookHelpers.processMessageHistory(mockRawHistory, 'agent456', false);
console.log('Processed conversation without images:');
processedWithoutImages.forEach((msg, i) => {
  console.log(`${i + 1}. ${msg.role}: ${msg.content}`);
});
console.log('');
console.log('Should have 3 messages (excludes image-only):', 
  processedWithoutImages.length === 3 ? '✅ PASS' : '❌ FAIL'
);
console.log('Should NOT include imageUrl fields:', 
  processedWithoutImages.every(m => !m.imageUrl) ? '✅ PASS' : '❌ FAIL'
);
console.log('');

console.log('=== All Tests Complete ===\n');

