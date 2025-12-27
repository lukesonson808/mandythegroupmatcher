/**
 * Multi-User Response Tracker
 * Tracks group conversations to ensure all members respond before Mandy replies
 */

const groupProfileStorage = require('./group-profile-storage');

/**
 * Get unique user IDs from raw message history
 * @param {Array} rawHistory - Raw message history from A1Zap API
 * @param {string} agentId - Agent ID to exclude from user count
 * @returns {Set<string>} Set of unique user IDs
 */
function getUniqueUserIds(rawHistory, agentId) {
  const userIds = new Set();
  
  if (!rawHistory || !Array.isArray(rawHistory)) {
    return userIds;
  }
  
  rawHistory.forEach(msg => {
    // Only count user messages (not agent messages)
    if (msg.senderId && msg.senderId !== agentId && !msg.isAgent) {
      userIds.add(msg.senderId);
    }
  });
  
  return userIds;
}

/**
 * Get or initialize question response state for a chat
 * @param {string} chatId - Chat ID
 * @returns {Object} Response tracking state
 */
function getResponseState(chatId) {
  const state = groupProfileStorage.getInterviewState(chatId);
  
  if (!state || !state.questionResponseTracking) {
    return {
      currentQuestionId: null,
      currentQuestionTimestamp: null,
      expectedUserIds: [],
      respondedUserIds: [],
      questionCount: 0
    };
  }
  
  return state.questionResponseTracking;
}

/**
 * Save response state for a chat
 * @param {string} chatId - Chat ID
 * @param {Object} responseState - Response tracking state
 */
function saveResponseState(chatId, responseState) {
  const state = groupProfileStorage.getInterviewState(chatId) || {};
  state.questionResponseTracking = responseState;
  groupProfileStorage.setInterviewState(chatId, state);
}

/**
 * Start tracking a new question
 * @param {string} chatId - Chat ID
 * @param {Array<string>} expectedUserIds - User IDs who should respond
 */
function startQuestionTracking(chatId, expectedUserIds) {
  const responseState = {
    currentQuestionId: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    currentQuestionTimestamp: Date.now(),
    expectedUserIds: expectedUserIds || [],
    respondedUserIds: [],
    questionCount: (getResponseState(chatId).questionCount || 0) + 1
  };
  
  saveResponseState(chatId, responseState);
  console.log(`📊 [Multi-User] Started tracking question ${responseState.questionCount} for ${expectedUserIds.length} users`);
  return responseState;
}

/**
 * Record a user's response to the current question
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID who responded
 * @returns {Object} { allResponded: boolean, responseState: Object }
 */
function recordUserResponse(chatId, userId) {
  const responseState = getResponseState(chatId);
  
  // If no question is being tracked, create a new one
  if (!responseState.currentQuestionId) {
    console.log(`⚠️  [Multi-User] User ${userId} responded but no question is being tracked`);
    return { allResponded: false, responseState };
  }
  
  // Add user to responded list if not already there
  if (!responseState.respondedUserIds.includes(userId)) {
    responseState.respondedUserIds.push(userId);
    saveResponseState(chatId, responseState);
    console.log(`✅ [Multi-User] User ${userId} responded (${responseState.respondedUserIds.length}/${responseState.expectedUserIds.length})`);
  }
  
  // Check if all users have responded
  const allResponded = responseState.expectedUserIds.length > 0 &&
                       responseState.expectedUserIds.every(id => responseState.respondedUserIds.includes(id));
  
  return { allResponded, responseState };
}

/**
 * Clear question tracking (call when Mandy responds)
 * @param {string} chatId - Chat ID
 */
function clearQuestionTracking(chatId) {
  const state = groupProfileStorage.getInterviewState(chatId) || {};
  state.questionResponseTracking = {
    currentQuestionId: null,
    currentQuestionTimestamp: null,
    expectedUserIds: [],
    respondedUserIds: [],
    questionCount: state.questionResponseTracking?.questionCount || 0
  };
  groupProfileStorage.setInterviewState(chatId, state);
  console.log(`🗑️  [Multi-User] Cleared question tracking for chat ${chatId}`);
}

/**
 * Check if we're currently waiting for responses
 * @param {string} chatId - Chat ID
 * @returns {boolean} True if waiting for responses
 */
function isWaitingForResponses(chatId) {
  const responseState = getResponseState(chatId);
  return responseState.currentQuestionId !== null && 
         responseState.expectedUserIds.length > 0 &&
         responseState.respondedUserIds.length < responseState.expectedUserIds.length;
}

/**
 * Get response status for logging
 * @param {string} chatId - Chat ID
 * @returns {string} Status string
 */
function getResponseStatus(chatId) {
  const responseState = getResponseState(chatId);
  if (!responseState.currentQuestionId) {
    return 'No question being tracked';
  }
  return `${responseState.respondedUserIds.length}/${responseState.expectedUserIds.length} users responded`;
}

module.exports = {
  getUniqueUserIds,
  getResponseState,
  saveResponseState,
  startQuestionTracking,
  recordUserResponse,
  clearQuestionTracking,
  isWaitingForResponses,
  getResponseStatus
};

