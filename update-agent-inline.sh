#!/bin/bash

echo "Updating agent to inline mode..."

# Update the agent via API
curl -X PUT http://localhost:8787/admin/agents/character-c4d6907a-b76b-4729-b444-b2ba06d55133 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SEO Assistant Bot",
    "apiKey": "",
    "domains": ["newcastleseo.com.au", "*.newcastleseo.com.au", "localhost:8080"],
    "messagesPerHour": "100",
    "messagesPerSession": "30",
    "primaryColor": "#007bff",
    "position": "bottom-right",
    "width": "450",
    "embedMode": "inline"
  }'

echo ""
echo "Agent updated. Checking new configuration:"
curl -s http://localhost:8787/agent/character-c4d6907a-b76b-4729-b444-b2ba06d55133 | jq .