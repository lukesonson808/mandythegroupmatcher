# Integration Format Guide

This document explains what format the `mandythegroupmatcher` server expects when receiving group data from the `a1zap-maker` server.

## Current Issues

The `a1zap-maker` server is currently:
1. ❌ Sending to the wrong endpoint: `/webhook/mandy` 
2. ❌ Wrapping data in a webhook format: `{ event: "group.profile.completed", groupData: {...}, timestamp: ... }`
3. ❌ Using field names that don't match what the server expects

## Required Changes

### 1. Change the Endpoint

**Current (WRONG):**
```typescript
const mandyServerUrl = process.env.MANDY_GROUP_MATCHER_WEBHOOK_URL || "https://mandythegroupmatcher-production.up.railway.app/webhook/mandy";
```

**Should be:**
```typescript
const mandyServerUrl = process.env.MANDY_GROUP_MATCHER_WEBHOOK_URL || "https://mandythegroupmatcher-production.up.railway.app/api/groups/receive";
```

### 2. Send Data Directly (Not Wrapped)

**Current (WRONG):**
```typescript
const mandyPayload = {
  event: "group.profile.completed",
  groupData: formData,
  timestamp: new Date().toISOString(),
};

const mandyResponse = await fetch(mandyServerUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(mandyPayload),
});
```

**Should be:**
```typescript
// Transform formData to match expected format
const mandyPayload = {
  // Required fields
  groupName: formData.groupName,
  email: formData.leadEmail, // or contactEmail
  memberEmails: formData.memberEmails || [formData.leadEmail], // Array of emails
  
  // Group size
  groupSize: formData.groupSize,
  
  // Looking for
  lookingFor: formData.lookingFor, // Array or string
  
  // Vibes (array of vibe tag IDs)
  vibes: formData.vibeTags, // Array like ["night-owls", "foodies", ...]
  
  // Optional metadata
  tagline: formData.tagline,
  leadName: formData.leadName,
  leadPhone: formData.leadPhone,
  house: formData.house,
  additionalInfo: formData.additionalInfo,
  
  // If you have a chatId, include it
  chatId: formData.chatId || null,
};

const mandyResponse = await fetch(mandyServerUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(mandyPayload), // Send directly, no wrapper
});
```

## Expected Field Format

The `mandythegroupmatcher` server accepts these field names (it tries multiple variations):

### Required Fields
- `name` OR `groupName` OR `group_name` ✅ (required)

### Optional but Recommended Fields
- `email` OR `contactEmail` OR `contact_email` - Lead contact email
- `memberEmails` OR `member_emails` OR `emails` OR `members` - Array of all member emails (for group chat creation)
- `groupSize` OR `size` OR `group_size` - Number of people in group
- `lookingFor` OR `looking_for` - What the group is looking for (string or array)
- `vibes` OR `preferences` - Array of vibe tags/preferences

### Field Mapping from a1zap-maker Form

| a1zap-maker Field | mandythegroupmatcher Field | Notes |
|------------------|---------------------------|-------|
| `formData.groupName` | `groupName` | ✅ Direct match |
| `formData.leadEmail` | `email` | Lead contact email |
| `formData.leadEmail` (or collect all) | `memberEmails` | Array of all member emails |
| `formData.groupSize` | `groupSize` | ✅ Direct match |
| `formData.lookingFor` | `lookingFor` | ✅ Direct match (array) |
| `formData.vibeTags` | `vibes` | Array of vibe tag IDs |
| `formData.tagline` | `tagline` | Stored in rawData |
| `formData.leadName` | `leadName` | Stored in rawData |
| `formData.leadPhone` | `leadPhone` | Stored in rawData |
| `formData.house` | `house` | Stored in rawData |

## Complete Example Transformation

Here's how to transform the formData in your `submit/route.ts`:

```typescript
// 3. Send to Mandy group matcher server
const mandyServerUrl = process.env.MANDY_GROUP_MATCHER_WEBHOOK_URL || 
  "https://mandythegroupmatcher-production.up.railway.app/api/groups/receive";
  
try {
  // Transform formData to match mandythegroupmatcher format
  const mandyPayload = {
    // Required
    groupName: formData.groupName,
    
    // Contact info
    email: formData.leadEmail,
    memberEmails: formData.memberEmails || [formData.leadEmail], // TODO: Collect all member emails if available
    
    // Group details
    groupSize: formData.groupSize,
    lookingFor: formData.lookingFor, // Array
    vibes: formData.vibeTags, // Array of vibe tag IDs
    
    // Additional info (stored in rawData)
    tagline: formData.tagline,
    leadName: formData.leadName,
    leadPhone: formData.leadPhone,
    house: formData.house,
    additionalInfo: formData.additionalInfo,
    
    // Optional: chatId if you have it
    chatId: formData.chatId || null,
  };

  const mandyResponse = await fetch(mandyServerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mandyPayload), // Send directly, no wrapper
  });

  if (mandyResponse.ok) {
    results.mandyServer.success = true;
  } else {
    const errorText = await mandyResponse.text();
    results.mandyServer.error = `Mandy server error: ${mandyResponse.status} - ${errorText}`;
  }
} catch (error: any) {
  results.mandyServer.error = error.message || "Failed to send to Mandy server";
}
```

## Important Notes

1. **Member Emails**: The server needs `memberEmails` as an array to create group chats. If you only have `leadEmail`, you can pass `[formData.leadEmail]` for now, but ideally collect all member emails.

2. **Vibes Format**: The `vibes` field should be an array of vibe tag IDs (e.g., `["night-owls", "foodies", "chill-vibes"]`), which matches what your form already collects.

3. **Looking For Format**: The `lookingFor` field can be an array (which your form already uses) or a string.

4. **No Wrapper**: Send the data directly as JSON, not wrapped in `{ event: "...", groupData: {...} }`.

5. **Response Format**: The server will return:
   ```json
   {
     "success": true,
     "message": "Group received and saved successfully",
     "group": {
       "name": "Group Name",
       "id": "generated-id",
       "email": "lead@example.com",
       "created": true
     }
   }
   ```

## Testing

After making these changes, you can test by:
1. Submitting a form through the a1zap-maker UI
2. Checking the mandythegroupmatcher logs to see if data was received
3. Calling `GET /api/groups` on mandythegroupmatcher to verify the group was saved
4. Running the matching algorithm via `GET/POST /api/match`
