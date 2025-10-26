/**
 * Diagnose A1Zap message delivery
 * Check if the message was actually sent by querying message history
 */

require('dotenv').config();
const a1zapClient = require('../services/a1zap-client');
const config = require('../config');

async function diagnoseDelivery() {
  console.log('\n=== A1Zap Message Delivery Diagnostic ===\n');

  // From your logs, the chat ID is:
  const chatId = 'm97b9r4wc0bsth1artk5dm05h17t7cra';
  const expectedMessageId = 'js7780xdyqxrsw6syc1g76tnah7t6z1e'; // From the successful send
  const agentId = config.a1zap.agentId;

  console.log(`Chat ID: ${chatId}`);
  console.log(`Expected Message ID: ${expectedMessageId}`);
  console.log(`Agent ID: ${agentId}`);
  console.log('');

  // Fetch recent message history to see if our message appears
  console.log('1️⃣  Fetching message history from A1Zap...\n');
  
  try {
    const messages = await a1zapClient.getMessageHistory(chatId, 50, agentId);
    
    console.log(`Retrieved ${messages.length} messages from history\n`);

    if (messages.length === 0) {
      console.log('❌ No messages found in history');
      console.log('   This could mean:');
      console.log('   - The chat ID is incorrect');
      console.log('   - The agent doesn\'t have access to this chat');
      console.log('   - A1Zap API issue\n');
      return;
    }

    // Look for our message
    console.log('2️⃣  Searching for our sent message...\n');
    const ourMessage = messages.find(msg => msg.id === expectedMessageId);

    if (ourMessage) {
      console.log('✅ Message FOUND in history!');
      console.log('   Message:', JSON.stringify(ourMessage, null, 2));
      console.log('\n   ✨ The message was delivered to A1Zap successfully!');
      console.log('   If you don\'t see it in WhatsApp, check:');
      console.log('   - WhatsApp app (not just web)');
      console.log('   - Message might be in a different conversation');
      console.log('   - WhatsApp might be filtering/delaying it\n');
    } else {
      console.log('❌ Message NOT FOUND in history');
      console.log('   Message ID:', expectedMessageId);
      console.log('\n   This could mean:');
      console.log('   - A1Zap accepted but failed to deliver the message');
      console.log('   - There\'s a delay in A1Zap\'s processing');
      console.log('   - The message was rejected after acceptance\n');
    }

    // Show recent messages
    console.log('3️⃣  Recent messages in chat:\n');
    messages.slice(0, 10).forEach((msg, idx) => {
      console.log(`   ${idx + 1}. [${msg.isAgent ? 'AGENT' : 'USER'}] ${msg.messageType || 'text'}`);
      console.log(`      ID: ${msg.id}`);
      console.log(`      Content: ${(msg.content || '[no content]').substring(0, 50)}${msg.content?.length > 50 ? '...' : ''}`);
      if (msg.media) {
        console.log(`      Media: ${msg.media.url ? '✅ Has media URL' : '❌ No media URL'}`);
      }
      console.log('');
    });

    // Look for agent messages specifically
    const agentMessages = messages.filter(msg => msg.isAgent || msg.senderId === agentId);
    console.log(`4️⃣  Total agent messages in history: ${agentMessages.length}\n`);

    if (agentMessages.length === 0) {
      console.log('   ⚠️  NO agent messages found in history!');
      console.log('   This suggests the agent has never successfully sent a message to this chat.');
      console.log('   Possible issues:');
      console.log('   - Agent ID mismatch');
      console.log('   - A1Zap configuration issue');
      console.log('   - Messages are being sent but not recorded\n');
    } else {
      console.log('   Recent agent messages:');
      agentMessages.slice(0, 5).forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg.messageType || 'text'} - ${msg.id}`);
        console.log(`      "${(msg.content || '[no content]').substring(0, 60)}..."`);
        if (msg.media) {
          console.log(`      Media URL: ${msg.media.url || 'N/A'}`);
        }
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error fetching message history:', error.message);
    console.error('   Details:', error.response?.data || error);
  }

  console.log('=== Diagnostic Complete ===\n');
}

diagnoseDelivery().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});

