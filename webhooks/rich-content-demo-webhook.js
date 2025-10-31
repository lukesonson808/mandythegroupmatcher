const BaseWebhook = require('../core/BaseWebhook');
const BaseA1ZapClient = require('../core/BaseA1ZapClient');
const richContentDemoAgent = require('../agents/rich-content-demo-agent');
const webhookHelpers = require('../services/webhook-helpers');
const config = require('../config');

/**
 * Rich Content Demo Webhook Handler
 * Non-AI agent that responds to text commands with rich content examples
 * 
 * Supports all 18 rich content types:
 * - carousel, gallery, social_share, social_profile
 * - button_card, quick_replies, poll, form_card
 * - profile_card, product_card, event_card, location_card, contact_card, link_preview
 * - task_card, project_card, reminder_card, workflow_status
 */
class RichContentDemoWebhook extends BaseWebhook {
  constructor() {
    // Create A1Zap client for this agent
    const client = new BaseA1ZapClient(config.agents.richContentDemo);
    
    // Initialize base webhook
    super(richContentDemoAgent, client);
  }

  /**
   * Process request - match command and send appropriate example
   * @param {Object} data - Request data with conversation history
   * @returns {Promise<Object>} Result with response text
   */
  async processRequest(data) {
    const { userMessage, chatId } = data;
    const command = userMessage.toLowerCase().trim();

    console.log(`📝 Processing command: "${command}"`);

    // Match command to content type
    let response = '';
    let richContentBlocks = null;

    switch (command) {
      // Visual & Media
      case 'carousel':
        richContentBlocks = this.getCarouselExample();
        response = '🎠 Here\'s a **Carousel** example - swipe through these featured products:';
        break;

      case 'gallery':
        richContentBlocks = this.getGalleryExample();
        response = '🖼️ Here\'s a **Gallery** example - view these photos in a grid:';
        break;

      case 'social_share':
      case 'social share':
        richContentBlocks = this.getSocialShareExample();
        response = '📱 Here\'s a **Social Share** example - embedded TikTok video:';
        break;

      case 'social_profile':
      case 'social profile':
        richContentBlocks = this.getSocialProfileExample();
        response = '👤 Here\'s a **Social Profile** example - creator profile card:';
        break;

      // Interactive Elements
      case 'button_card':
      case 'button card':
      case 'buttons':
        richContentBlocks = this.getButtonCardExample();
        response = '🔘 Here\'s a **Button Card** example - action buttons:';
        break;

      case 'quick_replies':
      case 'quick replies':
      case 'quick':
        richContentBlocks = this.getQuickRepliesExample();
        response = '⚡ Here\'s a **Quick Replies** example - fast-tap responses:';
        break;

      case 'poll':
        richContentBlocks = this.getPollExample();
        response = '📊 Here\'s a **Poll** example - vote for your favorite:';
        break;

      case 'form_card':
      case 'form card':
      case 'form':
        richContentBlocks = this.getFormCardExample();
        response = '📝 Here\'s a **Form Card** example - data collection form:';
        break;

      // Information Cards
      case 'profile_card':
      case 'profile card':
      case 'profile':
        richContentBlocks = this.getProfileCardExample();
        response = '👨‍💼 Here\'s a **Profile Card** example - person profile:';
        break;

      case 'product_card':
      case 'product card':
      case 'product':
        richContentBlocks = this.getProductCardExample();
        response = '🛍️ Here\'s a **Product Card** example - e-commerce product:';
        break;

      case 'event_card':
      case 'event card':
      case 'event':
        richContentBlocks = this.getEventCardExample();
        response = '📅 Here\'s an **Event Card** example - upcoming conference:';
        break;

      case 'location_card':
      case 'location card':
      case 'location':
        richContentBlocks = this.getLocationCardExample();
        response = '📍 Here\'s a **Location Card** example - business location:';
        break;

      case 'contact_card':
      case 'contact card':
      case 'contact':
        richContentBlocks = this.getContactCardExample();
        response = '📇 Here\'s a **Contact Card** example - business card:';
        break;

      case 'link_preview':
      case 'link preview':
      case 'link':
        richContentBlocks = this.getLinkPreviewExample();
        response = '🔗 Here\'s a **Link Preview** example - article preview:';
        break;

      // Workflow & Tasks
      case 'task_card':
      case 'task card':
      case 'task':
        richContentBlocks = this.getTaskCardExample();
        response = '✅ Here\'s a **Task Card** example - task with status:';
        break;

      case 'project_card':
      case 'project card':
      case 'project':
        richContentBlocks = this.getProjectCardExample();
        response = '📊 Here\'s a **Project Card** example - project progress:';
        break;

      case 'reminder_card':
      case 'reminder card':
      case 'reminder':
        richContentBlocks = this.getReminderCardExample();
        response = '⏰ Here\'s a **Reminder Card** example - scheduled reminder:';
        break;

      case 'workflow_status':
      case 'workflow status':
      case 'workflow':
        richContentBlocks = this.getWorkflowStatusExample();
        response = '⚙️ Here\'s a **Workflow Status** example - pipeline execution:';
        break;

      // Special commands
      case 'help':
      case 'commands':
      case 'list':
        response = this.agent.getWelcomeMessage(null, true);
        break;

      case 'all':
        response = '🎨 Sending multiple examples! Check them out:';
        // Send first example immediately, queue others
        richContentBlocks = this.getCarouselExample();
        // Queue additional examples
        this.sendMultipleExamples(chatId).catch(err => {
          console.error('Error sending multiple examples:', err.message);
        });
        break;

      default:
        response = `❓ Unknown command: "${userMessage}"

Type \`help\` to see all available commands, or try one of these:
• \`carousel\` - Swipeable carousel
• \`gallery\` - Photo grid
• \`poll\` - Voting poll
• \`form\` - Data collection form
• \`all\` - See multiple examples`;
        break;
    }

    // Return response with rich content blocks
    // Let BaseWebhook.sendResponse() handle the actual sending
    return { response, richContentBlocks };
  }

