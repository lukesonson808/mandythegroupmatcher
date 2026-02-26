# End-to-End Flow Verification

## Complete Flow: From Form Submission to Match Notification

### ✅ Step 1: User Submits Form (a1zap-maker)

**Location:** `a1zap-maker/src/app/harvard/mandy/join/client-page.tsx`

**Data Collected:**
- ✅ `groupName` - Group name
- ✅ `tagline` - Group tagline
- ✅ `vibeTags` - Array of vibe tag IDs
- ✅ `lookingFor` - Array of what they're looking for
- ✅ `groupSize` - Number of people
- ✅ `leadName` - Lead's name
- ✅ `leadEmail` - Lead's email
- ✅ `leadPhone` - Lead's phone
- ✅ `memberEmails` - Array of all member emails (NEW - just added)
- ✅ `house` - Harvard house (optional)
- ✅ `additionalInfo` - Additional info (optional)

**Form submits to:** `/api/harvard/mandy/submit`

---

### ✅ Step 2: Transform and Send (a1zap-maker)

**Location:** `a1zap-maker/src/app/api/harvard/mandy/submit/route.ts`

**What happens:**
1. ✅ Validates required fields (groupName, leadEmail, leadPhone, leadName)
2. ✅ Combines lead email + member emails into `allMemberEmails` array
3. ✅ Transforms data to match mandythegroupmatcher format:
   ```typescript
   {
     groupName: formData.groupName,
     email: formData.leadEmail,
     memberEmails: allMemberEmails, // [leadEmail, ...memberEmails]
     groupSize: formData.groupSize,
     lookingFor: formData.lookingFor,
     vibes: formData.vibeTags, // ✅ Sends as 'vibes'
     vibeTags: formData.vibeTags, // ✅ Also sends as 'vibeTags' for compatibility
     // ... other fields
   }
   ```
4. ✅ Sends to: `https://mandythegroupmatcher-production.up.railway.app/api/groups/receive`
5. ✅ Sends data directly (no wrapper)
6. ✅ Logs success/failure

---

### ✅ Step 3: Receive and Store (mandythegroupmatcher)

**Location:** `mandythegroupmatcher/server.js` - `/api/groups/receive`

**What happens:**
1. ✅ Receives POST request at `/api/groups/receive`
2. ✅ Validates: `groupName` or `name` field exists
3. ✅ Transforms data to internal format:
   - ✅ Maps `groupName` / `name` → `groupName`
   - ✅ Maps `email` / `contactEmail` → `email`
   - ✅ Maps `memberEmails` / `member_emails` / `emails` → `memberEmails`
   - ✅ Maps `groupSize` / `size` → `answers.question2`
   - ✅ Maps `vibes` / `vibeTags` → `vibes` ✅
   - ✅ Maps `lookingFor` → `lookingFor` and `answers.question3`
   - ✅ Stores all data in `rawData` for reference
4. ✅ Checks if group exists (by groupName)
5. ✅ Creates new profile OR updates existing
6. ✅ Saves to `data/group-profiles.json`
7. ✅ Returns success response with group ID

**Expected Log:**
```
📥 [Groups] Received group data from main server
✨ [Groups] Creating new group: Test_1
```

---

### ✅ Step 4: Run Matching (mandythegroupmatcher)

**Location:** `mandythegroupmatcher/server.js` - `/api/match`

**What happens:**
1. ✅ Retrieves all groups from storage
2. ✅ Validates at least 2 groups exist
3. ✅ Runs matching algorithm:
   - ✅ Quantitative scoring (group size, interests)
   - ✅ AI qualitative analysis (compatibility)
   - ✅ Finds best match
   - ✅ Finds top matches for each group
4. ✅ Saves matches to `data/matches.json`
5. ✅ For best match:
   - ✅ Calls `emailService.sendMatchNotification()`
   - ✅ Creates group chat via webapp API
   - ✅ Extracts group chat ID from response
   - ✅ Generates shareable link
   - ✅ Sends emails to both groups
6. ✅ Returns match results with email status

---

### ✅ Step 5: Create Chat and Send Emails (mandythegroupmatcher)

**Location:** `mandythegroupmatcher/services/email-service.js`

**What happens:**
1. ✅ **Create Chat:**
   - ✅ Calls `POST {A1ZAP_WEBAPP_URL}/api/agents/{agentId}/group-chat/create`
   - ✅ Extracts `chat.id` (group chat external ID) from response
   - ✅ Constructs shareable link: `{A1ZAP_WEBAPP_URL}/chat/{agentSlug}/{groupChatId}`
   - ✅ On failure, does not send a synthetic link; email uses fallback CTA to Mandy page

