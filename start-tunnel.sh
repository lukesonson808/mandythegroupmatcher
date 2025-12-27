#!/bin/bash

# Start Mandy server with local tunnel for testing
# Usage: ./start-tunnel.sh

PORT=${PORT:-3000}

echo "🚀 Starting Mandy server on port $PORT..."
echo ""

# Start server in background
node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Check if server started successfully
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start!"
    exit 1
fi

echo "✅ Server started (PID: $SERVER_PID)"
echo ""
echo "🌐 Starting local tunnel..."
echo ""

# Start local tunnel
npx localtunnel --port $PORT --print-requests

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; exit" INT TERM