  /**
   * Send multiple examples in sequence (for 'all' command)
   * @param {string} chatId - Chat ID
   */
  async sendMultipleExamples(chatId) {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const examples = [
      { text: '🖼️ Gallery example:', blocks: this.getGalleryExample() },
      { text: '🔘 Button Card example:', blocks: this.getButtonCardExample() },
      { text: '⚡ Quick Replies example:', blocks: this.getQuickRepliesExample() },
      { text: '📊 Poll example:', blocks: this.getPollExample() },
      { text: '🛍️ Product Card example:', blocks: this.getProductCardExample() }
    ];

    for (const example of examples) {
      await delay(1500); // Wait 1.5 seconds between messages
      await webhookHelpers.sendResponse(this.client, chatId, example.text, example.blocks);
    }

    await delay(1500);
    await webhookHelpers.sendResponse(
      this.client,
      chatId,
      '✨ That\'s a sample! Type any command to see more examples, or `help` for the full list.',
      null
    );
  }

  // ==========================================================================
  // VISUAL & MEDIA EXAMPLES
  // ==========================================================================

  /**
   * Get carousel example with product showcase
   * @returns {Array} Rich content blocks
   */
  getCarouselExample() {
    return [{
      type: 'carousel',
      data: {
        items: [
          {
            imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80',
            title: 'Premium Wireless Headphones',
            subtitle: '$299.99',
            description: 'Industry-leading noise cancellation with 30-hour battery life',
            url: 'https://example.com/product1'
          },
          {
            imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80',
            title: 'Smart Fitness Watch',
            subtitle: '$399.99',
            description: 'Track health metrics, GPS, waterproof design',
            url: 'https://example.com/product2'
          },
          {
            imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=900&q=80',
            title: 'Designer Sunglasses',
            subtitle: '$189.99',
            description: 'UV protection, polarized lenses, luxury brand',
            url: 'https://example.com/product3'
          },
          {
            imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=900&q=80',
            title: 'Leather Sneakers',
            subtitle: '$149.99',
            description: 'Handcrafted Italian leather, comfort insole',
            url: 'https://example.com/product4'
          },
          {
            imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=80',
            title: 'Minimalist Backpack',
            subtitle: '$79.99',
            description: 'Water-resistant, laptop sleeve, TSA-friendly',
            url: 'https://example.com/product5'
          }
        ],
        interval: 3500
      },
      order: 0
    }];
  }

