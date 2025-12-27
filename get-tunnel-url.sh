#!/bin/bash
echo "🔄 Getting fresh tunnel URL..."
pkill -f "localtunnel" 2>/dev/null
sleep 1
(npx localtunnel --port 3000 2>&1 | tee /tmp/lt-output.log) &
TUNNEL_PID=$!
sleep 8
URL=$(grep -i "your url is" /tmp/lt-output.log | tail -1 | sed 's/.*your url is: //' | tr -d '\r\n')
if [ ! -z "$URL" ]; then
  echo ""
  echo "✅ TUNNEL URL: $URL"
  echo "📋 WEBHOOK URL: $URL/webhook/mandy"
  echo ""
  echo "Tunnel PID: $TUNNEL_PID"
  echo "$TUNNEL_PID" > /tmp/localtunnel.pid
else
  echo "❌ Could not get tunnel URL. Check logs:"
  tail -20 /tmp/lt-output.log
fi
