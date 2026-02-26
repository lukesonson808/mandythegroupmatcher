# Testing the Complete Matching Flow

This document outlines how to test the complete matching flow from receiving group data to sending emails with shareable chat links.

## Prerequisites

1. **Server is running** (either locally or on Railway)
2. **Environment variables are set:**
   - `MANDY_AGENT_ID` - Your Mandy agent ID
   - `MANDY_API_KEY` - Your A1Zap API key
   - `MANDY_AGENT_SLUG` - Optional, defaults to 'mandythematchmaker'
   - `CLAUDE_API_KEY` - For AI matching analysis

## Test Flow

### Step 1: Send Group 1 Data

```bash
curl -X POST https://mandythegroupmatcher-production.up.railway.app/api/groups/receive \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Test Group Alpha",
    "email": "test-alpha@example.com",
    "memberEmails": ["member1@example.com", "member2@example.com", "member3@example.com"],
    "groupSize": 3,
    "lookingFor": ["meet-people", "down-for-whatever"],
    "vibeTags": ["chill-vibes", "foodies", "outdoorsy"],
    "tagline": "We love adventures and good food!",
    "leadName": "Alice",
    "leadEmail": "test-alpha@example.com",
    "leadPhone": "+1234567890"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Group received and saved successfully",
  "group": {
    "name": "Test Group Alpha",
    "id": "group_...",
    "email": "test-alpha@example.com",
    "created": true
  }
}
```

### Step 2: Send Group 2 Data

```bash
curl -X POST https://mandythegroupmatcher-production.up.railway.app/api/groups/receive \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Test Group Beta",
    "email": "test-beta@example.com",
    "memberEmails": ["member4@example.com", "member5@example.com"],
    "groupSize": 2,
    "lookingFor": ["meet-people"],
    "vibeTags": ["energetic", "social", "foodies"],
    "tagline": "Always up for trying new things!",
    "leadName": "Bob",
    "leadEmail": "test-beta@example.com",
    "leadPhone": "+1234567891"
  }'
```

### Step 3: Verify Groups Were Stored

```bash
curl https://mandythegroupmatcher-production.up.railway.app/api/groups
```

**Expected Response:**
```json
{
  "success": true,
  "totalGroups": 2,
  "groups": [
    {
      "groupName": "Test Group Alpha",
      "id": "group_...",
      "size": 3,
      ...
    },
    {
      "groupName": "Test Group Beta",
      "id": "group_...",
      "size": 2,
      ...
    }
  ]
}
```

### Step 4: Run Matching Algorithm

```bash
curl -X POST https://mandythegroupmatcher-production.up.railway.app/api/match
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Matching completed successfully",
  "summary": {
    "totalGroups": 2,
    "totalMatches": 1,
    "bestMatch": {
      "group1": "Test Group Alpha",
      "group2": "Test Group Beta",
      "compatibility": 85,
      "breakdown": {
        "quantitative": 75,
        "qualitative": 90,
        "sizeMatch": 90
      }
    }
  },
  "emailStatus": {
    "sent": true,
    "emails": [
      {
        "group": "Test Group Alpha",
        "email": "test-alpha@example.com",
        "success": true
      },
      {
        "group": "Test Group Beta",
        "email": "test-beta@example.com",
        "success": true
      }
    ],
    "shareLink": "https://www.a1zap.com/chat/mandythematchmaker/{groupChatId}",
    "chatId": "{groupChatId}"
  }
}
```

### Step 5: Verify Share Link Format

The `shareLink` should:
- ✅ Start with the webapp base URL (e.g. `https://www.a1zap.com/chat/`)
- ✅ Include the agent slug (e.g., `mandythematchmaker`)
- ✅ Include a valid group chat ID (e.g. `group_...`)
- ✅ Be a clickable URL

### Step 6: Check Email Status

Verify that:
- ✅ `emailStatus.sent` is `true` (if emails were sent)
- ✅ `emailStatus.shareLink` is present and valid
- ✅ `emailStatus.chatId` is present
- ✅ Each email in `emailStatus.emails` has `success: true`

## What to Check

### ✅ Success Indicators

1. **Group Reception:**
   - Groups are saved with unique IDs
   - All fields are stored correctly
   - Groups can be retrieved via `/api/groups`

2. **Matching:**
   - Best match is found between groups
   - Compatibility score is calculated (0-100)
   - Match is saved to `data/matches.json`

3. **Chat Creation:**
   - Group chat is created via webapp API (`POST {A1ZAP_WEBAPP_URL}/api/agents/{agentId}/group-chat/create`)
   - Group chat ID is taken from response `chat.id`
   - Shareable link is constructed correctly
   - Link format: `{A1ZAP_WEBAPP_URL}/chat/{agentSlug}/{groupChatId}`

4. **Email Sending:**
   - Emails are sent to both groups
   - Email content includes:
     - Match notification
     - Compatibility score
     - Shareable link to join chat
   - Email status is returned in response

### ⚠️ Common Issues

1. **"Not enough groups" error:**
   - Make sure at least 2 groups are sent before running matching
   - Check `/api/groups` to verify groups were saved

2. **Email service not configured:**
   - Check that `MANDY_AGENT_ID` and `MANDY_API_KEY` are set
   - Verify API key has permission to send emails

3. **Chat creation failed:**
   - Ensure the webapp is reachable from the matcher (set `A1ZAP_WEBAPP_URL` if not using default)
   - Verify `MANDY_AGENT_ID` is the Convex agent ID (used in `/api/agents/{agentId}/group-chat/create`)
   - Check webapp response for `success: true` and `chat.id`

4. **Share link format incorrect:**
   - Verify `MANDY_AGENT_SLUG` matches your agent handle (e.g. `mandythematchmaker`)
   - Share links use `/chat/{agentSlug}/{groupChatId}` (not `/hybrid-chat/`)

## Using the Test Script

If you have `axios` installed:

```bash
# Test against production
TEST_URL=https://mandythegroupmatcher-production.up.railway.app node test-matching-flow.js

# Test against local server
TEST_URL=http://localhost:3000 node test-matching-flow.js
```

The test script will:
1. ✅ Check server health
2. ✅ Send both test groups
3. ✅ Verify groups were stored
4. ✅ Run matching algorithm
5. ✅ Check email status and share link
6. ✅ Verify matches were saved

## Manual Testing Checklist

- [ ] Server is running and accessible
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Group 1 data is received and saved
- [ ] Group 2 data is received and saved
- [ ] `/api/groups` shows both groups
- [ ] `/api/match` finds a match between groups
- [ ] Match has compatibility score > 0
- [ ] Email status includes `shareLink` and `chatId`
- [ ] Share link is in correct format
- [ ] Emails were sent (if configured)
- [ ] `/api/matches` shows the saved match
