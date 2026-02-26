/**
 * Activity Planning Service
 * Helps groups find local activities like restaurants, mini golf, escape rooms, etc.
 * 
 * Integrates with Yelp Fusion API for real-time business data, ratings, and reviews.
 */

const axios = require('axios');
const yelpService = require('./yelp-service');

class ActivityPlanningService {
  constructor() {
    this.useYelp = yelpService.isConfigured();
    if (this.useYelp) {
      console.log('✅ [ActivityPlanning] Yelp API configured - using Yelp for business searches');
    } else {
      console.log('⚠️  [ActivityPlanning] Yelp API not configured - using fallback methods');
    }
  }

  /**
   * Extract location from user message or conversation
   * @param {string} userMessage - User's message
   * @param {string} storedLocation - Previously stored location (if any)
   * @returns {string} Extracted location or empty string
   */
  extractLocation(userMessage, storedLocation = '') {
    // If we have a stored location, use it
    if (storedLocation) {
      return storedLocation;
    }

    // Try to extract location from message with better patterns
    const locationPatterns = [
      // "in Boston", "near Harvard Square", "at MIT", "around Cambridge"
      /(?:in|near|at|around|close to|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s|$|,|\.|!|\?|for|to)/,
      // "we're in Boston", "located in Cambridge"
      /(?:we're|we are|we're in|located in|based in|live in|staying in)\s+([A-Z][a-zA-Z\s]+?)(?:\s|$|,|\.|!|\?)/,
      // City names at the end: "restaurant in Boston"
      /(?:in|near)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*?)(?:\s*$|,|\.|!|\?)/,
      // ZIP codes
      /\b(\d{5}(?:-\d{4})?)\b/
    ];

