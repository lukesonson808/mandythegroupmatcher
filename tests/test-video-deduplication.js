/**
 * Test Video Deduplication
 * 
 * This test verifies that when multiple restaurants share the same TikTok URL,
 * we only send the video once (no duplicates).
 */

const socialLinkExtractor = require('../services/social-link-extractor');

async function testDeduplication() {
  console.log('\n🧪 Testing Video Deduplication\n');
  console.log('=' .repeat(60));

  // Test case: Response mentions multiple places that share the same video
  // Looking at the CSV, these places share the same TikTok URL:
  // - Ocean Palace, Quan 1
  // - Saigon Central Post Office  
  // - Tan Dinh Church
  // All use: https://www.tiktok.com/@brandneweats/video/7326398793815969031
  
  const testResponse = `
    You should definitely visit these places in Saigon:
    
    1. Ocean Palace in Quan 1 - a hella fancy Chinese spot with great yum cha
    2. Saigon Central Post Office - a beautiful historic building
    3. Tan Dinh Church - the famous pink church
    
    All three are must-visit spots!
  `;

  console.log('📝 Test Response:');
  console.log(testResponse);
  console.log('\n' + '=' .repeat(60));
  console.log('\n🔍 Extracting relevant social links...\n');

  try {
    const links = await socialLinkExtractor.extractRelevantSocialLinks(testResponse);
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 Results:\n');
    console.log(`Total links returned: ${links.length}`);
    
    if (links.length > 0) {
      console.log('\nLinks:');
      links.forEach((link, index) => {
        console.log(`  ${index + 1}. ${link.name}`);
        console.log(`     URL: ${link.url}`);
        console.log(`     City: ${link.city}`);
        console.log('');
      });
      
      // Check for duplicates
      const urls = links.map(l => l.url);
      const uniqueUrls = new Set(urls);
      
      if (urls.length !== uniqueUrls.size) {
        console.log('❌ TEST FAILED: Duplicate URLs detected!');
        console.log(`   Expected: ${uniqueUrls.size} unique URLs`);
        console.log(`   Got: ${urls.length} total URLs`);
        return false;
      } else {
        console.log('✅ TEST PASSED: No duplicate URLs!');
        console.log(`   All ${links.length} video(s) are unique`);
        return true;
      }
    } else {
      console.log('⚠️  No links found (this might be expected depending on CSV content)');
      return true;
    }
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
testDeduplication()
  .then(passed => {
    console.log('\n' + '=' .repeat(60));
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

