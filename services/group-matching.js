/**
 * Group Matching Service
 * 
 * Matches groups based on their profiles using a combination of:
 * - Quantitative metrics (group size similarity)
 * - Qualitative analysis (AI-powered semantic similarity)
 * - Compatibility scoring
 * 
 * Matching Algorithm:
 * 
 * 1. QUANTITATIVE METRICS (0-1 scale):
 *    - Group Size Similarity: Groups with similar sizes get higher scores
 *    - Activity Level Match: Based on "ideal day" responses
 *    - Energy Level Match: Based on emoji and overall vibe
 * 
 * 2. QUALITATIVE ANALYSIS (AI-powered):
 *    - Semantic similarity of answers using embeddings
 *    - Cultural fit (music taste, fiction references)
 *    - Shared interests (Roman Empire, side quests)
 *    - Complementary personalities
 * 
 * 3. COMPATIBILITY SCORING:
 *    - Weighted combination of quantitative and qualitative scores
 *    - Final score: 0-100 (higher = more compatible)
 * 
 * How it works:
 * - Each group profile is analyzed and given a "match vector"
 * - Groups are compared pairwise using cosine similarity
 * - Top matches are ranked by compatibility score
 * - Can be run on-demand or scheduled (e.g., weekly matching events)
 */

const claudeService = require('./claude-service');
const groupProfileStorage = require('./group-profile-storage');

function safeLower(value) {
  return String(value ?? '').toLowerCase();
}

function getGroupDisplayName(group) {
  if (!group || typeof group !== 'object') return 'Unknown';
  return (
    group.groupName ||
    group.name ||
    group.group_name ||
    (group.answers && (group.answers.question1 || group.answers.q1)) ||
    'Unknown'
  );
}

/**
 * Helper to get answer value (handles both old and new format)
 */
function getAnswer(group, questionNumber) {
  const qKey = `q${questionNumber}`;
  const newKey = `question${questionNumber}`;
  
  // Try new format first
  if (group.answers && group.answers[newKey]) {
    return group.answers[newKey];
  }
  
  // Try old format
  if (group[qKey]) {
    return group[qKey];
  }
  
  // Try extracting number from old format (e.g., "1 person" -> "1")
  if (group[qKey] && typeof group[qKey] === 'string') {
    const numMatch = group[qKey].match(/\d+/);
    if (numMatch && questionNumber === 2) {
      return numMatch[0];
    }
    return group[qKey];
  }
  
  return null;
}

/**
 * Calculate quantitative compatibility score between two groups
 * Prioritizes similar group sizes and shared interests
 * @param {Object} group1 - First group profile
 * @param {Object} group2 - Second group profile
 * @returns {number} Score from 0-1
 */
