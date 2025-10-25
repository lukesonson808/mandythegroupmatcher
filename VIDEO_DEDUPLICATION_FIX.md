# Video Deduplication Fix

## Problem

When returning related videos to users, the system was sometimes sending duplicate videos. This occurred when multiple restaurants in the CSV shared the same TikTok URL. For example:

- **Ocean Palace, Quan 1**
- **Saigon Central Post Office**  
- **Tan Dinh Church**

All three places share the same TikTok URL: `https://www.tiktok.com/@brandneweats/video/7326398793815969031`

If a user asked about all three places, they would receive the same video 3 times.

## Solution

Implemented deduplication logic in the social link extractor to ensure each unique video URL is only sent once.

### Changes Made

#### 1. **services/social-link-extractor.js**

Added deduplication logic after finding relevant links but before limiting to 5:

```javascript
// Deduplicate by URL - keep only the first occurrence of each unique URL
const seenUrls = new Set();
const uniqueLinks = relevantLinks.filter(link => {
  if (seenUrls.has(link.url)) {
    console.log(`   ℹ️  Skipping duplicate URL for ${link.name}: ${link.url}`);
    return false;
  }
  seenUrls.add(link.url);
  return true;
});
```

This ensures:
- Only unique video URLs are included
- The first mentioned restaurant "claims" each video
- Duplicate URLs are logged for debugging
- The count is accurate before applying the 5-video limit

#### 2. **webhooks/brandoneats-webhook.js**

Updated the message to include the video count:

**Before:**
```javascript
const socialMessage = relevantLinks.length === 1
  ? `🎥 Here's a video about ${relevantLinks[0].name}!`
  : `🎥 Here are some videos about these places!`;
```

**After:**
```javascript
const socialMessage = relevantLinks.length === 1
  ? `🎥 Here's a video about ${relevantLinks[0].name}!`
  : `🎥 Here are ${relevantLinks.length} videos about these places!`;
```

This ensures the message count always matches the actual number of videos sent.

### Testing

Created two comprehensive tests:

#### **test-video-deduplication.js**
Tests that duplicate videos are properly filtered:
- Mentions 3 places that share the same video
- Verifies only 1 video is returned
- ✅ **Result:** Only 1 unique video sent (not 3 duplicates)

#### **test-multiple-unique-videos.js**
Tests that unique videos are all included:
- Mentions 3 places with different videos
- Verifies all 3 videos are returned
- ✅ **Result:** All 3 unique videos sent

### Run Tests

```bash
# Test deduplication
node tests/test-video-deduplication.js

# Test multiple unique videos
node tests/test-multiple-unique-videos.js
```

## Benefits

✅ **No more duplicate videos** - Users see each video only once  
✅ **Accurate count** - Message says "Here are 2 videos" and sends exactly 2  
✅ **Better UX** - Cleaner, more professional experience  
✅ **Efficient** - Doesn't waste bandwidth or user attention on duplicates  
✅ **Logged** - Duplicate skips are logged for debugging

## Example

**User asks:** "Tell me about Ocean Palace, Saigon Central Post Office, and Tan Dinh Church"

**Before fix:**
- Bot response with info
- Follow-up: "🎥 Here are some videos about these places!"
- Sends 3 videos (all the same URL - duplicates!)

**After fix:**
- Bot response with info
- Follow-up: "🎥 Here's a video about Ocean Palace, Quan 1!"
- Sends 1 video (the unique URL)

## CSV Data Note

The CSV file (`files/brandoneats.csv`) contains several instances where multiple places share the same TikTok URL. This is expected behavior when one video covers multiple locations. The deduplication logic handles this gracefully.

Examples of shared URLs in the CSV:
- Lines 3-20: Ocean Palace + Saigon Central Post Office + Tan Dinh Church
- Lines 188-203: Lâm Phở Bò + Pho Cuon Huong Mai + Pho Co Hao
- Lines 476-497: Several Da Nang dessert spots

The fix ensures these shared URLs result in one video, not duplicates.

