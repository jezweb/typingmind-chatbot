#!/bin/bash

echo "Testing Worker API endpoint..."

curl -X POST https://typingmind-chatbot.webfonts.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.newcastleseo.com.au" \
  -H "Referer: https://www.newcastleseo.com.au/" \
  -d '{
    "agentId": "character-c4d6907a-b76b-4729-b444-b2ba06d55133",
    "messages": [
      {"role": "user", "content": "Hello, can you help me with SEO?"}
    ],
    "sessionId": "test-session-123"
  }' \
  -v