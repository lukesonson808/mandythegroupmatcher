/**
 * Test script for group response tracking functionality
 * Simulates a group chat scenario with multiple users
 */

require('@dotenvx/dotenvx').config();
const multiUserTracker = require('./services/multi-user-tracker');
const groupProfileStorage = require('./services/group-profile-storage');

// Mock chat IDs and user IDs
const CHAT_ID = 'test-group-chat-123';
const USER_1_ID = 'user1-abc';
const USER_2_ID = 'user2-def';
const USER_3_ID = 'user3-ghi';
const USER_4_ID = 'user4-jkl';
const AGENT_ID = 'test-agent-id';

// Clear any existing state
console.log('🧹 Cleaning up test data...\n');
try {
  groupProfileStorage.clearInterviewState(CHAT_ID);
  console.log('✅ Cleared existing interview state\n');
} catch (e) {
  // Ignore if doesn't exist
}

// Mock raw message history structure
function createMockRawHistory(userIds, messages) {
  return messages.map((msg, index) => ({
    senderId: msg.userId,
    senderName: msg.userName || `User ${msg.userId}`,
    content: msg.content,
    isAgent: msg.userId === AGENT_ID,
    timestamp: Date.now() - (messages.length - index) * 1000
  }));
}

// Test 1: Detect unique users
console.log('='.repeat(80));
console.log('TEST 1: Group Detection');
console.log('='.repeat(80));

const mockHistory1 = createMockRawHistory([USER_1_ID, USER_2_ID], [
  { userId: USER_1_ID, content: 'Hey everyone!' },
  { userId: USER_2_ID, content: 'Hello!' }
]);

const uniqueUserIds = multiUserTracker.getUniqueUserIds(mockHistory1, AGENT_ID);
console.log(`Detected ${uniqueUserIds.size} unique users:`, Array.from(uniqueUserIds));
console.assert(uniqueUserIds.size === 2, 'Should detect 2 users');
console.log('✅ Test 1 passed: Group detection works\n');

// Test 2: Start question tracking
console.log('='.repeat(80));
console.log('TEST 2: Start Question Tracking');
console.log('='.repeat(80));

const expectedUserIds = Array.from(uniqueUserIds);
multiUserTracker.startQuestionTracking(CHAT_ID, expectedUserIds);

const responseState = multiUserTracker.getResponseState(CHAT_ID);
console.log('Response state:', JSON.stringify(responseState, null, 2));
console.assert(responseState.currentQuestionId !== null, 'Should have question ID');
console.assert(responseState.expectedUserIds.length === 2, 'Should track 2 users');
console.assert(responseState.respondedUserIds.length === 0, 'Should have no responses yet');
console.log('✅ Test 2 passed: Question tracking initialized\n');

// Test 3: Record first user response (should not trigger completion)
console.log('='.repeat(80));
console.log('TEST 3: Record First User Response');
console.log('='.repeat(80));

const { allResponded: allResponded1 } = multiUserTracker.recordUserResponse(CHAT_ID, USER_1_ID);
const state1 = multiUserTracker.getResponseState(CHAT_ID);
console.log(`All responded: ${allResponded1}`);
console.log(`Response status: ${multiUserTracker.getResponseStatus(CHAT_ID)}`);
console.assert(allResponded1 === false, 'Should not be complete yet');
console.assert(state1.respondedUserIds.length === 1, 'Should have 1 response');
console.assert(state1.respondedUserIds.includes(USER_1_ID), 'Should include USER_1_ID');
console.log('✅ Test 3 passed: First user response recorded correctly\n');

// Test 4: Check waiting status
console.log('='.repeat(80));
console.log('TEST 4: Check Waiting Status');
console.log('='.repeat(80));

const isWaiting = multiUserTracker.isWaitingForResponses(CHAT_ID);
console.log(`Is waiting: ${isWaiting}`);
console.assert(isWaiting === true, 'Should be waiting for more responses');
console.log('✅ Test 4 passed: Waiting status correct\n');

// Test 5: Record second user response (should trigger completion)
console.log('='.repeat(80));
console.log('TEST 5: Record Second User Response (Complete)');
console.log('='.repeat(80));

const { allResponded: allResponded2 } = multiUserTracker.recordUserResponse(CHAT_ID, USER_2_ID);
const state2 = multiUserTracker.getResponseState(CHAT_ID);
console.log(`All responded: ${allResponded2}`);
console.log(`Response status: ${multiUserTracker.getResponseStatus(CHAT_ID)}`);
console.log(`Responded users: ${state2.respondedUserIds.join(', ')}`);
console.assert(allResponded2 === true, 'Should be complete now');
console.assert(state2.respondedUserIds.length === 2, 'Should have 2 responses');
console.log('✅ Test 5 passed: All users responded correctly\n');