function calculateQuantitativeScore(group1, group2) {
  let score = 0;
  let totalWeight = 0;

  // Factor 1: Group Size Similarity (HIGH PRIORITY - 40% weight)
  // Groups with similar sizes should match better
  const size1Raw = getAnswer(group1, 2);
  const size2Raw = getAnswer(group2, 2);
  
  if (size1Raw && size2Raw) {
    // Extract number from string like "3 people" or just use number
    const size1 = parseInt(size1Raw.toString().match(/\d+/)?.[0] || size1Raw) || 0;
    const size2 = parseInt(size2Raw.toString().match(/\d+/)?.[0] || size2Raw) || 0;
    
    if (size1 > 0 && size2 > 0) {
      // Improved size similarity: exponential decay for larger differences
      // Exact match = 1.0, difference of 1 = 0.9, difference of 2 = 0.7, etc.
      const sizeDiff = Math.abs(size1 - size2);
      let sizeScore;
      
      if (sizeDiff === 0) {
        sizeScore = 1.0; // Perfect match
      } else if (sizeDiff === 1) {
        sizeScore = 0.9; // Very close (e.g., 3 vs 4)
      } else if (sizeDiff === 2) {
        sizeScore = 0.7; // Close (e.g., 3 vs 5)
      } else if (sizeDiff <= 3) {
        sizeScore = 0.5; // Moderate difference
      } else {
        // Larger differences get penalized more
        sizeScore = Math.max(0.1, 0.5 - (sizeDiff - 3) * 0.1);
      }
      
      score += sizeScore * 0.4; // 40% weight
      totalWeight += 0.4;
    }
  }

  // Factor 2: Music Taste Similarity (25% weight)
  // Groups with similar music taste often have compatible vibes
  const music1 = String(getAnswer(group1, 5) || '').toLowerCase().trim();
  const music2 = String(getAnswer(group2, 5) || '').toLowerCase().trim();
  
  if (music1 && music2) {
    let musicScore = 0;
    
    // Exact match
    if (music1 === music2) {
      musicScore = 1.0;
    } else {
      // Check for similar genres (basic keyword matching)
      const keywords = {
        rock: ['rock', 'indie rock', 'alternative', 'punk'],
        pop: ['pop', 'mainstream', 'top 40'],
        hiphop: ['rap', 'hip hop', 'hiphop', 'trap'],
        electronic: ['house', 'edm', 'electronic', 'techno', 'dubstep'],
        indie: ['indie', 'alternative', 'indie rock']
      };
      
      let genre1 = null;
      let genre2 = null;
      
      for (const [genre, terms] of Object.entries(keywords)) {
        if (terms.some(term => music1.includes(term))) genre1 = genre;
        if (terms.some(term => music2.includes(term))) genre2 = genre;
      }
      
      if (genre1 && genre2) {
        musicScore = genre1 === genre2 ? 0.8 : 0.3;
      } else {
        // Partial word match
        const words1 = music1.split(/\s+/);
        const words2 = music2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w) && w.length > 2);
        musicScore = commonWords.length > 0 ? 0.5 : 0.2;
      }
    }
    
    score += musicScore * 0.25; // 25% weight
    totalWeight += 0.25;
  }

  // Factor 3: Activity/Interest Similarity (25% weight)
  // Based on "ideal day" - groups with similar ideal days often get along
  const idealDay1 = String(getAnswer(group1, 3) || '').toLowerCase();
  const idealDay2 = String(getAnswer(group2, 3) || '').toLowerCase();
  
  if (idealDay1 && idealDay2) {
    let activityScore = 0;
    
    // Exact or near-exact match
    if (idealDay1 === idealDay2) {
      activityScore = 1.0;
    } else {
      // Check for shared keywords (activities, places)
      const activityKeywords = {
        outdoor: ['beach', 'hiking', 'mountain', 'park', 'outdoor', 'camping', 'nature'],
        food: ['eating', 'restaurant', 'food', 'cooking', 'dining'],
        social: ['friends', 'hanging', 'party', 'social', 'together'],
        creative: ['art', 'music', 'creative', 'projects', 'making'],
        chill: ['chill', 'relax', 'netflix', 'watching', 'lounging'],
        adventure: ['exploring', 'travel', 'adventure', 'road trip', 'trip']
      };
      
      let category1 = [];
      let category2 = [];
      
      for (const [category, keywords] of Object.entries(activityKeywords)) {
        if (keywords.some(kw => idealDay1.includes(kw))) category1.push(category);
        if (keywords.some(kw => idealDay2.includes(kw))) category2.push(category);
      }
      
      const commonCategories = category1.filter(c => category2.includes(c));
      if (commonCategories.length > 0) {
        activityScore = 0.7 + (commonCategories.length * 0.1); // 0.7-1.0
      } else {
        // Check for any common words
        const words1 = idealDay1.split(/\s+/).filter(w => w.length > 3);
        const words2 = idealDay2.split(/\s+/).filter(w => w.length > 3);
        const commonWords = words1.filter(w => words2.includes(w));
        activityScore = Math.min(0.6, commonWords.length * 0.2);
      }
    }
    
    score += activityScore * 0.25; // 25% weight
    totalWeight += 0.25;
  }

  // Factor 4: Emoji/Vibe Similarity (10% weight - lower priority)
  const emoji1 = String(getAnswer(group1, 8) || '').toLowerCase().trim();
  const emoji2 = String(getAnswer(group2, 8) || '').toLowerCase().trim();
  
  if (emoji1 && emoji2) {
    const emojiScore = emoji1 === emoji2 ? 0.8 : 0.3;
    score += emojiScore * 0.1; // 10% weight
    totalWeight += 0.1;
  }

  // Normalize by total weight (handles missing data)
  return totalWeight > 0 ? score / totalWeight : 0.5;
}

/**
 * Calculate qualitative compatibility using AI
 * @param {Object} group1 - First group profile
 * @param {Object} group2 - Second group profile
 * @returns {Promise<number>} Score from 0-1
 */