  /**
   * Get gallery example with photo grid
   * @returns {Array} Rich content blocks
   */
  getGalleryExample() {
    return [{
      type: 'gallery',
      data: {
        items: [
          {
            mediaId: 'demo-photo-1',
            caption: 'Mountain sunrise - breathtaking views'
          },
          {
            mediaId: 'demo-photo-2',
            caption: 'City skyline at night'
          },
          {
            mediaId: 'demo-photo-3',
            caption: 'Ocean waves crashing'
          },
          {
            mediaId: 'demo-photo-4',
            caption: 'Forest hiking trail'
          },
          {
            mediaId: 'demo-photo-5',
            caption: 'Desert landscape'
          },
          {
            mediaId: 'demo-photo-6',
            caption: 'Northern lights display'
          }
        ],
        columns: 2,
        aspectRatio: '1:1'
      },
      order: 0
    }];
  }

  /**
   * Get social share example with TikTok embed
   * @returns {Array} Rich content blocks
   */
  getSocialShareExample() {
    return [{
      type: 'social_share',
      data: {
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@creator/video/7123456789',
        aspectRatio: '9:16',
        author: {
          name: 'Travel Creator',
          handle: '@travelcreator',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80'
        },
        metrics: {
          views: 2500000,
          likes: 450000,
          comments: 23000,
          duration: 58
        }
      },
      order: 0
    }];
  }

  /**
   * Get social profile example
   * @returns {Array} Rich content blocks
   */
  getSocialProfileExample() {
    return [{
      type: 'social_profile',
      data: {
        platform: 'instagram',
        url: 'https://instagram.com/foodieblogger',
        username: 'The Foodie Explorer',
        handle: '@foodieblogger',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80',
        bio: 'Food blogger 🍜 | Travel enthusiast ✈️ | Recipe creator 👨‍🍳 | Featured in Bon Appétit',
        verified: true,
        metrics: {
          followers: 1250000,
          following: 850,
          posts: 1432
        },
        profileType: 'creator'
      },
      order: 0
    }];
  }

  // ==========================================================================
  // INTERACTIVE ELEMENTS EXAMPLES
  // ==========================================================================

  /**
   * Get button card example
   * @returns {Array} Rich content blocks
   */
  getButtonCardExample() {
    return [{
      type: 'button_card',
      data: {
        title: 'Join Our Premium Membership',
        description: 'Unlock exclusive features, early access, and special discounts',
        imageUrl: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=900&q=80',
        buttons: [
          {
            id: 'subscribe-annual',
            label: '🎯 Subscribe Annual ($99)',
            action: 'url',
            url: 'https://example.com/subscribe/annual',
            variant: 'primary'
          },
          {
            id: 'subscribe-monthly',
            label: '📅 Subscribe Monthly ($12)',
            action: 'url',
            url: 'https://example.com/subscribe/monthly',
            variant: 'secondary'
          },
          {
            id: 'learn-more',
            label: '📚 Learn More',
            action: 'url',
            url: 'https://example.com/pricing',
            variant: 'outline'
          },
          {
            id: 'contact',
            label: '💬 Contact Sales',
            action: 'message',
            message: 'I would like to speak with sales',
            variant: 'outline'
          }
        ]
      },
      order: 0
    }];
  }

  /**
   * Get quick replies example
   * @returns {Array} Rich content blocks
   */
  getQuickRepliesExample() {
    return [{
      type: 'quick_replies',
      data: {
        replies: [
          {
            id: 'yes',
            label: '✅ Yes',
            icon: 'check'
          },
          {
            id: 'no',
            label: '❌ No',
            icon: 'x'
          },
          {
            id: 'maybe',
            label: '🤔 Maybe',
            icon: 'help'
          },
          {
            id: 'later',
            label: '⏰ Ask Later',
            icon: 'clock'
          },
          {
            id: 'info',
            label: 'ℹ️ More Info',
            icon: 'info'
          }
        ]
      },
      order: 0
    }];
  }

