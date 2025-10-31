/**
 * Rich Content Demo Agent Configuration
 * Non-AI agent that showcases all 18 rich content types available in A1Zap
 * 
 * This is a demonstration agent that responds to simple text commands
 * with examples of different rich content formats (carousels, cards, buttons, etc.)
 * 
 * No AI model is used - just keyword matching and hardcoded responses.
 */

const BaseAgent = require('../core/BaseAgent');

class RichContentDemoAgent extends BaseAgent {
  constructor() {
    super({
      name: 'Rich Content Demo Assistant',
      role: 'Interactive Content Showcase',
      description: 'Demonstrates all 18 rich content types available in the A1Zap platform',
      model: 'claude', // Required by BaseAgent but not actually used
      generationOptions: {
        temperature: 0.7,
        maxTokens: 1024
      },
      metadata: {
        category: 'demo-showcase',
        version: '1.0.0',
        nonAI: true // Flag to indicate this doesn't use AI
      }
    });
  }

  /**
   * Get the system prompt for this agent
   * Note: Not actually used since this is a non-AI agent
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are a demo assistant that showcases rich content types. Respond to user commands with examples.`;
  }

  /**
   * Get welcome message for chat.started event
   * @param {string} userName - User's name (if available)
   * @param {boolean} isAnonymous - Whether the user is anonymous
   * @returns {string} Welcome message with command list
   */
  getWelcomeMessage(userName, isAnonymous) {
    let greeting;
    if (userName && !isAnonymous) {
      const firstName = userName.split(' ')[0];
      greeting = `Hey ${firstName}! 👋`;
    } else {
      greeting = `Hey there! 👋`;
    }

    return `${greeting}

Welcome to the **Rich Content Demo Assistant**! 🎨

I showcase all 18 rich content types available in the A1Zap platform. Just type a command to see a filled example!

📋 **Available Commands:**

**Visual & Media:**
• \`carousel\` - Swipeable image carousel
• \`gallery\` - Photo grid layout
• \`social_share\` - Social media embed
• \`social_profile\` - Creator profile card

**Interactive Elements:**
• \`button_card\` - Action buttons
• \`quick_replies\` - Fast-tap responses
• \`poll\` - Voting poll
• \`form_card\` - Data collection form

**Information Cards:**
• \`profile_card\` - Person profile
• \`product_card\` - Product with price
• \`event_card\` - Event with date/time
• \`location_card\` - Map location
• \`contact_card\` - Business card
• \`link_preview\` - Web link preview

**Workflow & Tasks:**
• \`task_card\` - Task with status
• \`project_card\` - Project progress
• \`reminder_card\` - Scheduled reminder
• \`workflow_status\` - Pipeline status

**Other Commands:**
• \`help\` - Show this list again
• \`all\` - See multiple examples

Just type any command to get started! 🚀`;
  }
}

// Export a singleton instance
module.exports = new RichContentDemoAgent();