async function calculateQualitativeScore(group1, group2) {
  // Get group sizes for context
  const size1Raw = getAnswer(group1, 2);
  const size2Raw = getAnswer(group2, 2);
  const size1 = size1Raw ? parseInt(size1Raw.toString().match(/\d+/)?.[0] || size1Raw) || 0 : 0;
  const size2 = size2Raw ? parseInt(size2Raw.toString().match(/\d+/)?.[0] || size2Raw) || 0 : 0;
  
  // Extract mini app data if available
  const miniAppData1 = group1.miniAppData || {};
  const miniAppData2 = group2.miniAppData || {};
  const hasMiniAppData1 = Object.keys(miniAppData1).length > 0;
  const hasMiniAppData2 = Object.keys(miniAppData2).length > 0;
  
  let miniAppSection = '';
  if (hasMiniAppData1 || hasMiniAppData2) {
    miniAppSection = '\n\nMINI APP DATA (if available, use this to find shared preferences/behaviors):\n';
    if (hasMiniAppData1) {
      miniAppSection += `Group 1 Mini App Data: ${JSON.stringify(miniAppData1, null, 2)}\n`;
    } else {
      miniAppSection += 'Group 1: No mini app data available\n';
    }
    if (hasMiniAppData2) {
      miniAppSection += `Group 2 Mini App Data: ${JSON.stringify(miniAppData2, null, 2)}\n`;
    } else {
      miniAppSection += 'Group 2: No mini app data available\n';
    }
    miniAppSection += '- Look for shared preferences, similar choices, or complementary behaviors in mini app data\n';
    miniAppSection += '- If both groups have mini app data, add +5-20 points for strong alignment\n';
  }
  
  const comparisonPrompt = `You are analyzing two groups for compatibility in a matchmaking system (like blocking groups at Harvard).

CRITICAL PRIORITIES (in order):
1. Group Size Similarity - Groups with similar sizes should score MUCH higher (e.g., 3 vs 3 = excellent, 3 vs 4 = very good, 3 vs 8 = poor)
2. Shared Interests - Groups with similar interests (music, activities, references) should score higher
3. Mini App Data Alignment - If both groups have mini app data, use it to find shared preferences and behaviors
4. Cultural Fit - Similar vibes, energy levels, and values
5. Complementary Personalities - Groups that would balance each other well

Group 1:
- Name: ${getGroupDisplayName(group1)}
- Group Size: ${size1} ${size1 === 1 ? 'person' : 'people'}
- Ideal Day: ${getAnswer(group1, 3) || 'N/A'}
- Fiction Group: ${getAnswer(group1, 4) || 'N/A'}
- Music Taste: ${getAnswer(group1, 5) || 'N/A'}
- Disliked Celebrity: ${getAnswer(group1, 6) || 'N/A'}
- Origin Story: ${getAnswer(group1, 7) || 'N/A'}
- Emoji: ${getAnswer(group1, 8) || 'N/A'}
- Roman Empire: ${getAnswer(group1, 9) || 'N/A'}
- Side Quest: ${getAnswer(group1, 10) || 'N/A'}

Group 2:
- Name: ${getGroupDisplayName(group2)}
- Group Size: ${size2} ${size2 === 1 ? 'person' : 'people'}
- Ideal Day: ${getAnswer(group2, 3) || 'N/A'}
- Fiction Group: ${getAnswer(group2, 4) || 'N/A'}
- Music Taste: ${getAnswer(group2, 5) || 'N/A'}
- Disliked Celebrity: ${getAnswer(group2, 6) || 'N/A'}
- Origin Story: ${getAnswer(group2, 7) || 'N/A'}
- Emoji: ${getAnswer(group2, 8) || 'N/A'}
- Roman Empire: ${getAnswer(group2, 9) || 'N/A'}
- Side Quest: ${getAnswer(group2, 10) || 'N/A'}${miniAppSection}

SCORING GUIDELINES:
- Groups with same/similar sizes (difference ≤ 1): Start at 70-100 base
- Groups with moderate size difference (2-3): Start at 50-70 base
- Groups with large size difference (4+): Start at 30-50 base, reduce further if interests don't align
- Add points for shared interests (music, activities, references): +5-15 points each
- Add points for mini app data alignment (if both have data): +5-20 points
- Add points for cultural fit: +5-10 points
- Subtract points for conflicting vibes: -5-10 points

Analyze their compatibility and respond with ONLY a number from 0-100.
Just the number, nothing else.`;

  try {
    const response = await claudeService.generateText(comparisonPrompt, {
      temperature: 0.3,
      maxTokens: 10
    });

    const score = parseInt(response.trim());
    if (isNaN(score) || score < 0 || score > 100) {
      return 50; // Default to neutral if parsing fails
    }
    return score / 100; // Convert to 0-1 scale
  } catch (error) {
    console.error('Error calculating qualitative score:', error);
    return 0.5; // Default to neutral on error
  }
}

