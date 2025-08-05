#!/bin/bash

# Show exactly what curl sends
echo "Testing with hexdump to see exact bytes..."

# Use printf to ensure no shell interpretation
json='{"agentId":"character-c4d6907a-b76b-4729-b444-b2ba06d55133","messages":[{"role":"user","content":"Hello"}],"sessionId":"test-123"}'

echo "JSON string: $json"
echo "JSON hex dump:"
echo -n "$json" | hexdump -C

echo -e "\n\nSending request..."
curl -X POST https://typingmind-chatbot.webfonts.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.newcastleseo.com.au" \
  -d "$json" \
  -s | jq '.'