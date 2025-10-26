/**
 * Simple test to demonstrate the prompt building with context
 * Shows how the agent now includes conversation history in image generation prompts
 */

const makeupAgent = require('../agents/makeup-artist-agent');

console.log('🔍 Makeup Artist Agent - Prompt Building with Context\n');
console.log('='.repeat(70));

// Scenario 1: User discusses makeup, then uploads image
console.log('\n📌 SCENARIO 1: User discusses makeup style, then uploads image');
console.log('─'.repeat(70));

const conversation1 = [
  { role: 'user', content: 'Can you give me full glam' },
  { role: 'assistant', content: 'Absolutely! I can create a full glam look with smokey eyes, bold lashes, defined contouring, radiant highlight, and a classic red lip!' },
  { role: 'user', content: 'yep' },
  { role: 'assistant', content: 'Great! Please upload your image and I\'ll apply the full glam look.' }
];

const prompt1 = makeupAgent.buildPrompt('', conversation1, false);

console.log('\n💬 Conversation history:');
conversation1.forEach((msg, i) => {
  console.log(`  ${i + 1}. [${msg.role.toUpperCase()}]: ${msg.content.substring(0, 80)}...`);
});

console.log('\n📝 Generated prompt for Gemini (when user uploads image):');
console.log('┌' + '─'.repeat(68) + '┐');
prompt1.split('\n').forEach(line => {
  console.log(`│ ${line.padEnd(66)} │`);
});
console.log('└' + '─'.repeat(68) + '┘');

console.log('\n✅ Notice how "full glam" is extracted from the conversation history!\n');

// Scenario 2: User refines previous request
console.log('\n📌 SCENARIO 2: User refines their previous makeup request');
console.log('─'.repeat(70));

const conversation2 = [
  { role: 'user', content: 'Give me smokey eyes' },
  { role: 'assistant', content: 'I can create beautiful smokey eyes for you!' },
  { role: 'user', content: 'actually make them more dramatic' }
];

const prompt2 = makeupAgent.buildPrompt('and add red lipstick', conversation2, false);

console.log('\n💬 Conversation history:');
conversation2.forEach((msg, i) => {
  console.log(`  ${i + 1}. [${msg.role.toUpperCase()}]: ${msg.content.substring(0, 80)}...`);
});

console.log('\n📝 Generated prompt for Gemini (with refinement):');
console.log('┌' + '─'.repeat(68) + '┐');
prompt2.split('\n').forEach(line => {
  console.log(`│ ${line.padEnd(66)} │`);
});
console.log('└' + '─'.repeat(68) + '┘');

console.log('\n✅ Previous requests are chained together with the new one!\n');

// Scenario 3: First message (no context)
console.log('\n📌 SCENARIO 3: First message with no conversation history');
console.log('─'.repeat(70));

const conversation3 = [];
const prompt3 = makeupAgent.buildPrompt('Add natural makeup', conversation3, true);

console.log('\n💬 Conversation history: (empty - first message)');

console.log('\n📝 Generated prompt for Gemini:');
console.log('┌' + '─'.repeat(68) + '┐');
prompt3.split('\n').forEach(line => {
  console.log(`│ ${line.padEnd(66)} │`);
});
console.log('└' + '─'.repeat(68) + '┘');

console.log('\n✅ Works normally for first messages!\n');

// Scenario 4: [Image] placeholder with context (real world case)
console.log('\n📌 SCENARIO 4: "[Image]" placeholder with context (real world case)');
console.log('─'.repeat(70));

const conversation4 = [
  { role: 'user', content: 'Make me casino Royale glam' },
  { role: 'assistant', content: 'Alright, let\'s give you a Casino Royale glam look!' }
];
const prompt4 = makeupAgent.buildPrompt('[Image]', conversation4, false);

console.log('\n💬 Conversation history:');
conversation4.forEach((msg, i) => {
  console.log(`  ${i + 1}. [${msg.role.toUpperCase()}]: ${msg.content.substring(0, 80)}...`);
});
console.log('💬 User message: "[Image]" (placeholder from A1Zap)');

console.log('\n📝 Generated prompt for Gemini:');
console.log('┌' + '─'.repeat(68) + '┐');
prompt4.split('\n').forEach(line => {
  console.log(`│ ${line.padEnd(66)} │`);
});
console.log('└' + '─'.repeat(68) + '┘');

console.log('\n✅ "[Image]" placeholder is treated as empty and context is used!\n');

// Summary
console.log('='.repeat(70));
console.log('\n🎉 SUMMARY');
console.log('─'.repeat(70));
console.log('The buildPrompt function now:');
console.log('  ✓ Extracts makeup-related keywords from recent messages');
console.log('  ✓ Builds context from the last 6 messages in the conversation');
console.log('  ✓ Uses context when current message is empty or minimal');
console.log('  ✓ Chains multiple requests together for complex looks');
console.log('  ✓ Maintains backward compatibility with first messages');
console.log('\nThis ensures that when users discuss makeup styles and then upload');
console.log('images, the AI remembers what they requested and applies it correctly!');
console.log('\n' + '='.repeat(70));