/**
 * Calculate overall compatibility score between two groups
 * @param {Object} group1 - First group profile
 * @param {Object} group2 - Second group profile
 * @returns {Promise<Object>} { score: number, breakdown: Object }
 */
async function calculateCompatibility(group1, group2) {
  const quantitativeScore = calculateQuantitativeScore(group1, group2);
  const qualitativeScore = await calculateQualitativeScore(group1, group2);

  // IMPROVED WEIGHTING: 
  // - 40% quantitative (prioritizes group size and interests)
  // - 60% qualitative (AI analysis considers everything, including size)
  // This gives quantitative factors (especially size) significant influence
  // while still allowing AI to capture nuanced compatibility
  const finalScore = (quantitativeScore * 0.4) + (qualitativeScore * 0.6);

  return {
    score: finalScore,
    percentage: Math.round(finalScore * 100),
    breakdown: {
      quantitative: Math.round(quantitativeScore * 100),
      qualitative: Math.round(qualitativeScore * 100),
      sizeMatch: getSizeMatchScore(group1, group2)
    }
  };
}

/**
 * Calculate size match score for breakdown
 */
function getSizeMatchScore(group1, group2) {
  const size1Raw = getAnswer(group1, 2);
  const size2Raw = getAnswer(group2, 2);
  
  if (!size1Raw || !size2Raw) return 0;
  
  const size1 = parseInt(size1Raw.toString().match(/\d+/)?.[0] || size1Raw) || 0;
  const size2 = parseInt(size2Raw.toString().match(/\d+/)?.[0] || size2Raw) || 0;
  
  if (size1 === 0 || size2 === 0) return 0;
  
  const sizeDiff = Math.abs(size1 - size2);
  
  if (sizeDiff === 0) return 100;
  if (sizeDiff === 1) return 90;
  if (sizeDiff === 2) return 70;
  if (sizeDiff === 3) return 50;
  return Math.max(10, 50 - (sizeDiff - 3) * 10);
}

/**
 * Find best matches for a group
 * @param {string} groupName - Group name to find matches for
 * @param {number} limit - Number of matches to return (default: 5)
 * @returns {Promise<Array>} Array of { group, compatibility } objects
 */
async function findMatchesForGroup(groupName, limit = 5) {
  const allProfiles = groupProfileStorage.getAllProfiles();
  const targetGroup = groupProfileStorage.getProfileByGroupName(groupName);

  if (!targetGroup) {
    throw new Error(`Group "${groupName}" not found`);
  }

  const matches = [];

  for (const group of allProfiles) {
    // Skip self
    if (safeLower(getGroupDisplayName(group)) === safeLower(groupName)) {
      continue;
    }

    const compatibility = await calculateCompatibility(targetGroup, group);
    matches.push({
      group: group,
      compatibility: compatibility
    });
  }

  // Sort by compatibility score (highest first)
  matches.sort((a, b) => b.compatibility.score - a.compatibility.score);

  return matches.slice(0, limit);
}

/**
 * Find the best overall match (top pair)
 * NOTE: This does NOT save matches - use find-matches.js for matching events
 * @returns {Promise<Object|null>} { group1, group2, compatibility } or null
 */
async function findBestMatch() {
  const allProfiles = groupProfileStorage.getAllProfiles();

  if (allProfiles.length < 2) {
    return null; // Need at least 2 groups
  }

  let bestMatch = null;
  let bestScore = 0;

  // Compare all pairs (optimization: could be improved with caching)
  for (let i = 0; i < allProfiles.length; i++) {
    for (let j = i + 1; j < allProfiles.length; j++) {
      const compatibility = await calculateCompatibility(allProfiles[i], allProfiles[j]);
      
      if (compatibility.score > bestScore) {
        bestScore = compatibility.score;
        bestMatch = {
          group1: allProfiles[i],
          group2: allProfiles[j],
          compatibility: compatibility
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Get matching statistics
 * @returns {Object} Statistics about matching
 */
function getMatchingStats() {
  const allProfiles = groupProfileStorage.getAllProfiles();
  const totalPossiblePairs = allProfiles.length >= 2 
    ? (allProfiles.length * (allProfiles.length - 1)) / 2 
    : 0;

  return {
    totalGroups: allProfiles.length,
    totalPossiblePairs: totalPossiblePairs,
    canMatch: allProfiles.length >= 2
  };
}

module.exports = {
  calculateCompatibility,
  findMatchesForGroup,
  findBestMatch,
  getMatchingStats
};

