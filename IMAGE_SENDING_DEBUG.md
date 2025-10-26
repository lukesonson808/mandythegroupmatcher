# Image Sending to A1Zap - Debug Guide

## ✅ Configuration Status

Your setup is **correctly configured**:

- **BASE_URL**: `https://a1base-demo-1.ngrok.app` ✅
- **Server**: Running and accessible ✅
- **Images**: Can be served from ngrok URL ✅
- **A1Zap API**: Configured with valid keys ✅

## 📝 Enhanced Logging

We've added comprehensive logging to track image sending. When a webhook processes an image, you'll now see:

### In the Webhook Handler (`makeup-artist-webhook.js`)

```
📸 Image saved and available at: https://...
Preparing to send image message...
  Chat ID: <chat_id>
  Test mode: false/true
  Image URL: https://...
  Message text: ...
🚀 Sending media message to A1Zap API...
```

### In the A1Zap Client (`a1zap-client.js`)

```
📤 A1Zap API Request Details:
   URL: https://api.a1zap.com/v1/messages/individual/<agent_id>/send
   Chat ID: <chat_id>
   Media URL: https://...
   Content length: XXX chars
   Payload: {
     "chatId": "...",
     "content": "...",
     "media": {
       "url": "https://...",
       "contentType": "image/png"
     },
     "metadata": {
       "source": "gemini-webhook-agent",
       "messageType": "image"
     }
   }
✅ Media message sent to A1Zap: {...}
   Status: 200 OK
```

## 🔍 What to Check in Your Logs

When testing the makeup artist agent, look for:

1. **Is the image being generated?**
   - Look for: `📸 Image saved and available at:`
   - If missing: Check Gemini API response

2. **Is test mode preventing sends?**
   - Look for: `Test mode: true`
   - If true and you want to send: Make sure chat ID doesn't start with "test-"

3. **Is the API call being made?**
   - Look for: `🚀 Sending media message to A1Zap API...`
   - If missing: Check if test mode is blocking

4. **What's the API response?**
   - Look for: `✅ Media message sent to A1Zap`
   - If error: Check the error details logged below

## 🧪 Test Scripts

We've created test scripts to verify your setup:

### 1. Test BASE_URL Configuration
```bash
node tests/test-image-url-generation.js
```

### 2. Test Image Saving and URL Generation
```bash
node tests/test-send-image.js
```

### 3. Test ngrok Accessibility
```bash
node tests/verify-ngrok-access.js
```

### 4. Test with Real API (sends actual message)
```bash
SEND_REAL_MESSAGE=true node tests/test-send-image.js
```

## 🚨 Common Issues

### Issue: "Test mode: Skipping A1Zap send"
**Cause**: Chat ID starts with "test-"  
**Solution**: Use a real chat ID or remove the test mode check

### Issue: Images not appearing in chat
**Possible causes**:
1. ngrok URL not accessible from A1Zap servers (firewall/timeout)
2. Image URL format incorrect
3. A1Zap API rejecting the request

**Debug steps**:
1. Check server logs for full API request/response
2. Verify image URL is accessible: `curl <image_url>`
3. Check A1Zap API documentation for any changes

### Issue: "Error sending media message to A1Zap"
**Debug steps**:
1. Check the error status code and message in logs
2. Verify A1Zap API key is valid
3. Verify agent ID is correct
4. Check if A1Zap API is experiencing issues

## 📋 Correct Message Format for A1Zap

Based on the reference app you provided, the format is:

```json
{
  "chatId": "chat_id_here",
  "content": "Your text message here",
  "media": {
    "url": "https://url-to-image.png",
    "contentType": "image/png"
  },
  "metadata": {
    "source": "gemini-webhook-agent",
    "messageType": "image"
  }
}
```

This matches what we're sending. ✅

## 🎯 Next Steps

1. **Restart your server** to enable the new logging:
   ```bash
   # Stop current server (Ctrl+C)
   node server.js
   ```

2. **Send a test image** through your makeup artist webhook

3. **Check the logs** for the detailed output

4. **Look for any errors** in the A1Zap API response

The enhanced logging will show you exactly:
- What URL is being generated
- What payload is being sent to A1Zap
- What response A1Zap returns
- Any errors that occur

## 📞 If Images Still Don't Appear

With the enhanced logging, you'll be able to see:
- If the request is reaching A1Zap (look for HTTP 200 response)
- If A1Zap is accepting the image URL
- If there are any validation errors from A1Zap

Share the relevant log output and we can diagnose further!

