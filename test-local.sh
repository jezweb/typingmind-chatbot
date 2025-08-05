#!/bin/bash

# Kill any existing wrangler dev process
pkill -f "wrangler dev" 2>/dev/null

echo "Starting wrangler dev in background..."
wrangler dev --port 8787 > wrangler.log 2>&1 &
WRANGLER_PID=$!

# Wait for wrangler to start
sleep 5

echo "Testing local worker..."

# Test the local worker
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.newcastleseo.com.au" \
  -H "Referer: https://www.newcastleseo.com.au/" \
  -d '{
    "agentId": "character-c4d6907a-b76b-4729-b444-b2ba06d55133",
    "messages": [
      {"role": "user", "content": "Hello, can you help me with SEO?"}
    ],
    "sessionId": "test-session-123"
  }' | jq '.'

echo -e "\n\nWrangler logs:"
cat wrangler.log | grep -E "(error|Error|ERROR)" || echo "No errors found"

# Kill wrangler dev
kill $WRANGLER_PID 2>/dev/null