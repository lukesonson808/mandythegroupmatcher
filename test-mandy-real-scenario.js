/**
 * Test simulating the real scenario from the conversation
 * Tests the case where Mandy asks a question and waits for responses
 */

require('@dotenvx/dotenvx').config();
const multiUserTracker = require('./services/multi-user-tracker');
const groupProfileStorage = require('./services/group-profile-storage');

const CHAT_ID = 'test-real-scenario-123';
const USER_1_ID = 'luke-sonson-id';
const USER_2_ID = 'user2-id';
const AGENT_ID = 'mandy-agent-id';

// Clear state
console.log('🧹 Cleaning up...\n');
try {
  groupProfileStorage.clearInterviewState(CHAT_ID);
} catch (e) {}

// Simulate the scenario step by step
console.log('='.repeat(80));
console.log('REAL SCENARIO TEST: Mandy asks question, waits for both users');
console.log('='.repeat(80));
console.log('');

// Step 1: User 1 says "Ready" (first message)
console.log('📨 STEP 1: User 1 (Luke) says "Ready"');
let rawHistory = [
  { senderId: USER_1_ID, senderName: 'Luke Sonson', content: 'Ready', isAgent: false }
];
let uniqueUserIds = multiUserTracker.getUniqueUserIds(rawHistory, AGENT_ID);
console.log(`   Detected ${uniqueUserIds.size} user(s): ${Array.from(uniqueUserIds).join(', ')}`);
console.assert(uniqueUserIds.size === 1, 'Should detect 1 user initially');
console.log('   → Mandy asks: "are you flying solo or is this a group situation?"');
console.log('   → Tracking starts? NO (only 1 user detected, so individual chat)\n');

// Step 2: User 1 responds "It's two of us"
console.log('📨 STEP 2: User 1 responds "It\'s two of us"');
rawHistory.push({ senderId: USER_1_ID, senderName: 'Luke Sonson', content: 'It\'s two of us', isAgent: false });
uniqueUserIds = multiUserTracker.getUniqueUserIds(rawHistory, AGENT_ID);
console.log(`   Detected ${uniqueUserIds.size} user(s): ${Array.from(uniqueUserIds).join(', ')}`);
console.log('   → Still only 1 user ID detected (User 2 hasn\'t sent a message yet)');
console.log('   → This is the problem: We can\'t track for 2 users if we only know about 1 user ID\n');

// Step 3: User 1 says "it's two of us" again (duplicate)
console.log('📨 STEP 3: User 1 says "it\'s two of us" again');
rawHistory.push({ senderId: USER_1_ID, senderName: 'Luke Sonson', content: 'it\'s two of us', isAgent: false });
uniqueUserIds = multiUserTracker.getUniqueUserIds(rawHistory, AGENT_ID);
console.log(`   Detected ${uniqueUserIds.size} user(s): ${Array.from(uniqueUserIds).join(', ')}`);
console.log('   → Still only 1 user ID detected');
console.log('   → Mandy should respond, but she\'s waiting for tracking that never started correctly\n');

// Now let's test what happens if User 2 actually sends a message
console.log('\n📨 STEP 4: User 2 joins and sends "ready"');
rawHistory.push({ senderId: USER_2_ID, senderName: 'User 2', content: 'ready', isAgent: false });
uniqueUserIds = multiUserTracker.getUniqueUserIds(rawHistory, AGENT_ID);
console.log(`   Detected ${uniqueUserIds.size} user(s): ${Array.from(uniqueUserIds).join(', ')}`);
console.assert(uniqueUserIds.size === 2, 'Should now detect 2 users');
console.log('   → Now we can start tracking for 2 users!\n');

// Test the actual tracking flow with 2 users
console.log('📨 STEP 5: Simulating Mandy asking a question');
console.log('   → Mandy asks: "What should I call you/your crew?"');
multiUserTracker.startQuestionTracking(CHAT_ID, Array.from(uniqueUserIds));
const state1 = multiUserTracker.getResponseState(CHAT_ID);
console.log(`   → Tracking started for ${state1.expectedUserIds.length} users: ${state1.expectedUserIds.join(', ')}`);
console.assert(state1.expectedUserIds.length === 2, 'Should track 2 users');

// Step 6: User 1 responds
console.log('\n📨 STEP 6: User 1 responds');
const { allResponded: all1 } = multiUserTracker.recordUserResponse(CHAT_ID, USER_1_ID);
const state2 = multiUserTracker.getResponseState(CHAT_ID);
console.log(`   → ${state2.respondedUserIds.length}/${state2.expectedUserIds.length} users responded`);
console.log(`   → All responded? ${all1}`);
console.assert(all1 === false, 'Should NOT be complete yet');
console.assert(state2.respondedUserIds.includes(USER_1_ID), 'Should include USER_1_ID');

// Step 7: User 2 responds
console.log('\n📨 STEP 7: User 2 responds');
const { allResponded: all2 } = multiUserTracker.recordUserResponse(CHAT_ID, USER_2_ID);
const state3 = multiUserTracker.getResponseState(CHAT_ID);
console.log(`   → ${state3.respondedUserIds.length}/${state3.expectedUserIds.length} users responded`);
console.log(`   → All responded? ${all2}`);
console.assert(all2 === true, 'Should be complete now');
console.assert(state3.respondedUserIds.includes(USER_2_ID), 'Should include USER_2_ID');
console.log('   → ✅ Mandy can now respond!\n');

// Cleanup
console.log('🧹 Cleaning up...');
try {
  groupProfileStorage.clearInterviewState(CHAT_ID);
  console.log('✅ Cleanup complete\n');
} catch (e) {}

console.log('='.repeat(80));
console.log('✅ TEST COMPLETE');
console.log('='.repeat(80));
console.log('\n💡 KEY INSIGHT:');
console.log('   The issue is that group tracking requires knowing the actual user IDs.');
console.log('   If User 2 hasn\'t sent a message yet, we can\'t detect their user ID.');
console.log('   Solution: Don\'t start tracking until we detect all expected users.');
console.log('   OR: Start tracking when user says "it\'s two of us" and wait for the second user to join.');