  /**
   * Get poll example
   * @returns {Array} Rich content blocks
   */
  getPollExample() {
    return [{
      type: 'poll',
      data: {
        question: 'What\'s your favorite A1Zap feature?',
        options: [
          {
            id: 'rich-content',
            text: '🎨 Rich Content Blocks',
            count: 342
          },
          {
            id: 'webhooks',
            text: '🔗 Webhook Integration',
            count: 198
          },
          {
            id: 'ai-agents',
            text: '🤖 AI Agent System',
            count: 527
          },
          {
            id: 'analytics',
            text: '📊 Analytics Dashboard',
            count: 143
          },
          {
            id: 'api',
            text: '⚡ RESTful API',
            count: 289
          }
        ],
        allowMultiple: false,
        totalVotes: 1499
      },
      order: 0
    }];
  }

  /**
   * Get form card example
   * @returns {Array} Rich content blocks
   */
  getFormCardExample() {
    return [{
      type: 'form_card',
      data: {
        title: 'Contact Us',
        description: 'Fill out this form and we\'ll get back to you within 24 hours',
        submitButtonText: 'Submit Request',
        fields: [
          {
            id: 'full-name',
            label: 'Full Name',
            type: 'text',
            required: true,
            placeholder: 'John Doe'
          },
          {
            id: 'email',
            label: 'Email Address',
            type: 'text',
            required: true,
            placeholder: 'john@example.com'
          },
          {
            id: 'company',
            label: 'Company Name',
            type: 'text',
            required: false,
            placeholder: 'Acme Inc.'
          },
          {
            id: 'inquiry-type',
            label: 'Type of Inquiry',
            type: 'select',
            required: true,
            options: [
              { value: 'sales', label: 'Sales Inquiry' },
              { value: 'support', label: 'Technical Support' },
              { value: 'partnership', label: 'Partnership Opportunity' },
              { value: 'feedback', label: 'Product Feedback' },
              { value: 'other', label: 'Other' }
            ]
          },
          {
            id: 'message',
            label: 'Message',
            type: 'textarea',
            required: true,
            placeholder: 'Tell us more about your inquiry...'
          },
          {
            id: 'newsletter',
            label: 'Subscribe to our newsletter',
            type: 'checkbox',
            defaultValue: 'true'
          }
        ]
      },
      order: 0
    }];
  }

  // ==========================================================================
  // INFORMATION CARDS EXAMPLES
  // ==========================================================================

  /**
   * Get profile card example
   * @returns {Array} Rich content blocks
   */
  getProfileCardExample() {
    return [{
      type: 'profile_card',
      data: {
        name: 'Dr. Sarah Chen',
        handle: '@drsarahchen',
        bio: 'Chief Technology Officer | AI Research Lead | Stanford PhD | Speaker & Author',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&q=80',
        verified: true
      },
      order: 0
    }];
  }

  /**
   * Get product card example
   * @returns {Array} Rich content blocks
   */
  getProductCardExample() {
    return [{
      type: 'product_card',
      data: {
        name: 'MacBook Pro 16-inch',
        description: 'M3 Max chip, 36GB RAM, 1TB SSD. The most powerful MacBook Pro ever. Perfect for developers and creators.',
        price: 3499.99,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=900&q=80',
        url: 'https://example.com/macbook-pro',
        rating: 4.8,
        reviewCount: 2847,
        inStock: true,
        sku: 'MBP-16-M3MAX-36-1TB'
      },
      order: 0
    }];
  }

  /**
   * Get event card example
   * @returns {Array} Rich content blocks
   */
  getEventCardExample() {
    return [{
      type: 'event_card',
      data: {
        title: 'AI & Machine Learning Summit 2025',
        description: 'Join 500+ industry leaders for 2 days of keynotes, workshops, and networking on the future of AI',
        startTime: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
        endTime: Date.now() + (31 * 24 * 60 * 60 * 1000), // 31 days from now
        location: 'San Francisco Convention Center, CA',
        imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80',
        url: 'https://example.com/ai-summit-2025',
        attendeeCount: 487,
        maxAttendees: 500,
        isVirtual: false
      },
      order: 0
    }];
  }

  /**
   * Get location card example
   * @returns {Array} Rich content blocks
   */
  getLocationCardExample() {
    return [{
      type: 'location_card',
      data: {
        name: 'Blue Bottle Coffee - Ferry Building',
        address: '1 Ferry Building, San Francisco, CA 94111',
        latitude: 37.7956,
        longitude: -122.3933,
        imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900&q=80',
        url: 'https://maps.google.com/?q=37.7956,-122.3933'
      },
      order: 0
    }];
  }

