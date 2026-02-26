#!/bin/bash

# Test script for the complete matching flow using curl
# Usage: ./test-flow.sh [BASE_URL]
# Example: ./test-flow.sh https://mandythegroupmatcher-production.up.railway.app

BASE_URL=${1:-"http://localhost:3000"}

echo "🧪 Testing Complete Matching Flow"
echo "=================================="
echo "📍 Testing against: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 0: Health check
echo "🏥 Step 0: Health check..."
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Server is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed, but continuing...${NC}"
fi

# Step 1: Send Group 1
echo ""
echo "📥 Step 1: Sending Group 1 data..."
GROUP1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/groups/receive" \
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
  }')

if echo "$GROUP1_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Group 1 received and saved${NC}"
    echo "$GROUP1_RESPONSE" | grep -o '"id":"[^"]*"' | head -1
else
    echo -e "${RED}❌ Failed to save Group 1${NC}"
    echo "$GROUP1_RESPONSE"
    exit 1
fi

# Step 2: Send Group 2
echo ""
echo "📥 Step 2: Sending Group 2 data..."
GROUP2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/groups/receive" \
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
  }')

if echo "$GROUP2_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Group 2 received and saved${NC}"
    echo "$GROUP2_RESPONSE" | grep -o '"id":"[^"]*"' | head -1
else
    echo -e "${RED}❌ Failed to save Group 2${NC}"
    echo "$GROUP2_RESPONSE"
    exit 1
fi

# Step 3: Check groups
echo ""
echo "📋 Step 3: Checking all groups..."
GROUPS_RESPONSE=$(curl -s "$BASE_URL/api/groups")
TOTAL_GROUPS=$(echo "$GROUPS_RESPONSE" | grep -o '"totalGroups":[0-9]*' | grep -o '[0-9]*')
echo -e "${GREEN}✅ Found $TOTAL_GROUPS groups${NC}"

# Step 4: Run matching
echo ""
echo "💕 Step 4: Running matching algorithm..."
echo "   This may take a moment (AI analysis)..."
MATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/match")

if echo "$MATCH_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Matching completed!${NC}"
    
    # Extract match summary
    BEST_MATCH=$(echo "$MATCH_RESPONSE" | grep -o '"bestMatch":{[^}]*}' | head -1)
    if [ -n "$BEST_MATCH" ]; then
        GROUP1=$(echo "$BEST_MATCH" | grep -o '"group1":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
        GROUP2=$(echo "$BEST_MATCH" | grep -o '"group2":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
        COMPAT=$(echo "$BEST_MATCH" | grep -o '"compatibility":[0-9]*' | grep -o '[0-9]*')
        echo "   Best Match: $GROUP1 ↔ $GROUP2"
        echo "   Compatibility: $COMPAT%"
    fi
else
    echo -e "${RED}❌ Matching failed${NC}"
    echo "$MATCH_RESPONSE"
    exit 1
fi

# Step 5: Check email status
echo ""
echo "📧 Step 5: Checking email and chat creation..."
EMAIL_STATUS=$(echo "$MATCH_RESPONSE" | grep -o '"emailStatus":{[^}]*}' | head -1)

if [ -n "$EMAIL_STATUS" ]; then
    SHARE_LINK=$(echo "$MATCH_RESPONSE" | grep -o '"shareLink":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
    CHAT_ID=$(echo "$MATCH_RESPONSE" | grep -o '"chatId":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
    
    if [ -n "$SHARE_LINK" ]; then
        echo -e "${GREEN}✅ Share Link: $SHARE_LINK${NC}"
        
        # Verify link format: path contains /chat/ (any host)
        if echo "$SHARE_LINK" | grep -q "/chat/"; then
            echo -e "${GREEN}   ✅ Share link format is correct (/chat/)${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Share link format may be incorrect (expected .../chat/{agentSlug}/{groupChatId})${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No share link generated${NC}"
    fi
    
    if [ -n "$CHAT_ID" ]; then
        echo -e "${GREEN}✅ Chat ID: $CHAT_ID${NC}"
    else
        echo -e "${YELLOW}⚠️  No chat ID generated${NC}"
    fi
    
    # Check if emails were sent
    SENT=$(echo "$MATCH_RESPONSE" | grep -o '"sent":[^,}]*' | grep -o '[^:]*$')
    if [ "$SENT" = "true" ]; then
        echo -e "${GREEN}✅ Emails sent successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Emails may not have been sent (check configuration)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No email status returned (no match found or email service not configured)${NC}"
fi

# Step 6: Check matches
echo ""
echo "📋 Step 6: Checking all saved matches..."
MATCHES_RESPONSE=$(curl -s "$BASE_URL/api/matches")
TOTAL_MATCHES=$(echo "$MATCHES_RESPONSE" | grep -o '"totalMatches":[0-9]*' | grep -o '[0-9]*')
echo -e "${GREEN}✅ Found $TOTAL_MATCHES saved matches${NC}"

echo ""
echo "=================================="
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "📝 Summary:"
echo "   ✅ Groups received and stored"
echo "   ✅ Matching algorithm executed"
echo "   ✅ Chat link created (if match found)"
echo "   ✅ Emails sent (if configured and match found)"
echo ""
echo "💡 Note: If emails failed, check that MANDY_AGENT_ID and MANDY_API_KEY are set"
echo "   If chat creation failed, ensure A1ZAP_WEBAPP_URL is reachable and MANDY_AGENT_ID is the Convex agent ID"
