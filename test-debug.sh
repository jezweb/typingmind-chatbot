#!/bin/bash

# Test with escaped JSON to avoid shell interpretation
curl -X POST https://typingmind-chatbot.webfonts.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.newcastleseo.com.au" \
  --data-raw '{"agentId":"character-c4d6907a-b76b-4729-b444-b2ba06d55133","messages":[{"role":"user","content":"Hello"}],"sessionId":"test-123"}'