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

  // Yelp API configuration for activity planning
  yelp: {
    apiKey: process.env.YELP_API_KEY || 'your_yelp_api_key_here'
  },

  // Mandy agent configuration (legacy compatibility)
  mandy: {
    apiKey: process.env.A1ZAP_API_KEY || 'your_a1zap_api_key_here',
    agentId: process.env.MANDY_AGENT_ID || 'your_mandy_agent_id_here',
    apiUrl: 'https://api.a1zap.com/v1/messages/individual'
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
    },

    mandy: {
      apiKey: process.env.A1ZAP_API_KEY || 'your_a1zap_api_key_here',
      agentId: process.env.MANDY_AGENT_ID || 'your_mandy_agent_id_here',
      apiUrl: 'https://api.a1zap.com/v1/messages/individual',
      agentName: 'mandy',
      // Mini App configuration - includes metadata for rich content blocks
      // Each mini app needs: id, handle, name (and optionally iconUrl, description)
      miniApps: {
        // NOTE: If you don't have handles/names yet, we set safe placeholders.
        // A1Zap instance cards require `handle` + `name` in the rich content block.
        // If you later provide real handles/names, swap them in here.

        miniApp01: {
          id: process.env.MINI_APP_01_ID || 'xs7dh4w4ckmthbezzfdd7z4ww97ya0jn',
          handle: process.env.MINI_APP_01_HANDLE || 'click-splosion',
          name: process.env.MINI_APP_01_NAME || 'Click Splosion'
        },
        miniApp03: {
          id: process.env.MINI_APP_03_ID || 'xs79kqye9wqyk0faf582qf7cjn7ybef5',
          handle: process.env.MINI_APP_03_HANDLE || 'smoothy-ship',
          name: process.env.MINI_APP_03_NAME || 'Smoothy Ship'
        },
        miniApp12: {
          id: process.env.MINI_APP_12_ID || 'xs74n3mf1fb9qqr7xsky0wfkxx7yfgxq',
          handle: process.env.MINI_APP_12_HANDLE || 'swamp-digger',
          name: process.env.MINI_APP_12_NAME || 'Swamp Digger'
        },
        miniApp16: {
          id: process.env.MINI_APP_16_ID || 'xs7ewa9qdjqmfe11adhhetb57x80hxs6',
          handle: process.env.MINI_APP_16_HANDLE || 'lie-reveal-tho1',
          name: process.env.MINI_APP_16_NAME || 'Lie Reveal'
        },
        miniApp17: {
          id: process.env.MINI_APP_17_ID || 'xs7bjn2zrsttxhawz9p90r6rrh7ybp5x',
          handle: process.env.MINI_APP_17_HANDLE || 'fluid-flows',
          name: process.env.MINI_APP_17_NAME || 'Fluid Flows'
        },
        miniApp18: {
          id: process.env.MINI_APP_18_ID || 'xs7c0c44mgrj2ggj7cayj3ekbd7zkdj9',
          handle: process.env.MINI_APP_18_HANDLE || 'goal-rush',
          name: process.env.MINI_APP_18_NAME || 'Goal Rush'
        },
        miniApp19: {
          id: process.env.MINI_APP_19_ID || 'xs74c1p1yz0551h5hc649dvqdn7yfaab',
          handle: process.env.MINI_APP_19_HANDLE || 'reel-deal',
          name: process.env.MINI_APP_19_NAME || 'Reel Deal'
        },
        miniApp20: {
          id: process.env.MINI_APP_20_ID || 'xs7742w95vcw17byrr7vgsjksx7wwnmb',
          handle: process.env.MINI_APP_20_HANDLE || 'flappy-95',
          name: process.env.MINI_APP_20_NAME || 'Flappy 95'
        },
        miniApp21: {
          id: process.env.MINI_APP_21_ID || 'xs7a9db6143badvgv018z0kgwx80t1e7',
          handle: process.env.MINI_APP_21_HANDLE || 'name-crossword',
          name: process.env.MINI_APP_21_NAME || 'Name Crossword'
        }
      }
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