2. ✅ **Send Emails:**
   - ✅ Uses `/v1/agents/{agentId}/emails/send` endpoint
   - ✅ Uses `A1ZAP_API_KEY` from config
   - ✅ Sends to both groups with:
     - Match notification
     - Compatibility score
     - Shareable link to join group chat
   - ✅ Returns success/failure status

---

## Data Flow Summary

```
User fills form
    ↓
a1zap-maker: /api/harvard/mandy/submit
    ↓ (transforms data)
POST https://mandythegroupmatcher-production.up.railway.app/api/groups/receive
    ↓ (validates & stores)
mandythegroupmatcher: saves to group-profiles.json
    ↓
Admin runs: GET/POST /api/match
    ↓ (finds matches)
mandythegroupmatcher: creates chat + sends emails
    ↓
Both groups receive email with shareable link
    ↓
Groups click link → join group chat → Mandy helps break the ice
```

---

## Field Mapping Verification

| a1zap-maker sends | mandythegroupmatcher receives | Status |
|------------------|-------------------------------|--------|
| `groupName` | `groupName` ✅ | ✅ Works |
| `leadEmail` | `email` ✅ | ✅ Works |
| `allMemberEmails` | `memberEmails` ✅ | ✅ Works |
| `groupSize` | `groupSize` → `answers.question2` ✅ | ✅ Works |
| `vibeTags` | `vibes` ✅ | ✅ Works |
| `lookingFor` | `lookingFor` + `answers.question3` ✅ | ✅ Works |
| `tagline`, `leadName`, etc. | Stored in `rawData` ✅ | ✅ Works |

---

## Potential Issues Check

### ✅ Endpoint
- **a1zap-maker sends to:** `/api/groups/receive` ✅
- **mandythegroupmatcher receives at:** `/api/groups/receive` ✅
- **Status:** ✅ CORRECT

### ✅ Data Format
- **a1zap-maker sends:** Direct JSON (no wrapper) ✅
- **mandythegroupmatcher expects:** Direct JSON ✅
- **Status:** ✅ CORRECT

### ✅ Field Names
- **vibes:** Sends both `vibes` and `vibeTags` ✅
- **Server accepts:** Both `vibes` and `vibeTags` ✅
- **Status:** ✅ CORRECT

### ✅ Member Emails
- **a1zap-maker:** Collects in form, combines with lead email ✅
- **mandythegroupmatcher:** Receives as `memberEmails` array ✅
- **Status:** ✅ CORRECT

### ✅ Email Service
- **Uses:** `A1ZAP_API_KEY` from config ✅
- **Uses:** `MANDY_AGENT_ID` from config (Convex agent ID) ✅
- **Creates chat:** Via webapp `POST /api/agents/{agentId}/group-chat/create` ✅
- **Share link format:** `{A1ZAP_WEBAPP_URL}/chat/{agentSlug}/{groupChatId}` ✅
- **Sends emails:** Via email API ✅
- **Status:** ✅ CORRECT (if env vars are set)

---

## Final Verification

### ✅ Everything Should Work If:

1. **a1zap-maker is deployed** with updated code
2. **mandythegroupmatcher is running** on Railway
3. **Environment variables are set:**
   - `MANDY_AGENT_ID` (or in config) — Convex agent ID for group-chat create
   - `A1ZAP_API_KEY` (or in config)
   - `A1ZAP_WEBAPP_URL` (optional, default `https://www.a1zap.com`) — webapp base for chat create and share links
   - `CLAUDE_API_KEY` (for matching)
   - `MANDY_AGENT_SLUG` (optional, defaults to 'mandythematchmaker')
   - `YELP_API_KEY` (optional, for activity planning)

### ✅ Expected Behavior:

1. **Group signs up** → Data sent to `/api/groups/receive` ✅
2. **Group saved** → Appears in `/api/groups` ✅
3. **Run matching** → `/api/match` finds matches ✅
4. **Chat created** → Webapp group-chat API called, groupChatId extracted ✅
5. **Emails sent** → Both groups receive notification with link ✅
6. **Groups click link** → Join group chat, Mandy helps break ice ✅

---

## Summary

**✅ YES - Everything should work end-to-end!**

All the pieces are in place:
- ✅ Correct endpoints
- ✅ Correct data format
- ✅ Field mapping works
- ✅ Member emails collected
- ✅ Chat creation implemented
- ✅ Email sending configured
- ✅ Error handling in place

The only requirement is that environment variables are set on the mandythegroupmatcher server.
