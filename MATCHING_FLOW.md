# Complete Matching Flow Documentation

## Overview
This document explains the complete flow from receiving group data to matching groups and sending notifications.

## Flow Steps

### Step 1: Receive Group Data
**Endpoint:** `POST /api/groups/receive`

**What happens:**
1. Main A1Zap server sends group data to this endpoint
2. Data is transformed to match expected format
3. Group is saved or updated in storage
4. Returns success confirmation

**Example Request:**
```json
{
  "name": "Group Alpha",
  "email": "group-alpha@example.com",
  "memberEmails": ["member1@example.com", "member2@example.com"],
  "size": 2,
  "idealDay": "Going to the beach",
  "musicTaste": "Indie rock",
  "vibes": "chill, adventurous",
  "lookingFor": "fun activities"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Group received and saved successfully",
  "group": {
    "name": "Group Alpha",
    "id": "group_1234567890_abc123",
    "email": "group-alpha@example.com",
    "created": true
  }
}
```

---

### Step 2: Run Matching (Manual)
**Endpoint:** `GET/POST /api/match`

**What happens:**
1. Retrieves all groups from storage
2. Runs matching algorithm comparing all groups:
   - **Group Size Similarity** (40% weight)
   - **Music Taste Similarity** (25% weight)
   - **Activity/Interest Similarity** (25% weight)
   - **Emoji/Vibe Similarity** (10% weight)
   - **AI-Powered Qualitative Analysis** (60% weight)
3. Finds best overall match
4. Creates group chat link via A1Zap API
5. Sends emails to both matched groups with:
   - Match notification
   - Compatibility score
   - Shareable group chat link
6. Saves match record
7. Returns results

**Response:**
```json
{
  "success": true,
  "message": "Matching completed successfully",
  "summary": {
    "totalGroups": 5,
    "totalMatches": 10,
    "bestMatch": {
      "group1": "Group Alpha",
      "group2": "Group Beta",
      "compatibility": 85,
      "breakdown": {
        "quantitative": 80,
        "qualitative": 88,
        "sizeMatch": 90
      }
    }
  },
  "emailStatus": {
    "sent": true,
    "emails": [
      {
        "group": "Group Alpha",
        "email": "group-alpha@example.com",
        "success": true
      },
      {
        "group": "Group Beta",
        "email": "group-beta@example.com",
        "success": true
      }
    ],
    "shareLink": "https://www.a1zap.com/chat/mandythematchmaker/group_1234567890_abc123",
    "chatId": "group_1234567890_abc123"
  }
}
```

---

### Step 3: Groups Receive Email
**What happens:**
1. Both groups receive an email with:
   - Match notification
   - Their matched group name
   - Compatibility score
   - **Shareable group chat link** (button + text link)
   - Instructions to join

**Email Content:**
- Subject: "🎉 You've been matched with [Other Group]!"
- HTML email with styled button
- Plain text fallback
- Shareable link to join group chat

---

### Step 4: Groups Join Chat
**What happens:**
1. Members from both groups click the shareable link
2. They join the same A1Zap group chat
3. Mandy is already in the chat (via webhook setup)
4. Mandy helps break the ice and plan activities

---

## Data Flow Diagram

```
Main A1Zap Server
    ↓
POST /api/groups/receive
    ↓
Group Data Stored
    ↓
[Manual Trigger]
    ↓
GET/POST /api/match
    ↓
Matching Algorithm Runs
    ↓
Best Match Found
    ↓
Group Chat Created (A1Zap API)
    ↓
Emails Sent to Both Groups
    ↓
Groups Click Link → Join Chat
    ↓
Mandy Helps in Chat
```

---

## Testing the Flow

### Option 1: Use Test Script
```bash
node test-matching-flow.js
```

### Option 2: Manual Testing

1. **Send Group 1:**
```bash
curl -X POST https://mandythegroupmatcher-production.up.railway.app/api/groups/receive \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Group 1",
    "email": "test1@example.com",
    "memberEmails": ["member1@example.com"],
    "size": 3,
    "idealDay": "Beach day",
    "musicTaste": "Rock"
  }'
```

2. **Send Group 2:**
```bash
curl -X POST https://mandythegroupmatcher-production.up.railway.app/api/groups/receive \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Group 2",
    "email": "test2@example.com",
    "memberEmails": ["member2@example.com"],
    "size": 3,
    "idealDay": "City exploration",
    "musicTaste": "Pop"
  }'
```

3. **Run Matching:**
```bash
curl -X POST https://mandythegroupmatcher-production.up.railway.app/api/match
```

---

## Important Notes

1. **Member Emails:** The system stores `memberEmails` array to add all individuals to the group chat
2. **Group Chat Creation:** Uses A1Zap API to create shareable links
3. **Email Service:** Requires `MANDY_AGENT_ID` and `MANDY_API_KEY` environment variables
4. **Matching Threshold:** Currently matches all groups, but you can add a minimum compatibility threshold

---

## Troubleshooting

### Groups not matching?
- Check that you have at least 2 groups: `GET /api/groups`
- Verify groups have required data (size, interests, etc.)

### Emails not sending?
- Check `MANDY_AGENT_ID` and `MANDY_API_KEY` are set
- Verify groups have email addresses
- Check server logs for email service errors

### Group chat link not working?
- Verify A1Zap API endpoint for group chat creation
- Check that member emails are being passed correctly
- Fallback link format may need adjustment based on A1Zap's actual API
