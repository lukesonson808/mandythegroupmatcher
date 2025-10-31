// Load environment variables


module.exports = {
  // AI Model Configurations
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || 'your_gemini_api_key_here',
    defaultModel: 'gemini-2.5-flash',
    temperature: 0.7,
    maxOutputTokens: 65565
  },

  claude: {
    apiKey: process.env.CLAUDE_API_KEY || 'your_claude_api_key_here',
    defaultModel: 'claude-sonnet-4-5',
    maxTokens: 8192,
    temperature: 0.7,
    // Files API beta header (required for file_id references)
    betaHeaders: ['files-api-2025-04-14']
  },

  // Agent-Specific A1Zap Configurations
  agents: {
    claudeDocubot: {
      apiKey: process.env.A1ZAP_API_KEY || 'your_a1zap_api_key_here',
      agentId: process.env.A1ZAP_AGENT_ID || 'your_agent_id_here',
      apiUrl: 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'claude-docubot'
    },

    brandonEats: {
      apiKey: process.env.BRANDONEATS_API_KEY || 'your_brandoneats_api_key_here',
      agentId: process.env.BRANDONEATS_AGENT_ID || 'your_brandoneats_agent_id_here',
      apiUrl: process.env.BRANDONEATS_API_URL || 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'brandoneats'
    },
    
    willWanderForFood: {
      apiKey: process.env.WILLWANDERFORFOOD_API_KEY || 'your_will_wander_for_food_api_key_here',
      agentId: process.env.WILLWANDERFORFOOD_AGENT_ID || 'your_will_wander_for_food_agent_id_here',
      apiUrl: process.env.WILLWANDERFORFOOD_API_URL || 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'willwanderforfood'
    },

    makeupArtist: {
      apiKey: process.env.MAKEUP_ARTIST_API_KEY || process.env.A1ZAP_API_KEY || 'your_makeup_artist_api_key_here',
      agentId: process.env.MAKEUP_ARTIST_AGENT_ID || 'your_makeup_artist_agent_id_here',
      apiUrl: process.env.MAKEUP_ARTIST_API_URL || 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'makeup-artist'
    },

    ycPhotographer: {
      apiKey: process.env.YC_PHOTOGRAPHER_API_KEY || process.env.A1ZAP_API_KEY || 'your_yc_photographer_api_key_here',
      agentId: process.env.YC_PHOTOGRAPHER_AGENT_ID || 'your_yc_photographer_agent_id_here',
      apiUrl: process.env.YC_PHOTOGRAPHER_API_URL || 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'yc-photographer'
    },

    zapbankRep: {
      apiKey: process.env.ZAPBANK_REP_API_KEY || process.env.A1ZAP_API_KEY || 'your_zapbank_rep_api_key_here',
      agentId: process.env.ZAPBANK_REP_AGENT_ID || 'your_zapbank_rep_agent_id_here',
      apiUrl: process.env.ZAPBANK_REP_API_URL || 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'zapbank-rep'
    },

    richContentDemo: {
      apiKey: process.env.RICH_CONTENT_DEMO_API_KEY || process.env.A1ZAP_API_KEY || 'your_rich_content_demo_api_key_here',
      agentId: process.env.RICH_CONTENT_DEMO_AGENT_ID || 'your_rich_content_demo_agent_id_here',
      apiUrl: process.env.RICH_CONTENT_DEMO_API_URL || 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'rich-content-demo'
    }
  },

  // Legacy compatibility (deprecated - use config.agents instead)
  a1zap: {
    apiKey: process.env.A1ZAP_API_KEY || 'your_a1zap_api_key_here',
    agentId: process.env.A1ZAP_AGENT_ID || 'your_agent_id_here',
    apiUrl: 'https://api.a1zap.com/v1/messages/individual'
  },
  brandonEats: {
    apiKey: process.env.BRANDONEATS_API_KEY || 'your_brandoneats_api_key_here',
    agentId: process.env.BRANDONEATS_AGENT_ID || 'your_brandoneats_agent_id_here',
    apiUrl: process.env.BRANDONEATS_API_URL || 'https://api.a1zap.com/v1/messages/individual'
  },
  makeupArtist: {
    apiKey: process.env.MAKEUP_ARTIST_API_KEY || process.env.A1ZAP_API_KEY || 'your_makeup_artist_api_key_here',
    agentId: process.env.MAKEUP_ARTIST_AGENT_ID || 'your_makeup_artist_agent_id_here',
    apiUrl: process.env.MAKEUP_ARTIST_API_URL || 'https://api.a1zap.com/v1/messages/individual'
  },
  ycPhotographer: {
    apiKey: process.env.YC_PHOTOGRAPHER_API_KEY || process.env.A1ZAP_API_KEY || 'your_yc_photographer_api_key_here',
    agentId: process.env.YC_PHOTOGRAPHER_AGENT_ID || 'your_yc_photographer_agent_id_here',
    apiUrl: process.env.YC_PHOTOGRAPHER_API_URL || 'https://api.a1zap.com/v1/messages/individual'
  },
  zapbankRep: {
    apiKey: process.env.ZAPBANK_REP_API_KEY || process.env.A1ZAP_API_KEY || 'your_zapbank_rep_api_key_here',
    agentId: process.env.ZAPBANK_REP_AGENT_ID || 'your_zapbank_rep_agent_id_here',
    apiUrl: process.env.ZAPBANK_REP_API_URL || 'https://api.a1zap.com/v1/messages/individual'
  },

  // File Registry Configuration
  files: {
    registryPath: './files-registry.json'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000'
  },

  // Helper functions for validation
  validation: {
    /**
     * Check if a value is a placeholder (not properly configured)
     */
    isPlaceholder(value) {
      if (!value) return true;
      const placeholder_prefixes = [
        'your_',
        'YOUR_',
      ];
      return placeholder_prefixes.some(p => String(value).startsWith(p));
    },

    /**
     * Validate agent configuration
     */
    validateAgent(agentName, agentConfig) {
      const warnings = [];
      const errors = [];

      if (this.isPlaceholder(agentConfig.apiKey)) {
        errors.push(`❌ ${agentName}: API Key is not configured (using placeholder value)`);
      }

      if (this.isPlaceholder(agentConfig.agentId)) {
        errors.push(`❌ ${agentName}: Agent ID is not configured (using placeholder value)`);
      }

      return { warnings, errors };
    },

    /**
     * Validate AI service configuration
     */
    validateAIService(serviceName, serviceConfig) {
      const warnings = [];
      const errors = [];

      if (this.isPlaceholder(serviceConfig.apiKey)) {
        warnings.push(`⚠️  ${serviceName}: API Key is not configured (using placeholder value)`);
      }

      return { warnings, errors };
    }
  }
};
