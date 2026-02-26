/**
 * A1Zap Mini App Service
 * 
 * Handles creating, managing, and accessing mini app sessions for Mandy.
 * Allows Mandy to share mini apps in group chats and access their data.
 */

const axios = require('axios');

class MiniAppService {
  constructor(apiKey, baseUrl = 'https://api.a1zap.com') {
    if (!apiKey) {
      throw new Error('A1Zap API key is required for Mini App Service');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Create or get an existing mini app session
   * @param {string} microAppId - The mini app ID
   * @param {string} sessionKey - Unique identifier (e.g., chatId-based)
   * @param {string} name - Display name for the session
   * @param {Object} initialData - Initial sharedData (optional)
   * @returns {Promise<Object>} Session info with shareUrl
   */
  async getOrCreateSession(microAppId, sessionKey, name, initialData = {}) {
    try {
      const isDryRun = String(process.env.A1ZAP_DRY_RUN || '').toLowerCase() === 'true';

      // API now requires sessionKey in the body (per updated API)
      const url = `${this.baseUrl}/api/agent-sessions`;
      
      const payload = {
        microAppId,
        sessionKey,
        name: name || `Mandy Session - ${sessionKey}`,
        initialData
      };

      console.log(`📱 [MiniApp] Creating session for ${name?.split(' - ').pop() || microAppId.slice(0,8)}...`);

      if (isDryRun) {
        const safeSuffix = String(sessionKey).replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'session';
        const instanceId = `dry_${microAppId.slice(0, 6)}_${safeSuffix}_${Date.now()}`;
        const shareCode = `dry_${microAppId.slice(0, 6)}_${Math.random().toString(36).slice(2, 8)}`;
        const shareUrl = `https://www.a1zap.com/micro-apps/join/${shareCode}`;

        console.log(`🧪 [MiniApp] A1ZAP_DRY_RUN=true → returning mock session:`);
        console.log(`   Instance ID: ${instanceId}`);
        console.log(`   Share URL: ${shareUrl}`);
        console.log(`   Share Code: ${shareCode}\n`);

        return {
          created: true,
          dryRun: true,
          microAppId,
          sessionKey,
          instanceId,
          shareCode,
          shareUrl,
          name: payload.name
        };
      }

      const response = await axios.post(url, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log(`✅ [MiniApp] Session ready: ${response.data.shareCode}`);

      return response.data;
    } catch (error) {
      console.error(`❌ [MiniApp] Session error for ${microAppId.slice(0,8)}: ${error.response?.status || 'network'} - ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  /**
   * Get an existing session by sessionKey or instanceId
   * @param {string} sessionKey - Optional session key
   * @param {string} instanceId - Optional instance ID
   * @returns {Promise<Object>} Session info with sharedData
   */
  async getSession(sessionKey = null, instanceId = null) {
    try {
      if (!sessionKey && !instanceId) {
        throw new Error('Either sessionKey or instanceId must be provided');
      }

      const param = sessionKey ? `sessionKey=${encodeURIComponent(sessionKey)}` : `instanceId=${encodeURIComponent(instanceId)}`;
      const url = `${this.baseUrl}/api/agent-sessions?${param}`;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📱 [MiniApp] Getting session`);
      console.log(`${'='.repeat(80)}`);
      console.log(`URL: ${url}`);
      console.log(`${'='.repeat(80)}\n`);

      const response = await axios.get(url, {
        headers: {
          'X-API-Key': this.apiKey
        },
        timeout: 10000
      });

      console.log(`✅ [MiniApp] Session retrieved:`);
      console.log(`   Instance ID: ${response.data.instanceId}`);
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Shared Data Version: ${response.data.sharedDataVersion}\n`);

      return response.data;
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [MiniApp] Error getting session`);
      console.error(`${'='.repeat(80)}`);
      console.error('Error:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
      console.error(`${'='.repeat(80)}\n`);
      throw error;
    }
  }

  /**
   * Get shared data for a session
   * @param {string} instanceId - The instance ID
   * @returns {Promise<Object>} Session data including sharedData
   */
  async getSharedData(instanceId) {
    try {
      const isDryRun = String(process.env.A1ZAP_DRY_RUN || '').toLowerCase() === 'true';
      if (isDryRun) {
        console.log(`🧪 [MiniApp] A1ZAP_DRY_RUN=true → returning mock sharedData for ${instanceId}\n`);
        return {
          instanceId,
          status: 'active',
          sharedDataVersion: 1,
          sharedData: {}
        };
      }

      const url = `${this.baseUrl}/api/micro-apps/instance-data?instanceId=${encodeURIComponent(instanceId)}`;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📱 [MiniApp] Getting shared data`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Instance ID: ${instanceId}`);
      console.log(`${'='.repeat(80)}\n`);

      const response = await axios.get(url, {
        headers: {
          'X-API-Key': this.apiKey
        },
        timeout: 10000
      });

      console.log(`✅ [MiniApp] Shared data retrieved:`);
      console.log(`   Version: ${response.data.sharedDataVersion}`);
      console.log(`   Has Data: ${!!response.data.sharedData}\n`);

      return response.data;
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [MiniApp] Error getting shared data`);
      console.error(`${'='.repeat(80)}`);
      console.error('Error:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
      }
      console.error(`${'='.repeat(80)}\n`);
      throw error;
    }
  }

  /**
   * Update shared data for a session (with optimistic concurrency)
   * @param {string} instanceId - The instance ID
   * @param {Object} sharedData - The new sharedData
   * @param {number} expectedVersion - The version you last read
   * @returns {Promise<Object>} Update result
   */
  async updateSharedData(instanceId, sharedData, expectedVersion) {
    try {
      const url = `${this.baseUrl}/api/micro-apps/instance-data`;

      const payload = {
        instanceId,
        sharedData,
        expectedVersion
      };

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📱 [MiniApp] Updating shared data`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Instance ID: ${instanceId}`);
      console.log(`Expected Version: ${expectedVersion}`);
      console.log(`${'='.repeat(80)}\n`);

      const response = await axios.post(url, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.error === 'VERSION_CONFLICT') {
        console.warn(`⚠️  [MiniApp] Version conflict - current version: ${response.data.currentVersion}`);
        return response.data;
      }

      console.log(`✅ [MiniApp] Shared data updated:`);
      console.log(`   New Version: ${response.data.newVersion}\n`);

      return response.data;
    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [MiniApp] Error updating shared data`);
      console.error(`${'='.repeat(80)}`);
      console.error('Error:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
      console.error(`${'='.repeat(80)}\n`);
      throw error;
    }
  }

  /**
   * Helper: Create session key from chatId
   * @param {string} chatId - Chat ID
   * @param {string} suffix - Optional suffix (e.g., mini app name)
   * @returns {string} Session key
   */
  createSessionKey(chatId, suffix = '') {
    const base = `mandy-chat-${chatId}`;
    return suffix ? `${base}-${suffix}` : base;
  }

  /**
   * Helper: Retry update with version conflict handling
   * @param {string} instanceId - The instance ID
   * @param {Function} updateFn - Function that takes current data and returns new data
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Update result
   */
  async updateSharedDataWithRetry(instanceId, updateFn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get current data
        const current = await this.getSharedData(instanceId);
        
        // Apply update function
        const newData = updateFn(current.sharedData || {});
        
        // Try to update
        const result = await this.updateSharedData(
          instanceId,
          newData,
          current.sharedDataVersion
        );
        
        // Check for version conflict
        if (result.error === 'VERSION_CONFLICT') {
          if (attempt < maxRetries) {
            console.log(`⚠️  [MiniApp] Version conflict on attempt ${attempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
            continue;
          } else {
            throw new Error('Version conflict after max retries');
          }
        }
        
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`⚠️  [MiniApp] Update attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }
}

module.exports = MiniAppService;