  /**
   * Get contact card example
   * @returns {Array} Rich content blocks
   */
  getContactCardExample() {
    return [{
      type: 'contact_card',
      data: {
        name: 'Alex Martinez',
        jobTitle: 'Senior Account Manager',
        company: 'TechCorp Solutions',
        phoneNumber: '+1 (415) 555-0123',
        email: 'alex.martinez@techcorp.com',
        address: '123 Market Street, Suite 400, San Francisco, CA 94102',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80',
        website: 'https://techcorp.com'
      },
      order: 0
    }];
  }

  /**
   * Get link preview example
   * @returns {Array} Rich content blocks
   */
  getLinkPreviewExample() {
    return [{
      type: 'link_preview',
      data: {
        url: 'https://example.com/blog/future-of-ai',
        title: 'The Future of AI: What to Expect in 2025',
        description: 'Explore the latest trends in artificial intelligence, from large language models to autonomous systems. Industry experts share their predictions for the year ahead.',
        imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=900&q=80',
        faviconUrl: 'https://example.com/favicon.ico',
        siteName: 'TechInsights Blog'
      },
      order: 0
    }];
  }

  // ==========================================================================
  // WORKFLOW & TASKS EXAMPLES
  // ==========================================================================

  /**
   * Get task card example
   * @returns {Array} Rich content blocks
   */
  getTaskCardExample() {
    return [{
      type: 'task_card',
      data: {
        taskId: 'TASK-1234',
        title: 'Complete Q4 Product Roadmap',
        description: 'Finalize feature prioritization, timeline estimates, and resource allocation for Q4 2025',
        status: 'in_progress',
        priority: 'high',
        dueDate: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
        assignee: {
          name: 'Jane Smith',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80'
        },
        tags: ['planning', 'roadmap', 'q4', 'priority']
      },
      order: 0
    }];
  }

  /**
   * Get project card example
   * @returns {Array} Rich content blocks
   */
  getProjectCardExample() {
    return [{
      type: 'project_card',
      data: {
        projectId: 'PROJ-2025-WEB',
        name: 'Website Redesign Project',
        description: 'Complete overhaul of company website with modern design, improved UX, and performance optimization',
        status: 'In Progress',
        progress: 68,
        dueDate: Date.now() + (45 * 24 * 60 * 60 * 1000), // 45 days from now
        assignees: [
          { 
            name: 'Alice Chen', 
            avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80' 
          },
          { 
            name: 'Bob Wilson', 
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80' 
          },
          { 
            name: 'Carol Davis', 
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&q=80' 
          }
        ],
        tags: ['design', 'frontend', 'ux', 'high-priority']
      },
      order: 0
    }];
  }

  /**
   * Get reminder card example
   * @returns {Array} Rich content blocks
   */
  getReminderCardExample() {
    return [{
      type: 'reminder_card',
      data: {
        reminderId: 'REM-2025-001',
        title: 'Team Meeting - Q4 Planning',
        description: 'Prepare slides on team objectives, resource needs, and timeline estimates',
        reminderTime: Date.now() + (2 * 60 * 60 * 1000), // 2 hours from now
        isRecurring: false,
        category: 'meeting'
      },
      order: 0
    }];
  }

  /**
   * Get workflow status example
   * @returns {Array} Rich content blocks
   */
  getWorkflowStatusExample() {
    return [{
      type: 'workflow_status',
      data: {
        workflowId: 'WF-2025-DEPLOY-42',
        name: 'Production Deployment Pipeline',
        description: 'Automated deployment workflow for v2.5.0 release',
        status: 'running',
        progress: 65,
        completedSteps: 4,
        totalSteps: 6,
        currentStep: 'Running integration tests',
        startTime: Date.now() - (8 * 60 * 1000) // Started 8 minutes ago
      },
      order: 0
    }];
  }
}

// Create and export singleton webhook handler
const richContentDemoWebhook = new RichContentDemoWebhook();
module.exports = richContentDemoWebhook.createHandler();

