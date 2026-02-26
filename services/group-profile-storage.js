/**
 * Group Profile Storage Service
 * 
 * Manages group profiles and interview state for Mandy the Group Matchmaker.
 * Stores:
 * - Interview state per chat (which question, answers collected)
 * - Completed group profiles (for matching)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PROFILES_FILE = path.join(DATA_DIR, 'group-profiles.json');
const STATE_FILE = path.join(DATA_DIR, 'interview-state.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

function safeLower(value) {
  return String(value ?? '').toLowerCase();
}

function normalizeGroupName(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const groupName =
    profile.groupName ||
    profile.name ||
    profile.group_name ||
    profile.answers?.question1 ||
    profile.answers?.q1;

  if (groupName && !profile.groupName) {
    return { ...profile, groupName };
  }
  return profile;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Initialize data files if they don't exist
 */
function initializeFiles() {
  if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify({ groups: [] }, null, 2));
  }
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));
  }
  if (!fs.existsSync(MATCHES_FILE)) {
    fs.writeFileSync(MATCHES_FILE, JSON.stringify({ matches: [] }, null, 2));
  }
}

// Initialize on load
initializeFiles();

/**
 * Load group profiles from file
 * @returns {Object} { groups: Array }
 */
function loadProfiles() {
  try {
    const data = fs.readFileSync(PROFILES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading profiles:', error);
    return { groups: [] };
  }
}

/**
 * Save group profiles to file
 * @param {Object} data - { groups: Array }
 */
function saveProfiles(data) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving profiles:', error);
    throw error;
  }
}

/**
 * Load interview state from file
 * @returns {Object} { chatId: { questionNumber, answers, groupName, ... } }
 */
function loadState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading state:', error);
    return {};
  }
}

/**
 * Save interview state to file
 * @param {Object} state - { chatId: { ... } }
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving state:', error);
    throw error;
  }
}

/**
 * Get interview state for a chat
 * @param {string} chatId - Chat ID
 * @returns {Object|null} Interview state or null
 */
function getInterviewState(chatId) {
  const state = loadState();
  return state[chatId] || null;
}

/**
 * Set interview state for a chat
 * @param {string} chatId - Chat ID
 * @param {Object} interviewState - State object
 */
function setInterviewState(chatId, interviewState) {
  const state = loadState();
  state[chatId] = interviewState;
  saveState(state);
}

/**
 * Clear interview state for a chat (after completion)
 * @param {string} chatId - Chat ID
 */
function clearInterviewState(chatId) {
  const state = loadState();
  delete state[chatId];
  saveState(state);
}

/**
 * Check if a group name already exists
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if exists
 */
function groupNameExists(groupName) {
  const profiles = loadProfiles();
  if (!groupName) return false;
  return profiles.groups.some(g => 
    g.groupName && safeLower(g.groupName) === safeLower(groupName)
  );
}

/**
 * Save a completed group profile
 * @param {Object} profile - Group profile object
 * @returns {Object} Saved profile with ID
 */
function saveGroupProfile(profile) {
  const profiles = loadProfiles();
  
  // Add metadata
  const fullProfile = {
    ...profile,
    id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    profileVersion: '1.0'
  };
  
  profiles.groups.push(fullProfile);
  saveProfiles(profiles);
  
  console.log(`✅ Saved group profile: ${fullProfile.groupName} (ID: ${fullProfile.id})`);
  return fullProfile;
}

/**
 * Get all group profiles
 * @returns {Array} Array of group profiles
 */
function getAllProfiles() {
  const profiles = loadProfiles();
  return (profiles.groups || []).map(normalizeGroupName);
}

/**
 * Get a profile by group name
 * @param {string} groupName - Group name
 * @returns {Object|null} Profile or null
 */
function getProfileByGroupName(groupName) {
  const profiles = loadProfiles();
  if (!groupName) return null;
  return profiles.groups.find(g => 
    g.groupName && safeLower(g.groupName) === safeLower(groupName)
  ) || null;
}

/**
 * Get a profile by chat ID
 * @param {string} chatId - Chat ID
 * @returns {Object|null} Profile or null
 */
function getProfileByChatId(chatId) {
  const profiles = loadProfiles();
  return profiles.groups.find(g => g.chatId === chatId) || null;
}

/**
 * Get a profile by group name and email (or chatId)
 * Uses composite key to prevent groups with same name but different emails from overwriting each other
 * @param {string} groupName - Group name
 * @param {string} email - Email address (optional)
 * @param {string} chatId - Chat ID (optional, takes precedence over email)
 * @returns {Object|null} Profile or null
 */