    for (const pattern of locationPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        let location = match[1].trim();
        
        // Filter out common false positives (cuisine types, common words)
        const falsePositives = [
          'Italian', 'Mexican', 'Chinese', 'Thai', 'Sushi', 'Pizza', 
          'Japanese', 'Indian', 'French', 'American', 'Restaurant',
          'Food', 'Place', 'Spot', 'Here', 'There', 'Where'
        ];
        
        if (!falsePositives.some(fp => location.toLowerCase().includes(fp.toLowerCase()))) {
          // Clean up location (remove trailing words like "for", "to", etc.)
          location = location.replace(/\s+(for|to|that|which|restaurant|food|place|spot)\s*$/i, '').trim();
          
          // Only return if it looks like a real location (has capital letter, not too short)
          if (location.length >= 2 && /[A-Z]/.test(location)) {
            return location;
          }
        }
      }
    }

    return '';
  }

  /**
   * Search for local activities using Yelp API or fallback methods
   * @param {string} query - What they're looking for (e.g., "italian restaurant", "mini golf", "escape room")
   * @param {string} location - Location (city, area, etc.) - optional
   * @param {Function} webSearchFn - Web search function (injected for testing)
   * @returns {Promise<Object>} Activity recommendations with real results
   */
  async searchActivities(query, location = '', webSearchFn = null) {
    try {
      // Build search query with location
      const searchQuery = location 
        ? `best ${query} near ${location}`
        : `best ${query}`;

      console.log(`🔍 [ActivityPlanning] Searching for: "${searchQuery}"`);

      let recommendations = [];
      let yelpUrl = '';
      let mapsUrl = '';

      // Try Yelp API first if configured
      if (this.useYelp && location) {
        try {
          const yelpResults = await yelpService.searchBusinesses(query, location, {
            limit: 5,
            sortBy: 'rating'
          });

          if (yelpResults.success && yelpResults.businesses.length > 0) {
            recommendations = yelpService.formatBusinesses(yelpResults.businesses).map(business => ({
              name: business.name,
              description: business.categories || 'Restaurant',
              address: business.address,
              rating: business.rating,
              reviewCount: business.reviewCount,
              price: business.price,
              url: business.url,
              imageUrl: business.imageUrl,
              distance: business.distance,
              phone: business.phone
            }));

            console.log(`✅ [ActivityPlanning] Found ${recommendations.length} businesses via Yelp API`);
          }
        } catch (yelpError) {
          console.warn(`⚠️  [ActivityPlanning] Yelp API error, using fallback:`, yelpError.message);
          // Fall through to fallback methods
        }
      }

      // Fallback to web search if Yelp didn't work or isn't configured
      if (recommendations.length === 0) {
        let searchResults = null;
        if (webSearchFn) {
          searchResults = await webSearchFn(searchQuery);
        }
        recommendations = this.parseSearchResults(searchResults, query, location);
      }

      // Build Google Maps search URL
      const mapsQuery = location 
        ? `${query} near ${location}`
        : query;
      mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;

      // Build Yelp search URL
      if (location) {
        yelpUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}&find_loc=${encodeURIComponent(location)}`;
      }

      return {
        success: true,
        query: searchQuery,
        location: location || 'your area',
        recommendations: recommendations,
        mapsUrl: mapsUrl,
        yelpUrl: yelpUrl,
        helpfulLinks: this.getHelpfulLinksForActivityType(query),
        source: this.useYelp && recommendations.length > 0 ? 'yelp' : 'web'
      };
    } catch (error) {
      console.error('❌ [ActivityPlanning] Error searching activities:', error);
      return {
        success: false,
        error: error.message,
        query: query,
        location: location || 'your area'
      };
    }
  }

  /**
   * Parse web search results to extract useful information
   * @param {Object} searchResults - Web search results
   * @param {string} query - Original query
   * @param {string} location - Location
   * @returns {Array<Object>} Parsed recommendations
   */
  parseSearchResults(searchResults, query, location) {
    const recommendations = [];

    if (searchResults && searchResults.results && Array.isArray(searchResults.results)) {
      // Extract top 3-5 results
      const topResults = searchResults.results.slice(0, 5);
      
      topResults.forEach((result, index) => {
        if (result.title && result.snippet) {
          recommendations.push({
            name: result.title,
            description: result.snippet,
            url: result.url || result.link,
            rank: index + 1
          });
        }
      });
    }

    // If no results parsed, provide helpful guidance
    if (recommendations.length === 0) {
      recommendations.push({
        name: 'Search on Google Maps',
        description: `Search for "${query}${location ? ` near ${location}` : ''}" on Google Maps for the most up-to-date options with reviews, ratings, and directions.`,
        url: `https://www.google.com/maps/search/${encodeURIComponent(query + (location ? ` near ${location}` : ''))}`,
        rank: 1
      });
    }

    return recommendations;
  }

  /**
   * Get helpful links based on activity type
   * @param {string} activityType - Type of activity
   * @returns {Array<Object>} Array of helpful links
   */
  getHelpfulLinksForActivityType(activityType) {
    const lowerType = activityType.toLowerCase();
    const links = [];

    // Restaurant-related
    if (lowerType.includes('restaurant') || lowerType.includes('food') || lowerType.includes('dinner') || lowerType.includes('lunch') || lowerType.includes('italian') || lowerType.includes('pizza') || lowerType.includes('sushi') || lowerType.includes('mexican') || lowerType.includes('chinese') || lowerType.includes('thai')) {
      links.push({
        name: 'Yelp',
        url: 'https://www.yelp.com',
        description: 'Find restaurants with reviews and ratings'
      });
      links.push({
        name: 'OpenTable',
        url: 'https://www.opentable.com',
        description: 'Make restaurant reservations'
      });
      links.push({
        name: 'Google Maps',
        url: 'https://www.google.com/maps',
        description: 'Search for restaurants near you'
      });
    }

    // Entertainment/Activities
    if (lowerType.includes('mini golf') || lowerType.includes('golf') || lowerType.includes('escape room') || lowerType.includes('bowling') || lowerType.includes('arcade') || lowerType.includes('activity') || lowerType.includes('fun')) {
      links.push({
        name: 'Google Maps',
        url: 'https://www.google.com/maps',
        description: 'Search for activities and entertainment near you'
      });
      links.push({
        name: 'Yelp',
        url: 'https://www.yelp.com',
        description: 'Find local activities with reviews'
      });
    }

    // Escape rooms specifically
    if (lowerType.includes('escape room')) {
      links.push({
        name: 'Escape Room Directory',
        url: 'https://www.escaperoom.com',
        description: 'Find escape rooms near you'
      });
    }

    return links;
  }

  /**
   * Format activity recommendations for Mandy to share
   * @param {Object} searchResult - Result from searchActivities
   * @returns {string} Formatted message for Mandy to send
   */
  formatActivityRecommendations(searchResult) {
    if (!searchResult.success) {
      return `Hmm, having trouble finding that right now! 😅 Try searching on Google Maps or Yelp - they're usually pretty good at finding local spots!`;
    }

    let message = `Here are some great options${searchResult.location ? ` in ${searchResult.location}` : ''}:\n\n`;
    
    // Add specific recommendations if available
    if (searchResult.recommendations && searchResult.recommendations.length > 0) {
      searchResult.recommendations.slice(0, 5).forEach((rec, index) => {
        if (rec.name) {
          // Make the name a clickable Yelp link (bold the link text)
          const nameLink = rec.url ? `[**${rec.name}**](${rec.url})` : `**${rec.name}**`;
          message += `${index + 1}. ${nameLink}`;
          
          // Add rating if available (from Yelp)
          if (rec.rating) {
            message += ` ⭐ ${rec.rating.toFixed(1)}`;
            if (rec.reviewCount) {
              message += ` (${rec.reviewCount.toLocaleString()})`;
            }
          }
          
          // Add price if available
          if (rec.price && rec.price !== 'N/A') {
            message += ` • ${rec.price}`;
          }
          
          // Add address and distance on same line if available
          if (rec.address || rec.distance) {
            message += `\n   📍 `;
            if (rec.address) {
              message += rec.address;
            }
            if (rec.distance) {
              message += rec.address ? ` • ${rec.distance}` : rec.distance;
            }
          }
          
          message += `\n`;
        }
      });
    }

    // Add quick search links (much shorter)
    if (searchResult.mapsUrl || searchResult.yelpUrl) {
      message += `\nMore: `;
      if (searchResult.mapsUrl) {
        message += `[Maps](${searchResult.mapsUrl})`;
      }
      if (searchResult.yelpUrl) {
        message += searchResult.mapsUrl ? ` • [Yelp](${searchResult.yelpUrl})` : `[Yelp](${searchResult.yelpUrl})`;
      }
    }

    return message;
  }
}

module.exports = new ActivityPlanningService();