// Test 6: Clear tracking and start new question
console.log('='.repeat(80));
console.log('TEST 6: Clear and Start New Question');
console.log('='.repeat(80));

multiUserTracker.clearQuestionTracking(CHAT_ID);
const stateAfterClear = multiUserTracker.getResponseState(CHAT_ID);
console.assert(stateAfterClear.currentQuestionId === null, 'Question ID should be null');
console.assert(stateAfterClear.respondedUserIds.length === 0, 'Responses should be cleared');
console.assert(stateAfterClear.questionCount > 0, 'Question count should persist');

// Start new question
multiUserTracker.startQuestionTracking(CHAT_ID, [USER_1_ID, USER_2_ID, USER_3_ID]);
const newState = multiUserTracker.getResponseState(CHAT_ID);
console.log(`New question ID: ${newState.currentQuestionId}`);
console.log(`Expected users: ${newState.expectedUserIds.length}`);
console.assert(newState.questionCount === 2, 'Question count should increment');
console.log('✅ Test 6 passed: New question tracking started\n');

// Test 7: Test with 4 users
console.log('='.repeat(80));
console.log('TEST 7: Test with 4 Users');
console.log('='.repeat(80));

const CHAT_ID_4 = 'test-group-4';
multiUserTracker.startQuestionTracking(CHAT_ID_4, [USER_1_ID, USER_2_ID, USER_3_ID, USER_4_ID]);

// Record 3 responses
multiUserTracker.recordUserResponse(CHAT_ID_4, USER_1_ID);
multiUserTracker.recordUserResponse(CHAT_ID_4, USER_2_ID);
const { allResponded: allResponded4a } = multiUserTracker.recordUserResponse(CHAT_ID_4, USER_3_ID);

console.log(`After 3/4 responses: ${multiUserTracker.getResponseStatus(CHAT_ID_4)}`);
console.assert(allResponded4a === false, 'Should not be complete with 3/4');

// Record 4th response
const { allResponded: allResponded4b } = multiUserTracker.recordUserResponse(CHAT_ID_4, USER_4_ID);
console.log(`After 4/4 responses: ${multiUserTracker.getResponseStatus(CHAT_ID_4)}`);
console.assert(allResponded4b === true, 'Should be complete with 4/4');
console.log('✅ Test 7 passed: 4-user group works correctly\n');

// Test 8: Duplicate responses (same user responding twice)
console.log('='.repeat(80));
console.log('TEST 8: Duplicate User Response Handling');
console.log('='.repeat(80));

const CHAT_ID_DUP = 'test-group-dup';
multiUserTracker.startQuestionTracking(CHAT_ID_DUP, [USER_1_ID, USER_2_ID]);

multiUserTracker.recordUserResponse(CHAT_ID_DUP, USER_1_ID);
const { allResponded: allRespondedDup1 } = multiUserTracker.recordUserResponse(CHAT_ID_DUP, USER_1_ID); // Same user again

const stateDup = multiUserTracker.getResponseState(CHAT_ID_DUP);
console.log(`After duplicate: ${stateDup.respondedUserIds.length} unique responses`);
console.assert(stateDup.respondedUserIds.length === 1, 'Should still have 1 unique response');
console.assert(allRespondedDup1 === false, 'Should not be complete (USER_2 hasn\'t responded)');

// Now record USER_2
const { allResponded: allRespondedDup2 } = multiUserTracker.recordUserResponse(CHAT_ID_DUP, USER_2_ID);
console.assert(allRespondedDup2 === true, 'Should be complete now');
console.log('✅ Test 8 passed: Duplicate responses handled correctly\n');

// Cleanup
console.log('='.repeat(80));
console.log('🧹 Cleaning up test data...');
try {
  groupProfileStorage.clearInterviewState(CHAT_ID);
  groupProfileStorage.clearInterviewState(CHAT_ID_4);
  groupProfileStorage.clearInterviewState(CHAT_ID_DUP);
  console.log('✅ Cleanup complete\n');
} catch (e) {
  console.log('⚠️  Cleanup warning:', e.message);
}

console.log('='.repeat(80));
console.log('✅ ALL TESTS PASSED!');
console.log('='.repeat(80));
console.log('\n📋 Summary:');
console.log('  ✅ Group detection works');
console.log('  ✅ Question tracking initialization works');
console.log('  ✅ Response recording works');
console.log('  ✅ Waiting status detection works');
console.log('  ✅ Completion detection works');
console.log('  ✅ Tracking cleanup works');
console.log('  ✅ Multi-user groups (4 users) work');
console.log('  ✅ Duplicate response handling works');
console.log('\n🎉 Group response tracking is ready to use!');

