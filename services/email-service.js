/**
 * Email Service
 * Sends emails using the A1Zap API
 */

const axios = require('axios');
const config = require('../config');

class EmailService {
  constructor() {
    // Use config.js values (which already has MANDY_AGENT_ID and A1ZAP_API_KEY)
    this.mandyAgentId = process.env.MANDY_AGENT_ID || config.agents.mandy.agentId;
    this.mandyApiKey = process.env.MANDY_API_KEY || process.env.A1ZAP_API_KEY || config.agents.mandy.apiKey;
    this.a1zapApiUrl = process.env.A1ZAP_API_URL || 'https://api.a1zap.com';
    // Webapp base URL for group-chat create and share links (e.g. https://www.a1zap.com)
    this.webappBaseUrl = (process.env.A1ZAP_WEBAPP_URL || 'https://www.a1zap.com').replace(/\/$/, '');
    // Agent slug for constructing shareable links (e.g., "mandythematchmaker")
    this.agentSlug = process.env.MANDY_AGENT_SLUG || 'mandythematchmaker';
  }

  /**
   * Check if email service is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.mandyAgentId && this.mandyApiKey && 
              !this.mandyAgentId.includes('your_') && 
              !this.mandyApiKey.includes('your_'));
  }

  /**
   * Send email from Mandy
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} bodyHtml - HTML email body
   * @param {string} bodyText - Plain text email body
   * @param {string} replyTo - Optional reply-to address
   * @returns {Promise<Object>} { success: boolean, emailId?: string, error?: string }
   */
  async sendEmail(to, subject, bodyHtml, bodyText, replyTo = null) {
    if (!this.isConfigured()) {
      console.error('[Email Service] MANDY_AGENT_ID or MANDY_API_KEY not configured');
      return { 
        success: false, 
        error: 'Email service not configured. Please set MANDY_AGENT_ID and MANDY_API_KEY environment variables.' 
      };
    }

    try {
      const url = `${this.a1zapApiUrl}/v1/agents/${this.mandyAgentId}/emails/send`;
      
      const payload = {
        to,
        subject,
        bodyHtml,
        bodyText
      };

      if (replyTo) {
        payload.replyTo = replyTo;
      }

      console.log(`📧 [Email Service] Sending email to: ${to}`);
      console.log(`   Subject: ${subject}`);

      const response = await axios.post(url, payload, {
        headers: {
          'X-API-Key': this.mandyApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.emailId) {
        console.log(`✅ [Email Service] Email sent successfully: ${response.data.emailId}`);
        return { 
          success: true, 
          emailId: response.data.emailId,
          messageId: response.data.messageId,
          timestamp: response.data.timestamp
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ [Email Service] Error sending email:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
        return { 
          success: false, 
          error: `API error: ${error.response.status} - ${error.response.data?.error || error.message}` 
        };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a group chat via the webapp API and return the shareable link.
   * Uses POST {webappBaseUrl}/api/agents/{agentId}/group-chat/create, then
   * builds link as {webappBaseUrl}/chat/{agentSlug}/{groupChatId}.
   * Does not return synthetic links; on failure returns success: false so email copy can avoid claiming a chat link.
   *
   * @param {Object} group1 - First group data { name, memberEmails?, ... }
   * @param {Object} group2 - Second group data { name, memberEmails?, ... }
   * @returns {Promise<Object>} { success: boolean, shareLink?: string, chatId?: string, error?: string }
   */
  async createGroupChatLink(group1, group2) {
    if (!this.mandyAgentId || this.mandyAgentId.includes('your_')) {
      console.warn('[Email Service] MANDY_AGENT_ID not configured; cannot create group chat');
      return { success: false, error: 'MANDY_AGENT_ID not configured' };
    }

    const url = `${this.webappBaseUrl}/api/agents/${this.mandyAgentId}/group-chat/create`;
    const chatName = `Match: ${group1.name} & ${group2.name}`;
    const payload = {
      name: chatName,
      isAnonymous: true,
      anonymousUserId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      anonymousUserName: 'Mandy Match'
    };

    try {
      console.log(`💬 [Email Service] Creating group chat for: ${group1.name} + ${group2.name}`);
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const data = response.data;
      const groupChatId = data?.chat?.id;

      if (!data?.success || !groupChatId) {
        console.warn('[Email Service] Group chat create response missing success or chat.id:', JSON.stringify(data));
        return { success: false, error: 'No chat ID in response' };
      }

      const shareLink = `${this.webappBaseUrl}/chat/${this.agentSlug}/${groupChatId}`;
      console.log(`✅ [Email Service] Group chat created: ${groupChatId}`);
      console.log(`   Share Link: ${shareLink}`);

      return {
        success: true,
        shareLink,
        chatId: groupChatId
      };
    } catch (error) {
      console.error('[Email Service] Error creating group chat:', error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Send match notification email to both groups
   * @param {Object} group1 - First group data { name, email, memberEmails?, ... }
   * @param {Object} group2 - Second group data { name, email, memberEmails?, ... }
   * @param {Object} matchInfo - Match information { compatibility, ... }
   * @returns {Promise<Object>} { success: boolean, emails: Array, shareLink?: string }
   */
  async sendMatchNotification(group1, group2, matchInfo = {}) {
    const compatibility = matchInfo.compatibility || {};
    const compatibilityScore = compatibility.percentage || compatibility.score * 100 || 'N/A';

    // Create group chat link first; do not use synthetic links
    const chatResult = await this.createGroupChatLink(group1, group2);
    const hasChatLink = chatResult.success && !!chatResult.shareLink;
    const shareLink = hasChatLink
      ? chatResult.shareLink
      : `${this.webappBaseUrl}/harvard/mandy`;

    // Create email content; avoid claiming a working chat link when we don't have one
    const subject = `🎉 You've been matched with ${group2.name}!`;
    const ctaCopy = hasChatLink ? 'Join Group Chat →' : 'Visit Mandy →';
    const chatBlurb = hasChatLink
      ? `Click the link below to join your group chat with ${group2.name} and start planning together!`
      : `Head to Mandy to connect with ${group2.name} and get the conversation started.`;
    const nextSteps = hasChatLink
      ? 'Once you join the chat, Mandy will be there to help you break the ice and plan activities together!'
      : 'Mandy will help you break the ice and plan activities together.';

    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #A51C30;">🎉 You've Been Matched!</h1>
        <p>Hi ${group1.name},</p>
        <p>Great news! We've found a match for your group.</p>
        
        <h2 style="color: #A51C30;">Your Match: ${group2.name}</h2>
        <p>You've been matched with <strong>${group2.name}</strong>!</p>
        
        ${compatibilityScore !== 'N/A' ? `<p><strong>Compatibility Score: ${compatibilityScore}%</strong></p>` : ''}
        
        <h2 style="color: #A51C30;">${hasChatLink ? 'Join Your Group Chat' : 'Next Steps'}</h2>
        <p>${chatBlurb}</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${shareLink}" style="background-color: #A51C30; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            ${ctaCopy}
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">Or copy this link: ${shareLink}</p>
        ${hasChatLink ? `
        <h2 style="color: #A51C30;">Next Steps</h2>
        <p>${nextSteps}</p>
        ` : `<p>${nextSteps}</p>`}
        
        <p>Best,<br>Mandy the Matchmaker</p>
      </div>
    `;

    const bodyText = `Great news, ${group1.name}!\n\nYou've been matched with ${group2.name}!\n\n${compatibilityScore !== 'N/A' ? `Compatibility Score: ${compatibilityScore}%\n\n` : ''}${chatBlurb}\n\n${shareLink}\n\n${nextSteps}\n\nBest,\nMandy the Matchmaker`;

    // Send to both groups
    const results = [];
    
    // Email to group 1
    if (group1.email) {
      const result1 = await this.sendEmail(group1.email, subject, bodyHtml, bodyText);
      results.push({ group: group1.name, email: group1.email, ...result1 });
    } else {
      console.warn(`⚠️  [Email Service] Group 1 (${group1.name}) has no email address`);
      results.push({ group: group1.name, email: null, success: false, error: 'No email address' });
    }

    // Email to group 2 (with swapped subject/content)
    const subject2 = `🎉 You've been matched with ${group1.name}!`;
    const bodyHtml2 = bodyHtml.replace(new RegExp(group1.name, 'g'), 'YOUR_GROUP').replace(new RegExp(group2.name, 'g'), group1.name).replace('YOUR_GROUP', group2.name);
    const bodyText2 = bodyText.replace(new RegExp(group1.name, 'g'), 'YOUR_GROUP').replace(new RegExp(group2.name, 'g'), group1.name).replace('YOUR_GROUP', group2.name);

    if (group2.email) {
      const result2 = await this.sendEmail(group2.email, subject2, bodyHtml2, bodyText2);
      results.push({ group: group2.name, email: group2.email, ...result2 });
    } else {
      console.warn(`⚠️  [Email Service] Group 2 (${group2.name}) has no email address`);
      results.push({ group: group2.name, email: null, success: false, error: 'No email address' });
    }

    const allSuccessful = results.every(r => r.success);
    return {
      success: allSuccessful,
      emails: results,
      shareLink: shareLink,
      chatId: hasChatLink ? chatResult.chatId : null
    };
  }
}

module.exports = new EmailService();