function getProfileByCompositeKey(groupName, email = null, chatId = null) {
  const profiles = loadProfiles();
  if (!groupName && !chatId) return null;
  
  // If chatId is provided, use it as primary identifier
  if (chatId) {
    const byChatId = profiles.groups.find(g => g.chatId === chatId);
    if (byChatId) return byChatId;
  }
  
  // Otherwise, match by name + email
  if (email) {
    const byNameAndEmail = profiles.groups.find(g => 
      g.groupName && safeLower(g.groupName) === safeLower(groupName) &&
      g.email && safeLower(g.email) === safeLower(email)
    );
    if (byNameAndEmail) return byNameAndEmail;
  }
  
  // Fallback to name only (for backward compatibility)
  return profiles.groups.find(g => 
    g.groupName && safeLower(g.groupName) === safeLower(groupName)
  ) || null;
}

/**
 * Update an existing group profile
 * @param {string} groupName - Group name to update
 * @param {Object} updates - Fields to update
 * @param {string} email - Email address (optional, for composite key)
 * @param {string} chatId - Chat ID (optional, takes precedence over email)
 * @returns {Object|null} Updated profile or null if not found
 */
function updateGroupProfile(groupName, updates, email = null, chatId = null) {
  const profiles = loadProfiles();
  if (!groupName && !chatId) return null;
  
  let groupIndex = -1;
  
  // If chatId is provided, use it as primary identifier
  if (chatId) {
    groupIndex = profiles.groups.findIndex(g => g.chatId === chatId);
  }
  
  // Otherwise, match by name + email
  if (groupIndex === -1 && email) {
    groupIndex = profiles.groups.findIndex(g => 
      g.groupName && safeLower(g.groupName) === safeLower(groupName) &&
      g.email && safeLower(g.email) === safeLower(email)
    );
  }
  
  // Fallback to name only (for backward compatibility)
  if (groupIndex === -1) {
    groupIndex = profiles.groups.findIndex(g => 
      g.groupName && safeLower(g.groupName) === safeLower(groupName)
    );
  }
  
  if (groupIndex === -1) {
    return null;
  }
  
  // Update the profile
  profiles.groups[groupIndex] = {
    ...profiles.groups[groupIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  saveProfiles(profiles);
  console.log(`✅ Updated group profile: ${groupName}${email ? ` (${email})` : ''}`);
  return profiles.groups[groupIndex];
}

/**
 * Update an existing profile
 * @param {string} chatId - Chat ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated profile or null if not found
 */
function updateProfile(chatId, updates) {
  const profiles = loadProfiles();
  const profileIndex = profiles.groups.findIndex(g => g.chatId === chatId);
  
  if (profileIndex === -1) {
    return null;
  }
  
  // Merge updates
  profiles.groups[profileIndex] = {
    ...profiles.groups[profileIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  saveProfiles(profiles);
  console.log(`✅ Updated profile for chat ${chatId}`);
  return profiles.groups[profileIndex];
}

/**
 * Load matches from file
 * @returns {Object} { matches: Array }
 */
function loadMatches() {
  try {
    const data = fs.readFileSync(MATCHES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading matches:', error);
    return { matches: [] };
  }
}

/**
 * Save matches to file
 * @param {Object} data - { matches: Array }
 */
function saveMatches(data) {
  try {
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving matches:', error);
    throw error;
  }
}

/**
 * Save a match result
 * @param {Object} match - Match object { group1, group2, compatibility, matchedAt }
 */
function saveMatch(match) {
  const matchesData = loadMatches();
  
  // Check if this match already exists (same pair)
  const existingIndex = matchesData.matches.findIndex(m => 
    (m.group1Name === match.group1Name && m.group2Name === match.group2Name) ||
    (m.group1Name === match.group2Name && m.group2Name === match.group1Name)
  );
  
  const matchToSave = {
    ...match,
    matchedAt: match.matchedAt || new Date().toISOString(),
    id: match.id || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  if (existingIndex >= 0) {
    // Update existing match
    matchesData.matches[existingIndex] = matchToSave;
  } else {
    // Add new match
    matchesData.matches.push(matchToSave);
  }
  
  saveMatches(matchesData);
  console.log(`✅ Saved match: ${match.group1Name} ↔ ${match.group2Name} (${match.compatibility.percentage}%)`);
  return matchToSave;
}

/**
 * Get all stored matches
 * @returns {Array} Array of matches
 */
function getAllMatches() {
  const matchesData = loadMatches();
  return matchesData.matches || [];
}

/**
 * Get matches for a specific group
 * @param {string} groupName - Group name
 * @returns {Array} Array of matches for this group
 */
function getMatchesForGroup(groupName) {
  const allMatches = getAllMatches();
  if (!groupName) return [];
  return allMatches.filter(m => 
    safeLower(m.group1Name) === safeLower(groupName) ||
    safeLower(m.group2Name) === safeLower(groupName)
  );
}

/**
 * Get statistics about stored profiles
 * @returns {Object} Statistics
 */
function getStats() {
  const profiles = loadProfiles();
  const state = loadState();
  const matches = getAllMatches();
  
  return {
    totalProfiles: profiles.groups.length,
    activeInterviews: Object.keys(state).length,
    totalMatches: matches.length,
    groups: profiles.groups.map(g => ({
      name: g.groupName,
      id: g.id,
      createdAt: g.createdAt
    }))
  };
}

/**
 * Get group response state for a chat
 * Tracks which users have responded to each question
 * @param {string} chatId - Chat ID
 * @returns {Object|null} Group response state or null
 */
function getGroupResponseState(chatId) {
  const state = loadState();
  return state[chatId]?.groupResponseState || null;
}

/**
 * Set group response state for a chat
 * @param {string} chatId - Chat ID
 * @param {Object} responseState - Group response state object
 */
function setGroupResponseState(chatId, responseState) {
  const state = loadState();
  if (!state[chatId]) {
    state[chatId] = {};
  }
  state[chatId].groupResponseState = responseState;
  saveState(state);
}

/**
 * Initialize group response tracking
 * @param {string} chatId - Chat ID
 * @param {number} groupSize - Number of people in the group
 * @param {Array<string>} userIds - Array of user IDs in the group
 */
function initializeGroupResponseTracking(chatId, groupSize, userIds) {
  const responseState = {
    groupSize,
    userIds: userIds || [],
    currentQuestionNumber: 0,
    responses: {} // questionNumber -> { [userId]: response }
  };
  setGroupResponseState(chatId, responseState);
}

/**
 * Record a user's response to the current question
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID who responded
 * @param {string} response - The user's response text
 * @returns {Object} { allResponded: boolean, remainingCount: number }
 */
function recordUserResponse(chatId, userId, response) {
  const state = loadState();
  if (!state[chatId]?.groupResponseState) {
    return { allResponded: false, remainingCount: -1 };
  }
  
  const responseState = state[chatId].groupResponseState;
  const questionNum = responseState.currentQuestionNumber;
  
  if (!responseState.responses[questionNum]) {
    responseState.responses[questionNum] = {};
  }
  
  responseState.responses[questionNum][userId] = response;
  
  // Count how many unique users have responded
  const respondedUsers = Object.keys(responseState.responses[questionNum]);
  const remainingCount = responseState.groupSize - respondedUsers.length;
  const allResponded = remainingCount <= 0;
  
  setGroupResponseState(chatId, responseState);
  
  return { allResponded, remainingCount, respondedUsers };
}

/**
 * Move to the next question
 * @param {string} chatId - Chat ID
 */
function moveToNextQuestion(chatId) {
  const state = loadState();
  if (!state[chatId]?.groupResponseState) {
    return;
  }
  
  const responseState = state[chatId].groupResponseState;
  responseState.currentQuestionNumber += 1;
  setGroupResponseState(chatId, responseState);
}

/**
 * Get responses for the current question
 * @param {string} chatId - Chat ID
 * @returns {Object|null} Object mapping userId to response, or null
 */
function getCurrentQuestionResponses(chatId) {
  const state = loadState();
  if (!state[chatId]?.groupResponseState) {
    return null;
  }
  
  const responseState = state[chatId].groupResponseState;
  const questionNum = responseState.currentQuestionNumber;
  return responseState.responses[questionNum] || null;
}

module.exports = {
  updateGroupProfile,
  getInterviewState,
  setInterviewState,
  clearInterviewState,
  groupNameExists,
  saveGroupProfile,
  getAllProfiles,
  getProfileByGroupName,
  getProfileByChatId,
  getProfileByCompositeKey,
  updateProfile,
  saveMatch,
  getAllMatches,
  getMatchesForGroup,
  getStats,
  getGroupResponseState,
  setGroupResponseState,
  initializeGroupResponseTracking,
  recordUserResponse,
  moveToNextQuestion,
  getCurrentQuestionResponses
};

