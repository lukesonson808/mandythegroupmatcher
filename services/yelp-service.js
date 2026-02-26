/**
 * Yelp API Service
 * Integrates with Yelp Fusion API to search for businesses, restaurants, and activities
 * Documentation: https://www.yelp.com/developers/documentation/v3
 */

const axios = require('axios');

class YelpService {
  constructor() {
    this.apiKey = process.env.YELP_API_KEY || '';
    this.baseUrl = 'https://api.yelp.com/v3';
  }

  /**
   * Check if Yelp service is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.apiKey && !this.apiKey.includes('your_') && !this.apiKey.includes('YOUR_'));
  }

  /**
   * Search for businesses using Yelp API
   * @param {string} term - Search term (e.g., "italian restaurant", "mini golf", "escape room")
   * @param {string} location - Location (city, address, etc.)
   * @param {Object} options - Additional options (latitude, longitude, limit, etc.)
   * @returns {Promise<Object>} Search results
   */
  async searchBusinesses(term, location, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Yelp API key not configured. Please set YELP_API_KEY environment variable.');
    }

    try {
      const params = {
        term: term,
        location: location,
        limit: options.limit || 10,
        sort_by: options.sortBy || 'rating', // rating, distance, review_count
        ...options
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined) {
          delete params[key];
        }
      });

      console.log(`🍽️  [Yelp] Searching for: "${term}" in "${location}"`);

      const response = await axios.get(`${this.baseUrl}/businesses/search`, {
        params: params,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        total: response.data.total || 0,
        businesses: response.data.businesses || []
      };
    } catch (error) {
      console.error(`❌ [Yelp] Error searching businesses:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Get business details by ID
   * @param {string} businessId - Yelp business ID
   * @returns {Promise<Object>} Business details
   */
  async getBusinessDetails(businessId) {
    if (!this.isConfigured()) {
      throw new Error('Yelp API key not configured.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/businesses/${businessId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        business: response.data
      };
    } catch (error) {
      console.error(`❌ [Yelp] Error getting business details:`, error.message);
      throw error;
    }
  }

  /**
   * Get reviews for a business (up to 3)
   * @param {string} businessId - Yelp business ID
   * @returns {Promise<Object>} Reviews
   */
  async getBusinessReviews(businessId) {
    if (!this.isConfigured()) {
      throw new Error('Yelp API key not configured.');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/businesses/${businessId}/reviews`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        reviews: response.data.reviews || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error(`❌ [Yelp] Error getting reviews:`, error.message);
      throw error;
    }
  }

  /**
   * Search for businesses that support delivery
   * @param {string} location - Location (city, address, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Delivery search results
   */
  async searchDelivery(location, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Yelp API key not configured.');
    }

    try {
      const params = {
        location: location,
        limit: options.limit || 10,
        ...options
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined) {
          delete params[key];
        }
      });

      console.log(`🚚 [Yelp] Searching for delivery in "${location}"`);

      const response = await axios.get(`${this.baseUrl}/transactions/delivery/search`, {
        params: params,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        total: response.data.total || 0,
        businesses: response.data.businesses || []
      };
    } catch (error) {
      console.error(`❌ [Yelp] Error searching delivery:`, error.message);
      throw error;
    }
  }

  /**
   * Format business data for display
   * @param {Object} business - Yelp business object
   * @returns {Object} Formatted business data
   */
  formatBusiness(business) {
    if (!business) return null;

    return {
      id: business.id,
      name: business.name,
      rating: business.rating,
      reviewCount: business.review_count,
      price: business.price || 'N/A',
      phone: business.phone,
      url: business.url,
      imageUrl: business.image_url,
      photos: business.photos || [],
      categories: (business.categories || []).map(cat => cat.title).join(', '),
      address: this.formatAddress(business.location),
      coordinates: business.coordinates,
      distance: business.distance ? `${(business.distance / 1609.34).toFixed(1)} mi` : null, // Convert meters to miles
      isClosed: business.is_closed,
      hours: business.hours || []
    };
  }

  /**
   * Format address from Yelp location object
   * @param {Object} location - Yelp location object
   * @returns {string} Formatted address
   */
  formatAddress(location) {
    if (!location) return 'Address not available';
    
    const parts = [
      location.address1,
      location.address2,
      location.address3,
      location.city,
      location.state,
      location.zip_code
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Format multiple businesses for recommendations
   * @param {Array<Object>} businesses - Array of Yelp business objects
   * @returns {Array<Object>} Formatted businesses
   */
  formatBusinesses(businesses) {
    if (!Array.isArray(businesses)) return [];
    
    return businesses
      .filter(b => b && !b.is_closed) // Filter out closed businesses
      .slice(0, 5) // Limit to top 5
      .map(business => this.formatBusiness(business));
  }
}

module.exports = new YelpService();
