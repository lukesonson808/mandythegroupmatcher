#!/bin/bash
cd "$(dirname "$0")"

# Kill any existing processes
echo "🧹 Cleaning up..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -f "localtunnel" 2>/dev/null

# Start server
echo "🚀 Starting server..."
npm start > /tmp/mandy-server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > /tmp/mandy-server.pid
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "⏳ Waiting for server to start..."
for i in {1..10}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is up!"
    break
  fi
  sleep 1
done

# Start localtunnel
echo "🌐 Starting localtunnel..."
npx localtunnel --port 3000 2>&1 | tee /tmp/localtunnel.log &
TUNNEL_PID=$!
echo $TUNNEL_PID > /tmp/localtunnel.pid

# Wait and show tunnel URL
sleep 5
echo ""
echo "=========================================="
echo "📋 TUNNEL INFORMATION"
echo "=========================================="
grep -i "your url is" /tmp/localtunnel.log || echo "Tunnel URL will appear in the logs..."
echo ""
echo "Server logs: tail -f /tmp/mandy-server.log"
echo "Tunnel logs: tail -f /tmp/localtunnel.log"
echo "=========================================="
