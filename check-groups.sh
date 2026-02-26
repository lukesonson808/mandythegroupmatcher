#!/bin/bash

# Script to check if groups were received from the a1zap-maker server
# Usage: ./check-groups.sh

BASE_URL="${MANDY_SERVER_URL:-https://mandythegroupmatcher-production.up.railway.app}"

echo "🔍 Checking for received groups..."
echo "📍 Server: $BASE_URL"
echo ""

# Check health first
echo "🏥 Checking server health..."
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Server is healthy"
else
    echo "⚠️  Health check failed, but continuing..."
fi

echo ""
echo "📋 Fetching all groups..."

# Get all groups
GROUPS_RESPONSE=$(curl -s "$BASE_URL/api/groups" 2>/dev/null)

if [ -z "$GROUPS_RESPONSE" ]; then
    echo "❌ No response from server"
    echo "   Check if server is running and accessible"
    exit 1
fi

# Check if we got valid JSON
if echo "$GROUPS_RESPONSE" | grep -q "totalGroups"; then
    TOTAL_GROUPS=$(echo "$GROUPS_RESPONSE" | grep -o '"totalGroups":[0-9]*' | grep -o '[0-9]*')
    echo ""
    echo "📊 Results:"
    echo "   Total Groups: ${TOTAL_GROUPS:-0}"
    
    if [ "${TOTAL_GROUPS:-0}" -gt 0 ]; then
        echo ""
        echo "✅ Found $TOTAL_GROUPS group(s):"
        echo ""
        
        # Extract group names
        echo "$GROUPS_RESPONSE" | grep -o '"groupName":"[^"]*"' | sed 's/"groupName":"//;s/"//' | while read -r name; do
            if [ -n "$name" ]; then
                echo "   • $name"
            fi
        done
        
        # Check for Test_1 specifically
        if echo "$GROUPS_RESPONSE" | grep -qi "test_1"; then
            echo ""
            echo "✅ Found 'Test_1' group!"
        else
            echo ""
            echo "⚠️  'Test_1' group not found in the list"
        fi
        
        echo ""
        echo "Full response:"
        echo "$GROUPS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$GROUPS_RESPONSE"
    else
        echo ""
        echo "❌ No groups found in the system"
        echo ""
        echo "💡 This could mean:"
        echo "   1. Groups were not sent from a1zap-maker server"
        echo "   2. Groups were sent but not received (check endpoint)"
        echo "   3. Groups were sent to wrong endpoint"
        echo ""
        echo "📝 To check if groups were sent, verify:"
        echo "   - a1zap-maker is sending to: /api/groups/receive"
        echo "   - Data format matches INTEGRATION_FORMAT.md"
        echo "   - Server logs show '📥 [Groups] Received group data'"
    fi
else
    echo "❌ Invalid response from server:"
    echo "$GROUPS_RESPONSE"
fi
