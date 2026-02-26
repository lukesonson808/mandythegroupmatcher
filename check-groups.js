/**
 * Script to check if groups were received from the a1zap-maker server
 * Usage: node check-groups.js
 */

const axios = require('axios');

const BASE_URL = process.env.MANDY_SERVER_URL || 'https://mandythegroupmatcher-production.up.railway.app';

async function checkGroups() {
  try {
    console.log('🔍 Checking for received groups...\n');
    console.log(`📍 Server: ${BASE_URL}\n`);

    // Check health first
    try {
      const health = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      console.log('✅ Server is healthy:', health.data.status);
    } catch (error) {
      console.warn('⚠️  Health check failed, but continuing...');
    }

    // Get all groups
    console.log('\n📋 Fetching all groups...');
    const response = await axios.get(`${BASE_URL}/api/groups`, { timeout: 10000 });
    
    const data = response.data;
    
    console.log(`\n📊 Results:`);
    console.log(`   Total Groups: ${data.totalGroups || 0}`);
    
    if (data.groups && data.groups.length > 0) {
      console.log(`\n✅ Found ${data.groups.length} group(s):\n`);
      
      data.groups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.groupName || group.name || 'Unknown'}`);
        console.log(`   ID: ${group.id || 'N/A'}`);
        console.log(`   Size: ${group.size || 'N/A'}`);
        console.log(`   Created: ${group.createdAt || 'N/A'}`);
        console.log('');
      });

      // Check for Test_1 specifically
      const test1Group = data.groups.find(g => 
        (g.groupName && g.groupName.toLowerCase().includes('test_1')) ||
        (g.name && g.name.toLowerCase().includes('test_1'))
      );

      if (test1Group) {
        console.log('✅ Found "Test_1" group!');
        console.log(JSON.stringify(test1Group, null, 2));
      } else {
        console.log('⚠️  "Test_1" group not found in the list');
      }
    } else {
      console.log('\n❌ No groups found in the system');
      console.log('\n💡 This could mean:');
      console.log('   1. Groups were not sent from a1zap-maker server');
      console.log('   2. Groups were sent but not received (check endpoint)');
      console.log('   3. Groups were sent to wrong endpoint');
      console.log('\n📝 To check if groups were sent, verify:');
      console.log('   - a1zap-maker is sending to: /api/groups/receive');
      console.log('   - Data format matches INTEGRATION_FORMAT.md');
      console.log('   - Server logs show "📥 [Groups] Received group data"');
    }

  } catch (error) {
    console.error('\n❌ Error checking groups:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received. Is the server running?');
    }
    process.exit(1);
  }
}

checkGroups();
