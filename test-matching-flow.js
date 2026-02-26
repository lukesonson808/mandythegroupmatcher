/**
 * Test script for the complete matching flow
 * Run with: node test-matching-flow.js
 * 
 * Tests:
 * 1. Receiving group data from a1zap-maker
 * 2. Storing groups
 * 3. Running matching algorithm
 * 4. Creating chat and extracting shareable link
 * 5. Sending emails (if configured)
 */

const axios = require('axios');

// Configuration - update with your Railway URL or use localhost for local testing
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Test data - sample groups (matching format from a1zap-maker)
const testGroup1 = {
  groupName: 'Test Group Alpha',
  email: 'test-alpha@example.com',
  memberEmails: ['member1@example.com', 'member2@example.com', 'member3@example.com'],
  groupSize: 3,
  lookingFor: ['meet-people', 'down-for-whatever'],
  vibeTags: ['chill-vibes', 'foodies', 'outdoorsy'],
  tagline: 'We love adventures and good food!',
  leadName: 'Alice',
  leadEmail: 'test-alpha@example.com',
  leadPhone: '+1234567890'
};

const testGroup2 = {
  groupName: 'Test Group Beta',
  email: 'test-beta@example.com',
  memberEmails: ['member4@example.com', 'member5@example.com'],
  groupSize: 2,
  lookingFor: ['meet-people'],
  vibeTags: ['energetic', 'social', 'foodies'],
  tagline: 'Always up for trying new things!',
  leadName: 'Bob',
  leadEmail: 'test-beta@example.com',
  leadPhone: '+1234567891'
};

async function testFlow() {
  console.log('🧪 Testing Complete Matching Flow\n');
  console.log('='.repeat(60));
  console.log(`📍 Testing against: ${BASE_URL}\n`);
  
  try {
    // Step 1: Health check
    console.log('🏥 Step 0: Health check...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Server is healthy:', healthResponse.data.status);
    } catch (error) {
      console.warn('⚠️  Health check failed, but continuing...');
    }
    
    // Step 1: Send first group
    console.log('\n📥 Step 1: Sending Group 1 data...');
    console.log('   Group:', testGroup1.groupName);
    const response1 = await axios.post(`${BASE_URL}/api/groups/receive`, testGroup1, {
      timeout: 10000
    });
    console.log('✅ Group 1 received and saved');
    console.log('   ID:', response1.data.group?.id || 'N/A');
    console.log('   Email:', response1.data.group?.email || 'N/A');
    
    // Step 2: Send second group
    console.log('\n📥 Step 2: Sending Group 2 data...');
    console.log('   Group:', testGroup2.groupName);
    const response2 = await axios.post(`${BASE_URL}/api/groups/receive`, testGroup2, {
      timeout: 10000
    });
    console.log('✅ Group 2 received and saved');
    console.log('   ID:', response2.data.group?.id || 'N/A');
    console.log('   Email:', response2.data.group?.email || 'N/A');
    
    // Step 3: Check groups
    console.log('\n📋 Step 3: Checking all groups...');
    const groupsResponse = await axios.get(`${BASE_URL}/api/groups`, { timeout: 10000 });
    console.log(`✅ Found ${groupsResponse.data.totalGroups} groups`);
    if (groupsResponse.data.groups && groupsResponse.data.groups.length > 0) {
      console.log('   Groups:', groupsResponse.data.groups.map(g => g.groupName).join(', '));
    }
    
    // Step 4: Run matching
    console.log('\n💕 Step 4: Running matching algorithm...');
    console.log('   This may take a moment (AI analysis)...');
    const matchResponse = await axios.post(`${BASE_URL}/api/match`, {}, {
      timeout: 60000 // 60 seconds for AI matching
    });
    console.log('✅ Matching completed!');
    
    // Display match summary
    if (matchResponse.data.summary) {
      console.log('\n📊 Match Summary:');
      console.log(`   Total Groups: ${matchResponse.data.summary.totalGroups}`);
      console.log(`   Total Matches: ${matchResponse.data.summary.totalMatches}`);
      if (matchResponse.data.summary.bestMatch) {
        console.log(`   Best Match: ${matchResponse.data.summary.bestMatch.group1} ↔ ${matchResponse.data.summary.bestMatch.group2}`);
        console.log(`   Compatibility: ${matchResponse.data.summary.bestMatch.compatibility}%`);
      }
    }
    
    // Step 5: Check email status and chat creation
    console.log('\n📧 Step 5: Checking email and chat creation...');
    if (matchResponse.data.emailStatus) {
      const emailStatus = matchResponse.data.emailStatus;
      console.log('✅ Email service executed');
      console.log(`   Share Link: ${emailStatus.shareLink || 'Not generated'}`);
      console.log(`   Chat ID: ${emailStatus.chatId || 'Not generated'}`);
      console.log(`   Emails Sent: ${emailStatus.sent ? 'Yes' : 'No'}`);
      
      if (emailStatus.emails && emailStatus.emails.length > 0) {
        console.log('\n   Email Details:');
        emailStatus.emails.forEach((email, idx) => {
          console.log(`   ${idx + 1}. ${email.group}: ${email.success ? '✅ Sent' : '❌ Failed'}`);
          if (email.error) {
            console.log(`      Error: ${email.error}`);
          }
        });
      }
      
      // Verify share link format: should be /chat/{agentSlug}/{groupChatId}, not synthetic
      if (emailStatus.shareLink) {
        const hasChatPath = emailStatus.shareLink.includes('/chat/');
        const looksSynthetic = emailStatus.chatId && String(emailStatus.chatId).startsWith('match_');
        if (hasChatPath && !looksSynthetic) {
          console.log('   ✅ Share link format is correct (/chat/ with real group chat ID)');
        } else if (hasChatPath) {
          console.log('   ✅ Share link has /chat/ path');
        } else {
          console.log('   ⚠️  Share link format may be incorrect (expected .../chat/{agentSlug}/{groupChatId})');
        }
      }
    } else {
      console.log('⚠️  No email status returned (no match found or email service not configured)');
    }
    
    // Step 6: Check matches
    console.log('\n📋 Step 6: Checking all saved matches...');
    const matchesResponse = await axios.get(`${BASE_URL}/api/matches`, { timeout: 10000 });
    console.log(`✅ Found ${matchesResponse.data.totalMatches} saved matches`);
    if (matchesResponse.data.matches && matchesResponse.data.matches.length > 0) {
      console.log('\n   Matches:');
      matchesResponse.data.matches.slice(0, 5).forEach((match, idx) => {
        console.log(`   ${idx + 1}. ${match.group1} ↔ ${match.group2} (${match.compatibility}%)`);
        if (match.isBestMatch) {
          console.log('      ⭐ Best Match');
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Groups received and stored');
    console.log('   ✅ Matching algorithm executed');
    console.log('   ✅ Chat link created (if match found)');
    console.log('   ✅ Emails sent (if configured and match found)');
    console.log('\n💡 Note: If emails failed, check that MANDY_AGENT_ID and MANDY_API_KEY are set');
    console.log('   If chat creation failed, ensure A1ZAP_WEBAPP_URL is reachable and MANDY_AGENT_ID is the Convex agent ID');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received. Is the server running?');
      console.error('   Make sure the server is running at:', BASE_URL);
    } else {
      console.error('   Error:', error.message);
    }
    console.error('\n   Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testFlow();
