const fs = require('fs').promises;
const path = require('path');
const claudeService = require('./claude-service');

/**
 * Social Link Extractor Service
 * Parses CSV file and uses Claude AI to intelligently match restaurants mentioned
 * in responses to their TikTok/social media links
 */

class SocialLinkExtractor {
  constructor() {
    this.socialLinksCache = null;
    this.csvPath = path.join(__dirname, '../files/brandoneats.csv');
  }

  /**
   * Parse CSV line handling quoted fields with commas
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Load and parse the Brandon Eats CSV file
   * Returns array of objects with name, type, city, tiktokLink, transcript, available
   */
  async loadSocialLinks() {
    try {
      // Return cached data if available
      if (this.socialLinksCache) {
        return this.socialLinksCache;
      }

      console.log('📊 Loading social links from CSV...');
      const csvContent = await fs.readFile(this.csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        console.warn('⚠️  CSV file is empty');
        return [];
      }

      // Parse header
      const header = this.parseCSVLine(lines[0]);
      console.log('CSV Headers:', header);

      // Parse data rows
      const socialLinks = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        
        // Skip if not enough columns or no TikTok link
        if (values.length < 4 || !values[3] || !values[3].startsWith('http')) {
          continue;
        }

        socialLinks.push({
          name: values[0] || '',
          type: values[1] || '',
          city: values[2] || '',
          tiktokLink: values[3] || '',
          transcript: values[4] || '',
          available: values[5] || ''
        });
      }

      console.log(`✅ Loaded ${socialLinks.length} social links from CSV`);
      
      // Cache the results
      this.socialLinksCache = socialLinks;
      return socialLinks;

    } catch (error) {
      console.error('❌ Error loading social links:', error.message);
      return [];
    }
  }

  /**
   * Use Claude AI to intelligently detect which restaurants/places from the CSV
   * are actually mentioned in the bot's response.
   * 
   * This is Stage 2B of the social link filtering process (Stage 2A happens in webhook).
   * 
   * How it works:
   * 1. Takes the bot's response and the list of all restaurants from the CSV
   * 2. Uses Claude AI to analyze which restaurants are ACTUALLY DISCUSSED (not just mentioned)
   * 3. Returns only restaurants that are key subjects of the response
   * 
   * The AI is trained to be strict:
   * - "You should try Pho 24" → Include "Pho 24" ✓
   * - "Brandon has reviewed many places" → Return empty array (no specific place) ✗
   * - "What would you like to know?" → Return empty array (clarification) ✗
   * 
   * @param {string} responseText - The text response from the bot
   * @param {Array} allLinks - Array of all social link objects from CSV
   * @returns {Array} - Array of restaurant names that Claude identified as meaningfully discussed
   */
  async detectMentionedRestaurants(responseText, allLinks) {
    try {
      if (!allLinks || allLinks.length === 0) {
        return [];
      }

      // Extract just the names for Claude to analyze
      const restaurantNames = allLinks.map(link => link.name).filter(name => name);
      
      if (restaurantNames.length === 0) {
        return [];
      }

      console.log('🤖 Using Claude to detect mentioned restaurants...');

      // Create a prompt for Claude to analyze
      const analysisPrompt = `You are analyzing a response about restaurants and places in Vietnam.

RESPONSE TEXT:
${responseText}

AVAILABLE RESTAURANT/PLACE NAMES:
${restaurantNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Task: Which of these restaurants or places are ACTUALLY DISCUSSED OR RECOMMENDED in the response text?

STRICT Rules:
- ONLY return names that are specifically mentioned, discussed, or recommended in the response
- The restaurant/place must be a key subject of the response, not just a passing mention
- Match names even if slightly misspelled or abbreviated in the response
- DO NOT include names that appear in generic statements or context without being discussed
- If the response is just a greeting, clarification, or generic statement, return "NONE"
- If the response doesn't actually discuss specific places, return "NONE"
- Return ONLY the exact names from the list above, one per line
- If none are meaningfully discussed, return "NONE"

Examples:
- "Brandon loved the pho at Pho 24" → Include "Pho 24"
- "You should try Banh Mi 25" → Include "Banh Mi 25"
- "Check out Highlands Coffee for great drinks" → Include "Highlands Coffee"
- "Brandon has reviewed many places" → Return "NONE" (no specific place discussed)
- "What restaurants do you want to know about?" → Return "NONE" (clarification question)
- "I can help you find information" → Return "NONE" (generic statement)

Return only the names, nothing else:`;

      // Call Claude for analysis
      const claudeResponse = await claudeService.generateText(analysisPrompt, {
        temperature: 0.3, // Lower temperature for more consistent extraction
        maxTokens: 500
      });

      // Parse Claude's response
      const mentionedNames = claudeResponse
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'NONE' && !line.match(/^\d+\./))
        .filter(line => restaurantNames.includes(line));

      console.log(`✅ Claude identified ${mentionedNames.length} mentioned restaurants:`, mentionedNames);
      
      return mentionedNames;

    } catch (error) {
      console.error('❌ Error detecting mentioned restaurants:', error.message);
      return [];
    }
  }

  /**
   * Extract relevant social links based on the bot's response
   * Uses Claude AI to intelligently match mentioned restaurants
   * 
   * @param {string} responseText - The bot's response text
   * @returns {Array} - Array of relevant social link objects with name and url
   */
  async extractRelevantSocialLinks(responseText) {
    try {
      if (!responseText || typeof responseText !== 'string') {
        return [];
      }

      // Load all social links from CSV
      const allLinks = await this.loadSocialLinks();
      
      if (allLinks.length === 0) {
        console.log('ℹ️  No social links available in CSV');
        return [];
      }

      // Use Claude to detect which restaurants are mentioned
      const mentionedNames = await this.detectMentionedRestaurants(responseText, allLinks);

      if (mentionedNames.length === 0) {
        console.log('ℹ️  No restaurants mentioned in response');
        return [];
      }

      // Find the corresponding links
      const relevantLinks = allLinks
        .filter(link => mentionedNames.includes(link.name))
        .map(link => ({
          name: link.name,
          url: link.tiktokLink,
          type: link.type,
          city: link.city
        }))
        .filter(link => link.url); // Ensure URL exists

      // Deduplicate by URL - keep only the first occurrence of each unique URL
      const seenUrls = new Set();
      const uniqueLinks = relevantLinks.filter(link => {
        if (seenUrls.has(link.url)) {
          console.log(`   ℹ️  Skipping duplicate URL for ${link.name}: ${link.url}`);
          return false;
        }
        seenUrls.add(link.url);
        return true;
      });

      // Limit to max 5 links to avoid overwhelming the user
      const limitedLinks = uniqueLinks.slice(0, 5);

      if (limitedLinks.length > 0) {
        console.log(`✅ Found ${limitedLinks.length} relevant social links`);
        limitedLinks.forEach(link => {
          console.log(`   - ${link.name}: ${link.url}`);
        });
      }

      return limitedLinks;

    } catch (error) {
      console.error('❌ Error extracting relevant social links:', error.message);
      return [];
    }
  }

  /**
   * Clear the cache (useful for testing or when CSV is updated)
   */
  clearCache() {
    this.socialLinksCache = null;
    console.log('🗑️  Social links cache cleared');
  }
}

// Export singleton instance
module.exports = new SocialLinkExtractor();

